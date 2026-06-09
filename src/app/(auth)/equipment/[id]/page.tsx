import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, MapPin, Bell, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasAccess } from "@/lib/access-control";
import { getReminderState } from "@/lib/services/maintenance-schedule";
import { CATEGORY_META, formatINR, formatDateIST } from "@/lib/equipment-display";
import { CategoryPill, StatusBadge, EquipmentEmptyState } from "@/components/equipment/ui";
import { CategoryIcon } from "@/components/equipment/category-icon";
import { DetailActions } from "@/components/equipment/detail-actions";
import { MaintenanceHistory } from "@/components/equipment/maintenance-history";
import type { HistoryRecord } from "@/components/equipment/maintenance-history";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}

const HISTORY_PAGE_SIZE = 25;

function InfoCell({
  icon,
  label,
  children,
}: {
  icon: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-[3px]">
      <div
        className="flex items-center gap-[5px] font-[550]"
        style={{ fontSize: 11.5, color: "#71717a" }}
      >
        <CategoryIcon name={icon} size={13} />
        {label}
      </div>
      <div
        className="font-semibold text-foreground"
        style={{ fontSize: 13.5 }}
      >
        {children}
      </div>
    </div>
  );
}

export default async function EquipmentDetailPage({ params, searchParams }: Props) {
  const session = await auth();
  if (!session) redirect("/login");

  // @ts-expect-error - extended session fields
  const role: string = session.user.role ?? "";
  // @ts-expect-error - extended session fields
  const sessionBranchId: string | null = session.user.branchId ?? null;

  if (!hasAccess(role, "equipment.view")) redirect("/dashboard");

  const { id } = await params;
  const { page: pageParam } = await searchParams;

  const item = await prisma.equipment.findUnique({
    where: { id },
    include: { branch: { select: { id: true, name: true } } },
  });

  if (!item) notFound();

  // BRANCH_MANAGER can only see their own branch's items
  if (role === "BRANCH_MANAGER" && item.branchId !== sessionBranchId) {
    redirect("/equipment");
  }

  // ── Maintenance history: paginated 25/page, ?page= is reload-friendly ──────
  const totalRecords = await prisma.maintenanceRecord.count({
    where: { equipmentId: id },
  });
  const totalPages = Math.max(1, Math.ceil(totalRecords / HISTORY_PAGE_SIZE));
  const requestedPage = Number(pageParam);
  const page = Number.isFinite(requestedPage)
    ? Math.min(Math.max(Math.trunc(requestedPage), 1), totalPages)
    : 1;
  const spendAgg = await prisma.maintenanceRecord.aggregate({
    where: { equipmentId: id },
    _sum: { cost: true },
  });
  const pageRecords = await prisma.maintenanceRecord.findMany({
    where: { equipmentId: id },
    orderBy: { serviceDate: "desc" },
    include: { loggedBy: { select: { name: true } } },
    skip: (page - 1) * HISTORY_PAGE_SIZE,
    take: HISTORY_PAGE_SIZE,
  });

  const canManage = hasAccess(role, "equipment.manage");
  const canSnooze = hasAccess(role, "equipment.snooze");
  const canLog = hasAccess(role, "equipment.records.create");

  const today = new Date();
  const reminderState = getReminderState(
    {
      nextDueDate: item.nextDueDate,
      reminderLeadDays: item.reminderLeadDays,
      snoozedUntil: item.snoozedUntil,
      status: item.status,
    },
    today
  );

  const cm = CATEGORY_META[item.category] ?? CATEGORY_META["OTHER"];

  // Format dates (IST, server-timezone independent)
  const lastServiced = formatDateIST(item.lastServiceDate);
  const nextDue = formatDateIST(item.nextDueDate);
  const snoozedUntilStr =
    item.snoozedUntil && item.snoozedUntil > today
      ? formatDateIST(item.snoozedUntil)
      : null;

  // Map records to serialisable shape (Decimal → number, Date → ISO string)
  const historyRecords: HistoryRecord[] = pageRecords.map((r) => ({
    id: r.id,
    serviceDate: r.serviceDate.toISOString(),
    maintenanceType: r.maintenanceType,
    issue: r.issue,
    vendorName: r.vendorName,
    vendorContact: r.vendorContact,
    cost: Number(r.cost),
    status: r.status,
    remarks: r.remarks,
    billUrl: r.billUrl,
    photoUrls: r.photoUrls,
    loggedBy: r.loggedBy,
  }));

  const totalSpend = Number(spendAgg._sum.cost ?? 0);

  return (
    <div className="flex-1 space-y-6 p-4 pt-4 md:p-8 md:pt-6">
      {/* Back link */}
      <div>
        <Link
          href="/equipment"
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          style={{ marginLeft: -8 }}
        >
          <ArrowLeft size={15} />
          Back to items
        </Link>
      </div>

      {/* Info header card */}
      <div className="rounded-xl border bg-card p-4 md:p-[22px] shadow-sm">
        {/* Top row: icon + name/badges + actions */}
        <div className="flex items-start gap-3 md:gap-4">
          {/* Category icon tile */}
          <div
            className="flex h-[44px] w-[44px] flex-none items-center justify-center rounded-[11px]"
            style={{ background: cm.bg, color: cm.fg }}
          >
            <CategoryIcon name={cm.icon} size={22} strokeWidth={2.1} />
          </div>

          {/* Name + category + location */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-[10px]">
              <h1 className="text-[19px] font-bold tracking-[-0.02em] md:text-[21px]">
                {item.name}
              </h1>
              <StatusBadge state={reminderState} />
              {item.status === "RETIRED" && (
                <Badge variant="secondary" className="text-[12px] text-muted-foreground">
                  Inactive
                </Badge>
              )}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-[10px]">
              <CategoryPill category={item.category} size="sm" />
              <span
                className="inline-flex items-center gap-[5px] text-muted-foreground"
                style={{ fontSize: 12.5 }}
              >
                <MapPin size={13} />
                {item.branch.name}
                {item.location ? ` · ${item.location}` : ""}
              </span>
            </div>
          </div>

          {/* Actions — hidden on mobile, shown inline on sm+ */}
          <div className="hidden sm:block">
            <DetailActions
              equipmentId={item.id}
              equipmentName={item.name}
              canManage={canManage}
              canSnooze={canSnooze}
              canLog={canLog}
              status={item.status}
            />
          </div>
        </div>

        {/* Mobile-only stacked actions */}
        <div className="mt-3 sm:hidden">
          <DetailActions
            equipmentId={item.id}
            equipmentName={item.name}
            canManage={canManage}
            canSnooze={canSnooze}
            canLog={canLog}
            status={item.status}
          />
        </div>

        {/* Divider */}
        <div className="my-4 border-t md:my-5" />

        {/* Info grid — 2-col on mobile, 4-col on md+ */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-5">
          <InfoCell icon="calendar" label="Frequency">
            {item.frequencyMonths
              ? `Every ${item.frequencyMonths} month${item.frequencyMonths === 1 ? "" : "s"}`
              : "One-off"}
          </InfoCell>

          <InfoCell icon="bell" label="Reminder lead">
            {item.reminderLeadDays} days before
          </InfoCell>

          <InfoCell icon="calendar" label="Last serviced">
            {lastServiced}
          </InfoCell>

          <InfoCell icon="calendar" label="Next due">
            <span>{nextDue}</span>
            {snoozedUntilStr && (
              <span
                className="ml-1.5 inline-flex items-center gap-1 font-medium text-muted-foreground"
                style={{ fontSize: 11.5 }}
              >
                <Bell size={11} className="inline" />
                Snoozed until {snoozedUntilStr}
              </span>
            )}
          </InfoCell>
        </div>

        {/* Notes block */}
        {item.notes && (
          <div
            className="mt-[18px] rounded-lg border px-[13px] py-[11px] text-[12.5px] leading-[1.5] text-muted-foreground"
            style={{ background: "#fafafa" }}
          >
            <strong className="font-semibold text-foreground">Note </strong>
            {item.notes}
          </div>
        )}
      </div>

      {/* History section */}
      <div className="overflow-x-auto">
        {/* History heading */}
        <div className="mb-3.5 flex items-center justify-between">
          <h2 className="text-[15.5px] font-bold">
            Maintenance History
            <span className="ml-1.5 font-[500] text-muted-foreground">
              {totalRecords}
            </span>
          </h2>
          {totalRecords > 0 && (
            <span className="text-[12.5px] text-muted-foreground">
              Total spend{" "}
              <strong className="tabular-nums text-foreground">
                {formatINR(totalSpend)}
              </strong>
            </span>
          )}
        </div>

        {totalRecords === 0 ? (
          <div className="rounded-xl border bg-card shadow-sm">
            <EquipmentEmptyState
              icon="wrench"
              title="No history yet"
              body="Once you log a maintenance entry, it will appear here as a timeline."
              compact
              action={
                canManage ? (
                  <Link
                    href={`/equipment/${item.id}/records/new`}
                    className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    <Calendar size={15} />
                    Log Maintenance
                  </Link>
                ) : undefined
              }
            />
          </div>
        ) : (
          <>
            <MaintenanceHistory records={historyRecords} />
            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between">
                <span className="text-[12.5px] text-muted-foreground">
                  Page {page} of {totalPages} · {totalRecords} entries
                </span>
                <div className="flex items-center gap-2">
                  {page > 1 ? (
                    <Link
                      href={`/equipment/${item.id}?page=${page - 1}`}
                      scroll={false}
                      className="inline-flex items-center gap-1 rounded-md border bg-card px-3 py-1.5 text-[13px] font-medium transition-colors hover:bg-accent"
                    >
                      <ArrowLeft size={14} />
                      Previous
                    </Link>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-[13px] font-medium text-muted-foreground opacity-50">
                      <ArrowLeft size={14} />
                      Previous
                    </span>
                  )}
                  {page < totalPages ? (
                    <Link
                      href={`/equipment/${item.id}?page=${page + 1}`}
                      scroll={false}
                      className="inline-flex items-center gap-1 rounded-md border bg-card px-3 py-1.5 text-[13px] font-medium transition-colors hover:bg-accent"
                    >
                      Next
                      <ArrowLeft size={14} className="rotate-180" />
                    </Link>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-[13px] font-medium text-muted-foreground opacity-50">
                      Next
                      <ArrowLeft size={14} className="rotate-180" />
                    </span>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
