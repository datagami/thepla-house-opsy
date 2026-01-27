import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import * as XLSX from "xlsx";
import { format } from "date-fns";

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const isSettled = searchParams.get("isSettled");
    const status = searchParams.get("status");
    const search = searchParams.get("search");
    const fromDate = searchParams.get("fromDate");
    const toDate = searchParams.get("toDate");
    const branchId = searchParams.get("branchId");

    // @ts-expect-error - role is not in the User type
    const userRole = session.user.role;
    const isHROrManagement = ["HR", "MANAGEMENT"].includes(userRole);
    const userId = session.user.id;

    // Build where clause (same as main route)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (!isHROrManagement) {
      where.userId = userId;
    }

    if (isSettled !== null && isSettled !== undefined && isSettled !== "") {
      where.isSettled = isSettled === "true";
    }

    if (status && status !== "ALL") {
      where.status = status;
    }

    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) {
        where.createdAt.gte = new Date(fromDate);
      }
      if (toDate) {
        where.createdAt.lte = new Date(toDate);
      }
    }

    if (isHROrManagement && branchId && branchId !== "ALL") {
      where.user = {
        branchId: branchId,
      };
    }

    if (search && isHROrManagement) {
      where.user = {
        ...where.user,
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { numId: isNaN(parseInt(search)) ? undefined : parseInt(search) },
        ].filter(Boolean),
      };
    }

    // Fetch all advances with related data
    const allAdvances = await prisma.advancePayment.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            numId: true,
            branch: {
              select: {
                name: true,
              },
            },
          },
        },
        approvedBy: {
          select: {
            name: true,
            numId: true,
          },
        },
        installments: {
          include: {
            salary: {
              select: {
                month: true,
                year: true,
              },
            },
            approvedBy: {
              select: {
                name: true,
                numId: true,
              },
            },
          },
          orderBy: {
            paidAt: "asc",
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Create workbook
    const workbook = XLSX.utils.book_new();

    // Sheet 1: Overview - Grouped by user
    const userAdvancesMap = new Map<
      string,
      {
        empNo: number;
        name: string;
        branch: string;
        totalAdvances: number;
        remainingBalance: number;
        emiAmount: number;
        advancesCount: number;
        status: string;
      }
    >();

    allAdvances.forEach((advance) => {
      const userId = advance.userId;
      if (!userAdvancesMap.has(userId)) {
        userAdvancesMap.set(userId, {
          empNo: advance.user.numId,
          name: advance.user.name ?? "Unknown",
          branch: advance.user.branch?.name ?? "N/A",
          totalAdvances: 0,
          remainingBalance: 0,
          emiAmount: 0,
          advancesCount: 0,
          status: "",
        });
      }

      const userStats = userAdvancesMap.get(userId)!;
      userStats.totalAdvances += advance.amount;
      userStats.remainingBalance += advance.remainingAmount;
      userStats.emiAmount += advance.emiAmount;
      userStats.advancesCount += 1;

      // Determine predominant status
      if (advance.isSettled) {
        userStats.status = "SETTLED";
      } else if (!userStats.status) {
        userStats.status = advance.status;
      } else if (userStats.status !== advance.status) {
        userStats.status = "MIXED";
      }
    });

    const overviewData = Array.from(userAdvancesMap.values())
      .sort((a, b) => b.remainingBalance - a.remainingBalance)
      .map((user) => ({
        "Emp No": user.empNo,
        Name: user.name,
        Branch: user.branch,
        "Total Advances": user.totalAdvances,
        "Remaining Balance": user.remainingBalance,
        "EMI Amount": user.emiAmount,
        "Advances Count": user.advancesCount,
        Status: user.status,
      }));

    const overviewSheet = XLSX.utils.json_to_sheet(overviewData);
    XLSX.utils.book_append_sheet(workbook, overviewSheet, "Overview");

    // Sheet 2: All Advances - Individual advances
    const advancesData = allAdvances.map((advance) => ({
      "Emp No": advance.user.numId,
      Name: advance.user.name ?? "Unknown",
      Branch: advance.user.branch?.name ?? "N/A",
      "Advance ID": advance.numId,
      Amount: advance.amount,
      "EMI Amount": advance.emiAmount,
      "Remaining Balance": advance.remainingAmount,
      Reason: advance.reason ?? "N/A",
      Status: advance.status,
      "Is Settled": advance.isSettled ? "Yes" : "No",
      "Requested Date": format(new Date(advance.createdAt), "yyyy-MM-dd"),
      "Approved By": advance.approvedBy
        ? `${advance.approvedBy.name} (#${advance.approvedBy.numId})`
        : "N/A",
      "Approved Date": advance.approvedAt
        ? format(new Date(advance.approvedAt), "yyyy-MM-dd")
        : "N/A",
    }));

    const advancesSheet = XLSX.utils.json_to_sheet(advancesData);
    XLSX.utils.book_append_sheet(workbook, advancesSheet, "All Advances");

    // Sheet 3: Payment History - All installments
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const paymentHistoryData: any[] = [];

    allAdvances.forEach((advance) => {
      advance.installments.forEach((installment) => {
        paymentHistoryData.push({
          "Emp No": advance.user.numId,
          Name: advance.user.name ?? "Unknown",
          Branch: advance.user.branch?.name ?? "N/A",
          "Advance ID": advance.numId,
          "Installment ID": installment.numId,
          "Amount Paid": installment.amountPaid,
          Status: installment.status,
          "Salary Month": installment.salary?.month ?? "N/A",
          "Salary Year": installment.salary?.year ?? "N/A",
          "Paid Date": installment.paidAt
            ? format(new Date(installment.paidAt), "yyyy-MM-dd")
            : "N/A",
          "Approved By": installment.approvedBy
            ? `${installment.approvedBy.name} (#${installment.approvedBy.numId})`
            : "N/A",
          "Approved Date": installment.approvedAt
            ? format(new Date(installment.approvedAt), "yyyy-MM-dd")
            : "N/A",
        });
      });
    });

    const paymentHistorySheet = XLSX.utils.json_to_sheet(paymentHistoryData);
    XLSX.utils.book_append_sheet(
      workbook,
      paymentHistorySheet,
      "Payment History"
    );

    // Generate Excel buffer
    const excelBuffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "buffer",
    });

    // Create response with Excel file
    const response = new NextResponse(excelBuffer);
    response.headers.set(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    response.headers.set(
      "Content-Disposition",
      `attachment; filename=advances-report-${format(new Date(), "yyyy-MM-dd")}.xlsx`
    );

    return response;
  } catch (error) {
    console.error("Error generating advances report:", error);
    return NextResponse.json(
      { error: "Failed to generate advances report" },
      { status: 500 }
    );
  }
}
