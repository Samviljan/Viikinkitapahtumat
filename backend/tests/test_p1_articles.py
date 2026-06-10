"""
P1: Articles — list + detail + beta feedback.

The intro article and beta-tester article are auto-seeded on backend
startup with Gemini-generated hero images. These tests verify the
endpoints are wired correctly, both seeded articles are accessible,
and the beta feedback submission flow works.
"""
import pytest


SEEDED_SLUG = "mita-historianelavoitystapahtumassa-tapahtuu"
BETA_SLUG = "liity-mobiilisovelluksen-beta-testaajaksi"


class TestArticles:
    def test_list_returns_array(self, base_url, api_client):
        r = api_client.get(f"{base_url}/api/articles", timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)

    def test_seeded_article_present(self, base_url, api_client):
        r = api_client.get(f"{base_url}/api/articles", timeout=30)
        slugs = [a["slug"] for a in r.json()]
        assert SEEDED_SLUG in slugs, (
            f"intro article {SEEDED_SLUG!r} missing from /api/articles"
        )

    def test_detail_by_slug(self, base_url, api_client):
        r = api_client.get(f"{base_url}/api/articles/{SEEDED_SLUG}", timeout=30)
        assert r.status_code == 200
        a = r.json()
        assert a["slug"] == SEEDED_SLUG
        assert a["title_fi"].startswith("Mitä historianelävöitystapahtuma")
        # Body should be the full multi-paragraph article
        assert len(a["body_fi"]) > 1500
        # Localised titles populated for the 7 supported languages
        for lang in ("en", "sv", "da", "de", "et", "pl"):
            assert a.get(f"title_{lang}"), f"title_{lang} missing"

    def test_detail_404_for_unknown_slug(self, base_url, api_client):
        r = api_client.get(
            f"{base_url}/api/articles/does-not-exist-xyz",
            timeout=30,
        )
        assert r.status_code == 404

    def test_intro_article_has_gallery_or_cover(self, base_url, api_client):
        """Image generation is best-effort — but if EMERGENT_LLM_KEY is set
        on the backend (default in our envs) the article will have at least
        one image populated. This test allows the no-images path so the
        suite still passes in offline CI."""
        r = api_client.get(f"{base_url}/api/articles/{SEEDED_SLUG}", timeout=30)
        a = r.json()
        cover = a.get("cover_image_url") or ""
        gallery = a.get("gallery") or []
        has_any = bool(cover) or len(gallery) > 0
        # Either we have an image (LLM was available), or we have none
        # (LLM unavailable on backend). Both are acceptable; only assert that
        # the fields are at least the right TYPE.
        assert isinstance(gallery, list)
        if has_any:
            for url in [cover] + gallery:
                if url:
                    assert url.startswith("/api/uploads/article-images/") or url.startswith("http"), (
                        f"unexpected image URL shape: {url!r}"
                    )

    def test_article_images_served(self, base_url, api_client):
        """If the article has images, they must be reachable through the
        public serve endpoint with a 200 OK + image content-type."""
        r = api_client.get(f"{base_url}/api/articles/{SEEDED_SLUG}", timeout=30)
        a = r.json()
        for url in [a.get("cover_image_url")] + (a.get("gallery") or []):
            if not url:
                continue
            if url.startswith("/api/"):
                full = f"{base_url}{url}"
            else:
                full = url
            img_r = api_client.get(full, timeout=30)
            assert img_r.status_code == 200, (
                f"image {url} returned {img_r.status_code}"
            )
            assert img_r.headers.get("content-type", "").startswith("image/"), (
                f"image {url} bad content-type {img_r.headers.get('content-type')!r}"
            )


class TestBetaArticleAndFeedback:
    def test_beta_article_present(self, base_url, api_client):
        r = api_client.get(f"{base_url}/api/articles/{BETA_SLUG}", timeout=30)
        assert r.status_code == 200
        a = r.json()
        assert a["slug"] == BETA_SLUG
        assert a["title_fi"].startswith("Liity mobiilisovelluksen")
        # This is the key flag the frontend checks to render the form
        assert a.get("feedback_form_type") == "beta_app", (
            "feedback_form_type must be 'beta_app' so the form renders"
        )
        # Body contains the markdown-style headings the renderer understands
        assert "## Miksi beta-testaajia tarvitaan?" in a["body_fi"]
        assert "- asentaa sovelluksen Android-puhelimeen" in a["body_fi"]

    def test_beta_feedback_rejects_empty(self, base_url, api_client):
        r = api_client.post(
            f"{base_url}/api/feedback/beta-app",
            json={"message": ""},
            timeout=15,
        )
        assert r.status_code == 422

    def test_beta_feedback_rejects_invalid_email(self, base_url, api_client):
        r = api_client.post(
            f"{base_url}/api/feedback/beta-app",
            json={"message": "Hyvä!", "email": "not-an-email"},
            timeout=15,
        )
        assert r.status_code == 422
