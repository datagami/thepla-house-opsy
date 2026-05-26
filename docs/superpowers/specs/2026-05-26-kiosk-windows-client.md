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
| MVVM framework | **CommunityToolkit.Mvvm** (Microsoft-maintained, lightweight, source generators replace boilerplate). Not Prism/Caliburn — overkill for our screen count |
| Local data | **SQLite via Entity Framework Core 8** — same Prisma-like DX, easy migrations, mature on Windows. Stores the template cache + offline punch queue + device config |
| Fingerprint matcher | **Mantra MFS500 native SDK** (`MFS100`/`Mantra Aratek` DLLs) via P/Invoke. Local 1:N match against the synced template cache. ISO 19794-2 minutiae format |
| Camera capture | **WinRT MediaCapture** API (built into Windows; no extra NuGet). 1280×720 → encoded JPEG ≤512 KB before upload |
| HTTP client | **`HttpClient` + Polly** for retry/backoff. JSON via `System.Text.Json` |
| Auth header storage | **Windows Credential Locker** (`Windows.Security.Credentials.PasswordVault`) — kiosk token + device-id stay outside the SQLite DB so a DB wipe doesn't leak credentials |
| Logging | **Serilog** → rolling file in `%LOCALAPPDATA%\OpsyKiosk\logs` + Sentry sink |
| Crash reporting | **Sentry.NET** (existing opsy org account, free tier covers a few devices). Tagged by `kioskDeviceId` + `branchId` from handshake |
| Self-update | **Velopack** (modern Squirrel successor; simple, reliable on locked-down Windows; signed installer + auto-update). NOT ClickOnce (legacy, signing pain). NOT MSI (overkill) |
| Kiosk lockdown | **Windows Assigned Access** in single-app mode + Task Scheduler to auto-launch on user logon. Disables `Alt+F4`/Task Manager via Group Policy on the kiosk account |
| Idle timeout | After 30s of no input, return to idle screen (fingerprint prompt) |
| Offline mode | **Queue punches in SQLite**, retry on reconnect. Photos stay in `%LOCALAPPDATA%\OpsyKiosk\queue\<punchId>\{uniform,nails}.jpg` until uploaded. Grooming flagged `PENDING` server-side when delayed photos arrive |
| Template cache encryption | **DPAPI** (`ProtectedData.Protect`) keyed to the kiosk account — templates are non-reversible ISO minutiae but DPAPI is cheap defense-in-depth |
| Clock skew | On handshake, store `serverTime - localTime` offset. Stamp `punchedAt = DateTime.UtcNow + offset` on every punch. Re-handshake hourly + on app start |

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
                ┌───────────┼───────────┐
                │           │           │
              200         403         5xx/offline
                │       (server         │
                │        re-gate)       │
                ▼           │           ▼
           ResultView   WrongOutlet  QueueLocally + ResultViewDegraded
           ("Punched    Toast → Idle  ("Recorded offline — will sync")
            IN at … —
            Uniform ✓
            Nails ✗
            Reason: …")
                │
            6s timeout
                ▼
              Idle
```

**Latency budget per punch (target):**
- Local fingerprint match: <2s
- Camera capture × 2: <4s (1.5s each + UI transitions)
- HTTP upload + grooming: <9s (8s server-side timeout + 1s network)
- Result screen → idle: 6s
- **Total: <21s** from finger-press to "next employee can punch"

## B. Enroll mode (HR, PIN-gated)

Triggered by **hidden gesture**: tap top-left corner 5 times within 3 seconds. Prompts for a 6-digit PIN (stored hashed in `kiosk.db`, set during installation, rotatable from the web app — `KioskDevice.enrollPinHash`, **schema addition needed**).

```
EnrollLogin ──PIN OK──▶ EnrollSearch (by name or #numId, fuzzy)
                              │
                              ▼ pick user
                       EnrollCapture
                         ↓
                  for fingerIndex in [1 (right index), 0 (right thumb)]:
                    scan finger 3× → average template → POST enroll
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
  string Id;                      // local Guid; matched server-side via idempotency-key
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

class BlockedAttempt {           // local log of wrong-outlet attempts
  string Id;
  string UserId;
  DateTime AttemptedAt;
  string AssignedBranchName;      // from outlet pre-check
}

class DeviceConfig {             // singleton row
  string ServerUrl;
  string BranchId;
  string BranchName;
  DateTime? LastFullSyncAt;
  DateTime? LastDeltaSyncAt;
  long ClockSkewMs;               // (serverTime - localTime) at last handshake
  string? EnrollPinHash;
}
```

**Sync schedule:**

| Trigger | What | Endpoint |
|---|---|---|
| App start | Handshake + full reconcile + delta sync | `/handshake`, `/fingerprints` (no params), `/fingerprints?updatedSince=…` |
| Every 5 min (idle) | Delta sync | `/fingerprints?updatedSince=<lastDeltaSyncAt>` |
| Every 1 hour | Re-handshake (refresh clock offset) | `/handshake` |
| Once daily at 03:00 IST | Full reconcile (self-heal missed deltas + catch hard-deletes) | `/fingerprints` (no params) |
| On punch failure (5xx/network) | Background retry of queue, exponential backoff: 30s, 2m, 10m, 1h | `/punch` per queued item |
| On shift dialog open | Cached shifts; refresh in background | `/shifts` |

**Sync semantics handled by the backend** (no client-side cleverness needed): tombstones (`isActive=false`) → kiosk deletes from cache; new rows → insert; existing rows → update (including `branchId` for transfers). The full-reconcile mode returns only currently-active enrollments; the kiosk diffs against its local cache and deletes anything not in the response.

## D. Camera + fingerprint integration

### Fingerprint (Mantra MFS500)

- **SDK source:** Mantra/Aratek "MFS100 Win SDK" — includes `MFS100.dll` + `MantraJSAuth.dll` + a C# wrapper sample. Distribute the DLLs with the app (no system install needed; place under `App.Path\Vendor\Mantra\`)
- **Pattern:** `Init()` → `AutoCapture(quality=60, timeout=10s)` → returns `ISOTemplate` (base64). For enrollment: capture 3×, use SDK's `MatchScore` between captures to confirm consistency (>60), average via `CreateTemplate` SDK helper
- **Local 1:N matcher:** SDK provides `MatchISO(probe, candidate)` — score >60 = match. Iterate cached templates, return first match with score ≥70 (tighter threshold for 1:N vs 1:1)
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

**Accessibility:** high-contrast palette by default (white text on dark surface). No screen-reader integration in v1 (kiosk users are sighted; HR Hindi UI is a follow-up).

## F. Configuration + deployment

### First-run setup (HR runs once per kiosk)

1. Install signed `OpsyKiosk-Setup.exe` (Velopack-generated)
2. On first launch: shows a setup wizard
   - Server URL (default `https://opsy.<domain>`)
   - Provision token (paste once — HR generated via the web `POST /api/kiosk/devices`)
   - Set enroll PIN
3. App stores token in Credential Locker, device-id in `kiosk.db`, exits
4. Re-launch → enters Idle mode (full kiosk lockdown active)

### Auto-launch on boot

Windows Assigned Access "single-app kiosk" mode pinned to a dedicated `KioskUser` local account (no admin rights). On boot → auto-login to `KioskUser` → Windows launches OpsyKiosk.exe via Assigned Access → app takes over the entire screen.

### Updates

- **Velopack** checks `https://opsy.<domain>/kiosk-updates/RELEASES` once at startup + once daily
- New version → download in background, apply on next idle-state transition (never mid-punch)
- Updates are signed (Authenticode) — kiosks reject unsigned releases. Cert lives in Azure Key Vault, signing happens in CI

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

1. **Skeleton + dev loop** — empty WPF project + MVVM scaffolding + ApiClient + handshake call that 401s, then succeeds with a real token. Confirms the dev environment (your Parallels Mac VM setup). ~2 days.
2. **Fingerprint + camera** — wire Mantra SDK + WinRT MediaCapture as standalone services with simple test UIs. Confirms hardware works. ~3-4 days.
3. **Punch flow happy path** — Idle → ShiftPicker → Direction → Capture × 2 → POST → Result. No offline, no enroll yet, no outlet-precheck. ~5 days.
4. **Outlet pre-check + WrongOutlet UX** — local check using cached template's `branchId`. ~1 day.
5. **Enroll mode** — PIN gate, search, capture, POST. ~3 days.
6. **Sync** — full reconcile on launch + delta poll + daily reconcile. ~2 days.
7. **Offline queue** — SQLite-backed queue + Polly retry policy + degraded result UX. ~3 days.
8. **Kiosk lockdown + auto-launch** — Assigned Access config, Velopack updater, signing pipeline. ~3 days.
9. **Sentry + Serilog wiring** — minimal. ~1 day.
10. **Pilot on 1 outlet** — co-locate with manager, fix UX bugs, measure latency. ~1 week observation + fixes.
11. **Roll out** — once pilot is stable, deploy to remaining outlets in waves (3 at a time, 1-week observation between waves).

Total dev time: ~4 weeks for one engineer + 1 week pilot + rollout per outlet schedule.

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

These need explicit decisions before writing the implementation plan. Default suggestions inline; flag if you want to override:

- **Mantra SDK distribution** — Mantra's licensing model varies (per-device, per-app, royalty). Confirm we have a developer/runtime license covering the deployment fleet (assume yes; flag if no — this would block Phase 3 hard)
- **Update channel(s)** — single `production` channel, or `production` + `pilot`? Default: single channel; pilots are by outlet selection, not by version
- **PIN sharing model** — one PIN per kiosk, or per HR user? Default: one PIN per kiosk (rotatable from web). Per-user PINs need a user picker on the PIN screen — more friction. Per-kiosk + Sentry "EnrollSession" event with `enrolledByDeviceId` already gives us per-device audit
- **Schema addition needed** — backend `KioskDevice.enrollPinHash` (nullable). Small migration on `kiosk-main` before Phase 3 ships. Could be added during Phase 3's pilot
- **Idle-screen branding** — outlet logo / time / weather? Default: brand mark + branch name + clock only. Anything more is scope creep
- **Multilingual UI** — v1 is English only. Hindi v1.1 if requested by branches; spec out in v1.1 plan
- **Crash-time data capture** — Sentry captures stack + tags. Should we also dump the queued punches snapshot as a Sentry attachment for forensic recovery? Default: yes, attach `kiosk.db.QueuedPunch` rows (no photos) to crash events
- **Velopack signing cost** — Authenticode code-signing certs are ~$300/yr (Sectigo OV) or ~$500/yr (EV). Default: OV is sufficient for kiosks; EV is for SmartScreen reputation (less relevant for our distribution model)
- **Hardware spec** — recommend kiosk vendor sources for the tablet/MFS500/webcam bundle. Out of scope here; ops team to pick. Min spec: Win 11 Pro (for Assigned Access), 4 GB RAM, 64 GB storage, USB 2.0+, integrated or USB webcam

---

## See also

- **Phase 1+2 backend spec** — `docs/superpowers/specs/2026-05-26-kiosk-biometric-attendance-design.md` (the API contract this client implements)
- **Endpoint smoke runbook** — `docs/superpowers/runbooks/kiosk-endpoint-smoke.md` (the HTTP behaviors this client must produce)
- **Sibling subproject scaffold** — `opsy-kiosk/README.md`
- **Backend implementation plan (done)** — `docs/superpowers/plans/2026-05-26-kiosk-biometric-attendance-backend.md`
