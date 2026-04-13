import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, Express } from "express";

// Mock db functions
vi.mock("./db", () => ({
  findOrderItemsByOrderNumbers: vi.fn().mockResolvedValue([]),
  findOrderItemsByOriginalOrderNos: vi.fn().mockResolvedValue([]),
  updateOrderItem: vi.fn().mockResolvedValue(undefined),
  updateOrder: vi.fn().mockResolvedValue(undefined),
  recalculateOrderTotals: vi.fn().mockResolvedValue(undefined),
  createAuditLog: vi.fn().mockResolvedValue(undefined),
  getCustomerByWhatsapp: vi.fn().mockResolvedValue(null),
  createCustomer: vi.fn().mockResolvedValue(1),
  createOrder: vi.fn().mockResolvedValue(100),
  createOrderItem: vi.fn().mockResolvedValue(200),
  getCurrentExchangeRate: vi.fn().mockResolvedValue({ rate: "7.2000" }),
}));

// Mock trackingProxy
vi.mock("./trackingProxy", () => ({
  subscribeTrackingNo: vi.fn().mockResolvedValue(true),
  getCallbackUrl: vi.fn().mockReturnValue("https://example.com/api/kuaidi100/callback"),
}));

// Mock sdk
vi.mock("./_core/sdk", () => ({
  sdk: {
    authenticateRequest: vi.fn().mockResolvedValue({ id: 1, name: "TestUser", role: "admin" }),
  },
}));

// Mock xlsx
vi.mock("xlsx", () => ({
  read: vi.fn(),
  utils: {
    sheet_to_json: vi.fn(),
  },
}));

import * as db from "./db";
import * as XLSX from "xlsx";

// Helper to extract registered route handlers
function createMockApp() {
  const routes: Record<string, Function> = {};
  const mockApp = {
    post: vi.fn((path: string, ...handlers: Function[]) => {
      // The last handler is the actual route handler, previous ones are middleware (multer)
      routes[path] = handlers[handlers.length - 1];
    }),
    get: vi.fn(),
  } as unknown as Express;
  return { mockApp, routes };
}

function createMockReq(overrides: Partial<Request> = {}): Request {
  return {
    file: { buffer: Buffer.from("test"), originalname: "test.xlsx" },
    query: {},
    body: {},
    headers: { host: "localhost:3000" },
    protocol: "https",
    get: vi.fn().mockReturnValue("localhost:3000"),
    ...overrides,
  } as unknown as Request;
}

function createMockRes(): Response & { _json: any; _status: number } {
  const res = {
    _json: null as any,
    _status: 200,
    status(code: number) { this._status = code; return this; },
    json(data: any) { this._json = data; return this; },
  } as any;
  return res;
}

describe("Excel Import - Auto Create Mode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("preview should return canAutoCreate=true when customerWhatsapp column exists", async () => {
    const { registerExcelImportRoute } = await import("./excelImport");
    const { mockApp, routes } = createMockApp();
    registerExcelImportRoute(mockApp);

    const previewHandler = routes["/api/excel-preview"];
    expect(previewHandler).toBeDefined();

    // Mock XLSX to return data with customerWhatsapp column
    (XLSX.read as any).mockReturnValue({
      SheetNames: ["Sheet1"],
      Sheets: { Sheet1: {} },
    });
    (XLSX.utils.sheet_to_json as any).mockReturnValue([
      ["订单编号", "客户WhatsApp", "Size", "国内单号"],
      ["ORD001", "+1234567890", "42", "SF123456"],
      ["ORD002", "+0987654321", "43", "YT789012"],
    ]);

    // No existing items match
    (db.findOrderItemsByOrderNumbers as any).mockResolvedValue([]);
    (db.findOrderItemsByOriginalOrderNos as any).mockResolvedValue([]);

    const req = createMockReq();
    const res = createMockRes();

    await previewHandler(req, res);

    expect(res._json.success).toBe(true);
    expect(res._json.canAutoCreate).toBe(true);
    expect(res._json.unmatchedCount).toBe(2);
    expect(res._json.matchedCount).toBe(0);
  });

  it("preview should return canAutoCreate=false when no customerWhatsapp column", async () => {
    const { registerExcelImportRoute } = await import("./excelImport");
    const { mockApp, routes } = createMockApp();
    registerExcelImportRoute(mockApp);

    const previewHandler = routes["/api/excel-preview"];

    (XLSX.read as any).mockReturnValue({
      SheetNames: ["Sheet1"],
      Sheets: { Sheet1: {} },
    });
    (XLSX.utils.sheet_to_json as any).mockReturnValue([
      ["订单编号", "Size", "国内单号"],
      ["ORD001", "42", "SF123456"],
    ]);

    (db.findOrderItemsByOrderNumbers as any).mockResolvedValue([]);
    (db.findOrderItemsByOriginalOrderNos as any).mockResolvedValue([]);

    const req = createMockReq();
    const res = createMockRes();

    await previewHandler(req, res);

    expect(res._json.success).toBe(true);
    expect(res._json.canAutoCreate).toBe(false);
  });

  it("import with autoCreate=true should create new orders for unmatched rows", async () => {
    const { registerExcelImportRoute } = await import("./excelImport");
    const { mockApp, routes } = createMockApp();
    registerExcelImportRoute(mockApp);

    const importHandler = routes["/api/excel-import"];
    expect(importHandler).toBeDefined();

    (XLSX.read as any).mockReturnValue({
      SheetNames: ["Sheet1"],
      Sheets: { Sheet1: {} },
    });
    (XLSX.utils.sheet_to_json as any).mockReturnValue([
      ["订单编号", "客户WhatsApp", "Size", "总金额$", "售价", "产品成本"],
      ["NEW001", "+1234567890", "42", "100", "500", "300"],
    ]);

    // No existing items match
    (db.findOrderItemsByOrderNumbers as any).mockResolvedValue([]);
    (db.findOrderItemsByOriginalOrderNos as any).mockResolvedValue([]);
    (db.getCustomerByWhatsapp as any).mockResolvedValue(null);
    (db.createCustomer as any).mockResolvedValue(10);
    (db.createOrder as any).mockResolvedValue(50);
    (db.createOrderItem as any).mockResolvedValue(200);

    const req = createMockReq({ query: { autoCreate: "true" } as any });
    const res = createMockRes();

    await importHandler(req, res);

    expect(res._json.success).toBe(true);
    expect(res._json.created).toBe(1);
    expect(res._json.createdOrders).toHaveLength(1);
    expect(res._json.createdOrders[0].orderNumber).toBe("NEW001");

    // Verify customer was created
    expect(db.createCustomer).toHaveBeenCalledWith(expect.objectContaining({
      whatsapp: "+1234567890",
    }));

    // Verify order was created
    expect(db.createOrder).toHaveBeenCalledWith(expect.objectContaining({
      orderNumber: "NEW001",
      customerWhatsapp: "+1234567890",
    }));

    // Verify order item was created
    expect(db.createOrderItem).toHaveBeenCalled();
    expect(db.recalculateOrderTotals).toHaveBeenCalledWith(50);
  });

  it("import without autoCreate should skip unmatched rows", async () => {
    const { registerExcelImportRoute } = await import("./excelImport");
    const { mockApp, routes } = createMockApp();
    registerExcelImportRoute(mockApp);

    const importHandler = routes["/api/excel-import"];

    (XLSX.read as any).mockReturnValue({
      SheetNames: ["Sheet1"],
      Sheets: { Sheet1: {} },
    });
    (XLSX.utils.sheet_to_json as any).mockReturnValue([
      ["订单编号", "客户WhatsApp", "Size"],
      ["NOMATCH001", "+1234567890", "42"],
    ]);

    (db.findOrderItemsByOrderNumbers as any).mockResolvedValue([]);
    (db.findOrderItemsByOriginalOrderNos as any).mockResolvedValue([]);

    const req = createMockReq(); // no autoCreate
    const res = createMockRes();

    await importHandler(req, res);

    expect(res._json.success).toBe(true);
    expect(res._json.updated).toBe(0);
    expect(res._json.created).toBe(0);
    expect(res._json.skipped).toBe(1);
    expect(db.createOrder).not.toHaveBeenCalled();
  });

  it("import with autoCreate should use existing customer if found", async () => {
    const { registerExcelImportRoute } = await import("./excelImport");
    const { mockApp, routes } = createMockApp();
    registerExcelImportRoute(mockApp);

    const importHandler = routes["/api/excel-import"];

    (XLSX.read as any).mockReturnValue({
      SheetNames: ["Sheet1"],
      Sheets: { Sheet1: {} },
    });
    (XLSX.utils.sheet_to_json as any).mockReturnValue([
      ["订单编号", "客户WhatsApp", "Size"],
      ["NEW002", "+existing123", "44"],
    ]);

    (db.findOrderItemsByOrderNumbers as any).mockResolvedValue([]);
    (db.findOrderItemsByOriginalOrderNos as any).mockResolvedValue([]);
    (db.getCustomerByWhatsapp as any).mockResolvedValue({ id: 99, whatsapp: "+existing123" });
    (db.createOrder as any).mockResolvedValue(60);
    (db.createOrderItem as any).mockResolvedValue(300);

    const req = createMockReq({ query: { autoCreate: "true" } as any });
    const res = createMockRes();

    await importHandler(req, res);

    expect(res._json.success).toBe(true);
    expect(res._json.created).toBe(1);
    // Should NOT create a new customer
    expect(db.createCustomer).not.toHaveBeenCalled();
    // Should use existing customerId
    expect(db.createOrder).toHaveBeenCalledWith(expect.objectContaining({
      customerId: 99,
    }));
  });

  it("import with autoCreate should group rows by orderNumber + whatsapp", async () => {
    const { registerExcelImportRoute } = await import("./excelImport");
    const { mockApp, routes } = createMockApp();
    registerExcelImportRoute(mockApp);

    const importHandler = routes["/api/excel-import"];

    (XLSX.read as any).mockReturnValue({
      SheetNames: ["Sheet1"],
      Sheets: { Sheet1: {} },
    });
    (XLSX.utils.sheet_to_json as any).mockReturnValue([
      ["订单编号", "客户WhatsApp", "Size"],
      ["MULTI001", "+111222333", "42"],
      ["MULTI001", "+111222333", "43"],  // Same order, different item
    ]);

    (db.findOrderItemsByOrderNumbers as any).mockResolvedValue([]);
    (db.findOrderItemsByOriginalOrderNos as any).mockResolvedValue([]);
    (db.getCustomerByWhatsapp as any).mockResolvedValue(null);
    (db.createCustomer as any).mockResolvedValue(20);
    (db.createOrder as any).mockResolvedValue(70);
    (db.createOrderItem as any).mockResolvedValue(400);

    const req = createMockReq({ query: { autoCreate: "true" } as any });
    const res = createMockRes();

    await importHandler(req, res);

    expect(res._json.success).toBe(true);
    expect(res._json.created).toBe(1); // Only 1 order created
    // But 2 items should be created
    expect(db.createOrderItem).toHaveBeenCalledTimes(2);
    expect(db.createOrder).toHaveBeenCalledTimes(1);
  });
});
