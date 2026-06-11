// src/lib/services/equipment-label-pdf.tsx
import { Document, Page, Text, View, Image, StyleSheet, pdf } from "@react-pdf/renderer";
import QRCode from "qrcode";

export interface LabelInput {
  tag: string;
  name: string;
  outlet: string;
  category: string;
  url: string; // encoded in the QR
}

const MM = 2.834645669; // points per mm
const LABEL_W = 50 * MM;
const LABEL_H = 25 * MM;
const GUTTER = 2 * MM;
const QR = 20 * MM;
const PAGE: [number, number] = [2 * LABEL_W + GUTTER, LABEL_H];

const styles = StyleSheet.create({
  page: { flexDirection: "row", backgroundColor: "#FFFFFF" },
  cell: { width: LABEL_W, height: LABEL_H, flexDirection: "row", alignItems: "center", padding: 3 },
  gutter: { width: GUTTER },
  qr: { width: QR, height: QR, marginRight: 4 },
  col: { flex: 1, justifyContent: "center" },
  tag: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#111" },
  name: { fontSize: 7, color: "#111", marginTop: 1 },
  meta: { fontSize: 6, color: "#555", marginTop: 1 },
});

function Cell({ item, qrDataUrl }: { item: LabelInput; qrDataUrl: string }) {
  return (
    <View style={styles.cell}>
      {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer Image is not an HTML <img> */}
      <Image src={qrDataUrl} style={styles.qr} />
      <View style={styles.col}>
        <Text style={styles.tag}>{item.tag}</Text>
        <Text style={styles.name} wrap={false}>{item.name}</Text>
        <Text style={styles.meta} wrap={false}>{item.outlet}</Text>
        <Text style={styles.meta} wrap={false}>{item.category}</Text>
      </View>
    </View>
  );
}

/** Group into pairs for 2-up pages. */
function pairs<T>(arr: T[]): [T, T?][] {
  const out: [T, T?][] = [];
  for (let i = 0; i < arr.length; i += 2) out.push([arr[i], arr[i + 1]]);
  return out;
}

export async function renderEquipmentLabels(items: LabelInput[]): Promise<Buffer> {
  // Pre-generate QR data URLs (async) before the sync render.
  const qr = await Promise.all(
    items.map((it) => QRCode.toDataURL(it.url, { margin: 0, width: 240, errorCorrectionLevel: "M" }))
  );
  const withQr = items.map((it, i) => ({ it, qrDataUrl: qr[i] }));

  const doc = (
    <Document title="Asset Labels">
      {/* Always render at least one (blank) page so an empty set is a valid PDF. */}
      {withQr.length === 0 ? (
        <Page size={PAGE} style={styles.page} />
      ) : (
        pairs(withQr).map((pair, idx) => (
          <Page key={idx} size={PAGE} style={styles.page}>
            <Cell item={pair[0].it} qrDataUrl={pair[0].qrDataUrl} />
            <View style={styles.gutter} />
            {pair[1] ? <Cell item={pair[1].it} qrDataUrl={pair[1].qrDataUrl} /> : <View style={styles.cell} />}
          </Page>
        ))
      )}
    </Document>
  );

  // Portable render→Buffer (same approach as leave-application-pdf.tsx).
  const instance = pdf(doc);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyInstance = instance as any;
  if (typeof anyInstance.toBuffer === "function") {
    const out = await anyInstance.toBuffer();
    if (Buffer.isBuffer(out)) return out;
    if (out && typeof out.on === "function") {
      return await new Promise<Buffer>((resolve, reject) => {
        const chunks: Buffer[] = [];
        out.on("data", (c: Buffer) => chunks.push(c));
        out.on("end", () => resolve(Buffer.concat(chunks)));
        out.on("error", (e: Error) => reject(e));
      });
    }
  }
  const blob: Blob = await anyInstance.toBlob();
  return Buffer.from(new Uint8Array(await blob.arrayBuffer()));
}
