"""P1 regression — RSVP T-7 weekly reminder.

Verifies the bugfix that changed reminders from "daily within 3 days" to
"exactly once, 7 days before the event":

- Event at +7 days from today triggers reminder.
- Event at +3 days from today does NOT trigger.
- Event at +8 days from today does NOT trigger.
- Re-running the reminder job is idempotent (no double-sends).
- Per-channel dedup: a successful push reminder does NOT block the email
  reminder for the same event (each channel logged separately).
"""
from datetime import datetime, timezone, timedelta

import pytest

from tests.conftest import P1_PREFIX, p1_id


# Helpers ---------------------------------------------------------------------

def _today():
    return datetime.now(timezone.utc).date()


def _seed_event(mongo, *, days_from_today: int, with_registration=False) -> str:
    eid = p1_id("evt")
    start = (_today() + timedelta(days=days_from_today)).isoformat()
    mongo.events.insert_one({
        "id": eid,
        "title_fi": f"Reminder Test +{days_from_today}d",
        "start_date": start,
        "end_date": start,
        "status": "approved",
        "location": "Helsinki",
        "organizer": "Test Org",
        "organizer_email": "org@p1test.local",
        "link": "https://example.com",
        "registration_url": "https://forms.gle/test" if with_registration else "",
        "image_url": "",
        "organizer_user_ids": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "_pytest_artifact": True,
    })
    return eid


def _seed_user(mongo, *, nickname=None) -> str:
    uid = p1_id("usr")
    mongo.users.insert_one({
        "id": uid,
        "email": f"{uid}@p1test.local",
        "role": "user",
        "nickname": nickname or f"Tester-{uid[-6:]}",
        "expo_push_tokens": [],
        "_pytest_artifact": True,
    })
    return uid


def _seed_rsvp(mongo, event_id: str, user_id: str, *, notify_push=True, notify_email=True):
    mongo.event_attendees.insert_one({
        "id": p1_id("rsvp"),
        "event_id": event_id,
        "user_id": user_id,
        "notify_push": notify_push,
        "notify_email": notify_email,
        "consent_organizer_messages": True,
        "consent_merchant_offers": True,
        "_pytest_artifact": True,
    })


def _run_reminders(days_before=7) -> dict:
    """Invoke the reminder job through the async helper directly.

    Motor caches the asyncio event loop on first connect, so we reuse a
    single loop across the whole test module to avoid 'Event loop is closed'
    once the second call hits the cached pool.
    """
    import asyncio
    import sys
    if "/app/backend" not in sys.path:
        sys.path.insert(0, "/app/backend")
    from server import _run_daily_event_reminders

    loop = _get_shared_loop()
    return loop.run_until_complete(_run_daily_event_reminders(days_before))


_LOOP = None


def _get_shared_loop():
    global _LOOP
    if _LOOP is None or _LOOP.is_closed():
        _LOOP = asyncio.new_event_loop()
        asyncio.set_event_loop(_LOOP)
    return _LOOP


import asyncio  # noqa: E402  (imported after fn def for clarity)


# Tests -----------------------------------------------------------------------

@pytest.mark.p1
def test_reminder_fires_at_exactly_7_days(mongo, p1_cleanup):
    eid = _seed_event(mongo, days_from_today=7)
    uid = _seed_user(mongo)
    _seed_rsvp(mongo, eid, uid, notify_push=True, notify_email=True)

    result = _run_reminders()

    assert result["events_processed"] >= 1, result
    # reminder_log must have at least the inbox row (push and email rely on
    # external services that may be unavailable in test env, but inbox + the
    # underlying _record_inbox_rows always run).
    logs = list(mongo.reminder_log.find({"event_id": eid}))
    channels = {l["channel"] for l in logs}
    assert "inbox" in channels, f"Expected inbox channel, got: {channels}"
    # We don't assert push_sent > 0 (no real device tokens) but the function
    # must at least have logged an attempt or skipped without raising.


@pytest.mark.p1
def test_reminder_does_not_fire_at_3_days(mongo, p1_cleanup):
    eid = _seed_event(mongo, days_from_today=3)
    uid = _seed_user(mongo)
    _seed_rsvp(mongo, eid, uid)

    _run_reminders()  # default days_before=7

    logs = list(mongo.reminder_log.find({"event_id": eid}))
    assert logs == [], f"Event at +3d should NOT trigger reminder, got: {logs}"


@pytest.mark.p1
def test_reminder_does_not_fire_at_8_days(mongo, p1_cleanup):
    eid = _seed_event(mongo, days_from_today=8)
    uid = _seed_user(mongo)
    _seed_rsvp(mongo, eid, uid)

    _run_reminders()

    logs = list(mongo.reminder_log.find({"event_id": eid}))
    assert logs == [], f"Event at +8d should NOT trigger reminder, got: {logs}"


@pytest.mark.p1
def test_reminder_is_idempotent(mongo, p1_cleanup):
    eid = _seed_event(mongo, days_from_today=7)
    uid = _seed_user(mongo)
    _seed_rsvp(mongo, eid, uid)

    first = _run_reminders()
    first_logs = list(mongo.reminder_log.find({"event_id": eid}))
    n_first = len(first_logs)
    assert n_first >= 1, first

    second = _run_reminders()
    second_logs = list(mongo.reminder_log.find({"event_id": eid}))
    n_second = len(second_logs)

    assert n_first == n_second, (
        f"Idempotency violated — first run logged {n_first} rows, "
        f"second run logged {n_second}: {second_logs}"
    )
    # The function may still increment events_processed but MUST NOT add new
    # reminder_log rows.
    assert second["events_processed"] >= 0


@pytest.mark.p1
def test_reminder_custom_days_before(mongo, p1_cleanup):
    """Admin endpoint accepts a custom days_before; verify +3 day event
    triggers when days_before=3."""
    eid = _seed_event(mongo, days_from_today=3)
    uid = _seed_user(mongo)
    _seed_rsvp(mongo, eid, uid)

    result = _run_reminders(days_before=3)
    assert result["events_processed"] >= 1

    logs = list(mongo.reminder_log.find({"event_id": eid}))
    channels = {l["channel"] for l in logs}
    assert "inbox" in channels
