import { Express, Request, Response } from "express";
import ExcelJS from "exceljs";

export function registerExcelTemplateRoute(app: Express) {
  app.get("/api/excel-template", async (_req: Request, res: Response) => {
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "WhatsApp CRM";
      workbook.created = new Date();

      // ── Sheet 1: 导入模板（含示例数据）──
      const ws = workbook.addWorksheet("订单导入模板");

      const headers = [
        "日期", "账号", "客户WhatsApp", "客户属性",
        "订单编号", "订单图片", "Size", "国内单号",
        "推荐码数", "联系方式", "国际跟踪单号", "原订单号",
        "发出日期", "件数", "货源", "订单状态",
        "总金额$", "售价", "产品成本",
        "收取运费", "实际运费",
        "备注", "付款状态", "付款截图",
      ];

      // Column widths
      const colWidths = [
        12, 14, 18, 12,
        16, 16, 10, 20,
        10, 22, 22, 16,
        12, 6, 10, 18,
        10, 10, 10,
        10, 10,
        20, 10, 16,
      ];

      // Set columns
      ws.columns = headers.map((header, i) => ({
        header,
        width: colWidths[i] || 12,
      }));

      // Style header row
      const headerRow = ws.getRow(1);
      headerRow.font = { bold: true, size: 11, color: { argb: "FFFFFFFF" } };
      headerRow.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      headerRow.height = 30;
      headerRow.eachCell((cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF2E7D32" }, // 翡翠绿
        };
        cell.border = {
          top: { style: "thin", color: { argb: "FFB0B0B0" } },
          bottom: { style: "thin", color: { argb: "FFB0B0B0" } },
          left: { style: "thin", color: { argb: "FFB0B0B0" } },
          right: { style: "thin", color: { argb: "FFB0B0B0" } },
        };
      });

      // ── 示例数据行 1（更新模式示例：通过订单编号匹配已有订单并更新字段）──
      const example1 = [
        "2025-04-10", "账号A", "8613800001111", "新零售",
        "ORD-20250410-001", "(可粘贴图片)", "42", "78986114501177",
        "42-43", "张三/13800001111/广东省深圳市", "YJ2025041001", "",
        "2025-04-11", "1", "工厂A", "已发货",
        "45.5", "280", "180",
        "12", "8",
        "加急处理", "已付款", "(可粘贴图片)",
      ];

      const row2 = ws.addRow(example1);
      row2.alignment = { horizontal: "center", vertical: "middle" };
      row2.height = 22;
      // Light green background for example row
      row2.eachCell((cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFE8F5E9" },
        };
        cell.border = {
          top: { style: "thin", color: { argb: "FFD0D0D0" } },
          bottom: { style: "thin", color: { argb: "FFD0D0D0" } },
          left: { style: "thin", color: { argb: "FFD0D0D0" } },
          right: { style: "thin", color: { argb: "FFD0D0D0" } },
        };
      });

      // ── 示例数据行 2（新建模式示例：未匹配的行将自动创建新订单）──
      const example2 = [
        "2025-04-10", "账号B", "8613900002222", "零售复购",
        "ORD-20250410-002", "(可粘贴图片)", "38", "",
        "38", "李四/13900002222/上海市浦东新区", "", "OLD-12345",
        "", "2", "工厂B", "已报货待发货",
        "68", "420", "260",
        "15", "",
        "需要QC视频", "未付款", "(可粘贴图片)",
      ];

      const row3 = ws.addRow(example2);
      row3.alignment = { horizontal: "center", vertical: "middle" };
      row3.height = 22;
      row3.eachCell((cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFE3F2FD" }, // Light blue for new-create example
        };
        cell.border = {
          top: { style: "thin", color: { argb: "FFD0D0D0" } },
          bottom: { style: "thin", color: { argb: "FFD0D0D0" } },
          left: { style: "thin", color: { argb: "FFD0D0D0" } },
          right: { style: "thin", color: { argb: "FFD0D0D0" } },
        };
      });

      // ── Sheet 2: 填写说明 ──
      const helpWs = workbook.addWorksheet("填写说明");
      helpWs.columns = [
        { header: "列名", width: 18 },
        { header: "说明", width: 50 },
        { header: "是否必填", width: 12 },
        { header: "示例值", width: 30 },
      ];

      // Style help header
      const helpHeader = helpWs.getRow(1);
      helpHeader.font = { bold: true, size: 11, color: { argb: "FFFFFFFF" } };
      helpHeader.alignment = { horizontal: "center", vertical: "middle" };
      helpHeader.height = 28;
      helpHeader.eachCell((cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF1565C0" },
        };
      });

      const helpData: [string, string, string, string][] = [
        ["日期", "订单创建日期，格式 YYYY-MM-DD", "新建时必填", "2025-04-10"],
        ["账号", "WhatsApp 运营账号名称", "新建时必填", "账号A"],
        ["客户WhatsApp", "客户的 WhatsApp 号码（含国家码）", "新建时必填", "8613800001111"],
        ["客户属性", "新零售 / 零售复购 / 定金-新零售 / 定金-零售复购", "可选", "新零售"],
        ["订单编号", "系统订单编号，用于匹配已有订单（更新模式）", "更新时必填*", "ORD-20250410-001"],
        ["订单图片", "可直接在单元格中粘贴图片，导入时自动提取上传", "可选", "(粘贴图片)"],
        ["Size", "商品尺码", "可选", "42"],
        ["国内单号", "国内快递单号，导入后自动订阅物流推送", "可选", "78986114501177"],
        ["推荐码数", "推荐的尺码范围", "可选", "42-43"],
        ["联系方式", "收件人姓名/电话/地址", "可选", "张三/138xxx/深圳"],
        ["国际跟踪单号", "国际物流跟踪号", "可选", "YJ2025041001"],
        ["原订单号", "原始订单号，可用于匹配已有订单（更新模式）", "更新时必填*", "OLD-12345"],
        ["发出日期", "发货日期，格式 YYYY-MM-DD", "可选", "2025-04-11"],
        ["件数", "商品数量", "可选，默认1", "1"],
        ["货源", "货源渠道", "可选", "工厂A"],
        ["订单状态", "已报货待发货/待定/缺货/已发货/已退款 等", "可选", "已发货"],
        ["总金额$", "订单总金额（美元）", "可选", "45.5"],
        ["售价", "产品售价（人民币）", "可选", "280"],
        ["产品成本", "产品成本（人民币）", "可选", "180"],
        ["收取运费", "向客户收取的运费（人民币）", "可选", "12"],
        ["实际运费", "实际支付的运费（人民币）", "可选", "8"],
        ["备注", "订单备注信息", "可选", "加急处理"],
        ["付款状态", "已付款 / 未付款 / 部分付款", "可选", "已付款"],
        ["付款截图", "可直接在单元格中粘贴图片，导入时自动提取上传", "可选", "(粘贴图片)"],
      ];

      helpData.forEach((row, idx) => {
        const dataRow = helpWs.addRow(row);
        dataRow.alignment = { vertical: "middle", wrapText: true };
        dataRow.height = 22;
        // Alternate row colors
        if (idx % 2 === 0) {
          dataRow.eachCell((cell) => {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFF5F5F5" },
            };
          });
        }
      });

      // Add notes section
      helpWs.addRow([]);
      const noteHeaderRow = helpWs.addRow(["重要说明", "", "", ""]);
      noteHeaderRow.font = { bold: true, size: 12 };
      noteHeaderRow.getCell(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFFF3E0" },
      };
      helpWs.mergeCells(noteHeaderRow.number, 1, noteHeaderRow.number, 4);

      const notes = [
        "1. 更新模式：通过「订单编号」或「原订单号」匹配已有订单，更新对应字段值。",
        "2. 新建模式：开启「导入+新建」开关后，未匹配的行将自动创建新订单（需填写日期、账号、客户WhatsApp）。",
        "3. 图片列：可以直接在 Excel 单元格中粘贴图片，导入时系统会自动提取并上传；也支持填写图片URL。",
        "4. 自动计算：总金额￥、产品毛利润、毛利率、运费利润等字段由系统自动计算，无需填写。",
        "5. 物流订阅：填写国内单号后，系统会自动订阅快递100物流推送，无需手动操作。",
        "6. 示例行说明：绿色行=更新已有订单示例，蓝色行=新建订单示例。请删除示例行后填写实际数据。",
        "7. * 更新模式下「订单编号」和「原订单号」至少填写一个；新建模式下两者均可不填。",
      ];

      notes.forEach((note) => {
        const noteRow = helpWs.addRow([note, "", "", ""]);
        noteRow.alignment = { wrapText: true };
        noteRow.height = 22;
        helpWs.mergeCells(noteRow.number, 1, noteRow.number, 4);
      });

      // Freeze header rows
      ws.views = [{ state: "frozen", ySplit: 1, xSplit: 0 }];
      helpWs.views = [{ state: "frozen", ySplit: 1, xSplit: 0 }];

      // Auto-filter on main sheet
      ws.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: headers.length },
      };

      // Generate and send
      const buffer = await workbook.xlsx.writeBuffer();
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="order_import_template.xlsx"'
      );
      res.send(buffer);
    } catch (err: any) {
      console.error("Template generation error:", err);
      res.status(500).json({ error: err.message || "模板生成失败" });
    }
  });
}
