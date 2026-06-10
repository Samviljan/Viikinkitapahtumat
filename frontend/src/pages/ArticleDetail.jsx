import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useI18n, pickLocalized } from "@/lib/i18n";
import { useDocumentSeo } from "@/lib/seo";
import { api } from "@/lib/api";
import { resolveImageUrl } from "@/lib/images";
import { ChevronLeft, Calendar } from "lucide-react";

function formatPublishedDate(iso, lang) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(lang === "fi" ? "fi-FI" : lang, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function ArticleDetail() {
  const { slug } = useParams();
  const { t, lang } = useI18n();
  const [article, setArticle] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .get(`/articles/${slug}`)
      .then((r) => setArticle(r.data))
      .catch(() => setError("not_found"));
  }, [slug]);

  const title = article ? pickLocalized(article, lang, "title") : "";
  const body = article ? pickLocalized(article, lang, "body") : "";
  const excerpt = article ? pickLocalized(article, lang, "excerpt") : "";
  const cover = article?.cover_image_url
    ? resolveImageUrl(article.cover_image_url)
    : null;

  // schema.org/Article JSON-LD for rich search results
  const canonicalUrl = article
    ? `https://viikinkitapahtumat.fi/articles/${article.slug}`
    : undefined;
  const jsonLd = article
    ? {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: title,
        datePublished: article.published_at,
        dateModified: article.updated_at || article.published_at,
        url: canonicalUrl,
        description: excerpt
          ? excerpt.replace(/\s+/g, " ").trim()
          : (body ? body.slice(0, 200).replace(/\s+/g, " ").trim() : undefined),
        image: cover ? [cover] : undefined,
        publisher: {
          "@type": "Organization",
          name: "Viikinkitapahtumat",
          url: "https://viikinkitapahtumat.fi/",
        },
        inLanguage: lang,
      }
    : undefined;

  useDocumentSeo({
    title: title ? `${title} — Viikinkitapahtumat` : undefined,
    description: excerpt || (body ? body.slice(0, 200).replace(/\s+/g, " ").trim() : undefined),
    canonicalPath: article ? `/articles/${article.slug}` : undefined,
    image: cover || undefined,
    type: "article",
    jsonLd,
  });

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h1 className="font-serif text-3xl text-viking-bone mb-4">404</h1>
        <Link
          to="/articles"
          className="inline-flex items-center gap-2 text-viking-gold font-rune text-xs"
          data-testid="article-back-link"
        >
          <ChevronLeft size={14} /> {t("articles.back")}
        </Link>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20">
        <div className="h-72 bg-viking-surface animate-pulse rounded-sm" />
      </div>
    );
  }

  const gallery = Array.isArray(article.gallery)
    ? article.gallery.filter(Boolean)
    : [];

  return (
    <article className="pb-20" data-testid="article-detail">
      {cover ? (
        <div className="relative h-[42vh] min-h-[280px] w-full overflow-hidden">
          <img
            src={cover}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-viking-bg/40 via-viking-bg/60 to-viking-bg" />
        </div>
      ) : (
        <div className="h-32 bg-viking-surface/60" />
      )}

      <div className="mx-auto max-w-3xl px-4 sm:px-8 -mt-20 relative z-10">
        <Link
          to="/articles"
          data-testid="article-back-link"
          className="inline-flex items-center gap-2 text-viking-stone hover:text-viking-gold font-rune text-[11px] mb-5"
        >
          <ChevronLeft size={14} /> {t("articles.back")}
        </Link>

        <div className="carved-card rounded-sm p-7 sm:p-12">
          <div className="flex items-center gap-2 text-overline text-viking-gold mb-4">
            <Calendar size={14} />
            <span>{formatPublishedDate(article.published_at, lang)}</span>
          </div>
          <h1
            className="font-serif text-4xl sm:text-5xl text-viking-bone leading-tight mb-8"
            data-testid="article-title"
          >
            {title}
          </h1>

          {body && (
            <div
              className="font-serif text-lg text-viking-bone leading-relaxed space-y-5"
              data-testid="article-body"
            >
              {body.split("\n\n").map((para, idx) => (
                <p key={idx}>{para}</p>
              ))}
            </div>
          )}

          {gallery.length > 0 && (
            <div className="mt-10" data-testid="article-gallery">
              <div className="text-overline mb-4 text-viking-stone">
                {t("articles.gallery")}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {gallery.map((url, idx) => (
                  <a
                    key={`${url}-${idx}`}
                    href={resolveImageUrl(url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid={`article-gallery-item-${idx}`}
                    className="block aspect-[16/9] overflow-hidden rounded-sm border border-viking-edge hover:border-viking-gold/60 transition-colors"
                  >
                    <img
                      src={resolveImageUrl(url)}
                      alt=""
                      loading="lazy"
                      className="w-full h-full object-cover opacity-90 hover:opacity-100 hover:scale-105 transition-all duration-700"
                    />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
