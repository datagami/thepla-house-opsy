import { PDFDocument, PDFPage, rgb, StandardFonts } from 'pdf-lib';
import path from 'path';
import fs from 'fs';

interface AppointmentLetterData {
  employeeName: string;
  joiningDate: string;
  jobTitle: string;
  department?: string;
  salary: number;
  contractStartDate: string;
  contractEndDate: string;
  userImagePath?: string;
}

// Company information
const companyInfo = {
  name: 'Thepla House',
  address: 'Gala No. 6, Shriguppi Industrial Estate, Sakivihar Road, Andheri (E), Mumbai - 400072',
  phone: '+91 9819555065',
  website: 'www.theplahouse.com',
  email: 'info@theplahouse.com',
  logoPath: 'company/logo.png', // Path to logo in public directory
};

// Helper function to check if we need a new page
function needsNewPage(currentY: number, requiredSpace: number = 100): boolean {
  return currentY < requiredSpace;
}

// Helper function to create a new page
async function createNewPage(pdfDoc: PDFDocument, data: AppointmentLetterData, isFirstPage: boolean = false): Promise<[PDFPage, number]> {
  const page = pdfDoc.addPage([595, 842]); // A4 size
  const y = await addPageHeader(pdfDoc, page, data, isFirstPage);
  return [page, y];
}

// Helper function to add text block with proper word wrapping and bold text support
async function addTextBlock(page: PDFPage, text: string, x: number, y: number, width: number, size: number = 10, lineSpacing: number = 1.5): Promise<number> {
  const pdfDoc = page.doc;
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const words = text.split(' ');
  let currentLine = '';
  let currentY = y;
  const lineHeight = size * lineSpacing;
  const maxWidth = width;
  let isBold = false;

  for (let i = 0; i < words.length; i++) {
    let word = words[i];
    
    // Handle bold text markers
    if (word.startsWith('**') && word.endsWith('**')) {
      word = word.slice(2, -2); // Remove ** markers
      isBold = true;
    }

    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const font = isBold ? boldFont : regularFont;
    const testWidth = font.widthOfTextAtSize(testLine, size);

    if (testWidth < maxWidth) {
      currentLine = testLine;
    } else {
      // Draw current line
      const lineFont = currentLine.includes('**') ? boldFont : regularFont;
      page.drawText(currentLine.replace(/\*\*/g, '').trim(), {
        x,
        y: currentY,
        size,
        lineHeight,
        font: lineFont
      });
      currentY -= lineHeight;
      currentLine = word;
    }

    // Reset bold flag after word
    isBold = false;
  }

  // Draw remaining text
  if (currentLine.trim()) {
    const lineFont = currentLine.includes('**') ? boldFont : regularFont;
    page.drawText(currentLine.replace(/\*\*/g, '').trim(), {
      x,
      y: currentY,
      size,
      lineHeight,
      font: lineFont
    });
    currentY -= lineHeight;
  }

  return currentY;
}

// Helper function to add page header
async function addPageHeader(pdfDoc: PDFDocument, page: PDFPage, data?: AppointmentLetterData, isFirstPage: boolean = false): Promise<number> {
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

  // Add user image on the right side if available and it's the first page
  if (isFirstPage && data?.userImagePath) {
    try {
      const userImagePath = path.join(process.cwd(), 'public', data.userImagePath);
      const imageBuffer = fs.readFileSync(userImagePath);
      const userImage = await pdfDoc.embedPng(imageBuffer);
      const imageDims = userImage.scale(0.2); // Adjust scale as needed
      
      page.drawImage(userImage, {
        x: width - 50 - imageDims.width, // Position from right
        y: startY - imageDims.height + 15,
        width: imageDims.width,
        height: imageDims.height,
      });
    } catch (error) {
      console.error('Error embedding user image:', error);
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
  const contactWidth = (width - 100 - logoWidth) / 2;

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

  // Return a lower Y position to add more padding after the header
  return contactY - 70;
}

export async function generateAppointmentLetter(
  pdfDoc: PDFDocument,
  data: AppointmentLetterData,
) {
  let [currentPage, y] = await createNewPage(pdfDoc, data, true); // true for first page

  // Function to handle page breaks
  const handlePageBreak = async (requiredSpace: number = 100) => {
    if (needsNewPage(y, requiredSpace)) {
      [currentPage, y] = await createNewPage(pdfDoc, data, false); // false for subsequent pages
    }
  };

  // Helper function to add list items
  const addListItems = async (items: string[], indent: number = 0) => {
    for (const item of items) {
      await handlePageBreak();
      y = await addTextBlock(currentPage, item, 50 + indent, y, 495 - indent);
      y -= 10;
    }
  };

  // Helper function to add section
  const addSection = async (title: string, content: string, options: { spacing?: number; lineSpacing?: number } = {}) => {
    const { spacing = 30, lineSpacing = 1.5 } = options;
    y -= spacing;
    await handlePageBreak();
    await addTextBlock(currentPage, title, 50, y, 495, 12, lineSpacing);
    y -= 20;
    y = await addTextBlock(currentPage, content, 50, y, 495, 10, lineSpacing);
  };

  // Title
  y -= 30;
  await addTextBlock(currentPage, 'APPOINTMENT LETTER', 250, y, 295, 14, 1.5);

  // Salutation
  y -= 40;
  await addTextBlock(currentPage, `Dear ${data.employeeName},`, 50, y, 495, 12, 1.5);

  // Introduction paragraph
  await addSection('', 
    'Following our recent discussions, we are pleased to extend to you this offer of employment with Thepla House Private Limited, a company Incorporate under the Companies Act, 1956 ("the company" or "Thepla House") subject to the conditions and terms as set out below (the "letter" or the "Agreement").',
    { spacing: 30 }
  );

  // Section 1: Joining Date
  await addSection('1. Joining Date',
    `As per our records, your date of joining will be ${data.joiningDate}`
  );

  // Section 2: Job Title
  const jobTitleText = data.department 
    ? `${data.jobTitle} (${data.department})`
    : data.jobTitle;
  await addSection('2. Job Title',
    `You will be employed as ${jobTitleText} or in such other position(s) as the Company may designate from time to time. Your duties may include, but may not be limited to, duties usually associated with the position at the sites and such other duties as may be required by the company. Your service shall be transferable in whole or in part to any of our sites/locations in India. The reimbursement for outstation travel, long stay transfers will be according to the company travel policy.`
  );

  // Section 3: Duration of Employment
  await addSection('3. Duration Of Employment',
    'You will be employed on a probationary basis for an initial period of 6 months and based on the Company\'s view of your performance, you will be deemed confirmed.'
  );
  y -= 10;
  await handlePageBreak();
  y = await addTextBlock(currentPage,
    `Your employment will be for a period of five years effective from the date of your joining and may be renewed on a review of performance. This arrangement is with effect from ${data.contractStartDate} and will be valid till ${data.contractEndDate}. Till renewed after the valid date, your appointment will stand terminated.`,
    50, y, 495, 10, 1.8
  );

  // Section 4: Compensation
  await addSection('4. Compensation',
    `You will be eligible for a gross salary of Rs ${data.salary} per month from the company. Such compensation received by you will be subject to tax deduction at source, as applicable under the provisions of the Income-Tax Act, 1961 ('IT Act") and the Rules made thereunder and such other statutory deductions, as applicable.`
  );

  // Section 5: Taxation
  await addSection('5. Taxation',
    'The tax liability arising in respect of the exercise of employment will be borne solely by you. The company will be only responsible for withholding taxes from the compensation and any perquisites and allowances paid/provided to you and depositing the same to the credit of the Central Government in accordance with the provisions of the IT Act and the Rules made thereunder.'
  );

  // Section 6: Hours of Work
  await addSection('6. Hours Of Work',
    'Your hours of work will be determined by the company in accordance with the needs of its business and company policy. The company reserves the right to alter your work hours and/or workdays including, without limitation, the time(s) you start and/or conclude work on given day(s). In the event such alteration is, in the Company\'s opinion, material, it will provide you with a minimum twenty-four hours\' notice thereof whenever possible.'
  );

  // Section 7: Medical Cover
  await addSection('7. Medical Cover',
    'You will be eligible for participation in an appropriate medical benefit scheme as required under Indian law (if any) after 6 months of joining.'
  );

  // Section 8: Exclusive Services
  await addSection('8. Exclusive Services',
    '- During the continuance of your employment with the Company, you shall devote the whole of your time, attention and abilities to the business and affairs of the Company.'
  );
  y -= 10;
  await handlePageBreak();
  y = await addTextBlock(currentPage,
    '- You shall not, at any time, during the period of your employment hereunder, directly or indirectly, be employed, engaged, concerned or interested in any other employment whatsoever either alone or jointly with any other person in any manner whatsoever.',
    50, y, 495, 10, 1.8
  );

  // Section 9: Terminations
  await addSection('9. Terminations',
    '- During your probationary period, your employment may be terminated by the Company upon 5 days prior written notice (or payment of five day\'s salary in lieu thereof). At all other times, your employment may be terminated by the company upon 30 days\' notice or payment of 30 days salary in lieu thereof.'
  );
  y -= 15;
  await handlePageBreak();
  y = await addTextBlock(currentPage,
    '- At all other times including your probation period, you may terminate your employment upon 30 days\' notice in writing; failing which your 30 days salary will be deducted as notice period.',
    50, y, 495, 10, 1.8
  );
  y -= 15;
  await handlePageBreak();
  y = await addTextBlock(currentPage,
    '- Notwithstanding anything to the contrary in this Agreement, the Company may terminate your employment forthwith by notice (or may suspend you from employment without pay), for one or more of the following reasons:',
    50, y, 495, 10, 1.8
  );

  // Termination reasons
  const terminationReasons = [
    'I. You commit any breach of the terms, conditions, or stipulations contained in this Agreement;',
    'II. You fully disobey a lawful or reasonable order;',
    'III. You conduct yourself in a way inconsistent with the due and faithful discharge of your duties;',
    'IV. You are guilty of fraud or dishonesty or misconduct;',
    'V. You violate the Company\'s Business Conduct Policy;',
    'VI. You habitually neglect your duties;',
    'VII. You are guilty of conduct which brings or is likely to bring you or the Company or any associated company into disrepute;',
    'VIII. On any other grounds on which the Company would be entitled to terminate your employment forthwith under applicable law.',
    'IX. For avoidance of any ambiguities, the Company reserves the right to terminate your employment on the basis of the above-mentioned points and shall be unconstrained to such other rights and remedies as may be available to the Company under agreement or as per Law.'
  ];

  await addListItems(terminationReasons);

  y -= 20;
  await handlePageBreak();
  y = await addTextBlock(currentPage,
    'The company also reserves the right to order you not to attend work and/or not to undertake some or all of your duties of employment during any period, provided that the company shall continue to pay you salary and any contractual benefits whilst you remain employed with the company, except as otherwise specified in Paragraph 12(c) with respect to suspension without pay.',
    50, y, 495
  );

  // Section 10: Amendment
  await addSection('10. Amendment',
    'The terms contained in this Agreement may be amended or modified by the Company from time to time by written intimation to you.'
  );

  // Section 11: Confidentiality
  await addSection('11. Confidentiality',
    '- You shall observe utmost confidentiality and secrecy of any and all information received by you or entrusted to you in the course of your employment and you shall at all times, whether during or after the termination of your employment hereunder, act with utmost fidelity and not disclose or divulge such information to a third party or make use of such information for your own benefit.'
  );
  y -= 15;
  await handlePageBreak();
  y = await addTextBlock(currentPage,
    '- Upon termination of your employment, you will immediately surrender to the Company all confidential and proprietary information of the Company and/or its associated companies including, without limitation, any copies thereof, in all formats and mediums.',
    50, y, 495, 10, 1.8
  );
  y -= 15;
  await handlePageBreak();
  y = await addTextBlock(currentPage,
    '- You will not reproduce, store in a retrieval system or transmit in any form or by any means, electronic, mechanical, photocopying, recording, scanning or otherwise, any copyrighted material which is the property of the Company or any of its affiliated companies for your own benefit or for the benefit of any third party.',
    50, y, 495, 10, 1.8
  );
  y -= 15;
  await handlePageBreak();
  y = await addTextBlock(currentPage,
    '- In case of any breach or default by you of the obligations contained in this Paragraph 14, this Agreement may be terminated by the Company with immediate effect and the Company may seek any other remedies for such breach or default permitted by law.',
    50, y, 495, 10, 1.8
  );

  // Section 12: Compliance with Company Business Policy
  await addSection('12. Compliance with Company Business Policy',
    'You have read and understood the requirements of the Company\'s Business Conduct Policy and agree to act in compliance with such policy (including any modifications or amendments thereto) at all times. Any willful default of the policy will at the company\'s option result in disciplinary action, which may include actions up to and including summary dismissal with immediate effect without any salary in lieu for the same.'
  );

  // Section 13: Return of Company Property and Information
  y -= 30;
  await handlePageBreak(150); // Ensure enough space for the section
  await addTextBlock(currentPage, '13. Return of Company Property and Information', 50, y, 495, 12, 1.5);
  y -= 20;

  // Split Section 13 content into separate blocks for better control
  const propertyReturnContent = [
    'Not later than 10 days following the date of termination of your employment, you shall deliver to the company at your sole cost and expense and in good condition all equipment, other property, materials, data and other information furnished to you by or on behalf of the company and/or its associated companies, including, without limitation and as applicable, any and all keys, passes etc.',
    'Should you fail to return any such items to the company within the aforesaid 10-day period, the company reserves the right to charge you the full replacement costs for such items, which amount shall be immediately due and payable by you upon our demand, and take such other actions, legal or otherwise, as may be necessary and appropriate to enforce the company\'s right hereunder.',
    'Additionally, your failure to return items and/or to pay the amount prescribed by this Paragraph may result in the imposition of collection charges, reasonable attorney\'s fees, and interest.'
  ];

  // Add each block with proper spacing
  for (const content of propertyReturnContent) {
    y -= 15;
    await handlePageBreak();
    y = await addTextBlock(currentPage, content, 50, y, 495, 10, 2.0); // Increased line spacing
  }

  // Note section with proper bold text
  y -= 25;
  await handlePageBreak();
  const noteText = 'Note: If you fail to give one month prior notice before leaving the organization as per the terms of appointment letter, the entire cost of company assets along with salary advance and notice pay recovery will be adjusted against your bonus and other payable amount to you till the last day of your employment.';
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  await addTextBlock(currentPage, 'Note:', 50, y, 495, 10, 1.5);
  y = await addTextBlock(currentPage,
    noteText.substring(5), // Remove "Note:" as it's already drawn in bold
    50 + boldFont.widthOfTextAtSize('Note:', 10) + 5, // Add some spacing after "Note:"
    y,
    495 - (boldFont.widthOfTextAtSize('Note:', 10) + 5),
    10,
    2.0
  );

  // Section 14: Miscellaneous
  y -= 30;
  await handlePageBreak(150); // Ensure enough space for the section
  await addTextBlock(currentPage, '14. Miscellaneous', 50, y, 495, 12, 1.5);
  y -= 20;

  // Split Miscellaneous content into separate blocks for better control
  const miscContent = [
    'This Agreement shall supersede the terms of any and all previous employment agreements between the parties. Matters not addressed by any of the clauses above will be dealt with as per the company\'s policy and procedures from time to time.',
    'This Agreement shall be governed by and construed in accordance with the laws of India. Disputes, if any, will be subject to the jurisdiction of the Mumbai High Court.',
    'Should you accept this Agreement, please sign the enclosed copy and return all pages thereof. Your signature will indicate your acceptance of all terms and conditions (including policies of the company) which may be amended by the Company from time to time.'
  ];

  for (const content of miscContent) {
    y -= 15;
    await handlePageBreak();
    y = await addTextBlock(currentPage, content, 50, y, 495, 10, 2.0); // Increased line spacing
  }

  // Section 15: Indemnity
  await addSection('15. Indemnity',
    'You shall be responsible for protecting any property of the company or the client/customer entrusted to you in the due discharge of your duties, and you shall indemnify the company/client/customer if there is any loss to the said property.'
  );

  // Section 16: Other Rules and Regulations
  await addSection('16. Other Rules and Regulations', '');

  const rules = [
    'A. Month Off Reporting:',
    '- Employees must inform the employer about their hometown emergency leave, providing paper proof; failure to do so may result in the withholding of salary for the respective days.',
    '',
    'B. No Advance:',
    '- Employees are not entitled to receive any advance payment.',
    '',
    'C. No Cash from Kot Table:',
    '- Cash transactions are not allowed at the Kot (Kitchen Order Ticket) table.',
    '',
    'D. Salary:',
    '- All new joiners must work for 30 days to receive salary. If any joiner leaves before 30 days, he/she is not eligible to receive salary.',
    '- Salary payments will not be made in cash.',
    '- Bank account should be in your name and not that of relatives or friends.',
    '',
    'E. Month Off Reporting:',
    '- Employees must report their monthly off before 8 PM the previous day. Failure to inform will result in absence not being considered, and salary may be deducted.',
    '',
    'F. Working Hours:',
    '- Ordering hours are from 7:30 AM to 10:30 PM.',
    '',
    'G. Duty Hours:',
    '- Duty hours are 12 hours: 7 AM to 7 PM or 11 AM to 11 PM.',
    '',
    'H. Misconduct and Property Damage:',
    '- Any misconduct involving company property will result in the cost of damages being deducted from the employee\'s salary.',
    '',
    'I. No Non-Veg on Premises:',
    '- Consumption of non-vegetarian food is prohibited on company premises.',
    '',
    'J. No Drinking on Premises:',
    '- Consumption of alcoholic beverages is not allowed on company premises.',
    '',
    'K. No Tobacco During Working Hours:',
    '- Employees are prohibited from using tobacco during working hours.',
    '',
    'L. Personal Hygiene:',
    '- Employees are expected to maintain personal hygiene, including short and trimmed hair and nails.',
    '',
    'M. No Jewelry:',
    '- No jewelry or artificial jewelry is allowed to be worn during working hours.',
    '',
    'N. Uniform Requirements:',
    '- Employees must wear the provided uniform, including safety shoes, caps, and aprons.',
    '',
    'O. No Phone During Orders:',
    '- Personal mobile phones are not allowed to be used during order processing.',
    '',
    'P. No Personal Use of Company\'s Phone:',
    '- The company\'s phone should not be used for personal calls or activities.'
  ];

  await addListItems(rules);

  // Acceptance Section
  y -= 30;
  await handlePageBreak(150); // Require more space for the signature section
  await addTextBlock(currentPage, 'Accepted and Agreed', 50, y, 495, 14, 1.5);

  y -= 50;
  await addTextBlock(currentPage, 'Name:', 50, y, 495, 12, 1.5);

  y -= 30;
  await addTextBlock(currentPage, 'Date:', 50, y, 495, 12, 1.5);

  y -= 30;
  await addTextBlock(currentPage, 'Signature:', 50, y, 495, 12, 1.5);

  return pdfDoc;
} 
