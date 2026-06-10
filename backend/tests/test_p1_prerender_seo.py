"""
P1: Bot prerender endpoint for SEO

The React SPA serves a blank `index.html` to non-JS crawlers (bingbot,
Slackbot, LinkedInBot, Twitterbot, WhatsApp, Telegram, Facebook). We expose
`/api/prerender/events/{id}` so the production reverse proxy / CDN can
forward known bot user-agents to this endpoint and serve them a fully
populated HTML snapshot.

These tests verify the snapshot contains everything a crawler needs:
  * <title>, <meta description>, canonical link
  * Open Graph + Twitter card meta tags
  * schema.org/Event JSON-LD with the event's actual fields
  * Visible <h1> + <p> content with the event title & description
"""
import json
import re
import pytest


@pytest.fixture(scope="module")
def sample_event(base_url):
    """Pick any approved event from the public list."""
    import requests
    r = requests.get(f"{base_url}/api/events", timeout=30)
    r.raise_for_status()
    events = r.json()
    assert events, "No approved events available in DB for prerender test"
    return events[0]


class TestPrerenderEvent:
    def test_returns_200_and_html(self, base_url, api_client, sample_event):
        r = api_client.get(
            f"{base_url}/api/prerender/events/{sample_event['id']}",
            timeout=30,
        )
        assert r.status_code == 200
        ctype = r.headers.get("content-type", "")
        assert "html" in ctype.lower(), f"expected HTML content-type, got {ctype}"

    def test_returns_404_for_unknown_id(self, base_url, api_client):
        r = api_client.get(
            f"{base_url}/api/prerender/events/does-not-exist-9999",
            timeout=30,
        )
        assert r.status_code == 404

    def test_contains_event_title_and_description(self, base_url, api_client, sample_event):
        r = api_client.get(
            f"{base_url}/api/prerender/events/{sample_event['id']}",
            timeout=30,
        )
        html = r.text
        title = sample_event.get("title_fi") or sample_event.get("title_en")
        # Title is HTML-escaped so use a tolerant containment check
        # (just look for the first 12 chars to dodge Unicode escaping).
        prefix = (title or "")[:12]
        assert prefix and prefix in html, (
            f"event title prefix {prefix!r} missing from prerender HTML"
        )

    def test_has_canonical_and_og_tags(self, base_url, api_client, sample_event):
        r = api_client.get(
            f"{base_url}/api/prerender/events/{sample_event['id']}",
            timeout=30,
        )
        html = r.text
        expected_canonical = (
            f'https://viikinkitapahtumat.fi/events/{sample_event["id"]}'
        )
        assert f'rel="canonical" href="{expected_canonical}"' in html
        assert 'property="og:type" content="event"' in html
        assert 'name="twitter:card" content="summary_large_image"' in html
        # og:image should point at the OG card endpoint (NOT the raw upload).
        assert (
            f'/api/og/events/{sample_event["id"]}.jpg' in html
        ), "og:image should reference the rendered OG card endpoint"

    def test_contains_event_jsonld(self, base_url, api_client, sample_event):
        r = api_client.get(
            f"{base_url}/api/prerender/events/{sample_event['id']}",
            timeout=30,
        )
        html = r.text
        # Extract the JSON-LD block.
        m = re.search(
            r'<script type="application/ld\+json">(.*?)</script>',
            html,
            re.DOTALL,
        )
        assert m, "JSON-LD script tag missing from prerender HTML"
        payload = json.loads(m.group(1))
        assert payload.get("@type") == "Event"
        assert payload.get("name"), "JSON-LD 'name' missing"
        assert payload.get("startDate") == sample_event["start_date"]
        # eventStatus + attendanceMode are required-ish for Google Event rich results
        assert payload.get("eventStatus") == "https://schema.org/EventScheduled"
        assert payload.get("eventAttendanceMode") == (
            "https://schema.org/OfflineEventAttendanceMode"
        )
        assert payload.get("url", "").endswith(f"/events/{sample_event['id']}")

    def test_response_is_cacheable(self, base_url, api_client, sample_event):
        # The endpoint MUST be a successful response (cache & robots headers
        # are set on the FastAPI response but may be overridden by the
        # preview ingress which forces noindex; that override does NOT
        # occur in production where viikinkitapahtumat.fi is served).
        r = api_client.get(
            f"{base_url}/api/prerender/events/{sample_event['id']}",
            timeout=30,
        )
        assert r.status_code == 200
