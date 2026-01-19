import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { Prisma } from "@prisma/client";
import * as XLSX from "xlsx";

export async function GET(req: Request) {
  try {
    const session = await auth();
    // @ts-expect-error - role is not in the User type
    if (!session?.user || !["HR", "MANAGEMENT", "BRANCH_MANAGER"].includes(session.user.role)) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const year = parseInt(searchParams.get("year") || new Date().getFullYear().toString());
    const branchFilter = searchParams.get("branch") || "ALL";

    // @ts-expect-error - branchId/managedBranchId are not in the User type
    const userBranchId = session.user.managedBranchId ?? session.user.branchId;
    // @ts-expect-error - role is not in the User type
    const isBranchManager = session.user.role === "BRANCH_MANAGER";

    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year, 11, 31, 23, 59, 59);

    const whereClause: Prisma.UniformWhereInput = {
      issuedAt: { gte: yearStart, lte: yearEnd },
      user: {
        status: "ACTIVE",
        ...(isBranchManager && { branchId: userBranchId }),
        ...(branchFilter !== "ALL" && !isBranchManager && {
          branch: { name: branchFilter },
        }),
      },
    };

    const uniforms = await prisma.uniform.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            numId: true,
            name: true,
            branch: { select: { name: true } },
          },
        },
        issuedBy: { select: { name: true } },
        returnedBy: { select: { name: true } },
      },
      orderBy: { issuedAt: "desc" },
    });

    const reportData = uniforms.map((u) => ({
      "EMP ID": u.user?.numId ?? "",
      "EMP NAME": u.user?.name ?? "",
      "BRANCH": u.user?.branch?.name ?? "",
      "ITEM": u.itemName,
      "TYPE": u.itemType,
      "UNIFORM NO": (u as unknown as { uniform_number?: string | null }).uniform_number ?? "",
      "SIZE": u.size ?? "",
      "STATUS": u.status,
      "ISSUED AT": u.issuedAt ? u.issuedAt.toISOString().split("T")[0] : "",
      "ISSUED BY": u.issuedBy?.name ?? "",
      "RETURNED AT": u.returnedAt ? u.returnedAt.toISOString().split("T")[0] : "",
      "RETURNED BY": u.returnedBy?.name ?? "",
      "NOTES": u.notes ?? "",
    }));

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(reportData);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Uniforms");

    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });

    const response = new NextResponse(excelBuffer);
    response.headers.set(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    response.headers.set("Content-Disposition", `attachment; filename=uniform-report-${year}.xlsx`);
    return response;
  } catch (error) {
    console.error("Error exporting uniform report:", error);
    return NextResponse.json({ error: "Failed to export report" }, { status: 500 });
  }
}

