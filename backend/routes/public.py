"""Public web endpoints — SEO (bot prerender + sitemap), iCal feed,
newsletter subscribe/unsubscribe, and per-event email reminder subscriptions.

Extracted from server.py — public API surface unchanged (URLs, response
shapes, status codes, headers).

Usage from server.py::

    from routes.public import create_public_router
    api_router.include_router(
        create_public_router(db)
    )
"""
from __future__ import annotations

import json
import logging
import os
import re
import uuid
from datetime import datetime, timedelta, timezone
from html import escape as html_escape
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request, Response
from fastapi.responses import HTMLResponse, RedirectResponse
from pydantic import BaseModel, EmailStr

from email_service import (
    make_unsubscribe_token,
    send_reminder_confirmation as svc_send_reminder_confirmation,
    send_subscribe_confirmation,
)

logger = logging.getLogger(__name__)


# =============================================================================
# Models
# =============================================================================
class SubscribeRequest(BaseModel):
    email: EmailStr
    lang: Optional[str] = "fi"


class ReminderRequest(BaseModel):
    email: EmailStr
    lang: Optional[str] = "fi"


# =============================================================================
# SEO helpers (bot prerender)
# =============================================================================
_BOT_REDIRECT_HTML_AFTER_S = 0  # 0 = instant, kept for tweakability


def _pick_localized_field(doc: Dict[str, Any], base: str, lang: str = "fi") -> str:
    """Pick `<base>_<lang>` from a Mongo event doc, falling back through
    Finnish -> English -> Swedish -> any other localized variant -> empty."""
    candidates = [
        f"{base}_{lang}",
        f"{base}_fi",
        f"{base}_en",
        f"{base}_sv",
        f"{base}_de",
        f"{base}_da",
        f"{base}_et",
        f"{base}_pl",
    ]
    for k in candidates:
        v = (doc.get(k) or "").strip()
        if v:
            return v
    return ""


def _event_jsonld(event: Dict[str, Any], canonical_url: str, og_image: str) -> Dict[str, Any]:
    """Build a schema.org/Event JSON-LD payload from a Mongo event document.
    Only includes fields with a non-empty value (Google ignores empty strings
    but rejects malformed JSON-LD, so we keep it lean)."""
    title = _pick_localized_field(event, "title")
    desc = _pick_localized_field(event, "description")
    start = (event.get("start_date") or "").strip()
    end = (event.get("end_date") or start).strip()
    location = (event.get("location") or "").strip()
    organizer = (event.get("organizer") or "").strip()
    organizer_email = (event.get("organizer_email") or "").strip()
    link = (event.get("link") or "").strip()
    registration = (event.get("registration_url") or "").strip()
    image_url = (event.get("image_url") or "").strip()

    payload: Dict[str, Any] = {
        "@context": "https://schema.org",
        "@type": "Event",
        "name": title,
        "startDate": start,
        "eventStatus": "https://schema.org/EventScheduled",
        "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
        "url": canonical_url,
    }
    if end and end != start:
        payload["endDate"] = end
    if desc:
        payload["description"] = desc.replace("\r\n", "\n").strip()
    if location:
        payload["location"] = {
            "@type": "Place",
            "name": location,
            "address": location,
        }
    if organizer:
        org_payload: Dict[str, Any] = {"@type": "Organization", "name": organizer}
        if organizer_email:
            org_payload["email"] = organizer_email
        if link:
            org_payload["url"] = link
        payload["organizer"] = org_payload
    if image_url or og_image:
        # Prefer the rendered OG card (1200×630, branded) when available
        # because Twitter/X, LinkedIn, WhatsApp and Slack prefer that ratio.
        payload["image"] = [og_image] if og_image else [image_url]
    if registration:
        payload["offers"] = {
            "@type": "Offer",
            "url": registration,
            "availability": "https://schema.org/InStock",
            "price": "0",
            "priceCurrency": "EUR",
        }
    return payload


# =============================================================================
# iCal helpers
# =============================================================================
def _ical_escape(s: str) -> str:
    return (
        (s or "")
        .replace("\\", "\\\\")
        .replace(";", "\\;")
        .replace(",", "\\,")
        .replace("\n", "\\n")
    )


def _to_ical_date(iso_date: str) -> str:
    return iso_date.replace("-", "")


# =============================================================================
# Router factory
# =============================================================================
def create_public_router(db) -> APIRouter:
    """Build the /api/... router for public SEO / iCal / newsletter routes."""
    router = APIRouter()

    # -------------------------------------------------------------------------
    # Bot prerender — server-rendered HTML snapshot for an event page
    # -------------------------------------------------------------------------
    # Why this exists:
    # The main web app is a React SPA. Even though modern Googlebot executes
    # JavaScript, crawlers like bingbot, DuckDuckBot, Slackbot, LinkedInBot,
    # Twitterbot, WhatsApp, Telegram and Facebook do NOT — they see the empty
    # `index.html`. This endpoint returns a fully-populated HTML snapshot
    # containing the event title, description, hero image, structured data
    # (schema.org/Event JSON-LD) and Open Graph tags so any crawler hitting
    # this URL can index/preview the event correctly.
    #
    # It is hooked into the bot path through:
    #   1) Direct route — production reverse proxy / CDN may forward known bot
    #      user-agents to `/api/prerender/events/{id}` and serve the rendered
    #      HTML to the bot while regular users still get the React SPA.
    #   2) Sitemap — already exposed via `/api/sitemap.xml`.
    #
    # Keep this rendering side-effect free, simple, and resilient: never raise
    # for missing optional fields.
    @router.get("/prerender/events/{event_id}", include_in_schema=False)
    async def prerender_event(event_id: str, request: Request):
        """Server-rendered HTML snapshot for crawlers / non-JS clients.

        Returns a fully populated `<html>` document with:
          - <title> / <meta description> / canonical
          - Open Graph + Twitter card meta
          - schema.org/Event JSON-LD
          - Visible <h1>, <p>, <time>, <a> elements containing the event data
            so crawlers without JS still index meaningful content.
        The body also redirects regular browsers back to the SPA route via
        <meta http-equiv="refresh">, so if a real user lands here directly
        they get the interactive page after the bot snapshot has been read.
        """
        # SECURITY: constrain `event_id` to the safe UUID-hex+hyphen alphabet
        # before it flows anywhere near the HTML response. This is defence in
        # depth on top of `html_escape` — protects against reflected XSS even
        # if a downstream formatter ever forgets to escape. Real event IDs are
        # UUID4 strings (see EventCreate) so any non-conforming ID is invalid
        # by definition and can short-circuit to 404 without DB lookup.
        if not re.fullmatch(r"[A-Za-z0-9._-]{1,64}", event_id):
            raise HTTPException(status_code=404, detail="Event not found")

        event = await db.events.find_one(
            {"id": event_id, "status": "approved"}, {"_id": 0}
        )
        if not event:
            raise HTTPException(status_code=404, detail="Event not found")

        site_base = "https://viikinkitapahtumat.fi"
        canonical = f"{site_base}/events/{event_id}"
        # OG image is served by the backend itself. We use the request base_url
        # so the URL works in both preview and production environments; in
        # production the proxy maps `/api/og/events/*.jpg` back to this backend.
        og_image = f"{site_base}/api/og/events/{event_id}.jpg"
        _ = request  # kept for future use (e.g., extracting Accept-Language)

        title = _pick_localized_field(event, "title") or "Viikinkitapahtumat"
        desc_full = _pick_localized_field(event, "description")
        desc_short = " ".join(desc_full.split())[:300]
        location = (event.get("location") or "").strip()
        organizer = (event.get("organizer") or "").strip()
        start = (event.get("start_date") or "").strip()
        end = (event.get("end_date") or "").strip()
        category = (event.get("category") or "").strip()
        country = (event.get("country") or "FI").strip()
        link = (event.get("link") or "").strip()
        registration = (event.get("registration_url") or "").strip()

        jsonld = _event_jsonld(event, canonical, og_image)
        # JSON inside a <script> tag is XSS-prone if any value contains
        # `</script>`, `<!--` or similar HTML-sensitive sequences. `json.dumps`
        # does NOT escape `<`, `>` or `&` — they are valid in JSON but not
        # safe when the payload lives inside an HTML <script>. Escape these
        # to their Unicode equivalents so the JSON stays semantically the
        # same while being unable to break out of the script context.
        # https://owasp.org/www-community/attacks/xss/ — DOM/Stored XSS via JSON
        jsonld_str = (
            json.dumps(jsonld, ensure_ascii=False, separators=(",", ":"))
            .replace("<", "\\u003c")
            .replace(">", "\\u003e")
            .replace("&", "\\u0026")
            .replace("\u2028", "\\u2028")
            .replace("\u2029", "\\u2029")
        )

        date_str = start if not end or end == start else f"{start} – {end}"

        # Build the visible body. We deliberately use plain semantic HTML (no
        # CSS, no JS) so even text-only crawlers like Slackbot/Twitterbot can
        # parse it. The <meta http-equiv="refresh"> bounces real browsers to
        # the SPA route once they've loaded the snapshot.
        body_parts: List[str] = [
            f"<h1>{html_escape(title)}</h1>",
            f"<p><strong>{html_escape(date_str)}</strong>"
            + (f" · {html_escape(location)}" if location else "")
            + (f" · {html_escape(organizer)}" if organizer else "")
            + "</p>",
        ]
        if desc_full:
            # Preserve paragraphs from the source description.
            for para in desc_full.split("\n\n"):
                para = para.strip()
                if para:
                    body_parts.append(f"<p>{html_escape(para)}</p>")
        extra_links: List[str] = []
        if link:
            extra_links.append(
                f'<a rel="noopener" href="{html_escape(link)}">Tapahtuman verkkosivu</a>'
            )
        if registration:
            extra_links.append(
                f'<a rel="noopener" href="{html_escape(registration)}">Ilmoittaudu</a>'
            )
        if extra_links:
            body_parts.append("<p>" + " · ".join(extra_links) + "</p>")
        body_parts.append(
            f'<p><a href="{html_escape(canonical)}">Avaa tapahtumasivu →</a></p>'
        )
        body_html = "\n".join(body_parts)

        html_doc = f"""<!doctype html>
<html lang="fi">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>{html_escape(title)} — Viikinkitapahtumat</title>
<meta name="description" content="{html_escape(desc_short or title)}" />
<meta name="robots" content="index, follow, max-image-preview:large" />
<link rel="canonical" href="{html_escape(canonical)}" />
<meta property="og:type" content="event" />
<meta property="og:site_name" content="Viikinkitapahtumat" />
<meta property="og:title" content="{html_escape(title)}" />
<meta property="og:description" content="{html_escape(desc_short or title)}" />
<meta property="og:url" content="{html_escape(canonical)}" />
<meta property="og:image" content="{html_escape(og_image)}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="{html_escape(title)}" />
<meta name="twitter:description" content="{html_escape(desc_short or title)}" />
<meta name="twitter:image" content="{html_escape(og_image)}" />
<meta name="event:category" content="{html_escape(category)}" />
<meta name="event:country" content="{html_escape(country)}" />
<meta http-equiv="refresh" content="{_BOT_REDIRECT_HTML_AFTER_S};url={html_escape(canonical)}" />
<script type="application/ld+json">{jsonld_str}</script>
</head>
<body>
{body_html}
</body>
</html>"""
        return HTMLResponse(
            content=html_doc,
            headers={
                # Allow CDN caching for 5 minutes; crawlers re-fetch often enough.
                "Cache-Control": "public, max-age=300, s-maxage=300",
                "X-Robots-Tag": "index, follow",
            },
        )

    # -------------------------------------------------------------------------
    # iCal feed (public)
    # -------------------------------------------------------------------------
    @router.get("/events.ics")
    async def events_ical():
        docs = (
            await db.events.find({"status": "approved"}, {"_id": 0})
            .sort("start_date", 1)
            .to_list(2000)
        )
        today = datetime.now(timezone.utc).date().isoformat()
        docs = [d for d in docs if (d.get("end_date") or d.get("start_date") or "") >= today]
        site = os.environ.get("PUBLIC_SITE_URL", "").rstrip("/")
        lines = [
            "BEGIN:VCALENDAR",
            "VERSION:2.0",
            "PRODID:-//Viikinkitapahtumat//FI",
            "CALSCALE:GREGORIAN",
            "METHOD:PUBLISH",
            "X-WR-CALNAME:Viikinkitapahtumat",
            "X-WR-TIMEZONE:Europe/Helsinki",
        ]
        for d in docs:
            try:
                start = _to_ical_date(d["start_date"])
                end_raw = d.get("end_date") or d["start_date"]
                end_dt = (
                    datetime.fromisoformat(end_raw) + timedelta(days=1)
                ).date().isoformat()
                end = _to_ical_date(end_dt)
            except Exception:  # noqa: BLE001
                continue
            url = f"{site}/events/{d['id']}" if site else ""
            summary = _ical_escape(d.get("title_fi") or "")
            location = _ical_escape(d.get("location") or "")
            desc_parts = []
            if d.get("description_fi"):
                desc_parts.append(d["description_fi"])
            if d.get("organizer"):
                desc_parts.append(f"Järjestäjä: {d['organizer']}")
            if url:
                desc_parts.append(url)
            description = _ical_escape("\n\n".join(desc_parts))
            dtstamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
            lines += [
                "BEGIN:VEVENT",
                f"UID:{d['id']}@viikinkitapahtumat.fi",
                f"DTSTAMP:{dtstamp}",
                f"DTSTART;VALUE=DATE:{start}",
                f"DTEND;VALUE=DATE:{end}",
                f"SUMMARY:{summary}",
                f"LOCATION:{location}",
                f"DESCRIPTION:{description}",
            ]
            if url:
                lines.append(f"URL:{url}")
            lines.append("END:VEVENT")
        lines.append("END:VCALENDAR")
        body = "\r\n".join(lines) + "\r\n"
        return Response(
            content=body,
            media_type="text/calendar; charset=utf-8",
            headers={"Content-Disposition": 'inline; filename="viikinkitapahtumat.ics"'},
        )

    # -------------------------------------------------------------------------
    # Newsletter (public)
    # -------------------------------------------------------------------------
    @router.post("/newsletter/subscribe")
    async def subscribe(payload: SubscribeRequest, background: BackgroundTasks):
        email = payload.email.lower()
        existing = await db.newsletter_subscribers.find_one({"email": email})
        if existing and existing.get("status") == "active":
            return {"ok": True, "already": True}
        token = make_unsubscribe_token()
        doc = {
            "id": existing.get("id") if existing else str(uuid.uuid4()),
            "email": email,
            "lang": payload.lang or "fi",
            "status": "active",
            "unsubscribe_token": token,
            "created_at": existing.get("created_at")
            if existing
            else datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.newsletter_subscribers.update_one(
            {"email": email},
            {"$set": doc},
            upsert=True,
        )
        background.add_task(send_subscribe_confirmation, email, token)
        return {"ok": True}

    @router.get("/newsletter/unsubscribe")
    async def unsubscribe(token: str):
        res = await db.newsletter_subscribers.update_one(
            {"unsubscribe_token": token},
            {
                "$set": {
                    "status": "unsubscribed",
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }
            },
        )
        site = os.environ.get("PUBLIC_SITE_URL", "").rstrip("/")
        target = (
            f"{site}/?unsub={'ok' if res.modified_count else 'invalid'}"
            if site
            else "/"
        )
        return RedirectResponse(url=target, status_code=303)

    # -------------------------------------------------------------------------
    # Per-event email reminder (public)
    # -------------------------------------------------------------------------
    @router.post("/events/{event_id}/remind")
    async def request_event_reminder(
        event_id: str, payload: ReminderRequest, background: BackgroundTasks
    ):
        ev = await db.events.find_one(
            {"id": event_id, "status": "approved"}, {"_id": 0}
        )
        if not ev:
            raise HTTPException(status_code=404, detail="Event not found")
        email = payload.email.lower()
        existing = await db.event_reminders.find_one(
            {"event_id": event_id, "email": email}
        )
        if existing and existing.get("status") == "active":
            return {"ok": True, "already": True}
        token = make_unsubscribe_token()
        now = datetime.now(timezone.utc).isoformat()
        doc = {
            "id": existing.get("id") if existing else str(uuid.uuid4()),
            "event_id": event_id,
            "email": email,
            "lang": payload.lang or "fi",
            "status": "active",
            "unsubscribe_token": token,
            "created_at": existing.get("created_at") if existing else now,
            "updated_at": now,
            "sent_at": None,
        }
        await db.event_reminders.update_one(
            {"event_id": event_id, "email": email},
            {"$set": doc},
            upsert=True,
        )
        background.add_task(svc_send_reminder_confirmation, ev, email, token)
        return {"ok": True}

    @router.get("/reminders/unsubscribe")
    async def unsubscribe_reminder(token: str):
        res = await db.event_reminders.update_one(
            {"unsubscribe_token": token},
            {
                "$set": {
                    "status": "unsubscribed",
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }
            },
        )
        site = os.environ.get("PUBLIC_SITE_URL", "").rstrip("/")
        target = (
            f"{site}/?reminder_unsub={'ok' if res.modified_count else 'invalid'}"
            if site
            else "/"
        )
        return RedirectResponse(url=target, status_code=303)

    # -------------------------------------------------------------------------
    # Sitemap (SEO — must be reachable on /sitemap.xml + /robots.txt).
    # Ingress only routes /api/* to the backend, so we expose sitemap under
    # /api/sitemap.xml and rely on a frontend rewrite (or redirect) for the
    # canonical /sitemap.xml URL. robots.txt itself lives in /frontend/public.
    # -------------------------------------------------------------------------
    @router.get("/sitemap.xml", include_in_schema=False)
    async def sitemap_xml():
        """Generate a multi-language sitemap of all approved events + key static
        pages. The base URL is intentionally hard-coded to the canonical public
        domain — Google Search Console rejects sitemaps containing URLs from a
        different host than the property where the sitemap was submitted."""
        base = "https://viikinkitapahtumat.fi"
        today = datetime.now(timezone.utc).date().isoformat()
        static_paths = [
            ("/", "1.0", "daily"),
            ("/events", "0.95", "daily"),
            ("/calendar", "0.8", "weekly"),
            ("/about", "0.5", "monthly"),
            ("/guide", "0.6", "monthly"),
            ("/privacy", "0.3", "yearly"),
            ("/submit", "0.5", "monthly"),
        ]
        parts = ['<?xml version="1.0" encoding="UTF-8"?>']
        parts.append(
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" '
            'xmlns:xhtml="http://www.w3.org/1999/xhtml">'
        )
        for path, prio, freq in static_paths:
            parts.append(
                f"  <url><loc>{base}{path}</loc>"
                f"<lastmod>{today}</lastmod>"
                f"<changefreq>{freq}</changefreq>"
                f"<priority>{prio}</priority></url>"
            )
        # All approved events
        cursor = db.events.find(
            {"status": "approved"},
            {
                "_id": 0,
                "id": 1,
                "start_date": 1,
                "title_fi": 1,
                "title_en": 1,
                "title_sv": 1,
                "title_da": 1,
                "title_de": 1,
                "title_et": 1,
                "title_pl": 1,
                "updated_at": 1,
            },
        )
        async for ev in cursor:
            ev_id = ev.get("id")
            if not ev_id:
                continue
            lastmod = ev.get("updated_at") or ev.get("start_date") or today
            if isinstance(lastmod, datetime):
                lastmod = lastmod.date().isoformat()
            elif isinstance(lastmod, str) and "T" in lastmod:
                lastmod = lastmod.split("T", 1)[0]
            url = f"{base}/events/{ev_id}"
            parts.append(
                f"  <url><loc>{url}</loc><lastmod>{lastmod}</lastmod>"
                f"<changefreq>weekly</changefreq><priority>0.85</priority>"
            )
            # hreflang alternates per language
            for code in ("fi", "en", "sv", "da", "de", "et", "pl"):
                parts.append(
                    f'    <xhtml:link rel="alternate" hreflang="{code}" '
                    f'href="{url}?lang={code}" />'
                )
            parts.append("  </url>")
        parts.append("</urlset>")
        return Response(
            content="\n".join(parts),
            media_type="application/xml",
            headers={"Cache-Control": "public, max-age=3600"},
        )

    return router
