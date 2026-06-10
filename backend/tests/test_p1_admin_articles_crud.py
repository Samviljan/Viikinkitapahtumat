"""
P1: Admin CRUD for articles + image upload.

Verifies the admin endpoints used by `AdminArticlesPanel`:
  POST   /api/admin/articles
  PATCH  /api/admin/articles/{slug}
  DELETE /api/admin/articles/{slug}
  POST   /api/admin/articles/{slug}/images
  DELETE /api/admin/articles/{slug}/images
  POST   /api/admin/articles/{slug}/translate
"""
import base64
import io
import pytest


def _tiny_png_bytes() -> bytes:
    """1×1 transparent PNG — smallest valid image we can attach."""
    return base64.b64decode(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAA"
        "C0lEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII="
    )


@pytest.fixture
def created_article(base_url, admin_client):
    """Create a throwaway test article + clean it up after the test."""
    payload = {
        "title_fi": "Pytest CRUD -testiartikkeli",
        "excerpt_fi": "Tämä artikkeli poistetaan testin lopuksi.",
        "body_fi": "Kappale yksi.\n\n## Otsikko\n\n- kohta a\n- kohta b\n\nKappale kaksi.",
        "auto_translate": False,
    }
    r = admin_client.post(f"{base_url}/api/admin/articles", json=payload, timeout=30)
    assert r.status_code == 200, r.text
    article = r.json()
    yield article
    # Best-effort cleanup
    try:
        admin_client.delete(
            f"{base_url}/api/admin/articles/{article['slug']}", timeout=15
        )
    except Exception:
        pass


class TestAdminArticlesCrud:
    def test_unauthenticated_create_rejected(self, base_url, api_client):
        r = api_client.post(
            f"{base_url}/api/admin/articles",
            json={"title_fi": "x", "body_fi": "y"},
            timeout=15,
        )
        # FastAPI returns 401 (no token) or 403 (anon user). Either is fine.
        assert r.status_code in (401, 403)

    def test_create_requires_title_and_body(self, base_url, admin_client):
        r = admin_client.post(
            f"{base_url}/api/admin/articles",
            json={"title_fi": "", "body_fi": ""},
            timeout=15,
        )
        assert r.status_code == 422

    def test_create_auto_generates_slug(self, base_url, admin_client):
        r = admin_client.post(
            f"{base_url}/api/admin/articles",
            json={
                "title_fi": "Ääkkösiä Sisältävä Otsikko",
                "body_fi": "Lyhyt runko.",
                "auto_translate": False,
            },
            timeout=30,
        )
        assert r.status_code == 200, r.text
        slug = r.json()["slug"]
        assert slug == "aakkosia-sisaltava-otsikko", f"unexpected slug: {slug}"
        admin_client.delete(f"{base_url}/api/admin/articles/{slug}", timeout=15)

    def test_create_rejects_duplicate_slug(self, base_url, admin_client, created_article):
        r = admin_client.post(
            f"{base_url}/api/admin/articles",
            json={
                "slug": created_article["slug"],
                "title_fi": "Sama slug",
                "body_fi": "rivi",
                "auto_translate": False,
            },
            timeout=15,
        )
        assert r.status_code == 409

    def test_patch_updates_only_provided_fields(self, base_url, admin_client, created_article):
        slug = created_article["slug"]
        r = admin_client.patch(
            f"{base_url}/api/admin/articles/{slug}",
            json={"excerpt_fi": "Päivitetty nosto"},
            timeout=15,
        )
        assert r.status_code == 200
        updated = r.json()
        assert updated["excerpt_fi"] == "Päivitetty nosto"
        # Body should remain unchanged
        assert updated["body_fi"] == created_article["body_fi"]
        assert updated["title_fi"] == created_article["title_fi"]

    def test_image_upload_sets_cover(self, base_url, admin_token, created_article):
        # Use requests.post directly because multipart upload requires a
        # different Content-Type than the JSON-default admin_client uses.
        import requests
        slug = created_article["slug"]
        files = {"file": ("tiny.png", _tiny_png_bytes(), "image/png")}
        r = requests.post(
            f"{base_url}/api/admin/articles/{slug}/images",
            headers={"Authorization": f"Bearer {admin_token}"},
            files=files,
            data={"kind": "cover"},
            params={"kind": "cover"},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["kind"] == "cover"
        assert body["url"].startswith("/api/uploads/article-images/article_")

        # Article doc should now have the URL
        r2 = requests.get(f"{base_url}/api/articles/{slug}", timeout=15)
        assert r2.json()["cover_image_url"] == body["url"]

    def test_image_upload_rejects_non_image(self, base_url, admin_token, created_article):
        import requests
        slug = created_article["slug"]
        files = {"file": ("ev.exe", b"\x4D\x5A binary garbage", "application/octet-stream")}
        r = requests.post(
            f"{base_url}/api/admin/articles/{slug}/images",
            headers={"Authorization": f"Bearer {admin_token}"},
            files=files,
            data={"kind": "cover"},
            params={"kind": "cover"},
            timeout=30,
        )
        assert r.status_code == 415

    def test_delete_removes_article_and_404s_subsequent_reads(
        self, base_url, admin_client, api_client
    ):
        # Create + delete in one shot (not using the fixture so cleanup is
        # not double-attempted).
        r = admin_client.post(
            f"{base_url}/api/admin/articles",
            json={
                "title_fi": "Poistettava artikkeli",
                "body_fi": "Hetken elossa.",
                "auto_translate": False,
            },
            timeout=30,
        )
        assert r.status_code == 200
        slug = r.json()["slug"]

        d = admin_client.delete(
            f"{base_url}/api/admin/articles/{slug}", timeout=15
        )
        assert d.status_code == 200
        assert d.json() == {"ok": True}

        gone = api_client.get(f"{base_url}/api/articles/{slug}", timeout=15)
        assert gone.status_code == 404

    def test_delete_unknown_article_404(self, base_url, admin_client):
        r = admin_client.delete(
            f"{base_url}/api/admin/articles/never-was-here", timeout=15
        )
        assert r.status_code == 404
