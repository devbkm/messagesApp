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

> **Project status:** Phase 7 — UI polish. The backend, the React Native app and the
> optional React web app are complete. They have been through a security, reliability
> and edge-case review (see [Security and reliability](#security-and-reliability)) and a
> UI/usability review (see [Design system](#design-system)).

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
│   │       ├── api/            # HTTP client, endpoint functions, wire types, query client
│   │       ├── components/     # ui/ (design system) and messages/ (inbox row)
│   │       ├── hooks/          # TanStack Query hooks (list, detail, create, delete)
│   │       ├── identity/       # Per-device user id (sent as X-User-Id)
│   │       ├── navigation/     # Stack navigator + typed route params
│   │       ├── screens/        # Inbox, MessageDetail, CreateMessage
│   │       ├── theme/          # Design tokens
│   │       ├── utils/          # Date formatting, validation, error messages
│   │       └── __tests__/      # Jest + React Native Testing Library
│   └── web/                    # React web app (optional client)
│       └── src/
│           ├── api/            # HTTP client, endpoint functions, wire types, query client
│           ├── components/ui/  # Design-system components (CSS Modules)
│           ├── hooks/          # TanStack Query hooks (list, detail, create, delete)
│           ├── identity/       # Per-browser user id (sent as X-User-Id)
│           ├── layouts/        # App shell (skip link, header, main)
│           ├── pages/          # Inbox, MessageDetail, CreateMessage, NotFound (+ tests)
│           ├── styles/         # Tokens + global styles
│           ├── utils/          # Date formatting, validation, error messages
│           ├── test/           # Vitest setup and render helper
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
set `EXPO_PUBLIC_API_URL` to your computer's LAN IP (e.g. `http://192.168.1.20:8000`),
not `localhost`; on the Android emulator use `http://10.0.2.2:8000`. Restart
`npx expo start` after changing `.env`.

### 4. Web app (optional)

```bash
cd apps/web
npm install
cp .env.example .env.local
npm run dev
```

Open <http://localhost:5173>. The backend's `CORS_ORIGINS` (in `backend/.env`) must
include this origin; `.env.example` already does.

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
| Mobile tests / types / lint | `npm test` · `npm run typecheck` · `npm run lint` |
| Web tests / types / lint / build | `npm test` · `npm run typecheck` · `npm run lint` · `npm run build` |

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
- **Mobile client:** on first launch the app generates a random UUID (`expo-crypto`),
  stores it on the device (AsyncStorage) and sends it with every request. The same
  inbox is therefore shown across restarts; reinstalling the app starts a new, empty
  inbox. With real authentication, `src/identity/userId.ts` would return a token instead.
- **Web client:** the same approach, stored in `localStorage` (`crypto.randomUUID()`).
  The browser and the phone are therefore different users unless they share an id,
  which is the expected consequence of having no sign-in.

---

## REST API

Base path: `/api/v1`. JSON in and out. The machine-readable contract is served at
`/openapi.json`, with interactive docs at `/docs` (both disabled when
`ENVIRONMENT=production`). In Swagger UI, use **Authorize** to set `X-User-Id`.

| Method | Path | Success | Errors |
| --- | --- | --- | --- |
| `GET` | `/api/v1/messages` | `200` list of the caller's messages, newest first | `401`, `503` |
| `GET` | `/api/v1/messages/{id}` | `200` the full message | `401`, `404`, `422`, `503` |
| `POST` | `/api/v1/messages` | `201` the created message + `Location` header | `401`, `422`, `503` |
| `DELETE` | `/api/v1/messages/{id}` | `204` no body | `401`, `404`, `422`, `503` |
| `GET` | `/health` | `200` `{"status": "ok"}` (no identity needed) | — |

Every `/api/v1/messages` request must include the header
`X-User-Id: <uuid>` (see [User handling](#user-handling)).

### Request and response bodies

**Create** — `POST /api/v1/messages`

```json
{ "subject": "Example", "text": "Message content" }
```

**Message** — returned by `POST` and `GET /{id}`

```json
{
  "id": "687abbcc-15a4-4043-8443-2b60f6b4974e",
  "subject": "Example",
  "text": "Message content",
  "created_at": "2026-09-25T07:28:54.980508Z",
  "attachment": null
}
```

`attachment`, when present, is `{"filename", "content_type", "size_bytes"}`.

**List** — `GET /api/v1/messages`

```json
{
  "items": [
    {
      "id": "687abbcc-15a4-4043-8443-2b60f6b4974e",
      "subject": "Example",
      "created_at": "2026-09-25T07:28:54.980508Z",
      "has_attachment": false
    }
  ]
}
```

The list carries only what the inbox shows (subject, date). The full text comes from
`GET /{id}`. `created_at` is always UTC in ISO 8601; clients format it for display
(e.g. `dd.mm.YYYY`). The list is wrapped in `items` so pagination fields can be added
later without a breaking change.

### Validation rules

| Field | Rule |
| --- | --- |
| `subject` | Required string; 1–40 characters after trimming surrounding whitespace; a single line with at least one visible character (no control or zero-width-only content) |
| `text` | Required string; 1–10,000 characters after trimming surrounding whitespace; line breaks and tabs are kept, other control characters (e.g. NUL) are rejected |
| request body | At most 256 KiB, with a `Content-Length` header (`413` / `411` otherwise) |
| any other field | Rejected with `422`, including `id`, `user_id` and `created_at` |
| `{id}` path parameter | Must be a UUID, otherwise `422` |
| `X-User-Id` header | Required UUID, otherwise `401` |

The 10,000-character limit on `text` is an assumption; the brief sets no maximum. It
protects the API from oversized payloads. Lengths count Unicode characters (code
points): 40 emoji make a valid subject. Both clients count the same way. Validation runs on the server even though the
clients also validate, and the database enforces the same rules again (see
[Data model](#data-model)).

### Errors

All errors share one envelope:

```json
{
  "error": {
    "code": "validation_error",
    "message": "The request is invalid.",
    "details": [
      { "field": "body.subject", "message": "String should have at most 40 characters" }
    ]
  }
}
```

| Status | `code` | When |
| --- | --- | --- |
| `401` | `unauthorized` | `X-User-Id` missing or not a UUID |
| `404` | `not_found` | The message does not exist **or belongs to another user**. Both cases return the same response, so nothing reveals that another user's message exists. |
| `405` | `method_not_allowed` | Unsupported HTTP method |
| `411` | `length_required` | A body was sent without `Content-Length` (e.g. chunked upload) |
| `413` | `payload_too_large` | The body is larger than 256 KiB |
| `422` | `validation_error` | Invalid body, malformed JSON, unknown fields, or an invalid id. `details` lists each problem by field. |
| `500` | `internal_error` | Unexpected error. Details are logged on the server only. |
| `503` | `service_unavailable` | The database is unreachable; the client may retry. |

Responses never include stack traces, SQL, driver messages or submitted values. API
responses are sent with `Cache-Control: no-store` (they hold private data) and
`X-Content-Type-Options: nosniff`.

### Design decisions

- **Scoping:** every service query filters on both the message id *and* the current user,
  so another user's message is indistinguishable from a missing one.
- **Unknown fields are rejected, not ignored:** a client that sends `user_id` or
  `created_at` gets a clear `422` instead of the value being silently dropped.
- **Invalid ids return `422`,** matching the `uuid` format in the OpenAPI contract, rather
  than `404`.
- **No pagination yet:** an inbox in this exercise stays small. The `items` wrapper and
  the `(user_id, created_at DESC)` index let cursor pagination be added without breaking
  clients.

---

## Security and reliability

A dedicated review (phase 6) checked the items below. Each one is covered by an
automated test unless marked as manual.

### API security

| Check | How it is ensured |
| --- | --- |
| User isolation | Every query filters on message id **and** owner; other users' messages return the same `404` as missing ones. Covered for read, delete and list. |
| Ownership cannot be supplied | `MessageCreate` accepts only `subject` and `text`; `user_id`, `id` and `created_at` are rejected with `422` and nothing is stored. |
| IDs cannot bypass authorization | UUIDs are not guessable, and knowing one grants nothing: authorization never depends on the id alone. |
| Safe database access | All SQL goes through the SQLAlchemy ORM with bound parameters. The only raw SQL fragments are constant DDL (defaults, check constraints). |
| Unstorable input | NUL and other control characters are rejected at validation (`422`); before this review a NUL caused a `500` from PostgreSQL. |
| Oversized requests | Bodies over 256 KiB get `413`, and bodies without `Content-Length` get `411`, before anything is parsed. |
| No leaked internals | Stack traces, SQL, driver messages and submitted values never appear in responses. Unexpected errors are logged on the server and answered with a generic `500` / `503`. |
| Server-side validation | Enforced by Pydantic, then again by database constraints, regardless of client checks. |
| CORS | Only origins listed in `CORS_ORIGINS` get CORS headers; others are refused. |
| Production settings | `DATABASE_URL` has no default; `/docs` and `/openapi.json` are disabled when `ENVIRONMENT=production`. |

### Secrets and configuration

- No secrets are committed. `.env` files are git-ignored; only `.env.example` files with
  placeholders are tracked. The one credential in the repository is the documented,
  development-only database password in `docker-compose.yml`, and the database port is
  bound to `127.0.0.1` only.
- Database credentials exist only in the backend's environment. The clients receive a
  single public value, the API base URL (`EXPO_PUBLIC_API_URL` / `VITE_API_URL`). The
  production web bundle and the compiled Android bundle were scanned and contain no
  database URL, password or backend setting (manual check).
- The clients do not log anything (`console.*` is not used) and never render HTML from
  data: React escapes all text, so a subject like `<img onerror=…>` is shown literally
  (tested).

### Reliability

| Scenario | Behaviour |
| --- | --- |
| API unavailable | Clear "Can't reach the server" error with **Try again**; queries retry once automatically first. |
| Slow API | Skeletons and busy buttons are shown immediately. After 15 s the request is aborted with "The server is taking too long to respond". |
| Invalid / malformed response | Every response is checked before use. A non-JSON body, wrong shape or bad date becomes a normal, recoverable error, not a crash. |
| Unexpected render error | A last-resort boundary (mobile) or route error page (web) shows a friendly screen with a way to recover. |
| Empty database | A friendly empty state with a call to action, never a blank screen. |
| Duplicate submission | Create and delete ignore repeated taps, clicks and Enter while a request is running. |
| Repeated delete / deleted elsewhere | A `404` on delete counts as success: the row disappears without an error. Opening a message that was deleted elsewhere shows "not found" and removes the stale row from the inbox. |
| Network failure during create / delete | Create keeps the form content and allows retry. Delete keeps the message and offers **Try again**. |
| Reopening the app | The per-device user id is persisted (AsyncStorage / localStorage), so the same inbox is shown. On the web, a random id is still generated where `crypto.randomUUID` is unavailable (plain-`http` LAN address) or storage is blocked. |
| Many messages | 150 messages are listed newest first (API). The mobile list is virtualised (300 messages tested); the web list renders 500 without issue. |

### Edge cases

| Case | Result |
| --- | --- |
| Exactly 40 characters, including 40 emoji, accented or CJK characters | Accepted everywhere; the counter shows `40/40`. |
| More than 40 characters | Rejected by the clients while typing and by the API (`422`). |
| Very long message (10,000 characters, including emoji) | Accepted; the detail views scroll and wrap long words. |
| Multiline text with tabs | Stored and shown exactly as written. |
| Unicode, right-to-left text, special characters, markup | Round-trips unchanged and is displayed as plain text. |
| Invisible-only or multi-line subject | Rejected with a clear message, in the clients and the API. |
| Keyboard opening, small phone screens | Handled by keyboard-avoiding layouts with the submit button pinned above the keyboard, and 320 px web layouts. Verified manually in a phone-sized browser; still to be checked on a physical device. |

### Known limitations

- **No authentication.** `X-User-Id` identifies but does not authenticate (see
  [User handling](#user-handling)).
- **Retrying after a lost create response can duplicate a message.** If a create
  succeeds on the server but the response is lost (e.g. timeout), retrying creates a
  second copy. Idempotency keys would prevent this but are beyond the exercise's scope.
- **No rate limiting.** It would normally sit in a reverse proxy or API gateway in
  front of the service.

---

## Mobile app

The React Native app is the primary client. It has three screens on a native stack:

| Screen | What it shows | States |
| --- | --- | --- |
| **Inbox** (landing) | A virtualised `FlatList` of the user's messages, newest first. Each card shows the **subject** (up to two lines) and the **date and time** (`dd.mm.YYYY, HH:mm`), plus "Attachment" when there is one. Tapping a card opens the detail screen; a trash button deletes. "New message" is pinned at the bottom. Pull to refresh. | Skeleton while loading (never a false "empty"), friendly empty state with "Write your first message", error with **Try again**, and an inline banner if a background refresh fails |
| **Message detail** | Subject as the page title, then date/time, the full text (scrollable, selectable), and attachment details if present | Loading, "Message not found" with **Back to inbox**, other errors with **Try again** |
| **Create message** | Subject and message fields with visible labels, placeholders and a live `n/40` counter; submit button pinned above the keyboard | Validation, submission progress, failure banner, discard-draft confirmation |

**Data fetching.** TanStack Query holds the server state. `useMessageList`, `useMessage`,
`useCreateMessage` and `useDeleteMessage` (`src/hooks/useMessages.ts`) wrap the API
functions. Queries retry once on network/5xx errors but never on 4xx; mutations never
retry automatically, so a create or delete only happens when the user asks. Data is
refetched when the app returns to the foreground.

**Creating.** Validation mirrors the server (subject 1–40 characters and text required,
both after trimming). An over-long subject is reported while typing. "Required" errors
appear once a field is left or on submit, and focus moves to the first invalid field.
Pasted text is never silently truncated; the counter and the error explain the
problem instead. While saving, the button shows progress and ignores further taps. On
success the new message is written into the cached list at once, the list is
refetched, and the app returns to the inbox, so the new message is visible
immediately. On failure the form stays open with its content, a banner explains what
happened, and field errors from the server appear next to the field. Leaving with a
draft asks "Discard this message?" first.

**Deleting.** The trash button opens a confirmation dialog naming the message. While
the request runs, Delete shows progress and both buttons are disabled, so duplicate
requests are impossible. On success the dialog closes and the row disappears. On
failure the message stays in the list, the dialog shows the error and the button
becomes **Try again**.

**Errors.** The API client (`src/api/client.ts`) turns every failure (offline, timeout
after 15 s, error envelope, unexpected response) into an `ApiError`, and
`describeError` maps it to a short, plain sentence. Raw error messages and stack
traces are never shown.

**Accessibility.** Rows are announced as "subject, 25 September 2026 at 07:28", and
delete buttons as "Delete message: subject". Inputs are named "Subject, required".
Errors start with "Error:", so they do not rely on colour. The loading skeleton is a
single announced progress element. Outcomes ("Message created", "Message deleted") are
announced to screen readers. All controls are at least 48 dp.

**Tests** (`npm test`, 51 tests) render the whole app with either the API module or `fetch` mocked, and
cover:
- inbox rendering, accessible names and long subjects;
- loading, empty and error states, including retry;
- delete: confirmation, cancel, progress, duplicate taps, success, and failure with retry;
- form validation, create success (back to inbox with the message listed) and failure
  (input kept, retry), and server field errors;
- the discard-draft guard and navigation to and from the detail screen;
- the API client and the formatting and validation helpers.

---

## Web app

The optional React web client (Vite, React Router, TanStack Query) talks to the same
`/api/v1` endpoints as the mobile app. It has no business logic of its own: ownership,
timestamps and validation all come from the API. The client-side checks only mirror
the API's limits to give instant feedback.

| Route | Page |
| --- | --- |
| `/` | **Inbox**: messages newest first. Each row is one link showing the **subject** (wraps to two lines) and the **date/time** as a `<time>` element, with a separate **Delete** button. "New message" sits next to the page heading. |
| `/messages/:id` | **Message detail**: a separate page with the subject as the `<h1>`, the date/time below it, then the full text (line breaks kept, long words wrap) and the attachment, if any. |
| `/messages/new` | **Create message**: labelled subject and message fields with a live counter, inline errors and Cancel / Create message buttons. |
| anything else | **Not found** page with a link back to the inbox. |

**Shared with mobile:** the same API client behaviour (error envelope → `ApiError`,
15-second timeout, user id header), the same query hooks and cache updates, the same
validation rules and messages, the same `dd.mm.YYYY, HH:mm` formatting and the same
design tokens. The code is duplicated rather than shared as a package, so each app
builds on its own with no monorepo tooling (see [Architecture](#architecture)).

**States and recovery:**
- skeleton while loading;
- friendly empty state with "Write your first message";
- error state with **Try again**;
- a banner if a background refresh fails;
- "Message not found" with a way back.

Create keeps the form and its content on failure and shows the reason, and server field
errors appear inline. Delete keeps the message and changes the button to **Try again**.
While a request runs, the relevant buttons are disabled and marked `aria-busy`, and
repeated clicks or Enter presses are ignored.

**Deliberate destructive actions:** delete always goes through a confirmation dialog
that names the message. Leaving the create page with a draft, by link or back button,
asks "Discard this message?". Closing or reloading the tab shows the browser's own
"leave site?" prompt.

**Responsive:** a single-column layout capped at 720 px, with 16 px side margins (24 px
from 768 px up). Form buttons stack full-width below 480 px. Long subjects are clamped
to two lines in the list and wrap fully on the detail page, and unbroken words wrap
anywhere. I checked it at 1280, 768, 375 and 320 px: no horizontal scrolling on any
page.

**Accessibility (web):**
- Headings follow a clear hierarchy: `h1` per page, `h2` for sections and dialogs.
- There is a skip link, and focus moves to the page heading on every navigation; the
  document title names the page.
- Everything works from the keyboard, and `:focus-visible` rings are shown on all controls.
- Dialogs use the native `<dialog>`, which traps focus and closes with Escape.
- Focus starts on the safe choice (Cancel). When a dialog closes, focus returns to the
  button that opened it, or to the page heading if that row was deleted.
- Each delete button is named "Delete message: subject".
- Fields have `<label>`s. Hints, counters and errors are linked with
  `aria-describedby`, and invalid fields set `aria-invalid`.
- Errors begin with a visible "Error:", and success is announced through a status region.

**Tests** (`npm test`, Vitest + Testing Library, 50 tests) render the real routes with
either the API module or `fetch` mocked. They cover:
- the inbox, its loading, empty and error states, and retry;
- keyboard order and the skip link;
- delete: confirmation, cancel, busy state, a single request, success with focus
  handling, and failure with retry;
- the detail page's content, attachment, not-found and retry states;
- form validation, the no-truncation counter, create success and failure,
  server field errors, and the discard-draft guard;
- the API client and the helpers.

---

## Design system

Both clients implement the same small set of building blocks:

| Component | Mobile | Web |
| --- | --- | --- |
| Typography | `AppText` (`title`, `heading`, `subheading`, `body`, `label`, `caption`) | CSS font tokens |
| Button | `Button` — `primary` / `secondary` / `danger` / `ghost`, loading + disabled | `Button`, `ButtonLink` |
| Input | `TextField` — visible label, hint, error, character counter | `TextField` (input / textarea) |
| List row | `ListRow` — card row with a chevron and optional trailing action | `ListRow` (inside `<ul>`) |
| Icons | Ionicons (`@expo/vector-icons`), `IconButton` | `Icon`: small inline SVG set, no icon font |
| Screen container | `Screen` — safe areas, keyboard avoidance, pinned footer | `PageContainer` + `AppLayout` |
| States | `LoadingState`, `EmptyState`, `ErrorState` (with retry), `InlineError` | same |
| Confirmation | `ConfirmDialog` (modal) | `ConfirmDialog` (native `<dialog>`) |

Guidelines:

- **One primary action per screen.** Create actions carry a "+" icon on both clients.
- **Rows that open something show a chevron.** The row's secondary line shows the
  date/time and, when present, a paperclip "Attachment" marker.
- **Destructive actions are quiet until confirmed.** The per-row delete control is
  neutral grey (red only on hover/focus on the web); the `danger` style is reserved for
  the confirmation dialog, so a list does not read as a wall of warnings.
- **Page purpose is stated.** The inbox shows "N messages · newest first" under its
  title.
- **App identity:** the mobile app icon, Android adaptive icon and favicons use the same
  inbox-tray mark as the web header and favicon (no template placeholders).
- **Touch targets are at least 48 px/dp** (buttons, inputs, list rows).
- **Spacing** uses a 4-based scale (`4, 8, 12, 16, 24, 32, 48`).
- **Contrast:** text colours meet WCAG AA (≥ 4.5:1) on the background and surface colours.
- **Content width** is capped (640 dp on mobile tablets, 720 px on web) for readability; the
  web layout has no horizontal overflow down to 320 px wide. On phones the web page's
  primary action spans the full width and row delete controls become icon-only (they
  keep their accessible name).
- **Reviewed at** 320×568, 375×812, 768×1024 and 1024–1280 px wide. The mobile app was
  checked in a phone-sized browser; keyboard behaviour still needs a check on a device.

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
3. **REST API** — messages endpoints, user scoping, validation, errors, OpenAPI ✅
4. **Mobile app** — inbox, detail and create screens on the real API, with tests ✅
5. **Web client** — the same features on the shared API, responsive and keyboard accessible ✅
6. **Hardening** — security, reliability and edge-case review, with fixes and tests ✅
7. **UI polish** — consistency and usability review of both clients ✅
8. Final documentation: decisions and trade-offs
