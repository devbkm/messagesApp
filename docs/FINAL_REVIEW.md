# Final review checklist

Final review of the practical exercise against the supplied brief, carried out on
2026-09-25 (phase 9). Status legend: **Done**: implemented and verified. **Partial**:
implemented with a documented limitation.

## 1. Exercise requirements

| # | Requirement (from the brief) | Implementation location | Status | Remaining issue |
| --- | --- | --- | --- | --- |
| 1 | Frontend built with React Native; works as a mobile app | `apps/mobile` (Expo SDK 57, TypeScript) | Done | Not yet run on a physical device (see §4) |
| 2 | Optional web solution in React using the same backend | `apps/web` (React + Vite) against the same `/api/v1` | Done | None |
| 3 | Backend in a language of choice exposing REST endpoints | `backend/app/api/routes/messages.py` (FastAPI) | Done | None |
| 4 | Messages saved in a database | PostgreSQL; `backend/app/models/message.py`; migration `backend/alembic/versions/…create_users_and_messages.py` | Done | None |
| 5 | Messages are user-specific; each belongs to a user ID; users only see and manage their own | `messages.user_id` FK; `backend/app/services/messages.py` filters on `user_id`; `backend/app/core/identity.py` resolves the signed-in session | Done | Real sign-up/login added in the authentication enhancement |
| 6 | Landing screen lists the current user's messages | `apps/mobile/src/screens/InboxScreen.tsx`, `apps/web/src/pages/InboxPage.tsx` | Done | None |
| 7 | Landing screen has a button for creating messages | "+ New message" (and "Write your first message" in the empty state) | Done | None |
| 8 | Each list item shows the date (`dd.mm.YYYY`) and subject | `MessageListItem.tsx` / `InboxPage.tsx` using `utils/format.ts` (`dd.mm.YYYY, HH:mm`) | Done | None |
| 9 | Delete a message from the landing screen | Row delete control → `ConfirmDialog` → `DELETE /api/v1/messages/{id}` | Done | None |
| 10 | Tapping a message opens its detail screen | Stack navigation to `MessageDetail` (mobile), route `/messages/:id` (web) | Done | None |
| 11 | Detail screen shows subject, date and text | `MessageDetailScreen.tsx`, `MessageDetailPage.tsx` | Done | None |
| 12 | Detail screen shows attachment (optional) | Attachment card (file name, type, size) on both clients; `attachment_*` columns | Partial | Attachment metadata only; no upload/storage endpoint (optional in the brief; documented) |
| 13 | Creation screen with mandatory subject and text | `CreateMessageScreen.tsx`, `CreateMessagePage.tsx`; `MessageCreate` schema; `NOT NULL` + check constraints | Done | None |
| 14 | Subject not more than 40 characters | Client counter + validation (`utils/validation.ts`), Pydantic `max_length=40`, `varchar(40)` + `ck_messages_subject_max_length` | Done | None |
| 15 | Return to the landing screen after a successful create | `navigation.goBack()` (mobile), `navigate('/', { replace: true })` (web); new message shown immediately | Done | None |
| 16 | Date created automatically in the backend | `created_at` `DEFAULT now()` (`timestamptz`, UTC session); clients cannot send it (`422`) | Done | None |
| 17 | Data structure consistent across app, API and database; link to user ID | README §3 and §6; `models/`, `schemas/`, `src/api/types.ts` | Done | None |
| 18 | User handling: decide how a user is identified; list returns only that user's messages | README §7; session-based sign-in (Bearer on mobile, `httpOnly` cookie on web); owner-scoped queries | Done | Enhanced beyond the brief with real accounts |
| 19 | Database setup: which DB, schema, created/initialised from a clean checkout | README §6 and §16; `docker-compose.yml` + `alembic upgrade head` | Done | Requires Docker (or any PostgreSQL 17) |
| 20 | API: routes, request/response shapes, status codes, server-side validation (mandatory fields, 40 chars) | README §9–§11; OpenAPI at `/docs` | Done | None |
| 21 | Loading behaviour: indicators, empty state, clear error handling | README §14; skeletons, empty states, error states with retry on both clients | Done | None |
| 22 | Written explanation: data approach, screens, trade-offs, assumptions, how RN and web relate | `README.md` (21 sections incl. §19 trade-offs, §20 assumptions) | Done | None |

## 2. Review areas

| Area | Findings | Status | Remaining issue |
| --- | --- | --- | --- |
| Architecture | Thin routes → `CurrentUser` → services → ORM; one API for both clients; settings from environment only | Done | None |
| Database | Owner FK `NOT NULL`, check constraints mirroring API rules, `(user_id, created_at DESC)` index, UTC timestamps | Done | None |
| Migrations | Single initial migration; `alembic check` clean; tests run upgrade → downgrade → upgrade each time | Done | None |
| API | 4 endpoints + `/health`; `201` + `Location`, `204`, uniform error envelope; OpenAPI documents all status codes | Done | No pagination (documented trade-off) |
| Validation | Client (feedback), Pydantic (authoritative), database (last line); same rules and character counting on both clients | Done | None |
| User isolation | Every read/delete filters on id **and** owner; another user's message → identical `404`; tests for read/delete/list | Done | None |
| Security | No SQL injection surface; control chars / oversized bodies rejected; no internals in errors; `no-store`; CORS allow-list; no secrets committed; bundles scanned | Done | No authentication, rate limiting or HTTPS termination (documented production work) |
| Inbox UI | Subject prominent, date/time secondary, chevron, neutral delete control, count + ordering stated, pull to refresh (mobile) | Done | None |
| Message detail UI | Separate screen; subject as the top heading, then date/time, text, attachment | Done | None |
| Create message UI | Labels, placeholders, live `n/40` counter, immediate over-length feedback, busy state, draft-discard guard | Done | None |
| Subject / date-time display | `dd.mm.YYYY, HH:mm` in the device time zone; spoken form for screen readers | Done | None |
| Navigation | Mobile native stack; web routes with history; back from inbox never reopens a submitted form (fixed in this review) | Done | None |
| Loading state | List skeleton (no false "empty"), detail spinner, busy buttons, 15 s timeout message | Done | None |
| Empty state | "Your inbox is empty" + explanation + create action | Done | None |
| Error handling | Plain-language messages, retry everywhere, form data kept, malformed responses handled, crash fallbacks | Done | Lost create responses can duplicate on retry (no idempotency keys; documented) |
| Deletion confirmation | Dialog naming the message; busy state blocks duplicates; failure keeps the message and offers retry; `404` treated as already deleted | Done | None |
| Mobile usability | 48 dp targets, pinned primary action, keyboard-avoiding create form, safe areas; reviewed at 320×568 and 375×812 | Partial | Keyboard behaviour and gestures still need a check on a physical device |
| Responsive web usability | 320 px – desktop with no horizontal overflow; full-width primary action and icon-only delete on phones | Done | None |
| Accessibility | Labels/names on all controls, "Error:" text (not colour only), focus management, skip link, native `<dialog>`, screen-reader announcements, WCAG AA contrast | Done | Not tested with a real screen reader (VoiceOver/TalkBack/NVDA) |
| Tests | 110 backend + 51 mobile + 51 web = 212 automated tests, all passing | Done | None |
| Documentation | README with the 21 required sections, requirement coverage and limitations; this checklist | Done | None |
| Environment configuration | `.env.example` for backend, mobile and web; `DATABASE_URL` required; client bundles hold only the API URL | Done | None |
| Git history | One commit per phase, all authored by Bilal (`bilalkamal@live.com`), no co-author trailers, no rewritten history | Done | None |

## 3. Core user journey

Performed against the real API and database, on both clients, at phone size (375×812).

| Step | Mobile (Expo web target) | Web |
| --- | --- | --- |
| Open Inbox | ✅ "3 messages · newest first" | ✅ |
| See subject + date/time | ✅ subject with `25.09.2026, 12:53` below | ✅ |
| Tap a message | ✅ | ✅ |
| Separate detail screen | ✅ `MessageDetail` screen | ✅ `/messages/:id`, focus on the heading |
| Subject at top, then date/time, text, attachment | ✅ incl. `contract-v2.pdf · application/pdf · 243.0 KB` | ✅ |
| Navigate back | ✅ (see note 1) | ✅ |
| Create a message | ✅ | ✅ |
| Return to Inbox | ✅ automatically after saving | ✅ (see note 2) |
| See the new message | ✅ at the top, "4 messages" | ✅ |
| Delete with confirmation | ✅ dialog names the message; row removed | ✅ dialog names the message; row removed; deletion announced |

**Notes**

1. In the *Expo web preview* of the mobile app, the header back control did not react to
   automated clicks. Its handler navigates correctly when invoked, and on devices the
   header is native, so this only affects the non-deliverable web preview.
2. **Defect found and fixed in this review:** after creating a message on the web, the
   browser's Back button returned to an empty "New message" form. The redirect now
   replaces the form's history entry, and a new test covers it (it fails without the
   fix).
3. On a cold development server the mobile icon font loaded a few seconds after the first
   render in the web preview, so icons showed as boxes until then. In Expo Go and in builds
   the font is local, so the delay is negligible.

## 4. Remaining known limitations

- **Account lifecycle is minimal.** Sign-up, login and logout exist, but there is no
  email verification, password reset, login rate limiting or multi-factor
  authentication yet (README §21). Users created before accounts existed keep their
  messages but cannot sign in.
- **Attachments are metadata-only.** There is no upload or storage (the brief marks
  attachments optional).
- **Not verified on a physical device or native emulator.** Keyboard behaviour, iOS and
  Android back gestures, and the home-screen icon need a quick check in Expo Go.
- **Not tested with a real screen reader.** The semantics are covered by automated
  accessibility queries only.
- **No pagination, rate limiting or idempotency keys.** Retrying after a lost create
  response can create a duplicate.
- **Production concerns** (HTTPS, monitoring, structured and audit logging, backups,
  secret management, CI/CD) are documented in README §21 but not implemented.
