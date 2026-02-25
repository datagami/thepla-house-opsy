import * as fs from "fs";
import * as path from "path";
import { format } from "date-fns";

/**
 * EMAIL PREVIEW SCRIPT
 * Run with: npx tsx scripts/preview-email.ts
 * 
 * This generates a mock email with fake data so you can 
 * see what it looks like in your browser.
 */

const mockDocs = [
    {
        name: "Trade License 2024",
        documentType: { name: "Legal" },
        branch: { name: "Mumbai Main" },
        renewalDate: new Date(),
        fileUrl: "#"
    },
    {
        name: "Fire Safety Certificate",
        documentType: { name: "Safety" },
        branch: { name: "Delhi South" },
        renewalDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
        fileUrl: "#"
    }
];

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

let emailHtml = `
  <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 20px;">
    <h2 style="color: #333;">Outlet Documents Expiry Report (PREVIEW)</h2>
    <p>This is a preview of the daily automated report.</p>
`;

emailHtml += renderDocList("🚨 Already Expired", [mockDocs[0]], "#dc2626");
emailHtml += renderDocList("⚠️ Expiring in 15 Days", [mockDocs[1]], "#ea580c");

emailHtml += `
    <p style="margin-top: 20px; font-size: 12px; color: #666;">
      This email was generated automatically by Opsy.
    </p>
  </div>
`;

const outputPath = path.join(process.cwd(), "email-preview.html");
fs.writeFileSync(outputPath, emailHtml);

console.log(`\n✨ Preview generated!`);
console.log(`📍 File location: ${outputPath}`);
console.log(`👉 Open this file in your browser to see the email layout.\n`);
