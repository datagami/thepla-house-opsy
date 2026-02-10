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

    // @ts-expect-error - role is not in the User type
    const userRole = session.user.role;
    const isHROrManagement = ["HR", "MANAGEMENT"].includes(userRole);

    // Only HR and MANAGEMENT can export reports
    if (!isHROrManagement) {
      return NextResponse.json(
        { error: "Unauthorized - Only HR and Management can export reports" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const fromDate = searchParams.get("fromDate");
    const toDate = searchParams.get("toDate");
    const branchId = searchParams.get("branchId");

    // Build where clause
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    // Filter by status (paid/eligible/pending/archived)
    if (status === "archived") {
      where.archivedAt = { not: null };
    } else {
      where.archivedAt = null; // active referrals only for payout statuses
      if (status === "paid") {
        where.paidAt = { not: null };
      } else if (status === "eligible") {
        where.paidAt = null;
        where.eligibleAt = { lte: new Date() };
      } else if (status === "pending") {
        where.paidAt = null;
        where.eligibleAt = { gt: new Date() };
      }
    }

    // Filter by eligibility date range
    if (fromDate || toDate) {
      where.eligibleAt = {};
      if (fromDate) {
        where.eligibleAt.gte = new Date(fromDate);
      }
      if (toDate) {
        where.eligibleAt.lte = new Date(toDate);
      }
    }

    // Filter by branch
    if (branchId && branchId !== "ALL") {
      where.referrer = {
        branchId: branchId,
      };
    }

    // Fetch all referrals with related data
    const allReferrals = await prisma.referral.findMany({
      where,
      include: {
        referrer: {
          select: {
            id: true,
            name: true,
            numId: true,
            email: true,
            branch: {
              select: {
                name: true,
              },
            },
          },
        },
        referredUser: {
          select: {
            id: true,
            name: true,
            numId: true,
            email: true,
            doj: true,
            status: true,
            branch: {
              select: {
                name: true,
              },
            },
          },
        },
        salary: {
          select: {
            id: true,
            month: true,
            year: true,
            paidAt: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Helper function to get status
    const getStatus = (referral: {
      paidAt: Date | null;
      eligibleAt: Date | null;
      archivedAt: Date | null;
    }) => {
      if (referral.archivedAt) {
        return "Archived";
      }
      if (referral.paidAt) {
        return "Paid";
      }
      const now = new Date();
      const eligibleDate = new Date(referral.eligibleAt!);
      if (now >= eligibleDate) {
        return "Eligible";
      }
      return "Pending";
    };

    // Create workbook
    const workbook = XLSX.utils.book_new();

    // Sheet 1: Summary by Referrer
    const referrerMap = new Map<
      string,
      {
        empNo: number;
        name: string;
        branch: string;
        totalReferrals: number;
        paidReferrals: number;
        eligibleReferrals: number;
        pendingReferrals: number;
        totalBonusAmount: number;
        paidBonusAmount: number;
        pendingBonusAmount: number;
      }
    >();

    allReferrals.forEach((referral) => {
      const referrerId = referral.referrerId;
      if (!referrerMap.has(referrerId)) {
        referrerMap.set(referrerId, {
          empNo: referral.referrer.numId,
          name: referral.referrer.name ?? "Unknown",
          branch: referral.referrer.branch?.name ?? "N/A",
          totalReferrals: 0,
          paidReferrals: 0,
          eligibleReferrals: 0,
          pendingReferrals: 0,
          totalBonusAmount: 0,
          paidBonusAmount: 0,
          pendingBonusAmount: 0,
        });
      }

      const referrerStats = referrerMap.get(referrerId)!;
      referrerStats.totalReferrals += 1;
      referrerStats.totalBonusAmount += referral.bonusAmount;

      const status = getStatus(referral);
      switch (status) {
        case "Paid":
          referrerStats.paidReferrals += 1;
          referrerStats.paidBonusAmount += referral.bonusAmount;
          break;
        case "Eligible":
          referrerStats.eligibleReferrals += 1;
          referrerStats.pendingBonusAmount += referral.bonusAmount;
          break;
        case "Pending":
          referrerStats.pendingReferrals += 1;
          referrerStats.pendingBonusAmount += referral.bonusAmount;
          break;
      }
    });

    const summaryData = Array.from(referrerMap.values())
      .sort((a, b) => b.totalReferrals - a.totalReferrals)
      .map((referrer) => ({
        "Referrer Emp No": referrer.empNo,
        "Referrer Name": referrer.name,
        Branch: referrer.branch,
        "Total Referrals": referrer.totalReferrals,
        "Paid Referrals": referrer.paidReferrals,
        "Eligible Referrals": referrer.eligibleReferrals,
        "Pending Referrals": referrer.pendingReferrals,
        "Total Bonus Amount": referrer.totalBonusAmount,
        "Paid Bonus Amount": referrer.paidBonusAmount,
        "Pending Bonus Amount": referrer.pendingBonusAmount,
      }));

    const summarySheet = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary by Referrer");

    // Sheet 2: All Referrals
    const referralsData = allReferrals.map((referral) => ({
      "Referrer Emp No": referral.referrer.numId,
      "Referrer Name": referral.referrer.name ?? "Unknown",
      "Referrer Branch": referral.referrer.branch?.name ?? "N/A",
      "Referred Emp No": referral.referredUser.numId,
      "Referred Name": referral.referredUser.name ?? "Unknown",
      "Referred Branch": referral.referredUser.branch?.name ?? "N/A",
      "Referred User Status": referral.referredUser.status ?? "N/A",
      "Referred DOJ": referral.referredUser.doj
        ? format(new Date(referral.referredUser.doj), "yyyy-MM-dd")
        : "N/A",
      "Bonus Amount": referral.bonusAmount,
      "Eligible Date": format(new Date(referral.eligibleAt), "yyyy-MM-dd"),
      Status: getStatus(referral),
      Archived: referral.archivedAt ? "Yes" : "No",
      "Archived At": referral.archivedAt
        ? format(new Date(referral.archivedAt), "yyyy-MM-dd")
        : "N/A",
      "Paid Date": referral.paidAt
        ? format(new Date(referral.paidAt), "yyyy-MM-dd")
        : "N/A",
      "Paid In Salary": referral.salary
        ? `${format(new Date(referral.salary.year, referral.salary.month - 1), "MMM yyyy")}`
        : "N/A",
      "Created Date": format(new Date(referral.createdAt), "yyyy-MM-dd"),
    }));

    const referralsSheet = XLSX.utils.json_to_sheet(referralsData);
    XLSX.utils.book_append_sheet(workbook, referralsSheet, "All Referrals");

    // Sheet 3: Statistics
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const statsData: any[] = [];

    // Overall Statistics (exclude archived from payout-related counts)
    const totalReferrals = allReferrals.length;
    const activeReferrals = allReferrals.filter((r) => r.archivedAt == null);
    const archivedCount = allReferrals.filter((r) => r.archivedAt != null).length;
    const paidCount = activeReferrals.filter((r) => r.paidAt).length;
    const eligibleCount = activeReferrals.filter(
      (r) => !r.paidAt && new Date(r.eligibleAt) <= new Date()
    ).length;
    const pendingCount = activeReferrals.filter(
      (r) => !r.paidAt && new Date(r.eligibleAt) > new Date()
    ).length;
    const totalBonusPaid = activeReferrals
      .filter((r) => r.paidAt)
      .reduce((sum, r) => sum + r.bonusAmount, 0);
    const totalBonusPending = activeReferrals
      .filter((r) => !r.paidAt)
      .reduce((sum, r) => sum + r.bonusAmount, 0);

    statsData.push({ "Statistic Type": "OVERALL STATISTICS" });
    statsData.push({
      "Statistic Type": "Total Referrals",
      Value: totalReferrals,
    });
    statsData.push({
      "Statistic Type": "Archived Count",
      Value: archivedCount,
    });
    statsData.push({
      "Statistic Type": "Paid Count",
      Value: paidCount,
    });
    statsData.push({
      "Statistic Type": "Eligible Count",
      Value: eligibleCount,
    });
    statsData.push({
      "Statistic Type": "Pending Count",
      Value: pendingCount,
    });
    statsData.push({
      "Statistic Type": "Total Bonus Paid",
      Value: totalBonusPaid,
    });
    statsData.push({
      "Statistic Type": "Total Bonus Pending",
      Value: totalBonusPending,
    });

    // By Branch
    statsData.push({ "Statistic Type": "" });
    statsData.push({ "Statistic Type": "BY BRANCH" });

    const branchStats = new Map<string, { count: number; totalBonus: number }>();
    allReferrals.forEach((referral) => {
      const branch = referral.referrer.branch?.name ?? "N/A";
      const current = branchStats.get(branch) || { count: 0, totalBonus: 0 };
      current.count += 1;
      current.totalBonus += referral.bonusAmount;
      branchStats.set(branch, current);
    });

    branchStats.forEach((stats, branch) => {
      statsData.push({
        "Statistic Type": branch,
        "Referrals Count": stats.count,
        "Total Bonus": stats.totalBonus,
      });
    });

    // Monthly Trend
    statsData.push({ "Statistic Type": "" });
    statsData.push({ "Statistic Type": "MONTHLY TREND (BY ELIGIBLE DATE)" });

    const monthStats = new Map<string, { referralsEligible: number; bonusAmount: number }>();
    allReferrals.forEach((referral) => {
      const monthKey = format(new Date(referral.eligibleAt), "yyyy-MM");
      const current = monthStats.get(monthKey) || { referralsEligible: 0, bonusAmount: 0 };
      current.referralsEligible += 1;
      current.bonusAmount += referral.bonusAmount;
      monthStats.set(monthKey, current);
    });

    Array.from(monthStats.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .forEach(([month, stats]) => {
        statsData.push({
          "Statistic Type": format(new Date(month + "-01"), "MMMM yyyy"),
          "Referrals Eligible": stats.referralsEligible,
          "Bonus Amount": stats.bonusAmount,
        });
      });

    const statsSheet = XLSX.utils.json_to_sheet(statsData);
    XLSX.utils.book_append_sheet(workbook, statsSheet, "Statistics");

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
      `attachment; filename=referrals-report-${format(new Date(), "yyyy-MM-dd")}.xlsx`
    );

    return response;
  } catch (error) {
    console.error("Error generating referrals report:", error);
    return NextResponse.json(
      { error: "Failed to generate referrals report" },
      { status: 500 }
    );
  }
}
