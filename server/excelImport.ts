import type { Express, Request, Response } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import { sdk } from "./_core/sdk";
import {
  findOrderItemsByOrderNumbers,
  findOrderItemsByOriginalOrderNos,
  updateOrderItem,
  updateOrder,
  recalculateOrderTotals,
  createAuditLog,
  getCustomerByWhatsapp,
  createCustomer,
  createOrder,
  createOrderItem,
  getCurrentExchangeRate,
} from "./db";
import { subscribeTrackingNo, getCallbackUrl } from "./trackingProxy";
import { storagePut } from "./storage";
import crypto from "crypto";

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
  "订单图片": "orderImageUrl",
  "订单图片链接": "orderImageUrl",
  "orderimageurl": "orderImageUrl",
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
  "付款截图": "paymentScreenshotUrl",
  "付款截图链接": "paymentScreenshotUrl",
  "paymentscreenshoturl": "paymentScreenshotUrl",
  "备注": "remarks",
  "付款状态": "paymentStatus",
  "操作": "_skip",
};

// Fields on order_items that can be updated from Excel
const UPDATABLE_ITEM_FIELDS = [
  "size", "domesticTrackingNo", "sizeRecommendation", "contactInfo",
  "internationalTrackingNo", "originalOrderNo", "shipDate", "quantity",
  "source", "amountUsd", "amountCny", "sellingPrice", "productCost",
  "shippingCharged", "shippingActual", "remarks", "paymentStatus", "itemStatus",
  "orderImageUrl", "paymentScreenshotUrl",
];

// Fields on orders table that can be updated from Excel
const UPDATABLE_ORDER_FIELDS = [
  "orderStatus", "paymentStatus", "remarks", "customerType", "account",
];

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, "");
}

// Parse various date formats from Excel cells into a valid Date or null
function parseExcelDate(value: string | undefined): Date | null {
  if (!value) return null;
  const v = value.trim();
  if (!v) return null;

  // ISO date string: "2026-02-01T00:00:00.000Z"
  if (/^\d{4}-\d{2}-\d{2}T/.test(v)) {
    const d = new Date(v);
    if (!isNaN(d.getTime()) && d.getFullYear() > 1970 && d.getFullYear() < 2100) return d;
  }

  // YYYY-MM-DD or YYYY/MM/DD
  if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(v)) {
    const d = new Date(v.replace(/\//g, "-"));
    if (!isNaN(d.getTime()) && d.getFullYear() > 1970 && d.getFullYear() < 2100) return d;
  }

  // Excel serial number (e.g. 44927 for 2023-01-01)
  const num = parseFloat(v);
  if (!isNaN(num) && num > 25569 && num < 100000) {
    // Excel serial date to JS date
    const d = new Date((num - 25569) * 86400 * 1000);
    if (!isNaN(d.getTime()) && d.getFullYear() > 1970 && d.getFullYear() < 2100) return d;
  }

  return null;
}

// Format a Date to "YYYY-MM-DD" string for MySQL date column
function formatDateForDb(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Clean cell value: remove formula artifacts like DISPIMG(...)
function cleanCellValue(val: string): string {
  // DISPIMG formula from WPS/Excel 365 image cells
  if (/^=?_?xlfn\.?DISPIMG/i.test(val) || /^=DISPIMG/i.test(val)) return "";
  return val;
}

function mapHeaders(rawHeaders: string[]): string[] {
  return rawHeaders.map((h) => {
    const normalized = normalizeHeader(h);
    if (HEADER_MAP[h.trim()]) return HEADER_MAP[h.trim()];
    for (const [key, val] of Object.entries(HEADER_MAP)) {
      if (normalizeHeader(key) === normalized) return val;
    }
    return "_skip";
  });
}

// Extract embedded images from Excel using ExcelJS and map them to row/col positions
async function extractEmbeddedImages(fileBuffer: Buffer): Promise<Map<string, string>> {
  // Returns a map of "row:col" → S3 URL
  const imageMap = new Map<string, string>();
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(fileBuffer as any);
    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) return imageMap;

    const images = worksheet.getImages();
    if (!images || images.length === 0) return imageMap;

    // Process images in parallel (batch of 5)
    const BATCH_SIZE = 5;
    for (let i = 0; i < images.length; i += BATCH_SIZE) {
      const batch = images.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(async (img) => {
        try {
          const imageData = workbook.getImage(Number(img.imageId));
          if (!imageData || !imageData.buffer) return;

          const imgType = (imageData as any).type || "png";
          const ext = imgType === "jpeg" ? "jpg" : imgType;
          const mimeType = imgType === "jpeg" ? "image/jpeg" : `image/${imgType}`;
          const randomSuffix = crypto.randomBytes(6).toString("hex");
          const fileKey = `excel-import-images/${Date.now()}-${randomSuffix}.${ext}`;

          const { url } = await storagePut(fileKey, imageData.buffer as any, mimeType);

          // Get the anchor position (row, col) - ExcelJS uses tl (top-left) anchor
          const range = img.range;
          if (range && typeof range === "object" && "tl" in range) {
            const tl = (range as any).tl;
            const row = typeof tl.nativeRow === "number" ? tl.nativeRow : (typeof tl.row === "number" ? tl.row : -1);
            const col = typeof tl.nativeCol === "number" ? tl.nativeCol : (typeof tl.col === "number" ? tl.col : -1);
            if (row >= 0 && col >= 0) {
              // row is 0-based (row 0 = header), col is 0-based
              imageMap.set(`${row}:${col}`, url);
            }
          }
        } catch (e) {
          console.error("[Excel Import] Failed to extract image:", e);
        }
      }));
    }
  } catch (e) {
    console.error("[Excel Import] Failed to parse images with ExcelJS:", e);
  }
  return imageMap;
}

export function registerExcelImportRoute(app: Express) {
  // Preview endpoint: parse Excel and check match status without updating
  app.post("/api/excel-preview", upload.single("file"), async (req: Request, res: Response) => {
    try {
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

      const headerRow = rawData[0].map(String);
      const fieldMapping = mapHeaders(headerRow);

      const hasOrderNumber = fieldMapping.includes("orderNumber");
      const hasOriginalOrderNo = fieldMapping.includes("originalOrderNo");
      if (!hasOrderNumber && !hasOriginalOrderNo) {
        res.status(400).json({
          error: "Excel 文件必须包含「订单编号」或「原订单号」列（至少包含其中一个）",
          detectedHeaders: headerRow,
          mapping: fieldMapping,
        });
        return;
      }

      const dataRows = rawData.slice(1).filter((row) => row.some((cell) => String(cell).trim()));

      // Extract embedded images from Excel and upload to S3
      const orderImageColIdx = fieldMapping.indexOf("orderImageUrl");
      const paymentImageColIdx = fieldMapping.indexOf("paymentScreenshotUrl");
      let imageMap = new Map<string, string>();
      if (orderImageColIdx >= 0 || paymentImageColIdx >= 0) {
        imageMap = await extractEmbeddedImages(req.file.buffer as any);
      }

      // Track which data rows map to which raw row index (1-based, skipping header)
      let rawRowIdx = 0;
      const parsedRows: Record<string, string>[] = [];
      for (const row of dataRows) {
        rawRowIdx++; // 1-based index in rawData (after header)
        const obj: Record<string, string> = {};
        fieldMapping.forEach((field, idx) => {
          if (field !== "_skip" && row[idx] !== undefined) {
            let val = String(row[idx]).trim();
            val = cleanCellValue(val);
            if (val) obj[field] = val;
          }
        });

        // Inject embedded images if cell value is empty but image exists at that position
        if (orderImageColIdx >= 0 && !obj.orderImageUrl) {
          const imgUrl = imageMap.get(`${rawRowIdx}:${orderImageColIdx}`);
          if (imgUrl) obj.orderImageUrl = imgUrl;
        }
        if (paymentImageColIdx >= 0 && !obj.paymentScreenshotUrl) {
          const imgUrl = imageMap.get(`${rawRowIdx}:${paymentImageColIdx}`);
          if (imgUrl) obj.paymentScreenshotUrl = imgUrl;
        }

        if (obj.orderNumber || obj.originalOrderNo) {
          parsedRows.push(obj);
        }
      }

      if (parsedRows.length === 0) {
        res.status(400).json({ error: "没有找到有效的数据行（需要订单编号或原订单号）" });
        return;
      }

      // Collect identifiers
      const orderNumbers = Array.from(new Set(parsedRows.map((r) => r.orderNumber).filter(Boolean)));
      const originalOrderNos = Array.from(new Set(parsedRows.map((r) => r.originalOrderNo).filter(Boolean)));

      // Query existing items
      const [itemsByOrderNum, itemsByOrigNo] = await Promise.all([
        findOrderItemsByOrderNumbers(orderNumbers),
        findOrderItemsByOriginalOrderNos(originalOrderNos),
      ]);

      // Build lookup sets
      const matchedOrderNums = new Set(itemsByOrderNum.map((r) => r.item.orderNumber || ""));
      const matchedOrigNos = new Set(itemsByOrigNo.map((r) => r.item.originalOrderNo || ""));

      // Build preview rows with match status
      const previewRows = parsedRows.map((row) => {
        let matched = false;
        let matchType = "";
        if (row.orderNumber && matchedOrderNums.has(row.orderNumber)) {
          matched = true;
          matchType = "orderNumber";
        } else if (row.originalOrderNo && matchedOrigNos.has(row.originalOrderNo)) {
          matched = true;
          matchType = "originalOrderNo";
        }

        // Determine which fields will be updated
        const updatableFields: string[] = [];
        for (const [field, value] of Object.entries(row)) {
          if (!value) continue;
          if (UPDATABLE_ITEM_FIELDS.includes(field) || UPDATABLE_ORDER_FIELDS.includes(field)) {
            updatableFields.push(field);
          }
        }

        return {
          ...row,
          _matched: matched,
          _matchType: matchType,
          _updatableFields: updatableFields,
        };
      });

      const matchedCount = previewRows.filter((r) => r._matched).length;
      const unmatchedCount = previewRows.filter((r) => !r._matched).length;

      // Check if autoCreate mode is possible (need customerWhatsapp column)
      const hasCustomerWhatsapp = fieldMapping.includes("customerWhatsapp");

      res.json({
        success: true,
        totalRows: previewRows.length,
        matchedCount,
        unmatchedCount,
        rows: previewRows,
        detectedHeaders: headerRow,
        mapping: fieldMapping.map((f, i) => ({ header: headerRow[i], field: f })),
        canAutoCreate: hasCustomerWhatsapp,
      });
    } catch (err: any) {
      console.error("[Excel Preview] Error:", err);
      res.status(500).json({ error: err.message || "预览失败" });
    }
  });

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

      // Check required fields: must have orderNumber or originalOrderNo (at least one)
      const hasOrderNumber = fieldMapping.includes("orderNumber");
      const hasOriginalOrderNo = fieldMapping.includes("originalOrderNo");
      if (!hasOrderNumber && !hasOriginalOrderNo) {
        res.status(400).json({
          error: "Excel 文件必须包含「订单编号」或「原订单号」列（至少包含其中一个）",
          detectedHeaders: headerRow,
          mapping: fieldMapping,
        });
        return;
      }

      // Parse data rows
      const dataRows = rawData.slice(1).filter((row) => row.some((cell) => String(cell).trim()));

      // Extract embedded images from Excel and upload to S3
      const orderImageColIdx = fieldMapping.indexOf("orderImageUrl");
      const paymentImageColIdx = fieldMapping.indexOf("paymentScreenshotUrl");
      let imageMap = new Map<string, string>();
      if (orderImageColIdx >= 0 || paymentImageColIdx >= 0) {
        imageMap = await extractEmbeddedImages(req.file.buffer as any);
      }

      let rawRowIdx = 0;
      const parsedRows: Record<string, string>[] = [];
      for (const row of dataRows) {
        rawRowIdx++;
        const obj: Record<string, string> = {};
        fieldMapping.forEach((field, idx) => {
          if (field !== "_skip" && row[idx] !== undefined) {
            let val = String(row[idx]).trim();
            val = cleanCellValue(val);
            if (val) obj[field] = val;
          }
        });

        // Inject embedded images if cell value is empty but image exists at that position
        if (orderImageColIdx >= 0 && !obj.orderImageUrl) {
          const imgUrl = imageMap.get(`${rawRowIdx}:${orderImageColIdx}`);
          if (imgUrl) obj.orderImageUrl = imgUrl;
        }
        if (paymentImageColIdx >= 0 && !obj.paymentScreenshotUrl) {
          const imgUrl = imageMap.get(`${rawRowIdx}:${paymentImageColIdx}`);
          if (imgUrl) obj.paymentScreenshotUrl = imgUrl;
        }

        if (obj.orderNumber || obj.originalOrderNo) {
          parsedRows.push(obj);
        }
      }

      if (parsedRows.length === 0) {
        res.status(400).json({ error: "没有找到有效的数据行（需要订单编号或原订单号）" });
        return;
      }

      // ========== Match existing order items ==========
      // Collect all orderNumbers and originalOrderNos from parsed rows
      const orderNumbers = Array.from(new Set(parsedRows.map((r) => r.orderNumber).filter(Boolean)));
      const originalOrderNos = Array.from(new Set(parsedRows.map((r) => r.originalOrderNo).filter(Boolean)));

      // Query existing items by orderNumber and originalOrderNo
      const [itemsByOrderNum, itemsByOrigNo] = await Promise.all([
        findOrderItemsByOrderNumbers(orderNumbers),
        findOrderItemsByOriginalOrderNos(originalOrderNos),
      ]);

      // Build lookup maps: key → { itemId, orderId }
      // orderNumber → list of matching items
      const orderNumMap = new Map<string, { itemId: number; orderId: number }[]>();
      for (const row of itemsByOrderNum) {
        const key = row.item.orderNumber || "";
        if (!orderNumMap.has(key)) orderNumMap.set(key, []);
        orderNumMap.get(key)!.push({ itemId: row.item.id, orderId: row.item.orderId });
      }

      // originalOrderNo → list of matching items
      const origNoMap = new Map<string, { itemId: number; orderId: number }[]>();
      for (const row of itemsByOrigNo) {
        const key = row.item.originalOrderNo || "";
        if (!origNoMap.has(key)) origNoMap.set(key, []);
        origNoMap.get(key)!.push({ itemId: row.item.id, orderId: row.item.orderId });
      }

      // Check autoCreate mode from query parameter
      const autoCreate = req.query.autoCreate === "true" || req.body?.autoCreate === true;
      const hasCustomerWhatsapp = fieldMapping.includes("customerWhatsapp");

      // Process each row: match and update
      let updatedCount = 0;
      let skippedCount = 0;
      let createdCount = 0;
      const errors: string[] = [];
      const affectedOrderIds = new Set<number>();
      const updatedItems: { itemId: number; orderNumber: string; fieldsUpdated: string[] }[] = [];
      const createdOrders: { orderId: number; orderNumber: string }[] = [];

      // Group unmatched rows by orderNumber + customerWhatsapp for auto-create
      const unmatchedGroups = new Map<string, Record<string, string>[]>();

      for (const row of parsedRows) {
        try {
          // Try to match: first by orderNumber, then by originalOrderNo
          let matchedItems: { itemId: number; orderId: number }[] = [];

          if (row.orderNumber && orderNumMap.has(row.orderNumber)) {
            matchedItems = orderNumMap.get(row.orderNumber)!;
          } else if (row.originalOrderNo && origNoMap.has(row.originalOrderNo)) {
            matchedItems = origNoMap.get(row.originalOrderNo)!;
          }

          if (matchedItems.length === 0) {
            if (autoCreate && hasCustomerWhatsapp && row.customerWhatsapp && row.orderNumber) {
              // Collect unmatched rows for auto-create
              const groupKey = `${row.orderNumber}||${row.customerWhatsapp}`;
              if (!unmatchedGroups.has(groupKey)) unmatchedGroups.set(groupKey, []);
              unmatchedGroups.get(groupKey)!.push(row);
              continue;
            }
            skippedCount++;
            const identifier = row.orderNumber || row.originalOrderNo || "未知";
            errors.push(`未找到匹配的订单子项: ${identifier}`);
            continue;
          }

          // Build update data from the row (only non-empty updatable fields)
          const itemUpdateData: Record<string, any> = {};
          const orderUpdateData: Record<string, any> = {};

          for (const [field, value] of Object.entries(row)) {
            if (!value) continue;
            if (UPDATABLE_ITEM_FIELDS.includes(field)) {
              // Handle numeric fields
              if (["quantity"].includes(field)) {
                const parsed = parseInt(value);
                if (!isNaN(parsed)) itemUpdateData[field] = parsed;
              } else if (["amountUsd", "amountCny", "sellingPrice", "productCost", "shippingCharged", "shippingActual"].includes(field)) {
                const parsed = parseFloat(value);
                if (!isNaN(parsed)) itemUpdateData[field] = parsed.toFixed(2);
              } else {
                itemUpdateData[field] = value;
              }
            }
            if (UPDATABLE_ORDER_FIELDS.includes(field)) {
              orderUpdateData[field] = value;
            }
          }

          // Recalculate profit fields if financial data changed
          if (itemUpdateData.sellingPrice !== undefined || itemUpdateData.productCost !== undefined ||
              itemUpdateData.amountCny !== undefined || itemUpdateData.shippingActual !== undefined ||
              itemUpdateData.amountUsd !== undefined || itemUpdateData.shippingCharged !== undefined) {
            const sp = parseFloat(itemUpdateData.sellingPrice || row.sellingPrice || "0");
            const pc = parseFloat(itemUpdateData.productCost || row.productCost || "0");
            const productProfit = sp - pc;
            const productProfitRate = sp > 0 ? productProfit / sp : 0;

            const sc = parseFloat(itemUpdateData.shippingCharged || row.shippingCharged || "0");
            const sa = parseFloat(itemUpdateData.shippingActual || row.shippingActual || "0");
            const shippingProfit = sc - sa;
            const shippingProfitRate = sc > 0 ? shippingProfit / sc : 0;

            const totalProfit = productProfit + shippingProfit;
            const aCny = parseFloat(itemUpdateData.amountCny || row.amountCny || "0");
            const profitRate = aCny > 0 ? totalProfit / aCny : 0;

            itemUpdateData.productProfit = productProfit.toFixed(2);
            itemUpdateData.productProfitRate = productProfitRate.toFixed(6);
            itemUpdateData.shippingProfit = shippingProfit.toFixed(2);
            itemUpdateData.shippingProfitRate = shippingProfitRate.toFixed(6);
            itemUpdateData.totalProfit = totalProfit.toFixed(2);
            itemUpdateData.profitRate = profitRate.toFixed(6);
          }

          const fieldsUpdated = Object.keys(itemUpdateData);

          if (fieldsUpdated.length === 0 && Object.keys(orderUpdateData).length === 0) {
            skippedCount++;
            continue;
          }

          // Update all matched items
          for (const matched of matchedItems) {
            if (fieldsUpdated.length > 0) {
              await updateOrderItem(matched.itemId, itemUpdateData);
            }
            affectedOrderIds.add(matched.orderId);

            // Update order-level fields if present
            if (Object.keys(orderUpdateData).length > 0) {
              await updateOrder(matched.orderId, orderUpdateData);
            }
          }

          updatedCount++;
          updatedItems.push({
            itemId: matchedItems[0].itemId,
            orderNumber: row.orderNumber || row.originalOrderNo || "",
            fieldsUpdated,
          });
        } catch (err: any) {
          const identifier = row.orderNumber || row.originalOrderNo || "未知";
          errors.push(`更新 ${identifier} 失败: ${err.message}`);
        }
      }

      // Recalculate totals for all affected orders
      for (const orderId of Array.from(affectedOrderIds)) {
        await recalculateOrderTotals(orderId);
      }

      // ========== Auto-create new orders for unmatched rows ==========
      if (autoCreate && unmatchedGroups.size > 0) {
        const currentRate = await getCurrentExchangeRate();
        const exchangeRateVal = parseFloat(String(currentRate.rate));

        for (const [, groupRows] of Array.from(unmatchedGroups)) {
          try {
            const first = groupRows[0];

            // Auto-create customer if not exists
            let existingCustomer = await getCustomerByWhatsapp(first.customerWhatsapp!);
            let customerId: number;
            if (!existingCustomer) {
              customerId = await createCustomer({
                whatsapp: first.customerWhatsapp!,
                customerType: first.customerType || "新零售",
                createdById: user.id,
              });
            } else {
              customerId = existingCustomer.id;
            }

            // Parse and validate order date
            const parsedDate = parseExcelDate(first.orderDate);

            // Create order
            const orderId = await createOrder({
              orderDate: parsedDate ? formatDateForDb(parsedDate) as any : null,
              account: first.account || user.name || "默认账号",
              customerWhatsapp: first.customerWhatsapp!,
              customerId,
              customerType: first.customerType || "新零售",
              orderNumber: first.orderNumber!,
              orderStatus: first.orderStatus || "已报货，待发货",
              paymentStatus: first.paymentStatus || "未付款",
              remarks: first.remarks || undefined,
              staffId: user.id,
              staffName: user.name || "未知客服",
            });

            // Create order items for each row in the group
            for (const row of groupRows) {
              const amountUsd = parseFloat(row.amountUsd || "0");
              const amountCny = row.amountCny ? parseFloat(row.amountCny) : amountUsd * exchangeRateVal;
              const sellingPrice = parseFloat(row.sellingPrice || "0");
              const productCost = parseFloat(row.productCost || "0");
              const productProfit = sellingPrice - productCost;
              const productProfitRate = sellingPrice > 0 ? productProfit / sellingPrice : 0;
              const shippingCharged = parseFloat(row.shippingCharged || "0") || (amountCny - sellingPrice);
              const shippingActual = parseFloat(row.shippingActual || "0");
              const shippingProfit = shippingCharged - shippingActual;
              const shippingProfitRate = shippingCharged > 0 ? shippingProfit / shippingCharged : 0;
              const totalProfit = productProfit + shippingProfit;
              const profitRate = amountCny > 0 ? totalProfit / amountCny : 0;

              const itemId = await createOrderItem({
                orderId,
                orderNumber: row.orderNumber!,
                size: row.size || undefined,
                domesticTrackingNo: row.domesticTrackingNo || undefined,
                sizeRecommendation: row.sizeRecommendation || undefined,
                contactInfo: row.contactInfo || undefined,
                internationalTrackingNo: row.internationalTrackingNo || undefined,
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
                originalOrderNo: row.originalOrderNo || undefined,
                orderImageUrl: row.orderImageUrl || undefined,
                paymentScreenshotUrl: row.paymentScreenshotUrl || undefined,
              });

              // Auto-subscribe domestic tracking if present
              if (row.domesticTrackingNo) {
                try {
                  const callbackUrl = getCallbackUrl(req);
                  await subscribeTrackingNo(itemId, row.domesticTrackingNo, callbackUrl);
                } catch { /* ignore subscription errors */ }
              }
            }

            await recalculateOrderTotals(orderId);
            createdOrders.push({ orderId, orderNumber: first.orderNumber! });
            createdCount++;
          } catch (err: any) {
            const identifier = groupRows[0].orderNumber || "未知";
            errors.push(`创建订单 ${identifier} 失败: ${err.message}`);
          }
        }
      }

      // Log the import action
      await createAuditLog({
        userId: user.id,
        userName: user.name || "未知",
        userRole: user.role,
        action: "import",
        targetType: "order",
        targetName: `Excel导入: 更新${updatedCount}条, 新建${createdCount}个订单`,
        details: JSON.stringify({
          updated: updatedCount,
          created: createdCount,
          skipped: skippedCount,
          errors: errors.length,
          affectedOrders: Array.from(affectedOrderIds),
          createdOrders: createdOrders.map(o => o.orderNumber),
        }),
      });

      res.json({
        success: true,
        updated: updatedCount,
        created: createdCount,
        skipped: skippedCount,
        totalRows: parsedRows.length,
        updatedItems,
        createdOrders,
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
