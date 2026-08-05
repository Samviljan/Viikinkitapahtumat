"""Articles module — public browsing, admin CRUD, seed-on-startup.

Extracted from server.py to shrink the monolith. Public API surface
(URLs, response shapes, status codes, behavior) is unchanged.

Usage from server.py:

    from routes.articles import create_articles_router, init_articles
    api_router.include_router(create_articles_router(db, get_admin_user))
    # …then, inside the app.on_event("startup") handler:
    await init_articles(db)
"""
from __future__ import annotations

import asyncio
import base64
import logging
import os
import re
import uuid
from datetime import datetime, timezone
from html import escape as html_escape
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Request,
    Response,
    UploadFile,
)
from motor.motor_asyncio import AsyncIOMotorGridFSBucket
from pydantic import BaseModel, ConfigDict, EmailStr, field_validator

from translation_service import (
    fill_missing_article_translations,
    sweep_missing_article_translations,
)

logger = logging.getLogger(__name__)


# -----------------------------------------------------------------------------
# Local copy of MIME map — kept in-module so this file has no back-reference to
# server.py. Matches the one in server.py for parity of behavior.
# -----------------------------------------------------------------------------
_MIME_FOR_EXT = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
}


# =============================================================================
# Models
# =============================================================================
class ArticleOut(BaseModel):
    id: str
    slug: str
    title_fi: str
    title_en: Optional[str] = ""
    title_sv: Optional[str] = ""
    title_da: Optional[str] = ""
    title_de: Optional[str] = ""
    title_et: Optional[str] = ""
    title_pl: Optional[str] = ""
    excerpt_fi: Optional[str] = ""
    excerpt_en: Optional[str] = ""
    excerpt_sv: Optional[str] = ""
    excerpt_da: Optional[str] = ""
    excerpt_de: Optional[str] = ""
    excerpt_et: Optional[str] = ""
    excerpt_pl: Optional[str] = ""
    body_fi: str
    body_en: Optional[str] = ""
    body_sv: Optional[str] = ""
    body_da: Optional[str] = ""
    body_de: Optional[str] = ""
    body_et: Optional[str] = ""
    body_pl: Optional[str] = ""
    cover_image_url: Optional[str] = ""
    gallery: List[str] = []
    published_at: str
    created_at: str
    updated_at: Optional[str] = None
    feedback_form_type: Optional[str] = None  # e.g. "beta_app" → render form on detail page


class ArticleAdminCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    slug: Optional[str] = ""  # auto-generated from title_fi when omitted
    title_fi: str
    title_en: Optional[str] = ""
    title_sv: Optional[str] = ""
    title_da: Optional[str] = ""
    title_de: Optional[str] = ""
    title_et: Optional[str] = ""
    title_pl: Optional[str] = ""
    excerpt_fi: Optional[str] = ""
    excerpt_en: Optional[str] = ""
    excerpt_sv: Optional[str] = ""
    excerpt_da: Optional[str] = ""
    excerpt_de: Optional[str] = ""
    excerpt_et: Optional[str] = ""
    excerpt_pl: Optional[str] = ""
    body_fi: str
    body_en: Optional[str] = ""
    body_sv: Optional[str] = ""
    body_da: Optional[str] = ""
    body_de: Optional[str] = ""
    body_et: Optional[str] = ""
    body_pl: Optional[str] = ""
    cover_image_url: Optional[str] = ""
    gallery: Optional[List[str]] = None
    feedback_form_type: Optional[str] = None
    auto_translate: bool = True  # fire-and-forget background translation


class ArticleAdminUpdate(BaseModel):
    """All fields optional — only sent values are updated."""
    model_config = ConfigDict(extra="ignore")
    title_fi: Optional[str] = None
    title_en: Optional[str] = None
    title_sv: Optional[str] = None
    title_da: Optional[str] = None
    title_de: Optional[str] = None
    title_et: Optional[str] = None
    title_pl: Optional[str] = None
    excerpt_fi: Optional[str] = None
    excerpt_en: Optional[str] = None
    excerpt_sv: Optional[str] = None
    excerpt_da: Optional[str] = None
    excerpt_de: Optional[str] = None
    excerpt_et: Optional[str] = None
    excerpt_pl: Optional[str] = None
    body_fi: Optional[str] = None
    body_en: Optional[str] = None
    body_sv: Optional[str] = None
    body_da: Optional[str] = None
    body_de: Optional[str] = None
    body_et: Optional[str] = None
    body_pl: Optional[str] = None
    cover_image_url: Optional[str] = None
    gallery: Optional[List[str]] = None
    feedback_form_type: Optional[str] = None  # use empty string to clear
    auto_translate: bool = False  # re-translate empty fields after update


class BetaFeedbackIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    name: Optional[str] = ""
    email: Optional[EmailStr] = None
    device: Optional[str] = ""
    message: str

    @field_validator("message")
    @classmethod
    def _msg_nonempty(cls, v: str) -> str:
        v = (v or "").strip()
        if not v:
            raise ValueError("message is required")
        if len(v) > 5000:
            raise ValueError("message too long (max 5000 chars)")
        return v


# =============================================================================
# Small utilities
# =============================================================================
def _slugify(text: str) -> str:
    """Lowercase, ASCII-fold, hyphenate — safe enough for FI/SV/EN titles."""
    text = (text or "").strip().lower()
    if not text:
        return ""
    # Common Finnish/Swedish letter folding
    table = str.maketrans({
        "ä": "a", "ö": "o", "å": "a", "é": "e", "è": "e", "ê": "e",
        "ü": "u", "ß": "ss", "ñ": "n", "ç": "c", "ø": "o", "æ": "ae",
    })
    text = text.translate(table)
    text = re.sub(r"[^a-z0-9\s-]+", "", text)
    text = re.sub(r"[\s_-]+", "-", text).strip("-")
    return text[:80] or "artikkeli"


def _public_article_image_url(filename: str) -> str:
    return f"/api/uploads/article-images/{filename}"


# GridFS bucket per Mongo database handle. Kept separate from event/profile
# buckets so we can apply different size/lifecycle rules later.
_ARTICLE_BUCKET_CACHE: Dict[int, AsyncIOMotorGridFSBucket] = {}


def _article_images_bucket(db) -> AsyncIOMotorGridFSBucket:
    key = id(db)
    bucket = _ARTICLE_BUCKET_CACHE.get(key)
    if bucket is None:
        bucket = AsyncIOMotorGridFSBucket(db, bucket_name="article_images")
        _ARTICLE_BUCKET_CACHE[key] = bucket
    return bucket


async def _translate_single_article(db, slug: str) -> None:
    """Background helper used by admin create/update — same behavior as
    `fill_missing_article_translations` but swallows errors so a failing
    LLM call never bubbles back to the admin."""
    try:
        await fill_missing_article_translations(db, slug)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Background article translate failed for %s: %s", slug, exc)


# =============================================================================
# Router factory
# =============================================================================
def create_articles_router(db, get_admin_user) -> APIRouter:
    """Build the /api/... router for articles.

    Uses closures so `db` and `get_admin_user` are captured cleanly and
    FastAPI's dependency injection can resolve the real `get_admin_user`
    (which itself Depends on `get_current_user`).
    """
    router = APIRouter()

    # ----- Static image serving ---------------------------------------------
    @router.get("/uploads/article-images/{filename}")
    async def serve_article_image(filename: str):
        """Public, immutable. Filenames are UUID-prefixed so safe to cache forever."""
        doc = await db["article_images.files"].find_one(
            {"filename": filename}, {"_id": 1, "metadata": 1}
        )
        if not doc:
            raise HTTPException(status_code=404, detail="Image not found")
        ctype = (doc.get("metadata") or {}).get("content_type") or _MIME_FOR_EXT.get(
            Path(filename).suffix.lower(), "application/octet-stream"
        )
        stream = await _article_images_bucket(db).open_download_stream_by_name(filename)
        data = await stream.read()
        return Response(
            content=data,
            media_type=ctype,
            headers={"Cache-Control": "public, max-age=31536000, immutable"},
        )

    # ----- Public list + detail --------------------------------------------
    @router.get("/articles", response_model=List[ArticleOut])
    async def list_articles():
        """Public list — newest first by published_at, then created_at."""
        docs = (
            await db.articles
            .find({}, {"_id": 0})
            .sort([("published_at", -1), ("created_at", -1)])
            .to_list(200)
        )
        return [ArticleOut(**d) for d in docs]

    @router.get("/articles/{slug}", response_model=ArticleOut)
    async def get_article(slug: str):
        doc = await db.articles.find_one({"slug": slug}, {"_id": 0})
        if not doc:
            raise HTTPException(status_code=404, detail="Article not found")
        return ArticleOut(**doc)

    # ----- Admin CRUD -------------------------------------------------------
    @router.post(
        "/admin/articles",
        response_model=ArticleOut,
        dependencies=[Depends(get_admin_user)],
    )
    async def admin_create_article(payload: ArticleAdminCreate):
        """Admin: create a new article. Slug is auto-derived from title_fi
        unless explicitly provided. Auto-translation runs as background task
        so the response is fast — translations populate over the next ~30s."""
        title_fi = (payload.title_fi or "").strip()
        body_fi = (payload.body_fi or "").strip()
        if not title_fi or not body_fi:
            raise HTTPException(
                status_code=422, detail="title_fi and body_fi are required"
            )
        slug = (payload.slug or "").strip() or _slugify(title_fi)
        if not slug:
            raise HTTPException(status_code=422, detail="Could not derive slug")
        if await db.articles.find_one({"slug": slug}, {"_id": 1}):
            raise HTTPException(
                status_code=409, detail=f"Article with slug '{slug}' already exists"
            )

        now = datetime.now(timezone.utc).isoformat()
        doc = payload.model_dump()
        doc.pop("auto_translate", None)
        doc["slug"] = slug
        doc["id"] = str(uuid.uuid4())
        doc["gallery"] = list(payload.gallery or [])
        doc["published_at"] = now
        doc["created_at"] = now
        doc["updated_at"] = now
        # Normalize feedback_form_type — empty string → None
        if not (doc.get("feedback_form_type") or "").strip():
            doc["feedback_form_type"] = None

        await db.articles.insert_one(doc.copy())

        if payload.auto_translate:
            asyncio.create_task(_translate_single_article(db, slug))

        return ArticleOut(**{k: v for k, v in doc.items() if k != "_id"})

    @router.patch(
        "/admin/articles/{slug}",
        response_model=ArticleOut,
        dependencies=[Depends(get_admin_user)],
    )
    async def admin_update_article(slug: str, payload: ArticleAdminUpdate):
        existing = await db.articles.find_one({"slug": slug}, {"_id": 0})
        if not existing:
            raise HTTPException(status_code=404, detail="Article not found")

        updates: Dict[str, Any] = {}
        raw = payload.model_dump(exclude_unset=True)
        auto_translate = raw.pop("auto_translate", False)
        for k, v in raw.items():
            if k == "feedback_form_type":
                # Empty string = explicit clear; None = "don't change"
                updates[k] = (v.strip() if isinstance(v, str) and v.strip() else None)
            else:
                updates[k] = v
        if not updates:
            return ArticleOut(**existing)

        updates["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.articles.update_one({"slug": slug}, {"$set": updates})

        if auto_translate:
            asyncio.create_task(_translate_single_article(db, slug))

        new_doc = await db.articles.find_one({"slug": slug}, {"_id": 0})
        return ArticleOut(**new_doc)

    @router.delete(
        "/admin/articles/{slug}",
        dependencies=[Depends(get_admin_user)],
    )
    async def admin_delete_article(slug: str):
        existing = await db.articles.find_one(
            {"slug": slug}, {"_id": 0, "cover_image_url": 1, "gallery": 1}
        )
        if not existing:
            raise HTTPException(status_code=404, detail="Article not found")

        # Best-effort: remove associated GridFS images (admin-uploaded only —
        # `article_images` filenames are unique so this can't collide with
        # other articles' files).
        image_urls = []
        if existing.get("cover_image_url"):
            image_urls.append(existing["cover_image_url"])
        for url in existing.get("gallery") or []:
            if url:
                image_urls.append(url)
        for url in image_urls:
            if not url or not url.startswith("/api/uploads/article-images/"):
                continue
            filename = url.rsplit("/", 1)[-1]
            try:
                file_doc = await db["article_images.files"].find_one(
                    {"filename": filename}, {"_id": 1}
                )
                if file_doc:
                    await _article_images_bucket(db).delete(file_doc["_id"])
            except Exception:  # noqa: BLE001
                logger.exception("Failed to delete article image %s", filename)

        await db.articles.delete_one({"slug": slug})
        return {"ok": True}

    @router.post(
        "/admin/articles/{slug}/images",
        dependencies=[Depends(get_admin_user)],
    )
    async def admin_upload_article_image(
        slug: str,
        file: UploadFile = File(...),
        kind: str = Form("cover"),  # "cover" | "gallery"
    ):
        """Upload an article image. `kind=cover` sets `cover_image_url`,
        `kind=gallery` appends to `gallery[]`. Old cover image is left in
        GridFS (cheap; we may want it back). Frontend can call DELETE if it
        wants to actually free storage."""
        article = await db.articles.find_one({"slug": slug}, {"_id": 0, "gallery": 1})
        if not article:
            raise HTTPException(status_code=404, detail="Article not found")
        if kind not in ("cover", "gallery"):
            raise HTTPException(status_code=422, detail="kind must be 'cover' or 'gallery'")

        contents = await file.read()
        if not contents:
            raise HTTPException(status_code=422, detail="Empty file")
        if len(contents) > 8 * 1024 * 1024:  # 8 MB cap per image
            raise HTTPException(status_code=413, detail="File too large (max 8 MB)")

        ctype = (file.content_type or "").lower()
        if not ctype.startswith("image/"):
            raise HTTPException(status_code=415, detail="Only image uploads allowed")
        ext_map = {
            "image/jpeg": ".jpg", "image/jpg": ".jpg",
            "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif",
        }
        ext = ext_map.get(ctype, Path(file.filename or "").suffix.lower() or ".png")
        filename = f"article_{slug[:24]}_{kind}_{uuid.uuid4().hex[:10]}{ext}"
        await _article_images_bucket(db).upload_from_stream(
            filename,
            contents,
            metadata={
                "content_type": ctype,
                "article_slug": slug,
                "kind": "article_image",
            },
        )
        public_url = _public_article_image_url(filename)

        now = datetime.now(timezone.utc).isoformat()
        if kind == "cover":
            await db.articles.update_one(
                {"slug": slug},
                {"$set": {"cover_image_url": public_url, "updated_at": now}},
            )
        else:
            await db.articles.update_one(
                {"slug": slug},
                {"$push": {"gallery": public_url}, "$set": {"updated_at": now}},
            )
        return {"url": public_url, "kind": kind}

    @router.delete(
        "/admin/articles/{slug}/images",
        dependencies=[Depends(get_admin_user)],
    )
    async def admin_delete_article_image(slug: str, url: str):
        """Remove a single image URL from cover_image_url or gallery[]. Also
        deletes the underlying GridFS blob if it lives in our article bucket."""
        article = await db.articles.find_one(
            {"slug": slug}, {"_id": 0, "cover_image_url": 1, "gallery": 1}
        )
        if not article:
            raise HTTPException(status_code=404, detail="Article not found")

        now = datetime.now(timezone.utc).isoformat()
        if article.get("cover_image_url") == url:
            await db.articles.update_one(
                {"slug": slug},
                {"$set": {"cover_image_url": "", "updated_at": now}},
            )
        if url in (article.get("gallery") or []):
            await db.articles.update_one(
                {"slug": slug},
                {"$pull": {"gallery": url}, "$set": {"updated_at": now}},
            )

        if url.startswith("/api/uploads/article-images/"):
            filename = url.rsplit("/", 1)[-1]
            try:
                file_doc = await db["article_images.files"].find_one(
                    {"filename": filename}, {"_id": 1}
                )
                if file_doc:
                    await _article_images_bucket(db).delete(file_doc["_id"])
            except Exception:  # noqa: BLE001
                logger.exception("Failed to delete article image blob %s", filename)
        return {"ok": True}

    @router.post(
        "/admin/articles/{slug}/translate",
        dependencies=[Depends(get_admin_user)],
    )
    async def admin_translate_article(slug: str):
        """Manual trigger — translates any empty (title/excerpt/body) × lang
        fields. Fast for admins who want to see translations appear right
        after creating an article (synchronous, returns when done)."""
        existing = await db.articles.find_one({"slug": slug}, {"_id": 1})
        if not existing:
            raise HTTPException(status_code=404, detail="Article not found")
        result = await fill_missing_article_translations(db, slug)
        return result

    # ----- Public beta-tester feedback form --------------------------------
    @router.post("/feedback/beta-app")
    async def submit_beta_feedback(payload: BetaFeedbackIn, request: Request):
        """Public — anyone reading the beta-tester article can submit feedback.
        Stored in `beta_app_feedback` for the admin to read; an email is also
        forwarded to the admin so they don't need to check the DB to see new
        submissions. Lightweight rate limit: 1 submission per minute per IP."""
        # Rate-limit by client IP via a tiny in-memory deque-of-timestamps. The
        # form is not gating anything critical, so this is enough to deter spam.
        ip = (
            request.headers.get("x-forwarded-for", "").split(",")[0].strip()
            or (request.client.host if request.client else "unknown")
        )
        if not hasattr(submit_beta_feedback, "_last_ip"):
            submit_beta_feedback._last_ip = {}
        now_ts = datetime.now(timezone.utc).timestamp()
        last = submit_beta_feedback._last_ip.get(ip, 0)
        if now_ts - last < 60:
            raise HTTPException(
                status_code=429, detail="Please wait before sending another message"
            )
        submit_beta_feedback._last_ip[ip] = now_ts

        doc = {
            "id": str(uuid.uuid4()),
            "name": (payload.name or "").strip()[:120],
            "email": (str(payload.email) if payload.email else ""),
            "device": (payload.device or "").strip()[:120],
            "message": payload.message,
            "ip": ip,
            "user_agent": (request.headers.get("user-agent") or "")[:300],
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.beta_app_feedback.insert_one(doc.copy())

        # Email forward — best-effort, do not fail the request if SMTP is down.
        admin_email = os.environ.get(
            "ADMIN_EMAIL", "admin@viikinkitapahtumat.fi"
        ).lower()
        try:
            from email_service import send_email as svc_send_email
            site = "https://viikinkitapahtumat.fi"
            subject = "Uutta beta-palautetta mobiilisovelluksesta"
            contact_line = (
                f"<div style='color:#8E8276;font-size:12px;margin-top:18px;'>"
                f"Yhteystiedot: {html_escape(doc['email'] or 'ei annettu')}"
                f"{' · ' + html_escape(doc['name']) if doc['name'] else ''}"
                f"{' · ' + html_escape(doc['device']) if doc['device'] else ''}"
                f"</div>"
            )
            html = (
                f"<div style='font-family:Georgia,serif;background:#141111;color:#E8E2D5;padding:24px;'>"
                f"<div style='max-width:580px;margin:0 auto;background:#1A1614;border:1px solid #352A23;padding:28px;'>"
                f"<div style='font-size:11px;letter-spacing:1.6px;color:#C19C4D;text-transform:uppercase;'>Beta-palaute</div>"
                f"<h1 style='font-family:Georgia,serif;color:#E8E2D5;margin:8px 0 16px;font-size:20px;'>"
                f"viikinkitapahtumat.fi mobiilisovellus</h1>"
                f"<div style='white-space:pre-wrap;line-height:1.55;color:#E8E2D5;'>"
                f"{html_escape(doc['message'])}</div>"
                f"{contact_line}"
                f"<div style='font-size:11px;color:#8E8276;margin-top:18px;'>"
                f"Lähetetty osoitteen <a href='{site}' style='color:#C19C4D;'>"
                f"viikinkitapahtumat.fi</a> beta-testaajan artikkelin kautta."
                f"</div></div></div>"
            )
            try:
                await svc_send_email(
                    admin_email, subject, html,
                    reply_to=(doc["email"] or None),
                )
            except TypeError:
                await svc_send_email(admin_email, subject, html)
        except Exception:  # noqa: BLE001
            logger.exception("Beta feedback admin email failed (DB row still saved)")

        return {"ok": True}

    return router


# =============================================================================
# Seed data — constants + seed coroutines
# =============================================================================
_REENACTMENT_INTRO_SLUG = "mita-historianelavoitystapahtumassa-tapahtuu"
_BETA_TESTER_SLUG = "liity-mobiilisovelluksen-beta-testaajaksi"

_REENACTMENT_INTRO_FI = (
    "Historianelävöitystapahtuma vie kävijän hetkeksi menneisyyteen. Tapahtumissa "
    "historiaa ei vain katsella vitriinin takaa, vaan sitä koetaan, kuullaan, "
    "kokeillaan ja eletään. Suomessa historianelävöitystapahtumat voivat sijoittua "
    "esimerkiksi rautakaudelle, viikinkiajalle, keskiajalle tai myöhempiin "
    "historiallisiin aikakausiin.\n\n"
    "Tapahtumissa voi nähdä historiallisiin vaatteisiin pukeutuneita elävöittäjiä, "
    "käsityöläisiä, kauppiaita, taistelunäytöksiä, leirejä ja työnäytöksiä. Usein "
    "paikalla esitellään myös aikakauden ruokaa, aseita, varusteita, koruja, "
    "tekstiilejä ja arkielämää. Kävijä voi päästä seuraamaan, miten kangasta "
    "värjättiin, miten sepän työ eteni, millaisia varusteita soturilla oli tai "
    "miten ihmiset elivät ennen nykyaikaa.\n\n"
    "Monet tapahtumat sopivat hyvin myös lapsiperheille. Lapsille voi olla tarjolla "
    "kokeilupisteitä, satuja, pelejä, työnäytöksiä tai mahdollisuus tutustua "
    "aikakauden esineisiin turvallisesti. Aikuisille tapahtumat tarjoavat "
    "kiinnostavaa tietoa historiasta, käsityöperinteistä ja elävöitysharrastuksesta.\n\n"
    "Historianelävöitystapahtumissa tärkeää on tunnelma. Leirinuotion savu, "
    "käsityöläisten työkalujen äänet, markkinakojujen vilinä ja elävöittäjien tarinat "
    "tekevät menneisyydestä konkreettista. Jokainen tapahtuma on hieman erilainen: "
    "osa painottuu markkinoihin, osa taistelunäytöksiin, osa käsityöhön, "
    "museoympäristöön tai koko perheen elämyksiin.\n\n"
    "Tapahtumiin voi yleensä tulla tavallisena kävijänä ilman aiempaa kokemusta. "
    "Riittää, että saavut paikalle uteliaana. Jos kiinnostus syttyy, monissa "
    "tapahtumissa voi jutella elävöittäjien kanssa ja kysyä, miten harrastukseen "
    "pääsee mukaan.\n\n"
    "Historianelävöitystapahtuma on parhaimmillaan elävä ikkuna menneisyyteen. "
    "Se antaa mahdollisuuden nähdä, miltä historia saattoi tuntua, kuulostaa ja "
    "näyttää — ja löytää samalla uusia tapahtumia, ihmisiä ja tarinoita."
)

_ARTICLE_IMAGE_PROMPTS = [
    (
        "Atmospheric medieval reenactment marketplace scene: wooden stalls, "
        "linen banners, blacksmith demonstration with glowing forge, costumed "
        "reenactors in iron-age and viking-era clothing, smoke from campfires, "
        "warm golden hour light, photographic realism, cinematic depth of field, "
        "1600x900 aspect"
    ),
    (
        "Wide angle photo of a historical reenactment camp at dusk: viking-era "
        "tents, men and women in handwoven tunics, women dyeing fabric over an "
        "open fire, children watching a craftsman work leather, warm campfire "
        "light, misty pine forest in the background, photojournalistic style, "
        "1600x900 aspect"
    ),
]


async def _seed_intro_article(db) -> None:
    """Insert the introductory article + generate 2 hero images via Gemini
    Nano Banana on first boot. Idempotent — never re-runs if the article
    already exists. Failures (no LLM key, network) leave the article without
    images, which the frontend handles gracefully (falls back to gradient)."""
    existing = await db.articles.find_one({"slug": _REENACTMENT_INTRO_SLUG}, {"id": 1})
    if existing:
        return

    api_key = os.environ.get("EMERGENT_LLM_KEY")
    image_urls: List[str] = []
    if api_key:
        try:
            from emergentintegrations.llm.chat import LlmChat, UserMessage  # noqa: WPS433
            for idx, prompt in enumerate(_ARTICLE_IMAGE_PROMPTS):
                chat = LlmChat(
                    api_key=api_key,
                    session_id=f"article-img-{_REENACTMENT_INTRO_SLUG}-{idx}",
                    system_message=(
                        "Generate atmospheric, photographic images of Finnish "
                        "historical reenactment events. Avoid text overlays."
                    ),
                )
                chat.with_model(
                    "gemini", "gemini-3.1-flash-image-preview"
                ).with_params(modalities=["image", "text"])
                try:
                    _, images = await chat.send_message_multimodal_response(
                        UserMessage(text=prompt)
                    )
                except Exception as exc:  # noqa: BLE001
                    logger.warning("Article image gen %d failed: %s", idx, exc)
                    continue
                if not images:
                    continue
                img = images[0]
                mime = img.get("mime_type") or "image/png"
                ext = ".png" if "png" in mime else (".jpg" if "jpeg" in mime else ".png")
                try:
                    image_bytes = base64.b64decode(img["data"])
                except Exception:  # noqa: BLE001
                    continue
                filename = (
                    f"article_{_REENACTMENT_INTRO_SLUG[:24]}_"
                    f"{idx}_{uuid.uuid4().hex[:8]}{ext}"
                )
                await _article_images_bucket(db).upload_from_stream(
                    filename,
                    image_bytes,
                    metadata={
                        "content_type": mime,
                        "article_slug": _REENACTMENT_INTRO_SLUG,
                        "kind": "article_image",
                    },
                )
                image_urls.append(_public_article_image_url(filename))
        except Exception as exc:  # noqa: BLE001
            logger.warning("Article seed image generation aborted: %s", exc)
    else:
        logger.warning(
            "EMERGENT_LLM_KEY missing — seeding article without generated images"
        )

    now = datetime.now(timezone.utc).isoformat()
    article = {
        "id": str(uuid.uuid4()),
        "slug": _REENACTMENT_INTRO_SLUG,
        "title_fi": "Mitä historianelävöitystapahtumassa tapahtuu?",
        "title_en": "What happens at a historical reenactment event?",
        "title_sv": "Vad händer på ett historiskt återskapande-evenemang?",
        "title_da": "Hvad sker der til et historisk reenactment-arrangement?",
        "title_de": "Was passiert auf einer historischen Reenactment-Veranstaltung?",
        "title_et": "Mis toimub ajaloolisel taaskehastuse üritusel?",
        "title_pl": "Co dzieje się na wydarzeniu rekonstrukcji historycznej?",
        "excerpt_fi": (
            "Historianelävöitystapahtuma vie kävijän hetkeksi menneisyyteen — "
            "markkinoita, käsityötä, taisteluja ja leirituli."
        ),
        "excerpt_en": "",
        "excerpt_sv": "",
        "excerpt_da": "",
        "excerpt_de": "",
        "excerpt_et": "",
        "excerpt_pl": "",
        "body_fi": _REENACTMENT_INTRO_FI,
        "body_en": "",
        "body_sv": "",
        "body_da": "",
        "body_de": "",
        "body_et": "",
        "body_pl": "",
        "cover_image_url": image_urls[0] if image_urls else "",
        "gallery": image_urls[1:] if len(image_urls) > 1 else [],
        "published_at": now,
        "created_at": now,
        "updated_at": now,
    }
    await db.articles.insert_one(article.copy())
    logger.info(
        "Seeded intro article (slug=%s, %d images)",
        _REENACTMENT_INTRO_SLUG,
        len(image_urls),
    )


_BETA_TESTER_BODY_FI = (
    "Löydä viikinki-, rautakausi-, keskiaika- ja historianelävöitystapahtumat helposti yhdestä paikasta.\n\n"
    "viikinkitapahtumat.fi-mobiilisovellus tuo sivuston tapahtumatiedot kätevästi puhelimeen. Sovelluksen avulla voit selata viikinki-, rautakausi-, keskiaika- ja historianelävöitystapahtumia, löytää kiinnostavia tapahtumia ja tarkistaa tapahtumien perustiedot helposti myös liikkeellä ollessa.\n\n"
    "Sovellus on tarkoitettu kaikille, joita kiinnostavat historia, elävöitys, viikinkiaika, rautakausi, keskiaika, markkinat, käsityöt, museotapahtumat ja historialliset elämykset. Se sopii sekä tapahtumissa käyville, harrastajille, elävöittäjille että järjestäjille, jotka haluavat seurata, mitä Suomessa tapahtuu.\n\n"
    "## Miksi beta-testaajia tarvitaan?\n\n"
    "Sovellus on parhaillaan testivaiheessa. Ennen laajempaa julkaisua haluan varmistaa, että sovellus toimii hyvin erilaisilla Android-puhelimilla ja että tapahtumien selaaminen on mahdollisimman helppoa.\n\n"
    "Beta-testaajien palaute auttaa kehittämään sovellusta paremmaksi. Testaajien avulla voidaan huomata esimerkiksi käyttöliittymän epäselvyydet, puuttuvat tiedot, toimivuusongelmat tai ideat, jotka tekevät sovelluksesta hyödyllisemmän.\n\n"
    "## Miten beta-testaajaksi pääsee?\n\n"
    "Beta-testaajaksi pääset lähettämällä vapaamuotoisen sähköpostin osoitteeseen admin@viikinkitapahtumat.fi.\n\n"
    "Kirjoita viestiin, että haluat mukaan viikinkitapahtumat.fi-mobiilisovelluksen beta-testaukseen. Lisää viestiin myös se Gmail-osoite, jolla käytät Google Playta, sillä Google Playn testiryhmään voidaan lisätä vain Google-tiliin liitetty sähköpostiosoite.\n\n"
    "Kun sinut on lisätty testiryhmään, saat ohjeet sovelluksen asentamiseen Google Playn kautta. Testaus onnistuu Android-laitteella.\n\n"
    "## Mitä testaajalta pyydetään?\n\n"
    "Testaaminen ei vaadi teknistä osaamista. Riittää, että käytät sovellusta tavallisen käyttäjän näkökulmasta ja kerrot, miltä se tuntuu.\n\n"
    "Toivon, että beta-testaaja:\n\n"
    "- asentaa sovelluksen Android-puhelimeen\n"
    "- avaa tapahtumalistan\n"
    "- etsii yhden tai useamman kiinnostavan tapahtuman\n"
    "- tarkistaa, löytyvätkö tapahtuman nimi, aika, paikka ja kuvaus helposti\n"
    "- kertoo, jos jokin kohta tuntuu epäselvältä\n"
    "- ilmoittaa, jos sovellus ei toimi odotetusti\n"
    "- lähettää lyhyen palautteen palautelomakkeella\n\n"
    "Erityisen arvokasta palautetta on se, löysitkö sovelluksesta tapahtuman, johon voisit oikeasti mennä, ja oliko tapahtuman tiedot helppo ymmärtää.\n\n"
    "## Kuinka kauan testaus kestää?\n\n"
    "Yksittäinen testikerta vie noin 5–10 minuuttia. Voit kuitenkin käyttää sovellusta pidempään ja palata siihen myöhemmin, kun uusia tapahtumia lisätään.\n\n"
    "Beta-testijakson aikana toivon, että testaajat pitävät sovelluksen asennettuna vähintään kahden viikon ajan. Näin voidaan paremmin seurata, miten sovellus toimii käytössä ja miten tapahtumatiedot palvelevat käyttäjiä ajan mittaan.\n\n"
    "## Anna palautetta\n\n"
    "Kun olet kokeillut sovellusta, lähetä palautteesi alla olevan palautelomakkeen kautta.\n\n"
    "Voit kertoa esimerkiksi:\n\n"
    "- mikä sovelluksessa toimi hyvin\n"
    "- mikä oli epäselvää\n"
    "- löysitkö kiinnostavan tapahtuman\n"
    "- puuttuuko sovelluksesta jokin tapahtuma\n"
    "- toimiko sovellus puhelimellasi ongelmitta\n"
    "- mitä ominaisuutta toivoisit seuraavaksi\n\n"
    "Myös lyhyt palaute auttaa. Yksi huomio voi riittää tekemään sovelluksesta paremman kaikille käyttäjille.\n\n"
    "## Kiitos avusta\n\n"
    "viikinkitapahtumat.fi ja sen mobiilisovellus rakentuvat harrastajien, tapahtumakävijöiden ja järjestäjien tarpeisiin. Beta-testaajana autat tekemään palvelusta hyödyllisemmän kaikille, jotka etsivät viikinki-, rautakausi-, keskiaika- ja historianelävöitystapahtumia.\n\n"
    "Tervetuloa mukaan testaamaan!"
)

_BETA_IMAGE_PROMPT = (
    "Atmospheric photograph of a person's hand holding a modern smartphone "
    "outdoors at a viking reenactment market. The phone screen shows a clean "
    "event calendar app interface (no readable text). In the soft-focus "
    "background: linen tents, costumed reenactors, glowing campfire, golden "
    "hour light. Photographic realism, cinematic depth of field, 1600x900 aspect"
)


async def _seed_beta_tester_article(db) -> None:
    """Insert the second seeded article (beta tester recruitment) + generate
    1 hero image. Idempotent."""
    existing = await db.articles.find_one({"slug": _BETA_TESTER_SLUG}, {"id": 1})
    if existing:
        return

    api_key = os.environ.get("EMERGENT_LLM_KEY")
    cover_url = ""
    if api_key:
        try:
            from emergentintegrations.llm.chat import LlmChat, UserMessage  # noqa: WPS433
            chat = LlmChat(
                api_key=api_key,
                session_id=f"article-img-{_BETA_TESTER_SLUG}-0",
                system_message=(
                    "Generate atmospheric, photographic images bridging modern "
                    "mobile technology with Nordic historical reenactment "
                    "events. Avoid text overlays."
                ),
            )
            chat.with_model(
                "gemini", "gemini-3.1-flash-image-preview"
            ).with_params(modalities=["image", "text"])
            try:
                _, images = await chat.send_message_multimodal_response(
                    UserMessage(text=_BETA_IMAGE_PROMPT)
                )
            except Exception as exc:  # noqa: BLE001
                logger.warning("Beta article image gen failed: %s", exc)
                images = []
            if images:
                img = images[0]
                mime = img.get("mime_type") or "image/png"
                ext = ".png" if "png" in mime else (".jpg" if "jpeg" in mime else ".png")
                try:
                    image_bytes = base64.b64decode(img["data"])
                    filename = (
                        f"article_{_BETA_TESTER_SLUG[:24]}_"
                        f"0_{uuid.uuid4().hex[:8]}{ext}"
                    )
                    await _article_images_bucket(db).upload_from_stream(
                        filename,
                        image_bytes,
                        metadata={
                            "content_type": mime,
                            "article_slug": _BETA_TESTER_SLUG,
                            "kind": "article_image",
                        },
                    )
                    cover_url = _public_article_image_url(filename)
                except Exception as exc:  # noqa: BLE001
                    logger.warning("Beta article image save failed: %s", exc)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Beta article seed image gen aborted: %s", exc)

    now = datetime.now(timezone.utc).isoformat()
    article = {
        "id": str(uuid.uuid4()),
        "slug": _BETA_TESTER_SLUG,
        "title_fi": "Liity mobiilisovelluksen beta-testaajaksi",
        "title_en": "Become a mobile app beta tester",
        "title_sv": "Bli beta-testare för mobilappen",
        "title_da": "Bliv beta-tester af mobilappen",
        "title_de": "Werde Beta-Tester der mobilen App",
        "title_et": "Hakka mobiilirakenduse beeta-testijaks",
        "title_pl": "Zostań beta-testerem aplikacji mobilnej",
        "excerpt_fi": (
            "Auta tekemään viikinkitapahtumat.fi-mobiilisovelluksesta parempi — "
            "ilmoittaudu Android-beta-testaajaksi ja anna palautetta."
        ),
        "excerpt_en": "",
        "excerpt_sv": "",
        "excerpt_da": "",
        "excerpt_de": "",
        "excerpt_et": "",
        "excerpt_pl": "",
        "body_fi": _BETA_TESTER_BODY_FI,
        "body_en": "",
        "body_sv": "",
        "body_da": "",
        "body_de": "",
        "body_et": "",
        "body_pl": "",
        "cover_image_url": cover_url,
        "gallery": [],
        "published_at": now,
        "created_at": now,
        "updated_at": now,
        "feedback_form_type": "beta_app",
    }
    await db.articles.insert_one(article.copy())
    logger.info(
        "Seeded beta tester article (slug=%s, cover=%s)",
        _BETA_TESTER_SLUG,
        bool(cover_url),
    )


# ---------- Article #3: PWA install guide ---------------------------------
_PWA_INSTALL_SLUG = "asenna-viikinkitapahtumat-puhelimeen"

# Real site screenshots (viikinkitapahtumat.fi rendered in mobile viewport,
# wrapped in a stylised phone frame with rounded corners & dark bezel).
# Show the actual product rather than a generic phone illustration.
_PWA_INSTALL_IMAGE_URLS = [
    "/article-images/pwa_site_home_f3b4ffed.jpg",     # home page (cover)
    "/article-images/pwa_site_events_f7a05f4b.jpg",   # events listing
    "/article-images/pwa_site_article_3a390e54.jpg",  # article detail
]

_PWA_INSTALL_BODY_FI = (
    "Voit nyt asentaa viikinkitapahtumat.fi-sivuston aloitusnäytöllesi kuten "
    "minkä tahansa sovelluksen — ilman Google Playta tai App Storea. Se "
    "tarkoittaa nopeampaa käynnistystä, oman kuvakkeen sekä tapahtumakalenterin "
    "selailua myös offline-tilassa.\n\n"
    "## Miksi asentaa?\n\n"
    "- Kalenteri toimii myös verkon katketessa — tallennetut tapahtumat pysyvät luettavina\n"
    "- Oma kuvake aloitusnäytöllä — ei tarvitse muistaa osoitetta\n"
    "- Nopeampi käynnistys ja täyskuvatila (ei selainpalkkia)\n"
    "- Vie noin 500 kt tilaa — murto-osan siitä mitä natiivit sovellukset\n\n"
    "## Android · Chrome-selain\n\n"
    "Asennus Android-puhelimeen käy näin:\n\n"
    "- Avaa Chrome-selain ja mene osoitteeseen viikinkitapahtumat.fi\n"
    "- Näet alalaidassa keltaisen \u201eAsenna sovellus\u201d -painikkeen — paina sitä\n"
    "- Chrome kysyy vahvistuksen → paina uudelleen \u201eAsenna\u201d. Sovellus ilmestyy aloitusnäytöllesi.\n\n"
    "Vinkki: jos painiketta ei näy, avaa Chromen valikko (kolme pistettä oikeassa yläkulmassa) ja valitse \u201eAsenna sovellus\u201d tai \u201eLisää aloitusnäyttöön\u201d.\n\n"
    "## iPhone · Safari-selain\n\n"
    "Asennus iPhoneen tapahtuu Safarin kautta (Chrome ei toimi iOS:llä tähän tarkoitukseen):\n\n"
    "- Avaa Safari ja mene osoitteeseen viikinkitapahtumat.fi\n"
    "- Paina alapalkin keskellä olevaa Jaa-painiketta (neliö, jossa nuoli osoittaa ylös)\n"
    "- Vieritä listaa alaspäin ja valitse \u201eLisää aloitusnäyttöön\u201d\n"
    "- Paina oikeassa yläkulmassa \u201eLisää\u201d. Kuvake ilmestyy aloitusnäytölle.\n\n"
    "Vinkki: iOS 16.4 tai uudempi tarvitaan täyden toimivuuden vuoksi (esim. push-ilmoitukset). Voit halutessasi myös vetää kuvakkeen lopulliseen kohtaan aloitusnäytöllä pitämällä sovellusta painettuna.\n\n"
    "## Näin sovellus näyttää asennuksen jälkeen\n\n"
    "Kultainen Fehu-riimu tunnistettavassa muodossa ilmestyy aloitusnäytöllesi — yksi klikkaus ja koko tapahtumakalenteri on käytössäsi. Ei enää selainpalkkia, ei osoiterivin naputtelua.\n\n"
    "## Kysymyksiä?\n\n"
    "Jos asennus ei syystä tai toisesta onnistu, lähetä sähköpostia osoitteeseen admin@viikinkitapahtumat.fi ja kerro mitä puhelinta ja selainta käytät. Autamme mielellämme."
)


async def _seed_pwa_install_article(db) -> None:
    """Insert the PWA install guide article. Reuses images generated for
    the corresponding email template, so this runs fast (no LLM calls).
    Idempotent — exits early if the slug already exists."""
    existing = await db.articles.find_one({"slug": _PWA_INSTALL_SLUG}, {"id": 1})
    if existing:
        return

    now = datetime.now(timezone.utc).isoformat()
    article = {
        "id": str(uuid.uuid4()),
        "slug": _PWA_INSTALL_SLUG,
        "title_fi": "Asenna Viikinkitapahtumat puhelimeesi ilman sovelluskauppaa",
        "title_en": "Install Viikinkitapahtumat on your phone without an app store",
        "title_sv": "Installera Viikinkitapahtumat på din telefon utan appbutik",
        "title_da": "Installer Viikinkitapahtumat på din telefon uden en app-butik",
        "title_de": "Viikinkitapahtumat ohne App-Store auf dem Handy installieren",
        "title_et": "Paigalda Viikinkitapahtumat oma telefoni ilma rakenduse poeta",
        "title_pl": "Zainstaluj Viikinkitapahtumat na telefonie bez sklepu z aplikacjami",
        "excerpt_fi": (
            "Näin lisäät viikinkitapahtumat.fi:n aloitusnäytöllesi kuvakkeeksi — "
            "toimii myös offline ja käynnistyy sekunnissa."
        ),
        "excerpt_en": "",
        "excerpt_sv": "",
        "excerpt_da": "",
        "excerpt_de": "",
        "excerpt_et": "",
        "excerpt_pl": "",
        "body_fi": _PWA_INSTALL_BODY_FI,
        "body_en": "",
        "body_sv": "",
        "body_da": "",
        "body_de": "",
        "body_et": "",
        "body_pl": "",
        "cover_image_url": _PWA_INSTALL_IMAGE_URLS[0],  # home page (cover)
        "gallery": [
            _PWA_INSTALL_IMAGE_URLS[1],  # events listing
            _PWA_INSTALL_IMAGE_URLS[2],  # article detail
        ],
        "published_at": now,
        "created_at": now,
        "updated_at": now,
        "feedback_form_type": None,
    }
    await db.articles.insert_one(article.copy())
    logger.info("Seeded PWA install article (slug=%s)", _PWA_INSTALL_SLUG)


# ---------- Article #4: privacy & PWA (does the app spy on me?) ----------
_PRIVACY_PWA_SLUG = "vakoileeko-sovellus-minua-tietosuoja-ja-pwa"

_PRIVACY_PWA_BODY_FI = (
    "Yhä useampi käyttäjä on tietoinen siitä, että puhelimen sovellukset voivat kerätä paljon henkilökohtaista tietoa. Kun asennat viikinkitapahtumat.fi-sivuston puhelimeesi PWA-sovelluksena, on täysin oikeutettua kysyä: mitä tämä sovellus näkee minusta, ja pystyykö se seuraamaan tekemisiäni?\n\n"
    "Vastaus on lyhyesti: **ei, sovellus ei vakoile sinua**. Alla kerromme miksi — ja miten voit halutessasi tarkistaa asian itse.\n\n"
    "## Mikä PWA on ja miksi se on turvallisempi kuin \u201eperinteinen\u201d sovellus?\n\n"
    "PWA (Progressive Web App) on **pohjimmiltaan tavallinen verkkosivu**, joka on paketoitu niin, että sen voi asentaa aloitusnäytölle kuten minkä tahansa sovelluksen. Se ei kuitenkaan ole erillinen ohjelma vaan pyörii selaimessa — vaikka se näyttäisi kokoruutusovellukselta.\n\n"
    "Käytännössä tämä tarkoittaa, että PWA:lla on **täsmälleen samat rajoitukset** kuin millä tahansa verkkosivulla. Se ei voi:\n\n"
    "- Lukea yhteystietojasi tai puheluhistoriaasi\n"
    "- Nähdä puhelimen valokuvia (paitsi ne, jotka nimenomaisesti lataat)\n"
    "- Selata muiden sovellusten dataa\n"
    "- Käynnistyä taustalla ilman että avaat sen\n"
    "- Käyttää sijaintitietoa ilman lupaa\n"
    "- Lähettää push-ilmoituksia ilman lupaa\n"
    "- Käyttää kameraa tai mikrofonia ilman lupaa\n\n"
    "Toisin sanoen: viikinkitapahtumat.fi asennettuna PWA:na näkee sinusta yhtä paljon (ja vain yhtä paljon) kuin jos avaisit sivuston selaimessa.\n\n"
    "## Mitä tietoja viikinkitapahtumat.fi kerää?\n\n"
    "Kaikki keräämämme tieto on kuvattu tarkasti tietosuojaselosteessa, mutta lyhyesti tässä on koko lista:\n\n"
    "- **Selainmuistiin (localStorage) tallennettuja tietoja**: valittu kieli, hyväksymäsi evästeasetukset, kirjautumisen jälkeen JWT-kirjautumistunniste. Nämä pysyvät VAIN sinun laitteellasi.\n"
    "- **Palvelimelle tallennettuja tietoja jos rekisteröidyt**: sähköposti, salasana (bcrypt-hashattuna — emme näe salasanaasi selvätekstinä), nimimerkki, maa, kiinnostuksen kohteet ja se mitä tapahtumia olet RSVP:llä ilmoittanut. Kaikki nämä olet itse antanut ja voit poistaa ne milloin tahansa.\n"
    "- **Verkkoliikenteen lokitiedot** (IP-osoite, käytetyt sivut, ajankohta) — säilytämme 30 päivää palveluvirheiden korjaamiseksi ja väärinkäytön estämiseksi.\n"
    "- **Anonyymit käyttötilastot** Google Analyticsin kautta — VAIN jos hyväksyt evästebannerista. Voit hylätä ne yhdellä klikkauksella.\n\n"
    "**Emme myy tietojasi kolmansille osapuolille**. Emme lähetä sinulle mainossähköpostia ilman erillistä uutiskirjeen tilausta. Sivustolla ei ole mainoksia eikä ulkoisia mainostajien seurantapiksellejä.\n\n"
    "## Miten offline-toiminto toimii — kerätäänkö silloin tietoa?\n\n"
    "Kun asennat PWA:n, palvelutyöntekijä (service worker) tallentaa selaimen sisäiseen välimuistiin niitä tapahtumia ja artikkeleita, joita olet katsonut. Tämän ansiosta voit selata jo latautuneita sivuja myös verkon katketessa.\n\n"
    "**Välimuisti on täysin paikallinen** — mitään ei lähetetä takaisin palvelimelle. Voit tyhjentää sen milloin tahansa poistamalla sovelluksen tai selaimen välimuistin kautta.\n\n"
    "## Miten voit itse varmistaa mitä sovellus tekee?\n\n"
    "PWA:n läpinäkyvyys on sen suuri etu: koska se on verkkosivu, voit **kirjaimellisesti tarkistaa itse** mitä se lähettää ja vastaanottaa:\n\n"
    "- Avaa Chrome tai Firefox tietokoneella\n"
    "- Mene osoitteeseen viikinkitapahtumat.fi\n"
    "- Paina F12 → välilehti \u201eNetwork\u201d\n"
    "- Selaa sivustoa ja katso kaikki verkkopyynnöt. Ei mitään piilotettuja pyyntöjä muualle kuin viikinkitapahtumat.fi:n omalle palvelimelle.\n\n"
    "Sama pätee mobiilisovellukselle asennettuna PWA:na — se on sama koodi, sama liikenne.\n\n"
    "## Voinko peruuttaa lupia jos muutan mieleni?\n\n"
    "Kyllä, ja se on helppoa:\n\n"
    "- **Sijainti / kamera / mikrofoni**: mene puhelimen selaimen asetuksiin → sivustokohtaiset asetukset → viikinkitapahtumat.fi → peru kaikki luvat. Sovellus ei voi enää käyttää niitä.\n"
    "- **Push-ilmoitukset**: peru samasta valikosta (tai natiivista Asetukset → Ilmoitukset).\n"
    "- **Evästeet / analytiikka**: paina alalaidassa olevaa evästebanneria tai käy Tietosuojaseloste-sivulla.\n"
    "- **Käyttäjätilin poisto**: profiilisivulla on \u201ePoista tili\u201d -painike, joka poistaa kaikki henkilökohtaiset tietosi peruuttamattomasti.\n"
    "- **Poista koko sovellus**: pitkä painallus aloitusnäytöllä olevalle kuvakkeelle → Poista sovellus. Kaikki paikalliseen välimuistiin tallennettu poistetaan samalla.\n\n"
    "## Yhteenveto\n\n"
    "PWA:na asennettu viikinkitapahtumat.fi ei ole vakoiluohjelma — se on **sama verkkosivusto** jonka tunnet, jolla on sama tietosuoja kuin selaimessa käyttäessäsi. Mikään erityisesti PWA-asennuksen mukana ei kerää lisätietoa. Kaikkia lupia hallinnoidaan puhelimen selaimen omien asetusten kautta.\n\n"
    "Jos sinulla on kysymyksiä tietosuojasta tai haluat tarkistaa mitä tietoja meillä on sinusta, ota yhteyttä osoitteeseen admin@viikinkitapahtumat.fi. GDPR:n mukaisesti annamme sinulle koko datasi kopion 30 päivän sisällä pyynnöstä.\n\n"
    "Täydellinen tietosuojaseloste löytyy sivuston alaosasta \u201eTietosuoja\u201d-linkistä."
)


async def _seed_privacy_pwa_article(db) -> None:
    """Insert the privacy/PWA explainer article. Reuses site screenshots
    from the install-guide article for the gallery, plus a new dedicated
    cover image (viking shield + smartphone padlock).
    Idempotent — exits early if the slug already exists."""
    existing = await db.articles.find_one({"slug": _PRIVACY_PWA_SLUG}, {"id": 1})
    if existing:
        return

    now = datetime.now(timezone.utc).isoformat()
    article = {
        "id": str(uuid.uuid4()),
        "slug": _PRIVACY_PWA_SLUG,
        "title_fi": "Vakoileeko sovellus minua? Tietosuoja ja PWA yksinkertaisesti selitettynä",
        "title_en": "Is the app spying on me? Privacy and PWA explained simply",
        "title_sv": "Spionerar appen på mig? Integritet och PWA enkelt förklarat",
        "title_da": "Spionerer appen på mig? Privatliv og PWA enkelt forklaret",
        "title_de": "Spioniert die App mich aus? Datenschutz und PWA einfach erklärt",
        "title_et": "Kas rakendus jälgib mind? Privaatsus ja PWA lihtsalt selgitatud",
        "title_pl": "Czy aplikacja mnie szpieguje? Prywatność i PWA prosto wyjaśnione",
        "excerpt_fi": (
            "PWA:na asennettu viikinkitapahtumat.fi ei näe sinusta enempää kuin "
            "selain. Näin varmistat asian itse ja hallinnoit lupia."
        ),
        "excerpt_en": "",
        "excerpt_sv": "",
        "excerpt_da": "",
        "excerpt_de": "",
        "excerpt_et": "",
        "excerpt_pl": "",
        "body_fi": _PRIVACY_PWA_BODY_FI,
        "body_en": "",
        "body_sv": "",
        "body_da": "",
        "body_de": "",
        "body_et": "",
        "body_pl": "",
        # Cover: viking shield + smartphone padlock (new Gemini generation)
        "cover_image_url": "/article-images/privacy_shield_95024907.jpg",
        # Gallery: reuse the phone-framed site screenshots — reinforces the
        # message "you see exactly the same site as in a browser".
        "gallery": [
            "/article-images/pwa_site_home_f3b4ffed.jpg",
            "/article-images/pwa_site_article_3a390e54.jpg",
        ],
        "published_at": now,
        "created_at": now,
        "updated_at": now,
        "feedback_form_type": None,
    }
    await db.articles.insert_one(article.copy())
    logger.info("Seeded privacy/PWA article (slug=%s)", _PRIVACY_PWA_SLUG)


# =============================================================================
# Startup init
# =============================================================================
async def init_articles(db) -> None:
    """Called from the app startup handler after Mongo connection is ready.

    - Creates indexes
    - Runs each seed (idempotent — skips if slug exists)
    - Self-heals legacy GridFS-prefixed image URLs on seed articles
    - Schedules a background translation sweep (best-effort, non-blocking)
    """
    await db.articles.create_index("slug", unique=True)
    await db.articles.create_index("id", unique=True)
    await db.articles.create_index("published_at")

    # Seed the introductory article on first boot. Idempotent — exits early
    # if the article already exists. Image generation may take 10–20s; we
    # await it here so the article is fully ready by the time the first
    # /api/articles request arrives.
    try:
        await _seed_intro_article(db)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Intro article seed failed (will retry on next boot): %s", exc)
    try:
        await _seed_beta_tester_article(db)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Beta tester article seed failed (will retry on next boot): %s", exc)
    try:
        await _seed_pwa_install_article(db)
    except Exception as exc:  # noqa: BLE001
        logger.warning("PWA install article seed failed (will retry on next boot): %s", exc)
    try:
        await _seed_privacy_pwa_article(db)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Privacy/PWA article seed failed (will retry on next boot): %s", exc)

    # ---- Self-healing for seed articles' image URLs ---------------------
    # Older deploys wrote hero/gallery URLs pointing at the GridFS-backed
    # /api/uploads/article-images/<file>.jpg endpoint. Those blobs live only
    # in the *preview* Mongo bucket — production has empty GridFS so those
    # URLs 404. The files are now committed to the repo as static assets at
    # /article-images/<file>.jpg. This one-shot startup pass rewrites any
    # DB article that still references the old prefix but only for the
    # specific seed-owned filenames (never touches admin-uploaded images).
    try:
        _seed_image_files = {
            "privacy_shield_95024907.jpg",
            "pwa_site_home_f3b4ffed.jpg",
            "pwa_site_events_f7a05f4b.jpg",
            "pwa_site_article_3a390e54.jpg",
            "pwa_guide_android_0325f007.jpg",
            "pwa_guide_ios_f9880829.jpg",
            "pwa_guide_homescreen_694e497d.jpg",
        }
        _old_pfx = "/api/uploads/article-images/"
        _new_pfx = "/article-images/"

        def _heal(url: Optional[str]) -> Optional[str]:
            if not url or not url.startswith(_old_pfx):
                return url
            filename = url[len(_old_pfx):]
            if filename in _seed_image_files:
                return _new_pfx + filename
            return url

        healed = 0
        async for art in db.articles.find(
            {}, {"_id": 1, "slug": 1, "cover_image_url": 1, "gallery": 1}
        ):
            changes = {}
            new_cover = _heal(art.get("cover_image_url"))
            if new_cover != art.get("cover_image_url"):
                changes["cover_image_url"] = new_cover
            gallery = art.get("gallery") or []
            new_gallery = [_heal(g) for g in gallery]
            if new_gallery != gallery:
                changes["gallery"] = new_gallery
            if changes:
                changes["updated_at"] = datetime.now(timezone.utc).isoformat()
                await db.articles.update_one(
                    {"_id": art["_id"]}, {"$set": changes}
                )
                healed += 1
        if healed:
            logger.info(
                "Auto-healed %d article(s) with legacy GridFS image URLs", healed
            )
    except Exception as exc:  # noqa: BLE001
        logger.warning("Article image URL self-heal failed: %s", exc)

    # Translate any seeded/manually-added articles into the other 6 languages
    # in the background. Best-effort; runs once per boot and is fully
    # idempotent (only fills empty fields). We schedule it as a task so the
    # startup phase isn't blocked by ~30-60s of Claude calls.
    async def _bg_article_translate_sweep():
        try:
            result = await sweep_missing_article_translations(db, max_articles=10)
            if result.get("fields_filled"):
                logger.info("Article translation sweep done: %s", result)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Article translation sweep failed: %s", exc)

    asyncio.create_task(_bg_article_translate_sweep())
