"""Password hashing and session tokens.

- Passwords are hashed with Argon2id (memory-hard, salted per hash). Only the hash is
  stored; the raw password is never persisted or logged.
- Session tokens are 256-bit random values handed to the client once. The database
  stores only their SHA-256 digest, so a database leak does not reveal usable tokens.
"""

import hashlib
import secrets

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

_hasher = PasswordHasher()  # Argon2id with the library's current recommended parameters

# Used when an email is unknown, so a failed login takes as long as a real check and
# response timing does not reveal which emails are registered.
_DUMMY_HASH = _hasher.hash(secrets.token_urlsafe(16))


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password_hash: str | None, password: str) -> bool:
    try:
        return _hasher.verify(password_hash or _DUMMY_HASH, password) and password_hash is not None
    except (VerificationError, InvalidHashError):
        return False


def needs_rehash(password_hash: str) -> bool:
    """True when the stored hash uses older parameters and should be upgraded."""
    return _hasher.check_needs_rehash(password_hash)


def new_session_token() -> str:
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()
