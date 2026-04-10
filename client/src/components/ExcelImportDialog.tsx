import { useState, useCallback, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Upload,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ArrowRight,
  Package,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

interface ExcelImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

// The fields we display in the preview
const PREVIEW_FIELDS = [
  { key: "orderDate", label: "日期" },
  { key: "account", label: "账号" },
  { key: "customerWhatsapp", label: "客户WhatsApp" },
  { key: "customerType", label: "客户属性" },
  { key: "orderNumber", label: "订单编号" },
  { key: "size", label: "Size" },
  { key: "domesticTrackingNo", label: "国内单号" },
  { key: "internationalTrackingNo", label: "国际跟踪单号" },
  { key: "originalOrderNo", label: "原订单号" },
  { key: "source", label: "货源" },
  { key: "amountUsd", label: "总金额$" },
  { key: "sellingPrice", label: "售价" },
  { key: "productCost", label: "产品成本" },
  { key: "shippingActual", label: "实际运费" },
  { key: "remarks", label: "备注" },
  { key: "paymentStatus", label: "付款状态" },
];

type ImportResult = {
  success: boolean;
  imported: number;
  totalRows: number;
  orders: { orderId: number; orderNumber: string }[];
  errors?: string[];
  detectedHeaders: string[];
  mapping: { header: string; field: string }[];
};

export default function ExcelImportDialog({ open, onOpenChange, onSuccess }: ExcelImportDialogProps) {
  const [step, setStep] = useState<"upload" | "preview" | "result">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [previewData, setPreviewData] = useState<Record<string, string>[]>([]);
  const [mappingInfo, setMappingInfo] = useState<{ header: string; field: string }[]>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();

  const handleClose = useCallback(() => {
    setStep("upload");
    setFile(null);
    setPreviewData([]);
    setMappingInfo([]);
    setImportResult(null);
    setImporting(false);
    onOpenChange(false);
  }, [onOpenChange]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    // Validate file type
    const validTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "text/csv",
    ];
    const validExtensions = [".xlsx", ".xls", ".csv"];
    const ext = selected.name.toLowerCase().substring(selected.name.lastIndexOf("."));

    if (!validTypes.includes(selected.type) && !validExtensions.includes(ext)) {
      toast.error("请上传 Excel 文件（.xlsx, .xls）或 CSV 文件");
      return;
    }

    if (selected.size > 10 * 1024 * 1024) {
      toast.error("文件大小不能超过 10MB");
      return;
    }

    setFile(selected);
  }, []);

  // Parse file client-side for preview using xlsx
  const handlePreview = useCallback(async () => {
    if (!file) {
      toast.error("请先选择文件");
      return;
    }

    try {
      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        toast.error("Excel 文件中没有工作表");
        return;
      }

      const sheet = workbook.Sheets[sheetName];
      const rawData: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

      if (rawData.length < 2) {
        toast.error("Excel 文件至少需要包含表头行和一行数据");
        return;
      }

      const headerRow = rawData[0].map(String);
      const dataRows = rawData.slice(1).filter((row) => row.some((cell) => String(cell).trim()));

      // Simple client-side header mapping for preview
      const HEADER_MAP: Record<string, string> = {
        "日期": "orderDate", "订单日期": "orderDate",
        "账号": "account",
        "客户whatsapp": "customerWhatsapp", "whatsapp": "customerWhatsapp",
        "客户属性": "customerType",
        "订单编号": "orderNumber", "订单号": "orderNumber",
        "size": "size", "尺码": "size",
        "国内单号": "domesticTrackingNo",
        "推荐码数": "sizeRecommendation",
        "联系方式": "contactInfo",
        "国际跟踪单号": "internationalTrackingNo", "国际单号": "internationalTrackingNo",
        "原订单号": "originalOrderNo", "原单号": "originalOrderNo",
        "发出日期": "shipDate",
        "件数": "quantity", "数量": "quantity",
        "货源": "source",
        "订单状态": "orderStatus",
        "总金额$": "amountUsd",
        "售价": "sellingPrice",
        "产品成本": "productCost", "成本": "productCost",
        "实际运费": "shippingActual",
        "备注": "remarks",
        "付款状态": "paymentStatus",
      };

      const fieldMapping = headerRow.map((h) => {
        const normalized = h.trim().toLowerCase();
        for (const [key, val] of Object.entries(HEADER_MAP)) {
          if (key.toLowerCase() === normalized || key === h.trim()) return val;
        }
        return "_skip";
      });

      const mapping = headerRow.map((h, i) => ({ header: h, field: fieldMapping[i] }));
      setMappingInfo(mapping);

      // Parse rows
      const parsed = dataRows.map((row) => {
        const obj: Record<string, string> = {};
        fieldMapping.forEach((field, idx) => {
          if (field !== "_skip" && row[idx] !== undefined) {
            const val = String(row[idx]).trim();
            if (val) obj[field] = val;
          }
        });
        return obj;
      }).filter((row) => row.orderNumber || row.originalOrderNo);

      if (parsed.length === 0) {
        toast.error("没有找到有效的数据行（需要订单编号或原订单号）");
        return;
      }

      setPreviewData(parsed);
      setStep("preview");
    } catch (err: any) {
      toast.error("解析文件失败: " + (err.message || "未知错误"));
    }
  }, [file]);

  // Upload file to server for actual import
  const handleImport = useCallback(async () => {
    if (!file) return;

    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/excel-import", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || "导入失败");
        setImporting(false);
        return;
      }

      setImportResult(result);
      setStep("result");
      toast.success(`成功导入 ${result.imported} 个订单`);
      utils.orders.list.invalidate();
      utils.stats.overview.invalidate();
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || "导入失败");
    } finally {
      setImporting(false);
    }
  }, [file, utils, onSuccess]);

  // Download template
  const handleDownloadTemplate = useCallback(async () => {
    try {
      const XLSX = await import("xlsx");
      const headers = [
        "日期", "账号", "客户WhatsApp", "客户属性", "订单编号",
        "Size", "国内单号", "推荐码数", "联系方式", "国际跟踪单号",
        "原订单号", "发出日期", "件数", "货源", "订单状态",
        "总金额$", "售价", "产品成本", "实际运费", "备注", "付款状态",
      ];
      const ws = XLSX.utils.aoa_to_sheet([headers]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "订单导入模板");

      // Set column widths
      ws["!cols"] = headers.map(() => ({ wch: 15 }));

      XLSX.writeFile(wb, "订单导入模板.xlsx");
      toast.success("模板已下载");
    } catch {
      toast.error("下载模板失败");
    }
  }, []);

  const uniqueOrders = new Set(previewData.map((r) => `${r.orderNumber || r.originalOrderNo || ""}||${r.customerWhatsapp || ""}`)).size;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else onOpenChange(v); }}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            导入 Excel 订单
          </DialogTitle>
          <DialogDescription>
            上传 Excel 文件（.xlsx, .xls）或 CSV 文件，系统将自动识别列名并批量导入订单
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
          <Badge variant={step === "upload" ? "default" : "secondary"} className="text-[10px]">1. 上传文件</Badge>
          <ArrowRight className="h-3 w-3" />
          <Badge variant={step === "preview" ? "default" : "secondary"} className="text-[10px]">2. 预览数据</Badge>
          <ArrowRight className="h-3 w-3" />
          <Badge variant={step === "result" ? "default" : "secondary"} className="text-[10px]">3. 导入结果</Badge>
        </div>

        {/* Step 1: Upload */}
        {step === "upload" && (
          <div className="flex-1 flex flex-col gap-4 min-h-0">
            <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 text-sm">
              <AlertCircle className="h-4 w-4 mt-0.5 text-amber-500 shrink-0" />
              <div>
                <p className="font-medium">使用方法</p>
                <p className="text-muted-foreground mt-1">
                  1. 准备包含订单数据的 Excel 文件（第一行为表头）<br />
                  2. 必须包含「订单编号」或「原订单号」列（至少包含其中一个）<br />
                  3. 系统会自动识别列名并映射到对应字段<br />
                  4. 不确定格式？可以先下载模板填写
                </p>
              </div>
            </div>

            {/* File drop zone */}
            <div
              className="flex-1 min-h-[180px] flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/30 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileSelect}
                className="hidden"
              />
              {file ? (
                <div className="text-center">
                  <FileSpreadsheet className="h-12 w-12 text-emerald-500 mx-auto mb-2" />
                  <p className="text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {(file.size / 1024).toFixed(1)} KB · 点击更换文件
                  </p>
                </div>
              ) : (
                <div className="text-center">
                  <Upload className="h-10 w-10 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">点击选择文件或拖拽文件到此处</p>
                  <p className="text-xs text-muted-foreground mt-1">支持 .xlsx, .xls, .csv 格式，最大 10MB</p>
                </div>
              )}
            </div>

            {/* Download template button */}
            <Button variant="outline" size="sm" onClick={handleDownloadTemplate} className="gap-2 self-start">
              <Download className="h-4 w-4" />
              下载导入模板
            </Button>
          </div>
        )}

        {/* Step 2: Preview */}
        {step === "preview" && (
          <div className="flex-1 flex flex-col gap-3 min-h-0">
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span>将导入 <span className="font-bold text-emerald-600">{uniqueOrders}</span> 个订单</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Package className="h-4 w-4 text-blue-500" />
                <span>共 <span className="font-bold text-blue-600">{previewData.length}</span> 条子项</span>
              </div>
            </div>

            {/* Mapping info */}
            {mappingInfo.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {mappingInfo.filter((m) => m.field !== "_skip").map((m, i) => (
                  <Badge key={i} variant="outline" className="text-[10px] gap-1">
                    {m.header} → {PREVIEW_FIELDS.find((f) => f.key === m.field)?.label || m.field}
                  </Badge>
                ))}
              </div>
            )}

            <ScrollArea className="flex-1 border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">#</TableHead>
                    {PREVIEW_FIELDS.filter((f) => previewData.some((row) => row[f.key])).map((f) => (
                      <TableHead key={f.key} className="text-xs whitespace-nowrap">{f.label}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewData.slice(0, 50).map((row, rowIdx) => (
                    <TableRow key={rowIdx}>
                      <TableCell className="text-xs text-muted-foreground">{rowIdx + 1}</TableCell>
                      {PREVIEW_FIELDS.filter((f) => previewData.some((r) => r[f.key])).map((f) => (
                        <TableCell key={f.key} className="text-xs max-w-[150px] truncate">
                          {row[f.key] || "-"}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {previewData.length > 50 && (
                <p className="text-xs text-muted-foreground text-center py-2">
                  仅显示前 50 行，共 {previewData.length} 行
                </p>
              )}
            </ScrollArea>
          </div>
        )}

        {/* Step 3: Result */}
        {step === "result" && importResult && (
          <div className="flex-1 flex flex-col gap-4 min-h-0 items-center justify-center">
            <CheckCircle2 className="h-16 w-16 text-emerald-500" />
            <div className="text-center">
              <p className="text-lg font-semibold">导入完成</p>
              <p className="text-sm text-muted-foreground mt-1">
                成功导入 <span className="font-bold text-emerald-600">{importResult.imported}</span> 个订单，
                共 <span className="font-bold text-blue-600">{importResult.totalRows}</span> 条数据行
              </p>
            </div>
            {importResult.errors && importResult.errors.length > 0 && (
              <div className="w-full p-3 rounded-lg bg-red-50 border border-red-200">
                <p className="text-sm font-medium text-red-700 mb-1">部分数据导入失败：</p>
                <ul className="text-xs text-red-600 space-y-0.5">
                  {importResult.errors.map((err, i) => (
                    <li key={i}>• {err}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {step === "upload" && (
            <>
              <Button variant="outline" onClick={handleClose}>取消</Button>
              <Button onClick={handlePreview} disabled={!file} className="gap-2">
                <ArrowRight className="h-4 w-4" />
                预览数据
              </Button>
            </>
          )}
          {step === "preview" && (
            <>
              <Button variant="outline" onClick={() => setStep("upload")}>上一步</Button>
              <Button onClick={handleImport} disabled={importing} className="gap-2">
                {importing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    导入中...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    确认导入 {uniqueOrders} 个订单
                  </>
                )}
              </Button>
            </>
          )}
          {step === "result" && (
            <Button onClick={handleClose} className="gap-2">
              <CheckCircle2 className="h-4 w-4" />
              完成
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
