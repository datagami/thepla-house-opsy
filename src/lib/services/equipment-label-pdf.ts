import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import QRCode from "qrcode";

export interface LabelInput {
  tag: string;
  name: string;
  outlet: string;
  category: string;
  url: string; // encoded in the QR
}

// Geometry (points; 1mm = 72/25.4). Two 50×25mm labels side-by-side per page.
const MM = 72 / 25.4;
const LABEL_W = 50 * MM;
const LABEL_H = 25 * MM;
const GUTTER = 2 * MM;
const QR = 20 * MM;
const PAGE_W = 2 * LABEL_W + GUTTER;
const PAGE_H = LABEL_H;
const PAD = 3;

const INK = rgb(0.07, 0.07, 0.07);
const MUTED = rgb(0.33, 0.33, 0.33);

/**
 * Renders printable 50×25mm asset labels (2-up per page) to a PDF Buffer using
 * pdf-lib. Each label has a QR (left) encoding the asset URL + the tag (bold),
 * name, outlet, and category. Imperative pdf-lib (no React) so it renders
 * identically in Node, Vitest, and the Next server runtime.
 */
export async function renderEquipmentLabels(items: LabelInput[]): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  // Pre-generate QR PNGs (Node Buffers).
  const qrPngs = await Promise.all(
    items.map((it) =>
      QRCode.toBuffer(it.url, { type: "png", margin: 0, width: 240, errorCorrectionLevel: "M" })
    )
  );

  if (items.length === 0) {
    doc.addPage([PAGE_W, PAGE_H]); // valid 1-page (blank) PDF for an empty set
  }

  for (let i = 0; i < items.length; i += 2) {
    const page = doc.addPage([PAGE_W, PAGE_H]);
    await drawCell(doc, page, font, fontBold, items[i], qrPngs[i], 0);
    if (i + 1 < items.length) {
      await drawCell(doc, page, font, fontBold, items[i + 1], qrPngs[i + 1], LABEL_W + GUTTER);
    }
  }

  const bytes = await doc.save();
  return Buffer.from(bytes);
}

async function drawCell(
  doc: PDFDocument,
  page: PDFPage,
  font: PDFFont,
  fontBold: PDFFont,
  item: LabelInput,
  qrPng: Buffer,
  xOffset: number
): Promise<void> {
  // QR on the left, vertically centered.
  const png = await doc.embedPng(qrPng);
  page.drawImage(png, { x: xOffset + PAD, y: (LABEL_H - QR) / 2, width: QR, height: QR });

  // Text column to the right of the QR.
  const textX = xOffset + PAD + QR + 4;
  const maxW = xOffset + LABEL_W - PAD - textX;

  // pdf-lib Y origin is bottom-left; lay lines out from the top down.
  let y = LABEL_H - PAD - 8;
  drawLine(page, fontBold, fit(fontBold, item.tag, 9, maxW), textX, y, 9, INK);
  y -= 9;
  drawLine(page, font, fit(font, item.name, 7, maxW), textX, y, 7, INK);
  y -= 8;
  drawLine(page, font, fit(font, item.outlet, 6, maxW), textX, y, 6, MUTED);
  y -= 7;
  drawLine(page, font, fit(font, item.category, 6, maxW), textX, y, 6, MUTED);
}

function drawLine(
  page: PDFPage,
  font: PDFFont,
  text: string,
  x: number,
  y: number,
  size: number,
  color: ReturnType<typeof rgb>
): void {
  if (!text) return;
  page.drawText(text, { x, y, size, font, color });
}

/** Strip characters the WinAnsi-encoded StandardFonts can't render, then trim. */
function sanitize(s: string): string {
  let out = "";
  for (const ch of s) {
    const code = ch.codePointAt(0)!;
    out += code >= 0x20 && code <= 0xff ? ch : " ";
  }
  return out.replace(/\s+/g, " ").trim();
}

/** Truncate (with an ellipsis) so the text fits within maxWidth at the given size. */
function fit(font: PDFFont, raw: string, size: number, maxWidth: number): string {
  const s = sanitize(raw);
  if (font.widthOfTextAtSize(s, size) <= maxWidth) return s;
  let lo = 0;
  let hi = s.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (font.widthOfTextAtSize(s.slice(0, mid) + "…", size) <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return lo > 0 ? s.slice(0, lo) + "…" : "";
}
