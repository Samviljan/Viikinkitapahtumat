"""P1 regression — Variable substitution helpers + integration.

Direct unit tests of:
- `substitute_event_vars` — event-level placeholders.
- `substitute_recipient_vars` — per-recipient {{nickname}}.

The HTTP integration of /messages/send is covered by smoke tests rather
than full E2E here because actually sending live Resend emails to test
addresses is wasteful and can hit quota limits.
"""
import sys
import pytest

if "/app/backend" not in sys.path:
    sys.path.insert(0, "/app/backend")

from server import substitute_event_vars, substitute_recipient_vars  # noqa: E402


@pytest.mark.p1
def test_substitute_event_vars_replaces_all_placeholders():
    ev = {
        "id": "evt-99",
        "title_fi": "Bonk Pohjalla VII",
        "start_date": "2099-04-03",
        "location": "Oulu",
        "organizer": "Oulun Miekkailuseura",
        "registration_url": "https://forms.gle/abc",
    }
    text = (
        "Tervetuloa {{event_title}} ({{event_date}}, {{event_location}}). "
        "Ilm: {{registration_url}}. Lisää: {{event_url}}. — {{organizer_name}}"
    )
    out = substitute_event_vars(text, ev)
    assert "Bonk Pohjalla VII" in out
    assert "2099-04-03" in out
    assert "Oulu" in out
    assert "Oulun Miekkailuseura" in out
    assert "https://forms.gle/abc" in out
    assert "/events/evt-99" in out  # event_url interpolated
    # No raw placeholders left for known event-level keys.
    for ph in ("{{event_title}}", "{{event_date}}", "{{event_location}}",
               "{{registration_url}}", "{{event_url}}", "{{organizer_name}}"):
        assert ph not in out, f"Placeholder {ph} not substituted in: {out}"


@pytest.mark.p1
def test_substitute_event_vars_handles_missing_fields_gracefully():
    ev = {"id": "evt-x", "title_fi": "Tapahtuma X"}
    out = substitute_event_vars("Hi {{event_title}} at {{event_location}}", ev)
    # Missing fields render as empty string (not the literal placeholder).
    assert out == "Hi Tapahtuma X at "


@pytest.mark.p1
def test_substitute_event_vars_no_braces_is_noop():
    ev = {"id": "x", "title_fi": "T"}
    assert substitute_event_vars("Plain text", ev) == "Plain text"
    assert substitute_event_vars("", ev) == ""
    assert substitute_event_vars(None, ev) == ""


@pytest.mark.p1
def test_substitute_recipient_vars_uses_nickname():
    recip = {"nickname": "Ragnar", "email": "r@example.com"}
    out = substitute_recipient_vars("Hei {{nickname}}!", recip)
    assert out == "Hei Ragnar!"


@pytest.mark.p1
def test_substitute_recipient_vars_falls_back_to_email_local_part():
    recip = {"email": "loki@example.com"}  # no nickname
    out = substitute_recipient_vars("Hei {{nickname}}!", recip)
    assert out == "Hei loki!"


@pytest.mark.p1
def test_substitute_recipient_vars_with_none_recipient_blanks_placeholder():
    out = substitute_recipient_vars("Hei {{nickname}}!", None)
    # When recipient is missing, placeholder is replaced with empty string.
    assert out == "Hei !"


@pytest.mark.p1
def test_substitute_recipient_vars_no_placeholder_is_noop():
    recip = {"nickname": "Ragnar"}
    assert substitute_recipient_vars("Hello world", recip) == "Hello world"
    assert substitute_recipient_vars("", recip) == ""
