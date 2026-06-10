/**
 * Lightweight SEO helper. Pure DOM mutation — no React Helmet dependency.
 *
 * Usage in a page component:
 *
 *   useDocumentSeo({
 *     title: "Wikingerlager 2026 — Viikinkitapahtumat",
 *     description: "Viking event in Schleswig, Germany.",
 *     canonicalPath: "/events/abc-123",
 *     image: "https://.../cover.jpg",
 *     keywords: ["viikinkitapahtuma", "vikings", "reenactment"],
 *   });
 *
 * On unmount, restores the original document.title so the fallback (set in
 * /public/index.html) reappears when navigating back to a page that does not
 * call this hook.
 */
import { useEffect } from "react";

const SITE_BASE = "https://viikinkitapahtumat.fi";
const DEFAULT_TITLE = "Viikinkitapahtumat — viikingit, historianelävöitys, keskiaika";
const DEFAULT_DESC =
  "Viikinkitapahtumat.fi — pohjoismainen viikinki- ja rauta-aikatapahtumien kalenteri. Vikings, reenactment, living history events.";

function upsertMeta(selector, attr, name, content) {
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertLink(rel, href) {
  let el = document.head.querySelector(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

export function useDocumentSeo({
  title,
  description,
  canonicalPath,
  image,
  keywords,
  type = "website",
  jsonLd,
} = {}) {
  useEffect(() => {
    const finalTitle = title || DEFAULT_TITLE;
    const finalDesc = description || DEFAULT_DESC;
    const canonical = canonicalPath
      ? `${SITE_BASE}${canonicalPath.startsWith("/") ? canonicalPath : `/${canonicalPath}`}`
      : SITE_BASE;

    document.title = finalTitle;
    upsertMeta('meta[name="description"]', "name", "description", finalDesc);
    if (Array.isArray(keywords) && keywords.length) {
      upsertMeta(
        'meta[name="keywords"]',
        "name",
        "keywords",
        keywords.join(", "),
      );
    }
    upsertLink("canonical", canonical);

    upsertMeta(
      'meta[property="og:title"]',
      "property",
      "og:title",
      finalTitle,
    );
    upsertMeta(
      'meta[property="og:description"]',
      "property",
      "og:description",
      finalDesc,
    );
    upsertMeta('meta[property="og:url"]', "property", "og:url", canonical);
    upsertMeta('meta[property="og:type"]', "property", "og:type", type);
    if (image) {
      upsertMeta(
        'meta[property="og:image"]',
        "property",
        "og:image",
        image,
      );
      upsertMeta(
        'meta[name="twitter:image"]',
        "name",
        "twitter:image",
        image,
      );
    }

    upsertMeta(
      'meta[name="twitter:title"]',
      "name",
      "twitter:title",
      finalTitle,
    );
    upsertMeta(
      'meta[name="twitter:description"]',
      "name",
      "twitter:description",
      finalDesc,
    );

    // JSON-LD structured data. We tag our injected scripts so navigations
    // between SPA routes replace the previous block instead of stacking.
    const previous = document.head.querySelectorAll(
      'script[type="application/ld+json"][data-seo-injected="true"]',
    );
    previous.forEach((el) => el.parentNode?.removeChild(el));
    if (jsonLd) {
      const docs = Array.isArray(jsonLd) ? jsonLd : [jsonLd];
      docs.filter(Boolean).forEach((doc) => {
        const el = document.createElement("script");
        el.type = "application/ld+json";
        el.setAttribute("data-seo-injected", "true");
        el.text = JSON.stringify(doc);
        document.head.appendChild(el);
      });
    }
  }, [title, description, canonicalPath, image, keywords, type, jsonLd]);
}
