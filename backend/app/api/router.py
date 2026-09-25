"""Versioned API router. Resource routers are mounted here."""

from fastapi import APIRouter

from app.api.routes import auth, messages

API_V1_PREFIX = "/api/v1"

api_v1_router = APIRouter(prefix=API_V1_PREFIX)
api_v1_router.include_router(auth.router)
api_v1_router.include_router(messages.router)
