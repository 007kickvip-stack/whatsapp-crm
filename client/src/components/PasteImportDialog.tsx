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
import { ClipboardPaste, AlertCircle, CheckCircle2, Loader2, Trash2, ArrowRight, Package } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

// Column definitions that map to the order/item fields
const IMPORTABLE_COLUMNS = [
  { key: "skip", label: "跳过此列" },
  { key: "orderDate", label: "日期" },
  { key: "account", label: "账号" },
  { key: "customerWhatsapp", label: "客户WhatsApp" },
  { key: "customerType", label: "客户属性" },
  { key: "orderNumber", label: "订单编号" },
  { key: "size", label: "Size/尺码" },
  { key: "domesticTrackingNo", label: "国内单号" },
  { key: "sizeRecommendation", label: "推荐码数" },
  { key: "contactInfo", label: "联系方式" },
  { key: "internationalTrackingNo", label: "国际跟踪单号" },
  { key: "shipDate", label: "发出日期" },
  { key: "quantity", label: "件数" },
  { key: "source", label: "货源" },
  { key: "orderStatus", label: "订单状态" },
  { key: "amountUsd", label: "总金额$" },
  { key: "amountCny", label: "总金额¥" },
  { key: "sellingPrice", label: "售价" },
  { key: "productCost", label: "产品成本" },
  { key: "shippingCharged", label: "收取运费" },
  { key: "shippingActual", label: "实际运费" },
  { key: "remarks", label: "备注" },
  { key: "paymentStatus", label: "付款状态" },
] as const;

// Auto-detect column mapping from header text
const HEADER_MAPPING: Record<string, string> = {
  "日期": "orderDate",
  "订单日期": "orderDate",
  "date": "orderDate",
  "账号": "account",
  "客服名字": "skip", // staffName is auto-assigned
  "客服": "skip",
  "客户whatsapp": "customerWhatsapp",
  "whatsapp": "customerWhatsapp",
  "wa": "customerWhatsapp",
  "客户属性": "customerType",
  "订单编号": "orderNumber",
  "订单号": "orderNumber",
  "编号": "orderNumber",
  "订单图片": "skip",
  "size": "size",
  "尺码": "size",
  "国内单号": "domesticTrackingNo",
  "推荐码数": "sizeRecommendation",
  "联系方式": "contactInfo",
  "姓名/电话/地址": "contactInfo",
  "国际跟踪单号": "internationalTrackingNo",
  "国际单号": "internationalTrackingNo",
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
  "产品毛利润": "skip",
  "产品毛利率": "skip",
  "收取运费(¥)": "shippingCharged",
  "收取运费": "shippingCharged",
  "实际运费": "shippingActual",
  "运费利润": "skip",
  "运费利润率": "skip",
  "总利润": "skip",
  "利润率": "skip",
  "付款截图": "skip",
  "备注": "remarks",
  "付款状态": "paymentStatus",
  "操作": "skip",
};

type ParsedRow = Record<string, string>;

interface PasteImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export default function PasteImportDialog({ open, onOpenChange, onSuccess }: PasteImportDialogProps) {
  const [step, setStep] = useState<"paste" | "mapping" | "preview">("paste");
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<string[]>([]);
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const utils = trpc.useUtils();

  const bulkImportMutation = trpc.orders.bulkImport.useMutation({
    onSuccess: (result) => {
      toast.success(`成功导入 ${result.imported} 个订单`);
      utils.orders.list.invalidate();
      utils.stats.overview.invalidate();
      onSuccess();
      handleClose();
    },
    onError: (err) => {
      toast.error(err.message || "导入失败");
      setImporting(false);
    },
  });

  const handleClose = useCallback(() => {
    setStep("paste");
    setRawRows([]);
    setHeaders([]);
    setColumnMapping([]);
    setParsedData([]);
    setImporting(false);
    onOpenChange(false);
  }, [onOpenChange]);

  // Parse pasted TSV data
  const handlePaste = useCallback(() => {
    const text = textareaRef.current?.value?.trim();
    if (!text) {
      toast.error("请先粘贴表格数据");
      return;
    }

    const lines = text.split("\n").map(line => line.split("\t"));
    if (lines.length < 2) {
      toast.error("数据至少需要包含表头行和一行数据");
      return;
    }

    const headerRow = lines[0].map(h => h.trim());
    const dataRows = lines.slice(1).filter(row => row.some(cell => cell.trim()));

    if (dataRows.length === 0) {
      toast.error("没有找到有效的数据行");
      return;
    }

    // Auto-detect column mapping
    const mapping = headerRow.map(h => {
      const normalized = h.toLowerCase().trim();
      return HEADER_MAPPING[normalized] || HEADER_MAPPING[h.trim()] || "skip";
    });

    setHeaders(headerRow);
    setRawRows(dataRows);
    setColumnMapping(mapping);
    setStep("mapping");
  }, []);

  // Apply column mapping and generate preview
  const applyMapping = useCallback(() => {
    // Validate required columns are mapped
    const hasWhatsapp = columnMapping.includes("customerWhatsapp");
    const hasOrderNumber = columnMapping.includes("orderNumber");

    if (!hasWhatsapp) {
      toast.error("必须映射「客户WhatsApp」列");
      return;
    }
    if (!hasOrderNumber) {
      toast.error("必须映射「订单编号」列");
      return;
    }

    const data: ParsedRow[] = rawRows.map(row => {
      const obj: ParsedRow = {};
      columnMapping.forEach((fieldKey, colIdx) => {
        if (fieldKey !== "skip" && row[colIdx] !== undefined) {
          const val = row[colIdx].trim();
          if (val) obj[fieldKey] = val;
        }
      });
      return obj;
    }).filter(row => row.customerWhatsapp && row.orderNumber);

    if (data.length === 0) {
      toast.error("没有找到有效的数据行（需要客户WhatsApp和订单编号）");
      return;
    }

    setParsedData(data);
    setStep("preview");
  }, [columnMapping, rawRows]);

  // Submit import
  const handleImport = useCallback(async () => {
    setImporting(true);
    const rows = parsedData.map(row => ({
      orderDate: row.orderDate || undefined,
      account: row.account || undefined,
      customerWhatsapp: row.customerWhatsapp,
      customerType: row.customerType || undefined,
      orderNumber: row.orderNumber,
      orderStatus: row.orderStatus || undefined,
      paymentStatus: row.paymentStatus || undefined,
      remarks: row.remarks || undefined,
      size: row.size || undefined,
      domesticTrackingNo: row.domesticTrackingNo || undefined,
      sizeRecommendation: row.sizeRecommendation || undefined,
      contactInfo: row.contactInfo || undefined,
      internationalTrackingNo: row.internationalTrackingNo || undefined,
      shipDate: row.shipDate || undefined,
      quantity: row.quantity ? parseInt(row.quantity) || undefined : undefined,
      source: row.source || undefined,
      amountUsd: row.amountUsd || undefined,
      amountCny: row.amountCny || undefined,
      sellingPrice: row.sellingPrice || undefined,
      productCost: row.productCost || undefined,
      shippingCharged: row.shippingCharged || undefined,
      shippingActual: row.shippingActual || undefined,
    }));

    bulkImportMutation.mutate({ rows });
  }, [parsedData, bulkImportMutation]);

  const mappedCount = columnMapping.filter(m => m !== "skip").length;
  const uniqueOrders = new Set(parsedData.map(r => `${r.orderNumber}||${r.customerWhatsapp}`)).size;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else onOpenChange(v); }}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardPaste className="h-5 w-5" />
            从表格粘贴导入订单
          </DialogTitle>
          <DialogDescription>
            从 Excel 或 Google Sheets 复制表格数据，粘贴到下方即可批量导入
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
          <Badge variant={step === "paste" ? "default" : "secondary"} className="text-[10px]">1. 粘贴数据</Badge>
          <ArrowRight className="h-3 w-3" />
          <Badge variant={step === "mapping" ? "default" : "secondary"} className="text-[10px]">2. 列映射</Badge>
          <ArrowRight className="h-3 w-3" />
          <Badge variant={step === "preview" ? "default" : "secondary"} className="text-[10px]">3. 预览导入</Badge>
        </div>

        {/* Step 1: Paste */}
        {step === "paste" && (
          <div className="flex-1 flex flex-col gap-3 min-h-0">
            <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 text-sm">
              <AlertCircle className="h-4 w-4 mt-0.5 text-amber-500 shrink-0" />
              <div>
                <p className="font-medium">使用方法</p>
                <p className="text-muted-foreground mt-1">
                  1. 在 Excel / Google Sheets 中选中包含表头的数据区域<br />
                  2. 按 Ctrl+C (或 Cmd+C) 复制<br />
                  3. 点击下方文本框，按 Ctrl+V (或 Cmd+V) 粘贴<br />
                  4. 系统会自动识别列名并映射到对应字段
                </p>
              </div>
            </div>
            <textarea
              ref={textareaRef}
              className="flex-1 min-h-[200px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
              placeholder={"在此粘贴从 Excel 或 Google Sheets 复制的数据...\n\n示例（Tab 分隔）：\n日期\t客户WhatsApp\t订单编号\t售价\t产品成本\n2026-04-01\t+44 7312 035806\t珠04015806-Test\t100\t60"}
            />
          </div>
        )}

        {/* Step 2: Column Mapping */}
        {step === "mapping" && (
          <div className="flex-1 flex flex-col gap-3 min-h-0">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                检测到 <span className="font-medium text-foreground">{headers.length}</span> 列，
                <span className="font-medium text-foreground">{rawRows.length}</span> 行数据。
                已自动映射 <span className="font-medium text-emerald-600">{mappedCount}</span> 列。
              </p>
              <Badge variant="outline" className="text-[10px]">
                <span className="text-red-500">*</span> 客户WhatsApp 和 订单编号 为必填
              </Badge>
            </div>
            <ScrollArea className="flex-1 border rounded-md">
              <div className="p-3 space-y-2">
                {headers.map((header, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <div className="w-40 text-sm font-medium truncate shrink-0 text-right" title={header}>
                      {header}
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    <Select
                      value={columnMapping[idx] || "skip"}
                      onValueChange={(v) => {
                        const newMapping = [...columnMapping];
                        newMapping[idx] = v;
                        setColumnMapping(newMapping);
                      }}
                    >
                      <SelectTrigger className="w-48 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {IMPORTABLE_COLUMNS.map((col) => (
                          <SelectItem key={col.key} value={col.key}>
                            <span className={col.key === "skip" ? "text-muted-foreground" : ""}>{col.label}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="text-xs text-muted-foreground truncate flex-1" title={rawRows[0]?.[idx]}>
                      示例: {rawRows[0]?.[idx] || "(空)"}
                    </span>
                    {columnMapping[idx] === "customerWhatsapp" && <Badge className="bg-red-100 text-red-700 text-[9px]">必填</Badge>}
                    {columnMapping[idx] === "orderNumber" && <Badge className="bg-red-100 text-red-700 text-[9px]">必填</Badge>}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Step 3: Preview */}
        {step === "preview" && (
          <div className="flex-1 flex flex-col gap-3 min-h-0">
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span>将导入 <span className="font-bold text-emerald-600">{uniqueOrders}</span> 个订单</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Package className="h-4 w-4 text-blue-500" />
                <span>共 <span className="font-bold text-blue-600">{parsedData.length}</span> 条子项</span>
              </div>
            </div>
            <ScrollArea className="flex-1 border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">#</TableHead>
                    {columnMapping.filter(m => m !== "skip").map((key, i) => (
                      <TableHead key={i} className="text-xs">
                        {IMPORTABLE_COLUMNS.find(c => c.key === key)?.label || key}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedData.slice(0, 50).map((row, rowIdx) => (
                    <TableRow key={rowIdx}>
                      <TableCell className="text-xs text-muted-foreground">{rowIdx + 1}</TableCell>
                      {columnMapping.filter(m => m !== "skip").map((key, colIdx) => (
                        <TableCell key={colIdx} className="text-xs max-w-[150px] truncate">
                          {row[key] || "-"}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {parsedData.length > 50 && (
                <p className="text-xs text-muted-foreground text-center py-2">
                  仅显示前 50 行，共 {parsedData.length} 行
                </p>
              )}
            </ScrollArea>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {step === "paste" && (
            <>
              <Button variant="outline" onClick={handleClose}>取消</Button>
              <Button onClick={handlePaste} className="gap-2">
                <ClipboardPaste className="h-4 w-4" />
                解析数据
              </Button>
            </>
          )}
          {step === "mapping" && (
            <>
              <Button variant="outline" onClick={() => setStep("paste")}>上一步</Button>
              <Button onClick={applyMapping} className="gap-2">
                <ArrowRight className="h-4 w-4" />
                预览数据
              </Button>
            </>
          )}
          {step === "preview" && (
            <>
              <Button variant="outline" onClick={() => setStep("mapping")}>上一步</Button>
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
