"""Lightweight Claude Haiku translator for event content fields.

Used as a FastAPI BackgroundTask: when an event is created or edited, any
empty (title|description) field is filled by translating the most-populated
sibling. Cheap, async-only, no message persistence.
"""

import logging
import os
import uuid
from typing import Optional

from emergentintegrations.llm.chat import LlmChat, UserMessage

logger = logging.getLogger(__name__)

LANG_NAME = {
    "fi": "Finnish",
    "en": "English",
    "sv": "Swedish",
    "da": "Danish",
    "de": "German",
    "et": "Estonian",
    "pl": "Polish",
}
SUPPORTED_LANGS = tuple(LANG_NAME.keys())  # primary order also used for fallback picking
MODEL = "claude-haiku-4-5-20251001"
PROVIDER = "anthropic"


async def translate(text: str, source: str, target: str) -> Optional[str]:
    """Translate `text` from source language to target language.

    Returns the translated text, or None on failure. Source/target are short
    language codes (fi, en, sv). Designed for short-to-medium event copy
    (titles, descriptions up to ~3000 chars).
    """
    text = (text or "").strip()
    if not text:
        return None
    if source == target:
        return text
    src = LANG_NAME.get(source, source)
    tgt = LANG_NAME.get(target, target)
    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        logger.warning("translate: EMERGENT_LLM_KEY missing")
        return None
    system = (
        f"You are a professional translator for a Finnish viking-age living-history events "
        f"website. Translate the user's text from {src} to {tgt}. Preserve tone, line breaks, "
        f"capitalisation of proper nouns and event names. Do NOT add commentary, quotes, or "
        f"markdown — output the translated text only."
    )
    try:
        chat = LlmChat(
            api_key=api_key,
            session_id=f"translate-{uuid.uuid4()}",
            system_message=system,
        ).with_model(PROVIDER, MODEL)
        msg = UserMessage(text=text)
        out = await chat.send_message(msg)
        return (out or "").strip()
    except Exception as e:  # noqa: BLE001
        logger.exception("translate(%s->%s) failed: %s", source, target, e)
        return None


def _pick_source(values: dict[str, str]) -> Optional[str]:
    """Return language code with the longest non-empty value, prefer fi > en > sv > others."""
    pref_order = ("fi", "en", "sv", "da", "de", "et", "pl")
    candidates = [(lang, (values.get(lang) or "").strip()) for lang in pref_order]
    candidates = [(lang, v) for lang, v in candidates if v]
    if not candidates:
        return None
    candidates.sort(key=lambda x: -len(x[1]))
    return candidates[0][0]


async def fill_missing_translations(db, event_id: str) -> dict:
    """For the given event, fill any empty `title_*` / `description_*` field by
    translating from whichever language is populated. Persists only fields
    that were empty AND successfully translated.
    """
    ev = await db.events.find_one({"id": event_id}, {"_id": 0})
    if not ev:
        return {"ok": False, "reason": "not_found"}

    updates: dict = {}
    for base in ("title", "description"):
        values = {lang: ev.get(f"{base}_{lang}", "") for lang in SUPPORTED_LANGS}
        src = _pick_source(values)
        if not src:
            continue
        for tgt in SUPPORTED_LANGS:
            if tgt == src:
                continue
            if (values.get(tgt) or "").strip():
                continue  # already has content, don't overwrite
            translated = await translate(values[src], src, tgt)
            if translated:
                updates[f"{base}_{tgt}"] = translated

    if updates:
        await db.events.update_one({"id": event_id}, {"$set": updates})
        logger.info("auto-translated event %s fields=%s", event_id, list(updates.keys()))
    return {"ok": True, "updated": list(updates.keys())}


async def find_events_with_missing_translations(db) -> list[dict]:
    """Return events that have at least one empty title_* or description_*
    field across SUPPORTED_LANGS. Cheap projection — only checks the
    presence/length of each language column."""
    proj = {"_id": 0, "id": 1, "status": 1}
    for base in ("title", "description"):
        for lang in SUPPORTED_LANGS:
            proj[f"{base}_{lang}"] = 1
    cursor = db.events.find({"status": {"$in": ["approved", "pending"]}}, proj)
    out: list[dict] = []
    async for ev in cursor:
        missing = []
        for base in ("title", "description"):
            for lang in SUPPORTED_LANGS:
                if not (ev.get(f"{base}_{lang}") or "").strip():
                    missing.append(f"{base}_{lang}")
        if missing:
            out.append({"id": ev["id"], "missing": missing})
    return out


async def sweep_missing_translations(db, max_events: int = 50) -> dict:
    """Scheduled job: find every event with at least one missing translation
    field and trigger `fill_missing_translations` on it. Caps the number of
    events processed per run so the LLM cost stays bounded.

    Returns a summary of how many events were checked / translated /
    skipped + any errors.
    """
    candidates = await find_events_with_missing_translations(db)
    summary = {
        "candidates": len(candidates),
        "processed": 0,
        "fields_filled": 0,
        "errors": 0,
    }
    if not candidates:
        logger.info("translation sweep: no events with missing fields")
        return summary

    for cand in candidates[:max_events]:
        try:
            result = await fill_missing_translations(db, cand["id"])
            updated = result.get("updated") or []
            summary["processed"] += 1
            summary["fields_filled"] += len(updated)
            if updated:
                logger.info(
                    "translation sweep: event=%s filled=%d fields=%s",
                    cand["id"],
                    len(updated),
                    updated,
                )
        except Exception as e:  # pragma: no cover — best-effort
            summary["errors"] += 1
            logger.error("translation sweep: event=%s failed: %s", cand["id"], e)

    if len(candidates) > max_events:
        summary["throttled"] = len(candidates) - max_events
        logger.info(
            "translation sweep: %d events left for next run", summary["throttled"]
        )
    return summary


# ---------------------------------------------------------------------------
# Articles — same shape as events, but operates on (title, excerpt, body)
# across the 7 supported languages. Translations are best-effort: failures
# leave the field empty (frontend falls back to the source lang via
# `pickLocalized`).
# ---------------------------------------------------------------------------
ARTICLE_FIELDS = ("title", "excerpt", "body")


async def fill_missing_article_translations(db, slug: str) -> dict:
    """For the given article (by slug), translate any empty `title_*` /
    `excerpt_*` / `body_*` field from whichever language is most populated.
    Persists only newly-translated fields — never overwrites existing
    content. Best-effort; partial success is recorded if the LLM is flaky.
    """
    art = await db.articles.find_one({"slug": slug}, {"_id": 0})
    if not art:
        return {"ok": False, "reason": "not_found"}

    updates: dict = {}
    for base in ARTICLE_FIELDS:
        values = {lang: art.get(f"{base}_{lang}", "") for lang in SUPPORTED_LANGS}
        src = _pick_source(values)
        if not src:
            continue
        for tgt in SUPPORTED_LANGS:
            if tgt == src:
                continue
            if (values.get(tgt) or "").strip():
                continue
            translated = await translate(values[src], src, tgt)
            if translated:
                updates[f"{base}_{tgt}"] = translated

    if updates:
        updates["updated_at"] = (
            __import__("datetime").datetime.now(
                __import__("datetime").timezone.utc
            ).isoformat()
        )
        await db.articles.update_one({"slug": slug}, {"$set": updates})
        logger.info(
            "auto-translated article %s fields=%s", slug, list(updates.keys())
        )
    return {"ok": True, "updated": list(updates.keys())}


async def sweep_missing_article_translations(db, max_articles: int = 20) -> dict:
    """Find every article with at least one empty translation field across
    title/excerpt/body × 7 langs. Triggers `fill_missing_article_translations`
    on each. Capped per run to bound LLM cost."""
    proj = {"_id": 0, "slug": 1}
    for base in ARTICLE_FIELDS:
        for lang in SUPPORTED_LANGS:
            proj[f"{base}_{lang}"] = 1

    cursor = db.articles.find({}, proj)
    candidates: list[str] = []
    async for art in cursor:
        missing = False
        for base in ARTICLE_FIELDS:
            populated = {
                lang: (art.get(f"{base}_{lang}") or "").strip()
                for lang in SUPPORTED_LANGS
            }
            if not any(populated.values()):
                continue  # source language also empty — nothing to translate
            for lang in SUPPORTED_LANGS:
                if not populated[lang]:
                    missing = True
                    break
            if missing:
                break
        if missing:
            candidates.append(art["slug"])

    summary = {
        "candidates": len(candidates),
        "processed": 0,
        "fields_filled": 0,
        "errors": 0,
    }
    if not candidates:
        logger.info("article translation sweep: nothing to do")
        return summary

    for slug in candidates[:max_articles]:
        try:
            result = await fill_missing_article_translations(db, slug)
            updated = result.get("updated") or []
            summary["processed"] += 1
            summary["fields_filled"] += len(updated)
            if updated:
                logger.info(
                    "article translation sweep: slug=%s filled=%d",
                    slug,
                    len(updated),
                )
        except Exception as e:  # pragma: no cover — best-effort
            summary["errors"] += 1
            logger.error("article translation sweep: slug=%s failed: %s", slug, e)

    if len(candidates) > max_articles:
        summary["throttled"] = len(candidates) - max_articles
    return summary

