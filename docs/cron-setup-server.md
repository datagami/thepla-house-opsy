# Weekly Off Cron Job - Server Setup Guide

This guide explains how to set up the weekly off cron job on your self-hosted server running in IST timezone.

## Overview

The cron job automatically flags users with fixed weekly off days by calling the API endpoint `/api/cron/weekly-off`. It processes the entire current week and creates attendance records for employees whose weekly off day falls within that week.

## Prerequisites

- Next.js app running on the server (port 8080 by default)
- Access to server's crontab
- `curl` command available
- `jq` command (optional, for better JSON parsing in logs)

## Step 1: Generate CRON_SECRET

The CRON_SECRET is a password that protects your cron API endpoint from unauthorized access.

### Option 1: Use the provided script

```bash
cd /path/to/opsy
npx tsx scripts/generate-cron-secret.ts
```

This will output a secure random string. Copy it.

### Option 2: Generate manually

```bash
openssl rand -base64 32
```

### Option 3: Use any secure random string

You can use any long, random string as your CRON_SECRET.

## Step 2: Configure CRON_SECRET

You need to set CRON_SECRET in **two places** with the **same value**:

### 2.1. In Your Next.js App Environment

Add `CRON_SECRET` to wherever your Next.js app reads environment variables:

**If using `.env` file:**
```bash
# Add to .env or .env.production
CRON_SECRET=your_generated_secret_here
```

**If using systemd service:**
```ini
# In your systemd service file (e.g., /etc/systemd/system/opsy.service)
[Service]
Environment="CRON_SECRET=your_generated_secret_here"
```

**If using PM2:**
```bash
# In ecosystem.config.js or via command
pm2 set CRON_SECRET "your_generated_secret_here"
```

### 2.2. In Your Cron Environment

The cron script needs access to CRON_SECRET. You can set it in the crontab entry itself:

```bash
# In crontab, set it before the command
CRON_SECRET=your_generated_secret_here */5 * * * * /path/to/script.sh
```

Or export it in the script itself (less secure, but works).

## Step 3: Configure the Cron Script

### 3.1. Make Script Executable

```bash
chmod +x /path/to/opsy/scripts/cron-weekly-off.sh
```

### 3.2. Test the Script Manually

Before adding to crontab, test it manually:

```bash
# Set CRON_SECRET in your current shell
export CRON_SECRET="your_generated_secret_here"

# Set API_URL if your app runs on a different URL
export API_URL="http://localhost:8080/api/cron/weekly-off"

# Run the script
/path/to/opsy/scripts/cron-weekly-off.sh
```

Check the output and log file to ensure it works correctly.

## Step 4: Add to Crontab

### 4.1. Open Crontab

```bash
crontab -e
```

### 4.2. Add Cron Entry

**For Testing (Every 5 Minutes):**
```bash
# Weekly Off Cron Job - Runs every 5 minutes for testing
*/5 * * * * TZ=Asia/Kolkata CRON_SECRET=your_generated_secret_here /path/to/opsy/scripts/cron-weekly-off.sh >> /var/log/opsy-weekly-off-cron.log 2>&1
```

**For Production (Daily at 1:00 AM IST):**
```bash
# Weekly Off Cron Job - Runs daily at 1:00 AM IST
0 1 * * * TZ=Asia/Kolkata CRON_SECRET=your_generated_secret_here /path/to/opsy/scripts/cron-weekly-off.sh >> /var/log/opsy-weekly-off-cron.log 2>&1
```

**For Production (Twice Daily - 1:00 AM and 1:00 PM IST):**
```bash
# Weekly Off Cron Job - Runs twice daily
0 1,13 * * * TZ=Asia/Kolkata CRON_SECRET=your_generated_secret_here /path/to/opsy/scripts/cron-weekly-off.sh >> /var/log/opsy-weekly-off-cron.log 2>&1
```

### 4.3. Cron Schedule Explanation

```
┌───────────── minute (0 - 59)
│ ┌───────────── hour (0 - 23)
│ │ ┌───────────── day of month (1 - 31)
│ │ │ ┌───────────── month (1 - 12)
│ │ │ │ ┌───────────── day of week (0 - 6) (Sunday to Saturday)
│ │ │ │ │
* * * * *
```

Examples:
- `*/5 * * * *` - Every 5 minutes
- `0 1 * * *` - Daily at 1:00 AM
- `0 1,13 * * *` - Daily at 1:00 AM and 1:00 PM

### 4.4. Important Notes

1. **Replace `/path/to/opsy`** with the actual path to your project
2. **Replace `your_generated_secret_here`** with your actual CRON_SECRET
3. **TZ=Asia/Kolkata** ensures the cron runs in IST timezone
4. **Log file location**: The script logs to `/var/log/opsy-weekly-off-cron.log` by default. Make sure this directory exists and is writable:
   ```bash
   sudo mkdir -p /var/log
   sudo chmod 755 /var/log
   ```

## Step 5: Verify Setup

### 5.1. Check Cron is Running

```bash
# List your cron jobs
crontab -l

# Check cron service status (on systemd systems)
systemctl status cron
# or
systemctl status crond
```

### 5.2. Monitor Logs

```bash
# Watch the log file in real-time
tail -f /var/log/opsy-weekly-off-cron.log

# Or check recent entries
tail -n 50 /var/log/opsy-weekly-off-cron.log
```

### 5.3. Test with a Test Employee

1. Create or update an employee with:
   - `hasWeeklyOff: true`
   - `weeklyOffType: "FIXED"`
   - `weeklyOffDay: 6` (Saturday, where 0=Sunday, 6=Saturday)

2. Wait for the cron job to run (or trigger it manually)

3. Check the attendance records to verify the weekly off was created

## Step 6: Troubleshooting

### Issue: "CRON_SECRET environment variable is not set"

**Solution:** Make sure CRON_SECRET is set in the crontab entry:
```bash
CRON_SECRET=your_secret */5 * * * * /path/to/script.sh
```

### Issue: "401 Unauthorized"

**Solution:** 
1. Verify CRON_SECRET in crontab matches the one in your Next.js app
2. Check that there are no extra spaces or quotes
3. Test manually: `curl -H "Authorization: Bearer YOUR_SECRET" http://localhost:8080/api/cron/weekly-off`

### Issue: "Connection refused" or "Failed to connect"

**Solution:**
1. Verify your Next.js app is running: `curl http://localhost:8080`
2. Check if the app is on a different port and update `API_URL` in the script
3. If app is behind a reverse proxy, use the full URL

### Issue: No logs appearing

**Solution:**
1. Check if log directory exists: `ls -la /var/log/`
2. Check file permissions: `ls -la /var/log/opsy-weekly-off-cron.log`
3. Try running script manually to see if it creates logs
4. Check cron service logs: `journalctl -u cron` or `grep CRON /var/log/syslog`

### Issue: Script runs but no attendance records created

**Solution:**
1. Check if any employees have `hasWeeklyOff: true` and `weeklyOffType: "FIXED"`
2. Verify the `weeklyOffDay` matches the current day of week
3. Check the API response in logs for error messages
4. Verify employees have `branchId` set (required for attendance creation)

## Monitoring

### View Recent Logs

```bash
# Last 100 lines
tail -n 100 /var/log/opsy-weekly-off-cron.log

# Search for errors
grep ERROR /var/log/opsy-weekly-off-cron.log

# Search for successful runs
grep "SUCCESS" /var/log/opsy-weekly-off-cron.log
```

### Set Up Log Rotation

To prevent log files from growing too large, set up log rotation:

Create `/etc/logrotate.d/opsy-weekly-off-cron`:
```
/var/log/opsy-weekly-off-cron.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 0644 root root
}
```

## Security Best Practices

1. **Keep CRON_SECRET secure**: Never commit it to version control
2. **Use strong secrets**: Generate a long, random string (32+ characters)
3. **Restrict log file permissions**: `chmod 640 /var/log/opsy-weekly-off-cron.log`
4. **Monitor logs regularly**: Check for unauthorized access attempts
5. **Use HTTPS in production**: If calling external URL, ensure it uses HTTPS

## Switching from Testing to Production

Once you've verified the cron job works correctly with the 5-minute schedule:

1. Edit crontab: `crontab -e`
2. Change the schedule from `*/5 * * * *` to `0 1 * * *` (daily at 1 AM) or `0 1,13 * * *` (twice daily)
3. Save and exit
4. Monitor logs to ensure it continues working

## Manual Testing

You can manually trigger the cron job for testing:

```bash
# Set environment variables
export CRON_SECRET="your_secret_here"
export API_URL="http://localhost:8080/api/cron/weekly-off"

# Run the script
/path/to/opsy/scripts/cron-weekly-off.sh

# Or use curl directly
curl -H "Authorization: Bearer YOUR_SECRET" http://localhost:8080/api/cron/weekly-off
```

## Support

If you encounter issues:
1. Check the log file: `/var/log/opsy-weekly-off-cron.log`
2. Check Next.js app logs for API endpoint errors
3. Verify database connectivity
4. Test the API endpoint manually with curl
