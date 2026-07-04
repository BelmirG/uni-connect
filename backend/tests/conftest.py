"""Test fixtures.

The suite runs inside the backend container (`docker compose exec backend pytest`)
against a dedicated `iusconnect_test` database — the dev database is never touched.
Users are created directly in the DB and authenticated by minting a JWT cookie,
which keeps tests fast and independent of the login rate limiter.
"""
import os
import random
import uuid

# Point the app at the test database BEFORE any app module is imported —
# app.config reads DATABASE_URL once at import time.
_DEV_URL = os.environ["DATABASE_URL"]
_TEST_URL = _DEV_URL.rsplit("/", 1)[0] + "/iusconnect_test"
os.environ["DATABASE_URL"] = _TEST_URL

import asyncpg
import httpx
import pytest_asyncio

from app.core.security import create_access_token, hash_password
from app.database import AsyncSessionLocal, Base, engine
from app.main import app
from app.models.user import User


@pytest_asyncio.fixture(scope="session", autouse=True)
async def _test_database():
    # Bootstrap: create iusconnect_test if it doesn't exist yet, connecting
    # through the dev URL (CREATE DATABASE can't run inside the target DB).
    conn = await asyncpg.connect(dsn=_DEV_URL.replace("postgresql+asyncpg://", "postgresql://"))
    exists = await conn.fetchval("SELECT 1 FROM pg_database WHERE datname = 'iusconnect_test'")
    if not exists:
        await conn.execute("CREATE DATABASE iusconnect_test")
    await conn.close()

    # Fresh schema from the ORM models on every run.
    async with engine.begin() as c:
        await c.run_sync(Base.metadata.drop_all)
        await c.run_sync(Base.metadata.create_all)
    yield
    await engine.dispose()


@pytest_asyncio.fixture
async def db():
    async with AsyncSessionLocal() as session:
        yield session


@pytest_asyncio.fixture
async def make_user(db):
    async def _make(*, is_admin: bool = False, is_active: bool = True) -> User:
        name = f"t_{uuid.uuid4().hex[:10]}"
        user = User(
            email=f"{name}@student.ius.edu.ba",
            username=name,
            display_name=name,
            password_hash=hash_password("testpass123"),
            is_email_verified=True,
            is_admin=is_admin,
            is_active=is_active,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        return user

    return _make


@pytest_asyncio.fixture
async def client_for():
    """Factory: an API client authenticated as the given user (None = anonymous).

    Each client gets a random fake source IP so repeated runs never accumulate
    against the Redis rate limiter (which keys on client IP).
    """
    clients: list[httpx.AsyncClient] = []

    def _make(user: User | None = None) -> httpx.AsyncClient:
        fake_ip = f"10.{random.randint(0, 255)}.{random.randint(0, 255)}.{random.randint(1, 254)}"
        cookies = {"access_token": create_access_token(str(user.id))} if user else {}
        c = httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app, client=(fake_ip, 12345)),
            base_url="http://test",
            cookies=cookies,
        )
        clients.append(c)
        return c

    yield _make
    for c in clients:
        await c.aclose()
