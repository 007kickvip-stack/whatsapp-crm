import { useState, useRef, useCallback, useEffect, useMemo } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Upload,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ArrowRight,
  Download,
  RefreshCw,
  XCircle,
  PlusCircle,
  ImageIcon,
  ChevronDown,
  ChevronUp,
  Eye,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

interface ExcelImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

// System fields available for mapping
const MAPPABLE_FIELDS = [
  { key: "_skip", label: "跳过此列", group: "other" },
  { key: "orderDate", label: "日期", group: "order" },
  { key: "account", label: "账号", group: "order" },
  { key: "customerWhatsapp", label: "客户WhatsApp", group: "order" },
  { key: "customerType", label: "客户属性", group: "order" },
  { key: "orderNumber", label: "订单编号", group: "order" },
  { key: "originalOrderNo", label: "原订单号", group: "order" },
  { key: "orderStatus", label: "订单状态", group: "order" },
  { key: "paymentStatus", label: "付款状态", group: "order" },
  { key: "remarks", label: "备注", group: "order" },
  { key: "size", label: "Size/尺码", group: "item" },
  { key: "domesticTrackingNo", label: "国内单号", group: "item" },
  { key: "sizeRecommendation", label: "推荐码数", group: "item" },
  { key: "contactInfo", label: "联系方式", group: "item" },
  { key: "internationalTrackingNo", label: "国际跟踪单号", group: "item" },
  { key: "shipDate", label: "发出日期", group: "item" },
  { key: "quantity", label: "件数", group: "item" },
  { key: "source", label: "货源", group: "item" },
  { key: "amountUsd", label: "总金额$", group: "finance" },
  { key: "amountCny", label: "总金额¥", group: "finance" },
  { key: "sellingPrice", label: "售价", group: "finance" },
  { key: "productCost", label: "产品成本", group: "finance" },
  { key: "shippingCharged", label: "收取运费", group: "finance" },
  { key: "shippingActual", label: "实际运费", group: "finance" },
  { key: "orderImageUrl", label: "订单图片", group: "media" },
  { key: "paymentScreenshotUrl", label: "付款截图", group: "media" },
] as const;

const FIELD_LABEL_MAP = Object.fromEntries(MAPPABLE_FIELDS.map((f) => [f.key, f.label]));

// Preview display fields
const PREVIEW_FIELDS = [
  { key: "orderNumber", label: "订单编号" },
  { key: "originalOrderNo", label: "原订单号" },
  { key: "customerWhatsapp", label: "WhatsApp" },
  { key: "size", label: "Size" },
  { key: "domesticTrackingNo", label: "国内单号" },
  { key: "internationalTrackingNo", label: "国际跟踪单号" },
  { key: "source", label: "货源" },
  { key: "shipDate", label: "发出日期" },
  { key: "amountUsd", label: "总金额$" },
  { key: "sellingPrice", label: "售价" },
  { key: "productCost", label: "产品成本" },
  { key: "shippingActual", label: "实际运费" },
  { key: "orderStatus", label: "订单状态" },
  { key: "paymentStatus", label: "付款状态" },
  { key: "remarks", label: "备注" },
  { key: "orderImageUrl", label: "订单图片" },
  { key: "paymentScreenshotUrl", label: "付款截图" },
];

type PreviewRow = Record<string, string> & {
  _matched: boolean;
  _matchType: string;
  _updatableFields: string[];
};

type PreviewResult = {
  success: boolean;
  totalRows: number;
  matchedCount: number;
  unmatchedCount: number;
  rows: PreviewRow[];
  detectedHeaders: string[];
  mapping: { header: string; field: string }[];
  canAutoCreate?: boolean;
};

type UpdateResult = {
  success: boolean;
  updated: number;
  created?: number;
  skipped: number;
  totalRows: number;
  updatedItems: { itemId: number; orderNumber: string; fieldsUpdated: string[] }[];
  createdOrders?: { orderId: number; orderNumber: string }[];
  errors?: string[];
  detectedHeaders: string[];
  mapping: { header: string; field: string }[];
};

type HeadersResult = {
  success: boolean;
  headers: string[];
  autoMapping: string[];
  sampleData: string[][];
  totalRows: number;
};

export default function ExcelImportDialog({ open, onOpenChange, onSuccess }: ExcelImportDialogProps) {
  const [step, setStep] = useState<"upload" | "preview" | "result">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null);
  const [importResult, setImportResult] = useState<UpdateResult | null>(null);
  const [autoCreate, setAutoCreate] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();

  // Field mapping state
  const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<string[]>([]);
  const [sampleData, setSampleData] = useState<string[][]>([]);
  const [totalDataRows, setTotalDataRows] = useState(0);
  const [showMapping, setShowMapping] = useState(false);
  const [parsing, setParsing] = useState(false);

  const handleClose = useCallback(() => {
    setStep("upload");
    setFile(null);
    setPreviewResult(null);
    setImportResult(null);
    setImporting(false);
    setPreviewing(false);
    setParsing(false);
    setAutoCreate(false);
    setExcelHeaders([]);
    setColumnMapping([]);
    setSampleData([]);
    setTotalDataRows(0);
    setShowMapping(false);
    onOpenChange(false);
  }, [onOpenChange]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

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
    // Reset states when new file is selected
    setExcelHeaders([]);
    setColumnMapping([]);
    setSampleData([]);
    setTotalDataRows(0);
    setShowMapping(false);
    setPreviewResult(null);
  }, []);

  // Auto-parse headers when file is selected
  useEffect(() => {
    if (!file || excelHeaders.length > 0) return;
    let cancelled = false;

    const parseHeaders = async () => {
      setParsing(true);
      try {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/api/excel-headers", {
          method: "POST",
          body: formData,
        });

        const result: HeadersResult = await response.json();

        if (!response.ok) {
          toast.error((result as any).error || "解析失败");
          return;
        }

        if (!cancelled) {
          setExcelHeaders(result.headers);
          setColumnMapping(result.autoMapping);
          setSampleData(result.sampleData);
          setTotalDataRows(result.totalRows);
        }
      } catch (err: any) {
        if (!cancelled) toast.error(err.message || "解析失败");
      } finally {
        if (!cancelled) setParsing(false);
      }
    };

    parseHeaders();
    return () => { cancelled = true; };
  }, [file]);

  // Mapping stats
  const mappedCount = columnMapping.filter((m) => m !== "_skip").length;
  const hasRequiredMapping = columnMapping.includes("orderNumber") || columnMapping.includes("originalOrderNo");
  const hasImageMapping = columnMapping.includes("orderImageUrl") || columnMapping.includes("paymentScreenshotUrl");

  // Preview with custom mapping
  const handlePreview = useCallback(async () => {
    if (!file) return;

    if (!hasRequiredMapping) {
      toast.error("必须映射「订单编号」或「原订单号」列（至少映射其中一个）");
      return;
    }

    setPreviewing(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("customMapping", JSON.stringify(columnMapping));

      const response = await fetch("/api/excel-preview", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || "预览失败");
        setPreviewing(false);
        return;
      }

      setPreviewResult(result);
      setStep("preview");
    } catch (err: any) {
      toast.error(err.message || "预览失败");
    } finally {
      setPreviewing(false);
    }
  }, [file, columnMapping, hasRequiredMapping]);

  // Import with custom mapping
  const handleImport = useCallback(async () => {
    if (!file) return;

    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("customMapping", JSON.stringify(columnMapping));

      let url = "/api/excel-import";
      if (autoCreate) url += "?autoCreate=true";

      const response = await fetch(url, {
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

      const messages: string[] = [];
      if (result.updated > 0) messages.push(`更新 ${result.updated} 条`);
      if (result.created > 0) messages.push(`新建 ${result.created} 个订单`);
      if (messages.length > 0) {
        toast.success(`成功${messages.join("，")}`);
      } else {
        toast.warning("没有匹配到已有订单，也没有新建订单");
      }
      utils.orders.list.invalidate();
      utils.stats.overview.invalidate();
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || "导入失败");
    } finally {
      setImporting(false);
    }
  }, [file, autoCreate, columnMapping, utils, onSuccess]);

  // Download template
  const handleDownloadTemplate = useCallback(async () => {
    try {
      const res = await fetch("/api/excel-template");
      if (!res.ok) throw new Error("下载失败");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "订单导入模板.xlsx";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("模板已下载");
    } catch {
      toast.error("下载模板失败");
    }
  }, []);

  const previewRows = previewResult?.rows || [];
  const matchedCount = previewResult?.matchedCount || 0;
  const unmatchedCount = previewResult?.unmatchedCount || 0;
  const totalRows = previewResult?.totalRows || 0;
  const canAutoCreate = previewResult?.canAutoCreate || false;
  const visibleFields = PREVIEW_FIELDS.filter((f) => previewRows.some((row) => row[f.key]));

  const autoCreateableCount = autoCreate
    ? previewRows.filter((r) => !r._matched && r.customerWhatsapp && r.orderNumber).length
    : 0;

  const actionableCount = matchedCount + (autoCreate ? autoCreateableCount : 0);

  // Count image fields in preview
  const imageCount = useMemo(() => {
    if (!previewRows.length) return 0;
    return previewRows.filter((r) => r.orderImageUrl || r.paymentScreenshotUrl).length;
  }, [previewRows]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else onOpenChange(v); }}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="pb-0">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
            导入 Excel
          </DialogTitle>
          <DialogDescription className="text-xs">
            上传 Excel 文件，系统自动识别列名并映射字段，预览确认后导入
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator - compact */}
        <div className="flex items-center gap-1.5 text-[11px] px-1">
          <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${step === "upload" ? "bg-emerald-100 text-emerald-700 font-medium" : "text-muted-foreground"}`}>
            <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${step === "upload" ? "bg-emerald-600 text-white" : "bg-emerald-600 text-white"}`}>
              {step === "preview" || step === "result" ? "✓" : "1"}
            </span>
            上传 & 映射
          </div>
          <ArrowRight className="h-3 w-3 text-muted-foreground" />
          <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${step === "preview" ? "bg-emerald-100 text-emerald-700 font-medium" : "text-muted-foreground"}`}>
            <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${step === "preview" ? "bg-emerald-600 text-white" : step === "result" ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground"}`}>
              {step === "result" ? "✓" : "2"}
            </span>
            预览匹配
          </div>
          <ArrowRight className="h-3 w-3 text-muted-foreground" />
          <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${step === "result" ? "bg-emerald-100 text-emerald-700 font-medium" : "text-muted-foreground"}`}>
            <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${step === "result" ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground"}`}>3</span>
            导入结果
          </div>
        </div>

        {/* ========== Step 1: Upload + Mapping (merged) ========== */}
        {step === "upload" && (
          <div className="flex-1 flex flex-col gap-3 min-h-0 overflow-hidden">
            {/* File upload area */}
            <div
              className={`flex items-center gap-4 p-4 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
                file ? "border-emerald-300 bg-emerald-50/50" : "border-gray-200 hover:border-emerald-300 hover:bg-emerald-50/30"
              }`}
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
                <>
                  <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                    <FileSpreadsheet className="h-6 w-6 text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(file.size / 1024).toFixed(1)} KB
                      {parsing && " · 正在解析..."}
                      {!parsing && totalDataRows > 0 && ` · ${totalDataRows} 行数据 · ${excelHeaders.length} 列`}
                    </p>
                  </div>
                  {parsing && <Loader2 className="h-5 w-5 text-emerald-600 animate-spin shrink-0" />}
                  {!parsing && totalDataRows > 0 && <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />}
                  <span className="text-xs text-emerald-600 hover:underline shrink-0">更换文件</span>
                </>
              ) : (
                <>
                  <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                    <Upload className="h-6 w-6 text-gray-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">点击选择 Excel 文件</p>
                    <p className="text-xs text-muted-foreground">支持 .xlsx, .xls, .csv，最大 10MB · 图片可直接粘贴在Excel单元格中</p>
                  </div>
                </>
              )}
            </div>

            {/* Auto-mapping summary (shown after file parsed) */}
            {excelHeaders.length > 0 && !parsing && (
              <div className="flex flex-col gap-2">
                {/* Quick stats */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-xs">
                    <Badge variant="outline" className="gap-1 text-emerald-700 border-emerald-200 bg-emerald-50">
                      <Zap className="h-3 w-3" />
                      已自动映射 {mappedCount}/{excelHeaders.length} 列
                    </Badge>
                    {hasImageMapping && (
                      <Badge variant="outline" className="gap-1 text-blue-700 border-blue-200 bg-blue-50">
                        <ImageIcon className="h-3 w-3" />
                        含图片列
                      </Badge>
                    )}
                    {!hasRequiredMapping && (
                      <Badge variant="outline" className="gap-1 text-red-700 border-red-200 bg-red-50">
                        <AlertCircle className="h-3 w-3" />
                        需映射订单编号或原订单号
                      </Badge>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-7 gap-1"
                    onClick={() => setShowMapping(!showMapping)}
                  >
                    {showMapping ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    {showMapping ? "收起映射" : "查看/修改映射"}
                  </Button>
                </div>

                {/* Mapped fields pills */}
                {!showMapping && (
                  <div className="flex flex-wrap gap-1">
                    {excelHeaders.map((header, idx) => {
                      const field = columnMapping[idx];
                      if (field === "_skip") return null;
                      const label = FIELD_LABEL_MAP[field] || field;
                      const isImage = field === "orderImageUrl" || field === "paymentScreenshotUrl";
                      return (
                        <span
                          key={idx}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] ${
                            isImage ? "bg-blue-50 text-blue-700 border border-blue-200" : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {isImage && <ImageIcon className="h-2.5 w-2.5" />}
                          {header} → {label}
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* Expandable mapping editor */}
                {showMapping && (
                  <ScrollArea className="border rounded-lg max-h-[340px]">
                    <div className="p-2 space-y-1">
                      {excelHeaders.map((header, idx) => {
                        const currentField = columnMapping[idx] || "_skip";
                        const isSkipped = currentField === "_skip";
                        const isImage = currentField === "orderImageUrl" || currentField === "paymentScreenshotUrl";
                        const sample = sampleData[0]?.[idx] || "";

                        return (
                          <div
                            key={idx}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors ${
                              isSkipped ? "opacity-40 hover:opacity-70" : isImage ? "bg-blue-50/50" : "bg-muted/30"
                            }`}
                          >
                            {/* Column letter */}
                            <span className="text-[10px] text-muted-foreground w-4 text-center font-mono shrink-0">
                              {String.fromCharCode(65 + (idx % 26))}
                            </span>

                            {/* Excel header + sample */}
                            <div className="w-32 shrink-0">
                              <p className="text-xs font-medium truncate" title={header}>{header}</p>
                              <p className="text-[10px] text-muted-foreground truncate" title={sample}>
                                {sample ? (sample.length > 20 ? sample.slice(0, 20) + "..." : sample) : "(空)"}
                              </p>
                            </div>

                            <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />

                            {/* Field select */}
                            <Select
                              value={currentField}
                              onValueChange={(v) => {
                                const newMapping = [...columnMapping];
                                newMapping[idx] = v;
                                setColumnMapping(newMapping);
                              }}
                            >
                              <SelectTrigger className="w-40 h-7 text-[11px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="_skip">
                                  <span className="text-muted-foreground">跳过此列</span>
                                </SelectItem>
                                <SelectItem value="_group_order" disabled>
                                  <span className="text-[10px] font-semibold text-muted-foreground">── 订单字段 ──</span>
                                </SelectItem>
                                {MAPPABLE_FIELDS.filter((f) => f.group === "order").map((f) => (
                                  <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
                                ))}
                                <SelectItem value="_group_item" disabled>
                                  <span className="text-[10px] font-semibold text-muted-foreground">── 子项字段 ──</span>
                                </SelectItem>
                                {MAPPABLE_FIELDS.filter((f) => f.group === "item").map((f) => (
                                  <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
                                ))}
                                <SelectItem value="_group_finance" disabled>
                                  <span className="text-[10px] font-semibold text-muted-foreground">── 财务字段 ──</span>
                                </SelectItem>
                                {MAPPABLE_FIELDS.filter((f) => f.group === "finance").map((f) => (
                                  <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
                                ))}
                                <SelectItem value="_group_media" disabled>
                                  <span className="text-[10px] font-semibold text-muted-foreground">── 图片字段 ──</span>
                                </SelectItem>
                                {MAPPABLE_FIELDS.filter((f) => f.group === "media").map((f) => (
                                  <SelectItem key={f.key} value={f.key}>
                                    <span className="flex items-center gap-1">
                                      <ImageIcon className="h-3 w-3" />
                                      {f.label}
                                    </span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                            {/* More sample data */}
                            <div className="flex-1 flex items-center gap-1.5 overflow-hidden">
                              {sampleData.slice(1, 3).map((row, sIdx) => (
                                <span key={sIdx} className="text-[10px] text-muted-foreground truncate max-w-[80px]" title={row[idx]}>
                                  {row[idx] || ""}
                                </span>
                              ))}
                            </div>

                            {/* Status badges */}
                            {(currentField === "orderNumber" || currentField === "originalOrderNo") && (
                              <Badge className="bg-emerald-100 text-emerald-700 text-[9px] shrink-0 h-4">匹配键</Badge>
                            )}
                            {isImage && (
                              <Badge className="bg-blue-100 text-blue-700 text-[9px] shrink-0 h-4 gap-0.5">
                                <ImageIcon className="h-2.5 w-2.5" />图片
                              </Badge>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                )}
              </div>
            )}

            {/* Help text */}
            {!file && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/40 text-xs text-muted-foreground">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <div>
                  <p>上传包含订单数据的 Excel 文件（第一行为表头），系统会自动识别列名。</p>
                  <p className="mt-1">
                    <strong>支持图片导入：</strong>直接在 Excel 中粘贴图片到「订单图片」列，导入时自动提取上传。
                  </p>
                </div>
              </div>
            )}

            {/* Download template link */}
            <div className="flex items-center justify-between mt-auto pt-1">
              <Button variant="link" size="sm" onClick={handleDownloadTemplate} className="text-xs text-muted-foreground h-6 px-0 gap-1">
                <Download className="h-3 w-3" />
                下载导入模板
              </Button>
            </div>
          </div>
        )}

        {/* ========== Step 2: Preview with match status ========== */}
        {step === "preview" && previewResult && (
          <div className="flex-1 flex flex-col gap-2 min-h-0">
            {/* Match summary - compact */}
            <div className="flex items-center gap-3 text-xs">
              <span className="text-muted-foreground">共 <strong className="text-foreground">{totalRows}</strong> 条</span>
              <div className="flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                <span className="text-emerald-600 font-medium">{matchedCount} 已匹配</span>
              </div>
              {unmatchedCount > 0 && (
                <div className="flex items-center gap-1">
                  {autoCreate ? (
                    <>
                      <PlusCircle className="h-3.5 w-3.5 text-blue-500" />
                      <span className="text-blue-600 font-medium">{autoCreateableCount} 将新建</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-3.5 w-3.5 text-red-500" />
                      <span className="text-red-600 font-medium">{unmatchedCount} 未匹配</span>
                    </>
                  )}
                </div>
              )}
              {imageCount > 0 && (
                <div className="flex items-center gap-1">
                  <ImageIcon className="h-3.5 w-3.5 text-blue-500" />
                  <span className="text-blue-600 font-medium">{imageCount} 含图片</span>
                </div>
              )}
            </div>

            {/* Auto-create toggle */}
            {unmatchedCount > 0 && (
              <div className="flex items-center justify-between p-2.5 rounded-lg border bg-card">
                <div className="flex items-start gap-2">
                  <PlusCircle className="h-4 w-4 mt-0.5 text-blue-500 shrink-0" />
                  <div>
                    <p className="text-xs font-medium">导入 + 新建混合模式</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {canAutoCreate
                        ? "开启后，未匹配的行将自动创建为新订单"
                        : "未映射「客户WhatsApp」列，无法自动创建"}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={autoCreate}
                  onCheckedChange={setAutoCreate}
                  disabled={!canAutoCreate}
                />
              </div>
            )}

            {!autoCreate && unmatchedCount > 0 && (
              <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-amber-50 border border-amber-200 text-[10px] text-amber-700">
                <AlertCircle className="h-3 w-3 shrink-0" />
                未匹配的行将被跳过。可开启「导入+新建」模式自动创建新订单。
              </div>
            )}

            {/* Mapping pills */}
            {previewResult.mapping.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {previewResult.mapping.filter((m) => m.field !== "_skip").map((m, i) => {
                  const isImage = m.field === "orderImageUrl" || m.field === "paymentScreenshotUrl";
                  return (
                    <span key={i} className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] ${
                      isImage ? "bg-blue-50 text-blue-700 border border-blue-200" : "bg-muted text-muted-foreground"
                    }`}>
                      {isImage && <ImageIcon className="h-2.5 w-2.5" />}
                      {m.header} → {FIELD_LABEL_MAP[m.field] || m.field}
                    </span>
                  );
                })}
              </div>
            )}

            {/* Preview table */}
            <ScrollArea className="flex-1 border rounded-lg min-h-0">
              <div className="min-w-[900px]">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="w-6 text-[10px]">#</TableHead>
                      <TableHead className="text-[10px] w-[70px]">状态</TableHead>
                      {visibleFields.map((f) => (
                        <TableHead key={f.key} className="text-[10px] whitespace-nowrap">
                          {f.key === "orderImageUrl" || f.key === "paymentScreenshotUrl" ? (
                            <span className="flex items-center gap-0.5">
                              <ImageIcon className="h-3 w-3" />
                              {f.label}
                            </span>
                          ) : f.label}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewRows.slice(0, 100).map((row, rowIdx) => {
                      const isMatched = row._matched;
                      const willCreate = !isMatched && autoCreate && row.customerWhatsapp && row.orderNumber;
                      const willSkip = !isMatched && !willCreate;

                      return (
                        <TableRow key={rowIdx} className={isMatched ? "" : willCreate ? "bg-blue-50/30" : "bg-red-50/30"}>
                          <TableCell className="text-[10px] text-muted-foreground py-1.5">{rowIdx + 1}</TableCell>
                          <TableCell className="text-[10px] py-1.5">
                            {isMatched ? (
                              <span className="inline-flex items-center gap-0.5 text-emerald-600">
                                <CheckCircle2 className="h-3 w-3" />已匹配
                              </span>
                            ) : willCreate ? (
                              <span className="inline-flex items-center gap-0.5 text-blue-600">
                                <PlusCircle className="h-3 w-3" />将新建
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-0.5 text-red-500">
                                <XCircle className="h-3 w-3" />未匹配
                              </span>
                            )}
                          </TableCell>
                          {visibleFields.map((f) => (
                            <TableCell key={f.key} className="text-[10px] py-1.5 max-w-[130px]">
                              {(f.key === "orderImageUrl" || f.key === "paymentScreenshotUrl") && row[f.key] ? (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className="w-8 h-8 rounded border overflow-hidden cursor-pointer bg-muted/30">
                                        <img
                                          src={row[f.key]}
                                          alt=""
                                          className="w-full h-full object-cover"
                                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                                        />
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent side="right" className="p-0">
                                      <img src={row[f.key]} alt="" className="max-w-[200px] max-h-[200px] rounded" />
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              ) : (
                                <span className="truncate block">{row[f.key] || "-"}</span>
                              )}
                            </TableCell>
                          ))}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              {previewRows.length > 100 && (
                <p className="text-[10px] text-muted-foreground text-center py-1.5">
                  仅显示前 100 行，共 {previewRows.length} 行
                </p>
              )}
            </ScrollArea>
          </div>
        )}

        {/* ========== Step 3: Result ========== */}
        {step === "result" && importResult && (
          <div className="flex-1 flex flex-col gap-4 min-h-0 items-center justify-center py-6">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold">导入完成</p>
              <div className="flex items-center justify-center gap-4 mt-2 text-sm">
                {importResult.updated > 0 && (
                  <span className="text-emerald-600">
                    <strong>{importResult.updated}</strong> 条更新
                  </span>
                )}
                {importResult.created !== undefined && importResult.created > 0 && (
                  <span className="text-blue-600">
                    <strong>{importResult.created}</strong> 个新建
                  </span>
                )}
                {importResult.skipped > 0 && (
                  <span className="text-gray-500">
                    <strong>{importResult.skipped}</strong> 条跳过
                  </span>
                )}
              </div>
            </div>
            {importResult.createdOrders && importResult.createdOrders.length > 0 && (
              <div className="w-full max-w-md p-3 rounded-lg bg-blue-50 border border-blue-200 max-h-[100px] overflow-auto">
                <p className="text-xs font-medium text-blue-700 mb-1">新建的订单：</p>
                <div className="flex flex-wrap gap-1">
                  {importResult.createdOrders.map((o, i) => (
                    <Badge key={i} variant="outline" className="text-[10px] bg-blue-100 text-blue-700 border-blue-300">
                      {o.orderNumber}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {importResult.errors && importResult.errors.length > 0 && (
              <div className="w-full max-w-md p-3 rounded-lg bg-red-50 border border-red-200 max-h-[150px] overflow-auto">
                <p className="text-xs font-medium text-red-700 mb-1">部分数据处理失败：</p>
                <ul className="text-[10px] text-red-600 space-y-0.5">
                  {importResult.errors.slice(0, 20).map((err, i) => (
                    <li key={i}>• {err}</li>
                  ))}
                  {importResult.errors.length > 20 && (
                    <li>...还有 {importResult.errors.length - 20} 条错误</li>
                  )}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* ========== Footer ========== */}
        <DialogFooter className="gap-2 sm:gap-0 shrink-0 pt-2 border-t">
          {step === "upload" && (
            <>
              <Button variant="outline" size="sm" onClick={handleClose}>取消</Button>
              <Button
                size="sm"
                onClick={handlePreview}
                disabled={!file || parsing || previewing || !hasRequiredMapping || excelHeaders.length === 0}
                className="gap-1.5"
              >
                {previewing ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    预览中...
                  </>
                ) : (
                  <>
                    <Eye className="h-3.5 w-3.5" />
                    预览匹配 ({mappedCount} 列已映射)
                  </>
                )}
              </Button>
            </>
          )}
          {step === "preview" && (
            <>
              <Button variant="outline" size="sm" onClick={() => { setStep("upload"); setPreviewResult(null); setAutoCreate(false); }}>
                上一步
              </Button>
              <Button
                size="sm"
                onClick={handleImport}
                disabled={importing || actionableCount === 0}
                className="gap-1.5"
              >
                {importing ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    导入中...
                  </>
                ) : autoCreate && autoCreateableCount > 0 ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5" />
                    确认导入 ({matchedCount} 更新 + {autoCreateableCount} 新建)
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-3.5 w-3.5" />
                    确认更新 {matchedCount} 条数据
                  </>
                )}
              </Button>
            </>
          )}
          {step === "result" && (
            <Button size="sm" onClick={handleClose} className="gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" />
              完成
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
