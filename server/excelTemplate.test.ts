import { describe, it, expect, vi } from "vitest";

describe("Excel Template Download", () => {
  it("should register GET /api/excel-template route", async () => {
    const { registerExcelTemplateRoute } = await import("./excelTemplate");
    const mockApp = {
      get: vi.fn(),
      post: vi.fn(),
      use: vi.fn(),
    };
    registerExcelTemplateRoute(mockApp as any);
    expect(mockApp.get).toHaveBeenCalledWith("/api/excel-template", expect.any(Function));
  });

  it("should generate a valid .xlsx workbook with two sheets", async () => {
    const { registerExcelTemplateRoute } = await import("./excelTemplate");
    const mockApp = {
      get: vi.fn(),
      post: vi.fn(),
      use: vi.fn(),
    };
    registerExcelTemplateRoute(mockApp as any);

    // Get the route handler
    const handler = mockApp.get.mock.calls[0][1];

    // Mock request and response
    let sentBuffer: any = null;
    let headers: Record<string, string> = {};
    const mockRes = {
      setHeader: (key: string, value: string) => { headers[key] = value; },
      send: (buf: any) => { sentBuffer = buf; },
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    await handler({} as any, mockRes as any);

    // Verify response headers
    expect(headers["Content-Type"]).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    expect(headers["Content-Disposition"]).toContain("order_import_template.xlsx");

    // Verify buffer was sent
    expect(sentBuffer).toBeTruthy();
    expect(sentBuffer.length).toBeGreaterThan(0);

    // Parse the workbook and verify structure
    const ExcelJS = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(sentBuffer);

    // Should have 2 worksheets
    expect(workbook.worksheets.length).toBe(2);

    // Sheet 1: 订单导入模板
    const templateSheet = workbook.getWorksheet("订单导入模板");
    expect(templateSheet).toBeDefined();

    // Verify header row
    const headerRow = templateSheet!.getRow(1);
    expect(headerRow.getCell(1).value).toBe("日期");
    expect(headerRow.getCell(5).value).toBe("订单编号");
    expect(headerRow.getCell(6).value).toBe("订单图片");
    expect(headerRow.getCell(24).value).toBe("付款截图");

    // Verify example data rows exist (rows 2 and 3)
    const exampleRow1 = templateSheet!.getRow(2);
    expect(exampleRow1.getCell(1).value).toBe("2025-04-10");
    expect(exampleRow1.getCell(2).value).toBe("账号A");
    expect(exampleRow1.getCell(3).value).toBe("8613800001111");

    const exampleRow2 = templateSheet!.getRow(3);
    expect(exampleRow2.getCell(1).value).toBe("2025-04-10");
    expect(exampleRow2.getCell(2).value).toBe("账号B");
    expect(exampleRow2.getCell(3).value).toBe("8613900002222");

    // Sheet 2: 填写说明
    const helpSheet = workbook.getWorksheet("填写说明");
    expect(helpSheet).toBeDefined();

    // Verify help sheet header
    const helpHeaderRow = helpSheet!.getRow(1);
    expect(helpHeaderRow.getCell(1).value).toBe("列名");
    expect(helpHeaderRow.getCell(2).value).toBe("说明");
    expect(helpHeaderRow.getCell(3).value).toBe("是否必填");
    expect(helpHeaderRow.getCell(4).value).toBe("示例值");

    // Verify help data has entries for key columns
    let foundImageRow = false;
    let foundPaymentRow = false;
    for (let i = 2; i <= 25; i++) {
      const row = helpSheet!.getRow(i);
      const cellVal = row.getCell(1).value?.toString() || "";
      if (cellVal === "订单图片") foundImageRow = true;
      if (cellVal === "付款截图") foundPaymentRow = true;
    }
    expect(foundImageRow).toBe(true);
    expect(foundPaymentRow).toBe(true);
  });

  it("should have 24 columns in the template header", async () => {
    const { registerExcelTemplateRoute } = await import("./excelTemplate");
    const mockApp = { get: vi.fn(), post: vi.fn(), use: vi.fn() };
    registerExcelTemplateRoute(mockApp as any);

    const handler = mockApp.get.mock.calls[0][1];
    let sentBuffer: any = null;
    const mockRes = {
      setHeader: () => {},
      send: (buf: any) => { sentBuffer = buf; },
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    await handler({} as any, mockRes as any);

    const ExcelJS = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(sentBuffer);

    const templateSheet = workbook.getWorksheet("订单导入模板");
    const headerRow = templateSheet!.getRow(1);

    // Count non-empty header cells
    let colCount = 0;
    headerRow.eachCell(() => { colCount++; });
    expect(colCount).toBe(24);
  });

  it("should have frozen header row", async () => {
    const { registerExcelTemplateRoute } = await import("./excelTemplate");
    const mockApp = { get: vi.fn(), post: vi.fn(), use: vi.fn() };
    registerExcelTemplateRoute(mockApp as any);

    const handler = mockApp.get.mock.calls[0][1];
    let sentBuffer: any = null;
    const mockRes = {
      setHeader: () => {},
      send: (buf: any) => { sentBuffer = buf; },
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    await handler({} as any, mockRes as any);

    const ExcelJS = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(sentBuffer);

    const templateSheet = workbook.getWorksheet("订单导入模板");
    expect(templateSheet!.views).toBeDefined();
    expect(templateSheet!.views.length).toBeGreaterThan(0);
    expect(templateSheet!.views[0].state).toBe("frozen");
    expect(templateSheet!.views[0].ySplit).toBe(1);
  });
});
