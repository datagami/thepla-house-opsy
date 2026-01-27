# Azure Function - Weekly Off Timer Trigger

This Azure Function automatically calls the weekly off cron API endpoint daily at 1:00 AM IST to flag users with fixed weekly off days.

## Overview

- **Function Name**: `weekly-off-timer`
- **Trigger Type**: Timer Trigger
- **Schedule**: Daily at 1:00 AM IST (7:30 PM UTC)
- **Runtime**: Python 3.11
- **Purpose**: Calls the Next.js API endpoint `/api/cron/weekly-off` with authentication

## Architecture

```
Azure Function App (Timer Trigger)
    ↓ (Daily at 1:00 AM IST = 7:30 PM UTC)
HTTP GET Request with CRON_SECRET
    ↓
Next.js API: https://opsy.theplahouse.com/api/cron/weekly-off
    ↓
Weekly Off Service
    ↓
Database (Attendance Records)
```

## Prerequisites

1. Azure account with Function App creation permissions
2. Azure Functions Core Tools (optional, for local development)
3. Python 3.11+ (for local testing)
4. CRON_SECRET value (same as in Next.js App Service)

## Local Development Setup

### 1. Install Dependencies

```bash
cd azure-functions
pip install -r requirements.txt
```

### 2. Configure Local Settings

Copy the example settings file:

```bash
cp local.settings.json.example local.settings.json
```

Edit `local.settings.json` and set:
- `CRON_SECRET`: Your CRON_SECRET value
- `API_URL`: Your API endpoint URL (default: https://opsy.theplahouse.com/api/cron/weekly-off)

**Note**: `local.settings.json` is in `.funcignore` and should not be committed to git.

### 3. Run Locally

```bash
# Install Azure Functions Core Tools first
# npm install -g azure-functions-core-tools@4

# Run the function locally
func start
```

The function will trigger based on the schedule, or you can test it manually.

## Deployment to Azure

### Method 1: Azure Portal (Easiest)

1. **Create Function App**
   - Go to Azure Portal → Create a resource
   - Search for "Function App"
   - Create with:
     - Runtime stack: Python
     - Version: 3.11
     - Plan: Consumption (Serverless)
     - Region: Same as your App Service (Central India)

2. **Deploy Function Code**
   - Go to your Function App → Functions
   - Click "Create" → "Timer trigger"
   - Name: `weekly-off-timer`
   - Schedule: `0 30 19 * * *` (7:30 PM UTC = 1:00 AM IST)
   - Copy the code from `weekly-off-timer/__init__.py`

3. **Configure Application Settings**
   - Go to Configuration → Application settings
   - Add:
     - `CRON_SECRET`: Your CRON_SECRET value
     - `API_URL`: `https://opsy.theplahouse.com/api/cron/weekly-off` (optional, has default)

4. **Install Dependencies**
   - Go to Deployment Center → Settings
   - Or use Kudu Console to install: `pip install -r requirements.txt`

### Method 2: Azure Functions Core Tools

```bash
# Install Azure Functions Core Tools
npm install -g azure-functions-core-tools@4

# Login to Azure
az login

# Create Function App (if not exists)
az functionapp create \
  --resource-group <your-resource-group> \
  --consumption-plan-location centralindia \
  --runtime python \
  --runtime-version 3.11 \
  --functions-version 4 \
  --name <function-app-name> \
  --storage-account <storage-account-name>

# Deploy function
cd azure-functions
func azure functionapp publish <function-app-name>
```

### Method 3: VS Code Azure Functions Extension

1. Install "Azure Functions" extension in VS Code
2. Open the `azure-functions` folder
3. Click "Deploy to Function App"
4. Follow the prompts

### Method 4: GitHub Actions / CI/CD

Create `.github/workflows/deploy-function.yml`:

```yaml
name: Deploy Azure Function

on:
  push:
    branches: [main]
    paths:
      - 'azure-functions/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      
      - name: Install dependencies
        run: |
          cd azure-functions
          pip install -r requirements.txt
      
      - name: Deploy to Azure Functions
        uses: Azure/functions-action@v1
        with:
          app-name: <your-function-app-name>
          package: './azure-functions'
          publish-profile: ${{ secrets.AZURE_FUNCTIONAPP_PUBLISH_PROFILE }}
```

## Configuration

### Environment Variables

Set these in Azure Function App → Configuration → Application settings:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `CRON_SECRET` | Yes | - | Authentication secret (same as in Next.js app) |
| `API_URL` | No | `https://opsy.theplahouse.com/api/cron/weekly-off` | API endpoint URL |

### Timer Schedule

The function uses NCRONTAB format: `0 30 19 * * *`

- **UTC Time**: 7:30 PM (19:30)
- **IST Time**: 1:00 AM next day (IST is UTC+5:30)
- **Frequency**: Daily

To change the schedule, edit `weekly-off-timer/function.json`:
- Format: `{second} {minute} {hour} {day} {month} {day-of-week}`
- Example: `0 0 1 * * *` = 1:00 AM UTC daily

## Monitoring

### View Logs

1. **Azure Portal**
   - Function App → Functions → `weekly-off-timer` → Monitor
   - View execution history and logs

2. **Application Insights** (if enabled)
   - Function App → Application Insights
   - View detailed telemetry and logs

3. **Log Stream**
   - Function App → Log stream
   - Real-time log viewing

### Check Execution Status

- Go to Function App → Functions → `weekly-off-timer` → Monitor
- View recent executions, success/failure status, and duration

## Testing

### Test Manually via Azure Portal

1. Go to Function App → Functions → `weekly-off-timer`
2. Click "Test/Run"
3. Click "Run" to execute immediately
4. Check logs for results

### Test Locally

```bash
# Start function locally
func start

# In another terminal, trigger manually
curl -X POST http://localhost:7071/admin/functions/weekly-off-timer
```

### Test API Endpoint Directly

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
     https://opsy.theplahouse.com/api/cron/weekly-off
```

## Troubleshooting

### Function Not Running

1. Check timer schedule is correct
2. Verify Function App is running (not stopped)
3. Check Application Insights for errors

### Authentication Errors (401)

1. Verify `CRON_SECRET` matches in both:
   - Azure Function App settings
   - Next.js App Service settings
2. Check for extra spaces or quotes in the secret

### Connection Errors

1. Verify API URL is correct and accessible
2. Check network connectivity from Function App
3. Verify SSL certificate is valid

### Timeout Errors

1. Increase function timeout in `host.json`
2. Check if API endpoint is responding
3. Review Next.js app logs for slow queries

## Cost

- **Consumption Plan**: Pay per execution
- **Free Tier**: 1 million executions/month free
- **Estimated Cost**: ~$0 for daily execution (30 executions/month)

## Security

- CRON_SECRET stored in Azure Key Vault (recommended) or App Settings (encrypted)
- HTTPS communication to API endpoint
- Function authentication can be enabled for additional security
- Network isolation available with VNet integration

## Schedule Details

- **IST Time**: 1:00 AM daily
- **UTC Time**: 7:30 PM (previous day)
- **NCRONTAB**: `0 30 19 * * *`
- **Timezone Handling**: Function runs in UTC, schedule adjusted for IST

## Support

For issues:
1. Check Azure Function App logs
2. Check Next.js API endpoint logs
3. Verify environment variables are set correctly
4. Test API endpoint manually with curl
