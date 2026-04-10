import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the db module
vi.mock("./db", () => ({
  listUsers: vi.fn().mockResolvedValue({ data: [], total: 0 }),
  updateUserRole: vi.fn().mockResolvedValue(undefined),
  deleteUser: vi.fn().mockResolvedValue(undefined),
  getUserById: vi.fn().mockResolvedValue(null),
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

  it("admin can delete user", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.users.delete({ userId: 2 });
    expect(result).toBeUndefined();
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

  it("admin can get target progress", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.staffTargets.progress({ yearMonth: "2026-04" });
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(1);
    expect(result[0].profitProgress).toBe(0.5);
    expect(result[0].revenueProgress).toBe(0.6);
    expect(result[0].profitGap).toBe("2500.00");
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
