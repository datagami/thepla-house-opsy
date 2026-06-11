import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasAccess } from "@/lib/access-control";
import { canManageBranch } from "@/lib/maintenance-access";
import { EquipmentForm } from "@/components/equipment/equipment-form";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditEquipmentPage({ params }: Props) {
  const session = await auth();
  if (!session) redirect("/login");

  // @ts-expect-error - extended session fields
  const role: string = session.user.role ?? "";
  // @ts-expect-error - extended session fields
  const sessionBranchId: string | null = session.user.branchId ?? null;

  if (!hasAccess(role, "equipment.manage")) redirect("/equipment");

  const { id } = await params;

  const item = await prisma.equipment.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      category: true,
      branchId: true,
      location: true,
      frequencyMonths: true,
      reminderLeadDays: true,
      notes: true,
      imageUrl: true,
    },
  });

  if (!item) notFound();

  if (!canManageBranch(role, sessionBranchId, item.branchId)) {
    redirect("/equipment");
  }

  const branches = await prisma.branch.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <h2 className="text-3xl font-bold tracking-tight">Edit Item</h2>
      <div className="mx-auto max-w-2xl">
        <EquipmentForm
          branches={branches}
          initial={{
            id: item.id,
            name: item.name,
            category: item.category,
            branchId: item.branchId,
            location: item.location,
            frequencyMonths: item.frequencyMonths,
            reminderLeadDays: item.reminderLeadDays,
            notes: item.notes,
            imageUrl: item.imageUrl,
          }}
        />
      </div>
    </div>
  );
}
