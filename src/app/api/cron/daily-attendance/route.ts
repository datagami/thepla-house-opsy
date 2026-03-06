import { NextRequest, NextResponse } from "next/server";
import { sendDailyAttendanceReport } from "@/lib/services/daily-attendance-report";

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();

  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret) {
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Invalid or missing CRON_SECRET", timestamp },
        { status: 401 }
      );
    }
  }

  const preview = request.nextUrl.searchParams.get("preview") === "true";

  try {
    console.log("Running Daily Attendance Report Cron Job...");
    const result = await sendDailyAttendanceReport({ previewOnly: preview });

    if (preview && result.html) {
      return new NextResponse(result.html, {
        headers: { "Content-Type": "text/html" },
      });
    }

    const duration = Date.now() - startTime;
    return NextResponse.json({
      success: true,
      message: "Daily attendance report sent successfully",
      result,
      duration: `${duration}ms`,
      timestamp,
    });
  } catch (error) {
    console.error("Daily Attendance Report Cron Job Error:", error);
    const duration = Date.now() - startTime;
    return NextResponse.json(
      {
        success: false,
        error: "Failed to send daily attendance report",
        message: error instanceof Error ? error.message : "Unknown error",
        timestamp,
        duration: `${duration}ms`,
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
