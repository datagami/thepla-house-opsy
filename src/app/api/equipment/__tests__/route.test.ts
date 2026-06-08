import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { GET, POST } from "@/app/api/equipment/route";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
const authMock = auth as unknown as ReturnType<typeof vi.fn>;

const BR_A = "__test_eq_branch_a";
const BR_B = "__test_eq_branch_b";

beforeEach(async () => {
  await prisma.branch.upsert({ where: { id: BR_A }, update: {}, create: { id: BR_A, name: "__test_eq_A", city: "X", state: "Y" } });
  await prisma.branch.upsert({ where: { id: BR_B }, update: {}, create: { id: BR_B, name: "__test_eq_B", city: "X", state: "Y" } });
  await prisma.user.upsert({
    where: { id: "__test_eq_mgr" }, update: {},
    create: { id: "__test_eq_mgr", name: "__test_eq_mgr", email: "__test_eq_mgr@x.test", role: "BRANCH_MANAGER", status: "ACTIVE", branchId: BR_A },
  });
});

afterEach(async () => {
  await prisma.equipment.deleteMany({ where: { name: { startsWith: "__test_eq_" } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: "__test_eq_" } } });
  await prisma.branch.deleteMany({ where: { name: { startsWith: "__test_eq_" } } });
  vi.resetAllMocks();
});

function asManager() {
  authMock.mockResolvedValue({ user: { id: "__test_eq_mgr", role: "BRANCH_MANAGER", branchId: BR_A } });
}
function asManagement() {
  authMock.mockResolvedValue({ user: { id: "__test_eq_mgr", role: "MANAGEMENT", branchId: null } });
}

function postReq(body: unknown) {
  return new Request("http://t/api/equipment", { method: "POST", body: JSON.stringify(body) });
}

describe("POST /api/equipment", () => {
  it("lets a manager create an item in their own branch", async () => {
    asManager();
    const res = await POST(postReq({ name: "__test_eq_extinguisher", category: "FIRE_SAFETY", branchId: BR_A, frequencyMonths: 12 }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.name).toBe("__test_eq_extinguisher");
    expect(body.nextDueDate).toBeTruthy();
  });

  it("forbids a manager creating in another branch", async () => {
    asManager();
    const res = await POST(postReq({ name: "__test_eq_x", category: "OTHER", branchId: BR_B }));
    expect(res.status).toBe(403);
  });

  it("rejects invalid input with 400", async () => {
    asManager();
    const res = await POST(postReq({ name: "", category: "FIRE_SAFETY", branchId: BR_A }));
    expect(res.status).toBe(400);
  });
});

describe("GET /api/equipment", () => {
  it("scopes a manager to their own branch", async () => {
    asManagement();
    await POST(postReq({ name: "__test_eq_inA", category: "OTHER", branchId: BR_A }));
    await POST(postReq({ name: "__test_eq_inB", category: "OTHER", branchId: BR_B }));

    asManager();
    const res = await GET(new Request("http://t/api/equipment"));
    const list = await res.json();
    const names = list.map((e: { name: string }) => e.name);
    expect(names).toContain("__test_eq_inA");
    expect(names).not.toContain("__test_eq_inB");
  });

  it("returns 401 when auth() resolves null", async () => {
    authMock.mockResolvedValue(null);
    expect((await GET(new Request("http://t/api/equipment"))).status).toBe(401);
  });

  it("returns 403 for an EMPLOYEE role", async () => {
    authMock.mockResolvedValue({ user: { id: "__test_eq_mgr", role: "EMPLOYEE", branchId: BR_A } });
    expect((await GET(new Request("http://t/api/equipment"))).status).toBe(403);
  });

  it("ignores an invalid ?category=NOPE (does not 500)", async () => {
    asManagement();
    await POST(postReq({ name: "__test_eq_validItem", category: "OTHER", branchId: BR_A }));

    asManagement();
    const res = await GET(new Request("http://t/api/equipment?category=NOPE"));
    expect(res.status).toBe(200);
    const list = await res.json();
    const names = list.map((e: { name: string }) => e.name);
    expect(names).toContain("__test_eq_validItem");
  });
});

describe("POST /api/equipment auth guards", () => {
  it("returns 403 for an HR role (HR lacks equipment.manage)", async () => {
    authMock.mockResolvedValue({ user: { id: "__test_eq_mgr", role: "HR", branchId: BR_A } });
    const res = await POST(postReq({ name: "__test_eq_hr_item", category: "FIRE_SAFETY", branchId: BR_A, frequencyMonths: 12 }));
    expect(res.status).toBe(403);
  });
});
