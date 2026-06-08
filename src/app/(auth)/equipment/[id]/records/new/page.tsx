import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasAccess } from "@/lib/access-control";
import { canManageBranch } from "@/lib/maintenance-access";
import { MaintenanceRecordForm } from "@/components/equipment/maintenance-record-form";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function NewMaintenanceRecordPage({ params }: Props) {
  const session = await auth();
  if (!session) redirect("/login");

  // @ts-expect-error - extended session fields
  const role: string = session.user.role ?? "";
  // @ts-expect-error - extended session fields
  const sessionBranchId: string | null = session.user.branchId ?? null;

  if (!hasAccess(role, "equipment.records.create")) redirect("/equipment");

  const { id } = await params;

  const item = await prisma.equipment.findUnique({
    where: { id },
    select: { id: true, name: true, branchId: true },
  });

  if (!item) notFound();

  if (!canManageBranch(role, sessionBranchId, item.branchId)) {
    redirect("/equipment");
  }

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <h2 className="text-2xl font-bold tracking-tight">
        Log Maintenance — {item.name}
      </h2>
      <div className="mx-auto max-w-2xl">
        <MaintenanceRecordForm equipmentId={item.id} />
      </div>
    </div>
  );
}
