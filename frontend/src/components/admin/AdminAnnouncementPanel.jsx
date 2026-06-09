/**
 * Admin one-off newsletter announcement composer.
 *
 * Separate from the monthly digest — used for ad-hoc bulletins about app or
 * site updates, maintenance, new features etc.
 *
 * Backend: POST /api/admin/newsletter/announcement
 */
import React, { useState } from "react";
import { toast } from "sonner";
import { Sparkles, Send } from "lucide-react";
import { api, formatApiErrorDetail } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const fieldClass =
  "bg-viking-surface border-viking-edge rounded-sm text-viking-bone placeholder:text-viking-stone focus:border-viking-ember focus:ring-viking-ember";

export default function AdminAnnouncementPanel() {
  const { t } = useI18n();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  async function send() {
    if (!subject.trim() || !body.trim()) return;
    if (!window.confirm(t("admin.announcement.confirm"))) return;
    setSending(true);
    setResult(null);
    try {
      const { data } = await api.post("/admin/newsletter/announcement", {
        subject: subject.trim(),
        body: body.trim(),
        cta_label: ctaLabel.trim(),
        cta_url: ctaUrl.trim(),
      });
      setResult(data);
      toast.success(
        (t("admin.announcement.success") || "")
          .replace("{sent}", String(data.sent ?? 0))
          .replace("{recipients}", String(data.recipients ?? 0)),
      );
      setSubject("");
      setBody("");
      setCtaLabel("");
      setCtaUrl("");
    } catch (err) {
      toast.error(
        formatApiErrorDetail(err.response?.data?.detail) ||
          t("admin.action_error"),
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <section
      data-testid="admin-announcement-panel"
      className="carved-card rounded-sm p-5 sm:p-6 space-y-4"
    >
      <header className="flex items-start gap-3 mb-1">
        <div className="h-10 w-10 rounded-sm border border-viking-gold/50 flex items-center justify-center text-viking-gold shrink-0">
          <Sparkles size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-serif text-xl text-viking-bone">
            {t("admin.announcement.title")}
          </h2>
          <p className="text-xs text-viking-stone leading-relaxed mt-1">
            {t("admin.announcement.help")}
          </p>
        </div>
      </header>

      <div className="space-y-1.5">
        <Label className="text-overline">{t("admin.announcement.subject")}</Label>
        <Input
          data-testid="announcement-subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={200}
          className={fieldClass}
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-overline">{t("admin.announcement.body")}</Label>
        <Textarea
          data-testid="announcement-body"
          rows={6}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={5000}
          className={fieldClass}
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-overline">
            {t("admin.announcement.cta_label")}
          </Label>
          <Input
            data-testid="announcement-cta-label"
            value={ctaLabel}
            onChange={(e) => setCtaLabel(e.target.value)}
            maxLength={50}
            className={fieldClass}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-overline">
            {t("admin.announcement.cta_url")}
          </Label>
          <Input
            data-testid="announcement-cta-url"
            value={ctaUrl}
            onChange={(e) => setCtaUrl(e.target.value)}
            placeholder="https://"
            className={fieldClass}
          />
        </div>
      </div>

      <Button
        type="button"
        onClick={send}
        disabled={sending || !subject.trim() || !body.trim()}
        data-testid="announcement-send"
        className="bg-viking-ember hover:bg-viking-emberHover text-viking-bone rounded-sm font-rune text-xs h-11 px-6 ember-glow"
      >
        <Send size={14} className="mr-1.5" />
        {sending ? "…" : t("admin.announcement.send")}
      </Button>

      {result ? (
        <div
          data-testid="announcement-result"
          className="mt-2 p-4 border border-viking-gold/40 rounded-sm bg-viking-gold/5 text-sm text-viking-bone"
        >
          {(t("admin.announcement.success") || "")
            .replace("{sent}", String(result.sent ?? 0))
            .replace("{recipients}", String(result.recipients ?? 0))}
        </div>
      ) : null}
    </section>
  );
}
