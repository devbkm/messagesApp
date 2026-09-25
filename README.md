# Inbox

A small inbox application where each user can **create, view and delete their own messages**.
It is built as a practical exercise and consists of:

| Part | Status | Technology |
| --- | --- | --- |
| Mobile app (primary client) | Required | React Native · Expo · TypeScript |
| REST API | Required | Python · FastAPI · Pydantic · SQLAlchemy |
| Database | Required | PostgreSQL |
| Web app | Optional | React · Vite · TypeScript |

Both clients talk to the same versioned REST API (`/api/v1/...`). The backend is the
single source of truth for ownership, validation, creation dates and deletion.

> **Project status:** Phase 2 — database. The project structure, design system,
> navigation, `/health`, and the database layer (models, migrations, integrity rules,
> current-user seam) are in place. The message API endpoints and the client screens
> are added in later phases (see [Roadmap](#roadmap)).

---

## Functional scope

From the exercise brief:

- **Inbox (landing) screen** — lists the current user's messages, showing each message's
  **subject** and **date (`dd.mm.YYYY`)**. It has a button to create a message and lets
  the user delete a message. Tapping a message opens its detail screen.
- **Message detail screen** — shows the subject, date, text and (optionally) an attachment.
- **Create message screen** — **subject** and **text** are mandatory; the subject is at most
  **40 characters**. After a successful save the app returns to the inbox. The creation
  date is set by the backend.
- Messages belong to a user; a user only ever sees and manages their own messages.

Editing messages is **not** part of the scope.

---

## Architecture

```
┌──────────────────────┐     ┌──────────────────────┐
│  apps/mobile (Expo)  │     │  apps/web (Vite)     │
│  React Native + TS   │     │  React + TS          │
└──────────┬───────────┘     └──────────┬───────────┘
           │   HTTPS / JSON  /api/v1/…  │
           └─────────────┬──────────────┘
                         ▼
              ┌──────────────────────┐
              │  backend (FastAPI)   │
              │  routes → services → │
              │  SQLAlchemy models   │
              └──────────┬───────────┘
                         ▼
              ┌──────────────────────┐
              │     PostgreSQL       │
              └──────────────────────┘
```

- The clients are independent apps with no shared runtime code. They share **design
  tokens** (colours, spacing, typography) whose values are kept identical in
  `apps/mobile/src/theme/tokens.ts` and `apps/web/src/styles/tokens.css`. A shared
  package was considered, but it adds monorepo build tooling that is not justified for
  two small clients.
- The backend follows a layered structure: HTTP routes stay thin, business rules live in
  services, and persistence is handled by SQLAlchemy models. Configuration comes only
  from environment variables.
- Errors from the API use one JSON envelope:
  `{"error": {"code": "...", "message": "...", "details": [...]}}`. Unexpected errors are
  logged on the server and returned as a generic `500` without internal details.

---

## Repository structure

```
messagesApp/
├── apps/
│   ├── mobile/                 # React Native (Expo) app — primary client
│   │   ├── App.tsx             # Providers + navigation root
│   │   └── src/
│   │       ├── components/ui/  # Design-system components
│   │       ├── navigation/     # Stack navigator + typed route params
│   │       ├── screens/        # Inbox, MessageDetail, CreateMessage
│   │       └── theme/          # Design tokens
│   └── web/                    # React web app (optional client)
│       └── src/
│           ├── components/ui/  # Design-system components (CSS Modules)
│           ├── layouts/        # App shell (skip link, header, main)
│           ├── pages/          # Inbox, MessageDetail, CreateMessage, NotFound
│           ├── styles/         # Tokens + global styles
│           └── router.tsx      # Routes
├── backend/
│   ├── alembic/                # Migrations (versions/) and environment
│   ├── app/
│   │   ├── api/                # Routers (/health, /api/v1)
│   │   ├── core/               # Settings, error handling, current-user resolution
│   │   ├── db/                 # Declarative base, engine/session
│   │   ├── models/             # ORM models
│   │   ├── schemas/            # Pydantic request/response models
│   │   ├── services/           # Business logic
│   │   └── main.py             # App factory
│   └── tests/
├── docker-compose.yml          # Local PostgreSQL
└── README.md
```

---

## Local setup

### Prerequisites

| Tool | Version |
| --- | --- |
| Python | 3.12 or newer (developed with 3.14) |
| Node.js | 20.19+ or 22 LTS (developed with 22) |
| Docker Desktop | Used to run PostgreSQL locally. On Windows it requires WSL 2 (`wsl --install`, then reboot). |
| Expo Go app | On a phone, or an Android emulator / iOS simulator |

### 1. Database

```bash
docker compose up -d --wait db
```

This starts PostgreSQL 17 on `127.0.0.1:5432` (bound to localhost only) with
development-only credentials that match `backend/.env.example`. The schema is created
by the migrations in step 2.

> The URLs use `127.0.0.1` rather than `localhost`: on some Windows machines
> `localhost` resolves to IPv6 first and the connection attempt stalls.

### 2. Backend

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate   macOS/Linux: source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env
alembic upgrade head          # create / update the database schema
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

`alembic upgrade head` is all a clean checkout needs to initialise the database: it
applies every migration in `backend/alembic/versions/` in order and is safe to re-run.
Alembic reads `DATABASE_URL` from the environment / `backend/.env`; no credentials are
stored in `alembic.ini`.

- Health check: <http://localhost:8000/health> → `{"status": "ok"}`
- Interactive API docs (non-production only): <http://localhost:8000/docs>

`--host 0.0.0.0` makes the API reachable from a phone on the same network.

### 3. Mobile app

```bash
cd apps/mobile
npm install
cp .env.example .env
npx expo start
```

Scan the QR code with Expo Go, or press `a` (Android) / `i` (iOS). On a physical device,
set `EXPO_PUBLIC_API_URL` to your computer's LAN IP, not `localhost`.

### 4. Web app (optional)

```bash
cd apps/web
npm install
cp .env.example .env.local
npm run dev
```

Open <http://localhost:5173>.

### Environment variables

| File | Variable | Purpose |
| --- | --- | --- |
| `backend/.env` | `DATABASE_URL` | SQLAlchemy URL for PostgreSQL (**required**, no default) |
| | `CORS_ORIGINS` | Comma-separated browser origins allowed to call the API |
| | `ENVIRONMENT` | `development`, `test` or `production` (production hides `/docs`) |
| | `LOG_LEVEL` | Python log level |
| `apps/mobile/.env` | `EXPO_PUBLIC_API_URL` | API base URL used by the app |
| `apps/web/.env.local` | `VITE_API_URL` | API base URL used by the web app |

Only `.env.example` files are committed. Client-side variables (`EXPO_PUBLIC_*`,
`VITE_*`) are embedded in the app bundle and must never contain secrets.

---

## Quality checks

| Area | Command (run inside the folder) |
| --- | --- |
| Backend lint / format | `ruff check .` · `ruff format --check .` |
| Backend types | `mypy app tests alembic` |
| Backend tests | `pytest` (needs the database container running) |
| Migrations match models | `alembic check` |
| Mobile types / lint | `npm run typecheck` · `npm run lint` |
| Web types / lint / build | `npm run typecheck` · `npm run lint` · `npm run build` |

---

## Data model

```
users                                   messages
─────────────────────────────           ──────────────────────────────────────────────
id          uuid  PK                    id                       uuid  PK
created_at  timestamptz  NOT NULL  ◄──┐ user_id                  uuid  NOT NULL  FK → users.id (ON DELETE CASCADE)
                                      └ subject                  varchar(40)  NOT NULL
                                        text                     text  NOT NULL
                                        created_at               timestamptz  NOT NULL
                                        attachment_filename      varchar(255)  NULL
                                        attachment_content_type  varchar(127)  NULL
                                        attachment_size_bytes    integer  NULL

Index: ix_messages_user_id_created_at (user_id, created_at DESC)
```

- **UUID primary keys** are generated by the server (Python `uuid4`, with
  `gen_random_uuid()` as the database default). They are not guessable, so ids in URLs
  do not reveal how many messages exist.
- **Timestamps** are `timestamptz`, set by the database (`now()`), and every connection
  pins its session time zone to UTC. Clients never supply `created_at`.
- **Integrity is enforced in the database**, not only in the API, so no code path can
  store invalid data:
  - `user_id` is `NOT NULL` with a foreign key to `users` (a message always has an owner);
  - `subject` is at most 40 characters (`varchar(40)` plus a check constraint) and
    cannot be blank; `text` cannot be blank;
  - attachment metadata is all-or-nothing and its size cannot be negative.
- **Index:** `(user_id, created_at DESC)` matches the inbox query ("this user's
  messages, newest first"). Because `user_id` is its leading column, it also serves
  lookups by owner and the foreign-key check, so no separate `user_id` index is needed.
- **Attachments:** only metadata columns exist. Storing the files themselves is out of
  scope for now; the columns let that be added without a schema redesign.
- **Constraint names** follow a fixed naming convention (`pk_`, `fk_`, `ck_`, `ix_`), so
  migrations are deterministic and errors are easy to trace.

The same shapes are used across layers: SQLAlchemy models (`app/models`) for storage,
Pydantic schemas (`app/schemas`) for the API. `MessageCreate` accepts only `subject` and
`text` and **rejects** any other field (such as `user_id` or `created_at`) instead of
silently ignoring it. `MessageRead` never exposes `user_id`.

## User handling

Messages belong to a user, and the backend alone decides who that is:

- Business logic (`app/services`) receives a `CurrentUser` value and never reads
  headers or tokens. Ownership is always taken from `CurrentUser`, never from the
  request body.
- `get_current_user` (`app/core/identity.py`) is the single place that turns a request
  into a `CurrentUser`. For this exercise the client sends an opaque UUID in the
  `X-User-Id` header, and a user row is created on first use (safe under concurrent
  requests).
- **Trade-off:** this identifies the caller but does not *authenticate* them; anyone who
  knows a UUID can act as that user. It keeps the exercise simple, as the brief allows.
  Moving to JWT/OAuth means rewriting only `get_current_user` (verify the token, map its
  subject to a user). Services, models and routes stay the same.

---

## Design system

Both clients implement the same small set of building blocks:

| Component | Mobile | Web |
| --- | --- | --- |
| Typography | `AppText` (`title`, `heading`, `subheading`, `body`, `label`, `caption`) | CSS font tokens |
| Button | `Button` — `primary` / `secondary` / `danger` / `ghost`, loading + disabled | `Button`, `ButtonLink` |
| Input | `TextField` — visible label, hint, error, character counter | `TextField` (input / textarea) |
| List row | `ListRow` — card row with optional trailing action | `ListRow` (inside `<ul>`) |
| Screen container | `Screen` — safe areas, keyboard avoidance, pinned footer | `PageContainer` + `AppLayout` |
| States | `LoadingState`, `EmptyState`, `ErrorState` (with retry), `InlineError` | same |
| Confirmation | `ConfirmDialog` (modal) | `ConfirmDialog` (native `<dialog>`) |

Guidelines:

- **One primary action per screen.** Destructive actions use the `danger` style and
  always go through `ConfirmDialog`.
- **Touch targets are at least 48 px/dp** (buttons, inputs, list rows).
- **Spacing** uses a 4-based scale (`4, 8, 12, 16, 24, 32, 48`).
- **Contrast:** text colours meet WCAG AA (≥ 4.5:1) on the background and surface colours.
- **Content width** is capped (640 dp on mobile tablets, 720 px on web) for readability; the
  web layout has no horizontal overflow down to 320 px wide.

### Accessibility conventions

- Every input has a **visible, programmatically associated label**; placeholders are never
  the only label. Hints and errors are linked to the field (`aria-describedby` /
  `accessibilityHint`).
- Errors are communicated with **text**, not colour alone (e.g. an "Error:" prefix for
  screen readers, a text banner for failed requests).
- Interactive elements use semantic controls (`button`, `a`, `accessibilityRole`) and
  expose disabled/busy state.
- Loading and error states are announced (`role="status"` / `role="alert"`, live regions).
- **Web:** skip-to-content link, visible `:focus-visible` rings, focus moves to the page
  heading on navigation, the document title reflects the page, and dialogs trap focus
  and close with Escape. Reduced-motion preferences are respected.
- **Mobile:** headings are exposed as headers, text scales with the system font size
  (capped at 1.8×), and dialogs are marked as modal for VoiceOver/TalkBack.

---

## Roadmap

1. **Foundation** — project structure, design system, navigation, `/health` ✅
2. **Database** — models, migrations, integrity rules, current-user seam ✅
3. Messages REST API with validation, user scoping and tests
4. Mobile: API client and data fetching
5. Mobile: inbox, detail and create screens
6. Web: the same features on the shared API
7. Final documentation: data model, decisions and trade-offs
