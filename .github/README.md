# CI / pre-commit hookit

## GitHub Actions — `backend-tests.yml`

Ajaa P1 regressiosuiten (26 testitapausta) automaattisesti:

- **Triggerit**: push main-haaraan, pull request (vain jos `backend/` muuttuu) ja manuaalinen `workflow_dispatch`
- **Aika**: ~2–3 min (Python + Mongo setup + 26 testiä)
- **Ympäristö**: Ubuntu + MongoDB 7 service container + Python 3.11 + pip-cache

### GitHub-secretit (vapaaehtoiset)
| Avain | Pakollinen | Selitys |
|---|---|---|
| `CI_JWT_SECRET` | ei (workflow käyttää inline-dummya) | Jos haluat CI:lle oman JWT-salaisuuden |

Muut "salaisuudet" (Resend, Emergent LLM, Expo) eivät ole pakollisia — testit eivät tee oikeita lähetyksiä, joten workflow käyttää dummy-arvoja.

### Mitä workflow tekee
1. Checkout
2. Python 3.11 + pip cache
3. `pip install -r backend/requirements.txt`
4. Kirjoittaa `backend/.env` ja `frontend/.env` (testikohtaiset arvot)
5. Käynnistää uvicorn portissa 8001 taustalle
6. Odottaa että `/api/events` vastaa
7. Seediroi admin-käyttäjän bcrypt-salasanahashilla (TEST_ADMIN_PASSWORD)
8. `pytest tests/test_p1_*.py -v`
9. Dumppaa uvicorn-lokin jos pytest fail
10. Sammuttaa backendin

### Manuaalinen ajo
GitHub UI → Actions → "Backend P1 regression suite" → Run workflow

---

## Pre-commit hook (paikallinen)

`.pre-commit-config.yaml` ajaa P1-suiten automaattisesti `git commit`-hetkellä, jos staged tiedostot koskevat `backend/`-kansiota.

### Asennus
```bash
pip install pre-commit
pre-commit install
```

### Tarvitset paikallisesti
- MongoDB ajossa (`mongodb://localhost:27017`)
- `export TEST_ADMIN_PASSWORD=TestAdmin123!` (sama kuin paikallisessa kannassasi)

### Manuaalinen ajo kaikkien tiedostojen yli
```bash
pre-commit run --all-files
```

### Hookin ohittaminen kerralla (vain hätätilanteessa)
```bash
git commit --no-verify -m "..."
```

---

## Lisähookit jotka voisivat olla seuraavia
- `eslint --fix` frontend-tiedostoille
- `ruff` python-tyylinilkutus
- `prettier --write` JSON-tiedostoille
- Mobile-puolen TypeScript-tarkistus
