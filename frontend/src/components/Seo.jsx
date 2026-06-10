/**
 * Generic SEO meta tag injector — wraps react-helmet-async so individual
 * pages can declare per-route `<title>`, description, canonical URL,
 * Open Graph + Twitter card overrides and (optional) JSON-LD structured
 * data without duplicating Helmet boilerplate everywhere.
 *
 * The component is intentionally tiny and unopinionated: it only writes
 * the props passed to it. Defaults from `public/index.html` remain active
 * for any page that doesn't mount this component.
 */
import React from "react";
import { Helmet } from "react-helmet-async";

const SITE = "https://viikinkitapahtumat.fi";
const DEFAULT_IMG = `${SITE}/og-cover.jpg`;

export default function Seo({
  title,
  description,
  canonical,
  image,
  type = "website",
  locale = "fi_FI",
  jsonLd,
  noindex = false,
}) {
  const url = canonical
    ? canonical.startsWith("http")
      ? canonical
      : `${SITE}${canonical}`
    : undefined;
  const ogImage = image || DEFAULT_IMG;
  const ld = Array.isArray(jsonLd) ? jsonLd : jsonLd ? [jsonLd] : [];

  return (
    <Helmet>
      {title ? <title>{title}</title> : null}
      {description ? (
        <meta name="description" content={description} />
      ) : null}
      {noindex ? <meta name="robots" content="noindex, nofollow" /> : null}
      {url ? <link rel="canonical" href={url} /> : null}

      {/* Open Graph */}
      {title ? <meta property="og:title" content={title} /> : null}
      {description ? (
        <meta property="og:description" content={description} />
      ) : null}
      <meta property="og:type" content={type} />
      <meta property="og:locale" content={locale} />
      {url ? <meta property="og:url" content={url} /> : null}
      <meta property="og:image" content={ogImage} />

      {/* Twitter */}
      {title ? <meta name="twitter:title" content={title} /> : null}
      {description ? (
        <meta name="twitter:description" content={description} />
      ) : null}
      <meta name="twitter:image" content={ogImage} />

      {/* JSON-LD structured data — one or more script tags */}
      {ld.map((doc, i) => (
        <script type="application/ld+json" key={`jsonld-${i}`}>
          {JSON.stringify(doc)}
        </script>
      ))}
    </Helmet>
  );
}
