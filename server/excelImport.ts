import type { Express, Request, Response } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import { sdk } from "./_core/sdk";
import {
  createOrder,
  createOrderItem,
  createCustomer,
  getCustomerByWhatsapp,
  getCurrentExchangeRate,
  recalculateOrderTotals,
  createAuditLog,
} from "./db";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Column header mapping: Chinese header → field key
const HEADER_MAP: Record<string, string> = {
  "日期": "orderDate",
  "订单日期": "orderDate",
  "date": "orderDate",
  "账号": "account",
  "客服名字": "_skip",
  "客服": "_skip",
  "客户whatsapp": "customerWhatsapp",
  "whatsapp": "customerWhatsapp",
  "wa": "customerWhatsapp",
  "客户属性": "customerType",
  "订单编号": "orderNumber",
  "订单号": "orderNumber",
  "编号": "orderNumber",
  "订单图片": "_skip",
  "size": "size",
  "尺码": "size",
  "国内单号": "domesticTrackingNo",
  "推荐码数": "sizeRecommendation",
  "联系方式": "contactInfo",
  "姓名/电话/地址": "contactInfo",
  "国际跟踪单号": "internationalTrackingNo",
  "国际单号": "internationalTrackingNo",
  "原订单号": "originalOrderNo",
  "原单号": "originalOrderNo",
  "发出日期": "shipDate",
  "件数": "quantity",
  "数量": "quantity",
  "货源": "source",
  "订单状态": "orderStatus",
  "状态": "orderStatus",
  "总金额$": "amountUsd",
  "总金额￥": "amountCny",
  "总金额¥": "amountCny",
  "售价": "sellingPrice",
  "产品成本": "productCost",
  "成本": "productCost",
  "产品毛利润": "_skip",
  "产品毛利率": "_skip",
  "收取运费(¥)": "shippingCharged",
  "收取运费": "shippingCharged",
  "实际运费": "shippingActual",
  "运费利润": "_skip",
  "运费利润率": "_skip",
  "总利润": "_skip",
  "利润率": "_skip",
  "付款截图": "_skip",
  "备注": "remarks",
  "付款状态": "paymentStatus",
  "操作": "_skip",
};

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, "");
}

function mapHeaders(rawHeaders: string[]): string[] {
  return rawHeaders.map((h) => {
    const normalized = normalizeHeader(h);
    // Try exact match first, then normalized
    if (HEADER_MAP[h.trim()]) return HEADER_MAP[h.trim()];
    for (const [key, val] of Object.entries(HEADER_MAP)) {
      if (normalizeHeader(key) === normalized) return val;
    }
    return "_skip";
  });
}

export function registerExcelImportRoute(app: Express) {
  app.post("/api/excel-import", upload.single("file"), async (req: Request, res: Response) => {
    try {
      // Authenticate user
      let user;
      try {
        user = await sdk.authenticateRequest(req);
      } catch {
        res.status(401).json({ error: "未登录或登录已过期" });
        return;
      }

      if (!req.file) {
        res.status(400).json({ error: "请上传 Excel 文件" });
        return;
      }

      // Parse Excel file
      const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        res.status(400).json({ error: "Excel 文件中没有工作表" });
        return;
      }

      const sheet = workbook.Sheets[sheetName];
      const rawData: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

      if (rawData.length < 2) {
        res.status(400).json({ error: "Excel 文件至少需要包含表头行和一行数据" });
        return;
      }

      // Map headers
      const headerRow = rawData[0].map(String);
      const fieldMapping = mapHeaders(headerRow);

      // Check required fields
      const hasWhatsapp = fieldMapping.includes("customerWhatsapp");
      const hasOrderNumber = fieldMapping.includes("orderNumber");
      if (!hasWhatsapp || !hasOrderNumber) {
        res.status(400).json({
          error: "Excel 文件必须包含「客户WhatsApp」和「订单编号」列",
          detectedHeaders: headerRow,
          mapping: fieldMapping,
        });
        return;
      }

      // Parse data rows
      const dataRows = rawData.slice(1).filter((row) => row.some((cell) => String(cell).trim()));
      const parsedRows: Record<string, string>[] = dataRows.map((row) => {
        const obj: Record<string, string> = {};
        fieldMapping.forEach((field, idx) => {
          if (field !== "_skip" && row[idx] !== undefined) {
            const val = String(row[idx]).trim();
            if (val) obj[field] = val;
          }
        });
        return obj;
      }).filter((row) => row.customerWhatsapp && row.orderNumber);

      if (parsedRows.length === 0) {
        res.status(400).json({ error: "没有找到有效的数据行（需要客户WhatsApp和订单编号）" });
        return;
      }

      // Group rows by orderNumber + customerWhatsapp
      const orderGroups = new Map<string, Record<string, string>[]>();
      for (const row of parsedRows) {
        const key = `${row.orderNumber}||${row.customerWhatsapp}`;
        if (!orderGroups.has(key)) orderGroups.set(key, []);
        orderGroups.get(key)!.push(row);
      }

      // Import orders
      const results: { orderId: number; orderNumber: string }[] = [];
      const errors: string[] = [];

      const currentRate = await getCurrentExchangeRate();
      const exchangeRateVal = parseFloat(String(currentRate.rate));

      for (const [, groupRows] of Array.from(orderGroups)) {
        try {
          const first = groupRows[0];

          // Auto-create customer if not exists
          let existingCustomer = await getCustomerByWhatsapp(first.customerWhatsapp);
          let customerId: number | undefined;
          if (!existingCustomer) {
            customerId = await createCustomer({
              whatsapp: first.customerWhatsapp,
              customerType: first.customerType || "新零售",
              createdById: user.id,
            });
          } else {
            customerId = existingCustomer.id;
          }

          // Create order
          const orderId = await createOrder({
            orderDate: first.orderDate ? new Date(first.orderDate) : null,
            account: first.account || undefined,
            customerWhatsapp: first.customerWhatsapp,
            customerId,
            customerType: first.customerType || "新零售",
            orderNumber: first.orderNumber,
            orderStatus: first.orderStatus || "已报货，待发货",
            paymentStatus: first.paymentStatus || "未付款",
            remarks: first.remarks || undefined,
            staffId: user.id,
            staffName: user.name || "未知客服",
          });

          // Create order items
          for (const row of groupRows) {
            const amountUsd = parseFloat(row.amountUsd || "0");
            const amountCny = amountUsd * exchangeRateVal;
            const sellingPrice = parseFloat(row.sellingPrice || "0");
            const productCost = parseFloat(row.productCost || "0");
            const productProfit = sellingPrice - productCost;
            const productProfitRate = sellingPrice > 0 ? productProfit / sellingPrice : 0;
            const shippingCharged = amountCny - sellingPrice;
            const shippingActual = parseFloat(row.shippingActual || "0");
            const shippingProfit = shippingCharged - shippingActual;
            const shippingProfitRate = shippingCharged > 0 ? shippingProfit / shippingCharged : 0;
            const totalProfit = productProfit + shippingProfit;
            const profitRate = amountCny > 0 ? totalProfit / amountCny : 0;

            await createOrderItem({
              orderId,
              orderNumber: row.orderNumber,
              size: row.size || undefined,
              domesticTrackingNo: row.domesticTrackingNo || undefined,
              sizeRecommendation: row.sizeRecommendation || undefined,
              contactInfo: row.contactInfo || undefined,
              internationalTrackingNo: row.internationalTrackingNo || undefined,
              originalOrderNo: row.originalOrderNo || undefined,
              shipDate: row.shipDate || undefined,
              quantity: row.quantity ? parseInt(row.quantity) || 1 : 1,
              source: row.source || undefined,
              amountUsd: row.amountUsd || "0",
              amountCny: amountCny.toFixed(2),
              sellingPrice: row.sellingPrice || "0",
              productCost: row.productCost || "0",
              shippingCharged: shippingCharged.toFixed(2),
              shippingActual: row.shippingActual || "0",
              productProfit: productProfit.toFixed(2),
              productProfitRate: productProfitRate.toFixed(6),
              shippingProfit: shippingProfit.toFixed(2),
              shippingProfitRate: shippingProfitRate.toFixed(6),
              totalProfit: totalProfit.toFixed(2),
              profitRate: profitRate.toFixed(6),
              remarks: row.remarks || undefined,
              paymentStatus: row.paymentStatus || undefined,
            });
          }

          await recalculateOrderTotals(orderId);
          results.push({ orderId, orderNumber: first.orderNumber });
        } catch (err: any) {
          errors.push(`订单 ${groupRows[0].orderNumber}: ${err.message}`);
        }
      }

      // Log the import action
      await createAuditLog({
        userId: user.id,
        userName: user.name || "未知",
        userRole: user.role,
        action: "import",
        targetType: "order",
        targetName: `Excel导入 ${results.length} 个订单`,
        details: JSON.stringify({
          count: results.length,
          errors: errors.length,
          orderNumbers: results.map((r) => r.orderNumber),
        }),
      });

      res.json({
        success: true,
        imported: results.length,
        totalRows: parsedRows.length,
        orders: results,
        errors: errors.length > 0 ? errors : undefined,
        detectedHeaders: headerRow,
        mapping: fieldMapping.map((f, i) => ({ header: headerRow[i], field: f })),
      });
    } catch (err: any) {
      console.error("[Excel Import] Error:", err);
      res.status(500).json({ error: err.message || "导入失败" });
    }
  });
}
