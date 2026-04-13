import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock db module
vi.mock("./db", () => ({
  exportOrders: vi.fn(),
}));

describe("Excel Export with Images", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should export ExcelJS module and have addImage method", async () => {
    const ExcelJS = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    expect(workbook).toBeDefined();
    expect(typeof workbook.addImage).toBe("function");
    const ws = workbook.addWorksheet("test");
    expect(typeof ws.addImage).toBe("function");
    expect(typeof ws.getImages).toBe("function");
  });

  it("should register the export route", async () => {
    const { registerExcelExportRoute } = await import("./excelExport");
    const mockApp = {
      post: vi.fn(),
      get: vi.fn(),
      use: vi.fn(),
    };
    registerExcelExportRoute(mockApp as any);
    expect(mockApp.post).toHaveBeenCalledWith("/api/excel-export", expect.any(Function));
  });

  it("should create workbook with correct headers", async () => {
    const ExcelJS = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("订单数据");

    const headers = [
      "日期", "客服名字", "账号", "客户WhatsApp", "客户属性", "订单编号",
      "订单图片", "Size", "国内单号", "推荐码数", "联系方式",
      "国际跟踪单号", "原订单号", "发出日期", "件数", "货源", "订单状态",
      "总金额$", "总金额￥", "售价", "产品成本", "产品毛利润", "产品毛利率",
      "收取运费", "实际运费", "运费利润", "运费利润率", "总利润", "利润率",
      "备注", "付款状态", "付款截图"
    ];

    const headerRow = worksheet.addRow(headers);
    expect(headerRow.getCell(1).value).toBe("日期");
    expect(headerRow.getCell(7).value).toBe("订单图片");
    expect(headerRow.getCell(32).value).toBe("付款截图");
  });

  it("should embed image into workbook", async () => {
    const ExcelJS = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("test");

    // Create a minimal 1x1 PNG buffer
    const pngBuffer = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64"
    );

    const imageId = workbook.addImage({
      buffer: pngBuffer,
      extension: "png",
    });

    worksheet.addImage(imageId, {
      tl: { col: 6, row: 1 } as any,
      ext: { width: 80, height: 55 },
    });

    const images = worksheet.getImages();
    expect(images.length).toBe(1);
  });
});

describe("Excel Import with Embedded Images", () => {
  it("should have extractEmbeddedImages function available via import", async () => {
    // The function is not exported, but we can verify the module loads without errors
    const module = await import("./excelImport");
    expect(module.registerExcelImportRoute).toBeDefined();
  });

  it("should register import route with image extraction support", async () => {
    const { registerExcelImportRoute } = await import("./excelImport");
    const mockApp = {
      post: vi.fn(),
      get: vi.fn(),
      use: vi.fn(),
    };
    registerExcelImportRoute(mockApp as any);
    // Should register both preview and import routes
    const postCalls = mockApp.post.mock.calls;
    const routes = postCalls.map((c: any[]) => c[0]);
    expect(routes).toContain("/api/excel-preview");
    expect(routes).toContain("/api/excel-import");
  });

  it("should create and read back Excel with embedded images using ExcelJS", async () => {
    const ExcelJS = await import("exceljs");

    // Create a workbook with an embedded image
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Sheet1");
    worksheet.addRow(["订单编号", "订单图片"]);
    worksheet.addRow(["ORD001", ""]);

    const pngBuffer = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64"
    );

    const imageId = workbook.addImage({
      buffer: pngBuffer,
      extension: "png",
    });

    worksheet.addImage(imageId, {
      tl: { col: 1, row: 1 } as any,
      ext: { width: 80, height: 55 },
    });

    // Write to buffer and read back
    const buffer = await workbook.xlsx.writeBuffer();
    const readWorkbook = new ExcelJS.Workbook();
    await readWorkbook.xlsx.load(buffer as any);

    const readSheet = readWorkbook.getWorksheet(1);
    expect(readSheet).toBeDefined();

    const images = readSheet!.getImages();
    expect(images.length).toBe(1);

    // Verify we can get image data back
    const imgData = readWorkbook.getImage(Number(images[0].imageId));
    expect(imgData).toBeDefined();
    expect(imgData.buffer).toBeDefined();
  });
});
