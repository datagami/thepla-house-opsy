/**
 * Generate a secure random string for CRON_SECRET
 * 
 * Usage:
 *   npx tsx scripts/generate-cron-secret.ts
 * 
 * This generates a cryptographically secure random string
 * suitable for use as CRON_SECRET environment variable.
 */

import crypto from 'crypto';

function generateCronSecret(length: number = 32): string {
  // Generate random bytes and convert to base64
  const randomBytes = crypto.randomBytes(length);
  return randomBytes.toString('base64');
}

function main() {
  const secret = generateCronSecret(32);
  
  console.log('\n✅ Generated CRON_SECRET:\n');
  console.log(secret);
  console.log('\n📋 Copy this value and add it to your environment variables:');
  console.log('   - Server: Add to .env or .env.production file');
  console.log('   - Crontab: Include in crontab entry');
  console.log('\n⚠️  Keep this secret secure and never commit it to version control!\n');
  
  // Also show as a one-liner for easy copying
  console.log('One-liner for .env file:');
  console.log(`CRON_SECRET=${secret}\n`);
  
  console.log('One-liner for crontab:');
  console.log(`CRON_SECRET=${secret}\n`);
}

main();
