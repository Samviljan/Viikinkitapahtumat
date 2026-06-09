"""P1 regression — Email templates CRUD + authorization.

Endpoints under test:
- GET    /api/email-templates               (auth: admin OR paid_messaging)
- POST   /api/admin/email-templates          (admin only)
- PATCH  /api/admin/email-templates/{id}     (admin only)
- DELETE /api/admin/email-templates/{id}     (admin only)
"""
import uuid

import pytest


# Helpers ---------------------------------------------------------------------

def _new_template_payload(**over) -> dict:
    p = {
        "name": f"P1 Template {uuid.uuid4().hex[:6]}",
        "subject": "Subj {{event_title}}",
        "body": "Hei {{nickname}}!\n\nTervetuloa {{event_title}} ({{event_date}}).",
        "icon": "Bell",
        "color": "#C8492C",
    }
    p.update(over)
    return p


@pytest.fixture
def created_template(base_url, admin_client):
    """Create one template, return its id, clean up after."""
    r = admin_client.post(
        f"{base_url}/api/admin/email-templates",
        json=_new_template_payload(),
        timeout=15,
    )
    assert r.status_code == 200, r.text
    tid = r.json()["id"]
    yield tid
    admin_client.delete(f"{base_url}/api/admin/email-templates/{tid}", timeout=15)


# Tests -----------------------------------------------------------------------

@pytest.mark.p1
def test_admin_can_create_template(base_url, admin_client):
    payload = _new_template_payload(name="P1-create-test", icon="Sparkles", color="#C19C4D")
    r = admin_client.post(f"{base_url}/api/admin/email-templates", json=payload, timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["name"] == "P1-create-test"
    assert body["icon"] == "Sparkles"
    assert body["color"] == "#C19C4D"
    assert body["subject"].startswith("Subj")
    assert "id" in body and "created_at" in body
    # Cleanup
    admin_client.delete(f"{base_url}/api/admin/email-templates/{body['id']}", timeout=15)


@pytest.mark.p1
def test_create_requires_required_fields(base_url, admin_client):
    r = admin_client.post(
        f"{base_url}/api/admin/email-templates",
        json={"name": "x", "subject": "", "body": "  "},
        timeout=15,
    )
    assert r.status_code in (400, 422), r.text


@pytest.mark.p1
def test_unauthenticated_cannot_create(base_url, api_client):
    r = api_client.post(
        f"{base_url}/api/admin/email-templates",
        json=_new_template_payload(),
        timeout=15,
    )
    assert r.status_code in (401, 403), r.text


@pytest.mark.p1
def test_admin_can_list_templates(base_url, admin_client, created_template):
    r = admin_client.get(f"{base_url}/api/email-templates", timeout=15)
    assert r.status_code == 200, r.text
    items = r.json()
    assert isinstance(items, list)
    assert any(it["id"] == created_template for it in items), (
        f"Created template {created_template} not in list of {len(items)} items"
    )


@pytest.mark.p1
def test_anonymous_list_is_unauthenticated(base_url, api_client):
    """GET /email-templates requires auth (read access for paid users / admin)."""
    r = api_client.get(f"{base_url}/api/email-templates", timeout=15)
    assert r.status_code in (401, 403), r.text


@pytest.mark.p1
def test_admin_can_patch_template(base_url, admin_client, created_template):
    r = admin_client.patch(
        f"{base_url}/api/admin/email-templates/{created_template}",
        json={"name": "Renamed P1", "color": "#123456"},
        timeout=15,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["name"] == "Renamed P1"
    assert body["color"] == "#123456"
    # Untouched field still present
    assert body["subject"].startswith("Subj")


@pytest.mark.p1
def test_admin_can_delete_template(base_url, admin_client):
    # Create then delete in one test to avoid fixture cleanup conflict.
    r = admin_client.post(
        f"{base_url}/api/admin/email-templates",
        json=_new_template_payload(name="P1-delete-test"),
        timeout=15,
    )
    assert r.status_code == 200
    tid = r.json()["id"]
    r2 = admin_client.delete(f"{base_url}/api/admin/email-templates/{tid}", timeout=15)
    assert r2.status_code == 200, r2.text
    assert r2.json().get("deleted") is True
    # Subsequent GET should NOT include it
    r3 = admin_client.get(f"{base_url}/api/email-templates", timeout=15)
    assert all(it["id"] != tid for it in r3.json())


@pytest.mark.p1
def test_delete_missing_returns_404(base_url, admin_client):
    r = admin_client.delete(
        f"{base_url}/api/admin/email-templates/does-not-exist-{uuid.uuid4().hex[:6]}",
        timeout=15,
    )
    assert r.status_code == 404
