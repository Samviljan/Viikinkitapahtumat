import os
import pytest
import requests
from datetime import datetime, timezone, timedelta
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL")
if not BASE_URL:
    # Fallback to reading frontend/.env directly
    from pathlib import Path
    env_path = Path("/app/frontend/.env")
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().strip('"')
                break

BASE_URL = (BASE_URL or "").rstrip("/")

ADMIN_EMAIL = os.environ.get("TEST_ADMIN_EMAIL", "admin@viikinkitapahtumat.fi")
# Admin password is NEVER hardcoded. Export TEST_ADMIN_PASSWORD before running
# the pytest suite (also kept in /app/memory/test_credentials.md, gitignored).
ADMIN_PASSWORD = os.environ.get("TEST_ADMIN_PASSWORD")
assert ADMIN_PASSWORD, "TEST_ADMIN_PASSWORD env var is required to run tests"


@pytest.fixture(scope="session")
def base_url():
    assert BASE_URL, "REACT_APP_BACKEND_URL not set"
    return BASE_URL


@pytest.fixture
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture
def admin_token(base_url, api_client):
    r = api_client.post(
        f"{base_url}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=30,
    )
    if r.status_code != 200:
        pytest.skip(f"Admin login failed: {r.status_code} {r.text}")
    return r.json().get("token")


@pytest.fixture
def admin_client(base_url, admin_token):
    s = requests.Session()
    s.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {admin_token}",
    })
    return s


# ---- Direct DB access (sync via pymongo) ------------------------------------
# Used by the P1 regression suite where we need to seed events/RSVPs/users at
# specific dates that the HTTP API would not let us create (e.g. event with
# start_date = today + 7 days, exactly).

def _read_backend_env(key: str) -> str | None:
    from pathlib import Path
    p = Path("/app/backend/.env")
    if not p.exists():
        return None
    for line in p.read_text().splitlines():
        if line.startswith(f"{key}="):
            return line.split("=", 1)[1].strip().strip('"')
    return None


@pytest.fixture(scope="session")
def mongo():
    mongo_url = os.environ.get("MONGO_URL") or _read_backend_env("MONGO_URL")
    db_name = os.environ.get("DB_NAME") or _read_backend_env("DB_NAME")
    assert mongo_url and db_name, "MONGO_URL and DB_NAME required"
    client = MongoClient(mongo_url)
    yield client[db_name]
    client.close()


# ---- P1 test helpers --------------------------------------------------------

P1_PREFIX = "p1test_"


@pytest.fixture
def p1_cleanup(mongo):
    """Tracks ids created during a single test so the test can rely on
    `_pytest_artifact: True` flagging + per-test deletion. Yields a registry
    dict; teardown deletes any documents whose id starts with `p1test_`.
    """
    yield
    # Belt-and-suspenders cleanup using the shared prefix.
    for coll in (
        "users",
        "events",
        "event_attendees",
        "email_templates",
        "reminder_log",
        "user_messages",
        "message_log",
        "newsletter_subscribers",
    ):
        mongo[coll].delete_many({"id": {"$regex": f"^{P1_PREFIX}"}})
        mongo[coll].delete_many({"event_id": {"$regex": f"^{P1_PREFIX}"}})
        mongo[coll].delete_many({"user_id": {"$regex": f"^{P1_PREFIX}"}})
        mongo[coll].delete_many({"recipient_id": {"$regex": f"^{P1_PREFIX}"}})
        mongo[coll].delete_many({"email": {"$regex": f"^{P1_PREFIX}"}})


def p1_id(suffix: str = "") -> str:
    import uuid as _u
    return f"{P1_PREFIX}{_u.uuid4().hex[:10]}{('_' + suffix) if suffix else ''}"
