import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { auth } from "@/auth";
import { PDFDocument, PDFPage, rgb } from 'pdf-lib';
import { addCompanyHeader } from '@/components/pdf/company-header';
import { generateAppointmentLetter } from '@/components/pdf/appointment-letter';
import {User} from "@/models/models";

// Company information
const companyInfo = {
  name: 'Thepla House By Tejal\'s Kitchen',
  address: 'Gala No. 6, Shriguppi Industrial Estate, Sakivihar Road, Andheri (E), Mumbai - 400072',
  phone: '+91 9819555065',
  website: 'www.theplahouse.com',
  email: 'info@theplahouse.com',
  logoPath: 'company/logo.png', // Path to logo in public directory
};

// Font sizes and spacing
const STYLES = {
  title: { size: 24, spacing: 30 },
  sectionHeader: { size: 14, spacing: 20 },
  content: { size: 12, spacing: 15 },
  margin: { left: 50, right: 50 },
};

// Helper function to add a new page
function addNewPage(pdfDoc: PDFDocument): [PDFPage, number] {
  const page = pdfDoc.addPage([595, 842]); // A4 size
  const startY = page.getSize().height - 50;
  return [page, startY];
}

// Helper function to add text
async function addText(page: PDFPage, text: string, x: number, y: number, fontSize: number = STYLES.content.size): Promise<number> {
  // Replace Rupee symbol with "Rs." to avoid encoding issues
  const safeText = text.replace('₹', 'Rs.');
  
  page.drawText(safeText, {
    x,
    y,
    size: fontSize,
    color: rgb(0, 0, 0),
  });
  return y - STYLES.content.spacing;
}

// Helper function to add user image
async function addUserImage(pdfDoc: PDFDocument, page: PDFPage, imageUrl: string | null, y: number): Promise<number> {
  if (!imageUrl) return y - 50; // Return with some spacing even if no image

  try {
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error('Failed to fetch image');
    const imageBuffer = await response.arrayBuffer();
    
    const image = await pdfDoc.embedPng(new Uint8Array(imageBuffer));
    
    // Scale image to reasonable size (80x80 pixels - slightly smaller)
    const scaledDims = image.scale(80 / image.width);
    
    const { width } = page.getSize();
    const x = (width - scaledDims.width) / 2;
    
    page.drawImage(image, {
      x,
      y: y - scaledDims.height,
      width: scaledDims.width,
      height: scaledDims.height,
    });

    return y - scaledDims.height - 30; // Return new Y position with padding
  } catch (error) {
    console.error('Error adding user image:', error);
    return y - 50; // Return with some spacing even if image fails
  }
}

// Helper function to add joining form details
async function addJoiningFormDetails(page: PDFPage, user: User, y: number): Promise<number> {
  const { width } = page.getSize();
  const leftMargin = STYLES.margin.left;
  const rightColumn = width / 2 + 20;
  
  // Add section title
  page.drawText('Personal Information', {
    x: leftMargin,
    y,
    size: STYLES.sectionHeader.size,
    color: rgb(0, 0, 0),
  });
  y -= STYLES.sectionHeader.spacing;

  // Left column - Personal Information
  y = await addText(page, `Name: ${user.name || 'N/A'}`, leftMargin, y);
  y = await addText(page, `Email: ${user.email || 'N/A'}`, leftMargin, y);
  y = await addText(page, `Phone: ${user.mobileNo || 'N/A'}`, leftMargin, y);
  y = await addText(page, `Date of Birth: ${user.dob ? new Date(user.dob).toLocaleDateString() : 'N/A'}`, leftMargin, y);

  // Add some spacing before employment details
  y -= STYLES.sectionHeader.spacing;

  // Employment Details section
  page.drawText('Employment Details', {
    x: leftMargin,
    y,
    size: STYLES.sectionHeader.size,
    color: rgb(0, 0, 0),
  });
  y -= STYLES.sectionHeader.spacing;

  y = await addText(page, `Employee ID: ${user.numId || 'N/A'}`, leftMargin, y);
  y = await addText(page, `Position: ${user.role}${user.department ? ` (${user.department})` : ''}`, leftMargin, y);
  y = await addText(page, `Branch: ${user.branch?.name || 'N/A'}`, leftMargin, y);
  y = await addText(page, `Date of Joining: ${user.doj ? new Date(user.doj).toLocaleDateString() : 'N/A'}`, leftMargin, y);
  y = await addText(page, `Salary: Rs.${user.salary?.toLocaleString() || 'N/A'}`, leftMargin, y);

  // Add some spacing before government IDs
  y -= STYLES.sectionHeader.spacing;

  // Government IDs section
  page.drawText('Government IDs', {
    x: leftMargin,
    y,
    size: STYLES.sectionHeader.size,
    color: rgb(0, 0, 0),
  });
  y -= STYLES.sectionHeader.spacing;

  y = await addText(page, `Aadhaar Number: ${user.aadharNo || 'N/A'}`, leftMargin, y);
  y = await addText(page, `PAN Number: ${user.panNo || 'N/A'}`, leftMargin, y);

  // Add some spacing before bank details
  y -= STYLES.sectionHeader.spacing;

  // Bank Details section
  page.drawText('Bank Details', {
    x: leftMargin,
    y,
    size: STYLES.sectionHeader.size,
    color: rgb(0, 0, 0),
  });
  y -= STYLES.sectionHeader.spacing;

  y = await addText(page, `Account Number: ${user.bankAccountNo || 'N/A'}`, leftMargin, y);
  y = await addText(page, `IFSC Code: ${user.bankIfscCode || 'N/A'}`, leftMargin, y);

  // Add some spacing before references
  y -= STYLES.sectionHeader.spacing;

  // References section
  page.drawText('References', {
    x: leftMargin,
    y,
    size: STYLES.sectionHeader.size,
    color: rgb(0, 0, 0),
  });
  y -= STYLES.sectionHeader.spacing;

  // Add references in two columns
  if (user.references && user.references.length > 0) {
    let leftY = y;
    let rightY = y;

    // First reference on left
    if (user.references[0]) {
      leftY = await addText(page, `Reference 1:`, leftMargin, leftY);
      leftY = await addText(page, `Name: ${user.references[0].name || 'N/A'}`, leftMargin, leftY);
      leftY = await addText(page, `Phone: ${user.references[0].contactNo || 'N/A'}`, leftMargin, leftY);
    }

    // Second reference on right
    if (user.references[1]) {
      rightY = await addText(page, `Reference 2:`, rightColumn, rightY);
      rightY = await addText(page, `Name: ${user.references[1].name || 'N/A'}`, rightColumn, rightY);
      rightY = await addText(page, `Phone: ${user.references[1].contactNo || 'N/A'}`, rightColumn, rightY);
    }

    // Use the lower Y position of the two columns
    y = Math.min(leftY, rightY);
  } else {
    y = await addText(page, 'No references provided', leftMargin, y);
  }

  // Add some spacing before signature section
  y -= STYLES.sectionHeader.spacing * 2;

  // Signature section
  const signatureY = y;

  // Employee signature
  page.drawText('Employee Signature:', {
    x: leftMargin,
    y: signatureY,
    size: STYLES.content.size,
    color: rgb(0, 0, 0),
  });
  
  // Draw signature line for employee
  page.drawLine({
    start: { x: leftMargin, y: signatureY - 30 },
    end: { x: leftMargin + 200, y: signatureY - 30 },
    thickness: 1,
    color: rgb(0, 0, 0),
  });

  // Draw date line for employee
  page.drawText('Date:', {
    x: leftMargin,
    y: signatureY - 50,
    size: STYLES.content.size,
    color: rgb(0, 0, 0),
  });
  page.drawLine({
    start: { x: leftMargin + 40, y: signatureY - 50 },
    end: { x: leftMargin + 200, y: signatureY - 50 },
    thickness: 1,
    color: rgb(0, 0, 0),
  });

  // HR signature
  page.drawText('HR Signature:', {
    x: width - STYLES.margin.right - 200,
    y: signatureY,
    size: STYLES.content.size,
    color: rgb(0, 0, 0),
  });
  
  // Draw signature line for HR
  page.drawLine({
    start: { x: width - STYLES.margin.right - 200, y: signatureY - 30 },
    end: { x: width - STYLES.margin.right, y: signatureY - 30 },
    thickness: 1,
    color: rgb(0, 0, 0),
  });

  // Draw date line for HR
  page.drawText('Date:', {
    x: width - STYLES.margin.right - 200,
    y: signatureY - 50,
    size: STYLES.content.size,
    color: rgb(0, 0, 0),
  });
  page.drawLine({
    start: { x: width - STYLES.margin.right - 160, y: signatureY - 50 },
    end: { x: width - STYLES.margin.right, y: signatureY - 50 },
    thickness: 1,
    color: rgb(0, 0, 0),
  });

  return signatureY - 70; // Return new Y position with padding
}

export async function GET(request: Request) {
  try {
    const session = await auth();
    // @ts-expect-error - Ignoring role type error as it's handled by auth configuration
    if (!session?.user || !session.user.role || !['HR', 'MANAGEMENT'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        branch: true,
        references: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Create a new PDF document
    const pdfDoc = await PDFDocument.create();
    // eslint-disable-next-line prefer-const
    let [page, y] = addNewPage(pdfDoc);

    // Add company header
    y = await addCompanyHeader(pdfDoc, page, companyInfo);
    y -= STYLES.title.spacing;

    // Add user image
    y = await addUserImage(pdfDoc, page, user.image || null, y);

    // Add joining form details
    // @ts-expect-error - Ignoring type error as user is already defined
    await addJoiningFormDetails(page, user, y);

    // Generate appointment letter data with null checks
    const appointmentData = {
      employeeName: user.name || '',
      joiningDate: user.doj ? new Date(user.doj).toLocaleDateString() : 'N/A',
      jobTitle: user.role || '',
      department: user.department || '',
      salary: user.salary || 0,
      contractStartDate: user.doj ? new Date(user.doj).toLocaleDateString() : 'N/A',
      contractEndDate: user.doj 
        ? new Date(new Date(user.doj).setFullYear(new Date(user.doj).getFullYear() + 5)).toLocaleDateString()
        : 'N/A',
    };

    // Add appointment letter pages
    await generateAppointmentLetter(pdfDoc, appointmentData);

    // Save the PDF
    const pdfBytes = await pdfDoc.save();

    // Return the PDF as a response
    return new NextResponse(pdfBytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="employee-documents-${user.numId}.pdf"`,
      },
    });
  } catch (error) {
    console.error('Failed to generate documents:', error);
    return NextResponse.json(
      { error: 'Failed to generate documents' },
      { status: 500 }
    );
  }
}
