import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus, List, BarChart2 } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasAccess } from "@/lib/access-control";
import { ALL_CATEGORIES } from "@/lib/equipment-display";
import { equipmentWhereForRole } from "@/lib/maintenance-access";
import { getReminderState } from "@/lib/services/maintenance-schedule";
import { StatCard, EquipmentEmptyState } from "@/components/equipment/ui";
import { EquipmentFilters } from "@/components/equipment/equipment-filters";
import { EquipmentTable } from "@/components/equipment/equipment-table";
import type { EquipmentRow } from "@/components/equipment/equipment-table";
import { Button } from "@/components/ui/button";

interface Props {
  searchParams: Promise<{
    outlet?: string;
    category?: string;
    status?: string;
    lifecycle?: string;
  }>;
}

// Map design status param values → ReminderState enum keys
const STATUS_PARAM_MAP: Record<string, string> = {
  overdue: "OVERDUE",
  "due-soon": "DUE_SOON",
  snoozed: "SNOOZED",
  ok: "OK",
};

export default async function EquipmentPage({ searchParams }: Props) {
  const session = await auth();
  if (!session) redirect("/login");

  // @ts-expect-error - extended session fields
  const role: string = session.user.role ?? "";
  // @ts-expect-error - extended session fields
  const branchId: string | null = session.user.branchId ?? null;

  if (!hasAccess(role, "equipment.view")) redirect("/dashboard");

  const { outlet, category, status, lifecycle } = await searchParams;

  // ── Build DB where clause ────────────────────────────────────────────────
  const roleWhere = equipmentWhereForRole(role, branchId);

  // Outlet param: HR/MANAGEMENT can filter by outlet (= branchId at DB level)
  const outletWhere =
    outlet && (role === "HR" || role === "MANAGEMENT")
      ? { branchId: outlet }
      : {};

  // Category filter — only add if it's a known key to prevent injection
  const categoryWhere =
    category && ALL_CATEGORIES.includes(category) ? { category: category as never } : {};

  // Lifecycle param drives the DB-level status filter ("active" / absent = ACTIVE, "inactive" = RETIRED, "all" = no filter)
  const lifecycleWhere =
    lifecycle === "inactive"
      ? { status: "RETIRED" as const }
      : lifecycle === "all"
      ? {}
      : { status: "ACTIVE" as const };

  const dbWhere = {
    ...roleWhere,
    ...outletWhere,
    ...categoryWhere,
    ...lifecycleWhere,
  };

  // ── Query equipment ──────────────────────────────────────────────────────
  const equipment = await prisma.equipment.findMany({
    where: dbWhere,
    include: { branch: { select: { id: true, name: true } } },
    orderBy: [{ nextDueDate: "asc" }, { name: "asc" }],
  });

  // ── Fetch all branches for filter dropdown ───────────────────────────────
  const branches = await prisma.branch.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  // ── Derive reminder states ───────────────────────────────────────────────
  const today = new Date();

  const rowsWithState = equipment.map((item) => {
    const reminderState = getReminderState(
      {
        nextDueDate: item.nextDueDate,
        reminderLeadDays: item.reminderLeadDays,
        snoozedUntil: item.snoozedUntil,
        status: item.status,
      },
      today
    );
    return { item, reminderState };
  });

  // ── Stat counts (from all rows before reminder-state filter) ─────────────
  const overdueCount = rowsWithState.filter(
    (r) => r.reminderState === "OVERDUE"
  ).length;
  const dueSoonCount = rowsWithState.filter(
    (r) => r.reminderState === "DUE_SOON"
  ).length;
  const activeCount = rowsWithState.length;

  // ── Filter by reminder-state param ──────────────────────────────────────
  const targetState = status ? STATUS_PARAM_MAP[status] : null;
  const filteredRows = targetState
    ? rowsWithState.filter((r) => r.reminderState === targetState)
    : rowsWithState;

  // ── Sort: overdue → due-soon → snoozed → ok, then by days ────────────────
  const ORDER: Record<string, number> = {
    OVERDUE: 0,
    DUE_SOON: 1,
    SNOOZED: 2,
    OK: 3,
    NONE: 4,
  };
  const sorted = [...filteredRows].sort((a, b) => {
    const orderDiff = (ORDER[a.reminderState] ?? 4) - (ORDER[b.reminderState] ?? 4);
    if (orderDiff !== 0) return orderDiff;
    // secondary: by nextDueDate asc
    const aDate = a.item.nextDueDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const bDate = b.item.nextDueDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
    return aDate - bDate;
  });

  // ── Map to EquipmentRow (Date → ISO string) ──────────────────────────────
  const tableRows: EquipmentRow[] = sorted.map(({ item }) => ({
    id: item.id,
    name: item.name,
    category: item.category,
    location: item.location,
    status: item.status,
    reminderLeadDays: item.reminderLeadDays,
    frequencyMonths: item.frequencyMonths,
    nextDueDate: item.nextDueDate ? item.nextDueDate.toISOString() : null,
    lastServiceDate: item.lastServiceDate
      ? item.lastServiceDate.toISOString()
      : null,
    snoozedUntil: item.snoozedUntil ? item.snoozedUntil.toISOString() : null,
    branch: item.branch,
  }));

  const canManage = hasAccess(role, "equipment.manage");
  const canSnooze = hasAccess(role, "equipment.snooze");
  const canLog = hasAccess(role, "equipment.records.create");
  const lockedOutletId = role === "BRANCH_MANAGER" ? branchId : null;

  // ── Header subtitle ───────────────────────────────────────────────────────
  const outletBranch = outlet
    ? branches.find((b) => b.id === outlet)?.name
    : null;
  const subtitle =
    role === "BRANCH_MANAGER" && branchId
      ? `Equipment & recurring services · ${branches.find((b) => b.id === branchId)?.name ?? "your outlet"}`
      : outletBranch
      ? `Equipment & recurring services · ${outletBranch}`
      : `Equipment & recurring services across ${branches.length} outlets`;

  // ── Build stat card links ─────────────────────────────────────────────────
  function buildStatusLink(s: string) {
    const base = outlet ? `?outlet=${outlet}&` : "?";
    const cat = category ? `category=${category}&` : "";
    const lc =
      lifecycle && lifecycle !== "active" ? `lifecycle=${lifecycle}&` : "";
    return status === s
      ? `${base}${cat}${lc}` // clicking active filter → clear it
      : `${base}${cat}${lc}status=${s}`;
  }

  const isEmpty = equipment.length === 0;

  return (
    <div className="flex-1 space-y-4 p-4 pt-4 md:p-8 md:pt-6">
      {/* Header */}
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-[22px] font-bold tracking-[-0.02em] text-foreground">
            Maintenance
          </h1>
          <p className="mt-1 text-[13.5px] text-muted-foreground">{subtitle}</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Tabs */}
          <div className="flex items-center rounded-lg border bg-muted p-0.5">
            <span className="flex items-center gap-1.5 rounded-md bg-background px-3 py-1.5 text-[13px] font-semibold shadow-sm">
              <List size={15} />
              Items
            </span>
            <Link
              href="/equipment/costs"
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <BarChart2 size={15} />
              <span className="hidden sm:inline">Cost Summary</span>
              <span className="sm:hidden">Costs</span>
            </Link>
          </div>

          {canManage && (
            <Button asChild>
              <Link href="/equipment/new">
                <Plus size={16} className="mr-1.5" />
                <span className="hidden sm:inline">Add Item</span>
                <span className="sm:hidden">Add</span>
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Stat cards — 3-across compact grid on mobile, flex row on desktop */}
      <div className="grid grid-cols-3 gap-2 md:flex md:gap-3.5">
        <Link
          href={buildStatusLink("overdue")}
          className="flex flex-1"
          tabIndex={-1}
        >
          <StatCard
            tone="red"
            icon="alert-triangle"
            value={overdueCount}
            label="Overdue"
            active={status === "overdue"}
            onClick={undefined}
          />
        </Link>
        <Link
          href={buildStatusLink("due-soon")}
          className="flex flex-1"
          tabIndex={-1}
        >
          <StatCard
            tone="amber"
            icon="clock"
            value={dueSoonCount}
            label="Due soon"
            active={status === "due-soon"}
            onClick={undefined}
          />
        </Link>
        <div className="flex flex-1">
          <StatCard
            tone="neutral"
            icon="wrench"
            value={activeCount}
            label="Active items"
            active={false}
            onClick={undefined}
          />
        </div>
      </div>

      {/* Filters + Table */}
      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        {/* Filter bar */}
        <div className="border-b bg-card px-4 py-3">
          <EquipmentFilters
            outlets={branches}
            lockedOutletId={lockedOutletId}
            lifecycle={lifecycle ?? "active"}
          />
        </div>

        {isEmpty ? (
          <EquipmentEmptyState
            icon="wrench"
            title="No items yet"
            body="Add your first piece of equipment or a recurring outlet service to start tracking maintenance."
            action={
              canManage ? (
                <Button asChild>
                  <Link href="/equipment/new">
                    <Plus size={16} className="mr-1.5" />
                    Add Item
                  </Link>
                </Button>
              ) : undefined
            }
          />
        ) : tableRows.length === 0 ? (
          <EquipmentEmptyState
            icon="search"
            title="No items match these filters"
            body="Try clearing a filter to see more."
            compact
          />
        ) : (
          <EquipmentTable
            rows={tableRows}
            canManage={canManage}
            canSnooze={canSnooze}
            canLog={canLog}
          />
        )}
      </div>
    </div>
  );
}
