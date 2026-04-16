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

describe("Excel Headers - Field Mapping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return headers, autoMapping and sampleData", async () => {
    const { registerExcelImportRoute } = await import("./excelImport");
    const { mockApp, routes } = createMockApp();
    registerExcelImportRoute(mockApp);

    const headersHandler = routes["/api/excel-headers"];
    expect(headersHandler).toBeDefined();

    (XLSX.read as any).mockReturnValue({
      SheetNames: ["Sheet1"],
      Sheets: { Sheet1: {} },
    });
    (XLSX.utils.sheet_to_json as any).mockReturnValue([
      ["\u8ba2\u5355\u7f16\u53f7", "\u5ba2\u6237WhatsApp", "Size", "\u56fd\u5185\u5355\u53f7"],
      ["ORD001", "+1234567890", "42", "SF123456"],
      ["ORD002", "+0987654321", "43", "YT789012"],
      ["ORD003", "+1111111111", "44", "ZT345678"],
    ]);

    const req = createMockReq();
    const res = createMockRes();

    await headersHandler(req, res);

    expect(res._json.success).toBe(true);
    expect(res._json.headers).toEqual(["\u8ba2\u5355\u7f16\u53f7", "\u5ba2\u6237WhatsApp", "Size", "\u56fd\u5185\u5355\u53f7"]);
    expect(res._json.autoMapping).toContain("orderNumber");
    expect(res._json.autoMapping).toContain("customerWhatsapp");
    expect(res._json.sampleData).toHaveLength(3); // first 3 data rows
    expect(res._json.totalRows).toBe(3);
  });

  it("should support custom mapping in preview", async () => {
    const { registerExcelImportRoute } = await import("./excelImport");
    const { mockApp, routes } = createMockApp();
    registerExcelImportRoute(mockApp);

    const previewHandler = routes["/api/excel-preview"];

    (XLSX.read as any).mockReturnValue({
      SheetNames: ["Sheet1"],
      Sheets: { Sheet1: {} },
    });
    // Columns with non-standard names
    (XLSX.utils.sheet_to_json as any).mockReturnValue([
      ["MyOrder", "Phone", "Sz"],
      ["ORD001", "+1234567890", "42"],
    ]);

    (db.findOrderItemsByOrderNumbers as any).mockResolvedValue([]);
    (db.findOrderItemsByOriginalOrderNos as any).mockResolvedValue([]);

    // Send custom mapping via body
    const req = createMockReq({
      body: {
        customMapping: ["orderNumber", "customerWhatsapp", "size"],
      },
    });
    const res = createMockRes();

    await previewHandler(req, res);

    expect(res._json.success).toBe(true);
    expect(res._json.canAutoCreate).toBe(true);
    expect(res._json.rows[0].orderNumber).toBe("ORD001");
    expect(res._json.rows[0].customerWhatsapp).toBe("+1234567890");
    expect(res._json.rows[0].size).toBe("42");
  });

  it("should support custom mapping in import", async () => {
    const { registerExcelImportRoute } = await import("./excelImport");
    const { mockApp, routes } = createMockApp();
    registerExcelImportRoute(mockApp);

    const importHandler = routes["/api/excel-import"];

    (XLSX.read as any).mockReturnValue({
      SheetNames: ["Sheet1"],
      Sheets: { Sheet1: {} },
    });
    (XLSX.utils.sheet_to_json as any).mockReturnValue([
      ["MyOrder", "Phone", "Sz"],
      ["NEW001", "+1234567890", "42"],
    ]);

    (db.findOrderItemsByOrderNumbers as any).mockResolvedValue([]);
    (db.findOrderItemsByOriginalOrderNos as any).mockResolvedValue([]);
    (db.getCustomerByWhatsapp as any).mockResolvedValue(null);
    (db.createCustomer as any).mockResolvedValue(10);
    (db.createOrder as any).mockResolvedValue(50);
    (db.createOrderItem as any).mockResolvedValue(200);

    const req = createMockReq({
      query: { autoCreate: "true" } as any,
      body: {
        customMapping: JSON.stringify(["orderNumber", "customerWhatsapp", "size"]),
      },
    });
    const res = createMockRes();

    await importHandler(req, res);

    expect(res._json.success).toBe(true);
    expect(res._json.created).toBe(1);
    expect(db.createOrder).toHaveBeenCalledWith(expect.objectContaining({
      orderNumber: "NEW001",
      customerWhatsapp: "+1234567890",
    }));
  });
});

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

describe("Excel Import - Image Column Support", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("preview should handle orderImageUrl mapping in custom mapping", async () => {
    const { registerExcelImportRoute } = await import("./excelImport");
    const { mockApp, routes } = createMockApp();
    registerExcelImportRoute(mockApp);

    const previewHandler = routes["/api/excel-preview"];

    (XLSX.read as any).mockReturnValue({
      SheetNames: ["Sheet1"],
      Sheets: { Sheet1: {} },
    });
    (XLSX.utils.sheet_to_json as any).mockReturnValue([
      ["订单编号", "订单图片", "Size"],
      ["ORD001", "", "42"],
    ]);

    (db.findOrderItemsByOrderNumbers as any).mockResolvedValue([]);
    (db.findOrderItemsByOriginalOrderNos as any).mockResolvedValue([]);

    const req = createMockReq({
      body: {
        customMapping: ["orderNumber", "orderImageUrl", "size"],
      },
    });
    const res = createMockRes();

    await previewHandler(req, res);

    expect(res._json.success).toBe(true);
    expect(res._json.rows[0].orderNumber).toBe("ORD001");
    expect(res._json.rows[0].size).toBe("42");
  });

  it("preview should handle paymentScreenshotUrl mapping", async () => {
    const { registerExcelImportRoute } = await import("./excelImport");
    const { mockApp, routes } = createMockApp();
    registerExcelImportRoute(mockApp);

    const previewHandler = routes["/api/excel-preview"];

    (XLSX.read as any).mockReturnValue({
      SheetNames: ["Sheet1"],
      Sheets: { Sheet1: {} },
    });
    (XLSX.utils.sheet_to_json as any).mockReturnValue([
      ["订单编号", "付款截图", "客户WhatsApp"],
      ["ORD001", "https://example.com/img.jpg", "+1234567890"],
    ]);

    (db.findOrderItemsByOrderNumbers as any).mockResolvedValue([]);
    (db.findOrderItemsByOriginalOrderNos as any).mockResolvedValue([]);

    const req = createMockReq({
      body: {
        customMapping: ["orderNumber", "paymentScreenshotUrl", "customerWhatsapp"],
      },
    });
    const res = createMockRes();

    await previewHandler(req, res);

    expect(res._json.success).toBe(true);
    expect(res._json.rows[0].paymentScreenshotUrl).toBe("https://example.com/img.jpg");
    expect(res._json.canAutoCreate).toBe(true);
  });

  it("headers endpoint should auto-map 订单图片 column", async () => {
    const { registerExcelImportRoute } = await import("./excelImport");
    const { mockApp, routes } = createMockApp();
    registerExcelImportRoute(mockApp);

    const headersHandler = routes["/api/excel-headers"];

    (XLSX.read as any).mockReturnValue({
      SheetNames: ["Sheet1"],
      Sheets: { Sheet1: {} },
    });
    (XLSX.utils.sheet_to_json as any).mockReturnValue([
      ["订单编号", "订单图片", "付款截图", "Size"],
      ["ORD001", "", "", "42"],
    ]);

    const req = createMockReq();
    const res = createMockRes();

    await headersHandler(req, res);

    expect(res._json.success).toBe(true);
    expect(res._json.autoMapping).toContain("orderImageUrl");
    expect(res._json.autoMapping).toContain("paymentScreenshotUrl");
  });

  it("import should include image URL fields in updatable fields", async () => {
    const { registerExcelImportRoute } = await import("./excelImport");
    const { mockApp, routes } = createMockApp();
    registerExcelImportRoute(mockApp);

    const importHandler = routes["/api/excel-import"];

    (XLSX.read as any).mockReturnValue({
      SheetNames: ["Sheet1"],
      Sheets: { Sheet1: {} },
    });
    (XLSX.utils.sheet_to_json as any).mockReturnValue([
      ["订单编号", "订单图片"],
      ["ORD001", "https://cdn.example.com/order1.jpg"],
    ]);

    // Mock existing item match
    (db.findOrderItemsByOrderNumbers as any).mockResolvedValue([
      { item: { id: 10, orderId: 5, orderNumber: "ORD001" } },
    ]);
    (db.findOrderItemsByOriginalOrderNos as any).mockResolvedValue([]);

    const req = createMockReq({
      body: {
        customMapping: JSON.stringify(["orderNumber", "orderImageUrl"]),
      },
    });
    const res = createMockRes();

    await importHandler(req, res);

    expect(res._json.success).toBe(true);
    expect(res._json.updated).toBe(1);
    expect(db.updateOrderItem).toHaveBeenCalledWith(10, expect.objectContaining({
      orderImageUrl: "https://cdn.example.com/order1.jpg",
    }));
  });

  it("should clean DISPIMG formula values from image cells", async () => {
    const { registerExcelImportRoute } = await import("./excelImport");
    const { mockApp, routes } = createMockApp();
    registerExcelImportRoute(mockApp);

    const headersHandler = routes["/api/excel-headers"];

    (XLSX.read as any).mockReturnValue({
      SheetNames: ["Sheet1"],
      Sheets: { Sheet1: {} },
    });
    (XLSX.utils.sheet_to_json as any).mockReturnValue([
      ["订单编号", "订单图片"],
      ["ORD001", '=DISPIMG("ID_xxx",1)'],
    ]);

    const req = createMockReq();
    const res = createMockRes();

    await headersHandler(req, res);

    expect(res._json.success).toBe(true);
    // DISPIMG formula should be cleaned to empty string
    expect(res._json.sampleData[0][1]).toBe("");
  });
});

describe("Excel Import - Simplified Flow Validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should register all 3 endpoints", async () => {
    const { registerExcelImportRoute } = await import("./excelImport");
    const { mockApp, routes } = createMockApp();
    registerExcelImportRoute(mockApp);

    expect(routes["/api/excel-headers"]).toBeDefined();
    expect(routes["/api/excel-preview"]).toBeDefined();
    expect(routes["/api/excel-import"]).toBeDefined();
  });

  it("headers endpoint should return totalRows for display", async () => {
    const { registerExcelImportRoute } = await import("./excelImport");
    const { mockApp, routes } = createMockApp();
    registerExcelImportRoute(mockApp);

    const headersHandler = routes["/api/excel-headers"];

    (XLSX.read as any).mockReturnValue({
      SheetNames: ["Sheet1"],
      Sheets: { Sheet1: {} },
    });
    (XLSX.utils.sheet_to_json as any).mockReturnValue([
      ["订单编号", "Size"],
      ["ORD001", "42"],
      ["ORD002", "43"],
      ["ORD003", "44"],
      ["ORD004", "45"],
      ["ORD005", "46"],
    ]);

    const req = createMockReq();
    const res = createMockRes();

    await headersHandler(req, res);

    expect(res._json.success).toBe(true);
    expect(res._json.totalRows).toBe(5); // 5 data rows (excluding header)
    expect(res._json.sampleData).toHaveLength(3); // max 3 sample rows
  });

  it("preview should return mapping info for display", async () => {
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
      ["ORD001", "42", "SF123"],
    ]);

    (db.findOrderItemsByOrderNumbers as any).mockResolvedValue([]);
    (db.findOrderItemsByOriginalOrderNos as any).mockResolvedValue([]);

    const req = createMockReq();
    const res = createMockRes();

    await previewHandler(req, res);

    expect(res._json.success).toBe(true);
    // Should return mapping array for UI display
    expect(res._json.mapping).toBeDefined();
    expect(Array.isArray(res._json.mapping)).toBe(true);
    expect(res._json.mapping.length).toBe(3);
    expect(res._json.mapping[0]).toHaveProperty("header");
    expect(res._json.mapping[0]).toHaveProperty("field");
  });
});
