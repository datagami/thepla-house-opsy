import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { PDFDocument, PDFFont, PDFPage, rgb, RGB, StandardFonts } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

// ---------------------------------------------------------------------------
// Brand palette — translated from the design reference HTML
// ---------------------------------------------------------------------------
const COLORS = {
	green: rgb(0.18, 0.36, 0.27), // hsl(150 28% 18%) primary dark green
	greenSoft: rgb(0.86, 0.92, 0.89), // hsl(147 30% 92%)
	greenDeep: rgb(0.11, 0.27, 0.18), // hsl(147 45% 12%)
	cream: rgb(1, 0.99, 0.95), // hsl(39 100% 97%)
	creamDeep: rgb(0.97, 0.93, 0.83), // hsl(39 60% 92%)
	gold: rgb(0.93, 0.69, 0.2), // hsl(38 80% 55%)
	coral: rgb(0.95, 0.45, 0.35), // hsl(14 86% 57%)
	coralSoft: rgb(0.99, 0.93, 0.91), // hsl(14 86% 96%)
	white: rgb(1, 1, 1),
	ink1: rgb(0.1, 0.13, 0.11), // primary text
	ink2: rgb(0.32, 0.37, 0.34), // secondary
	ink3: rgb(0.49, 0.53, 0.5), // muted hints
	ink4: rgb(0.66, 0.69, 0.66), // faintest, zero tiles
	rule: rgb(0.86, 0.89, 0.87), // hsl(150 10% 88%)
	ruleStrong: rgb(0.76, 0.79, 0.77), // hsl(150 10% 78%)
	tileBorder: rgb(0.94, 0.88, 0.74), // hsl(39 60% 88%)
	periodLabel: rgb(0.65, 0.78, 0.72), // hsl(147 25% 70%) — muted cream-on-green
	netLabel: rgb(0.7, 0.81, 0.75), // hsl(147 25% 75%)
	netSub: rgb(0.78, 0.86, 0.81), // hsl(147 18% 80%)
};

// Page geometry: A4 portrait
const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN_X = 36; // ~13mm in points
const MARGIN_TOP = 40;
const MARGIN_BOTTOM = 34;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatCurrency(amount: number, decimals = 0): string {
	// "Rs " prefix because pdf-lib's WinAnsi standard fonts can't render ₹.
	const formatted = new Intl.NumberFormat('en-IN', {
		minimumFractionDigits: decimals,
		maximumFractionDigits: decimals,
	}).format(amount);
	return `Rs ${formatted}`;
}

function formatDate(date: Date): string {
	return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatGenerated(date: Date): string {
	return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

function titlePrefix(gender: string | null | undefined): string {
	if (!gender) return '';
	const g = gender.toUpperCase();
	if (g === 'MALE' || g === 'M') return 'Mr.';
	if (g === 'FEMALE' || g === 'F') return 'Ms.';
	return '';
}

function formatDays(days: number): string {
	return days % 1 === 0 ? days.toString() : days.toFixed(1);
}

interface DrawTextOpts {
	font: PDFFont;
	size: number;
	color?: RGB;
}

function drawText(page: PDFPage, text: string, x: number, y: number, opts: DrawTextOpts) {
	page.drawText(text, { x, y, size: opts.size, font: opts.font, color: opts.color ?? COLORS.ink1 });
}

function drawRightAligned(page: PDFPage, text: string, rightX: number, y: number, opts: DrawTextOpts) {
	const w = opts.font.widthOfTextAtSize(text, opts.size);
	drawText(page, text, rightX - w, y, opts);
}

function fillRect(
	page: PDFPage,
	x: number,
	y: number,
	w: number,
	h: number,
	color: RGB,
	border?: { color: RGB; width: number }
) {
	page.drawRectangle({
		x,
		y,
		width: w,
		height: h,
		color,
		borderColor: border?.color,
		borderWidth: border?.width,
	});
}

function strokeLine(
	page: PDFPage,
	x1: number,
	y1: number,
	x2: number,
	y2: number,
	color: RGB,
	thickness = 0.6
) {
	page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness, color });
}

// Dashed horizontal rule, used to separate row labels from amounts inside panels.
function dashedHLine(page: PDFPage, x1: number, x2: number, y: number, color: RGB) {
	const dash = 1.5;
	const gap = 1.5;
	let cur = x1;
	while (cur < x2) {
		const end = Math.min(cur + dash, x2);
		page.drawLine({ start: { x: cur, y }, end: { x: end, y }, thickness: 0.4, color });
		cur = end + gap;
	}
}

// ---------------------------------------------------------------------------
// Section drawing
// ---------------------------------------------------------------------------
async function drawHeader(
	pdfDoc: PDFDocument,
	page: PDFPage,
	regular: PDFFont,
	bold: PDFFont
): Promise<number> {
	const topY = PAGE_H - MARGIN_TOP;

	// Logo (round-ish: pdf-lib has no clipping mask for round images, so we draw
	// the image inside a green-circle-substitute square. Acceptable fallback.)
	const logoSize = 44;
	const logoX = MARGIN_X;
	const logoY = topY - logoSize;

	try {
		const logoPath = path.join(process.cwd(), 'public', 'company', 'logo.png');
		const buf = fs.readFileSync(logoPath);
		const img = await pdfDoc.embedPng(buf);
		// Background green disc behind/around the logo so any transparency reads on cream
		fillRect(page, logoX, logoY, logoSize, logoSize, COLORS.green);
		page.drawImage(img, { x: logoX + 2, y: logoY + 2, width: logoSize - 4, height: logoSize - 4 });
	} catch {
		fillRect(page, logoX, logoY, logoSize, logoSize, COLORS.green);
	}

	// Brand name to the right of logo
	const brandX = logoX + logoSize + 12;
	drawText(page, 'Thepla House', brandX, topY - 16, { font: bold, size: 16, color: COLORS.green });
	drawText(page, "BY TEJAL'S KITCHEN", brandX, topY - 32, {
		font: regular,
		size: 8,
		color: COLORS.ink3,
	});

	// Right-aligned address + contact
	const rightX = PAGE_W - MARGIN_X;
	drawRightAligned(page, 'Gala No. 6, Shriguppi Industrial Estate,', rightX, topY - 8, {
		font: regular,
		size: 8.5,
		color: COLORS.ink2,
	});
	drawRightAligned(
		page,
		'Sakivihar Road, Andheri (E), Mumbai - 400072',
		rightX,
		topY - 20,
		{ font: regular, size: 8.5, color: COLORS.ink2 }
	);
	drawRightAligned(
		page,
		'+91 9819555065  -  info@theplahouse.com  -  www.theplahouse.com',
		rightX,
		topY - 34,
		{ font: regular, size: 8, color: COLORS.ink3 }
	);

	// Separator rule
	const ruleY = topY - logoSize - 8;
	strokeLine(page, MARGIN_X, ruleY, PAGE_W - MARGIN_X, ruleY, COLORS.rule, 0.5);

	return ruleY - 10;
}

function drawTitleBand(
	page: PDFPage,
	y: number,
	regular: PDFFont,
	bold: PDFFont,
	period: string
): number {
	const x = MARGIN_X;
	const w = PAGE_W - 2 * MARGIN_X;
	const h = 44;
	const top = y;
	const bottom = top - h;

	// Body
	fillRect(page, x, bottom, w, h, COLORS.green);
	// Gold left accent stripe (8pt wide per spec)
	fillRect(page, x, bottom, 6, h, COLORS.gold);

	// Title — large cream lockup on the left
	drawText(page, 'PAYSLIP', x + 22, bottom + h / 2 - 8, {
		font: bold,
		size: 24,
		color: COLORS.cream,
	});

	// Right side: period label + value
	const rightX = x + w - 18;
	drawRightAligned(page, 'SALARY PERIOD', rightX, bottom + h - 14, {
		font: bold,
		size: 7.5,
		color: COLORS.periodLabel,
	});
	drawRightAligned(page, period, rightX, bottom + 12, {
		font: bold,
		size: 14,
		color: COLORS.cream,
	});

	return bottom - 14;
}

interface EmployeeCardData {
	prefix: string;
	name: string;
	department: string;
	branch: string;
	empId: string;
	doj: string;
	dob: string;
	monthlySalary: string;
	perDayRate: string;
	bankAccount: string;
	ifsc: string;
}

function drawEmployeeCard(
	page: PDFPage,
	y: number,
	regular: PDFFont,
	bold: PDFFont,
	d: EmployeeCardData
): number {
	const x = MARGIN_X;
	const w = PAGE_W - 2 * MARGIN_X;
	const h = 110;
	const top = y;
	const bottom = top - h;

	// Card body
	fillRect(page, x, bottom, w, h, COLORS.white, { color: COLORS.rule, width: 0.6 });

	// Top row: name on left, employee ID pill area on right
	const padX = 16;
	const headerY = top - 18;

	// Title prefix + name
	let cursorX = x + padX;
	if (d.prefix) {
		drawText(page, d.prefix.toUpperCase(), cursorX, headerY + 5, {
			font: regular,
			size: 8,
			color: COLORS.ink3,
		});
		cursorX += regular.widthOfTextAtSize(d.prefix.toUpperCase(), 8) + 6;
	}
	drawText(page, d.name, cursorX, headerY, { font: bold, size: 15, color: COLORS.ink1 });

	// Sub-line: department · branch
	const deptW = bold.widthOfTextAtSize(d.department, 9);
	drawText(page, d.department, x + padX, headerY - 14, {
		font: bold,
		size: 9,
		color: COLORS.green,
	});
	drawText(page, '  -  ', x + padX + deptW, headerY - 14, {
		font: regular,
		size: 9,
		color: COLORS.ink4,
	});
	const sepW = regular.widthOfTextAtSize('  -  ', 9);
	drawText(page, d.branch, x + padX + deptW + sepW, headerY - 14, {
		font: regular,
		size: 9,
		color: COLORS.ink2,
	});

	// Right side: Employee ID label + value
	const rightX = x + w - padX;
	drawRightAligned(page, 'EMPLOYEE ID', rightX, headerY + 5, {
		font: regular,
		size: 7.5,
		color: COLORS.ink3,
	});
	drawRightAligned(page, `#${d.empId}`, rightX, headerY - 14, {
		font: bold,
		size: 13,
		color: COLORS.ink1,
	});

	// Divider rule
	const ruleY = top - 42;
	strokeLine(page, x + padX, ruleY, x + w - padX, ruleY, COLORS.rule, 0.5);

	// 3-column grid below the divider, two rows of three fields
	const cols = 3;
	const gridLeft = x + padX;
	const gridRight = x + w - padX;
	const colW = (gridRight - gridLeft) / cols;
	const fields: Array<{ k: string; v: string }> = [
		{ k: 'DATE OF JOINING', v: d.doj },
		{ k: 'DATE OF BIRTH', v: d.dob },
		{ k: 'MONTHLY SALARY', v: d.monthlySalary },
		{ k: 'PER DAY RATE', v: d.perDayRate },
		{ k: 'BANK ACCOUNT', v: d.bankAccount },
		{ k: 'IFSC CODE', v: d.ifsc },
	];
	const rowH = 28;
	for (let i = 0; i < fields.length; i++) {
		const col = i % cols;
		const row = Math.floor(i / cols);
		const cellX = gridLeft + col * colW;
		const cellTopY = ruleY - 10 - row * rowH;
		drawText(page, fields[i].k, cellX, cellTopY, {
			font: regular,
			size: 7,
			color: COLORS.ink3,
		});
		drawText(page, fields[i].v, cellX, cellTopY - 12, {
			font: regular,
			size: 10,
			color: COLORS.ink1,
		});
	}

	return bottom - 14;
}

interface PanelRow {
	label: string;
	hint?: string;
	amount: number;
	muted?: boolean;
}

interface PanelGroup {
	subhead?: string;
	rows: PanelRow[];
}

interface PanelData {
	title: string;
	chip: string;
	chipBg: RGB;
	chipFg: RGB;
	subtotalLabel: string;
	subtotal: number;
	subtotalColor: RGB;
	groups: PanelGroup[];
	emptyText?: string;
}

function drawPanel(
	page: PDFPage,
	x: number,
	y: number,
	w: number,
	h: number,
	regular: PDFFont,
	bold: PDFFont,
	d: PanelData
) {
	const top = y;
	const bottom = top - h;
	const padX = 16;
	const padTop = 14;

	// Card
	fillRect(page, x, bottom, w, h, COLORS.white, { color: COLORS.rule, width: 0.6 });

	// Header row: title + chip
	const headY = top - padTop;
	drawText(page, d.title.toUpperCase(), x + padX, headY, {
		font: bold,
		size: 10,
		color: COLORS.ink1,
	});

	// Chip on right
	const chipText = d.chip.toUpperCase();
	const chipTextW = bold.widthOfTextAtSize(chipText, 7);
	const chipPadX = 6;
	const chipH = 12;
	const chipW = chipTextW + chipPadX * 2;
	const chipX = x + w - padX - chipW;
	const chipY = headY - 1;
	fillRect(page, chipX, chipY, chipW, chipH, d.chipBg);
	drawText(page, chipText, chipX + chipPadX, chipY + 3, {
		font: bold,
		size: 7,
		color: d.chipFg,
	});

	// Divider under header
	const ruleY = headY - 8;
	strokeLine(page, x + padX, ruleY, x + w - padX, ruleY, COLORS.rule, 0.5);

	// Body rows
	const amountRightX = x + w - padX;
	let cursorY = ruleY - 14;
	const totalRows = d.groups.reduce((s, g) => s + g.rows.length, 0);

	if (totalRows === 0 && d.emptyText) {
		drawText(page, d.emptyText, x + padX, cursorY, {
			font: regular,
			size: 10,
			color: COLORS.ink3,
		});
	}

	for (const group of d.groups) {
		if (group.subhead) {
			drawText(page, group.subhead.toUpperCase(), x + padX, cursorY, {
				font: bold,
				size: 7.5,
				color: COLORS.ink3,
			});
			cursorY -= 12;
		}
		for (const row of group.rows) {
			drawText(page, row.label, x + padX, cursorY, {
				font: regular,
				size: 10,
				color: row.muted ? COLORS.ink3 : COLORS.ink1,
			});
			if (row.hint) {
				const labelW = regular.widthOfTextAtSize(row.label, 10);
				drawText(page, row.hint, x + padX + labelW + 8, cursorY, {
					font: regular,
					size: 8.5,
					color: COLORS.ink3,
				});
			}
			drawRightAligned(page, formatCurrency(row.amount), amountRightX, cursorY, {
				font: bold,
				size: 10.5,
				color: COLORS.ink1,
			});
			cursorY -= 8;
			dashedHLine(page, x + padX, x + w - padX, cursorY, COLORS.rule);
			cursorY -= 8;
		}
	}

	// Subtotal pinned to bottom of card
	const subY = bottom + 14;
	strokeLine(page, x + padX, subY + 16, x + w - padX, subY + 16, COLORS.ruleStrong, 0.6);
	drawText(page, d.subtotalLabel.toUpperCase(), x + padX, subY, {
		font: bold,
		size: 10,
		color: COLORS.ink1,
	});
	drawRightAligned(page, formatCurrency(d.subtotal), amountRightX, subY - 2, {
		font: bold,
		size: 14,
		color: d.subtotalColor,
	});
}

function drawNetSalary(
	page: PDFPage,
	y: number,
	regular: PDFFont,
	bold: PDFFont,
	totalEarnings: number,
	totalDeductions: number,
	calculated: number,
	rounded: number
): number {
	const x = MARGIN_X;
	const w = PAGE_W - 2 * MARGIN_X;
	const h = 64;
	const top = y;
	const bottom = top - h;
	const padX = 24;

	// Body
	fillRect(page, x, bottom, w, h, COLORS.green);
	// Gold accent stripe (matches title band)
	fillRect(page, x, bottom, 6, h, COLORS.gold);

	// Left: label + sub-line
	drawText(page, 'NET SALARY', x + padX, top - 22, {
		font: bold,
		size: 10,
		color: COLORS.netLabel,
	});
	const subText = `Earnings ${formatCurrency(totalEarnings)}  -  Deductions ${formatCurrency(totalDeductions)}`;
	drawText(page, subText, x + padX, top - 42, {
		font: regular,
		size: 9.5,
		color: COLORS.netSub,
	});

	// Right: large amount + raw line
	const rightX = x + w - padX;
	drawRightAligned(page, formatCurrency(rounded), rightX, top - 32, {
		font: bold,
		size: 28,
		color: COLORS.cream,
	});
	const raw = `Calculated: ${formatCurrency(calculated, 2)}  -  rounded to nearest rupee`;
	drawRightAligned(page, raw, rightX, top - 52, {
		font: regular,
		size: 8,
		color: COLORS.netSub,
	});

	return bottom - 14;
}

interface AttendanceTile {
	label: string;
	value: string;
	zero: boolean;
	primary?: boolean;
}

function drawAttendance(
	page: PDFPage,
	y: number,
	regular: PDFFont,
	bold: PDFFont,
	monthLabel: string,
	tiles: AttendanceTile[]
): number {
	const x = MARGIN_X;
	const w = PAGE_W - 2 * MARGIN_X;
	const h = 96;
	const top = y;
	const bottom = top - h;
	const padX = 16;

	// Card
	fillRect(page, x, bottom, w, h, COLORS.white, { color: COLORS.rule, width: 0.6 });

	// Header
	drawText(page, 'ATTENDANCE SUMMARY', x + padX, top - 14, {
		font: bold,
		size: 10,
		color: COLORS.ink1,
	});
	drawRightAligned(page, monthLabel, x + w - padX, top - 14, {
		font: regular,
		size: 9,
		color: COLORS.ink3,
	});

	// Divider
	const ruleY = top - 26;
	strokeLine(page, x + padX, ruleY, x + w - padX, ruleY, COLORS.rule, 0.5);

	// 9 tiles in a single row
	const gridLeft = x + padX;
	const gridRight = x + w - padX;
	const gap = 5;
	const tileW = (gridRight - gridLeft - gap * (tiles.length - 1)) / tiles.length;
	const tileH = 52;
	const tileTopY = ruleY - 6;

	for (let i = 0; i < tiles.length; i++) {
		const t = tiles[i];
		const tx = gridLeft + i * (tileW + gap);
		const ty = tileTopY - tileH;
		const bg = t.primary ? COLORS.green : COLORS.cream;
		const border = t.primary ? COLORS.green : COLORS.tileBorder;
		fillRect(page, tx, ty, tileW, tileH, bg, { color: border, width: 0.6 });

		// Value
		const valueColor = t.primary ? COLORS.white : t.zero ? COLORS.ink4 : COLORS.green;
		const valSize = 14;
		const valW = bold.widthOfTextAtSize(t.value, valSize);
		drawText(page, t.value, tx + (tileW - valW) / 2, ty + tileH - 18, {
			font: bold,
			size: valSize,
			color: valueColor,
		});

		// Label (may have a soft break — split on " " if too long)
		const labelColor = t.primary ? COLORS.netLabel : COLORS.ink3;
		const labelLines = wrapTileLabel(t.label, regular, tileW - 6, 7.5);
		for (let li = 0; li < labelLines.length; li++) {
			const line = labelLines[li];
			const lw = regular.widthOfTextAtSize(line, 7.5);
			drawText(page, line, tx + (tileW - lw) / 2, ty + 14 - li * 9, {
				font: bold,
				size: 7.5,
				color: labelColor,
			});
		}
	}

	return bottom - 12;
}

function wrapTileLabel(label: string, font: PDFFont, maxW: number, size: number): string[] {
	const words = label.split(' ');
	if (words.length === 1) return [label.toUpperCase()];
	// Greedy two-line wrap
	const lines: string[] = [];
	let cur = '';
	for (const word of words) {
		const next = cur ? cur + ' ' + word : word;
		if (font.widthOfTextAtSize(next, size) <= maxW) {
			cur = next;
		} else {
			if (cur) lines.push(cur);
			cur = word;
		}
	}
	if (cur) lines.push(cur);
	return lines.map(l => l.toUpperCase());
}

function drawFooter(page: PDFPage, regular: PDFFont, bold: PDFFont) {
	const y = MARGIN_BOTTOM;
	strokeLine(page, MARGIN_X, y + 14, PAGE_W - MARGIN_X, y + 14, COLORS.rule, 0.5);
	const generated = `Generated on ${formatGenerated(new Date())}  -  System-generated, no signature required.`;
	drawText(page, generated, MARGIN_X, y, {
		font: regular,
		size: 8,
		color: COLORS.ink3,
	});
	drawRightAligned(page, 'THEPLA HOUSE  -  PAYROLL', PAGE_W - MARGIN_X, y, {
		font: bold,
		size: 7.5,
		color: COLORS.ink3,
	});
}

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------
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

		const salary = await prisma.salary.findUnique({
			where: { id: salaryId },
			include: {
				user: {
					include: {
						branch: true,
						department: { select: { id: true, name: true } },
					},
				},
				referrals: { include: { referredUser: true } },
			},
		});

		if (!salary) {
			return NextResponse.json({ error: 'Salary record not found' }, { status: 404 });
		}

		const startDate = new Date(salary.year, salary.month - 1, 1);
		const endDate = new Date(salary.year, salary.month, 0);

		const attendance = await prisma.attendance.findMany({
			where: {
				userId: salary.userId,
				date: { gte: startDate, lte: endDate },
				status: 'APPROVED',
			},
		});

		const advanceInstallments = await prisma.advancePaymentInstallment.findMany({
			where: { salaryId: salary.id },
			include: { advance: true },
		});

		// --- Math (unchanged) ---
		const totalDaysInMonth = endDate.getDate();
		const perDaySalary = Math.round((salary.baseSalary / totalDaysInMonth) * 100) / 100;

		const weeklyOffDays = attendance.filter(a => a.isPresent && a.isWeeklyOff).length;
		const wfhDays = attendance.filter(a => a.isPresent && a.isWorkFromHome).length;
		const regularDays = attendance.filter(
			a => a.isPresent && !a.isHalfDay && !a.overtime && !a.isWeeklyOff && !a.isWorkFromHome
		).length;
		const halfDays = attendance.filter(a => a.isPresent && a.isHalfDay && !a.isWeeklyOff).length;
		const overtimeDays = attendance.filter(a => a.isPresent && a.overtime && !a.isWeeklyOff).length;
		const leaveDays = attendance.filter(a => !a.isPresent).length;

		const presentDays = regularDays + overtimeDays + halfDays * 0.5 + weeklyOffDays + wfhDays;
		const presentDaysSalary = presentDays * perDaySalary;
		const overtimeSalary = overtimeDays * 0.5 * perDaySalary;

		let leavesEarned = 0;
		let leaveSalary = 0;
		const userHasWeeklyOff =
			(salary.user as unknown as { hasWeeklyOff?: boolean | null }).hasWeeklyOff || false;
		if (!userHasWeeklyOff) {
			const presentDaysForBonusLeaves = regularDays + overtimeDays + halfDays * 0.5;
			if (presentDaysForBonusLeaves >= 25) leavesEarned = 2;
			else if (presentDaysForBonusLeaves >= 15) leavesEarned = 1;
			leaveSalary = leavesEarned * perDaySalary;
		}

		const approvedAdvanceInstallments = advanceInstallments.filter(i => i.status === 'APPROVED');
		const totalAdvanceDeductions = approvedAdvanceInstallments.reduce(
			(sum, i) => sum + i.amountPaid,
			0
		);
		const totalOtherDeductions = salary.otherDeductions;
		const recurringEntries =
			(salary.recurringDeductions as Array<{ code: string; name: string; amount: number }> | null) ??
			[];
		const totalRecurringDeductions = recurringEntries.reduce((s, e) => s + e.amount, 0);
		const totalDeductions =
			totalAdvanceDeductions + totalOtherDeductions + totalRecurringDeductions;

		const baseSalaryEarned = presentDaysSalary + overtimeSalary + salary.otherBonuses + leaveSalary;
		const totalEarnings = baseSalaryEarned;
		const calculatedNetSalary = baseSalaryEarned - totalDeductions;
		const roundedNetSalary = Math.round(calculatedNetSalary);

		const totalReferralBonus =
			salary.referrals?.reduce((sum, r) => sum + (r.bonusAmount || 0), 0) || 0;

		// --- PDF rendering ---
		const pdfDoc = await PDFDocument.create();
		const page = pdfDoc.addPage([PAGE_W, PAGE_H]);

		// Cream page background
		fillRect(page, 0, 0, PAGE_W, PAGE_H, COLORS.cream);

		const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
		const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

		// 1. Header
		let cursorY = await drawHeader(pdfDoc, page, regular, bold);

		// 2. Title band
		const monthName = new Date(salary.year, salary.month - 1).toLocaleString('default', {
			month: 'long',
			year: 'numeric',
		});
		cursorY = drawTitleBand(page, cursorY, regular, bold, monthName);

		// 3. Employee card
		const gender = (salary.user as unknown as { gender?: string | null }).gender;
		cursorY = drawEmployeeCard(page, cursorY, regular, bold, {
			prefix: titlePrefix(gender),
			name: salary.user.name || 'N/A',
			department: salary.user.department?.name || (salary.user.title || 'Employee'),
			branch: salary.user.branch?.name || 'N/A',
			empId: salary.user.numId.toString(),
			doj: salary.user.doj ? formatDate(new Date(salary.user.doj)) : 'N/A',
			dob: salary.user.dob ? formatDate(new Date(salary.user.dob)) : 'N/A',
			monthlySalary: formatCurrency(salary.baseSalary, 2),
			perDayRate: formatCurrency(perDaySalary, 2),
			bankAccount: salary.user.bankAccountNo || 'N/A',
			ifsc: salary.user.bankIfscCode || 'N/A',
		});

		// 4. Earnings + Deductions panels (side-by-side)
		const panelGap = 12;
		const panelW = (PAGE_W - 2 * MARGIN_X - panelGap) / 2;
		const panelH = 170;
		const panelTopY = cursorY;

		// Earnings rows
		const earningsRows: PanelRow[] = [];
		earningsRows.push({
			label: 'Present Days Salary',
			hint: `${formatDays(presentDays)} x ${formatCurrency(perDaySalary, 2)}`,
			amount: presentDaysSalary,
		});
		if (overtimeSalary > 0) {
			earningsRows.push({
				label: 'Overtime Bonus',
				hint: `${overtimeDays} x 0.5 x ${formatCurrency(perDaySalary, 2)}`,
				amount: overtimeSalary,
			});
		}
		if (leaveSalary > 0) {
			earningsRows.push({
				label: 'Leave Salary',
				hint: `${leavesEarned} x ${formatCurrency(perDaySalary, 2)}`,
				amount: leaveSalary,
			});
		}
		if (totalReferralBonus > 0 && salary.otherBonuses > totalReferralBonus) {
			earningsRows.push({
				label: 'Other Bonuses',
				amount: salary.otherBonuses - totalReferralBonus,
			});
			earningsRows.push({ label: 'Referral Bonus', amount: totalReferralBonus });
		} else if (salary.otherBonuses > 0) {
			earningsRows.push({ label: 'Other Bonuses', amount: salary.otherBonuses });
		}

		drawPanel(page, MARGIN_X, panelTopY, panelW, panelH, regular, bold, {
			title: 'Earnings',
			chip: 'Credit',
			chipBg: COLORS.greenSoft,
			chipFg: COLORS.greenDeep,
			subtotalLabel: 'Total Earnings',
			subtotal: totalEarnings,
			subtotalColor: COLORS.green,
			groups: [{ rows: earningsRows }],
		});

		// Deductions groups
		const deductionGroups: PanelGroup[] = [];
		if (recurringEntries.length > 0) {
			deductionGroups.push({
				subhead: 'Statutory Deductions',
				rows: recurringEntries.map(entry => ({
					label: entry.name,
					amount: entry.amount,
				})),
			});
		}
		if (approvedAdvanceInstallments.length > 0) {
			deductionGroups.push({
				subhead: 'Advance Deductions',
				rows: approvedAdvanceInstallments.map(installment => ({
					label: installment.advance.reason || 'Advance Payment',
					amount: installment.amountPaid,
				})),
			});
		}
		if (salary.otherDeductions > 0) {
			deductionGroups.push({
				rows: [{ label: 'Other Deductions', amount: salary.otherDeductions }],
			});
		}

		drawPanel(
			page,
			MARGIN_X + panelW + panelGap,
			panelTopY,
			panelW,
			panelH,
			regular,
			bold,
			{
				title: 'Deductions',
				chip: 'Debit',
				chipBg: COLORS.coralSoft,
				chipFg: COLORS.coral,
				subtotalLabel: 'Total Deductions',
				subtotal: totalDeductions,
				subtotalColor: COLORS.coral,
				groups: deductionGroups,
				emptyText: 'No Deductions',
			}
		);

		cursorY = panelTopY - panelH - 14;

		// 5. Net salary hero
		cursorY = drawNetSalary(
			page,
			cursorY,
			regular,
			bold,
			totalEarnings,
			totalDeductions,
			calculatedNetSalary,
			roundedNetSalary
		);

		// 6. Attendance summary tiles
		const attendanceTiles: AttendanceTile[] = [
			{
				label: 'Days in Month',
				value: totalDaysInMonth.toString(),
				zero: totalDaysInMonth === 0,
				primary: true,
			},
			{
				label: 'Present',
				value: formatDays(presentDays),
				zero: presentDays === 0,
				primary: true,
			},
			{ label: 'Regular', value: regularDays.toString(), zero: regularDays === 0 },
			{ label: 'Weekly Off', value: weeklyOffDays.toString(), zero: weeklyOffDays === 0 },
			{ label: 'WFH', value: wfhDays.toString(), zero: wfhDays === 0 },
			{ label: 'Half Day', value: halfDays.toString(), zero: halfDays === 0 },
			{ label: 'Overtime', value: overtimeDays.toString(), zero: overtimeDays === 0 },
			{ label: 'Leave', value: leaveDays.toString(), zero: leaveDays === 0 },
			{ label: 'Earned Leaves', value: leavesEarned.toString(), zero: leavesEarned === 0 },
		];
		const attendanceMonthLabel = `${monthName}  -  ${totalDaysInMonth} days`;
		cursorY = drawAttendance(
			page,
			cursorY,
			regular,
			bold,
			attendanceMonthLabel,
			attendanceTiles
		);

		// 7. Footer
		drawFooter(page, regular, bold);

		// Save
		const bytes = await pdfDoc.save();
		const employeeName = (salary.user.name || `Employee-${salary.user.numId}`).replace(
			/[^a-zA-Z0-9]/g,
			'-'
		);
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
