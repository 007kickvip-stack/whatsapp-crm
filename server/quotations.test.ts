import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database module
vi.mock("./db", () => ({
  createQuotation: vi.fn().mockResolvedValue(1),
  updateQuotation: vi.fn().mockResolvedValue(undefined),
  deleteQuotation: vi.fn().mockResolvedValue(undefined),
  getQuotationById: vi.fn().mockResolvedValue({ id: 1, customerName: "Test Customer", contactInfo: "+44 123", status: "待确认", totalAmountUsd: "100.00", totalAmountCny: "700.00", staffId: 1, staffName: "Test Staff" }),
  getQuotationWithItems: vi.fn().mockResolvedValue({
    id: 1,
    customerName: "Test Customer",
    contactInfo: "+44 123",
    status: "待确认",
    totalAmountUsd: "100.00",
    totalAmountCny: "700.00",
    staffId: 1,
    staffName: "Test Staff",
    remarks: null,
    items: [
      { id: 1, quotationId: 1, orderImageUrl: null, productName: "Nike Shoes", size: "42", quantity: 1, amountUsd: "50.00", amountCny: "350.00", remarks: null },
      { id: 2, quotationId: 1, orderImageUrl: null, productName: "Adidas Shirt", size: "L", quantity: 2, amountUsd: "50.00", amountCny: "350.00", remarks: null },
    ],
  }),
  listQuotations: vi.fn().mockResolvedValue({
    data: [
      {
        id: 1,
        customerName: "Test Customer",
        contactInfo: "+44 123",
        status: "待确认",
        totalAmountUsd: "100.00",
        totalAmountCny: "700.00",
        staffId: 1,
        staffName: "Test Staff",
        items: [
          { id: 1, quotationId: 1, productName: "Nike Shoes", size: "42", amountUsd: "50.00", amountCny: "350.00" },
        ],
      },
    ],
    total: 1,
  }),
  recalculateQuotationTotals: vi.fn().mockResolvedValue(undefined),
  createQuotationItem: vi.fn().mockResolvedValue(1),
  updateQuotationItem: vi.fn().mockResolvedValue(undefined),
  deleteQuotationItem: vi.fn().mockResolvedValue(undefined),
  getQuotationItemsByQuotationId: vi.fn().mockResolvedValue([]),
  createOrder: vi.fn().mockResolvedValue(100),
  createOrderItem: vi.fn().mockResolvedValue(200),
  recalculateOrderTotals: vi.fn().mockResolvedValue(undefined),
  getCurrentExchangeRate: vi.fn().mockResolvedValue({ rate: "7.00" }),
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}));

// Mock other dependencies
vi.mock("./_core/sdk", () => ({ sdk: {} }));
vi.mock("./_core/cookies", () => ({
  COOKIE_NAME: "session",
  getSessionCookieOptions: vi.fn().mockReturnValue({}),
}));
vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({ url: "https://example.com/test.png" }),
}));
vi.mock("./trackingProxy", () => ({
  subscribeTrackingNo: vi.fn().mockResolvedValue(undefined),
  getCallbackUrl: vi.fn().mockReturnValue("https://example.com/callback"),
}));

import { appRouter } from "./routers";
import {
  createQuotation,
  updateQuotation,
  deleteQuotation,
  getQuotationWithItems,
  listQuotations,
  recalculateQuotationTotals,
  createQuotationItem,
  updateQuotationItem,
  deleteQuotationItem,
  createOrder,
  createOrderItem,
  recalculateOrderTotals,
  getCurrentExchangeRate,
} from "./db";

const mockCtx = {
  user: { id: 1, name: "Test Staff", role: "admin" as const, openId: "test-open-id", email: null },
  req: {} as any,
  res: { clearCookie: vi.fn() } as any,
};

const caller = appRouter.createCaller(mockCtx as any);

describe("Quotation CRUD", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should list quotations", async () => {
    const result = await caller.quotations.list({ page: 1, pageSize: 50 });
    expect(result.data).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.data[0].customerName).toBe("Test Customer");
    expect(listQuotations).toHaveBeenCalledWith({
      page: 1,
      pageSize: 50,
      search: undefined,
      staffId: undefined, // admin sees all
    });
  });

  it("should list quotations with search filter", async () => {
    await caller.quotations.list({ page: 1, pageSize: 50, search: "Test" });
    expect(listQuotations).toHaveBeenCalledWith({
      page: 1,
      pageSize: 50,
      search: "Test",
      staffId: undefined,
    });
  });

  it("should create a quotation with auto-created item", async () => {
    const result = await caller.quotations.create({
      customerName: "New Customer",
      contactInfo: "+44 999",
    });
    expect(result.id).toBe(1);
    expect(createQuotation).toHaveBeenCalledWith({
      customerName: "New Customer",
      contactInfo: "+44 999",
      remarks: null,
      staffId: 1,
      staffName: "Test Staff",
    });
    // Should auto-create one empty item
    expect(createQuotationItem).toHaveBeenCalledWith({ quotationId: 1 });
  });

  it("should update a quotation", async () => {
    const result = await caller.quotations.update({
      id: 1,
      customerName: "Updated Customer",
      contactInfo: "+44 888",
    });
    expect(result.success).toBe(true);
    expect(updateQuotation).toHaveBeenCalledWith(1, {
      customerName: "Updated Customer",
      contactInfo: "+44 888",
    });
  });

  it("should delete a quotation", async () => {
    const result = await caller.quotations.delete({ id: 1 });
    expect(result.success).toBe(true);
    expect(deleteQuotation).toHaveBeenCalledWith(1);
  });

  it("should get quotation by id with items", async () => {
    const result = await caller.quotations.getById({ id: 1 });
    expect(result).toBeDefined();
    expect(result!.customerName).toBe("Test Customer");
    expect(result!.items).toHaveLength(2);
    expect(getQuotationWithItems).toHaveBeenCalledWith(1);
  });
});

describe("Quotation Items CRUD", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create a quotation item and recalculate totals", async () => {
    const result = await caller.quotationItems.create({
      quotationId: 1,
      productName: "New Product",
      size: "M",
      amountUsd: "25.00",
    });
    expect(result.id).toBe(1);
    expect(createQuotationItem).toHaveBeenCalled();
    expect(recalculateQuotationTotals).toHaveBeenCalledWith(1);
  });

  it("should update a quotation item with auto CNY calculation", async () => {
    const result = await caller.quotationItems.update({
      id: 1,
      quotationId: 1,
      amountUsd: "30.00",
    });
    expect(result.success).toBe(true);
    // Should auto-calculate amountCny = 30 * 7 = 210
    expect(updateQuotationItem).toHaveBeenCalledWith(1, {
      amountUsd: "30.00",
      amountCny: "210.00",
    });
    expect(recalculateQuotationTotals).toHaveBeenCalledWith(1);
  });

  it("should delete a quotation item and recalculate totals", async () => {
    const result = await caller.quotationItems.delete({ id: 1, quotationId: 1 });
    expect(result.success).toBe(true);
    expect(deleteQuotationItem).toHaveBeenCalledWith(1);
    expect(recalculateQuotationTotals).toHaveBeenCalledWith(1);
  });
});

describe("Sync Quotation to Order", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should sync quotation to order management", async () => {
    const result = await caller.quotations.syncToOrder({ quotationId: 1 });
    expect(result.orderId).toBe(100);
    // Should create order
    expect(createOrder).toHaveBeenCalledTimes(1);
    const orderCall = (createOrder as any).mock.calls[0][0];
    expect(orderCall.customerName).toBe("Test Customer");
    expect(orderCall.customerWhatsapp).toBe("+44 123");
    expect(orderCall.staffId).toBe(1);
    // Should create order items (2 items from quotation)
    expect(createOrderItem).toHaveBeenCalledTimes(2);
    // Should recalculate order totals
    expect(recalculateOrderTotals).toHaveBeenCalledWith(100);
    // Should mark quotation as synced
    expect(updateQuotation).toHaveBeenCalledWith(1, { status: "已同步" });
  });
});
