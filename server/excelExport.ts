import { Express, Request, Response } from "express";
import ExcelJS from "exceljs";
import { exportOrders } from "./db";

// Fetch image as buffer with timeout
async function fetchImageBuffer(url: string): Promise<{ buffer: any; ext: string } | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") || "";
    let ext: "png" | "jpeg" | "gif" = "png";
    if (contentType.includes("jpeg") || contentType.includes("jpg")) ext = "jpeg";
    else if (contentType.includes("gif")) ext = "gif";
    const arrayBuf = await res.arrayBuffer();
    return { buffer: Buffer.from(arrayBuf) as any, ext };
  } catch {
    return null;
  }
}

export function registerExcelExportRoute(app: Express) {
  app.post("/api/excel-export", async (req: Request, res: Response) => {
    try {
      const { filters, userId, userRole } = req.body;
      if (!userId) {
        return res.status(401).json({ error: "未登录" });
      }

      const isAdmin = userRole === "admin";
      const data = await exportOrders({
        ...filters,
        staffId: isAdmin ? undefined : userId,
      });

      if (!data || data.length === 0) {
        return res.status(404).json({ error: "没有可导出的订单数据" });
      }

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("订单数据");

      // Define headers
      const headers = [
        "日期", "客服名字", "账号", "客户WhatsApp", "客户属性", "订单编号",
        "订单图片", "Size", "国内单号", "推荐码数", "联系方式",
        "国际跟踪单号", "原订单号", "发出日期", "件数", "货源", "订单状态",
        "总金额$", "总金额￥", "售价", "产品成本", "产品毛利润", "产品毛利率",
        "收取运费", "实际运费", "运费利润", "运费利润率", "总利润", "利润率",
        "备注", "付款状态", "付款截图"
      ];

      // Add header row
      const headerRow = worksheet.addRow(headers);
      headerRow.font = { bold: true, size: 11 };
      headerRow.alignment = { horizontal: "center", vertical: "middle" };
      headerRow.height = 25;

      // Set column widths
      const colWidths = [
        12, 10, 12, 16, 10, 14,
        14, 8, 18, 8, 20,
        20, 16, 12, 6, 8, 16,
        10, 10, 10, 10, 10, 10,
        10, 10, 10, 10, 10, 10,
        20, 10, 14
      ];
      worksheet.columns = headers.map((_, i) => ({ width: colWidths[i] || 12 }));

      // Image column indices (1-based): 订单图片=7, 付款截图=32
      const IMAGE_COL = 7;
      const PAYMENT_COL = 32;
      const IMAGE_ROW_HEIGHT = 60; // pixels

      // Collect all image URLs to fetch
      interface RowImageInfo {
        rowIndex: number;
        orderImageUrl?: string;
        paymentScreenshotUrl?: string;
      }
      const rowImages: RowImageInfo[] = [];

      // Build data rows
      let currentRow = 2; // row 1 is header
      for (const order of data as any[]) {
        const items = (order.items && order.items.length > 0) ? order.items : [{}];
        for (const item of items) {
          const fmtNum = (v: any) => v ? parseFloat(v) : "";
          const fmtPct = (v: any) => {
            if (!v) return "";
            const n = parseFloat(v);
            return isNaN(n) ? "" : (n * 100).toFixed(2) + "%";
          };

          const rowData = [
            order.orderDate ? new Date(order.orderDate).toLocaleDateString("zh-CN") : "",
            order.staffName || "",
            order.account || "",
            order.customerWhatsapp || "",
            order.customerType || "",
            item.orderNumber || order.orderNumber || "",
            "", // placeholder for image
            item.size || "",
            item.domesticTrackingNo || "",
            item.sizeRecommendation || "",
            item.contactInfo || "",
            item.internationalTrackingNo || "",
            item.originalOrderNo || "",
            item.shipDate || "",
            item.quantity || "",
            item.source || "",
            item.itemStatus || order.orderStatus || "",
            fmtNum(item.amountUsd),
            fmtNum(item.amountCny),
            fmtNum(item.sellingPrice),
            fmtNum(item.productCost),
            fmtNum(item.productProfit),
            fmtPct(item.productProfitRate),
            fmtNum(item.shippingCharged),
            fmtNum(item.shippingActual),
            fmtNum(item.shippingProfit),
            fmtPct(item.shippingProfitRate),
            fmtNum(item.totalProfit),
            fmtPct(item.profitRate),
            item.remarks || order.remarks || "",
            item.paymentStatus || order.paymentStatus || "",
            "", // placeholder for payment screenshot
          ];

          const row = worksheet.addRow(rowData);
          row.alignment = { horizontal: "center", vertical: "middle" };

          if (item.orderImageUrl || item.paymentScreenshotUrl) {
            rowImages.push({
              rowIndex: currentRow,
              orderImageUrl: item.orderImageUrl || undefined,
              paymentScreenshotUrl: item.paymentScreenshotUrl || undefined,
            });
          }
          currentRow++;
        }
      }

      // Fetch and embed images (batch with concurrency limit)
      const CONCURRENCY = 10;
      const imageQueue = [...rowImages];
      
      const processImageBatch = async (batch: RowImageInfo[]) => {
        await Promise.all(batch.map(async (info) => {
          // Order image
          if (info.orderImageUrl) {
            const img = await fetchImageBuffer(info.orderImageUrl);
            if (img) {
              const imageId = workbook.addImage({
                buffer: img.buffer,
                extension: img.ext as "png" | "jpeg" | "gif",
              });
              worksheet.addImage(imageId, {
                tl: { col: IMAGE_COL - 1, row: info.rowIndex - 1 } as any,
                ext: { width: 80, height: 55 },
              });
              // Set row height for image
              const row = worksheet.getRow(info.rowIndex);
              row.height = IMAGE_ROW_HEIGHT;
            }
          }
          // Payment screenshot
          if (info.paymentScreenshotUrl) {
            const img = await fetchImageBuffer(info.paymentScreenshotUrl);
            if (img) {
              const imageId = workbook.addImage({
                buffer: img.buffer,
                extension: img.ext as "png" | "jpeg" | "gif",
              });
              worksheet.addImage(imageId, {
                tl: { col: PAYMENT_COL - 1, row: info.rowIndex - 1 } as any,
                ext: { width: 80, height: 55 },
              });
              const row = worksheet.getRow(info.rowIndex);
              row.height = IMAGE_ROW_HEIGHT;
            }
          }
        }));
      }

      // Process in batches
      for (let i = 0; i < imageQueue.length; i += CONCURRENCY) {
        const batch = imageQueue.slice(i, i + CONCURRENCY);
        await processImageBatch(batch);
      }

      // Generate buffer and send
      const buffer = await workbook.xlsx.writeBuffer();
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename=orders_export_${new Date().toISOString().split("T")[0]}.xlsx`);
      res.send(buffer);
    } catch (err: any) {
      console.error("Excel export error:", err);
      res.status(500).json({ error: err.message || "导出失败" });
    }
  });
}
