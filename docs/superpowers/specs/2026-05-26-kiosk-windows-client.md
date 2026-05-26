# Kiosk Windows Client (WPF) — Design

**Date:** 2026-05-26
**Status:** Draft for review
**Scope:** Phase 3 of the kiosk biometric attendance system. The backend (Phase 1+2) is feature-complete on `kiosk-main` (PRs #46 merged, #47 pending review). This spec covers the **Windows kiosk client** that runs on a tablet at each outlet's entrance.

## Context

A Mantra MFS500 fingerprint scanner + a webcam sit at each outlet's entrance, attached to a Windows 11 tablet. Employees:

1. Press a finger on the MFS500 → the kiosk identifies them **locally** (templates synced from the opsy backend)
2. **Outlet pre-check** — does this employee belong at this outlet today? If not, show "Ask HR to update your outlet" and log the attempt
3. Pick the shift they're reporting for (Full Day / Break One / Mid-Night)
4. Pick **IN** or **OUT**
5. Camera captures **2 photos** (uniform, nails) — the kiosk uploads them to the backend
6. Server runs GPT-4o grooming checks, returns verdicts in the same response
7. Kiosk shows a green/red verdict screen with reasons → returns to idle

A second mode is **HR enroll mode** (PIN-gated): search by name/`#numId`, scan finger(s), POST to `/api/kiosk/fingerprints/enroll`.

The kiosk **never makes attendance decisions itself** — it's a recording UI for the backend. All HR functionality (verify, edit, overtime, salary recalc) keeps working unchanged.

## Decisions

| Area | Decision |
|---|---|
| Runtime | **.NET 8 LTS** (long-term-supported through Nov 2026), **WPF** (Windows-only — Phase 1+2 spec locked this) |
| Target framework moniker | **`net8.0-windows10.0.22621.0`** (Windows 11 SDK 22H2). Required for `<UseWPF>true</UseWPF>` + WinRT MediaCapture interop |
| MVVM framework | **CommunityToolkit.Mvvm** (Microsoft-maintained, lightweight, source generators replace boilerplate). Not Prism/Caliburn — overkill for our screen count |
| DI container | **`Microsoft.Extensions.DependencyInjection`** — registered in `App.OnStartup`, ViewModels and Services resolved through it. Same library opsy backend already uses; familiar to the team |
| Local data | **SQLite via Entity Framework Core 8** — same Prisma-like DX, easy migrations, mature on Windows. Stores the template cache + offline punch queue + device config |
| Fingerprint matcher | **Mantra MFS500 native SDK** (`MFS100`/`Mantra Aratek` DLLs) via P/Invoke. Local 1:N match against the synced template cache. ISO 19794-2 minutiae format |
| Camera capture | **WinRT MediaCapture** API (built into Windows; no extra NuGet). 1280×720 → encoded JPEG ≤512 KB before upload |
| HTTP client | **`HttpClient` + Polly** for retry/backoff. JSON via `System.Text.Json` |
| Auth header storage | **Windows Credential Locker** (`Windows.Security.Credentials.PasswordVault`) — kiosk token + device-id stay outside the SQLite DB so a DB wipe doesn't leak credentials |
| Logging | **Serilog** → rolling file in `%LOCALAPPDATA%\OpsyKiosk\logs` + Sentry sink |
| Crash reporting | **Sentry.NET** (existing opsy org account, free tier covers a few devices). Tagged by `kioskDeviceId` + `branchId` from handshake |
| Self-update | **Velopack** (modern Squirrel successor; simple, reliable on locked-down Windows; signed installer + auto-update). NOT ClickOnce (legacy, signing pain). NOT MSI (overkill) |
| Code-signing cert | **OV (Sectigo / DigiCert) ~$300/yr.** EV ($500/yr) gives SmartScreen reputation but our distribution is closed (HR-installed); OV is sufficient |
| Update channel | **Single `production` channel.** Pilot rollouts gate by outlet selection, not by version channel. Simpler ops |
| Kiosk lockdown | **Windows Assigned Access** in single-app mode + Task Scheduler to auto-launch on user logon. Disables `Alt+F4`/Task Manager via Group Policy on the kiosk account |
| Idle timeout | After 30s of no input, return to idle screen (fingerprint prompt) |
| Offline mode | **Queue punches in SQLite**, retry on reconnect. Photos stay in `%LOCALAPPDATA%\OpsyKiosk\queue\<punchId>\{uniform,nails}.jpg` until uploaded. Grooming flagged `PENDING` server-side when delayed photos arrive |
| Photo upload cap | **Backend rejects > 7.5MB base64 per photo (HTTP 413).** Client must validate `Encoding.UTF8.GetByteCount(base64) <= 7_500_000` before POST. v1's 1280×720 q=75 produces ~150-300KB so this is a foot-gun guard, not a normal limit |
| Template cache encryption | **DPAPI** (`ProtectedData.Protect`) keyed to the kiosk account — templates are non-reversible ISO minutiae but DPAPI is cheap defense-in-depth. On decryption failure (Windows reinstall / account migration), wipe the local cache and trigger an immediate `/fingerprints` full reconcile |
| PIN model | **One PIN per kiosk.** Hash stored on backend's `KioskDevice.enrollPinHash` (new column — schema addition needed); `/handshake` returns it on every call; kiosk caches locally for offline auth and invalidates on next handshake when the server value changes. Per-user PINs would need a user picker on the PIN screen — more friction; per-device + the `enrolledByDeviceId` audit on each enrollment row already gives us per-device traceability |
| Clock skew | On handshake, store `serverTime - localTime` offset. Stamp `punchedAt = (DateTime.UtcNow + offset).ToString("o")` — the `o`/round-trip format always emits the `Z` suffix the backend requires (a naive ISO string is hard-rejected with HTTP 400). Re-handshake hourly + on app start |
| Hindi UI | **Out for v1.** v1 ships English-only. Hindi (and other regional) lifted into a v1.1 spec if branches request it |

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  OpsyKiosk.exe                                                       │
│  ┌────────────────────────────────────────────────────────────┐     │
│  │  Views (WPF)                                                │     │
│  │   IdleView → ShiftPickerView → CaptureView → ResultView    │     │
│  │   EnrollLoginView → EnrollSearchView → EnrollCaptureView   │     │
│  └────────────────────────────────────────────────────────────┘     │
│           ▲                                                          │
│           │ DataContext (MVVM)                                       │
│  ┌────────────────────────────────────────────────────────────┐     │
│  │  ViewModels  (CommunityToolkit.Mvvm)                       │     │
│  └────────────────────────────────────────────────────────────┘     │
│           │ uses                                                     │
│  ┌────────────────────────────────────────────────────────────┐     │
│  │  Services                                                  │     │
│  │   FingerprintService   ←─ Mantra MFS500 SDK (P/Invoke)    │     │
│  │   CameraService        ←─ WinRT MediaCapture              │     │
│  │   TemplateCacheService ←─ EF Core SQLite                  │     │
│  │   PunchQueueService    ←─ EF Core SQLite + disk           │     │
│  │   ApiClient            ←─ HttpClient + Polly              │     │
│  │   SyncService          ←─ background; full + delta        │     │
│  │   AuthStore            ←─ Windows Credential Locker       │     │
│  └────────────────────────────────────────────────────────────┘     │
│           │                                                          │
│  ┌────────────────────────────────────────────────────────────┐     │
│  │  Storage                                                   │     │
│  │   kiosk.db (SQLite)       Credential Locker (token)        │     │
│  │   queue/<punchId>/*.jpg   logs/  (Serilog)                │     │
│  └────────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────┘
                          │ HTTPS
                          ▼
                   ┌──────────────┐
                   │ opsy backend │  /api/kiosk/* (Phase 1+2 spec)
                   └──────────────┘
```

---

## A. Punch flow (default mode)

State machine:

```
Idle ──finger placed──▶ Matching ──match──▶ OutletPrecheck
                            │                    │
                            └──no match──▶ NoMatchToast (3s) ──▶ Idle
                                                 │
        ┌────────────────────────────────────────┘
        │
        ▼
   employee.branchId == device.branchId ?
        │                                    │
        │ YES                                │ NO
        ▼                                    ▼
   ShiftPicker ─pick─▶ DirectionPicker   WrongOutletToast (4s)
                            │              "You're assigned to <branch>.
                            │               Ask HR to update your outlet."
                            ▼              → log attempt (local) → Idle
                    CaptureUniform
                            │
                            ▼
                    CaptureNails
                            │
                            ▼
                    Submitting (POST /api/kiosk/punch)
                            │
                ┌───────────┼──────────────┐
                │           │              │
              200         403          other  ──── see status-map below
                │       (server            │
                │        re-gate)          │
                ▼           │              ▼
           ResultView   WrongOutlet   per-status UX
           ("Punched    Toast → Idle
            IN at … —
            Uniform ✓
            Nails ✗
            Reason: …")
                │
            6s timeout
                ▼
              Idle
```

**Fingerprint events are dropped** during `Matching`, `Submitting`, and `Result` phases — only `Idle` accepts scans, so the next employee can't accidentally trigger a punch mid-flow.

**HTTP status → UX map** (the kiosk MUST handle each distinctly, not lump all non-2xx into "queue offline"):

| Status | Cause | Kiosk UX | Queue locally? |
|---|---|---|---|
| **200** | Punch recorded | `Result` screen with grooming verdicts (green/red) | No |
| **403** with `{ blocked: true, reason: "WRONG_OUTLET", assignedBranch, punchEventId }` | Server re-gated the outlet (race vs local pre-check) | `WrongOutlet` toast naming the assigned branch | No — server already recorded a `BLOCKED_WRONG_OUTLET` PunchEvent |
| **400** | Bad request body (e.g. naive ISO timestamp) | `ApplicationErrorToast` "Punch rejected by server — try again" + log to Sentry as a bug | No — re-queueing the same bad body forever is wrong |
| **401** | Device token revoked / inactive | `AuthErrorToast` "Device unauthorized — call HR" + cease retries indefinitely | No — kiosk needs HR re-provision |
| **404** | User not found (template matched a deleted employee) | `UnknownUserToast` "Employee record missing — call HR" + trigger immediate `/fingerprints` full reconcile (to purge the orphan template) | No |
| **413** | Photo too large (> 7.5 MB base64) | `PhotoErrorToast` "Photo capture failed — please try again" + re-encode with lower quality (`PhotoQuality - 10`) on next attempt | No — re-queueing won't fix the size |
| **5xx / network error / timeout** | Backend down or unreachable | `ResultViewDegraded` "Recorded offline — will sync when network returns" + queue locally | **Yes** — Polly backoff 30s, 2m, 10m, 1h (then alert) |

**Latency budget per punch (target):**
- Local fingerprint match: <2s
- Camera capture × 2: <4s (1.5s each + UI transitions)
- HTTP upload + grooming: <9s (8s server-side timeout + 1s network)
- Result screen → idle: 6s
- **Total: <21s** from finger-press to "next employee can punch"

## B. Enroll mode (HR, PIN-gated)

Triggered by **hidden gesture**: tap top-left corner 5 times within 3 seconds. **The gesture is only sampled on `IdleView`** — all other views ignore it, so a customer can't accidentally drop out of a mid-punch shift dialog or capture screen.

**PIN model** (per Decisions): one 6-digit PIN per kiosk. Hash stored on backend's `KioskDevice.enrollPinHash` (new column — schema addition needed); `/handshake` returns it on every call; kiosk caches the hash locally in `DeviceConfig.EnrollPinHashCache`. PIN entry is validated against the cache (works offline). HR rotates from the web admin UI; the next handshake replaces the cache. Initial PIN is set during first-run setup (see §F).

```
EnrollLogin ──PIN OK──▶ EnrollSearch (by name or #numId, fuzzy)
                              │
                              ▼ pick user
                       EnrollCapture
                         ↓
                  for fingerIndex in [1 (right index), 0 (right thumb)]:
                    scan finger 3× → average template → POST /api/kiosk/fingerprints/enroll
                         ↓
                  ┌──────────────────┐
                  │  201 → continue  │
                  │  409 → UserInactiveToast "User no longer ACTIVE — contact HR"
                  │       → back to EnrollSearch
                  │  4xx/5xx → ErrorToast → retry from EnrollCapture
                  └──────────────────┘
                         ↓
                  EnrollSuccess (3s) → EnrollSearch (loop, can enroll another user)
```

Reuses `/api/kiosk/fingerprints/enroll`. The backend upserts on `(userId, fingerIndex)` so re-enrolling a finger replaces the old template (Phase 1+2 spec §A2). Minimum 2 fingers per employee (so a cut on the index doesn't block them).

## C. Local data + sync

**`kiosk.db` (SQLite) tables (EF Core models):**

```csharp
class CachedTemplate {           // mirrors backend FingerprintEnrollment
  string Id;
  string UserId;
  int FingerIndex;
  byte[] TemplateData;            // DPAPI-encrypted at rest
  bool IsActive;
  string BranchId;                // owner's current outlet (from sync)
  DateTime UpdatedAt;
}

class QueuedPunch {              // offline queue
  string Id;                      // local Guid; client-side dedup key (see retry-dedup note below)
  string UserId;
  string ShiftId;
  string Direction;               // "IN" | "OUT"
  DateTime PunchedAt;             // UTC, kiosk-stamped
  string UniformPhotoPath;        // local file path
  string NailsPhotoPath;
  int RetryCount;
  DateTime? NextRetryAt;
  string? LastError;
}

// (No local BlockedAttempt table — the backend persists every wrong-outlet
//  attempt as a BLOCKED_WRONG_OUTLET PunchEvent. Kiosk emits a Sentry event
//  for ops visibility but does not duplicate the store.)

class DeviceConfig {             // singleton row
  string ServerUrl;
  string BranchId;
  string BranchName;
  DateTime? LastFullSyncAt;
  DateTime? LastDeltaSyncAt;
  long ClockSkewMs;               // (serverTime - localTime) at last handshake
  string? EnrollPinHashCache;     // mirrors backend KioskDevice.enrollPinHash; replaced on each handshake
  DateTime? EnrollPinHashCachedAt;
}
```

> **Retry dedup — v1 design and acceptable tradeoffs:** the backend `/api/kiosk/punch` route does NOT (yet) honor a client-supplied idempotency key. With the current `@@unique([userId, date])` on `Attendance`, two retried IN punches for the same user/day merge cleanly (1 Attendance, 2 PunchEvents — handled by the existing P2002 retry in `punch-service`). However, **two retried OUT punches will both succeed**, creating two `PunchEvent` rows with duplicate photos; `Attendance.checkOut` will be overwritten by whichever lands last (no data loss; minor Azure storage waste). v1 ships with this tradeoff. **v1.1 enhancement** (tracked in Open items): backend accepts an `Idempotency-Key: <QueuedPunch.Id>` header, `PunchEvent` gains a `@@unique` on it, retries become true no-ops.

> **DPAPI recovery:** `ProtectedData.Protect` uses the kiosk account's DPAPI keys. A Windows reinstall, account migration, or profile reset destroys those keys → all `CachedTemplate.TemplateData` becomes undecryptable. On the first decryption failure the kiosk: (1) deletes all rows from `CachedTemplate`, (2) clears `DeviceConfig.LastFullSyncAt`, (3) triggers an immediate `/fingerprints` full reconcile (no params). Recovery is automatic; the gap is one sync round-trip (<5s). Logged as a `TemplateCacheRebuilt` Sentry event.

**Sync schedule:**

| Trigger | What | Endpoint |
|---|---|---|
| App start | Handshake + full reconcile + delta sync | `/handshake`, `/fingerprints` (no params), `/fingerprints?updatedSince=…` |
| Every 5 min (idle) | Delta sync | `/fingerprints?updatedSince=<lastDeltaSyncAt>` |
| Every 1 hour | Re-handshake (refresh clock offset) | `/handshake` |
| Once daily at 03:00 IST | Full reconcile (self-heal missed deltas + catch hard-deletes) | `/fingerprints` (no params) |
| On punch failure (5xx/network) | Background retry of queue, exponential backoff: 30s, 2m, 10m, 1h | `/punch` per queued item |
| App start + once per IST calendar day at 03:00 | Refresh shift list (in-memory only, not persisted to SQLite) | `/shifts` |

Shift dialog reads from the in-memory cache without a network call. Shifts change rarely (HR action), and a stale list is a non-issue for the next punch — worst case the employee picks a shift that's been renamed, and HR fixes it post hoc via the existing edit flow.

**Sync semantics handled by the backend** (no client-side cleverness needed): tombstones (`isActive=false`) → kiosk deletes from cache; new rows → insert; existing rows → update (including `branchId` for transfers). The full-reconcile mode returns only currently-active enrollments; the kiosk diffs against its local cache and deletes anything not in the response.

## D. Camera + fingerprint integration

### Fingerprint (Mantra MFS500)

- **SDK source:** Mantra/Aratek "MFS100 Win SDK" — includes `MFS100.dll` + `MantraJSAuth.dll` + a C# wrapper sample. Distribute the DLLs with the app (no system install needed; place under `App.Path\Vendor\Mantra\`)
- **Pattern:** `Init()` → `AutoCapture(quality=60, timeout=10s)` → returns `ISOTemplate` (base64). For enrollment: capture 3×, use SDK's `MatchScore` between captures to confirm consistency (>60), average via `CreateTemplate` SDK helper
- **Local 1:N matcher:** SDK provides `MatchISO(probe, candidate)` returning an integer match score. SDK considers **≥60** the floor for a 1:1 match; our 1:N policy tightens this to **≥70** (the larger the candidate pool, the higher the false-positive probability at a given score). Threshold is tuned via `MatchThreshold` in `appsettings.json` (§F). Iterate the cached templates, return the first candidate scoring ≥ `MatchThreshold`
- **Performance:** For ~500 employees × 2 fingers each = 1000 candidates, sequential matching is <2s on modern CPUs. If we scale past 5000 templates, batch via `Parallel.ForEach` or move to vendor's NBis matcher

### Camera (WinRT MediaCapture)

- Two captures per punch (uniform = chest-up, nails = hands-down)
- Auto-focus + 200ms warm-up before grab (avoids dark first frame)
- **Re-take button** on capture screen (5s window) — single-shot, no scrubbing
- Output: 1280×720 JPEG, quality 75 → ~150-300 KB. Sent as base64 in the POST body
- No video; no preview hold; capture immediately on screen entry + on tap

## E. UX + screens (kiosk lockdown)

**Window:** fullscreen, no chrome, no minimize/close. `WindowStyle="None"`, `WindowState="Maximized"`, `Topmost="True"`, `ShowInTaskbar="False"`. Block `Alt+F4`, `Alt+Tab`, `Win`, `Ctrl+Esc` via `KeyDown` handlers + Windows kiosk-mode policy.

**Screens** (rough wireframes — designer to refine):

| Screen | Content | Timeout |
|---|---|---|
| Idle | Big "Place finger" prompt + outlet name + clock + tiny "v1.0.3" footer. Hidden top-left gesture activates EnrollLogin | — |
| Matching | "Reading…" spinner. Cancels if finger removed | 10s → Idle |
| NoMatch | "Fingerprint not recognized — ask HR to enroll" | 3s → Idle |
| WrongOutlet | "You're assigned to **<branch>**. Ask HR to update your outlet." Red banner | 4s → Idle |
| ShiftPicker | "Hi **<name>** — pick your shift today." 3 large buttons | 30s → Idle |
| DirectionPicker | "Punching IN or OUT?" 2 huge buttons (green/orange) | 30s → Idle |
| CaptureUniform | Live preview + countdown (3,2,1, snap). Capture → Re-take/Continue (5s) | 30s → Idle |
| CaptureNails | Same, prompt "Show your hands palms down" | 30s → Idle |
| Submitting | Spinner + "Saving your punch…" | 15s → fallback to ResultViewDegraded |
| Result | Big green/red. "Punched IN at 09:00 — Uniform ✓ Nails ✗ (Nails: too long, please trim)". Manager-visible audit | 6s → Idle |
| ResultDegraded | "Recorded offline — will sync when network is back" + a small queue badge ("3 pending") | 6s → Idle |
| EnrollLogin | PIN pad (6 digits, masked) | 60s → Idle |
| EnrollSearch | Search box + recent matches list (name + #numId) | 120s idle → EnrollLogin |
| EnrollCapture | "Press right index finger (1 of 3)" + finger-position diagram | 60s → EnrollSearch |
| EnrollSuccess | "Enrolled ✓ — enroll another?" | 5s → EnrollSearch |

**Touch target sizing:** all interactive elements ≥80×80 dp (employees may have wet/oily hands). Min font sizes: 24pt body, 48pt headings, 96pt result-screen status.

**Accessibility:** high-contrast palette by default (white text on dark surface). No screen-reader integration in v1 (kiosk users are sighted). Language is English only in v1 (see Decisions).

## F. Configuration + deployment

### First-run setup (HR runs once per kiosk)

1. **HR provisions the device on the web** at `/admin/kiosk-devices` (a small admin UI included as a sub-deliverable of Phase 3 — see Phasing). The page POSTs `/api/kiosk/devices` (HR/MANAGEMENT-only, already implemented in Phase 1+2) and displays the raw token ONCE with a "Copy to clipboard" button + the device-id. HR also sets the initial enroll PIN here (which writes `KioskDevice.enrollPinHash` — the new column).
2. Install signed `OpsyKiosk-Setup.exe` on the Windows tablet (Velopack-generated, see Updates below)
3. On first launch: setup wizard prompts for:
   - Server URL (default `https://opsy.<domain>`)
   - Provision token (paste from clipboard)
   - Device-id (paste from clipboard) — server validates this matches the token's hash
4. App stores token in Credential Locker, device-id in `kiosk.db`, calls `/handshake` once to verify + pull initial `enrollPinHash`, exits
5. Re-launch → enters Idle mode (full kiosk lockdown active)

### Auto-launch on boot

Windows Assigned Access "single-app kiosk" mode pinned to a dedicated `KioskUser` local account (no admin rights). On boot → auto-login to `KioskUser` → Windows launches OpsyKiosk.exe via Assigned Access → app takes over the entire screen.

### Updates

- **Velopack** checks `https://opsy.<domain>/kiosk-updates/RELEASES` once at startup + once daily
- New version → download in background, apply on next idle-state transition (never mid-punch)
- Updates are signed (Authenticode) — kiosks reject unsigned releases. Cert lives in **Azure Key Vault**, signing happens in **GitHub Actions** (windows-latest runner; OIDC federated identity to Azure; `signtool` against Key Vault HSM)
- **Release feed hosting:** static files (`RELEASES` + `*-full.nupkg` + `*-delta.nupkg`) live in a dedicated **Azure Blob container** (`kiosk-releases`, public-read). Next.js `next.config.ts` has a single `rewrites()` rule mapping `/kiosk-updates/*` → `https://<account>.blob.core.windows.net/kiosk-releases/*`. CI uploads on every tagged release (`v1.2.3`); rollback = re-upload an older `RELEASES` file. No backend code change beyond the rewrite

### Settings file (read-only at runtime)

`%LOCALAPPDATA%\OpsyKiosk\appsettings.json`:

```json
{
  "ApiBaseUrl": "https://opsy.example.com",
  "SyncIntervalSeconds": 300,
  "FullReconcileTimeIst": "03:00",
  "MatchThreshold": 70,
  "PunchTimeoutSeconds": 30,
  "IdleTimeoutSeconds": 30,
  "PhotoQuality": 75,
  "PhotoMaxWidth": 1280,
  "PhotoMaxBase64Bytes": 7500000,
  "Sentry": {
    "Dsn": "<from-env-at-build>",
    "Environment": "production"
  }
}
```

## G. Telemetry + logging

- **Serilog rolling file** in `%LOCALAPPDATA%\OpsyKiosk\logs\opsy-kiosk-YYYYMMDD.log`, 30-day retention
- **Sentry**: all exceptions + key events (`PunchSubmitted`, `PunchQueued`, `WrongOutletBlocked`, `SyncCompleted`, `FingerprintEnrolled`, `UpdateApplied`). Tagged with `kioskDeviceId`, `branchId`, `appVersion`
- **No PII in Sentry breadcrumbs** — log `userId` only (already an opaque CUID), never `name`/`email`/photo paths
- **Local metrics**: counts of punches/day, average match latency, average grooming latency, queue depth — visible on a hidden "ops" screen (gesture: tap top-right 5×, PIN-gated). Not sent server-side in v1.

## Phasing

**Pre-phase (web, parallelizable; depends on backend, not client):**

0. **Backend additions** (web team): (a) add `KioskDevice.enrollPinHash String?` schema + migration; (b) extend `/api/kiosk/handshake` to return the cached `enrollPinHash`; (c) build the `/admin/kiosk-devices` HR page (provision UI: list/create/revoke devices, copy raw token once, set/rotate enroll PIN); (d) add `next.config.ts` rewrite for `/kiosk-updates/*` → Azure Blob `kiosk-releases`. ~3-4 days; merges to `kiosk-main` ahead of Phase-3 client work.
0b. **Hardware procurement** (ops, parallel to all dev): order MFS500 + UVC webcam + Windows 11 tablet; secure Mantra MFS500 runtime license + SDK access; order OV code-signing cert (Sectigo ~$300). Lead time: 1-2 weeks. **This is the critical-path dependency.**

**Client (Phase 3 proper):**

1. **Skeleton + dev loop** — empty WPF project (`net8.0-windows10.0.22621.0`, `<UseWPF>true</UseWPF>`) + MVVM scaffolding (CommunityToolkit.Mvvm + `Microsoft.Extensions.DependencyInjection`) + ApiClient + handshake call that 401s, then succeeds with a real token. Confirms the dev environment (Parallels Windows VM). ~2 days.
2. **Fingerprint + camera** — wire Mantra SDK (P/Invoke) + WinRT MediaCapture as standalone services with simple test UIs. Confirms hardware works (USB passthrough via Parallels is often the slowest part — budget for an extra day if it's flaky). ~3-5 days.
3. **Punch flow happy path** — Idle → ShiftPicker → Direction → Capture × 2 → POST → Result. No offline, no enroll yet, no outlet-precheck. ~5 days.
4. **Outlet pre-check + WrongOutlet UX** — local check using cached template's `branchId`. ~1 day.
5. **Enroll mode** — PIN gate (cached hash from handshake), search, capture, POST. ~3 days.
6. **Sync** — full reconcile on launch + delta poll + daily reconcile. ~2 days.
7. **Offline queue** — SQLite-backed queue + Polly retry policy + per-status UX (see §A status map) + degraded result view. ~3 days.
8. **Kiosk lockdown + auto-launch** — Assigned Access config, Velopack updater, **signing pipeline (GitHub Actions + Azure Key Vault first-time setup is the long pole — 1-2 days alone)**, release-feed hosting. ~4-5 days.
9. **Sentry + Serilog wiring** — minimal. ~1 day.
10. **Pilot on 1 outlet** — co-locate with manager, fix UX bugs, measure latency. **~2 weeks** observation + fixes (1 week is too short for a payroll-impacting system; the second week catches edge cases like end-of-month / shift-change-day issues).
11. **Roll out** — once pilot is stable, deploy to remaining outlets in waves (3 at a time, 1-week observation between waves).

**Total dev time: ~5-6 weeks for one engineer** (clientside, after pre-phase backend additions land) + 2 weeks pilot + rollout per outlet schedule. Add 1-2 weeks of Mantra SDK procurement lead time to start-of-Phase-2; that work can overlap with Phase 1's skeleton.

## Verification

### Per-component (XUnit)

- **TemplateCacheService**: insert / update (transfer simulation) / tombstone / delete; encryption round-trip via DPAPI; query by userId
- **PunchQueueService**: enqueue / dequeue oldest-first / retry-with-backoff / mark-failed-after-N-retries
- **ApiClient**: handshake handles 401/200/timeout; punch retries on 5xx, gives up on 4xx; serializes/deserializes the contract correctly (use the backend's vitest test fixtures as golden samples)
- **SyncService**: full reconcile applies adds + deletes; delta applies adds + tombstones; clock skew is updated on handshake

### Hardware-in-the-loop (manual on the Mac+Parallels dev rig)

1. Plug MFS500 into Mac USB → Parallels passes through → SDK `Init()` returns success
2. Plug UVC webcam → MediaCapture enumerates → preview shows
3. End-to-end: enroll 1 finger of 1 test employee → punch IN → confirm Attendance row in opsy DB → punch OUT → confirm same row updated

### Pilot acceptance (1 outlet, 1 week)

- 95th percentile punch latency <25s
- Zero misidentifications (wrong employee credited with a punch) — confirmed by HR sampling 50 punches
- Wrong-outlet blocks recorded correctly (cross-test by transferring a test user)
- Offline queue drains within 5 min of reconnect (test by yanking Wi-Fi mid-day)
- No app crashes (Sentry events = 0)
- Grooming verdicts displayed (even if "all PASS" by default — confirms the UI binds and the backend round-trips)

## Open items (lock before plan)

These need explicit decisions before writing the implementation plan. (Items that were originally listed here but had clear-default answers have been promoted into the Decisions table above — update channel, PIN model, Velopack cost tier, Hindi UI.)

- **Mantra SDK procurement** — vendor contact, license tier (per-device runtime expected), DLL package source. **Critical path** — flag immediately if procurement won't land before Phase 2's hardware-integration window. Without the SDK, Phase 2 stalls.
- **Idempotency-key for offline-queue retries (v1.1)** — backend currently has no client-supplied dedup key on `/punch`. Two retried OUT punches will dupe `PunchEvent` rows + photos (Attendance handles the IN case via `@@unique`). Spec out a backend addition: `Idempotency-Key: <QueuedPunch.Id>` header + a `@@unique` on `PunchEvent.idempotencyKey`. Track for v1.1.
- **Crash-time data capture format** — Sentry attaches `QueuedPunch` rows on crash. Format: JSON array, includes everything in the `QueuedPunch` model EXCEPT `UniformPhotoPath` / `NailsPhotoPath` (the paths only — never the photo bytes; photos may contain PII). Lock this if accepted.
- **Idle-screen branding** — outlet logo / time / weather? Default: brand mark + branch name + clock only. Anything more is scope creep
- **Hardware spec** — recommend kiosk vendor sources for the tablet/MFS500/webcam bundle. Out of scope here; ops team to pick. Min spec: Win 11 Pro (for Assigned Access), 4 GB RAM, 64 GB storage, USB 2.0+, integrated or USB webcam
- **Token revocation UX** — when HR sets `KioskDevice.isActive=false` (e.g. lost/stolen tablet), the kiosk gets 401 on its next call. Per §A status map this shows the `AuthErrorToast` "Device unauthorized — call HR" and ceases retries. Decide: should the kiosk wipe its local SQLite + template cache on receiving an indefinite 401, to prevent a recovered device from punching for old templates? Default: yes, wipe after 24h of continuous 401s.
- **Decommissioning procedure** — when a kiosk is retired (or moves to a different outlet), the HR procedure to wipe `kiosk.db` + `%LOCALAPPDATA%\OpsyKiosk\*` + uninstall before disposal. Document in an ops runbook (Phase 3.5 deliverable, not v1).
- **Ops alerting on queue depth** — kiosk has a local "ops" screen showing queue depth (gesture, PIN-gated), but ops can't see it remotely. Decide: should the kiosk POST a periodic `/api/kiosk/heartbeat` with `{ queueDepth, lastSyncAt, appVersion, uptimeMs }`? Default: yes for v1.1; v1 ships without (Sentry events for `PunchQueued` give partial visibility).
- **Pilot rollback path** — if the pilot reveals a critical issue (misIDs, payroll discrepancy, repeated crashes), what's the immediate response? Default: HR sets `KioskDevice.isActive=false` on the pilot kiosk (immediately freezes new punches; existing queued punches drain or are discarded per Token revocation UX above), outlet reverts to the prior paper/manual attendance flow. **Document the rollback decision authority** (HR Manager? Engineering on-call?) before pilot starts.
- **Local DB backup / corruption recovery** — `kiosk.db` corruption (power loss mid-write, disk failure) is recoverable via `/fingerprints` full reconcile + the offline queue being lost (rare but possible). Default: on EF Core `SqliteException` open-failure, delete `kiosk.db`, log a Sentry `LocalDbReset` event with the queue depth at last known checkpoint, trigger full re-sync. Acceptable data loss for v1; revisit if pilot shows it happens > once per kiosk-year.

---

## See also

- **Phase 1+2 backend spec** — `docs/superpowers/specs/2026-05-26-kiosk-biometric-attendance-design.md` (the API contract this client implements)
- **Endpoint smoke runbook** — `docs/superpowers/runbooks/kiosk-endpoint-smoke.md` (the HTTP behaviors this client must produce)
- **Sibling subproject scaffold** — `opsy-kiosk/README.md`
- **Backend implementation plan (done)** — `docs/superpowers/plans/2026-05-26-kiosk-biometric-attendance-backend.md`
