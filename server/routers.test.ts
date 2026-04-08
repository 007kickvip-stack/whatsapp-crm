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
  getOrderItemsByOrderId: vi.fn().mockResolvedValue([]),
  recalculateOrderTotals: vi.fn().mockResolvedValue(undefined),
  getOrderStats: vi.fn().mockResolvedValue({ totalOrders: 5, totalRevenueCny: "1000", totalProfit: "200" }),
  getOrderStatusDistribution: vi.fn().mockResolvedValue([{ status: "待处理", count: 3 }]),
  getPaymentStatusDistribution: vi.fn().mockResolvedValue([{ status: "未付款", count: 2 }]),
  getStaffPerformance: vi.fn().mockResolvedValue([]),
  getRecentOrders: vi.fn().mockResolvedValue([]),
  getCustomerStats: vi.fn().mockResolvedValue({ total: 10 }),
  getDailyOrderTrend: vi.fn().mockResolvedValue([]),
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

    await caller.orderItems.create({
      orderId: 1,
      orderNumber: "TEST-001",
      size: "XL",
      quantity: 1,
      sellingPrice: "100",
      productCost: "60",
      shippingCharged: "30",
      shippingActual: "20",
      amountCny: "130",
      amountUsd: "18",
    });

    expect(createOrderItem).toHaveBeenCalledWith(
      expect.objectContaining({
        productProfit: "40.00",
        productProfitRate: "0.400000",
        shippingProfit: "10.00",
        shippingProfitRate: "0.333333",
        totalProfit: "50.00",
        profitRate: "0.384615",
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
      shippingCharged: "0",
      shippingActual: "0",
      amountCny: "0",
    });

    expect(createOrderItem).toHaveBeenCalledWith(
      expect.objectContaining({
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
