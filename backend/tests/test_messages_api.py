"""End-to-end tests for /api/v1/messages against a real PostgreSQL database."""

import uuid
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from typing import Any

import httpx2
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.session import create_engine_for, get_db
from app.main import create_app
from app.models import Message
from app.services import messages as message_service
from tests.support import auth_headers

URL = "/api/v1/messages"


def user_headers(client: TestClient) -> dict[str, str]:
    """A freshly signed-up user's Bearer headers."""
    return auth_headers(client)


def create(client: TestClient, headers: dict[str, str], **payload: Any) -> dict[str, Any]:
    body = {"subject": "Hello", "text": "Message content"} | payload
    response = client.post(URL, json=body, headers=headers)
    assert response.status_code == 201, response.text
    created: dict[str, Any] = response.json()
    return created


def assert_error(response: httpx2.Response, status_code: int, code: str) -> dict[str, Any]:
    assert response.status_code == status_code, response.text
    body: dict[str, Any] = response.json()
    assert body["error"]["code"] == code
    assert isinstance(body["error"]["message"], str)
    return body


# --- Create ------------------------------------------------------------------------


def test_create_returns_201_with_server_generated_fields(client: TestClient) -> None:
    headers = user_headers(client)

    response = client.post(URL, json={"subject": "Example", "text": "Hi"}, headers=headers)

    assert response.status_code == 201
    body = response.json()
    assert set(body) == {"id", "subject", "text", "created_at", "attachment"}
    assert body["subject"] == "Example"
    assert body["text"] == "Hi"
    assert body["attachment"] is None
    uuid.UUID(body["id"])
    created_at = datetime.fromisoformat(body["created_at"])
    assert created_at.utcoffset() == timedelta(0)
    assert abs(datetime.now(UTC) - created_at) < timedelta(minutes=1)
    assert response.headers["location"].endswith(f"{URL}/{body['id']}")


def test_create_trims_surrounding_whitespace(client: TestClient) -> None:
    body = create(client, user_headers(client), subject="  Padded  ", text="\n Text \n")

    assert body["subject"] == "Padded"
    assert body["text"] == "Text"


def test_subject_of_exactly_40_characters_is_accepted(client: TestClient) -> None:
    body = create(client, user_headers(client), subject="s" * 40)

    assert body["subject"] == "s" * 40


@pytest.mark.parametrize("field", ["user_id", "created_at", "id"])
def test_client_cannot_set_server_owned_fields(client: TestClient, db: Session, field: str) -> None:
    headers = user_headers(client)
    values = {
        "user_id": str(uuid.uuid4()),
        "created_at": "2000-01-01T00:00:00Z",
        "id": str(uuid.uuid4()),
    }
    payload = {"subject": "Hi", "text": "Body", field: values[field]}

    response = client.post(URL, json=payload, headers=headers)

    body = assert_error(response, 422, "validation_error")
    assert body["error"]["details"][0]["field"] == f"body.{field}"
    assert db.scalar(select(func.count()).select_from(Message)) == 0


# --- Validation --------------------------------------------------------------------


@pytest.mark.parametrize(
    ("payload", "field"),
    [
        ({"text": "Body"}, "body.subject"),
        ({"subject": "Hi"}, "body.text"),
        ({"subject": "", "text": "Body"}, "body.subject"),
        ({"subject": "   ", "text": "Body"}, "body.subject"),
        ({"subject": "s" * 41, "text": "Body"}, "body.subject"),
        ({"subject": "Hi", "text": ""}, "body.text"),
        ({"subject": "Hi", "text": " \n\t "}, "body.text"),
        ({"subject": "Hi", "text": "t" * 10_001}, "body.text"),
        ({"subject": None, "text": "Body"}, "body.subject"),
        ({"subject": 123, "text": "Body"}, "body.subject"),
    ],
    ids=[
        "missing-subject",
        "missing-text",
        "empty-subject",
        "blank-subject",
        "subject-41-chars",
        "empty-text",
        "blank-text",
        "text-too-long",
        "null-subject",
        "non-string-subject",
    ],
)
def test_invalid_payloads_are_rejected(
    client: TestClient, payload: dict[str, Any], field: str
) -> None:
    response = client.post(URL, json=payload, headers=user_headers(client))

    body = assert_error(response, 422, "validation_error")
    assert field in [detail["field"] for detail in body["error"]["details"]]


def test_validation_errors_do_not_echo_input(client: TestClient) -> None:
    secret = "s" * 41
    response = client.post(
        URL, json={"subject": secret, "text": "Body"}, headers=user_headers(client)
    )

    assert response.status_code == 422
    assert secret not in response.text


@pytest.mark.parametrize(
    ("content", "content_type"),
    [("{not json", "application/json"), ("[]", "application/json"), ("", "application/json")],
    ids=["malformed-json", "json-array", "empty-body"],
)
def test_malformed_bodies_are_rejected(client: TestClient, content: str, content_type: str) -> None:
    response = client.post(
        URL, content=content, headers={**user_headers(client), "Content-Type": content_type}
    )

    assert_error(response, 422, "validation_error")


# --- List --------------------------------------------------------------------------


def test_list_is_empty_for_a_new_user(client: TestClient) -> None:
    response = client.get(URL, headers=user_headers(client))

    assert response.status_code == 200
    assert response.json() == {"items": []}


def test_list_returns_own_messages_newest_first(client: TestClient) -> None:
    headers = user_headers(client)
    first = create(client, headers, subject="First")
    second = create(client, headers, subject="Second")

    response = client.get(URL, headers=headers)

    assert response.status_code == 200
    items = response.json()["items"]
    # Both rows share the transaction timestamp in tests; order falls back to id.
    assert {item["id"] for item in items} == {first["id"], second["id"]}
    assert items == sorted(items, key=lambda i: (i["created_at"], i["id"]), reverse=True)
    assert set(items[0]) == {"id", "subject", "created_at", "has_attachment"}


def test_api_responses_are_not_cacheable(client: TestClient) -> None:
    response = client.get(URL, headers=user_headers(client))

    assert response.headers["cache-control"] == "no-store"
    assert response.headers["x-content-type-options"] == "nosniff"


# --- Retrieve ----------------------------------------------------------------------


def test_get_returns_the_full_message(client: TestClient) -> None:
    headers = user_headers(client)
    created = create(client, headers, subject="Detail", text="Full text")

    response = client.get(f"{URL}/{created['id']}", headers=headers)

    assert response.status_code == 200
    assert response.json() == created


def test_get_unknown_message_returns_404(client: TestClient) -> None:
    response = client.get(f"{URL}/{uuid.uuid4()}", headers=user_headers(client))

    assert_error(response, 404, "not_found")


@pytest.mark.parametrize("bad_id", ["not-a-uuid", "123", "00000000-0000-0000-0000"])
def test_invalid_message_id_returns_422(client: TestClient, bad_id: str) -> None:
    headers = user_headers(client)

    assert_error(client.get(f"{URL}/{bad_id}", headers=headers), 422, "validation_error")
    assert_error(client.delete(f"{URL}/{bad_id}", headers=headers), 422, "validation_error")


# --- Delete ------------------------------------------------------------------------


def test_delete_removes_the_message(client: TestClient) -> None:
    headers = user_headers(client)
    created = create(client, headers)

    response = client.delete(f"{URL}/{created['id']}", headers=headers)

    assert response.status_code == 204
    assert response.content == b""
    assert_error(client.get(f"{URL}/{created['id']}", headers=headers), 404, "not_found")
    assert client.get(URL, headers=headers).json() == {"items": []}


def test_delete_twice_returns_404(client: TestClient) -> None:
    headers = user_headers(client)
    created = create(client, headers)
    client.delete(f"{URL}/{created['id']}", headers=headers)

    response = client.delete(f"{URL}/{created['id']}", headers=headers)

    assert_error(response, 404, "not_found")


# --- User isolation ----------------------------------------------------------------


def test_users_only_see_their_own_messages(client: TestClient) -> None:
    alice, bob = user_headers(client), user_headers(client)
    alices = create(client, alice, subject="Alice's")
    bobs = create(client, bob, subject="Bob's")

    alice_ids = [m["id"] for m in client.get(URL, headers=alice).json()["items"]]
    bob_ids = [m["id"] for m in client.get(URL, headers=bob).json()["items"]]

    assert alice_ids == [alices["id"]]
    assert bob_ids == [bobs["id"]]


def test_cannot_read_another_users_message(client: TestClient) -> None:
    owner, intruder = user_headers(client), user_headers(client)
    message = create(client, owner)

    response = client.get(f"{URL}/{message['id']}", headers=intruder)

    # Identical to a message that does not exist: nothing leaks about its existence.
    missing = client.get(f"{URL}/{uuid.uuid4()}", headers=intruder)
    assert_error(response, 404, "not_found")
    assert response.json() == missing.json()


def test_cannot_delete_another_users_message(client: TestClient) -> None:
    owner, intruder = user_headers(client), user_headers(client)
    message = create(client, owner)

    response = client.delete(f"{URL}/{message['id']}", headers=intruder)

    assert_error(response, 404, "not_found")
    assert client.get(f"{URL}/{message['id']}", headers=owner).status_code == 200


# --- Authentication ----------------------------------------------------------------


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("GET", URL),
        ("POST", URL),
        ("GET", f"{URL}/{uuid.uuid4()}"),
        ("DELETE", f"{URL}/{uuid.uuid4()}"),
    ],
)
@pytest.mark.parametrize(
    ("headers", "code"),
    [
        ({}, "not_authenticated"),
        ({"Authorization": "Bearer "}, "not_authenticated"),
        ({"Authorization": "Basic dXNlcjpwYXNz"}, "not_authenticated"),
        ({"Authorization": "Bearer not-a-real-token"}, "invalid_session"),
        # The legacy development header no longer identifies anyone.
        ({"X-User-Id": str(uuid.uuid4())}, "not_authenticated"),
    ],
    ids=["none", "empty-bearer", "basic-auth", "unknown-token", "legacy-header"],
)
def test_unauthenticated_requests_are_rejected(
    client: TestClient, method: str, path: str, headers: dict[str, str], code: str
) -> None:
    response = client.request(method, path, headers=headers, json={"subject": "a", "text": "b"})

    assert_error(response, 401, code)
    assert response.headers["www-authenticate"] == "Bearer"


# --- Failure handling --------------------------------------------------------------


@pytest.fixture
def unreachable_db_client() -> Iterator[TestClient]:
    """A client whose database connection is refused."""
    engine = create_engine_for("postgresql+psycopg://nobody:secret@127.0.0.1:1/missing")
    app = create_app()

    def broken_db() -> Iterator[Session]:
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_db] = broken_db
    with TestClient(app) as test_client:
        yield test_client
    engine.dispose()


def test_database_outage_returns_503_without_details(unreachable_db_client: TestClient) -> None:
    # Any token: resolving it needs the database, which is down.
    response = unreachable_db_client.get(URL, headers={"Authorization": "Bearer some-token"})

    assert_error(response, 503, "service_unavailable")
    for leaked in ("psycopg", "127.0.0.1", "secret", "SELECT", "INSERT", "Traceback"):
        assert leaked not in response.text


def test_database_error_returns_generic_500(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    def fail(*_: object) -> None:
        raise IntegrityError("INSERT INTO messages VALUES (secret)", {}, Exception("boom"))

    monkeypatch.setattr(message_service, "create_message", fail)

    response = client.post(
        URL, json={"subject": "Hi", "text": "Body"}, headers=user_headers(client)
    )

    body = assert_error(response, 500, "internal_error")
    assert "INSERT" not in response.text and "secret" not in response.text
    assert "details" not in body["error"]


def test_unexpected_error_returns_generic_500(db: Session, monkeypatch: pytest.MonkeyPatch) -> None:
    def fail(*_: object) -> None:
        raise RuntimeError("internal detail that must not leak")

    monkeypatch.setattr(message_service, "list_messages", fail)
    app = create_app()
    app.dependency_overrides[get_db] = lambda: db

    with TestClient(app, raise_server_exceptions=False) as test_client:
        response = test_client.get(URL, headers=user_headers(test_client))

    assert_error(response, 500, "internal_error")
    assert "internal detail" not in response.text


def test_unsupported_method_uses_error_envelope(client: TestClient) -> None:
    response = client.put(URL, json={}, headers=user_headers(client))

    assert_error(response, 405, "method_not_allowed")


# --- OpenAPI -----------------------------------------------------------------------


def test_openapi_documents_the_contract(client: TestClient) -> None:
    spec = client.get("/openapi.json").json()
    paths = spec["paths"]
    schemas = spec["components"]["schemas"]

    assert set(paths[URL]) == {"get", "post"}
    assert set(paths[f"{URL}/{{message_id}}"]) == {"get", "delete"}

    assert {"200", "401", "503"} <= set(paths[URL]["get"]["responses"])
    assert {"201", "401", "422"} <= set(paths[URL]["post"]["responses"])
    assert {"200", "401", "404", "422"} <= set(paths[f"{URL}/{{message_id}}"]["get"]["responses"])
    assert {"204", "401", "404", "422"} <= set(
        paths[f"{URL}/{{message_id}}"]["delete"]["responses"]
    )

    # 422 uses our error envelope, not FastAPI's default HTTPValidationError.
    post_422 = paths[URL]["post"]["responses"]["422"]["content"]["application/json"]["schema"]
    assert post_422["$ref"].endswith("/ErrorResponse")
    assert "HTTPValidationError" not in schemas

    create_schema = schemas["MessageCreate"]
    assert set(create_schema["properties"]) == {"subject", "text"}
    assert create_schema["required"] == ["subject", "text"]
    assert create_schema["additionalProperties"] is False
    assert create_schema["properties"]["subject"]["maxLength"] == 40
    assert create_schema["properties"]["subject"]["minLength"] == 1
    assert "user_id" not in schemas["MessageRead"]["properties"]

    schemes = spec["components"]["securitySchemes"]
    assert schemes["BearerToken"]["scheme"] == "bearer"
    assert schemes["SessionCookie"] == {
        "type": "apiKey",
        "in": "cookie",
        "name": "inbox_session",
        "description": "Web session cookie; requires the `X-Auth-Transport: cookie` header.",
    }
    assert paths[URL]["get"]["security"] == [{"BearerToken": []}, {"SessionCookie": []}]
    assert {
        "/api/v1/auth/signup",
        "/api/v1/auth/login",
        "/api/v1/auth/logout",
        "/api/v1/auth/me",
    } <= set(paths)
    assert "password_hash" not in str(schemas)
