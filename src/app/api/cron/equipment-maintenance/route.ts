import { NextRequest, NextResponse } from "next/server";
import { processEquipmentMaintenanceReminders } from "@/lib/services/equipment-maintenance-reminders";

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();

  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized", message: "Invalid or missing CRON_SECRET", timestamp }, { status: 401 });
  }

  try {
    console.log("Running Equipment Maintenance Reminder Cron Job...");
    const result = await processEquipmentMaintenanceReminders();
    const duration = Date.now() - startTime;
    return NextResponse.json({ success: true, message: "Processed maintenance reminders", result, duration: `${duration}ms`, timestamp });
  } catch (error) {
    console.error("Equipment Maintenance Cron Job Error:", error);
    const duration = Date.now() - startTime;
    return NextResponse.json(
      { success: false, error: "Failed to process maintenance reminders", message: error instanceof Error ? error.message : "Unknown error", timestamp, duration: `${duration}ms` },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
