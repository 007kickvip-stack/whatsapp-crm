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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
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
  Columns3,
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

// The fields we display in the preview table
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
  const [step, setStep] = useState<"upload" | "mapping" | "preview" | "result">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [parsing, setParsing] = useState(false);
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
  }, []);

  // Step 1 → Step 2: Parse headers and go to mapping
  const handleParseHeaders = useCallback(async () => {
    if (!file) {
      toast.error("请先选择文件");
      return;
    }

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
        setParsing(false);
        return;
      }

      setExcelHeaders(result.headers);
      setColumnMapping(result.autoMapping);
      setSampleData(result.sampleData);
      setTotalDataRows(result.totalRows);
      setStep("mapping");
    } catch (err: any) {
      toast.error(err.message || "解析失败");
    } finally {
      setParsing(false);
    }
  }, [file]);

  // Step 2 → Step 3: Preview with custom mapping
  const handlePreview = useCallback(async () => {
    if (!file) return;

    // Validate: must have orderNumber or originalOrderNo mapped
    const hasOrderNumber = columnMapping.includes("orderNumber");
    const hasOriginalOrderNo = columnMapping.includes("originalOrderNo");
    if (!hasOrderNumber && !hasOriginalOrderNo) {
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
  }, [file, columnMapping]);

  // Step 3 → Step 4: Import with custom mapping
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
      toast.success("模板已下载，请查看『填写说明』工作表了解各列格式");
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

  // Mapping stats
  const mappedCount = columnMapping.filter((m) => m !== "_skip").length;
  const hasRequiredMapping = columnMapping.includes("orderNumber") || columnMapping.includes("originalOrderNo");

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else onOpenChange(v); }}>
      <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            导入 Excel 更新订单
          </DialogTitle>
          <DialogDescription>
            上传 Excel 文件，自定义字段映射，预览匹配结果后导入
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
          <Badge variant={step === "upload" ? "default" : "secondary"} className="text-[10px]">1. 上传文件</Badge>
          <ArrowRight className="h-3 w-3" />
          <Badge variant={step === "mapping" ? "default" : "secondary"} className="text-[10px]">2. 字段映射</Badge>
          <ArrowRight className="h-3 w-3" />
          <Badge variant={step === "preview" ? "default" : "secondary"} className="text-[10px]">3. 预览匹配</Badge>
          <ArrowRight className="h-3 w-3" />
          <Badge variant={step === "result" ? "default" : "secondary"} className="text-[10px]">4. 导入结果</Badge>
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
                  2. 上传后可自定义每列与系统字段的映射关系<br />
                  3. 系统会自动识别常见列名并预设映射，您可随时调整<br />
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

            <Button variant="outline" size="sm" onClick={handleDownloadTemplate} className="gap-2 self-start">
              <Download className="h-4 w-4" />
              下载导入模板
            </Button>
          </div>
        )}

        {/* Step 2: Field Mapping */}
        {step === "mapping" && (
          <div className="flex-1 flex flex-col gap-3 min-h-0 overflow-hidden">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                检测到 <span className="font-medium text-foreground">{excelHeaders.length}</span> 列，
                <span className="font-medium text-foreground">{totalDataRows}</span> 行数据。
                已自动映射 <span className="font-medium text-emerald-600">{mappedCount}</span> 列。
              </p>
              <Badge variant="outline" className="text-[10px]">
                <span className="text-red-500">*</span> 订单编号 或 原订单号 至少映射一个
              </Badge>
            </div>

            <ScrollArea className="flex-1 border rounded-md min-h-0">
              <div className="p-3 space-y-1.5">
                {excelHeaders.map((header, idx) => {
                  const currentField = columnMapping[idx] || "_skip";
                  const isSkipped = currentField === "_skip";
                  const isRequired = currentField === "orderNumber" || currentField === "originalOrderNo";

                  return (
                    <div
                      key={idx}
                      className={`flex items-center gap-3 p-2 rounded-md transition-colors ${
                        isSkipped ? "opacity-50" : "bg-muted/30"
                      }`}
                    >
                      {/* Column index */}
                      <span className="text-[10px] text-muted-foreground w-5 text-right shrink-0">
                        {String.fromCharCode(65 + (idx % 26))}
                      </span>

                      {/* Excel header name */}
                      <div className="w-36 shrink-0">
                        <p className="text-sm font-medium truncate" title={header}>{header}</p>
                        <p className="text-[10px] text-muted-foreground truncate" title={sampleData[0]?.[idx]}>
                          {sampleData[0]?.[idx] || "(空)"}
                        </p>
                      </div>

                      {/* Arrow */}
                      <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />

                      {/* System field select */}
                      <Select
                        value={currentField}
                        onValueChange={(v) => {
                          const newMapping = [...columnMapping];
                          newMapping[idx] = v;
                          setColumnMapping(newMapping);
                        }}
                      >
                        <SelectTrigger className="w-44 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_skip">
                            <span className="text-muted-foreground">跳过此列</span>
                          </SelectItem>
                          {/* Order fields */}
                          <SelectItem value="_group_order" disabled>
                            <span className="text-[10px] font-semibold text-muted-foreground">── 订单字段 ──</span>
                          </SelectItem>
                          {MAPPABLE_FIELDS.filter((f) => f.group === "order").map((f) => (
                            <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
                          ))}
                          {/* Item fields */}
                          <SelectItem value="_group_item" disabled>
                            <span className="text-[10px] font-semibold text-muted-foreground">── 子项字段 ──</span>
                          </SelectItem>
                          {MAPPABLE_FIELDS.filter((f) => f.group === "item").map((f) => (
                            <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
                          ))}
                          {/* Finance fields */}
                          <SelectItem value="_group_finance" disabled>
                            <span className="text-[10px] font-semibold text-muted-foreground">── 财务字段 ──</span>
                          </SelectItem>
                          {MAPPABLE_FIELDS.filter((f) => f.group === "finance").map((f) => (
                            <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
                          ))}
                          {/* Media fields */}
                          <SelectItem value="_group_media" disabled>
                            <span className="text-[10px] font-semibold text-muted-foreground">── 图片字段 ──</span>
                          </SelectItem>
                          {MAPPABLE_FIELDS.filter((f) => f.group === "media").map((f) => (
                            <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {/* Sample data from other rows */}
                      <div className="flex-1 flex gap-2 overflow-hidden">
                        {sampleData.slice(1).map((row, sIdx) => (
                          <span key={sIdx} className="text-[10px] text-muted-foreground truncate max-w-[100px]" title={row[idx]}>
                            {row[idx] || ""}
                          </span>
                        ))}
                      </div>

                      {/* Required badge */}
                      {isRequired && (
                        <Badge className="bg-red-100 text-red-700 text-[9px] shrink-0">必填</Badge>
                      )}
                      {currentField === "customerWhatsapp" && (
                        <Badge className="bg-blue-100 text-blue-700 text-[9px] shrink-0">新建必填</Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            {!hasRequiredMapping && (
              <div className="flex items-start gap-2 p-2 rounded-lg bg-red-50 border border-red-200 text-xs">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 text-red-500 shrink-0" />
                <span className="text-red-700">
                  请至少将一列映射为「订单编号」或「原订单号」，用于匹配已有订单。
                </span>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Preview with match status */}
        {step === "preview" && previewResult && (
          <div className="flex-1 flex flex-col gap-3 min-h-0">
            {/* Match summary */}
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5">
                <span>共 <span className="font-bold">{totalRows}</span> 条数据：</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span className="text-emerald-600 font-medium">{matchedCount} 条已匹配</span>
              </div>
              {unmatchedCount > 0 && (
                <div className="flex items-center gap-1.5">
                  {autoCreate ? (
                    <>
                      <PlusCircle className="h-4 w-4 text-blue-500" />
                      <span className="text-blue-600 font-medium">{autoCreateableCount} 条将新建</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4 text-red-500" />
                      <span className="text-red-600 font-medium">{unmatchedCount} 条未匹配</span>
                    </>
                  )}
                </div>
              )}
              {autoCreate && unmatchedCount > autoCreateableCount && (
                <div className="flex items-center gap-1.5">
                  <XCircle className="h-4 w-4 text-red-500" />
                  <span className="text-red-600 font-medium">{unmatchedCount - autoCreateableCount} 条跳过</span>
                </div>
              )}
            </div>

            {/* Auto-create toggle */}
            {unmatchedCount > 0 && (
              <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                <div className="flex items-start gap-2">
                  <PlusCircle className="h-4 w-4 mt-0.5 text-blue-500 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">导入 + 新建混合模式</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {canAutoCreate
                        ? "开启后，未匹配的行将自动创建为新订单（需包含订单编号和 WhatsApp）"
                        : "未映射「客户WhatsApp」列，无法自动创建新订单。请返回上一步添加该映射。"}
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
              <div className="flex items-start gap-2 p-2 rounded-lg bg-amber-50 border border-amber-200 text-xs">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 text-amber-500 shrink-0" />
                <span className="text-amber-700">
                  未匹配的行将被跳过，不会进行更新。可开启「导入+新建」模式自动创建新订单。
                </span>
              </div>
            )}

            {/* Current mapping summary */}
            {previewResult.mapping.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {previewResult.mapping.filter((m) => m.field !== "_skip").map((m, i) => (
                  <Badge key={i} variant="outline" className="text-[10px] gap-1">
                    {m.header} → {MAPPABLE_FIELDS.find((f) => f.key === m.field)?.label || m.field}
                  </Badge>
                ))}
              </div>
            )}

            <ScrollArea className="flex-1 border rounded-md min-h-0">
              <div className="min-w-[1000px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">#</TableHead>
                    <TableHead className="text-xs whitespace-nowrap w-[80px]">匹配状态</TableHead>
                    {visibleFields.map((f) => (
                      <TableHead key={f.key} className="text-xs whitespace-nowrap">{f.label}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewRows.slice(0, 100).map((row, rowIdx) => {
                    const isMatched = row._matched;
                    const willCreate = !isMatched && autoCreate && row.customerWhatsapp && row.orderNumber;
                    const willSkip = !isMatched && !willCreate;

                    return (
                      <TableRow key={rowIdx} className={isMatched ? "" : willCreate ? "bg-blue-50/50" : "bg-red-50/50"}>
                        <TableCell className="text-xs text-muted-foreground">{rowIdx + 1}</TableCell>
                        <TableCell className="text-xs">
                          {isMatched ? (
                            <div className="flex items-center gap-1">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                              <span className="text-emerald-600 font-medium">已匹配</span>
                            </div>
                          ) : willCreate ? (
                            <div className="flex items-center gap-1">
                              <PlusCircle className="h-3.5 w-3.5 text-blue-500" />
                              <span className="text-blue-600 font-medium">将新建</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              <XCircle className="h-3.5 w-3.5 text-red-500" />
                              <span className="text-red-600 font-medium">未匹配</span>
                            </div>
                          )}
                        </TableCell>
                        {visibleFields.map((f) => (
                          <TableCell key={f.key} className="text-xs max-w-[150px] truncate">
                            {row[f.key] || "-"}
                          </TableCell>
                        ))}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              </div>
              {previewRows.length > 100 && (
                <p className="text-xs text-muted-foreground text-center py-2">
                  仅显示前 100 行，共 {previewRows.length} 行
                </p>
              )}
            </ScrollArea>
          </div>
        )}

        {/* Step 4: Result */}
        {step === "result" && importResult && (
          <div className="flex-1 flex flex-col gap-4 min-h-0 items-center justify-center">
            <CheckCircle2 className="h-16 w-16 text-emerald-500" />
            <div className="text-center">
              <p className="text-lg font-semibold">导入完成</p>
              <div className="text-sm text-muted-foreground mt-1 space-y-0.5">
                <p>
                  更新 <span className="font-bold text-emerald-600">{importResult.updated}</span> 条
                  {importResult.created !== undefined && importResult.created > 0 && (
                    <>，新建 <span className="font-bold text-blue-600">{importResult.created}</span> 个订单</>
                  )}
                  ，跳过 <span className="font-bold text-gray-500">{importResult.skipped}</span> 条
                  ，共 <span className="font-bold">{importResult.totalRows}</span> 条数据
                </p>
              </div>
            </div>
            {importResult.createdOrders && importResult.createdOrders.length > 0 && (
              <div className="w-full p-3 rounded-lg bg-blue-50 border border-blue-200 max-h-[120px] overflow-auto">
                <p className="text-sm font-medium text-blue-700 mb-1">新建的订单：</p>
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
              <div className="w-full p-3 rounded-lg bg-red-50 border border-red-200 max-h-[200px] overflow-auto">
                <p className="text-sm font-medium text-red-700 mb-1">部分数据未匹配或处理失败：</p>
                <ul className="text-xs text-red-600 space-y-0.5">
                  {importResult.errors.map((err, i) => (
                    <li key={i}>• {err}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0 shrink-0 pt-2 border-t">
          {step === "upload" && (
            <>
              <Button variant="outline" onClick={handleClose}>取消</Button>
              <Button onClick={handleParseHeaders} disabled={!file || parsing} className="gap-2">
                {parsing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    解析中...
                  </>
                ) : (
                  <>
                    <Columns3 className="h-4 w-4" />
                    解析列头
                  </>
                )}
              </Button>
            </>
          )}
          {step === "mapping" && (
            <>
              <Button variant="outline" onClick={() => { setStep("upload"); setExcelHeaders([]); setColumnMapping([]); setSampleData([]); }}>上一步</Button>
              <Button
                onClick={handlePreview}
                disabled={previewing || !hasRequiredMapping}
                className="gap-2"
              >
                {previewing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    预览中...
                  </>
                ) : (
                  <>
                    <ArrowRight className="h-4 w-4" />
                    预览匹配 ({mappedCount} 列已映射)
                  </>
                )}
              </Button>
            </>
          )}
          {step === "preview" && (
            <>
              <Button variant="outline" onClick={() => { setStep("mapping"); setPreviewResult(null); setAutoCreate(false); }}>上一步</Button>
              <Button
                onClick={handleImport}
                disabled={importing || actionableCount === 0}
                className="gap-2"
              >
                {importing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {autoCreate ? "导入中..." : "更新中..."}
                  </>
                ) : autoCreate && autoCreateableCount > 0 ? (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    更新 {matchedCount} 条 + 新建 {autoCreateableCount} 个订单
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    确认更新 {matchedCount} 条匹配数据
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
