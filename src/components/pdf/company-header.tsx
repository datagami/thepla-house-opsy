import { PDFDocument, PDFPage, rgb } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

interface CompanyInfo {
  name: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  logoPath?: string; // Path to logo in public directory
}

export async function addCompanyHeader(
  pdfDoc: PDFDocument,
  page: PDFPage,
  companyInfo: CompanyInfo
) {
  const { width } = page.getSize();
  let logoWidth = 0;
  const startY = page.getSize().height - 50;
  
  // Add company logo if available
  if (companyInfo.logoPath) {
    try {
      const logoPath = path.join(process.cwd(), 'public', companyInfo.logoPath);
      const logoBuffer = fs.readFileSync(logoPath);
      const logoImage = await pdfDoc.embedPng(logoBuffer);
      const logoDims = logoImage.scale(0.15); // Scale down the logo more
      logoWidth = logoDims.width + 20; // Add some padding

      page.drawImage(logoImage, {
        x: 50,
        y: startY - logoDims.height + 15, // Align with text
        width: logoDims.width,
        height: logoDims.height,
      });
    } catch (error) {
      console.error('Error embedding logo:', error);
    }
  }

  // Add company name
  page.drawText(companyInfo.name, {
    x: 50 + logoWidth,
    y: startY,
    size: 16,
  });

  // Add address
  page.drawText(companyInfo.address, {
    x: 50 + logoWidth,
    y: startY - 20,
    size: 10,
  });

  // Add contact details in a row
  const contactY = startY - 35;
  const contactWidth = (width - 100 - logoWidth) / 2; // Divide space for 2 items instead of 3

  // Phone
  page.drawText(`Phone: ${companyInfo.phone}`, {
    x: 50 + logoWidth,
    y: contactY,
    size: 10,
  });

  // Email
  page.drawText(`Email: ${companyInfo.email}`, {
    x: 50 + logoWidth + contactWidth,
    y: contactY,
    size: 10,
  });

  // Website on next line
  page.drawText(`Website: ${companyInfo.website}`, {
    x: 50 + logoWidth,
    y: contactY - 15,
    size: 10,
  });

  // Add a separator line
  page.drawLine({
    start: { x: 50, y: contactY - 30 },
    end: { x: width - 50, y: contactY - 30 },
    thickness: 1,
    color: rgb(0, 0, 0),
  });

  return contactY - 40; // Return the new y position for the next content
} 