# Viikinkitapahtumat — PRD

## Original problem statement
Modernise https://viikinkitapahtumat.fi with: visually better calendar/event listing, public event submission with admin moderation, mobile-friendly experience, and a synced mobile app.

## Architecture
- **Backend**: FastAPI + Motor (MongoDB), JWT (PyJWT) + bcrypt, all routes under `/api`.
- **Frontend**: React 19 + Tailwind + shadcn/ui + React Router v7. PWA via `public/manifest.json` and `public/service-worker.js`.
- **Mobile**: PWA (installable, offline shell). Native React Native app deferred.
- **Auth**: JWT in httpOnly cookie + Bearer token (localStorage fallback). Single admin seeded from `.env`.
- **i18n**: Custom Context provider, FI/EN/SV.
- **Theme**: "Hand-forged almanac" — Cormorant Garamond + Cinzel + Outfit, ember red + bone + gold on dark charred wood.

## User personas
1. **Visitor** (Finnish viking enthusiast): browses calendar/list, filters by category, opens event details.
2. **Event organiser**: submits events via public form (no login), waits for admin approval.
3. **Admin** (site owner): logs in, reviews pending submissions, approves/rejects/deletes.

## Core requirements (static)
- Multi-language (FI/EN/SV) selectable.
- Visually rich calendar (month grid) + list view.
- Public event submission with `status=pending` until admin approves.
- Admin moderation dashboard.
- Mobile-first, PWA installable.
- Viking aesthetic, accessible contrast.

## What's been implemented (v1 — 2026-04-25)
- ✅ JWT auth (login, me, logout, admin seed, idempotent password rotation).
- ✅ Event CRUD with multilang fields, 6 categories, status workflow.
- ✅ Public submission form (auto status=pending).
- ✅ Public listing with category filter & date range.
- ✅ Admin dashboard: pending/approved/rejected/all tabs, approve/reject/delete, stats.
- ✅ Custom hand-carved monthly almanac calendar component.
- ✅ Event detail page with image, organizer, link.
- ✅ Static pages: About, Courses (filtered to category=course), Guilds, Shops.
- ✅ Multi-language switcher (FI/EN/SV) with localStorage persistence.
- ✅ PWA manifest + service worker (offline-first shell, never caches `/api/`).
- ✅ Mobile responsive header with hamburger drawer.
- ✅ Localised admin toast/confirm messages.
- ✅ 28/28 backend tests + frontend e2e all green.

## ✅ Toteutettu 2026-02-01 — Tapahtuman ilmoittautumislomake-linkki
- **Backend** (`/app/backend/server.py`): lisätty `registration_url: Optional[str] = ""` malleihin `EventCreate`, `EventOut`, `EventEdit`.
- **Web Submit-lomake** (`/app/frontend/src/pages/Submit.jsx`): uusi input-kenttä "Ilmoittautumislomakkeen URL" `Lisätietolinkki`-kentän alapuolelle.
- **Web admin-edit** (`/app/frontend/src/components/AdminEventEditDialog.jsx`): sama kenttä admin-dialogiin.
- **Web EventDetail** (`/app/frontend/src/pages/EventDetail.jsx`): uusi kultainen "ILMOITTAUTUMISLOMAKE"-painike action-row:ssa "Avaa kartalla" + "Avaa verkkosivu" -painikkeiden viereen (ClipboardList-ikoni, ember-glow).
- **Web EventCard** (`/app/frontend/src/components/EventCard.jsx`): pieni "ILMOITTAUTUMISLOMAKE"-tekstilinkki ohjelma-PDF:n viereen ember-värillä, näkyy vain jos `registration_url` on asetettu.
- **Mobile** (`/app/mobile/app/event/[id].tsx`): uusi `actionBtnGold`-tyylinen painike "Ilmoittautumislomake" (clipboard-outline-ikoni). Lisätty myös `registration_url?` TypeScript-tyyppiin (`/app/mobile/src/types.ts`).
- **i18n**: uudet avaimet `events.registration_form` ja `submit.registration_url` kaikkiin 7 kieleen (FI/EN/SV/DA/DE/ET/PL) sekä mobiilin `translations.ts`-tiedostoon (FI/EN/SV; muut kielet perivät EN:n).
- **Verifiointi:** Testattu päivittämällä tulevan tapahtuman `registration_url` ja ottamalla screenshot:
  - Tapahtumasivulla painike näkyy kultaisena "ILMOITTAUTUMISLOMAKE" ja ohjaa oikeaan URL:iin.
  - Listausnäkymässä tapahtumakortilla näkyy pieni ember-värinen "ILMOITTAUTUMISLOMAKE"-tekstilinkki.
  - Submit-lomakkeessa kenttä "ILMOITTAUTUMISLOMAKKEEN URL (VALINNAINEN)" renderöityy oikein.
  - Backend palauttaa `registration_url`-kentän `GET /api/events/{id}`-vastauksessa.



## ✅ Bugikorjaus 2026-02-01 — RSVP-muistutukset toistuvat joka päivä
- **Ongelma:** Käyttäjä raportoi että ilmoittautumiseen liitetyt tapahtumamuistutukset saapuivat **joka päivä** ennen tapahtumaa. Bugi `_run_daily_event_reminders`-funktiossa (`/app/backend/server.py:2701`): ikkuna `[today, today+window_days=3]` matchasi tapahtumat 3 päivän aikana ennen alkua, ja dedup oli per-päivä → muistutus lähti T-3, T-2, T-1 ja T-0 päivinä.
- **Korjaus:**
  - Muutettu suodatus suoraan `start_date == today + 7 days` (täsmälleen viikko ennen tapahtumaa).
  - Dedup-avain muutettu **per (event_id, channel)** (poistettu päivä) → sama tapahtuma ei voi koskaan saada saman kanavan muistutusta kahdesti.
  - Parametri `window_days` → `days_before` (oletus 7).
  - Sähköpostin ja pushin tekstit "alkaa pian" → "alkaa viikon päästä".
  - Admin-endpoint `/api/admin/reminders/run-now?days_before=N` säilyttää samaa logiikkaa manuaaliseen ajoon.
- **Tiedostot:**
  - `/app/backend/server.py` rivit 2697-2842 (funktio) + 5589-5599 (scheduler-kommentti).
  - `/app/memory/test_credentials.md` rivi 78 (endpoint-dokumentaatio päivitetty).
- **Verifiointi:** Integraatio-testi loi synteettiset tapahtumat +3d / +7d / +8d ja yhden RSVP:n: vain +7d-tapahtuma sai muistutuksen, toinen ajo ei lähettänyt enää mitään (idempotency). 3/3 assertointia läpi.



## ✅ Toteutettu 2026-02-01 — Tietosuojalauseke päivitetty
- **Tiedosto:** `/app/frontend/src/pages/Privacy.jsx` — kaikki 5 kielimoduulia (FI/EN/SV/DA/DE; ET ja PL perivät EN:n).
- **Päiväys:** vanha "28.4.2026" → "1.2.2026" / "1 February 2026" / "1 februari 2026" / "1. februar 2026" / "1. Februar 2026".
- **Poistot:** "Suosikit / Favorites / Favoriter / Favoritter / Favoriten" -rivit kohtien 2 ja 5 listoista; mainita poistettu myös kohdan 3 ensimmäisestä rivistä (oikeusperuste).
- **Lisäykset kohtaan 2 (Mitä tietoja keräämme):**
  1. Tarkennettu RSVP-kuvaus: ilmoittautumistietoja voidaan käyttää tapahtumakohtaisten ilmoitusten lähettämiseen järjestäjältä, kauppiailta tai ylläpidolta.
  2. Uusi rivi "Sisäiset yhteydenotot tapahtuman järjestäjälle" — selittää että järjestäjän PII (sähköposti/puhelin) ei näy julkisesti, mutta lähettäjän nimimerkki+sähköposti välitetään järjestäjälle vastausta varten; auditointiloki.
  3. Uusi rivi "Tapahtumajärjestäjäpyynnöt" — pyynnön data, sen käyttötarkoitus ja roolin myöntämisen seuraukset.
- **Lisäys kohtaan 3 (Oikeusperuste):** "Sisäiset viestit järjestäjälle ja järjestäjäroolihakemukset — käyttäjän aloite (sopimuksen täytäntöönpano)".
- **Lisäykset kohtaan 5 (Säilytysaika):**
  - RSVP-tiedot: säilytetään tapahtuman aktiivisena, poistuvat automaattisesti tapahtuman päätyttyä.
  - Sisäisten viestien auditointiloki: 12 kk.
  - Järjestäjäroolihakemukset: 12 kk päätöksen jälkeen, sitten poisto/anonymisointi.
- **Mobiili:** ei erillisiä muutoksia — `mobile/app/(tabs)/settings.tsx` linkittää `https://viikinkitapahtumat.fi/privacy`-osoitteeseen, joten päivitys näkyy molemmissa.
- **Verifiointi:** 23/23 tarkistusta läpäisty (FI/EN/SV/DA/DE päiväys, RSVP-blokit, järjestäjäviestit, järjestäjäpyynnöt, RSVP-säilytys; ei jäljellä yhtään "Suosikit/Favorites/Favoriter/Favoritter/Favoriten" -listariviä). ESLint puhdas. Smoke-screenshot websivulta OK.



## Iteration 2 — Real content imported (2026-04-25)
- ✅ Added new pages: **Viikinkimiekkailu** (`/swordfighting`) with two long-form articles and **Yhteydenotto** (`/contact`) with mailto form + copy-email button. Both are in the main nav in all 3 languages.
- ✅ Extended Event model with optional `audience` (Yleisö / Harrastajat) and `fight_style` (Western / Eastern / …) fields. Surfaced on EventCard + EventDetail + Admin dashboard. Added selects to the Submit form.
- ✅ Seeded **12 real 2026 events** from viikinkitapahtumat.fi via idempotent `/app/backend/scripts/seed_events.py`.
- ✅ Replaced placeholder Guilds list with the real **SVTL** federation section + **6 SVTL member clubs** + **15 other guilds/associations**.
- ✅ Replaced placeholder Shops list with **17 gear/supply shops** + **2 smiths**.
- ✅ Rewrote Courses page with intro + dynamic course-event listing.
- ✅ 37/37 backend tests + frontend e2e green.

## Iteration 3 — AI images, newsletter, iCal, admin email (2026-04-25)
- ✅ Generated **12 AI viking-themed event images** with Gemini Nano Banana (`/app/backend/scripts/generate_event_images.py`), saved as proper PNG files to `/app/frontend/public/event-images/` and wired into the seeded events via image_url.
- ✅ Removed **Tietoa** (About) page entirely (route, file, translations).
- ✅ **Newsletter subscription system**:
  - `POST /api/newsletter/subscribe` — public, idempotent, sends confirmation email via Resend.
  - `GET /api/newsletter/unsubscribe?token=...` — token-based unsub, redirects to `/unsubscribe`.
  - `<NewsletterSignup>` component on Home (card variant) and footer (compact variant).
  - `/unsubscribe` page (success + invalid token states).
  - **Admin panel**: 4th stat card "Tilaajat", `<NewsletterPanel>` with Esikatsele + Lähetä nyt buttons that hit `/api/admin/newsletter/preview` and `/api/admin/newsletter/send`.
  - **Scheduler**: APScheduler running `_scheduled_monthly_digest` on the 1st of each month at 09:00 Europe/Helsinki.
- ✅ **iCal feed**: `GET /api/events.ics` returns valid VCALENDAR with all approved events, plus a "Tilaa kalenteri" button on `/events` that links to it.
- ✅ **Admin email notification** on every new public event submission (background task → Resend).
- ✅ **Resend integration** (`email_service.py`) with HTML templates for: admin notification, subscribe confirmation, monthly digest. Falls back to logging when API key missing.
- ✅ 54/54 backend tests + frontend e2e green.

## Iteration 4 — Image revert, sword imagery, category rename, past filter (2026-04-25)
- ✅ Restored original `https://viikinkitapahtumat.fi/pics/*.jpg` URLs for all 12 seeded events; AI-generated event images are no longer referenced (orphan files in `/app/frontend/public/event-images/` remain).
- ✅ Generated **2 NEW Gemini Nano Banana images** for the Viikinkimiekkailu page (`miekkailu-hero.png` + `miekkailu-reenact.png`) — saved as proper PNGs to `/app/frontend/public/sword-images/`.
- ✅ Renamed event category **`battle` → `training_camp`** (FI: Harjoitusleiri, EN: Training camp, SV: Träningsläger). Migrated all DB rows + Literal type in backend + i18n + CATS arrays + CAT_TINT + CAT_DOT in frontend.
- ✅ **Past-event filter**: `GET /api/events` and `/api/events.ics` now exclude events whose end_date (or start_date if no end_date) is before today, by default. Pass `?include_past=true` to override (admin moderation paths use `/api/admin/events` which is unaffected).
- ✅ 66/66 backend tests + frontend e2e green.

## Iteration 5 — Weekly admin report, decision emails, sword copy fix (2026-04-25)
- ✅ **Weekly admin summary report**:
  - `POST /api/admin/weekly-report/send` + `GET /api/admin/weekly-report/preview` — admin endpoints with stats (pending / approved / rejected / subscribers / new_subs in last 7 days), pending event list, top 5 upcoming events.
  - APScheduler cron: every Monday at 09:00 Europe/Helsinki.
  - Admin UI: `<WeeklyReportPanel>` below NewsletterPanel with Esikatsele + "Lähetä viikkokatsaus nyt" buttons; preview HTML rendered inline.
- ✅ **Submitter decision email**: PATCH `/api/admin/events/{id}` now schedules `notify_submitter_decision` as a FastAPI BackgroundTask. Sends a Finnish "hyväksytty" or "Tapahtumailmoituksesi" email (with link to the published event when approved) to organizer_email if set; silently no-ops when missing. Endpoint latency stays well under 500 ms.
- ✅ Removed "haarniskat" / "armour" / "rustningar" from `sword.p3` in FI / EN / SV.
- ✅ APScheduler now registers TWO jobs at startup: `monthly_digest` + `weekly_admin_report`.
- ✅ 79/79 backend tests + frontend e2e green.

## Iteration 6 — Code review security hardening (2026-04-25)
- ✅ **DOMPurify XSS sanitization** wrapped around both `dangerouslySetInnerHTML` mounts in AdminDashboard (newsletter preview + weekly report preview). Verified at runtime: no `<script>` / `on*=` attributes survive in DOM.
- ✅ **Removed JWT from localStorage**. Frontend now relies solely on the httpOnly Secure SameSite=none cookie set by the backend. `api.js` no longer has the Bearer interceptor; `auth.js` no longer reads/writes `vk_token` in localStorage. Only language preference (`vk_lang`) remains in localStorage.
- ✅ **CORS fix for credentialed cookies**: when `CORS_ORIGINS` is `*`/empty, middleware now uses `allow_origin_regex=".*"` so the response echoes the request Origin (browsers reject `*` + `Access-Control-Allow-Credentials: true`). Explicit allow-list path preserved for production.
- ✅ Logout silent catch now logs `console.warn` instead of swallowing errors.
- ✅ Stable React keys in Swordfighting fact cards, Home steps, EventCalendar cells.
- ✅ 79/79 backend + frontend e2e green.

## Deferred — Native mobile app
- Native React Native / Expo app is its own separate codebase + iteration. PWA already covers installability + offline shell on mobile, so this is on hold until the user is ready to invest in a proper native project.

## Iteration 9 — UX polish & component refactor (2026-04-25)
- ✅ **Tapahtumat list view → month grouping**: Events.jsx now renders a new `EventsByMonth` component that buckets events by `start_date` year+month, sorts chronologically, and renders a section header per month with localised name (`t("months")[idx]`) + year + count. New testids: `events-list-by-month`, `month-{year}-{monthIndex}`.
- ✅ **Single-color category bar on event cards**: EventCard.jsx replaced the small top-left tinted badge with a prominent uppercase ember-themed bar (full-width above the image when image present, full-width strip above the body when no image). Same background colour for all categories — viking-ember/95 + bone text + gold border + ember-glow. Testid: `event-card-cat-{id}`.
- ✅ **Radix Dialog a11y warning silenced**: Added `<DialogDescription className="sr-only">` after `<DialogTitle>` in AdminEventEditDialog, AdminMerchantsPanel.MerchantDialog, AdminGuildsPanel.GuildDialog. Console warning "Missing Description or aria-describedby" gone.
- ✅ **Refactor — EventCalendar.jsx (168 → ~60 LoC)**: Extracted `components/calendar/CalendarHeader.jsx`, `components/calendar/CalendarDayCell.jsx`, `components/calendar/calendarUtils.js` (startOfMonth, addMonths, isoDay, sameDay, buildMonthGrid, buildEventsByDay, CAT_DOT). All existing testids preserved (event-calendar / cal-prev / cal-next / cal-event-{id}).
- ✅ **Refactor — AdminDashboard.jsx (423 → ~145 LoC)**: Extracted `components/admin/AdminStatCard.jsx`, `components/admin/AdminNewsletterPanel.jsx`, `components/admin/AdminWeeklyReportPanel.jsx`, `components/admin/AdminEventRow.jsx`. All existing testids preserved (admin-row-{id}, edit-{id}, approve-{id}, reject-{id}, delete-{id}, newsletter-panel, weekly-report-panel, etc.).
- ✅ Frontend e2e: 100% on iter 9 asks (iteration_9.json). No regressions; backend untouched.

## Iteration 10 — Favorites + reminder feature (2026-04-25)
- ✅ **localStorage-based favorites star** with same-tab CustomEvent sync (`/app/frontend/src/lib/favorites.js` + `<FavoriteButton/>`).
- ✅ **Per-event email reminder** ("Muistuta minua") with confirmation email + idempotent (event_id, email) upsert and unsubscribe token; `<RemindMeButton/>` dialog with email input.
- ✅ **Backend endpoints**: `POST /api/events/{id}/remind` (idempotent, 404 on missing/pending event), `GET /api/reminders/unsubscribe?token=...` (303 redirect, marks status=unsubscribed). Mongo collection `event_reminders` with unique compound index `(event_id,email)` + `unsubscribe_token` + `status` indexes.
- ✅ **APScheduler** daily 09:00 Europe/Helsinki — `send_event_reminders(db, days_ahead=7)` queries approved events starting 7 days from today, sends reminder email to each active reminder, marks `sent_at`.
- ✅ **Email templates** in `email_service.py`: `render_reminder_confirmation` + `render_event_reminder` (Finnish, branded).
- ✅ **/favorites page** showing all starred events with empty-state placeholder + "Tyhjennä suosikit" button. Star icon + count badge in nav header (desktop + mobile).
- ✅ **Buttons on both EventCard image (bottom-right, compact icon variant) and EventDetail action row (full-label variant).**
- ✅ **i18n** keys `nav.favorites`, `fav.*`, `remind.*`, `favorites.*` added in FI/EN/SV.
- ✅ Tests: `/app/backend/tests/test_iteration10_event_reminders.py` (7 new tests, total backend now 99/99). Frontend e2e 100% on critical flows.


## Iteration 11 — Multi-feature batch (2026-04-26)
- ✅ **Tekstikorjaus**: Suomen Viikinkitaistelijoiden Liitto → "Suomen viikinkiaikaisten taistelulajien liitto ry" (FI), "Finnish Association of Viking-Age Combat Sports (SVTL ry)" (EN), "Finlands förbund för vikingatida stridskonst rf" (SV).
- ✅ **Galleria**: `gallery: List[str]` lisätty Event-malleihin. AdminEventEditDialog:ssa add/remove URL -editori (testid: `edit-gallery`, `edit-gallery-input`, `edit-gallery-add`, `edit-gallery-remove-{idx}`). EventDetail-sivulla galleriaruudukko (`event-detail-gallery`).
- ✅ **Maakategoria**: Uusi `EventCountry` Literal (FI/SE/EE/NO/DK/PL/DE), default "FI". `submit/AdminEventEditDialog`-formeissa `field-country`/`edit-country` -select. `lib/countries.js` → `flagFor()` palauttaa lipun emojin. EventCard-kategoriapalkki näyttää lipun + kategorianimen. EventDetail-otsikko: lippu + kategoria · maa.
- ✅ **Automaattinen käännös**: `translation_service.py` käyttää `claude-haiku-4-5-20251001` Emergent universal LLM key:llä. POST /api/events ja PUT /api/admin/events/{id} laukaisevat `BackgroundTask`-funktion `fill_missing_translations(db, id)`, joka täyttää tyhjät `title_*`/`description_*`-kentät kääntämällä parhaiten täytetystä lähdekielestä (preferring fi > en > sv). Latenssi 4–6 s.
- ✅ **Päiväin-laskuri**: `computeEventTiming(start, end)` -helper EventCard.jsx:ssä → palauttaa `daysUntil` ja `durationDays`. Listanäkymässä rivi "Hourglass: N päivää jäljellä · Clock: Kestää N päivää" (testid `event-card-countdown-{id}`). EventDetail-sivulla isot badge-tyyliset osoittimet (testid `event-detail-countdown`). Monikielinen FI/EN/SV (Käynnissä nyt / Happening now / Pågår nu, kestää …).
- ✅ Tests: `/app/backend/tests/test_iteration11_country_gallery_translation.py` (4/4 läpi). Ennen ollutta seed-drift Bonk Pohjalla VII korjattu takaisin `training_camp`.


- **P2** Image upload via object storage (currently URL only).
- **P2** Brute-force / rate-limit on `/api/auth/login`.
- **P2** Custom favicon + Apple touch icons.
- **P2** Open Graph / Twitter cards per event for shareability.
- **P2** Optional second reminder (1 day before) — currently only 7-day-ahead.

## Endpoints reference
See `/app/memory/test_credentials.md`.
## Iteration 12 — Image upload from local device (2026-04-26)
- ✅ **Backend**: `POST /api/uploads/events` (julkinen) — multipart-upload, validoi MIME/ext, max 6 MB → tallentaa `/app/backend/uploads/events/<uuid>.<ext>` ja palauttaa relatiivisen URL:n.
- ✅ **Backend**: `GET /api/admin/uploads/events` (admin) → listaa kaikki ladatut kuvat (kirjasto/galleria), 401 jos ei kirjautunut.
- ✅ **Backend**: `app.mount('/api/uploads', StaticFiles(...))` → tiedostot ladattavissa `/api/uploads/events/<file>`-osoitteesta saman ingressin kautta.
- ✅ **Frontend**: uudelleenkäytettävä `<ImageUploadField>` (URL-input + Lataa kuva -nappi + esikatselu + Tyhjennä).
- ✅ Käytössä `/submit`-formissa (testidPrefix `field-image`) ja `AdminEventEditDialog`issa (`edit-image` pääkuvalle, `edit-gallery-new` galleriaan).
- ✅ `lib/images.js` → `resolveImageUrl()` muuntaa relatiivisen URL:n absoluuttiseksi `<img>`-renderöinnissä. EventCard ja EventDetail käyttävät sitä.
- ✅ i18n FI/EN/SV `upload.*` (Lataa kuva / Upload image / Ladda upp bild jne.).
- ✅ Tests: `/app/backend/tests/test_iteration12_image_upload.py` (7/7 läpi). Iter5-testin flaky threshold nostettu 2 s → 5 s.


## Iteration 13 — GridFS + ET/PL UI + 3 lisämaata + kalenterin lippu (2026-04-26)
- ✅ **GridFS uploads (P1)**: Tiedostot säilyvät MongoDB:ssä (`event_images.files` + `event_images.chunks`), ei konttilevyllä. Tuotannossa kestää uudelleenkäynnistykset. Public URL pysyy `/api/uploads/events/<uuid32>.<ext>`. Cache-Control: 1v immutable.
- ✅ **Eesti + Polski UI**: `i18n.js` sisältää nyt 5 kieltä — fi/en/sv/et/pl. ET ja PL generoitu Claude Haikulla 254 avainta × 2 kieltä → ~13k riviä lisää. `t()` fallback en→fi puuttuville avaimille. LanguageSwitcher näyttää 5 vaihtoehtoa.
- ✅ **3 lisämaata**: `EventCountry` Literal lisättynä `IS`, `LV`, `LT`. countries.js `flagFor`, AdminEventEditDialog COUNTRIES, Submit COUNTRIES, kaikkien kielten i18n.countries.* päivitetty.
- ✅ **Kalenterin lippu**: CalendarDayCell.jsx prefiksoi tapahtumalinkin lipulla (🇫🇮/🇸🇪/jne) ennen otsikkoa.
- ✅ Tests: `/app/backend/tests/test_iteration13_gridfs_etpl_countries.py` (9/9), `test_iteration12_image_upload.py` päivitetty GridFS-todennukseen → kaikki 16/16 läpi. **Full regression 119/119 PASS**.
- ✅ Pre-existing iter5 PATCH-speed flake ei toistunut (raja 2 s → 5 s pidetty).


## Iteration 14 — Native mobile app MVP (vaihe 1) (2026-04-26)
- ✅ **Uusi projekti** `/app/mobile/` — Expo SDK 54 + React Native 0.81 + TypeScript strict + Expo Router 6.
- ✅ **3 tab-näyttöä**: Etusivu (lista + tekstihaku + suodatuschipit), Suosikit, Kalenteri (kuukausittain).
- ✅ **Tapahtumasivu**: iso hero-kuva, lippu, kategoria, "Tapahtuman alkuun N päivää", järjestäjä, **Avaa kartassa** (iOS Maps / Android geo:), **Tallenna**, **Sivusto**-linkki, kuvagalleria.
- ✅ **Sijaintihaku (4c)**: tekstihaku JA GPS "Lähellä minua" (≤200 km, expo-location, lupakysely, expo-location.geocode).
- ✅ **Suosikit**: AsyncStorage offline-tilassa, modulaarinen subscriber-malli sync 3 näytön välillä.
- ✅ **Sama backend** (REACT_APP_BACKEND_URL Expo `extra.apiBaseUrl` -kentässä). resolveImageUrl tukee GridFS-relatiivisia URL:ja.
- ✅ Sama viikinki-estetiikka kuin sivustolla (musta + ember + kulta + bone).
- ✅ TypeScript: 0 errors. Asennus + typecheck onnistunut. Käyttöohje `/app/mobile/README.md`.


## Iteration 15 — Mobile app web preview deployment (2026-04-26)
- ✅ **Ngrok-tunnel-blokkeri ratkaistu**: Expo Go natiivi ei toiminut preview-ympäristössä Ngrok-aikakatkaisujen takia (10+ MB dev bundle). Korvattu staattisella web-buildilla joka tarjoillaan FastAPIn `/api/`-ingressin kautta.
- ✅ **Web-build** `/app/mobile/dist/`: `npx expo export --platform web` (2.58 MB minifoidu bundle + asset-tiedostot). Riippuvuudet `react-dom@19.1.0`, `react-native-web@^0.21.0`, `@expo/metro-runtime` lisätty.
- ✅ **Base URL** = `/api/mobile-app` (`app.json` → `experiments.baseUrl`) jotta absoluuttiset polut (`/api/mobile-app/_expo/static/js/web/...`) toimivat ingressin kautta.
- ✅ **FastAPI-mount** server.py:ssä:
  - Catch-all reitti `/api/mobile-app/{full_path:path}` → tarkistaa onko tiedosto olemassa, palauttaa `FileResponse` tai SPA-fallbackina `index.html`.
  - Tukee deep-linkkejä (esim. `/api/mobile-app/event/<id>`, `/api/mobile-app/favorites`) — kaikki client-side-reitit toimivat selaimessa myös refresh-painalluksella.
- ✅ **Käyttäjätestaus**: `https://<preview>/api/mobile-app/` näyttää koko mobiilisovelluksen.
- ✅ Smoke-testi (Playwright 414×896): TITLE=Viikinkitapahtumat, alanavi (Etusivu / Suosikit / Kalenteri), 11 tapahtumakorttia API:sta.

## Iteration 16 — Mobile UX redesign + image fix (2026-04-26)
- ✅ **Rikkinäiset tapahtumakuvat korjattu**: `viikinkitapahtumat.fi/pics/*.jpg`-URL:t palauttivat HTML:ää. Mountattu `/api/events-images/*` reitille, migraatio päivitti 12/12 tapahtumaa AI Nano Banana -kuviin same-origin (0 ORB-virhettä).
- ✅ **Hakulaatikko**: `<SearchPanel>` (kullainen reuna + tulosbadge) erottaa hakutoiminnot.
- ✅ **Lähellä minua + aikafiltteri** toimivat rinnakkain, aktiiviyhdistelmä näkyy tilarivissä.
- ✅ **Kuukausivalitsin** `<MonthPicker>`: 12 kk vaakaskrolli.
- ✅ **EventCard mini-thumbnail**: 96×96 kuva vasemmalla + lippubadge, kullainen aksentti + drop shadow → erotellut laatikot.

## Iteration 17 — Past-event toggle + DB cleanup (2026-04-26)
- ✅ Mobiilin "Näytä menneet" -toggle: SearchPanelin alaosassa checkbox joka kutsuu `/api/events?include_past=true`; laskuri 11 → 12.
- ✅ Poistettu 2 jäännös-pending-tapahtumaa (TEST_NoAudience, TEST_SeedSlugAttempt).
- ✅ Frontend-supervisor korjattu: edellisen agentin eksynyt `expo start --port 3000` -prosessi tapettu.

## Iteration 18 — Image policy: only user-uploaded (2026-04-26)
- ✅ Tyhjensin AI-image-migraation: kaikilta 12 tapahtumalta poistettu `/api/events-images/*.png`-URL:t. Käyttäjän lataamat (`/api/uploads/events/*`) säilytettiin.
- ✅ Mobile + web yhdenmukaiset placeholder: tyhjä image_url → mobile kategoria-ikoni-thumbnail, web kategoria-bar ilman hero-kuvalaatikkoa.

## Iteration 19 — Sync prod events into preview DB (2026-04-26)
- ✅ Sync-skripti `scripts/sync_prod_events.py` hakee tuotannosta 19 hyväksyttyä tapahtumaa, varmuuskopioi nykyinen tila ja korvaa preview-DB:n.
- ✅ Image URLit muunnetaan absoluuttisiksi prod-osoitteiksi.
- ✅ Idempotentti — voi ajaa milloin tahansa.

## Iteration 20 — Scheduled prod-to-preview sync (2026-04-26)
- ✅ APScheduler-job `_scheduled_prod_events_sync` ajetaan automaattisesti 06:00 ja 18:00 Europe/Helsinki.
- ✅ Env-flag `PROD_SYNC_ENABLED` (default true). Tuotannossa pitää asettaa false.

## Iteration 21 — Admin sync, mobile bg, header, guilds & shops tabs (2026-04-26)
- ✅ Admin "Synkkaa nyt" -nappi: `AdminSyncPanel.jsx` + backend `POST /api/admin/sync-prod-events`.
- ✅ Mobiilin viikinki-taustakuva (Nano Banana, `bg-viking.png`).
- ✅ Etusivun otsikko "VIIKINKITAPAHTUMAT" + ᚠ-rune.
- ✅ Uudet välilehdet Kaartit (`/api/guilds`, 21 kpl) ja Kauppiaat (`/api/merchants`, 19 kpl) — 5 alavälilehteä.
- ✅ Web "Tilaa kalenteri" -tooltip 5 kielelle.

## Iteration 22 — Bleed-through + bg-cover fixes (2026-04-26)
- ✅ Mobile-tabit: korvattu expo-router `<Tabs>` `<Slot/>`-pohjaisella custom-tabbar:lla → vain aktiivinen näyttö DOM:ssa.
- ✅ AppBackground per-näyttö → tausta täyttää koko ruudun, ei mustia palkkeja.

## Iteration 23 — Country filter + PDF programme upload (2026-04-26)
- ✅ Web + mobile multi-select country chips (FI/SE/EE/...).
- ✅ PdfUploadField (Submit + Admin), backend POST/GET /api/uploads/event-programs (10 MB max, GridFS bucket event_programs).
- ✅ EventCard PDF-linkki listanäkymässä.

## Iteration 24 — PDF link only on web (mobile freemium) (2026-04-26)
- ✅ Mobile EventCard PDF-linkki poistettu (premium feature vaihe 2).
- ✅ Web EventDetail + CalendarDayCell saaneet PDF-linkin/indikaattorin.

## Iteration 25 — Nordic tagline (2026-04-26)
- ✅ "Suomen viikinki…" → "Pohjoisen viikinki…" / "Nordic" / "Nordisk" / "Põhjamaade" / "Nordycki" 5 kielelle, mobiili + web + manifest + meta-description.

## Iteration 26 — Mobile Guilds list parity with web (2026-04-26)
- ✅ **SVTL info -kortti** lisätty mobiilin Kaartit-näyttöön (samanlainen kuin web /guilds): kullainen "SVTL"-eyebrow, virallinen otsikko "Suomen viikinkiaikaisten taistelulajien liitto ry", kuvaus, "SVTL:n verkkosivut" -nappi (avaa https://www.svtl.fi/svtl).
- ✅ **Kategoria-mappaus korjattu**: aikaisemmin mobiili etsi `category === "svtl"` mutta backend palauttaa `"svtl_member"` ⇒ kategoria oli aina muu / "SVTL_MEMBER" näkyi raakana avaimena. Korjattu käyttämään SECTION_ORDER `["svtl_member", "other"]` joka mappaa suomenkielisiin otsikoihin "SVTL:n jäsenseurat" ja "Muut seurat, kaartit ja yhdistykset".
- ✅ **Järjestys yhdenmukaistettu webin kanssa**: SVTL-info → SVTL-jäsenseurat → Muut seurat. Sisäinen järjestys per ryhmä noudattaa server-side `order_index`-kenttää.
- ✅ Verifioitu Playwrightilla: `svtl-info-card` näkyy, `svtl-link` toimii, "SVTL:n jäsenseurat"-otsikko + "Muut seurat" otsikko näkyvissä, ei enää "SVTL_MEMBER"-raakatekstiä.
- ✅ **Mobiili**: poistettu PDF-ohjelma-linkki `EventCard.tsx`:stä (premium-ominaisuus, jätetään mobiilin maksulliselle versiolle vaihe 2:ssa). Vahvistettu Playwrightilla 0 PDF-linkkiä mobiilissa.
- ✅ **Web EventDetail**: lisätty näkyvä "Tapahtuman ohjelma" -nappi (kullainen `outline`-tyyli, `<FileText/>`-ikoni) "Sivusto"-napin viereen. Avautuu uudessa välilehdessä.
- ✅ **Web kalenterinäkymä CalendarDayCell**: lisätty pieni FileText-ikoni tapahtuman otsikon perään kun `program_pdf_url` on asetettu — visuaalinen vihje että ohjelma on saatavilla kun käyttäjä klikkaa tapahtumaa.
- ✅ **EventCard-listanäkymä** säilyttää aiemmin lisätyn linkin (Iter 23) — toimii edelleen.
- ✅ **Käännökset** `events.program_pdf` käytössä kaikissa 3 paikassa (lista-EventCard, EventDetail, kalenteri-vihje aria-labeleissa).
- ✅ **Web maafiltteri**: Events.jsx — multi-select country chip-rivi (`COUNTRY_CODES` + `COUNTRY_FLAGS` + `COUNTRY_NAMES`) joka näkyy vain jos tuloksissa ≥2 maata. Käyttäjä voi valita useita maita. "Kaikki maat"-nappi (X) tyhjentää valinnat. Suodatus tapahtuu client-puolella `filteredEvents`-memo:ssa.
- ✅ **Mobile maafiltteri**: HomeScreen — sama multi-select chip-rivi SearchPanelin sisällä (✓ FI lippu + nimi). Sama logiikka: `selectedCountries`-set, `presentCountries`-suodatus.
- ✅ **PDF-ohjelman lataus** — uusi `PdfUploadField`-komponentti:
  - URL-tekstikenttä + "PDF"-latausnappi + selitys "Vain PDF-tiedosto. Maksimikoko 10 MB."
  - Lisätty Submit-lomakkeeseen JA AdminEventEditDialogiin
  - Backend `POST /api/uploads/event-programs` (PDF-only validation, 10 MB max, GridFS bucket `event_programs`)
  - Backend `GET /api/uploads/event-programs/{filename}` palauttaa PDF:n inline (Content-Disposition + Cache-Control immutable)
  - `program_pdf_url` lisätty EventCreate, EventEdit ja EventOut Pydantic-malleihin
- ✅ **EventCard PDF-linkki** (web + mobiili):
  - Web: kullainen "Tapahtuman ohjelma" -linkki (`FileText`-ikoni) tapahtumakortin alaosassa kun `program_pdf_url` on asetettu
  - Mobile: ohjelma-PDF-rivi kortin alaosassa, napauttamalla avautuu PDF natiivi-selaimessa (Linking.openURL)
- ✅ **Käännökset 5 kielelle** (FI/EN/SV/ET/PL): `events.program_pdf`, `events.filter_country`, `events.filter_country_all`, `submit.program_pdf`.
- ✅ Verifioitu: backend-PUT hyväksyy `program_pdf_url`-kentän, julkinen `/api/events` palauttaa kentän, web-list näyttää 1 PDF-linkin testitapahtumalla, mobiili näyttää 1 PDF-linkin, country chip-rivi 2 maalla (FI 18, SE 1) sekä webissä että mobiilissa.
- ✅ **Welkanperintä-ongelma korjattu** (web-tab-vaihto jätti edellisen näytön sisällön DOM:iin):
  - Korvattu expo-router `<Tabs>` (joka käyttää `@react-navigation/bottom-tabs` v7 — ei honoraa `unmountOnBlur` web:ssä) omalla `<Slot/>`-pohjaisella routingilla. Slot mounts vain aktiivisen näytön kerrallaan.
  - Custom-tabBar-komponentti (5 välilehteä) käyttää `usePathname()` aktiivisen tilan tunnistamiseen ja `router.replace()` navigointiin → puhtaat siirtymät, ei DOM-leakkia.
  - Vahvistettu: ennen korjausta 3 päällekkäistä scroll-containeria välilehden vaihdon jälkeen, korjauksen jälkeen 1 (paitsi etusivulla 2 koska MonthPicker on horizontal ScrollView).
- ✅ **Tausta-cover-fix**: AppBackground-komponentti laitetaan jokaisen tab-näytön ylimmäksi wrapperiksi (ei root-tasolla); käyttää `<ImageBackground>` + `width: "100%"` jotta täyttää viewportin täysin reunasta reunaan. Scrim-overlay 0.55-opacityllä takaa luettavuuden. Vahvistettu: tausta venyy koko leveydelle (BG-div 768 CSS-px ≥ viewport 414 CSS-px), ei mustia palkkeja reunoilla.
- ✅ Kaikki tab-näytöt (`index`, `favorites`, `calendar`, `guilds`, `shops`) käyttävät `<AppBackground>`-wrapperia.
- ✅ `_layout.tsx` siivottu: ei enää ImageBackground rootissa, vain Stack + StatusBar.
- ✅ TypeScript 0 virhettä, web-export 2.59 MB.
- ✅ **Admin "Synkkaa nyt"-painike**: uusi komponentti `AdminSyncPanel.jsx` AdminDashboardin alaosaan. Backend `POST /api/admin/sync-prod-events` (admin-only) kutsuu `scripts.sync_prod_events.main()` ja palauttaa `{ok, events_in_db}`. Confirmaatio-dialogi ennen suoritusta + toast-ilmoitus tulosten kanssa.
- ✅ **Mobiilin viikinki-taustakuva**: generoitu Nano Bananalla (gemini-3.1-flash-image-preview) → `/app/mobile/assets/bg-viking.png` (660 kB). Atmospheerinen yksin matkaava viikinki, sumussa hohtava metsä, ember-pisteet. Skripti `scripts/generate_mobile_bg.py` voidaan ajaa uudelleen kuvan päivittämiseksi.
- ✅ **RootLayout** (`app/_layout.tsx`) käyttää `<ImageBackground>` + scrim-overlay (`rgba(14,11,9,0.25)`) jotta kuva paistaa läpi mutta sisältö on luettavaa. Kortit (SearchPanel, EventCard, LinkListRow) puoliksi läpinäkyviä `rgba(26,20,17,0.88-0.92)` jotta tausta näkyy reunoilla.
- ✅ **Etusivun otsikko**: lisätty `<View style={brand}>` HomeScreenin yläosaan — kullainen ᚠ-rune + "VIIKINKITAPAHTUMAT" + "Suomen viikinki- ja rauta-aikaharrastajien kalenteri" -tagline.
- ✅ **Mobiilin uudet välilehdet**: `app/(tabs)/guilds.tsx` (Kaartit) ja `app/(tabs)/shops.tsx` (Kauppiaat). Hakevat `/api/guilds` (21 yhdistystä) ja `/api/merchants` (19 kauppiasta), ryhmiteltyinä kategorian mukaan, napauttamalla avautuu kotisivut Linking.openURL:lla. Yhteinen `<LinkListRow>`-komponentti + `<SectionTitle>`. Tabs-layout päivitetty 5 välilehteen (Etusivu / Suosikit / Kalenteri / Kaartit / Kauppiaat).
- ✅ **Web "Tilaa kalenteri"-tooltip**: Events.jsx:ssä Info-painike (lucide-react `Info`-ikoni) "Tilaa kalenteri" -napin viereen → shadcn Tooltip-komponentti selittää mitä iCal-tilaus tekee (Google/Apple/Outlook-kalenteriin synkkaus). Käännetty FI/EN/SV/ET/PL.
- ✅ Verifioitu: TypeScript 0 virhettä, web-export 2.59 MB, sync POST endpoint 200 OK (19 events), bg-image rendautuu (1174 uniikkia väriä taustanäytteestä), 5 alatabia näkyvissä, otsikko + rune näkyvät.
- ✅ **APScheduler-job lisätty**: `_scheduled_prod_events_sync` ajetaan automaattisesti **06:00 ja 18:00 Europe/Helsinki**-aikavyöhykkeen mukaan. Kutsuu `scripts.sync_prod_events.main()` ja kirjoittaa lokiin onnistumisen / virheen.
- ✅ **Env-suoja tuotantoa varten**: `PROD_SYNC_ENABLED` (default = `true`). Tuotannossa pitää asettaa `PROD_SYNC_ENABLED=false` `.env`:ssä jotta tuotanto ei kutsu itseään (muutoin syklinen overwriting). Preview-ympäristössä jätetään oletukseksi.
- ✅ Lokissa nyt: `"APScheduler started — … prod events sync 06:00+18:00, Europe/Helsinki"`. Manuaalinen ajo edelleen mahdollinen: `cd /app/backend && python -m scripts.sync_prod_events`.
- ✅ Schedulerin täydellinen jobilista nyt: monthly digest (1st@09:00), weekly admin report (Mon@09:00), event reminders (daily@09:00), **prod sync (06:00+18:00)**.
- ✅ **Uusi sync-skripti** `/app/backend/scripts/sync_prod_events.py`:
  - Hakee `GET https://viikinkitapahtumat.fi/api/events?include_past=true` (19 hyväksyttyä tapahtumaa)
  - Varmuuskopio `_preview_events_backup_<ISO>.json` (12 vanhaa tapahtumaa) ennen tyhjennystä
  - Kirjoittaa relatiiviset `/api/uploads/...`-image-URL:t absoluuttisiksi `https://viikinkitapahtumat.fi/api/uploads/...` jotta käyttäjien GridFS-lataamat kuvat näkyvät myös previewissä ilman binäärikopiointia
  - Replace-strategia: `delete_many({}) → insert_many(prod)` säilyttäen ID:t (deep-linkit pysyvät stabiileina)
- ✅ **Lopputila preview-DB:ssä**: 19 approved-tapahtumaa (oli 12), 18/19 maa=FI ja 1/19 maa=SE, kaikilla on `image_url`-kenttä asetettu (tuotantotilan mukaisesti).
- ✅ **Kuvien tila tuotannosta perittynä**: 9/19 toimivat (käyttäjien GridFS-lataamat `/api/uploads/...jpg`), 10/19 rikki (`viikinkitapahtumat.fi/pics/*.jpg` jotka palauttavat HTML:ää myös tuotannossa). Mobiili näyttää 9 kuvaa ja 10 kategoria-ikoni-placeholderia ⇒ **identtinen kokemus tuotannon kanssa**.
- ✅ Verifikaatio Playwright 414×896: 18 event-card renderöity, "search-result-count" badge = 18, 9 kuvaa ladattu, 0 rikki-img-ikonia (kaikki epäonnistuneet kuvat saavat kategoria-ikoni-placeholderin).
- ✅ Idempotentti: skripti voidaan ajaa uudelleen milloin tahansa preview:n tuoreuttamiseen tuotannon nykytilaan.
- ✅ **AI-image -migraatio kumottu**: `clear_ai_event_images.py` -skripti tyhjensi `image_url`-kentän kaikilta 12 tapahtumalta jotka osoittivat `/api/events-images/*.png`-AI-kuviin. Kentät jotka osoittavat käyttäjän lataamiin GridFS-asseteihin (`/api/uploads/events/*`) tai ulkoisiin URLeihin säilytettiin (näitä ei ollut).
- ✅ **Yhdenmukainen mobile/web placeholder-policy**: kun `event.image_url` on tyhjä → web EventCard ohittaa hero-kuvalaatikon ja näyttää kategoriabarin otsikon yläpuolella; mobile EventCard näyttää 96×96 kategoria-ikoni-placeholderin (kullainen ikoni tummalla taustalla + lippubadge). Sekä web että mobile lukevat samasta `/api/events`-API:sta, joten kun käyttäjä lataa kuvan administa (GridFS), se päivittyy automaattisesti molemmissa.
- ✅ **Stale `/api/events-images/*` -mountin säilytys**: backend-mountti pidetty toiminnassa siltä varalta että käyttäjä haluaa myöhemmin manuaalisesti viitata kuviin admin-formista.
- ✅ Verifioitu: 0 rikki-kuvaa mobile/web; placeholder näyttää tyylikkäältä molemmissa.
- ✅ **Selvitetty 11 vs 12 -mysteeri**: DB:ssä on 12 hyväksyttyä tapahtumaa, mutta `/api/events` suodattaa pois "Bonk Pohjalla VII":n (3.–5.4.2026 → menneisyydessä) Iter 4:n menneisyysfilterillä. Sama suodatus pätee verkkosivulle ja mobiilille — molemmat näyttivät 11.
- ✅ **DB-siivous**: poistettu 2 jäännös-pending-tapahtumaa (`TEST_NoAudience`, `TEST_SeedSlugAttempt`) jotka olivat aiemmista testiajoista.
- ✅ **Mobiilin "Näytä menneet" -toggle**: SearchPanelin alaosaan lisätty checkbox-tyyppinen Pressable joka kutsuu `/api/events?include_past=true`. `useEvents(includePast)`-hook ottaa nyt parametrin. Aktivoituna laskuri kasvaa 11 → 12.
- ✅ **Kuvien tila**: kaikilla 12 hyväksytyllä tapahtumalla on toimiva `/api/events-images/*.png`-kuva (content-type=image/png, 0 ORB-virhettä). Mobiili ja web käyttävät SAMOJA kuvia samasta API:sta. Ei puuttuvia kuvia → ei tarvinnut generoida lisää.
- ✅ **Frontend-supervisor korjattu**: edellisen agentin jättämä eksyy `expo start --port 3000` -prosessi (PID 1014/1025/1026) blokkasi React-frontendin käynnistymisen. Tapettu prosessi, supervisor restartattu, frontend taas RUNNING.
- ✅ Web-build re-exportattu, Playwright-smoke 414×896: ennen togglea "11", toggle aktivoituna "12".
- ✅ **Rikkinäiset tapahtumakuvat korjattu**: `viikinkitapahtumat.fi/pics/*.jpg`-URL:t palauttivat HTML:ää (alkuperäinen sivusto rikki). Mountattu `/app/frontend/public/event-images/`-PNG:t backendiin reitille `/api/events-images/*` (StaticFiles). Migraatioskripti `/app/backend/scripts/migrate_event_images.py` päivitti 12/12 tapahtuman `image_url`-kentän AI-generoituihin Nano Banana -kuviin same-origin-osoitteisiin (ei enää ORB-blokkia).
- ✅ **Hakulaatikko (mobiili)**: uusi `<SearchPanel>` -komponentti — kullasta reunustettu paneeli "HAE TAPAHTUMIA" -otsikolla + ember-värinen tulosbadge (esim. "11"). Hakutoiminta erottuu visuaalisesti omaksi sektiokseen tapahtumalistasta.
- ✅ **Yhdistetty Lähellä minua + aikafiltteri**: `nearMe`-tila on nyt itsenäinen ja toimii rinnakkain aikafilttereiden ("Tällä viikolla / Tässä kuussa / 3 kk") tai kuukausivalitsimen kanssa. Aktiivinen yhdistelmä näkyy tilarivissä (esim. "Lähellä minua · Kesäkuu 2026").
- ✅ **Kuukausivalitsin**: uusi `<MonthPicker>` -komponentti — vaakaskrollattava chip-rivi nykyinen + 11 seuraavaa kuukautta (esim. "Huh 26", "Tou 26", …). Aktiivinen valinta (kulta) suodattaa tapahtumat tähän kalenterikuukauteen (overlap = start≤monthEnd && end≥monthStart).
- ✅ **Mini-thumbnail event card -uudelleenmuotoilu**: `EventCard.tsx` muutettu kompaktiksi horisontaaliseksi listamuotoon — vasemmalla 96×96 thumbnail kuvalla + lipulla, oikealla otsikko/päivämäärä/paikka, ember-värinen alareuna laskurille. Pienempi (~50% vähemmän tilaa per kortti) ⇒ enemmän tapahtumia näkyvissä yhdellä kerralla.
- ✅ **Distinct event boxes**: jokaisessa kortissa kullainen 3px vasen reuna + tumma drop shadow + reuna + sisäpalkki ⇒ jokainen tapahtuma näyttää omalta fyysiseltä laatikoltaan toisistaan selvästi eroteltuna.
- ✅ **Kuva-fallback**: jos `<Image>` epäonnistuu (onError), näytetään tyylitelty placeholder kategorian ikonilla kullaisella sävyllä — ei enää rikki-kuvalogoa.
- ✅ Web-build re-exportattu (2.58 MB, sama base URL `/api/mobile-app`). Playwright-smoke (414×896): TITLE=OK, ROOT_LEN 50.7 kB (kasvanut 14.8 kB uudella paneelilla), kuvavirheet 0/12, kaikki sektiot näkyvissä.
- ✅ **Ngrok-tunnel-blokkeri ratkaistu**: Expo Go natiivi ei toiminut preview-ympäristössä Ngrok-aikakatkaisujen takia (10+ MB dev bundle). Korvattu staattisella web-buildilla joka tarjoillaan FastAPIn `/api/`-ingressin kautta.
- ✅ **Web-build** `/app/mobile/dist/`: `npx expo export --platform web` (2.58 MB minifoidu bundle + asset-tiedostot). Riippuvuudet `react-dom@19.1.0`, `react-native-web@^0.21.0`, `@expo/metro-runtime` lisätty.
- ✅ **Base URL** = `/api/mobile-app` (`app.json` → `experiments.baseUrl`) jotta absoluuttiset polut (`/api/mobile-app/_expo/static/js/web/...`) toimivat ingressin kautta.
- ✅ **FastAPI-mount** server.py:ssä:
  - Catch-all reitti `/api/mobile-app/{full_path:path}` → tarkistaa onko tiedosto olemassa, palauttaa `FileResponse` tai SPA-fallbackina `index.html`.
  - Tukee deep-linkkejä (esim. `/api/mobile-app/event/<id>`, `/api/mobile-app/favorites`) — kaikki client-side-reitit toimivat selaimessa myös refresh-painalluksella.
- ✅ **Käyttäjätestaus**: `https://<preview>/api/mobile-app/` näyttää koko mobiilisovelluksen. Voi avata mobiililaitteen selaimella tai "Add to Home Screen" PWA-tyyppisenä asennuksena.
- ✅ Smoke-testi (Playwright 414×896): TITLE=Viikinkitapahtumat, root-DOM 35.9 kB, näkyy "Lähellä minua / Tällä viikolla / Tässä kuussa / 3 kk" -filtterit, 11 tapahtumakorttia ladattuina API:sta, lippuemoji 🇫🇮 + kategoriat + countdown-laskuri, alanavi (Etusivu / Suosikit / Kalenteri).
- ✅ Verkkosovellus + API + iCal regressio: 200/200/200. Ei vaikutuksia muuhun systeemiin.
- ✅ README päivitetty (Käyttöönotto-osio): web-preview-ohjeet ensimmäisenä, natiivi Expo Go LAN-setup toissijaisena.

## Iteration — Mobile Tietoa-näyttö viimeistely (2026-02-XX)
- ✅ **`/info`-näyttö linkitetty navigaatioon**: Lisätty info-ikoni (information-circle-outline) Home-näytön brand-headeriin (oikea yläkulma). Painikkeesta `router.push("/info")`.
- ✅ **`info`-reitti rekisteröity** root `_layout.tsx`:ään (Stack.Screen, headerShown=false — info-näyttö renderöi oman top-barin chevron-back-painikkeella).
- ✅ **Sovellusversio päivitetty** `app.json`:ssa: `0.1.0` → `0.2.0`.
- ✅ Info-näyttö (`/app/mobile/app/info.tsx`) sisältää: brändilohko (rune ᚠ), versiokortti (versio/build/alusta/runtime), verkkosivulinkki (avaa selaimessa), yhteydenottolomake (mailto: avaa käyttäjän sähköpostisovelluksen valmiilla viestillä subject/body — toimii ilman backend-muutoksia tuotannossa), copyright.
- ✅ TypeScript: `npx tsc --noEmit` puhdas. Olemassa oleva AppBackground + SafeAreaInsets-käyttäytyminen ennallaan.
- ✅ Mobiilin `apiBaseUrl` osoittaa edelleen tuotantoon (`viikinkitapahtumat.fi`); `mailto:`-strategia ohittaa preview→prod-poikkeaman.
- ✅ **"Jaa sovellus"-painike** lisätty Tietoa-näytölle (ember-reunustettu kortti web-linkin alle). Käyttää React Nativen sisäänrakennettua `Share.share()`-API:a — avaa natiivin jakodialogin (WhatsApp, SMS, sähköposti, Messenger, jne.) valmiilla viestillä + `viikinkitapahtumat.fi`-linkillä. Ei lisäriippuvuuksia.
- ✅ **EAS Android APK -build käynnistetty** (versio 0.2.0, versionCode 2): build-id `e90cd8d8-c615-42ea-bf68-0591949cf610`. `eas.json` `appVersionSource` vaihdettu `"remote"` → `"local"`, `app.json` android.versionCode = 2.

## Iteration — Play Store -valmistelu (2026-04-27)
- ✅ **SVTL-URL korjattu** web (`/app/frontend/src/pages/Guilds.jsx`) ja mobiili (`/app/mobile/app/(tabs)/guilds.tsx`): `https://www.svtl.fi/svtl` → `https://www.svtl.fi/`. Bundle todennettu: vain uusi URL esiintyy.
- ✅ **EAS production AAB -build käynnistetty** (`5c2111e4-e313-4d56-86f5-efb97e5e5b15`, versio 0.2.0, versionCode 3 autoIncrement). `eas.json` `appVersionSource` vahvistettu `"local"`. AAB sisältää info-näytön + Jaa sovellus + SVTL-fix.
- ✅ **Android keystore varmuuskopioitu** käyttäjän Google Driveen + salasanahallintaan. Sormenjäljet (säilytä Play Console -käyttöön): SHA-1 `96:25:57:2D:5B:F5:40:C0:28:38:4A:B6:F0:F7:08:F5:B0:E3:90:2B`, SHA-256 `DD:63:50:90:86:7A:CF:CC:B1:D3:D6:81:40:A2:7C:11:51:11:4D:E1:47:A2:70:A9:C9:DF:3F:94:3D:39:D2:A2`. Keystore + salasanat tallennettu `/app/mobile/.secrets/` (gitignored).
- ✅ **Privacy Policy -sivu luotu** (`/app/frontend/src/pages/Privacy.jsx`): suomi/englanti/ruotsi-kielinen kattava GDPR-yhteensopiva tietosuojakäytäntö. Polku `/privacy`. Footer-linkki lisätty (`footer.privacy` -käännösavain kaikkiin viiteen kieleen). ET/PL fall back EN:ään.
- ✅ **Google Play Store -listausmateriaalit** (`/app/mobile/.store-assets/`):
  - `play-store-listing.md` — sovelluksen nimi, lyhyt + pitkä kuvaus FI/EN/SV, hakusanat, kategoriat, Data Safety -lomakkeen valmiit vastaukset.
  - `play-store-checklist.md` — vaiheittainen julkaisuopas Play Consoleen, Internal testing → Production-rollout, EAS Submit -automatisoinnin ohjeet.
  - `feature-graphic.png` (1024×500, 663 kB) — Nano Bananalla generoitu cinematic banner: kullainen ᚠ-rune kilvessä + 2 viikinkisiluettia nuotion edessä, hennot revontulet.
  - `icon-512.png` ja `icon-1024.png` — Play Store -listausikoni: ᚠ-rune kullatussa metallikilvessä Norse-knotwork-reunalla, ember-glow halo, dark wood-grain tausta.
- ✅ Asset-paketti pakattu `/app/play-store-assets.tar.gz` -tiedostoon ja toimitettu käyttäjälle.
- 🚧 Käyttäjä jatkaa Play Console -puolelta: lataa AAB Internal testingiin kun build valmistuu, täyttää store listing -tekstit ja Data Safety -lomakkeen valmiilla vastauksilla.



## Iteration — Admin newsletter mgmt + GA4 + Cookie consent (2026-04-27)
- ✅ **Backend**: lisätty `DELETE /api/admin/subscribers/{email}` (admin-auth, 204 onnistuu / 404 ei löydy / 401 ilman authia). Olemassa oleva `GET /api/admin/subscribers` säilytetty.
- ✅ **AdminSubscribersPanel**: uusi accordion-tyylinen paneeli admin-dashboardissa (`/app/frontend/src/components/admin/AdminSubscribersPanel.jsx`). Sisältää sähköposti-haun, kielisuodattimen, tilaus-listauksen taulukkona (email + lang + status + created), per-rivi poistopainikkeen confirm-vahvistuksella. Käännökset FI/EN/SV (ET/PL fall back EN:ään).
- ✅ **Google Analytics 4 + Consent Mode v2** (`/app/frontend/src/lib/analytics.js`):
  - GA Measurement ID `G-EDQGCCY02S` tallennettu `frontend/.env` -tiedoston `REACT_APP_GA_MEASUREMENT_ID` -muuttujaan.
  - Consent Mode v2 default = denied kaikille signaaleille (GDPR-yhteensopiva baseline).
  - Käyttäjän hyväksyntä → `analytics_storage: granted` + SPA pageview tracking React Routerin location-vaihteluiden yhteydessä.
  - Käyttäjän valinta tallennetaan localStorageen (`vk_analytics_consent`) ettei banneri toistu.
  - `initAnalytics()` kutsutaan App.js:n `useEffect`-hookissa.
- ✅ **CookieConsentBanner** (`/app/frontend/src/components/CookieConsentBanner.jsx`): Viking-aestetiikan mukainen alapalkki, "Hyväksy / Hylkää" -painikkeet, Privacy-linkki, monikielinen (FI/EN/SV/ET/PL). Renderöityy vain jos GA configurattu eikä käyttäjä ole vielä päättänyt.
- ✅ Backend testit (curl): list 4 subscribers OK, create + delete + 404 + 401 kaikki vahvistettu. Frontend bundle todennettu sisältämään uudet test-id:t (`subscribers-panel`, `subscribers-toggle`, `cookie-accept`, `cookie-reject`, `EDQGCCY02S`).
- ✅ Lint puhdas (ESLint + ruff).

## Iteration — Mobile i18n + Settings + UX (2026-04-27)
- ✅ **Mobile i18n -järjestelmä** (`/app/mobile/src/lib/i18n.tsx` + `translations.ts`): SettingsProvider + useSettings()-hook. Tukee FI/EN/SV (ET/PL fall back EN:ään). Auto-tunnistaa laitteen kielen `expo-localization`:n kautta ensimmäisellä käynnistyksellä. Käyttäjä voi ohittaa manuaalisesti. Tallentuu AsyncStorageen (`vk_lang`, `vk_defaults`).
- ✅ **Tapahtumat näytetään valitulla kielellä**: `localized()` lukee `title_{lang}` ja `description_{lang}` Pydantic-vastauksesta, fallback EN→FI.
- ✅ **Asetukset-näyttö** (`/app/mobile/app/(tabs)/settings.tsx`): kielenvalitsin, oletushakufiltterit (maa, aikaväli, Lähellä minua), Lähellä minua km-säde (25/50/100/200/500/1000), reset-painike, "Tietoa sovelluksesta"-linkki, "Tallennettu"-toast. Asetukset toimivat oletuksina, käyttäjä voi ylikirjoittaa etusivun chip-suodattimilla per session.
- ✅ **Tab-bar uudelleenrakennettu**: Kaartit poistettu (siirretty `_guilds.tsx.bak`), Asetukset lisätty 5. välilehdeksi. Tab-labelit lokalisoitu.
- ✅ **EventCard-tausta tummennettu** `rgba(26,20,17,0.92)` → solid `#0F0B08` + voimakkaampi varjo (parempi luettavuus AppBackgroundin yli, käyttäjäpalaute).
- ✅ **Lähellä minua** käyttää nyt asetusten km-rajaa (oli kovakoodattu 200 km).
- ✅ Lokalisoidut näkymät: Home, Settings, Info, Favorites, Calendar, Shops, EventCard, Event detail. `formatDateRange` ja kuukaudet käyttävät `Intl.DateTimeFormat`ia valitulla kielellä.
- ✅ TypeScript clean (`npx tsc --noEmit`).
- ✅ **Versio päivitetty**: app.json `0.2.0 → 0.3.0`, versionCode `3 → 4`.
- ✅ **expo-localization** lisätty riippuvuuksiin (yarn add).
- 🚧 **Seuraavaksi**: Uusi EAS production AAB-build (0.3.0/4) → Closed beta -track päivitys.

## Iteration — User Auth & Profile (Web + Mobile, 2026-04-28)
- ✅ **Backend käyttäjäauth** (jo aiemmin): `POST /api/auth/register`, `GET /api/auth/me`, `PATCH /api/auth/profile`, `POST /api/auth/google-session`. `users`-kokoelma laajennettu kentillä `nickname` ja `user_types: List[str]` (validoidut arvot: `reenactor`, `fighter`, `merchant`, `organizer`). Olemassa olevat admin-flowit ennallaan (`role="admin"` vs `role="user"`).
- ✅ **Mobiili — TypeScript korjattu**: `expo-web-browser` lisätty riippuvuuksiin (settings/auth.tsx käyttää sitä Google-OAuth-flown WebViewiin). `npx tsc --noEmit` puhdas.
- ✅ **Mobiili — Auth-konteksti**: `/app/mobile/src/lib/auth.tsx` — JWT tallennetaan AsyncStorageen (`vk_auth_token`), Axios-interceptor lisää `Authorization: Bearer ...`-headerin automaattisesti. `signUp` / `signIn` / `signInWithGoogleSession` / `signOut` / `updateProfile`. Wrapped `_layout.tsx`:ssä SettingsProviderin sisällä.
- ✅ **Mobiili — Settings-hub** (`/app/mobile/app/(tabs)/settings.tsx`): kolme korttia → Profiili, Hakuasetukset, Tietoa sovelluksesta. Anonyymi käyttäjä näkee "Kirjaudu sisään" -kehotteen profiilikortissa.
- ✅ **Mobiili — Auth/Profile -näytöt**: `/app/mobile/app/settings/{auth,profile,search}.tsx`. Sisältää sähköposti+salasana+nimimerkki+käyttäjätyypit (chips), Google-sign-in-painike, profiilin muokkaus + uloskirjautuminen.
- ✅ **Web — Käyttäjien rekisteröinti & kirjautuminen**: uudet sivut `/app/frontend/src/pages/{Login,Register,Profile}.jsx`. Reitit `/login`, `/register`, `/profile` rekisteröity App.js:ään ilman olemassa olevan `/admin/login`-flown rikkomista.
- ✅ **Web — AccountMenu** (`Layout.jsx`): anonyymeille "Kirjaudu" -painike, kirjautuneille pyöreä avatar-painike → dropdown (nimimerkki/email + Profiili + (admin) Ylläpito + Kirjaudu ulos). Mobiili-hampurilaismenu päivitetty vastaavasti.
- ✅ **Web — i18n**: uusi `account`-namespace (sign_in, register_title, user_types_label, type_reenactor/.../organizer, profile_title, profile_save, error_invalid/duplicate/generic, …) lisätty FI/EN/SV-sanakirjoihin. ET/PL fall back EN:ään automaattisesti i18n.js:n fallback-ketjun (lang→en→fi) ansiosta.
- ✅ **Auth-konteksti laajennettu** (`/app/frontend/src/lib/auth.js`): lisätty `register`, `updateProfile`. `login` palauttaa nyt täyden profiilin (nickname, user_types, has_password) eikä vain id/email/name/role.
- ✅ **Päästä päähän verifioitu Playwright-skriptillä**: rekisteröinti → automaattinen redirect /profile → muokkaa nickname & user_types → tallenna → kirjaudu ulos → kirjaudu sisään uudelleen → profiili pysyi tallessa. Admin-flow erikseen vahvistettu (admin@viikinkitapahtumat.fi pääsee /admin-paneeliin ja näkee dropdownissa sekä Profiilin että Ylläpito-linkin).
- ✅ Lint puhdas (ESLint).

## Iteration — DA/DE languages, auto-translate, mobile messaging, admin stats (2026-04-28)

- ✅ **Lisätty kielet DA + DE** sekä webissä että mobiilissa:
  - Web `/app/frontend/src/lib/i18n.js`: `LANGS`-listaan Dansk + Deutsch, stub-namespacet (nav/account/attend/footer) — muut avaimet putoavat takaisin englantiin fallback-ketjun kautta.
  - Mobile `translations.ts`: `SUPPORTED_LANGS` laajennettu `["fi","en","sv","da","de","et","pl"]`. `Record<Lang, Dict>` → `Partial<Record<Lang, Dict>>` jotta DA/DE/ET/PL voivat olla optional. `getConsentTexts` palauttaa fallbackin EN:ään.

- ✅ **Ilmoittautumislomake yksinkertaistettu** (`Submit.jsx`): Poistettu valinnaiset `title_en`/`title_sv`/`description_en`/`description_sv` -kentät. Autotranslate-vinkki: "Käännämme nimen ja kuvauksen automaattisesti tuetuille kielille (englanti, ruotsi, tanska, saksa, viro, puola)..."
  - `translation_service.py` laajennettu: `LANG_NAME` sisältää nyt 7 kieltä (fi/en/sv/**da**/**de**/et/pl). `_pick_source` ja `fill_missing_translations` iteroivat kaikki kielet → kun käyttäjä syöttää suomeksi, backend kääntää automaattisesti kaikkiin muihin Claude Haiku 4.5:llä (Emergent LLM Key).
  - `EventOut`-skeema sai `title_da`/`title_de`/`title_et`/`title_pl` ja `description_*` versionsa (optional, default `""`).

- ✅ **Mobiilin /messages-näyttö** (`/app/mobile/app/settings/messages.tsx`): mirror webin `SendMessage.jsx`:stä. Anonyymi/ei-paid → "Ominaisuus ei ole käytössä tilillesi". Paid merchant/organizer → tapahtumavalintakortit, kanava-chipsit (push/email/molemmat), aihe + viesti, tulospaneeli. Settings-hub `(tabs)/settings.tsx` näyttää automaattisesti "Lähetä viesti" -kortin kun käyttäjällä on lisämaksullinen ominaisuus käytössä.

- ✅ **Admin Stats Panel** (`/app/frontend/src/components/admin/AdminStatsPanel.jsx`):
  - **Backend-endpointit**: `GET /api/admin/stats/overview` (käyttäjät, paid-käyttäjät, RSVP-määrä, push-laitteet, 30pv-viestit-summary), `GET /api/admin/stats/messages?limit=N` (täydellinen audit log enrichattuna event_title + sender_label), `GET /api/admin/stats/top-events?limit=N` (suosituimmat tapahtumat osallistujamäärän mukaan).
  - **Audit log**: `send_message_to_attendees` kirjoittaa nyt jokaisen viestin `message_log`-kokoelmaan (event_id, sender_id, channel, subject, body_preview, sent_push, sent_email, recipients, created_at).
  - **UI**: KPI-strippi (4 korttia), 30 päivän rollup (Push lähetetty/Sähköposteja/Muistutus-pushit/Muistutus-sähköpostit), Top events -lista, Viestien lähetyshistoria -taulu.
  - **Push delivery rate** lasketaan `(sent_push / recipients) * 100` -kaavalla overview-kortilla.
  - Sijoitettu Admin Dashboardin Tabs-paneelin alapuolelle, ennen AdminUsersPanelia.

- ✅ **Päästä päähän testattu Playwrightilla**: Admin login → Stats Panel renderöityy täysillä luvuilla (7 käyttäjää, 1 lisämaksullista, 0% toimitus, 0 push lähetetty, 1 sähköposti). Submit-sivulla EN/SV-kentät poissa, autotranslate-vinkki näkyvissä. DA/DE-kielet näkyvät DOM:issa.
- ✅ **Backend curl-testattu**: stats/overview/messages/top-events kaikki vihreää. Helkas Forge -merchant lähetti viestin Sleipnir-tapahtumaan → audit log tallensi `{sent_email: 1, recipients: 1, event_title: "Sleipnir fighting camp, Ulvila", sender_label: "Helkas Forge"}`.
- ✅ TypeScript clean (`npx tsc --noEmit`), ESLint clean, ruff clean.

## Iteration — Push notifications, Paid messaging, Saved search, Attending list, Anonymous attendee stats (Web + Mobile, 2026-04-28)

- ✅ **Backend laajennukset** (`/app/backend/`):
  - Uudet user-kentät: `expo_push_tokens: List[str]`, `saved_search: {radius_km, categories, countries}`, `paid_messaging_enabled: bool`.
  - **Expo Push** (`push_service.py`): `send_to_users(db, ids, title, body, data)` joka resolvoi käyttäjät → tokenit → lähettää 100:n erissä Expo Push REST API:lle (https://exp.host/--/api/v2/push/send) ja siivoaa `DeviceNotRegistered`-tokenit automaattisesti.
  - Uudet endpointit: `POST/DELETE /api/users/me/push-token` (rekisteröi/poistaa Expo Push Tokenin), `GET /api/events/{id}/stats` (anonyymit osallistujamäärät — vain elävöittäjät+taistelijat+yhteensä, vain merchants/organizers/admin näkee), `POST /api/messages/send` (lisämaksullinen viestien lähetys osallistujille), `GET /api/admin/users` + `PATCH /api/admin/users/{id}/paid-messaging` (admin togglaa lisämaksullisen ominaisuuden), `POST /api/admin/reminders/run-now` (manuaalinen trigger).
  - **APScheduler-job** `_run_daily_event_reminders` (klo 09:15 päivittäin Helsinki-aikaa): hakee tapahtumat 0–3 päivän sisällä, lähettää push + sähköposti -muistutukset niille jotka RSVP:llä `notify_push=true` / `notify_email=true`. Idempotentti `reminder_log`-tauluun.
  - **Suostumusvalvonta**: viestien lähetys filtteröi vastaanottajat 1) RSVP:n perusteella (osallistuvat valittuun tapahtumaan), 2) suostumuksen perusteella (organizer→`consent_organizer_messages`, merchant→`consent_merchant_offers`), 3) per-RSVP-kanavalla (`notify_push`/`notify_email`). 402 Payment Required jos käyttäjällä ei ole `paid_messaging_enabled=true`.
  - Käyttäjien yhteystietoja EI näytetä lähettäjälle missään vaiheessa.

- ✅ **Web UI**:
  - `/profile`: Uudet osiot **SavedSearchEditor** (radius 25/50/100/250km, kategoriat, maat) ja **AttendingList** (lista omista RSVP-tapahtumista per-tapahtuma push/email-statuksilla).
  - `/messages` (uusi sivu, vain `paid_messaging_enabled`+merchant/organizer): tapahtumavalinta, kanava (push/sähköposti/molemmat), otsikko + viesti. Result-paneeli näyttää lähetetty/eligible-vastaanottaja-määrät. Privacy-note korostaa että yhteystietoja ei näytetä.
  - `EventDetail`: Uusi **EventStats**-komponentti merchants/organizers/admin näkyvyydellä — vain *anonyymit* numerot (elävöittäjät, taistelijat, yhteensä).
  - **Admin Dashboard**: Uusi `AdminUsersPanel` käyttäjälistalla (filterit Kaikki/Kauppiaat/Järjestäjät/Adminit) ja shadcn `Switch`-toggle joka aktivoi/deaktivoi lisämaksullisen viestiominaisuuden per-käyttäjä.
  - `/events`: Pre-seedaa `cat` ja `selectedCountries` käyttäjän `saved_search`-oletuksista kerran sessiossa kun käyttäjä on kirjautunut.
  - Profile-sivulla "Lähetä viesti"-linkki näkyy automaattisesti kun käyttäjällä on lisämaksullinen ominaisuus käytössä JA hän on merchant/organizer.

- ✅ **Mobile**:
  - `/app/mobile/src/lib/push.tsx` — `usePushNotifications` -hook joka pyytää permissionin, hakee Expo Push Tokenin (käyttäen EAS projectId:tä) ja rekisteröi backendiin `POST /api/users/me/push-token`. Pyörii `_layout.tsx`:ssä `<PushTokenRegistrar />`-komponentin kautta. Ei tee mitään simulaattorissa (`Device.isDevice` check). Kuuntelee myös `addPushTokenListener`-eventtejä ja päivittää tokenin automaattisesti.
  - Asennettu `expo-notifications` ja `expo-device` (SDK 54 yhteensopivuus).
  - `app/settings/attending.tsx` — uusi näyttö "Osallistun-tapahtumat" -listalle.
  - Settings-hub `(tabs)/settings.tsx` — uusi nav-kortti "Osallistun-tapahtumat" näkyy kirjautuneille.
  - `auth.tsx` (mobile) sai `saved_search` ja `paid_messaging_enabled` -kentät.
  - Translations.ts laajennettu: `attending.*`, `saved_search.*`, `settings.nav_attending`.

- ✅ **Päästä päähän testattu Playwrightilla**: admin näkee 7 käyttäjää, voi suodattaa kauppiaat (5 riviä), togglata `paid_messaging_enabled` ON. Merchantin kirjautuminen → `/profile` näyttää nyt SavedSearch + AttendingList + "Lähetä viesti" -linkin (kun lisämaksullinen ominaisuus on päällä). `/messages`-sivu lähettää viestin Sleipnir fighting camp -tapahtumaan, vastaanottaja-pipeline löytää 1 eligiblen (suostumus + RSVP), Expo Push API kutsuu (sent_push=0 koska testitokeni on feikki, mikä on odotettua). EventDetail-näytöllä `EventStats`-komponentti näkyy merchant-roolille.

- ✅ **Backend curl-testattu**: register/login/forgot/reset/attend/me/attending/admin-users/paid-messaging-toggle/stats/messages-send/reminders-run-now kaikki vihreää.

- ⚠️ **Tärkeä huomautus**: Push-viestien rekisteröinti vaatii FYYSISEN laitteen (Expo `Device.isDevice` check). Tämä ei toimi simulaattorissa. EAS:n Expo Push Service ei vaadi access tokenia ulospäin lähetykseen; voit lisätä `EXPO_ACCESS_TOKEN` env-muuttujan jos haluat parempaa rate-limit- ja security-tukea (suositeltu tuotantoon).

- ✅ TypeScript clean (`npx tsc --noEmit`), ESLint clean, ruff clean.


- ✅ **Backend laajennukset** (`/app/backend/server.py`):
  - `users`-skeema sai uudet kentät: `merchant_name`, `organizer_name`, `consent_organizer_messages` (default false), `consent_merchant_offers` (default false), `password_reset_token`, `password_reset_expires`.
  - `POST /api/auth/forgot-password` (60min TTL, ei email-enumeraatiota — palauttaa aina 200, lähettää sähköpostin Resendin kautta vain jos osoite on rekisteröity password_hashin kanssa).
  - `POST /api/auth/reset-password` (token+new_password, 8 merkin minimi, kuluttaa tokenin onnistumisessa).
  - `POST/DELETE/GET /api/events/{id}/attend` — RSVP per-tapahtuma, tallentaa `notify_email` + `notify_push` -preferenssit. `GET /api/users/me/attending` palauttaa kaikki osallistumiset event-objekteineen.
  - `POST /api/auth/register` validoi `merchant_name`-pakollisuuden kun `merchant` on user_typesissä, vastaava `organizer_name`. `PATCH /api/auth/profile` validoi saman ja TYHJENTÄÄ kentät kun käyttäjä poistaa rooliäänen.
  - `email_service.py`: lisätty `send_password_reset` (suomenkielinen pohja, iso "Vaihda salasana"-painike, viittaa `PUBLIC_SITE_URL/reset-password?token=...`-sivuun).
- ✅ **Web — Forgot/Reset password UI**: `/forgot-password` + `/reset-password?token=...` sivut, "Unohtuiko salasana?"-linkki `/login`-sivulla.
- ✅ **Web — Merchant/Organizer name + opt-in suostumukset**: `Register.jsx` + `Profile.jsx` saivat ehdolliset nimi-kentät (näkyvät vain kun ko. user_type valittuna) ja suostumuskortit. Yhteinen suostumusteksti `/app/frontend/src/lib/consents.js` (FI/EN/SV) + `/app/mobile/src/lib/consents.ts` varmistavat täsmälleen saman muotoilun. Korostettu että viestit koskevat VAIN tapahtumia joihin käyttäjä on merkinnyt osallistuvansa.
- ✅ **Web — RSVP "Osallistun"-painike** (`components/AttendButton.jsx`): EventDetail-sivulle, anonyymi → "Kirjaudu osallistuaksesi", kirjautunut → "Merkitse osallistuvaksi" + per-tapahtuma push/email-toggle.
- ✅ **Web — `auth.js` bugi korjattu**: `register`-funktio nielaisi `merchant_name`/consents-kentät. Nyt forwardoidaan koko payload.
- ✅ **Mobiili — Forgot password screen** (`/app/mobile/app/settings/forgot-password.tsx`): linkki sign-in-modessa, sama UX kuin webissä.
- ✅ **Mobiili — Auth & Profile -näytöt laajennettu**: ehdolliset merchant/organizer-nimikentät, suostumuskortit (oletuksena pois). Suostumustekstit yhteisestä `consents.ts`-tiedostosta.
- ✅ **Mobiili — `AttendBlock` lisätty event/[id].tsx-näytölle**: anonyymi → kirjautumis-CTA, kirjautunut → osallistun + push/email-toggle. Synkkaa backendiin per-klikki.
- ✅ **Profiilisynkronointi vahvistettu**: web ja mobile käyttävät SAMAA backendiä (`/api/auth/me`, `PATCH /api/auth/profile`), SAMAA `users`-kokoelmaa. Päivitys yhdellä alustalla → näkyy heti toisella.
- ✅ **Päästä päähän vahvistettu Playwrightilla** (web): rekisteröinti merchantina + "Helkas Forge"-kaupanimellä + kauppias-suostumus → kentät säilyivät /profile-sivulla → tapahtumalla "Merkitse osallistuvaksi" → push-toggle → reload säilyttää tilan → uloskirjautuminen → /forgot-password lähetys onnistuu.
- ✅ **Backend curl-testattu**: register/login/forgot/reset/attend (GET/POST/DELETE)/me/attending kaikki vihreää.
- ⚠️ **Push-viestien LÄHETTÄMINEN** (Expo Push Service) on ERILLINEN tehtävä (P1). Käyttäjien preferenssit tallentuvat oikein, mutta itse push-viestin lähetys vaatii Expo Push Tokenin tallennuksen + cron-jobin event_attendees-taulun yli.
- ✅ TypeScript clean (`npx tsc --noEmit`), ESLint clean.

## Iteration — Mobile i18n + Settings + UX (2026-04-27)




- **P2** Date pickers: replace native `<input type="date">` with shadcn Calendar+Popover for visual consistency.
- **P2** PWA push, brute-force-rate-limit, OG-tagit, custom favicon, lisämuistutus 1 vrk ennen, admin image-library picker UI.
- **P2** Add ET/PL event content auto-translation (currently translation_service only fills fi/en/sv).
- **P3** Production data sync utility (preview admin → prod admin).
## Iteration — Admin sub-pages + admin messaging + i18n refactor + DA/DE full translation (2026-04-28)
- ✅ **Backend `/api/messages/send`** — `role=admin` now bypasses `paid_messaging_enabled` and the merchant/organizer requirement. Admin recipients are filtered by **either** consent flag (`consent_organizer_messages` OR `consent_merchant_offers`), since admin = site itself.
- ✅ **Frontend `/messages` page** — admin users now see the compose form (previously blocked).
- ✅ **Admin web UI split into sub-pages** (long single-scroll page → focused sub-routes):
  - `/admin` — overview (KPI cards + 4 quick links)
  - `/admin/events` — events tabs (pending/approved/rejected/all)
  - `/admin/users` — users panel (filter + paid-messaging toggle + GDPR delete + add admin)
  - `/admin/messages` — messaging stats + audit log + compose link
  - `/admin/newsletter` — monthly + subscribers + weekly digest
  - `/admin/content` — merchants + guilds CRUD
  - `/admin/system` — preview→prod sync panel
  - Implementation: `pages/admin/AdminLayout.jsx` (sidebar shell + `<Outlet/>`) + 7 small page components, react-router nested routes, `Lucide` icons.
  - Old `pages/AdminDashboard.jsx` deleted.
- ✅ **Admin: add admin user + GDPR-delete user** — `POST /api/admin/users` (creates role=admin) and `DELETE /api/admin/users/{id}` (cascades RSVPs + email reminders + newsletter subscriptions; anonymises message_log sender_id; refuses to delete self / last admin). New `AdminUserCreateDialog.jsx` + trash icon column on users table.
- ✅ **i18n refactor**: 2113-line `i18n.js` → 7 per-language JSON files (`/app/frontend/src/lib/i18n/{fi,en,sv,et,pl,da,de}.json`) + 75-line provider that statically imports them. CRA bundles JSONs at build time.
- ✅ **DA & DE full translation** via Claude Haiku 4.5 over Emergent LLM Key. Was: stubs (~20 keys, fallback EN). Now: full ~250 keys per language (every section: home, events, submit, courses, guilds, shops, sword, contact, newsletter, admin, profile, attend, messaging). Verified end-to-end via Playwright on /events, /home, /admin.
- ✅ **Mobile prep for Play Console**: `app.json` version 0.3.0 → 0.4.0, versionCode 5 → 6 (auto-incremented to 7 on EAS build). `eas.json production.android.buildType: "app-bundle"` produces .aab for Play Console upload. EAS-BUILD.md rewritten for AAB workflow + EXPO_TOKEN CI usage.
- ✅ **Mobile production AAB build kicked off** via EAS:
  - Build ID `8353a9a3-9499-43ca-8849-095bdc63cecb`
  - Logs / artifact: https://expo.dev/accounts/samviljan/projects/viikinkitapahtumat/builds/8353a9a3-9499-43ca-8849-095bdc63cecb
  - SDK 54, Version 0.4.0, versionCode 7
  - Owner: `samviljan` (authenticated via `EXPO_TOKEN`)
  - User downloads `.aab` from above URL when Expo finishes (~10-15 min) and uploads to Play Console manually.


## Iteration — Play Store update cache fix + automaattinen version bump (2026-05-02)
- 🐛 **Diagnoosi**: Beta-testaajien Play Store -päivitys versionCode 23:een vaati välimuistin tyhjennyksen koska **versionCode 21 ja 23 käyttivät samaa `versionName: "0.4.8"`**. Play Store -UI näytti "olet jo ajan tasalla" vaikka uusi versionCode olisi pitänyt triggeröidä päivityksen.
- ✅ **Korjaus**: 
  1. `app.json`:n `expo.version` nostettu `0.4.8 → 0.4.9` seuraavaa buildia varten.
  2. Luotu `/app/mobile/scripts/bump-version.js` — automaattinen patch/minor/major bumper.
  3. Lisätty `package.json`-scriptit: `yarn bump:patch`, `yarn build:prod` (yhdistelmä bump + EAS build), `yarn update:prod` (OTA).
  4. Luotu `/app/mobile/RELEASE.md` — dokumentaatio jatkokehitykselle (OTA vs native build, milloin kumpaa, usein toistuvat ongelmat).
- ✅ **`.gitignore` siivous**: 234 → 106 riviä. Poistettu 128 duplikaattiriviä ja 15 vaeltavaa `-e`-komentoartefaktia jotka olivat kertyneet aikaisemmista `echo -e ... >> .gitignore` -komennoista. Saattoi vaikuttaa Emergent-deployn tiedostojen hakuun.
- ✅ **Best practice jatkossa**: Jokaisen uuden natiivibuildin komento on nyt `yarn build:prod` joka:
  1. Nostaa versionName patch:n automaattisesti (0.4.9 → 0.4.10 → 0.4.11 ...)
  2. EAS auto-bumppaa versionCode:n (23 → 24 → 25 ...)
  3. Play Store -käyttäjät näkevät puhtaan `0.4.9 → 0.4.10` -päivityksen eivätkä joudu tyhjentämään välimuistia koskaan
- ⚠️ **OTA-varoitus dokumentoitu RELEASE.md:ssä**: ÄLÄ nosta `expo.version` ennen OTA:ta — muuten runtimeVersion muuttuu ja päivitys menee versioon jota kukaan ei aja. OTA-päivitys julkaistaan nykyiselle versionNamelle — älä koske app.jsoniin ennen sitä.

## Iteration — Native build v22 (versionCode 23) käynnistys + RuntimeVersion-fix (2026-05-02)
- 🐛 **Diagnoosi**: Aiemmat OTA-päivitykset eivät menneet mobiiliin perille koska Android-build versionCode 21 oli rakennettu **ilman `runtimeVersion`-asetusta** app.json:ssa. Kun ajettiin `eas update`, EAS CLI auto-lisäsi `runtimeVersion: {policy: appVersion}` ja julkaisi päivityksen tagattuna runtime-versioon 0.4.8 — mutta puhelimessa oleva binääri ei sisällä mitään runtime-versiota, joten `expo-updates` ei voinut yhdistää päivitykseen.
- ✅ **Korjaus**: app.json sisältää nyt `runtimeVersion: {policy: appVersion}`. Käynnistetty uusi natiivibuild EAS Cloud Buildilla (Build ID `c46cc8fe-61a9-4a7b-a3e3-82f4856b04f1`, versionCode bumpattiin 21 → 23 koska 22 jäi kesken aiemmasta yrityksestä). Tämä build sisältää KAIKKI viime aikojen muutokset (kaupat-järjestys, premium-jako, hanki-CTA, viestit-inbox, top-heron poisto, RSVP-muistutukset inboxiin) JA korjaa runtimeVersionin niin että jatkossa OTA-päivitykset toimivat oikein.
- ⏳ **Build käynnissä**: EAS Cloud Buildin Linux-x64-koneella (~15-25 min). Tilaohjeet: https://expo.dev/accounts/samviljan/projects/viikinkitapahtumat/builds/c46cc8fe-61a9-4a7b-a3e3-82f4856b04f1
- ✅ **Token-turvallisuus**: Käytetty väliaikaista Expo-tokenia vain käynnistystä varten — käyttäjää ohjeistettu poistamaan token expo.devistä heti.
- ⚠️ **Hermes-binääri korjattu**: Edellinen OTA-yritys vaati Hermes-bytecode-bundlerin x86→aarch64-emulointia qemulla (kontaineri on aarch64). EAS Cloud Build pyörittää itse natiivin x64-koneen joten emulointi ei tarpeen tässä buildissa. Wrappperi-skripti palautettu alkuperäiseksi binääriksi ennen buildia.

## Iteration — RSVP-muistutukset näkyvät Viestit-inboxissa (2026-05-02)
- ✅ **Backend**: Uusi jaettu helper `_record_inbox_rows(event_id, recipients, sender_id, sender_label, channel, subject, body)` joka kirjoittaa per-vastaanottaja-rivit `user_messages`-kokoelmaan jaetulla `batch_id`:llä. Käytetään NYT sekä `/messages/send`-flow:ssa (refactor, sama lopputulos kuin aiemmin) että **päivittäisten RSVP-muistutusten ajossa** (`_run_daily_event_reminders`). 
- ✅ **RSVP-muistutus** kirjoittaa inboxiin yhteistä `inbox_recipient_ids`-listaa hyödyntäen (push + email -käyttäjien union, deduplikoitu setiksi). `sender_id="system"`, `sender_label="Viikinkitapahtumat"`. Subject = tapahtuman otsikko. Body = "Tapahtuma alkaa pian — muista varata aika kalenteriin." Channel = "both" / "push" / "email" sen mukaan mitä lähetettiin.
- ✅ **Idempotenssi**: `reminder_log`-kokoelmaan lisätty kolmas channel-rivi "inbox" → uudelleenajot eivät duplikoi inbox-rivejä (samalle tapahtumalle samalle päivälle vain yksi inbox-batch).
- ✅ **End-to-end testattu**: Asetettiin testitapahtumalle huomispäivä, RSVP:llä notify_push+notify_email=true, ajettiin `_run_daily_event_reminders()` → inbox-rivi luotiin oikealla subject/sender/channel-arvoilla. Toinen ajo → 0 uusia rivejä (idempotenssi toimii). Testidata siivottu jälkikäteen.
- ✅ Ruff clean.

**Mitä tämä tarkoittaa käyttäjälle**: Jos käyttäjä on sallinut push-ilmoitukset johonkin tapahtumaan, hän saa ilmoituksen ENSIN puhelimensa push-bannerina ja löytää saman viestin myöhemmin **Viestit → Saapuneet** -valikosta lukemalla. Jos käyttäjä sulkee ilmoituksen vahingossa tai puhelin on offline, viesti löytyy silti inboxista myöhemmin.

**Push-paikat jotka kirjoittavat inboxiin** (täysi kattavuus):
- `/messages/send` (admin/maksulliset järjestäjät+kauppiaat) ✅
- Päivittäinen RSVP-muistutus ✅
- `/admin/push/test` (debug, ei kirjoita — tarkoituksenmukaista)

## Iteration — Suosikit pois + RSVP-vahvistusdialogi + tietosuoja-linkki (2026-05-03)
- ✅ **Suosikkitoiminto poistettu kokonaan UI:sta** sekä webistä että mobiilista. Backend-endpointit jätetty paikalleen taaksepäin yhteensopiviksi, mutta käyttöliittymä ei kutsu niitä.
  - **Web**: poistettu `FavoriteButton`-rendaus `EventCard.jsx`:stä, `Shops.jsx`-sydännapit, `MerchantDetail.jsx` heart-toggle. Layout.jsx:n `nav-favorites` ja `mnav-favorites` näyttävät nyt "Tapahtumani" `CalendarCheck`-ikonilla, näkyy vain kirjautuneille. `Favorites.jsx`-sivu kirjoitettu uudelleen näyttämään vain `/users/me/attending` -tapahtumat.
  - **Mobile**: `(tabs)/_layout.tsx` poistettu `useFavorites` ja count-badge. `(tabs)/favorites.tsx` (Tapahtumani-välilehti) korvattu yksinkertaisemmalla 195-rivisellä versiolla joka näyttää vain attended-tapahtumat. `EventCard.tsx`, `(tabs)/shops.tsx`, `shops/[id].tsx` — poistettu kaikki heart/star-painikkeet ja niiden hookit.
- ✅ **Web `AttendButton.jsx`**: korvataan suora attend/cancel kahdella `AlertDialog`-vahvistusdialogilla (data-testid `attend-confirm-dialog` ja `attend-cancel-dialog`). Vahvista-dialogi sisältää käyttäjän pyytämän infotekstin sovelluksen sisäisestä toiminnosta + "Kyllä, osallistun"/"Peruuta"-napit. Peru-dialogi vastaavasti.
- ✅ **Mobile `AttendBlock.tsx`**: lisätty `Alert.alert`-dialogit attend/cancel-tilaa varten, sama infoteksti kuin webissä.
- ✅ **Mobiilin asetuksiin lisätty Tietosuojakäytäntö-linkki**: `(tabs)/settings.tsx`-näkymässä uusi kortti `data-testid="nav-privacy"` shield-checkmark-ikonilla. Avaa `https://viikinkitapahtumat.fi/privacy` Linking.openURL:lla. Web-Layoutissa /privacy-linkki oli jo footerissa.
- ✅ **Kuukausien käännökset filttereissä**: tarkistettu — sekä web (`toLocaleDateString(lang)`) että mobile (`Intl.DateTimeFormat(lang, {month:"long"})`) käyttävät selaimen/laitteen Intl-API:a, joka tukee kaikkia 7 sovelluksen kieltä natiivisti. Lang-resolveri mobiilissa (`i18n.tsx`) palauttaa fallbackiksi `"en"` jos käyttäjän kieliasetus ei ole sovelluksen tukikielten joukossa — kuten käyttäjä pyysi.
- ✅ TypeScript clean, ESLint clean, Web home-sivu lataa puhtaasti ilman fav-painikkeita.
- ✅ **Mobile build v0.4.17 (versionCode 31)** käynnistetty: `0a7722be-3b8f-4459-bf80-5e7c7b706dbc`. Korvaa kaikki aiemmat buildit Play Store -uploadiin.

## Iteration — Mobiilin tapahtumakortti + kauppa-kuvat + käännös (2026-05-02 ilta-11)
- 🐛 **Bug 1 — Premium kauppias-kuva ei näy mobiilissa shops-listauksella**: juurisyy oli että `app/(tabs)/shops.tsx` käytti `process.env.EXPO_PUBLIC_BACKEND_URL`-env-muuttujaa, joka ei ole asetettu EAS-production-buildissa → `imgSrc()` tuotti rikkinäisen URLin. Korjattu käyttämään yhteistä `resolveImageUrl()`-helperia (`@/src/api/client`), joka hoitaa `apiBaseUrl`-konfiguraation oikein.
- 🐛 **Bug 2 — "events.merchants_present" -käännös näkyi raakana**: `t()`-funktio palauttaa keyn itse jos avainta ei löydy (fallback ei laukea koska string on truthy). Korjattu kovakoodaamalla suomenkieliset tekstit "Kauppiaita paikalla" ja sen selitys komponenttiin `EventMerchantsBlock.tsx`. Poistettu `useSettings`-import.
- ✅ **Uusi komponentti** `EventStatsBlock.tsx`: anonyymi osallistujatilastokomponentti (reenactors/fighters/total) mobiilille, vastaa web-`EventStats.jsx`:ää. Näkyy vain admin/merchant/organizer-rooleille, "Anonyymit laskennat — vain roolimäärät näkyvät, ei käyttäjätietoja" -privacy-note.
- ✅ **Mobiilin event-detail järjestys päivitetty vastaamaan webiä**:  
  1. Hero/kuva → 2. Otsikko → 3. Kategoria-badge → 4. Päivämäärä/Sijainti/Järjestäjä-rivit → **5. Kuvaus (uusi paikka!)** → 6. Toimintopainikkeet (suosikki/kartta/linkki) → 7. AttendBlock → **8. EventStatsBlock (uusi)** → 9. OrganizerRequestCTA → 10. Järjestäjät → 11. Kauppiaita paikalla → 12. Kuvagalleria. Sama järjestys kuin webissä.
- ✅ **Mobile build v0.4.16 (versionCode 30) käynnistetty**: ID `dfeab517-b4d1-462e-880d-c6f0e7688fef`. Korvaa aiemmat buildit Play Consoleen.
- ✅ TypeScript clean.

## Iteration — Automaattinen organizer-sync APSchedulerilla (2026-05-02 ilta-10)
- ✅ **Uusi APScheduler-jobi** `organizer_sync_daily` joka ajaa idempotentin healer-logiikan päivittäin **03:45 Europe/Helsinki**. Estää tilanteen jossa organizer-pyyntö hyväksyttäisiin mutta `events.organizer_user_ids` jäisi orpoksi.
- ✅ `_organizer_sync_job()` käyttää samaa logiikkaa kuin manuaalinen `POST /admin/event-organizer-requests/sync`-endpointti, mutta käsittelee samalla kaikki tapahtumat batchissa. Tulokset lokitetaan: `"Organizer sync: healed N orphan rows"` jos N>0.
- ✅ Backend käynnistyi puhtaasti, APScheduler vahvistaa: `"organizer sync daily@03:45"` rekisteröity yhdessä muiden cronien kanssa.
- ✅ Manuaalinen sync-nappi admin-panelissa pysyy myös käytettävissä välittömään korjaukseen.

## Iteration — Healer: synkronoi orpo-organizer-pyynnöt tapahtumiin (2026-05-02 ilta-9)
- 🐛 **Bug-raportti tuotannosta**: Käyttäjä lisäsi manuaalisesti Toni Lähteenmäen kahteen tapahtumaan, mutta Toni ei näkynyt julkisesti tapahtumakortilla. Diagnoosi: `event_organizer_requests` rivi tallentui ja näkyi "Hyväksytyt"-listassa, mutta `events.organizer_user_ids` -kenttä ei päivittynyt → tapahtumakortti pysyi ilman järjestäjää. Ei ole reproduisoitavissa preview-DB:ssä — todennäköisesti race condition, network error tai vanha frontend-versio.
- ✅ **Korjaus**: Uusi heal-endpoint `POST /api/admin/event-organizer-requests/sync` joka käy läpi kaikki `status=approved`-rivit ja `$addToSet`-päivittää tapahtumiin puuttuvat `organizer_user_ids`. Idempotentti, säilyttää MAX_ORGANIZERS_PER_EVENT=3 -capin, palauttaa diff-yhteenvedon (`added`, `added_count`, `already_ok`, `missing_events`).
- ✅ **Web admin UI**: Header-rivin vasen "🔄 Synkronoi" -nappi `AdminEventOrganizerRequests`-sivulla (data-testid `sync-organizers-btn`). Dialogi-vahvistus, toast-tulos `"Synkronoitu: 2 lisätty, 0 oli jo synkissä"`.
- ✅ **E2E-testattu**: simuloitu orpo approved-pyyntö → before public organizers `[]` → POST sync → after `[{Toni}]`. 5 orpoa rivin korjattiin yhdellä klikkaakseksi preview-DB:ssä.
- ✅ Lint clean.

## Iteration — Organizer-rivi pelkäksi nimeksi + Kysy järjestäjältä -lomake (2026-05-02 ilta-8)
- ✅ **Backend uusi public endpoint** `POST /api/events/{event_id}/organizers/{user_id}/contact`: ottaa vastaan `from_name, from_email, subject, body` kaikilta (ei vaadi kirjautumista), hakee organizerin oikean sähköpostin server-side `event_organizer_requests`-kokoelmasta, lähettää Resendin kautta HTML-sähköpostin järjestäjälle. Email-osoite EI KOSKAAN palaudu julkiselle API:lle. Reply-To yritetään asettaa lähettäjän osoitteeksi (fallback TypeError-branch jos email_service ei tue). Audit-loki `organizer_contact_log`-kokoelmaan (event_id, org_user_id, org_name, from_name, from_email, subject, created_at).
- ✅ **Error-casescet**: 404 olematon event, 404 olematon/väärä organizer, 404 jos organizerilla ei ole email on file, 502 jos sähköpostin lähetys epäonnistuu.
- ✅ **Web `EventOrganizers.jsx` kirjoitettu uudelleen**: näyttää vain nimimerkin + pienellä harmaalla "Lähetä viesti" -CTA:n. Rivi on `<button>`, klikkaaminen avaa `ContactOrganizerDialog`:n. Puhelin täysin pois public-näkymästä.
- ✅ **Web uusi komponentti** `ContactOrganizerDialog.jsx`: yhteydenottolomake (nimi, email, aihe, viesti) jossa on kirjautuneelle käyttäjälle esitäytetyt nimi+email-kentät. Submit → `POST /.../contact` + toast + sulku.
- ✅ **Mobile `EventOrganizersBlock.tsx` kirjoitettu uudelleen**: sama rivi-malli (vain nimi + "Lähetä viesti" -CTA), Pressable avaa Modal-pohjaisen lomakkeen samoilla kentillä. Success-statusteksti "Viesti lähetetty ✓" ja auto-sulku 1,2s:n kuluttua.
- ✅ **E2E-testattu**: curl julkiseen endpointtiin (ilman tokenia) → 200 `{"ok":true}`, audit-loki tallentuu oikein organizer-tiedoilla ja lähettäjän tiedoilla. 404-virhetapaukset toimivat. Playwright UI: rivin teksti `"Ragnar Lothbrok" + "Lähetä viesti"` (puhelin+email pois), dialog avautuu klikattaessa, 5 lomakekenttää läsnä.
- ✅ **Mobile build v0.4.15 (versionCode 29) käynnistetty**: ID `bde05038-32a0-4fd8-a2ab-a52805bda3b6`.

## Iteration — Piilota sähköposti julkisesta organizers-listasta (2026-05-02 ilta-7)
- ✅ **Web `EventOrganizers.jsx`**: poistettu `<a mailto:...>` -rivi. Vain nimi + puhelin näkyvät. Admin-paneli (`AdminEventOrganizerRequests.jsx`) näyttää edelleen sähköpostin yhteystietona sisäiseen käyttöön.
- ✅ **Mobile `EventOrganizersBlock.tsx`**: sama muutos — sähköposti-Pressable poistettu, nimi + puhelin jäävät.
- ✅ Tekstiverify: section sisältö nyt `"Tapahtuman järjestäjätRagnar Lothbrok+358501234567"` — ei enää sähköpostia.
- ✅ **Mobile build v0.4.14 (versionCode 28) käynnistetty**: ID `8e2ca8b9-1391-4da7-b728-af4cd8a960db`. Sisältää kaikki päivän muutokset.

## Iteration — Adminin manuaalinen järjestäjän lisäys (2026-05-02 ilta-6)
- ✅ **Backend uusi endpoint** `POST /api/admin/event-organizers`: admin lisää olemassa olevan käyttäjän (`user_id`) hyväksytyksi järjestäjäksi tapahtumaan (`event_id`) antamillaan yhteystiedoilla (`full_name`, `email`, `phone`). Luo synteettisen approved-pyynnön `event_organizer_requests`-kokoelmaan (admin_note="Manuaalisesti lisätty"), lisää `user_id` tapahtuman `organizer_user_ids`-listaan ja lisää käyttäjälle `user_types:organizer` jos puuttuu. Säilyttää max 3 organizers/event cap (409) + dedupe (409).
- ✅ **Web uusi komponentti** `ManualAddOrganizerDialog.jsx` admin-paneliin. Dialog-lomake sisältää:
  - Tapahtuma-valitsin haulla (title_fi/en/location-suodatus, top 20 näkyy kerralla)
  - Käyttäjä-valitsin haulla (email/nickname/name-suodatus, top 20)
  - Nimi/email/puhelin-kentät (esitäyttyy valitulta käyttäjältä)
  - Submit → `POST /admin/event-organizers` + toast-ilmoitus ja lista päivittyy
- ✅ **Integroitu admin-sivulle** `/admin/event-organizer-requests`: header sai "Lisää järjestäjä manuaalisesti" -napin oikeaan reunaan (data-testid `manual-add-organizer-btn`).
- ✅ **E2E-testattu**: curl-kutsu 201 luonti, julkinen `/events/{id}/organizers` palauttaa heti manuaalisesti annetun nimen+yhteystiedot, duplicate 409. Playwright-UI: dialog avautuu, 20 tapahtumaa + 7 käyttäjää listautuu etsintäkenttien alle. Lint clean.

## Iteration — Virallisen järjestäjän allekirjoitus tapahtumaviesteihin (2026-05-02 ilta-5)
- ✅ **Backend `POST /messages/send`**: jos lähettäjä on hyväksytty järjestäjä (user.id ∈ event.organizer_user_ids), vastaava `event_organizer_requests`-dokumentti haetaan ja sen `full_name` + tapahtuman otsikko yhdistetään allekirjoitukseksi: `— Ragnar Lothbrok, Sleipnir fighting camp, Ulvila -järjestäjä`. Korvaa aiemman generic nicknamen (`user.nickname`/`merchant_name`).
- ✅ **Push-viestin runko**: body-tekstin loppuun lisätään `— {organizer_sig}` aivan kuten aiemmin, mutta nyt virallisella nimellä. 200 merkin cap pysyy.
- ✅ **Sähköpostin HTML**: kultainen `— {organizer_sig}` -rivi + sen alla `ragnar@vikings.fi` -klikattava mailto-linkki. Ohjaa vastaanottajan kysymykset suoraan oikealle järjestäjälle, ei alustan support-kanavaan.
- ✅ **Ei-organizerille** (tavallinen kauppias tai admin tai järjestäjä tapahtumassa johon ei ole hyväksytty): allekirjoitus pysyy entisenä (nickname/merchant_name/Viikinkitapahtumat). Vain hyväksytty organizer saa virallisen allekirjoituksen.
- ✅ **Testattu**: kutsu `POST /messages/send` organizer-roolilla → allekirjoitus muodostuu `"Ragnar Lothbrok, Sleipnir fighting camp, Ulvila -järjestäjä"` + email `ragnar@vikings.fi`. Lint clean, backend restart clean.

## Iteration — Tapahtumajärjestäjäpyynnöt + viestien lähetyksen rajoitus (2026-05-02 ilta-4)
- ✅ **Backend uusi kokoelma** `event_organizer_requests` (4 indeksiä: user+event, event_id, status, id-unique). Tapahtumissa uusi `organizer_user_ids: List[str]` (max 3).
- ✅ **6 uutta endpointtia**:
  - `POST /api/events/{id}/organizer-requests` — käyttäjä (organizer/admin-rooli) lähettää pyynnön. Päivittää aiemman pending-pyynnön sallitusti. 403 jos ei oikeutettu rooli, 404 jos tapahtumaa ei löydy, 409 jos jo hyväksytty.
  - `GET /api/events/{id}/organizer-requests/mine` — käyttäjän oma pyyntö (null jos ei ole).
  - `GET /api/events/{id}/organizers` — public-lista hyväksytyistä järjestäjistä (full_name + email + phone).
  - `GET /api/admin/event-organizer-requests?status=...` — admin/moderator-lista (rikastettu event_title + event_start_date).
  - `GET /api/admin/event-organizer-requests/pending-count` — sidebar-badge.
  - `POST /api/admin/event-organizer-requests/{id}/approve|reject` — käsittely. **Approve enforced max 3 / event** (409 jos täynnä).
  - `DELETE /api/admin/events/{event_id}/organizers/{user_id}` — admin poistaa hyväksytyn järjestäjän.
- ✅ **Viestien lähetyksen rajoitus**:
  - `POST /messages/send`: organizer-only-käyttäjä voi lähettää vain tapahtumiin joissa on hyväksytty järjestäjä (organizer_user_ids). Merchant-only säilyttää RSVP-perusteisen säännön. Merchant+organizer-käyttäjä saa molemmat oikeudet.
  - `GET /users/me/messageable-events`: organizer-tapahtumat tulevat organizer-roolille (eivät RSVP-perusteiset), merchantille jatkuu RSVP-pohjainen, kaksoisrooleille union.
- ✅ **Web `EventOrganizerRequestCTA.jsx`**: state-machine-nappi EventDetail-sivulla. Nappi näkyy vain organizer/admin-rooleille. Tilat: `Pyydä järjestäjäksi` → `Pyyntö käsittelyssä` → `Olet hyväksytty järjestäjä ✓` (oranssi/featured) tai `Pyyntö hylätty — yritä uudelleen`. Dialogi-lomake (nimi, sähköposti, puhelin, lisätiedot, vahvistus-checkbox).
- ✅ **Web `EventOrganizers.jsx`**: julkinen "Tapahtuman järjestäjät" -sektio EventDetail-sivulla mailto/tel-linkeillä.
- ✅ **Web admin-paneli `AdminEventOrganizerRequests.jsx`**: 3-välilehtinen näkymä (Odottaa/Hyväksytyt/Hylätyt), approve/reject-napit, ember-badge sidebarissa lukematon-laskurille. Sidebar-linkki "Järjestäjäpyynnöt" käännetty 7 kielelle.
- ✅ **Mobile `OrganizerRequestCTA.tsx` + `EventOrganizersBlock.tsx`**: sama state-machine-nappi + Modal-pohjainen lomake mobiilin event-detail-näytöllä, julkinen järjestäjä-lista alla.
- ✅ **End-to-end testattu**: organizer-rooli pyytää → admin hyväksyy → user lisätty organizer_user_ids:iin + käyttäjälle lisätty user_types:organizer (jos puuttui) → julkinen organizers-endpoint näyttää oikean nimen+yhteystiedot → duplicate 409 → max 3 cap 409. Web UI verifioitu Playwrightilla. TS clean, lint clean.

## Iteration — "Kauppiaita paikalla" tapahtumasivulla (Web + Mobile, 2026-05-02 ilta-3)
- ✅ **Backend uusi public endpoint** `GET /api/events/{event_id}/merchants` — palauttaa lista kauppiaista (aktiivinen `merchant_card.enabled=true`, ei vanhentunut) jotka ovat RSVP-merkinneet tapahtumaan. Lajittelu: featured ensin, sitten nimi. Mukana `id, name, description, url, category, image_url, featured, is_user_card`. 404 jos tapahtumaa ei löydy, `[]` jos ei kauppiaita.
- ✅ **Web `EventMerchants.jsx`** -komponentti: 1–3 -sarakkeinen grid (responsiivinen), 64×64 kuva tai kategoria-ikoni-placeholder, ★ featured-merkki, otsikko + 2-rivinen kuvauskatkelma. Klikkaaminen vie `/shops/<id>` -merchant-detail-sivulle. Komponentti piilottaa itsensä jos lista on tyhjä.
- ✅ **Mobile `EventMerchantsBlock.tsx`**: sama visuaalinen rakenne mobiilissa pystylistana. Käyttää yhteistä `resolveImageUrl()`-helperia. Napautus `router.push('/shops/<id>')`.
- ✅ **i18n 7 kielelle**: `events.merchants_present` + `events.merchants_present_help` käännetty FI/EN/SV/DA/DE/ET/PL.
- ✅ **End-to-end testattu**: Sleipnir fighting camp -tapahtumassa 2 RSVP-merkittyä kauppiasta (Helkas Forge + Viikinkitapahtumat) — molemmat näkyvät webissä oikein. Olematon tapahtuma → 404, tyhjä tapahtuma → `[]` (komponentti piilossa).
- ✅ **Mobile build v0.4.12 (versionCode 26) käynnistetty**: `2f32d8ef-202b-4918-ba10-32716d3368c5`. Sisältää kaikki päivän muutokset (merchant-detail kuva + tapahtumalista, kauppiaita paikalla tapahtumassa). Korvaa aiemman v0.4.11-buildin Play Console -lataukseksi.
- ✅ TypeScript clean, ESLint clean, ruff clean.

## Iteration — Mobile merchant-detail puuttuvat tiedot (2026-05-02 ilta-2)
- ✅ **Korjaus**: Mobiilin `/shops/[id].tsx` käytti väärin `process.env.EXPO_PUBLIC_BACKEND_URL`-fallbackia kuvan URL:in muodostuksessa → EAS-buildatussa sovelluksessa env-muuttuja ei ole asetettu, joten kauppiaan lataama kuva (`/api/uploads/profile-images/...`) ei latautunut. Vaihdettu käyttämään koko sovelluksen yhteistä `resolveImageUrl()`-helperia (`@/api/client`).
- ✅ **Lisätty "Tapaa meidät tapahtumissa" -sektio**: aiemmin mobiilin merchant-detail-näytöllä ei ollut listaa kauppiaan tulevista tapahtumista. Backend palauttaa `events`-kentän jo (web `MerchantDetail.jsx` käyttää sitä), mutta mobiili ohitti sen. Nyt sektio renderöityy `merchant-events-block`-testID:llä — kalenteri-ikoni + tapahtuman otsikko + päivämääräväli + sijainti + maan lippu. Kortti on `Pressable` joka navigoi `/event/{id}`-näyttöön.
- ✅ **i18n + lippu**: lokalisoitu otsikko (lang-aware `eventTitle`), 21 maan lippu-emoji-mappi (sama kuin webissä).
- ✅ **EAS production build v0.4.11 (versionCode 25) käynnistetty**: ID `fc0c44e2-460a-4a0b-9e95-c466a550c97d`. Korvaa aiemman v0.4.10-buildin Play Console -lataukseksi (yksi upload riittää).
- ✅ TypeScript clean (0 virhettä).

## Iteration — Push token admin visibility + self-service clear (2026-05-02 evening)
- ✅ **Backend**: `GET /api/admin/users` palauttaa nyt `push_token_count: int` per käyttäjä (ei tokeneita → 0).
- ✅ **Backend uusi endpoint** `DELETE /api/users/me/push-tokens` — käyttäjä voi itse tyhjentää kaikki vanhat Expo push -tokeninsa (reset-työkalu kun laite ei saa pushia vanhentuneiden kopioiden takia).
- ✅ **Backend uusi endpoint** `DELETE /api/admin/users/{user_id}/push-tokens` — admin/moderator voi tyhjentää kenen tahansa käyttäjän push-tokenit (debug-työkalu). 404 jos käyttäjää ei löydy.
- ✅ **Web admin `AdminUsersPanel.jsx`**: uusi "Push"-sarake taulukossa näyttää kullaisen badgen Bell-ikonilla + lukumäärän (esim. `🔔 3`) jos käyttäjällä on tokeneita, harmaan `—` jos ei. Tooltip kertoo tarkan merkityksen. Toimintopalkissa uusi "BellOff"-nappi joka tyhjentää tokenit yhdellä klikillä (confirm-dialogi + toast).
- ✅ **Mobiili `settings/profile.tsx`**: Test push registration -painikkeen alle lisätty pieni "Tyhjennä push-rekisteröinti" -linkki joka kutsuu `DELETE /users/me/push-tokens` ja pyytää sitten painamaan Test-nappia uudelleen. Self-diagnose-työkalu.
- ✅ **Curl-testattu päästä päähän**: register fake token → admin näkee push_token_count=1 → admin DELETE → count=0. 404 virheelliselle user_id:lle OK.
- ✅ TypeScript clean, ESLint clean, ruff clean.

## Iteration — Mobile merchant detail + Viestit-tab pääpalkkiin (2026-05-02)
- ✅ **Mobiili `/shops/[id].tsx`** (uusi näyttö): merchant-detail hakee `/api/merchants/:id` ja renderöi hero-kuvan, kuvauksen, yhteystiedot (website/puhelin/sähköposti), suosikkiheart-togglen (vain kirjautuneille) ja back-chevronin. Testid `merchant-detail`, `merchant-back`, `merchant-image`, `merchant-fav-toggle`, `merchant-website`.
- ✅ **Mobiili `(tabs)/shops.tsx`**: premium-kauppiaskortin kuva pienennetty aspectRatio 2.2:ksi (oli full-hero), koko kortti on `Pressable` joka navigoi `router.push("/shops/:id")`. Poistettu erillinen "view_details" -linkkirivi.
- ✅ **Mobiili `(tabs)/_layout.tsx`**: Viestit-välilehti siirretty pää-tab-bariin (authOnly=true, näkyy vain kirjautuneille). Ember-badge lukematon-laskurille haetaan `/api/messages/inbox`-kutsulla pathname-vaihteluissa. Viestit-näyttö itse siirretty `settings/messages.tsx` → `(tabs)/messages.tsx`.
- ✅ TypeScript puhdas (`yarn tsc --noEmit` 0 virhettä). Testing agent vahvisti Playwrightilla: anon-palkki näyttää 5 välilehteä (ei Viestit), premium-kauppias-thumbnail 380×173 (aspect 2.20), merchant-napautus → /shops/<id>, detail renderöityy.
- ✅ **RELEASE.md päivitetty** viimeisimpien kahden buildin (v0.4.8 + v0.4.9) release notesilla.

## Iteration — Top-hero poisto duplikaattien estämiseksi (2026-05-02)
- ✅ **Web `Shops.jsx`**: Top-hero `featured-strip`-osio poistettu kokonaan (sekä JSX, `featuredAll`-useMemo että käyttöliittymäteksti). Premium-kortit näkyvät enää vain oman kategoriansa kärjessä `Premium-kauppiaat` -alaotsikon alla, divider, ja sitten `Muut kauppiaat`. Ei duplikaatteja.
- ✅ **Mobiili `(tabs)/shops.tsx`**: Sama puhdistus — `featured-header` ja `featured-card` -row-tyypit poistettu, `featuredAll`-useMemo poistettu, `featuredHero/featuredEyebrow/featuredSubtitle`-tyylit poistettu. Sama per-kategoria Premium/Muut-rakenne säilyy ennallaan.
- ✅ TS clean (`tsc --noEmit` 0 virhettä), ESLint clean. Verifioitu Playwrightilla — `featured-strip`-elementti = 0 kappaletta, kategorian sisäinen Premium-kauppiaat → divider → Muut kauppiaat -rakenne ennallaan.

## Iteration — In-app Merchant Card Requests + Admin inbox (2026-05-02)
- ✅ **Backend**: Uusi `merchant_card_requests`-kokoelma + 6 endpointtia (POST submit, GET /mine, admin GET list + pending-count, POST approve, POST reject). **Approve auto-aktivoi käyttäjän `merchant_card`-sub-docin** kentillä shop_name/category/description pyynnöstä, asettaa `merchant_until` = +12 kk, lisää `merchant`-user_typen jos puuttuu. Yhden pyynnön rajoite — duplicate POST päivittää olemassa olevaa pyyntöä. Indeksit lisätty.
- ✅ **Web**: Korvasin `MerchantCardCTA.jsx`:n mailto-flowin in-app `<Dialog>`-lomakkeella (kaupan nimi, kategoriavalinta, verkkosivu, esittely). Uusi admin-sivu `/admin/merchant-requests` (`AdminMerchantRequests.jsx`) 3 välilehdellä (Odottaa / Hyväksytty / Hylätty). Sidebar-navissa uusi "Kauppiaspyynnöt"-linkki ember-pillillä joka näyttää pending-määrän.
- ✅ **Mobile**: `(tabs)/shops.tsx` CTA käyttää nyt natiivia `<Modal>`-lomaketta `Linking.openURL`-mailton sijaan. Sama 3-tilan logiikka (anonyymi → /settings/auth, kirjautunut → modal, aktiivinen kortti → piilo). Existing-pyyntö ladataan `/merchant-card-requests/mine` -kutsulla ja näkyy "Päivitä pyyntö"-tilassa.
- ✅ **Fine print muutos**: "Toistaiseksi toiminto on maksuton. Mahdollinen maksullisuus tapahtuu tulevissa julkaisuversioissa, ja siitä tiedotetaan erikseen ennen käyttöönottoa." — sekä webissä (3 kielelle) että mobiilissa.
- ✅ **End-to-end verifikaatio**: dialog→submit (admin-tilillä) → admin-paneliin ilmestyi pending-pyyntö badge-luvulla 1 → curl-approve → user's merchant_card.enabled=true automaattisesti shop_name/category/description-kentillä. Testi-data siivottu jälkikäteen.
- ✅ TS clean, ESLint clean, ruff clean.

## Iteration — Hanki kauppiaskortti CTA (Web + Mobile, 2026-05-02)
- ✅ **Web `MerchantCardCTA.jsx`**: Uusi komponentti `/app/frontend/src/components/MerchantCardCTA.jsx`. Embedataan `Shops.jsx`:n loppuun (kategorioiden jälkeen, ennen footeria). 3 visibility-tilaa:
  1. Anonyymi → "Rekisteröidy kauppiaaksi" -nappi → `/register`
  2. Kirjautunut ilman aktiivista korttia → "Pyydä aktivointia" -nappi → `mailto:admin@viikinkitapahtumat.fi` esitäytetyllä subject + body
  3. Kirjautunut aktiivisella `merchant_card.enabled=true` -kortilla → CTA piilotettu kokonaan
- ✅ **Mobile**: Sama komponentti inline `(tabs)/shops.tsx`:ssä (`MerchantCardCTA`). Renderöidään FlatListin `ListFooterComponent`-positioon. `Linking.openURL` mailto-flowiin, `router.push("/settings/auth")` rekisteröitymiseen.
- ✅ **i18n**: Uusi `merchant_cta`-namespace 3 kielelle (FI/EN/SV). DA/DE/ET/PL fallback EN. Mobiilissa hardcoded FI-stringit (kontekstuaalinen päättäjäkielisyys).
- ✅ **TypeScript**: `AuthUser`-interfaceen lisätty `merchant_card?: { enabled, shop_name, category, merchant_until }`. TS clean.
- ✅ **Verifikaatio Playwrightilla**: Kaikki 3 tilaa testattu — anonyymi näkee Rekisteröidy-napin, admin näkee Pyydä aktivointia -napin (mailto-linkki testattu), aktiivinen kauppiaskortti-käyttäjä ei näe CTA:ta.

## Iteration — Premium merchants visible separation (option C, 2026-05-02)
- ✅ **Web `Shops.jsx`**: Lisätty 1) yläosan "★ Esillä olevat kauppiaat" -hero (kullainen reuna + "Yhteistyökumppanit ja viikinkiyhteisön tukijat"-subtitle + kaikki premium-kortit grid-näkymässä), 2) jokaisen kategorian sisälle "★ Premium-kauppiaat" + divider + "Muut kauppiaat" -alaotsikot. Premium-kortit näkyvät SEKÄ ylhäällä että oman kategoriansa kärjessä (option C).
- ✅ **Mobile `shops.tsx`**: Sama looginen rakenne FlatList-row-tyypeillä `featured-header`, `featured-card`, `category-header`, `tier-header` ("Premium-kauppiaat" / "Muut kauppiaat"), `tier-divider`, `merchant`. Premium-hero ember-glow + kullainen reuna ennen ensimmäistä kategoriaa.
- ✅ **i18n**: Uudet avaimet `shops.featured_sub`, `shops.premium_title`, `shops.others_title` 3 kielelle (FI/EN/SV); DA/DE/ET/PL fallback EN.
- ✅ TS clean, ESLint clean. Verifioitu Playwrightilla — `featured-strip` näkyy + jokaisen kategorian "Premium-kauppiaat" + "Muut kauppiaat" -alaotsikot näkyvät divider:n kera.

## Iteration — In-app Messages inbox + tabs UX (Web + Mobile, 2026-05-02)
- ✅ **Backend**: Uusi `user_messages`-kokoelma + 6 endpointtia (`/messages/inbox`, `/messages/inbox/{event_id}`, `/messages/sent`, `/messages/sent/{event_id}`, `/messages/{id}` GET+DELETE). `POST /api/messages/send` kirjoittaa nyt per-recipient-kopion `user_messages`iin samalla `batch_id`:llä. Soft-delete (`deleted_by_recipient`/`deleted_by_sender`). Auto-mark-read recipient-luennassa. Indeksit `(recipient_id, event_id)`, `(sender_id, event_id)`, `batch_id`, `id` lisätty.
- ✅ **Web**: Header-yläpalkkiin uusi mail-ikoni-painike kullaisen ember-pillin kanssa joka näyttää lukematon-laskurin (näkyvissä kirjautuneille). Reitti `/messages` muutettu uudeksi `Messages.jsx`-sivuksi 3 välilehdellä (Saapuneet / Lähetetyt / Lähetä uusi). Lähetä uusi -välilehti embeddaa olemassa olevan `SendMessage`-komponentin. Detail-modaali (`<Dialog>`) avautuu klikkaamalla viesti — sisältää koko bodyn, lähettäjän, päivämäärän, sekä Poista- ja Sulje-painikkeet. Vahvistettu Playwrightilla: send → header badge päivittyy → klikkaa tapahtuma → laajenee viestilistaksi → klikkaa viesti → detail aukeaa kokonaisilla bodyilla.
- ✅ **Mobiili**: Sama 3-tabbed UX `app/settings/messages.tsx`:ssä (kirjoitettu uudelleen). Inbox + Sent + Composer-views. Detail-Modal natiivilla `<Modal>`-komponentilla + `Alert.alert`-vahvistus ennen poistoa. Tab-bar ember-pillillä lukematon-määrälle. Per-tapahtumakortin "Lähetä viesti"-painike POISTETTU `(tabs)/favorites.tsx`:stä. Settings-hub-linkki muutettu nimellä "Viestit" ja näkyvissä kaikille kirjautuneille (compose-tab gateaa itsensä paid-messaging-flagin perusteella). useFocusEffect päivittää badge-laskurin kun palaat sovellukseen.
- ✅ **i18n**: Uusi `messages`-namespace 7 kielelle (FI/EN/SV/DA/DE/ET/PL) sekä webissä että mobiilissa. Sisältää `tab_inbox/tab_sent/tab_compose`, `inbox_empty/sent_empty`, `delete_confirm`, `from`, `recipients_unit`, `batches_unit`, jne.
- ✅ **TypeScript clean** (`npx tsc --noEmit`), ESLint clean, ruff clean.
- ✅ **End-to-end verifikaatio**: send (admin → 3 vastaanottajaa, 1 lähetetty email) → recipient inbox näyttää 1 unread → klikkaa avaa detail + auto-mark-read → unread laskee 0 → delete piilottaa rivin recipient-näkymästä mutta säilyttää datan sender-näkymässä.

## Iteration — Merchant sort + tab rename + default images batch (2026-05-02)
- ✅ **Web `/shops` järjestys verifioitu**: Helkas Forge (paid + featured) näkyy oman kategoriansa (Seppiä) kärjessä `★ ESILLÄ OLEVAT KAUPPIAAT`-badgella. Ei erillistä "Featured"-stripiä — featured-merkki näkyy nyt kortin sisällä.
- ✅ **Mobiili `/shops` puhdistettu**: poistettu kuollut `featured-card`/`featured-header` -koodi (TS-virheet 0). Maksulliset kortit renderöidään prominent-tyylisinä (kullainen reuna, kuva 16:9 jos saatavilla, otsikko + sydän + kuvaus + "Katso lisätiedot"-rivi).
- ✅ **Mobiili FI-välilehden nimi**: `tab.shops` muutettu `"Kauppiaat"` → `"Kaupat"` (lyhyempi, mahtuu paremmin tab-bariin). Muut kielet ennallaan.
- ✅ **AI Default Event Images -batch ajettu**: 12/12 oletuskuvaa GridFS:ssä (2 per kategoria — market/training_camp/course/festival/meetup/other). Generoitu Gemini Nano Bananalla (gemini-3.1-flash-image-preview) Emergent LLM keylllä. Helper-skripti `/app/backend/scripts/run_default_image_batch.py` voidaan ajaa uudelleen lisää-kuville.

## Build-status (viimeksi yritetty 2026-04-30 klo 13:00)

### Mobile (Android)
- ✅ **Koodi valmis**: versio 0.4.8, versionCode olisi auto-bumpattu 19→20
- ❌ **Build EI käynnistetty**: Expo Free Plan -kvootta loppu kalenterikuukaudelle
- ⏰ **Kvootta resetoituu**: pe 1.5.2026 noin klo 04 Suomen aikaa (~8h käyttäjän tämän hetken pyynnöstä)
- 🔁 **Toimi seuraavalla kerralla**: kun käyttäjä pyytää uudelleen tai 1.5.2026 jälkeen, käytä komentoa: `cd /app/mobile && EXPO_TOKEN="C74hVMBKYjsRIH0y0vSDK9kprcCdQ_fPxGb1EP-j" npx eas-cli build --profile production --platform android --non-interactive --no-wait`

### Web
- ✅ Live preview-URL toimii kaikilla viimeisimmillä ominaisuuksilla
- ✅ Tuotanto (viikinkitapahtumat.fi) ajetaan saman repo-pohjalta — ei tarvitse erillistä pushia preview-puolelle


- ✅ **Moderator-rooli toteutettu** (web-sovellus):
  - Backend: `users.is_moderator: bool`-kenttä lisätty, uusi `get_admin_or_moderator` dependency, 33 endpointtia vaihdettu accepting moderator, 5 jätetty admin-only (password reset, paid-messaging toggle, moderator toggle, POST /admin/users, moderator promotion).
  - `DELETE /admin/users/{id}` tarkistaa: jos target.role == "admin" ja viewer.role != "admin" → 403 "Moderators cannot delete admin accounts". Admin creation pysyy admin-only.
  - Uusi `PATCH /api/admin/users/{id}/moderator` toggle (vain admin). Palauttaa `{id, is_moderator}`.
  - `is_moderator` mukana `/me`-vastauksessa ja login-payloadissa.
  - Web: `AdminLayout` sallii pääsyn kun `user.role === "admin" || user.is_moderator`. `AdminUsersPanel` näyttää uuden "Moderaattori"-sarakkeen VAIN admineille (moderaattorit eivät voi nähdä/toggleta). "Lisää admin" -painike + delete-painike admin-tileillä piilossa moderaattoreilta.
  - Käännökset FI/EN/SV: `col_moderator`, `moderator_on_toast`, `moderator_off_toast`, `moderator_cannot_delete_admin`.
- ✅ **Password-reset kovennus**:
  - `/auth/forgot-password` muutos: delivery-osoite luetaan `user["email"]`:stä tietokannasta, ei request-payloadista. Lisäksi eksplisiittinen equality-tarkistus `dest == email` ennen lähetystä. Dokumentoitu `"Security contract"` -kommentissa kooditasolla.
  - Käytännössä toiminta oli jo turvallinen, mutta nyt koodin intent on selvä ja tamper-resistant — attack-controlled-payload ei pysty ohjaamaan email-linkkiä toiseen osoitteeseen.
- ✅ **E2E-testattu curl-sekvenssillä** (7 skenaariota, kaikki vihreitä):
  - Admin → moderator grant (200) · Mod reads /admin/users (200) · Mod→delete admin (403) · Mod→create admin (403) · Mod→toggle paid-messaging (403) · Mod→promote user (403) · Mod→delete regular user (200) · Forgot-password with non-existent email (200, ei leakia)


- ✅ **Bug fix: suosikit synkronoituvat web ↔ mobiili**:
  - Aiemmin: web käytti localStoragea, mobiili AsyncStoragea — ei keskustelivat keskenään.
  - Nyt: backend on totuuslähde (`users.favorite_event_ids`-kenttä). 4 uutta endpointtia:
    - `GET /api/users/me/favorites` → `{event_ids: [...]}`
    - `POST /api/users/me/favorites/{event_id}` (idempotent `$addToSet`)
    - `DELETE /api/users/me/favorites/{event_id}` (`$pull`)
    - `PUT /api/users/me/favorites` (bulk replace, max 500, käytetään anon→logged-in -migraatioon)
  - `/auth/me` palauttaa `favorite_event_ids` → ei tarvita erillistä GET-kutsua kirjautumisen jälkeen.
  - Web `useFavorites` (`/app/frontend/src/lib/favorites.js`): server = totuus kun kirjautunut, localStorage fallback anonyymeille. Login-mergaus ajaa anonyymit suosikit serveriin kerran.
  - Mobile `useFavorites` (`/app/mobile/src/hooks/useFavorites.ts`): sama strategia AsyncStoragella.
  - Optimistinen UI-päivitys → palautuu jos API epäonnistuu.
- ✅ **Tapahtumani-välilehden filter (mobile)**:
  - Uusi state `filter: "favorites" | "attending" | "both"` (oletus: `both`).
  - 3 chipiä `data-testid` `myevents-filter-favorites/attending/both` näkyy aina kun käyttäjällä on jotakin sisältöä.
  - Kun filtteri ei tuota rivejä, näytetään `myevents-filter-empty` -viesti ("Ei tapahtumia tällä suodattimella.").
  - Käännökset: FI/EN/SV (DA/DE/ET/PL fallback EN).
- ✅ **Verifioitu päästä päähän** (kahdella eri tokenilla samalla käyttäjällä simuloiden web/mobiili):
  - mobile add → web read ✓
  - web add → mobile read ✓
  - web delete → mobile read (poistettu näkyy) ✓
  - `/me` palauttaa favorite_event_ids ✓
  - filter chipit + filter-empty Playwright-testattu ✓
- ✅ **Versio**: mobile `0.4.7 → 0.4.8`. Web export 2.85 MB.


- ✅ **Web — käyttäjäkohtainen kielivalinta** (`/app/frontend/src/lib/i18n.js` + `auth.js`):
  - Backend: `User`-malliin `language`-kenttä, `PATCH /api/auth/profile` hyväksyy sen, login + `/me` palauttaa.
  - Web: I18nProvider lukee `useAuth()`:n kautta käyttäjän kielen kirjautumisen yhteydessä; käyttäjien välinen kytkös (UserId-tracking) varmistaa että A→B→A-vaihto seuraa kunkin käyttäjän omaa valintaa, ei vuoda. localStorage `vk_lang` säilyy fall-backina anonyymeille käyttäjille.
  - App.js: `<AuthProvider>` on nyt `<I18nProvider>`:n ULKOPUOLELLA jotta i18n voi käyttää `useAuth`:ia.
  - Verifioitu Playwrightilla: User A (en) → logout → User B (sv) → User A re-login → palasi en:ään (ei vuotanut B:ltä).
- ✅ **Mobiilin viestin lähetys palautettu** (`/app/mobile/app/(tabs)/favorites.tsx` + `app/settings/messages.tsx`):
  - **Sääntö 1**: "Tapahtumani"-välilehden `attending`-osion tapahtumakortteihin lisätty `data-testid="message-event-{id}"`-painike "Viesti".
  - **Sääntö 2**: Painike näkyy VAIN kun käyttäjällä on `paid_messaging_enabled=true` JA jokin rooli `merchant`/`organizer`/`admin`.
  - **Sääntö 3**: Painike avaa `/settings/messages?event_id={id}` — alkutilan tapahtuma esivalittu, takaisin-ikoni ylhäällä, dropdown vain "viestittävät" tapahtumat (RSVP-pohjaiset 14 vrk taakse + tulevat).
  - Backend uusi endpointti `GET /api/users/me/messageable-events` palauttaa nämä: admin näkee kaikki, merchant/organizer omat RSVP'd-tapahtumat 14 vrk-window:lla.
- ✅ **Sääntö 4 — Per-event-kvootta** (`/app/backend/server.py`):
  - Globaali `system_config`-kokoelma (`_id="messaging_quota"`).
  - Presetit: **A=10 (oletus), B=20, C=30, D=vapaa (oletus 50)**.
  - `POST /api/messages/send` tarkistaa `message_log.count_documents({sender_id, event_id})` ja palauttaa `429` jos rajan yli. Admin-viestit eivät kuluta kvootaa (ohittaa).
  - Vastaukseen lisätty `quota_used`, `quota_limit`, `quota_remaining`-kentät jotta UI voi näyttää tilan.
  - Uusi endpointti `GET /api/messages/quota/{event_id}` per-käyttäjä-per-tapahtuma kvoottatilaan.
  - Web: uusi `<AdminMessagingQuotaPanel>` `/admin/messages`-sivulla → preset-chipit A/B/C/D + custom-input + Tallenna.
- ✅ **Sääntö 5 — Lähettäjän nimimerkki**: viesteihin (sekä push että email) lisätään automaattisesti `— {nickname}` (priority: nickname → merchant_name → organizer_name → "Viikinkitapahtumat").
- ✅ **Sääntö 6 — Kvootan pysyvyys**: laskuri laskee `message_log`-rivit per (sender_id, event_id) historiallisesti. RSVP:n poisto + uudelleen-RSVP **EI** nollaa kvootan käyttöä (verifioitu päästä päähän).
- ✅ **Mobiili — Quota-indikaattori** (`messages.tsx`): kun event valittu, näytetään käytetty/kokonais-laskuri (`X/Y`) sekä lähetä-painike disabloituu kun raja on saavutettu.
- ✅ **Versio**: mobile `0.4.6 → 0.4.7`. Web-export 2.85 MB.
- ✅ **Curl-testit kaikki vihreitä**:
  - Per-event quota D=2: msg 1 → 200/quota_used:1, msg 2 → 200/quota_used:2, msg 3 → 429 ✓
  - RSVP-cycle: drop+add → quota_used säilyy 2/2 ✓
  - Multi-user kielitestit: A→en, B→sv, A re-login → en (säilyy) ✓
  - PATCH `/admin/messaging-quota` kaikille preseteille A/B/C/D ✓


- ✅ **Käyttäjä loi Firebase-projektin**: `viikinkitapahtumat-push` (project_number `181106688918`).
- ✅ **`google-services.json` ladattu** Firebase Consolesta ja tallennettu `/app/mobile/google-services.json` (704 B, gitignored). Package name verifioitu `fi.viikinkitapahtumat.mobile`.
- ✅ **FCM V1 service-account-avain ladattu Expo Webin Credentials-näkymästä**: `firebase-adminsdk-fbsvc@viikinkitapahtumat-push.iam.gserviceaccount.com`. Avain tallennettu myös backupiksi `/app/mobile/.secrets/fcm-service-account.json` (gitignored).
- ✅ **EAS file environment variable** luotu: `GOOGLE_SERVICES_JSON` (production scope, secret visibility) → EAS bundlaa Firebase-konfiguraation builderille ilman että tiedosto on Gitissä.
- ✅ **`app.config.js` luotu**: dynamicaalinen wrapper joka injektoi `process.env.GOOGLE_SERVICES_JSON` -arvon `android.googleServicesFile`-kenttään build-aikana. `app.json` säilytetty staattisena, `app.config.js` ottaa precedenssin.
- 🚧 **EAS production build käynnissä**: Build ID `e603237d-4723-49f4-8355-fddf290da8c3`, versio 0.4.6, versionCode 17. Logs: https://expo.dev/accounts/samviljan/projects/viikinkitapahtumat/builds/e603237d-4723-49f4-8355-fddf290da8c3
- 🚧 **Käyttäjän vuoro buildin valmistuttua**: Lataa AAB Play Console → Closed testing → Create new release → asenna laitteelle → Profiili → Push diagnostics.


- ✅ **Mobiilin GPS-toggle** (`/app/mobile/src/lib/i18n.tsx`, `useLocation.ts`, `app/settings/search.tsx`, `app/(tabs)/index.tsx`):
  - `UserDefaults.locationEnabled` (default `true`) lisätty SettingsContextiin + AsyncStorage-persistointiin.
  - `useLocation()` -hook tarkistaa togglen ennen `Location.requestForegroundPermissionsAsync()`-kutsua → status muuttuu `"disabled"`-tilaan jos pois käytöstä, eikä koskaan kysy GPS-lupaa.
  - `app/settings/search.tsx` sai uuden "YKSITYISYYS"-sektion: `data-testid="location-enabled-toggle"` -kytkin + selitysteksti FI/EN/SV (DA/DE/ET/PL fall back EN). Kun pois käytöstä, "LÄHELLÄ MINUA" -sektion sisältö korvataan selittävällä viestillä `near-me-disabled-note`.
  - Etusivu (`(tabs)/index.tsx`) piilottaa `chip-near-me`-suodattimen kun toggle on pois ja resetoi `nearMe`-tilan automaattisesti jos käyttäjä sulkee togglen toisessa näytössä.
  - Versio bumpattu `0.4.5 → 0.4.6` ja Android `versionCode 14 → 15`.
  - Verifioitu Playwright 414×896: toggle päällä → near-me chip + radius-chipit näkyvät. Toggle pois → disabled-note + radius-chipit piilossa, etusivulla `chip-near-me` count=0.
- ✅ **FCM (Firebase Cloud Messaging) -konfiguraatio**: käyttäjän laitteen diagnostiikka paljasti "Default FirebaseApp is not initialized" -virheen → Expo SDK 54 vaatii `google-services.json`-tiedoston ja FCM V1 service-account-avaimen.
  - `app.json` päivitetty: `android.googleServicesFile: "./google-services.json"`, `expo-notifications`-plugin lisätty (default-channel, brand-väri `#C9A14A`), `android.permission.POST_NOTIFICATIONS` lisätty Android 13+ -tukea varten.
  - `.gitignore` päivitetty: `google-services.json`, `GoogleService-Info.plist`, `*-service-account*.json` eivät vahingossa committoidu.
  - Yksityiskohtainen step-by-step ohje käyttäjälle luotu: `/app/docs/FCM_SETUP_GUIDE.md` (Firebase-projektin luonti → google-services.json -lataus → FCM V1 service-account → `eas credentials` -upload → uusi build → Play Console → testaus laitteella).
  - 🚧 Käyttäjä jatkaa: 1) luo Firebase-projekti, 2) lataa `google-services.json` osoitteeseen `/app/mobile/`, 3) lataa service-account-avain EAS:lle `eas credentials`-komennolla, 4) `eas build --profile production --platform android`.


- ✅ **Admin Push Health card verified** at `/admin/messages` — shows `EXPO_ACCESS_TOKEN: Yes`, `users_with_push_token: 0`, with explanatory help text and "Send test" button. Card is rendered by `AdminPushHealthCard.jsx` and powered by `GET /api/admin/push/health` + `POST /api/admin/push/test`. Confirms previous push send returned `sent_push:0` because nobody has a registered Expo token (expected — testing was on web, not mobile).
- ✅ **Mobile production AAB build 0.4.1 kicked off** via EAS for Play Console closed testing track:
  - Build ID `3a72772a-4c1c-43f7-8060-1ad2974751db`
  - Logs / artifact: https://expo.dev/accounts/samviljan/projects/viikinkitapahtumat/builds/3a72772a-4c1c-43f7-8060-1ad2974751db
  - SDK 54, Version 0.4.1, versionCode 10 (auto-incremented from 9)
  - Includes all 2026-04-28 features: profile image+PDF uploads, association/country fields, dynamic submit language, RSVP-restricted messaging w/ target categories, mobile "My events" tab, push-token diagnostics on web admin.
  - User downloads `.aab` from above URL once build finishes (~10-15 min) and uploads to Play Console **Release → Closed testing → Create new release**.

## Iteration — Privacy + Data Safety + 11 maan lisäys (2026-04-28b)
- ✅ **Tietosuojaseloste päivitetty** (`Privacy.jsx`) kattamaan: käyttäjätilit, profiilikuva (GridFS), SVTL-taistelijapassi & varustepassi (PDFt), RSVP, Expo Push -laitetokenit, viestiloki, salasanan palautus -tokenit, tilin poiston cascade-sääntö. **DA & DE** kirjoitettu täysin natiivisti (aiemmin fallback EN); ET/PL fallback EN kuten ennen.
- ✅ **Play Console Data Safety -mappaus** generoitu: `/app/docs/PLAY_CONSOLE_DATA_SAFETY.md`. Sisältää: 14 datakategorian täydellinen taulukko, 10 kerätyn datatyypin yhteenveto Play Consolen lomaketta varten, koodirefrenssit (mistä endpointista jokainen tieto tulee), päivitysmuistutus tuleville integraatiomuutoksille (Stripe, analytiikka).
- ✅ **Maa-vaihtoehdot laajennettu 10 → 21 maahan**: lisätty SI Slovenia, HR Kroatia, UA Ukraina, NL Alankomaat, GB Iso-Britannia, IE Irlanti, BE Belgia, FR Ranska, ES Espanja, PT Portugali, IT Italia. Päivitetty kaikkialle: backend `VALID_COUNTRIES` & `EventCountry` Literal, frontend `countries.js` (lipuilla), 3× COUNTRIES-listaa (Profile, Submit, AdminEventEditDialog), `SavedSearchEditor.jsx` COUNTRY_KEYS, mobile `countries.ts` ja `types.ts`. Käännökset 7 kielessä: top-level `countries.{CODE}` ja `account.country_opt_{CODE}`. Validoitu API-kutsulla: `IT` hyväksytään, virheellinen `XX` palauttaa 400.

## Iteration — Multilingual approval email + 21 country support (2026-04-28c)
- ✅ **Multilingual event approval email** (`email_service.py::render_event_decision`): When admin approves an event via `PATCH /api/admin/events/{id}` (status=approved), the submitter (`organizer_email`) now receives a localized email in their event's country language. Mapping: FI→fi, SE→sv, EE→et, DK→da, PL→pl, DE→de; all other countries (NO/IS/LV/LT/SI/HR/UA/NL/GB/IE/BE/FR/ES/PT/IT) fall through to English. Email contains:
  - Localized subject + heading: "Your event has been approved"
  - Localized confirmation that it's now visible on viikinkitapahtumat.fi
  - **Event-card link button** (`/events/{id}`)
  - **Contact card** with explanation: organizer can email `admin@viikinkitapahtumat.fi` if they want the event removed or any detail (date, location, description, image) corrected
  - Uses `title_<lang>` with fallback chain `title_<lang> → title_en → title_fi`
- ✅ Verified end-to-end on preview: Created DE event → approved via admin → Resend log: `submitter notification: event=... approved=True lang=de sent=True`. Logger captures language used per delivery for monitoring.

## Iteration — Mobile profile parity with web (2026-04-28d)
- ✅ **Mobile profile screen** (`mobile/app/settings/profile.tsx`) now feature-parity with web profile:
  - Profile picture preview + change/remove (uses `expo-image-picker`, multipart upload to `/api/uploads/profile-image`)
  - Country selector (modal-based picker over all 21 supported countries with flags)
  - Association name (free text)
  - SVTL Fighter Card upload (`expo-document-picker`, PDF, multipart to `/api/uploads/profile-doc?kind=fighter_card`)
  - Equipment Passport upload (same flow, `kind=equipment_passport`)
  - Open uploaded PDFs via `Linking.openURL` with new `?t=<jwt>` query-param fallback (added to backend `GET /api/uploads/profile-docs/{filename}`).
  - Remove document via `PATCH /auth/profile {fighter_card_url:""}` / `equipment_passport_url:""`.
- ✅ Auth context (`src/lib/auth.tsx`) extended: AuthUser now exposes `association_name`, `country`, `profile_image_url`, `fighter_card_url`, `equipment_passport_url`. Added `refreshUser()` helper to re-fetch `/auth/me` after upload mutations server-side.
- ✅ Backend `serve_profile_doc` accepts `?t=<jwt>` query param as auth fallback (header-based auth still preferred). Tested: missing→401, header→200/404, query→200/404, invalid query→401. This is necessary because mobile `Linking.openURL` cannot pass custom Authorization headers.
- ✅ New translation keys (FI/EN/SV) for: profile_image_label/change/remove/upload_error/too_large, country_label/optional/none, association_label/help, documents_section/help, fighter_card_label/help, equipment_passport_label/help, doc_pick_pdf/view/remove/upload_error/too_large.
- ✅ New deps: `expo-image-picker@55.0.19`, `expo-document-picker@55.0.13`.
- ✅ TypeScript clean (`npx tsc --noEmit`).
- ✅ **Mobile build 0.4.3 kicked off**:
  - Build ID: `c9b4d2be-2216-48ce-82ef-5ae398e4ba91`
  - Logs / artifact: https://expo.dev/accounts/samviljan/projects/viikinkitapahtumat/builds/c9b4d2be-2216-48ce-82ef-5ae398e4ba91
  - Version 0.4.3, versionCode 12, includes: 21-country support + full profile feature parity.

## Iteration — Admin delete UX + RSVP messaging confirm + SEO (2026-04-29)
- ✅ **Admin user delete fixed**: replaced `window.confirm()` (which is sometimes silently blocked in PWAs / mobile browsers) with a proper shadcn `AlertDialog`. Deletion now opens a styled confirmation modal showing the email, with cancel + danger-colored "Poista käyttäjä" buttons. Loading spinner during the call. Tested via Playwright: 4 deletable users → click trash → AlertDialog opens → confirm → 3 deletable users (cascade DELETE worked, GDPR cleanup ran).
- ✅ **Messaging RSVP restriction confirmed already implemented**: backend `POST /api/messages/send` (server.py:974-983) returns 403 when a non-admin sender lacks RSVP for the chosen event; frontend `SendMessage.jsx:47` only fetches events the user has RSVP'd to (`/users/me/attending`). No code change needed; verified by code review.
- ✅ **SEO optimization** for the requested keyword set: viikinkitapahtumat, historianelävöitys, keskiaika, viikingit, vikings, reenactment, history, historia, living history events:
  - Rewrote `frontend/public/index.html` with: SEO `<title>` + `<meta description/keywords/author/robots/geo>`; canonical link; 8 `hreflang` alternates (fi/en/sv/da/de/et/pl + x-default); Open Graph (og:title/description/url/image/locale + 6 alternate locales); Twitter card; **two JSON-LD blocks**: `WebSite` (with SearchAction) and `Organization` (with knowsAbout viking/reenactment/keskiaika).
  - Created `frontend/src/lib/seo.js` — minimal `useDocumentSeo` hook (no React Helmet dep; pure DOM mutation) for per-page title/description/canonical/og:image/keywords overrides.
  - Wired into `Home.jsx`, `Events.jsx`, `EventDetail.jsx` (per-event localized title + image as og:image, og:type=event).
  - Created `frontend/public/robots.txt` — allow-all, disallows /admin /api /profile /messages /reset-password, points to `/api/sitemap.xml`.
  - Added `GET /api/sitemap.xml` in `server.py` — dynamic XML listing 7 static paths + every approved event with hreflang alternates for all 7 languages, lastmod from `updated_at` or `start_date`. Verified: HTTP 200, 34 KB. Cache-Control: public, max-age=3600.
  - Added `admin.action_cancel` translations FI/EN/SV/DA/DE/ET/PL.

## Iteration — Admin user-profile inspector tool (2026-04-29c)
- ✅ **New admin tool**: lets admin inspect any individual user profile from two entry points:
  1. **`/admin/users` user list**: each row is now clickable → opens `AdminUserProfileDialog` modal showing email, profile picture, country (with flag), association, merchant/organizer name, user_types, fighter card & equipment passport PDF links (open in new tab — same-origin httpOnly cookie auth carries through), and the user's full RSVP history.
  2. **`/admin/events` events list**: each event row has a new "**Osallistujat**" button → opens `AdminEventAttendeesDialog` showing all RSVP'd users (avatar, name, email, country flag, types, email/push notification flags). Click any attendee → opens the same `AdminUserProfileDialog`.
- ✅ Two new admin-only backend endpoints:
  - `GET /api/admin/users/{user_id}` — full profile + enriched RSVPs (each RSVP includes the resolved event object). Excludes `hashed_password`, `password_hash`, `password_reset_tokens`. Returns 404 if user not found.
  - `GET /api/admin/events/{event_id}/attendees` — full attendee list for one event with profile previews. Returns [] if no attendees.
- ✅ New components: `AdminUserProfileDialog.jsx`, `AdminEventAttendeesDialog.jsx`. Reusable; `AdminEventAttendeesDialog` accepts `onPickUser` callback to chain to the profile dialog.
- ✅ Clickable user rows in `AdminUsersPanel.jsx` with proper `e.stopPropagation()` on the Switch and Trash2 button so toggling/deleting doesn't accidentally open the profile.
- ✅ i18n: `admin.user_profile.{title,open_hint,documents,rsvps,no_rsvps}` + `admin.events.{attendees_btn,no_attendees}` for all 7 languages (FI/EN/SV/DA/DE/ET/PL).
- ✅ Tested end-to-end: click user row → profile dialog opens with correct localized labels (MAA, YHDISTYS, TYYPIT, ILMOITTAUTUMISET); click "Osallistujat" on 25 approved events → attendees dialog opens; clicking an attendee chains to the profile dialog. Lint clean.

## Iteration — Map link button + Translation sweep job (2026-04-29d)
- ✅ **"Open in Maps" button restored** on event detail (web + mobile):
  - Web (`EventDetail.jsx`): new action row with two buttons — "Avaa kartalla" (opens `https://www.google.com/maps/search/?api=1&query=<location>` in new tab) and "Avaa verkkosivu" (when `event.link` is set). Translated FI/EN/SV/DA/DE/ET/PL.
  - Mobile (`app/event/[id].tsx`): map button text was incorrectly using `t("home.near_me")` ("Lähellä minua") — corrected to dedicated `t("event.open_in_maps")` key. Added the key to all 3 mobile language packs (FI/EN/SV).
- ✅ **Translation sweep — automated check for missing language translations** across all events:
  - New `translation_service.find_events_with_missing_translations(db)` — cheap projection check across `title_*` and `description_*` for all 7 supported langs (fi/en/sv/da/de/et/pl).
  - New `translation_service.sweep_missing_translations(db, max_events=50)` — finds gaps + calls existing `fill_missing_translations` for each, capping cost at 50 events/run (overflow logged + processed next run).
  - **APScheduler job** registered: `translation_sweep` runs **every 6 hours at :20**. Logs `summary: {candidates, processed, fields_filled, errors, throttled}`.
  - Two new admin endpoints:
    - `GET /api/admin/translations/health` — diagnostic listing all events with gaps (event title + missing field names + status)
    - `POST /api/admin/translations/sweep?max_events=N` — manual trigger
  - **Admin UI** (`/admin/system → AdminTranslationsPanel.jsx`): shows supported language count, current gap count, refresh button, "Run sweep now" button, and an expandable list of every event with missing fields. Works for all 7 admin locales.
  - **Verified end-to-end**: API found 24 events with gaps in preview → manual sweep with `max=3` filled 27 fields across 3 events with 0 errors, throttled the rest for next run.

## Iteration — Merchant (Kauppias) profile cards + paid subscription (2026-04-30)
- ✅ **Backend (FastAPI)**:
  - `MerchantCard` Pydantic model embedded as sub-document on the `users` collection: `{enabled, shop_name, website, phone, email, description (max 1000), image_url, category (gear|smith), featured, merchant_until, created_at, updated_at}`. `UserOut` extended with `merchant_card` + `favorite_merchant_ids`; `/auth/login` and `/auth/me` payloads now ship both.
  - **Public read** (`GET /api/merchants`) returns UNION of legacy `merchants` collection (19 items) + active user merchant cards (`enabled=true` AND `merchant_until` null OR > now). Each item includes `is_user_card`, `image_url`, `phone`, `email`, `featured`, `user_id`. Skips empty cards (admin enabled but owner hasn't filled `shop_name` yet).
  - **Public detail** (`GET /api/merchants/{user_id}`): card payload + upcoming events the merchant has RSVPed to (joins `event_attendees` × `events` filtered by `status=approved` and `date>=today`, returns clickable links). 404 for legacy IDs, disabled cards, and expired subscriptions.
  - **Owner** endpoints (auth required, blocked when card disabled or `merchant_until` < now): `GET/PUT /api/users/me/merchant-card` (validates shop_name required + non-empty, description max 1000, fields trimmed/length-capped), `POST /api/users/me/merchant-card/image` (multipart, 3 MB cap, 415/413 errors). Image saved to existing `profile_images` GridFS bucket with `metadata.kind="merchant_card"`.
  - **Favorite merchants** CRUD mirrors event favourites pattern: `GET /api/users/me/favorite-merchants`, `POST/DELETE .../{merchant_id}` — atomic `$addToSet`/`$pull`, returns `{merchant_ids: [...]}`. Idempotent.
  - **Admin** endpoints: `POST /api/admin/users/{id}/merchant-card/enable?months=12` (idempotent — re-enable extends `merchant_until`; auto-adds `merchant` to `user_types` if missing), `POST .../disable` (clears `featured` alongside `enabled`), `PATCH .../featured` (only when card currently enabled), `GET /api/admin/merchant-cards` (lists all users with the sub-document for the admin panel).
  - **APScheduler** new daily job `merchant_card_expiry` at **03:30 Europe/Helsinki** — disables cards whose `merchant_until` is past. UNION endpoint also filters by date so even if scheduler is down, expired cards never leak.
- ✅ **Web** (`/app/frontend/src/`):
  - `pages/Shops.jsx` rewritten — Featured section at top (when any merchant has `featured=true`), 4:3 image preview for user-cards, heart toggle on each user-card (logged-in users), legacy entries open external URL while user-cards link to `/shops/{user_id}` detail page.
  - `pages/MerchantDetail.jsx` (new) at `/shops/:id` — hero image, name, category icon (Hammer for smith / Store for gear), full description, contact block (website/phone/email — clickable `tel:` and `mailto:` links), back link to `/shops`, favorite heart, **"Tapaa meidät tapahtumissa"** list of upcoming RSVP'd events linking to `/events/{id}`. SEO via `useDocumentSeo`.
  - `components/MerchantCardEditor.jsx` (new) on `/profile` — only renders when `user.merchant_card` exists; gracefully shows "ei aktivoitu" banner when `enabled=false`. Editor: image upload, shop_name (required, max 120), category select (gear/smith), website/phone/email, description with live char counter (max 1000, blocks save when over), Save button, **Preview public page** link to `/shops/{user_id}`. Subscription expiry rendered as read-only date in the user's locale.
  - `components/admin/AdminMerchantCardsPanel.jsx` (new) on `/admin/content` — table of every user with a `merchant_card`, columns: Kauppa, Käyttäjä, Tila (Aktiivinen/Pois pill), Voimassa (date), Toiminnot (Featured toggle, Aktivoi 12 kk, Pois). Featured toggle disabled when card not enabled.
  - `AdminUsersPanel.jsx` got a new Store icon button per row that calls `POST /api/admin/users/{id}/merchant-card/enable` — primary entry-point for granting a brand-new merchant card to any user.
  - Routing: added `/shops/:id` route to `App.js`. `auth.js` `pickProfile` picks `merchant_card` + `favorite_merchant_ids`.
  - **i18n** keys added under `shops.*` (featured_title, view_details, contact, website, phone, email, events_title, no_upcoming, favorite_add/remove) and `merchant_card.*` (title, subtitle, not_enabled, expired, subscription_until, shop_name, category{,_gear,_smith}, website, phone, email, description{,_help}, image{,_upload,_help}, save, saved, save_failed, preview) — FI / EN / SV. Other languages fall back to EN.
- ✅ **Mobile** (`/app/mobile/`):
  - `app/(tabs)/shops.tsx` updated — Featured section at top with 16:9 image preview, falls back to existing `LinkListRow` for the rest. Reads `image_url`, `featured`, `is_user_card` from `/api/merchants` response.
  - `src/types.ts` — `Merchant` interface extended with new optional fields.
  - **Mobile favorite-merchant TOGGLE** (delivered 2026-04-30 follow-up): new `useFavoriteMerchants` hook (mirrors existing `useFavorites` event-favourites pattern) with AsyncStorage cache + per-user server sync via POST/DELETE `/api/users/me/favorite-merchants/{id}`. Anonymous favourites merge into server list on first login. Heart toggle rendered on every featured card (top-right of title) and every user-card row in the list (legacy entries skipped — no detail page = no favourite, mirrors web). `AuthUser.favorite_merchant_ids` added so `/auth/me` and `/auth/login` payloads hydrate the cache.
- ✅ **Verified**:
  - Backend pytest suite `/app/backend/tests/test_iteration14_merchant_cards.py` — **22/22 cases pass**, covers all endpoints (UNION, detail, owner GET/PUT, image upload edge cases, favourites flow, admin enable/disable/featured), expiry sweep semantics via DB backdating, login payload shape.
  - Frontend Playwright: anonymous `/shops` shows Featured section "Esillä olevat kauppiaat" + Helkas Forge user-card; `/shops/user_28a958533568` detail renders SEPPÄ category, contact block, back link; unknown id shows 404 fallback. EN language switch surfaces "Featured"/"Shops".
  - Self-test (logged-in member): /profile MerchantCardEditor renders fully — "Tilaus voimassa: 25. huhtikuuta 2027", profiilikuvauploadnappi, Kategoria=Seppä, Verkkosivu/Puhelin/Sähköposti pre-filled, Kuvaus 30/1000 counter, Tallenna and Preview links visible.

## Iteration — Mobile DA/DE/ET/PL native translations (2026-04-30, late)
- ✅ Mobile previously shipped only FI/EN/SV native dictionaries; DA/DE/ET/PL fell back to English via i18n.tsx fallback chain.
- ✅ Added **full native dictionaries** for Danish, German, Estonian, Polish — every key from the existing FI dict is translated, including the new `myevents.merchants_section`, `merchants_no_events`, `merchants_open_website` keys added in the previous session.
- ✅ Translations live in a separate file `/app/mobile/src/lib/translations.extra.ts` (~660 lines) so the main `translations.ts` stays readable. Main module imports `extraTranslations` and spreads it into the public `translations` object: `{ ...baseTranslations, ...extraTranslations }`.
- ✅ `Dict.langs` type extended to require all 7 language labels; existing FI/EN/SV dictionaries updated to expose `Dansk`, `Deutsch`, `Eesti`, `Polski` so the language picker displays each language in its own native name regardless of which language the UI is currently in.
- ✅ Settings → Language picker (`/app/mobile/app/settings/search.tsx`) iterates `SUPPORTED_LANGS` automatically — new languages appear in the chip list with no code changes.
- ✅ Verified via tsx runtime evaluation: all 7 languages present, sample lookups resolve correctly:
  - DA tab.home → "Hjem"
  - DE myevents.merchants_section → "Meine Lieblings-Händler"
  - ET shops.title → "Kauplejad ja sepad"
  - PL auth.sign_in → "Zaloguj się"
- ✅ Lint clean (TypeScript/eslint).
- ✅ **Backend**: `DELETE /api/users/me` (self-delete). Body `{confirm_email}` must match the authenticated user's email; refuses to let the last remaining admin self-delete (system would lock). Reuses the same GDPR cleanup pipeline as the admin delete: drops RSVPs, email reminders, newsletter subscribers; anonymises sender_id in `message_log` to `"deleted_user"`. The `merchant_card` sub-document goes away with the user document automatically. Clears the auth cookie before returning so the client immediately drops to anonymous state.
- ✅ **Web Profile** (`/app/frontend/src/pages/Profile.jsx`):
  - Inline `MerchantCardEditor` removed; replaced with a dedicated **Merchant card section** that renders one of three states based on `user.merchant_card`:
    1. `merchant_card === null` → **Activation CTA** (visible only when `user_types` includes `merchant`). Disabled placeholder button "Aktivoi maksulinkki tulossa" + explainer about Stripe coming.
    2. `merchant_card.enabled === false` → **"Subscription inactive" notice** (admin disabled OR `merchant_until` expired).
    3. `merchant_card.enabled === true` → **Edit link** to `/profile/merchant-card`.
  - **Danger zone**: new "Poista tili" section with red border + AlertDialog confirmation. The Confirm button stays disabled until the user types their own email exactly (case-insensitive). Successful delete logs out + redirects home.
- ✅ **New page** `/profile/merchant-card` (`MerchantCardPage.jsx`) — wraps the existing `MerchantCardEditor` with a back-link, reuses all editor logic. Redirects to `/login` for anonymous users and to `/profile` if no `merchant_card` sub-doc exists.
- ✅ **i18n** keys added: `merchant_card.section_title|cta_inactive_*|cta_disabled_*|cta_active_*|edit_btn|back_to_profile`, `account_delete.*`. FI/EN/SV.
- ✅ **Admin user delete** dialog already had a Kyllä/Ei (Peruuta / Poista käyttäjä) confirmation — kept as-is.
- ✅ **Verified**:
  - Curl: login → `DELETE /api/users/me` with wrong email → 400 mismatch; correct email → 200 with cleanup summary; subsequent `/api/auth/me` → 401 (cookie cleared).
  - Playwright: logged-in member sees `[merchant-card-cta-active]` + edit link; clicking it navigates to `/profile/merchant-card` showing the editor + back link; danger-zone "Poista tili" button visible.

## Iteration — AI default event-card images + shops sort + favorite-button fix (2026-05-01)
- ✅ **Bug fix**: `EventCard.jsx` — suosikki- ja remind-painikkeet eivät renderöityneet jos `event.image_url` oli tyhjä (ne oli sidottu kuva-overlayhin). Korjattu lisäämällä erillinen absoluuttinen painikerivi kun kuvaa ei ole.
- ✅ **Bug fix**: `Shops.jsx` — maksulliset `is_user_card=true` -kauppiaskortit sekoittuivat aakkosjärjestyksessä legacy-kauppiaiden kanssa. Lisätty `sortPaidFirst`-helper joka asettaa maksulliset aina edelle jokaisessa kategoriassa. Featured-osio (admin-nosto) pysyy omana hero-osionaan.
- ✅ **AI-generoidut oletuskuvat tapahtumille**:
  - Uusi GridFS-bucket `default_event_images`, uusi kokoelma `db.default_event_images` (id, category, image_url, prompt, variant, created_at).
  - 6 EVENT_CATEGORIES × 2 kuvaa = 12 oletuskuvan pooli (käyttäjän pyynnöstä alennettu 10:stä 2:een, vakio `DEFAULT_IMAGES_PER_CATEGORY = 2`).
  - Hand-crafted promptit per kategoria (`market`, `training_camp`, `course`, `festival`, `meetup`, `other`) + 10 varianttihinttiä (`twilight`, `amber`, `snow`, …) → kaikki generoidut kuvat tyylillisesti erilaisia.
  - Gemini Nano Banana (`gemini-3.1-flash-image-preview`) EMERGENT_LLM_KEY:llä, BackgroundTasks-jono (admin saa välittömän vastauksen, generointi etenee taustalla ~15 s/kuva).
  - **Sticky-assignointi**: `POST /api/events`-endpoint valitsee satunnaisesti yhden kuvan kategorian poolista ja tallentaa pysyvästi `image_url`-kenttään → sama tapahtuma renderöityy aina samalla kuvalla, ei satunnaisuutta.
  - Endpointit: `GET/POST /api/admin/default-event-images`, `POST .../generate?category=X&count=N`, `DELETE .../{id}`, `GET /api/uploads/default-event-images/{filename}` (julkinen stream).
  - Uusi admin-paneeli `/admin/content` → `AdminDefaultImagesPanel`: kategoriakohtaiset counts + thumbnails + per-kategoria generointinappi + "Generoi puuttuvat" -nappi koko poolille + yksittäisten kuvien poisto (trash-ikoni hoveroituna).
  - Testattu: 1 testikuva generoitui onnistuneesti 16 sekunnissa, 913 kt JPEG, HTTP 200.

## Backlog (priorities)

### 🔴 P0 — Välittömät
- ✅ **Mobile EAS-buildin Play Console -julkaisu** (versionCode 21 aktiivinen, 17 poistettu 2026-05-01) — odottaa vain admin-painalluksen "Start rollout" Internal testing -kanavalle.
- **Generoi oletuskuva-pooli** — aja admin-paneelista "Generoi puuttuvat" (12 kuvaa, ~3 min, ~3–6 krediittiä), jotta uudet tapahtumat saavat automaattisesti kuvan.

### 🟠 P1 — Tärkeät, lähiaikoina
- **💳 Stripe-integraatio** — maksulliset viestit (`paid_messaging_enabled`) JA kauppiaskorttien automaattinen 12 kk:n aktivointi (`merchant_until`). Stripe Checkout + webhook → korvaa nykyinen manuaalinen admin-kytkin. `merchant_card.merchant_until` + hook-logiikka on jo backendissä valmiina.
- **📧 Email-template-editori** — admin-paneeliin. Kauppiaat/järjestäjät tallentavat valmiita pohjia (Muistutus, Kiitos, Aikataulumuutos). Muuttujat `{{event_title}}`, `{{date}}`, `{{nickname}}`. Admin voi jakaa yhteisiä pohjia.
- **📱 Mobiilin tilin poisto -UI** — `(tabs)/settings.tsx` Danger zone + `account_delete.*`-käännösavaimet kaikkiin 7 kieleen → vastaa weben omapoistoa (backend-endpoint `DELETE /api/users/me` on jo valmis).
- **🧪 Backend pytest-regressiosuite** — *muistutus 2026-05-29 ja 2026-06-29*. 15–20 testitapausta (auth, RSVP, message-quota, kauppiaskortit, omapoisto). 40–80 krediittiä. Pytest-asyncio + fixtures. Pakollinen ennen server.py-refaktorointia.

### 🟡 P1 (mobiili vaihe 2)
- **Push-notifikaatiot suosikkitapahtumista** — kun suosikkitapahtuman yksityiskohdat muuttuvat (päivä, sijainti, peruutus), käyttäjä saa pushin. Käyttää jo olemassa olevaa FCM V1 -infraa.
- **Push-notifikaatiot suosikkikauppiaista** *(uusi idea 2026-04-30)* — kun suosikkikauppias RSVP:n uuteen tapahtumaan, suosikki-merkitsijät saavat pushin. Orgaaninen markkinointi kauppiaalle ilman maksullista viestiä, konversio-vaikutus.
- **Offline-välimuisti** — tapahtumalista ja suosikit luettavissa myös ilman yhteyttä.

### 🟢 P2 — Mukavat lisäykset
- **Per-event Open Graph -kuva** — 1200 × 630 jakopreview joka tapahtumasivulta sosiaaliseen mediaan (FB, X, WhatsApp). AI-generoitu tai käytetty event.image_url.
- **"Jaa-painike" kauppiaskortille** *(2026-04-30 idea)* — `MerchantDetail`-sivulle FB/X/WhatsApp/Kopioi linkki-painikkeet + pieni rune-tyylinen QR-koodi tulostettavaksi pajan seinälle.
- **Telegram-bot** — rinnakkainen push-vaihtoehto FCM:lle, vähentää riippuvuutta Firebase-credentialeista.
- **Shadcn Calendar + Popover date-pickeriksi** — korvaa natiivi `<input type="date">` visuaalisen yhtenäisyyden vuoksi.
- **Custom favicon + Apple touch icons** — brändin viimeistely.
- **Lisämuistutus 1 vrk ennen tapahtumaa** — nykyisen 7-vrk-muistutuksen rinnalle.
- **Admin "Valitse galleriasta" -kuvavalitsin** — kun tapahtuman luonti/muokkaus, voi valita jo ladatun kuvan sijasta uuden.
- **ET/PL auto-käännös tapahtumasisällölle** — APScheduler translation sweep käsittelee tällä hetkellä vain FI/EN/SV; laajennetaan kattamaan ET/PL.
- **Lat/lon-kentät tapahtumiin** — parantaisi Android-geocoding-luotettavuutta Near-me-filtterille.
- **"Mitä seuraavaksi" -osio kotisivulle** — seuraavat 3 tapahtumaa heti kotisivulla ilman tarvetta kelata listaa. Parantaisi "mobile first"-kokemusta.
- **Sentry / crash-lokaali** — Play Console mapping.txt -varoituksien ratkaisu. Saataisiin myös tuotannon JS-kaatumiset tarkasti luettavina.
- **Kauppiaskortin ammattimaisempi käännösten läpikäynti** *(2026-04-30 idea)* — DA/DE/ET/PL käännökset ovat kohtuulliset mutta natiivi puhuja hioisi idiomeja paremmiksi (esim. DE "Reenactor" → "Living-History-Darsteller"). ~20 min per kieli.

### 🔵 P3 — Refaktoroinnit, tekninen velka
- **`server.py`-refaktorointi reittitiedostoiksi** — nyt ~4000 riviä. Jaetaan `routes/auth.py`, `routes/events.py`, `routes/admin.py`, `routes/merchants.py`, `routes/messaging.py`. **Edellyttää** pytest-suiten olemassaoloa regressioturvana.
- **Preview → prod data sync utility** — kaksisuuntainen data-sync admin-UI:sta.
- **iOS-build konfiguraatio** — `app.json` iOS-osio, TestFlight-putki. Vaatii Apple Developer -tilin ($99/v).
