# Configure logging FIRST - before any other imports
import logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Log that we're starting to import
logger.info('=' * 60)
logger.info('Starting function initialization...')
logger.info('=' * 60)

# Import standard library modules first
try:
    logger.info('Importing standard library modules...')
    import datetime
    import json
    import os
    import sys
    import traceback
    from typing import Any
    logger.info('✓ Standard library modules imported successfully')
except Exception as e:
    logger.error('✗ Failed to import standard library modules')
    logger.error(f'Error: {str(e)}')
    logger.error(f'Traceback: {traceback.format_exc()}')
    raise

# Test datetime availability
try:
    logger.info('Testing datetime module...')
    test_now = datetime.datetime.now()
    test_utc = datetime.datetime.utcnow()
    test_timezone = datetime.timezone
    test_timedelta = datetime.timedelta
    logger.info(f'✓ datetime module working - current time: {test_now}')
except Exception as e:
    logger.error('✗ datetime module not working')
    logger.error(f'Error: {str(e)}')
    logger.error(f'Traceback: {traceback.format_exc()}')
    raise

# Import Azure Functions
try:
    logger.info('Importing azure.functions...')
    import azure.functions as func
    logger.info('✓ azure.functions imported successfully')
except Exception as e:
    logger.error('✗ Failed to import azure.functions')
    logger.error(f'Error: {str(e)}')
    logger.error(f'Traceback: {traceback.format_exc()}')
    raise

# Import requests (this is the most likely to fail)
try:
    logger.info('Importing requests...')
    import requests
    logger.info('✓ requests imported successfully')
    logger.info(f'requests version: {requests.__version__ if hasattr(requests, "__version__") else "unknown"}')
except ImportError as e:
    logger.error('=' * 60)
    logger.error('✗ CRITICAL: Failed to import requests')
    logger.error('=' * 60)
    logger.error(f'Error type: {type(e).__name__}')
    logger.error(f'Error message: {str(e)}')
    logger.error('This means the requests library is NOT installed.')
    logger.error('SOLUTION: Add requests to requirements.txt at the root of your Function App')
    logger.error('=' * 60)
    logger.error('Full traceback:')
    logger.error(traceback.format_exc())
    logger.error('=' * 60)
    raise
except Exception as e:
    logger.error('✗ Failed to import requests (unexpected error)')
    logger.error(f'Error: {str(e)}')
    logger.error(f'Traceback: {traceback.format_exc()}')
    raise

logger.info('All imports successful')
logger.info('=' * 60)


def main(timer: func.TimerRequest) -> None:
    """
    Azure Function Timer Trigger for Weekly Off Cron Job
    
    This function runs daily at 1:00 AM IST (7:30 PM UTC) and calls the
    weekly off API endpoint to automatically flag users with fixed weekly off days.
    """
    try:
        logger.info('=' * 60)
        logger.info('Function main() called')
        logger.info('=' * 60)
        
        # Log timer information
        try:
            logger.info(f'Timer object type: {type(timer)}')
            logger.info(f'Timer schedule status: {getattr(timer, "schedule_status", "N/A")}')
            logger.info(f'Timer past due: {getattr(timer, "past_due", "N/A")}')
        except Exception as e:
            logger.warning(f'Could not read timer properties: {str(e)}')
        
        utc_timestamp = datetime.datetime.utcnow().replace(tzinfo=datetime.timezone.utc).isoformat()
        ist_timestamp = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=5, minutes=30))).isoformat()
        
        logger.info('=' * 60)
        logger.info('Weekly Off Cron Job - Azure Function Started')
        logger.info('=' * 60)
        logger.info(f'UTC Timestamp: {utc_timestamp}')
        logger.info(f'IST Timestamp: {ist_timestamp}')
        logger.info(f'Python version: {sys.version}')
        logger.info(f'Python executable: {sys.executable}')
        logger.info(f'Current working directory: {os.getcwd()}')
        logger.info(f'Environment variables available: {len(os.environ)} vars')
    
        # Get configuration from environment variables
        logger.info('Reading environment variables...')
        cron_secret = os.environ.get('CRON_SECRET')
        api_url = os.environ.get('API_URL', 'https://opsy.theplahouse.com/api/cron/weekly-off')
        
        logger.info(f'CRON_SECRET found: {"Yes" if cron_secret else "No"}')
        logger.info(f'CRON_SECRET length: {len(cron_secret) if cron_secret else 0}')
        logger.info(f'API_URL: {api_url}')
        
        # Validate required configuration
        if not cron_secret:
            error_msg = 'CRON_SECRET environment variable is not set!'
            logger.error('=' * 60)
            logger.error('ERROR: ' + error_msg)
            logger.error('=' * 60)
            logger.error('Available environment variables:')
            for key in sorted(os.environ.keys()):
                if 'SECRET' in key.upper() or 'CRON' in key.upper() or 'API' in key.upper():
                    logger.error(f'  {key}: {"[SET]" if os.environ.get(key) else "[NOT SET]"}')
            raise ValueError(error_msg)
    
        logger.info(f'API URL: {api_url}')
        logger.info('CRON_SECRET: [SET - Hidden for security]')
        logger.info('')
        
        # Prepare HTTP request
        logger.info('Preparing HTTP request...')
        headers = {
            'Authorization': f'Bearer {cron_secret}',
            'User-Agent': 'azure-function-weekly-off-timer/1.0',
            'Content-Type': 'application/json'
        }
        logger.info(f'Headers prepared: {list(headers.keys())}')
        
        logger.info('Making API request...')
        logger.info(f'  Method: GET')
        logger.info(f'  Endpoint: {api_url}')
        logger.info(f'  Headers: Authorization: Bearer [HIDDEN]')
        logger.info('')
        
        try:
        # Make HTTP request with timeout
        response = requests.get(
            api_url,
            headers=headers,
            timeout=60,  # 60 second timeout
            verify=True  # Verify SSL certificate
        )
        
        # Log response details
        logger.info(f'HTTP Status Code: {response.status_code}')
        logger.info(f'Response Headers: {dict(response.headers)}')
        
        # Parse response
        try:
            response_data = response.json()
        except json.JSONDecodeError:
            response_data = {'raw_response': response.text}
        
        # Handle different status codes
        if response.status_code == 200:
            logger.info('=' * 60)
            logger.info('SUCCESS: Weekly off cron job completed successfully')
            logger.info('=' * 60)
            
            # Extract and log details from response
            records_created = response_data.get('recordsCreated', 'N/A')
            total_processed = response_data.get('totalProcessed', 'N/A')
            duration = response_data.get('duration', 'N/A')
            
            logger.info(f'Records Created/Updated: {records_created}')
            logger.info(f'Total Processed: {total_processed}')
            logger.info(f'Duration: {duration}')
            logger.info(f'Timestamp: {response_data.get("timestamp", "N/A")}')
            logger.info(f'IST Time: {response_data.get("istTime", "N/A")}')
            logger.info('')
            
            # Log users that were marked
            users = response_data.get('users', [])
            if users:
                logger.info('Users Marked as Weekly Off:')
                for idx, user in enumerate(users, 1):
                    user_name = user.get('userName', 'Unknown')
                    user_email = user.get('userEmail', 'No email')
                    day_name = user.get('dayName', 'Unknown')
                    action = user.get('action', 'unknown')
                    logger.info(f'  {idx}. {user_name} ({user_email})')
                    logger.info(f'     - Day: {day_name}')
                    logger.info(f'     - Action: {action}')
                logger.info('')
            else:
                logger.info('No users were marked as weekly off (all were already processed or no matches found)')
                logger.info('')
            
            logger.info('=' * 60)
            logger.info('Function completed successfully')
            logger.info('=' * 60)
            
        elif response.status_code == 401:
            error_msg = 'UNAUTHORIZED: CRON_SECRET authentication failed'
            logger.error('=' * 60)
            logger.error(f'ERROR: {error_msg}')
            logger.error('=' * 60)
            logger.error('Please verify that CRON_SECRET matches the value in your Next.js app environment')
            logger.error(f'Response: {response_data}')
            raise requests.exceptions.HTTPError(f'{error_msg} - Status: {response.status_code}')
            
        elif response.status_code >= 500:
            error_msg = f'SERVER ERROR: The API endpoint returned status {response.status_code}'
            logger.error('=' * 60)
            logger.error(f'ERROR: {error_msg}')
            logger.error('=' * 60)
            logger.error(f'Response: {response_data}')
            raise requests.exceptions.HTTPError(f'{error_msg} - Status: {response.status_code}')
            
        else:
            error_msg = f'Unexpected HTTP status code: {response.status_code}'
            logger.error('=' * 60)
            logger.error(f'ERROR: {error_msg}')
            logger.error('=' * 60)
            logger.error(f'Response: {response_data}')
            raise requests.exceptions.HTTPError(f'{error_msg} - Status: {response.status_code}')
    
    except requests.exceptions.Timeout:
        error_msg = 'Request timeout: The API endpoint did not respond within 60 seconds'
        logger.error('=' * 60)
        logger.error(f'ERROR: {error_msg}')
        logger.error('=' * 60)
        raise
    
    except requests.exceptions.ConnectionError as e:
        error_msg = f'Connection error: Could not connect to API endpoint - {str(e)}'
        logger.error('=' * 60)
        logger.error(f'ERROR: {error_msg}')
        logger.error('=' * 60)
        raise
    
    except requests.exceptions.RequestException as e:
        error_msg = f'Request error: {str(e)}'
        logger.error('=' * 60)
        logger.error(f'ERROR: {error_msg}')
        logger.error('=' * 60)
        raise
    
    except Exception as e:
        error_msg = f'Unexpected error: {str(e)}'
        logger.error('=' * 60)
        logger.error(f'ERROR: {error_msg}')
        logger.error('=' * 60)
        logger.error(f'Exception type: {type(e).__name__}')
        logger.error(f'Exception message: {str(e)}')
        logger.error('Full traceback:')
        logger.error(traceback.format_exc())
        logger.error('=' * 60)
        raise
    
        if timer.past_due:
            logger.warning('The timer is past due!')
            
    except ValueError as e:
        # Configuration errors
        logger.error('=' * 60)
        logger.error('CONFIGURATION ERROR')
        logger.error('=' * 60)
        logger.error(f'Error type: {type(e).__name__}')
        logger.error(f'Error message: {str(e)}')
        logger.error('Full traceback:')
        logger.error(traceback.format_exc())
        logger.error('=' * 60)
        raise
        
    except ImportError as e:
        # Import errors
        logger.error('=' * 60)
        logger.error('IMPORT ERROR')
        logger.error('=' * 60)
        logger.error(f'Error type: {type(e).__name__}')
        logger.error(f'Error message: {str(e)}')
        logger.error('This usually means a required package is not installed.')
        logger.error('Make sure requirements.txt exists and contains all dependencies.')
        logger.error('Full traceback:')
        logger.error(traceback.format_exc())
        logger.error('=' * 60)
        raise
        
    except Exception as e:
        # Catch-all for any other errors
        logger.error('=' * 60)
        logger.error('UNEXPECTED ERROR IN MAIN FUNCTION')
        logger.error('=' * 60)
        logger.error(f'Error type: {type(e).__name__}')
        logger.error(f'Error message: {str(e)}')
        logger.error('Full traceback:')
        logger.error(traceback.format_exc())
        logger.error('=' * 60)
        raise
