#!/bin/bash

# Weekly Off Cron Job Script
# This script calls the weekly off API endpoint to automatically flag users with fixed weekly off days
# 
# Usage:
#   ./scripts/cron-weekly-off.sh
# 
# Or add to crontab:
#   */5 * * * * /path/to/opsy/scripts/cron-weekly-off.sh >> /var/log/opsy-weekly-off-cron.log 2>&1

# Set script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Log file location
# Use project-relative log directory for local development, /var/log for production
if [ -w "/var/log" ] 2>/dev/null; then
    LOG_FILE="${LOG_FILE:-/var/log/opsy-weekly-off-cron.log}"
else
    # Fallback to project logs directory if /var/log is not writable
    LOG_FILE="${LOG_FILE:-$PROJECT_ROOT/logs/opsy-weekly-off-cron.log}"
fi

# Ensure log directory exists
mkdir -p "$(dirname "$LOG_FILE")"

# Function to log with timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S %Z')] $*" | tee -a "$LOG_FILE"
}

# Function to log error
log_error() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S %Z')] ERROR: $*" | tee -a "$LOG_FILE" >&2
}

# Start logging
log "=========================================="
log "Weekly Off Cron Job Started"
log "=========================================="

# Display environment and parameters
log "Environment Details:"
log "  - Script Directory: $SCRIPT_DIR"
log "  - Project Root: $PROJECT_ROOT"
log "  - Log File: $LOG_FILE"
log "  - Current User: $(whoami)"
log "  - Current Date/Time: $(date)"
log "  - Timezone: $(date +%Z) ($(date +%z))"
log "  - Day of Week: $(date +%A) ($(date +%u))"

# Check if CRON_SECRET is set
if [ -z "$CRON_SECRET" ]; then
    log_error "CRON_SECRET environment variable is not set!"
    log_error "Please set CRON_SECRET in your environment or crontab"
    log_error "Example: export CRON_SECRET='your-secret-here'"
    exit 1
fi

log "  - CRON_SECRET: [SET - Hidden for security]"

# Determine API URL
# Default to port 3000 for local development, 8080 for production
# Can be overridden with API_URL environment variable
DEFAULT_PORT="${DEFAULT_PORT:-3000}"
API_URL="${API_URL:-http://localhost:${DEFAULT_PORT}/api/cron/weekly-off}"

# If API_URL is not explicitly set, try to detect
if [ -z "$API_URL" ] || [ "$API_URL" = "http://localhost:${DEFAULT_PORT}/api/cron/weekly-off" ]; then
    # Check if we can reach localhost on the default port
    if curl -s --connect-timeout 2 --max-time 3 "http://localhost:${DEFAULT_PORT}" > /dev/null 2>&1; then
        API_URL="http://localhost:${DEFAULT_PORT}/api/cron/weekly-off"
        log "  - Server Status: ✅ Next.js app is running on port ${DEFAULT_PORT}"
    else
        # Try port 8080 as fallback (production)
        if curl -s --connect-timeout 2 --max-time 3 http://localhost:8080 > /dev/null 2>&1; then
            API_URL="http://localhost:8080/api/cron/weekly-off"
            log "  - Server Status: ✅ Next.js app is running on port 8080"
        else
            # Check if app might be on a different port
            log_error "⚠️  Warning: Cannot reach http://localhost:${DEFAULT_PORT} or http://localhost:8080"
            log_error "   Make sure your Next.js app is running: npm run dev (port 3000) or npm run start (port 8080)"
            log_error "   Or set API_URL environment variable if app is on a different URL"
            # Try to get from environment or use default
            API_URL="${NEXT_PUBLIC_API_URL:-http://localhost:${DEFAULT_PORT}}/api/cron/weekly-off"
        fi
    fi
fi

log "  - API URL: $API_URL"

# Display request parameters
log ""
log "Request Parameters:"
log "  - Method: GET"
log "  - Endpoint: $API_URL"
log "  - Authorization: Bearer [CRON_SECRET]"
log "  - User-Agent: opsy-cron-job/1.0"

# Make the API call
log ""
log "Making API request..."

# Check if curl is available
if ! command -v curl > /dev/null 2>&1; then
    log_error "curl command not found. Please install curl."
    exit 1
fi

RESPONSE=$(curl -s -w "\n%{http_code}" \
    -H "Authorization: Bearer $CRON_SECRET" \
    -H "User-Agent: opsy-cron-job/1.0" \
    -H "Content-Type: application/json" \
    --connect-timeout 5 \
    --max-time 30 \
    "$API_URL" 2>&1)

# Check for curl errors
CURL_EXIT_CODE=$?
if [ $CURL_EXIT_CODE -ne 0 ]; then
    log_error "curl failed with exit code: $CURL_EXIT_CODE"
    log_error "Response: $RESPONSE"
    if echo "$RESPONSE" | grep -q "Connection refused"; then
        log_error "Connection refused - Is your Next.js app running?"
        log_error "Start it with: npm run dev (port 3000) or npm run start (port 8080)"
    elif echo "$RESPONSE" | grep -q "Failed to connect"; then
        log_error "Failed to connect - Check if the server is running and accessible"
    fi
    exit 1
fi

# Extract HTTP status code (last line)
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
# Extract response body (all but last line)
RESPONSE_BODY=$(echo "$RESPONSE" | sed '$d')

log "HTTP Response Code: $HTTP_CODE"

# Log response body
if [ -n "$RESPONSE_BODY" ]; then
    log "Response Body:"
    echo "$RESPONSE_BODY" | jq '.' 2>/dev/null || echo "$RESPONSE_BODY" | while IFS= read -r line; do
        log "  $line"
    done
else
    log "Response Body: [Empty]"
fi

# Check if request was successful
if [ "$HTTP_CODE" -eq 200 ]; then
    log "✅ SUCCESS: Weekly off cron job completed successfully"
    
    # Try to extract record count and user details from JSON response if available
    if command -v jq > /dev/null 2>&1; then
        RECORDS_CREATED=$(echo "$RESPONSE_BODY" | jq -r '.recordsCreated // .count // "N/A"' 2>/dev/null)
        TOTAL_PROCESSED=$(echo "$RESPONSE_BODY" | jq -r '.totalProcessed // "N/A"' 2>/dev/null)
        
        if [ "$RECORDS_CREATED" != "N/A" ] && [ "$RECORDS_CREATED" != "null" ]; then
            log "  - Records Created/Updated: $RECORDS_CREATED"
        fi
        
        if [ "$TOTAL_PROCESSED" != "N/A" ] && [ "$TOTAL_PROCESSED" != "null" ]; then
            log "  - Total Processed: $TOTAL_PROCESSED"
        fi
        
        # Extract and display users that were marked
        USER_COUNT=$(echo "$RESPONSE_BODY" | jq -r '.users | length // 0' 2>/dev/null)
        if [ "$USER_COUNT" != "0" ] && [ "$USER_COUNT" != "null" ]; then
            log ""
            log "Users Marked as Weekly Off:"
            echo "$RESPONSE_BODY" | jq -r '.users[]? | "  - \(.userName) (\(.userEmail // "No email")) - \(.dayName) - \(.action)"' 2>/dev/null | while IFS= read -r user_line; do
                log "$user_line"
            done
        else
            log ""
            log "  ℹ️  No users were marked as weekly off (all were already processed or no matches found)"
        fi
    else
        # Fallback if jq is not available - try to extract basic info
        log "  - Response received (install jq for detailed user information)"
    fi
    
    EXIT_CODE=0
elif [ "$HTTP_CODE" -eq 401 ]; then
    log_error "❌ UNAUTHORIZED: CRON_SECRET authentication failed"
    log_error "Please verify that CRON_SECRET matches the value in your Next.js app environment"
    EXIT_CODE=1
elif [ "$HTTP_CODE" -eq 500 ]; then
    log_error "❌ SERVER ERROR: The API endpoint encountered an error"
    log_error "Check the Next.js application logs for more details"
    EXIT_CODE=1
else
    log_error "❌ FAILED: Unexpected HTTP status code: $HTTP_CODE"
    EXIT_CODE=1
fi

log "=========================================="
log "Weekly Off Cron Job Completed"
log "Exit Code: $EXIT_CODE"
log "=========================================="
log ""

exit $EXIT_CODE
