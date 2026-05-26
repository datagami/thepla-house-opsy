# Kiosk Endpoint Smoke — Phase 1+2

End-to-end manual smoke for the kiosk backend. Run before opening the PR and after every backend change.

## Prerequisites

- `next dev` is running on `http://localhost:3000`
- You are signed in to opsy as an `HR` or `MANAGEMENT` user in a browser; copy the session cookie if needed for device provisioning
- Postgres is healthy and `npm run seed:shifts` has been run
- `.env` has `AZURE_AI_FOUNDRY_*` set (the grooming endpoint will reject without them — that's fine, you'll see `ERROR` verdicts but the punch still records)
- Have two small JPEGs ready: `uniform.jpg` (≤512KB) and `nails.jpg` (≤512KB)

## Variables

Replace `<BRANCH_A_ID>` and `<BRANCH_B_ID>` with two real Branch IDs (different outlets). `<USER_ID>` is an `ACTIVE` employee currently assigned to `<BRANCH_A_ID>`.

```bash
BASE=http://localhost:3000
BRANCH_A=<BRANCH_A_ID>
BRANCH_B=<BRANCH_B_ID>
USER_ID=<USER_ID>
```

## 1. Provision a kiosk device

Uses your NextAuth session — easiest from the browser DevTools console:

```js
await fetch('/api/kiosk/devices', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'Smoke Kiosk', branchId: '<BRANCH_A_ID>' })
}).then(r => r.json())
```

**Expected:** `201` with `{ device: { id, ... }, token: "<RAW_TOKEN_ONCE>", warning }`. **Copy the token** — you can't retrieve it again.

```bash
DEVICE_ID=<from response>
TOKEN=<from response>
```

## 2. Handshake

```bash
curl -s "$BASE/api/kiosk/handshake" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Kiosk-Device-Id: $DEVICE_ID" | jq
```

**Expected:** `{ device: { id, branchId }, branch: { id, name }, serverTime }`. A bad token returns 401.

## 3. Shifts list

```bash
curl -s "$BASE/api/kiosk/shifts" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Kiosk-Device-Id: $DEVICE_ID" | jq
```

**Expected:** three shifts (Full Day / Break One / Mid-Night). "Break One" has two segments.

## 4. Enroll a fingerprint (any base64 stand-in for the smoke)

```bash
curl -s -X POST "$BASE/api/kiosk/fingerprints/enroll" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Kiosk-Device-Id: $DEVICE_ID" \
  -H "Content-Type: application/json" \
  -d "{\"userId\":\"$USER_ID\",\"fingerIndex\":1,\"templateData\":\"VEVTVF9URU1QTEFURQ==\"}" | jq
```

**Expected:** `201 { enrollment: { id, userId, fingerIndex: 1, isActive: true, updatedAt } }`.

## 5. Sync — full reconcile

```bash
curl -s "$BASE/api/kiosk/fingerprints" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Kiosk-Device-Id: $DEVICE_ID" | jq '.enrollments | length, .serverTime'
```

**Expected:** count ≥ 1; `serverTime` is current. Each enrollment carries `branchId` (the owner's current outlet).

## 6. Sync — delta (should return at least the enrollment we just made)

```bash
curl -s "$BASE/api/kiosk/fingerprints?updatedSince=2020-01-01T00:00:00Z" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Kiosk-Device-Id: $DEVICE_ID" | jq '.enrollments | length'
```

**Expected:** ≥ 1.

## 7. Punch at the **wrong** outlet → 403 + BLOCKED_WRONG_OUTLET PunchEvent + no Attendance

First, **move the user to Branch B in the web app** (so their `branchId` ≠ this kiosk's branch):

```bash
# In a separate shell, via your existing employee-edit endpoint or directly in Prisma Studio:
npx prisma studio
# → users1 table → set branchId of <USER_ID> to <BRANCH_B_ID>
```

Grab a shift ID for the punch:

```bash
SHIFT_ID=$(curl -s "$BASE/api/kiosk/shifts" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Kiosk-Device-Id: $DEVICE_ID" | jq -r '.shifts[0].id')
echo "Using shift: $SHIFT_ID"
```

Now punch (build the JSON with base64-encoded JPEGs):

```bash
UNIFORM_B64=$(base64 -i uniform.jpg | tr -d '\n')
NAILS_B64=$(base64 -i nails.jpg | tr -d '\n')

cat > /tmp/punch-wrong.json <<EOF
{
  "userId": "$USER_ID",
  "shiftId": "$SHIFT_ID",
  "direction": "IN",
  "punchedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "uniformPhoto": "$UNIFORM_B64",
  "nailsPhoto": "$NAILS_B64"
}
EOF

curl -s -X POST "$BASE/api/kiosk/punch" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Kiosk-Device-Id: $DEVICE_ID" \
  -H "Content-Type: application/json" \
  --data-binary @/tmp/punch-wrong.json -w "\nHTTP %{http_code}\n" | jq
```

**Expected:** `HTTP 403`, body: `{ blocked: true, reason: "WRONG_OUTLET", assignedBranch: { id: "<BRANCH_B>", name }, punchEventId }`.

Verify in DB:

```bash
npx tsx -e "import { prisma } from './src/lib/prisma'; (async () => {
  const pe = await prisma.punchEvent.findMany({ where: { outcome: 'BLOCKED_WRONG_OUTLET' }, orderBy: { createdAt: 'desc' }, take: 1 });
  console.log('PunchEvent:', pe);
  const att = await prisma.attendance.findMany({ where: { userId: '$USER_ID' }, orderBy: { createdAt: 'desc' }, take: 1 });
  console.log('Attendance:', att);
  await prisma.\$disconnect();
})()"
```

**Expected:** one `BLOCKED_WRONG_OUTLET` PunchEvent with `attendanceId: null`, `uniformPhotoUrl: null`. NO Attendance row created by this punch.

## 8. Move the user back to Branch A → punch succeeds

Move user back via Prisma Studio (`branchId = <BRANCH_A_ID>`), then re-run the punch curl above.

**Expected:** `HTTP 200`, body has `punchEventId`, `attendanceId`, `grooming`, `overallGroomingPass`.

Verify:

```bash
npx tsx -e "import { prisma } from './src/lib/prisma'; (async () => {
  const att = await prisma.attendance.findFirst({ where: { userId: '$USER_ID' }, orderBy: { date: 'desc' } });
  console.log('Latest Attendance:', att);
  await prisma.\$disconnect();
})()"
```

**Expected:** `isPresent: true`, `checkIn` is an `HH:mm` IST string, `branchId == <BRANCH_A_ID>`, `status: 'PENDING_VERIFICATION'`.

## 9. Punch OUT same user same day → checkOut set on the same Attendance row

Re-run the punch curl with `direction: "OUT"`.

**Expected:** same `attendanceId` as the IN punch, `checkOut` populated, no second Attendance row.

## 10. HR can still verify/edit the kiosk-created Attendance

In the existing HR UI, open the attendance row from step 8/9. Verify and approve. Confirm the existing flow works unchanged.

## 11. Cleanup

```bash
npx tsx -e "import { prisma } from './src/lib/prisma'; (async () => {
  await prisma.kioskDevice.update({ where: { id: '$DEVICE_ID' }, data: { isActive: false } });
  await prisma.\$disconnect();
})()"
```
