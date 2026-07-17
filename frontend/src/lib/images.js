/**
 * Resolve an image URL stored in the database for use in <img src>.
 * Local uploads are stored as relative paths like `/api/uploads/events/<id>.jpg`
 * — these need to be prefixed with REACT_APP_BACKEND_URL when rendered.
 * External URLs (`http(s)://…`) are returned unchanged.
 */
export function resolveImageUrl(url) {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) {
    return url;
  }
  // Static assets served by the frontend (e.g. seeded article images
  // committed to /public/article-images/) live at the current origin and
  // must NOT be prefixed with the backend URL — that would 404.
  if (url.startsWith("/article-images/") || url.startsWith("/event-images/") || url.startsWith("/pwa-icons/")) {
    return url;
  }
  const backend = process.env.REACT_APP_BACKEND_URL || "";
  return `${backend}${url}`;
}
