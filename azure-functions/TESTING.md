# Testing Guide - Azure Function Weekly Off Timer

This guide covers all testing scenarios for the Azure Function timer trigger.

## Pre-Testing Checklist

- [ ] Function App created in Azure
- [ ] Function deployed successfully
- [ ] CRON_SECRET configured in Function App settings
- [ ] API_URL configured (or using default)
- [ ] Next.js App Service is running
- [ ] CRON_SECRET matches in both Function App and App Service

## Test 1: Manual Function Execution

### Via Azure Portal

1. **Navigate to Function**
   - Go to Azure Portal → Your Function App
   - Click **Functions** → `weekly-off-timer`

2. **Execute Function**
   - Click **Code + Test** tab
   - Click **Test/Run** tab
   - Click **Run** button
   - Wait for execution to complete

3. **Check Results**
   - View **Output** tab for logs
   - Verify success message
   - Check for user details in logs

### Expected Output

```
============================================================
Weekly Off Cron Job - Azure Function Started
============================================================
UTC Timestamp: 2026-01-24T19:30:00.000Z
IST Timestamp: 2026-01-25T01:00:00+05:30
API URL: https://opsy.theplahouse.com/api/cron/weekly-off
Making API request...
HTTP Status Code: 200
============================================================
SUCCESS: Weekly off cron job completed successfully
============================================================
Records Created/Updated: 2
Total Processed: 2
Users Marked as Weekly Off:
  1. John Doe (john@example.com)
     - Day: Saturday
     - Action: created
============================================================
```

## Test 2: Verify API Endpoint Response

### Test API Directly

```bash
# Test from local machine or Azure Cloud Shell
curl -X GET \
  -H "Authorization: Bearer xTAE+YsAf+gFq1UxYUe4ciLA5RIi0S/FetNS+hgZgQs=" \
  -H "Content-Type: application/json" \
  https://opsy.theplahouse.com/api/cron/weekly-off
```

### Expected Response

```json
{
  "success": true,
  "message": "Successfully processed weekly off attendance",
  "recordsCreated": 2,
  "totalProcessed": 2,
  "duration": "1234ms",
  "timestamp": "2026-01-24T19:30:00.000Z",
  "istTime": "1/25/2026, 1:00:00 AM",
  "dayOfWeek": "Saturday",
  "weekRange": {
    "start": "2026-01-19T00:00:00.000Z",
    "end": "2026-01-25T23:59:59.999Z"
  },
  "users": [
    {
      "userId": "user-id-1",
      "userName": "John Doe",
      "userEmail": "john@example.com",
      "date": "2026-01-25T00:00:00.000Z",
      "dayName": "Saturday",
      "action": "created",
      "attendanceId": "attendance-id-1"
    }
  ]
}
```

## Test 3: Check Function Logs

### Via Azure Portal

1. Go to Function App → Functions → `weekly-off-timer`
2. Click **Monitor** tab
3. View execution history
4. Click on an execution to see detailed logs

### Via Log Stream

1. Go to Function App → **Log stream**
2. View real-time logs
3. Trigger function manually to see logs

### Via Application Insights (if enabled)

1. Go to Function App → **Application Insights**
2. Click **Logs**
3. Query execution logs:
   ```kusto
   traces
   | where message contains "Weekly Off Cron Job"
   | order by timestamp desc
   ```

## Test 4: Verify Database Changes

### Check Attendance Records

After function execution, verify in database:

```sql
-- Check for newly created weekly off records
SELECT 
  a.id,
  u.name as user_name,
  u.email,
  a.date,
  a.is_weekly_off,
  a.is_present,
  a.status
FROM attendances a
JOIN users u ON a.user_id = u.id
WHERE a.is_weekly_off = true
  AND a.date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY a.date DESC, u.name;
```

### Expected Results

- Records have `is_weekly_off = true`
- Records have `is_present = true`
- Records have `status = 'APPROVED'`
- Dates match the weekly off days for users

## Test 5: Test Error Scenarios

### Test 1: Invalid CRON_SECRET

1. Temporarily change CRON_SECRET in Function App settings to wrong value
2. Run function manually
3. Verify error: `401 UNAUTHORIZED`
4. Restore correct CRON_SECRET

### Test 2: API Endpoint Unavailable

1. Temporarily set API_URL to invalid URL
2. Run function manually
3. Verify connection error is logged
4. Restore correct API_URL

### Test 3: Timeout Scenario

1. If API takes too long, verify timeout handling
2. Check function logs for timeout errors
3. Verify retry logic (if configured)

## Test 6: Scheduled Execution Test

### Adjust Schedule for Testing

1. Edit `function.json` schedule to run in 5 minutes:
   ```json
   "schedule": "0 */5 * * * *"  // Every 5 minutes
   ```

2. Redeploy function

3. Wait and monitor execution

4. Restore original schedule after testing:
   ```json
   "schedule": "0 30 19 * * *"  // 1:00 AM IST daily
   ```

## Test 7: Verify Timezone Handling

### Check IST Time Conversion

1. Function runs at 7:30 PM UTC
2. Verify logs show correct IST timestamp (1:00 AM next day)
3. Verify API receives request at correct time
4. Check database records have correct dates in IST

## Test 8: Monitor Multiple Executions

### Track Over Time

1. Let function run for a few days
2. Monitor execution history
3. Verify consistent success
4. Check for any patterns in failures
5. Review performance metrics

## Test 9: Load and Performance

### Verify Performance

1. Check function execution duration (should be < 30 seconds)
2. Verify API response time
3. Check for any timeout issues
4. Monitor memory usage

## Test 10: Integration Test

### End-to-End Verification

1. **Setup Test Employee**
   - Create employee with Saturday as weekly off
   - Verify configuration: `hasWeeklyOff: true`, `weeklyOffType: "FIXED"`, `weeklyOffDay: 6`

2. **Run Function**
   - Execute function manually or wait for schedule

3. **Verify Results**
   - Check function logs show success
   - Check API logs show request received
   - Check database has attendance record
   - Verify attendance has correct flags

4. **Cleanup**
   - Remove test data if needed

## Common Issues and Solutions

### Issue: Function Not Running

**Solution:**
- Check function is enabled
- Verify timer schedule is correct
- Check Application settings are saved
- Review Activity log for errors

### Issue: Authentication Failed (401)

**Solution:**
- Verify CRON_SECRET matches exactly in both places
- Check for extra spaces or quotes
- Test API endpoint manually with curl
- Verify App Service has CRON_SECRET set

### Issue: Connection Timeout

**Solution:**
- Check API endpoint is accessible
- Verify network connectivity
- Increase function timeout in host.json
- Check Next.js app is running

### Issue: No Users Processed

**Solution:**
- Verify employees have `hasWeeklyOff: true`
- Check `weeklyOffType: "FIXED"`
- Verify `weeklyOffDay` matches current day
- Check employees have `branchId` set

### Issue: Import Errors

**Solution:**
- Verify requirements.txt dependencies installed
- Check Python version is 3.11
- Review function logs for specific errors
- Reinstall dependencies if needed

## Success Criteria

✅ Function executes successfully  
✅ HTTP 200 response from API  
✅ Authentication works correctly  
✅ Users are marked as weekly off  
✅ Database records created/updated  
✅ Logs show detailed information  
✅ No errors in execution history  
✅ Consistent execution over time  

## Next Steps After Testing

1. Monitor first scheduled execution
2. Set up alerts for failures
3. Review logs weekly
4. Adjust schedule if needed
5. Document any custom configurations
