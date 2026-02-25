import * as fs from "fs";
import * as path from "path";
import { processDocumentExpiries } from "../src/lib/services/document-expiry";

// Load environment variables from .env file
if (typeof process.loadEnvFile === 'function') {
    process.loadEnvFile('.env');
} else {
    // Fallback for older Node versions: manually parse simple .env
    try {
        const envPath = path.resolve(process.cwd(), '.env');
        if (fs.existsSync(envPath)) {
            const envConfig = fs.readFileSync(envPath, 'utf8');
            envConfig.split('\n').forEach(line => {
                const [key, ...valueParts] = line.split('=');
                if (key && valueParts && !process.env[key.trim()]) {
                    process.env[key.trim()] = valueParts.join('=').trim();
                }
            });
        }
    } catch (e) {
        console.warn("Could not manually load .env file:", e);
    }
}

/**
 * Local Test Script
 * Run with: npx tsx scripts/test-expiry-report.ts
 * 
 * This script runs the document expiry logic. 
 * If you haven't set up SMTP yet, the actual 'send' will fail, 
 * but you can see the results in the console.
 */

async function runTest() {
    console.log("🚀 Starting local test for Document Expiry Report...");

    try {
        const result = await processDocumentExpiries();

        console.log("\n✅ Test Result Summary:");
        console.log(JSON.stringify(result, null, 2));

        // To properly test the HTML content locally without SMTP:
        // We can't easily intercept the HTML from the service without changing it,
        // so I will suggest the user check the console or use a mock SMTP like Mailtrap.

        if (result.processed > 0) {
            console.log("\n💡 Documents were found.");
        } else {
            console.log("\nℹ️ No documents found matching criteria.");
        }

    } catch (error) {
        if (error instanceof Error && error.message.includes("SMTP")) {
            console.log("\n⚠️ Note: The email failed to send because SMTP is not configured.");
            console.log("This confirms the logic reached the 'send' stage!");
        } else {
            console.error("\n❌ Test Failed:");
            console.log(error);
        }
    }
}

runTest();
