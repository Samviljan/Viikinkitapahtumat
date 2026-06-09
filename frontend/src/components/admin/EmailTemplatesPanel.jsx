/**
 * Admin email-templates library.
 *
 * - Lists all saved templates (CRUD)
 * - Each template has: name, subject, body, icon (lucide name), color (hex)
 * - Templates support {{event_title}}, {{event_date}}, {{event_location}},
 *   {{organizer_name}}, {{event_url}}, {{registration_url}}, {{nickname}}
 *   placeholders; variable substitution happens server-side at send time.
 *
 * Used from /admin/messages.
 */
import React, { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import * as Icons from "lucide-react";
import { Mail, Pencil, Trash2, Plus, X, Check } from "lucide-react";
import { api, formatApiErrorDetail } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const fieldClass =
  "bg-viking-surface border-viking-edge rounded-sm text-viking-bone placeholder:text-viking-stone focus:border-viking-ember focus:ring-viking-ember";

const COMMON_ICONS = [
  "Mail",
  "Bell",
  "AlarmClock",
  "CalendarCheck",
  "MessageSquare",
  "Megaphone",
  "Sparkles",
  "Heart",
  "AlertTriangle",
  "Award",
];

function emptyDraft() {
  return {
    name: "",
    subject: "",
    body: "",
    icon: "Mail",
    color: "#C8492C",
  };
}

function IconPreview({ name, size = 16, color = "#C19C4D" }) {
  const Comp = Icons[name] || Mail;
  return <Comp size={size} color={color} />;
}

export default function EmailTemplatesPanel() {
  const { t } = useI18n();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null | "new" | template object
  const [draft, setDraft] = useState(emptyDraft());
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get("/email-templates");
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  const startNew = useCallback(() => {
    setEditing("new");
    setDraft(emptyDraft());
  }, []);
  const startEdit = useCallback((item) => {
    setEditing(item.id);
    setDraft({
      name: item.name || "",
      subject: item.subject || "",
      body: item.body || "",
      icon: item.icon || "Mail",
      color: item.color || "#C8492C",
    });
  }, []);
  const cancelEdit = useCallback(() => {
    setEditing(null);
    setDraft(emptyDraft());
  }, []);
  async function save() {
    if (!draft.name.trim() || !draft.subject.trim() || !draft.body.trim()) {
      toast.error(t("admin.action_error"));
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: draft.name.trim(),
        subject: draft.subject.trim(),
        body: draft.body,
        icon: draft.icon || "Mail",
        color: draft.color || "#C8492C",
      };
      if (editing === "new") {
        await api.post("/admin/email-templates", payload);
      } else {
        await api.patch(`/admin/email-templates/${editing}`, payload);
      }
      toast.success(t("admin.action_ok"));
      cancelEdit();
      load();
    } catch (err) {
      toast.error(
        formatApiErrorDetail(err.response?.data?.detail) || t("admin.action_error"),
      );
    } finally {
      setSaving(false);
    }
  }
  async function remove(item) {
    const msg = (t("admin.templates.confirm_delete") || "").replace(
      "{name}",
      item.name,
    );
    if (!window.confirm(msg)) return;
    try {
      await api.delete(`/admin/email-templates/${item.id}`);
      toast.success(t("admin.action_ok"));
      load();
    } catch (err) {
      toast.error(
        formatApiErrorDetail(err.response?.data?.detail) || t("admin.action_error"),
      );
    }
  }

  return (
    <section
      data-testid="email-templates-panel"
      className="carved-card rounded-sm p-5 sm:p-6"
    >
      <header className="flex items-start justify-between gap-4 mb-4">
        <div className="flex-1 min-w-0">
          <h2 className="font-serif text-xl text-viking-bone">
            {t("admin.templates.title")}
          </h2>
          <p className="text-xs text-viking-stone leading-relaxed mt-1">
            {t("admin.templates.help")}
          </p>
        </div>
        {!editing && (
          <Button
            data-testid="templates-new-btn"
            onClick={startNew}
            className="bg-viking-ember hover:bg-viking-emberHover text-viking-bone rounded-sm font-rune text-[11px] tracking-[0.15em] uppercase shrink-0"
          >
            <Plus size={14} className="mr-1.5" />
            {t("admin.templates.new")}
          </Button>
        )}
      </header>

      {editing && (
        <div
          data-testid="template-editor"
          className="border border-viking-gold/30 rounded-sm p-4 mb-5 bg-viking-surface2 space-y-4"
        >
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-overline">{t("admin.templates.name")}</Label>
              <Input
                data-testid="template-name"
                value={draft.name}
                onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))}
                maxLength={120}
                className={fieldClass}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-overline">{t("admin.templates.color")}</Label>
              <input
                data-testid="template-color"
                type="color"
                value={draft.color}
                onChange={(e) => setDraft((p) => ({ ...p, color: e.target.value }))}
                className="w-full h-10 rounded-sm border border-viking-edge bg-viking-surface cursor-pointer"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-overline">{t("admin.templates.icon")}</Label>
            <div className="flex flex-wrap gap-2" data-testid="template-icon-picker">
              {COMMON_ICONS.map((n) => {
                const active = draft.icon === n;
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setDraft((p) => ({ ...p, icon: n }))}
                    title={n}
                    data-testid={`template-icon-${n}`}
                    className={`p-2 rounded-sm border transition-colors ${
                      active
                        ? "border-viking-gold bg-viking-gold/10"
                        : "border-viking-edge hover:border-viking-gold/40"
                    }`}
                  >
                    <IconPreview name={n} color={active ? draft.color : "#A89A82"} size={18} />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-overline">{t("admin.templates.subject")}</Label>
            <Input
              data-testid="template-subject"
              value={draft.subject}
              onChange={(e) => setDraft((p) => ({ ...p, subject: e.target.value }))}
              maxLength={200}
              className={fieldClass}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-overline">{t("admin.templates.body")}</Label>
            <Textarea
              data-testid="template-body"
              rows={6}
              value={draft.body}
              onChange={(e) => setDraft((p) => ({ ...p, body: e.target.value }))}
              maxLength={5000}
              className={fieldClass}
            />
            <p className="text-[11px] text-viking-stone italic leading-relaxed">
              {t("admin.templates.vars_help")}
            </p>
          </div>

          <div className="flex flex-wrap gap-2 justify-end">
            <Button
              variant="outline"
              onClick={cancelEdit}
              data-testid="template-cancel"
              className="border-viking-edge text-viking-bone hover:border-viking-stone rounded-sm font-rune text-xs"
            >
              <X size={14} className="mr-1.5" />
              {t("admin.templates.cancel")}
            </Button>
            <Button
              onClick={save}
              disabled={saving}
              data-testid="template-save"
              className="bg-viking-ember hover:bg-viking-emberHover text-viking-bone rounded-sm font-rune text-xs ember-glow"
            >
              <Check size={14} className="mr-1.5" />
              {saving ? "…" : t("admin.templates.save")}
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-xs text-viking-stone italic">…</p>
      ) : items.length === 0 ? (
        <p
          data-testid="templates-empty"
          className="text-sm text-viking-stone italic py-4"
        >
          {t("admin.templates.empty")}
        </p>
      ) : (
        <ul className="space-y-2" data-testid="templates-list">
          {items.map((it) => (
            <li
              key={it.id}
              data-testid={`template-row-${it.id}`}
              className="flex items-center gap-3 p-3 rounded-sm border border-viking-edge hover:border-viking-gold/40 transition-colors bg-viking-surface"
            >
              <div
                className="h-10 w-10 rounded-sm flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: `${it.color}22`,
                  border: `1px solid ${it.color}66`,
                }}
              >
                <IconPreview name={it.icon} color={it.color} size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-viking-bone truncate">{it.name}</div>
                <div className="text-[11px] text-viking-stone truncate">
                  {it.subject}
                </div>
              </div>
              <button
                type="button"
                onClick={() => startEdit(it)}
                data-testid={`template-edit-${it.id}`}
                className="p-2 rounded-sm border border-viking-edge text-viking-stone hover:border-viking-gold hover:text-viking-gold transition-colors"
                title={t("admin.templates.edit")}
              >
                <Pencil size={14} />
              </button>
              <button
                type="button"
                onClick={() => remove(it)}
                data-testid={`template-delete-${it.id}`}
                className="p-2 rounded-sm border border-viking-edge text-viking-stone hover:border-viking-ember hover:text-viking-ember transition-colors"
                title={t("admin.templates.delete")}
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
