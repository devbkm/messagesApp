"""Versioned API router. Resource routers (e.g. messages) are mounted here."""

from fastapi import APIRouter

API_V1_PREFIX = "/api/v1"

api_v1_router = APIRouter(prefix=API_V1_PREFIX)
