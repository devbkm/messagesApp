"""Message endpoints. Thin HTTP layer: identity and validation in, services do the work."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Path, Request, Response, status
from sqlalchemy.orm import Session

from app.core.identity import CurrentUser, get_current_user
from app.db.session import get_db
from app.schemas.error import error_responses
from app.schemas.message import MessageCreate, MessageList, MessageRead, MessageSummary
from app.services import messages as message_service

DbSession = Annotated[Session, Depends(get_db)]
Owner = Annotated[CurrentUser, Depends(get_current_user)]
MessageId = Annotated[uuid.UUID, Path(description="The message id (UUID).")]

router = APIRouter(
    prefix="/messages",
    tags=["messages"],
    responses=error_responses(401, 422, 503),
)


@router.get(
    "",
    response_model=MessageList,
    summary="List the current user's messages",
    description="Returns only the caller's messages, newest first.",
)
def list_messages(db: DbSession, owner: Owner) -> MessageList:
    messages = message_service.list_messages(db, owner)
    return MessageList(items=[MessageSummary.from_model(m) for m in messages])


@router.get(
    "/{message_id}",
    response_model=MessageRead,
    summary="Get one of the current user's messages",
    responses=error_responses(404, 422),
)
def get_message(message_id: MessageId, db: DbSession, owner: Owner) -> MessageRead:
    return MessageRead.from_model(message_service.get_message(db, owner, message_id))


@router.post(
    "",
    response_model=MessageRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a message for the current user",
    description=(
        "The server assigns `id`, the owner and `created_at`. Sending any of them, or "
        "any other unknown field, is rejected with 422."
    ),
    responses={
        **error_responses(422),
        201: {"description": "Created. `Location` points to the new message."},
    },
)
def create_message(
    data: MessageCreate, request: Request, response: Response, db: DbSession, owner: Owner
) -> MessageRead:
    message = message_service.create_message(db, owner, data)
    response.headers["Location"] = str(request.url_for("get_message", message_id=message.id))
    return MessageRead.from_model(message)


@router.delete(
    "/{message_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete one of the current user's messages",
    responses={**error_responses(404, 422), 204: {"description": "Deleted."}},
)
def delete_message(message_id: MessageId, db: DbSession, owner: Owner) -> Response:
    message_service.delete_message(db, owner, message_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
