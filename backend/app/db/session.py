"""Database engine and request-scoped session dependency.

The engine is created lazily so the API process (and /health) can start even when
the database is not reachable yet.
"""

from collections.abc import Iterator
from functools import lru_cache

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings


@lru_cache
def get_engine() -> Engine:
    return create_engine_for(str(get_settings().database_url))


def create_engine_for(url: str) -> Engine:
    # Pin the session time zone so timestamps are always returned in UTC,
    # regardless of the database server's configuration.
    return create_engine(
        url,
        pool_pre_ping=True,
        connect_args={"options": "-c timezone=UTC", "connect_timeout": 10},
    )


@lru_cache
def get_session_factory() -> sessionmaker[Session]:
    return sessionmaker(bind=get_engine(), autoflush=False, expire_on_commit=False)


def get_db() -> Iterator[Session]:
    """FastAPI dependency that yields a session and always closes it."""
    session = get_session_factory()()
    try:
        yield session
    finally:
        session.close()
