"""Security, reliability and edge-case checks for the HTTP API."""

import json
from collections.abc import Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.db.session import get_db
from app.main import MAX_BODY_BYTES, create_app
from app.models import Message
from tests.support import auth_headers, signup_payload

URL = "/api/v1/messages"
TEST_DSN = "postgresql+psycopg://test:test@127.0.0.1:5432/test"


def headers(client: TestClient) -> dict[str, str]:
    """A freshly signed-up user's Bearer headers."""
    return auth_headers(client)


def count_messages(db: Session) -> int:
    return db.scalar(select(func.count()).select_from(Message)) or 0


# --- Input edge cases --------------------------------------------------------------


@pytest.mark.parametrize(
    ("payload", "field"),
    [
        ({"subject": "Hi", "text": "a\x00b"}, "body.text"),
        ({"subject": "a\x00b", "text": "Body"}, "body.subject"),
        ({"subject": "line one\nline two", "text": "Body"}, "body.subject"),
        ({"subject": "tab\there", "text": "Body"}, "body.subject"),
        ({"subject": "Hi", "text": "bell\x07"}, "body.text"),
        ({"subject": "​​", "text": "Body"}, "body.subject"),
        ({"subject": "Hi", "text": "​ ⁠"}, "body.text"),
    ],
    ids=[
        "nul-in-text",
        "nul-in-subject",
        "newline-in-subject",
        "tab-in-subject",
        "control-char-in-text",
        "invisible-subject",
        "invisible-text",
    ],
)
def test_control_and_invisible_characters_are_rejected_not_500(
    client: TestClient, db: Session, payload: dict[str, str], field: str
) -> None:
    response = client.post(URL, json=payload, headers=headers(client))

    assert response.status_code == 422
    assert field in [d["field"] for d in response.json()["error"]["details"]]
    assert count_messages(db) == 0


def test_multiline_text_with_tabs_is_preserved_exactly(client: TestClient) -> None:
    text = "Dear team,\n\n\tPoint one\r\n\tPoint two\n\nBye"
    response = client.post(URL, json={"subject": "Notes", "text": text}, headers=headers(client))

    assert response.status_code == 201
    assert response.json()["text"] == text


@pytest.mark.parametrize(
    "subject",
    ["😀" * 40, "é" * 40, "中" * 40, "مرحبا بالعالم", "Grüße, ñandú & «quotes» — ok"],
    ids=["40-emoji", "40-accented", "40-cjk", "rtl", "punctuation"],
)
def test_unicode_subjects_round_trip(client: TestClient, subject: str) -> None:
    h = headers(client)
    created = client.post(URL, json={"subject": subject, "text": "Body"}, headers=h)

    assert created.status_code == 201
    fetched = client.get(f"{URL}/{created.json()['id']}", headers=h)
    assert fetched.json()["subject"] == subject


def test_forty_one_emoji_subject_is_rejected(client: TestClient) -> None:
    # Limits count characters (code points), not bytes or UTF-16 units.
    response = client.post(
        URL, json={"subject": "😀" * 41, "text": "Body"}, headers=headers(client)
    )

    assert response.status_code == 422


def test_markup_is_stored_and_returned_as_inert_json_text(client: TestClient) -> None:
    payload = {"subject": "<img src=x onerror=alert(1)>", "text": "<script>alert(1)</script>"}

    response = client.post(URL, json=payload, headers=headers(client))

    assert response.status_code == 201
    assert response.headers["content-type"] == "application/json"
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.json()["subject"] == payload["subject"]


def test_maximum_length_text_is_accepted(client: TestClient) -> None:
    text = "😀" * 10_000  # the longest valid text, 4 bytes per character in UTF-8

    response = client.post(URL, json={"subject": "Long", "text": text}, headers=headers(client))

    assert response.status_code == 201
    assert len(response.json()["text"]) == 10_000


# --- Request limits ----------------------------------------------------------------


def test_oversized_body_is_rejected_before_parsing(client: TestClient, db: Session) -> None:
    body = json.dumps({"subject": "Big", "text": "x" * (MAX_BODY_BYTES + 1)})

    response = client.post(
        URL, content=body, headers={**headers(client), "Content-Type": "application/json"}
    )

    assert response.status_code == 413
    assert response.json()["error"]["code"] == "payload_too_large"
    assert count_messages(db) == 0


def test_body_without_declared_length_is_rejected(client: TestClient) -> None:
    def chunks() -> Iterator[bytes]:
        yield b'{"subject": "Hi", '
        yield b'"text": "Body"}'

    response = client.post(
        URL, content=chunks(), headers={**headers(client), "Content-Type": "application/json"}
    )

    assert response.status_code == 411
    assert response.json()["error"]["code"] == "length_required"


def test_non_json_content_type_is_rejected(client: TestClient) -> None:
    response = client.post(
        URL,
        content='{"subject": "Hi", "text": "Body"}',
        headers={**headers(client), "Content-Type": "text/plain"},
    )

    assert response.status_code == 422


# --- Identity and authorization ----------------------------------------------------


def test_a_user_id_header_cannot_impersonate_anyone(client: TestClient) -> None:
    """Identity comes only from the session token, never from a client-supplied id."""
    victim = client.post("/api/v1/auth/signup", json=signup_payload())
    victim_id = victim.json()["user"]["id"]

    response = client.get(URL, headers={"X-User-Id": victim_id})

    assert response.status_code == 401


def test_oversized_token_is_rejected(client: TestClient) -> None:
    response = client.get(URL, headers={"Authorization": "Bearer " + "x" * 5000})

    assert response.status_code == 401


def test_message_ids_cannot_reach_other_users_data_by_any_route(client: TestClient) -> None:
    owner, intruder = headers(client), headers(client)
    message_id = client.post(URL, json={"subject": "S", "text": "T"}, headers=owner).json()["id"]

    assert client.get(f"{URL}/{message_id}", headers=intruder).status_code == 404
    assert client.delete(f"{URL}/{message_id}", headers=intruder).status_code == 404
    assert message_id not in [m["id"] for m in client.get(URL, headers=intruder).json()["items"]]
    # Still intact for the owner.
    assert client.get(f"{URL}/{message_id}", headers=owner).status_code == 200


# --- Reliability -------------------------------------------------------------------


def test_many_messages_are_listed_newest_first(client: TestClient, db: Session) -> None:
    h = headers(client)
    for index in range(150):
        client.post(URL, json={"subject": f"Message {index}", "text": "Body"}, headers=h)

    items = client.get(URL, headers=h).json()["items"]

    assert len(items) == 150
    keys = [(item["created_at"], item["id"]) for item in items]
    assert keys == sorted(keys, reverse=True)


def test_message_deleted_elsewhere_is_reported_as_not_found(client: TestClient) -> None:
    h = headers(client)
    message_id = client.post(URL, json={"subject": "S", "text": "T"}, headers=h).json()["id"]
    client.delete(f"{URL}/{message_id}", headers=h)  # e.g. from another device

    assert client.get(f"{URL}/{message_id}", headers=h).status_code == 404
    assert client.delete(f"{URL}/{message_id}", headers=h).status_code == 404


def test_health_does_not_depend_on_the_database() -> None:
    app = create_app()

    def broken_db() -> Iterator[Session]:
        raise AssertionError("health must not open a database session")
        yield  # pragma: no cover

    app.dependency_overrides[get_db] = broken_db

    assert TestClient(app).get("/health").status_code == 200


# --- Configuration -----------------------------------------------------------------


def test_database_url_has_no_default(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("DATABASE_URL", raising=False)

    with pytest.raises(ValidationError):
        Settings(_env_file=None)


def test_production_hides_interactive_docs() -> None:
    settings = Settings(environment="production", database_url=TEST_DSN)
    client = TestClient(create_app(settings))

    assert client.get("/docs").status_code == 404
    assert client.get("/openapi.json").status_code == 404


def test_cors_allows_only_configured_origins() -> None:
    settings = Settings(database_url=TEST_DSN, cors_origins="http://localhost:5173")
    client = TestClient(create_app(settings))

    def preflight(origin: str) -> Any:
        return client.options(
            URL,
            headers={
                "Origin": origin,
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "content-type,authorization,x-auth-transport",
            },
        )

    allowed = preflight("http://localhost:5173")
    assert allowed.status_code == 200
    assert allowed.headers["access-control-allow-origin"] == "http://localhost:5173"
    # Credentials are allowed so the web session cookie is sent...
    assert allowed.headers["access-control-allow-credentials"] == "true"
    allowed_headers = allowed.headers["access-control-allow-headers"].lower()
    assert "authorization" in allowed_headers
    assert "x-auth-transport" in allowed_headers

    # ...but only for the configured origin: without a matching Allow-Origin the browser
    # refuses the credentialed request, so other sites cannot use the session cookie.
    denied = preflight("https://evil.example")
    assert denied.status_code == 400
    assert "access-control-allow-origin" not in denied.headers
