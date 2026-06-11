// src/app/api/equipment/labels/__tests__/route.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { GET } from "@/app/api/equipment/labels/route";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
const authMock = auth as unknown as ReturnType<typeof vi.fn>;
const BR_A = "__test_lbl_a", BR_B = "__test_lbl_b";

let itemA = "", itemB = "";
beforeEach(async () => {
  await prisma.branch.upsert({ where: { id: BR_A }, update: {}, create: { id: BR_A, name: "__test_lbl_A", code: "TLA", city: "X", state: "Y" } });
  await prisma.branch.upsert({ where: { id: BR_B }, update: {}, create: { id: BR_B, name: "__test_lbl_B", code: "TLB", city: "X", state: "Y" } });
  await prisma.user.upsert({ where: { id: "__test_lbl_mgr" }, update: {}, create: { id: "__test_lbl_mgr", name: "__test_lbl_mgr", email: "__test_lbl_mgr@x.test", role: "BRANCH_MANAGER", status: "ACTIVE", branchId: BR_A } });
  itemA = (await prisma.equipment.create({ data: { name: "__test_lbl_inA", category: "OTHER", branchId: BR_A, reminderLeadDays: 15, createdById: "__test_lbl_mgr" } })).id;
  itemB = (await prisma.equipment.create({ data: { name: "__test_lbl_inB", category: "OTHER", branchId: BR_B, reminderLeadDays: 15, createdById: "__test_lbl_mgr" } })).id;
});
afterEach(async () => {
  await prisma.equipment.deleteMany({ where: { name: { startsWith: "__test_lbl_" } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: "__test_lbl_" } } });
  await prisma.branch.deleteMany({ where: { name: { startsWith: "__test_lbl_" } } });
  vi.resetAllMocks();
});
function asManager() { authMock.mockResolvedValue({ user: { id: "__test_lbl_mgr", role: "BRANCH_MANAGER", branchId: BR_A } }); }

describe("GET /api/equipment/labels", () => {
  it("returns a PDF for the manager's own item", async () => {
    asManager();
    const res = await GET(new Request(`http://t/api/equipment/labels?ids=${itemA}`));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
  });
  it("drops another outlet's item from scope → 400 when only it is requested", async () => {
    asManager();
    const res = await GET(new Request(`http://t/api/equipment/labels?ids=${itemB}`));
    expect(res.status).toBe(400);
  });
  it("forbids HR", async () => {
    authMock.mockResolvedValue({ user: { id: "__test_lbl_mgr", role: "HR", branchId: null } });
    const res = await GET(new Request(`http://t/api/equipment/labels?ids=${itemA}`));
    expect(res.status).toBe(403);
  });
  it("ignores an invalid category param instead of 500ing", async () => {
    asManager();
    const res = await GET(new Request(`http://t/api/equipment/labels?ids=${itemA}&category=NOT_A_CATEGORY`));
    // category is dropped → the item still matches → 200 PDF (not a Prisma-validation 500).
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
  });
});
