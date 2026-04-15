import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAdminContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "admin-user",
    email: "admin@example.com",
    name: "Admin User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

function createStaffContext(staffId: number = 100): TrpcContext {
  const user: AuthenticatedUser = {
    id: staffId,
    openId: "staff-user",
    email: "staff@example.com",
    name: "Staff User",
    loginMethod: "password",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("Commission Rules", () => {
  const adminCaller = appRouter.createCaller(createAdminContext());
  const staffCaller = appRouter.createCaller(createStaffContext());
  let createdRuleId: number;

  it("admin can create a commission rule", async () => {
    const result = await adminCaller.commissionRules.create({
      name: "测试第一档",
      minAmount: "0",
      maxAmount: "5000.00",
      commissionRate: "0.0500",
      sortOrder: 1,
    });
    expect(result).toBeDefined();
    expect(result.id).toBeGreaterThan(0);
    createdRuleId = result.id;
  });

  it("admin can list all commission rules", async () => {
    const rules = await adminCaller.commissionRules.list();
    expect(Array.isArray(rules)).toBe(true);
    const found = rules.find((r: any) => r.id === createdRuleId);
    expect(found).toBeDefined();
    expect(found?.name).toBe("测试第一档");
  });

  it("staff can view active commission rules", async () => {
    const rules = await staffCaller.commissionRules.activeList();
    expect(Array.isArray(rules)).toBe(true);
    // Should include the rule we just created (isActive=1 by default)
    const found = rules.find((r: any) => r.id === createdRuleId);
    expect(found).toBeDefined();
  });

  it("admin can update a commission rule", async () => {
    const result = await adminCaller.commissionRules.update({
      id: createdRuleId,
      name: "测试第一档-修改",
      commissionRate: "0.0600",
    });
    expect(result).toEqual({ success: true });

    const rules = await adminCaller.commissionRules.list();
    const updated = rules.find((r: any) => r.id === createdRuleId);
    expect(updated?.name).toBe("测试第一档-修改");
  });

  it("admin can toggle rule active status", async () => {
    await adminCaller.commissionRules.update({
      id: createdRuleId,
      isActive: 0,
    });

    const activeRules = await staffCaller.commissionRules.activeList();
    const found = activeRules.find((r: any) => r.id === createdRuleId);
    expect(found).toBeUndefined(); // Should not appear in active list

    // Re-enable
    await adminCaller.commissionRules.update({
      id: createdRuleId,
      isActive: 1,
    });
  });

  it("admin can delete a commission rule", async () => {
    const result = await adminCaller.commissionRules.delete({
      id: createdRuleId,
    });
    expect(result).toEqual({ success: true });

    const rules = await adminCaller.commissionRules.list();
    const found = rules.find((r: any) => r.id === createdRuleId);
    expect(found).toBeUndefined();
  });

  it("staff cannot create commission rules (should throw FORBIDDEN)", async () => {
    await expect(
      staffCaller.commissionRules.create({
        name: "非法规则",
        minAmount: "0",
        commissionRate: "0.1000",
      })
    ).rejects.toThrow();
  });
});

describe("Salary Report", () => {
  const adminCaller = appRouter.createCaller(createAdminContext());
  const staffCaller = appRouter.createCaller(createStaffContext(100));

  it("admin can get salary report for a month", async () => {
    const report = await adminCaller.salaryReport.get({
      yearMonth: "2026-04",
    });
    expect(Array.isArray(report)).toBe(true);
    // Each entry should have expected fields
    if (report.length > 0) {
      const entry = report[0];
      expect(entry).toHaveProperty("staffId");
      expect(entry).toHaveProperty("staffName");
      expect(entry).toHaveProperty("baseSalary");
      expect(entry).toHaveProperty("totalRevenue");
      expect(entry).toHaveProperty("orderCount");
      expect(entry).toHaveProperty("commission");
      expect(entry).toHaveProperty("totalSalary");
    }
  });

  it("staff can only see their own salary report", async () => {
    const report = await staffCaller.salaryReport.get({
      yearMonth: "2026-04",
    });
    expect(Array.isArray(report)).toBe(true);
    // All entries should belong to staffId=100
    for (const entry of report) {
      expect(entry.staffId).toBe(100);
    }
  });

  it("salary report returns valid numbers", async () => {
    const report = await adminCaller.salaryReport.get({
      yearMonth: "2026-01",
    });
    expect(Array.isArray(report)).toBe(true);
    for (const entry of report) {
      expect(typeof entry.baseSalary).toBe("number");
      expect(typeof entry.totalRevenue).toBe("number");
      expect(typeof entry.commission).toBe("number");
      expect(typeof entry.totalSalary).toBe("number");
      expect(entry.totalSalary).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("User Base Salary", () => {
  const adminCaller = appRouter.createCaller(createAdminContext());

  it("admin can update user base salary", async () => {
    // Use a known user id (1 = admin user)
    const result = await adminCaller.users.updateBaseSalary({
      userId: 1,
      baseSalary: "5000.00",
    });
    expect(result).toEqual({ success: true });
  });

  it("admin can create user with base salary", async () => {
    const result = await adminCaller.users.create({
      name: "测试客服底薪",
      username: "test_salary_user_" + Date.now(),
      password: "test1234",
      role: "user",
      baseSalary: "3500.00",
    });
    expect(result).toBeDefined();
    expect(result.id).toBeGreaterThan(0);

    // Clean up
    await adminCaller.users.delete({ userId: result.id });
  });

  it("staff cannot update base salary (should throw FORBIDDEN)", async () => {
    const staffCaller = appRouter.createCaller(createStaffContext());
    await expect(
      staffCaller.users.updateBaseSalary({
        userId: 1,
        baseSalary: "9999.00",
      })
    ).rejects.toThrow();
  });
});
