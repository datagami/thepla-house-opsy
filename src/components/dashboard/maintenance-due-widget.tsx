import Link from "next/link";
import { Wrench, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/equipment/ui";
import { EquipmentEmptyState } from "@/components/equipment/ui";
import { stateBadge, categoryLabel } from "@/lib/equipment-display";
import { getReminderState } from "@/lib/services/maintenance-schedule";
import { equipmentWhereForRole } from "@/lib/maintenance-access";
import { hasAccess } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";

export async function MaintenanceDueWidget({
  role,
  branchId,
}: {
  role: string;
  branchId: string | null;
}) {
  if (!hasAccess(role, "equipment.view")) return null;

  const items = await prisma.equipment.findMany({
    where: {
      ...equipmentWhereForRole(role, branchId),
      status: "ACTIVE",
      nextDueDate: { not: null },
    },
    include: { branch: { select: { name: true } } },
    orderBy: { nextDueDate: "asc" },
  });

  const today = new Date();

  const urgent = items
    .map((item) => ({
      item,
      state: getReminderState(
        {
          nextDueDate: item.nextDueDate,
          reminderLeadDays: item.reminderLeadDays,
          snoozedUntil: item.snoozedUntil,
          status: item.status as "ACTIVE" | "RETIRED",
        },
        today
      ),
    }))
    .filter(({ state }) => state === "OVERDUE" || state === "DUE_SOON")
    .sort((a, b) => {
      const aDate = a.item.nextDueDate!.getTime();
      const bDate = b.item.nextDueDate!.getTime();
      return aDate - bDate;
    })
    .slice(0, 5);

  if (urgent.length === 0) return null;

  const canLog = hasAccess(role, "equipment.records.create");

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <CardHeader className="flex flex-row items-center gap-3 border-b px-[18px] py-[15px] space-y-0">
        <div
          className="flex h-8 w-8 flex-none items-center justify-center rounded-lg"
          style={{ background: "hsl(var(--primary) / 0.1)", color: "hsl(var(--primary))" }}
        >
          <Wrench size={17} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold leading-snug">Maintenance due</div>
          <div className="text-xs text-muted-foreground">
            {urgent.length} need attention
          </div>
        </div>
        <Button variant="ghost" size="sm" asChild className="h-7 px-2 text-xs">
          <Link href="/equipment">
            View all <ArrowRight size={14} className="ml-1" />
          </Link>
        </Button>
      </CardHeader>

      {/* Body */}
      <CardContent className="px-2 py-[6px]">
        {urgent.length === 0 ? (
          <EquipmentEmptyState
            icon="check-circle"
            title="All clear"
            body="Nothing overdue or due soon."
            compact
          />
        ) : (
          <div className="flex flex-col">
            {urgent.map(({ item, state }) => {
              const badge = stateBadge(state);
              return (
                <div
                  key={item.id}
                  className="flex items-center gap-[11px] rounded-lg px-[10px] py-[9px] hover:bg-muted/60 transition-colors"
                >
                  {/* Status dot */}
                  <span
                    className="h-2 w-2 flex-none rounded-full"
                    style={{ background: badge.fg }}
                  />

                  {/* Name + outlet · category */}
                  <Link
                    href={`/equipment/${item.id}`}
                    className="flex-1 min-w-0 block"
                  >
                    <div className="truncate text-[13px] font-semibold text-foreground">
                      {item.name}
                    </div>
                    <div className="text-[11.5px] text-muted-foreground">
                      {item.branch.name}&nbsp;·&nbsp;{categoryLabel(item.category)}
                    </div>
                  </Link>

                  {/* Status badge */}
                  <StatusBadge state={state} size="sm" />

                  {/* Log button — only when user can create records */}
                  {canLog && (
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                      className="h-7 px-2 text-xs flex-none"
                    >
                      <Link href={`/equipment/${item.id}/records/new`}>
                        Log
                      </Link>
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
