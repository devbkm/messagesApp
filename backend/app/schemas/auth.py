import uuid
from datetime import datetime
from typing import Annotated

from pydantic import (
    AfterValidator,
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    StringConstraints,
    ValidationInfo,
    field_validator,
)

from app.models.user import EMAIL_MAX_LENGTH, NAME_MAX_LENGTH

PASSWORD_MIN_LENGTH = 8
# Bounded so hashing cost cannot be abused with huge inputs.
PASSWORD_MAX_LENGTH = 128


def _normalise_email(value: str) -> str:
    return value.strip().lower()


def _single_line_name(value: str) -> str:
    if any(ord(char) < 0x20 or 0x7F <= ord(char) <= 0x9F for char in value):
        raise ValueError("Name must be a single line without control characters")
    return value


Email = Annotated[
    EmailStr,
    Field(max_length=EMAIL_MAX_LENGTH, examples=["ada@example.com"]),
    AfterValidator(_normalise_email),
]
Name = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=NAME_MAX_LENGTH),
    AfterValidator(_single_line_name),
    Field(examples=["Ada Lovelace"]),
]
NewPassword = Annotated[
    str,
    Field(
        min_length=PASSWORD_MIN_LENGTH,
        max_length=PASSWORD_MAX_LENGTH,
        description=f"{PASSWORD_MIN_LENGTH}-{PASSWORD_MAX_LENGTH} characters.",
    ),
]


class SignupRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: Name
    email: Email
    password: NewPassword
    password_confirmation: str = Field(max_length=PASSWORD_MAX_LENGTH)

    @field_validator("password_confirmation")
    @classmethod
    def passwords_match(cls, value: str, info: ValidationInfo) -> str:
        # Reported on the confirmation field so clients can show it next to that input.
        if "password" in info.data and value != info.data["password"]:
            raise ValueError("Passwords do not match")
        return value


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: Annotated[str, AfterValidator(_normalise_email), Field(min_length=1, max_length=320)]
    # Not length-checked against the sign-up policy: a wrong password is simply wrong.
    password: str = Field(min_length=1, max_length=PASSWORD_MAX_LENGTH)


class UserRead(BaseModel):
    """The signed-in user. Never includes the password hash."""

    id: uuid.UUID
    name: str
    email: str
    created_at: datetime


class AuthResponse(BaseModel):
    user: UserRead
    token: str | None = Field(
        default=None,
        description=(
            "Session token for `Authorization: Bearer` (native clients). Omitted when the "
            "request used `X-Auth-Transport: cookie`; the token is then set as an httpOnly cookie."
        ),
    )
    expires_at: datetime
