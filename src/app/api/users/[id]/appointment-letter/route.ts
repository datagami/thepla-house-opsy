import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { hasAccess } from '@/lib/access-control';
import { PDFDocument, PDFPage, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

// Draw a simple company header with logo and contact details
async function drawCompanyHeader(pdfDoc: PDFDocument, page: PDFPage) {
	const { width, height } = page.getSize();
	const startY = height - 50;
	let logoWidth = 0;

	try {
		const logoPath = path.join(process.cwd(), 'public', 'company', 'logo.png');
		const logoBuffer = fs.readFileSync(logoPath);
		const logoImage = await pdfDoc.embedPng(logoBuffer);
		const logoDims = logoImage.scale(0.15);
		logoWidth = logoDims.width + 20;

		page.drawImage(logoImage, {
			x: 50,
			y: startY - logoDims.height + 15,
			width: logoDims.width,
			height: logoDims.height,
		});
	} catch {
		// Ignore missing logo; continue rendering header
	}

	page.drawText("Thepla House By Tejal's Kitchen", { x: 50 + logoWidth, y: startY, size: 16 });
	page.drawText('Gala No. 6, Shriguppi Industrial Estate, Sakivihar Road, Andheri (E), Mumbai - 400072', { x: 50 + logoWidth, y: startY - 20, size: 10 });

	const contactY = startY - 35;
	page.drawText('Phone: +91 9819555065', { x: 50 + logoWidth, y: contactY, size: 10 });
	page.drawText('Email: info@theplahouse.com', { x: 250 + logoWidth, y: contactY, size: 10 });
	page.drawText('Website: www.theplahouse.com', { x: 50 + logoWidth, y: contactY - 15, size: 10 });

	page.drawLine({ start: { x: 50, y: contactY - 30 }, end: { x: width - 50, y: contactY - 30 }, thickness: 1, color: rgb(0, 0, 0) });

	return contactY - 60;
}

async function addTextBlock(page: PDFPage, text: string, x: number, y: number, width: number, size: number = 11, lineSpacing: number = 1.5) {
	const pdfDoc = page.doc;
	const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
	const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

	let currentY = y;
	const lineHeight = size * lineSpacing;

	const paragraphs = text.split(/\r?\n/);
	for (const paragraph of paragraphs) {
		const words = paragraph.split(' ');
		let currentLine = '';
		for (let i = 0; i < words.length; i++) {
			const nextLine = currentLine ? `${currentLine} ${words[i]}` : words[i];
			const stripped = nextLine.replace(/\*\*/g, '');
			const isBold = nextLine.startsWith('**') || nextLine.includes(' **');
			const font = isBold ? boldFont : regularFont;
			const testWidth = font.widthOfTextAtSize(stripped, size);
			if (testWidth < width) {
				currentLine = nextLine;
			} else {
				const lineFont = (currentLine.startsWith('**') || currentLine.includes(' **')) ? boldFont : regularFont;
				page.drawText(currentLine.replace(/\*\*/g, '').trim(), { x, y: currentY, size, lineHeight, font: lineFont });
				currentY -= lineHeight;
				currentLine = words[i];
			}
		}
		if (currentLine.trim()) {
			const lineFont = (currentLine.startsWith('**') || currentLine.includes(' **')) ? boldFont : regularFont;
			page.drawText(currentLine.replace(/\*\*/g, '').trim(), { x, y: currentY, size, lineHeight, font: lineFont });
			currentY -= lineHeight;
		}
		currentY -= 5; // extra spacing between paragraphs
	}
	return currentY;
}

// --- New helpers for multipage content and photo embedding ---
function needsNewPage(currentY: number, requiredSpace: number = 100): boolean {
	return currentY < requiredSpace;
}

async function createNewPage(pdfDoc: PDFDocument): Promise<[PDFPage, number]> {
	const page = pdfDoc.addPage([595, 842]);
	const y = await drawCompanyHeader(pdfDoc, page);
	return [page, y];
}

async function drawUserPhoto(pdfDoc: PDFDocument, page: PDFPage, imageUrl?: string | null) {
	if (!imageUrl) return;
	try {
		const res = await fetch(imageUrl);
		if (!res.ok) return;
		const buf = new Uint8Array(await res.arrayBuffer());
		let img;
		try {
			img = await pdfDoc.embedPng(buf);
		} catch {
			img = await pdfDoc.embedJpg(buf);
		}
		const dims = img.scale(0.2);
		const { width, height } = page.getSize();
		page.drawImage(img, {
			x: width - 50 - dims.width,
			y: height - 50 - dims.height + 15,
			width: dims.width,
			height: dims.height,
		});
	} catch {
		// ignore
	}
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	try {
		const session = await auth();
		if (!session?.user) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { id } = await params;
		const isOwn = session.user.id === id;
		// @ts-expect-error role exists on our session
		const canManage = hasAccess(session.user.role, 'users.manage');
		if (!isOwn && !canManage) {
			return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
		}

		const user = await prisma.user.findUnique({
			where: { id },
			include: { branch: true },
		});
		if (!user) {
			return NextResponse.json({ error: 'User not found' }, { status: 404 });
		}

		const pdfDoc = await PDFDocument.create();
		let page = pdfDoc.addPage([595, 842]);
		let y = await drawCompanyHeader(pdfDoc, page);

		// Draw user photo at top-right if available
		await drawUserPhoto(pdfDoc, page, user.image || undefined);

		// Title
		y -= 20;
		const titleFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
		page.drawText('APPOINTMENT LETTER', { x: 200, y, size: 14, font: titleFont });
		y -= 30;

		// Helpers for page breaks within this scope
		const handlePageBreak = async (requiredSpace: number = 100) => {
			if (needsNewPage(y, requiredSpace)) {
				[page, y] = await createNewPage(pdfDoc);
			}
		};

		const addSection = async (title: string, content: string, options: { spacing?: number; lineSpacing?: number } = {}) => {
			const { spacing = 30, lineSpacing = 1.5 } = options;
			y -= spacing;
			await handlePageBreak(150);
			y = await addTextBlock(page, title, 50, y, 495, 12, lineSpacing);
			y -= 20;
			y = await addTextBlock(page, content, 50, y, 495, 10, lineSpacing);
		};

		const addListItems = async (items: string[], indent: number = 0, options: { lineSpacing?: number } = {}) => {
			const { lineSpacing = 1.6 } = options;
			for (const item of items) {
				await handlePageBreak();
				y = await addTextBlock(page, item, 50 + indent, y, 495 - indent, 10, lineSpacing);
				y -= 10;
			}
		};

		// Salutation and intro
		y = await addTextBlock(page, `Dear ${user.name || 'Employee'},`, 50, y, 495, 12, 1.5);
		y = await addTextBlock(page, 'Following our recent discussions, we are pleased to extend to you this offer of employment with Thepla House Private Limited ("the Company" or "Thepla House"). The terms and conditions of your appointment are set out below.', 50, y - 10, 495, 11, 1.6);

		// Key details
		y -= 20;
		const details = [
			`Name: ${user.name || 'N/A'}`,
			`Employee ID: ${user.numId}`,
			`Department: ${user.department || 'N/A'}`,
			`Title: ${user.title || 'N/A'}`,
			`Role: ${user.role}`,
			`Branch: ${user.branch?.name || 'N/A'}`,
			`Date of Joining: ${user.doj ? new Date(user.doj).toLocaleDateString() : 'N/A'}`,
			`Salary: Rs ${user.salary ?? 0}`,
		];
		for (const d of details) {
			y = await addTextBlock(page, d, 50, y, 495, 11, 1.5);
		}

		// Sections reintroduced (condensed from detailed template)
		await addSection('1. Joining Date', `As per our records, your date of joining will be ${user.doj ? new Date(user.doj).toLocaleDateString() : 'N/A'}.`);

		const jobTitleText = user.department ? `${user.title || user.role} (${user.department})` : (user.title || user.role);
		await addSection('2. Job Title', `You will be employed as ${jobTitleText}. Your duties may include those usually associated with the position and such other duties as may be required by the Company. Your services may be transferred to any site/location in India.`);

		await addSection('3. Duration Of Employment', 'You will be employed on a probationary basis for an initial period of 6 months and, based on performance, you may be confirmed. Your employment will be for a period of five years effective from your joining date and may be renewed upon review of performance.');

		await addSection('4. Compensation', `You will be eligible for a gross salary of Rs ${user.salary ?? 0} per month. Compensation will be subject to tax deduction at source and other statutory deductions, as applicable.`);

		await addSection('5. Taxation', 'The tax liability arising in respect of the exercise of employment will be borne solely by you. The Company will be responsible only for withholding taxes from the compensation and depositing the same to the credit of the Central Government as per applicable law.');

		await addSection('6. Hours Of Work', 'Your hours of work will be determined by the Company in accordance with the needs of its business and Company policy. The Company reserves the right to alter your work hours and/or workdays.');

		await addSection('7. Medical Cover', 'You will be eligible for participation in an appropriate medical benefit scheme as required under Indian law (if any) after 6 months of joining.');

		await addSection('8. Exclusive Services', '- During your employment, you shall devote your full time and attention to the business and affairs of the Company.\n- You shall not, during employment, be engaged or interested in any other employment or business either alone or with any other person in any manner whatsoever.');

		await addSection('9. Terminations', 'Your employment may be terminated during probation upon 5 days prior written notice (or payment in lieu). Thereafter, your employment may be terminated by either party upon 30 days notice or payment in lieu.');

		await addListItems([
			'I. Breach of the terms of this Agreement;',
			'II. Willful disobedience of a lawful or reasonable order;',
			'III. Conduct inconsistent with the due and faithful discharge of duties;',
			'IV. Fraud, dishonesty or misconduct;',
			'V. Violation of the Company\'s Business Conduct Policy;',
			'VI. Habitual negligence of duties;',
			'VII. Conduct that brings you or the Company into disrepute;',
			'VIII. Any other grounds for immediate termination permitted by law.'
		], 20);

		await addSection('10. Amendment', 'The terms contained in this Agreement may be amended or modified by the Company from time to time by written intimation to you.');

		await addSection('11. Confidentiality', '- You shall maintain utmost confidentiality of all information received in the course of your employment and not disclose the same to third parties.\n- Upon termination, you shall return to the Company all confidential and proprietary information in all formats and mediums.\n- You shall not reproduce or transmit any copyrighted material belonging to the Company or its affiliates for personal benefit.');

		await addSection('12. Compliance with Company Business Policy', 'You agree to comply with the Company\'s Business Conduct Policy (as amended from time to time). Any willful default may result in disciplinary action, up to and including summary dismissal.');

		// Section 13 with multiple paragraphs
		y -= 30; await handlePageBreak(150);
		y = await addTextBlock(page, '13. Return of Company Property and Information', 50, y, 495, 12, 1.5);
		y -= 20;
		const propertyReturnContent = [
			'Not later than 10 days following the date of termination of your employment, you shall deliver to the Company at your sole cost and expense and in good condition all equipment, other property, materials, data and other information furnished to you by or on behalf of the Company and/or its associated companies, including any and all keys, passes etc.',
			'Should you fail to return any such items within the aforesaid period, the Company reserves the right to charge you the full replacement costs for such items and take such legal or other actions as may be necessary.',
			'Additionally, your failure to return items and/or to pay the amount prescribed may result in the imposition of collection charges, reasonable attorney\'s fees, and interest.'
		];
		for (const content of propertyReturnContent) {
			y -= 15; await handlePageBreak();
			y = await addTextBlock(page, content, 50, y, 495, 10, 1.8);
		}

		// Note
		y -= 25; await handlePageBreak();
		y = await addTextBlock(page, 'Note: If you fail to give one month prior notice before leaving the organization as per the terms of appointment letter, the entire cost of company assets along with salary advance and notice pay recovery will be adjusted against your bonus and other payable amount to you till the last day of your employment.', 50, y, 495, 10, 1.8);

		await addSection('14. Miscellaneous', 'This Agreement supersedes all previous employment agreements between the parties. Matters not addressed herein will be dealt with as per the Company\'s policies and procedures from time to time. This Agreement shall be governed by the laws of India. Disputes, if any, will be subject to the jurisdiction of the Mumbai High Court. Should you accept this Agreement, your signature will indicate acceptance of all terms and conditions.');

		await addSection('15. Indemnity', 'You shall be responsible for protecting any property of the Company or the client/customer entrusted to you in the due discharge of your duties, and you shall indemnify the Company/client/customer in case of loss to such property.');

		// 16. Other Rules and Regulations (list)
		await addSection('16. Other Rules and Regulations', '');
		const rules = [
			'A. Month Off Reporting: Employees must inform the employer about their hometown emergency leave with paper proof; failure may result in withholding salary for respective days.',
			'B. No Advance: Employees are not entitled to receive any advance payment.',
			'C. No Cash from Kot Table: Cash transactions are not allowed at the Kot (Kitchen Order Ticket) table.',
			'D. Salary: New joiners must work for 30 days to receive salary; leaving before 30 days makes one ineligible. Salary will not be paid in cash. Bank account should be in your name. Leave accrual as per company policy.',
			'E. Month Off Reporting: Employees must report monthly off before 8 PM the previous day; failure may result in absence not being considered with possible salary deduction.',
			'F. Working Hours: Ordering hours are from 7:30 AM to 10:30 PM.',
			'G. Duty Hours: Duty hours are 12 hours: 7 AM to 7 PM or 11 AM to 11 PM.',
			'H. Misconduct and Property Damage: Any misconduct involving company property will result in cost of damages being deducted from salary.',
			'I. No Non-Veg on Premises: Consumption of non-vegetarian food is prohibited on company premises.',
			'J. No Drinking on Premises: Consumption of alcoholic beverages is not allowed on company premises.',
			'K. No Tobacco During Working Hours: Use of tobacco is prohibited during working hours.',
			'L. Personal Hygiene: Maintain personal hygiene including short and trimmed hair and nails.',
			'M. No Jewelry: No jewelry or artificial jewelry is allowed during working hours.',
			'N. Uniform Requirements: Wear provided uniform including safety shoes, caps, and aprons. First pair is provided; replacements are chargeable.',
			'O. No Phone During Orders: Personal mobile phones are not allowed during order processing.',
			'P. No Personal Use of Company\'s Phone: Do not use company phone for personal calls or activities.'
		];
		await addListItems(rules, 10, { lineSpacing: 1.8 });

				// Signature block
			y -= 30; await handlePageBreak(120);
			page.drawText('Accepted and Agreed', { x: 50, y, size: 12 });
			y -= 50;
			const nameY = y;
			page.drawText('Name:', { x: 50, y: nameY, size: 11 });
			if (user.name) {
				page.drawText(String(user.name), { x: 120, y: nameY, size: 11 });
			}
			y -= 25;
			const dateY = y;
			page.drawText('Date:', { x: 50, y: dateY, size: 11 });
			const displayDate = user.joiningFormSignedAt ? new Date(user.joiningFormSignedAt).toLocaleDateString() : new Date().toLocaleDateString();
			page.drawText(displayDate, { x: 120, y: dateY, size: 11 });
			y -= 25;
			page.drawText('Signature:', { x: 50, y, size: 11 });

		// If e-signature exists, attempt to render it
		if (user.joiningFormSignature) {
			try {
				const sigRes = await fetch(user.joiningFormSignature);
				if (sigRes.ok) {
					const sigBuf = new Uint8Array(await sigRes.arrayBuffer());
					let sigImage;
					try { sigImage = await pdfDoc.embedPng(sigBuf); } catch { sigImage = await pdfDoc.embedJpg(sigBuf); }
					const dims = sigImage.scale(0.3);
					page.drawImage(sigImage, { x: 120, y: y - 50, width: dims.width, height: dims.height });
				}
			} catch { /* ignore */ }
		}

		// If verification photo exists, render it near signature block
		if (user.joiningFormPhoto) {
			try {
				const photoRes = await fetch(user.joiningFormPhoto);
				if (photoRes.ok) {
					const photoBuf = new Uint8Array(await photoRes.arrayBuffer());
					let photoImg;
					try { photoImg = await pdfDoc.embedPng(photoBuf); } catch { photoImg = await pdfDoc.embedJpg(photoBuf); }
					const pDims = photoImg.scale(0.2);
					page.drawImage(photoImg, { x: 350, y: y + 5, width: pDims.width, height: pDims.height });
					page.drawText('Verification Photo', { x: 350, y: y + pDims.height + 10, size: 9 });
				}
			} catch { /* ignore */ }
		}

		// Footer signed info
		if (user.joiningFormSignedAt) {
			page.drawText(`Signed on: ${new Date(user.joiningFormSignedAt).toLocaleString()}`, { x: 50, y: 80, size: 10 });
		}

		const bytes = await pdfDoc.save();
		const { searchParams } = new URL(request.url);
		const asDownload = searchParams.get('download') === '1';
		return new NextResponse(bytes, {
			headers: {
				'Content-Type': 'application/pdf',
				'Content-Disposition': `${asDownload ? 'attachment' : 'inline'}; filename="appointment-letter-${user.numId}.pdf"`,
			},
		});
	} catch (error) {
		console.error('Error generating appointment letter:', error);
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
	}
} 