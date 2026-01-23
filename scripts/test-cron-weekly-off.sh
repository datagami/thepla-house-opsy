#!/bin/bash

# Test Script for Weekly Off Cron Job
# This script helps verify that the cron job setup is working correctly
#
# Usage:
#   ./scripts/test-cron-weekly-off.sh

set -e  # Exit on error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=========================================="
echo "Weekly Off Cron Job - Test Script"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if CRON_SECRET is set
echo "1. Checking CRON_SECRET..."
if [ -z "$CRON_SECRET" ]; then
    echo -e "${YELLOW}⚠️  CRON_SECRET is not set in environment${NC}"
    echo "   Please set it: export CRON_SECRET='your_secret_here'"
    echo ""
    read -p "Do you want to generate a new CRON_SECRET? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Generating CRON_SECRET..."
        SECRET=$(npx tsx scripts/generate-cron-secret.ts 2>/dev/null | grep -A 1 "Generated CRON_SECRET" | tail -n 1 | xargs)
        if [ -n "$SECRET" ]; then
            export CRON_SECRET="$SECRET"
            echo -e "${GREEN}✅ Generated and set CRON_SECRET${NC}"
            echo "   Add this to your .env file: CRON_SECRET=$SECRET"
        else
            echo -e "${RED}❌ Failed to generate CRON_SECRET${NC}"
            exit 1
        fi
    else
        echo -e "${RED}❌ CRON_SECRET is required. Exiting.${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✅ CRON_SECRET is set${NC}"
    echo "   (Value hidden for security)"
fi
echo ""

# Check if API URL is accessible
echo "2. Checking API endpoint..."
API_URL="${API_URL:-http://localhost:8080/api/cron/weekly-off}"
echo "   Testing: $API_URL"

# Check if server is running
if curl -s --connect-timeout 2 --max-time 5 "$API_URL" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ API endpoint is accessible${NC}"
else
    echo -e "${YELLOW}⚠️  Could not reach API endpoint${NC}"
    echo "   Make sure your Next.js app is running on port 8080"
    echo "   Or set API_URL environment variable: export API_URL='http://your-server:8080/api/cron/weekly-off'"
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi
echo ""

# Test the cron script
echo "3. Testing cron script..."
echo "   Running: $PROJECT_ROOT/scripts/cron-weekly-off.sh"
echo ""

# Run the actual cron script
if "$PROJECT_ROOT/scripts/cron-weekly-off.sh"; then
    echo ""
    echo -e "${GREEN}✅ Cron script executed successfully${NC}"
else
    echo ""
    echo -e "${RED}❌ Cron script failed${NC}"
    echo "   Check the output above for errors"
    exit 1
fi
echo ""

# Check log file
echo "4. Checking log file..."
LOG_FILE="${LOG_FILE:-/var/log/opsy-weekly-off-cron.log}"
if [ -f "$LOG_FILE" ]; then
    echo -e "${GREEN}✅ Log file exists: $LOG_FILE${NC}"
    echo ""
    echo "Last 20 lines of log:"
    echo "----------------------------------------"
    tail -n 20 "$LOG_FILE" || echo "Could not read log file"
    echo "----------------------------------------"
else
    echo -e "${YELLOW}⚠️  Log file not found: $LOG_FILE${NC}"
    echo "   This is normal if the script hasn't run via cron yet"
fi
echo ""

# Verify API response
echo "5. Verifying API response..."
echo "   Making test request to API endpoint..."
echo ""

RESPONSE=$(curl -s -w "\n%{http_code}" \
    -H "Authorization: Bearer $CRON_SECRET" \
    -H "User-Agent: opsy-test-script/1.0" \
    --max-time 30 \
    "$API_URL")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
RESPONSE_BODY=$(echo "$RESPONSE" | sed '$d')

echo "   HTTP Status Code: $HTTP_CODE"

if [ "$HTTP_CODE" -eq 200 ]; then
    echo -e "${GREEN}✅ API returned success (200)${NC}"
    echo ""
    echo "   Response:"
    if command -v jq > /dev/null 2>&1; then
        echo "$RESPONSE_BODY" | jq '.' 2>/dev/null || echo "$RESPONSE_BODY"
    else
        echo "$RESPONSE_BODY"
    fi
elif [ "$HTTP_CODE" -eq 401 ]; then
    echo -e "${RED}❌ API returned Unauthorized (401)${NC}"
    echo "   CRON_SECRET mismatch! Check that:"
    echo "   1. CRON_SECRET in your .env file matches the one you're using"
    echo "   2. Your Next.js app has been restarted after adding CRON_SECRET"
    exit 1
else
    echo -e "${RED}❌ API returned error ($HTTP_CODE)${NC}"
    echo "   Response: $RESPONSE_BODY"
    exit 1
fi
echo ""

# Summary
echo "=========================================="
echo "Test Summary"
echo "=========================================="
echo -e "${GREEN}✅ All tests passed!${NC}"
echo ""
echo "Next steps:"
echo "1. Add CRON_SECRET to your .env file (if not already done)"
echo "2. Restart your Next.js app to load the new CRON_SECRET"
echo "3. Add to crontab for testing (every 5 minutes):"
echo ""
echo "   crontab -e"
echo ""
echo "   Add this line:"
echo "   */5 * * * * TZ=Asia/Kolkata CRON_SECRET=$CRON_SECRET $PROJECT_ROOT/scripts/cron-weekly-off.sh >> /var/log/opsy-weekly-off-cron.log 2>&1"
echo ""
echo "4. Monitor logs: tail -f /var/log/opsy-weekly-off-cron.log"
echo ""
echo "=========================================="
