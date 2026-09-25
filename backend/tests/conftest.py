"""Shared fixtures.

Database tests run against a dedicated ``inbox_test`` database (created on demand)
so they never touch development data. The schema is built with the real Alembic
migrations, and each test runs inside a transaction that is rolled back afterwards.

Override the target with ``TEST_DATABASE_URL``. If PostgreSQL is not reachable, the
database tests are skipped with an explanatory message; the rest still run.
"""

import os
from collections.abc import Iterator
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import Engine, make_url, text
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql+psycopg://inbox:inbox_dev_password@127.0.0.1:5432/inbox_test",
)

# Tests must never depend on a developer's real .env.
os.environ["DATABASE_URL"] = TEST_DATABASE_URL
os.environ.setdefault("ENVIRONMENT", "test")

from app.db.session import create_engine_for, get_db  # noqa: E402  (needs the env vars above)
from app.main import create_app  # noqa: E402

BACKEND_DIR = Path(__file__).resolve().parents[1]


def _ensure_database_exists(url: str) -> None:
    target = make_url(url)
    admin = create_engine_for(target.set(database="postgres").render_as_string(False))
    try:
        with admin.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
            exists = conn.execute(
                text("SELECT 1 FROM pg_database WHERE datname = :name"),
                {"name": target.database},
            ).scalar()
            if not exists:
                # The name comes from our own configuration, not user input.
                conn.execute(text(f'CREATE DATABASE "{target.database}"'))
    finally:
        admin.dispose()


def _alembic_config(url: str) -> Config:
    config = Config(str(BACKEND_DIR / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    config.attributes["url"] = url
    config.attributes["configure_logger"] = False
    return config


@pytest.fixture(scope="session", autouse=True)
def fast_password_hashing() -> Iterator[None]:
    """Use cheap Argon2 parameters in tests.

    Production uses the library's recommended (deliberately slow) parameters; the test
    suite signs up many users, so it swaps in a fast hasher. Hashing still goes through
    the same code path and format.
    """
    from argon2 import PasswordHasher

    from app.core import security

    original = (security._hasher, security._DUMMY_HASH)
    security._hasher = PasswordHasher(time_cost=1, memory_cost=1024, parallelism=1)
    security._DUMMY_HASH = security._hasher.hash("dummy-password")
    yield
    security._hasher, security._DUMMY_HASH = original


@pytest.fixture(scope="session")
def db_engine() -> Iterator[Engine]:
    try:
        _ensure_database_exists(TEST_DATABASE_URL)
    except OperationalError as exc:
        pytest.skip(
            "PostgreSQL is not reachable; start it with `docker compose up -d db`. "
            f"({exc.orig.__class__.__name__})"
        )

    config = _alembic_config(TEST_DATABASE_URL)
    # Start from nothing and exercise the full migration path, including downgrade.
    command.downgrade(config, "base")
    command.upgrade(config, "head")
    command.downgrade(config, "base")
    command.upgrade(config, "head")

    engine = create_engine_for(TEST_DATABASE_URL)
    yield engine
    engine.dispose()


@pytest.fixture
def db(db_engine: Engine) -> Iterator[Session]:
    """A session whose work (including ``commit()``) is rolled back after the test."""
    connection = db_engine.connect()
    transaction = connection.begin()
    session = Session(bind=connection, join_transaction_mode="create_savepoint")
    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()


@pytest.fixture
def client(db: Session) -> Iterator[TestClient]:
    """API client whose requests share the rolled-back test session."""
    app = create_app()
    app.dependency_overrides[get_db] = lambda: db
    with TestClient(app) as test_client:
        yield test_client
