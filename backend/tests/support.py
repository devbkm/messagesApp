"""Helpers shared by the API test modules."""

import uuid
from typing import Any

from fastapi.testclient import TestClient

SIGNUP_URL = "/api/v1/auth/signup"
PASSWORD = "correct horse battery"


def signup_payload(**overrides: Any) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "name": "Test User",
        "email": f"user-{uuid.uuid4().hex[:12]}@example.com",
        "password": PASSWORD,
        "password_confirmation": PASSWORD,
    }
    payload.update(overrides)
    return payload


def sign_up(client: TestClient, **overrides: Any) -> dict[str, Any]:
    """Create an account through the API; returns the response body (user + token)."""
    response = client.post(SIGNUP_URL, json=signup_payload(**overrides))
    assert response.status_code == 201, response.text
    body: dict[str, Any] = response.json()
    return body


def auth_headers(client: TestClient, **overrides: Any) -> dict[str, str]:
    """Sign up a fresh user and return headers that authenticate as them."""
    return {"Authorization": f"Bearer {sign_up(client, **overrides)['token']}"}
