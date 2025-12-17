import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { PDFDocument, PDFPage, PDFImage, StandardFonts, rgb } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

// Load and embed signature image
async function loadSignature(pdfDoc: PDFDocument) {
  try {
    const signaturePath = path.join(process.cwd(), 'public', 'company', 'signature.png');
    const signatureBuffer = fs.readFileSync(signaturePath);
    const signatureImage = await pdfDoc.embedPng(signatureBuffer);
    return signatureImage;
  } catch {
    return null;
  }
}

// Load and embed letterhead image
async function loadLetterhead(pdfDoc: PDFDocument) {
  try {
    const letterheadPath = path.join(process.cwd(), 'public', 'company', 'letterhead.png');
    const letterheadBuffer = fs.readFileSync(letterheadPath);
    
    // Try JPEG first (the file is actually a JPEG despite .png extension)
    let letterheadImage;
    try {
      letterheadImage = await pdfDoc.embedJpg(letterheadBuffer);
    } catch {
      // If JPEG fails, try PNG
      try {
        letterheadImage = await pdfDoc.embedPng(letterheadBuffer);
      } catch (pngError) {
        console.error('Failed to embed as both JPEG and PNG:', pngError);
        return null;
      }
    }
    
    console.log('Letterhead image loaded successfully:', {
      width: letterheadImage.width,
      height: letterheadImage.height,
    });
    return letterheadImage;
  } catch (error) {
    console.error('Error loading letterhead image:', error);
    return null;
  }
}

// Draw letterhead as background
async function drawLetterheadBackground(
  pdfDoc: PDFDocument, 
  page: PDFPage, 
  letterheadImage: PDFImage | null
): Promise<number> {
  const { width, height } = page.getSize();
  
  if (letterheadImage) {
    try {
      // Draw letterhead to fill the entire page (stretch to fit)
      page.drawImage(letterheadImage, {
        x: 0,
        y: 0,
        width: width,
        height: height,
      });
      console.log('Letterhead drawn on page:', { 
        width, 
        height, 
        imageWidth: letterheadImage.width, 
        imageHeight: letterheadImage.height 
      });
    } catch (error) {
      console.error('Error drawing letterhead:', error);
    }
  } else {
    console.warn('Letterhead image is null, not drawing background');
  }
  
  // Return starting Y position for content (after the header area of letterhead)
  // Based on typical letterhead design, content usually starts around 200-250 points from top
  return height - 200;
}

// Format number in Indian format
function formatIndianCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0,
  }).format(amount);
}

// Convert number to words (simplified for Indian numbering system)
function numberToWords(num: number): string {
  if (num === 0) return 'Zero';
  if (num < 0) return 'Negative ' + numberToWords(-num);
  
  const ones = [
    '',
    'One',
    'Two',
    'Three',
    'Four',
    'Five',
    'Six',
    'Seven',
    'Eight',
    'Nine',
    'Ten',
    'Eleven',
    'Twelve',
    'Thirteen',
    'Fourteen',
    'Fifteen',
    'Sixteen',
    'Seventeen',
    'Eighteen',
    'Nineteen',
  ];
  const tens = [
    '',
    '',
    'Twenty',
    'Thirty',
    'Forty',
    'Fifty',
    'Sixty',
    'Seventy',
    'Eighty',
    'Ninety',
  ];

  // Handle numbers less than 20
  if (num < 20) return ones[num];
  
  // Handle numbers 20-99
  if (num < 100) {
    const ten = Math.floor(num / 10);
    const one = num % 10;
    return tens[ten] + (one ? ' ' + ones[one] : '');
  }
  
  // Handle numbers 100-999
  if (num < 1000) {
    const hundred = Math.floor(num / 100);
    const remainder = num % 100;
    return ones[hundred] + ' Hundred' + (remainder ? ' ' + numberToWords(remainder) : '');
  }
  
  // Handle numbers 1000-99999 (thousands)
  if (num < 100000) {
    const thousand = Math.floor(num / 1000);
    const remainder = num % 1000;
    if (thousand < 100) {
      return numberToWords(thousand) + ' Thousand' + (remainder ? ' ' + numberToWords(remainder) : '');
    } else {
      // For numbers like 10000, we need to handle it differently
      const thousandWords = numberToWords(thousand);
      return thousandWords + ' Thousand' + (remainder ? ' ' + numberToWords(remainder) : '');
    }
  }
  
  // Handle numbers 100000-9999999 (lakhs)
  if (num < 10000000) {
    const lakh = Math.floor(num / 100000);
    const remainder = num % 100000;
    return numberToWords(lakh) + ' Lakh' + (remainder ? ' ' + numberToWords(remainder) : '');
  }
  
  // Handle numbers 10000000+ (crores)
  const crore = Math.floor(num / 10000000);
  const remainder = num % 10000000;
  return numberToWords(crore) + ' Crore' + (remainder ? ' ' + numberToWords(remainder) : '');
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // @ts-expect-error - role is not in the User type
    const canViewJobOffers = ['HR', 'MANAGEMENT'].includes(session.user.role);
    if (!canViewJobOffers) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    const jobOffer = await prisma.jobOffer.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            mobileNo: true,
          },
        },
        department: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!jobOffer) {
      return NextResponse.json(
        { error: 'Job offer not found' },
        { status: 404 }
      );
    }

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]);
    const { width, height } = page.getSize();

    const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    // Load images once for reuse on both pages
    const signatureImage = await loadSignature(pdfDoc);
    const letterheadImage = await loadLetterhead(pdfDoc);

    // Draw letterhead background
    let y = await drawLetterheadBackground(pdfDoc, page, letterheadImage);

    // Date (right aligned, positioned in the header area of letterhead)
    const offerDate = new Date(jobOffer.offerDate);
    const dateStr = offerDate.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    const dateWidth = regularFont.widthOfTextAtSize(dateStr, 10);
    // Position date in the top right area of the letterhead (around 100 points from top)
    page.drawText(dateStr, {
      x: width - 50 - dateWidth,
      y: height - 100,
      size: 10,
      font: regularFont,
    });

    // Start content below the letterhead header area
    y = height - 200;

    // Recipient name and city
    page.drawText(`Mr. ${jobOffer.name}`, { x: 50, y, size: 11, font: regularFont });
    y -= 15;
    page.drawText('Mumbai.', { x: 50, y, size: 11, font: regularFont });
    y -= 30;

    // Subject line
    const subjectText = `Subject: Letter of offer for the post of ${jobOffer.designation}`;
    page.drawText(subjectText, {
      x: 50,
      y,
      size: 11,
      font: boldFont,
    });
    y -= 30;

    // Salutation
    page.drawText(`Dear Mr. ${jobOffer.name},`, {
      x: 50,
      y,
      size: 11,
      font: regularFont,
    });
    y -= 30;

    // Offer statement
    const offerStatement = `We are pleased to offer you an opportunity to work as ${jobOffer.designation}, With THEPLA HOUSE BY TEJAL'S KITCHEN on following terms:`;
    const words = offerStatement.split(' ');
    let currentLine = '';
    const lineHeight = 15;
    const maxWidth = 495;

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const testWidth = regularFont.widthOfTextAtSize(testLine, 11);
      if (testWidth < maxWidth) {
        currentLine = testLine;
      } else {
        if (currentLine) {
          page.drawText(currentLine, {
            x: 50,
            y,
            size: 11,
            font: regularFont,
          });
          y -= lineHeight;
        }
        currentLine = word;
      }
    }
    if (currentLine) {
      page.drawText(currentLine, {
        x: 50,
        y,
        size: 11,
        font: regularFont,
      });
      y -= lineHeight;
    }

    y -= 20;

    // Terms
    // Convert salary to words (for amounts in lakhs)
    const salaryInLakhs = Math.floor(jobOffer.totalSalary / 100000);
    const remainderInThousands = Math.floor((jobOffer.totalSalary % 100000) / 1000);
    let salaryWords = '';
    if (salaryInLakhs > 0) {
      salaryWords = numberToWords(salaryInLakhs) + ' Lakh';
      if (remainderInThousands > 0) {
        salaryWords += ' ' + numberToWords(remainderInThousands) + ' Thousand';
      }
    } else if (remainderInThousands > 0) {
      salaryWords = numberToWords(remainderInThousands) + ' Thousand';
    } else {
      salaryWords = numberToWords(Math.floor(jobOffer.totalSalary / 1000)) + ' Thousand';
    }
    
    const terms = [
      `Your total cost to company will be ${formatIndianCurrency(jobOffer.totalSalary)}/- (${salaryWords} per annum).`,
      `Your Employment should commence on or before ${jobOffer.joiningDate ? new Date(jobOffer.joiningDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'TBD'} ("Joining Date"). Your failure to accept the offer. On or before the Joining date will be presumed that you are not interested in the offer and the offer will stand revoked on the respective date.`,
      'You will be given your letter of Appointment enumerating terms and conditions within same day of Joining.',
      'Please, sign the duplicate copy of this letter as a token of your acceptance and send us immediately. You shall also submit the copy of your resignation duly accepted by your present employer.',
      `You will not be eligible for National Public Holiday's However, you will be eligible for ${numberToWords(jobOffer.weekOff || 2)} week off${(jobOffer.weekOff || 2) !== 1 ? 's' : ''} and ${numberToWords(jobOffer.halfDays || 4)} half day${(jobOffer.halfDays || 4) !== 1 ? 's' : ''} in a month.`,
    ];

    for (const term of terms) {
      const termWords = term.split(' ');
      let termLine = '';
      for (const word of termWords) {
        const testLine = termLine ? `${termLine} ${word}` : word;
        const testWidth = regularFont.widthOfTextAtSize(testLine, 10);
        if (testWidth < maxWidth) {
          termLine = testLine;
        } else {
          if (termLine) {
            page.drawText(termLine, {
              x: 50,
              y,
              size: 10,
              font: regularFont,
            });
            y -= lineHeight;
            if (y < 100) {
              // New page
              const newPage = pdfDoc.addPage([595, 842]);
              await drawLetterheadBackground(pdfDoc, newPage, letterheadImage);
              const { height: newHeight } = newPage.getSize();
              y = newHeight - 200;
            }
          }
          termLine = word;
        }
      }
      if (termLine) {
        page.drawText(termLine, {
          x: 50,
          y,
          size: 10,
          font: regularFont,
        });
        y -= lineHeight;
        if (y < 100) {
          const newPage = pdfDoc.addPage([595, 842]);
          await drawLetterheadBackground(pdfDoc, newPage, letterheadImage);
          const { height: newHeight } = newPage.getSize();
          y = newHeight - 200;
        }
      }
      y -= 10; // Space between terms
    }

    // Signatures section
    y = Math.max(y, 200);
    y -= 30;

    // For Thepla House
    page.drawText('For Thepla House.:', {
      x: 50,
      y,
      size: 10,
      font: regularFont,
    });
    y -= 15; // Space before signature
    
    // Draw signature image
    if (signatureImage) {
      // Scale signature to appropriate size (width ~120px)
      const signatureWidth = 120;
      const signatureHeight = (signatureImage.height / signatureImage.width) * signatureWidth;
      
      page.drawImage(signatureImage, {
        x: 50,
        y: y - signatureHeight,
        width: signatureWidth,
        height: signatureHeight,
      });
      y -= signatureHeight + 10; // Space after signature
    } else {
      // Fallback to text if signature image not found
      y -= 35;
      page.drawText('Tejal Shah', {
        x: 50,
        y,
        size: 10,
        font: boldFont,
      });
      y -= 12;
    }
    
    // Add "Tejal Shah" in bold before "(Authorised Signatory)"
    page.drawText('Tejal Shah', {
      x: 50,
      y,
      size: 10,
      font: boldFont,
    });
    y -= 12;
    
    page.drawText('(Authorised Signatory)', {
      x: 50,
      y,
      size: 9,
      font: regularFont,
    });

    // Accepted By
    page.drawText('Accepted By:', {
      x: 350,
      y: y + 50,
      size: 10,
      font: regularFont,
    });
    y -= 50; // Space for signature
    page.drawText(jobOffer.name, {
      x: 350,
      y,
      size: 10,
      font: regularFont,
    });

    // Page 2 - Salary Breakup
    const page2 = pdfDoc.addPage([595, 842]);
    // Draw letterhead background on page 2
    await drawLetterheadBackground(pdfDoc, page2, letterheadImage);
    const { height: page2Height } = page2.getSize();
    let y2 = page2Height - 200;
    y2 -= 30;

    // Salary Break Up title
    page2.drawText('Salary Break Up', {
      x: 50,
      y: y2,
      size: 14,
      font: boldFont,
    });
    y2 -= 30;

    // Table headers
    const col1X = 50;
    const col2X = 250;
    const col3X = 400;
    const rowHeight = 25;

    page2.drawText('Header', { x: col1X, y: y2, size: 11, font: boldFont });
    page2.drawText('Per Annum', {
      x: col2X,
      y: y2,
      size: 11,
      font: boldFont,
    });
    page2.drawText('Per Month', {
      x: col3X,
      y: y2,
      size: 11,
      font: boldFont,
    });

    // Draw table lines
    y2 -= 5;
    page2.drawLine({
      start: { x: col1X, y: y2 },
      end: { x: width - 50, y: y2 },
      thickness: 1,
      color: rgb(0, 0, 0),
    });
    y2 -= rowHeight;

    // Table rows - use salaryComponents if available, otherwise fall back to legacy fields
    let rows: Array<{ label: string; perAnnum: number; perMonth: number }> = [];
    
    if (jobOffer.salaryComponents && Array.isArray(jobOffer.salaryComponents)) {
      // Use new dynamic components
      const components = jobOffer.salaryComponents as Array<{
        name: string;
        perAnnum: number;
        perMonth: number;
      }>;
      
      // Add all components
      rows = components.map((comp) => ({
        label: comp.name,
        perAnnum: comp.perAnnum,
        perMonth: comp.perMonth,
      }));
      
      // Calculate subtotal
      const subtotalPerAnnum = components.reduce((sum, comp) => sum + comp.perAnnum, 0);
      const subtotalPerMonth = components.reduce((sum, comp) => sum + comp.perMonth, 0);
      
      // Add subtotal row
      rows.push({
        label: 'Sub Total (A)',
        perAnnum: subtotalPerAnnum,
        perMonth: subtotalPerMonth,
      });
    } else {
      // Fall back to legacy fields for backward compatibility
      rows = [
        {
          label: 'Basic',
          perAnnum: jobOffer.basicPerAnnum || 0,
          perMonth: jobOffer.basicPerMonth || 0,
        },
        {
          label: 'Other Allowances',
          perAnnum: jobOffer.otherAllowancesPerAnnum || 0,
          perMonth: jobOffer.otherAllowancesPerMonth || 0,
        },
        {
          label: 'Sub Total (A)',
          perAnnum: jobOffer.subtotalPerAnnum || 0,
          perMonth: jobOffer.subtotalPerMonth || 0,
        },
      ];
    }
    
    // Add total row
    rows.push({
      label: 'Total Cost to Company',
      perAnnum: jobOffer.totalSalary,
      perMonth: jobOffer.totalSalary / 12,
    });

    for (const row of rows) {
      page2.drawText(row.label, {
        x: col1X,
        y: y2,
        size: 10,
        font: row.label.includes('Total') ? boldFont : regularFont,
      });
      page2.drawText(formatIndianCurrency(row.perAnnum), {
        x: col2X,
        y: y2,
        size: 10,
        font: row.label.includes('Total') ? boldFont : regularFont,
      });
      page2.drawText(formatIndianCurrency(row.perMonth), {
        x: col3X,
        y: y2,
        size: 10,
        font: row.label.includes('Total') ? boldFont : regularFont,
      });
      y2 -= rowHeight;
    }

    // Notes section
    y2 -= 30;
    page2.drawText('Note: -', {
      x: col1X,
      y: y2,
      size: 10,
      font: boldFont,
    });
    y2 -= 20;
    
    // Only show food and stay note if it's provided
    if (jobOffer.foodAndStayProvided) {
      page2.drawText('• Food & Accommodation provided.', {
        x: col1X + 10,
        y: y2,
        size: 10,
        font: regularFont,
      });
      y2 -= 15;
    }
    const note2 =
      '• You will be solely responsible for payment of your income tax. The company will deduct Income Tax based on the documents submitted by you from your monthly compensation and remit such monies to the tax authorities on your behalf.';
    const note2Words = note2.split(' ');
    let note2Line = '';
    for (const word of note2Words) {
      const testLine = note2Line ? `${note2Line} ${word}` : word;
      const testWidth = regularFont.widthOfTextAtSize(testLine, 10);
      if (testWidth < maxWidth - 20) {
        note2Line = testLine;
      } else {
        if (note2Line) {
          page2.drawText(note2Line, {
            x: col1X + 10,
            y: y2,
            size: 10,
            font: regularFont,
          });
          y2 -= 15;
        }
        note2Line = word;
      }
    }
    if (note2Line) {
      page2.drawText(note2Line, {
        x: col1X + 10,
        y: y2,
        size: 10,
        font: regularFont,
      });
    }

    // Signatures on page 2
    y2 = 150;
    page2.drawText('For Thepla House.:', {
      x: col1X,
      y: y2,
      size: 10,
      font: regularFont,
    });
    y2 -= 15; // Space before signature
    
    // Draw signature image on page 2
    if (signatureImage) {
      // Scale signature to appropriate size (width ~120px)
      const signatureWidth = 120;
      const signatureHeight = (signatureImage.height / signatureImage.width) * signatureWidth;
      
      page2.drawImage(signatureImage, {
        x: col1X,
        y: y2 - signatureHeight,
        width: signatureWidth,
        height: signatureHeight,
      });
      y2 -= signatureHeight + 10; // Space after signature
    } else {
      // Fallback to text if signature image not found
      y2 -= 35;
      page2.drawText('Tejal Shah', {
        x: col1X,
        y: y2,
        size: 10,
        font: boldFont,
      });
      y2 -= 12;
    }
    
    // Add "Tejal Shah" in bold before "(Authorised Signatory)"
    page2.drawText('Tejal Shah', {
      x: col1X,
      y: y2,
      size: 10,
      font: boldFont,
    });
    y2 -= 12;
    
    page2.drawText('(Authorised Signatory)', {
      x: col1X,
      y: y2,
      size: 9,
      font: regularFont,
    });

    page2.drawText('Accepted By', {
      x: col3X,
      y: y2 + 50,
      size: 10,
      font: regularFont,
    });
    page2.drawText(jobOffer.name, {
      x: col3X,
      y: y2,
      size: 10,
      font: regularFont,
    });

    // Save PDF
    const bytes = await pdfDoc.save();
    const fileName = `offer-letter-${jobOffer.name.replace(/[^a-zA-Z0-9]/g, '-')}-${jobOffer.id}.pdf`;

    return new NextResponse(bytes as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error('Error generating offer letter:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
