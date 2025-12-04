import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { PDFDocument, PDFPage, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

// Draw company header with logo and contact details
async function drawCompanyHeader(pdfDoc: PDFDocument, page: PDFPage) {
	const { width, height } = page.getSize();
	const startY = height - 40;
	let logoWidth = 0;

	try {
		const logoPath = path.join(process.cwd(), 'public', 'company', 'logo.png');
		const logoBuffer = fs.readFileSync(logoPath);
		const logoImage = await pdfDoc.embedPng(logoBuffer);
		const logoDims = logoImage.scale(0.12);
		logoWidth = logoDims.width + 15;

		page.drawImage(logoImage, {
			x: 50,
			y: startY - logoDims.height + 10,
			width: logoDims.width,
			height: logoDims.height,
		});
	} catch {
		// Ignore missing logo; continue rendering header
	}

	page.drawText("Thepla House By Tejal's Kitchen", { x: 50 + logoWidth, y: startY, size: 14 });
	page.drawText('Gala No. 6, Shriguppi Industrial Estate, Sakivihar Road, Andheri (E), Mumbai - 400072', { x: 50 + logoWidth, y: startY - 18, size: 9 });

	const contactY = startY - 32;
	page.drawText('Phone: +91 9819555065', { x: 50 + logoWidth, y: contactY, size: 9 });
	page.drawText('Email: info@theplahouse.com', { x: 250 + logoWidth, y: contactY, size: 9 });
	page.drawText('Website: www.theplahouse.com', { x: 50 + logoWidth, y: contactY - 12, size: 9 });

	page.drawLine({ start: { x: 50, y: contactY - 25 }, end: { x: width - 50, y: contactY - 25 }, thickness: 1, color: rgb(0, 0, 0) });

	return contactY - 45;
}

function formatCurrency(amount: number): string {
	// Use "Rs" instead of ₹ symbol for PDF compatibility (WinAnsi encoding doesn't support ₹)
	const formatted = new Intl.NumberFormat('en-IN', {
		minimumFractionDigits: 0,
		maximumFractionDigits: 0,
	}).format(amount);
	return `Rs ${formatted}`;
}

function formatDate(date: Date): string {
	return date.toLocaleDateString('en-IN', {
		day: 'numeric',
		month: 'long',
		year: 'numeric',
	});
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
		const userRole = session.user.role;
		if (!['HR', 'MANAGEMENT'].includes(userRole)) {
			return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
		}

		const { id } = await params;
		const salaryId = id;

		// Get the salary record with user details
		const salary = await prisma.salary.findUnique({
			where: { id: salaryId },
			include: {
				user: {
					include: {
						branch: true,
						department: {
							select: {
								id: true,
								name: true,
							},
						},
					},
				},
				referrals: {
					include: {
						referredUser: true,
					},
				},
			},
		});

		if (!salary) {
			return NextResponse.json({ error: 'Salary record not found' }, { status: 404 });
		}

		// Get attendance for the month
		const startDate = new Date(salary.year, salary.month - 1, 1);
		const endDate = new Date(salary.year, salary.month, 0);

		const attendance = await prisma.attendance.findMany({
			where: {
				userId: salary.userId,
				date: {
					gte: startDate,
					lte: endDate,
				},
				status: 'APPROVED',
			},
		});

		// Get advance installments (get all, filter by APPROVED later for display)
		const advanceInstallments = await prisma.advancePaymentInstallment.findMany({
			where: {
				salaryId: salary.id,
			},
			include: {
				advance: true,
			},
		});

		// Calculate attendance stats
		const totalDaysInMonth = endDate.getDate();
		const perDaySalary = Math.round((salary.baseSalary / totalDaysInMonth) * 100) / 100;

		// Count different attendance types
		const regularDays = attendance.filter(a => a.isPresent && !a.isHalfDay && !a.overtime).length;
		const halfDays = attendance.filter(a => a.isPresent && a.isHalfDay).length;
		const overtimeDays = attendance.filter(a => a.isPresent && a.overtime).length;
		const leaveDays = attendance.filter(a => !a.isPresent).length;

		// Calculate present days (counting half days as 0.5)
		const presentDays = regularDays + overtimeDays + halfDays * 0.5;

		// Calculate base salary from present days
		const presentDaysSalary = presentDays * perDaySalary;

		// Calculate overtime bonus (only the extra 0.5x part)
		const overtimeSalary = overtimeDays * 0.5 * perDaySalary;

		// Calculate earned leaves
		let leavesEarned = 0;
		if (presentDays >= 25) {
			leavesEarned = 2;
		} else if (presentDays >= 15) {
			leavesEarned = 1;
		}
		const leaveSalary = leavesEarned * perDaySalary;

		// Calculate total deductions (matching stats endpoint logic - only APPROVED installments)
		const totalAdvanceDeductions = advanceInstallments
			.filter(i => i.status === 'APPROVED')
			.reduce((sum, i) => sum + i.amountPaid, 0);
		const totalOtherDeductions = salary.otherDeductions;
		const totalDeductions = totalAdvanceDeductions + totalOtherDeductions;

		// Calculate total earnings (matching stats endpoint logic exactly)
		// Note: referral bonuses are already included in salary.otherBonuses
		const baseSalaryEarned = presentDaysSalary + overtimeSalary + salary.otherBonuses + leaveSalary;
		const totalEarnings = baseSalaryEarned;
		
		// Calculate net salary (matching stats endpoint logic)
		const calculatedNetSalary = baseSalaryEarned - totalDeductions;
		
		// Get referral bonus separately for display (if any)
		const totalReferralBonus = salary.referrals?.reduce((sum, r) => sum + (r.bonusAmount || 0), 0) || 0;

		// Generate PDF
		const pdfDoc = await PDFDocument.create();
		const page = pdfDoc.addPage([595, 842]);
		const { width } = page.getSize();
		let y = await drawCompanyHeader(pdfDoc, page);

		const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
		const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
		
		// Site colors (converted from HSL to RGB)
		// Primary: hsl(147 41% 16%) - dark green
		const primaryColor = rgb(0.18, 0.35, 0.28);
		// Primary foreground: hsl(39 100% 97%) - soft yellowish beige
		const primaryForeground = rgb(1, 0.99, 0.95);
		// Background: hsl(39 100% 97%) - soft yellowish beige
		const backgroundColor = rgb(1, 0.99, 0.95);
		// Secondary: hsl(14 86% 57%) - reddish
		const secondaryColor = rgb(0.95, 0.45, 0.35);
		// Success: hsl(141 63% 45%) - green
		const successColor = rgb(0.3, 0.75, 0.5);
		// Text colors
		const textDark = rgb(0.2, 0.2, 0.2);
		const textMuted = rgb(0.5, 0.5, 0.5);

		// Title with site primary color - centered text only
		y -= 15;
		const titleText = 'PAYSLIP';
		const titleFontSize = 14;
		const titleWidth = boldFont.widthOfTextAtSize(titleText, titleFontSize);
		page.drawText(titleText, { x: (width - titleWidth) / 2, y, size: titleFontSize, font: boldFont, color: primaryColor });
		y -= 25;

		// Employee Information Section - 2 columns layout
		const monthName = new Date(salary.year, salary.month - 1).toLocaleString('default', { month: 'long', year: 'numeric' });
		const periodText = `Salary Period: ${monthName}`;
		
		// Draw heading with Salary Period beside it
		page.drawText('Employee Information', { x: 50, y, size: 10, font: boldFont, color: primaryColor });
		const periodWidth = boldFont.widthOfTextAtSize(periodText, 10);
		page.drawText(periodText, { x: width - 50 - periodWidth, y, size: 10, font: boldFont, color: primaryColor });
		y -= 20;

		const employeeInfo = [
			{ label: 'Name', value: salary.user.name || 'N/A' },
			{ label: 'Employee ID', value: salary.user.numId.toString() },
			{ label: 'Department', value: salary.user.department?.name || 'N/A' },
			{ label: 'Designation', value: salary.user.title || salary.user.role || 'N/A' },
			{ label: 'Branch', value: salary.user.branch?.name || 'N/A' },
			{ label: 'Date of Joining', value: salary.user.doj ? formatDate(new Date(salary.user.doj)) : 'N/A' },
			{ label: 'Bank A/C.', value: salary.user.bankAccountNo || 'N/A' },
			{ label: 'IFSC', value: salary.user.bankIfscCode || 'N/A' },
			{ label: 'DOB', value: salary.user.dob ? formatDate(new Date(salary.user.dob)) : 'N/A' },
		];

		// Display in 2 columns
		const colWidth = (width - 100) / 2; // 2 columns with margins
		const startX = 50;
		let currentRow = 0;
		let currentCol = 0;

		for (const info of employeeInfo) {
			const colX = startX + (currentCol * colWidth);
			const rowY = y - (currentRow * 15);
			
			page.drawText(`${info.label}:`, { x: colX, y: rowY, size: 9, font: boldFont, color: textDark });
			page.drawText(info.value, { x: colX + 100, y: rowY, size: 9, font: regularFont, color: textDark });
			
			currentCol++;
			if (currentCol >= 2) {
				currentCol = 0;
				currentRow++;
			}
		}

		y = y - (currentRow * 15) - 20;

		// Earnings Section - Clean with subtle background
		const earningsStartY = y;
		const earningsBoxHeight = 120;
		const earningsBoxBottom = earningsStartY - earningsBoxHeight;
		
		// Draw box first
		page.drawRectangle({
			x: 50,
			y: earningsBoxBottom,
			width: 495,
			height: earningsBoxHeight,
			color: backgroundColor,
			borderColor: primaryColor,
			borderWidth: 1.5,
		});
		
		// Draw header inside box
		page.drawText('EARNINGS', { x: 60, y: earningsStartY - 15, size: 11, font: boldFont, color: primaryColor });
		y -= 28;

		const earnings = [
			{ label: 'Base Salary', amount: salary.baseSalary },
			{ label: 'Present Days Salary', amount: presentDaysSalary },
			{ label: 'Overtime Bonus', amount: overtimeSalary },
			{ label: 'Leave Salary', amount: leaveSalary },
		];

		// Show other bonuses and referral bonus separately if referral bonus exists
		if (totalReferralBonus > 0 && salary.otherBonuses > totalReferralBonus) {
			earnings.push({ label: 'Other Bonuses', amount: salary.otherBonuses - totalReferralBonus });
			earnings.push({ label: 'Referral Bonus', amount: totalReferralBonus });
		} else if (salary.otherBonuses > 0) {
			earnings.push({ label: 'Other Bonuses', amount: salary.otherBonuses });
		}

		for (const earning of earnings) {
			if (earning.amount > 0) {
				y -= 15;
				page.drawText(earning.label, { x: 60, y, size: 9, font: regularFont, color: textDark });
				const amountText = formatCurrency(earning.amount);
				const amountWidth = regularFont.widthOfTextAtSize(amountText, 9);
				page.drawText(amountText, { x: 520 - amountWidth, y, size: 9, font: regularFont, color: textDark });
			}
		}

		y -= 8;
		page.drawLine({ start: { x: 60, y }, end: { x: 535, y }, thickness: 1, color: primaryColor });
		y -= 15;
		page.drawText('Total Earnings', { x: 60, y, size: 10, font: boldFont, color: primaryColor });
		const totalEarningsText = formatCurrency(totalEarnings);
		const totalEarningsWidth = boldFont.widthOfTextAtSize(totalEarningsText, 10);
		page.drawText(totalEarningsText, { x: 520 - totalEarningsWidth, y, size: 10, font: boldFont, color: primaryColor });

		// Deductions Section - Clean with subtle background
		y -= 25;
		const deductionsStartY = y;
		const approvedAdvanceInstallments = advanceInstallments.filter(i => i.status === 'APPROVED');
		const deductionsContentHeight = approvedAdvanceInstallments.length > 0 ? 40 + (approvedAdvanceInstallments.length * 14) : 50;
		const deductionsBoxHeight = deductionsContentHeight + 30; // Add space for header and padding
		const deductionsBoxBottom = deductionsStartY - deductionsBoxHeight;
		
		// Draw box first
		page.drawRectangle({
			x: 50,
			y: deductionsBoxBottom,
			width: 495,
			height: deductionsBoxHeight,
			color: backgroundColor,
			borderColor: secondaryColor,
			borderWidth: 1.5,
		});
		
		// Draw header inside box
		page.drawText('DEDUCTIONS', { x: 60, y: deductionsStartY - 15, size: 11, font: boldFont, color: secondaryColor });
		y -= 28;
		if (approvedAdvanceInstallments.length > 0) {
			page.drawText('Advance Deductions:', { x: 60, y, size: 9, font: boldFont, color: textDark });
			y -= 15;
			for (const installment of approvedAdvanceInstallments) {
				const reason = installment.advance.reason || 'Advance Payment';
				page.drawText(`  • ${reason}`, { x: 70, y, size: 8, font: regularFont, color: textDark });
				const amountText = formatCurrency(installment.amountPaid);
				const amountWidth = regularFont.widthOfTextAtSize(amountText, 8);
				page.drawText(amountText, { x: 520 - amountWidth, y, size: 8, font: regularFont, color: textDark });
				y -= 12;
			}
		}

		if (salary.otherDeductions > 0) {
			page.drawText('Other Deductions', { x: 60, y, size: 9, font: regularFont, color: textDark });
			const otherDeductionsText = formatCurrency(salary.otherDeductions);
			const otherDeductionsWidth = regularFont.widthOfTextAtSize(otherDeductionsText, 9);
			page.drawText(otherDeductionsText, { x: 520 - otherDeductionsWidth, y, size: 9, font: regularFont, color: textDark });
			y -= 15;
		}

		if (totalDeductions === 0) {
			page.drawText('No Deductions', { x: 60, y, size: 9, font: regularFont, color: textMuted });
			y -= 15;
		}

		y -= 8;
		page.drawLine({ start: { x: 60, y }, end: { x: 535, y }, thickness: 1, color: secondaryColor });
		y -= 15;
		page.drawText('Total Deductions', { x: 60, y, size: 10, font: boldFont, color: secondaryColor });
		const totalDeductionsText = formatCurrency(totalDeductions);
		const totalDeductionsWidth = boldFont.widthOfTextAtSize(totalDeductionsText, 10);
		page.drawText(totalDeductionsText, { x: 520 - totalDeductionsWidth, y, size: 10, font: boldFont, color: secondaryColor });

		// Net Salary - Highlighted with site primary color
		y -= 25;
		const netSalaryBoxY = y;
		const netSalaryBoxHeight = 40;
		const netSalaryBoxBottom = netSalaryBoxY - netSalaryBoxHeight;
		
		// Draw box first
		page.drawRectangle({
			x: 50,
			y: netSalaryBoxBottom,
			width: 495,
			height: netSalaryBoxHeight,
			color: primaryColor,
		});
		
		// Draw text inside box (centered vertically)
		const netSalaryTextY = netSalaryBoxY - 15;
		page.drawText('NET SALARY', { x: 60, y: netSalaryTextY, size: 14, font: boldFont, color: primaryForeground });
		const netSalaryText = formatCurrency(calculatedNetSalary);
		const netSalaryWidth = boldFont.widthOfTextAtSize(netSalaryText, 14);
		page.drawText(netSalaryText, { x: 520 - netSalaryWidth, y: netSalaryTextY, size: 14, font: boldFont, color: primaryForeground });
		y = netSalaryBoxBottom - 15;

		// Attendance Summary - Clean layout with bottom padding
		const attendanceStartY = y;
		const attendanceBoxHeight = 130; // Increased height for bottom padding
		const attendanceBoxBottom = attendanceStartY - attendanceBoxHeight;
		
		// Draw box first
		page.drawRectangle({
			x: 50,
			y: attendanceBoxBottom,
			width: 495,
			height: attendanceBoxHeight,
			color: backgroundColor,
			borderColor: successColor,
			borderWidth: 1.5,
		});
		
		// Draw header inside box
		page.drawText('ATTENDANCE SUMMARY', { x: 60, y: attendanceStartY - 15, size: 11, font: boldFont, color: successColor });
		y -= 28;

		const attendanceSummary = [
			{ label: 'Number of Days in Month', value: totalDaysInMonth.toString() },
			{ label: 'Present Days', value: formatDays(presentDays) },
			{ label: 'Regular Days', value: regularDays.toString() },
			{ label: 'Half Days', value: halfDays.toString() },
			{ label: 'Overtime Days', value: overtimeDays.toString() },
			{ label: 'Leave Days', value: leaveDays.toString() },
			{ label: 'Leaves Earned', value: leavesEarned.toString() },
		];

		for (const summary of attendanceSummary) {
			y -= 13;
			page.drawText(`${summary.label}:`, { x: 60, y, size: 8, font: boldFont, color: textDark });
			page.drawText(summary.value, { x: 250, y, size: 8, font: regularFont, color: textDark });
		}
		
		// Add bottom padding by not moving y further down

		// Footer
		y -= 20;
		page.drawLine({ start: { x: 50, y }, end: { x: 545, y }, thickness: 1, color: textMuted });
		y -= 15;
		page.drawText(`Generated on: ${formatDate(new Date())}`, { x: 50, y, size: 8, font: regularFont, color: textMuted });
		const footerText = 'This is a system generated document.';
		const footerWidth = regularFont.widthOfTextAtSize(footerText, 8);
		page.drawText(footerText, { x: 545 - footerWidth, y, size: 8, font: regularFont, color: textMuted });

		// Save PDF
		const bytes = await pdfDoc.save();
		const employeeName = (salary.user.name || `Employee-${salary.user.numId}`).replace(/[^a-zA-Z0-9]/g, '-');
		const filename = `payslip-${employeeName}-${salary.month}-${salary.year}.pdf`;

		return new NextResponse(bytes as unknown as BodyInit, {
			headers: {
				'Content-Type': 'application/pdf',
				'Content-Disposition': `attachment; filename="${filename}"`,
			},
		});
	} catch (error) {
		console.error('Error generating payslip:', error);
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
	}
}

function formatDays(days: number): string {
	return days % 1 === 0 ? days.toString() : days.toFixed(1);
}

