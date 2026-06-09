import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "@/lib/api";
import { useI18n, pickLocalized } from "@/lib/i18n";
import { useDocumentSeo } from "@/lib/seo";
import { Calendar, MapPin, User, Mail, Globe, ChevronLeft, Hourglass, Clock, FileText, Map, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDateRange, computeEventTiming } from "@/components/EventCard";
import RemindMeButton from "@/components/RemindMeButton";
import AttendButton from "@/components/AttendButton";
import EventStats from "@/components/EventStats";
import EventMerchants from "@/components/EventMerchants";
import EventOrganizers from "@/components/EventOrganizers";
import EventOrganizerRequestCTA from "@/components/EventOrganizerRequestCTA";
import { flagFor } from "@/lib/countries";
import { resolveImageUrl } from "@/lib/images";

export default function EventDetail() {
  const { id } = useParams();
  const { t, lang } = useI18n();
  const [event, setEvent] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .get(`/events/${id}`)
      .then((r) => setEvent(r.data))
      .catch(() => setError("not_found"));
  }, [id]);

  // Localized strings — when event hasn't loaded yet these are empty strings.
  // Computed BEFORE early returns so the hook order is stable.
  const title = event ? pickLocalized(event, lang, "title") : "";
  const desc = event ? pickLocalized(event, lang, "description") : "";

  // SEO: per-event title/description/canonical/og:image. Helps Google index
  // each event with a localized title and an image card preview when shared.
  // MUST be called every render (not conditionally) — react-hooks/rules-of-hooks.
  // og:image — always point at the server-rendered OG card endpoint (even
  // when the event has no uploaded image; the endpoint composes a fallback).
  // This produces a branded 1200×630 preview on social shares (Facebook, X,
  // WhatsApp, LinkedIn, Slack, Telegram) — much better engagement than the
  // raw uploaded image which may be any dimensions.
  const ogBase = process.env.REACT_APP_BACKEND_URL || "";
  const ogImage = event?.id ? `${ogBase}/api/og/events/${event.id}.jpg` : undefined;

  useDocumentSeo({
    title: title ? `${title} — Viikinkitapahtumat` : undefined,
    description: desc
      ? desc.slice(0, 200).replace(/\s+/g, " ").trim()
      : undefined,
    canonicalPath: event ? `/events/${event.id}` : undefined,
    image: ogImage,
    keywords: [
      "viikinkitapahtumat",
      "viikingit",
      "vikings",
      "historianelävöitys",
      "reenactment",
      "keskiaika",
      "living history events",
      event?.location || "",
      event?.category || "",
    ].filter(Boolean),
    type: "event",
  });

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h1 className="font-serif text-3xl text-viking-bone mb-4">404</h1>
        <Link
          to="/events"
          className="inline-flex items-center gap-2 text-viking-gold font-rune text-xs"
          data-testid="back-link"
        >
          <ChevronLeft size={14} /> {t("events.back")}
        </Link>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20">
        <div className="h-72 bg-viking-surface animate-pulse rounded-sm" />
      </div>
    );
  }

  const flag = flagFor(event.country || "FI");
  const { daysUntil, durationDays } = computeEventTiming(event.start_date, event.end_date);
  const gallery = Array.isArray(event.gallery) ? event.gallery.filter(Boolean) : [];

  return (
    <article className="pb-20" data-testid="event-detail">
      {event.image_url ? (
        <div className="relative h-[42vh] min-h-[280px] w-full overflow-hidden">
          <img src={resolveImageUrl(event.image_url)} alt="" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-viking-bg/40 via-viking-bg/60 to-viking-bg" />
        </div>
      ) : (
        <div className="h-32 bg-viking-surface/60" />
      )}

      <div className="mx-auto max-w-4xl px-4 sm:px-8 -mt-20 relative z-10">
        <Link
          to="/events"
          data-testid="back-link"
          className="inline-flex items-center gap-2 text-viking-stone hover:text-viking-gold font-rune text-[11px] mb-5"
        >
          <ChevronLeft size={14} /> {t("events.back")}
        </Link>

        <div className="carved-card rounded-sm p-7 sm:p-12">
          <div className="flex items-center gap-3 mb-4">
            <span aria-hidden="true" className="text-2xl leading-none">{flag}</span>
            <span className="text-overline text-viking-gold">{t(`cats.${event.category}`)}</span>
            <span className="text-overline text-viking-stone">·</span>
            <span className="text-overline text-viking-stone">{t(`countries.${event.country || "FI"}`)}</span>
          </div>
          <h1 className="font-serif text-4xl sm:text-5xl text-viking-bone leading-tight mb-6">{title}</h1>

          {/* Countdown / duration banner */}
          {(daysUntil !== null || (durationDays && durationDays > 1)) && (
            <div className="mb-6" data-testid="event-detail-countdown">
              {daysUntil !== null && (
                <div className="text-overline text-viking-stone mb-2">
                  {t("events.countdown_label")}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                {daysUntil !== null && (
                  <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-sm border border-viking-ember/50 bg-viking-ember/10 text-viking-ember font-rune text-[11px] tracking-[0.15em] uppercase">
                    <Hourglass size={13} />
                    {countdownLabelDetail(daysUntil, t)}
                  </span>
                )}
                {durationDays && durationDays > 1 && (
                  <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-sm border border-viking-gold/50 bg-viking-gold/5 text-viking-gold font-rune text-[11px] tracking-[0.15em] uppercase">
                    <Clock size={13} />
                    {durationLabelDetail(durationDays, t)}
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8 py-6 border-y border-viking-edge mb-8">
            <DetailRow icon={Calendar} label={formatDateRange(event.start_date, event.end_date, lang)} />
            <DetailRow icon={MapPin} label={event.location} />
            <DetailRow icon={User} label={`${t("events.organizer")}: ${event.organizer}`} />
            {event.organizer_email && <DetailRow icon={Mail} label={event.organizer_email} />}
            {event.audience && (
              <DetailRow icon={User} label={`${t("audience_label")}: ${event.audience}`} />
            )}
            {event.fight_style && (
              <DetailRow icon={User} label={`${t("fight_label")}: ${event.fight_style}`} />
            )}
          </div>

          {/* Action row: Open in Maps + Open event website (if any). The maps
              link uses Google Maps' query API which works on every platform
              (desktop browsers, iOS, Android) and falls back to the user's
              default map app when set. */}
          {(event.location || event.link || event.registration_url) && (
            <div className="flex flex-wrap gap-3 mb-8" data-testid="event-detail-actions">
              {event.location && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="event-open-map"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-sm border border-viking-gold text-viking-gold hover:bg-viking-gold/10 transition-colors font-rune text-[11px] tracking-[0.15em] uppercase"
                >
                  <Map size={14} />
                  {t("events.open_in_maps") || "Avaa kartalla"}
                </a>
              )}
              {event.link && (
                <a
                  href={event.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="event-open-website"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-sm bg-viking-ember text-viking-bone hover:bg-viking-ember/90 transition-colors font-rune text-[11px] tracking-[0.15em] uppercase"
                >
                  <Globe size={14} />
                  {t("events.open_website") || "Avaa verkkosivu"}
                </a>
              )}
              {event.registration_url && (
                <a
                  href={event.registration_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="event-open-registration"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-sm bg-viking-gold text-viking-black hover:bg-viking-gold/90 transition-colors font-rune text-[11px] tracking-[0.15em] uppercase ember-glow font-semibold"
                >
                  <ClipboardList size={14} />
                  {t("events.registration_form")}
                </a>
              )}
            </div>
          )}

          <p className="font-serif text-lg text-viking-bone leading-relaxed whitespace-pre-line">{desc}</p>

          {gallery.length > 0 && (
            <div className="mt-10" data-testid="event-detail-gallery">
              <div className="text-overline mb-4 text-viking-stone">{t("events.gallery")}</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {gallery.map((url, idx) => (
                  <a
                    key={`${url}-${idx}`}
                    href={resolveImageUrl(url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid={`event-detail-gallery-item-${idx}`}
                    className="group block aspect-[4/3] overflow-hidden rounded-sm border border-viking-edge hover:border-viking-gold/60 transition-colors"
                  >
                    <img
                      src={resolveImageUrl(url)}
                      alt=""
                      loading="lazy"
                      className="w-full h-full object-cover opacity-90 group-hover:opacity-100 group-hover:scale-105 transition-all duration-700"
                    />
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className="mt-10 flex flex-wrap items-center gap-3">
            {event.program_pdf_url && (
              <a
                href={
                  event.program_pdf_url.startsWith("http")
                    ? event.program_pdf_url
                    : `${process.env.REACT_APP_BACKEND_URL || ""}${event.program_pdf_url}`
                }
                target="_blank"
                rel="noopener noreferrer"
                data-testid="event-program-link"
              >
                <Button
                  variant="outline"
                  className="border-viking-gold/60 text-viking-gold hover:bg-viking-gold/10 hover:text-viking-gold rounded-sm font-rune text-xs"
                >
                  <FileText size={14} className="mr-2" />
                  {t("events.program_pdf")}
                </Button>
              </a>
            )}
            <RemindMeButton eventId={event.id} />
          </div>
          <div className="mt-6 pt-6 border-t border-viking-edge">
            <AttendButton eventId={event.id} />
            <EventStats eventId={event.id} />
            <div className="mt-4">
              <EventOrganizerRequestCTA
                eventId={event.id}
                organizerIds={event.organizer_user_ids || []}
              />
            </div>
          </div>
          <EventOrganizers eventId={event.id} />
          <EventMerchants eventId={event.id} />
        </div>
      </div>
    </article>
  );
}

function DetailRow({ icon: Icon, label }) {
  return (
    <div className="flex items-start gap-3 text-sm text-viking-bone">
      <Icon size={16} className="mt-0.5 text-viking-gold flex-shrink-0" />
      <span>{label}</span>
    </div>
  );
}

function countdownLabelDetail(days, t) {
  if (days === 0) return t("events.happening_now");
  if (days === 1) return t("events.in_one_day");
  return t("events.in_n_days").replace("{n}", String(days));
}

function durationLabelDetail(days, t) {
  if (days === 1) return t("events.duration_one");
  return t("events.duration_n").replace("{n}", String(days));
}
