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

  it("admin can create a commission rule with commissionType=revenue", async () => {
    const result = await adminCaller.commissionRules.create({
      name: "按营业额测试",
      minAmount: "0",
      maxAmount: "10000.00",
      commissionRate: "0.0500",
      commissionType: "revenue",
      sortOrder: 10,
    });
    expect(result).toBeDefined();
    expect(result.id).toBeGreaterThan(0);
    // Verify the type is saved
    const rules = await adminCaller.commissionRules.list();
    const found = rules.find((r: any) => r.id === result.id);
    expect(found?.commissionType).toBe("revenue");
    // Clean up
    await adminCaller.commissionRules.delete({ id: result.id });
  });

  it("admin can create a commission rule with commissionType=profit", async () => {
    const result = await adminCaller.commissionRules.create({
      name: "按利润测试",
      minAmount: "0",
      maxAmount: "8000.00",
      commissionRate: "0.0800",
      commissionType: "profit",
      sortOrder: 20,
    });
    expect(result).toBeDefined();
    expect(result.id).toBeGreaterThan(0);
    const rules = await adminCaller.commissionRules.list();
    const found = rules.find((r: any) => r.id === result.id);
    expect(found?.commissionType).toBe("profit");
    await adminCaller.commissionRules.delete({ id: result.id });
  });

  it("admin can create a commission rule with commissionType=profitRate", async () => {
    const result = await adminCaller.commissionRules.create({
      name: "按利润率测试",
      minAmount: "10",
      maxAmount: "20",
      commissionRate: "0.1000",
      commissionType: "profitRate",
      sortOrder: 30,
    });
    expect(result).toBeDefined();
    expect(result.id).toBeGreaterThan(0);
    const rules = await adminCaller.commissionRules.list();
    const found = rules.find((r: any) => r.id === result.id);
    expect(found?.commissionType).toBe("profitRate");
    await adminCaller.commissionRules.delete({ id: result.id });
  });

  it("admin can update commissionType of a rule", async () => {
    // Update the first created rule's type
    const result = await adminCaller.commissionRules.update({
      id: createdRuleId,
      commissionType: "profit",
    });
    expect(result).toEqual({ success: true });

    const rules = await adminCaller.commissionRules.list();
    const updated = rules.find((r: any) => r.id === createdRuleId);
    expect(updated?.commissionType).toBe("profit");

    // Restore to revenue
    await adminCaller.commissionRules.update({
      id: createdRuleId,
      commissionType: "revenue",
    });
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
      // New fields for multi-mode commission
      expect(entry).toHaveProperty("revenueCommission");
      expect(entry).toHaveProperty("profitCommission");
      expect(entry).toHaveProperty("profitRateCommission");
    }
  });

  it("staff cannot access salary report (should throw FORBIDDEN)", async () => {
    await expect(
      staffCaller.salaryReport.get({
        yearMonth: "2026-04",
      })
    ).rejects.toThrow();
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
      expect(typeof entry.revenueCommission).toBe("number");
      expect(typeof entry.profitCommission).toBe("number");
      expect(typeof entry.profitRateCommission).toBe("number");
      expect(entry.totalSalary).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("Salary History", () => {
  const adminCaller = appRouter.createCaller(createAdminContext());
  const staffCaller = appRouter.createCaller(createStaffContext(100));

  it("admin can get salary history for all staff", async () => {
    const history = await adminCaller.salaryReport.history({
      months: 3,
    });
    expect(Array.isArray(history)).toBe(true);
    // Should have data for up to 3 months
    if (history.length > 0) {
      const entry = history[0];
      expect(entry).toHaveProperty("yearMonth");
      expect(entry).toHaveProperty("staffId");
      expect(entry).toHaveProperty("staffName");
      expect(entry).toHaveProperty("baseSalary");
      expect(entry).toHaveProperty("totalRevenue");
      expect(entry).toHaveProperty("commission");
      expect(entry).toHaveProperty("totalSalary");
      expect(typeof entry.baseSalary).toBe("number");
      expect(typeof entry.commission).toBe("number");
    }
  });

  it("admin can get salary history for a specific staff", async () => {
    const history = await adminCaller.salaryReport.history({
      months: 3,
      staffId: 1,
    });
    expect(Array.isArray(history)).toBe(true);
    for (const entry of history) {
      expect(entry.staffId).toBe(1);
    }
  });

  it("staff cannot access salary history (should throw FORBIDDEN)", async () => {
    await expect(
      staffCaller.salaryReport.history({
        months: 3,
      })
    ).rejects.toThrow();
  });

  it("staff cannot access salary history even with staffId (should throw FORBIDDEN)", async () => {
    await expect(
      staffCaller.salaryReport.history({
        months: 3,
        staffId: 1,
      })
    ).rejects.toThrow();
  });

  it("history returns correct yearMonth format", async () => {
    const history = await adminCaller.salaryReport.history({
      months: 6,
    });
    expect(Array.isArray(history)).toBe(true);
    for (const entry of history) {
      expect(entry.yearMonth).toMatch(/^\d{4}-\d{2}$/);
    }
  });
});

describe("Bonus Rules (High Profit Rewards)", () => {
  const adminCaller = appRouter.createCaller(createAdminContext());
  const staffCaller = appRouter.createCaller(createStaffContext());
  let createdBonusId: number;

  it("admin can create a bonus rule", async () => {
    const result = await adminCaller.bonusRules.create({
      name: "高利润奖励第一档",
      profitThreshold: "500.00",
      bonusAmount: "50.00",
      sortOrder: 1,
    });
    expect(result).toBeDefined();
    expect(result.id).toBeGreaterThan(0);
    createdBonusId = result.id;
  });

  it("admin can create multiple bonus rules with different thresholds", async () => {
    const result = await adminCaller.bonusRules.create({
      name: "高利润奖励第二档",
      profitThreshold: "1000.00",
      bonusAmount: "120.00",
      sortOrder: 2,
    });
    expect(result).toBeDefined();
    expect(result.id).toBeGreaterThan(0);
    // Clean up
    await adminCaller.bonusRules.delete({ id: result.id });
  });

  it("admin can list all bonus rules", async () => {
    const rules = await adminCaller.bonusRules.list();
    expect(Array.isArray(rules)).toBe(true);
    const found = rules.find((r: any) => r.id === createdBonusId);
    expect(found).toBeDefined();
    expect(found?.name).toBe("高利润奖励第一档");
    expect(parseFloat(found?.profitThreshold)).toBe(500);
    expect(parseFloat(found?.bonusAmount)).toBe(50);
  });

  it("staff can view active bonus rules", async () => {
    const rules = await staffCaller.bonusRules.activeList();
    expect(Array.isArray(rules)).toBe(true);
    const found = rules.find((r: any) => r.id === createdBonusId);
    expect(found).toBeDefined();
  });

  it("admin can update a bonus rule", async () => {
    const result = await adminCaller.bonusRules.update({
      id: createdBonusId,
      name: "高利润奖励第一档-修改",
      profitThreshold: "600.00",
      bonusAmount: "60.00",
    });
    expect(result).toEqual({ success: true });

    const rules = await adminCaller.bonusRules.list();
    const updated = rules.find((r: any) => r.id === createdBonusId);
    expect(updated?.name).toBe("高利润奖励第一档-修改");
    expect(parseFloat(updated?.profitThreshold)).toBe(600);
    expect(parseFloat(updated?.bonusAmount)).toBe(60);
  });

  it("admin can toggle bonus rule active status", async () => {
    await adminCaller.bonusRules.update({
      id: createdBonusId,
      isActive: 0,
    });

    const activeRules = await staffCaller.bonusRules.activeList();
    const found = activeRules.find((r: any) => r.id === createdBonusId);
    expect(found).toBeUndefined();

    // Re-enable
    await adminCaller.bonusRules.update({
      id: createdBonusId,
      isActive: 1,
    });
  });

  it("admin can delete a bonus rule", async () => {
    const result = await adminCaller.bonusRules.delete({
      id: createdBonusId,
    });
    expect(result).toEqual({ success: true });

    const rules = await adminCaller.bonusRules.list();
    const found = rules.find((r: any) => r.id === createdBonusId);
    expect(found).toBeUndefined();
  });

  it("staff cannot create bonus rules (should throw FORBIDDEN)", async () => {
    await expect(
      staffCaller.bonusRules.create({
        name: "非法奖励",
        profitThreshold: "100.00",
        bonusAmount: "10.00",
      })
    ).rejects.toThrow();
  });
});

describe("Salary Report with High Profit Bonus", () => {
  const adminCaller = appRouter.createCaller(createAdminContext());

  it("salary report includes highProfitBonus and highProfitOrderCount fields", async () => {
    const report = await adminCaller.salaryReport.get({
      yearMonth: "2026-04",
    });
    expect(Array.isArray(report)).toBe(true);
    if (report.length > 0) {
      const entry = report[0] as any;
      expect(entry).toHaveProperty("highProfitBonus");
      expect(entry).toHaveProperty("highProfitOrderCount");
      expect(typeof entry.highProfitBonus).toBe("number");
      expect(typeof entry.highProfitOrderCount).toBe("number");
      expect(entry.highProfitBonus).toBeGreaterThanOrEqual(0);
      expect(entry.highProfitOrderCount).toBeGreaterThanOrEqual(0);
    }
  });

  it("salary report includes adjustment fields", async () => {
    const report = await adminCaller.salaryReport.get({
      yearMonth: "2026-04",
    });
    expect(Array.isArray(report)).toBe(true);
    if (report.length > 0) {
      const entry = report[0] as any;
      expect(entry).toHaveProperty("profitDeduction");
      expect(entry).toHaveProperty("bonus");
      expect(entry).toHaveProperty("onlineCommission");
      expect(entry).toHaveProperty("performanceDeduction");
      expect(typeof entry.profitDeduction).toBe("number");
      expect(typeof entry.bonus).toBe("number");
      expect(typeof entry.onlineCommission).toBe("number");
      expect(typeof entry.performanceDeduction).toBe("number");
    }
  });

  it("salary report totalSalary formula includes adjustments", async () => {
    const report = await adminCaller.salaryReport.get({
      yearMonth: "2026-01",
    });
    expect(Array.isArray(report)).toBe(true);
    for (const r of report) {
      const entry = r as any;
      // totalSalary = baseSalary + commission + highProfitBonus + bonus + onlineCommission - profitDeduction - performanceDeduction
      const expected = entry.baseSalary + entry.commission + (entry.highProfitBonus || 0)
        + (entry.bonus || 0) + (entry.onlineCommission || 0)
        - (entry.profitDeduction || 0) - (entry.performanceDeduction || 0);
      expect(Math.abs(entry.totalSalary - expected)).toBeLessThan(0.01);
    }
  });
});

describe("Salary Adjustments", () => {
  const adminCaller = appRouter.createCaller(createAdminContext());
  const staffCaller = appRouter.createCaller(createStaffContext());

  it("admin can upsert salary adjustment", async () => {
    const result = await adminCaller.salaryReport.upsertAdjustment({
      staffId: 1,
      yearMonth: "2026-03",
      profitDeduction: "100.00",
      bonus: "200.00",
      onlineCommission: "50.00",
      performanceDeduction: "30.00",
      remark: "测试调整",
    });
    expect(result).toBeDefined();
    expect(result).toHaveProperty("id");
  });

  it("admin can update existing salary adjustment", async () => {
    const result = await adminCaller.salaryReport.upsertAdjustment({
      staffId: 1,
      yearMonth: "2026-03",
      profitDeduction: "150.00",
      bonus: "250.00",
      onlineCommission: "80.00",
      performanceDeduction: "50.00",
      remark: "更新调整",
    });
    expect(result).toBeDefined();
    // Could return { id, updated: true } or { id }
    expect(result).toHaveProperty("id");
  });

  it("staff cannot upsert salary adjustment (should throw FORBIDDEN)", async () => {
    await expect(
      staffCaller.salaryReport.upsertAdjustment({
        staffId: 100,
        yearMonth: "2026-03",
        profitDeduction: "10.00",
      })
    ).rejects.toThrow();
  });
});

describe("Order Completion Status", () => {
  const adminCaller = appRouter.createCaller(createAdminContext());
  const staffCaller = appRouter.createCaller(createStaffContext());

  it("admin can update order completion status", async () => {
    // First get an existing order
    const ordersResult = await adminCaller.orders.list({ page: 1, pageSize: 1 });
    const ordersList = Array.isArray(ordersResult) ? ordersResult : (ordersResult as any)?.orders || [];
    if (ordersList.length > 0) {
      const orderId = ordersList[0].id;
      const result = await adminCaller.orderCompletion.update({
        orderId,
        completionStatus: "completed",
      });
      expect(result).toBeDefined();
      // Restore
      await adminCaller.orderCompletion.update({
        orderId,
        completionStatus: "pending",
      });
    }
  });

  it("admin can batch update order completion status", async () => {
    const ordersResult = await adminCaller.orders.list({ page: 1, pageSize: 2 });
    const ordersList = Array.isArray(ordersResult) ? ordersResult : (ordersResult as any)?.orders || [];
    if (ordersList.length > 0) {
      const orderIds = ordersList.map((o: any) => o.id);
      const result = await adminCaller.orderCompletion.batchUpdate({
        orderIds,
        completionStatus: "completed",
      });
      expect(result).toBeDefined();
      // Restore
      await adminCaller.orderCompletion.batchUpdate({
        orderIds,
        completionStatus: "pending",
      });
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
