import React, { useEffect, useState } from "react";
import { api, formatApiErrorDetail } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import ImageUploadField from "@/components/ImageUploadField";
import PdfUploadField from "@/components/PdfUploadField";
import { toast } from "sonner";

const fieldClass =
  "bg-viking-surface border-viking-edge rounded-sm text-viking-bone placeholder:text-viking-stone focus:border-viking-ember focus:ring-viking-ember";

const CATS = ["market", "training_camp", "course", "festival", "meetup", "other"];
const COUNTRIES = ["FI", "SE", "EE", "NO", "DK", "PL", "DE", "IS", "LV", "LT", "SI", "HR", "UA", "NL", "GB", "IE", "BE", "FR", "ES", "PT", "IT"];

export default function AdminEventEditDialog({ event, open, onOpenChange, onSaved }) {
  const { t } = useI18n();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [galleryDraft, setGalleryDraft] = useState("");

  useEffect(() => {
    if (event) {
      setForm({
        title_fi: event.title_fi || "",
        title_en: event.title_en || "",
        title_sv: event.title_sv || "",
        description_fi: event.description_fi || "",
        description_en: event.description_en || "",
        description_sv: event.description_sv || "",
        category: event.category || "other",
        country: event.country || "FI",
        location: event.location || "",
        start_date: event.start_date || "",
        end_date: event.end_date || "",
        organizer: event.organizer || "",
        organizer_email: event.organizer_email || "",
        link: event.link || "",
        registration_url: event.registration_url || "",
        image_url: event.image_url || "",
        gallery: Array.isArray(event.gallery) ? event.gallery : [],
        audience: event.audience || "",
        fight_style: event.fight_style || "",
        program_pdf_url: event.program_pdf_url || "",
      });
      setGalleryDraft("");
    }
  }, [event]);

  if (!form) return null;

  const update = (k) => (e) =>
    setForm((p) => ({ ...p, [k]: typeof e === "string" ? e : e.target.value }));

  async function save() {
    setSaving(true);
    try {
      const payload = { ...form };
      if (!payload.organizer_email) delete payload.organizer_email;
      if (!payload.end_date) delete payload.end_date;
      payload.gallery = (payload.gallery || []).filter(Boolean);
      const { data } = await api.put(`/admin/events/${event.id}`, payload);
      toast.success(t("admin.action_ok"));
      onSaved && onSaved(data);
      onOpenChange(false);
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || t("admin.action_error"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="event-edit-dialog"
        className="bg-viking-surface border-viking-edge text-viking-bone max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl text-viking-bone">
            {t("admin.edit_event")}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t("admin.edit_event")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <Field label={t("submit.title_field")} required>
            <Input data-testid="edit-title-fi" value={form.title_fi} onChange={update("title_fi")} className={fieldClass} />
          </Field>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label={t("submit.title_en")}>
              <Input data-testid="edit-title-en" value={form.title_en} onChange={update("title_en")} className={fieldClass} />
            </Field>
            <Field label={t("submit.title_sv")}>
              <Input data-testid="edit-title-sv" value={form.title_sv} onChange={update("title_sv")} className={fieldClass} />
            </Field>
          </div>

          <Field label={t("submit.desc_field")} required>
            <Textarea data-testid="edit-desc-fi" rows={4} value={form.description_fi} onChange={update("description_fi")} className={fieldClass} />
          </Field>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label={t("submit.desc_en")}>
              <Textarea data-testid="edit-desc-en" rows={3} value={form.description_en} onChange={update("description_en")} className={fieldClass} />
            </Field>
            <Field label={t("submit.desc_sv")}>
              <Textarea data-testid="edit-desc-sv" rows={3} value={form.description_sv} onChange={update("description_sv")} className={fieldClass} />
            </Field>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            <Field label={t("submit.category")} required>
              <Select value={form.category} onValueChange={(v) => setForm((p) => ({ ...p, category: v }))}>
                <SelectTrigger data-testid="edit-category" className={fieldClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-viking-surface border-viking-edge text-viking-bone">
                  {CATS.map((c) => (
                    <SelectItem key={c} value={c} className="focus:bg-viking-surface2 focus:text-viking-gold">
                      {t(`cats.${c}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={t("submit.country")} required>
              <Select value={form.country} onValueChange={(v) => setForm((p) => ({ ...p, country: v }))}>
                <SelectTrigger data-testid="edit-country" className={fieldClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-viking-surface border-viking-edge text-viking-bone">
                  {COUNTRIES.map((c) => (
                    <SelectItem key={c} value={c} className="focus:bg-viking-surface2 focus:text-viking-gold">
                      {t(`countries.${c}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={t("submit.location")} required>
              <Input data-testid="edit-location" value={form.location} onChange={update("location")} className={fieldClass} />
            </Field>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label={t("submit.start_date")} required>
              <Input data-testid="edit-start-date" type="date" value={form.start_date} onChange={update("start_date")} className={fieldClass} />
            </Field>
            <Field label={t("submit.end_date")}>
              <Input data-testid="edit-end-date" type="date" value={form.end_date} onChange={update("end_date")} className={fieldClass} />
            </Field>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label={t("submit.organizer")} required>
              <Input data-testid="edit-organizer" value={form.organizer} onChange={update("organizer")} className={fieldClass} />
            </Field>
            <Field label={t("submit.organizer_email")}>
              <Input data-testid="edit-organizer-email" type="email" value={form.organizer_email} onChange={update("organizer_email")} className={fieldClass} />
            </Field>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label={t("submit.audience")}>
              <Select
                value={form.audience || "_none"}
                onValueChange={(v) => setForm((p) => ({ ...p, audience: v === "_none" ? "" : v }))}
              >
                <SelectTrigger data-testid="edit-audience" className={fieldClass}><SelectValue /></SelectTrigger>
                <SelectContent className="bg-viking-surface border-viking-edge text-viking-bone">
                  <SelectItem value="_none">—</SelectItem>
                  <SelectItem value="Yleisö">{t("submit.audience_public")}</SelectItem>
                  <SelectItem value="Harrastajat">{t("submit.audience_hobby")}</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label={t("submit.fight_style")}>
              <Select
                value={form.fight_style || "_none"}
                onValueChange={(v) => setForm((p) => ({ ...p, fight_style: v === "_none" ? "" : v }))}
              >
                <SelectTrigger data-testid="edit-fight-style" className={fieldClass}><SelectValue /></SelectTrigger>
                <SelectContent className="bg-viking-surface border-viking-edge text-viking-bone">
                  <SelectItem value="_none">—</SelectItem>
                  <SelectItem value="Western">{t("submit.fight_western")}</SelectItem>
                  <SelectItem value="Eastern">{t("submit.fight_eastern")}</SelectItem>
                  <SelectItem value="Western+Eastern">{t("submit.fight_western_eastern")}</SelectItem>
                  <SelectItem value="Buhurt">{t("submit.fight_buhurt")}</SelectItem>
                  <SelectItem value="SCA">{t("submit.fight_sca")}</SelectItem>
                  <SelectItem value="Other">{t("submit.fight_other")}</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label={t("submit.link")}>
            <Input data-testid="edit-link" value={form.link} onChange={update("link")} className={fieldClass} placeholder="https://" />
          </Field>
          <Field label={t("submit.registration_url")}>
            <Input data-testid="edit-registration-url" value={form.registration_url} onChange={update("registration_url")} className={fieldClass} placeholder="https://" />
          </Field>
          <Field label={t("submit.image")}>
            <ImageUploadField
              value={form.image_url}
              onChange={(v) => setForm((p) => ({ ...p, image_url: v }))}
              testIdPrefix="edit-image"
            />
          </Field>

          <Field label={t("submit.program_pdf")}>
            <PdfUploadField
              value={form.program_pdf_url}
              onChange={(v) => setForm((p) => ({ ...p, program_pdf_url: v }))}
              testIdPrefix="edit-program"
            />
          </Field>

          <Field label={t("submit.gallery")}>
            <div className="space-y-3" data-testid="edit-gallery">
              {form.gallery.length === 0 && (
                <p className="text-xs text-viking-stone italic">{t("submit.gallery_empty")}</p>
              )}
              {form.gallery.map((url, idx) => (
                <div key={`${url}-${idx}`} className="flex items-center gap-2">
                  <img
                    src={url.startsWith("http") ? url : `${process.env.REACT_APP_BACKEND_URL || ""}${url}`}
                    alt=""
                    className="h-10 w-14 object-cover rounded-sm border border-viking-edge"
                    onError={(e) => {
                      e.currentTarget.style.opacity = "0.3";
                    }}
                  />
                  <span className="flex-1 text-xs text-viking-stone truncate">{url}</span>
                  <button
                    type="button"
                    data-testid={`edit-gallery-remove-${idx}`}
                    onClick={() =>
                      setForm((p) => ({
                        ...p,
                        gallery: p.gallery.filter((_, i) => i !== idx),
                      }))
                    }
                    className="font-rune text-[10px] tracking-[0.2em] text-viking-stone hover:text-viking-ember uppercase"
                  >
                    {t("admin.remove")}
                  </button>
                </div>
              ))}
              <div className="border-t border-viking-edge/60 pt-3">
                <ImageUploadField
                  value={galleryDraft}
                  onChange={(v) => setGalleryDraft(v)}
                  testIdPrefix="edit-gallery-new"
                  placeholder="https://example.com/image.jpg"
                />
                <Button
                  type="button"
                  data-testid="edit-gallery-add"
                  disabled={!galleryDraft.trim()}
                  onClick={() => {
                    const v = galleryDraft.trim();
                    if (!v) return;
                    setForm((p) => ({ ...p, gallery: [...p.gallery, v] }));
                    setGalleryDraft("");
                  }}
                  variant="outline"
                  className="mt-2 border-viking-edge text-viking-bone hover:border-viking-gold hover:text-viking-gold rounded-sm font-rune text-[10px]"
                >
                  {t("admin.add")} →
                </Button>
              </div>
            </div>
          </Field>
        </div>

        <DialogFooter className="mt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-viking-edge text-viking-bone hover:border-viking-stone rounded-sm font-rune text-xs"
          >
            {t("admin.cancel")}
          </Button>
          <Button
            onClick={save}
            disabled={saving}
            data-testid="edit-save-btn"
            className="bg-viking-ember hover:bg-viking-emberHover text-viking-bone rounded-sm font-rune text-xs ember-glow"
          >
            {saving ? "..." : t("admin.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, required, children }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-overline">
        {label} {required && <span className="text-viking-ember">*</span>}
      </Label>
      {children}
    </div>
  );
}
