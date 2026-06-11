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
  const LEAD = 1.5; // extra leading between lines

  // Lines: tag (1, bold), name (wrapped to ≤2 lines), outlet (1), category (1).
  const lines: { text: string; size: number; font: PDFFont; color: ReturnType<typeof rgb> }[] = [
    { text: fit(fontBold, item.tag, 9, maxW), size: 9, font: fontBold, color: INK },
    ...wrapLines(font, item.name, 7, maxW, 2).map((t) => ({ text: t, size: 7, font, color: INK })),
    { text: fit(font, item.outlet, 6, maxW), size: 6, font, color: MUTED },
    { text: fit(font, item.category, 6, maxW), size: 6, font, color: MUTED },
  ];

  // Vertically center the whole text block against the label height.
  // pdf-lib's Y origin is bottom-left; drawText y is the baseline.
  const blockH = lines.reduce((h, ln) => h + ln.size + LEAD, 0) - LEAD;
  let y = (LABEL_H + blockH) / 2 - lines[0].size;
  for (const ln of lines) {
    if (ln.text) page.drawText(ln.text, { x: textX, y, size: ln.size, font: ln.font, color: ln.color });
    y -= ln.size + LEAD;
  }
}

/**
 * Greedy word-wrap to fit maxWidth, capped at maxLines. A single word wider than
 * the column is ellipsis-truncated; overflow past maxLines ellipsizes the last line.
 */
function wrapLines(font: PDFFont, raw: string, size: number, maxWidth: number, maxLines: number): string[] {
  const s = sanitize(raw);
  if (!s) return [];
  const out: string[] = [];
  let cur = "";
  for (const word of s.split(" ")) {
    const w = font.widthOfTextAtSize(word, size) > maxWidth ? fit(font, word, size, maxWidth) : word;
    const test = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(test, size) <= maxWidth) {
      cur = test;
    } else {
      if (cur) out.push(cur);
      cur = w;
    }
  }
  if (cur) out.push(cur);
  if (out.length <= maxLines) return out;
  // Overflow: keep the first maxLines, ellipsizing the last to signal truncation.
  const kept = out.slice(0, maxLines);
  kept[maxLines - 1] = fit(font, `${kept[maxLines - 1]} ${out.slice(maxLines).join(" ")}`, size, maxWidth);
  return kept;
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
