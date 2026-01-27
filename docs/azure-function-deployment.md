# Azure Function Deployment Guide - Weekly Off Timer

Complete step-by-step guide for deploying the Azure Function timer trigger for the weekly off cron job.

## Prerequisites

- Azure account with appropriate permissions
- Azure CLI installed (optional but recommended)
- CRON_SECRET value (same as in Next.js App Service)
- Access to Azure Portal

## Step 1: Create Azure Function App

### Option A: Using Azure Portal

1. **Navigate to Azure Portal**
   - Go to https://portal.azure.com
   - Click "Create a resource"

2. **Search for Function App**
   - Type "Function App" in the search box
   - Select "Function App" from results

3. **Configure Basics**
   - **Subscription**: Select your subscription
   - **Resource Group**: Select existing or create new (recommend same as App Service)
   - **Function App name**: e.g., `opsy-weekly-off-timer` (must be globally unique)
   - **Publish**: Code
   - **Runtime stack**: Python
   - **Version**: 3.11
   - **Region**: Central India (same as your App Service)

4. **Configure Hosting**
   - **Plan type**: Consumption (Serverless) - recommended for cost efficiency
   - Or Premium if you need VNet integration

5. **Review and Create**
   - Review settings
   - Click "Create"
   - Wait for deployment (2-3 minutes)

### Option B: Using Azure CLI

```bash
# Login to Azure
az login

# Set variables
RESOURCE_GROUP="your-resource-group"
FUNCTION_APP_NAME="opsy-weekly-off-timer"
STORAGE_ACCOUNT="opsyweekoffstorage"  # Must be globally unique
LOCATION="centralindia"

# Create storage account (required for Function App)
az storage account create \
  --name $STORAGE_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --sku Standard_LRS

# Create Function App
az functionapp create \
  --resource-group $RESOURCE_GROUP \
  --consumption-plan-location $LOCATION \
  --runtime python \
  --runtime-version 3.11 \
  --functions-version 4 \
  --name $FUNCTION_APP_NAME \
  --storage-account $STORAGE_ACCOUNT
```

## Step 2: Configure Application Settings

### Via Azure Portal

1. Go to your Function App
2. Navigate to **Configuration** → **Application settings**
3. Click **+ New application setting** for each:

   **CRON_SECRET**
   - Name: `CRON_SECRET`
   - Value: `xTAE+YsAf+gFq1UxYUe4ciLA5RIi0S/FetNS+hgZgQs=`
   - Click OK

   **API_URL** (Optional, has default)
   - Name: `API_URL`
   - Value: `https://opsy.theplahouse.com/api/cron/weekly-off`
   - Click OK

4. Click **Save** at the top
5. Wait for the app to restart

### Via Azure CLI

```bash
# Set CRON_SECRET
az functionapp config appsettings set \
  --name $FUNCTION_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --settings CRON_SECRET="xTAE+YsAf+gFq1UxYUe4ciLA5RIi0S/FetNS+hgZgQs="

# Set API_URL (optional)
az functionapp config appsettings set \
  --name $FUNCTION_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --settings API_URL="https://opsy.theplahouse.com/api/cron/weekly-off"
```

## Step 3: Deploy Function Code

### Method 1: Azure Portal (Quick Start)

1. **Create Function**
   - Go to Function App → Functions
   - Click **+ Create**
   - Select **Timer trigger**
   - Function name: `weekly-off-timer`
   - Schedule: `0 30 19 * * *` (7:30 PM UTC = 1:00 AM IST)
   - Click **Create**

2. **Upload Code**
   - Open the function
   - Go to **Code + Test**
   - Replace the default code with content from `azure-functions/weekly-off-timer/__init__.py`
   - Click **Save**

3. **Install Dependencies**
   - Go to **Deployment Center**
   - Or use **Console** (Advanced Tools → Go → Debug console)
   - Navigate to function directory
   - Run: `pip install -r requirements.txt`

### Method 2: Azure Functions Core Tools

```bash
# Install Azure Functions Core Tools
npm install -g azure-functions-core-tools@4

# Navigate to function directory
cd azure-functions

# Login to Azure
az login

# Deploy function
func azure functionapp publish $FUNCTION_APP_NAME
```

### Method 3: VS Code

1. Install "Azure Functions" extension
2. Open `azure-functions` folder in VS Code
3. Press F1 → "Azure Functions: Deploy to Function App"
4. Select your Function App
5. Follow prompts

### Method 4: ZIP Deploy

```bash
# Create deployment package
cd azure-functions
zip -r function-app.zip .

# Deploy via Azure CLI
az functionapp deployment source config-zip \
  --resource-group $RESOURCE_GROUP \
  --name $FUNCTION_APP_NAME \
  --src function-app.zip
```

## Step 4: Verify Deployment

### Check Function is Created

1. Go to Function App → Functions
2. Verify `weekly-off-timer` function exists
3. Check status is "Enabled"

### Test Function Manually

1. Go to Function App → Functions → `weekly-off-timer`
2. Click **Code + Test**
3. Click **Test/Run** tab
4. Click **Run** button
5. Check **Output** tab for logs
6. Verify success message and user details

### Check Logs

1. Go to Function App → Functions → `weekly-off-timer` → **Monitor**
2. View execution history
3. Click on an execution to see detailed logs

## Step 5: Verify API Endpoint

After function runs, verify:

1. **Check Next.js App Logs**
   - Go to App Service → Log stream
   - Look for "Weekly Off Cron Job - Request Received"
   - Verify authentication success

2. **Check Database**
   - Verify attendance records were created
   - Check `isWeeklyOff: true` for affected users

3. **Check Function Logs**
   - Function App → Functions → Monitor
   - Verify successful execution
   - Check for any errors

## Step 6: Monitor Scheduled Execution

### Wait for First Scheduled Run

- Function runs daily at 1:00 AM IST (7:30 PM UTC)
- Wait until scheduled time or adjust schedule for testing

### Set Up Alerts (Optional)

1. Go to Function App → Alerts
2. Click **+ Create** → **Alert rule**
3. Configure:
   - Condition: Function execution failures
   - Action: Email notification
   - Save

## Troubleshooting

### Function Not Appearing

- Check deployment completed successfully
- Refresh the Functions page
- Check Activity log for errors

### Function Not Running

- Verify function is enabled (not stopped)
- Check timer schedule is correct
- Verify Application settings are saved

### Authentication Errors

- Verify CRON_SECRET matches in both Function App and App Service
- Check for extra spaces or quotes
- Test API endpoint manually with curl

### Import Errors

- Verify `requirements.txt` dependencies are installed
- Check Python version is 3.11
- Review function logs for specific import errors

### Timeout Errors

- Increase timeout in `host.json` (default: 5 minutes)
- Check API endpoint response time
- Review Next.js app performance

## Schedule Adjustment

To change the execution time, edit the schedule in `function.json`:

Current: `0 30 19 * * *` (1:00 AM IST)

Examples:
- `0 0 1 * * *` = 1:00 AM UTC (6:30 AM IST)
- `0 0 2 * * *` = 2:00 AM UTC (7:30 AM IST)
- `0 30 20 * * *` = 8:30 PM UTC (2:00 AM IST next day)

Format: `{second} {minute} {hour} {day} {month} {day-of-week}`

## Cost Optimization

- Use Consumption Plan (pay per execution)
- First 1 million executions/month are free
- Estimated: ~30 executions/month = $0 cost

## Security Best Practices

1. **Store CRON_SECRET in Azure Key Vault** (recommended)
   - Create Key Vault
   - Store secret there
   - Reference from Function App settings: `@Microsoft.KeyVault(SecretUri=...)`

2. **Enable Function Authentication** (optional)
   - Function App → Authentication
   - Enable authentication
   - Configure identity provider

3. **Use Managed Identity** (for Key Vault access)
   - Function App → Identity
   - Enable System assigned identity
   - Grant Key Vault access

## Next Steps

1. Monitor first few executions
2. Set up alerts for failures
3. Review logs regularly
4. Adjust schedule if needed
5. Consider adding retry logic for transient failures

## Support Resources

- [Azure Functions Documentation](https://docs.microsoft.com/azure/azure-functions/)
- [Timer Trigger Reference](https://docs.microsoft.com/azure/azure-functions/functions-bindings-timer)
- [Python Azure Functions Guide](https://docs.microsoft.com/azure/azure-functions/functions-reference-python)
