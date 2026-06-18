# Viikinkitapahtumat 🛡️

> **Pohjoismainen viikinki- ja rautakauden harrastajien tapahtumakalenteri.**
> A Nordic event calendar for Viking & Iron Age reenactors, historians and
> enthusiasts — covering festivals, markets, fighter training, courses and
> crafts across Finland, Sweden, Denmark, Norway, Estonia, Poland and more.

🌐 **Live site:** [viikinkitapahtumat.fi](https://viikinkitapahtumat.fi)
📱 **Android app:** Google Play (closed testing — see [`/articles/liity-mobiilisovelluksen-beta-testaajaksi`](https://viikinkitapahtumat.fi/articles/liity-mobiilisovelluksen-beta-testaajaksi) to join)
🗓️ **Events:** 100+ verified across 21 countries

---

## Table of contents

1. [Features](#-features)
2. [Architecture](#️-architecture)
3. [Project structure](#-project-structure)
4. [Components & responsibilities](#-components--responsibilities)
5. [Data model](#-data-model)
6. [Local development](#-local-development)
7. [Mobile build (Android AAB)](#-mobile-build-android-aab)
8. [Testing](#-testing)
9. [Documentation](#-documentation)
10. [Security](#-security)
11. [Contributing](#-contributing)
12. [License](#-license)

---

## ✨ Features

### For visitors
- 📆 **Multilingual event calendar** in 7 languages (Finnish, English,
  Swedish, Danish, German, Estonian, Polish). Per-user language preference.
- 🔍 **Smart search & filters** — country, date range, category (fighter /
  merchant / reenactor / organizer), GPS-distance ("Near me") and free text.
- 📝 **User accounts** with detailed profiles (association, nickname,
  categories, profile photo, PDF Fighter Card / Equipment Passport uploads).
- 🎟️ **RSVP tracking** with email + push reminders (1 week + 1 day before).
- 🗺️ **"Open in Maps"** — one-tap directions to any event.
- 📲 **PWA** (installable web app) and a native Android app (iOS planned)
  sharing the same backend.

### For merchants / organizers
- 💬 **Paid messaging** to RSVP'd attendees (verified merchants only,
  per-event quota prevents spam).
- 🏪 **Merchant cards** with auto-renewing 12-month visibility tier.
- 👥 **Guild / association directory** with organizer self-management.

### For admins
- 📰 **Editorial articles** — admin CRUD UI with auto-translation to all 7
  languages via Claude Haiku 4.5, image uploads, and embedded feedback forms.
- 📧 **Email template editor** + newsletter broadcaster.
- 📊 **Dashboard** for moderation, default images, merchant verifications.

### Under the hood
- 🤖 **Automatic AI translations** of events and articles (Claude Haiku 4.5,
  nightly sweep for any locale with missing content).
- 🖼️ **Gemini Nano Banana image generation** seeds default category images
  and article cover photos.
- 🔔 **Expo Push Notifications** (Android FCM V1) for reminders & announcements.
- 📈 **SEO** — dynamic per-event Open Graph cards, schema.org/Event JSON-LD,
  bot prerender endpoint (`/api/prerender/events/{id}`) for non-JS crawlers,
  streaming `sitemap.xml`, `robots.txt`.
- 🛡️ **GDPR-ready** — cookie consent, data export, account self-deletion,
  documented Play Console Data Safety mapping.

---

## 🏗️ Architecture

```
┌─────────────────────────────┐          ┌─────────────────────────────┐
│  React 18 + Tailwind + PWA  │          │  Expo SDK 54 (React Native) │
│  viikinkitapahtumat.fi      │   API    │  Expo Router, EAS OTA       │
│  Public site + admin panel  │ ───────▶ │  Android (Play closed beta) │
└─────────────────────────────┘          └─────────────────────────────┘
              │                                          │
              ▼                                          ▼
       ┌──────────────────────────────────────────────────────┐
       │                FastAPI (Python 3.11)                 │
       │  ┌────────────────────────────────────────────────┐  │
       │  │  REST API (~70 endpoints, /api prefix)         │  │
       │  │  JWT auth · GridFS uploads · APScheduler       │  │
       │  │  Bot prerender + JSON-LD                       │  │
       │  └────────────────────────────────────────────────┘  │
       │  ┌────────────┬─────────────┬───────────────────┐    │
       │  │  Resend    │  Expo Push  │ Emergent LLM Key  │    │
       │  │  (email)   │  (FCM V1)   │ (Claude + Gemini) │    │
       │  └────────────┴─────────────┴───────────────────┘    │
       └──────────────────────────────────────────────────────┘
                            │
                            ▼
                  ┌────────────────────┐
                  │   MongoDB (Motor)  │
                  │   + GridFS buckets │
                  └────────────────────┘
```

### Request flow examples

- **Browser visits `/events/<id>`** → React SPA loads → fetches `GET /api/events/<id>` → renders detail.
- **Googlebot visits `/events/<id>`** → CDN routes to `GET /api/prerender/events/<id>` → backend returns pre-rendered HTML with JSON-LD.
- **User RSVPs an event** → `POST /api/events/<id>/attend` → APScheduler queues an email + push reminder for `<start_date> - 1 day`.
- **Admin creates an article** → `POST /api/admin/articles` → article saved → background task `fill_missing_article_translations` populates 6 other languages via Claude Haiku.

---

## 📁 Project structure

```
/app
├── backend/                       # FastAPI + MongoDB
│   ├── server.py                  # ~6,800-line main app (P2: split into routers)
│   ├── email_service.py           # Resend wrapper + iCal generation
│   ├── translation_service.py     # Claude Haiku 4.5 translation helpers
│   ├── push_service.py            # Expo / FCM V1 push helpers
│   ├── tests/                     # Pytest P1 regression suite (~25 tests)
│   ├── requirements.txt
│   └── .env                       # Secrets (gitignored)
│
├── frontend/                      # React 18 web app (PWA)
│   ├── src/
│   │   ├── App.js                 # Routes
│   │   ├── pages/                 # Top-level routed pages
│   │   │   ├── Home.jsx           # Hero + "What's new" strip + featured grid
│   │   │   ├── Events.jsx         # Full events listing
│   │   │   ├── EventDetail.jsx    # Single event view + RSVP + JSON-LD
│   │   │   ├── Articles.jsx       # Editorial articles list
│   │   │   ├── ArticleDetail.jsx  # Article view (Markdown-lite renderer)
│   │   │   └── admin/             # Admin panels (overview, content, ...)
│   │   ├── components/
│   │   │   ├── ui/                # Shadcn/UI primitives
│   │   │   ├── admin/             # Admin sub-panels
│   │   │   │   ├── AdminArticlesPanel.jsx
│   │   │   │   └── ... (default images, merchant cards, ...)
│   │   │   ├── LatestArticlesStrip.jsx
│   │   │   ├── BetaFeedbackForm.jsx
│   │   │   └── EventCard.jsx
│   │   └── lib/                   # api.js, i18n.js, seo.js, images.js
│   └── public/                    # static (index.html, robots.txt, favicons)
│
├── mobile/                        # Expo (React Native) app
│   ├── app/                       # Expo Router file-based routes
│   │   ├── (tabs)/index.tsx
│   │   ├── event/[id].tsx
│   │   └── ...
│   ├── src/components/            # Native EventCard, MerchantCard, ...
│   ├── eas.json                   # EAS build profiles
│   └── app.json                   # Expo config (runtime version 0.4.18)
│
├── docs/                          # User-facing & setup guides
│   ├── USER_GUIDE.md
│   ├── FCM_SETUP_GUIDE.md
│   └── PLAY_CONSOLE_DATA_SAFETY.md
│
├── memory/                        # Internal AI-agent memory
│   ├── PRD.md                     # Product requirements + change log
│   └── test_credentials.md        # Test account credentials
│
├── .github/
│   ├── workflows/
│   │   └── backend-tests.yml      # CI: P1 pytest on every push to main
│   └── README.md                  # CI / pre-commit notes
│
└── README.md                      # ← you are here
```

---

## 🧩 Components & responsibilities

### Backend services (`/backend`)
| Module | Purpose |
|---|---|
| `server.py` | FastAPI app, all REST endpoints, models, startup hooks |
| `email_service.py` | Resend API wrapper, HTML email rendering, iCal attachments |
| `translation_service.py` | Claude Haiku 4.5 single-translate + sweep workers (events & articles) |
| `push_service.py` | Expo Server SDK wrapper, FCM V1 dispatch, error categorisation |
| `og_card.py` | 1200×630 social preview generator (Pillow) |
| `tests/` | Pytest P1 regression suite |

### Frontend pages (`/frontend/src/pages`)
| Page | Route | Notes |
|---|---|---|
| `Home` | `/` | Hero, search shortcut, latest articles strip, featured events grid |
| `Events` | `/events` | Filterable event list (country, date range, category) |
| `EventDetail` | `/events/:id` | Full event view, RSVP, JSON-LD, OG image |
| `Articles` | `/articles` | Editorial articles list |
| `ArticleDetail` | `/articles/:slug` | Markdown-lite renderer + optional embedded forms |
| `Swordfighting` | `/swordfighting` | Curated category landing page |
| `Courses` | `/courses` | Hobby intro & training courses |
| `Guilds` | `/guilds` | Association directory |
| `Shops` | `/shops` | Merchant directory + premium merchant cards |
| `Contact` | `/contact` | Form posting to `/api/contact` |
| `Admin/*` | `/admin/...` | Moderation, content management, users, system |

### Mobile screens (`/mobile/app`)
| Screen | Notes |
|---|---|
| `(tabs)/index.tsx` | Events list |
| `(tabs)/favorites.tsx` | RSVP'd / favorited events |
| `(tabs)/profile.tsx` | Account, settings, language |
| `event/[id].tsx` | Event detail with truncated description modal |
| `merchant/[id].tsx` | Merchant card (premium tier) |
| `auth/*` | Login, registration, password reset |

### MongoDB collections
| Collection | Purpose |
|---|---|
| `users` | User accounts (bcrypt-hashed passwords, profile fields) |
| `events` | Approved & pending events (multilingual) |
| `event_attendees` | RSVP rows linking users to events |
| `messages` | Merchant/organizer messaging threads |
| `articles` | Editorial articles (multilingual, with feedback_form_type) |
| `beta_app_feedback` | Beta-tester feedback submissions |
| `email_templates` | Admin-editable HTML email templates |
| `system_config` | Feature flags, quotas, default images |
| `newsletter_subscribers` | Newsletter opt-ins |
| `email_reminders` | Pending RSVP reminder dispatches |
| **GridFS buckets** | `fs` (profile photos / docs), `default_images`, `article_images` |

---

## 🗃️ Data model

The Pydantic models live in `backend/server.py`. Key entities:

- **`User`**: `id (UUID)`, `email`, `password_hash`, `display_name`, `country`,
  `language`, `categories[]`, `profile_image_url`, `documents[]`, `role`
  (`user | moderator | admin`).
- **`Event`**: `id (UUID)`, `title_{lang}`, `description_{lang}` for 7 langs,
  `start_date`, `end_date`, `location`, `country`, `category`, `organizer`,
  `link`, `registration_url`, `image_url`, `status`, `created_by`.
- **`Article`**: `id (UUID)`, `slug`, `title_{lang}`, `excerpt_{lang}`,
  `body_{lang}` for 7 langs, `cover_image_url`, `gallery[]`, `published_at`,
  `feedback_form_type` (`null | "beta_app"`).
- **`MerchantCard`**: Embedded in user doc — `kind`, `business_name`,
  `merchant_until`, `categories[]`, `images[]`.

---

## 🚀 Local development

### Prerequisites
- Python 3.11+
- Node.js 18+ and Yarn
- MongoDB running locally (or a connection URL)
- Expo CLI for mobile: `npm install -g eas-cli`

### 1. Clone and install

```bash
git clone https://github.com/<your-username>/viikinkitapahtumat.git
cd viikinkitapahtumat

# Backend
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt --extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/

# Frontend
cd ../frontend && yarn install

# Mobile
cd ../mobile && yarn install
```

> The `--extra-index-url` is required because `emergentintegrations` (the
> LLM wrapper) lives on Emergent's internal index, not on PyPI.

### 2. Configure environment variables

Create `/backend/.env`:
```bash
MONGO_URL=mongodb://localhost:27017
DB_NAME=viikinkitapahtumat
CORS_ORIGINS=http://localhost:3000
EMERGENT_LLM_KEY=<your-key-from-emergent-dashboard>
RESEND_API_KEY=<your-resend-api-key>
JWT_SECRET=<random-32-char-hex-string>
PUBLIC_SITE_URL=http://localhost:3000
ADMIN_EMAIL=admin@yourdomain.test
ADMIN_PASSWORD=<bootstrap-admin-password>
```

Create `/frontend/.env`:
```bash
REACT_APP_BACKEND_URL=http://localhost:8001
```

Create `/mobile/.env`:
```bash
EXPO_PUBLIC_API_URL=http://localhost:8001
```

> ⚠️ **Never commit `.env` files** — they are gitignored by default.

### 3. Run

```bash
# Terminal 1 — Backend
cd backend && uvicorn server:app --host 0.0.0.0 --port 8001 --reload

# Terminal 2 — Frontend
cd frontend && yarn start

# Terminal 3 — Mobile (Expo Dev Server)
cd mobile && yarn start
```

- Web: http://localhost:3000
- Backend API docs: http://localhost:8001/docs
- Mobile: scan QR with Expo Go app on your phone

### 4. Seed initial data

The backend automatically seeds two intro articles on first boot. For
sample events, log in as admin and visit `/api/admin/seed-events`.

---

## 📱 Mobile build (Android AAB)

Production builds run on EAS Build:

```bash
cd mobile
EXPO_TOKEN=<your-token> eas build --profile production --platform android
```

OTA updates (no rebuild needed for JS/asset changes — must match installed runtime version):
```bash
EXPO_TOKEN=<your-token> eas update --branch production --runtime-version 0.4.18
```

FCM (Firebase Cloud Messaging) push notifications require:
1. `google-services.json` from Firebase Console (see `docs/FCM_SETUP_GUIDE.md`)
2. FCM V1 service account JSON uploaded to EAS Credentials
3. Uploaded as EAS File Environment Variable `GOOGLE_SERVICES_JSON` (secret visibility)

Full step-by-step guide: [`docs/FCM_SETUP_GUIDE.md`](docs/FCM_SETUP_GUIDE.md)

---

## 🧪 Testing

```bash
export TEST_ADMIN_PASSWORD=<your-admin-password>
cd backend && pytest tests/ -v
```

The backend P1 regression suite covers:
- Auth (login, password change, password reset)
- Events (CRUD, RSVP, attendance, reminders)
- Articles (list, detail, admin CRUD, image upload, MIME rejection)
- SEO prerender endpoint (JSON-LD shape, canonical URLs, content)
- Newsletter announcement broadcasting
- Translation substitution in admin messages

CI runs automatically on every push to `main` — see
[`.github/workflows/backend-tests.yml`](.github/workflows/backend-tests.yml) +
[`.github/README.md`](.github/README.md) for CI configuration details.

> `TEST_ADMIN_PASSWORD` is **required** — no password is ever hardcoded in
> the codebase. See [Security](#-security) below.

---

## 📚 Documentation

- [`docs/USER_GUIDE.md`](docs/USER_GUIDE.md) — End-user guide (Finnish)
- [`docs/FCM_SETUP_GUIDE.md`](docs/FCM_SETUP_GUIDE.md) — Firebase / push setup
- [`docs/PLAY_CONSOLE_DATA_SAFETY.md`](docs/PLAY_CONSOLE_DATA_SAFETY.md) — Play Store data safety mapping
- [`.github/README.md`](.github/README.md) — CI & pre-commit hooks
- [`backend/tests/README.md`](backend/tests/README.md) — Test suite layout
- [`memory/PRD.md`](memory/PRD.md) — Living product requirements & change log

---

## 🔐 Security

- **No hardcoded credentials.** All secrets come from `.env` files (gitignored) or EAS Environment Variables.
- **JWT authentication** with bcrypt-hashed passwords (cost factor 12).
- **HTTP-only, Secure, SameSite=none cookies** for session tokens.
- **CORS** restricted to configured `CORS_ORIGINS`.
- **CodeQL** static analysis runs on every push (see GitHub Security tab).
- **Bot prerender XSS-hardened** — UUID-shaped `event_id` validation + JSON-LD
  payload escapes `<`, `>`, `&` for safe `<script>` embedding.
- **GDPR**: user data export and account deletion endpoints.
- **Message quota** prevents merchant/organizer spam (configurable, default 10/event, not reset by RSVP cycling).

### Reporting a vulnerability

Please email admin@viikinkitapahtumat.fi with the details; we will respond within 72 hours. Do not open public GitHub issues for security bugs.

---

## 🤝 Contributing

Contributions are welcome! Viking reenactment is a global community — if you
spot missing events, translation improvements, or bugs, open an issue or PR.

1. Fork the repo
2. Create a branch: `git checkout -b feature/my-improvement`
3. Commit your changes with a descriptive message
4. Push and open a pull request

---

## 📜 License

Copyright © 2025–2026 Sami Viljanen / Viikinkitapahtumat.fi

This project is provided **for educational and non-commercial reference use**.
Contact admin@viikinkitapahtumat.fi if you want to reuse substantial portions
commercially.

---

## 🙏 Acknowledgements

- Built with 🤖 [Emergent](https://emergent.sh) — the AI-native full-stack platform
- Nordic reenactment community for inspiration and event data
- Anthropic Claude Haiku 4.5 for AI translations
- Google Gemini Nano Banana for image generation
- Firebase / Expo for cross-platform push infrastructure

---

*Bi öllum véum heilir!* — Be hale in all sanctuaries.
