import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { useI18n, pickLocalized } from "@/lib/i18n";
import { resolveImageUrl } from "@/lib/images";
import { Sparkles, ArrowUpRight } from "lucide-react";

/**
 * Compact "What's new" strip — surfaces the latest 1-2 articles on the home
 * page so visitors notice new editorial content (e.g. the beta-tester CTA)
 * without having to navigate to /articles. Renders nothing while loading
 * and nothing if the API returns zero articles, so it never injects empty
 * space into the layout.
 */
export default function LatestArticlesStrip({ limit = 2 }) {
  const { t, lang } = useI18n();
  const [articles, setArticles] = useState(null);

  useEffect(() => {
    api
      .get("/articles")
      .then((r) => setArticles(Array.isArray(r.data) ? r.data.slice(0, limit) : []))
      .catch(() => setArticles([]));
  }, [limit]);

  if (!articles || articles.length === 0) return null;

  return (
    <section
      data-testid="latest-articles-strip"
      className="mx-auto max-w-7xl px-4 sm:px-8 pt-12"
    >
      <div className="flex items-end justify-between mb-6">
        <div className="flex items-center gap-3">
          <Sparkles className="text-viking-gold" size={18} />
          <div>
            <div className="text-overline mb-1">{t("home.whats_new")}</div>
            <h2 className="font-serif text-2xl sm:text-3xl text-viking-bone">
              {t("articles.title")}
            </h2>
          </div>
        </div>
        <Link
          to="/articles"
          data-testid="latest-articles-all-link"
          className="text-viking-gold font-rune text-[11px] tracking-[0.15em] uppercase hover:text-viking-bone transition-colors hidden sm:inline-flex items-center gap-1"
        >
          {t("home.view_all")} →
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {articles.map((article) => {
          const title = pickLocalized(article, lang, "title");
          const excerpt = pickLocalized(article, lang, "excerpt");
          const cover = article.cover_image_url
            ? resolveImageUrl(article.cover_image_url)
            : null;
          return (
            <Link
              key={article.id}
              to={`/articles/${article.slug}`}
              data-testid={`latest-article-${article.slug}`}
              className="group flex carved-card rounded-sm overflow-hidden hover:border-viking-gold/60 transition-colors min-h-[120px]"
            >
              {cover && (
                <div className="relative w-32 sm:w-40 flex-shrink-0 overflow-hidden bg-viking-shadow/40">
                  <img
                    src={cover}
                    alt=""
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-700"
                  />
                </div>
              )}
              <div className="flex-1 p-4 sm:p-5 flex flex-col justify-between">
                <div>
                  <div className="text-overline text-viking-gold mb-1.5 text-[10px]">
                    {t("home.new_label")}
                  </div>
                  <h3 className="font-serif text-base sm:text-lg text-viking-bone leading-snug mb-1.5 group-hover:text-viking-gold transition-colors line-clamp-2">
                    {title}
                  </h3>
                  {excerpt && (
                    <p className="text-viking-stone text-xs sm:text-sm leading-relaxed line-clamp-2">
                      {excerpt}
                    </p>
                  )}
                </div>
                <div className="inline-flex items-center gap-1 text-viking-gold font-rune text-[10px] tracking-[0.15em] uppercase mt-2 self-end">
                  {t("articles.read_more")}
                  <ArrowUpRight size={12} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
