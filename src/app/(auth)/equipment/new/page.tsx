import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasAccess } from "@/lib/access-control";
import { EquipmentForm } from "@/components/equipment/equipment-form";

export default async function NewEquipmentPage() {
  const session = await auth();
  if (!session) redirect("/login");

  // @ts-expect-error - extended session fields
  const role: string = session.user.role ?? "";
  // @ts-expect-error - extended session fields
  const branchId: string | null = session.user.branchId ?? null;

  if (!hasAccess(role, "equipment.manage")) redirect("/equipment");

  const branches =
    role === "BRANCH_MANAGER" && branchId
      ? await prisma.branch.findMany({ where: { id: branchId }, select: { id: true, name: true } })
      : await prisma.branch.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <h2 className="text-3xl font-bold tracking-tight">Add Item</h2>
      <div className="mx-auto max-w-2xl">
        <EquipmentForm
          branches={branches}
          defaultBranchId={role === "BRANCH_MANAGER" ? (branchId ?? undefined) : undefined}
        />
      </div>
    </div>
  );
}
