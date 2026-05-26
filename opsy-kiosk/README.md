# opsy-kiosk

Outlet-side **biometric attendance kiosk** for Plahouse. Runs on a Windows tablet at each
outlet's entrance with a Mantra MFS500 fingerprint scanner + a webcam, and talks to the main
`opsy` web app over HTTPS.

This folder is the **kiosk application** (separate deployable from the Next.js web app in `../src`,
following the same sibling-subproject convention as `../opsy-timer`).

## Status

🟡 **Design phase.** No code yet.

- **Design spec:** [`../docs/superpowers/specs/2026-05-26-kiosk-biometric-attendance-design.md`](../docs/superpowers/specs/2026-05-26-kiosk-biometric-attendance-design.md)
- **Branch:** `feat/kiosk-biometric-attendance`
- **Next step:** spec review → backend implementation plan (via `superpowers:writing-plans`)
  → kiosk-app implementation plan.

## Scope (one-line)

Fingerprint-identify the employee → take a grooming photo → POST a punch to opsy → show a clear
result on screen. Punches are **outlet-gated**: only allowed at the employee's currently-assigned
outlet (`User.branchId`); wrong-outlet attempts are rejected with the assigned-outlet name and logged.

## Layout (planned, not yet created)

```
opsy-kiosk/
├── README.md           ← you are here
├── src/                ← kiosk app source (stack TBD in plan: Electron + React / Tauri / .NET)
├── drivers/            ← MFS500 SDK integration notes + native wrapper
├── config/             ← per-outlet config (branchId, kioskId, server URL, certs)
└── scripts/            ← packaging, install, update
```

Stack and exact layout will be decided in the implementation plan — see spec §"Kiosk app".

## See also

- Main web app: `../src` (Next.js, Prisma, Postgres)
- Schema: `../prisma/schema.prisma` (new models: `FingerprintEnrollment`, `PunchEvent`, `KioskDevice`, `GroomingFlag`)
- Sibling subproject convention: `../opsy-timer` (Azure Functions timers)
