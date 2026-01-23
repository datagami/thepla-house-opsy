import { NextRequest, NextResponse } from 'next/server';
import { createWeeklyOffAttendanceForTodayWithDetails } from '@/lib/services/weekly-off-attendance';

/**
 * Cron job endpoint for automatically creating weekly off attendance records
 * 
 * This endpoint should be called by:
 * - Vercel Cron Jobs (configured in vercel.json)
 * - External cron services (e.g., EasyCron, cron-job.org)
 * - Manual triggers (for testing/admin purposes)
 * 
 * Security: Protected by CRON_SECRET environment variable
 * 
 * Recommended schedule: Daily at 1:00 AM (0 1 * * *)
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  const istTime = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  const dayOfWeek = new Date().getDay(); // 0 = Sunday, 6 = Saturday
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  // Log request details
  console.log('==========================================');
  console.log('Weekly Off Cron Job - Request Received');
  console.log('==========================================');
  console.log('Timestamp (UTC):', timestamp);
  console.log('Timestamp (IST):', istTime);
  console.log('Day of Week:', dayNames[dayOfWeek], `(${dayOfWeek})`);
  console.log('Request Method:', request.method);
  console.log('Request URL:', request.url);
  console.log('User-Agent:', request.headers.get('user-agent') || 'Not provided');
  console.log('Remote Address:', request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'Not available');

  // Security: Verify the request is from an authorized source
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  console.log('Authentication Status:', cronSecret ? 'CRON_SECRET is configured' : 'CRON_SECRET not set (allowing all requests)');
  
  // If CRON_SECRET is set, require authentication
  if (cronSecret) {
    if (authHeader !== `Bearer ${cronSecret}`) {
      console.error('❌ Authentication Failed: Invalid or missing CRON_SECRET');
      console.log('Expected:', `Bearer ${cronSecret.substring(0, 8)}...`);
      console.log('Received:', authHeader ? `${authHeader.substring(0, 20)}...` : 'No authorization header');
      
      return NextResponse.json(
        { 
          error: 'Unauthorized',
          message: 'Invalid or missing CRON_SECRET',
          timestamp 
        },
        { status: 401 }
      );
    }
    console.log('✅ Authentication Successful: Valid CRON_SECRET provided');
  } else {
    console.log('⚠️  Warning: CRON_SECRET not set - endpoint is publicly accessible');
  }

  try {
    // Process only today - find users with weekly off on today's day
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayOfWeek = today.getDay();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    console.log('');
    console.log('Processing weekly off for TODAY only:');
    console.log(`  Today's Date: ${today.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
    console.log(`  Day of Week: ${dayNames[dayOfWeek]} (${dayOfWeek})`);
    console.log(`  Looking for users with weekly off on: ${dayNames[dayOfWeek]}`);
    console.log('');
    
    const results = await createWeeklyOffAttendanceForTodayWithDetails();
    const createdOrUpdated = results.filter(r => r.action !== 'skipped');
    const count = createdOrUpdated.length;
    
    const duration = Date.now() - startTime;
    
    console.log('==========================================');
    console.log('✅ Weekly Off Cron Job - SUCCESS');
    console.log('==========================================');
    console.log('Records Created/Updated:', count);
    console.log('Total Processed:', results.length);
    console.log('Duration:', `${duration}ms`);
    console.log('Timestamp:', timestamp);
    console.log('');
    
    if (createdOrUpdated.length > 0) {
      console.log('Users Marked as Weekly Off:');
      createdOrUpdated.forEach((result, index) => {
        console.log(`  ${index + 1}. ${result.userName} (${result.userEmail || 'No email'})`);
        console.log(`     - Date: ${result.date.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })} (${result.dayName})`);
        console.log(`     - Action: ${result.action === 'created' ? 'Created new attendance' : 'Updated existing attendance'}`);
      });
    } else {
      console.log('No users were marked as weekly off (all were already processed or no matches found)');
    }
    
    console.log('==========================================');
    console.log('');

    return NextResponse.json({
      success: true,
      message: `Successfully processed weekly off attendance`,
      recordsCreated: count,
      totalProcessed: results.length,
      duration: `${duration}ms`,
      timestamp,
      istTime,
      dayOfWeek: dayNames[dayOfWeek],
      todayDate: today.toISOString(),
      todayDateIST: today.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }),
      users: createdOrUpdated.map(r => ({
        userId: r.userId,
        userName: r.userName,
        userEmail: r.userEmail,
        date: r.date.toISOString(),
        dayName: r.dayName,
        action: r.action,
        attendanceId: r.attendanceId
      }))
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    
    console.error('==========================================');
    console.error('❌ Weekly Off Cron Job - ERROR');
    console.error('==========================================');
    console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
    if (error instanceof Error && error.stack) {
      console.error('Stack Trace:');
      console.error(error.stack);
    }
    console.error('Duration:', `${duration}ms`);
    console.error('Timestamp:', timestamp);
    console.error('==========================================');
    console.error('');

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create weekly off attendance',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp,
        istTime,
        duration: `${duration}ms`
      },
      { status: 500 }
    );
  }
}

/**
 * Allow POST requests for manual triggers (e.g., from admin dashboard)
 */
export async function POST(request: NextRequest) {
  return GET(request);
}
