"""Sign-up, login, logout and sessions (/api/v1/auth)."""

import logging
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.db.session import get_db
from app.main import create_app
from app.models import User, UserSession
from tests.support import PASSWORD, sign_up, signup_payload

AUTH = "/api/v1/auth"
MESSAGES = "/api/v1/messages"
COOKIE_MODE = {"X-Auth-Transport": "cookie"}


def bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def login(client: TestClient, email: str, password: str = PASSWORD, **kwargs: Any) -> Any:
    return client.post(f"{AUTH}/login", json={"email": email, "password": password}, **kwargs)


# --- Sign-up -----------------------------------------------------------------------


def test_signup_creates_the_account_and_signs_in(client: TestClient, db: Session) -> None:
    response = client.post(
        f"{AUTH}/signup", json=signup_payload(name="  Ada  ", email=" Ada@Example.COM ")
    )

    assert response.status_code == 201
    body = response.json()
    assert set(body) == {"user", "token", "expires_at"}
    assert set(body["user"]) == {"id", "name", "email", "created_at"}
    assert body["user"]["name"] == "Ada"
    assert body["user"]["email"] == "ada@example.com"  # normalised
    # Signed in straight away: no separate login needed.
    me = client.get(f"{AUTH}/me", headers=bearer(body["token"]))
    assert me.status_code == 200
    assert me.json() == body["user"]
    expires_at = datetime.fromisoformat(body["expires_at"])
    assert timedelta(days=13) < expires_at - datetime.now(UTC) <= timedelta(days=14)


def test_password_is_stored_only_as_an_argon2_hash(client: TestClient, db: Session) -> None:
    user_id = sign_up(client)["user"]["id"]

    stored = db.scalars(select(User.password_hash).where(User.id == user_id)).one()

    assert stored is not None
    assert stored.startswith("$argon2id$")
    assert PASSWORD not in stored


def test_duplicate_email_is_rejected_case_insensitively(client: TestClient) -> None:
    sign_up(client, email="taken@example.com")

    response = client.post(f"{AUTH}/signup", json=signup_payload(email="TAKEN@example.com"))

    assert response.status_code == 409
    assert response.json() == {
        "error": {"code": "email_taken", "message": "An account with this email already exists."}
    }


@pytest.mark.parametrize(
    ("overrides", "field"),
    [
        ({"name": ""}, "body.name"),
        ({"name": "   "}, "body.name"),
        ({"name": "x" * 101}, "body.name"),
        ({"email": "not-an-email"}, "body.email"),
        ({"email": ""}, "body.email"),
        ({"password": "short", "password_confirmation": "short"}, "body.password"),
        ({"password": "", "password_confirmation": ""}, "body.password"),
        ({"password_confirmation": "something else"}, "body.password_confirmation"),
    ],
    ids=[
        "empty-name",
        "blank-name",
        "long-name",
        "invalid-email",
        "empty-email",
        "short-password",
        "empty-password",
        "confirmation-mismatch",
    ],
)
def test_invalid_signup_data_is_rejected(
    client: TestClient, overrides: dict[str, str], field: str
) -> None:
    response = client.post(f"{AUTH}/signup", json=signup_payload(**overrides))

    assert response.status_code == 422
    assert field in [d["field"] for d in response.json()["error"]["details"]]


@pytest.mark.parametrize("missing", ["name", "email", "password", "password_confirmation"])
def test_signup_requires_every_field(client: TestClient, missing: str) -> None:
    payload = signup_payload()
    del payload[missing]

    response = client.post(f"{AUTH}/signup", json=payload)

    assert response.status_code == 422
    assert f"body.{missing}" in [d["field"] for d in response.json()["error"]["details"]]


def test_signup_rejects_client_supplied_ids(client: TestClient) -> None:
    response = client.post(
        f"{AUTH}/signup", json={**signup_payload(), "id": "00000000-0000-0000-0000-000000000000"}
    )

    assert response.status_code == 422


# --- Login -------------------------------------------------------------------------


def test_login_returns_a_new_working_session(client: TestClient) -> None:
    account = sign_up(client, email="login@example.com")

    response = login(client, " LOGIN@example.com ")

    assert response.status_code == 200
    body = response.json()
    assert body["user"] == account["user"]
    assert body["token"] != account["token"]
    # Both sessions (e.g. phone and laptop) stay valid independently.
    assert client.get(f"{AUTH}/me", headers=bearer(body["token"])).status_code == 200
    assert client.get(f"{AUTH}/me", headers=bearer(account["token"])).status_code == 200


def test_wrong_password_and_unknown_email_get_the_same_answer(client: TestClient) -> None:
    sign_up(client, email="known@example.com")

    wrong_password = login(client, "known@example.com", "not the password")
    unknown_email = login(client, "nobody@example.com", "not the password")

    assert wrong_password.status_code == unknown_email.status_code == 401
    assert (
        wrong_password.json()
        == unknown_email.json()
        == {"error": {"code": "invalid_credentials", "message": "Invalid email or password."}}
    )


@pytest.mark.parametrize(
    "payload",
    [{}, {"email": "", "password": ""}, {"email": "a@example.com"}, {"password": "x"}],
    ids=["nothing", "empty", "no-password", "no-email"],
)
def test_login_requires_email_and_password(client: TestClient, payload: dict[str, str]) -> None:
    response = client.post(f"{AUTH}/login", json=payload)

    assert response.status_code == 422


def test_legacy_accounts_without_credentials_cannot_log_in(client: TestClient, db: Session) -> None:
    db.add(User())  # an account created before sign-up existed
    db.flush()

    assert login(client, "", "x").status_code == 422
    assert login(client, "none@example.com", "anything").status_code == 401


# --- Logout ------------------------------------------------------------------------


def test_logout_ends_the_session_on_the_server(client: TestClient) -> None:
    token = sign_up(client)["token"]

    response = client.post(f"{AUTH}/logout", headers=bearer(token))

    assert response.status_code == 204
    after = client.get(MESSAGES, headers=bearer(token))
    assert after.status_code == 401
    assert after.json()["error"]["code"] == "invalid_session"


def test_logout_only_ends_that_session(client: TestClient) -> None:
    account = sign_up(client, email="two-devices@example.com")
    other = login(client, "two-devices@example.com").json()["token"]

    client.post(f"{AUTH}/logout", headers=bearer(account["token"]))

    assert client.get(f"{AUTH}/me", headers=bearer(other)).status_code == 200


def test_logout_without_a_session_still_succeeds(client: TestClient) -> None:
    assert client.post(f"{AUTH}/logout").status_code == 204


# --- Sessions ----------------------------------------------------------------------


def test_session_persists_across_requests_and_app_restarts(client: TestClient, db: Session) -> None:
    token = sign_up(client)["token"]
    client.post(MESSAGES, json={"subject": "Kept", "text": "Body"}, headers=bearer(token))

    restarted = create_app()  # a fresh app instance, as after a server restart
    restarted.dependency_overrides[get_db] = lambda: db
    with TestClient(restarted) as fresh:
        items = fresh.get(MESSAGES, headers=bearer(token)).json()["items"]

    assert [item["subject"] for item in items] == ["Kept"]


def test_expired_session_is_rejected_and_removed(client: TestClient, db: Session) -> None:
    token = sign_up(client)["token"]
    db.execute(update(UserSession).values(expires_at=datetime.now(UTC) - timedelta(seconds=1)))
    db.flush()

    response = client.get(MESSAGES, headers=bearer(token))

    assert response.status_code == 401
    assert response.json() == {
        "error": {
            "code": "session_expired",
            "message": "Your session has expired. Please log in again.",
        }
    }
    assert db.scalars(select(UserSession)).first() is None


def test_tampered_token_is_rejected(client: TestClient) -> None:
    token = sign_up(client)["token"]

    response = client.get(f"{AUTH}/me", headers=bearer(token[:-2] + "xx"))

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "invalid_session"


def test_me_requires_a_session(client: TestClient) -> None:
    response = client.get(f"{AUTH}/me")

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "not_authenticated"


# --- Web cookie transport ----------------------------------------------------------


def test_cookie_mode_sets_an_httponly_cookie_and_hides_the_token(client: TestClient) -> None:
    response = client.post(f"{AUTH}/signup", json=signup_payload(), headers=COOKIE_MODE)

    assert response.status_code == 201
    assert "token" not in response.json()
    cookie = response.headers["set-cookie"]
    assert cookie.startswith("inbox_session=")
    assert "HttpOnly" in cookie
    assert "SameSite=lax" in cookie
    assert "Path=/api/v1" in cookie


def test_cookie_authenticates_only_with_the_transport_header(client: TestClient) -> None:
    client.post(f"{AUTH}/signup", json=signup_payload(), headers=COOKIE_MODE)

    # A cross-site request cannot add the custom header, so the cookie alone is not enough.
    assert client.get(MESSAGES).status_code == 401
    assert client.get(MESSAGES, headers=COOKIE_MODE).status_code == 200
    assert client.post(MESSAGES, json={"subject": "S", "text": "T"}).status_code == 401


def test_cookie_logout_clears_the_cookie_and_the_session(client: TestClient) -> None:
    client.post(f"{AUTH}/signup", json=signup_payload(), headers=COOKIE_MODE)
    session_cookie = client.cookies.get("inbox_session")

    response = client.post(f"{AUTH}/logout", headers=COOKIE_MODE)

    assert response.status_code == 204
    assert 'inbox_session=""' in response.headers["set-cookie"]
    assert "Max-Age=0" in response.headers["set-cookie"]
    client.cookies.set("inbox_session", session_cookie or "", path="/api/v1")
    assert client.get(MESSAGES, headers=COOKIE_MODE).status_code == 401


def test_cookie_is_marked_secure_in_production(db: Session) -> None:
    settings = Settings(
        environment="production", database_url="postgresql+psycopg://x:y@127.0.0.1:1/z"
    )
    app = create_app(settings)
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_settings] = lambda: settings
    with TestClient(app) as prod:
        response = prod.post(f"{AUTH}/signup", json=signup_payload(), headers=COOKIE_MODE)

    assert "Secure" in response.headers["set-cookie"]


# --- Secrets never leak ------------------------------------------------------------


def test_passwords_and_hashes_never_appear_in_responses_or_logs(
    client: TestClient, caplog: pytest.LogCaptureFixture
) -> None:
    secret = "unique-password-4f7c"
    caplog.set_level(logging.DEBUG)

    responses = [
        client.post(
            f"{AUTH}/signup",
            json=signup_payload(
                email="leak@example.com", password=secret, password_confirmation=secret
            ),
        ),
        login(client, "leak@example.com", secret),
        login(client, "leak@example.com", secret + "-wrong"),
        client.post(
            f"{AUTH}/signup",
            json=signup_payload(password=secret, password_confirmation=secret + "x"),
        ),
    ]

    for response in responses:
        assert secret not in response.text
        assert "$argon2" not in response.text
        assert "password_hash" not in response.text
    assert secret not in caplog.text


# --- Data model --------------------------------------------------------------------


def test_database_enforces_unique_lowercase_emails_and_complete_credentials(db: Session) -> None:
    db.add(User(name="A", email="dup@example.com", password_hash="h"))
    db.flush()

    with pytest.raises(IntegrityError, match="uq_users_email"):
        db.add(User(name="B", email="dup@example.com", password_hash="h"))
        db.flush()
    db.rollback()

    with pytest.raises(IntegrityError, match="ck_users_email_lowercase"):
        db.add(User(name="C", email="Upper@example.com", password_hash="h"))
        db.flush()
    db.rollback()

    with pytest.raises(IntegrityError, match="ck_users_credentials_complete"):
        db.add(User(name="D", email="half@example.com"))
        db.flush()
