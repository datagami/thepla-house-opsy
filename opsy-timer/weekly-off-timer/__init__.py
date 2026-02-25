import logging
import datetime
import os
import sys
import traceback
import azure.functions as func

# Try importing requests
try:
    import requests
except ImportError as e:
    logging.error("Failed to import requests")
    raise

def main(mytimer: func.TimerRequest) -> None:
    logging.info('Weekly Off Cron Job - Azure Function Started')
    
    cron_secret = os.environ.get('CRON_SECRET')
    # Use API_URL if set, otherwise default to the production URL
    api_url = os.environ.get('API_URL', 'https://opsy.theplahouse.com/api/cron/weekly-off')
    
    if not cron_secret:
        logging.error('CRON_SECRET environment variable is not set!')
        raise ValueError('CRON_SECRET environment variable is not set!')

    headers = {
        'Authorization': f'Bearer {cron_secret}',
        'User-Agent': 'azure-function-weekly-off-timer/1.0',
        'Content-Type': 'application/json'
    }
    
    try:
        logging.info(f'Calling API: {api_url}')
        response = requests.get(api_url, headers=headers, timeout=60, verify=True)
        
        try:
            response_data = response.json()
        except Exception:
            response_data = {'raw_response': response.text}
        
        if response.status_code == 200:
            logging.info('SUCCESS: Weekly off cron job completed successfully')
            logging.info(f'Response: {response_data}')
        elif response.status_code == 401:
            logging.error('UNAUTHORIZED: CRON_SECRET authentication failed')
            raise requests.exceptions.HTTPError(f'Unauthorized - Status: {response.status_code}')
        else:
            logging.error(f'API returned error status: {response.status_code}')
            logging.error(f'Response: {response_data}')
            raise requests.exceptions.HTTPError(f'API return status {response.status_code}')
            
    except Exception as e:
        logging.error(f'Error calling API: {str(e)}')
        logging.error(traceback.format_exc())
        raise
