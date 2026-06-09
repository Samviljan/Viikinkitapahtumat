import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, formatApiErrorDetail } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import PageHero from "@/components/PageHero";
import ImageUploadField from "@/components/ImageUploadField";
import PdfUploadField from "@/components/PdfUploadField";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";

const CATS = ["market", "training_camp", "course", "festival", "meetup", "other"];
const COUNTRIES = ["FI", "SE", "EE", "NO", "DK", "PL", "DE", "IS", "LV", "LT", "SI", "HR", "UA", "NL", "GB", "IE", "BE", "FR", "ES", "PT", "IT"];
const fieldClass =
  "bg-viking-surface border-viking-edge rounded-sm text-viking-bone placeholder:text-viking-stone focus:border-viking-ember focus:ring-viking-ember";

export default function Submit() {
  const { t, lang } = useI18n();
  const nav = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  // Single title/description fields — user types in their UI language and the
  // backend translation service auto-fills the other 6. We carry the language
  // tag along to the payload key.
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "market",
    country: "FI",
    location: "",
    start_date: "",
    end_date: "",
    organizer: "",
    organizer_email: "",
    link: "",
    registration_url: "",
    image_url: "",
    audience: "",
    fight_style: "",
    program_pdf_url: "",
  });

  const update = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  async function onSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      // Post the user's text into the field matching the active UI language,
      // so the auto-translator picks the right source language.
      const { title, description, ...rest } = form;
      const payload = {
        ...rest,
        [`title_${lang}`]: title,
        [`description_${lang}`]: description,
      };
      if (!payload.organizer_email) delete payload.organizer_email;
      if (!payload.end_date) delete payload.end_date;
      if (!payload.audience) delete payload.audience;
      if (!payload.fight_style) delete payload.fight_style;
      if (!payload.program_pdf_url) delete payload.program_pdf_url;
      await api.post("/events", payload);
      setSuccess(true);
      toast.success(t("submit.success"));
      setTimeout(() => nav("/events"), 1800);
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || t("submit.error"));
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-32 text-center" data-testid="submit-success">
        <CheckCircle2 size={56} className="mx-auto text-viking-gold mb-6" />
        <h2 className="font-serif text-3xl text-viking-bone mb-3">{t("submit.success")}</h2>
      </div>
    );
  }

  return (
    <>
      <PageHero eyebrow={t("nav.submit")} title={t("submit.title")} sub={t("submit.sub")} />

      <section className="mx-auto max-w-3xl px-4 sm:px-8 py-12">
        <form
          onSubmit={onSubmit}
          data-testid="submit-form"
          className="carved-card rounded-sm p-7 sm:p-10 space-y-6"
        >
          <Field label={t("submit.title_field")} required>
            <Input
              required
              data-testid="field-title"
              value={form.title}
              onChange={update("title")}
              className={fieldClass}
            />
          </Field>

          <Field label={t("submit.desc_field")} required>
            <Textarea
              required
              data-testid="field-desc"
              rows={5}
              value={form.description}
              onChange={update("description")}
              className={fieldClass}
            />
            <p
              data-testid="autotranslate-hint"
              className="text-[11px] text-viking-stone italic mt-2 leading-relaxed"
            >
              {t("submit.autotranslate_hint")}
            </p>
          </Field>

          <div className="grid sm:grid-cols-3 gap-5">
            <Field label={t("submit.category")} required>
              <Select value={form.category} onValueChange={(v) => setForm((p) => ({ ...p, category: v }))}>
                <SelectTrigger data-testid="field-category" className={fieldClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-viking-surface border-viking-edge text-viking-bone">
                  {CATS.map((c) => (
                    <SelectItem
                      key={c}
                      value={c}
                      className="focus:bg-viking-surface2 focus:text-viking-gold"
                    >
                      {t(`cats.${c}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={t("submit.country")} required>
              <Select value={form.country} onValueChange={(v) => setForm((p) => ({ ...p, country: v }))}>
                <SelectTrigger data-testid="field-country" className={fieldClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-viking-surface border-viking-edge text-viking-bone">
                  {COUNTRIES.map((c) => (
                    <SelectItem
                      key={c}
                      value={c}
                      className="focus:bg-viking-surface2 focus:text-viking-gold"
                    >
                      {t(`countries.${c}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={t("submit.location")} required>
              <Input
                required
                data-testid="field-location"
                value={form.location}
                onChange={update("location")}
                className={fieldClass}
              />
            </Field>
          </div>

          <div className="grid sm:grid-cols-2 gap-5">
            <Field label={t("submit.start_date")} required>
              <Input
                required
                data-testid="field-start-date"
                type="date"
                value={form.start_date}
                onChange={update("start_date")}
                className={fieldClass}
              />
            </Field>
            <Field label={t("submit.end_date")}>
              <Input
                data-testid="field-end-date"
                type="date"
                value={form.end_date}
                onChange={update("end_date")}
                className={fieldClass}
              />
            </Field>
          </div>

          <div className="grid sm:grid-cols-2 gap-5">
            <Field label={t("submit.organizer")} required>
              <Input
                required
                data-testid="field-organizer"
                value={form.organizer}
                onChange={update("organizer")}
                className={fieldClass}
              />
            </Field>
            <Field label={t("submit.organizer_email")}>
              <Input
                type="email"
                data-testid="field-organizer-email"
                value={form.organizer_email}
                onChange={update("organizer_email")}
                className={fieldClass}
              />
            </Field>
          </div>

          <Field label={t("submit.link")}>
            <Input
              data-testid="field-link"
              value={form.link}
              onChange={update("link")}
              placeholder="https://"
              className={fieldClass}
            />
          </Field>

          <Field label={t("submit.registration_url")}>
            <Input
              data-testid="field-registration-url"
              value={form.registration_url}
              onChange={update("registration_url")}
              placeholder="https://"
              className={fieldClass}
            />
          </Field>

          <Field label={t("submit.image")}>
            <ImageUploadField
              value={form.image_url}
              onChange={(v) => setForm((p) => ({ ...p, image_url: v }))}
              testIdPrefix="field-image"
            />
          </Field>

          <Field label={t("submit.program_pdf")}>
            <PdfUploadField
              value={form.program_pdf_url}
              onChange={(v) => setForm((p) => ({ ...p, program_pdf_url: v }))}
              testIdPrefix="field-program"
            />
          </Field>

          <div className="grid sm:grid-cols-2 gap-5">
            <Field label={t("submit.audience")}>
              <Select
                value={form.audience || "none"}
                onValueChange={(v) => setForm((p) => ({ ...p, audience: v === "none" ? "" : v }))}
              >
                <SelectTrigger data-testid="field-audience" className={fieldClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-viking-surface border-viking-edge text-viking-bone">
                  <SelectItem value="none" className="focus:bg-viking-surface2 focus:text-viking-gold">
                    {t("submit.audience_none")}
                  </SelectItem>
                  <SelectItem value="Yleisö" className="focus:bg-viking-surface2 focus:text-viking-gold">
                    {t("submit.audience_public")}
                  </SelectItem>
                  <SelectItem value="Harrastajat" className="focus:bg-viking-surface2 focus:text-viking-gold">
                    {t("submit.audience_hobby")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label={t("submit.fight_style")}>
              <Select
                value={form.fight_style || "none"}
                onValueChange={(v) => setForm((p) => ({ ...p, fight_style: v === "none" ? "" : v }))}
              >
                <SelectTrigger data-testid="field-fight-style" className={fieldClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-viking-surface border-viking-edge text-viking-bone">
                  <SelectItem value="none" className="focus:bg-viking-surface2 focus:text-viking-gold">
                    {t("submit.fight_none")}
                  </SelectItem>
                  <SelectItem value="Western" className="focus:bg-viking-surface2 focus:text-viking-gold">
                    {t("submit.fight_western")}
                  </SelectItem>
                  <SelectItem value="Eastern" className="focus:bg-viking-surface2 focus:text-viking-gold">
                    {t("submit.fight_eastern")}
                  </SelectItem>
                  <SelectItem value="Western+Eastern" className="focus:bg-viking-surface2 focus:text-viking-gold">
                    {t("submit.fight_western_eastern")}
                  </SelectItem>
                  <SelectItem value="Buhurt" className="focus:bg-viking-surface2 focus:text-viking-gold">
                    {t("submit.fight_buhurt")}
                  </SelectItem>
                  <SelectItem value="SCA" className="focus:bg-viking-surface2 focus:text-viking-gold">
                    {t("submit.fight_sca")}
                  </SelectItem>
                  <SelectItem value="Other" className="focus:bg-viking-surface2 focus:text-viking-gold">
                    {t("submit.fight_other")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Button
            type="submit"
            disabled={submitting}
            data-testid="submit-event-btn"
            className="w-full bg-viking-ember hover:bg-viking-emberHover text-viking-bone rounded-sm font-rune text-xs h-12 ember-glow"
          >
            {submitting ? "..." : t("submit.submit_btn")}
          </Button>
        </form>
      </section>
    </>
  );
}

function Field({ label, required, children }) {
  return (
    <div className="space-y-2">
      <Label className="text-overline">
        {label} {required && <span className="text-viking-ember">*</span>}
      </Label>
      {children}
    </div>
  );
}
