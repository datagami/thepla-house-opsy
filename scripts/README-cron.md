# Quick Start: Weekly Off Cron Job

## Quick Setup (5 Minutes)

### 1. Generate CRON_SECRET
```bash
npx tsx scripts/generate-cron-secret.ts
# Copy the generated secret
```

### 2. Add to Your .env File
```bash
# Add to .env or .env.production
CRON_SECRET=your_generated_secret_here
```

### 3. Test the Script Manually
```bash
export CRON_SECRET="your_generated_secret_here"
./scripts/cron-weekly-off.sh
```

### 4. Add to Crontab (Every 5 Minutes for Testing)
```bash
crontab -e
```

Add this line:
```bash
*/5 * * * * TZ=Asia/Kolkata CRON_SECRET=your_generated_secret_here /full/path/to/opsy/scripts/cron-weekly-off.sh >> /var/log/opsy-weekly-off-cron.log 2>&1
```

### 5. Monitor Logs
```bash
tail -f /var/log/opsy-weekly-off-cron.log
```

## Switch to Production Schedule

Once testing is complete, change the schedule in crontab:

**Daily at 1:00 AM IST:**
```bash
0 1 * * * TZ=Asia/Kolkata CRON_SECRET=your_generated_secret_here /full/path/to/opsy/scripts/cron-weekly-off.sh >> /var/log/opsy-weekly-off-cron.log 2>&1
```

**Twice Daily (1:00 AM and 1:00 PM IST):**
```bash
0 1,13 * * * TZ=Asia/Kolkata CRON_SECRET=your_generated_secret_here /full/path/to/opsy/scripts/cron-weekly-off.sh >> /var/log/opsy-weekly-off-cron.log 2>&1
```

## Test Employee Setup

To test with an employee who has Saturday as weekly off:

1. Update employee in database or UI:
   - `hasWeeklyOff: true`
   - `weeklyOffType: "FIXED"`
   - `weeklyOffDay: 6` (Saturday)

2. Wait for cron to run (or trigger manually)

3. Check attendance records for that employee on Saturday

## Troubleshooting

- **Script not executable?** Run: `chmod +x scripts/cron-weekly-off.sh`
- **401 Unauthorized?** Check CRON_SECRET matches in both .env and crontab
- **No logs?** Check `/var/log/` directory exists and is writable
- **Connection refused?** Verify Next.js app is running on port 8080

For detailed documentation, see: `docs/cron-setup-server.md`
