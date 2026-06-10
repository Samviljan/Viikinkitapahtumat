/**
 * AdminArticlesPanel — full CRUD UI for editorial articles.
 *
 *  • List all articles (newest first) with translation status badge.
 *  • Inline "Create" form (slug auto-generates from title_fi, but editable).
 *  • Expanded edit view per article: edit FI fields, upload cover + gallery
 *    images, trigger manual translation, delete article.
 *  • Image upload is multipart (POST /api/admin/articles/{slug}/images?kind=).
 *  • All actions show sonner toasts; destructive actions require confirm.
 *
 * Layout follows the same `carved-card` design language as the other admin
 * panels — left-aligned, structured forms, gold accents for primary actions.
 */
import React, { useEffect, useState, useRef } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { resolveImageUrl } from "@/lib/images";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  Upload,
  Languages,
  Save,
  X,
  Image as ImageIcon,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const SUPPORTED_LANGS = ["fi", "en", "sv", "da", "de", "et", "pl"];

function slugify(text) {
  if (!text) return "";
  return text
    .toLowerCase()
    .replace(/[äå]/g, "a")
    .replace(/ö/g, "o")
    .replace(/[éèê]/g, "e")
    .replace(/ü/g, "u")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9\s-]+/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function translationBadge(article) {
  const filled = SUPPORTED_LANGS.filter(
    (l) => (article[`body_${l}`] || "").trim().length > 50
  ).length;
  const tone =
    filled === 7
      ? "bg-emerald-900/40 text-emerald-200 border-emerald-700/50"
      : filled >= 4
      ? "bg-amber-900/40 text-amber-200 border-amber-700/50"
      : "bg-stone-800/60 text-stone-300 border-stone-700/50";
  return (
    <span
      className={`text-[10px] tracking-[0.12em] uppercase px-2 py-0.5 rounded-sm border ${tone}`}
    >
      {filled}/7 kieltä
    </span>
  );
}

function CreateArticleForm({ onCreated, onCancel }) {
  const [titleFi, setTitleFi] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManual, setSlugManual] = useState(false);
  const [excerptFi, setExcerptFi] = useState("");
  const [bodyFi, setBodyFi] = useState("");
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function handleTitleChange(v) {
    setTitleFi(v);
    if (!slugManual) setSlug(slugify(v));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!titleFi.trim() || !bodyFi.trim()) {
      toast.error("Otsikko ja runkoteksti ovat pakollisia");
      return;
    }
    setSubmitting(true);
    try {
      const r = await api.post("/admin/articles", {
        slug: slug.trim() || undefined,
        title_fi: titleFi.trim(),
        excerpt_fi: excerptFi.trim(),
        body_fi: bodyFi,
        feedback_form_type: feedback || null,
        auto_translate: true,
      });
      toast.success("Artikkeli luotu. Käännökset valmistuvat hetken kuluttua.");
      onCreated(r.data);
    } catch (e2) {
      const code = e2?.response?.status;
      if (code === 409) toast.error("Slug on jo käytössä.");
      else if (code === 422) toast.error("Tarkista pakolliset kentät.");
      else toast.error("Tallennus epäonnistui.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      data-testid="admin-article-create-form"
      className="carved-card rounded-sm p-6 mb-6 space-y-4"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-xl text-viking-bone">Uusi artikkeli</h3>
        <button
          type="button"
          onClick={onCancel}
          className="text-viking-stone hover:text-viking-bone"
          data-testid="admin-article-create-cancel"
        >
          <X size={18} />
        </button>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <label className="block">
          <span className="text-overline text-viking-stone mb-1.5 block">
            Otsikko (suomeksi) *
          </span>
          <input
            type="text"
            value={titleFi}
            onChange={(e) => handleTitleChange(e.target.value)}
            required
            data-testid="admin-article-title-fi"
            className="w-full bg-viking-bg/60 border border-viking-edge rounded-sm px-3 py-2 text-viking-bone focus:border-viking-gold focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="text-overline text-viking-stone mb-1.5 block">
            Slug (URL-osa)
          </span>
          <input
            type="text"
            value={slug}
            onChange={(e) => {
              setSlugManual(true);
              setSlug(slugify(e.target.value));
            }}
            data-testid="admin-article-slug"
            className="w-full bg-viking-bg/60 border border-viking-edge rounded-sm px-3 py-2 text-viking-bone font-mono text-sm focus:border-viking-gold focus:outline-none"
            placeholder="auto-generoidaan otsikosta"
          />
        </label>
      </div>

      <label className="block">
        <span className="text-overline text-viking-stone mb-1.5 block">
          Lyhyt nosto / excerpt
        </span>
        <input
          type="text"
          value={excerptFi}
          onChange={(e) => setExcerptFi(e.target.value)}
          maxLength={300}
          data-testid="admin-article-excerpt-fi"
          className="w-full bg-viking-bg/60 border border-viking-edge rounded-sm px-3 py-2 text-viking-bone focus:border-viking-gold focus:outline-none"
          placeholder="Näkyy artikkelilistalla ja etusivun nostossa."
        />
      </label>

      <label className="block">
        <span className="text-overline text-viking-stone mb-1.5 block">
          Runkoteksti *
        </span>
        <textarea
          value={bodyFi}
          onChange={(e) => setBodyFi(e.target.value)}
          required
          rows={14}
          data-testid="admin-article-body-fi"
          className="w-full bg-viking-bg/60 border border-viking-edge rounded-sm px-3 py-2 text-viking-bone font-serif leading-relaxed focus:border-viking-gold focus:outline-none resize-y"
          placeholder={`Erottele kappaleet tyhjällä rivillä.\n\n## Otsikko (alkaa kahdella #-merkillä)\n\n- Luettelokohta alkaa ”- ” -merkein`}
        />
        <div className="text-xs text-viking-stone mt-1">
          Tuetut: <code>## Otsikko</code> · <code>- listakohta</code> · tyhjä rivi = uusi kappale.
        </div>
      </label>

      <label className="block max-w-xs">
        <span className="text-overline text-viking-stone mb-1.5 block">
          Lomaketyyppi (valinnainen)
        </span>
        <select
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          data-testid="admin-article-feedback-type"
          className="w-full bg-viking-bg/60 border border-viking-edge rounded-sm px-3 py-2 text-viking-bone focus:border-viking-gold focus:outline-none"
        >
          <option value="">— ei lomaketta —</option>
          <option value="beta_app">Beta-testaajan palautelomake</option>
        </select>
      </label>

      <div className="flex items-center gap-3 pt-2">
        <Button
          type="submit"
          disabled={submitting}
          data-testid="admin-article-create-submit"
          className="bg-viking-ember hover:bg-viking-ember/90 text-viking-bone"
        >
          {submitting ? <Loader2 className="animate-spin mr-2" size={14} /> : <Save size={14} className="mr-2" />}
          Tallenna ja käännä
        </Button>
        <span className="text-xs text-viking-stone">
          Käännös muille kielille tapahtuu taustalla (~30 s).
        </span>
      </div>
    </form>
  );
}

function ArticleEditor({ article, onUpdated, onDeleted }) {
  const [titleFi, setTitleFi] = useState(article.title_fi || "");
  const [excerptFi, setExcerptFi] = useState(article.excerpt_fi || "");
  const [bodyFi, setBodyFi] = useState(article.body_fi || "");
  const [feedback, setFeedback] = useState(article.feedback_form_type || "");
  const [saving, setSaving] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [uploading, setUploading] = useState(null); // "cover" | "gallery" | null
  const coverInputRef = useRef(null);
  const galleryInputRef = useRef(null);

  async function handleSave() {
    setSaving(true);
    try {
      const r = await api.patch(`/admin/articles/${article.slug}`, {
        title_fi: titleFi,
        excerpt_fi: excerptFi,
        body_fi: bodyFi,
        feedback_form_type: feedback || "",
        auto_translate: false,
      });
      toast.success("Tallennettu.");
      onUpdated(r.data);
    } catch {
      toast.error("Tallennus epäonnistui.");
    } finally {
      setSaving(false);
    }
  }

  async function handleTranslate() {
    setTranslating(true);
    try {
      const r = await api.post(`/admin/articles/${article.slug}/translate`);
      const filled = (r.data?.updated || []).length;
      if (filled === 0) {
        toast.info("Kaikki käännökset ovat jo paikoillaan.");
      } else {
        toast.success(`Käännetty ${filled} kenttää.`);
      }
      // Re-fetch to get the new translations
      const detail = await api.get(`/articles/${article.slug}`);
      onUpdated(detail.data);
    } catch {
      toast.error("Käännös epäonnistui.");
    } finally {
      setTranslating(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Poistetaanko artikkeli "${article.title_fi}"?`)) return;
    try {
      await api.delete(`/admin/articles/${article.slug}`);
      toast.success("Artikkeli poistettu.");
      onDeleted(article.slug);
    } catch {
      toast.error("Poisto epäonnistui.");
    }
  }

  async function uploadImage(file, kind) {
    if (!file) return;
    setUploading(kind);
    const form = new FormData();
    form.append("file", file);
    form.append("kind", kind);
    try {
      await api.post(
        `/admin/articles/${article.slug}/images?kind=${kind}`,
        form,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      toast.success(`${kind === "cover" ? "Kansikuva" : "Galleriakuva"} ladattu.`);
      const detail = await api.get(`/articles/${article.slug}`);
      onUpdated(detail.data);
    } catch (e) {
      const code = e?.response?.status;
      if (code === 413) toast.error("Kuva on liian suuri (max 8 MB).");
      else if (code === 415) toast.error("Vain kuvatiedostot ovat sallittuja.");
      else toast.error("Kuvan lataus epäonnistui.");
    } finally {
      setUploading(null);
      if (coverInputRef.current) coverInputRef.current.value = "";
      if (galleryInputRef.current) galleryInputRef.current.value = "";
    }
  }

  async function deleteImage(url) {
    if (!window.confirm("Poistetaanko tämä kuva?")) return;
    try {
      await api.delete(`/admin/articles/${article.slug}/images`, { params: { url } });
      toast.success("Kuva poistettu.");
      const detail = await api.get(`/articles/${article.slug}`);
      onUpdated(detail.data);
    } catch {
      toast.error("Poisto epäonnistui.");
    }
  }

  return (
    <div
      className="border-t border-viking-edge bg-viking-bg/40 p-6 space-y-5"
      data-testid={`admin-article-editor-${article.slug}`}
    >
      {/* FI text fields */}
      <div className="grid sm:grid-cols-2 gap-4">
        <label className="block">
          <span className="text-overline text-viking-stone mb-1.5 block">Otsikko (FI)</span>
          <input
            type="text"
            value={titleFi}
            onChange={(e) => setTitleFi(e.target.value)}
            data-testid={`admin-article-edit-title-${article.slug}`}
            className="w-full bg-viking-bg/60 border border-viking-edge rounded-sm px-3 py-2 text-viking-bone"
          />
        </label>
        <label className="block">
          <span className="text-overline text-viking-stone mb-1.5 block">Lyhyt nosto</span>
          <input
            type="text"
            value={excerptFi}
            onChange={(e) => setExcerptFi(e.target.value)}
            maxLength={300}
            className="w-full bg-viking-bg/60 border border-viking-edge rounded-sm px-3 py-2 text-viking-bone"
          />
        </label>
      </div>

      <label className="block">
        <span className="text-overline text-viking-stone mb-1.5 block">Runkoteksti (FI)</span>
        <textarea
          value={bodyFi}
          onChange={(e) => setBodyFi(e.target.value)}
          rows={14}
          data-testid={`admin-article-edit-body-${article.slug}`}
          className="w-full bg-viking-bg/60 border border-viking-edge rounded-sm px-3 py-2 text-viking-bone font-serif leading-relaxed resize-y"
        />
      </label>

      <label className="block max-w-xs">
        <span className="text-overline text-viking-stone mb-1.5 block">Lomake</span>
        <select
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          className="w-full bg-viking-bg/60 border border-viking-edge rounded-sm px-3 py-2 text-viking-bone"
        >
          <option value="">— ei lomaketta —</option>
          <option value="beta_app">Beta-testaajan palautelomake</option>
        </select>
      </label>

      {/* Image management */}
      <div className="grid sm:grid-cols-2 gap-5 pt-3 border-t border-viking-edge/50">
        <div>
          <div className="text-overline text-viking-stone mb-2">Kansikuva</div>
          {article.cover_image_url ? (
            <div className="relative w-full aspect-[16/9] rounded-sm overflow-hidden border border-viking-edge mb-2">
              <img
                src={resolveImageUrl(article.cover_image_url)}
                alt=""
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => deleteImage(article.cover_image_url)}
                title="Poista kansikuva"
                className="absolute top-2 right-2 bg-viking-bg/80 hover:bg-viking-ember text-viking-bone p-1.5 rounded-sm"
                data-testid={`admin-article-cover-delete-${article.slug}`}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ) : (
            <div className="w-full aspect-[16/9] rounded-sm border border-dashed border-viking-edge mb-2 flex items-center justify-center text-viking-stone">
              <ImageIcon size={32} />
            </div>
          )}
          <label className="inline-flex items-center gap-2 text-sm text-viking-gold cursor-pointer hover:text-viking-bone">
            <Upload size={14} />
            {uploading === "cover" ? "Ladataan…" : "Lataa kansikuva"}
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              disabled={uploading !== null}
              onChange={(e) => uploadImage(e.target.files?.[0], "cover")}
              data-testid={`admin-article-cover-upload-${article.slug}`}
              className="hidden"
            />
          </label>
        </div>

        <div>
          <div className="text-overline text-viking-stone mb-2">
            Galleria ({(article.gallery || []).length})
          </div>
          {article.gallery?.length > 0 ? (
            <div className="grid grid-cols-2 gap-2 mb-2">
              {article.gallery.map((url) => (
                <div
                  key={url}
                  className="relative aspect-[16/9] rounded-sm overflow-hidden border border-viking-edge"
                >
                  <img
                    src={resolveImageUrl(url)}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => deleteImage(url)}
                    title="Poista kuva"
                    className="absolute top-1 right-1 bg-viking-bg/80 hover:bg-viking-ember text-viking-bone p-1 rounded-sm"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="w-full aspect-[16/9] rounded-sm border border-dashed border-viking-edge mb-2 flex items-center justify-center text-viking-stone">
              <ImageIcon size={32} />
            </div>
          )}
          <label className="inline-flex items-center gap-2 text-sm text-viking-gold cursor-pointer hover:text-viking-bone">
            <Upload size={14} />
            {uploading === "gallery" ? "Ladataan…" : "Lisää galleriakuva"}
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              disabled={uploading !== null}
              onChange={(e) => uploadImage(e.target.files?.[0], "gallery")}
              data-testid={`admin-article-gallery-upload-${article.slug}`}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-viking-edge/50">
        <Button
          onClick={handleSave}
          disabled={saving}
          data-testid={`admin-article-save-${article.slug}`}
          className="bg-viking-ember hover:bg-viking-ember/90 text-viking-bone"
        >
          {saving ? <Loader2 className="animate-spin mr-2" size={14} /> : <Save size={14} className="mr-2" />}
          Tallenna
        </Button>
        <Button
          variant="outline"
          onClick={handleTranslate}
          disabled={translating}
          data-testid={`admin-article-translate-${article.slug}`}
        >
          {translating ? <Loader2 className="animate-spin mr-2" size={14} /> : <Languages size={14} className="mr-2" />}
          Käännä puuttuvat kielet
        </Button>
        <a
          href={`/articles/${article.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-viking-gold hover:text-viking-bone"
        >
          <ExternalLink size={14} /> Avaa artikkeli
        </a>
        <div className="flex-1" />
        <Button
          variant="outline"
          onClick={handleDelete}
          data-testid={`admin-article-delete-${article.slug}`}
          className="border-viking-ember/40 text-viking-ember hover:bg-viking-ember/10"
        >
          <Trash2 size={14} className="mr-2" />
          Poista
        </Button>
      </div>
    </div>
  );
}

export default function AdminArticlesPanel() {
  const [articles, setArticles] = useState(null);
  const [creating, setCreating] = useState(false);
  const [expanded, setExpanded] = useState(null);

  function reload() {
    setArticles(null);
    api
      .get("/articles")
      .then((r) => setArticles(r.data || []))
      .catch(() => setArticles([]));
  }

  useEffect(() => {
    let cancelled = false;
    api
      .get("/articles")
      .then((r) => {
        if (!cancelled) setArticles(r.data || []);
      })
      .catch(() => {
        if (!cancelled) setArticles([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function handleCreated(newArticle) {
    setArticles((prev) => [newArticle, ...(prev || [])]);
    setCreating(false);
    setExpanded(newArticle.slug);
  }

  function handleUpdated(updated) {
    setArticles((prev) =>
      (prev || []).map((a) => (a.slug === updated.slug ? updated : a))
    );
  }

  function handleDeleted(slug) {
    setArticles((prev) => (prev || []).filter((a) => a.slug !== slug));
    setExpanded(null);
  }

  return (
    <section data-testid="admin-articles-panel" className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-2xl text-viking-bone">Artikkelit</h2>
          <p className="text-sm text-viking-stone mt-1">
            Luo, muokkaa ja poista artikkeleita. Suomeksi kirjoitettu sisältö
            käännetään automaattisesti kaikille 7 kielelle.
          </p>
        </div>
        {!creating && (
          <Button
            onClick={() => setCreating(true)}
            data-testid="admin-article-new-button"
            className="bg-viking-ember hover:bg-viking-ember/90 text-viking-bone"
          >
            <Plus size={16} className="mr-2" /> Uusi artikkeli
          </Button>
        )}
      </div>

      {creating && (
        <CreateArticleForm
          onCreated={handleCreated}
          onCancel={() => setCreating(false)}
        />
      )}

      {articles === null && (
        <div className="text-viking-stone text-sm">Ladataan…</div>
      )}

      {articles?.length === 0 && !creating && (
        <div
          className="carved-card rounded-sm p-8 text-center text-viking-stone"
          data-testid="admin-articles-empty"
        >
          Ei vielä artikkeleita. Aloita klikkaamalla &quot;Uusi artikkeli&quot;.
        </div>
      )}

      {articles && articles.length > 0 && (
        <div className="space-y-3" data-testid="admin-articles-list">
          {articles.map((a) => (
            <div
              key={a.id || a.slug}
              data-testid={`admin-article-row-${a.slug}`}
              className="carved-card rounded-sm overflow-hidden"
            >
              <button
                type="button"
                onClick={() =>
                  setExpanded((cur) => (cur === a.slug ? null : a.slug))
                }
                className="w-full flex items-center gap-4 p-4 hover:bg-viking-bg/40 transition-colors text-left"
              >
                {a.cover_image_url ? (
                  <img
                    src={resolveImageUrl(a.cover_image_url)}
                    alt=""
                    className="w-16 h-16 object-cover rounded-sm flex-shrink-0"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-sm bg-viking-shadow/60 flex items-center justify-center flex-shrink-0">
                    <ImageIcon size={20} className="text-viking-stone" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-serif text-lg text-viking-bone truncate">
                    {a.title_fi}
                  </div>
                  <div className="text-xs text-viking-stone font-mono mt-0.5 truncate">
                    /articles/{a.slug}
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {translationBadge(a)}
                  {expanded === a.slug ? (
                    <ChevronDown size={18} className="text-viking-stone" />
                  ) : (
                    <ChevronRight size={18} className="text-viking-stone" />
                  )}
                </div>
              </button>
              {expanded === a.slug && (
                <ArticleEditor
                  article={a}
                  onUpdated={handleUpdated}
                  onDeleted={handleDeleted}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
