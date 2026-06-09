# Backend regression suite

Pytest-pohjainen regressiotestaus Viikinkitapahtumat-backendille.

## P1-suite (`test_p1_*.py`)

Kattaa kolme kriittistä viime viikkojen muutosta:

| Tiedosto | Kpl | Mitä testaa |
|---|---|---|
| `test_p1_reminders.py` | 5 | RSVP T-7 viikoittaiset muistutukset (oikea päivä, idempotenssi, dedup) |
| `test_p1_registration_url.py` | 3 | `registration_url`-kenttä event-mallissa (submit/get/admin-PUT) |
| `test_p1_email_templates.py` | 8 | Email-pohjien CRUD + autorisaatio (admin vs. anon) |
| `test_p1_substitution.py` | 7 | `substitute_event_vars` ja `substitute_recipient_vars` -helperit |
| `test_p1_newsletter_announcement.py` | 3 | `POST /api/admin/newsletter/announcement` |
| **Yhteensä** | **26** | |

## Suoritus

```bash
cd /app/backend
TEST_ADMIN_PASSWORD='ViikinkiAdmin2026!' python3 -m pytest tests/test_p1_*.py -v
```

Ajaminen kestää ~30–40 sekuntia. Kaikki testit ovat itse-siivoavia: ne luovat
oman datansa `p1test_`-prefixillä ja poistavat sen `p1_cleanup`-fixturessa.

### Vain yksi tiedosto

```bash
python3 -m pytest tests/test_p1_reminders.py -v
```

### Vain yksi testi

```bash
python3 -m pytest tests/test_p1_reminders.py::test_reminder_is_idempotent -v
```

### `-m p1` marker

Kaikilla P1-testeillä on `@pytest.mark.p1`. Voit ajaa vain ne markerilla
jos testikirjasto kasvaa muillekin osa-alueille:

```bash
python3 -m pytest -m p1 -v
```

## Vaatimukset

Pre-installed kontti-ympäristössä:

- `pytest>=9` ja `pytest-asyncio>=1.4`
- `requests` (HTTP-asiakas)
- `pymongo` (suora kannan luku)

## Ympäristömuuttujat

| Muuttuja | Pakollinen | Selitys |
|---|---|---|
| `TEST_ADMIN_PASSWORD` | KYLLÄ | admin@viikinkitapahtumat.fi -salasana |
| `TEST_ADMIN_EMAIL` | ei (oletus admin@viikinkitapahtumat.fi) | |
| `REACT_APP_BACKEND_URL` | ei (luetaan `/app/frontend/.env`:istä) | |
| `MONGO_URL`, `DB_NAME` | ei (luetaan `/app/backend/.env`:istä) | |

## Testidatan siivous

`conftest.py:p1_cleanup` poistaa kaikki dokumentit, joiden `id`, `event_id`,
`user_id`, `recipient_id` tai `email` alkaa prefixillä `p1test_`. Tämä takaa
että testit eivät jätä jälkiä tuotantokokoelmiin.

**Jos siivous epäonnistuu** (esim. agentti kaadetaan kesken ajon):

```bash
cd /app/backend && python3 -c "
import asyncio, sys; sys.path.insert(0, '.')
async def go():
    from server import db
    for c in ('users','events','event_attendees','email_templates','reminder_log','user_messages','message_log','newsletter_subscribers'):
        r = await db[c].delete_many({'id': {'\$regex': '^p1test_'}})
        r2 = await db[c].delete_many({'event_id': {'\$regex': '^p1test_'}})
        print(f'{c}: {r.deleted_count + r2.deleted_count}')
asyncio.run(go())
"
```

## Tunnetut rajoitukset

- **Push-lähetystä ei oikeasti varmenneta** — testikäyttäjillä ei ole laitteita.
  Testit varmistavat että `reminder_log` saa "inbox"-rivin, mikä takaa että
  job ajettiin koko polun läpi.
- **Sähköpostiakaan ei lähetetä oikeasti** — Resend-integraatio mokattu / yritys
  epäonnistuu hiljaa testidatalle ja kirjataan `skipped`-laskuriin. Tämä on
  tarkoitettu — emme halua roskapostia testikoneista.
- **Admin-tunnukset:** Jos brute-force-lukko lukitsee admin-tilin, suorita
  reset-skripti `/app/memory/test_credentials.md`-ohjeen mukaan.
