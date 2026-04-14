import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Trash2, Search, Upload, X, Loader2, Image as ImageIcon,
  Download, ArrowRightLeft, FileText, ChevronDown, ChevronRight
} from "lucide-react";
import AccountSelect from "@/components/AccountSelect";

// ============================================================
// Helper: format number
// ============================================================
function fmtNum(val: string | number | null | undefined): string {
  const n = parseFloat(String(val || "0"));
  return isNaN(n) ? "0.00" : n.toFixed(2);
}

// ============================================================
// Status color helper
// ============================================================
function statusColor(status: string | null): string {
  switch (status) {
    case "待确认": return "bg-amber-50 text-amber-700 border-amber-200";
    case "已确认": return "bg-blue-50 text-blue-700 border-blue-200";
    case "已同步": return "bg-emerald-50 text-emerald-700 border-emerald-200";
    default: return "bg-gray-50 text-gray-700 border-gray-200";
  }
}

// ============================================================
// Editable Cell Component
// ============================================================
function EditableCell({
  value,
  onSave,
  placeholder = "",
  className = "",
  type = "text",
}: {
  value: string;
  onSave: (v: string) => void;
  placeholder?: string;
  className?: string;
  type?: "text" | "number";
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  if (!editing) {
    return (
      <div
        onClick={() => { setDraft(value); setEditing(true); }}
        className={`cursor-text min-h-[22px] px-0.5 py-0.5 rounded hover:bg-emerald-50 transition-colors ${className}`}
      >
        {value || <span className="text-gray-300 italic text-[10px]">{placeholder || "点击编辑"}</span>}
      </div>
    );
  }

  return (
    <input
      ref={inputRef}
      type={type}
      step={type === "number" ? "0.01" : undefined}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        setEditing(false);
        if (draft !== value) onSave(draft);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          setEditing(false);
          if (draft !== value) onSave(draft);
        }
        if (e.key === "Escape") {
          setEditing(false);
          setDraft(value);
        }
      }}
      className="w-full bg-white border border-emerald-400 rounded text-[11px] py-0.5 px-1 focus:ring-1 focus:ring-emerald-400 outline-none"
    />
  );
}

// ============================================================
// Image Upload Cell (same pattern as Orders)
// ============================================================
function ImageUploadCell({
  imageUrl,
  onUploaded,
  onPreview,
  onRemove,
  uploadMutation,
}: {
  imageUrl: string | null;
  onUploaded: (url: string) => void;
  onPreview: (url: string) => void;
  onRemove?: () => void;
  uploadMutation: any;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounterRef = useRef(0);

  const handleFile = (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast.error("文件大小不能超过 5MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = (reader.result as string).split(",")[1];
        const result = await uploadMutation.mutateAsync({
          base64,
          filename: file.name,
          contentType: file.type,
        });
        onUploaded(result.url);
        toast.success("图片上传成功");
      } catch {
        toast.error("图片上传失败");
      }
    };
    reader.readAsDataURL(file);
  };

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) {
        e.preventDefault();
        e.stopPropagation();
        const file = items[i].getAsFile();
        if (file) handleFile(file);
        return;
      }
    }
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.types.includes("Files")) setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) setIsDragOver(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    dragCounterRef.current = 0; setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type.startsWith("image/")) {
      handleFile(files[0]);
    }
  }, []);

  return (
    <div
      ref={containerRef}
      className={`flex items-center justify-center rounded p-0.5 transition-all outline-none ${
        isDragOver ? "ring-2 ring-emerald-500 bg-emerald-100/70 scale-105" : isFocused ? "ring-1 ring-emerald-400 bg-emerald-50/50" : ""
      }`}
      tabIndex={0}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      onPaste={handlePaste}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      title={imageUrl ? "点击查看大图 | 粘贴/拖拽替换图片" : "点击上传、粘贴或拖拽图片"}
    >
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
      {isDragOver ? (
        <div className="flex items-center justify-center h-10 w-10">
          <ImageIcon className="h-5 w-5 text-emerald-500 animate-bounce" />
        </div>
      ) : imageUrl ? (
        <div className="relative group">
          <button onClick={() => onPreview(imageUrl)} className="inline-flex">
            <img src={imageUrl} alt="" className="h-10 w-10 rounded object-cover border border-emerald-200 hover:border-emerald-400 transition-colors cursor-pointer" />
          </button>
          {onRemove && (
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
              title="删除图片"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          )}
        </div>
      ) : (
        <button
          onClick={() => fileRef.current?.click()}
          className="inline-flex items-center justify-center h-8 w-8 rounded border border-dashed border-gray-300 hover:border-emerald-400 hover:bg-emerald-50 transition-colors"
          title="上传、粘贴或拖拽图片"
        >
          {uploadMutation.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-500" />
          ) : (
            <Upload className="h-3.5 w-3.5 text-gray-400" />
          )}
        </button>
      )}
    </div>
  );
}

// ============================================================
// Main Quotations Page
// ============================================================
export default function QuotationsPage() {
  const { user } = useAuth();
  const utils = trpc.useUtils();

  // State
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ customerName: "", contactInfo: "", account: "", customerWhatsapp: "", remarks: "" });
  const [collapsedIds, setCollapsedIds] = useState<Set<number>>(new Set());
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [exportingId, setExportingId] = useState<number | null>(null);

  // Queries
  const { data, isLoading } = trpc.quotations.list.useQuery({ page, pageSize: 50, search: search || undefined });
  const quotations = data?.data || [];
  const total = data?.total || 0;

  // Mutations
  const createMutation = trpc.quotations.create.useMutation({
    onSuccess: () => { utils.quotations.list.invalidate(); setDialogOpen(false); toast.success("报价表创建成功"); },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = trpc.quotations.update.useMutation({
    onSuccess: () => utils.quotations.list.invalidate(),
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.quotations.delete.useMutation({
    onSuccess: () => { utils.quotations.list.invalidate(); toast.success("报价表已删除"); },
    onError: (e) => toast.error(e.message),
  });
  const syncMutation = trpc.quotations.syncToOrder.useMutation({
    onSuccess: (data) => { utils.quotations.list.invalidate(); toast.success(`已同步到订单管理，订单ID: ${data.orderId}`); },
    onError: (e) => toast.error(e.message),
  });
  const createItemMutation = trpc.quotationItems.create.useMutation({
    onSuccess: () => utils.quotations.list.invalidate(),
    onError: (e) => toast.error(e.message),
  });
  const updateItemMutation = trpc.quotationItems.update.useMutation({
    onSuccess: () => utils.quotations.list.invalidate(),
    onError: (e) => toast.error(e.message),
  });
  const deleteItemMutation = trpc.quotationItems.delete.useMutation({
    onSuccess: () => utils.quotations.list.invalidate(),
    onError: (e) => toast.error(e.message),
  });
  const uploadMutation = trpc.upload.image.useMutation();

  // Toggle collapse
  const toggleCollapse = (id: number) => {
    setCollapsedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Save quotation field
  const saveQuotationField = (id: number, field: string, value: string) => {
    updateMutation.mutate({ id, [field]: value } as any);
  };

  // Save item field
  const saveItemField = (itemId: number, quotationId: number, field: string, value: string) => {
    updateItemMutation.mutate({ id: itemId, quotationId, [field]: value } as any);
  };

  // Create quotation
  const handleCreate = () => {
    if (!form.customerName.trim()) { toast.error("请输入客户名字"); return; }
    createMutation.mutate(form);
  };

  // Export quotation as image (English labels, no CNY column)
  const exportAsImage = async (quotation: any) => {
    setExportingId(quotation.id);
    try {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d")!;
      const items = quotation.items || [];
      const padding = 40;
      const rowHeight = 80;
      const imgSize = 60;
      const headerHeight = 80;
      const footerHeight = 120;
      // Export columns: #, Image, Size, Qty, Amount($), Shipping($), Remarks
      const colWidths = [50, 120, 80, 60, 120, 120, 150];
      const totalWidth = colWidths.reduce((s, w) => s + w, 0) + padding * 2;
      const totalHeight = headerHeight + 40 + items.length * rowHeight + footerHeight + padding * 2;

      canvas.width = totalWidth * 2;
      canvas.height = totalHeight * 2;
      ctx.scale(2, 2);

      // Background
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, totalWidth, totalHeight);

      // Header
      ctx.fillStyle = "#059669";
      ctx.fillRect(0, 0, totalWidth, headerHeight);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 22px sans-serif";
      ctx.fillText("Quotation", padding, 35);
      ctx.font = "14px sans-serif";
      ctx.fillText(`Customer: ${quotation.customerName}`, padding, 60);
      const now = new Date();
      const dateStr = `${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()}`;
      ctx.textAlign = "right";
      ctx.fillText(`Date: ${dateStr}`, totalWidth - padding, 60);
      ctx.textAlign = "left";

      // Table header
      const tableY = headerHeight + 10;
      ctx.fillStyle = "#f0fdf4";
      ctx.fillRect(padding, tableY, totalWidth - padding * 2, 30);
      ctx.fillStyle = "#065f46";
      ctx.font = "bold 12px sans-serif";
      const headers = ["#", "Image", "Size", "Qty", "Amount($)", "Shipping($)", "Remarks"];
      let x = padding;
      headers.forEach((h, i) => {
        ctx.fillText(h, x + 8, tableY + 20);
        x += colWidths[i];
      });

      // Load images first
      const imagePromises = items.map((item: any) => {
        if (!item.orderImageUrl) return Promise.resolve(null);
        return new Promise<HTMLImageElement | null>((resolve) => {
          const img = new window.Image();
          img.crossOrigin = "anonymous";
          img.onload = () => resolve(img);
          img.onerror = () => resolve(null);
          img.src = item.orderImageUrl;
        });
      });
      const loadedImages = await Promise.all(imagePromises);

      // Table rows
      ctx.font = "12px sans-serif";
      items.forEach((item: any, idx: number) => {
        const y = tableY + 30 + idx * rowHeight;
        if (idx % 2 === 0) {
          ctx.fillStyle = "#fafafa";
          ctx.fillRect(padding, y, totalWidth - padding * 2, rowHeight);
        }
        ctx.strokeStyle = "#e5e7eb";
        ctx.beginPath();
        ctx.moveTo(padding, y + rowHeight);
        ctx.lineTo(totalWidth - padding, y + rowHeight);
        ctx.stroke();

        ctx.fillStyle = "#1f2937";
        let rx = padding;
        // #
        ctx.fillText(String(idx + 1), rx + 8, y + rowHeight / 2 + 4);
        rx += colWidths[0];
        // Image
        const loadedImg = loadedImages[idx];
        if (loadedImg) {
          try { ctx.drawImage(loadedImg, rx + 8, y + (rowHeight - imgSize) / 2, imgSize, imgSize); } catch {}
        }
        rx += colWidths[1];
        // Size
        ctx.fillText(item.size || "-", rx + 8, y + rowHeight / 2 + 4);
        rx += colWidths[2];
        // Quantity
        ctx.fillText(String(item.quantity || 1), rx + 8, y + rowHeight / 2 + 4);
        rx += colWidths[3];
        // Amount USD
        ctx.fillText(`$${fmtNum(item.amountUsd)}`, rx + 8, y + rowHeight / 2 + 4);
        rx += colWidths[4];
        // Shipping USD
        const itemAmountCny = parseFloat(item.amountCny || "0");
        const itemSellingPrice = parseFloat(item.sellingPrice || "0");
        const itemShippingCny = itemAmountCny - itemSellingPrice;
        const itemAmountUsd = parseFloat(item.amountUsd || "0");
        const itemRate = itemAmountCny > 0 ? itemAmountUsd / itemAmountCny : 0;
        const itemShippingUsd = itemShippingCny * itemRate;
        ctx.fillText(`$${fmtNum(itemShippingUsd)}`, rx + 8, y + rowHeight / 2 + 4);
        rx += colWidths[5];
        // Remarks
        ctx.fillText(item.remarks || "-", rx + 8, y + rowHeight / 2 + 4);
      });

      // Calculate total shipping
      const totalSellingPriceExport = items.reduce((s: number, it: any) => s + parseFloat(it.sellingPrice || "0"), 0);
      const totalAmountCnyExport = parseFloat(String(quotation.totalAmountCny || "0"));
      const totalAmountUsdExport = parseFloat(String(quotation.totalAmountUsd || "0"));
      const totalShippingCnyExport = totalAmountCnyExport - totalSellingPriceExport;
      const rateExport = totalAmountCnyExport > 0 ? totalAmountUsdExport / totalAmountCnyExport : 0;
      const totalShippingUsdExport = totalShippingCnyExport * rateExport;

      // Footer - Shipping row + Total row
      const footerY = tableY + 30 + items.length * rowHeight + 10;
      // Shipping row
      ctx.fillStyle = "#065f46";
      ctx.fillRect(padding, footerY, totalWidth - padding * 2, 40);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 15px sans-serif";
      ctx.fillText("Shipping", padding + 16, footerY + 26);
      ctx.textAlign = "right";
      ctx.fillText(`$${fmtNum(totalShippingUsdExport)}`, totalWidth - padding - 16, footerY + 26);
      ctx.textAlign = "left";
      // Total row
      ctx.fillStyle = "#059669";
      ctx.fillRect(padding, footerY + 40, totalWidth - padding * 2, 40);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 16px sans-serif";
      ctx.fillText("Total", padding + 16, footerY + 40 + 26);
      ctx.textAlign = "right";
      ctx.fillText(`$${fmtNum(quotation.totalAmountUsd)}`, totalWidth - padding - 16, footerY + 40 + 26);
      ctx.textAlign = "left";

      // Download
      const link = document.createElement("a");
      link.download = `Quotation-${quotation.customerName}-${dateStr.replace(/\//g, "-")}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast.success("报价图片已导出");
    } catch (err) {
      toast.error("导出失败");
      console.error(err);
    } finally {
      setExportingId(null);
    }
  };

  // Build flat rows: parent row + child rows for each quotation
  const tableRows = useMemo(() => {
    const rows: Array<{
      type: "parent" | "child" | "total";
      quotation: any;
      item?: any;
      itemIndex?: number;
      itemCount: number;
    }> = [];
    quotations.forEach((q: any) => {
      const items = q.items || [];
      const isCollapsed = collapsedIds.has(q.id);
      // Parent row (first item merged)
      rows.push({ type: "parent", quotation: q, item: items[0] || null, itemIndex: 0, itemCount: items.length });
      // Child rows (remaining items)
      if (!isCollapsed) {
        items.slice(1).forEach((item: any, idx: number) => {
          rows.push({ type: "child", quotation: q, item, itemIndex: idx + 1, itemCount: items.length });
        });
        // Total row right after this quotation's items
        rows.push({ type: "total", quotation: q, itemCount: items.length });
      }
    });
    return rows;
  }, [quotations, collapsedIds]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">客户报价表</h1>
          <p className="text-xs text-muted-foreground mt-0.5">管理客户报价，支持导出图片和一键同步到订单</p>
        </div>
        <Button size="sm" onClick={() => { setForm({ customerName: "", contactInfo: "", account: "", customerWhatsapp: "", remarks: "" }); setDialogOpen(true); }} className="bg-emerald-600 hover:bg-emerald-700">
          <Plus className="h-4 w-4 mr-1" /> 新建报价
        </Button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="搜索客户名字..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9 h-8 text-sm"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2">
              <X className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600" />
            </button>
          )}
        </div>
        <span className="text-xs text-muted-foreground">共 {total} 条报价</span>
      </div>

      {/* Main Table */}
      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
        </div>
      ) : quotations.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 text-gray-400">
          <FileText className="h-10 w-10 mb-2" />
          <p className="text-sm">暂无报价表</p>
          <p className="text-xs mt-1">点击"新建报价"开始创建</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-x-auto">
          <table className="w-full text-[11px] border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-emerald-50 text-gray-600 border-b border-emerald-200">
                <th className="py-2 px-2 text-center w-[30px]"></th>
                <th className="py-2 px-2 text-center w-[40px]">#</th>
                <th className="py-2 px-2 text-center min-w-[80px]">客服名字</th>
                <th className="py-2 px-2 text-center min-w-[80px]">账号</th>
                <th className="py-2 px-2 text-center min-w-[100px]">客户名字</th>
                <th className="py-2 px-2 text-center min-w-[100px]">客户WhatsApp</th>
                <th className="py-2 px-2 text-center w-[80px]">订单图片</th>
                <th className="py-2 px-2 text-center w-[80px]">Size</th>
                <th className="py-2 px-2 text-center min-w-[120px]">联系方式</th>
                <th className="py-2 px-2 text-center w-[60px]">数量</th>
                <th className="py-2 px-2 text-center w-[100px]">总金额($)</th>
                <th className="py-2 px-2 text-center w-[100px]">总金额(¥)</th>
                <th className="py-2 px-2 text-center w-[100px]">售价(¥)</th>
                <th className="py-2 px-2 text-center w-[100px]">收取运费($)</th>
                <th className="py-2 px-2 text-center w-[100px]">备注</th>
                <th className="py-2 px-2 text-center w-[30px]"></th>
                <th className="py-2 px-2 text-center min-w-[60px]">状态</th>
                <th className="py-2 px-2 text-center min-w-[200px]">操作</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row, rowIdx) => {
                const q = row.quotation;
                const item = row.item;
                const isParent = row.type === "parent";
                const isTotal = row.type === "total";
                const isCollapsed = collapsedIds.has(q.id);
                const visibleItemCount = isCollapsed ? 1 : row.itemCount;

                if (isTotal) {
                  // Calculate total selling price and total shipping for this quotation
                  const qItems = q.items || [];
                  const totalSellingPrice = qItems.reduce((s: number, it: any) => s + parseFloat(it.sellingPrice || "0"), 0);
                  const totalShippingCny = parseFloat(String(q.totalAmountCny || "0")) - totalSellingPrice;
                  // Convert shipping to USD using rate: totalAmountUsd / totalAmountCny
                  const totalAmountCnyVal = parseFloat(String(q.totalAmountCny || "0"));
                  const totalAmountUsdVal = parseFloat(String(q.totalAmountUsd || "0"));
                  const rateForShipping = totalAmountCnyVal > 0 ? totalAmountUsdVal / totalAmountCnyVal : 0;
                  const totalShippingUsd = totalShippingCny * rateForShipping;
                  return (
                    <tr key={`total-${q.id}`} className="border-t-2 border-emerald-200 bg-emerald-50/30">
                      <td colSpan={10} className="py-1.5 px-2 text-right font-semibold text-gray-600 text-xs">
                        {q.customerName} 合计
                      </td>
                      <td className="py-1.5 px-2 text-center font-bold text-emerald-700 text-xs">${fmtNum(q.totalAmountUsd)}</td>
                      <td className="py-1.5 px-2 text-center font-bold text-orange-600 text-xs">¥{fmtNum(q.totalAmountCny)}</td>
                      <td className="py-1.5 px-2 text-center font-bold text-purple-600 text-xs">¥{fmtNum(totalSellingPrice)}</td>
                      <td className="py-1.5 px-2 text-center font-bold text-blue-600 text-xs">${fmtNum(totalShippingUsd)}</td>
                      <td colSpan={4}></td>
                    </tr>
                  );
                }

                if (isParent) {
                  return (
                    <tr
                      key={`parent-${q.id}`}
                      className="border-t-2 border-emerald-100 hover:bg-gray-50/50"
                    >
                      {/* Collapse toggle */}
                      <td
                        className="py-1 px-1 text-center align-middle border-r border-gray-100"
                        rowSpan={visibleItemCount}
                      >
                        <button
                          onClick={() => toggleCollapse(q.id)}
                          className="text-gray-400 hover:text-gray-600 p-0.5"
                          title={isCollapsed ? "展开子项" : "折叠子项"}
                        >
                          {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        </button>
                      </td>
                      {/* # - parent index */}
                      <td
                        className="py-1 px-2 text-center align-middle text-gray-400 font-medium border-r border-gray-100"
                        rowSpan={visibleItemCount}
                      >
                        {rowIdx + 1}
                      </td>
                      {/* 客服名字 - merged */}
                      <td
                        className="py-1 px-2 text-center align-middle border-r border-gray-100"
                        rowSpan={visibleItemCount}
                      >
                        <EditableCell
                          value={q.staffName || ""}
                          onSave={(v) => saveQuotationField(q.id, "staffName", v)}
                          placeholder="客服名字"
                          className="text-xs"
                        />
                      </td>
                      {/* 账号 - merged (dropdown) */}
                      <td
                        className="py-1 px-2 text-center align-middle border-r border-gray-100"
                        rowSpan={visibleItemCount}
                      >
                        <AccountSelect
                          value={q.account || ""}
                          onValueChange={(v) => saveQuotationField(q.id, "account", v)}
                          placeholder="账号"
                          compact
                        />
                      </td>
                      {/* Customer name - merged */}
                      <td
                        className="py-1 px-2 text-center align-middle border-r border-gray-100"
                        rowSpan={visibleItemCount}
                      >
                        <EditableCell
                          value={q.customerName || ""}
                          onSave={(v) => saveQuotationField(q.id, "customerName", v)}
                          placeholder="客户名字"
                          className="font-semibold text-xs text-gray-900"
                        />
                      </td>
                      {/* 客户WhatsApp - merged */}
                      <td
                        className="py-1 px-2 text-center align-middle border-r border-gray-100"
                        rowSpan={visibleItemCount}
                      >
                        <EditableCell
                          value={q.customerWhatsapp || ""}
                          onSave={(v) => saveQuotationField(q.id, "customerWhatsapp", v)}
                          placeholder="WhatsApp"
                          className="text-xs"
                        />
                      </td>
                      {/* Order image - per item */}
                      <td className="py-1 px-2 text-center">
                        {item && (
                          <ImageUploadCell
                            imageUrl={item.orderImageUrl}
                            onUploaded={(url) => saveItemField(item.id, q.id, "orderImageUrl", url)}
                            onPreview={(url) => setPreviewImage(url)}
                            onRemove={() => saveItemField(item.id, q.id, "orderImageUrl", "")}
                            uploadMutation={uploadMutation}
                          />
                        )}
                      </td>
                      {/* Size - per item */}
                      <td className="py-1 px-2 text-center">
                        {item && (
                          <EditableCell value={item.size || ""} onSave={(v) => saveItemField(item.id, q.id, "size", v)} placeholder="Size" />
                        )}
                      </td>
                      {/* Contact info - merged */}
                      <td
                        className="py-1 px-2 text-center align-middle border-r border-gray-100"
                        rowSpan={visibleItemCount}
                      >
                        <EditableCell
                          value={q.contactInfo || ""}
                          onSave={(v) => saveQuotationField(q.id, "contactInfo", v)}
                          placeholder="联系方式"
                          className="text-xs"
                        />
                      </td>
                      {/* Quantity - per item */}
                      <td className="py-1 px-2 text-center">
                        {item && (
                          <EditableCell value={String(item.quantity || 1)} onSave={(v) => saveItemField(item.id, q.id, "quantity", v)} placeholder="1" type="number" />
                        )}
                      </td>
                      {/* Amount USD - per item */}
                      <td className="py-1 px-2 text-center">
                        {item && (
                          <EditableCell value={fmtNum(item.amountUsd)} onSave={(v) => saveItemField(item.id, q.id, "amountUsd", v)} placeholder="0.00" type="number" />
                        )}
                      </td>
                      {/* Amount CNY - per item (auto calculated) */}
                      <td className="py-1 px-2 text-center text-gray-500">
                        {item ? `¥${fmtNum(item.amountCny)}` : ""}
                      </td>
                      {/* Selling Price (¥) - per item */}
                      <td className="py-1 px-2 text-center">
                        {item && (
                          <EditableCell value={fmtNum(item.sellingPrice)} onSave={(v) => saveItemField(item.id, q.id, "sellingPrice", v)} placeholder="0.00" type="number" />
                        )}
                      </td>
                      {/* Shipping Charged ($) - auto calculated: (amountCny - sellingPrice) converted to USD */}
                      <td className="py-1 px-2 text-center text-blue-600 text-xs">
                        {item ? (() => {
                          const amountCny = parseFloat(item.amountCny || "0");
                          const sellingPrice = parseFloat(item.sellingPrice || "0");
                          const shippingCny = amountCny - sellingPrice;
                          const amountUsd = parseFloat(item.amountUsd || "0");
                          const rate = amountCny > 0 ? amountUsd / amountCny : 0;
                          const shippingUsd = shippingCny * rate;
                          return `$${fmtNum(shippingUsd)}`;
                        })() : ""}
                      </td>
                      {/* Remarks - per item */}
                      <td className="py-1 px-2 text-center">
                        {item && (
                          <EditableCell value={item.remarks || ""} onSave={(v) => saveItemField(item.id, q.id, "remarks", v)} placeholder="备注" />
                        )}
                      </td>
                      {/* Delete item button for parent first item */}
                      <td className="py-1 px-1 text-center">
                        {item && row.itemCount > 1 && (
                          <button
                            onClick={() => {
                              if (confirm("确定要删除此商品行吗？")) {
                                deleteItemMutation.mutate({ id: item.id, quotationId: q.id });
                              }
                            }}
                            className="text-red-400 hover:text-red-600 p-0.5 rounded hover:bg-red-50 transition-colors"
                            title="删除此商品"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </td>
                      {/* Status - merged */}
                      <td
                        className="py-1 px-2 text-center align-middle border-r border-gray-100"
                        rowSpan={visibleItemCount}
                      >
                        <Badge variant="outline" className={`text-[10px] ${statusColor(q.status)}`}>{q.status}</Badge>
                      </td>
                      {/* Actions - merged */}
                      <td
                        className="py-1 px-2 text-center align-middle"
                        rowSpan={visibleItemCount}
                      >
                        <div className="flex items-center justify-center gap-1 flex-wrap">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 text-[10px] px-1.5"
                            onClick={() => createItemMutation.mutate({ quotationId: q.id })}
                          >
                            <Plus className="h-3 w-3 mr-0.5" /> 添加
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 text-[10px] px-1.5"
                            onClick={() => exportAsImage(q)}
                            disabled={exportingId === q.id}
                          >
                            {exportingId === q.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3 mr-0.5" />}
                            导出
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 text-[10px] px-1.5 text-blue-600 border-blue-200 hover:bg-blue-50"
                            onClick={() => {
                              if (confirm("确定要将此报价表同步到订单管理吗？")) {
                                syncMutation.mutate({ quotationId: q.id });
                              }
                            }}
                            disabled={q.status === "已同步" || syncMutation.isPending}
                          >
                            <ArrowRightLeft className="h-3 w-3 mr-0.5" />
                            {q.status === "已同步" ? "已同步" : "同步"}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => {
                              if (confirm("确定要删除此报价表吗？")) {
                                deleteMutation.mutate({ id: q.id });
                              }
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                }

                // Child row
                return (
                  <tr key={`child-${q.id}-${item?.id}`} className="border-t border-gray-100 hover:bg-gray-50/30">
                    {/* No collapse, #, staffName, account, customer name, customerWhatsapp, contact info, status, actions columns - they are rowSpan merged */}
                    {/* Order image */}
                    <td className="py-1 px-2 text-center">
                      {item && (
                        <ImageUploadCell
                          imageUrl={item.orderImageUrl}
                          onUploaded={(url) => saveItemField(item.id, q.id, "orderImageUrl", url)}
                          onPreview={(url) => setPreviewImage(url)}
                          onRemove={() => saveItemField(item.id, q.id, "orderImageUrl", "")}
                          uploadMutation={uploadMutation}
                        />
                      )}
                    </td>
                    {/* Size */}
                    <td className="py-1 px-2 text-center">
                      {item && (
                        <EditableCell value={item.size || ""} onSave={(v) => saveItemField(item.id, q.id, "size", v)} placeholder="Size" />
                      )}
                    </td>
                    {/* Quantity */}
                    <td className="py-1 px-2 text-center">
                      {item && (
                        <EditableCell value={String(item.quantity || 1)} onSave={(v) => saveItemField(item.id, q.id, "quantity", v)} placeholder="1" type="number" />
                      )}
                    </td>
                    {/* Amount USD */}
                    <td className="py-1 px-2 text-center">
                      {item && (
                        <EditableCell value={fmtNum(item.amountUsd)} onSave={(v) => saveItemField(item.id, q.id, "amountUsd", v)} placeholder="0.00" type="number" />
                      )}
                    </td>
                    {/* Amount CNY */}
                    <td className="py-1 px-2 text-center text-gray-500">
                      {item ? `¥${fmtNum(item.amountCny)}` : ""}
                    </td>
                    {/* Selling Price (¥) - per item */}
                    <td className="py-1 px-2 text-center">
                      {item && (
                        <EditableCell value={fmtNum(item.sellingPrice)} onSave={(v) => saveItemField(item.id, q.id, "sellingPrice", v)} placeholder="0.00" type="number" />
                      )}
                    </td>
                    {/* Shipping Charged ($) - auto calculated */}
                    <td className="py-1 px-2 text-center text-blue-600 text-xs">
                      {item ? (() => {
                        const amountCny = parseFloat(item.amountCny || "0");
                        const sellingPrice = parseFloat(item.sellingPrice || "0");
                        const shippingCny = amountCny - sellingPrice;
                        const amountUsd = parseFloat(item.amountUsd || "0");
                        const rate = amountCny > 0 ? amountUsd / amountCny : 0;
                        const shippingUsd = shippingCny * rate;
                        return `$${fmtNum(shippingUsd)}`;
                      })() : ""}
                    </td>
                    {/* Remarks */}
                    <td className="py-1 px-2 text-center">
                      {item && (
                        <EditableCell value={item.remarks || ""} onSave={(v) => saveItemField(item.id, q.id, "remarks", v)} placeholder="备注" />
                      )}
                    </td>
                    {/* Delete item button for child rows */}
                    <td className="py-1 px-1 text-center">
                      {item && (
                        <button
                          onClick={() => {
                            if (confirm("确定要删除此商品行吗？")) {
                              deleteItemMutation.mutate({ id: item.id, quotationId: q.id });
                            }
                          }}
                          className="text-red-400 hover:text-red-600 p-0.5 rounded hover:bg-red-50 transition-colors"
                          title="删除此商品"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}


            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {total > 50 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>上一页</Button>
          <span className="text-xs text-muted-foreground">第 {page} 页</span>
          <Button size="sm" variant="outline" disabled={page * 50 >= total} onClick={() => setPage(p => p + 1)}>下一页</Button>
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>新建报价表</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>客户名字 *</Label>
              <Input
                placeholder="输入客户名字"
                value={form.customerName}
                onChange={(e) => setForm({ ...form, customerName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>客户WhatsApp</Label>
              <Input
                placeholder="WhatsApp号码"
                value={form.customerWhatsapp}
                onChange={(e) => setForm({ ...form, customerWhatsapp: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>联系方式</Label>
              <Input
                placeholder="电话 / 邮箱 / 地址"
                value={form.contactInfo}
                onChange={(e) => setForm({ ...form, contactInfo: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>账号</Label>
              <AccountSelect
                value={form.account}
                onValueChange={(v) => setForm({ ...form, account: v })}
                placeholder="选择账号"
              />
            </div>
            <div className="space-y-2">
              <Label>备注</Label>
              <Input
                placeholder="备注信息"
                value={form.remarks}
                onChange={(e) => setForm({ ...form, remarks: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending} className="bg-emerald-600 hover:bg-emerald-700">
              {createMutation.isPending ? "创建中..." : "创建"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image Preview Dialog */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="max-w-2xl p-2">
          {previewImage && <img src={previewImage} alt="" className="w-full rounded" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
