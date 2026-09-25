"""Message ownership and authorization between two signed-in users."""

from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Message
from tests.support import sign_up

URL = "/api/v1/messages"


def bearer(account: dict[str, Any]) -> dict[str, str]:
    return {"Authorization": f"Bearer {account['token']}"}


@pytest.fixture
def alice(client: TestClient) -> dict[str, Any]:
    return sign_up(client, name="Alice", email="alice@example.com")


@pytest.fixture
def bob(client: TestClient) -> dict[str, Any]:
    return sign_up(client, name="Bob", email="bob@example.com")


@pytest.fixture
def alices_message(client: TestClient, alice: dict[str, Any]) -> dict[str, Any]:
    response = client.post(
        URL, json={"subject": "Alice's note", "text": "Private"}, headers=bearer(alice)
    )
    assert response.status_code == 201
    created: dict[str, Any] = response.json()
    return created


def test_new_messages_belong_to_the_authenticated_user(
    db: Session, alice: dict[str, Any], alices_message: dict[str, Any]
) -> None:
    stored = db.get_one(Message, alices_message["id"])

    assert str(stored.user_id) == alice["user"]["id"]


def test_the_owner_can_see_and_open_their_message(
    client: TestClient, alice: dict[str, Any], alices_message: dict[str, Any]
) -> None:
    listed = client.get(URL, headers=bearer(alice)).json()["items"]
    opened = client.get(f"{URL}/{alices_message['id']}", headers=bearer(alice))

    assert [m["id"] for m in listed] == [alices_message["id"]]
    assert opened.status_code == 200
    assert opened.json()["subject"] == "Alice's note"


def test_another_user_does_not_see_it_in_their_inbox(
    client: TestClient, bob: dict[str, Any], alices_message: dict[str, Any]
) -> None:
    assert client.get(URL, headers=bearer(bob)).json() == {"items": []}


def test_another_user_cannot_open_it_by_id(
    client: TestClient, bob: dict[str, Any], alices_message: dict[str, Any]
) -> None:
    response = client.get(f"{URL}/{alices_message['id']}", headers=bearer(bob))

    # Same answer as for a message that does not exist: nothing leaks.
    assert response.status_code == 404
    assert response.json() == {"error": {"code": "not_found", "message": "Message not found."}}


def test_another_user_cannot_delete_it(
    client: TestClient, alice: dict[str, Any], bob: dict[str, Any], alices_message: dict[str, Any]
) -> None:
    response = client.delete(f"{URL}/{alices_message['id']}", headers=bearer(bob))

    assert response.status_code == 404
    assert client.get(f"{URL}/{alices_message['id']}", headers=bearer(alice)).status_code == 200


def test_messages_cannot_be_created_for_someone_else(
    client: TestClient, alice: dict[str, Any], bob: dict[str, Any]
) -> None:
    response = client.post(
        URL,
        json={"subject": "Forged", "text": "Body", "user_id": alice["user"]["id"]},
        headers=bearer(bob),
    )

    assert response.status_code == 422
    assert client.get(URL, headers=bearer(alice)).json() == {"items": []}


def test_messages_are_not_editable(
    client: TestClient, alice: dict[str, Any], alices_message: dict[str, Any]
) -> None:
    """Editing is out of scope: there is no update endpoint for anyone."""
    response = client.put(
        f"{URL}/{alices_message['id']}", json={"subject": "x", "text": "y"}, headers=bearer(alice)
    )

    assert response.status_code == 405


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("GET", URL),
        ("POST", URL),
        ("GET", f"{URL}/{{id}}"),
        ("DELETE", f"{URL}/{{id}}"),
        ("GET", "/api/v1/auth/me"),
    ],
)
def test_protected_endpoints_reject_unauthenticated_requests(
    client: TestClient, alices_message: dict[str, Any], method: str, path: str
) -> None:
    response = client.request(
        method, path.format(id=alices_message["id"]), json={"subject": "a", "text": "b"}
    )

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "not_authenticated"
