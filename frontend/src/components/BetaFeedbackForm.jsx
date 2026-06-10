import React, { useState } from "react";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { Send, CheckCircle2, AlertCircle } from "lucide-react";

/**
 * BetaFeedbackForm — submitted by visitors of the beta-tester article.
 * Posts to `POST /api/feedback/beta-app`. The backend stores the row +
 * forwards an email to the admin. Lightweight: no auth, name + email
 * optional, only message is required.
 */
export default function BetaFeedbackForm() {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [device, setDevice] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (!message.trim()) {
      setErr(t("beta_feedback.error_message_required"));
      return;
    }
    setErr("");
    setSubmitting(true);
    try {
      await api.post("/feedback/beta-app", {
        name: name.trim(),
        email: email.trim() || undefined,
        device: device.trim(),
        message: message.trim(),
      });
      setDone(true);
      toast.success(t("beta_feedback.success_toast"));
    } catch (e2) {
      const code = e2?.response?.status;
      if (code === 429) {
        setErr(t("beta_feedback.error_rate_limited"));
      } else if (code === 422) {
        setErr(t("beta_feedback.error_invalid_email"));
      } else {
        setErr(t("beta_feedback.error_generic"));
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div
        data-testid="beta-feedback-success"
        className="mt-12 carved-card rounded-sm p-7 sm:p-9 border-viking-gold/40"
      >
        <div className="flex items-start gap-4">
          <CheckCircle2 className="text-viking-gold flex-shrink-0 mt-1" size={28} />
          <div>
            <h3 className="font-serif text-2xl text-viking-bone mb-2">
              {t("beta_feedback.success_title")}
            </h3>
            <p className="text-viking-stone text-sm leading-relaxed">
              {t("beta_feedback.success_body")}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      data-testid="beta-feedback-form"
      className="mt-12 carved-card rounded-sm p-7 sm:p-9"
    >
      <div className="text-overline text-viking-gold mb-3">
        {t("beta_feedback.eyebrow")}
      </div>
      <h3 className="font-serif text-2xl sm:text-3xl text-viking-bone mb-2">
        {t("beta_feedback.title")}
      </h3>
      <p className="text-viking-stone text-sm leading-relaxed mb-7">
        {t("beta_feedback.sub")}
      </p>

      <div className="grid sm:grid-cols-2 gap-5 mb-5">
        <label className="block">
          <span className="text-overline text-viking-stone mb-1.5 block">
            {t("beta_feedback.field_name")}
          </span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            data-testid="beta-feedback-name"
            className="w-full bg-viking-bg/60 border border-viking-edge rounded-sm px-3 py-2.5 text-viking-bone focus:border-viking-gold focus:outline-none transition-colors"
            placeholder={t("beta_feedback.placeholder_name")}
          />
        </label>
        <label className="block">
          <span className="text-overline text-viking-stone mb-1.5 block">
            {t("beta_feedback.field_email")}
          </span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            data-testid="beta-feedback-email"
            className="w-full bg-viking-bg/60 border border-viking-edge rounded-sm px-3 py-2.5 text-viking-bone focus:border-viking-gold focus:outline-none transition-colors"
            placeholder={t("beta_feedback.placeholder_email")}
          />
        </label>
      </div>

      <label className="block mb-5">
        <span className="text-overline text-viking-stone mb-1.5 block">
          {t("beta_feedback.field_device")}
        </span>
        <input
          type="text"
          value={device}
          onChange={(e) => setDevice(e.target.value)}
          data-testid="beta-feedback-device"
          className="w-full bg-viking-bg/60 border border-viking-edge rounded-sm px-3 py-2.5 text-viking-bone focus:border-viking-gold focus:outline-none transition-colors"
          placeholder={t("beta_feedback.placeholder_device")}
        />
      </label>

      <label className="block mb-2">
        <span className="text-overline text-viking-stone mb-1.5 block">
          {t("beta_feedback.field_message")} *
        </span>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          rows={6}
          maxLength={5000}
          data-testid="beta-feedback-message"
          className="w-full bg-viking-bg/60 border border-viking-edge rounded-sm px-3 py-2.5 text-viking-bone focus:border-viking-gold focus:outline-none transition-colors resize-y"
          placeholder={t("beta_feedback.placeholder_message")}
        />
      </label>
      <div className="text-xs text-viking-stone text-right mb-5">
        {message.length} / 5000
      </div>

      {err && (
        <div
          data-testid="beta-feedback-error"
          className="flex items-start gap-2 text-viking-ember text-sm mb-5"
        >
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
          <span>{err}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={submitting || !message.trim()}
        data-testid="beta-feedback-submit"
        className="inline-flex items-center gap-2 px-6 py-3 rounded-sm bg-viking-ember text-viking-bone hover:bg-viking-ember/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-rune text-[11px] tracking-[0.15em] uppercase ember-glow font-semibold"
      >
        <Send size={14} />
        {submitting ? t("beta_feedback.submitting") : t("beta_feedback.submit")}
      </button>
    </form>
  );
}
