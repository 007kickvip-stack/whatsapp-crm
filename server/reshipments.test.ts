import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the database module
vi.mock("./db", async (importOriginal) => {
  const original = await importOriginal<typeof import("./db")>();
  return {
    ...original,
    createReshipment: vi.fn().mockResolvedValue(1),
    updateReshipment: vi.fn().mockResolvedValue(undefined),
    deleteReshipment: vi.fn().mockResolvedValue(undefined),
    getReshipmentById: vi.fn().mockResolvedValue({
      id: 1,
      reshipDate: new Date("2026-04-15"),
      staffName: "Test Staff",
      staffId: 1,
      account: "test-account",
      customerWhatsapp: "+1234567890",
      orderNumber: "RS-001",
      orderImageUrl: null,
      size: "M",
      domesticTrackingNo: null,
      sizeRecommendation: null,
      contactInfo: null,
      internationalTrackingNo: null,
      originalOrderNo: "ORD-001",
      shipDate: null,
      quantity: 1,
      source: null,
      orderStatus: "已报货，待发货",
      totalProfit: "0",
      reshipReason: "尺码不对",
      customerPaidAmount: "0",
      reshipCost: "0",
      actualShipping: "0",
      profitLoss: "0",
      originalOrderId: 100,
      createdById: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
    listReshipments: vi.fn().mockResolvedValue({
      data: [
        {
          id: 1,
          reshipDate: new Date("2026-04-15"),
          staffName: "Test Staff",
          staffId: 1,
          account: "test-account",
          customerWhatsapp: "+1234567890",
          orderNumber: "RS-001",
          originalOrderNo: "ORD-001",
          orderStatus: "已报货，待发货",
          quantity: 1,
          totalProfit: "0",
          reshipReason: "尺码不对",
          customerPaidAmount: "0",
          reshipCost: "0",
          actualShipping: "0",
          profitLoss: "0",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      total: 1,
    }),
    getReshipmentsByOriginalOrderId: vi.fn().mockResolvedValue([
      {
        id: 1,
        originalOrderId: 100,
        orderNumber: "RS-001",
        reshipDate: new Date("2026-04-15"),
      },
    ]),
    getOrderWithItems: vi.fn().mockResolvedValue({
      id: 100,
      orderNumber: "ORD-001",
      staffName: "Test Staff",
      account: "test-account",
      customerWhatsapp: "+1234567890",
      items: [
        {
          orderImageUrl: "https://example.com/img.jpg",
          size: "M",
          sizeRecommendation: "建议L",
          contactInfo: "contact@test.com",
          source: "供应商A",
        },
      ],
    }),
    createAuditLog: vi.fn().mockResolvedValue(undefined),
  };
});

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
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("reshipments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("list", () => {
    it("admin can list all reshipments", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.reshipments.list({ page: 1, pageSize: 50 });
      expect(result).toHaveProperty("data");
      expect(result).toHaveProperty("total");
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it("staff list includes staffId filter", async () => {
      const { listReshipments } = await import("./db");
      const ctx = createStaffContext();
      const caller = appRouter.createCaller(ctx);
      await caller.reshipments.list({ page: 1, pageSize: 50 });
      expect(listReshipments).toHaveBeenCalledWith(
        expect.objectContaining({ staffId: 2 })
      );
    });
  });

  describe("getById", () => {
    it("returns a reshipment by id", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.reshipments.getById({ id: 1 });
      expect(result).toBeTruthy();
      expect(result?.id).toBe(1);
      expect(result?.staffName).toBe("Test Staff");
    });
  });

  describe("getByOriginalOrderId", () => {
    it("returns reshipments for a given order", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.reshipments.getByOriginalOrderId({ orderId: 100 });
      expect(result).toHaveLength(1);
      expect(result[0].originalOrderId).toBe(100);
    });
  });

  describe("create", () => {
    it("creates a new reshipment record", async () => {
      const { createReshipment } = await import("./db");
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.reshipments.create({
        reshipDate: "2026-04-15",
        staffName: "Test Staff",
        account: "test-account",
        customerWhatsapp: "+1234567890",
        orderNumber: "RS-002",
        reshipReason: "质量问题",
      });
      expect(result).toEqual({ id: 1 });
      expect(createReshipment).toHaveBeenCalledWith(
        expect.objectContaining({
          staffName: "Test Staff",
          account: "test-account",
          customerWhatsapp: "+1234567890",
          orderNumber: "RS-002",
          reshipReason: "质量问题",
          staffId: 1,
          createdById: 1,
        })
      );
    });
  });

  describe("createFromOrder", () => {
    it("creates reshipment from existing order with pre-filled data", async () => {
      const { createReshipment } = await import("./db");
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.reshipments.createFromOrder({
        orderId: 100,
        reshipReason: "尺码不对",
      });
      expect(result).toEqual({ id: 1 });
      expect(createReshipment).toHaveBeenCalledWith(
        expect.objectContaining({
          originalOrderNo: "ORD-001",
          staffName: "Test Staff",
          account: "test-account",
          customerWhatsapp: "+1234567890",
          originalOrderId: 100,
          reshipReason: "尺码不对",
          orderImageUrl: "https://example.com/img.jpg",
          size: "M",
          sizeRecommendation: "建议L",
          source: "供应商A",
        })
      );
    });
  });

  describe("update", () => {
    it("updates a reshipment record", async () => {
      const { updateReshipment } = await import("./db");
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.reshipments.update({
        id: 1,
        orderStatus: "已发货",
        reshipReason: "更新原因",
      });
      expect(result).toEqual({ success: true });
      expect(updateReshipment).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          orderStatus: "已发货",
          reshipReason: "更新原因",
        })
      );
    });

    it("auto-calculates profitLoss when financial fields change", async () => {
      const { updateReshipment } = await import("./db");
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);
      await caller.reshipments.update({
        id: 1,
        customerPaidAmount: "100",
        reshipCost: "30",
        actualShipping: "20",
      });
      expect(updateReshipment).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          profitLoss: "50",
        })
      );
    });
  });

  describe("delete", () => {
    it("deletes a reshipment record", async () => {
      const { deleteReshipment } = await import("./db");
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.reshipments.delete({ id: 1 });
      expect(result).toEqual({ success: true });
      expect(deleteReshipment).toHaveBeenCalledWith(1);
    });
  });
});
