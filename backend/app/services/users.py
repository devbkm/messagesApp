import uuid

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.models import User


def get_or_create_user(db: Session, user_id: uuid.UUID) -> User:
    """Return the user with ``user_id``, creating it on first use.

    ``ON CONFLICT DO NOTHING`` makes this safe when two first requests for the same
    user arrive concurrently.
    """
    db.execute(insert(User).values(id=user_id).on_conflict_do_nothing(index_elements=[User.id]))
    user = db.scalars(select(User).where(User.id == user_id)).one()
    db.commit()
    return user
