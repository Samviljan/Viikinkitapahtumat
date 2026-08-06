"""Application bootstrap — Mongo indexes, seed data, admin user seeding,
APScheduler jobs, and clean shutdown. Extracted from server.py so the
main module stays focused on route wiring.

Usage from server.py::

    from bootstrap import run_startup, run_shutdown

    @app.on_event("startup")
    async def _startup():
        global scheduler
        scheduler = await run_startup(
            db,
            hash_password=hash_password,
            verify_password=verify_password,
            run_daily_event_reminders=_run_daily_event_reminders,
        )

    @app.on_event("shutdown")
    async def _shutdown():
        await run_shutdown(client, scheduler)
"""
from __future__ import annotations

import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Awaitable, Callable, Optional

import pytz
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from email_service import (
    mask_email,
    send_event_reminders as svc_send_event_reminders,
    send_monthly_digest as svc_send_monthly_digest,
    send_weekly_admin_report as svc_send_weekly_admin_report,
)
from translation_service import sweep_missing_translations

logger = logging.getLogger(__name__)


# =============================================================================
# Mongo indexes — one place to declare every index the app needs. Runs on
# every boot; Mongo skips indexes that already exist so this is idempotent
# and cheap.
# =============================================================================
async def _create_core_indexes(db) -> None:
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.events.create_index("id", unique=True)
    await db.events.create_index("status")
    await db.events.create_index("start_date")
    await db.newsletter_subscribers.create_index("email", unique=True)
    await db.newsletter_subscribers.create_index("unsubscribe_token")
    await db.event_reminders.create_index(
        [("event_id", 1), ("email", 1)], unique=True
    )
    await db.event_reminders.create_index("unsubscribe_token")
    await db.event_reminders.create_index("status")
    await db.user_messages.create_index([("recipient_id", 1), ("event_id", 1)])
    await db.user_messages.create_index([("sender_id", 1), ("event_id", 1)])
    await db.user_messages.create_index("batch_id")
    await db.user_messages.create_index("id", unique=True)
    await db.merchant_card_requests.create_index("user_id")
    await db.merchant_card_requests.create_index("status")
    await db.merchant_card_requests.create_index("id", unique=True)
    await db.event_organizer_requests.create_index(
        [("user_id", 1), ("event_id", 1)]
    )
    await db.event_organizer_requests.create_index("event_id")
    await db.event_organizer_requests.create_index("status")
    await db.event_organizer_requests.create_index("id", unique=True)
    await db.email_templates.create_index("id", unique=True)
    await db.email_templates.create_index("name")


# =============================================================================
# Seed data
# =============================================================================
async def _seed_email_templates(db) -> None:
    """Insert every DEFAULT_EMAIL_TEMPLATES entry that isn't already in the
    DB. Idempotent — matches on `name`."""
    try:
        from seed_email_templates import DEFAULT_EMAIL_TEMPLATES
        seeded_now = 0
        for tpl in DEFAULT_EMAIL_TEMPLATES:
            if await db.email_templates.find_one({"name": tpl["name"]}, {"_id": 1}):
                continue
            now_iso = datetime.now(timezone.utc).isoformat()
            await db.email_templates.insert_one(
                {
                    "id": str(uuid.uuid4()),
                    "name": tpl["name"],
                    "subject": tpl["subject"],
                    "body": tpl["body"],
                    "icon": tpl.get("icon", "Mail"),
                    "color": tpl.get("color", "#C8492C"),
                    "created_at": now_iso,
                    "updated_at": now_iso,
                }
            )
            seeded_now += 1
        if seeded_now:
            logger.info("Seeded %d default email template(s)", seeded_now)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Default email template seed failed: %s", exc)


async def _seed_admin_user(
    db,
    hash_password: Callable[[str], str],
    verify_password: Callable[[str, str], bool],
) -> None:
    """Ensure the admin user exists with the current ADMIN_PASSWORD from env.
    Skips silently when ADMIN_PASSWORD isn't set (e.g. production redeploys
    that only need to keep the existing account)."""
    admin_email = os.environ.get(
        "ADMIN_EMAIL", "admin@viikinkitapahtumat.fi"
    ).lower()
    admin_password = os.environ.get("ADMIN_PASSWORD")
    if not admin_password:
        # Production deploys may not have the admin-seed password set — that
        # is fine, the admin user was seeded once already and we don't want
        # the startup event to crash the whole app over a missing seed var.
        logger.warning(
            "ADMIN_PASSWORD not set; skipping admin seeding. Set it in the "
            "deployment environment variables if you need to rotate the "
            "admin password on next boot."
        )
        return

    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        await db.users.insert_one(
            {
                "id": str(uuid.uuid4()),
                "email": admin_email,
                "password_hash": hash_password(admin_password),
                "name": "Admin",
                "role": "admin",
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        )
        logger.info("Admin user seeded: %s", mask_email(admin_email))
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one(
            {"email": admin_email},
            {"$set": {"password_hash": hash_password(admin_password)}},
        )


async def _seed_taxonomy_if_empty(db) -> None:
    """Auto-seed merchants / guilds taxonomy on first startup of an empty DB.
    Idempotent: only runs when EITHER collection is empty so manual edits
    aren't overwritten on subsequent restarts."""
    try:
        if await db.merchants.estimated_document_count() == 0:
            from scripts.seed_taxonomy import seed_taxonomy
            res = await seed_taxonomy(db)
            logger.info("Auto-seeded merchants/guilds: %s", res)
        elif await db.guilds.estimated_document_count() == 0:
            from scripts.seed_taxonomy import seed_taxonomy
            res = await seed_taxonomy(db)
            logger.info(
                "Auto-seeded merchants/guilds (guilds were empty): %s", res
            )
    except Exception as e:  # noqa: BLE001
        logger.exception("Taxonomy auto-seed failed: %s", e)


# =============================================================================
# Scheduled job wrappers — each catches its own exception so a single failure
# doesn't stop the scheduler from firing the next tick.
# =============================================================================
def _wrap_scheduled_monthly_digest(db):
    async def _job():
        try:
            result = await svc_send_monthly_digest(db, days=60)
            logger.info("Monthly digest sent: %s", result)
        except Exception as e:  # noqa: BLE001
            logger.exception("Monthly digest failed: %s", e)
    return _job


def _wrap_scheduled_weekly_admin_report(db):
    async def _job():
        try:
            result = await svc_send_weekly_admin_report(db)
            logger.info("Weekly admin report sent: %s", result)
        except Exception as e:  # noqa: BLE001
            logger.exception("Weekly admin report failed: %s", e)
    return _job


def _wrap_scheduled_event_reminders(db):
    async def _job():
        try:
            result = await svc_send_event_reminders(db, days_ahead=7)
            logger.info("Event reminders sent: %s", result)
        except Exception as e:  # noqa: BLE001
            logger.exception("Event reminders failed: %s", e)
    return _job


def _wrap_scheduled_prod_events_sync():
    async def _job():
        """Refresh preview/test DB events from production twice a day."""
        try:
            from scripts.sync_prod_events import main as sync_main
            await sync_main()
            logger.info("Prod → preview events sync completed")
        except Exception as e:  # noqa: BLE001
            logger.exception("Prod → preview events sync failed: %s", e)
    return _job


def _wrap_scheduled_translation_sweep(db):
    async def _job():
        """Background job: every 6h, fill missing language columns on all
        events. Cheap projection check first → only spends LLM tokens on events
        that actually have empty fields."""
        try:
            summary = await sweep_missing_translations(db, max_events=50)
            logger.info("translation sweep summary: %s", summary)
        except Exception as e:  # noqa: BLE001
            logger.exception("Translation sweep failed: %s", e)
    return _job


def _build_scheduler(
    db,
    run_daily_event_reminders: Callable[..., Awaitable[Any]],
) -> AsyncIOScheduler:
    """Wire every scheduled job we ship. Called from run_startup() once
    per boot. Import the two merchants-module sweep jobs lazily so this
    file has no import-time coupling to routes/merchants.py."""
    from routes.merchants import merchant_card_expiry_sweep, organizer_sync_job

    scheduler = AsyncIOScheduler(timezone=pytz.timezone("Europe/Helsinki"))
    scheduler.add_job(
        _wrap_scheduled_monthly_digest(db),
        CronTrigger(day=1, hour=9, minute=0),
        id="monthly_digest",
        replace_existing=True,
    )
    scheduler.add_job(
        _wrap_scheduled_weekly_admin_report(db),
        CronTrigger(day_of_week="mon", hour=9, minute=0),
        id="weekly_admin_report",
        replace_existing=True,
    )
    scheduler.add_job(
        _wrap_scheduled_event_reminders(db),
        CronTrigger(hour=9, minute=0),
        id="event_reminders_daily",
        replace_existing=True,
    )
    # NEW: Weekly push + email reminder for users who RSVPed to upcoming
    # events with notify_push / notify_email = true. Runs once per day at
    # 09:15 Helsinki, but only fires for events that start EXACTLY 7 days
    # from today, and uses per-event dedup so each event triggers exactly
    # one reminder per channel — ever.
    scheduler.add_job(
        run_daily_event_reminders,
        CronTrigger(hour=9, minute=15),
        id="rsvp_reminders_daily",
        replace_existing=True,
    )
    # Translation sweep — every 6 hours, fill any missing language columns
    # (title_da, title_de, title_pl, title_et, description_*…) using Claude
    # Haiku via emergentintegrations. Caps at 50 events/run to keep LLM
    # cost bounded — overflow is processed in subsequent runs.
    scheduler.add_job(
        _wrap_scheduled_translation_sweep(db),
        CronTrigger(hour="*/6", minute=20),
        id="translation_sweep",
        replace_existing=True,
    )
    # Sync events from production into preview/test DB twice daily — 06:00 + 18:00 Europe/Helsinki.
    # Only enabled when the env flag opts in (the production deployment must NOT pull from itself).
    if os.environ.get("PROD_SYNC_ENABLED", "true").lower() in ("1", "true", "yes"):
        scheduler.add_job(
            _wrap_scheduled_prod_events_sync(),
            CronTrigger(hour="6,18", minute=0),
            id="prod_events_sync",
            replace_existing=True,
        )
    # Merchant card subscription expiry — daily at 03:30 Europe/Helsinki.
    # Auto-disables cards whose `merchant_until` is in the past so expired
    # merchants drop off the public Shops page without manual intervention.
    scheduler.add_job(
        merchant_card_expiry_sweep,
        CronTrigger(hour=3, minute=30),
        id="merchant_card_expiry",
        replace_existing=True,
    )
    # Organizer sync — daily at 03:45 Europe/Helsinki. Idempotent self-heal
    # to ensure every approved organizer request is reflected in the
    # corresponding event's organizer_user_ids. Catches any orphan rows
    # left by failed admin add/approve requests.
    scheduler.add_job(
        organizer_sync_job,
        CronTrigger(hour=3, minute=45),
        id="organizer_sync_daily",
        replace_existing=True,
    )
    return scheduler


# =============================================================================
# Public entry points
# =============================================================================
async def run_startup(
    db,
    *,
    hash_password: Callable[[str], str],
    verify_password: Callable[[str, str], bool],
    run_daily_event_reminders: Callable[..., Awaitable[Any]],
) -> AsyncIOScheduler:
    """Complete boot sequence: indexes → seed email templates → articles module
    (indexes + seed articles + heal + translation sweep) → admin user →
    taxonomy → APScheduler. Returns the scheduler so shutdown can stop it."""
    await _create_core_indexes(db)
    await _seed_email_templates(db)

    # Articles module: create indexes, seed articles, self-heal legacy image
    # URLs, and schedule background translation sweep. Extracted to
    # routes/articles.py — see init_articles() for the full sequence.
    try:
        from routes.articles import init_articles
        await init_articles(db)
    except Exception as exc:  # noqa: BLE001
        logger.warning("init_articles failed (non-fatal): %s", exc)

    await _seed_admin_user(db, hash_password, verify_password)
    await _seed_taxonomy_if_empty(db)

    scheduler = _build_scheduler(db, run_daily_event_reminders)
    scheduler.start()
    logger.info(
        "APScheduler started — monthly digest 1st@09:00, weekly admin report Mon@09:00, "
        "event reminders daily@09:00, translation sweep every 6h, prod events sync 06:00+18:00, "
        "merchant card expiry daily@03:30, organizer sync daily@03:45, Europe/Helsinki"
    )
    return scheduler


async def run_shutdown(client, scheduler: Optional[AsyncIOScheduler]) -> None:
    """Cleanly stop the scheduler and close the Mongo client. Safe to call
    even if `scheduler` never started (None-guarded)."""
    if scheduler is not None:
        scheduler.shutdown(wait=False)
    client.close()
