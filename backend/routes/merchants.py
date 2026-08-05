"""Merchants module — merchant cards (admin management + activation requests
+ public directory helpers) and event organizer requests (application flow +
public contact form). Also exports two idempotent daily sweep jobs
(`merchant_card_expiry_sweep`, `organizer_sync_job`) that server.py wires
into APScheduler.

Extracted from server.py — public API surface unchanged (URLs, response
shapes, status codes, side effects).

Usage from server.py::

    from routes.merchants import (
        create_merchants_router,
        merchant_card_expiry_sweep,   # scheduler job
        organizer_sync_job,           # scheduler job
    )
    api_router.include_router(
        create_merchants_router(db, get_current_user, get_admin_or_moderator)
    )
"""
from __future__ import annotations

import logging
import os
import uuid
from datetime import datetime, timedelta, timezone
from html import escape as html_escape
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field

logger = logging.getLogger(__name__)


# =============================================================================
# Constants
# =============================================================================
MERCHANT_CARD_DEFAULT_MONTHS = 12
MAX_ORGANIZERS_PER_EVENT = 3


def _merchant_until_iso(months: int = MERCHANT_CARD_DEFAULT_MONTHS) -> str:
    """Now + `months` months (approximated as 30-day months) as ISO-8601 UTC."""
    return (datetime.now(timezone.utc) + timedelta(days=30 * months)).isoformat()


# =============================================================================
# Models
# =============================================================================
class FeaturedToggle(BaseModel):
    featured: bool


class MerchantCardRequestPayload(BaseModel):
    shop_name: str = Field(..., min_length=1, max_length=200)
    website: Optional[str] = Field(default="", max_length=500)
    category: str = Field(default="gear")  # "gear" | "smith" | "other"
    description: Optional[str] = Field(default="", max_length=1500)


class MerchantCardRequestDecision(BaseModel):
    note: Optional[str] = None


class EventOrganizerRequestPayload(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=200)
    email: EmailStr
    phone: Optional[str] = Field(default="", max_length=60)
    note: Optional[str] = Field(default="", max_length=1000)


class ContactOrganizerPayload(BaseModel):
    from_name: str = Field(..., min_length=1, max_length=120)
    from_email: EmailStr
    subject: str = Field(..., min_length=1, max_length=200)
    body: str = Field(..., min_length=1, max_length=4000)


class AdminAddOrganizerPayload(BaseModel):
    user_id: str = Field(..., min_length=1)
    event_id: str = Field(..., min_length=1)
    full_name: str = Field(..., min_length=1, max_length=200)
    email: EmailStr
    phone: Optional[str] = Field(default="", max_length=60)
    note: Optional[str] = Field(default="", max_length=1000)


# =============================================================================
# Scheduler jobs — plain module-level coroutines. `db` is captured from the
# outer closure inside the module via `set_db()`. The sweep functions must be
# invocable by APScheduler with no arguments; we solve this by having
# server.py pass `functools.partial(merchant_card_expiry_sweep, db)` into the
# scheduler, but for simplicity we use module-global db set at wire time.
# =============================================================================
_DB = None  # populated by create_merchants_router()


def _get_db():
    if _DB is None:  # defensive — should never happen after router mount
        raise RuntimeError("merchants module: db not configured")
    return _DB


async def merchant_card_expiry_sweep() -> dict:
    """Daily APScheduler sweep — disables cards whose `merchant_until` is in
    the past. Returns a summary for logs / admin diagnostics."""
    db = _get_db()
    now_iso = datetime.now(timezone.utc).isoformat()
    res = await db.users.update_many(
        {
            "merchant_card.enabled": True,
            "merchant_card.merchant_until": {"$lt": now_iso, "$ne": None},
        },
        {
            "$set": {
                "merchant_card.enabled": False,
                "merchant_card.featured": False,
                "merchant_card.updated_at": now_iso,
            }
        },
    )
    summary = {"expired": int(res.modified_count or 0), "ran_at": now_iso}
    if summary["expired"]:
        logger.info("Merchant card expiry sweep: %s", summary)
    return summary


async def organizer_sync_job() -> dict:
    """Daily APScheduler self-heal — re-runs the same logic as
    POST /admin/event-organizer-requests/sync to ensure every approved
    organizer request is reflected in events.organizer_user_ids."""
    db = _get_db()
    rows = await db.event_organizer_requests.find(
        {"status": "approved"},
        {"_id": 0, "event_id": 1, "user_id": 1},
    ).to_list(5000)
    by_event: dict[str, list[str]] = {}
    for r in rows:
        by_event.setdefault(r["event_id"], []).append(r["user_id"])
    added_total = 0
    for eid, uids in by_event.items():
        ev = await db.events.find_one({"id": eid}, {"_id": 0, "organizer_user_ids": 1})
        if not ev:
            continue
        current = set(ev.get("organizer_user_ids") or [])
        to_add = [u for u in uids if u not in current][
            : max(0, MAX_ORGANIZERS_PER_EVENT - len(current))
        ]
        if to_add:
            await db.events.update_one(
                {"id": eid},
                {"$addToSet": {"organizer_user_ids": {"$each": to_add}}},
            )
            added_total += len(to_add)
    summary = {
        "added": added_total,
        "ran_at": datetime.now(timezone.utc).isoformat(),
    }
    if added_total:
        logger.info("Organizer sync: healed %d orphan rows", added_total)
    return summary


# =============================================================================
# Router factory
# =============================================================================
def create_merchants_router(db, get_current_user, get_admin_or_moderator) -> APIRouter:
    """Register `db` for the scheduler jobs and build the /api/... router."""
    global _DB
    _DB = db

    router = APIRouter()

    # =========================================================================
    # Admin merchant-card management (enable / disable / featured toggle /
    # admin list).
    # =========================================================================
    @router.post("/admin/users/{user_id}/merchant-card/enable")
    async def admin_enable_merchant_card(
        user_id: str,
        _admin: dict = Depends(get_admin_or_moderator),
        months: int = MERCHANT_CARD_DEFAULT_MONTHS,
    ):
        """Enable a user's merchant card and start a fresh subscription window.
        Idempotent: re-enabling an already-active card extends the expiry."""
        user = await db.users.find_one(
            {"id": user_id},
            {"_id": 0, "id": 1, "merchant_card": 1, "user_types": 1},
        )
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        if "merchant" not in (user.get("user_types") or []):
            # Auto-add merchant role since admin is granting them a merchant card
            await db.users.update_one(
                {"id": user_id}, {"$addToSet": {"user_types": "merchant"}}
            )
        existing = user.get("merchant_card") or {}
        now = datetime.now(timezone.utc).isoformat()
        new_card = {
            "enabled": True,
            "shop_name": existing.get("shop_name") or "",
            "website": existing.get("website") or "",
            "phone": existing.get("phone") or "",
            "email": existing.get("email") or "",
            "description": existing.get("description") or "",
            "image_url": existing.get("image_url"),
            "category": existing.get("category") or "gear",
            "featured": bool(existing.get("featured", False)),
            "merchant_until": _merchant_until_iso(months),
            "created_at": existing.get("created_at") or now,
            "updated_at": now,
        }
        await db.users.update_one(
            {"id": user_id}, {"$set": {"merchant_card": new_card}}
        )
        return new_card

    @router.post("/admin/users/{user_id}/merchant-card/disable")
    async def admin_disable_merchant_card(
        user_id: str, _admin: dict = Depends(get_admin_or_moderator)
    ):
        res = await db.users.update_one(
            {"id": user_id},
            {
                "$set": {
                    "merchant_card.enabled": False,
                    "merchant_card.featured": False,
                    "merchant_card.updated_at": datetime.now(timezone.utc).isoformat(),
                }
            },
        )
        if res.matched_count == 0:
            raise HTTPException(status_code=404, detail="User not found")
        return {"ok": True}

    @router.patch("/admin/users/{user_id}/merchant-card/featured")
    async def admin_toggle_merchant_card_featured(
        user_id: str,
        payload: FeaturedToggle,
        _admin: dict = Depends(get_admin_or_moderator),
    ):
        res = await db.users.find_one_and_update(
            {"id": user_id, "merchant_card.enabled": True},
            {
                "$set": {
                    "merchant_card.featured": bool(payload.featured),
                    "merchant_card.updated_at": datetime.now(timezone.utc).isoformat(),
                }
            },
            return_document=True,
            projection={"_id": 0, "merchant_card": 1},
        )
        if not res:
            raise HTTPException(status_code=404, detail="Active merchant card not found")
        return res.get("merchant_card") or {}

    @router.get("/admin/merchant-cards")
    async def admin_list_merchant_cards(
        _admin: dict = Depends(get_admin_or_moderator),
    ):
        """Lists every user with a merchant_card sub-document (enabled or not)
        so the admin panel can manage them."""
        rows = await db.users.find(
            {"merchant_card": {"$exists": True, "$ne": None}},
            {
                "_id": 0,
                "id": 1,
                "email": 1,
                "nickname": 1,
                "merchant_name": 1,
                "user_types": 1,
                "merchant_card": 1,
            },
        ).to_list(2000)
        out = []
        for u in rows:
            m = u.get("merchant_card") or {}
            out.append(
                {
                    "user_id": u["id"],
                    "email": u.get("email"),
                    "nickname": u.get("nickname"),
                    "merchant_name": u.get("merchant_name"),
                    "enabled": bool(m.get("enabled", False)),
                    "featured": bool(m.get("featured", False)),
                    "shop_name": m.get("shop_name") or "",
                    "merchant_until": m.get("merchant_until"),
                    "category": m.get("category") or "gear",
                }
            )
        out.sort(
            key=lambda r: ((not r["enabled"]), r["shop_name"].lower(), r["email"] or "")
        )
        return out

    # =========================================================================
    # Merchant card activation requests (user submits → admin approves/rejects)
    # =========================================================================
    @router.post("/merchant-card-requests", status_code=201)
    async def submit_merchant_card_request(
        payload: MerchantCardRequestPayload,
        user: dict = Depends(get_current_user),
    ):
        """Logged-in user submits a merchant-card activation request. Only one
        `pending` request per user — a duplicate POST returns the existing one."""
        cat = payload.category if payload.category in ("gear", "smith", "other") else "gear"
        existing = await db.merchant_card_requests.find_one(
            {"user_id": user["id"], "status": "pending"}, {"_id": 0}
        )
        now_iso = datetime.now(timezone.utc).isoformat()
        if existing:
            # Update the in-flight request with newest details, leaves status alone.
            await db.merchant_card_requests.update_one(
                {"id": existing["id"]},
                {
                    "$set": {
                        "shop_name": payload.shop_name.strip(),
                        "website": (payload.website or "").strip(),
                        "category": cat,
                        "description": (payload.description or "").strip(),
                        "updated_at": now_iso,
                    }
                },
            )
            existing.update(
                {
                    "shop_name": payload.shop_name.strip(),
                    "website": (payload.website or "").strip(),
                    "category": cat,
                    "description": (payload.description or "").strip(),
                    "updated_at": now_iso,
                }
            )
            return existing
        doc = {
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "user_email": user.get("email"),
            "user_name": user.get("name") or user.get("nickname") or "",
            "shop_name": payload.shop_name.strip(),
            "website": (payload.website or "").strip(),
            "category": cat,
            "description": (payload.description or "").strip(),
            "status": "pending",
            "created_at": now_iso,
            "updated_at": now_iso,
            "processed_at": None,
            "processed_by": None,
            "admin_note": None,
        }
        await db.merchant_card_requests.insert_one(doc)
        doc.pop("_id", None)
        return doc

    @router.get("/merchant-card-requests/mine")
    async def my_merchant_card_request(user: dict = Depends(get_current_user)):
        """Returns the user's most recent request (any status), or null."""
        doc = await db.merchant_card_requests.find_one(
            {"user_id": user["id"]},
            {"_id": 0},
            sort=[("created_at", -1)],
        )
        return doc

    @router.get("/admin/merchant-card-requests")
    async def admin_list_merchant_card_requests(
        status: Optional[str] = None,
        _admin: dict = Depends(get_admin_or_moderator),
    ):
        """Admin: list all requests (optionally filtered by status)."""
        q: dict = {}
        if status in ("pending", "approved", "rejected"):
            q["status"] = status
        rows = (
            await db.merchant_card_requests.find(q, {"_id": 0})
            .sort("created_at", -1)
            .to_list(1000)
        )
        return rows

    @router.post("/admin/merchant-card-requests/{request_id}/approve")
    async def admin_approve_merchant_card_request(
        request_id: str,
        payload: Optional[MerchantCardRequestDecision] = None,
        admin: dict = Depends(get_admin_or_moderator),
    ):
        """Approve a request — auto-activates the user's merchant card with the
        requested shop_name/category/description, sets the 12-month window, and
        adds the `merchant` user_type if missing."""
        req = await db.merchant_card_requests.find_one(
            {"id": request_id}, {"_id": 0}
        )
        if not req:
            raise HTTPException(status_code=404, detail="Request not found")
        if req.get("status") != "pending":
            raise HTTPException(status_code=409, detail="Request already processed")

        user_id = req["user_id"]
        user = await db.users.find_one(
            {"id": user_id},
            {"_id": 0, "id": 1, "merchant_card": 1, "user_types": 1},
        )
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        if "merchant" not in (user.get("user_types") or []):
            await db.users.update_one(
                {"id": user_id}, {"$addToSet": {"user_types": "merchant"}}
            )
        existing = user.get("merchant_card") or {}
        now_iso = datetime.now(timezone.utc).isoformat()
        new_card = {
            "enabled": True,
            "shop_name": req.get("shop_name") or existing.get("shop_name") or "",
            "website": req.get("website") or existing.get("website") or "",
            "phone": existing.get("phone") or "",
            "email": existing.get("email") or "",
            "description": req.get("description") or existing.get("description") or "",
            "image_url": existing.get("image_url"),
            "category": req.get("category") or existing.get("category") or "gear",
            "featured": bool(existing.get("featured", False)),
            "merchant_until": _merchant_until_iso(MERCHANT_CARD_DEFAULT_MONTHS),
            "created_at": existing.get("created_at") or now_iso,
            "updated_at": now_iso,
        }
        await db.users.update_one(
            {"id": user_id}, {"$set": {"merchant_card": new_card}}
        )
        await db.merchant_card_requests.update_one(
            {"id": request_id},
            {
                "$set": {
                    "status": "approved",
                    "processed_at": now_iso,
                    "processed_by": admin.get("id"),
                    "admin_note": (payload.note if payload else None) or None,
                }
            },
        )
        return {"approved": True, "merchant_card": new_card}

    @router.post("/admin/merchant-card-requests/{request_id}/reject")
    async def admin_reject_merchant_card_request(
        request_id: str,
        payload: Optional[MerchantCardRequestDecision] = None,
        admin: dict = Depends(get_admin_or_moderator),
    ):
        res = await db.merchant_card_requests.find_one_and_update(
            {"id": request_id, "status": "pending"},
            {
                "$set": {
                    "status": "rejected",
                    "processed_at": datetime.now(timezone.utc).isoformat(),
                    "processed_by": admin.get("id"),
                    "admin_note": (payload.note if payload else None) or None,
                }
            },
            return_document=True,
            projection={"_id": 0},
        )
        if not res:
            raise HTTPException(status_code=404, detail="Pending request not found")
        return {"rejected": True, "request": res}

    @router.get("/admin/merchant-card-requests/pending-count")
    async def admin_pending_request_count(
        _admin: dict = Depends(get_admin_or_moderator),
    ):
        """Lightweight badge counter for the admin panel header."""
        n = await db.merchant_card_requests.count_documents({"status": "pending"})
        return {"pending": n}

    # =========================================================================
    # Event organizer activation requests
    # =========================================================================
    @router.post("/events/{event_id}/organizer-requests", status_code=201)
    async def submit_event_organizer_request(
        event_id: str,
        payload: EventOrganizerRequestPayload,
        user: dict = Depends(get_current_user),
    ):
        """Logged-in user (organizer/admin role) requests to be added as an
        official organizer for the given approved event. Admin reviews and
        approves; max 3 organizers per event.
        """
        user_types = set(user.get("user_types") or [])
        is_admin = user.get("role") == "admin"
        if not is_admin and "organizer" not in user_types:
            raise HTTPException(
                status_code=403,
                detail="Only users with the organizer role can request to organize events",
            )
        ev = await db.events.find_one(
            {"id": event_id, "status": "approved"},
            {"_id": 0, "id": 1, "organizer_user_ids": 1},
        )
        if not ev:
            raise HTTPException(status_code=404, detail="Event not found")
        if user["id"] in (ev.get("organizer_user_ids") or []):
            raise HTTPException(
                status_code=409, detail="Already an approved organizer for this event"
            )

        existing = await db.event_organizer_requests.find_one(
            {"user_id": user["id"], "event_id": event_id, "status": "pending"},
            {"_id": 0},
        )
        now_iso = datetime.now(timezone.utc).isoformat()
        if existing:
            await db.event_organizer_requests.update_one(
                {"id": existing["id"]},
                {
                    "$set": {
                        "full_name": payload.full_name.strip(),
                        "email": str(payload.email).strip(),
                        "phone": (payload.phone or "").strip(),
                        "note": (payload.note or "").strip(),
                        "updated_at": now_iso,
                    }
                },
            )
            existing.update(
                {
                    "full_name": payload.full_name.strip(),
                    "email": str(payload.email).strip(),
                    "phone": (payload.phone or "").strip(),
                    "note": (payload.note or "").strip(),
                    "updated_at": now_iso,
                }
            )
            return existing

        doc = {
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "user_email": user.get("email"),
            "user_nickname": user.get("nickname") or user.get("name") or "",
            "event_id": event_id,
            "full_name": payload.full_name.strip(),
            "email": str(payload.email).strip(),
            "phone": (payload.phone or "").strip(),
            "note": (payload.note or "").strip(),
            "status": "pending",
            "created_at": now_iso,
            "updated_at": now_iso,
            "processed_at": None,
            "processed_by": None,
            "admin_note": None,
        }
        await db.event_organizer_requests.insert_one(doc)
        doc.pop("_id", None)
        return doc

    @router.get("/events/{event_id}/organizer-requests/mine")
    async def my_event_organizer_request(
        event_id: str, user: dict = Depends(get_current_user)
    ):
        """Returns the current user's most recent request for this event, or null."""
        doc = await db.event_organizer_requests.find_one(
            {"user_id": user["id"], "event_id": event_id},
            {"_id": 0},
            sort=[("created_at", -1)],
        )
        return doc

    @router.get("/events/{event_id}/organizers")
    async def list_event_organizers(event_id: str):
        """Public list of approved organizers for this event. Returns
        `[{user_id, full_name, email, phone}]`. Empty array if none.
        """
        ev = await db.events.find_one(
            {"id": event_id, "status": "approved"},
            {"_id": 0, "id": 1, "organizer_user_ids": 1},
        )
        if not ev:
            raise HTTPException(status_code=404, detail="Event not found")
        ids = ev.get("organizer_user_ids") or []
        if not ids:
            return []
        # Look up the latest approved request per (user_id, event_id) to surface
        # the official name+contact (the user submitted as part of the request).
        rows = await db.event_organizer_requests.find(
            {"event_id": event_id, "user_id": {"$in": ids}, "status": "approved"},
            {"_id": 0, "user_id": 1, "full_name": 1, "email": 1, "phone": 1},
            sort=[("processed_at", -1)],
        ).to_list(50)
        seen: set = set()
        out: list[dict] = []
        for r in rows:
            if r["user_id"] in seen:
                continue
            seen.add(r["user_id"])
            out.append(
                {
                    "user_id": r["user_id"],
                    "full_name": r.get("full_name") or "",
                    "email": r.get("email") or "",
                    "phone": r.get("phone") or "",
                }
            )
        return out

    @router.get("/admin/event-organizer-requests")
    async def admin_list_event_organizer_requests(
        status: Optional[str] = None,
        _admin: dict = Depends(get_admin_or_moderator),
    ):
        q: dict = {}
        if status in ("pending", "approved", "rejected"):
            q["status"] = status
        rows = (
            await db.event_organizer_requests.find(q, {"_id": 0})
            .sort("created_at", -1)
            .to_list(2000)
        )
        # Enrich with event titles for the admin UI.
        if rows:
            eids = list({r["event_id"] for r in rows})
            evs = await db.events.find(
                {"id": {"$in": eids}},
                {"_id": 0, "id": 1, "title_fi": 1, "title_en": 1, "start_date": 1},
            ).to_list(2000)
            ev_map = {e["id"]: e for e in evs}
            for r in rows:
                ev = ev_map.get(r["event_id"]) or {}
                r["event_title"] = (
                    ev.get("title_fi") or ev.get("title_en") or r["event_id"]
                )
                r["event_start_date"] = ev.get("start_date") or ""
        return rows

    @router.get("/admin/event-organizer-requests/pending-count")
    async def admin_event_organizer_pending_count(
        _admin: dict = Depends(get_admin_or_moderator),
    ):
        n = await db.event_organizer_requests.count_documents({"status": "pending"})
        return {"pending": n}

    @router.post("/admin/event-organizer-requests/{request_id}/approve")
    async def admin_approve_event_organizer_request(
        request_id: str,
        payload: Optional[MerchantCardRequestDecision] = None,
        admin: dict = Depends(get_admin_or_moderator),
    ):
        """Approve: add the user to events.organizer_user_ids (max 3).
        Returns 409 if the event already has 3 organizers, or if the request
        is no longer pending.
        """
        req = await db.event_organizer_requests.find_one(
            {"id": request_id}, {"_id": 0}
        )
        if not req:
            raise HTTPException(status_code=404, detail="Request not found")
        if req.get("status") != "pending":
            raise HTTPException(status_code=409, detail="Request already processed")

        ev = await db.events.find_one(
            {"id": req["event_id"]},
            {"_id": 0, "id": 1, "organizer_user_ids": 1},
        )
        if not ev:
            raise HTTPException(status_code=404, detail="Event not found")
        current = list(ev.get("organizer_user_ids") or [])
        if req["user_id"] in current:
            # Already an organizer — mark request as approved without re-adding
            await db.event_organizer_requests.update_one(
                {"id": request_id},
                {
                    "$set": {
                        "status": "approved",
                        "processed_at": datetime.now(timezone.utc).isoformat(),
                        "processed_by": admin.get("id"),
                        "admin_note": (payload.note if payload else None) or None,
                    }
                },
            )
            return {"approved": True, "organizer_user_ids": current}
        if len(current) >= MAX_ORGANIZERS_PER_EVENT:
            raise HTTPException(
                status_code=409,
                detail=f"Event already has the maximum of {MAX_ORGANIZERS_PER_EVENT} organizers",
            )

        now_iso = datetime.now(timezone.utc).isoformat()
        await db.events.update_one(
            {"id": req["event_id"]},
            {"$addToSet": {"organizer_user_ids": req["user_id"]}},
        )
        await db.event_organizer_requests.update_one(
            {"id": request_id},
            {
                "$set": {
                    "status": "approved",
                    "processed_at": now_iso,
                    "processed_by": admin.get("id"),
                    "admin_note": (payload.note if payload else None) or None,
                }
            },
        )
        # Auto-add organizer user_type if missing (so they appear in admin lists).
        user_doc = await db.users.find_one(
            {"id": req["user_id"]}, {"_id": 0, "user_types": 1}
        )
        if user_doc and "organizer" not in (user_doc.get("user_types") or []):
            await db.users.update_one(
                {"id": req["user_id"]}, {"$addToSet": {"user_types": "organizer"}}
            )
        return {"approved": True, "organizer_user_ids": current + [req["user_id"]]}

    @router.post("/admin/event-organizer-requests/{request_id}/reject")
    async def admin_reject_event_organizer_request(
        request_id: str,
        payload: Optional[MerchantCardRequestDecision] = None,
        admin: dict = Depends(get_admin_or_moderator),
    ):
        res = await db.event_organizer_requests.find_one_and_update(
            {"id": request_id, "status": "pending"},
            {
                "$set": {
                    "status": "rejected",
                    "processed_at": datetime.now(timezone.utc).isoformat(),
                    "processed_by": admin.get("id"),
                    "admin_note": (payload.note if payload else None) or None,
                }
            },
            return_document=True,
            projection={"_id": 0},
        )
        if not res:
            raise HTTPException(status_code=404, detail="Pending request not found")
        return {"rejected": True, "request": res}

    @router.post("/events/{event_id}/organizers/{user_id}/contact")
    async def contact_event_organizer(
        event_id: str,
        user_id: str,
        payload: ContactOrganizerPayload,
    ):
        """Public endpoint: send a message from a visitor to an approved
        organizer of this event. The organizer's real email address stays
        hidden — we look it up server-side from the latest approved
        `event_organizer_requests` row. Reply-To is set to the visitor's
        email so the organizer can respond directly via their mail client.
        """
        ev = await db.events.find_one(
            {"id": event_id, "status": "approved"},
            {"_id": 0, "id": 1, "title_fi": 1, "title_en": 1, "organizer_user_ids": 1},
        )
        if not ev:
            raise HTTPException(status_code=404, detail="Event not found")
        if user_id not in (ev.get("organizer_user_ids") or []):
            raise HTTPException(status_code=404, detail="Organizer not found for this event")
        org_req = await db.event_organizer_requests.find_one(
            {"event_id": event_id, "user_id": user_id, "status": "approved"},
            {"_id": 0, "full_name": 1, "email": 1},
            sort=[("processed_at", -1)],
        )
        if not org_req or not (org_req.get("email") or "").strip():
            raise HTTPException(status_code=404, detail="Organizer has no contact email on file")

        to_email = org_req["email"].strip()
        organizer_name = org_req.get("full_name") or "Tapahtuman järjestäjä"
        ev_title = ev.get("title_fi") or ev.get("title_en") or "Viikinkitapahtumat"

        site = os.environ.get("PUBLIC_SITE_URL", "https://viikinkitapahtumat.fi")
        subject_line = f"[{ev_title}] {payload.subject.strip()}"
        html = (
            f"<div style='font-family:system-ui,Arial,sans-serif;background:#0E0B09;color:#E8E2D5;padding:24px;'>"
            f"<div style='max-width:560px;margin:auto;border:1px solid #352A23;padding:24px;'>"
            f"<div style='font-size:11px;letter-spacing:1.6px;color:#C19C4D;text-transform:uppercase;'>"
            f"Viesti tapahtuman järjestäjälle · {html_escape(ev_title)}</div>"
            f"<h1 style='font-family:Georgia,serif;color:#E8E2D5;margin:8px 0 16px;'>"
            f"{html_escape(payload.subject.strip())}</h1>"
            f"<div style='white-space:pre-wrap;line-height:1.55;color:#E8E2D5;'>"
            f"{html_escape(payload.body.strip())}</div>"
            f"<hr style='border:none;border-top:1px solid #352A23;margin:24px 0;'>"
            f"<div style='font-size:13px;color:#E8E2D5;'>Lähettäjä: "
            f"<strong>{html_escape(payload.from_name.strip())}</strong></div>"
            f"<div style='font-size:12px;color:#C19C4D;margin-top:4px;'>"
            f"Vastaa sähköpostiin: "
            f"<a href='mailto:{html_escape(str(payload.from_email))}' style='color:#C19C4D;'>"
            f"{html_escape(str(payload.from_email))}</a></div>"
            f"<div style='font-size:11px;color:#8E8276;margin-top:12px;'>"
            f"Viesti lähetetty osoitteen <a href='{site}' style='color:#C19C4D;'>"
            f"viikinkitapahtumat.fi</a> kautta. Et koskaan paljasta omaa sähköpostiosoitettasi "
            f"lähettäjälle — voit vastata suoraan sähköpostiohjelmastasi.</div>"
            f"</div></div>"
        )
        from email_service import send_email as svc_send_email
        try:
            await svc_send_email(
                to_email,
                subject_line,
                html,
                reply_to=str(payload.from_email),
            )
        except TypeError:
            # Older email_service signature without reply_to — fall back gracefully
            await svc_send_email(to_email, subject_line, html)
        except Exception:
            logger.exception("Failed sending organizer contact email for %s", event_id)
            raise HTTPException(status_code=502, detail="Message could not be sent")

        # Audit log (no PII leaked to public — only org recipient + event)
        await db.organizer_contact_log.insert_one(
            {
                "event_id": event_id,
                "organizer_user_id": user_id,
                "organizer_name": organizer_name,
                "from_name": payload.from_name.strip(),
                "from_email": str(payload.from_email),
                "subject": payload.subject.strip()[:200],
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        )
        return {"ok": True}

    @router.delete("/admin/events/{event_id}/organizers/{user_id}")
    async def admin_remove_event_organizer(
        event_id: str,
        user_id: str,
        _admin: dict = Depends(get_admin_or_moderator),
    ):
        """Admin: remove an approved organizer from an event. Useful if an
        organizer cancels or was approved by mistake. Does not delete the
        historical request record."""
        res = await db.events.update_one(
            {"id": event_id},
            {"$pull": {"organizer_user_ids": user_id}},
        )
        if res.matched_count == 0:
            raise HTTPException(status_code=404, detail="Event not found")
        return {"removed": True}

    @router.post("/admin/event-organizer-requests/sync")
    async def admin_sync_approved_organizers(
        _admin: dict = Depends(get_admin_or_moderator),
    ):
        """Heal tool: finds every `status=approved` row in event_organizer_requests
        and makes sure the corresponding `events.organizer_user_ids` list
        contains the user_id. Idempotent — safe to run any time. Returns a
        small diff summary for the admin UI."""
        rows = await db.event_organizer_requests.find(
            {"status": "approved"},
            {"_id": 0, "event_id": 1, "user_id": 1, "full_name": 1},
        ).to_list(5000)

        by_event: dict[str, list[dict]] = {}
        for r in rows:
            by_event.setdefault(r["event_id"], []).append(r)

        added: list[dict] = []
        missing_events: list[str] = []
        already_ok = 0
        for eid, reqs in by_event.items():
            ev = await db.events.find_one(
                {"id": eid}, {"_id": 0, "id": 1, "organizer_user_ids": 1}
            )
            if not ev:
                missing_events.append(eid)
                continue
            current = set(ev.get("organizer_user_ids") or [])
            to_add = [r["user_id"] for r in reqs if r["user_id"] not in current]
            if not to_add:
                already_ok += len(reqs)
                continue
            remaining_slots = max(0, MAX_ORGANIZERS_PER_EVENT - len(current))
            to_add_capped = to_add[:remaining_slots]
            if to_add_capped:
                await db.events.update_one(
                    {"id": eid},
                    {"$addToSet": {"organizer_user_ids": {"$each": to_add_capped}}},
                )
                for uid in to_add_capped:
                    matching = next(
                        (r for r in reqs if r["user_id"] == uid), {}
                    )
                    added.append(
                        {
                            "event_id": eid,
                            "user_id": uid,
                            "full_name": matching.get("full_name") or "",
                        }
                    )
        return {
            "added": added,
            "added_count": len(added),
            "already_ok": already_ok,
            "missing_events": missing_events,
        }

    @router.post("/admin/event-organizers", status_code=201)
    async def admin_add_event_organizer(
        payload: AdminAddOrganizerPayload,
        admin: dict = Depends(get_admin_or_moderator),
    ):
        """Admin shortcut: manually register a user as an approved organizer
        for an event *without* requiring the user to submit a request first.
        Creates a synthetic approved `event_organizer_requests` row (so the
        public /events/{id}/organizers endpoint surfaces the official
        name+contact), adds user_id to events.organizer_user_ids (max 3),
        and ensures the user has the organizer user_type.
        """
        user = await db.users.find_one(
            {"id": payload.user_id},
            {
                "_id": 0,
                "id": 1,
                "email": 1,
                "nickname": 1,
                "name": 1,
                "user_types": 1,
            },
        )
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        ev = await db.events.find_one(
            {"id": payload.event_id},
            {"_id": 0, "id": 1, "status": 1, "organizer_user_ids": 1},
        )
        if not ev:
            raise HTTPException(status_code=404, detail="Event not found")
        current = list(ev.get("organizer_user_ids") or [])
        if payload.user_id in current:
            raise HTTPException(
                status_code=409,
                detail="User is already an organizer for this event",
            )
        if len(current) >= MAX_ORGANIZERS_PER_EVENT:
            raise HTTPException(
                status_code=409,
                detail=f"Event already has the maximum of {MAX_ORGANIZERS_PER_EVENT} organizers",
            )

        now_iso = datetime.now(timezone.utc).isoformat()
        await db.events.update_one(
            {"id": payload.event_id},
            {"$addToSet": {"organizer_user_ids": payload.user_id}},
        )
        # Synthesize an approved request so /events/{id}/organizers surfaces
        # the full_name/email/phone that the admin entered (these may differ
        # from the user's account nickname/email).
        req_doc = {
            "id": str(uuid.uuid4()),
            "user_id": payload.user_id,
            "user_email": user.get("email"),
            "user_nickname": user.get("nickname") or user.get("name") or "",
            "event_id": payload.event_id,
            "full_name": payload.full_name.strip(),
            "email": str(payload.email).strip(),
            "phone": (payload.phone or "").strip(),
            "note": (payload.note or "").strip(),
            "status": "approved",
            "created_at": now_iso,
            "updated_at": now_iso,
            "processed_at": now_iso,
            "processed_by": admin.get("id"),
            "admin_note": "Manuaalisesti lisätty adminin toimesta",
            "source": "admin_manual",
        }
        await db.event_organizer_requests.insert_one(req_doc)
        if "organizer" not in (user.get("user_types") or []):
            await db.users.update_one(
                {"id": payload.user_id},
                {"$addToSet": {"user_types": "organizer"}},
            )
        req_doc.pop("_id", None)
        return {
            "ok": True,
            "request": req_doc,
            "organizer_user_ids": current + [payload.user_id],
        }

    return router
