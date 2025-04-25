import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { auth } from "@/auth";
import { PDFDocument, PDFPage, rgb } from 'pdf-lib';
import { addCompanyHeader } from '@/components/pdf/company-header';
import { generateAppointmentLetter } from '@/components/pdf/appointment-letter';

// Company information
const companyInfo = {
  name: 'Thepla House',
  address: 'Gala No. 6, Shriguppi Industrial Estate, Sakivihar Road, Andheri (E), Mumbai - 400072',
  phone: '+91 9819555065',
  website: 'www.theplahouse.com',
  email: 'info@theplahouse.com',
  logoPath: 'company/logo.png', // Path to logo in public directory
};

// Font sizes and spacing
const STYLES = {
  title: { size: 24, spacing: 50 },
  sectionHeader: { size: 14, spacing: 25 },
  content: { size: 12, spacing: 20 },
  margin: { left: 50, right: 50 },
};

// Helper function to add a new page
function addNewPage(pdfDoc: PDFDocument): [PDFPage, number] {
  const page = pdfDoc.addPage([595, 842]); // A4 size
  const startY = page.getSize().height - 50;
  return [page, startY];
}

// Helper function to check if we need a new page
function needsNewPage(currentY: number): boolean {
  return currentY < 100; // Leave some margin at the bottom
}

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user || !['HR', 'MANAGEMENT'].includes(session.user.role as string)) {
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
    let [page, y] = addNewPage(pdfDoc);
    const { width } = page.getSize();

    // Add company header
    y = await addCompanyHeader(pdfDoc, page, companyInfo);
    y -= STYLES.title.spacing;

    // Add form title
    page.drawText('Employee Joining Form', {
      x: STYLES.margin.left,
      y,
      size: STYLES.title.size,
    });

    // Draw underline for the title
    page.drawLine({
      start: { x: STYLES.margin.left, y: y - 5 },
      end: { x: width - STYLES.margin.right, y: y - 5 },
      thickness: 1,
      color: rgb(0, 0, 0),
    });

    y -= STYLES.title.spacing;

    // Calculate column widths and positions
    const contentWidth = width - STYLES.margin.left - STYLES.margin.right;
    const columnWidth = contentWidth / 2;
    const column2X = STYLES.margin.left + columnWidth + 20;

    // First Column: Personal & Employment Info
    // Add personal information
    page.drawText('Personal Information:', {
      x: STYLES.margin.left,
      y,
      size: STYLES.sectionHeader.size,
    });
    y -= STYLES.sectionHeader.spacing;

    const personalInfo = [
      `Name: ${user.name}`,
      `Employee ID: ${user.numId}`,
      `Mobile: ${user.mobileNo}`,
      `Gender: ${user.gender}`,
      `Date of Birth: ${user.dob ? new Date(user.dob).toLocaleDateString() : 'N/A'}`,
    ];

    let column2Y = y; // Save Y position for second column

    personalInfo.forEach(info => {
      page.drawText(info, {
        x: STYLES.margin.left,
        y,
        size: STYLES.content.size,
      });
      y -= STYLES.content.spacing;
    });

    y -= STYLES.sectionHeader.spacing;

    // Add employment details
    page.drawText('Employment Details:', {
      x: STYLES.margin.left,
      y,
      size: STYLES.sectionHeader.size,
    });
    y -= STYLES.sectionHeader.spacing;

    const employmentInfo = [
      `Department: ${user.department}`,
      `Title: ${user.title}`,
      `Role: ${user.role}`,
      `Branch: ${user.branch?.name || 'N/A'}`,
      `Date of Joining: ${user.doj ? new Date(user.doj).toLocaleDateString() : 'N/A'}`,
      `Salary: Rs. ${user.salary}`,
    ];

    employmentInfo.forEach(info => {
      page.drawText(info, {
        x: STYLES.margin.left,
        y,
        size: STYLES.content.size,
      });
      y -= STYLES.content.spacing;
    });

    // Second Column: Bank Details & Government IDs
    // Add bank details
    page.drawText('Bank Details:', {
      x: column2X,
      y: column2Y,
      size: STYLES.sectionHeader.size,
    });
    column2Y -= STYLES.sectionHeader.spacing;

    const bankInfo = [
      `Account Number: ${user.bankAccountNo}`,
      `IFSC Code: ${user.bankIfscCode}`,
    ];

    bankInfo.forEach(info => {
      page.drawText(info, {
        x: column2X,
        y: column2Y,
        size: STYLES.content.size,
      });
      column2Y -= STYLES.content.spacing;
    });

    column2Y -= STYLES.sectionHeader.spacing;

    // Add government IDs
    page.drawText('Government IDs:', {
      x: column2X,
      y: column2Y,
      size: STYLES.sectionHeader.size,
    });
    column2Y -= STYLES.sectionHeader.spacing;

    const govInfo = [
      `PAN: ${user.panNo}`,
      `Aadhar: ${user.aadharNo}`,
    ];

    govInfo.forEach(info => {
      page.drawText(info, {
        x: column2X,
        y: column2Y,
        size: STYLES.content.size,
      });
      column2Y -= STYLES.content.spacing;
    });

    // Use the lowest Y value between the two columns
    y = Math.min(y, column2Y);
    y -= STYLES.title.spacing;

    // Check if we need a new page for signatures
    if (needsNewPage(y)) {
      [page, y] = addNewPage(pdfDoc);
    }

    // Add signature sections with lines
    const signatureY = y;
    
    // Employee signature
    page.drawText('Employee Signature:', {
      x: STYLES.margin.left,
      y: signatureY,
      size: STYLES.content.size,
    });
    
    // Draw signature line for employee
    page.drawLine({
      start: { x: STYLES.margin.left, y: signatureY - 30 },
      end: { x: STYLES.margin.left + 200, y: signatureY - 30 },
      thickness: 1,
      color: rgb(0, 0, 0),
    });

    // Draw date line for employee
    page.drawText('Date:', {
      x: STYLES.margin.left,
      y: signatureY - 50,
      size: STYLES.content.size,
    });
    page.drawLine({
      start: { x: STYLES.margin.left + 40, y: signatureY - 50 },
      end: { x: STYLES.margin.left + 200, y: signatureY - 50 },
      thickness: 1,
      color: rgb(0, 0, 0),
    });

    // HR signature
    page.drawText('HR Signature:', {
      x: width - STYLES.margin.right - 200,
      y: signatureY,
      size: STYLES.content.size,
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
    });
    page.drawLine({
      start: { x: width - STYLES.margin.right - 160, y: signatureY - 50 },
      end: { x: width - STYLES.margin.right, y: signatureY - 50 },
      thickness: 1,
      color: rgb(0, 0, 0),
    });

    // Generate appointment letter
    const appointmentData = {
      employeeName: user.name,
      joiningDate: new Date(user.doj).toLocaleDateString(),
      jobTitle: user.role,
      salary: user.salary,
      contractStartDate: new Date(user.doj).toLocaleDateString(),
      contractEndDate: new Date(new Date(user.doj).setFullYear(new Date(user.doj).getFullYear() + 5)).toLocaleDateString(),
    };

    // Add appointment letter pages
    await generateAppointmentLetter(pdfDoc, appointmentData, companyInfo);

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
