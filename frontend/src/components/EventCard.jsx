import React from "react";
import { Link } from "react-router-dom";
import { Calendar, MapPin, ArrowUpRight, Hourglass, Clock, FileText, ClipboardList } from "lucide-react";
import { useI18n, pickLocalized } from "@/lib/i18n";
import RemindMeButton from "@/components/RemindMeButton";
import { flagFor } from "@/lib/countries";
import { resolveImageUrl } from "@/lib/images";

export default function EventCard({ event, compact = false }) {
  const { lang, t } = useI18n();
  const title = pickLocalized(event, lang, "title");
  const desc = pickLocalized(event, lang, "description");

  const dateLabel = formatDateRange(event.start_date, event.end_date, lang);
  const categoryLabel = t(`cats.${event.category}`);
  const flag = flagFor(event.country || "FI");
  const { daysUntil, durationDays } = computeEventTiming(event.start_date, event.end_date);

  return (
    <Link
      to={`/events/${event.id}`}
      data-testid={`event-card-${event.id}`}
      className="group relative block carved-card rounded-sm overflow-hidden hover:border-viking-gold/40 transition-colors"
    >
      {!compact && event.image_url ? (
        <div className="relative h-44 overflow-hidden">
          <img
            src={resolveImageUrl(event.image_url)}
            alt=""
            loading="lazy"
            className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-700"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-viking-surface via-viking-surface/40 to-transparent" />
          {/* Single-color category bar with country flag */}
          <div
            data-testid={`event-card-cat-${event.id}`}
            className="absolute top-0 left-0 right-0 bg-viking-ember/95 text-viking-bone font-rune uppercase tracking-[0.2em] text-[10px] sm:text-[11px] px-4 py-2 flex items-center justify-center gap-2 border-b border-viking-gold/40 ember-glow shadow-[0_2px_0_rgba(0,0,0,0.35)]"
          >
            <span aria-hidden="true" className="text-base leading-none">{flag}</span>
            <span>{categoryLabel}</span>
          </div>
          {/* Action icons (remind) bottom-right of image */}
          <div className="absolute bottom-3 right-3 flex items-center gap-2">
            <RemindMeButton eventId={event.id} variant="compact" />
          </div>
        </div>
      ) : null}

      <div className="p-5 sm:p-6 space-y-3">
        {(compact || !event.image_url) && (
          <div
            data-testid={`event-card-cat-${event.id}`}
            className="-mx-5 sm:-mx-6 -mt-5 sm:-mt-6 mb-1 bg-viking-ember/95 text-viking-bone font-rune uppercase tracking-[0.2em] text-[10px] sm:text-[11px] px-5 sm:px-6 py-2 flex items-center justify-center gap-2 border-b border-viking-gold/40 ember-glow"
          >
            <span aria-hidden="true" className="text-base leading-none">{flag}</span>
            <span>{categoryLabel}</span>
          </div>
        )}
        {/* Action icons (remind) — when there's no header image we render
            inside the body card so the user can still get reminders even
            when the organizer hasn't uploaded a picture. With an image,
            these render on the image overlay above. */}
        {!compact && !event.image_url ? (
          <div className="flex items-center gap-2 absolute top-2 right-3 z-10">
            <RemindMeButton eventId={event.id} variant="compact" />
          </div>
        ) : null}
        <h3 className="font-serif text-2xl text-viking-bone leading-tight group-hover:text-viking-gold transition-colors">
          {title}
        </h3>
        {!compact && desc ? (
          <p className="text-sm text-viking-stone line-clamp-2 leading-relaxed">{desc}</p>
        ) : null}

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-2 text-xs text-viking-stone border-t border-viking-edge/60">
          <span className="flex items-center gap-1.5 mt-2">
            <Calendar size={13} className="text-viking-gold" />
            {dateLabel}
          </span>
          <span className="flex items-center gap-1.5 mt-2">
            <MapPin size={13} className="text-viking-gold" />
            {event.location}
          </span>
          {event.audience && (
            <span className="mt-2 font-rune text-[10px] text-viking-gold/80">
              {event.audience}
            </span>
          )}
          {event.fight_style && (
            <span className="mt-2 font-rune text-[10px] text-viking-ember/80">
              {event.fight_style}
            </span>
          )}
        </div>

        {/* Countdown + duration row */}
        {(daysUntil !== null || durationDays !== null) && (
          <div
            data-testid={`event-card-countdown-${event.id}`}
            className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-[11px] text-viking-bone"
          >
            {daysUntil !== null && (
              <span className="inline-flex items-center gap-1.5">
                <Hourglass size={12} className="text-viking-ember" />
                <span className="font-rune tracking-[0.15em] uppercase text-viking-stone">
                  {t("events.countdown_label")}
                </span>
                <span className="font-rune tracking-[0.15em] uppercase text-viking-ember">
                  {countdownLabel(daysUntil, t)}
                </span>
              </span>
            )}
            {durationDays !== null && durationDays > 1 && (
              <span className="inline-flex items-center gap-1.5 text-viking-stone">
                <Clock size={12} className="text-viking-gold" />
                <span className="font-rune tracking-[0.15em] uppercase">
                  {durationLabel(durationDays, t)}
                </span>
              </span>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1">
          {event.program_pdf_url && (
            <a
              data-testid={`event-program-link-${event.id}`}
              href={
                event.program_pdf_url.startsWith("http")
                  ? event.program_pdf_url
                  : `${process.env.REACT_APP_BACKEND_URL || ""}${event.program_pdf_url}`
              }
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1.5 text-xs font-rune tracking-[0.15em] uppercase text-viking-gold hover:text-viking-bone underline-offset-4 hover:underline"
            >
              <FileText size={12} /> {t("events.program_pdf")}
            </a>
          )}
          {event.registration_url && (
            <a
              data-testid={`event-registration-link-${event.id}`}
              href={event.registration_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1.5 text-xs font-rune tracking-[0.15em] uppercase text-viking-ember hover:text-viking-bone underline-offset-4 hover:underline"
            >
              <ClipboardList size={12} /> {t("events.registration_form")}
            </a>
          )}
          <div className="flex items-center gap-2 text-xs font-rune text-viking-ember opacity-0 group-hover:opacity-100 transition-opacity ml-auto">
            {t("events.view")}
            <ArrowUpRight size={12} />
          </div>
        </div>
      </div>
    </Link>
  );
}

/**
 * Returns:
 * - daysUntil: integer days until the event STARTS (0 = today, negative = ongoing/past)
 *   We expose 0 if today is between start and end (event is happening now).
 *   Returns null if the event has already ended.
 * - durationDays: total whole days the event spans (1 for single-day, 2 for two-day, …)
 */
export function computeEventTiming(start, end) {
  const s = parseDate(start);
  if (!s) return { daysUntil: null, durationDays: null };
  const e = parseDate(end) || s;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  s.setHours(0, 0, 0, 0);
  e.setHours(0, 0, 0, 0);
  const ms = 1000 * 60 * 60 * 24;
  const durationDays = Math.round((e - s) / ms) + 1;

  if (today > e) return { daysUntil: null, durationDays };
  if (today >= s && today <= e) return { daysUntil: 0, durationDays };
  const daysUntil = Math.round((s - today) / ms);
  return { daysUntil, durationDays };
}

function countdownLabel(days, t) {
  if (days === 0) return t("events.happening_now");
  if (days === 1) return t("events.in_one_day");
  return t("events.in_n_days").replace("{n}", String(days));
}

function durationLabel(days, t) {
  if (days === 1) return t("events.duration_one");
  return t("events.duration_n").replace("{n}", String(days));
}

export function formatDateRange(start, end, lang) {
  const s = parseDate(start);
  if (!s) return "";
  const e = parseDate(end) || s;

  const sameDay =
    s.getFullYear() === e.getFullYear() &&
    s.getMonth() === e.getMonth() &&
    s.getDate() === e.getDate();
  const sameMonth =
    s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth();
  const sameYear = s.getFullYear() === e.getFullYear();

  if (lang === "fi") {
    // Finnish numeric: 5.6.2026, 5.–7.6.2026, 5.6.–7.7.2026, 5.6.2026 – 7.7.2027
    if (sameDay) return `${s.getDate()}.${s.getMonth() + 1}.${s.getFullYear()}`;
    if (sameMonth)
      return `${s.getDate()}.–${e.getDate()}.${e.getMonth() + 1}.${e.getFullYear()}`;
    if (sameYear)
      return `${s.getDate()}.${s.getMonth() + 1}.–${e.getDate()}.${e.getMonth() + 1}.${e.getFullYear()}`;
    return `${s.getDate()}.${s.getMonth() + 1}.${s.getFullYear()} – ${e.getDate()}.${e.getMonth() + 1}.${e.getFullYear()}`;
  }

  // English / Swedish: long month name, single year/month when shared
  const locale = lang === "sv" ? "sv-SE" : "en-GB";
  const longMonth = (d) => d.toLocaleDateString(locale, { month: "long" });
  const sDay = s.getDate();
  const eDay = e.getDate();
  const sMonth = longMonth(s);
  const eMonth = longMonth(e);
  const sYear = s.getFullYear();
  const eYear = e.getFullYear();

  if (sameDay) return `${sDay} ${sMonth} ${sYear}`;
  if (sameMonth) return `${sDay}–${eDay} ${eMonth} ${eYear}`;
  if (sameYear) return `${sDay} ${sMonth} – ${eDay} ${eMonth} ${eYear}`;
  return `${sDay} ${sMonth} ${sYear} – ${eDay} ${eMonth} ${eYear}`;
}

/**
 * Parse a `YYYY-MM-DD` event date string as a LOCAL Date (not UTC), avoiding
 * the timezone drift that `new Date("YYYY-MM-DD")` introduces in non-UTC zones.
 */
function parseDate(s) {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}
