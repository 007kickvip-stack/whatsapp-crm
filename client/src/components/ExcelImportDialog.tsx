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

  const handleClose = useCallback(() => {
    setStep("upload");
    setFile(null);
    setPreviewResult(null);
    setImportResult(null);
    setImporting(false);
    setPreviewing(false);
    setAutoCreate(false);
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

  // Upload file to server for preview with match status
  const handlePreview = useCallback(async () => {
    if (!file) {
      toast.error("请先选择文件");
      return;
    }

    setPreviewing(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

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
  }, [file]);

  // Upload file to server for matching & updating (with optional autoCreate)
  const handleImport = useCallback(async () => {
    if (!file) return;

    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const url = autoCreate ? "/api/excel-import?autoCreate=true" : "/api/excel-import";
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
  }, [file, autoCreate, utils, onSuccess]);

  // Download template
  const handleDownloadTemplate = useCallback(async () => {
    try {
      const XLSX = await import("xlsx");
      const headers = [
        "订单编号", "原订单号", "客户WhatsApp", "客户属性", "Size", "国内单号", "国际跟踪单号",
        "发出日期", "件数", "货源", "订单状态",
        "总金额$", "售价", "产品成本", "收取运费", "实际运费",
        "备注", "付款状态",
      ];
      const ws = XLSX.utils.aoa_to_sheet([headers]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "订单导入模板");
      ws["!cols"] = headers.map(() => ({ wch: 15 }));
      XLSX.writeFile(wb, "订单导入模板.xlsx");
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

  // Count unmatched rows that have required fields for auto-create
  const autoCreateableCount = autoCreate
    ? previewRows.filter((r) => !r._matched && r.customerWhatsapp && r.orderNumber).length
    : 0;

  // Determine the action count for the button
  const actionableCount = matchedCount + (autoCreate ? autoCreateableCount : 0);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else onOpenChange(v); }}>
      <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            导入 Excel 更新订单
          </DialogTitle>
          <DialogDescription>
            上传 Excel 文件，系统通过订单编号或原订单号匹配已有订单，自动更新对应字段
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
          <Badge variant={step === "upload" ? "default" : "secondary"} className="text-[10px]">1. 上传文件</Badge>
          <ArrowRight className="h-3 w-3" />
          <Badge variant={step === "preview" ? "default" : "secondary"} className="text-[10px]">2. 预览匹配</Badge>
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
                  2. 必须包含「订单编号」或「原订单号」列（至少一个，用于匹配已有订单）<br />
                  3. 系统会自动识别列名并将数据更新到匹配的订单字段<br />
                  4. 开启「导入+新建」模式后，未匹配的行将自动创建新订单（需包含 WhatsApp 列）<br />
                  5. 不确定格式？可以先下载模板填写
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

        {/* Step 2: Preview with match status */}
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
                        : "Excel 中未检测到「客户WhatsApp」列，无法自动创建新订单。请添加该列后重新上传。"}
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

            {/* Mapping info */}
            {previewResult.mapping.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {previewResult.mapping.filter((m) => m.field !== "_skip").map((m, i) => (
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
              {previewRows.length > 100 && (
                <p className="text-xs text-muted-foreground text-center py-2">
                  仅显示前 100 行，共 {previewRows.length} 行
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

        <DialogFooter className="gap-2 sm:gap-0">
          {step === "upload" && (
            <>
              <Button variant="outline" onClick={handleClose}>取消</Button>
              <Button onClick={handlePreview} disabled={!file || previewing} className="gap-2">
                {previewing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    检查匹配中...
                  </>
                ) : (
                  <>
                    <ArrowRight className="h-4 w-4" />
                    预览匹配
                  </>
                )}
              </Button>
            </>
          )}
          {step === "preview" && (
            <>
              <Button variant="outline" onClick={() => { setStep("upload"); setPreviewResult(null); setAutoCreate(false); }}>上一步</Button>
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
