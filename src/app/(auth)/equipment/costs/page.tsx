import { redirect } from "next/navigation";
import Link from "next/link";
import { List, BarChart2 } from "lucide-react";
import { subMonths } from "date-fns";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasAccess } from "@/lib/access-control";
import { equipmentWhereForRole } from "@/lib/maintenance-access";
import type { Prisma } from "@prisma/client";
import {
  CATEGORY_META,
  ALL_CATEGORIES,
  categoryLabel,
  formatINR,
  formatDateIST,
} from "@/lib/equipment-display";
import { CategoryPill, EquipmentEmptyState } from "@/components/equipment/ui";
import { CostFilters } from "@/components/equipment/cost-filters";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Props {
  searchParams: Promise<{
    outlet?: string;
    category?: string;
    range?: string;
    from?: string;
    to?: string;
  }>;
}

const RANGE_VALUES = [
  "this-month",
  "last-month",
  "3m",
  "6m",
  "12m",
  "custom",
] as const;

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
function istTodayParts(): { y: number; m: number; d: number } {
  const ist = new Date(Date.now() + IST_OFFSET_MS);
  return { y: ist.getUTCFullYear(), m: ist.getUTCMonth(), d: ist.getUTCDate() };
}
// UTC instant of IST 00:00:00 on y-m-d (m is 0-based)
function istStartOfDayUtc(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m, d, 0, 0, 0, 0) - IST_OFFSET_MS);
}
// UTC instant of the last millisecond of the IST day y-m-d
function istEndOfDayUtc(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m, d + 1, 0, 0, 0, 0) - IST_OFFSET_MS - 1);
}
function parseYmd(s: string): { y: number; m: number; d: number } | null {
  const parts = s.split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
  return { y: parts[0], m: parts[1] - 1, d: parts[2] };
}

export default async function CostSummaryPage({ searchParams }: Props) {
  const session = await auth();
  if (!session) redirect("/login");

  // @ts-expect-error - extended session fields
  const role: string = session.user.role ?? "";
  // @ts-expect-error - extended session fields
  const branchId: string | null = session.user.branchId ?? null;

  if (!hasAccess(role, "equipment.view")) redirect("/dashboard");

  const { outlet, category, range, from, to } = await searchParams;

  // Validate range; default 12m
  const rangeVal = (RANGE_VALUES as readonly string[]).includes(range ?? "")
    ? (range as (typeof RANGE_VALUES)[number])
    : "12m";

  // Resolve the service-date window [gte, lte] for the selected range.
  // Calendar-month/day boundaries are computed in IST so month edges are correct
  // regardless of the server's timezone (UTC in production).
  let gte: Date | null = null;
  let lte: Date | null = null;
  let rangeLabelText: string;

  if (rangeVal === "this-month") {
    const { y, m } = istTodayParts();
    gte = istStartOfDayUtc(y, m, 1);
    lte = new Date(istStartOfDayUtc(y, m + 1, 1).getTime() - 1);
    rangeLabelText = "this month";
  } else if (rangeVal === "last-month") {
    const { y, m } = istTodayParts();
    gte = istStartOfDayUtc(y, m - 1, 1);
    lte = new Date(istStartOfDayUtc(y, m, 1).getTime() - 1);
    rangeLabelText = "last month";
  } else if (rangeVal === "custom") {
    const f = from ? parseYmd(from) : null;
    const t = to ? parseYmd(to) : null;
    gte = f ? istStartOfDayUtc(f.y, f.m, f.d) : null;
    lte = t ? istEndOfDayUtc(t.y, t.m, t.d) : null;
    rangeLabelText =
      gte || lte
        ? `${gte ? formatDateIST(gte) : "start"} – ${lte ? formatDateIST(lte) : "today"}`
        : "all time";
  } else {
    const months = rangeVal === "3m" ? 3 : rangeVal === "6m" ? 6 : 12;
    gte = subMonths(new Date(), months);
    lte = null;
    rangeLabelText = `last ${months} months`;
  }

  const serviceDateWhere =
    gte || lte
      ? { serviceDate: { ...(gte ? { gte } : {}), ...(lte ? { lte } : {}) } }
      : {};

  // Determine branch scope
  const roleWhere = equipmentWhereForRole(role, branchId);
  // If roleWhere has a branchId key the user is BRANCH_MANAGER — their branch is locked
  const lockedBranchId =
    "branchId" in roleWhere && typeof roleWhere.branchId === "string"
      ? roleWhere.branchId
      : null;

  // Effective branchId for the query: locked for BRANCH_MANAGER, or from param for HR/MANAGEMENT
  const effectiveBranchId =
    lockedBranchId ??
    (outlet && (role === "HR" || role === "MANAGEMENT") ? outlet : null);

  // Category where (only known keys)
  const categoryOk =
    category && ALL_CATEGORIES.includes(category) ? category : null;

  // Build equipment relation filter for category (cast to Prisma enum type)
  const equipmentWhere: Prisma.EquipmentWhereInput | undefined = categoryOk
    ? { category: categoryOk as never }
    : undefined;

  // Query maintenance records
  const records = await prisma.maintenanceRecord.findMany({
    where: {
      ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
      ...serviceDateWhere,
      ...(equipmentWhere ? { equipment: equipmentWhere } : {}),
    },
    include: {
      equipment: {
        select: {
          id: true,
          name: true,
          category: true,
          branch: { select: { name: true } },
        },
      },
    },
  });

  // ── Compute aggregates ────────────────────────────────────────────────────

  const total = records.reduce((sum, r) => sum + Number(r.cost), 0);

  // by category
  const byCategoryMap: Record<string, number> = {};
  for (const r of records) {
    const cat = r.equipment.category;
    byCategoryMap[cat] = (byCategoryMap[cat] ?? 0) + Number(r.cost);
  }
  const byCategory = Object.entries(byCategoryMap).sort((a, b) => b[1] - a[1]);
  const maxCatValue = byCategory.length > 0 ? byCategory[0][1] : 1;

  // by item
  const byItemMap: Record<
    string,
    { name: string; category: string; branchName: string; cost: number; count: number }
  > = {};
  for (const r of records) {
    const eq = r.equipment;
    if (!byItemMap[eq.id]) {
      byItemMap[eq.id] = {
        name: eq.name,
        category: eq.category,
        branchName: eq.branch.name,
        cost: 0,
        count: 0,
      };
    }
    byItemMap[eq.id].cost += Number(r.cost);
    byItemMap[eq.id].count += 1;
  }
  const byItem = Object.entries(byItemMap).sort((a, b) => b[1].cost - a[1].cost);

  const totalEntries = records.length;
  const totalItems = byItem.length;

  // ── Branches for outlet filter (HR/MANAGEMENT only) ───────────────────────
  const branches =
    role === "HR" || role === "MANAGEMENT"
      ? await prisma.branch.findMany({
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : [];

  const lockedOutletId = lockedBranchId;

  return (
    <div className="flex-1 space-y-6 p-4 pt-4 md:p-8 md:pt-6">
      {/* Header */}
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex-1 min-w-0">
          <h2 className="text-[22px] font-bold tracking-[-0.02em] text-foreground">
            Maintenance
          </h2>
          <p className="mt-1 text-[13.5px] text-muted-foreground">
            Spend analysis across equipment &amp; services.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex items-center rounded-lg border bg-muted p-0.5">
          <Link
            href="/equipment"
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <List size={15} />
            Items
          </Link>
          <span className="flex items-center gap-1.5 rounded-md bg-background px-3 py-1.5 text-[13px] font-semibold shadow-sm">
            <BarChart2 size={15} />
            <span className="hidden sm:inline">Cost Summary</span>
            <span className="sm:hidden">Costs</span>
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="border-b bg-card px-4 py-3">
          <CostFilters outlets={branches} lockedOutletId={lockedOutletId} />
        </div>

        {/* Two-column grid: headline card + by-category card */}
        <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-[300px_1fr]">
          {/* Total spend card */}
          <Card className="flex flex-col justify-center">
            <CardContent className="px-6 py-6">
              <div className="text-[12.5px] font-[550] text-muted-foreground">
                Total spend · {rangeLabelText}
              </div>
              <div
                className="mt-1.5 text-[38px] font-[800] leading-[1] tracking-[-0.03em] tabular-nums text-foreground"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {formatINR(total)}
              </div>
              <div className="mt-2.5 flex gap-3.5 text-[12.5px] text-muted-foreground">
                <span>
                  <strong className="text-foreground">{totalEntries}</strong>{" "}
                  {totalEntries === 1 ? "entry" : "entries"}
                </span>
                <span>
                  <strong className="text-foreground">{totalItems}</strong>{" "}
                  {totalItems === 1 ? "item" : "items"}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Spend by category card */}
          <Card>
            <CardHeader className="pb-3 pt-5">
              <CardTitle className="text-[13px] font-[650]">
                Spend by category
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-5">
              {byCategory.length === 0 ? (
                <div className="py-2 text-[13px] text-muted-foreground">
                  No spend in this range.
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {byCategory.map(([cat, val]) => {
                    const cm = CATEGORY_META[cat] ?? CATEGORY_META["OTHER"];
                    const pct = Math.max(3, (val / maxCatValue) * 100);
                    return (
                      <div
                        key={cat}
                        className="flex items-center gap-3"
                      >
                        {/* Category label with dot */}
                        <div className="flex w-[140px] flex-none items-center gap-[7px] text-[12.5px] font-[550]">
                          <span
                            className="h-[9px] w-[9px] flex-none rounded-[3px]"
                            style={{ background: cm.dot }}
                          />
                          <span className="truncate">{categoryLabel(cat)}</span>
                        </div>
                        {/* Bar track */}
                        <div className="h-[22px] flex-1 overflow-hidden rounded-[6px] bg-muted">
                          <div
                            className="h-full rounded-[6px] transition-[width] [transition-duration:400ms] ease-in-out"
                            style={{
                              width: `${pct}%`,
                              background: cm.dot,
                              opacity: 0.85,
                            }}
                          />
                        </div>
                        {/* Amount */}
                        <div className="w-[84px] text-right text-[12.5px] font-[650] tabular-nums">
                          {formatINR(val)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Breakdown by item */}
      <div className="overflow-hidden rounded-xl border bg-card shadow-sm overflow-x-auto">
        <div className="border-b px-4 py-3 text-[13px] font-[650]">
          Breakdown by item
        </div>

        {byItem.length === 0 ? (
          <EquipmentEmptyState
            icon="bar-chart-2"
            title="No spend to show"
            compact
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Outlet</TableHead>
                <TableHead className="text-right">Entries</TableHead>
                <TableHead className="text-right">Total spend</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byItem.map(([id, row]) => (
                <TableRow key={id}>
                  <TableCell className="font-semibold">{row.name}</TableCell>
                  <TableCell>
                    <CategoryPill category={row.category} size="sm" />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.branchName}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {row.count}
                  </TableCell>
                  <TableCell className="text-right font-[650] tabular-nums">
                    {formatINR(row.cost)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={4} className="font-[650]">
                  Total
                </TableCell>
                <TableCell className="text-right font-[750] tabular-nums">
                  {formatINR(total)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        )}
      </div>
    </div>
  );
}
