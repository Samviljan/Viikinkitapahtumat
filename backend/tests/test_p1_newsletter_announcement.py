"""P1 regression — Newsletter announcement endpoint.

POST /api/admin/newsletter/announcement sends a one-off bulletin to all
`active` newsletter subscribers. We don't exercise the actual Resend
delivery here (live API call, quota risk) — we verify:
- 401/403 without admin token.
- Validation (empty subject/body returns 422).
- 200 with a count payload when subject + body provided.
- message_log audit row inserted with event_id="newsletter".

A test subscriber is seeded directly via Mongo so we don't pollute the
real subscriber list, and is cleaned up via the p1_cleanup fixture
(prefix-based delete).
"""
from datetime import datetime, timezone

import pytest

from tests.conftest import p1_id


def _seed_subscriber(mongo, *, status="active") -> dict:
    sub_id = p1_id("sub")
    doc = {
        "id": sub_id,
        "email": f"{sub_id}@p1test.local",
        "status": status,
        "lang": "fi",
        "unsubscribe_token": f"tok_{sub_id}",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "_pytest_artifact": True,
    }
    mongo.newsletter_subscribers.insert_one(doc)
    return doc


@pytest.mark.p1
def test_announcement_requires_auth(base_url, api_client):
    r = api_client.post(
        f"{base_url}/api/admin/newsletter/announcement",
        json={"subject": "x", "body": "y"},
        timeout=15,
    )
    assert r.status_code in (401, 403), r.text


@pytest.mark.p1
def test_announcement_validates_required_fields(base_url, admin_client):
    r = admin_client.post(
        f"{base_url}/api/admin/newsletter/announcement",
        json={"subject": "", "body": "  "},
        timeout=15,
    )
    assert r.status_code in (400, 422), r.text


@pytest.mark.p1
def test_announcement_counts_active_subscribers(base_url, admin_client, mongo, p1_cleanup):
    # Snapshot baseline of how many active subs exist
    baseline = mongo.newsletter_subscribers.count_documents({"status": "active"})
    seeded = _seed_subscriber(mongo, status="active")
    _ = seeded  # baseline reference; assertion delta below makes use of it
    _ = _seed_subscriber(mongo, status="paused")  # should be ignored

    r = admin_client.post(
        f"{base_url}/api/admin/newsletter/announcement",
        json={
            "subject": "P1 Test Announcement",
            "body": "This is a P1 regression test message.",
            "cta_label": "Open site",
            "cta_url": "https://viikinkitapahtumat.fi",
        },
        timeout=30,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["recipients"] == baseline + 1, (
        f"Expected recipients={baseline + 1} (baseline + 1 test seed), got {body}"
    )
    assert body["sent"] + body.get("skipped", 0) == body["recipients"]

    # Audit row exists in message_log.
    log = mongo.message_log.find_one(
        {"event_id": "newsletter", "subject": "P1 Test Announcement"},
        sort=[("created_at", -1)],
    )
    assert log is not None, "Newsletter audit row not written to message_log"
    assert log.get("channel") == "email"
    assert log.get("recipients") == baseline + 1
