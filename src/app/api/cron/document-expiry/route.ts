import { NextRequest, NextResponse } from "next/server";
import { processDocumentExpiries } from "@/lib/services/document-expiry";

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

    try {
        console.log("Running Document Expiry Cron Job...");
        const result = await processDocumentExpiries();

        const duration = Date.now() - startTime;
        return NextResponse.json({
            success: true,
            message: "Successfully processed document expiries",
            result,
            duration: `${duration}ms`,
            timestamp,
        });
    } catch (error) {
        console.error("Document Expiry Cron Job Error:", error);
        const duration = Date.now() - startTime;
        return NextResponse.json(
            {
                success: false,
                error: "Failed to process document expiries",
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
