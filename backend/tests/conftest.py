import os

# Tests must never depend on a developer's real .env; provide an explicit, unreachable DSN.
os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://test:test@localhost:5432/test")
os.environ.setdefault("ENVIRONMENT", "test")
