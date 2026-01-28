import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { Prisma } from "@prisma/client";
import ExcelJS from "exceljs";

const STATUS = {
  PRESENT: { code: "P", argb: "FFE8F5E9" },
  ABSENT: { code: "A", argb: "FFFFEBEE" },
  PENDING: { code: "-", argb: "FFFFF9C4" },
  HALF_DAY: { code: "HD", argb: "FFE3F2FD" },
  WEEKLY_OFF: { code: "WO", argb: "FFF3E5F5" },
  WORK_FROM_HOME: { code: "WFH", argb: "FFE0F2F1" },
  REJECTED: { code: "R", argb: "FFFFE4E6" },
} as const;

type StatusKey = keyof typeof STATUS;

function deriveStatus(rec: {
  isPresent: boolean;
  isHalfDay: boolean;
  isWeeklyOff: boolean;
  isWorkFromHome: boolean;
  status: string;
}): StatusKey {
  if (rec.status === "REJECTED") return "REJECTED";
  if (!rec.isPresent) return "ABSENT";
  if (rec.isWeeklyOff) return "WEEKLY_OFF";
  if (rec.isWorkFromHome) return "WORK_FROM_HOME";
  if (rec.isHalfDay) return "HALF_DAY";
  return "PRESENT";
}

function sanitizeSheetName(name: string): string {
  return name.replace(/[\[\]\\:*?/]/g, "").slice(0, 31) || "Sheet";
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export async function GET(req: Request) {
  try {
    const session = await auth();
    // @ts-expect-error - role is not in the User type
    if (!session?.user || !["HR", "MANAGEMENT"].includes(session.user.role)) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const month = parseInt(
      searchParams.get("month") || String(new Date().getMonth() + 1),
      10
    );
    const year = parseInt(
      searchParams.get("year") || String(new Date().getFullYear()),
      10
    );
    const branchFilter = searchParams.get("branch") || "ALL";

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    const daysInMonth = endDate.getDate();

    const employeeWhere: Prisma.UserWhereInput = {
      status: "ACTIVE",
      role: "EMPLOYEE",
      ...(branchFilter !== "ALL" && {
        branch: { name: branchFilter },
      }),
    };

    const employees = await prisma.user.findMany({
      where: employeeWhere,
      select: {
        id: true,
        numId: true,
        name: true,
        branch: { select: { name: true } },
      },
    });

    const attendance = await prisma.attendance.findMany({
      where: {
        date: { gte: startDate, lte: endDate },
        user: employeeWhere,
      },
      select: {
        userId: true,
        date: true,
        isPresent: true,
        isHalfDay: true,
        isWeeklyOff: true,
        isWorkFromHome: true,
        status: true,
      },
    });

    // Map: userId -> dateString (YYYY-MM-DD) -> record
    const attMap = new Map<string, Map<string, (typeof attendance)[0]>>();
    for (const a of attendance) {
      const key = a.date.toISOString().split("T")[0];
      if (!attMap.has(a.userId)) attMap.set(a.userId, new Map());
      attMap.get(a.userId)!.set(key, a);
    }

    // Group employees by branch
    const byBranch = new Map<string, typeof employees>();
    for (const e of employees) {
      const b = e.branch?.name ?? "Unknown";
      if (!byBranch.has(b)) byBranch.set(b, []);
      byBranch.get(b)!.push(e);
    }

    const branchNames = Array.from(byBranch.keys()).sort();

    const workbook = new ExcelJS.Workbook();

    const monthLabel = `${MONTH_NAMES[month - 1]} ${year}`;

    for (const branchName of branchNames) {
      const branchEmps = byBranch.get(branchName)!;
      const sheet = workbook.addWorksheet(sanitizeSheetName(branchName));

      // Title rows: branch name and period
      const branchTitleRow = sheet.addRow([`Branch: ${branchName}`]);
      branchTitleRow.getCell(1).font = { bold: true };
      const periodTitleRow = sheet.addRow([`Period: ${monthLabel}`]);
      periodTitleRow.getCell(1).font = { bold: true };

      // Headers: Emp ID | Name | 1..D | Present | Absent | Half Day | WFH | Weekly Off | Pending | Rejected
      const headerRow = [
        "Emp ID",
        "Name",
        ...Array.from({ length: daysInMonth }, (_, i) => String(i + 1)),
        "Present",
        "Absent",
        "Half Day",
        "WFH",
        "Weekly Off",
        "Pending",
        "Rejected",
      ];
      sheet.addRow(headerRow);

      const presentCol = 2 + daysInMonth + 1;
      const absentCol = presentCol + 1;
      const halfDayCol = absentCol + 1;
      const wfhCol = halfDayCol + 1;
      const woCol = wfhCol + 1;
      const pendingCol = woCol + 1;
      const rejectedCol = pendingCol + 1;

      for (const emp of branchEmps) {
        const counts: Record<StatusKey, number> = {
          PRESENT: 0,
          ABSENT: 0,
          PENDING: 0,
          HALF_DAY: 0,
          WEEKLY_OFF: 0,
          WORK_FROM_HOME: 0,
          REJECTED: 0,
        };

        const row: (string | number)[] = [
          emp.numId,
          emp.name ?? "",
        ];

        for (let d = 1; d <= daysInMonth; d++) {
          const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          const rec = attMap.get(emp.id)?.get(dateStr);
          let status: StatusKey;
          if (!rec) {
            status = "PENDING";
          } else {
            status = deriveStatus(rec);
          }
          counts[status] += 1;
          row.push(STATUS[status].code);
        }

        row.push(
          counts.PRESENT,
          counts.ABSENT,
          counts.HALF_DAY,
          counts.WORK_FROM_HOME,
          counts.WEEKLY_OFF,
          counts.PENDING,
          counts.REJECTED
        );

        const excelRow = sheet.addRow(row);

        // Color day cells (columns 3 to 2+daysInMonth, 1-based)
        for (let d = 1; d <= daysInMonth; d++) {
          const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          const rec = attMap.get(emp.id)?.get(dateStr);
          const status: StatusKey = !rec
            ? "PENDING"
            : deriveStatus(rec);
          const cell = excelRow.getCell(d + 2);
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: STATUS[status].argb },
          };
        }
      }
    }

    // Legend sheet
    const legendSheet = workbook.addWorksheet("Legend");
    legendSheet.addRow(["Code", "Meaning"]);
    legendSheet.addRow(["P", "Present"]);
    legendSheet.addRow(["A", "Absent"]);
    legendSheet.addRow(["-", "Pending"]);
    legendSheet.addRow(["HD", "Half Day"]);
    legendSheet.addRow(["WO", "Weekly Off"]);
    legendSheet.addRow(["WFH", "Work From Home"]);
    legendSheet.addRow(["R", "Rejected"]);

    const buffer = await workbook.xlsx.writeBuffer();

    const res = new NextResponse(buffer);
    res.headers.set(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.headers.set(
      "Content-Disposition",
      `attachment; filename=attendance-monthly-${month}-${year}.xlsx`
    );
    return res;
  } catch (error) {
    console.error("Error exporting attendance report:", error);
    return NextResponse.json(
      { error: "Failed to export attendance report" },
      { status: 500 }
    );
  }
}
