"""Messaging module — paid messaging (organizer/merchant → attendees),
in-app inbox/sent history, messaging quota, and push-notification admin
diagnostics.

Extracted from server.py. Public API surface (URLs, response shapes,
status codes, behavior) is unchanged. `record_inbox_rows` is re-exported
because the reminder job in server.py also writes to `user_messages`.

Usage from server.py:

    from routes.messaging import (
        create_messaging_router,
        record_inbox_rows,       # used by reminders
        substitute_event_vars,   # used elsewhere
        substitute_recipient_vars,
    )
    api_router.include_router(
        create_messaging_router(
            db, get_current_user, get_admin_or_moderator
        )
    )
"""
from __future__ import annotations

import logging
import os
import uuid
from datetime import datetime, timezone, timedelta
from html import escape as html_escape
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from email_service import mask_email
from push_service import send_to_users as push_send_to_users

logger = logging.getLogger(__name__)


# =============================================================================
# Models & quota config
# =============================================================================
class SendMessageRequest(BaseModel):
    """Organizer/merchant sends a single message to attendees of an event they
    are also attending. Channel = "push", "email", or "both". Recipients are
    filtered by the appropriate consent flag and `notify_*` per-RSVP, AND
    optionally by `target_categories` (a subset of user_types: reenactor /
    fighter / merchant / organizer). Empty `target_categories` means "all"."""

    event_id: str
    channel: Literal["push", "email", "both"] = "both"
    subject: str
    body: str
    target_categories: List[Literal["reenactor", "fighter", "merchant", "organizer"]] = []


# Messaging quota — global config that limits how many push/email messages a
# single non-admin sender may dispatch per event over its lifetime.
QUOTA_PRESETS = {"A": 10, "B": 20, "C": 30}
DEFAULT_QUOTA_PRESET = "A"
DEFAULT_CUSTOM_QUOTA = 50


class MessagingQuotaConfig(BaseModel):
    preset: Literal["A", "B", "C", "D"] = DEFAULT_QUOTA_PRESET
    custom_value: int = DEFAULT_CUSTOM_QUOTA


class MessagingQuotaUpdate(BaseModel):
    preset: Literal["A", "B", "C", "D"]
    custom_value: Optional[int] = None  # required when preset="D"


async def get_messaging_quota_config(db) -> MessagingQuotaConfig:
    """Read the current messaging quota config from system_config. Defaults to
    preset A (10 messages per event) when no config row exists."""
    row = await db.system_config.find_one({"_id": "messaging_quota"})
    if not row:
        return MessagingQuotaConfig()
    return MessagingQuotaConfig(
        preset=row.get("preset", DEFAULT_QUOTA_PRESET),
        custom_value=int(row.get("custom_value", DEFAULT_CUSTOM_QUOTA)),
    )


def quota_value(cfg: MessagingQuotaConfig) -> int:
    if cfg.preset == "D":
        return max(1, int(cfg.custom_value or DEFAULT_CUSTOM_QUOTA))
    return QUOTA_PRESETS[cfg.preset]


# =============================================================================
# Variable substitution & inbox helpers (re-exported for reminders & other
# server.py sites that also write to `user_messages`)
# =============================================================================
def substitute_event_vars(text: str, ev: dict) -> str:
    if not text or "{{" not in text:
        return text or ""
    site = os.environ.get("PUBLIC_SITE_URL", "https://viikinkitapahtumat.fi")
    repl = {
        "{{event_title}}": (ev.get("title_fi") or ev.get("title_en") or "").strip(),
        "{{event_date}}": (ev.get("start_date") or "").strip(),
        "{{event_location}}": (ev.get("location") or "").strip(),
        "{{organizer_name}}": (ev.get("organizer") or "").strip(),
        "{{event_url}}": f"{site}/events/{ev.get('id', '')}",
        "{{registration_url}}": (ev.get("registration_url") or "").strip(),
    }
    out = text
    for k, v in repl.items():
        out = out.replace(k, v)
    return out


def substitute_recipient_vars(text: str, recipient: dict | None) -> str:
    if not text or "{{nickname}}" not in text:
        return text or ""
    nick = ""
    if recipient:
        nick = (
            recipient.get("nickname")
            or (recipient.get("email", "").split("@")[0] if recipient.get("email") else "")
            or ""
        )
    return text.replace("{{nickname}}", nick)


def _localized_event_title(ev: dict) -> str:
    for k in ("title_fi", "title_en", "title_sv", "title"):
        if ev.get(k):
            return ev[k]
    return "Tapahtuma"


async def _enrich_events_dict(db, event_ids: list[str]) -> dict[str, dict]:
    """Fetch a small set of events keyed by id for inbox/sent grouping."""
    if not event_ids:
        return {}
    rows = await db.events.find(
        {"id": {"$in": list(set(event_ids))}},
        {
            "_id": 0,
            "id": 1,
            "title_fi": 1,
            "title_en": 1,
            "title_sv": 1,
            "title": 1,
            "start_date": 1,
            "end_date": 1,
            "image_url": 1,
            "category": 1,
            "country": 1,
            "city": 1,
            "location": 1,
        },
    ).to_list(500)
    return {r["id"]: r for r in rows}


async def record_inbox_rows(
    db,
    event_id: str,
    recipient_ids,
    sender_id: str,
    sender_label: str,
    channel: str,
    subject: str,
    body: str,
    target_categories: Optional[list[str]] = None,
    recipient_meta: Optional[dict[str, dict]] = None,
) -> str:
    """Insert one `user_messages` row per recipient sharing one batch_id.

    Used for both user-initiated `/messages/send` AND system-generated push
    notifications (RSVP reminders, future notifications, etc.) so every
    notification a user receives ends up in their in-app inbox where they
    can read it later from the Viestit menu. Returns the batch_id.

    If `recipient_meta` is provided (id -> user dict with nickname/email)
    AND the subject/body contain `{{nickname}}`, each row gets a personalised
    copy with the placeholder filled in.
    """
    if not recipient_ids:
        return ""
    batch_id = str(uuid.uuid4())
    now_iso = datetime.now(timezone.utc).isoformat()
    needs_nick = (subject and "{{nickname}}" in subject) or (
        body and "{{nickname}}" in body
    )
    rows = []
    for uid in recipient_ids:
        if needs_nick and recipient_meta is not None:
            recip = recipient_meta.get(uid)
            row_subject = substitute_recipient_vars(subject, recip)
            row_body = substitute_recipient_vars(body, recip)
        else:
            row_subject = subject or ""
            row_body = body or ""
        rows.append(
            {
                "id": str(uuid.uuid4()),
                "batch_id": batch_id,
                "event_id": event_id,
                "sender_id": sender_id,
                "sender_label": sender_label,
                "recipient_id": uid,
                "channel": channel,
                "subject": row_subject[:200],
                "body": row_body,
                "target_categories": target_categories or [],
                "created_at": now_iso,
                "read_at": None,
                "deleted_by_recipient": False,
                "deleted_by_sender": False,
            }
        )
    await db.user_messages.insert_many(rows)
    return batch_id


# =============================================================================
# Router factory
# =============================================================================
def create_messaging_router(db, get_current_user, get_admin_or_moderator) -> APIRouter:
    """Build the /api/... router for messaging."""
    router = APIRouter()

    # ---------------------------------------------------------------------
    # POST /messages/send — organizer/merchant → attendees
    # ---------------------------------------------------------------------
    @router.post("/messages/send")
    async def send_message_to_attendees(
        payload: SendMessageRequest, user: dict = Depends(get_current_user)
    ):
        is_admin = user.get("role") == "admin"
        if not is_admin and not user.get("paid_messaging_enabled"):
            raise HTTPException(
                status_code=402,
                detail="Paid messaging is not enabled for this account",
            )
        user_types = set(user.get("user_types") or [])
        if not is_admin and not (user_types & {"merchant", "organizer"}):
            raise HTTPException(status_code=403, detail="Only merchants/organizers may send")

        ev = await db.events.find_one({"id": payload.event_id, "status": "approved"}, {"_id": 0})
        if not ev:
            raise HTTPException(status_code=404, detail="Event not found")

        # Sender must be RSVPed to this event (admin bypasses for site-wide).
        # This prevents spam from random merchants spamming events they have no
        # connection to: only people committed to attending may send messages.
        # ORGANIZER-specific rule: organizers can only send to events where the
        # admin has approved them as official event organizers (organizer_user_ids).
        # Merchants still use the RSVP rule.
        if not is_admin:
            is_organizer_only = (
                "organizer" in user_types and "merchant" not in user_types
            )
            if is_organizer_only:
                organizer_ids = ev.get("organizer_user_ids") or []
                if user["id"] not in organizer_ids:
                    raise HTTPException(
                        status_code=403,
                        detail="Organizers can only message events they are an approved organizer of",
                    )
            else:
                own_rsvp = await db.event_attendees.find_one(
                    {"event_id": payload.event_id, "user_id": user["id"]},
                    {"_id": 1},
                )
                # Merchant+organizer users: allow if EITHER an approved organizer
                # OR an RSVP exists. This keeps the merchant flow open while
                # giving the organizer flow priority for events they run.
                organizer_ids = ev.get("organizer_user_ids") or []
                if not own_rsvp and user["id"] not in organizer_ids:
                    raise HTTPException(
                        status_code=403,
                        detail="You can only message attendees of events you yourself attend",
                    )

        # Per-event quota for non-admin senders. Counter = total message_log rows
        # by this sender for this event; this means leaving and re-RSVPing does
        # NOT reset the counter (counter is intentionally persistent).
        quota_used = 0
        quota_limit = 0
        if not is_admin:
            cfg = await get_messaging_quota_config(db)
            quota_limit = quota_value(cfg)
            quota_used = await db.message_log.count_documents(
                {"sender_id": user["id"], "event_id": payload.event_id}
            )
            if quota_used >= quota_limit:
                raise HTTPException(
                    status_code=429,
                    detail=f"Message quota for this event reached ({quota_used}/{quota_limit})",
                )

        # Pick the consent filter matching the sender. Admins reach everyone who has
        # given EITHER consent (site-wide announcements). Merchants/organizers stay
        # bound to their respective consent flag.
        if is_admin:
            consent_filter: dict = {
                "$or": [
                    {"consent_organizer_messages": True},
                    {"consent_merchant_offers": True},
                ]
            }
        elif "organizer" in user_types:
            consent_filter = {"consent_organizer_messages": True}
        else:
            consent_filter = {"consent_merchant_offers": True}

        # Optional category filter: limit recipients whose user_types intersect
        # with the sender's selected target_categories. Empty = no filter.
        target_categories = list(payload.target_categories or [])
        user_filter: dict = dict(consent_filter)
        if target_categories:
            user_filter["user_types"] = {"$in": target_categories}

        rows = await db.event_attendees.find(
            {"event_id": payload.event_id}, {"_id": 0}
        ).to_list(5000)
        if not rows:
            return {"sent_push": 0, "sent_email": 0, "recipients": 0}

        user_ids = [r["user_id"] for r in rows]
        consenters = await db.users.find(
            {"id": {"$in": user_ids}, **user_filter},
            {"_id": 0, "id": 1, "email": 1},
        ).to_list(5000)
        consenter_ids = {u["id"] for u in consenters}
        consenter_emails = {u["id"]: u["email"] for u in consenters}

        push_user_ids: list[str] = []
        email_recipients: list[str] = []
        for r in rows:
            uid = r["user_id"]
            if uid not in consenter_ids:
                continue
            if payload.channel in ("push", "both") and r.get("notify_push"):
                push_user_ids.append(uid)
            if payload.channel in ("email", "both") and r.get("notify_email"):
                email_recipients.append(consenter_emails[uid])

        # Sender nickname is appended to every push/email body so recipients always
        # know who the message is from. Admin uses "Viikinkitapahtumat" since the
        # site itself is the sender for site-wide announcements.
        #
        # If the sender is an APPROVED event organizer for this specific event,
        # replace the generic nickname with the official organizer signature
        # (full_name + role + email). This adds credibility to messages and
        # routes follow-up questions to the real organizer, not to platform
        # support.
        organizer_sig: Optional[str] = None
        organizer_email: Optional[str] = None
        if not is_admin and user["id"] in (ev.get("organizer_user_ids") or []):
            org_req = await db.event_organizer_requests.find_one(
                {
                    "event_id": payload.event_id,
                    "user_id": user["id"],
                    "status": "approved",
                },
                {"_id": 0, "full_name": 1, "email": 1},
                sort=[("processed_at", -1)],
            )
            if org_req and org_req.get("full_name"):
                ev_title_short = (ev.get("title_fi") or ev.get("title_en") or "").strip()
                suffix = (
                    f", {ev_title_short} -järjestäjä" if ev_title_short else ", järjestäjä"
                )
                organizer_sig = f"{org_req['full_name']}{suffix}"
                organizer_email = (org_req.get("email") or "").strip() or None

        sender_label = organizer_sig or (
            user.get("nickname")
            or user.get("merchant_name")
            or user.get("organizer_name")
            or ("Viikinkitapahtumat" if is_admin else "Viestin lähettäjä")
        )

        # Variable substitution — event-level placeholders are filled once for all
        # recipients (event_title, event_date, event_location, organizer_name,
        # event_url, registration_url). {{nickname}} is substituted per-recipient
        # below; if it's missing from the text these calls are no-ops.
        effective_subject = substitute_event_vars(payload.subject, ev)
        effective_body = substitute_event_vars(payload.body, ev)

        # Look up nicknames for every consenter so per-recipient {{nickname}} can
        # be filled in both the email body and the inbox copy below.
        recipient_meta: dict[str, dict] = {}
        if effective_body.find("{{nickname}}") >= 0 or effective_subject.find("{{nickname}}") >= 0:
            nick_users = await db.users.find(
                {"id": {"$in": list(consenter_ids)}},
                {"_id": 0, "id": 1, "nickname": 1, "email": 1},
            ).to_list(5000)
            recipient_meta = {u["id"]: u for u in nick_users}

        sent_push = 0
        if push_user_ids:
            # Push notifications go out as ONE broadcast (Expo bulk send). We strip
            # {{nickname}} for push so the placeholder doesn't leak into the
            # notification; per-device personalisation would require an N-way send
            # which isn't worth the cost for a 200-char push body.
            push_subject = effective_subject.replace("{{nickname}}", "")
            push_body_text = effective_body.replace("{{nickname}}", "")
            push_body = f"{push_body_text[:140]}\n— {sender_label}"
            result = await push_send_to_users(
                db,
                push_user_ids,
                title=push_subject,
                body=push_body[:200],
                data={"event_id": payload.event_id, "sender": sender_label},
            )
            sent_push = result.get("sent", 0)

        sent_email = 0
        if email_recipients:
            # Reuse the generic Resend wrapper.
            from email_service import send_email as svc_send_email
            site = os.environ.get("PUBLIC_SITE_URL", "https://viikinkitapahtumat.fi")
            ev_title = ev.get("title_fi") or ev.get("title") or "Viikinkitapahtumat"
            signature_block = (
                f"<div style='margin-top:18px;font-size:13px;color:#C19C4D;'>— {html_escape(sender_label)}</div>"
            )
            if organizer_email:
                signature_block += (
                    f"<div style='font-size:12px;color:#E8E2D5;margin-top:4px;'>"
                    f"<a href='mailto:{html_escape(organizer_email)}' style='color:#C19C4D;'>"
                    f"{html_escape(organizer_email)}</a></div>"
                )
            # We need recipient -> id mapping so {{nickname}} substitution can use
            # the correct nickname per outgoing email. consenter_emails is id->email;
            # build the reverse view of email->user once here.
            email_to_id = {v: k for k, v in consenter_emails.items()}
            for em in email_recipients:
                try:
                    recip_id = email_to_id.get(em)
                    recip = recipient_meta.get(recip_id) if recip_id else None
                    rec_subject = substitute_recipient_vars(effective_subject, recip)
                    rec_body = substitute_recipient_vars(effective_body, recip)
                    html = (
                        f"<div style='font-family:system-ui,Arial,sans-serif;background:#0E0B09;color:#E8E2D5;padding:24px;'>"
                        f"<div style='max-width:560px;margin:auto;border:1px solid #352A23;padding:24px;'>"
                        f"<div style='font-size:11px;letter-spacing:1.6px;color:#C19C4D;text-transform:uppercase;'>{html_escape(ev_title)}</div>"
                        f"<h1 style='font-family:Georgia,serif;color:#E8E2D5;margin:8px 0 16px;'>{html_escape(rec_subject)}</h1>"
                        f"<div style='white-space:pre-wrap;line-height:1.55;color:#E8E2D5;'>{html_escape(rec_body)}</div>"
                        f"{signature_block}"
                        f"<hr style='border:none;border-top:1px solid #352A23;margin:24px 0;'>"
                        f"<div style='font-size:11px;color:#8E8276;'>Lähettäjä: {html_escape(sender_label)} · "
                        f"<a href='{site}/profile' style='color:#C19C4D;'>Hallinnoi viestiasetuksia</a></div>"
                        f"</div></div>"
                    )
                    await svc_send_email(em, rec_subject, html)
                    sent_email += 1
                except Exception:
                    logger.exception("Failed sending merchant/organizer email to %s", mask_email(em))

        return_payload = {
            "sent_push": sent_push,
            "sent_email": sent_email,
            "recipients": len(consenter_ids),
            # Diagnostic counters so the UI can explain why a channel produced 0
            # without leaking PII (no names/emails/tokens).
            "push_eligible": len(push_user_ids),
            "email_eligible": len(email_recipients),
        }
        # Audit trail — used by /admin/stats/messages AND for per-event quota.
        await db.message_log.insert_one(
            {
                "event_id": payload.event_id,
                "sender_id": user["id"],
                "channel": payload.channel,
                "subject": effective_subject[:200],
                "body_preview": effective_body[:200],
                "target_categories": target_categories,
                "sent_push": sent_push,
                "sent_email": sent_email,
                "recipients": len(consenter_ids),
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        )
        if not is_admin:
            return_payload["quota_used"] = quota_used + 1
            return_payload["quota_limit"] = quota_limit
            return_payload["quota_remaining"] = max(0, quota_limit - (quota_used + 1))

        # ── Inbox copies ─────────────────────────────────────────────────────
        # Insert one `user_messages` row per consenting recipient so they can
        # read the message in their in-app inbox even if they later disable
        # push/email per-RSVP. Sender keeps a single batch_id grouping for the
        # "Lähetetyt"-tab on the messages page.
        batch_id = await record_inbox_rows(
            db,
            event_id=payload.event_id,
            recipient_ids=consenter_ids,
            sender_id=user["id"],
            sender_label=sender_label,
            channel=payload.channel,
            subject=effective_subject,
            body=effective_body,
            target_categories=target_categories,
            recipient_meta=recipient_meta,
        )
        return_payload["batch_id"] = batch_id
        return return_payload

    # ---------------------------------------------------------------------
    # Messaging quota — admin GET/PATCH + per-user "remaining quota" probe
    # ---------------------------------------------------------------------
    @router.get(
        "/admin/messaging-quota",
        dependencies=[Depends(get_admin_or_moderator)],
    )
    async def admin_get_messaging_quota():
        cfg = await get_messaging_quota_config(db)
        return {
            "preset": cfg.preset,
            "custom_value": cfg.custom_value,
            "current_limit": quota_value(cfg),
            "presets": {"A": 10, "B": 20, "C": 30, "D_default": DEFAULT_CUSTOM_QUOTA},
        }

    @router.patch(
        "/admin/messaging-quota",
        dependencies=[Depends(get_admin_or_moderator)],
    )
    async def admin_update_messaging_quota(payload: MessagingQuotaUpdate):
        cfg = await get_messaging_quota_config(db)
        new_custom = (
            max(1, int(payload.custom_value))
            if payload.custom_value is not None
            else cfg.custom_value
        )
        new_doc = {
            "_id": "messaging_quota",
            "preset": payload.preset,
            "custom_value": new_custom,
        }
        await db.system_config.update_one(
            {"_id": "messaging_quota"}, {"$set": new_doc}, upsert=True
        )
        fresh = MessagingQuotaConfig(preset=payload.preset, custom_value=new_custom)
        return {
            "preset": fresh.preset,
            "custom_value": fresh.custom_value,
            "current_limit": quota_value(fresh),
        }

    @router.get("/messages/quota/{event_id}")
    async def get_event_quota_for_user(
        event_id: str, user: dict = Depends(get_current_user)
    ):
        """Return the messaging quota state for the current user on a single event.
        Admin gets `unlimited=True`."""
        if user.get("role") == "admin":
            return {"unlimited": True, "used": 0, "limit": 0, "remaining": -1}
        cfg = await get_messaging_quota_config(db)
        limit = quota_value(cfg)
        used = await db.message_log.count_documents(
            {"sender_id": user["id"], "event_id": event_id}
        )
        return {
            "unlimited": False,
            "used": used,
            "limit": limit,
            "remaining": max(0, limit - used),
        }

    # ---------------------------------------------------------------------
    # In-app inbox / sent history
    # ---------------------------------------------------------------------
    @router.get("/messages/inbox")
    async def messages_inbox_overview(user: dict = Depends(get_current_user)):
        """List events the current user has received messages for, with unread +
        total counts. Soft-deleted (per-recipient) rows are excluded."""
        pipeline = [
            {"$match": {"recipient_id": user["id"], "deleted_by_recipient": False}},
            {
                "$group": {
                    "_id": "$event_id",
                    "total": {"$sum": 1},
                    "unread": {
                        "$sum": {"$cond": [{"$eq": ["$read_at", None]}, 1, 0]}
                    },
                    "last_message_at": {"$max": "$created_at"},
                }
            },
            {"$sort": {"last_message_at": -1}},
        ]
        rows = await db.user_messages.aggregate(pipeline).to_list(1000)
        events = await _enrich_events_dict(db, [r["_id"] for r in rows])
        out = []
        for r in rows:
            ev = events.get(r["_id"]) or {"id": r["_id"]}
            out.append(
                {
                    "event": ev,
                    "total": r["total"],
                    "unread": r["unread"],
                    "last_message_at": r["last_message_at"],
                }
            )
        return out

    @router.get("/messages/inbox/{event_id}")
    async def messages_inbox_for_event(
        event_id: str, user: dict = Depends(get_current_user)
    ):
        """List inbox messages for a single event, newest first. Excludes ones
        the recipient has soft-deleted."""
        rows = await db.user_messages.find(
            {
                "recipient_id": user["id"],
                "event_id": event_id,
                "deleted_by_recipient": False,
            },
            {"_id": 0, "deleted_by_sender": 0},
        ).sort("created_at", -1).to_list(500)
        return rows

    @router.get("/messages/sent")
    async def messages_sent_overview(user: dict = Depends(get_current_user)):
        """List events the current user has SENT messages for, grouped by event.
        Counts unique batches (one batch = one /messages/send call)."""
        pipeline = [
            {"$match": {"sender_id": user["id"], "deleted_by_sender": False}},
            {
                "$group": {
                    "_id": {"event_id": "$event_id", "batch_id": "$batch_id"},
                    "recipients": {"$sum": 1},
                    "created_at": {"$max": "$created_at"},
                }
            },
            {
                "$group": {
                    "_id": "$_id.event_id",
                    "batches": {"$sum": 1},
                    "last_sent_at": {"$max": "$created_at"},
                }
            },
            {"$sort": {"last_sent_at": -1}},
        ]
        rows = await db.user_messages.aggregate(pipeline).to_list(1000)
        events = await _enrich_events_dict(db, [r["_id"] for r in rows])
        out = []
        for r in rows:
            ev = events.get(r["_id"]) or {"id": r["_id"]}
            out.append(
                {
                    "event": ev,
                    "batches": r["batches"],
                    "last_sent_at": r["last_sent_at"],
                }
            )
        return out

    @router.get("/messages/sent/{event_id}")
    async def messages_sent_for_event(
        event_id: str, user: dict = Depends(get_current_user)
    ):
        """List the user's sent batches for an event (one row per batch with
        aggregate recipient count + a sample row to read body/subject)."""
        pipeline = [
            {
                "$match": {
                    "sender_id": user["id"],
                    "event_id": event_id,
                    "deleted_by_sender": False,
                }
            },
            {"$sort": {"created_at": 1}},
            {
                "$group": {
                    "_id": "$batch_id",
                    "recipients": {"$sum": 1},
                    "subject": {"$first": "$subject"},
                    "body": {"$first": "$body"},
                    "channel": {"$first": "$channel"},
                    "created_at": {"$first": "$created_at"},
                    "target_categories": {"$first": "$target_categories"},
                    "any_id": {"$first": "$id"},
                }
            },
            {"$sort": {"created_at": -1}},
        ]
        rows = await db.user_messages.aggregate(pipeline).to_list(500)
        return [
            {
                "batch_id": r["_id"],
                "id": r["any_id"],
                "subject": r["subject"],
                "body": r["body"],
                "channel": r["channel"],
                "target_categories": r.get("target_categories") or [],
                "created_at": r["created_at"],
                "recipients": r["recipients"],
            }
            for r in rows
        ]

    @router.get("/messages/{message_id}")
    async def messages_read_one(
        message_id: str, user: dict = Depends(get_current_user)
    ):
        """Read a single message. Recipient access auto-sets `read_at` if unread.
        Sender may also fetch own outgoing copy (any one row from the batch)."""
        doc = await db.user_messages.find_one({"id": message_id}, {"_id": 0})
        if not doc:
            raise HTTPException(status_code=404, detail="Message not found")
        if user["id"] == doc.get("recipient_id"):
            if doc.get("deleted_by_recipient"):
                raise HTTPException(status_code=404, detail="Message not found")
            if not doc.get("read_at"):
                now_iso = datetime.now(timezone.utc).isoformat()
                await db.user_messages.update_one(
                    {"id": message_id}, {"$set": {"read_at": now_iso}}
                )
                doc["read_at"] = now_iso
        elif user["id"] == doc.get("sender_id"):
            if doc.get("deleted_by_sender"):
                raise HTTPException(status_code=404, detail="Message not found")
        else:
            raise HTTPException(status_code=403, detail="Forbidden")
        return doc

    @router.delete("/messages/{message_id}")
    async def messages_delete_one(
        message_id: str, user: dict = Depends(get_current_user)
    ):
        """Soft-delete: recipient hides from their inbox, sender hides batch from
        their sent list. Both flags can be set independently."""
        doc = await db.user_messages.find_one(
            {"id": message_id},
            {"_id": 0, "id": 1, "recipient_id": 1, "sender_id": 1, "batch_id": 1},
        )
        if not doc:
            raise HTTPException(status_code=404, detail="Message not found")
        if user["id"] == doc.get("recipient_id"):
            await db.user_messages.update_one(
                {"id": message_id}, {"$set": {"deleted_by_recipient": True}}
            )
            return {"deleted": True, "scope": "recipient"}
        if user["id"] == doc.get("sender_id"):
            # Sender deletes the whole batch from their sent view (idempotent).
            await db.user_messages.update_many(
                {"batch_id": doc["batch_id"], "sender_id": user["id"]},
                {"$set": {"deleted_by_sender": True}},
            )
            return {"deleted": True, "scope": "sender_batch"}
        raise HTTPException(status_code=403, detail="Forbidden")

    # ---------------------------------------------------------------------
    # Messageable events — mobile compose screen source list
    # ---------------------------------------------------------------------
    @router.get("/users/me/messageable-events")
    async def list_messageable_events(user: dict = Depends(get_current_user)):
        """Events where the current user can plausibly send a message: events
        they are RSVPd to (today onward) PLUS any events that started ≤ 14
        days ago (so post-event recap messages still go through). Admin gets
        all approved events in this same window. Result is enriched with the
        same fields EventOut returns."""
        today = datetime.now(timezone.utc).date()
        from_iso = (today - timedelta(days=14)).isoformat()
        is_admin = user.get("role") == "admin"
        user_types = set(user.get("user_types") or [])
        base_filter = {
            "status": "approved",
            "$or": [
                {"start_date": {"$gte": from_iso}},
                {"end_date": {"$gte": from_iso}},
            ],
        }
        if is_admin:
            events = await db.events.find(base_filter, {"_id": 0}).sort("start_date", 1).to_list(2000)
            return {"events": events}

        # Organizer-only users get events where they are an approved organizer.
        # Merchants get events they have RSVPed to.
        # Users with BOTH roles see the union.
        ids: set[str] = set()
        if "organizer" in user_types:
            org_events = await db.events.find(
                {"organizer_user_ids": user["id"]}, {"_id": 0, "id": 1}
            ).to_list(500)
            ids.update(e["id"] for e in org_events)
        if "merchant" in user_types or not user_types:
            rsvps = await db.event_attendees.find(
                {"user_id": user["id"]}, {"_id": 0, "event_id": 1}
            ).to_list(5000)
            ids.update(r["event_id"] for r in rsvps)
        if not ids:
            return {"events": []}
        f = dict(base_filter, id={"$in": list(ids)})
        events = await db.events.find(f, {"_id": 0}).sort("start_date", 1).to_list(2000)
        return {"events": events}

    # ---------------------------------------------------------------------
    # Push diagnostics (admin dashboard)
    # ---------------------------------------------------------------------
    @router.get(
        "/admin/push/health",
        dependencies=[Depends(get_admin_or_moderator)],
    )
    async def admin_push_health():
        """Diagnostic: do we have an Expo access token + how many users have a
        push token registered? Used by the admin dashboard to explain why a push
        send returned 0 recipients."""
        has_token = bool(os.environ.get("EXPO_ACCESS_TOKEN"))
        users_with_token = await db.users.count_documents(
            {"expo_push_tokens": {"$exists": True, "$ne": []}}
        )
        total_tokens = 0
        async for u in db.users.find(
            {"expo_push_tokens": {"$exists": True, "$ne": []}},
            {"_id": 0, "expo_push_tokens": 1},
        ):
            total_tokens += len(u.get("expo_push_tokens") or [])
        return {
            "expo_access_token_set": has_token,
            "users_with_push_token": users_with_token,
            "total_active_tokens": total_tokens,
        }

    @router.post(
        "/admin/push/test",
        dependencies=[Depends(get_admin_or_moderator)],
    )
    async def admin_push_test(admin: dict = Depends(get_admin_or_moderator)):
        """Send a test push to the calling admin's own registered device tokens.
        Returns delivery summary. If 0 recipients → admin has no token registered
        on any device (they need to install the mobile app and sign in)."""
        result = await push_send_to_users(
            db,
            [admin["id"]],
            title="Viikinkitapahtumat — testi",
            body="Tämä on testi push-notifikaatio. Jos näet sen, kaikki toimii oikein.",
            data={"test": True},
        )
        return result

    return router
