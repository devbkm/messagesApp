"""SQLAlchemy ORM models. Import models here so Alembic autogenerate can discover them."""

from app.db.base import Base

__all__ = ["Base"]
