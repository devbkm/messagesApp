# Inbox

A small inbox application in which each user can **create, view and delete their own
messages**, built as a full-stack practical exercise:

| Part | Status in the brief | Technology |
| --- | --- | --- |
| Mobile app (primary client) | Required | React Native · Expo · TypeScript |
| REST API | Required | Python · FastAPI · Pydantic · SQLAlchemy · Alembic |
| Database | Required | PostgreSQL |
| Web app | Optional (implemented) | React · Vite · TypeScript |

Both clients use the same versioned REST API (`/api/v1/...`). The backend alone decides
ownership, validation, creation dates and deletion.

**Quick start:** [Local setup](#15-local-setup) · [API endpoints](#9-api-endpoints) ·
[Testing](#18-testing) · [Requirement coverage](#requirement-coverage)

## Contents

1. [Problem statement](#1-problem-statement)
2. [Solution overview](#2-solution-overview)
3. [Architecture](#3-architecture)
4. [Technology choices](#4-technology-choices)
5. [Repository structure](#5-repository-structure)
6. [Database model](#6-database-model)
7. [User handling](#7-user-handling)
8. [Security model](#8-security-model)
9. [API endpoints](#9-api-endpoints)
10. [Request and response examples](#10-request-and-response-examples)
11. [Validation](#11-validation)
12. [Mobile UI](#12-mobile-ui)
13. [Web UI](#13-web-ui)
14. [Loading, error and empty states](#14-loading-error-and-empty-states)
15. [Local setup](#15-local-setup)
16. [Database initialization](#16-database-initialization)
17. [Environment variables](#17-environment-variables)
18. [Testing](#18-testing)
19. [Architectural trade-offs](#19-architectural-trade-offs)
20. [Assumptions](#20-assumptions)
21. [Production improvements](#21-production-improvements)
- [Requirement coverage](#requirement-coverage)
- [Development history](#development-history)

---

## 1. Problem statement

Build a simple inbox in which users create, view and delete messages. Messages are
**user-specific**: each message belongs to a user ID, and a user only sees and manages
their own messages.

The brief asks for three screens:

- **Landing / inbox screen:** lists the current user's messages. Each item shows two
  properties, the **date (`dd.mm.YYYY`)** and the **subject**. There is a button to
  create a message, a message can be deleted from here, and tapping an item opens its
  detail screen.
- **Message detail screen:** shows all properties of a message: subject, date and text,
  plus an optional attachment.
- **Create message screen:** **subject** and **text** are mandatory, and the subject may
  not exceed **40 characters**. After a successful save the app returns to the landing
  screen. The **date is created by the backend**.

It must run as a **React Native** mobile app, with an optional **React** web app on the
same backend. The backend exposes **REST endpoints** and stores messages in a
**database**. The brief puts special weight on:
- the data structure and how a message is linked to a user;
- user handling;
- database setup from a clean checkout;
- API shapes and server-side validation;
- loading, empty and error behaviour;
- a written explanation of the approach.

## 2. Solution overview

- **Backend:** a FastAPI service with four message endpoints, each scoped to the calling
  user. PostgreSQL stores users and messages, and the schema is created by Alembic
  migrations. Validation happens in Pydantic schemas and again in database constraints.
  Every error uses one consistent JSON shape that never includes internal details.
- **Mobile app** (primary): Expo / React Native with React Navigation and TanStack
  Query.
  - **Inbox:** a virtualised list with pull to refresh and delete confirmation.
  - **Message detail:** a separate screen.
  - **Create message:** validation, a character counter and keyboard-aware layout.
  - **States:** deliberate loading, empty and error states throughout.
- **Web app** (optional): React with Vite, React Router and TanStack Query. It has the
  same three pages and states, is responsive from 320 px to desktop, and works fully
  from the keyboard.
- **User identity:** simplified as the brief allows. Each client generates a random
  UUID once, stores it, and sends it as `X-User-Id`. All identity handling sits in one
  function on the server, so it can later be replaced by real authentication (JWT/OAuth)
  without touching the business logic.
- **Quality:** 211 automated tests (110 backend, 51 mobile, 50 web). All three parts
  pass strict type checks and lint, and the builds and migration drift check succeed.
  A dedicated security, reliability and edge-case review, and a UI/usability review,
  were carried out.

Out of scope: editing messages, uploading attachments (the data model and UI display
attachment metadata, but no upload endpoint exists), and real authentication.

## 3. Architecture

```
┌──────────────────────┐     ┌──────────────────────┐
│  apps/mobile (Expo)  │     │  apps/web (Vite)     │
│  React Native + TS   │     │  React + TS          │
│  TanStack Query      │     │  TanStack Query      │
└──────────┬───────────┘     └──────────┬───────────┘
           │    JSON over HTTP  /api/v1/…  (X-User-Id header)
           └─────────────┬──────────────┘
                         ▼
        ┌─────────────────────────────────┐
        │  backend (FastAPI)              │
        │  routes      → HTTP only        │
        │  identity    → CurrentUser      │
        │  services    → business rules   │
        │  schemas     → Pydantic I/O     │
        │  models      → SQLAlchemy ORM   │
        └────────────────┬────────────────┘
                         ▼
              ┌──────────────────────┐
              │  PostgreSQL          │
              │  (Alembic migrations)│
              └──────────────────────┘
```

**Backend layers:**
- **Routes** (`app/api/routes`) handle only HTTP: status codes, response models and the
  `Location` header.
- **`get_current_user`** (`app/core/identity.py`) turns a request into a `CurrentUser`.
- **Services** (`app/services`) hold the rules and receive a `CurrentUser`; they never
  read headers or tokens.
- **Schemas** (`app/schemas`) define the API shapes; **models** (`app/models`) define
  storage.
- **Settings** come only from environment variables, and **error handlers**
  (`app/core/errors.py`) produce the single error envelope.

**Clients:**
- Each client is split into:
  - an API client that normalises errors, times out after 15 s and checks responses;
  - endpoint functions;
  - TanStack Query hooks;
  - screens/pages built from a small design system.
- The two clients are independent apps with the same structure and identical design
  tokens. They share no runtime package (see [trade-offs](#19-architectural-trade-offs)).

**One consistent data shape everywhere:**

| Layer | Definition |
| --- | --- |
| Database | `messages` table: `id`, `user_id`, `subject`, `text`, `created_at`, attachment metadata |
| ORM | `app/models/message.py` (`Message`) |
| API | `app/schemas/message.py`: `MessageCreate`, `MessageSummary`, `MessageRead` |
| Clients | `src/api/types.ts` in both apps, mirroring the API schemas |

`user_id` exists in the database and the ORM but is **never** accepted from or sent to
clients: ownership is implicit in who is asking.

## 4. Technology choices

| Concern | Choice | Why |
| --- | --- | --- |
| API framework | **FastAPI** | See below |
| Database | **PostgreSQL 17** | See below |
| Data access | **SQLAlchemy 2.0** (typed ORM) + psycopg 3 | See below |
| Migrations | **Alembic** | See below |
| Validation / settings | **Pydantic v2** + pydantic-settings | See below |
| Mobile | **React Native + Expo SDK 57**, TypeScript, React Navigation (native stack) | See below |
| Server state (both clients) | **TanStack Query v5** | See below |
| Web | React 19, Vite, React Router, CSS Modules | Fast builds; plain CSS with design tokens rather than a UI kit, so the look is deliberate and matches mobile |
| Tests | pytest (real PostgreSQL), Jest + React Native Testing Library, Vitest + Testing Library | Tests exercise real behaviour: the database with its constraints, and screens as users see them |
| Quality | ruff, mypy (strict), ESLint (expo config), oxlint, TypeScript strict | Mistakes are caught before runtime |

**Why FastAPI.**
- Request and response models are declared with Pydantic, so validation, serialisation
  and the **OpenAPI contract** come from one definition. `/docs` always matches the
  code.
- Its dependency injection gives a clean place for "who is calling"
  (`Depends(get_current_user)`) and for the database session.
- It is typed end to end, which works well with mypy, and needs very little
  boilerplate for a small service.
- Django would bring an admin, templates and its own ORM that this API doesn't need.
  Flask would need validation and API documentation added by hand.

**Why PostgreSQL.**
- The data is relational: messages belong to users. PostgreSQL enforces that with a
  real foreign key and `NOT NULL` ownership.
- It supports check constraints for the business rules, time-zone-aware timestamps
  (`timestamptz`), native UUIDs (`gen_random_uuid()`) and correct behaviour under
  concurrent requests.
- It is the kind of database this would run on in production, so the tests run against
  the same engine rather than SQLite, which differs in constraints, types and
  concurrency.

**Why SQLAlchemy.**
- Every query is built from bound parameters, which rules out SQL injection by
  construction.
- The 2.0 API is fully typed, and the models also define the schema constraints and
  indexes, which is what Alembic compares against.
- It is the most mature Python data layer, with a precise transaction model; the tests
  rely on it to roll each test back.

**Why Alembic.**
- Schema changes are versioned, reviewed code rather than ad-hoc SQL. A clean checkout
  gets the exact schema with `alembic upgrade head`.
- `alembic check` fails if the models and migrations drift apart.
- Every test run migrates the test database up, down and up again, so migrations are
  known to be reversible.
- The database URL comes from the environment, not `alembic.ini`.

**Why Pydantic.**
- Validation rules are declarative and live next to the field they protect. Examples:
  trimmed lengths, a single-line subject, no control characters.
- `extra="forbid"` makes the API **reject** fields it doesn't own, such as `user_id` or
  `created_at`.
- It produces consistent, per-field error details, which the error handler turns into
  the `details` array. The same models generate the OpenAPI schema.
- pydantic-settings loads and validates configuration. `DATABASE_URL` is required and
  has no default.

**Why React Native with Expo.**
- The brief requires React Native.
- Expo removes native project setup: a reviewer can run the app in Expo Go from a QR
  code, `npx expo install` picks SDK-compatible dependency versions, and `expo-doctor`
  checks the project.
- Standard React Navigation and TypeScript keep the code familiar to any React Native
  developer.

**Why TanStack Query.**
- The app's state is almost entirely *server* state: lists and messages that live in
  the API. TanStack Query provides that cache with explicit loading, error and refetch
  states, request de-duplication, retries (once, and never for client errors) and
  cache updates after create and delete.
- This removes hand-written loading flags and a global store.
- The same library and the same hooks run on web and mobile, so both clients behave
  identically.

## 5. Repository structure

```
messagesApp/
├── apps/
│   ├── mobile/                 # React Native (Expo) app: primary client
│   │   ├── App.tsx             # Providers, error boundary, navigation root
│   │   ├── assets/             # App icon, Android adaptive icon, favicon
│   │   └── src/
│   │       ├── api/            # HTTP client, endpoint functions + response checks, types, query client
│   │       ├── components/     # ui/ (design system), messages/ (inbox row), ErrorBoundary
│   │       ├── hooks/          # TanStack Query hooks (list, detail, create, delete)
│   │       ├── identity/       # Per-device user id (sent as X-User-Id)
│   │       ├── navigation/     # Native stack navigator + typed route params
│   │       ├── screens/        # Inbox, MessageDetail, CreateMessage
│   │       ├── theme/          # Design tokens
│   │       ├── utils/          # Date formatting, validation, user-facing error text
│   │       ├── test-utils/     # renderApp helper for tests
│   │       └── __tests__/      # Jest + React Native Testing Library
│   └── web/                    # React web app: optional client
│       └── src/
│           ├── api/            # Same responsibilities as mobile
│           ├── components/ui/  # Design system (CSS Modules), inline SVG icons
│           ├── hooks/          # TanStack Query hooks
│           ├── identity/       # Per-browser user id
│           ├── layouts/        # App shell: skip link, header, main
│           ├── pages/          # Inbox, MessageDetail, CreateMessage, NotFound, RouteError (+ tests)
│           ├── styles/         # Tokens + global styles
│           ├── utils/          # Formatting, validation, error text
│           ├── test/           # Vitest setup + renderApp helper
│           └── router.tsx      # Routes
├── backend/
│   ├── alembic/                # Migration environment + versions/
│   ├── app/
│   │   ├── api/                # Routers: /health, /api/v1/messages
│   │   ├── core/               # Settings, error handling, current-user resolution
│   │   ├── db/                 # Declarative base (naming convention), engine/session
│   │   ├── models/             # User, Message
│   │   ├── schemas/            # Pydantic request/response/error models
│   │   ├── services/           # Business logic (user provisioning, messages)
│   │   └── main.py             # App factory, middleware (security headers, body limit, CORS)
│   ├── tests/                  # pytest suites (models, services, API, hardening, health)
│   ├── requirements.txt        # Runtime dependencies (pinned)
│   └── requirements-dev.txt    # + test and quality tools
├── docker-compose.yml          # Local PostgreSQL 17
└── README.md
```

## 6. Database model

```
users                                   messages
─────────────────────────────           ──────────────────────────────────────────────
id          uuid  PK                    id                       uuid  PK
created_at  timestamptz  NOT NULL  ◄──┐ user_id                  uuid  NOT NULL  FK → users.id (ON DELETE CASCADE)
                                      └ subject                  varchar(40)  NOT NULL
                                        text                     text  NOT NULL
                                        created_at               timestamptz  NOT NULL  DEFAULT now()
                                        attachment_filename      varchar(255)  NULL
                                        attachment_content_type  varchar(127)  NULL
                                        attachment_size_bytes    integer  NULL

Index: ix_messages_user_id_created_at (user_id, created_at DESC)
```

- **Link to the user:** `messages.user_id` is `NOT NULL` with a foreign key to
  `users.id`, so a message cannot exist without an owner. Deleting a user deletes their
  messages.
- **UUID primary keys** are generated server-side (Python `uuid4`, with
  `gen_random_uuid()` as the database default). They are not sequential, so ids reveal
  nothing about other users' data or volume.
- **Timestamps** are `timestamptz`, set by the database clock (`now()`). Every
  connection pins its session time zone to UTC.
- **Integrity is also enforced by the database**, so no code path can store invalid
  data:
  - `subject` is at most 40 characters (`varchar(40)` plus a check constraint) and not
    blank;
  - `text` is not blank;
  - attachment metadata is all-or-nothing, with a size of at least 0.
- **Index:** `(user_id, created_at DESC)` matches the inbox query exactly ("this user's
  messages, newest first"). Its leading column also serves lookups by owner and the
  foreign-key check, so a separate `user_id` index would be redundant.
- **Attachments:** only metadata columns exist; see
  [Assumptions](#20-assumptions) and
  [Production improvements](#21-production-improvements).
- **Constraint names** follow a fixed convention (`pk_`, `fk_`, `ck_`, `ix_`), so
  migrations are deterministic and constraint errors are easy to trace.

## 7. User handling

**How a user is identified.**
- Each client creates a random UUID once and sends it with every request in the
  `X-User-Id` header:
  - **mobile:** `expo-crypto` generates it and AsyncStorage keeps it;
  - **web:** `crypto.randomUUID()` generates it (with a `getRandomValues` fallback on
    plain-`http` origins) and `localStorage` keeps it.
- On the server, `get_current_user` validates the header (missing or not a UUID → `401`)
  and returns a `CurrentUser`.
- It creates the `users` row on first use, with `INSERT … ON CONFLICT DO NOTHING`, which
  is safe when two first requests arrive together.
- The same inbox appears after restarting the app or reloading the page. A different
  device or browser is a different user.

**Why authentication was simplified.** The brief explicitly allows keeping user handling
simple and asks for the choice to be explained. A login system would add accounts,
password or identity-provider flows, token storage and session expiry. None of that
shows the parts the exercise focuses on: the data model, per-user isolation, the API
contract and UI states. The simplified header therefore **identifies** the caller but
does **not authenticate** them: anyone who knows a UUID can act as that user.

**How production authentication would work.** Identity is isolated behind one seam:
services, models and routes depend only on `CurrentUser`, never on how it was obtained.
Moving to real authentication means replacing the body of `get_current_user`:

1. Users sign in with an OpenID Connect provider (e.g. Auth0, Cognito, Keycloak or
   Entra ID):
   - **mobile:** Authorization Code + PKCE via `expo-auth-session`, with tokens kept in
     `expo-secure-store`;
   - **web:** a backend-for-frontend that keeps tokens in an `httpOnly`, `Secure`,
     `SameSite` cookie, or Authorization Code + PKCE.
2. Clients send `Authorization: Bearer <access token>` instead of `X-User-Id`.
3. `get_current_user` verifies the JWT against the provider's published keys (JWKS). It
   checks the signature, issuer, audience and expiry, then maps the token's `sub` to a
   `users` row, for example through an `external_subject` column added by a new
   migration.
4. Nothing else changes: the ownership filters in the services already enforce
   isolation for whatever `CurrentUser` they receive.

**How user isolation is enforced.**
- **Ownership comes from identity, never from input.** `create_message` sets `user_id`
  from `CurrentUser`. `MessageCreate` has no `user_id` field, and sending one is rejected
  (`422`).
- **Every read and delete filters on both keys:** `WHERE id = :id AND user_id = :owner`.
  A message owned by someone else is therefore indistinguishable from a missing one,
  and both return the same `404` body. The API never confirms that another user's
  message exists.
- **The list query filters on `user_id`**, and responses never include `user_id`.
- **The database backs this up** with the `NOT NULL` foreign key.
- **Tests** cover reading, deleting and listing across users with any id format, and
  check that another user's `404` is byte-identical to a missing message.

## 8. Security model

| Concern | Measure |
| --- | --- |
| Isolation | Owner-scoped queries; uniform `404`; ownership only from identity (see [User handling](#7-user-handling)) |
| Server-owned fields | `id`, `user_id` and `created_at` are generated server-side; sending them is rejected with `422` (`extra="forbid"`) |
| Injection | SQLAlchemy ORM with bound parameters only. The only raw SQL fragments are constant DDL (defaults, check constraints) |
| Input safety | Control characters (e.g. NUL, which PostgreSQL cannot store) are rejected with `422`; invisible-only subjects/text are rejected; lengths count Unicode characters |
| Request size | Bodies over 256 KiB → `413`; bodies without `Content-Length` → `411`, before parsing |
| Error disclosure | One error envelope; stack traces, SQL, driver messages and submitted values never leave the server; unexpected errors are logged server-side and answered with a generic `500`/`503` |
| Transport headers | `Cache-Control: no-store` on API responses (private data), `X-Content-Type-Options: nosniff` |
| CORS | Only origins listed in `CORS_ORIGINS`; methods `GET/POST/DELETE`; headers `Content-Type`, `X-User-Id` |
| Configuration | Settings only from environment variables; `DATABASE_URL` has no default; `/docs` and `/openapi.json` are disabled when `ENVIRONMENT=production` |
| Secrets | `.env` files are git-ignored; only `.env.example` files are committed. The single credential in the repo is the documented dev-only database password in `docker-compose.yml`, and the database port is bound to `127.0.0.1` |
| Clients | Receive only the public API URL (`EXPO_PUBLIC_API_URL` / `VITE_API_URL`). The built web bundle and the compiled Android bundle were scanned: no database URL, password or backend setting. No `console` logging; React escapes all text, so markup in a subject is shown literally |
| Destructive actions | Delete always requires confirmation; leaving a draft asks before discarding |

Known limitations are listed under [trade-offs](#19-architectural-trade-offs), and the
fixes for them under [production improvements](#21-production-improvements).

## 9. API endpoints

Base path `/api/v1`, JSON in and out. The machine-readable contract is at
`/openapi.json`, with interactive docs at `/docs` (both disabled in production). In
Swagger UI, **Authorize** sets `X-User-Id`.

| Method | Path | Success | Errors |
| --- | --- | --- | --- |
| `GET` | `/api/v1/messages` | `200` the caller's messages, newest first | `401`, `503` |
| `GET` | `/api/v1/messages/{id}` | `200` the full message | `401`, `404`, `422`, `503` |
| `POST` | `/api/v1/messages` | `201` the created message + `Location` header | `401`, `411`, `413`, `422`, `503` |
| `DELETE` | `/api/v1/messages/{id}` | `204` no body | `401`, `404`, `422`, `503` |
| `GET` | `/health` | `200` `{"status": "ok"}`, no identity or database needed | none |

Every `/api/v1/messages` request needs `X-User-Id: <uuid>`.

| Status | `code` | When |
| --- | --- | --- |
| `401` | `unauthorized` | `X-User-Id` missing or not a UUID |
| `404` | `not_found` | The message does not exist **or belongs to another user** (identical response) |
| `405` | `method_not_allowed` | Unsupported method |
| `411` | `length_required` | A body without `Content-Length` |
| `413` | `payload_too_large` | Body larger than 256 KiB |
| `422` | `validation_error` | Invalid body, malformed JSON, unknown field, or an `{id}` that is not a UUID; `details` lists problems per field |
| `500` | `internal_error` | Unexpected error (logged server-side only) |
| `503` | `service_unavailable` | Database unreachable; safe to retry |

## 10. Request and response examples

**Create a message**

```http
POST /api/v1/messages
X-User-Id: 3f1c6a0e-8d2b-4c9a-9f3e-2b7d5a1c4e60
Content-Type: application/json

{ "subject": "Example", "text": "Message content" }
```

```http
HTTP/1.1 201 Created
Location: http://localhost:8000/api/v1/messages/687abbcc-15a4-4043-8443-2b60f6b4974e

{
  "id": "687abbcc-15a4-4043-8443-2b60f6b4974e",
  "subject": "Example",
  "text": "Message content",
  "created_at": "2026-09-25T07:28:54.980508Z",
  "attachment": null
}
```

**List the inbox:** `GET /api/v1/messages` → `200`

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

The list carries only what the inbox displays; the full text comes from
`GET /api/v1/messages/{id}`. When a message has an attachment, `attachment` is
`{"filename": "contract.pdf", "content_type": "application/pdf", "size_bytes": 248832}`.
`created_at` is always UTC in ISO 8601, and the clients format it in the device's
time zone as `dd.mm.YYYY, HH:mm`.

**Delete:** `DELETE /api/v1/messages/{id}` → `204 No Content`.

**Validation error:** `POST` with a 41-character subject and a `user_id` field → `422`

```json
{
  "error": {
    "code": "validation_error",
    "message": "The request is invalid.",
    "details": [
      { "field": "body.subject", "message": "String should have at most 40 characters" },
      { "field": "body.user_id", "message": "Extra inputs are not permitted" }
    ]
  }
}
```

**Another user's (or a missing) message:** → `404`

```json
{ "error": { "code": "not_found", "message": "Message not found." } }
```

**Try it with curl**

```bash
curl -X POST http://localhost:8000/api/v1/messages -H "X-User-Id: 3f1c6a0e-8d2b-4c9a-9f3e-2b7d5a1c4e60" -H "Content-Type: application/json" -d '{"subject":"Hello","text":"First message"}'
```

## 11. Validation

| Input | Rule (enforced by the API) |
| --- | --- |
| `subject` | Required string; after trimming surrounding whitespace, 1–40 characters (Unicode code points, so 40 emoji are valid); a single line; at least one visible character |
| `text` | Required string; after trimming, 1–10,000 characters; line breaks and tabs kept; other control characters rejected; at least one visible character |
| Other body fields | Rejected, including `id`, `user_id`, `created_at` |
| `{id}` | Must be a UUID |
| `X-User-Id` | Required UUID (`401` otherwise) |
| Body | At most 256 KiB, with `Content-Length` |

**Where each rule is enforced:**
1. **Clients:** on typing, when a field is left, and on submit. This is for
   feedback only.
2. **API:** Pydantic. This is authoritative.
3. **Database:** `varchar(40)`, check constraints and `NOT NULL`. This is the last
   line of defence.

**Why validation exists on both the frontend and the backend.**
- **Client-side** validation is for usability: the user learns immediately that a
  subject is too long or a field is empty, without a round trip, and the form points at
  the field to fix.
- It proves nothing, though. Any client, a modified app or `curl` can send anything, so
  the **server** is the only place a rule is actually enforced, and the database repeats
  the core rules in case any future code path skips the API.
- The rules are kept identical on purpose: same limits, same trimming, same character
  counting, same messages on both clients. They are covered by tests on all three sides,
  and server field errors are still shown next to the field if they ever disagree.

## 12. Mobile UI

Three screens on a native stack (`src/navigation/RootNavigator.tsx`):

| Screen | Content |
| --- | --- |
| **Inbox** (landing) | See the details below |
| **Message detail** (separate screen) | See the details below |
| **Create message** | See the details below |

**Inbox (landing).**
- A virtualised `FlatList` of cards, newest first, headed "N messages · newest first".
- Each card shows the **subject** prominently (wrapping to two lines) and the **date and
  time** (`dd.mm.YYYY, HH:mm`) below it, plus a paperclip "Attachment" marker when
  there is one.
- A chevron shows the card opens the message. A separate trash button deletes, after
  confirmation.
- "+ New message" is pinned at the bottom, and pull to refresh reloads the list.

**Message detail (separate screen).**
- The subject is the large title at the top, followed by the date and time, a divider,
  the full text (scrollable and selectable), and an attachment card showing the file
  name, type and size.

**Create message.**
- Labelled fields ("Subject (required)", "Message (required)") with placeholders and a
  live `n/40` counter.
- Pasted text is never silently cut off; the counter and an error explain the problem
  instead.
- The keyboard-avoiding layout keeps the pinned "Create message" button above the
  keyboard.
- Leaving with a draft asks "Discard this message?".

**Create flow.**
- **Validation timing:** an over-long subject is flagged while typing. "Required" errors
  appear when a field is left or on submit, and focus then moves to the first invalid
  field.
- **While saving:** the button shows "Creating…" and ignores further taps.
- **On success:** the new message is written into the cached list at once, the list is
  refetched, and the app returns to the inbox, so the new message is visible
  immediately.
- **On failure:** the form keeps its content and shows a banner, server field errors
  appear next to the field, and submitting again retries.

**Delete flow.**
- The dialog names the message.
- While the request runs, Delete shows progress and both buttons are disabled, so
  duplicate requests are impossible.
- On success the row disappears and "Message deleted" is announced.
- On failure the message stays, the dialog shows the error, and the button becomes
  **Try again**.

**Layout and accessibility.**
- Safe areas are respected, and content width is capped at 640 dp on tablets. Screens
  were reviewed at 320×568 and 375×812.
- Rows are announced as "subject, 25 September 2026 at 07:28", delete buttons as
  "Delete message: subject", and fields as "Subject, required".
- Errors start with "Error:", so they don't rely on colour. Titles are exposed as
  headers, text scales with the system font size (up to 1.8×), and touch targets are at
  least 48 dp.
- A last-resort error boundary replaces a crash with a recoverable screen.

## 13. Web UI

React Router pages that mirror the mobile screens:

| Route | Page |
| --- | --- |
| `/` | **Inbox**: see the details below |
| `/messages/:id` | **Message detail**: see the details below |
| `/messages/new` | **Create message**: see the details below |
| `*` | **Not found** page; an unexpected render error shows a recovery page instead of a blank screen |

**Inbox (`/`).**
- The heading reads "Inbox" with "N messages · newest first" below it.
- Each row is one link: subject, then date/time as a `<time>` element, then a chevron.
  A separate trash-icon "Delete" button sits next to it.
- "+ New message" sits beside the heading.

**Message detail (`/messages/:id`).**
- A separate page with the subject as the `<h1>`, the date/time under it, then the full
  text (line breaks kept, long words wrap) and an "Attachment" section when present.

**Create message (`/messages/new`).**
- `<label>`led fields with a live counter, inline errors, and Cancel / Create message
  buttons.
- Leaving with a draft (by link or back) asks "Discard this message?", and closing the
  tab triggers the browser's own warning.

**Responsive.**
- A single column capped at 720 px, with 16 px side margins (24 px from 768 px up).
- Below 480 px the primary action becomes full-width, form buttons stack, and row delete
  controls become icon-only (their accessible name stays).
- Long subjects clamp to two lines in the list and wrap fully on the detail page.
- Checked at 320, 375, 768, 1024 and 1280 px, with no horizontal scrolling.

**Accessibility.**
- There's a skip link, and focus moves to the page `<h1>` on every navigation. The
  document title names the page, and headings follow `h1` → `h2`.
- Everything works from the keyboard, with visible `:focus-visible` rings.
- Dialogs use the native `<dialog>`: focus is trapped, Escape closes, and focus starts on
  Cancel. It returns to the opener afterwards, or to the page heading if that row was
  deleted.
- Hints, counters and errors are linked to fields with `aria-describedby`, invalid
  fields set `aria-invalid`, busy buttons set `aria-busy`, and outcomes are announced in
  a status region. Reduced-motion preferences are respected.

**Shared design system (both clients).**
- **Components:**
  - text styles (`title` / `heading` / `subheading` / `body` / `label` / `caption`);
  - buttons (`primary`, `secondary`, `danger`, `ghost`) with loading and disabled
    states;
  - labelled text fields with hint, error and counter;
  - card list rows with a chevron;
  - screen and page containers;
  - loading, empty and error states and inline errors;
  - a confirmation dialog.
- **Tokens:** colours, spacing (a 4-based scale), radii and type sizes are identical in
  `apps/mobile/src/theme/tokens.ts` and `apps/web/src/styles/tokens.css`. Text colours
  meet WCAG AA contrast.
- **Conventions:**
  - one primary action per screen;
  - red is reserved for the confirmation step;
  - icons are decorative and every control has a text name;
  - the same inbox-tray mark is used for the app icon, the favicon and the web header.

## 14. Loading, error and empty states

| Situation | Mobile and web behaviour |
| --- | --- |
| Inbox loading | A static skeleton shaped like the list, announced as "Loading messages". Never a premature "empty" state |
| No messages | "Your inbox is empty" with an explanation and a "Write your first message" button |
| Inbox fails to load | "Couldn't load your messages" with a plain reason and **Try again** (queries retry once automatically first, never on 4xx) |
| Background refresh fails | The list stays visible with an inline "Couldn't refresh" banner |
| Detail loading / fails | Loading indicator; **Try again** on failure; "Message not found" with a way back, which also removes a stale row deleted elsewhere |
| Slow API | Spinners and busy buttons appear immediately; requests are aborted after 15 s with "The server is taking too long to respond" |
| Offline / server unreachable | "Can't reach the server. Check your connection and try again." |
| Malformed response | Responses are checked before use; a wrong shape or non-JSON body becomes a normal recoverable error, not a crash |
| Create in progress / failed | "Creating…" busy button (duplicates ignored); on failure the input is kept, a banner explains, retry is one tap |
| Delete in progress / failed | Busy dialog with both buttons disabled; on failure the message stays and the button becomes **Try again**; a `404` (already deleted elsewhere) counts as done |
| Unexpected render error | Mobile error boundary or web route error page with a way to recover; no technical details shown |

Every user-facing error message is a short plain sentence (`describeError`). Raw error
text and stack traces are never displayed.

## 15. Local setup

**Prerequisites**

| Tool | Version |
| --- | --- |
| Python | 3.12 or newer (developed with 3.14) |
| Node.js | 20.19+ or 22 LTS (developed with 22) |
| Docker Desktop | Runs PostgreSQL. On Windows it needs WSL 2 and hardware virtualisation enabled in the BIOS/UEFI |
| Expo Go | On a phone, or an Android emulator / iOS simulator |

**1. Database**

```bash
docker compose up -d --wait db
```

**2. Backend** (from `backend/`)

```bash
python -m venv .venv
# Windows: .venv\Scripts\activate    macOS/Linux: source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env
alembic upgrade head
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Health check: <http://localhost:8000/health>. API docs: <http://localhost:8000/docs>.
`--host 0.0.0.0` makes the API reachable from a phone on the same network.

**3. Mobile app** (from `apps/mobile/`)

```bash
npm install
cp .env.example .env
npx expo start
```

Scan the QR code with Expo Go, or press `a` / `i`. On a physical phone, set
`EXPO_PUBLIC_API_URL` to your computer's LAN address (e.g. `http://192.168.1.20:8000`);
on the Android emulator use `http://10.0.2.2:8000`. Restart Expo after editing `.env`.

**4. Web app** (from `apps/web/`)

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open <http://localhost:5173>. This origin is already listed in the backend's
`CORS_ORIGINS`.

> **Windows note:** the example URLs use `127.0.0.1` rather than `localhost`, because on
> some Windows machines `localhost` resolves to IPv6 first and the database connection
> stalls.

## 16. Database initialization

A clean checkout needs two commands, both shown above:

1. `docker compose up -d --wait db` starts PostgreSQL 17 with development-only
   credentials (`inbox` / `inbox_dev_password`, database `inbox`) on `127.0.0.1:5432`.
   `--wait` returns once the health check passes. It checks over TCP, so it is not
   fooled by the image's temporary first-start server.
2. `alembic upgrade head` (in `backend/`) applies every migration in
   `backend/alembic/versions/` in order. It creates the `users` and `messages` tables,
   their constraints and the inbox index. It is safe to re-run and reads `DATABASE_URL`
   from the environment / `backend/.env`.

**Useful commands:**
- `alembic current` shows the applied revision.
- `alembic check` fails if the models and migrations disagree.
- `alembic downgrade base` removes the schema.
- `docker compose down -v` deletes the local database volume entirely.

There is no seed data; the first request from a client creates its user automatically.
The test suite uses its own `inbox_test` database, which it creates and migrates
automatically.

## 17. Environment variables

| File (copy from `.env.example`) | Variable | Purpose |
| --- | --- | --- |
| `backend/.env` | `DATABASE_URL` | PostgreSQL URL for SQLAlchemy (**required**, no default) |
| | `CORS_ORIGINS` | Comma-separated browser origins allowed to call the API |
| | `ENVIRONMENT` | `development`, `test` or `production` (production disables `/docs`) |
| | `LOG_LEVEL` | Python log level (default `INFO`) |
| `apps/mobile/.env` | `EXPO_PUBLIC_API_URL` | API base URL used by the app |
| `apps/web/.env.local` | `VITE_API_URL` | API base URL used by the web app |
| shell (optional) | `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | Override the compose defaults |
| shell (optional) | `TEST_DATABASE_URL` | Point the backend tests at another database |

Only `.env.example` files are committed. `EXPO_PUBLIC_*` and `VITE_*` values are
compiled into the client bundles, so they must never contain secrets. The API URL is
the only client setting.

## 18. Testing

| Suite | Command (in the folder) | Tests | Covers |
| --- | --- | --- | --- |
| Backend | `pytest` (database container running) | 110 | See below |
| Mobile | `npm test` | 51 | See below |
| Web | `npm test` | 50 | See below |

**Backend (110 tests).**
- They run against real PostgreSQL. The migrations run up, down and up again first,
  then each test runs in a transaction that is rolled back afterwards.
- **Models:** constraints, the user relationship and cascade.
- **Services:** create and user provisioning.
- **API:**
  - all endpoints and status codes;
  - user isolation;
  - rejected server-owned fields;
  - validation and malformed bodies;
  - failure handling with no internal details leaked;
  - the OpenAPI contract.
- **Hardening:**
  - control and invisible characters, Unicode and 40-emoji subjects, multiline text;
  - request size limits and identity header formats;
  - many messages;
  - CORS and production settings.

**Mobile (51 tests).**
- Jest with React Native Testing Library renders the whole app with navigation, using a
  mocked API module or a mocked `fetch`.
- **Screens:** inbox content and accessible names; loading, empty and error states with
  retry.
- **Delete:** confirmation, cancel, progress, duplicate taps, success and failure.
- **Create and detail:** form validation, create success and failure, server field
  errors, the discard-draft guard, and navigation to the detail screen.
- **Reliability:** timeouts, malformed responses, messages deleted elsewhere, a
  virtualised long list, the user id persisting across restarts, and the error
  boundary.

**Web (50 tests).**
- Vitest with Testing Library renders the real routes.
- **Screens and states:** the same screen, state and failure scenarios as mobile.
- **Keyboard:** Tab order, the skip link, and focus after deleting.
- **Dialog:** its accessible name and description.
- **Identity:** the user id with no secure context and with blocked storage.
- **Errors:** the route error page.

**Static checks and builds**

| Area | Commands |
| --- | --- |
| Backend | `ruff check .` · `ruff format --check .` · `mypy app tests alembic` (strict) · `alembic check` |
| Mobile | `npm run typecheck` · `npm run lint` · `npx expo-doctor` · `npx expo export --platform android` (production bundle) |
| Web | `npm run typecheck` · `npm run lint` · `npm run build` |

**Checked manually**, beyond the automated tests:
- Both clients were run against the real API in a browser at phone, tablet and desktop
  sizes. The mobile app was checked through Expo's web target, since no emulator was
  available.
- Create, view and delete; the API going down mid-delete and recovering with **Try
  again**; keyboard-only use of the web app.
- The production bundles were scanned for secrets.

**Not verified:** the mobile app has not been run on a physical device or a native
emulator. Behaviour when the on-screen keyboard opens, the iOS/Android back gestures and
the app icon on a home screen should get a quick check in Expo Go.

## 19. Architectural trade-offs

- **Header-based identity instead of authentication.** This keeps the exercise focused,
  as described in [User handling](#7-user-handling). The cost is that the API trusts
  whoever holds a UUID. The `get_current_user` seam keeps the fix local.
- **One REST API shared by web and mobile.**
  - All business rules (ownership, validation, timestamps) live in one place, and both
    clients behave identically because they consume the same contract.
  - The clients stay thin and hold no domain logic, so a third client (or a change to a
    rule) needs no changes elsewhere.
  - The cost is a network round trip for every change, which is irrelevant at this
    scale.
- **No shared client package.** The web and mobile apps duplicate their API client,
  hooks, validation and tokens instead of importing a workspace package. That avoids
  monorepo tooling (workspaces, Metro resolution, build ordering), and each app installs
  and builds on its own. The risk of drift is contained by identical code, identical
  tests and this documentation.
- **Validation is written three times** (client, API, database). This is deliberate:
  it gives immediate feedback, authoritative checks and integrity guarantees. The cost
  is keeping the rules in sync.
- **`created_at` from the database clock.**
  - It cannot be forged or back-dated by a client.
  - It doesn't depend on wrong or time-zone-shifted device clocks.
  - It gives one consistent ordering for "newest first".
  - It is stored in UTC and formatted in the viewer's local time by each client.
- **Unknown fields are rejected, not ignored.** A client that sends `user_id` learns
  immediately that it isn't allowed, rather than silently believing it was used.
- **Invalid ids return `422`, not `404`.** This matches the documented `uuid` format;
  a well-formed but unknown or foreign id returns `404`.
- **Synchronous SQLAlchemy.** Routes are plain functions that FastAPI runs in its thread
  pool. That is simpler to write and test than async sessions, and sufficient for this
  load.
- **No pagination.** An exercise inbox stays small. The `items` wrapper and the
  `(user_id, created_at DESC)` index allow cursor pagination later without breaking
  clients.
- **Hard delete.** Deleted messages are removed rather than soft-deleted; no
  undo/archive was requested.
- **Idempotent delete in the clients.** A `404` on delete means the message is already
  gone (for example, deleted on another device), so the clients treat it as success.
- **Lost create responses can duplicate a message.** If the server saves a message but
  the response is lost (e.g. a timeout) and the user retries, a second copy is created.
  Idempotency keys would prevent this; see
  [production improvements](#21-production-improvements).
- **Create screen as a normal stack screen**, not an iOS sheet, because sheets are known
  to misplace the keyboard-avoiding offset.
- **Tests use real PostgreSQL** rather than SQLite or mocks. They are slower and need
  Docker, but they exercise the real constraints, types and SQL.

## 20. Assumptions

- A user is identified by an opaque UUID and is created on first use. Each device or
  browser is its own user until real sign-in exists.
- The brief's date format `dd.mm.YYYY` is shown in the device's local time zone. The
  time (`HH:mm`) is added because several messages can share a date. Messages are
  ordered newest first.
- The 40-character subject limit counts **characters** (Unicode code points) after
  trimming surrounding whitespace. The subject is a single line.
- The brief sets no limit on message text. 10,000 characters is assumed, to keep
  requests bounded. Line breaks in the text are preserved.
- Attachments are optional. The model, API responses and both detail views support
  attachment **metadata** (file name, type and size), but **uploading and storing files
  is not implemented**: there is no upload endpoint, and the create form has only
  subject and text.
- Messages cannot be edited (not requested), and deletion is permanent.
- The user interface is in English.

## 21. Production improvements

These are **not implemented**; they are the natural next steps before real use:

- **Authentication:** OIDC sign-in with JWT verification behind `get_current_user`, as
  described in [User handling](#7-user-handling). Tokens would go in `expo-secure-store`
  on mobile and `httpOnly` cookies (or a backend-for-frontend) on the web. It would be
  followed by per-user authorisation tests using real tokens.
- **HTTPS everywhere:** TLS at the load balancer, HSTS, and a production CORS origin
  list.
- **Rate limiting and abuse protection:** per-user and per-IP limits (at an API gateway
  or reverse proxy, or with middleware), plus request-size limits at the proxy.
- **Idempotency keys** on `POST /messages`, so retried creates cannot duplicate
  messages.
- **Pagination:** cursor-based, on `(created_at, id)`.
- **Structured logging:** JSON logs with request ids and user ids (never message
  content), correlated across services.
- **Monitoring and alerting:** metrics (latency, error rates, database pool), tracing
  (OpenTelemetry), a readiness endpoint that checks the database, and error tracking
  such as Sentry on backend and clients.
- **Audit logging:** an append-only record of security-relevant events (sign-ins,
  deletes) for investigation.
- **Secure attachment storage:**
  - files in object storage (e.g. S3) behind short-lived pre-signed URLs, never on the
    API server;
  - size and type limits checked on the server, and malware scanning;
  - per-user access checks on download.
- **CI/CD:**
  - a pipeline (e.g. GitHub Actions) running the full check suite from
    [Testing](#18-testing) on every pull request;
  - dependency and secret scanning;
  - a container image for the API;
  - automated migrations on deploy;
  - EAS builds for the mobile app.
- **Backups:** a managed PostgreSQL with automated backups, point-in-time recovery and
  regular restore tests.
- **Secret management:** credentials from a secret manager (Vault, AWS Secrets Manager,
  Azure Key Vault) injected at runtime, rotated regularly, with a dedicated
  least-privilege database role for the API.
- **Operational hardening:**
  - a production ASGI server setup (Gunicorn with Uvicorn workers) with tuned
    connection pooling;
  - graceful shutdown;
  - a dedicated migration role separate from the runtime role.

---

## Requirement coverage

| Exercise requirement | Implementation |
| --- | --- |
| React Native mobile app | `apps/mobile` (Expo SDK 57, TypeScript) |
| Optional React web app on the same backend | `apps/web` (React + Vite), same `/api/v1` API |
| Backend exposing REST endpoints | FastAPI: `GET/POST /api/v1/messages`, `GET/DELETE /api/v1/messages/{id}` ([API](#9-api-endpoints)) |
| Messages saved in a database | PostgreSQL via SQLAlchemy; schema from Alembic migrations ([Database](#6-database-model)) |
| Messages belong to a user ID; each user sees only their own | `messages.user_id` FK + owner-scoped queries; identity via `X-User-Id` ([User handling](#7-user-handling)) |
| Landing screen lists the current user's messages | Mobile `InboxScreen`, web `InboxPage` |
| … with a button to create messages | "+ New message" (and "Write your first message" when empty) |
| … each item shows date (`dd.mm.YYYY`) and subject | `formatDate` / `formatDateTime`; subject as the row title |
| … delete a message from here | Trash button → confirmation dialog → `DELETE` |
| Tapping a message opens its detail screen | Navigation to `MessageDetail` (mobile) / `/messages/:id` (web) |
| Detail shows subject, date, text + attachment (optional) | `MessageDetailScreen` / `MessageDetailPage`; attachment metadata card |
| Creation screen with mandatory subject and text | `CreateMessageScreen` / `CreateMessagePage`; client + API + DB validation |
| Subject max 40 characters | Client counter/validation, Pydantic `max_length=40`, `varchar(40)` + check constraint |
| Return to the landing screen after creating | `navigation.goBack()` / `navigate('/')` after success; new message shown immediately |
| Date created automatically in the backend | `created_at` `DEFAULT now()` (timestamptz, UTC); clients cannot send it |
| Data structure consistent across app, API, DB | [Architecture](#3-architecture): the same shape in the table, ORM, schemas and client types |
| User handling explained | [User handling](#7-user-handling) |
| Database choice, schema and initialisation from a clean checkout | [Database model](#6-database-model), [Database initialization](#16-database-initialization) |
| REST routes, request/response shapes, status codes, server-side validation | [API endpoints](#9-api-endpoints), [Examples](#10-request-and-response-examples), [Validation](#11-validation) |
| Loading indicators, empty state, clear error handling | [Loading, error and empty states](#14-loading-error-and-empty-states) |
| Written explanation: data approach, screens, trade-offs, assumptions, web/mobile relation | This README (sections 2–4, 6–7, 12–13, 19–20; web and mobile share the API as explained in [trade-offs](#19-architectural-trade-offs)) |

## Development history

The project was built in reviewed phases, each committed separately:

1. Foundation: project structure, design system, navigation, `/health`
2. Database models, integrity rules and migrations
3. Secure REST API with validation and user scoping
4. React Native inbox experience
5. Responsive React web client
6. Security, reliability and edge-case hardening
7. UI polish and usability review
8. Final documentation and review (this document)
