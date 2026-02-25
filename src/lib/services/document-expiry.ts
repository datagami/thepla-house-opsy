import { prisma } from "@/prisma";
import { sendEmail } from "./email";
import { addDays, startOfDay, endOfDay, format } from "date-fns";

export async function processDocumentExpiries() {
  const today = startOfDay(new Date());

  const in30DaysStart = addDays(today, 30);
  const in30DaysEnd = endOfDay(in30DaysStart);

  const in15DaysStart = addDays(today, 15);
  const in15DaysEnd = endOfDay(in15DaysStart);

  console.log(`Checking document expiries for:
    30 Days: ${format(in30DaysStart, "yyyy-MM-dd")}
    15 Days: ${format(in15DaysStart, "yyyy-MM-dd")}
    Expired: Before ${format(today, "yyyy-MM-dd")}
  `);

  // Target Recipients
  const recipient = "kunal.sharma@datagami.in";

  // Find 30 days
  const expiringIn30Days = await prisma.branchDocument.findMany({
    where: {
      renewalDate: {
        gte: in30DaysStart,
        lte: in30DaysEnd,
      },
    },
    include: {
      branch: true,
      documentType: true,
    },
  });

  // Find 15 days
  const expiringIn15Days = await prisma.branchDocument.findMany({
    where: {
      renewalDate: {
        gte: in15DaysStart,
        lte: in15DaysEnd,
      },
    },
    include: {
      branch: true,
      documentType: true,
    },
  });

  // Find already expired
  const alreadyExpired = await prisma.branchDocument.findMany({
    where: {
      renewalDate: {
        lt: today,
      },
    },
    include: {
      branch: true,
      documentType: true,
    },
  });

  const totalFound = expiringIn30Days.length + expiringIn15Days.length + alreadyExpired.length;

  if (totalFound === 0) {
    console.log("No documents found expiring in 30 days, 15 days, or already expired.");
    return {
      processed: 0,
      emailsSent: 0,
      details: { expired: 0, in15Days: 0, in30Days: 0 }
    };
  }

  // Determine if we should send an email today
  let emailHtml = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Outlet Documents Expiry Report</h2>
      <p>This is the daily automated report regarding the expiry status of outlet/branch documents.</p>
  `;

  let hasContent = false;

  const renderDocList = (title: string, docs: any[], color: string) => {
    if (docs.length === 0) return "";
    let html = `<h3 style="color: ${color}; border-bottom: 2px solid ${color}; padding-bottom: 5px;">${title} (${docs.length})</h3>`;
    html += `<ul style="list-style-type: none; padding-left: 0;">`;
    docs.forEach(doc => {
      html += `
        <li style="margin-bottom: 10px; padding: 10px; background-color: #f9f9f9; border-left: 4px solid ${color};">
          <strong>${doc.name}</strong> (${doc.documentType?.name || "Other"})<br/>
          <strong>Outlet:</strong> ${doc.branch.name}<br/>
          <strong>Expiry Date:</strong> ${format(new Date(doc.renewalDate), "PPP")}<br/>
          <a href="${doc.fileUrl}" style="color: #0066cc;">View Document</a>
        </li>
      `;
    });
    html += `</ul>`;
    return html;
  };

  if (alreadyExpired.length > 0) {
    hasContent = true;
    emailHtml += renderDocList("🚨 Already Expired (Action Required!)", alreadyExpired, "#dc2626");
  }

  if (expiringIn15Days.length > 0) {
    hasContent = true;
    emailHtml += renderDocList("⚠️ Expiring in 15 Days", expiringIn15Days, "#ea580c");
  }

  if (expiringIn30Days.length > 0) {
    hasContent = true;
    emailHtml += renderDocList("ℹ️ Expiring in 30 Days", expiringIn30Days, "#ca8a04");
  }

  emailHtml += `
      <p style="margin-top: 20px; font-size: 12px; color: #666;">
        This email was generated automatically by Opsy. Please log in to the dashboard to update these documents.
      </p>
    </div>
  `;

  let emailsSent = 0;

  if (hasContent) {
    try {
      await sendEmail({
        to: recipient,
        subject: `Opsy Alert: ${alreadyExpired.length} Expired, ${expiringIn15Days.length + expiringIn30Days.length} Expiring Outlet Documents`,
        html: emailHtml,
      });
      emailsSent++;
      console.log("Expiry report email sent successfully to", recipient);
    } catch (error) {
      console.error("Failed to send document expiry email:", error);
    }
  }

  return {
    processed: totalFound,
    emailsSent,
    details: {
      expired: alreadyExpired.length,
      in15Days: expiringIn15Days.length,
      in30Days: expiringIn30Days.length,
    }
  };
}
