import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Plus,
  Trash2,
  Search,
  Upload,
  X,
  Loader2,
  Image as ImageIcon,
  Filter,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from "lucide-react";
import AccountSelect from "@/components/AccountSelect";

// ============================================================
// Constants
// ============================================================
const ORDER_STATUS_OPTIONS = [
  "已报货，待发货",
  "待定",
  "缺货",
  "已发送qc视频待确认",
  "已发送qc视频已确认",
  "已发货",
  "单号已发给顾客",
  "顾客已收货",
  "已退款",
];

const ORDER_STATUS_COLORS: Record<string, string> = {
  "已报货，待发货": "bg-yellow-100 text-yellow-800",
  "待定": "bg-gray-100 text-gray-800",
  "缺货": "bg-red-100 text-red-800",
  "已发送qc视频待确认": "bg-blue-100 text-blue-800",
  "已发送qc视频已确认": "bg-indigo-100 text-indigo-800",
  "已发货": "bg-emerald-100 text-emerald-800",
  "单号已发给顾客": "bg-teal-100 text-teal-800",
  "顾客已收货": "bg-green-100 text-green-800",
  "已退款": "bg-pink-100 text-pink-800",
};

// ============================================================
// Helper: format number
// ============================================================
function fmtNum(val: string | number | null | undefined): string {
  const n = parseFloat(String(val || "0"));
  return isNaN(n) ? "0.00" : n.toFixed(2);
}

function formatDate(val: string | Date | null | undefined): string {
  if (!val) return "";
  const d = new Date(val);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
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
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
        className={`cursor-text min-h-[22px] px-0.5 py-0.5 rounded hover:bg-emerald-50 transition-colors ${className}`}
      >
        {value || (
          <span className="text-gray-300 italic text-[10px]">
            {placeholder || "点击编辑"}
          </span>
        )}
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
      className="w-full border border-emerald-300 rounded px-1 py-0.5 text-[11px] outline-none focus:ring-1 focus:ring-emerald-400 bg-white"
    />
  );
}

// ============================================================
// Image Upload Cell
// ============================================================
function ImageUploadCell({
  value,
  onSave,
}: {
  value: string;
  onSave: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(false);
  const uploadMutation = trpc.upload.image.useMutation();
  const cellRef = useRef<HTMLDivElement>(null);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const base64 = (e.target?.result as string).split(",")[1];
          const result = await uploadMutation.mutateAsync({
            base64,
            filename: file.name,
            contentType: file.type,
          });
          onSave(result.url);
        } catch (err: any) {
          toast.error("上传失败: " + err.message);
        } finally {
          setUploading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch {
      setUploading(false);
    }
  };

  const handlePaste = useCallback(
    (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) handleUpload(file);
          break;
        }
      }
    },
    [handleUpload]
  );

  useEffect(() => {
    const el = cellRef.current;
    if (!el) return;
    el.addEventListener("paste", handlePaste as any);
    return () => el.removeEventListener("paste", handlePaste as any);
  }, [handlePaste]);

  if (uploading) {
    return (
      <div className="flex items-center justify-center h-8">
        <Loader2 className="h-3 w-3 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (value) {
    return (
      <div ref={cellRef} tabIndex={0} className="relative group">
        <img
          src={value}
          alt=""
          className="h-10 w-10 object-cover rounded cursor-pointer mx-auto"
          onClick={() => setPreview(true)}
        />
        <button
          className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-3.5 h-3.5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-[8px]"
          onClick={() => onSave("")}
        >
          ×
        </button>
        {preview && (
          <Dialog open={preview} onOpenChange={setPreview}>
            <DialogContent className="max-w-2xl">
              <img src={value} alt="" className="w-full rounded" />
            </DialogContent>
          </Dialog>
        )}
      </div>
    );
  }

  return (
    <div
      ref={cellRef}
      tabIndex={0}
      className="flex items-center justify-center"
    >
      <label className="cursor-pointer text-gray-400 hover:text-emerald-500 transition-colors">
        <Upload className="h-3.5 w-3.5" />
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleUpload(file);
          }}
        />
      </label>
    </div>
  );
}

// ============================================================
// Status Select Component
// ============================================================
function StatusSelect({
  value,
  onValueChange,
}: {
  value: string;
  onValueChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [open]);

  const colorClass = ORDER_STATUS_COLORS[value] || "bg-gray-100 text-gray-800";

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium cursor-pointer transition-all hover:ring-1 hover:ring-emerald-300 ${colorClass}`}
      >
        <span className="truncate max-w-[80px]">{value || "选择状态"}</span>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-[160px] bg-popover border border-border rounded-md shadow-lg max-h-[280px] overflow-y-auto text-[11px]">
          {ORDER_STATUS_OPTIONS.map((opt) => {
            const optColor = ORDER_STATUS_COLORS[opt] || "bg-gray-100 text-gray-800";
            return (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  onValueChange(opt);
                  setOpen(false);
                }}
                className={`w-full text-left px-2 py-1.5 hover:bg-accent/50 transition-colors flex items-center gap-1.5 ${
                  value === opt ? "bg-accent" : ""
                }`}
              >
                <span className={`inline-block px-1.5 py-0.5 rounded-full text-[9px] font-medium ${optColor}`}>
                  {opt}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================
// FlatRow type for grouped display
// ============================================================
type FlatRow = {
  id: number;
  isFirstRow: boolean;
  groupKey: string; // orderNumber or unique fallback
  visibleItemCount: number; // for rowSpan
  totalItemCount: number;
  isCollapsed: boolean;
  // Order-level (shared) fields
  reshipDate: string | null;
  staffName: string | null;
  account: string | null;
  customerWhatsapp: string | null;
  orderNumber: string | null;
  contactInfo: string | null;
  totalProfit: string | null;
  originalOrderId: number | null;
  // Item-level (per-row) fields
  orderImageUrl: string | null;
  size: string | null;
  domesticTrackingNo: string | null;
  sizeRecommendation: string | null;
  internationalTrackingNo: string | null;
  shipDate: string | null;
  quantity: number | null;
  source: string | null;
  orderStatus: string | null;
  reshipReason: string | null;
  customerPaidAmount: string | null;
  reshipCost: string | null;
  actualShipping: string | null;
  logisticsCompensation: string | null;
  profitLoss: string | null;
};

// ============================================================
// Main Component
// ============================================================
export default function ReshipmentsPage() {
  const { user } = useAuth();
  const utils = trpc.useUtils();

  // Filters
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [staffFilter, setStaffFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const pageSize = 50;

  const { data, isLoading } = trpc.reshipments.list.useQuery({
    page,
    pageSize,
    search: search || undefined,
    staffName: staffFilter || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    orderStatus: statusFilter || undefined,
  });

  const createMutation = trpc.reshipments.create.useMutation({
    onSuccess: () => {
      toast.success("补发记录已创建");
      utils.reshipments.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.reshipments.update.useMutation({
    onSuccess: () => {
      utils.reshipments.list.invalidate();
      toast.success("已保存");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.reshipments.delete.useMutation({
    onSuccess: () => {
      toast.success("补发记录已删除");
      utils.reshipments.list.invalidate();
      setDeleteId(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const toggleCollapse = useCallback((groupKey: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  }, []);

  const saveField = useCallback(
    (id: number, field: string, value: string | number) => {
      const payload: any = { id, [field]: value };
      // Auto-calculate profitLoss when related fields change
      if (field === "customerPaidAmount" || field === "reshipCost" || field === "actualShipping") {
        const row = data?.data?.find((r: any) => r.id === id);
        if (row) {
          const customerPaid = parseFloat(field === "customerPaidAmount" ? String(value) : String(row.customerPaidAmount || "0")) || 0;
          const cost = parseFloat(field === "reshipCost" ? String(value) : String(row.reshipCost || "0")) || 0;
          const shipping = parseFloat(field === "actualShipping" ? String(value) : String(row.actualShipping || "0")) || 0;
          payload.profitLoss = String(customerPaid - cost - shipping);
          payload.customerPaidAmount = String(customerPaid);
          payload.reshipCost = String(cost);
          payload.actualShipping = String(shipping);
        }
      }
      updateMutation.mutate(payload);
    },
    [data]
  );

  // Save a shared (order-level) field: update all records in the same group
  const saveGroupField = useCallback(
    (groupKey: string, field: string, value: string | number) => {
      const records = data?.data || [];
      const groupRecords = records.filter((r: any) => {
        const key = r.orderNumber ? r.orderNumber : `__single_${r.id}`;
        return key === groupKey;
      });
      for (const r of groupRecords) {
        updateMutation.mutate({ id: (r as any).id, [field]: value });
      }
    },
    [data]
  );

  const handleAddRow = () => {
    const today = new Date().toISOString().slice(0, 10);
    createMutation.mutate({
      reshipDate: today,
      staffName: user?.name || "",
    });
  };

  const records = data?.data || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / pageSize);

  // Build flat rows grouped by orderNumber
  const flatRows: FlatRow[] = useMemo(() => {
    if (!records.length) return [];

    // Group records by orderNumber
    const groups = new Map<string, any[]>();
    const groupOrder: string[] = [];
    for (const rec of records) {
      const key = rec.orderNumber ? rec.orderNumber : `__single_${rec.id}`;
      if (!groups.has(key)) {
        groups.set(key, []);
        groupOrder.push(key);
      }
      groups.get(key)!.push(rec);
    }

    const rows: FlatRow[] = [];
    for (const key of groupOrder) {
      const groupRecords = groups.get(key)!;
      const isCollapsed = collapsedGroups.has(key);
      const totalItemCount = groupRecords.length;
      const visibleRecords = isCollapsed && totalItemCount > 1 ? [groupRecords[0]] : groupRecords;
      const visibleItemCount = visibleRecords.length;

      visibleRecords.forEach((rec: any, idx: number) => {
        rows.push({
          id: rec.id,
          isFirstRow: idx === 0,
          groupKey: key,
          visibleItemCount,
          totalItemCount,
          isCollapsed,
          // Shared fields (from first record in group)
          reshipDate: idx === 0 ? formatDate(rec.reshipDate) : null,
          staffName: idx === 0 ? rec.staffName : null,
          account: idx === 0 ? rec.account : null,
          customerWhatsapp: idx === 0 ? rec.customerWhatsapp : null,
          orderNumber: idx === 0 ? rec.orderNumber : null,
          contactInfo: idx === 0 ? rec.contactInfo : null,
          totalProfit: idx === 0 ? rec.totalProfit : null,
          originalOrderId: idx === 0 ? rec.originalOrderId : null,
          // Per-row fields
          orderImageUrl: rec.orderImageUrl,
          size: rec.size,
          domesticTrackingNo: rec.domesticTrackingNo,
          sizeRecommendation: rec.sizeRecommendation,
          internationalTrackingNo: rec.internationalTrackingNo,
          shipDate: formatDate(rec.shipDate),
          quantity: rec.quantity,
          source: rec.source,
          orderStatus: rec.orderStatus,
          reshipReason: rec.reshipReason,
          customerPaidAmount: rec.customerPaidAmount,
          reshipCost: rec.reshipCost,
          actualShipping: rec.actualShipping,
          logisticsCompensation: rec.logisticsCompensation,
          profitLoss: rec.profitLoss,
        });
      });
    }
    return rows;
  }, [records, collapsedGroups]);

  // Table columns definition
  const columns = [
    { key: "actions", label: "", width: "36px" },
    { key: "index", label: "#", width: "30px" },
    { key: "reshipDate", label: "日期", width: "90px" },
    { key: "staffName", label: "客服名字", width: "70px" },
    { key: "account", label: "账号", width: "90px" },
    { key: "customerWhatsapp", label: "客户WhatsApp", width: "120px" },
    { key: "orderNumber", label: "订单编号", width: "100px" },
    { key: "orderImageUrl", label: "订单图片", width: "60px" },
    { key: "size", label: "Size", width: "60px" },
    { key: "domesticTrackingNo", label: "补发国内单号", width: "110px" },
    { key: "sizeRecommendation", label: "推荐码数", width: "70px" },
    { key: "contactInfo", label: "联系方式", width: "90px" },
    { key: "internationalTrackingNo", label: "补发国际跟踪单号", width: "110px" },
    { key: "shipDate", label: "发出日期", width: "90px" },
    { key: "quantity", label: "件数", width: "50px" },
    { key: "source", label: "货源", width: "70px" },
    { key: "orderStatus", label: "订单状态", width: "110px" },
    { key: "totalProfit", label: "原订单总利润", width: "90px" },
    { key: "reshipReason", label: "补发原因", width: "120px" },
    { key: "customerPaidAmount", label: "客户补的金额", width: "90px" },
    { key: "reshipCost", label: "补发成本", width: "70px" },
    { key: "actualShipping", label: "补发实际运费", width: "80px" },
    { key: "logisticsCompensation", label: "物流赔偿金额", width: "90px" },
    { key: "profitLoss", label: "盈亏", width: "70px" },
    { key: "delete", label: "操作", width: "50px" },
  ];

  // Counter for group numbering
  let groupCounter = 0;

  const renderRow = (row: FlatRow, rowIdx: number) => {
    const isGroupBoundary = row.isFirstRow;
    const borderTop = isGroupBoundary ? "border-t-2 border-t-emerald-200" : "border-t border-t-gray-100";
    const bgClass = isGroupBoundary ? "bg-white" : "bg-gray-50/50";

    if (isGroupBoundary) groupCounter++;

    return (
      <tr
        key={row.id}
        className={`${borderTop} ${bgClass} hover:bg-gray-50/80 group transition-colors`}
      >
        {/* Action: collapse/expand + delete */}
        {row.isFirstRow && (
          <td
            className="py-1 px-1 text-center border-r border-gray-100 align-middle"
            rowSpan={row.visibleItemCount}
          >
            <div className="flex items-center justify-center gap-0.5">
              {row.totalItemCount > 1 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      className="p-0.5 rounded hover:bg-emerald-100 transition-colors"
                      onClick={() => toggleCollapse(row.groupKey)}
                    >
                      {row.isCollapsed ? (
                        <ChevronDown className="h-3 w-3 text-emerald-600" />
                      ) : (
                        <ChevronUp className="h-3 w-3 text-emerald-600" />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {row.isCollapsed ? `展开 (${row.totalItemCount} 条记录)` : "折叠"}
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </td>
        )}

        {/* # - group number with rowSpan */}
        {row.isFirstRow && (
          <td
            className="px-2 py-1.5 text-center text-gray-400 border-r border-gray-100 align-middle"
            rowSpan={row.visibleItemCount}
          >
            {groupCounter}
            {row.totalItemCount > 1 && (
              <span className="ml-0.5 text-[9px] text-emerald-500 font-medium">
                ({row.totalItemCount})
              </span>
            )}
          </td>
        )}

        {/* 日期 - shared, rowSpan */}
        {row.isFirstRow && (
          <td
            className="px-1 py-1 text-center border-r border-gray-100 align-middle"
            rowSpan={row.visibleItemCount}
          >
            <input
              type="date"
              value={row.reshipDate || ""}
              onChange={(e) => saveGroupField(row.groupKey, "reshipDate", e.target.value)}
              className="w-full text-[11px] text-center bg-transparent border-0 outline-none cursor-pointer hover:bg-emerald-50 rounded px-0.5 py-0.5"
            />
          </td>
        )}

        {/* 客服名字 - shared, rowSpan */}
        {row.isFirstRow && (
          <td
            className="px-1 py-1 text-center border-r border-gray-100 align-middle"
            rowSpan={row.visibleItemCount}
          >
            <EditableCell
              value={row.staffName || ""}
              onSave={(v) => saveGroupField(row.groupKey, "staffName", v)}
              className="text-center"
            />
          </td>
        )}

        {/* 账号 - shared, rowSpan */}
        {row.isFirstRow && (
          <td
            className="px-1 py-1 text-center border-r border-gray-100 align-middle"
            rowSpan={row.visibleItemCount}
          >
            <AccountSelect
              value={row.account || ""}
              onValueChange={(v) => saveGroupField(row.groupKey, "account", v)}
              compact
            />
          </td>
        )}

        {/* 客户WhatsApp - shared, rowSpan */}
        {row.isFirstRow && (
          <td
            className="px-1 py-1 text-center border-r border-gray-100 align-middle"
            rowSpan={row.visibleItemCount}
          >
            <EditableCell
              value={row.customerWhatsapp || ""}
              onSave={(v) => saveGroupField(row.groupKey, "customerWhatsapp", v)}
              className="text-center"
            />
          </td>
        )}

        {/* 订单编号 - shared, rowSpan */}
        {row.isFirstRow && (
          <td
            className="px-1 py-1 text-center border-r border-gray-100 align-middle"
            rowSpan={row.visibleItemCount}
          >
            <EditableCell
              value={row.orderNumber || ""}
              onSave={(v) => saveGroupField(row.groupKey, "orderNumber", v)}
              className="text-center font-medium"
            />
          </td>
        )}

        {/* 订单图片 - per row */}
        <td className="px-1 py-1 text-center border-r border-gray-100">
          <ImageUploadCell
            value={row.orderImageUrl || ""}
            onSave={(url) => saveField(row.id, "orderImageUrl", url)}
          />
        </td>

        {/* Size - per row */}
        <td className="px-1 py-1 text-center border-r border-gray-100">
          <EditableCell
            value={row.size || ""}
            onSave={(v) => saveField(row.id, "size", v)}
            className="text-center"
          />
        </td>

        {/* 国内单号 - per row */}
        <td className="px-1 py-1 text-center border-r border-gray-100">
          <EditableCell
            value={row.domesticTrackingNo || ""}
            onSave={(v) => saveField(row.id, "domesticTrackingNo", v)}
            className="text-center"
          />
        </td>

        {/* 推荐码数 - per row */}
        <td className="px-1 py-1 text-center border-r border-gray-100">
          <EditableCell
            value={row.sizeRecommendation || ""}
            onSave={(v) => saveField(row.id, "sizeRecommendation", v)}
            className="text-center"
          />
        </td>

        {/* 联系方式 - shared, rowSpan */}
        {row.isFirstRow && (
          <td
            className="px-1 py-1 text-center border-r border-gray-100 align-middle max-w-[200px]"
            rowSpan={row.visibleItemCount}
          >
            <EditableCell
              value={row.contactInfo || ""}
              onSave={(v) => saveGroupField(row.groupKey, "contactInfo", v)}
              className="text-center"
              placeholder="联系方式"
            />
          </td>
        )}

        {/* 国际跟踪单号 - per row */}
        <td className="px-1 py-1 text-center border-r border-gray-100">
          <EditableCell
            value={row.internationalTrackingNo || ""}
            onSave={(v) => saveField(row.id, "internationalTrackingNo", v)}
            className="text-center"
          />
        </td>

        {/* 发出日期 - per row */}
        <td className="px-1 py-1 text-center border-r border-gray-100">
          <input
            type="date"
            value={row.shipDate || ""}
            onChange={(e) => saveField(row.id, "shipDate", e.target.value)}
            className="w-full text-[11px] text-center bg-transparent border-0 outline-none cursor-pointer hover:bg-emerald-50 rounded px-0.5 py-0.5"
          />
        </td>

        {/* 件数 - per row */}
        <td className="px-1 py-1 text-center border-r border-gray-100">
          <EditableCell
            value={String(row.quantity || 1)}
            onSave={(v) => saveField(row.id, "quantity", parseInt(v) || 1)}
            type="number"
            className="text-center"
          />
        </td>

        {/* 货源 - per row */}
        <td className="px-1 py-1 text-center border-r border-gray-100">
          <EditableCell
            value={row.source || ""}
            onSave={(v) => saveField(row.id, "source", v)}
            className="text-center"
          />
        </td>

        {/* 订单状态 - per row */}
        <td className="px-1 py-1 text-center border-r border-gray-100">
          <StatusSelect
            value={row.orderStatus || ""}
            onValueChange={(v) => saveField(row.id, "orderStatus", v)}
          />
        </td>

        {/* 总利润 - shared, rowSpan */}
        {row.isFirstRow && (
          <td
            className="px-1 py-1 text-center border-r border-gray-100 align-middle"
            rowSpan={row.visibleItemCount}
          >
            <EditableCell
              value={fmtNum(row.totalProfit)}
              onSave={(v) => saveGroupField(row.groupKey, "totalProfit", v)}
              type="number"
              className="text-center"
            />
          </td>
        )}

        {/* 补发原因 - per row */}
        <td className="px-1 py-1 text-center border-r border-gray-100">
          <EditableCell
            value={row.reshipReason || ""}
            onSave={(v) => saveField(row.id, "reshipReason", v)}
            className="text-center"
            placeholder="填写原因"
          />
        </td>

        {/* 客户补的金额 - per row */}
        <td className="px-1 py-1 text-center border-r border-gray-100">
          <EditableCell
            value={fmtNum(row.customerPaidAmount)}
            onSave={(v) => saveField(row.id, "customerPaidAmount", v)}
            type="number"
            className="text-center"
          />
        </td>

        {/* 补发成本 - per row */}
        <td className="px-1 py-1 text-center border-r border-gray-100">
          <EditableCell
            value={fmtNum(row.reshipCost)}
            onSave={(v) => saveField(row.id, "reshipCost", v)}
            type="number"
            className="text-center"
          />
        </td>

        {/* 补发实际运费 - per row */}
        <td className="px-1 py-1 text-center border-r border-gray-100">
          <EditableCell
            value={fmtNum(row.actualShipping)}
            onSave={(v) => saveField(row.id, "actualShipping", v)}
            type="number"
            className="text-center"
          />
        </td>

        {/* 物流赔偿金额 - per row */}
        <td className="px-1 py-1 text-center border-r border-gray-100">
          <EditableCell
            value={fmtNum(row.logisticsCompensation)}
            onSave={(v) => saveField(row.id, "logisticsCompensation", v)}
            type="number"
            className="text-center"
          />
        </td>

        {/* 盈亏 - per row */}
        <td className="px-1 py-1 text-center border-r border-gray-100">
          {(() => {
            const val = parseFloat(String(row.profitLoss || "0"));
            const color = val > 0 ? "text-green-600" : val < 0 ? "text-red-600" : "text-gray-500";
            return <span className={`font-medium ${color}`}>{fmtNum(val)}</span>;
          })()}
        </td>

        {/* 操作 - per row */}
        <td className="px-1 py-1 text-center">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-destructive hover:text-destructive"
                onClick={() => setDeleteId(row.id)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>删除</TooltipContent>
          </Tooltip>
        </td>
      </tr>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-orange-500" />
            补发表
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            共 {total} 条补发记录
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className="text-xs"
          >
            <Filter className="h-3.5 w-3.5 mr-1" />
            筛选
          </Button>
          <Button
            size="sm"
            onClick={handleAddRow}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            新增补发
          </Button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-white border border-gray-200 rounded-lg p-3 flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[180px]">
            <Label className="text-[10px] text-muted-foreground mb-1 block">搜索</Label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="搜索WhatsApp/订单编号..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="pl-7 h-8 text-xs"
              />
            </div>
          </div>
          <div className="w-[130px]">
            <Label className="text-[10px] text-muted-foreground mb-1 block">开始日期</Label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
              className="h-8 text-xs"
            />
          </div>
          <div className="w-[130px]">
            <Label className="text-[10px] text-muted-foreground mb-1 block">结束日期</Label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
              className="h-8 text-xs"
            />
          </div>
          <div className="w-[120px]">
            <Label className="text-[10px] text-muted-foreground mb-1 block">客服名字</Label>
            <Input
              placeholder="客服名字"
              value={staffFilter}
              onChange={(e) => { setStaffFilter(e.target.value); setPage(1); }}
              className="h-8 text-xs"
            />
          </div>
          <div className="w-[140px]">
            <Label className="text-[10px] text-muted-foreground mb-1 block">订单状态</Label>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="w-full h-8 text-xs border border-input rounded-md px-2 bg-background"
            >
              <option value="">全部状态</option>
              {ORDER_STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setSearch("");
              setDateFrom("");
              setDateTo("");
              setStaffFilter("");
              setStatusFilter("");
              setPage(1);
            }}
            className="h-8 text-xs"
          >
            <X className="h-3 w-3 mr-1" />
            清除
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]" style={{ minWidth: "2500px" }}>
            <thead>
              <tr className="bg-emerald-50 border-b border-gray-200">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className="px-2 py-2 text-center font-semibold text-gray-700 whitespace-nowrap"
                    style={{ width: col.width, minWidth: col.width }}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={columns.length} className="text-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-emerald-500 mx-auto" />
                  </td>
                </tr>
              ) : flatRows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="text-center py-12 text-gray-400">
                    暂无补发记录
                  </td>
                </tr>
              ) : (
                flatRows.map((row, idx) => renderRow(row, idx))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-2">
          <span className="text-xs text-muted-foreground">
            第 {page} / {totalPages} 页，共 {total} 条
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="h-7 text-xs"
            >
              <ChevronLeft className="h-3 w-3" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="h-7 text-xs"
            >
              <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除补发记录</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除此补发记录吗？此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteId) deleteMutation.mutate({ id: deleteId });
              }}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
