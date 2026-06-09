/**
 * Paid-feature page: organizers / merchants compose a message and send it
 * to the attendees of one of their events.
 *
 * Backend gates the request on `paid_messaging_enabled`. We hide the page
 * if the user doesn't have the flag, but the server is the source of truth.
 *
 * Recipients are filtered server-side by:
 *   1. Attendance to the chosen event
 *   2. The user's marketing consent flag matching the sender's role
 *   3. Per-RSVP notify_push / notify_email toggle for each channel
 */
import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";
import * as Icons from "lucide-react";
import { Megaphone, AlertTriangle, Check, Mail, FileText, Save } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const fieldClass =
  "bg-viking-surface border-viking-edge rounded-sm text-viking-bone placeholder:text-viking-stone focus:border-viking-ember focus:ring-viking-ember";

const CHANNELS = ["both", "push", "email"];
const TARGET_CATEGORIES = ["reenactor", "fighter", "merchant", "organizer"];

function TemplateIcon({ name, color }) {
  const Comp = Icons[name] || Mail;
  return <Comp size={16} color={color || "#C19C4D"} />;
}

export default function SendMessage() {
  const { user, loading } = useAuth();
  const { t, lang } = useI18n();
  const [events, setEvents] = useState([]);
  const [eventId, setEventId] = useState("");
  const [channel, setChannel] = useState("both");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [targets, setTargets] = useState([]);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  // Templates (admin-curated). Loaded for any user with access; plain users
  // get an empty list. Tab toggles the templates browser inside the form card.
  const [tab, setTab] = useState("write"); // "write" | "templates"
  const [templates, setTemplates] = useState([]);

  // Load only events the user is RSVPed to (admins see ALL events because they
  // send site-wide). Backend further enforces this gate; we pre-filter for UX.
  useEffect(() => {
    if (!user) return;
    const isAdmin = user.role === "admin";
    const url = isAdmin ? "/events?limit=200" : "/users/me/attending";
    api
      .get(url)
      .then((r) => setEvents(r.data || []))
      .catch(() => setEvents([]));
  }, [user]);

  // Fetch template library — admin sees all, paid merchants/organizers also
  // get the library (backend returns [] for everyone else so the UI degrades
  // gracefully without a 403).
  useEffect(() => {
    if (!user) return;
    api
      .get("/email-templates")
      .then((r) => setTemplates(Array.isArray(r.data) ? r.data : []))
      .catch(() => setTemplates([]));
  }, [user]);

  function applyTemplate(tpl) {
    setSubject(tpl.subject || "");
    setBody(tpl.body || "");
    setTab("write");
    toast.success(tpl.name);
  }

  async function saveCurrentAsTemplate() {
    const name = window.prompt(t("admin.templates.name"));
    if (!name || !name.trim()) return;
    try {
      await api.post("/admin/email-templates", {
        name: name.trim(),
        subject: subject.trim() || name.trim(),
        body: body || "",
      });
      const { data } = await api.get("/email-templates");
      setTemplates(Array.isArray(data) ? data : []);
      toast.success(t("admin.action_ok"));
    } catch (err) {
      const status = err.response?.status;
      if (status === 403 || status === 401) {
        toast.error(t("admin.action_error"));
      } else {
        toast.error(t("account.error_generic"));
      }
    }
  }

  if (loading) return null;
  if (!user || user === false || !user.role) {
    return <Navigate to="/login" replace state={{ from: "/messages" }} />;
  }
  // Hide the page for users without the paid flag or without merchant/organizer role.
  // Admins always have access (site-wide messaging).
  const types = user.user_types || [];
  const isAdmin = user.role === "admin";
  const allowed =
    isAdmin ||
    (!!user.paid_messaging_enabled &&
      (types.includes("merchant") || types.includes("organizer")));
  if (!allowed) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center" data-testid="messaging-blocked">
        <AlertTriangle size={28} className="text-viking-gold mx-auto mb-4" />
        <h1 className="font-serif text-2xl text-viking-bone mb-3">
          {t("messaging.blocked_title")}
        </h1>
        <p className="text-sm text-viking-stone leading-relaxed">
          {t("messaging.blocked_help")}
        </p>
      </div>
    );
  }

  async function send() {
    if (!eventId || !subject.trim() || !body.trim()) return;
    setSending(true);
    setResult(null);
    try {
      const { data } = await api.post("/messages/send", {
        event_id: eventId,
        channel,
        subject: subject.trim(),
        body: body.trim(),
        target_categories: targets,
      });
      setResult(data);
      toast.success(t("messaging.sent_toast"));
      setSubject("");
      setBody("");
    } catch (err) {
      const status = err.response?.status;
      const detail = err.response?.data?.detail;
      if (status === 403 && typeof detail === "string") {
        toast.error(detail);
      } else if (status === 402) {
        toast.error(t("messaging.blocked_title"));
      } else {
        toast.error(t("account.error_generic"));
      }
    } finally {
      setSending(false);
    }
  }

  function toggleTarget(c) {
    setTargets((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-12 sm:py-16">
      <div className="flex items-center gap-3 mb-8">
        <div className="h-12 w-12 rounded-sm border border-viking-gold/50 flex items-center justify-center text-viking-gold">
          <Megaphone size={20} />
        </div>
        <div>
          <div className="text-overline">{t("messaging.feature")}</div>
          <h1 className="font-serif text-2xl sm:text-3xl text-viking-bone">
            {t("messaging.title")}
          </h1>
        </div>
      </div>

      <p className="text-sm text-viking-stone leading-relaxed mb-8">
        {t("messaging.consent_help")}
      </p>

      <div className="carved-card rounded-sm p-6 space-y-5" data-testid="messaging-form">
        {/* Tabs: Write vs Templates */}
        <div className="flex gap-2 border-b border-viking-edge -mt-1 -mx-1 px-1 pb-3">
          <button
            type="button"
            data-testid="messaging-tab-write"
            onClick={() => setTab("write")}
            className={`px-3 py-1.5 rounded-sm text-[11px] font-rune tracking-[0.15em] uppercase border transition-colors ${
              tab === "write"
                ? "border-viking-gold text-viking-gold bg-viking-gold/10"
                : "border-viking-edge text-viking-stone hover:border-viking-gold/60"
            }`}
          >
            <Megaphone size={12} className="inline-block mr-1.5" />
            {t("messaging.title")}
          </button>
          <button
            type="button"
            data-testid="messaging-tab-templates"
            onClick={() => setTab("templates")}
            className={`px-3 py-1.5 rounded-sm text-[11px] font-rune tracking-[0.15em] uppercase border transition-colors ${
              tab === "templates"
                ? "border-viking-gold text-viking-gold bg-viking-gold/10"
                : "border-viking-edge text-viking-stone hover:border-viking-gold/60"
            }`}
          >
            <FileText size={12} className="inline-block mr-1.5" />
            {t("messaging.templates_tab")} ({templates.length})
          </button>
        </div>

        {tab === "templates" ? (
          <div data-testid="templates-tab-content" className="space-y-3">
            {templates.length === 0 ? (
              <p
                data-testid="templates-tab-empty"
                className="text-sm text-viking-stone italic py-4"
              >
                {t("messaging.templates_empty")}
              </p>
            ) : (
              <ul className="space-y-2">
                {templates.map((tpl) => (
                  <li
                    key={tpl.id}
                    data-testid={`tpl-row-${tpl.id}`}
                    className="flex items-center gap-3 p-3 rounded-sm border border-viking-edge bg-viking-surface hover:border-viking-gold/60 transition-colors"
                  >
                    <div
                      className="h-9 w-9 rounded-sm flex items-center justify-center shrink-0"
                      style={{
                        backgroundColor: `${tpl.color || "#C8492C"}22`,
                        border: `1px solid ${tpl.color || "#C8492C"}66`,
                      }}
                    >
                      <TemplateIcon name={tpl.icon} color={tpl.color || "#C19C4D"} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-viking-bone truncate">
                        {tpl.name}
                      </div>
                      <div className="text-[11px] text-viking-stone truncate">
                        {tpl.subject}
                      </div>
                    </div>
                    <Button
                      type="button"
                      onClick={() => applyTemplate(tpl)}
                      data-testid={`tpl-use-${tpl.id}`}
                      className="bg-viking-ember hover:bg-viking-emberHover text-viking-bone rounded-sm font-rune text-[10px] tracking-[0.15em] uppercase shrink-0"
                    >
                      {t("messaging.templates_load")}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            {isAdmin && (
              <div className="pt-2 border-t border-viking-edge">
                <Button
                  type="button"
                  onClick={saveCurrentAsTemplate}
                  disabled={!subject.trim() || !body.trim()}
                  data-testid="tpl-save-current"
                  variant="outline"
                  className="border-viking-gold/60 text-viking-gold hover:bg-viking-gold/10 rounded-sm font-rune text-[10px] tracking-[0.15em] uppercase"
                >
                  <Save size={12} className="mr-1.5" />
                  {t("messaging.templates_save_as")}
                </Button>
              </div>
            )}
          </div>
        ) : (
        <>
        {/* Event picker */}
        <div className="space-y-2">
          <Label className="text-overline">{t("messaging.pick_event")}</Label>
          <select
            data-testid="msg-event"
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
            className={`w-full px-3 py-2 ${fieldClass}`}
          >
            <option value="">— {t("messaging.pick_event")} —</option>
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev[`title_${lang}`] || ev.title_fi || ev.title || ev.id}
                {ev.start_date ? ` · ${ev.start_date}` : ""}
              </option>
            ))}
          </select>
        </div>

        {/* Channel */}
        <div className="space-y-2">
          <Label className="text-overline">{t("messaging.channel")}</Label>
          <div className="flex flex-wrap gap-2">
            {CHANNELS.map((c) => {
              const active = channel === c;
              return (
                <button
                  key={c}
                  type="button"
                  data-testid={`msg-channel-${c}`}
                  onClick={() => setChannel(c)}
                  className={`px-3 py-2 rounded-sm text-xs font-rune border transition-colors ${
                    active
                      ? "border-viking-gold text-viking-gold bg-viking-gold/10"
                      : "border-viking-edge text-viking-stone hover:border-viking-gold/60"
                  }`}
                >
                  {t(`messaging.ch_${c}`)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Target categories */}
        <div className="space-y-2">
          <Label className="text-overline">{t("messaging.targets")}</Label>
          <div className="flex flex-wrap gap-2">
            {TARGET_CATEGORIES.map((c) => {
              const active = targets.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  data-testid={`msg-target-${c}`}
                  onClick={() => toggleTarget(c)}
                  className={`px-3 py-2 rounded-sm text-xs font-rune border transition-colors ${
                    active
                      ? "border-viking-gold text-viking-gold bg-viking-gold/10"
                      : "border-viking-edge text-viking-stone hover:border-viking-gold/60"
                  }`}
                >
                  {t(`account.type_${c}`)}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-viking-stone italic">
            {targets.length === 0
              ? t("messaging.targets_help_all")
              : t("messaging.targets_help_some")}
          </p>
        </div>

        {/* Subject */}
        <div className="space-y-2">
          <Label className="text-overline">{t("messaging.subject")}</Label>
          <Input
            type="text"
            data-testid="msg-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={120}
            className={fieldClass}
          />
        </div>

        {/* Body */}
        <div className="space-y-2">
          <Label className="text-overline">{t("messaging.body")}</Label>
          <textarea
            data-testid="msg-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={6}
            maxLength={1500}
            className={`w-full px-3 py-2 ${fieldClass} resize-y`}
          />
          <p className="text-[11px] text-viking-stone italic">
            {t("messaging.body_hint")}
          </p>
          <p
            data-testid="msg-vars-hint"
            className="text-[11px] text-viking-gold/80 italic leading-relaxed"
          >
            {t("messaging.vars_hint")}
          </p>
        </div>

        <Button
          type="button"
          onClick={send}
          disabled={sending || !eventId || !subject.trim() || !body.trim()}
          data-testid="msg-send"
          className="bg-viking-ember hover:bg-viking-emberHover text-viking-bone rounded-sm font-rune text-xs h-11 px-6 ember-glow"
        >
          {sending ? "..." : t("messaging.send_btn")}
        </Button>

        {result ? (
          <div
            data-testid="msg-result"
            className="mt-2 p-4 border border-viking-gold/40 rounded-sm bg-viking-gold/5"
          >
            <div className="flex items-center gap-2 mb-2">
              <Check size={14} className="text-viking-gold" />
              <span className="text-overline">{t("messaging.result")}</span>
            </div>
            <p className="text-sm text-viking-bone">
              {(t("messaging.result_text") || "")
                .replace("{push}", String(result.sent_push ?? 0))
                .replace("{email}", String(result.sent_email ?? 0))
                .replace("{recipients}", String(result.recipients ?? 0))}
            </p>
            {/* Diagnostic explanation: push selected but no devices reachable */}
            {(channel === "push" || channel === "both") &&
            (result.sent_push ?? 0) === 0 &&
            (result.push_eligible ?? 0) === 0 ? (
              <p
                data-testid="msg-no-push-tokens"
                className="text-xs text-viking-ember mt-2 italic leading-relaxed"
              >
                {t("messaging.no_push_tokens")}
              </p>
            ) : null}
          </div>
        ) : null}
        </>
        )}
      </div>
    </div>
  );
}
