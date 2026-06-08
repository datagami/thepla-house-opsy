import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  pdf,
} from "@react-pdf/renderer";
import type { LeaveType } from "@prisma/client";

// Server-side PDF generator for the leave application form. This is a parallel
// rendering pipeline to the on-screen print page at /leave-requests/[id]/form
// — it uses @react-pdf/renderer primitives so we can produce a Buffer to attach
// to the new-leave-request notification email. Layout intentionally tracks the
// print page so both versions look like the same document.

export interface LeaveApplicationPdfInput {
  refNo: string;
  filedOn: string; // already formatted
  employeeName: string;
  employeeNumId: number | null;
  departmentName: string | null;
  branchName: string | null;
  doj: string | null; // formatted
  leaveType: LeaveType;
  startDate: string; // formatted
  endDate: string; // formatted
  totalDays: number;
  reason: string;
}

const colors = {
  green: "#172E22",
  greenDeep: "#0F231A",
  gold: "#D49A3B",
  ink1: "#1B221E",
  ink2: "#535C57",
  ink3: "#7E8682",
  rule: "#DDE2DF",
  ruleStrong: "#C6CCC8",
  panel: "#F7F8F8",
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 28,
    paddingHorizontal: 46,
    paddingBottom: 32,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: colors.ink1,
    backgroundColor: "#FFFFFF",
  },
  letterhead: {
    textAlign: "center",
    paddingBottom: 10,
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.rule,
    borderBottomStyle: "solid",
  },
  brand: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: colors.green,
  },
  tagline: {
    marginTop: 3,
    fontSize: 8,
    letterSpacing: 1.4,
    color: colors.ink3,
  },
  addr: {
    marginTop: 6,
    fontSize: 8,
    color: colors.ink2,
  },
  refRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
    fontSize: 9,
    color: colors.ink2,
  },
  refKey: { color: colors.ink3, marginRight: 4 },
  refVal: { color: colors.ink1, fontFamily: "Helvetica-Bold" },
  docTitle: {
    textAlign: "center",
    fontSize: 15,
    fontFamily: "Helvetica-Bold",
    color: colors.green,
    letterSpacing: 2,
    marginBottom: 4,
    textTransform: "uppercase",
  },
  docTitleRule: {
    alignSelf: "center",
    width: 46,
    height: 2,
    backgroundColor: colors.gold,
    marginBottom: 12,
  },
  toLbl: {
    fontSize: 8,
    color: colors.ink3,
    letterSpacing: 1,
    marginBottom: 2,
  },
  toName: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginBottom: 8,
  },
  subject: {
    fontSize: 10.5,
    fontFamily: "Helvetica-Bold",
    marginBottom: 8,
    textDecoration: "underline",
    color: colors.ink1,
  },
  body: {
    fontSize: 10,
    lineHeight: 1.5,
    marginBottom: 6,
    color: colors.ink1,
  },
  bold: { fontFamily: "Helvetica-Bold", color: colors.greenDeep },
  fieldGrid: {
    marginTop: 6,
    marginBottom: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.rule,
    borderStyle: "solid",
    borderRadius: 3,
    flexDirection: "row",
    flexWrap: "wrap",
  },
  field: {
    width: "50%",
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 2,
    paddingRight: 8,
  },
  fieldKey: {
    width: 84,
    fontSize: 8,
    color: colors.ink3,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  fieldVal: {
    flex: 1,
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: colors.ink1,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.ruleStrong,
    borderBottomStyle: "dotted",
    paddingBottom: 1,
  },
  reasonHead: {
    fontSize: 8,
    color: colors.ink3,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  reasonBox: {
    borderWidth: 1,
    borderColor: colors.rule,
    borderStyle: "solid",
    borderRadius: 3,
    padding: 8,
    minHeight: 40,
    fontSize: 10,
    lineHeight: 1.4,
    marginBottom: 10,
  },
  declaration: {
    // `fontStyle: "italic"` requires an italic variant of the font family
    // to be registered with Font.register(). Built-in Helvetica only ships
    // Regular + Bold in @react-pdf/renderer, and the missing italic variant
    // makes the reconciler throw at render time (observed as React error #31
    // when the PDF attachment was added in PR #51). Drop the italic and lean
    // on size + color to differentiate the declaration from the body text.
    fontSize: 9.5,
    color: colors.ink2,
    lineHeight: 1.45,
    marginTop: 4,
    marginBottom: 8,
  },
  undertaking: {
    marginTop: 4,
    marginBottom: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderLeftWidth: 2,
    borderLeftColor: colors.gold,
    borderLeftStyle: "solid",
    backgroundColor: "#FBF6E8",
  },
  undertakingHead: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    color: colors.greenDeep,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  undertakingBody: {
    fontSize: 9.5,
    lineHeight: 1.45,
    color: colors.ink1,
    marginBottom: 3,
  },
  undertakingItem: {
    fontSize: 9.5,
    lineHeight: 1.45,
    color: colors.ink1,
    flexDirection: "row",
    marginTop: 2,
  },
  undertakingBullet: {
    width: 16,
    color: colors.gold,
    fontFamily: "Helvetica-Bold",
  },
  signatureRow: {
    flexDirection: "row",
    marginTop: 14,
    gap: 18,
  },
  sigCol: { flex: 1 },
  sigRole: {
    fontSize: 8,
    color: colors.ink3,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  sigLine: {
    marginTop: 22,
    borderTopWidth: 1,
    borderTopColor: colors.ink2,
    borderTopStyle: "solid",
    marginBottom: 4,
  },
  sigLbl: { fontSize: 8.5, color: colors.ink2 },
  sigNm: { fontSize: 9, fontFamily: "Helvetica-Bold", marginTop: 2 },
  hrUse: {
    marginTop: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.ruleStrong,
    borderStyle: "dashed",
    borderRadius: 3,
    backgroundColor: "#FBF5E6",
  },
  hrUseHead: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    color: colors.greenDeep,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  hrUseRow: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  hrUseField: {
    width: "50%",
    flexDirection: "row",
    paddingVertical: 2,
    paddingRight: 8,
  },
  hrUseKey: {
    width: 96,
    fontSize: 8,
    color: colors.ink3,
    letterSpacing: 0.6,
  },
  hrUseVal: {
    flex: 1,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.ruleStrong,
    borderBottomStyle: "dotted",
    minHeight: 12,
  },
  footer: {
    marginTop: 16,
    paddingTop: 5,
    borderTopWidth: 1,
    borderTopColor: colors.rule,
    borderTopStyle: "solid",
    fontSize: 7.5,
    color: colors.ink3,
  },
});

export function LeaveApplicationDocument({ input }: { input: LeaveApplicationPdfInput }) {
  const departmentAt = [input.departmentName, input.branchName]
    .filter(Boolean)
    .join(" / ");

  return (
    <Document title={`Leave Application — ${input.employeeName} — ${input.refNo}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.letterhead}>
          <Text style={styles.brand}>Thepla House</Text>
          <Text style={styles.tagline}>BY TEJAL&apos;S KITCHEN</Text>
          <Text style={styles.addr}>
            Gala No. 6, Shriguppi Industrial Estate, Sakivihar Road, Andheri (E), Mumbai — 400072
          </Text>
        </View>

        <View style={styles.refRow}>
          <View style={{ flexDirection: "row" }}>
            <Text style={styles.refKey}>REF. NO.</Text>
            <Text style={styles.refVal}>{input.refNo}</Text>
          </View>
          <View style={{ flexDirection: "row" }}>
            <Text style={styles.refKey}>DATE</Text>
            <Text style={styles.refVal}>{input.filedOn}</Text>
          </View>
        </View>

        <Text style={styles.docTitle}>Leave Application Form</Text>
        <View style={styles.docTitleRule} />

        <Text style={styles.toLbl}>TO</Text>
        <Text style={styles.toName}>The Human Resources Department</Text>

        <Text style={styles.subject}>
          Subject: Application for{" "}
          {input.leaveType.charAt(0) + input.leaveType.slice(1).toLowerCase()} Leave
        </Text>

        <Text style={styles.body}>Sir / Madam,</Text>
        <Text style={styles.body}>
          I am <Text style={styles.bold}>{input.employeeName}</Text>
          {departmentAt && <Text>, working in <Text style={styles.bold}>{departmentAt}</Text></Text>}
          . I am asking for <Text style={styles.bold}>{input.leaveType}</Text> leave for{" "}
          <Text style={styles.bold}>{input.totalDays}</Text>{" "}
          {input.totalDays === 1 ? "day" : "days"}, from{" "}
          <Text style={styles.bold}>{input.startDate}</Text> to{" "}
          <Text style={styles.bold}>{input.endDate}</Text> (both days included). The reason is given below.
        </Text>

        <View style={styles.fieldGrid}>
          <View style={styles.field}>
            <Text style={styles.fieldKey}>EMPLOYEE</Text>
            <Text style={styles.fieldVal}>{input.employeeName}</Text>
          </View>
          <View style={styles.field}>
            <Text style={styles.fieldKey}>EMPLOYEE ID</Text>
            <Text style={styles.fieldVal}>{input.employeeNumId ?? "—"}</Text>
          </View>
          <View style={styles.field}>
            <Text style={styles.fieldKey}>DEPARTMENT</Text>
            <Text style={styles.fieldVal}>{input.departmentName ?? "—"}</Text>
          </View>
          <View style={styles.field}>
            <Text style={styles.fieldKey}>BRANCH</Text>
            <Text style={styles.fieldVal}>{input.branchName ?? "—"}</Text>
          </View>
          <View style={styles.field}>
            <Text style={styles.fieldKey}>DATE OF JOINING</Text>
            <Text style={styles.fieldVal}>{input.doj ?? "—"}</Text>
          </View>
          <View style={styles.field}>
            <Text style={styles.fieldKey}>LEAVE TYPE</Text>
            <Text style={styles.fieldVal}>{input.leaveType}</Text>
          </View>
          <View style={styles.field}>
            <Text style={styles.fieldKey}>FROM</Text>
            <Text style={styles.fieldVal}>{input.startDate}</Text>
          </View>
          <View style={styles.field}>
            <Text style={styles.fieldKey}>TO</Text>
            <Text style={styles.fieldVal}>{input.endDate}</Text>
          </View>
          <View style={styles.field}>
            <Text style={styles.fieldKey}>TOTAL DAYS</Text>
            <Text style={styles.fieldVal}>{input.totalDays}</Text>
          </View>
          <View style={styles.field}>
            <Text style={styles.fieldKey}>FILED ON</Text>
            <Text style={styles.fieldVal}>{input.filedOn}</Text>
          </View>
        </View>

        <Text style={styles.reasonHead}>REASON FOR LEAVE</Text>
        <Text style={styles.reasonBox}>{input.reason}</Text>

        <Text style={styles.declaration}>
          I confirm that the details given above are correct. I will inform my branch manager before my leave starts
          and hand over my pending work. I will keep my phone on and answer if the office calls me during my leave.
        </Text>

        <View style={styles.undertaking}>
          <Text style={styles.undertakingHead}>
            Acknowledgement on Failure to Resume Duty
          </Text>
          <Text style={styles.undertakingBody}>
            Should I fail to report back to duty on or before the next working day following the expiry of the leave
            period sanctioned above, I hereby acknowledge and accept that:
          </Text>
          <View style={styles.undertakingItem}>
            <Text style={styles.undertakingBullet}>(i)</Text>
            <Text style={{ flex: 1 }}>
              I shall forfeit my eligibility for the annual performance appraisal cycle, together with any associated
              increments, bonuses and benefits for the relevant assessment year.
            </Text>
          </View>
          <View style={styles.undertakingItem}>
            <Text style={styles.undertakingBullet}>(ii)</Text>
            <Text style={{ flex: 1 }}>
              My employment with the Company shall stand discontinued, and any subsequent re-engagement shall be
              entirely at the Company&apos;s sole discretion, subject to availability of a suitable vacancy. Such
              re-engagement, if granted, shall be treated as <Text style={styles.bold}>fresh employment</Text> —
              with no continuity of service, tenure, accrued leave balance or seniority being preserved.
            </Text>
          </View>
          <View style={styles.undertakingItem}>
            <Text style={styles.undertakingBullet}>(iii)</Text>
            <Text style={{ flex: 1 }}>
              The Company shall be entitled to withhold my final month&apos;s salary and any other dues then payable
              to me, until such time as a suitable replacement has been engaged and adequately trained to assume my
              responsibilities. No interest or compensation shall be payable by the Company in respect of the period
              of such withholding.
            </Text>
          </View>
          <View style={styles.undertakingItem}>
            <Text style={styles.undertakingBullet}>(iv)</Text>
            <Text style={{ flex: 1 }}>
              Routine or general representations — including illness without documentary support
              (&quot;bimar ho gaya hu&quot;), personal financial constraints (&quot;paise nahi hain&quot;), family
              disputes or similar reasons — shall NOT be regarded as valid justification for failure to resume duty
              within the sanctioned period. Only verified medical emergencies, supported by a certificate issued by a
              Registered Medical Practitioner, or other circumstances accepted at the sole discretion of the Company,
              shall be entertained.
            </Text>
          </View>
        </View>

        <View style={styles.signatureRow}>
          <View style={styles.sigCol}>
            <Text style={styles.sigRole}>EMPLOYEE</Text>
            <View style={styles.sigLine} />
            <Text style={styles.sigNm}>{input.employeeName}</Text>
            <Text style={styles.sigLbl}>Signature &amp; Date</Text>
          </View>
          <View style={styles.sigCol}>
            <Text style={styles.sigRole}>BRANCH MANAGER</Text>
            <View style={styles.sigLine} />
            <Text style={styles.sigLbl}>Signature &amp; Date</Text>
          </View>
          <View style={styles.sigCol}>
            <Text style={styles.sigRole}>HR / MANAGEMENT</Text>
            <View style={styles.sigLine} />
            <Text style={styles.sigLbl}>Signature &amp; Date</Text>
          </View>
        </View>

        <View style={styles.hrUse}>
          <Text style={styles.hrUseHead}>FOR HR USE ONLY</Text>
          <View style={styles.hrUseRow}>
            <View style={styles.hrUseField}>
              <Text style={styles.hrUseKey}>Decision</Text>
              <Text style={styles.hrUseVal}> </Text>
            </View>
            <View style={styles.hrUseField}>
              <Text style={styles.hrUseKey}>Decision Date</Text>
              <Text style={styles.hrUseVal}> </Text>
            </View>
            <View style={styles.hrUseField}>
              <Text style={styles.hrUseKey}>Leave Balance Used</Text>
              <Text style={styles.hrUseVal}> </Text>
            </View>
            <View style={styles.hrUseField}>
              <Text style={styles.hrUseKey}>Remarks</Text>
              <Text style={styles.hrUseVal}> </Text>
            </View>
          </View>
        </View>

        <Text style={styles.footer}>
          Leave Application · {input.employeeName} · Ref. {input.refNo}
        </Text>
      </Page>
    </Document>
  );
}

export async function renderLeaveApplicationPdf(
  input: LeaveApplicationPdfInput
): Promise<Buffer> {
  const instance = pdf(<LeaveApplicationDocument input={input} />);
  // @react-pdf returns Blob in browser and Buffer-like stream/buffer on server.
  // The toBuffer() helper isn't always present across versions — use toBlob()
  // and arrayBuffer() as a portable fallback.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyInstance = instance as any;
  if (typeof anyInstance.toBuffer === "function") {
    const out = await anyInstance.toBuffer();
    if (Buffer.isBuffer(out)) return out;
    if (out && typeof out.on === "function") {
      // It's a Node stream — collect chunks.
      return await new Promise<Buffer>((resolve, reject) => {
        const chunks: Buffer[] = [];
        out.on("data", (c: Buffer) => chunks.push(c));
        out.on("end", () => resolve(Buffer.concat(chunks)));
        out.on("error", (e: Error) => reject(e));
      });
    }
  }
  const blob: Blob = await anyInstance.toBlob();
  const arr = await blob.arrayBuffer();
  // Buffer.from(ArrayBuffer) returns a Buffer that SHARES memory with the
  // backing ArrayBuffer. Wrap in Uint8Array first to force a real copy so
  // the returned Buffer is decoupled from any future mutation of `arr`.
  return Buffer.from(new Uint8Array(arr));
}
