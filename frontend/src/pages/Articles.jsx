import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import PageHero from "@/components/PageHero";
import { useI18n, pickLocalized } from "@/lib/i18n";
import { useDocumentSeo } from "@/lib/seo";
import { api } from "@/lib/api";
import { resolveImageUrl } from "@/lib/images";
import { ChevronRight, BookOpen } from "lucide-react";

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

function ArticleCard({ article }) {
  const { t, lang } = useI18n();
  const title = pickLocalized(article, lang, "title");
  const excerpt = pickLocalized(article, lang, "excerpt");
  const cover = article.cover_image_url
    ? resolveImageUrl(article.cover_image_url)
    : null;

  return (
    <Link
      to={`/articles/${article.slug}`}
      data-testid={`article-card-${article.slug}`}
      className="group block carved-card rounded-sm overflow-hidden hover:border-viking-gold/60 transition-colors"
    >
      {cover ? (
        <div className="relative aspect-[16/9] overflow-hidden bg-viking-shadow/40">
          <img
            src={cover}
            alt=""
            loading="lazy"
            className="w-full h-full object-cover opacity-95 group-hover:opacity-100 group-hover:scale-[1.02] transition-all duration-700"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-viking-bg/80 via-viking-bg/10 to-transparent" />
        </div>
      ) : (
        <div className="aspect-[16/9] bg-gradient-to-br from-viking-shadow to-viking-surface flex items-center justify-center">
          <BookOpen className="text-viking-gold/40" size={48} />
        </div>
      )}
      <div className="p-6 sm:p-7">
        <div className="text-overline text-viking-gold mb-3">
          {formatPublishedDate(article.published_at, lang)}
        </div>
        <h2 className="font-serif text-2xl sm:text-3xl text-viking-bone leading-tight mb-3 group-hover:text-viking-gold transition-colors">
          {title}
        </h2>
        {excerpt && (
          <p className="text-viking-stone text-sm sm:text-base leading-relaxed mb-4 line-clamp-3">
            {excerpt}
          </p>
        )}
        <div className="inline-flex items-center gap-1 text-viking-gold font-rune text-[11px] tracking-[0.15em] uppercase">
          {t("articles.read_more")}
          <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
        </div>
      </div>
    </Link>
  );
}

export default function Articles() {
  const { t, lang } = useI18n();
  const [articles, setArticles] = useState(null);
  const [error, setError] = useState(null);

  useDocumentSeo({
    title: `${t("articles.title")} — Viikinkitapahtumat`,
    description: t("articles.sub"),
    canonicalPath: "/articles",
    keywords: [
      "historianelävöitys",
      "viikingit",
      "artikkelit",
      "reenactment",
      "vikings",
      "blog",
    ],
  });

  useEffect(() => {
    api
      .get("/articles")
      .then((r) => setArticles(Array.isArray(r.data) ? r.data : []))
      .catch(() => setError("load_failed"));
  }, []);

  return (
    <div data-testid="articles-page" className="pb-20">
      <PageHero
        eyebrow={t("articles.title")}
        title={t("articles.title")}
        sub={t("articles.sub")}
      />

      <div className="mx-auto max-w-5xl px-4 sm:px-8 mt-10">
        {articles === null && !error && (
          <div className="grid gap-6 sm:grid-cols-2">
            {[0, 1].map((i) => (
              <div
                key={i}
                className="h-80 bg-viking-surface/60 animate-pulse rounded-sm"
              />
            ))}
          </div>
        )}
        {error && (
          <div className="text-center text-viking-stone py-12">
            {t("articles.empty")}
          </div>
        )}
        {articles && articles.length === 0 && (
          <div className="text-center text-viking-stone py-16" data-testid="articles-empty">
            {t("articles.empty")}
          </div>
        )}
        {articles && articles.length > 0 && (
          <div className="grid gap-6 sm:grid-cols-2" data-testid="articles-grid">
            {articles.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        )}
      </div>
      {/* lang dep keeps SEO refresh on locale change */}
      <span className="sr-only">{lang}</span>
    </div>
  );
}
