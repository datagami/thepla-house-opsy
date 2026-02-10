/**
 * Canonical branch display order for salary report, financial report, and Excel export.
 * Branches not in this list appear at the end, sorted alphabetically.
 */
export const BRANCH_DISPLAY_ORDER = [
  "Chandivali",
  "Santacruz",
  "Mulund",
  "Parel",
  "Thane",
  "Kandivali",
  "Thepla House Office",
  "centralized kitchen",
  "Dadoji Stadium",
] as const;

/**
 * Returns branch names sorted in the canonical report order.
 * Used so Financial tab "Salary by Branch" and Excel salary report show the same sequence.
 */
export function sortBranchesForReport(branchNames: string[]): string[] {
  const order = BRANCH_DISPLAY_ORDER as readonly string[];
  return [...branchNames].sort((a, b) => {
    const aLower = a.toLowerCase().trim();
    const bLower = b.toLowerCase().trim();
    const aIndex = order.findIndex((p) => aLower === p.toLowerCase());
    const bIndex = order.findIndex((p) => bLower === p.toLowerCase());
    if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
    if (aIndex !== -1) return -1;
    if (bIndex !== -1) return 1;
    return a.localeCompare(b);
  });
}
