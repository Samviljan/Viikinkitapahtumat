"""End-to-end backend test suite for Viikinkitapahtumat API.
Covers: health, auth (login/me/logout), public events (submit/list/detail/filter),
admin events (list/get/patch/delete), admin stats, and authorization checks.
"""
import os
import pytest

ADMIN_EMAIL = os.environ.get("TEST_ADMIN_EMAIL", "admin@viikinkitapahtumat.fi")
# Admin password is NEVER hardcoded. Export TEST_ADMIN_PASSWORD to run tests.
ADMIN_PASSWORD = os.environ.get("TEST_ADMIN_PASSWORD")
assert ADMIN_PASSWORD, "TEST_ADMIN_PASSWORD env var is required to run tests"


# ---------- Health ----------
class TestHealth:
    def test_root(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/")
        assert r.status_code == 200
        assert "message" in r.json()

    def test_health(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/health")
        assert r.status_code == 200
        assert r.json()["status"] == "ok"


# ---------- Auth ----------
class TestAuth:
    def test_login_success(self, api_client, base_url):
        r = api_client.post(
            f"{base_url}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["email"] == ADMIN_EMAIL
        assert data["role"] == "admin"
        assert isinstance(data["token"], str) and len(data["token"]) > 20
        # Cookie set
        assert "access_token" in r.cookies or any(
            "access_token" in c for c in r.headers.get("set-cookie", "").split(",")
        )

    def test_login_invalid_password(self, api_client, base_url):
        r = api_client.post(
            f"{base_url}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": "wrong"},
        )
        assert r.status_code == 401

    def test_login_invalid_email(self, api_client, base_url):
        r = api_client.post(
            f"{base_url}/api/auth/login",
            json={"email": "nobody@example.com", "password": "x"},
        )
        assert r.status_code == 401

    def test_me_with_bearer_token(self, admin_client, base_url):
        r = admin_client.get(f"{base_url}/api/auth/me")
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["email"] == ADMIN_EMAIL
        assert data["role"] == "admin"
        assert "id" in data
        # _id must not leak
        assert "_id" not in data
        assert "password_hash" not in data

    def test_me_without_token(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/auth/me")
        assert r.status_code == 401

    def test_me_with_cookie(self, api_client, base_url):
        # Use cookie-based session
        r = api_client.post(
            f"{base_url}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        )
        assert r.status_code == 200
        r2 = api_client.get(f"{base_url}/api/auth/me")
        assert r2.status_code == 200
        assert r2.json()["email"] == ADMIN_EMAIL

    def test_logout(self, api_client, base_url):
        api_client.post(
            f"{base_url}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        )
        r = api_client.post(f"{base_url}/api/auth/logout")
        assert r.status_code == 200
        assert r.json()["ok"] is True


# ---------- Public Events ----------
@pytest.fixture
def submitted_event(api_client, base_url):
    payload = {
        "title_fi": "TEST_Markkinat",
        "title_en": "TEST_Market",
        "description_fi": "Testi kuvaus",
        "category": "market",
        "location": "Helsinki",
        "start_date": "2026-06-15",
        "end_date": "2026-06-16",
        "organizer": "TEST_Org",
        "organizer_email": "test@example.com",
    }
    r = api_client.post(f"{base_url}/api/events", json=payload)
    assert r.status_code == 201, r.text
    return r.json()


class TestPublicEvents:
    def test_submit_event_pending(self, submitted_event):
        assert submitted_event["status"] == "pending"
        assert submitted_event["title_fi"] == "TEST_Markkinat"
        assert submitted_event["category"] == "market"
        assert "id" in submitted_event
        assert len(submitted_event["id"]) >= 32  # UUID-ish
        assert "_id" not in submitted_event

    def test_submit_event_invalid_category(self, api_client, base_url):
        r = api_client.post(
            f"{base_url}/api/events",
            json={
                "title_fi": "X",
                "description_fi": "Y",
                "category": "invalid_cat",
                "location": "L",
                "start_date": "2026-01-01",
                "organizer": "O",
            },
        )
        assert r.status_code == 422

    def test_submit_event_missing_required(self, api_client, base_url):
        r = api_client.post(f"{base_url}/api/events", json={"title_fi": "X"})
        assert r.status_code == 422

    def test_get_pending_event_returns_404(self, api_client, base_url, submitted_event):
        r = api_client.get(f"{base_url}/api/events/{submitted_event['id']}")
        assert r.status_code == 404

    def test_list_events_only_approved(self, api_client, base_url, submitted_event):
        r = api_client.get(f"{base_url}/api/events")
        assert r.status_code == 200
        ids = [e["id"] for e in r.json()]
        # The pending one should not be visible
        assert submitted_event["id"] not in ids

    def test_get_nonexistent_event(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/events/nonexistent-id-xyz")
        assert r.status_code == 404


# ---------- Admin Events ----------
class TestAdminEvents:
    def test_admin_required_no_auth(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/admin/events")
        assert r.status_code == 401

    def test_admin_required_no_auth_patch(self, api_client, base_url):
        r = api_client.patch(
            f"{base_url}/api/admin/events/some-id", json={"status": "approved"}
        )
        assert r.status_code == 401

    def test_admin_required_no_auth_delete(self, api_client, base_url):
        r = api_client.delete(f"{base_url}/api/admin/events/some-id")
        assert r.status_code == 401

    def test_admin_list_pending(self, admin_client, base_url, submitted_event):
        r = admin_client.get(f"{base_url}/api/admin/events?status=pending")
        assert r.status_code == 200
        ids = [e["id"] for e in r.json()]
        assert submitted_event["id"] in ids

    def test_admin_list_all(self, admin_client, base_url):
        r = admin_client.get(f"{base_url}/api/admin/events?status=all")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_admin_get_event(self, admin_client, base_url, submitted_event):
        r = admin_client.get(f"{base_url}/api/admin/events/{submitted_event['id']}")
        assert r.status_code == 200
        assert r.json()["id"] == submitted_event["id"]

    def test_admin_approve_then_public_visible(self, admin_client, api_client, base_url, submitted_event):
        # Approve
        r = admin_client.patch(
            f"{base_url}/api/admin/events/{submitted_event['id']}",
            json={"status": "approved"},
        )
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "approved"

        # Now publicly visible via detail
        r2 = api_client.get(f"{base_url}/api/events/{submitted_event['id']}")
        assert r2.status_code == 200
        assert r2.json()["status"] == "approved"

        # And in list
        r3 = api_client.get(f"{base_url}/api/events")
        ids = [e["id"] for e in r3.json()]
        assert submitted_event["id"] in ids

    def test_filter_by_category(self, admin_client, api_client, base_url):
        # Submit and approve a training_camp event (future date so it appears in default list)
        payload = {
            "title_fi": "TEST_TrainingCamp",
            "description_fi": "kuvaus",
            "category": "training_camp",
            "location": "Turku",
            "start_date": "2027-07-01",
            "organizer": "TEST_Org",
        }
        r = api_client.post(f"{base_url}/api/events", json=payload)
        assert r.status_code == 201
        ev_id = r.json()["id"]
        admin_client.patch(
            f"{base_url}/api/admin/events/{ev_id}", json={"status": "approved"}
        )
        # Filter
        r2 = api_client.get(f"{base_url}/api/events?category=training_camp")
        assert r2.status_code == 200
        cats = {e["category"] for e in r2.json()}
        assert cats == {"training_camp"}
        # cleanup
        admin_client.delete(f"{base_url}/api/admin/events/{ev_id}")

    def test_battle_category_rejected(self, api_client, base_url):
        # 'battle' is removed from EventCategory Literal -> 422
        r = api_client.post(
            f"{base_url}/api/events",
            json={
                "title_fi": "TEST_OldBattle",
                "description_fi": "x",
                "category": "battle",
                "location": "L",
                "start_date": "2027-06-01",
                "organizer": "TEST_Org",
            },
        )
        assert r.status_code == 422

    def test_admin_reject(self, admin_client, base_url, api_client):
        r = api_client.post(
            f"{base_url}/api/events",
            json={
                "title_fi": "TEST_ToBeRejected",
                "description_fi": "x",
                "category": "other",
                "location": "L",
                "start_date": "2026-06-01",
                "organizer": "TEST_Org",
            },
        )
        ev_id = r.json()["id"]
        r2 = admin_client.patch(
            f"{base_url}/api/admin/events/{ev_id}", json={"status": "rejected"}
        )
        assert r2.status_code == 200
        assert r2.json()["status"] == "rejected"
        # Cleanup
        admin_client.delete(f"{base_url}/api/admin/events/{ev_id}")

    def test_admin_delete(self, admin_client, base_url, api_client):
        r = api_client.post(
            f"{base_url}/api/events",
            json={
                "title_fi": "TEST_ToDelete",
                "description_fi": "x",
                "category": "other",
                "location": "L",
                "start_date": "2026-06-01",
                "organizer": "TEST_Org",
            },
        )
        ev_id = r.json()["id"]
        r2 = admin_client.delete(f"{base_url}/api/admin/events/{ev_id}")
        assert r2.status_code == 200
        # Verify gone
        r3 = admin_client.get(f"{base_url}/api/admin/events/{ev_id}")
        assert r3.status_code == 404

    def test_admin_delete_nonexistent(self, admin_client, base_url):
        r = admin_client.delete(f"{base_url}/api/admin/events/does-not-exist-id")
        assert r.status_code == 404

    def test_admin_stats(self, admin_client, base_url):
        r = admin_client.get(f"{base_url}/api/admin/stats")
        assert r.status_code == 200
        data = r.json()
        for k in ("pending", "approved", "rejected"):
            assert k in data
            assert isinstance(data[k], int)


# ---------- Cleanup TEST_ events at end ----------
@pytest.fixture(scope="session", autouse=True)
def cleanup_test_data(request):
    yield
    # Best-effort cleanup
    import requests as _r
    try:
        _login = _r.post(
            f"{request.session.config.cache.get('base_url', None) or ''}",
            timeout=5,
        )
    except Exception:
        pass


def test_cleanup_test_events(admin_client, base_url):
    """Cleanup test data created during runs."""
    r = admin_client.get(f"{base_url}/api/admin/events?status=all")
    if r.status_code != 200:
        return
    for ev in r.json():
        if ev.get("title_fi", "").startswith("TEST_"):
            admin_client.delete(f"{base_url}/api/admin/events/{ev['id']}")
