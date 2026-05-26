# Kiosk Biometric Attendance + Grooming Checks — Design

**Date:** 2026-05-26
**Status:** Draft for review

## Context

opsy records attendance through manual web forms; HR verifies, edits, marks overtime, and recalculates
salary. We want a **Windows kiosk** at each branch where an employee punches in biometrically and gets an
immediate grooming check:

1. Finger on an **MFS500** scanner → the kiosk identifies *which* employee it is.
2. The employee picks the **shift** they're reporting for that day (no fixed roster).
3. The camera captures **two photos** — one to verify they're **in uniform**, one to verify their **nails are trimmed**.
4. The kiosk shows an **immediate on-screen verdict** ("Uniform OK ✓ / Nails not trimmed ✗").

The kiosk only *records* punches. Everything HR does today (edit times, overtime, verify/approve, salary
recalc) must keep working unchanged. The system must support **multiple punch-ins per day** for break
shifts. Grooming may later expand to oral health / shoes — out of scope for now.

Employees are **moved between outlets** frequently (decided before the shift). Each employee has one current
outlet (`User.branchId`); a move is recorded by **updating that outlet in the web app**. A kiosk only lets an
employee punch at the outlet they're currently assigned to — punching elsewhere is rejected with a clear
message and the fix is a web outlet-update. This keeps "where everyone is today" accurate without a roster.

## Decisions

| Area | Decision |
|---|---|
| Kiosk app | **.NET / WPF (C#)** — native Mantra MFS500 SDK + webcam |
| AI checks | **Backend-mediated, synchronous** — kiosk uploads photos, server analyzes, returns verdict in the same response |
| Fingerprint match | **Local 1:N on the kiosk** — templates synced from server (Mantra matcher is a native Windows lib) |
| Outlet assignment | Each employee is assigned to **one current outlet** = existing `User.branchId`. Moving someone = **update their outlet in the web app** (a deliberate, recorded action) |
| Cross-branch mobility | Identification is **global** (all templates sync to every kiosk, so any kiosk can *recognize* anyone), but a **punch is gated**: allowed only when `employee.branchId == kiosk.branchId`. Mismatch → punch rejected (with assigned-outlet name) + the attempt logged; resolved by updating the outlet on the web. **The only thing that blocks a punch is wrong-outlet** |
| Branch attribution | A successful punch implies assigned outlet == kiosk outlet, so the day's `Attendance.branchId` is unambiguous; that outlet's manager verifies it |
| AI provider | **Azure AI Foundry**, **GPT-4o vision deployment** (confirmed). Wrapped behind a provider-agnostic `checkGrooming()` service so the model is swappable later (e.g. Claude vision) via env var without route changes. |
| Punch storage | **New `PunchEvent` table**; daily `Attendance` row derived from it |
| Shifts | **Configurable `Shift` + `ShiftSegment` tables** (supports split/break shifts) |
| On grooming failure | **Record + flag + notify on-screen** — never block the punch |
| Enrollment | **HR "enroll mode" inside the same kiosk app** |
| Notifications (v1) | Synchronous on-screen verdict + persisted flag (HR-visible); push/SMS is a future hook |
| Photo retention | **90-day auto-purge** of uniform/nail photos (confirmed); text verdicts retained |

## Shifts to seed

| Name | Segments |
|---|---|
| Full Day | 07:00–19:00 |
| Break One | 07:00–15:00 **and** 19:00–23:00 |
| Mid-Night | 11:00–23:00 |

A "break shift" is one labelled shift with **two segments**; the employee still picks a single option at
the kiosk and may punch IN/OUT multiple times across the day. Shifts are editable by HR, so more can be
added later.

## Architecture

Two deliverables, one contract (the kiosk API):

- **(A) opsy backend** — this repo. Schema, kiosk API, AI grooming service. Fully buildable/testable here.
- **(B) WPF kiosk app** — a new, separate C# project. Specced here; gets its own plan when we reach it.

End-to-end flow:

```
Finger on MFS500 → kiosk matches LOCALLY (templates synced from server) → identifies employee
  → OUTLET CHECK: is employee assigned to THIS outlet?
       → NO  → show "You're assigned to <outlet> — ask HR to update your outlet", log attempt → idle
       → YES → shift dialog (GET /api/kiosk/shifts) + IN/OUT
  → camera captures 2 photos (uniform, nails)
  → POST /api/kiosk/punch { userId, shiftId, direction, uniformPhoto, nailsPhoto, punchedAt }
       → server re-validates outlet (authoritative) → store photos (Azure Blob)
                 → Azure AI Foundry verdicts → write PunchEvent → upsert daily Attendance row
                 → salary-recalc guard → activity log
       → returns grooming verdicts synchronously
  → kiosk shows green/red result screen → idle
```

---

## A. Backend (this repo)

### A1. Prisma schema (`prisma/schema.prisma`)

Add five models, two enums, relation back-links, and new `ActivityType` values. Follow existing
conventions (`@id @default(cuid())`, `numId Int @default(autoincrement()) @map("num_id")`, snake_case
`@@map`, `@@index` on FKs).

- **`KioskDevice`** — `name`, `branchId`, `tokenHash` (unique, SHA-256 of a one-time secret), `isActive`, `lastSeenAt`. Per-device, revocable, branch-scoped auth.
- **`FingerprintEnrollment`** — `userId`, `templateData` (`@db.Text`, base64 ISO 19794-2 template), `fingerIndex` (0–9; multiple fingers/user), `enrolledByDeviceId?`, `isActive`.
- **`Shift`** — `name`, `branchId?` (null = all branches), `isActive`, `sortOrder`. Times live in segments.
- **`ShiftSegment`** — `shiftId`, `startTime`/`endTime` (`"HH:mm"` branch-local), `sortOrder`. One row for a normal shift, two+ for a split/break shift.
- **`PunchEvent`** — `userId`, `attendanceId?` (backlink; null for a blocked attempt), `shiftId?`, `kioskDeviceId?`, `branchId` (the kiosk's outlet where the punch was attempted), `direction` (`PunchDirection`), `punchedAt` (UTC `DateTime`, authoritative), `outcome` (`PunchOutcome`, default `RECORDED`), `assignedBranchId?` (snapshot of the employee's outlet at attempt time — equals `branchId` when `RECORDED`, differs when `BLOCKED_WRONG_OUTLET`). Grooming: `uniformPhotoUrl`/`nailsPhotoUrl`, `uniformCheckStatus`/`nailsCheckStatus` (`GroomingCheckStatus`), `uniformCheckReason`/`nailsCheckReason` (`@db.Text`), `uniformConfidence`/`nailsConfidence` (Float), `aiRawResponse` (`@db.Text`, audit). A `BLOCKED_WRONG_OUTLET` row has no photos/grooming and no `attendanceId` — it exists purely as the audit signal for an attempt at an unassigned outlet.
- Enums: `PunchDirection { IN, OUT }`, `GroomingCheckStatus { PASS, FAIL, PENDING, ERROR }`, `PunchOutcome { RECORDED, BLOCKED_WRONG_OUTLET }`.
- Back-links: `User` ← `punchEvents`, `fingerprintEnrollments`; `Attendance` ← `punchEvents`; `Branch` ← `kioskDevices`, `shifts`, `punchEvents`.
- `ActivityType`: add `PUNCH_IN`, `PUNCH_OUT`, `PUNCH_BLOCKED_WRONG_OUTLET`, `GROOMING_CHECK_FAILED`, `FINGERPRINT_ENROLLED`, `KIOSK_DEVICE_CREATED`.
- Add `@@unique([userId, date])` to `Attendance` so the punch `upsert` is safe (current `@@unique([id, date])` is a no-op). **Verify no existing `userId+date` duplicates before migrating** — a `create-duplicate-attendance` seed script exists, so check data first.

### A2. Services

- **`src/lib/kiosk-auth.ts`** — `authenticateKiosk(request)`: reads `Authorization: Bearer <token>` + `X-Kiosk-Device-Id`, looks up `KioskDevice`, timing-safe compares SHA-256(token) vs `tokenHash`, checks `isActive`, updates `lastSeenAt` (fire-and-forget). Returns `{ device }` or null. Used by all `/api/kiosk/*` routes except admin provisioning.
- **`src/lib/services/grooming-check.ts`** — `checkGrooming(uniformUrl, nailsUrl): Promise<GroomingResult>`. Per photo, calls the Foundry vision endpoint with a criteria system prompt + `response_format: json_object`, expecting `{ pass, reason, confidence }`. Runs both via `Promise.all`. Per-call `AbortController` timeout (`AZURE_AI_FOUNDRY_TIMEOUT_MS`, default 8000): timeout → `status: PENDING`; error/unparseable → `status: ERROR`. Provider-agnostic interface so the model is swappable (GPT-4o vision ↔ Claude vision).
- **`src/lib/services/punch-service.ts`** — orchestrates a punch: photo upload, grooming call, `PunchEvent` create, `Attendance` upsert + shift-flag mapping, salary-recalc guard, activity log. Keeps the route handler thin.

Reuse: `AzureStorageService.uploadBase64Image(base64, fileName, folder, contentType?)` (`src/lib/azure-storage.ts`); `calculateSalary(userId, month, year)` (`src/lib/services/salary-calculator.ts`); `logEntityActivity(...)` (`src/lib/services/activity-log.ts`).

Photo folders: `kiosk-punches/uniform/{userId}/{YYYY-MM-DD}/{punchEventId}-uniform.jpg` and `.../nails/...`.

### A3. API endpoints (`src/app/api/kiosk/...`)

All use `authenticateKiosk()` except device provisioning (NextAuth). **Template sync is global** (every kiosk
can *identify* anyone), but the **punch is outlet-gated**: it succeeds only when the employee's assigned
`branchId` equals the kiosk's `branchId`. A mismatch is rejected and logged (see the punch sequence).

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/kiosk/handshake` | Validate device token; return device/branch + server UTC time |
| GET | `/api/kiosk/fingerprints` | Sync **all** active enrollments (delta via `?updatedSince=`, paginated via `?cursor=`); **delta includes deactivated/removed enrollments so kiosks purge them** |
| POST | `/api/kiosk/fingerprints/enroll` | Store a template for **any** employee (global search by name/`#numId` in HR enroll mode) |
| GET | `/api/kiosk/shifts` | List active shifts (+ segments) for the branch (shift dialog) |
| POST | `/api/kiosk/punch` | **Core**: photos + shift + IN/OUT → store, analyze, persist, return verdicts |
| POST | `/api/kiosk/devices` | Admin: provision a `KioskDevice`, return raw token **once**. Uses `auth()` (HR/MANAGEMENT) |

**Fingerprint sync semantics (mobility-critical):** "active" means the enrollment's `isActive` is true **and**
the owning user's status is `ACTIVE`. The `GET /api/kiosk/fingerprints` delta response returns each enrollment
changed since `updatedSince` with its effective active flag — additions/re-enrollments **and tombstones**
(for leavers, deactivated users, or a removed finger). Each returned enrollment also carries the owner's
**current `branchId`** so the kiosk can do the outlet pre-check locally (and a web-side outlet change shows
up as a normal delta-sync update). The kiosk applies additions and **deletes** tombstoned
templates from its local cache. A **transfer between outlets is not a sync event** — the employee is already
on every kiosk. A kiosk also does a **full reconcile** (no `updatedSince`) on launch and once daily to
self-heal missed deltas (and to catch hard-deleted users whose enrollment rows cascade away). Because matching is local and there
is no server-side matcher, every kiosk must hold every active template — templates are non-reversible ISO
minutiae (a few hundred bytes each), encrypted at rest on the device; the device token is revocable. This
all-templates-everywhere footprint is an accepted tradeoff of local matching + a mobile workforce.

**`POST /api/kiosk/punch` sequence** (synchronous, one handler):
1. `authenticateKiosk`; resolve the employee.
2. **Outlet gate (authoritative):** if `employee.branchId != device.branchId` → write a `PunchEvent` with `outcome=BLOCKED_WRONG_OUTLET`, `assignedBranchId=employee.branchId`, no photos/grooming, no `attendanceId`; `logEntityActivity` `PUNCH_BLOCKED_WRONG_OUTLET`; return `403 { blocked: true, reason: "WRONG_OUTLET", assignedBranch: { id, name } }`. **Stop** — no salary touch, no Attendance. (The kiosk normally pre-checks this client-side, so reaching here usually means a same-moment race; the server is the source of truth.)
3. (authorized) Upload uniform + nails photos (failures → URLs null, status `ERROR`, continue).
4. `checkGrooming(...)` (8s timeout each, parallel).
5. Create `PunchEvent` with `outcome=RECORDED`, `branchId = device.branchId`, `assignedBranchId = employee.branchId`.
6. Upsert daily `Attendance` (`where userId_date`): on create set `isPresent=true`, `checkIn`, `branchId = device.branchId`, `status=PENDING_VERIFICATION`; on IN set `checkIn` if empty; on OUT set `checkOut`. Map `shiftId`→legacy `shift1/2/3` by segment overlap (best-effort; truth lives on `PunchEvent.shiftId`).
7. Write `attendanceId` back onto the `PunchEvent`.
8. Salary-recalc guard (A4).
9. `logEntityActivity` PUNCH_IN/PUNCH_OUT (+ GROOMING_CHECK_FAILED when relevant).
10. Return `{ punchEventId, attendanceId, direction, punchedAt, grooming: { uniform, nails }, overallGroomingPass }`.

Raise the route body-size limit (~10 MB; two base64 JPEGs); the kiosk compresses photos to ≤1024px first.

### A4. Salary coupling & guards (preserve existing behavior)

Existing routes, on any attendance change, find the `Salary` row for `userId+month+year` with status in
(`PENDING`,`PROCESSING`); `PROCESSING` is a hard block, `PENDING` triggers `calculateSalary` + update.
`calculateSalary` counts only `APPROVED` attendance, so a kiosk punch (`PENDING_VERIFICATION`) does not
change present-days until HR approves — matching today's branch-manager flow.

**Kiosk deviation — never block the punch:** always write `PunchEvent` + upsert `Attendance`. If salary is
`PROCESSING`, **skip the recalc** (log it) rather than throwing. If `PENDING`, recalc as today. If no
salary row, do nothing.

### A5. Notifications (v1)

Real-time = the synchronous punch response rendered on the kiosk; verdict also persisted on `PunchEvent`
(HR-visible). No websocket/push/SMS in v1. Future hook: after step 8, `if (!overallGroomingPass)
notifyBranchManager(...)` — `PunchEvent` already carries everything a notifier needs.

### A6. Env vars (names only — never commit secrets)

Add: `AZURE_AI_FOUNDRY_ENDPOINT`, `AZURE_AI_FOUNDRY_KEY`, `AZURE_AI_FOUNDRY_DEPLOYMENT`,
`AZURE_AI_FOUNDRY_TIMEOUT_MS`, `KIOSK_TOKEN_SECRET`. Reuse existing `AZURE_STORAGE_*`.

### A7. Timezone (must handle)

`Attendance.checkIn/checkOut` are bare `"HH:mm"` strings with no tz; the weekly-off cron uses
`Asia/Kolkata`. The kiosk sends `punchedAt` as UTC. The server converts to **IST** via
`Intl.DateTimeFormat('en-IN', { timeZone:'Asia/Kolkata', hour:'2-digit', minute:'2-digit', hour12:false })`
for the strings, and derives `Attendance.date` as the IST calendar day (so a near-midnight punch lands on
the correct day).

### A8. Photo retention

**Confirmed: 90-day purge.** A scheduled job (reuse the `opsy-timer` Azure Functions pattern, guarded by
`CRON_SECRET`) deletes `kiosk-punches/*` blobs older than **90 days** and nulls the `*PhotoUrl` fields,
keeping the text verdicts on `PunchEvent` for the record.

---

## B. WPF kiosk app (separate C# project — spec only)

Single Windows app, two modes:

- **Punch mode (default):** idle → finger scan → local 1:N match against synced templates (Mantra MFS500 SDK) → on match, **outlet pre-check**: the synced template carries the employee's current `branchId`; if it ≠ this kiosk's branch, do a quick delta sync (in case they were just moved on the web) and re-check — still mismatched → show *"You're assigned to &lt;outlet&gt; — ask HR to update your outlet"* and log the attempt; matched → shift dialog (`GET /api/kiosk/shifts`) + IN/OUT → capture 2 photos → `POST /api/kiosk/punch` → green/red verdict screen with reasons → idle. **Offline:** queue punches locally and sync on reconnect (photos held; grooming marked PENDING).
- **Enroll mode (HR, PIN-gated):** search employee by name/`#numId` → scan finger(s) (≥2 recommended: index + thumb) → `POST /api/kiosk/fingerprints/enroll`.
- **Template cache:** holds **all** active employees' templates (encrypted at rest) so anyone can punch here. On launch and once daily it does a **full reconcile** (`GET /api/kiosk/fingerprints` with no `updatedSince`, following `cursor` pages); in between it polls **delta** syncs (`?updatedSince=`), applying additions and **purging tombstoned (`isActive:false`)** templates.
- Stores its device token in the Windows credential store; uses handshake server time to bound clock skew.

---

## Phasing

1. **Backend foundation** — schema + migration; `kiosk-auth`; device provisioning; shifts list + seed (Full Day / Break One / Mid-Night); fingerprint enroll + sync; handshake.
2. **Punch pipeline** — `grooming-check` (Foundry), `punch-service`, `POST /api/kiosk/punch`, salary/timezone handling, activity logging.
3. **WPF kiosk app** — enroll + punch flows, local matcher, camera, shift dialog, result screen, offline queue.
4. **Future** — HR dashboard for grooming flags, push/SMS notifications, photo-retention purge, oral-health/shoes checks.

Phases 1–2 are this repo and testable via `curl`/Postman before the WPF app exists. Phase 3 depends on hardware/SDK.

## Verification

- **Unit/integration (vitest):** outlet gate (`BLOCKED_WRONG_OUTLET` + no Attendance when `employee.branchId != device.branchId`; `RECORDED` when equal); `punch-service` attendance upsert (create vs IN vs OUT); shift→legacy-flag mapping incl. split shift; IST conversion of `punchedAt`; salary guard (PENDING recalc vs PROCESSING skip vs no-row); `authenticateKiosk` (valid/invalid/inactive). Mock grooming for timeout→PENDING and error→ERROR.
- **Endpoint smoke (curl/Postman):** provision device (NextAuth) → handshake → seed/list shifts → enroll template → sync templates → **punch at the wrong outlet → assert `403`, a `BLOCKED_WRONG_OUTLET` PunchEvent, and no Attendance** → update the employee's outlet via the web → punch with two sample base64 JPEGs; assert a `RECORDED` `PunchEvent`, an upserted `Attendance`, photos in Azure Blob, synchronous verdicts. Re-punch same user/day → `checkOut` set, no duplicate `Attendance`.
- **Manual:** HR can still edit times / mark overtime / verify the kiosk-created `Attendance` row in the existing UI; a kiosk punch during salary `PROCESSING` records without error and skips recalc.
- After build/merge, restart `next dev` so the running app reflects changes.

## Open items

- ~~Confirm Foundry model choice~~ → **GPT-4o** (2026-05-26). Service stays provider-agnostic so a switch to Claude vision is a single env-var + adapter change.
- The kiosk app (Windows tablet client) gets its own spec + plan at Phase 3.
