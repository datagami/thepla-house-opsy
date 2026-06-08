import type { Prisma } from "@prisma/client";

/**
 * Read scope: BRANCH_MANAGER sees only their branch; HR/MANAGEMENT see all.
 * A manager with no branch gets an impossible filter so they see nothing.
 */
export function equipmentWhereForRole(
  role: string,
  branchId: string | null
): Prisma.EquipmentWhereInput {
  if (role === "MANAGEMENT" || role === "HR") return {};
  if (role === "BRANCH_MANAGER") return { branchId: branchId ?? "__none__" };
  return { branchId: "__none__" };
}

/** Write scope: MANAGEMENT anywhere, BRANCH_MANAGER only in their own branch. */
export function canManageBranch(
  role: string,
  userBranchId: string | null,
  targetBranchId: string
): boolean {
  if (role === "MANAGEMENT") return true;
  if (role === "BRANCH_MANAGER") return !!userBranchId && userBranchId === targetBranchId;
  return false;
}
