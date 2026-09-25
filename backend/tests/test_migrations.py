"""The accounts migration preserves data created before sign-up existed.

Runs on its own database (``<test db>_migrations``) so it can move the schema up and
down without affecting the shared test database.
"""

import uuid
from collections.abc import Iterator

import pytest
from alembic import command
from sqlalchemy import Engine, make_url, text
from sqlalchemy.exc import OperationalError

from app.db.session import create_engine_for
from tests.conftest import TEST_DATABASE_URL, _alembic_config, _ensure_database_exists

BEFORE_ACCOUNTS = "867411616f93"
MIGRATION_DB_URL = (
    make_url(TEST_DATABASE_URL)
    .set(database=f"{make_url(TEST_DATABASE_URL).database}_migrations")
    .render_as_string(False)
)


@pytest.fixture
def migration_engine() -> Iterator[Engine]:
    try:
        _ensure_database_exists(MIGRATION_DB_URL)
    except OperationalError:
        pytest.skip("PostgreSQL is not reachable; start it with `docker compose up -d db`.")
    config = _alembic_config(MIGRATION_DB_URL)
    command.downgrade(config, "base")
    command.upgrade(config, BEFORE_ACCOUNTS)
    engine = create_engine_for(MIGRATION_DB_URL)
    yield engine
    engine.dispose()
    command.downgrade(config, "base")


def test_existing_users_and_messages_survive_the_accounts_migration(
    migration_engine: Engine,
) -> None:
    config = _alembic_config(MIGRATION_DB_URL)
    legacy_user = uuid.uuid4()
    with migration_engine.begin() as conn:
        conn.execute(text("INSERT INTO users (id) VALUES (:id)"), {"id": legacy_user})
        conn.execute(
            text("INSERT INTO messages (user_id, subject, text) VALUES (:u, 'Old note', 'Kept')"),
            {"u": legacy_user},
        )

    command.upgrade(config, "head")

    with migration_engine.connect() as conn:
        user = conn.execute(
            text("SELECT name, email, password_hash, updated_at FROM users WHERE id = :id"),
            {"id": legacy_user},
        ).one()
        message = conn.execute(
            text("SELECT user_id, subject, text, updated_at FROM messages")
        ).one()
    # The account keeps its id and messages; it simply has no credentials yet.
    assert user.name is None and user.email is None and user.password_hash is None
    assert user.updated_at is not None
    assert message.user_id == legacy_user
    assert (message.subject, message.text) == ("Old note", "Kept")
    assert message.updated_at is not None

    # Downgrading removes only what the migration added; the data is still there.
    command.downgrade(config, BEFORE_ACCOUNTS)
    with migration_engine.connect() as conn:
        assert conn.execute(text("SELECT count(*) FROM messages")).scalar() == 1
        assert conn.execute(text("SELECT to_regclass('sessions')")).scalar() is None
