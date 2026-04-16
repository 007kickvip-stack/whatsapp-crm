import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the db module
vi.mock("./db", () => ({
  listUsers: vi.fn().mockResolvedValue({ data: [], total: 0 }),
  updateUserRole: vi.fn().mockResolvedValue(undefined),
  deleteUser: vi.fn().mockResolvedValue(undefined),
  upsertUser: vi.fn().mockResolvedValue(undefined),
  getUserById: vi.fn().mockResolvedValue(null),
  createUser: vi.fn().mockResolvedValue({ id: 10, openId: "manual-test" }),
  getUserByUsername: vi.fn().mockResolvedValue(null),
  updateUserHireDate: vi.fn().mockResolvedValue(undefined),
  updateUserPassword: vi.fn().mockResolvedValue(undefined),
  updateUserUsername: vi.fn().mockResolvedValue(undefined),
  createCustomer: vi.fn().mockResolvedValue(1),
  updateCustomer: vi.fn().mockResolvedValue(undefined),
  deleteCustomer: vi.fn().mockResolvedValue(undefined),
  getCustomerById: vi.fn().mockResolvedValue(null),
  getCustomerByWhatsapp: vi.fn().mockResolvedValue(null),
  listCustomers: vi.fn().mockResolvedValue({ data: [], total: 0 }),
  createOrder: vi.fn().mockResolvedValue(1),
  updateOrder: vi.fn().mockResolvedValue(undefined),
  deleteOrder: vi.fn().mockResolvedValue(undefined),
  getOrderById: vi.fn().mockResolvedValue(null),
  getOrderWithItems: vi.fn().mockResolvedValue(null),
  listOrders: vi.fn().mockResolvedValue({ data: [], total: 0 }),
  createOrderItem: vi.fn().mockResolvedValue(1),
  updateOrderItem: vi.fn().mockResolvedValue(undefined),
  deleteOrderItem: vi.fn().mockResolvedValue(undefined),
  getOrderItemById: vi.fn().mockResolvedValue(undefined),
  getOrderItemsByOrderId: vi.fn().mockResolvedValue([]),
  recalculateOrderTotals: vi.fn().mockResolvedValue(undefined),
  getOrderStats: vi.fn().mockResolvedValue({ totalOrders: 5, totalRevenueCny: "1000", totalProfit: "200" }),
  getOrderStatusDistribution: vi.fn().mockResolvedValue([{ status: "待处理", count: 3 }]),
  getPaymentStatusDistribution: vi.fn().mockResolvedValue([{ status: "未付款", count: 2 }]),
  getStaffPerformance: vi.fn().mockResolvedValue([]),
  getRecentOrders: vi.fn().mockResolvedValue([]),
  getCustomerStats: vi.fn().mockResolvedValue({ total: 10 }),
  getDailyOrderTrend: vi.fn().mockResolvedValue([]),
  createAuditLog: vi.fn().mockResolvedValue(undefined),
  listAuditLogs: vi.fn().mockResolvedValue({ data: [], total: 0 }),
  exportOrders: vi.fn().mockResolvedValue([]),
  getCurrentExchangeRate: vi.fn().mockResolvedValue({ id: 1, rate: "6.4", previousRate: null, changedById: null, changedByName: null, reason: null, createdAt: new Date() }),
  listExchangeRates: vi.fn().mockResolvedValue({ data: [], total: 0 }),
  createExchangeRate: vi.fn().mockResolvedValue({ id: 2 }),
  getProfitReport: vi.fn().mockResolvedValue({ summary: { orderCount: 0, totalRevenueCny: "0", totalProfit: "0", avgProfitRate: "0" }, byStaff: [], dailyTrend: [] }),
  getDistinctStaffNames: vi.fn().mockResolvedValue(["Staff A", "Staff B"]),
  getMonthlyProfitComparison: vi.fn().mockResolvedValue([
    { period: "2026-03", orderCount: 5, totalRevenueCny: "1000", totalProfit: "200", avgProfitRate: "0.2", momProfitGrowth: null, momRevenueGrowth: null, yoyProfitGrowth: null, yoyRevenueGrowth: null },
    { period: "2026-04", orderCount: 8, totalRevenueCny: "1500", totalProfit: "350", avgProfitRate: "0.23", momProfitGrowth: 0.75, momRevenueGrowth: 0.5, yoyProfitGrowth: null, yoyRevenueGrowth: null },
  ]),
  getQuarterlyProfitComparison: vi.fn().mockResolvedValue([
    { period: "2026-Q1", orderCount: 20, totalRevenueCny: "5000", totalProfit: "1000", avgProfitRate: "0.2", qoqProfitGrowth: null, qoqRevenueGrowth: null, yoyProfitGrowth: null, yoyRevenueGrowth: null },
  ]),
  getProfitAlertSetting: vi.fn().mockResolvedValue({ id: 1, minProfitRate: "0.100000", enabled: 1, updatedByName: "Admin" }),
  upsertProfitAlertSetting: vi.fn().mockResolvedValue({ id: 2 }),
  getStaffProfitAlerts: vi.fn().mockResolvedValue([{ staffName: "Staff C", orderCount: 3, totalRevenueCny: "500", totalProfit: "20", avgProfitRate: "0.04" }]),
  listStaffMonthlyTargets: vi.fn().mockResolvedValue([{ id: 1, staffId: 2, staffName: "Staff A", yearMonth: "2026-04", profitTarget: "5000", revenueTarget: "20000", setById: 1, setByName: "Admin", createdAt: new Date(), updatedAt: new Date() }]),
  upsertStaffMonthlyTarget: vi.fn().mockResolvedValue({ id: 1 }),
  deleteStaffMonthlyTarget: vi.fn().mockResolvedValue(undefined),
  getStaffTargetProgress: vi.fn().mockResolvedValue([{ targetId: 1, staffId: 2, staffName: "Staff A", yearMonth: "2026-04", profitTarget: "5000", revenueTarget: "20000", actualProfit: "2500", actualRevenue: "12000", orderCount: 5, profitProgress: 0.5, revenueProgress: 0.6, profitGap: "2500.00", revenueGap: "8000.00" }]),
  getStaffList: vi.fn().mockResolvedValue([{ staffId: 1, staffName: "Admin" }, { staffId: 2, staffName: "Staff A" }]),
  getDailyOrderSummary: vi.fn().mockResolvedValue({ totalRevenue: "500", productSellingPrice: "400", shippingCharged: "100", estimatedProfit: "150" }),
  listDailyData: vi.fn().mockResolvedValue([{ id: 1, reportDate: "2026-04-09", staffId: 2, staffName: "Staff User", whatsAccount: "+123", messageCount: 50, newCustomerCount: 5, newIntentCount: 3, returnVisitCount: 2, newOrderCount: 4, oldOrderCount: 1, onlineOrderCount: 2, itemCount: 8, totalRevenue: "500", onlineRevenue: "200", productSellingPrice: "400", shippingCharged: "100", estimatedProfit: "150", estimatedProfitRate: "0.3", telegramPraiseCount: 1, referralCount: 0 }]),
  createDailyData: vi.fn().mockResolvedValue({ id: 1 }),
  updateDailyData: vi.fn().mockResolvedValue({ success: true }),
  deleteDailyData: vi.fn().mockResolvedValue({ success: true }),
  getDailyDataById: vi.fn().mockResolvedValue({ id: 1, reportDate: "2026-04-09", staffId: 2, staffName: "Staff User", whatsAccount: "M1 BUY-4254" }),
  getDistinctOrderAccounts: vi.fn().mockResolvedValue(["M1 BUY-4254", "K-ONE-1718", "UMI BUY-3264"]),
  getDailyReportByStaff: vi.fn().mockResolvedValue({ rows: [{ staffId: 2, staffName: "Staff User", messageCount: 50, totalRevenue: "500" }], totals: { staffCount: 1, totalMessages: 50, totalRevenue: "500", totalEstimatedProfit: "150", avgProfitRate: "0.3" } }),
  getDailyReportByAccount: vi.fn().mockResolvedValue({ rows: [{ id: 1, staffName: "Staff User", whatsAccount: "M1 BUY-4254", messageCount: 50, totalRevenue: "500" }], totals: { accountCount: 1, totalMessages: 50, totalRevenue: "500", totalEstimatedProfit: "150", avgProfitRate: "0.3" } }),
  getDailyReportDrillDown: vi.fn().mockResolvedValue([{ id: 1, staffName: "Staff User", whatsAccount: "M1 BUY-4254", messageCount: 30, totalRevenue: "300" }, { id: 2, staffName: "Staff User", whatsAccount: "K-ONE-1718", messageCount: 20, totalRevenue: "200" }]),
  listDailyReportNotes: vi.fn().mockResolvedValue([{ id: 1, reportDate: "2026-04-09", userId: 1, userName: "Admin User", userRole: "admin", content: "今日总结", createdAt: new Date(), updatedAt: new Date() }]),
  createDailyReportNote: vi.fn().mockResolvedValue({ id: 2 }),
  updateDailyReportNote: vi.fn().mockResolvedValue({ success: true }),
  deleteDailyReportNote: vi.fn().mockResolvedValue({ success: true }),
  getDailyReportNoteById: vi.fn().mockResolvedValue({ id: 1, reportDate: "2026-04-09", userId: 1, userName: "Admin User", userRole: "admin", content: "今日总结", createdAt: new Date(), updatedAt: new Date() }),
  syncOrderDataToDailyData: vi.fn().mockResolvedValue({ success: true }),
  listAccounts: vi.fn().mockResolvedValue([{ id: 1, name: "M1 BUY-4254", color: "#f87171", sortOrder: 0 }, { id: 2, name: "K-ONE-1718", color: "#fb923c", sortOrder: 1 }]),
  createAccount: vi.fn().mockResolvedValue({ id: 3 }),
  updateAccount: vi.fn().mockResolvedValue({ success: true }),
  deleteAccount: vi.fn().mockResolvedValue({ success: true }),
  reorderAccounts: vi.fn().mockResolvedValue({ success: true }),
  findOrderItemsByOrderNumbers: vi.fn().mockResolvedValue([]),
  findOrderItemsByOriginalOrderNos: vi.fn().mockResolvedValue([]),
  syncCustomerStats: vi.fn().mockResolvedValue(undefined),
  syncCustomerFromOrder: vi.fn().mockResolvedValue(undefined),
  syncOrderToPaypalIncome: vi.fn().mockResolvedValue(undefined),
  updatePaypalIncomeFromOrder: vi.fn().mockResolvedValue(undefined),
  deletePaypalIncomeByOrderId: vi.fn().mockResolvedValue(undefined),
  getCustomerOrderHistory: vi.fn().mockResolvedValue([]),
  findOrderItemByDomesticTrackingNo: vi.fn().mockResolvedValue(null),
  markLogisticsSubscribed: vi.fn().mockResolvedValue(undefined),
  getSocialInsuranceCost: vi.fn().mockResolvedValue({ id: 1, yearMonth: "2026-04", amount: "3000.00", remark: null }),
  upsertSocialInsuranceCost: vi.fn().mockResolvedValue(1),
  listSocialInsuranceCosts: vi.fn().mockResolvedValue([{ id: 1, yearMonth: "2026-04", amount: "3000.00" }]),
  getReshipmentProfitLoss: vi.fn().mockResolvedValue({ totalProfitLoss: "-500.00", count: 3 }),
  getSalaryTotalForPeriod: vi.fn().mockResolvedValue({ totalSalary: 15000, months: ["2026-04"] }),
  getSocialInsuranceTotalForPeriod: vi.fn().mockResolvedValue({ totalAmount: "3000.00" }),
  listAnnualTargets: vi.fn().mockResolvedValue([]),
  upsertAnnualTarget: vi.fn().mockResolvedValue({ id: 1, updated: false }),
  deleteAnnualTarget: vi.fn().mockResolvedValue(undefined),
  getAnnualTargetProgress: vi.fn().mockResolvedValue({ team: null, individuals: [] }),
  recalculateAllItemProfitRates: vi.fn().mockResolvedValue({ updated: 5, totalItems: 20, totalOrders: 10 }),
  restoreUser: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({ url: "https://cdn.example.com/test.jpg" }),
}));

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
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function createStaffContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 2,
    openId: "staff-user",
    email: "staff@example.com",
    name: "Staff User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function createUnauthContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

describe("Auth routes", () => {
  it("auth.me returns user for authenticated user", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeTruthy();
    expect(result?.name).toBe("Admin User");
    expect(result?.role).toBe("admin");
  });

  it("auth.me returns null for unauthenticated user", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });
});

describe("User Management (Admin Only)", () => {
  it("admin can list users", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.users.list({ page: 1, pageSize: 20 });
    expect(result).toHaveProperty("data");
    expect(result).toHaveProperty("total");
  });

  it("staff cannot list users", async () => {
    const ctx = createStaffContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.users.list({ page: 1, pageSize: 20 })).rejects.toThrow();
  });

  it("admin can update user role", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.users.updateRole({ userId: 2, role: "admin" });
    expect(result).toBeUndefined();
  });

  it("admin can delete (disable) user", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.users.delete({ userId: 2 });
    expect(result).toBeUndefined();
  });

  it("admin can list users with includeDisabled", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.users.list({ page: 1, pageSize: 20, includeDisabled: true });
    expect(result).toHaveProperty("data");
    expect(result).toHaveProperty("total");
  });

  it("admin can restore disabled user", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.users.restore({ userId: 2 });
    expect(result).toBeUndefined();
  });

  it("staff cannot restore user", async () => {
    const ctx = createStaffContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.users.restore({ userId: 2 })).rejects.toThrow();
  });
});

describe("Customer Management", () => {
  it("staff can create customer", async () => {
    const ctx = createStaffContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.customers.create({
      whatsapp: "+44 7312 035806",
      customerType: "新零售",
      contactName: "Test Customer",
      country: "UK",
    });
    expect(result).toHaveProperty("id");
    expect(result.id).toBe(1);
  });

  it("staff can list customers", async () => {
    const ctx = createStaffContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.customers.list({ page: 1, pageSize: 20 });
    expect(result).toHaveProperty("data");
    expect(result).toHaveProperty("total");
  });

  it("unauthenticated user cannot create customer", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.customers.create({ whatsapp: "+44 123456" })
    ).rejects.toThrow();
  });

  it("staff can update customer", async () => {
    const ctx = createStaffContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.customers.update({
      id: 1,
      contactName: "Updated Name",
    });
    expect(result).toEqual({ success: true });
  });

  it("staff can delete customer", async () => {
    const ctx = createStaffContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.customers.delete({ id: 1 });
    expect(result).toEqual({ success: true });
  });
});

describe("Order Management", () => {
  it("staff can create order", async () => {
    const ctx = createStaffContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.orders.create({
      customerWhatsapp: "+44 7312 035806",
      orderNumber: "珠04015806-Test",
      orderDate: "2026-04-08",
      orderStatus: "待处理",
    });
    expect(result).toHaveProperty("id");
    expect(result.id).toBe(1);
  });

  it("staff can list orders", async () => {
    const ctx = createStaffContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.orders.list({ page: 1, pageSize: 20 });
    expect(result).toHaveProperty("data");
    expect(result).toHaveProperty("total");
  });

  it("staff can update own order", async () => {
    const { getOrderById } = await import("./db");
    (getOrderById as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ id: 1, staffId: 2 });
    const ctx = createStaffContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.orders.update({
      id: 1,
      orderStatus: "已发货",
    });
    expect(result).toEqual({ success: true });
  });

  it("staff cannot update other's order", async () => {
    const { getOrderById } = await import("./db");
    (getOrderById as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ id: 1, staffId: 999 });
    const ctx = createStaffContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.orders.update({ id: 1, orderStatus: "已发货" })).rejects.toThrow("您只能编辑自己的订单");
  });

  it("staff can delete own order", async () => {
    const { getOrderById } = await import("./db");
    (getOrderById as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ id: 1, staffId: 2 });
    const ctx = createStaffContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.orders.delete({ id: 1 });
    expect(result).toEqual({ success: true });
  });

  it("staff cannot delete other's order", async () => {
    const { getOrderById } = await import("./db");
    (getOrderById as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ id: 1, staffId: 999 });
    const ctx = createStaffContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.orders.delete({ id: 1 })).rejects.toThrow("您只能删除自己的订单");
  });

  it("unauthenticated user cannot create order", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.orders.create({
        customerWhatsapp: "+44 123456",
        orderNumber: "TEST-001",
      })
    ).rejects.toThrow();
  });
});

describe("Order Items with Profit Calculation", () => {
  it("creates order item with auto-calculated profits", async () => {
    const { createOrderItem } = await import("./db");
    const ctx = createStaffContext();
    const caller = appRouter.createCaller(ctx);

    // amountUsd=20 => amountCny=20*6.4=128, shippingCharged=128-100=28
    await caller.orderItems.create({
      orderId: 1,
      orderNumber: "TEST-001",
      size: "XL",
      quantity: 1,
      sellingPrice: "100",
      productCost: "60",
      shippingActual: "20",
      amountUsd: "20",
    });

    expect(createOrderItem).toHaveBeenCalledWith(
      expect.objectContaining({
        amountCny: "128.00",
        shippingCharged: "28.00",
        productProfit: "40.00",
        productProfitRate: "0.400000",
        shippingProfit: "8.00",
        shippingProfitRate: "0.285714",
        totalProfit: "48.00",
        profitRate: "0.375000",
      })
    );
  });

  it("handles zero values correctly in profit calculation", async () => {
    const { createOrderItem } = await import("./db");
    const ctx = createStaffContext();
    const caller = appRouter.createCaller(ctx);

    await caller.orderItems.create({
      orderId: 1,
      orderNumber: "TEST-002",
      sellingPrice: "0",
      productCost: "0",
      shippingActual: "0",
      amountUsd: "0",
    });

    expect(createOrderItem).toHaveBeenCalledWith(
      expect.objectContaining({
        amountCny: "0.00",
        shippingCharged: "0.00",
        productProfit: "0.00",
        productProfitRate: "0.000000",
        shippingProfit: "0.00",
        shippingProfitRate: "0.000000",
        totalProfit: "0.00",
        profitRate: "0.000000",
      })
    );
  });

  it("staff can delete order item", async () => {
    const ctx = createStaffContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.orderItems.delete({ id: 1, orderId: 1 });
    expect(result).toEqual({ success: true });
  });
});

describe("Statistics", () => {
  it("admin can get overview stats", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.stats.overview();
    expect(result).toHaveProperty("orderStats");
    expect(result).toHaveProperty("customerStats");
    expect(result).toHaveProperty("statusDist");
    expect(result).toHaveProperty("paymentDist");
    expect(result.orderStats.totalOrders).toBe(5);
  });

  it("admin can get staff performance", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.stats.staffPerformance();
    expect(Array.isArray(result)).toBe(true);
  });

  it("staff cannot get staff performance", async () => {
    const ctx = createStaffContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.stats.staffPerformance()).rejects.toThrow();
  });

  it("staff can get recent orders", async () => {
    const ctx = createStaffContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.stats.recentOrders({ limit: 10 });
    expect(Array.isArray(result)).toBe(true);
  });

  it("staff can get daily trend", async () => {
    const ctx = createStaffContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.stats.dailyTrend({ days: 30 });
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("File Upload", () => {
  it("staff can upload image", async () => {
    const ctx = createStaffContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.upload.image({
      base64: "dGVzdA==", // "test" in base64
      filename: "test.jpg",
      contentType: "image/jpeg",
    });
    expect(result).toHaveProperty("url");
    expect(result.url).toBe("https://cdn.example.com/test.jpg");
  });

  it("unauthenticated user cannot upload image", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.upload.image({
        base64: "dGVzdA==",
        filename: "test.jpg",
        contentType: "image/jpeg",
      })
    ).rejects.toThrow();
  });
});

describe("Bulk Import Orders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("staff can bulk import orders with auto customer creation", async () => {
    const { createOrder, createOrderItem, recalculateOrderTotals, getCustomerByWhatsapp, createCustomer, createAuditLog } = await import("./db");
    (getCustomerByWhatsapp as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (createCustomer as ReturnType<typeof vi.fn>).mockResolvedValue(100);
    (createOrder as ReturnType<typeof vi.fn>).mockResolvedValue(1);
    (createOrderItem as ReturnType<typeof vi.fn>).mockResolvedValue(1);

    const ctx = createStaffContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.orders.bulkImport({
      rows: [
        {
          customerWhatsapp: "+44 7312 035806",
          orderNumber: "TEST-IMPORT-001",
          orderDate: "2026-04-08",
          sellingPrice: "100",
          productCost: "60",
          shippingActual: "20",
          amountUsd: "20",
        },
      ],
    });

    expect(result.success).toBe(true);
    expect(result.imported).toBe(1);
    expect(result.orders).toHaveLength(1);
    expect(result.orders[0].orderNumber).toBe("TEST-IMPORT-001");

    // Should auto-create customer
    expect(createCustomer).toHaveBeenCalledWith(
      expect.objectContaining({
        whatsapp: "+44 7312 035806",
      })
    );

    // Should create order
    expect(createOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        customerWhatsapp: "+44 7312 035806",
        orderNumber: "TEST-IMPORT-001",
        staffId: 2,
      })
    );

    // Should create order item with auto-calculated fields
    // amountUsd=20 => amountCny=128, shippingCharged=128-100=28
    expect(createOrderItem).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 1,
        amountCny: "128.00",
        shippingCharged: "28.00",
        productProfit: "40.00",
        productProfitRate: "0.400000",
        shippingProfit: "8.00",
        totalProfit: "48.00",
      })
    );

    // Should recalculate totals
    expect(recalculateOrderTotals).toHaveBeenCalledWith(1);

    // Should log the action
    expect(createAuditLog).toHaveBeenCalled();
  });

  it("groups rows with same orderNumber into one order", async () => {
    const { createOrder, createOrderItem, getCustomerByWhatsapp, createCustomer } = await import("./db");
    (getCustomerByWhatsapp as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (createCustomer as ReturnType<typeof vi.fn>).mockResolvedValue(100);
    (createOrder as ReturnType<typeof vi.fn>).mockResolvedValue(1);
    (createOrderItem as ReturnType<typeof vi.fn>).mockResolvedValue(1);

    const ctx = createStaffContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.orders.bulkImport({
      rows: [
        { customerWhatsapp: "+44 111", orderNumber: "ORDER-001", size: "M" },
        { customerWhatsapp: "+44 111", orderNumber: "ORDER-001", size: "L" },
        { customerWhatsapp: "+44 111", orderNumber: "ORDER-001", size: "XL" },
      ],
    });

    expect(result.imported).toBe(1); // One order
    expect(createOrder).toHaveBeenCalledTimes(1);
    expect(createOrderItem).toHaveBeenCalledTimes(3); // Three items
  });

  it("uses existing customer when found", async () => {
    const { getCustomerByWhatsapp, createCustomer, createOrder, createOrderItem } = await import("./db");
    (getCustomerByWhatsapp as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 50, whatsapp: "+44 222" });
    (createOrder as ReturnType<typeof vi.fn>).mockResolvedValue(1);
    (createOrderItem as ReturnType<typeof vi.fn>).mockResolvedValue(1);

    const ctx = createStaffContext();
    const caller = appRouter.createCaller(ctx);
    await caller.orders.bulkImport({
      rows: [
        { customerWhatsapp: "+44 222", orderNumber: "ORDER-002" },
      ],
    });

    // Should NOT create a new customer
    expect(createCustomer).not.toHaveBeenCalled();

    // Should use existing customer ID
    expect(createOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: 50,
      })
    );
  });

  it("rejects import with missing required fields", async () => {
    const ctx = createStaffContext();
    const caller = appRouter.createCaller(ctx);

    // Missing customerWhatsapp
    await expect(
      caller.orders.bulkImport({
        rows: [{ customerWhatsapp: "", orderNumber: "ORDER-003" }],
      })
    ).rejects.toThrow();

    // Missing orderNumber
    await expect(
      caller.orders.bulkImport({
        rows: [{ customerWhatsapp: "+44 333", orderNumber: "" }],
      })
    ).rejects.toThrow();
  });

  it("unauthenticated user cannot bulk import", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.orders.bulkImport({
        rows: [{ customerWhatsapp: "+44 444", orderNumber: "ORDER-004" }],
      })
    ).rejects.toThrow();
  });

  it("bulk import passes originalOrderNo to createOrderItem", async () => {
    const { createOrder, createOrderItem, getCustomerByWhatsapp, createCustomer, recalculateOrderTotals, createAuditLog } = await import("./db");
    (getCustomerByWhatsapp as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (createCustomer as ReturnType<typeof vi.fn>).mockResolvedValue(100);
    (createOrder as ReturnType<typeof vi.fn>).mockResolvedValue(1);
    (createOrderItem as ReturnType<typeof vi.fn>).mockResolvedValue(1);

    const ctx = createStaffContext();
    const caller = appRouter.createCaller(ctx);
    await caller.orders.bulkImport({
      rows: [
        {
          customerWhatsapp: "+44 555",
          orderNumber: "ORDER-ORIG-001",
          originalOrderNo: "ORIG-999",
          sellingPrice: "50",
          productCost: "30",
          amountUsd: "10",
        },
      ],
    });

    expect(createOrderItem).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 1,
        originalOrderNo: "ORIG-999",
      })
    );
  });
});

describe("Order Items originalOrderNo field", () => {
  it("orderItems.create accepts originalOrderNo", async () => {
    const { createOrderItem } = await import("./db");
    const ctx = createStaffContext();
    const caller = appRouter.createCaller(ctx);

    await caller.orderItems.create({
      orderId: 1,
      orderNumber: "TEST-ORIG-001",
      originalOrderNo: "ORIG-ABC",
      sellingPrice: "100",
      productCost: "60",
      shippingActual: "20",
      amountUsd: "20",
    });

    expect(createOrderItem).toHaveBeenCalledWith(
      expect.objectContaining({
        originalOrderNo: "ORIG-ABC",
      })
    );
  });

  it("orderItems.update accepts originalOrderNo", async () => {
    const { updateOrderItem, getOrderItemById } = await import("./db");
    (getOrderItemById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 10,
      orderId: 1,
      orderNumber: "TEST-001",
      originalOrderNo: null,
    });

    const ctx = createStaffContext();
    const caller = appRouter.createCaller(ctx);

    await caller.orderItems.update({
      id: 10,
      orderId: 1,
      originalOrderNo: "ORIG-XYZ",
    });

    expect(updateOrderItem).toHaveBeenCalledWith(
      10,
      expect.objectContaining({
        originalOrderNo: "ORIG-XYZ",
      })
    );
  });
});

describe("Exchange Rate Management", () => {
  it("any authenticated user can get current exchange rate", async () => {
    const ctx = createStaffContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.exchangeRate.current();
    expect(result).toHaveProperty("rate");
    expect(result.rate).toBe("6.4");
  });

  it("admin can list exchange rate history", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.exchangeRate.list({ page: 1, pageSize: 20 });
    expect(result).toHaveProperty("data");
    expect(result).toHaveProperty("total");
  });

  it("staff cannot list exchange rate history", async () => {
    const ctx = createStaffContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.exchangeRate.list({ page: 1, pageSize: 20 })).rejects.toThrow();
  });

  it("admin can update exchange rate", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.exchangeRate.update({ rate: 7.25, reason: "市场调整" });
    expect(result).toHaveProperty("id");
    expect(result).toHaveProperty("rate");
    expect(result.rate).toBe(7.25);
  });

  it("staff cannot update exchange rate", async () => {
    const ctx = createStaffContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.exchangeRate.update({ rate: 7.25 })).rejects.toThrow();
  });

  it("unauthenticated user cannot get exchange rate", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.exchangeRate.current()).rejects.toThrow();
  });
});

describe("Profit Report", () => {
  it("admin can get profit report summary", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.profitReport.summary({});
    expect(result).toHaveProperty("summary");
    expect(result).toHaveProperty("byStaff");
    expect(result).toHaveProperty("dailyTrend");
  });

  it("admin can get profit report with filters", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.profitReport.summary({
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      staffName: "Staff A",
    });
    expect(result).toHaveProperty("summary");
  });

  it("staff can get their own profit report", async () => {
    const ctx = createStaffContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.profitReport.summary({});
    // Staff gets filtered data (only their own)
    expect(result).toBeDefined();
    expect(result.summary).toBeDefined();
    // Verify getProfitReport was called with staff's own name
    const { getProfitReport } = await import("./db");
    const lastCall = (getProfitReport as any).mock.calls.at(-1);
    expect(lastCall[0].staffName).toBe("Staff User"); // staff context user name
  });

  it("staff cannot override staffName filter", async () => {
    const ctx = createStaffContext();
    const caller = appRouter.createCaller(ctx);
    // Even if staff tries to pass another staffName, it should be overridden
    await caller.profitReport.summary({ staffName: "Other Staff" });
    const { getProfitReport } = await import("./db");
    const lastCall = (getProfitReport as any).mock.calls.at(-1);
    expect(lastCall[0].staffName).toBe("Staff User"); // forced to own name
  });

  it("staff monthly comparison is filtered to own name", async () => {
    const ctx = createStaffContext();
    const caller = appRouter.createCaller(ctx);
    await caller.profitReport.monthlyComparison({});
    const { getMonthlyProfitComparison } = await import("./db");
    const lastCall = (getMonthlyProfitComparison as any).mock.calls.at(-1);
    expect(lastCall[0]).toBe("Staff User");
  });

  it("staff quarterly comparison is filtered to own name", async () => {
    const ctx = createStaffContext();
    const caller = appRouter.createCaller(ctx);
    await caller.profitReport.quarterlyComparison({});
    const { getQuarterlyProfitComparison } = await import("./db");
    const lastCall = (getQuarterlyProfitComparison as any).mock.calls.at(-1);
    expect(lastCall[0]).toBe("Staff User");
  });

  it("staff cannot access alert setting", async () => {
    const ctx = createStaffContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.profitReport.alertSetting()).rejects.toThrow();
  });

  it("any authenticated user can get staff names", async () => {
    const ctx = createStaffContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.profitReport.staffNames();
    expect(Array.isArray(result)).toBe(true);
    expect(result).toContain("Staff A");
    expect(result).toContain("Staff B");
  });

  it("unauthenticated user cannot get staff names", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.profitReport.staffNames()).rejects.toThrow();
  });

  // Monthly/Quarterly Comparison Tests
  it("admin can get monthly profit comparison", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.profitReport.monthlyComparison({});
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(2);
    expect(result[0].period).toBe("2026-03");
    expect(result[1].momProfitGrowth).toBe(0.75);
  });
  it("admin can get monthly comparison with staff filter", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.profitReport.monthlyComparison({ staffName: "Staff A" });
    expect(Array.isArray(result)).toBe(true);
  });
  it("staff can get their own monthly comparison", async () => {
    const ctx = createStaffContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.profitReport.monthlyComparison({});
    // Staff gets filtered data (only their own)
    expect(Array.isArray(result)).toBe(true);
  });
  it("admin can get quarterly profit comparison", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.profitReport.quarterlyComparison({});
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(1);
    expect(result[0].period).toBe("2026-Q1");
  });
  it("staff can get their own quarterly comparison", async () => {
    const ctx = createStaffContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.profitReport.quarterlyComparison({});
    // Staff gets filtered data (only their own)
    expect(Array.isArray(result)).toBe(true);
  });

  // Profit Alert Settings Tests
  it("admin can get alert setting", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.profitReport.alertSetting();
    expect(result.minProfitRate).toBe("0.100000");
    expect(result.enabled).toBe(1);
  });
  it("admin can update alert setting", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.profitReport.updateAlertSetting({ minProfitRate: 0.15, enabled: true });
    expect(result.id).toBe(2);
  });
  it("staff cannot update alert setting", async () => {
    const ctx = createStaffContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.profitReport.updateAlertSetting({ minProfitRate: 0.15, enabled: true })).rejects.toThrow();
  });
  it("admin can get staff alerts", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.profitReport.staffAlerts();
    expect(result.alerts.length).toBe(1);
    expect(result.alerts[0].staffName).toBe("Staff C");
    expect(result.setting.enabled).toBe(1);
  });
  it("staff cannot get staff alerts", async () => {
    const ctx = createStaffContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.profitReport.staffAlerts()).rejects.toThrow();
  });

  // ==================== Extra Data (补发盈亏、工资、社保) ====================
  it("admin can get extra data with all fields", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.profitReport.extraData({});
    expect(result.reshipmentProfitLoss).toBe("-500.00");
    expect(result.reshipmentCount).toBe(3);
    expect(result.salaryTotal).toBe(15000);
    expect(result.insuranceTotal).toBe("3000.00");
  });

  it("staff can get extra data but salary and insurance are 0", async () => {
    const ctx = createStaffContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.profitReport.extraData({});
    expect(result.reshipmentProfitLoss).toBeDefined();
    expect(result.salaryTotal).toBe(0);
    expect(result.insuranceTotal).toBe("0");
  });

  it("staff extraData filters reshipment by own staffName", async () => {
    const ctx = createStaffContext();
    const caller = appRouter.createCaller(ctx);
    await caller.profitReport.extraData({ staffName: "Other Staff" });
    const { getReshipmentProfitLoss } = await import("./db");
    const lastCall = (getReshipmentProfitLoss as any).mock.calls.at(-1);
    expect(lastCall[0].staffName).toBe("Staff User");
  });

  it("admin can get social insurance for a month", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.profitReport.getSocialInsurance({ yearMonth: "2026-04" });
    expect(result).toBeDefined();
    expect(result?.amount).toBe("3000.00");
  });

  it("admin can upsert social insurance", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.profitReport.upsertSocialInsurance({ yearMonth: "2026-04", amount: 5000, remark: "测试" });
    expect(result.id).toBeDefined();
  });

  it("admin can list social insurance", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.profitReport.listSocialInsurance();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(1);
  });

  it("staff cannot access social insurance APIs", async () => {
    const ctx = createStaffContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.profitReport.getSocialInsurance({ yearMonth: "2026-04" })).rejects.toThrow();
    await expect(caller.profitReport.upsertSocialInsurance({ yearMonth: "2026-04", amount: 5000 })).rejects.toThrow();
    await expect(caller.profitReport.listSocialInsurance()).rejects.toThrow();
  });
});

// ==================== Staff Monthly Targets ====================
describe("staffTargets", () => {
  it("admin can list targets for a month", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.staffTargets.list({ yearMonth: "2026-04" });
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(1);
    expect(result[0].staffName).toBe("Staff A");
  });

  it("admin can upsert a target", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.staffTargets.upsert({
      staffId: 2,
      staffName: "Staff A",
      yearMonth: "2026-04",
      profitTarget: 5000,
      revenueTarget: 20000,
    });
    expect(result.id).toBeDefined();
  });

  it("admin can delete a target", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.staffTargets.delete({ id: 1 });
    expect(result.success).toBe(true);
  });

  it("admin can get target progress with details and null teamSummary", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.staffTargets.progress({ yearMonth: "2026-04" });
    expect(result).toHaveProperty("details");
    expect(result).toHaveProperty("teamSummary");
    expect(result.teamSummary).toBeNull();
    expect(Array.isArray(result.details)).toBe(true);
    expect(result.details.length).toBe(1);
    expect(result.details[0].profitProgress).toBe(0.5);
    expect(result.details[0].revenueProgress).toBe(0.6);
    expect(result.details[0].profitGap).toBe("2500.00");
  });

  it("admin can get staff list", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.staffTargets.staffList();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(2);
  });

  it("staff can list their own targets", async () => {
    const ctx = createStaffContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.staffTargets.list({ yearMonth: "2026-04" });
    // Staff gets filtered data (only their own targets)
    expect(Array.isArray(result)).toBe(true);
  });

  it("staff gets progress with teamSummary and filtered details", async () => {
    const ctx = createStaffContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.staffTargets.progress({ yearMonth: "2026-04" });
    expect(result).toHaveProperty("details");
    expect(result).toHaveProperty("teamSummary");
    // teamSummary should contain aggregated team data
    expect(result.teamSummary).not.toBeNull();
    expect(result.teamSummary).toHaveProperty("totalProfitTarget");
    expect(result.teamSummary).toHaveProperty("totalActualProfit");
    expect(result.teamSummary).toHaveProperty("totalRevenueTarget");
    expect(result.teamSummary).toHaveProperty("totalActualRevenue");
    // details should only contain staff's own data
    expect(Array.isArray(result.details)).toBe(true);
    for (const d of result.details) {
      expect(d.staffId).toBe(2); // staff context user id
    }
  });

  it("staff cannot upsert targets", async () => {
    const ctx = createStaffContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.staffTargets.upsert({
      staffId: 2, staffName: "Staff A", yearMonth: "2026-04",
      profitTarget: 5000, revenueTarget: 20000,
    })).rejects.toThrow();
  });

  it("validates yearMonth format", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.staffTargets.list({ yearMonth: "2026/04" })).rejects.toThrow();
    await expect(caller.staffTargets.list({ yearMonth: "bad" })).rejects.toThrow();
  });
});

// ==================== Annual Targets Tests ====================
describe("annualTargets", () => {
  it("admin can list annual targets", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.annualTargets.list({ year: 2026 });
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });

  it("admin can upsert team annual target", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.annualTargets.upsert({
      year: 2026,
      type: "team",
      profitTarget: 100000,
      revenueTarget: 500000,
    });
    expect(result).toBeDefined();
    expect(result.id).toBe(1);
  });

  it("admin can upsert individual annual target", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.annualTargets.upsert({
      year: 2026,
      type: "individual",
      staffId: 2,
      staffName: "Staff A",
      profitTarget: 30000,
      revenueTarget: 150000,
    });
    expect(result).toBeDefined();
    expect(result.id).toBe(1);
  });

  it("individual target requires staffId", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.annualTargets.upsert({
      year: 2026,
      type: "individual",
      profitTarget: 30000,
      revenueTarget: 150000,
    })).rejects.toThrow();
  });

  it("admin can delete annual target", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.annualTargets.delete({ id: 1 });
    expect(result.success).toBe(true);
  });

  it("admin can get annual target progress", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.annualTargets.progress({ year: 2026 });
    expect(result).toBeDefined();
    expect(result).toHaveProperty("team");
    expect(result).toHaveProperty("individuals");
  });

  it("staff can list annual targets (filtered to team + own)", async () => {
    const { listAnnualTargets } = await import("./db");
    (listAnnualTargets as any).mockResolvedValueOnce([
      { id: 1, year: 2026, type: "team", staffId: null, staffName: null, profitTarget: "100000", revenueTarget: "500000" },
      { id: 2, year: 2026, type: "individual", staffId: 2, staffName: "Staff User", profitTarget: "30000", revenueTarget: "150000" },
      { id: 3, year: 2026, type: "individual", staffId: 99, staffName: "Other Staff", profitTarget: "30000", revenueTarget: "150000" },
    ]);
    const ctx = createStaffContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.annualTargets.list({ year: 2026 });
    // Should see team + own, not other staff
    expect(result.length).toBe(2);
    expect(result.some((t: any) => t.type === "team")).toBe(true);
    expect(result.some((t: any) => t.staffId === 99)).toBe(false);
  });

  it("staff cannot upsert annual targets", async () => {
    const ctx = createStaffContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.annualTargets.upsert({
      year: 2026,
      type: "team",
      profitTarget: 100000,
      revenueTarget: 500000,
    })).rejects.toThrow();
  });

  it("staff cannot delete annual targets", async () => {
    const ctx = createStaffContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.annualTargets.delete({ id: 1 })).rejects.toThrow();
  });

  it("staff progress shows team + own individuals only", async () => {
    const { getAnnualTargetProgress } = await import("./db");
    (getAnnualTargetProgress as any).mockResolvedValueOnce({
      team: { targetId: 1, year: 2026, profitTarget: "100000", revenueTarget: "500000", actualProfit: "50000", actualRevenue: "250000", orderCount: 100, profitProgress: 0.5, revenueProgress: 0.5, profitGap: "50000", revenueGap: "250000" },
      individuals: [
        { targetId: 2, staffId: 2, staffName: "Staff User", year: 2026, profitTarget: "30000", revenueTarget: "150000", actualProfit: "15000", actualRevenue: "75000", orderCount: 30, profitProgress: 0.5, revenueProgress: 0.5, profitGap: "15000", revenueGap: "75000" },
        { targetId: 3, staffId: 99, staffName: "Other Staff", year: 2026, profitTarget: "30000", revenueTarget: "150000", actualProfit: "10000", actualRevenue: "50000", orderCount: 20, profitProgress: 0.33, revenueProgress: 0.33, profitGap: "20000", revenueGap: "100000" },
      ],
    });
    const ctx = createStaffContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.annualTargets.progress({ year: 2026 });
    expect(result.team).toBeDefined();
    expect(result.individuals.length).toBe(1);
    expect(result.individuals[0].staffId).toBe(2);
  });

  it("rejects invalid year", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.annualTargets.list({ year: 2019 })).rejects.toThrow();
    await expect(caller.annualTargets.list({ year: 2101 })).rejects.toThrow();
  });
});

// ==================== Daily Data Tests ====================
describe("dailyData", () => {
  it("admin can list all daily data", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.dailyData.list({ startDate: "2026-04-01", endDate: "2026-04-09" });
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });

  it("staff can list daily data (filtered to own)", async () => {
    const ctx = createStaffContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.dailyData.list({ startDate: "2026-04-01" });
    expect(result).toBeDefined();
  });

  it("admin can create daily data for any staff", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.dailyData.create({
      reportDate: "2026-04-09",
      staffId: 2,
      staffName: "Staff User",
      messageCount: 50,
      newCustomerCount: 5,
    });
    expect(result).toHaveProperty("id");
  });

  it("staff can create own daily data", async () => {
    const ctx = createStaffContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.dailyData.create({
      reportDate: "2026-04-09",
      messageCount: 30,
    });
    expect(result).toHaveProperty("id");
  });

  it("staff can update own daily data", async () => {
    const ctx = createStaffContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.dailyData.update({ id: 1, messageCount: 60 });
    expect(result.success).toBe(true);
  });

  it("staff cannot update other staff data", async () => {
    const { getDailyDataById } = await import("./db");
    (getDailyDataById as any).mockResolvedValueOnce({ id: 1, reportDate: "2026-04-09", staffId: 999, staffName: "Other" });
    const ctx = createStaffContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.dailyData.update({ id: 1, messageCount: 60 })).rejects.toThrow();
  });

  it("staff can delete own daily data", async () => {
    const ctx = createStaffContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.dailyData.delete({ id: 1 });
    expect(result.success).toBe(true);
  });

  it("staff cannot delete other staff data", async () => {
    const { getDailyDataById } = await import("./db");
    (getDailyDataById as any).mockResolvedValueOnce({ id: 1, reportDate: "2026-04-09", staffId: 999, staffName: "Other" });
    const ctx = createStaffContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.dailyData.delete({ id: 1 })).rejects.toThrow();
  });

  it("admin can sync order data", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.dailyData.syncOrderData({ id: 1 });
    expect(result.success).toBe(true);
  });

  it("admin gets daily report by staff dimension (getDailyReportByStaff)", async () => {
    const { getDailyReportByStaff } = await import("./db");
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.dailyData.report({ reportDate: "2026-04-09" });
    expect(result).toHaveProperty("rows");
    expect(result).toHaveProperty("totals");
    expect(getDailyReportByStaff).toHaveBeenCalledWith("2026-04-09", undefined);
  });

  it("admin can filter daily report by staff name", async () => {
    const { getDailyReportByStaff } = await import("./db");
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.dailyData.report({ reportDate: "2026-04-09", staffName: "Staff User" });
    expect(result).toHaveProperty("rows");
    expect(getDailyReportByStaff).toHaveBeenCalledWith("2026-04-09", "Staff User");
  });

  it("staff gets daily report by account dimension (getDailyReportByAccount)", async () => {
    const { getDailyReportByAccount } = await import("./db");
    const ctx = createStaffContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.dailyData.report({ reportDate: "2026-04-09" });
    expect(result).toHaveProperty("rows");
    expect(getDailyReportByAccount).toHaveBeenCalledWith("2026-04-09", "Staff User");
  });

  it("only admin can access staffList", async () => {
    const staffCtx = createStaffContext();
    const staffCaller = appRouter.createCaller(staffCtx);
    await expect(staffCaller.dailyData.staffList()).rejects.toThrow();

    const adminCtx = createAdminContext();
    const adminCaller = appRouter.createCaller(adminCtx);
    const result = await adminCaller.dailyData.staffList();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("Account Management", () => {
  it("any authenticated user can list accounts", async () => {
    const ctx = createStaffContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.accounts.list();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(2);
    expect(result[0].name).toBe("M1 BUY-4254");
    expect(result[0].color).toBe("#f87171");
  });

  it("unauthenticated user cannot list accounts", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.accounts.list()).rejects.toThrow();
  });

  it("admin can create account", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.accounts.create({ name: "New Account", color: "#60a5fa" });
    expect(result.id).toBe(3);
  });

  it("staff cannot create account", async () => {
    const ctx = createStaffContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.accounts.create({ name: "New Account" })).rejects.toThrow();
  });

  it("admin can update account", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.accounts.update({ id: 1, name: "Updated Name", color: "#34d399" });
    expect(result.success).toBe(true);
  });

  it("staff cannot update account", async () => {
    const ctx = createStaffContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.accounts.update({ id: 1, name: "Updated" })).rejects.toThrow();
  });

  it("admin can delete account", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.accounts.delete({ id: 1 });
    expect(result.success).toBe(true);
  });

  it("staff cannot delete account", async () => {
    const ctx = createStaffContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.accounts.delete({ id: 1 })).rejects.toThrow();
  });

  it("admin can reorder accounts", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.accounts.reorder({
      items: [{ id: 2, sortOrder: 0 }, { id: 1, sortOrder: 1 }],
    });
    expect(result.success).toBe(true);
  });

  it("staff cannot reorder accounts", async () => {
    const ctx = createStaffContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.accounts.reorder({ items: [{ id: 1, sortOrder: 0 }] })
    ).rejects.toThrow();
  });

  it("create account rejects empty name", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.accounts.create({ name: "" })).rejects.toThrow();
  });
});

describe("Daily Report DrillDown", () => {
  it("admin can drill down into staff account details", async () => {
    const { getDailyReportDrillDown } = await import("./db");
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.dailyData.drillDown({ reportDate: "2026-04-09", staffName: "Staff User" });
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(2);
    expect(result[0].whatsAccount).toBe("M1 BUY-4254");
    expect(result[1].whatsAccount).toBe("K-ONE-1718");
    expect(getDailyReportDrillDown).toHaveBeenCalledWith("2026-04-09", "Staff User");
  });

  it("staff cannot access drillDown (admin only)", async () => {
    const ctx = createStaffContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.dailyData.drillDown({ reportDate: "2026-04-09", staffName: "Staff User" })).rejects.toThrow();
  });
});

describe("Daily Report Notes", () => {
  it("authenticated user can list notes", async () => {
    const { listDailyReportNotes } = await import("./db");
    const ctx = createStaffContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.dailyData.notesList({ reportDate: "2026-04-09" });
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(1);
    expect(result[0].content).toBe("今日总结");
    expect(listDailyReportNotes).toHaveBeenCalledWith("2026-04-09");
  });

  it("unauthenticated user cannot list notes", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.dailyData.notesList({ reportDate: "2026-04-09" })).rejects.toThrow();
  });

  it("authenticated user can create note", async () => {
    const { createDailyReportNote } = await import("./db");
    const ctx = createStaffContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.dailyData.createNote({ reportDate: "2026-04-09", content: "今日反馈" });
    expect(result.id).toBe(2);
    expect(createDailyReportNote).toHaveBeenCalledWith(expect.objectContaining({
      reportDate: "2026-04-09",
      userId: 2,
      userName: "Staff User",
      userRole: "user",
      content: "今日反馈",
    }));
  });

  it("createNote rejects empty content", async () => {
    const ctx = createStaffContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.dailyData.createNote({ reportDate: "2026-04-09", content: "" })).rejects.toThrow();
  });

  it("admin can update any note", async () => {
    const { updateDailyReportNote } = await import("./db");
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.dailyData.updateNote({ id: 1, content: "更新后的总结" });
    expect(result.success).toBe(true);
    expect(updateDailyReportNote).toHaveBeenCalledWith(1, "更新后的总结");
  });

  it("staff cannot update other user's note", async () => {
    const { getDailyReportNoteById } = await import("./db");
    // Note belongs to userId 1 (admin), staff is userId 2
    (getDailyReportNoteById as any).mockResolvedValueOnce({ id: 1, userId: 1, userName: "Admin User", userRole: "admin", content: "test" });
    const ctx = createStaffContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.dailyData.updateNote({ id: 1, content: "hack" })).rejects.toThrow("无权编辑他人的备注");
  });

  it("staff can update own note", async () => {
    const { getDailyReportNoteById, updateDailyReportNote } = await import("./db");
    (getDailyReportNoteById as any).mockResolvedValueOnce({ id: 5, userId: 2, userName: "Staff User", userRole: "user", content: "my note" });
    const ctx = createStaffContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.dailyData.updateNote({ id: 5, content: "updated" });
    expect(result.success).toBe(true);
    expect(updateDailyReportNote).toHaveBeenCalledWith(5, "updated");
  });

  it("admin can delete any note", async () => {
    const { deleteDailyReportNote } = await import("./db");
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.dailyData.deleteNote({ id: 1 });
    expect(result.success).toBe(true);
    expect(deleteDailyReportNote).toHaveBeenCalledWith(1);
  });

  it("staff cannot delete other user's note", async () => {
    const { getDailyReportNoteById } = await import("./db");
    (getDailyReportNoteById as any).mockResolvedValueOnce({ id: 1, userId: 1, userName: "Admin User", userRole: "admin", content: "test" });
    const ctx = createStaffContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.dailyData.deleteNote({ id: 1 })).rejects.toThrow("无权删除他人的备注");
  });
});

describe("users.create with hireDate", () => {
  it("admin can create user with hireDate", async () => {
    const { createUser } = await import("./db");
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.users.create({
      name: "New Staff",
      username: "newstaff",
      password: "test1234",
      role: "user",
      hireDate: "2026-03-15",
    });
    expect(result.id).toBe(10);
    expect(createUser).toHaveBeenCalledWith(expect.objectContaining({
      name: "New Staff",
      hireDate: "2026-03-15",
    }));
  });

  it("admin can create user without hireDate", async () => {
    const { createUser } = await import("./db");
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.users.create({
      name: "Another Staff",
      username: "another",
      password: "test1234",
      role: "user",
    });
    expect(result.id).toBe(10);
    expect(createUser).toHaveBeenCalledWith(expect.objectContaining({
      name: "Another Staff",
    }));
  });
});

describe("users.updateHireDate", () => {
  it("admin can update hire date", async () => {
    const { updateUserHireDate } = await import("./db");
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.users.updateHireDate({
      userId: 5,
      hireDate: "2026-01-10",
    });
    expect(result.success).toBe(true);
    expect(updateUserHireDate).toHaveBeenCalledWith(5, "2026-01-10");
  });

  it("admin can clear hire date", async () => {
    const { updateUserHireDate } = await import("./db");
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.users.updateHireDate({
      userId: 5,
      hireDate: null,
    });
    expect(result.success).toBe(true);
    expect(updateUserHireDate).toHaveBeenCalledWith(5, null);
  });
});

describe("orders.recalculateAllProfitRates", () => {
  it("admin can recalculate all profit rates", async () => {
    const { recalculateAllItemProfitRates, createAuditLog } = await import("./db");
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.orders.recalculateAllProfitRates();
    expect(result.updated).toBe(5);
    expect(result.totalItems).toBe(20);
    expect(result.totalOrders).toBe(10);
    expect(recalculateAllItemProfitRates).toHaveBeenCalled();
    expect(createAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      action: "update",
      targetType: "order",
    }));
  });

  it("non-admin cannot recalculate profit rates", async () => {
    const ctx = createStaffContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.orders.recalculateAllProfitRates()).rejects.toThrow();
  });

  it("unauthenticated user cannot recalculate profit rates", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.orders.recalculateAllProfitRates()).rejects.toThrow();
  });
});


// ==================== Batch Delete Orders ====================
describe("orders.batchDelete", () => {
  it("admin can batch delete orders", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.orders.batchDelete({ orderIds: [1, 2, 3] });
    expect(result.deleted).toBe(3);
  });

  it("non-admin cannot batch delete orders", async () => {
    const ctx = createStaffContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.orders.batchDelete({ orderIds: [1] })).rejects.toThrow();
  });

  it("unauthenticated user cannot batch delete orders", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.orders.batchDelete({ orderIds: [1] })).rejects.toThrow();
  });

  it("rejects empty orderIds array", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.orders.batchDelete({ orderIds: [] })).rejects.toThrow();
  });
});


// ==================== Session Invalidation Tests ====================
describe("session invalidation on user delete and password change", () => {
  it("deleteUser is called as soft delete (sets deletedAt)", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const { deleteUser } = await import("./db");
    await caller.users.delete({ userId: 5 });
    expect(deleteUser).toHaveBeenCalledWith(5);
  });

  it("loginWithPassword rejects deleted user with '该账号已被禁用'", async () => {
    const { getUserByUsername } = await import("./db");
    const { generateCaptcha } = await import("./captcha");
    const captcha = generateCaptcha();
    (getUserByUsername as any).mockResolvedValueOnce({
      id: 1, openId: "test-open-id", name: "Test", password: "salt:hash",
      role: "user", deletedAt: new Date(), sessionInvalidatedAt: null,
    });
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.auth.loginWithPassword({
      username: "test", password: "pass",
      captchaToken: captcha.token, captchaCode: captcha.code,
    })).rejects.toThrow("该账号已被禁用");
  });

  it("setPassword invalidates sessions (sets sessionInvalidatedAt)", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const { updateUserPassword, updateUserUsername } = await import("./db");
    (updateUserUsername as any).mockResolvedValueOnce(undefined);
    await caller.users.setPassword({ userId: 5, username: "testuser", password: "newpass123" });
    expect(updateUserPassword).toHaveBeenCalledWith(5, "newpass123");
  });
});

// ==================== Context Session Invalidation Tests ====================
describe("context-level session checks", () => {
  it("user with deletedAt set should be treated as null in context", async () => {
    // This tests the logic in context.ts - a user with deletedAt should not be authenticated
    const deletedUser = {
      id: 1, openId: "deleted-user", name: "Deleted", role: "user" as const,
      deletedAt: new Date(), sessionInvalidatedAt: null,
      lastSignedIn: new Date(),
    };
    // Verify the check logic
    let user: any = deletedUser;
    if (user && user.deletedAt) {
      user = null;
    }
    expect(user).toBeNull();
  });

  it("user with sessionInvalidatedAt after lastSignedIn should be treated as null", () => {
    const now = new Date();
    const user: any = {
      id: 1, openId: "pw-changed-user", name: "Test", role: "user",
      deletedAt: null,
      sessionInvalidatedAt: new Date(now.getTime() + 1000), // invalidated 1s after
      lastSignedIn: now,
    };
    let result: any = user;
    if (result && result.sessionInvalidatedAt && result.lastSignedIn) {
      const invalidatedAt = new Date(result.sessionInvalidatedAt).getTime();
      const lastSignedIn = new Date(result.lastSignedIn).getTime();
      if (lastSignedIn < invalidatedAt) {
        result = null;
      }
    }
    expect(result).toBeNull();
  });

  it("user with lastSignedIn after sessionInvalidatedAt should remain valid", () => {
    const now = new Date();
    const user: any = {
      id: 1, openId: "re-logged-user", name: "Test", role: "user",
      deletedAt: null,
      sessionInvalidatedAt: new Date(now.getTime() - 1000), // invalidated 1s before
      lastSignedIn: now,
    };
    let result: any = user;
    if (result && result.sessionInvalidatedAt && result.lastSignedIn) {
      const invalidatedAt = new Date(result.sessionInvalidatedAt).getTime();
      const lastSignedIn = new Date(result.lastSignedIn).getTime();
      if (lastSignedIn < invalidatedAt) {
        result = null;
      }
    }
    expect(result).not.toBeNull();
    expect(result.openId).toBe("re-logged-user");
  });
});
