"""P1 regression — `registration_url` field on events.

Verifies the field round-trips through:
- POST /api/events (submit)
- GET /api/events/{id}
- PATCH /api/admin/events/{id} (admin edit)
"""
import uuid

import pytest


def _submit_payload(suffix: str, **over):
    p = {
        "title_fi": f"P1 regurl {suffix}",
        "description_fi": "registration_url test",
        "category": "meetup",
        "location": "Helsinki",
        "start_date": "2099-06-01",
        "end_date": "2099-06-02",
        "organizer": "TEST org",
        "organizer_email": "test@example.com",
        "link": "https://example.com",
        "image_url": "",
    }
    p.update(over)
    return p


@pytest.mark.p1
def test_submit_persists_registration_url(base_url, api_client, admin_client):
    suffix = uuid.uuid4().hex[:8]
    payload = _submit_payload(suffix, registration_url="https://forms.gle/abc123")

    r = api_client.post(f"{base_url}/api/events", json=payload, timeout=15)
    assert r.status_code == 201, r.text
    eid = r.json()["id"]

    try:
        # Approve so GET /events/{id} doesn't 404 for unauth path
        admin_client.patch(
            f"{base_url}/api/admin/events/{eid}",
            json={"status": "approved"},
            timeout=15,
        )
        r2 = api_client.get(f"{base_url}/api/events/{eid}", timeout=30)
        assert r2.status_code == 200, r2.text
        assert r2.json().get("registration_url") == "https://forms.gle/abc123"
    finally:
        admin_client.delete(f"{base_url}/api/admin/events/{eid}", timeout=30)


@pytest.mark.p1
def test_submit_without_registration_url_returns_empty_string(base_url, api_client, admin_client):
    suffix = uuid.uuid4().hex[:8]
    r = api_client.post(f"{base_url}/api/events", json=_submit_payload(suffix), timeout=30)
    assert r.status_code == 201, r.text
    eid = r.json()["id"]
    try:
        admin_client.patch(
            f"{base_url}/api/admin/events/{eid}",
            json={"status": "approved"},
            timeout=30,
        )
        r2 = api_client.get(f"{base_url}/api/events/{eid}", timeout=30)
        assert r2.status_code == 200
        # Either empty string or missing — the EventOut model defaults to "".
        assert r2.json().get("registration_url", "") == ""
    finally:
        admin_client.delete(f"{base_url}/api/admin/events/{eid}", timeout=30)


@pytest.mark.p1
def test_admin_can_update_registration_url(base_url, api_client, admin_client):
    suffix = uuid.uuid4().hex[:8]
    r = api_client.post(f"{base_url}/api/events", json=_submit_payload(suffix), timeout=15)
    assert r.status_code == 201
    eid = r.json()["id"]
    try:
        # Approve via PATCH (status-only endpoint)
        r_approve = admin_client.patch(
            f"{base_url}/api/admin/events/{eid}",
            json={"status": "approved"},
            timeout=15,
        )
        assert r_approve.status_code == 200, r_approve.text
        # Full-content edit via PUT
        edit_payload = _submit_payload(suffix, registration_url="https://lyyti.fi/test")
        r2 = admin_client.put(
            f"{base_url}/api/admin/events/{eid}",
            json=edit_payload,
            timeout=15,
        )
        assert r2.status_code == 200, r2.text
        r3 = api_client.get(f"{base_url}/api/events/{eid}", timeout=15)
        assert r3.status_code == 200
        assert r3.json().get("registration_url") == "https://lyyti.fi/test"
    finally:
        admin_client.delete(f"{base_url}/api/admin/events/{eid}", timeout=15)
