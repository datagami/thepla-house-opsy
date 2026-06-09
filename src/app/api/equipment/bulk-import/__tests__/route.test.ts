// src/app/api/equipment/bulk-import/__tests__/route.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { POST } from "@/app/api/equipment/bulk-import/route";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { buildEquipmentWorkbook, type ExportItem } from "@/lib/services/equipment-bulk";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
const authMock = auth as unknown as ReturnType<typeof vi.fn>;

const BR_A = "__test_bulk_a";
const BR_B = "__test_bulk_b";

beforeEach(async () => {
  await prisma.branch.upsert({ where: { id: BR_A }, update: {}, create: { id: BR_A, name: "__test_bulk_A", city: "X", state: "Y" } });
  await prisma.branch.upsert({ where: { id: BR_B }, update: {}, create: { id: BR_B, name: "__test_bulk_B", city: "X", state: "Y" } });
  await prisma.user.upsert({
    where: { id: "__test_bulk_mgr" }, update: {},
    create: { id: "__test_bulk_mgr", name: "__test_bulk_mgr", email: "__test_bulk_mgr@x.test", role: "BRANCH_MANAGER", status: "ACTIVE", branchId: BR_A },
  });
});

afterEach(async () => {
  await prisma.equipment.deleteMany({ where: { name: { startsWith: "__test_bulk_" } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: "__test_bulk_" } } });
  await prisma.branch.deleteMany({ where: { name: { startsWith: "__test_bulk_" } } });
  vi.resetAllMocks();
});

function asManager() { authMock.mockResolvedValue({ user: { id: "__test_bulk_mgr", role: "BRANCH_MANAGER", branchId: BR_A } }); }
function asManagement() { authMock.mockResolvedValue({ user: { id: "__test_bulk_mgr", role: "MANAGEMENT", branchId: null } }); }

async function uploadOf(items: Partial<ExportItem>[], branchNames: string[]) {
  const full: ExportItem[] = items.map((p, i) => ({
    id: "", name: `__test_bulk_item_${i}`, category: "OTHER", branchName: "__test_bulk_A",
    location: null, frequencyMonths: null, reminderLeadDays: 15, status: "ACTIVE",
    nextDueDate: null, lastServiceDate: null, notes: null, ...p,
  }));
  const buf = await buildEquipmentWorkbook(full, { branchNames });
  const file = new File([Buffer.from(buf)], "items.xlsx", {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const fd = new FormData();
  fd.set("file", file);
  return new Request("http://t/api/equipment/bulk-import", { method: "POST", body: fd });
}

describe("POST /api/equipment/bulk-import", () => {
  it("creates new rows for a manager in their own outlet", async () => {
    asManager();
    const res = await POST(await uploadOf([{ id: "", name: "__test_bulk_new", branchName: "__test_bulk_A" }], ["__test_bulk_A"]));
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.created).toBe(1);
    const made = await prisma.equipment.findFirst({ where: { name: "__test_bulk_new" } });
    expect(made?.branchId).toBe(BR_A);
  });

  it("skips an Item ID that belongs to another outlet (manager)", async () => {
    asManagement();
    const other = await prisma.equipment.create({ data: { name: "__test_bulk_inB", category: "OTHER", branchId: BR_B, reminderLeadDays: 15, createdById: "__test_bulk_mgr" } });
    asManager();
    const res = await POST(await uploadOf([{ id: other.id, name: "__test_bulk_inB", branchName: "__test_bulk_B" }], ["__test_bulk_A"]));
    const body = await res.json();
    expect(body.updated).toBe(0);
    expect(body.skipped.some((s: { errors: string[] }) => s.errors.join().match(/your outlet/i))).toBe(true);
  });

  it("forbids HR", async () => {
    authMock.mockResolvedValue({ user: { id: "__test_bulk_mgr", role: "HR", branchId: null } });
    const res = await POST(await uploadOf([{ name: "__test_bulk_x" }], ["__test_bulk_A"]));
    expect(res.status).toBe(403);
  });
});
