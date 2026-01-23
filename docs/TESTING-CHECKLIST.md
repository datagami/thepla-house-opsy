# Weekly Off Cron Job - Testing Checklist

Use this checklist to verify that the weekly off cron job is working correctly.

## Pre-Testing Setup

- [ ] **CRON_SECRET Generated**
  ```bash
  npx tsx scripts/generate-cron-secret.ts
  ```
  - [ ] Secret copied and saved securely

- [ ] **CRON_SECRET Added to Environment**
  - [ ] Added to `.env` or `.env.production` file
  - [ ] Next.js app restarted to load the new environment variable
  - [ ] Verified: `echo $CRON_SECRET` (if testing manually)

- [ ] **Cron Script is Executable**
  ```bash
  chmod +x scripts/cron-weekly-off.sh
  ls -la scripts/cron-weekly-off.sh
  ```
  - [ ] Script has execute permissions

- [ ] **Test Employee Configured**
  - [ ] Employee exists in database
  - [ ] Employee has `hasWeeklyOff: true`
  - [ ] Employee has `weeklyOffType: "FIXED"`
  - [ ] Employee has `weeklyOffDay: 6` (Saturday)
  - [ ] Employee has `branchId` set (required)
  - [ ] Employee status is `ACTIVE`

  **Verify with:**
  ```bash
  npx tsx scripts/verify-test-employee.ts <employee-email>
  ```

## Testing the Script Manually

- [ ] **Test Script Execution**
  ```bash
  export CRON_SECRET="your_secret_here"
  ./scripts/cron-weekly-off.sh
  ```
  - [ ] Script runs without errors
  - [ ] Script displays all parameters correctly
  - [ ] Script shows HTTP 200 response
  - [ ] Script logs to `/var/log/opsy-weekly-off-cron.log`

- [ ] **Test API Endpoint Directly**
  ```bash
  curl -H "Authorization: Bearer YOUR_SECRET" http://localhost:8080/api/cron/weekly-off
  ```
  - [ ] Returns HTTP 200
  - [ ] Response includes `success: true`
  - [ ] Response includes `recordsCreated` count
  - [ ] Next.js console shows detailed logs

- [ ] **Check Logs**
  ```bash
  tail -n 50 /var/log/opsy-weekly-off-cron.log
  ```
  - [ ] Log file exists
  - [ ] Logs show successful execution
  - [ ] Logs show all parameters
  - [ ] Logs show HTTP response code 200

## Testing with Crontab

- [ ] **Added to Crontab**
  ```bash
  crontab -e
  ```
  - [ ] Added entry: `*/5 * * * * TZ=Asia/Kolkata CRON_SECRET=... /path/to/script.sh >> /var/log/opsy-weekly-off-cron.log 2>&1`
  - [ ] Full path to script is correct
  - [ ] CRON_SECRET is set in crontab entry

- [ ] **Verify Crontab Entry**
  ```bash
  crontab -l
  ```
  - [ ] Entry is listed correctly

- [ ] **Wait for Cron Execution**
  - [ ] Wait at least 5 minutes (or trigger manually)
  - [ ] Check log file for new entries
  - [ ] Verify execution happened at expected time

- [ ] **Monitor Logs in Real-Time**
  ```bash
  tail -f /var/log/opsy-weekly-off-cron.log
  ```
  - [ ] See new log entries every 5 minutes
  - [ ] All entries show success (HTTP 200)
  - [ ] No authentication errors (401)
  - [ ] No server errors (500)

## Verify Database Changes

- [ ] **Check Attendance Records Created**
  ```sql
  -- Check for attendance records with isWeeklyOff = true
  SELECT * FROM attendances 
  WHERE is_weekly_off = true 
  AND date >= CURRENT_DATE - INTERVAL '7 days'
  ORDER BY date DESC;
  ```
  - [ ] Records exist for test employee
  - [ ] Records have `isWeeklyOff: true`
  - [ ] Records have `isPresent: true`
  - [ ] Records have `status: 'APPROVED'`
  - [ ] Records are for the correct date (Saturday)

- [ ] **Verify Test Employee's Attendance**
  ```bash
  npx tsx scripts/verify-test-employee.ts <employee-email>
  ```
  - [ ] Script shows attendance record exists
  - [ ] Attendance record is correctly configured

## Verify API Logs

- [ ] **Check Next.js Application Logs**
  - [ ] Console shows "Weekly Off Cron Job - Request Received"
  - [ ] Console shows authentication success
  - [ ] Console shows "SUCCESS" message
  - [ ] Console shows records created count
  - [ ] Console shows execution duration

## Edge Cases Testing

- [ ] **Test with Multiple Employees**
  - [ ] Configure multiple employees with different weekly off days
  - [ ] Verify all get processed correctly

- [ ] **Test with Existing Attendance**
  - [ ] Create manual attendance for Saturday
  - [ ] Run cron job
  - [ ] Verify existing attendance is updated (not duplicated)

- [ ] **Test Timezone Handling**
  - [ ] Verify cron runs at correct IST time
  - [ ] Verify dates are calculated correctly for IST

## Production Readiness

- [ ] **Switch to Production Schedule**
  - [ ] Change crontab from `*/5 * * * *` to `0 1 * * *` (daily at 1 AM)
  - [ ] Or use `0 1,13 * * *` (twice daily)
  - [ ] Verify schedule is correct

- [ ] **Set Up Log Rotation**
  - [ ] Configure logrotate if needed
  - [ ] Ensure logs don't grow indefinitely

- [ ] **Monitor for First Production Run**
  - [ ] Check logs after first production run
  - [ ] Verify no errors occurred
  - [ ] Verify attendance records created correctly

## Troubleshooting

If any step fails:

1. **Check Logs**
   - `/var/log/opsy-weekly-off-cron.log` - Script logs
   - Next.js application console - API endpoint logs

2. **Verify Configuration**
   - CRON_SECRET matches in both places
   - Script path is correct
   - API URL is accessible

3. **Test Components Individually**
   - Test API endpoint with curl
   - Test script manually
   - Verify employee configuration

4. **Common Issues**
   - 401 Unauthorized → CRON_SECRET mismatch
   - Connection refused → App not running
   - No records created → Check employee configuration
   - Permission denied → Check script permissions

## Success Criteria

✅ All checklist items completed
✅ Cron job runs successfully every 5 minutes
✅ Logs show successful execution
✅ Attendance records created correctly
✅ Test employee has Saturday attendance marked as weekly off
✅ Ready to switch to production schedule

---

**Next Steps After Testing:**
1. Switch crontab to production schedule (daily or twice daily)
2. Remove test employee configuration if needed
3. Monitor logs regularly
4. Set up alerts for failures (optional)
