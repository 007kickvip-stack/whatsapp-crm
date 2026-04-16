import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Search,
  Edit,
  Trash2,
  Eye,
  Filter,
  X,
  ChevronLeft,
  ChevronRight,
  Package,
  Upload,
  Check,
  Loader2,
  Image as ImageIcon,
  PlusCircle,
  Download,
  FileSpreadsheet,
  ChevronDown,
  ChevronUp,
  Layers,
  ChevronsUpDown,
  ExternalLink,
  RefreshCw,
  DollarSign,
  CheckCircle2,
  XCircle,
  Calculator,
} from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import ExcelImportDialog from "@/components/ExcelImportDialog";
import TrackingDialog from "@/components/TrackingDialog";
import TrackingHoverCard from "@/components/TrackingHoverCard";
import AccountSelect from "@/components/AccountSelect";
import CountrySelect from "@/components/CountrySelect";
import PaymentRecordsPanel from "@/components/PaymentRecordsPanel";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";

type OrderForm = {
  orderDate: string;
  account: string;
  customerWhatsapp: string;
  customerType: string;
  customerName: string;
  orderNumber: string;
  orderStatus: string;
  paymentStatus: string;
  remarks: string;
};

const emptyOrderForm: OrderForm = {
  orderDate: new Date().toISOString().split("T")[0],
  account: "",
  customerWhatsapp: "",
  customerType: "新零售",
  customerName: "",
  orderNumber: "",
  orderStatus: "已报货，待发货",
  paymentStatus: "未收到",
  remarks: "",
};

const ORDER_STATUSES = [
  "已报货，待发货",
  "待定",
  "缺货",
  "已发送qc视频，待确认",
  "已发送qc视频，已确认",
  "已发货",
  "单号已发给顾客",
  "顾客已收货",
  "已退款",
];
const PAYMENT_STATUSES = ["未收到", "收到部分", "已收到全款"];

const ORDER_CATEGORIES = ["服饰", "鞋子", "配饰", "包包", "电子产品", "其他"];

function fmtNum(val: string | number | null | undefined): string {
  const n = Number(val);
  if (!val && val !== 0) return "";
  return n === 0 ? "0" : n.toFixed(2);
}

function fmtPct(val: string | number | null | undefined): string {
  const n = Number(val);
  if (!val && val !== 0) return "";
  return n === 0 ? "0%" : (n * 100).toFixed(1) + "%";
}

function statusColor(status: string | null): string {
  switch (status) {
    case "已报货，待发货": return "bg-orange-100 text-orange-800 border-orange-300";
    case "待定": return "bg-yellow-100 text-yellow-800 border-yellow-300";
    case "缺货": return "bg-yellow-200 text-yellow-900 border-yellow-400";
    case "已发送qc视频，待确认": return "bg-green-100 text-green-800 border-green-300";
    case "已发送qc视频，已确认": return "bg-green-200 text-green-900 border-green-400";
    case "已发货": return "bg-emerald-400 text-white border-emerald-500";
    case "单号已发给顾客": return "bg-purple-100 text-purple-800 border-purple-300";
    case "顾客已收货": return "bg-blue-100 text-blue-800 border-blue-300";
    case "已退款": return "bg-red-100 text-red-800 border-red-300";
    default: return "bg-gray-50 text-gray-700 border-gray-200";
  }
}

function customerTypeColor(type: string | null): string {
  switch (type) {
    case "新零售": return "bg-yellow-200 text-yellow-900 border-yellow-300";
    case "零售复购": return "bg-yellow-400 text-yellow-900 border-yellow-500";

    default: return "bg-gray-100 text-gray-700 border-gray-200";
  }
}

function paymentColor(status: string | null): string {
  switch (status) {
    case "已收到全款": return "bg-emerald-100 text-emerald-800 border-emerald-300";
    case "收到部分": return "bg-blue-100 text-blue-800 border-blue-300";
    case "未收到": return "bg-red-100 text-red-800 border-red-300";
    default: return "bg-gray-100 text-gray-700 border-gray-200";
  }
}

function profitColor(val: string | number | null | undefined): string {
  const n = Number(val);
  if (n > 0) return "text-emerald-600";
  if (n < 0) return "text-red-500";
  return "text-muted-foreground";
}

// 物流状态选项（与后端 STATE_MAP 对应）
const LOGISTICS_STATUSES = [
  { value: "in_transit", label: "在途", color: "bg-blue-100 text-blue-800 border-blue-300" },
  { value: "collected", label: "揽收", color: "bg-cyan-100 text-cyan-800 border-cyan-300" },
  { value: "delivering", label: "派件", color: "bg-indigo-100 text-indigo-800 border-indigo-300" },
  { value: "signed", label: "签收", color: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  { value: "difficult", label: "疑难", color: "bg-red-100 text-red-800 border-red-300" },
  { value: "returned", label: "退回", color: "bg-orange-100 text-orange-800 border-orange-300" },
  { value: "customs", label: "清关", color: "bg-purple-100 text-purple-800 border-purple-300" },
  { value: "refused", label: "拒签", color: "bg-red-200 text-red-900 border-red-400" },
  { value: "unknown", label: "未知", color: "bg-gray-100 text-gray-600 border-gray-200" },
];

function logisticsStatusColor(status: string | null): string {
  const found = LOGISTICS_STATUSES.find((s) => s.value === status);
  return found?.color || "bg-gray-100 text-gray-600 border-gray-200";
}

function logisticsStatusLabel(status: string | null): string {
  const found = LOGISTICS_STATUSES.find((s) => s.value === status);
  return found?.label || "";
}

// ============================================================
// Inline editable cell component
// ============================================================
function EditableCell({
  value,
  onSave,
  type = "text",
  className = "",
  placeholder = "",
  selectOptions,
  selectColorFn,
}: {
  value: string;
  onSave: (val: string) => void;
  type?: "text" | "number" | "date" | "select" | "textarea" | "multiSelect";
  className?: string;
  placeholder?: string;
  selectOptions?: string[];
  selectColorFn?: (val: string | null) => string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      if (inputRef.current instanceof HTMLInputElement) {
        inputRef.current.select();
      }
    }
  }, [editing]);

  const commit = () => {
    setEditing(false);
    if (draft !== value) {
      onSave(draft);
    }
  };

  const cancel = () => {
    setEditing(false);
    setDraft(value);
  };

  // 多选下拉（订购类目）
  if (type === "multiSelect" && selectOptions) {
    const selected = value ? value.split(",").map(s => s.trim()).filter(Boolean) : [];
    return (
      <Popover>
        <PopoverTrigger asChild>
          <div className="cursor-pointer min-h-[22px] px-0.5 py-0.5 rounded hover:bg-emerald-50 transition-colors">
            {selected.length > 0 ? (
              <div className="flex flex-wrap gap-0.5 justify-center">
                {selected.map(item => (
                  <span key={item} className="inline-block px-1 py-0 rounded text-[10px] bg-blue-100 text-blue-800 border border-blue-200">{item}</span>
                ))}
              </div>
            ) : (
              <span className="text-gray-300 italic text-[10px]">{placeholder || "点击选择"}</span>
            )}
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-[180px] p-2" align="start">
          <div className="space-y-1">
            {selectOptions.map(cat => {
              const isChecked = selected.includes(cat);
              return (
                <label key={cat} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5">
                  <Checkbox
                    checked={isChecked}
                    onCheckedChange={(checked) => {
                      const newSel = checked ? [...selected, cat] : selected.filter(s => s !== cat);
                      onSave(newSel.join(","));
                    }}
                  />
                  <span className="text-xs">{cat}</span>
                </label>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  if (type === "select" && selectOptions) {
    if (selectColorFn) {
      return (
        <div className="relative group">
          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium border ${selectColorFn(value)} cursor-pointer`}>
            {value || selectOptions[0]}
          </span>
          <select
            value={value}
            onChange={(e) => onSave(e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer w-full"
          >
            {selectOptions.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
      );
    }
    return (
      <select
        value={value}
        onChange={(e) => onSave(e.target.value)}
        className="w-full bg-transparent border-0 text-[11px] py-0.5 px-0 focus:ring-1 focus:ring-emerald-400 rounded cursor-pointer"
      >
        {selectOptions.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    );
  }

  if (!editing) {
    return (
      <div
        onClick={() => { setDraft(value); setEditing(true); }}
        className={`cursor-text min-h-[22px] px-0.5 py-0.5 rounded hover:bg-emerald-50 transition-colors ${className}`}
        title="点击编辑"
      >
        {value || <span className="text-gray-300 italic text-[10px]">{placeholder || "点击编辑"}</span>}
      </div>
    );
  }

  if (type === "textarea") {
    return (
      <textarea
        ref={inputRef as React.RefObject<HTMLTextAreaElement>}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Escape") cancel();
        }}
        rows={2}
        className="w-full border border-emerald-400 rounded px-1 py-0.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-emerald-400 bg-white"
      />
    );
  }

  return (
    <input
      ref={inputRef as React.RefObject<HTMLInputElement>}
      type={type === "number" ? "number" : type === "date" ? "date" : "text"}
      step={type === "number" ? "0.01" : undefined}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") cancel();
      }}
      className="w-full border border-emerald-400 rounded px-1 py-0.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-emerald-400 bg-white"
      placeholder={placeholder}
    />
  );
}

// ============================================================
// Image upload cell component (supports paste, delete key, remove, drag & drop)
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

  // Handle paste event for image upload
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

  // Handle keyboard delete for image removal
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.key === "Delete" || e.key === "Backspace") && imageUrl && onRemove) {
      e.preventDefault();
      onRemove();
    }
  }, [imageUrl, onRemove]);

  // Drag & drop handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.types.includes("Files")) {
      setIsDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragOver(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.type.startsWith("image/")) {
        handleFile(file);
      } else {
        toast.error("请拖入图片文件");
      }
    }
  }, []);

  return (
    <div
      ref={containerRef}
      className={`flex items-center justify-center rounded p-0.5 transition-all outline-none ${
        isDragOver
          ? "ring-2 ring-emerald-500 bg-emerald-100/70 scale-105"
          : isFocused
            ? "ring-1 ring-emerald-400 bg-emerald-50/50"
            : ""
      }`}
      tabIndex={0}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      onPaste={handlePaste}
      onKeyDown={handleKeyDown}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      title={imageUrl ? "点击查看大图 | 悬停显示删除 | 粘贴/拖拽替换图片" : "点击上传、粘贴或拖拽图片"}
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
// Receiving accounts display - aggregates from payment records
// ============================================================
function ReceivingAccountsDisplay({ orderId, fallbackAccount }: { orderId: number; fallbackAccount: string | null }) {
  const { data: payments } = trpc.orderPayments.listByOrder.useQuery({ orderId });

  // Aggregate unique receiving accounts from payment records
  const accounts = useMemo(() => {
    if (!payments || payments.length === 0) {
      return fallbackAccount ? [fallbackAccount] : [];
    }
    const uniqueAccounts = new Set<string>();
    for (const p of payments) {
      if (p.receivingAccount) uniqueAccounts.add(p.receivingAccount);
    }
    if (uniqueAccounts.size === 0 && fallbackAccount) {
      return [fallbackAccount];
    }
    return Array.from(uniqueAccounts);
  }, [payments, fallbackAccount]);

  if (accounts.length === 0) {
    return <span className="text-gray-400">-</span>;
  }

  if (accounts.length === 1) {
    return <span className="text-gray-700 truncate max-w-[100px] inline-block" title={accounts[0]}>{accounts[0]}</span>;
  }

  return (
    <div className="flex flex-col items-center gap-0.5">
      {accounts.map((acc, i) => (
        <span key={i} className="text-gray-700 text-[10px] leading-tight truncate max-w-[100px] inline-block" title={acc}>
          {acc}
        </span>
      ))}
    </div>
  );
}

// ============================================================
// Main component
// ============================================================
export default function OrdersPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<OrderForm>(emptyOrderForm);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  // Filter states
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterStaffName, setFilterStaffName] = useState("");
  const [filterAccount, setFilterAccount] = useState("");
  const [filterWhatsapp, setFilterWhatsapp] = useState("");
  const [filterCustomerType, setFilterCustomerType] = useState<string>("");
  const [filterOrderNumber, setFilterOrderNumber] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterPayment, setFilterPayment] = useState<string>("");
  const [filterIntlTracking, setFilterIntlTracking] = useState("");
  const [filterLogisticsStatus, setFilterLogisticsStatus] = useState<string>("");
  const [filterCountry, setFilterCountry] = useState<string>("");
  // Payment records panel state
  const [paymentPanelOpen, setPaymentPanelOpen] = useState(false);
  const [paymentPanelOrderId, setPaymentPanelOrderId] = useState<number>(0);
  const [paymentPanelOrderNumber, setPaymentPanelOrderNumber] = useState("");
  const [paymentPanelTotalUsd, setPaymentPanelTotalUsd] = useState("0");
  const [filterExpanded, setFilterExpanded] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [excelImportOpen, setExcelImportOpen] = useState(false);
  const [trackingOpen, setTrackingOpen] = useState(false);
  const [trackingNo, setTrackingNo] = useState("");
  const [trackingType, setTrackingType] = useState<"domestic" | "international">("domestic");
  // Bulk add items inline state
  const [bulkAddCount, setBulkAddCount] = useState(2);
  const bulkCreateMutation = trpc.orderItems.bulkCreate.useMutation({
    onSuccess: (result) => {
      toast.success(`成功添加 ${result.count} 个子项`);
      utils.orders.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });
  // Batch selection state
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<number>>(new Set());
  const toggleSelectOrder = useCallback((orderId: number) => {
    setSelectedOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  }, []);
  // toggleSelectAll defined after data query below
  // Batch completion status mutation
  const batchCompletionMutation = trpc.orderCompletion.batchUpdate.useMutation({
    onSuccess: (result) => {
      toast.success(`成功更新 ${result.count} 个订单的完成状态`);
      utils.orders.list.invalidate();
      setSelectedOrderIds(new Set());
    },
    onError: (err) => toast.error(err.message),
  });
  // Collapse/expand state: set of collapsed order IDs
  const [collapsedOrders, setCollapsedOrders] = useState<Set<number>>(new Set());

  const toggleCollapse = useCallback((orderId: number) => {
    setCollapsedOrders((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  }, []);

  const utils = trpc.useUtils();
  const queryInput = useMemo(
    () => ({
      page,
      pageSize: 20,
      search: search || undefined,
      staffName: filterStaffName || undefined,
      account: filterAccount || undefined,
      customerWhatsapp: filterWhatsapp || undefined,
      customerType: filterCustomerType || undefined,
      orderNumber: filterOrderNumber || undefined,
      orderStatus: filterStatus || undefined,
      paymentStatus: filterPayment || undefined,
      internationalTrackingNo: filterIntlTracking || undefined,
      logisticsStatus: filterLogisticsStatus || undefined,
      dateFrom: filterDateFrom || undefined,
      dateTo: filterDateTo || undefined,
      customerCountry: filterCountry || undefined,
    }),
    [page, search, filterStaffName, filterAccount, filterWhatsapp, filterCustomerType, filterOrderNumber, filterStatus, filterPayment, filterIntlTracking, filterLogisticsStatus, filterDateFrom, filterDateTo, filterCountry]
  );

  const { data, isLoading } = trpc.orders.list.useQuery(queryInput);

  const toggleSelectAll = useCallback(() => {
    if (!data?.data) return;
    const allIds = data.data.map((o: any) => o.id);
    if (selectedOrderIds.size >= allIds.length && allIds.length > 0) {
      setSelectedOrderIds(new Set());
    } else {
      setSelectedOrderIds(new Set(allIds));
    }
  }, [data, selectedOrderIds]);

  const toggleAllCollapse = useCallback(() => {
    if (!data?.data) return;
    const multiItemOrders = data.data.filter((o: any) => (o.items?.length || 0) > 1);
    if (collapsedOrders.size >= multiItemOrders.length && multiItemOrders.length > 0) {
      // All collapsed -> expand all
      setCollapsedOrders(new Set());
    } else {
      // Collapse all multi-item orders
      setCollapsedOrders(new Set(multiItemOrders.map((o: any) => o.id)));
    }
  }, [data, collapsedOrders]);

  const uploadMutation = trpc.upload.image.useMutation();

  const createMutation = trpc.orders.create.useMutation({
    onSuccess: () => {
      toast.success("订单创建成功，可直接在表格中编辑");
      utils.orders.list.invalidate();
      setDialogOpen(false);
      setForm(emptyOrderForm);
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.orders.update.useMutation({
    onSuccess: () => {
      toast.success("订单更新成功");
      utils.orders.list.invalidate();
      setDialogOpen(false);
      setEditingId(null);
      setForm(emptyOrderForm);
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.orders.delete.useMutation({
    onSuccess: () => {
      toast.success("订单已删除");
      utils.orders.list.invalidate();
      setDeleteId(null);
    },
    onError: (err) => toast.error(err.message),
  });

  // Inline update mutations for order-level and item-level fields
  const inlineUpdateOrder = trpc.orders.update.useMutation({
    onSuccess: () => {
      utils.orders.list.invalidate();
      toast.success("已保存");
    },
    onError: (err) => toast.error(err.message),
  });

  const inlineUpdateItem = trpc.orderItems.update.useMutation({
    onSuccess: () => {
      utils.orders.list.invalidate();
      toast.success("已保存");
    },
    onError: (err) => toast.error(err.message),
  });

  const createItemMutation = trpc.orderItems.create.useMutation({
    onSuccess: () => {
      toast.success("子项已添加");
      utils.orders.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  // Create reshipment from order
  const createReshipmentMutation = trpc.reshipments.createFromOrder.useMutation({
    onSuccess: (result) => {
      toast.success(`已创建${result.count}条补发记录，正在跳转到补发表...`);
      setLocation("/reshipments");
    },
    onError: (err) => toast.error(err.message),
  });

  // Create reshipment from single item
  const createReshipmentFromItemMutation = trpc.reshipments.createFromItem.useMutation({
    onSuccess: () => {
      toast.success("子项补发记录已创建，正在跳转到补发表...");
      setLocation("/reshipments");
    },
    onError: (err) => toast.error(err.message),
  });

  // Delete a single order item
  const [deleteItemInfo, setDeleteItemInfo] = useState<{ id: number; orderId: number } | null>(null);
  const deleteItemMutation = trpc.orderItems.delete.useMutation({
    onSuccess: () => {
      toast.success("子项已删除");
      utils.orders.list.invalidate();
      setDeleteItemInfo(null);
    },
    onError: (err) => toast.error(err.message),
  });

  // 订单完成状态更新
  const completionStatusMutation = trpc.orderCompletion.update.useMutation({
    onSuccess: () => {
      toast.success("完成状态已更新");
      utils.orders.list.invalidate();
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Save an order-level field inline
  const saveOrderField = useCallback(
    (orderId: number, field: string, value: string) => {
      inlineUpdateOrder.mutate({ id: orderId, [field]: value } as any);
    },
    []
  );

  // Save an item-level field inline
  const saveItemField = useCallback(
    (itemId: number, orderId: number, field: string, value: string) => {
      inlineUpdateItem.mutate({ id: itemId, orderId, [field]: value } as any);
    },
    []
  );

  const handleSubmit = () => {
    if (!form.customerWhatsapp.trim()) {
      toast.error("客户 WhatsApp 不能为空");
      return;
    }
    if (!form.orderNumber.trim()) {
      toast.error("订单编号不能为空");
      return;
    }
    if (editingId) {
      updateMutation.mutate({ id: editingId, ...form });
    } else {
      createMutation.mutate(form);
    }
  };

  const handleEdit = (order: any) => {
    setEditingId(order.id);
    setForm({
      orderDate: order.orderDate
        ? new Date(order.orderDate).toISOString().split("T")[0]
        : "",
      account: order.account || "",
      customerWhatsapp: order.customerWhatsapp || "",
      customerType: order.customerType || "新零售",
      customerName: order.customerName || "",
      orderNumber: order.orderNumber || "",
      orderStatus: order.orderStatus || "待处理",
      paymentStatus: order.paymentStatus || "未收到",
      remarks: order.remarks || "",
    });
    setDialogOpen(true);
  };

  const clearFilters = () => {
    setFilterDateFrom("");
    setFilterDateTo("");
    setFilterStaffName("");
    setFilterAccount("");
    setFilterWhatsapp("");
    setFilterCustomerType("");
    setFilterOrderNumber("");
    setFilterStatus("");
    setFilterPayment("");
    setFilterIntlTracking("");
    setFilterLogisticsStatus("");
    setFilterCountry("");
    setSearch("");
    setPage(1);
  };

  const hasActiveFilters =
    filterDateFrom || filterDateTo || filterStaffName || filterAccount || filterWhatsapp || filterCustomerType || filterOrderNumber || filterStatus || filterPayment || filterIntlTracking || filterLogisticsStatus || filterCountry;
  const totalPages = Math.ceil((data?.total ?? 0) / 20);

  const exportMutation = trpc.export.orders.useMutation();
  const recalcProfitRates = trpc.orders.recalculateAllProfitRates.useMutation();

  const handleExport = async () => {
    setExporting(true);
    try {
      const filters = {
        search: search || undefined,
        staffName: filterStaffName || undefined,
        account: filterAccount || undefined,
        customerWhatsapp: filterWhatsapp || undefined,
        customerType: filterCustomerType || undefined,
        orderNumber: filterOrderNumber || undefined,
        orderStatus: filterStatus || undefined,
        paymentStatus: filterPayment || undefined,
        internationalTrackingNo: filterIntlTracking || undefined,
        logisticsStatus: filterLogisticsStatus || undefined,
        dateFrom: filterDateFrom || undefined,
        dateTo: filterDateTo || undefined,
      };

      // Call the Excel export endpoint (returns .xlsx with embedded images)
      const response = await fetch("/api/excel-export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filters,
          userId: user?.id,
          userRole: user?.role,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: "导出失败" }));
        throw new Error(errData.error || "导出失败");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `订单导出_${new Date().toISOString().split("T")[0]}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success("导出成功（含图片）");
    } catch (err: any) {
      toast.error(err.message || "导出失败");
    } finally {
      setExporting(false);
    }
  };

  // Column definitions matching the Excel template exactly
  const columns = [
    { key: "date", label: "日期", width: "90px" },
    { key: "staffName", label: "客服名字", width: "80px" },
    { key: "account", label: "账号", width: "70px" },
    { key: "whatsapp", label: "客户WhatsApp", width: "140px" },
    { key: "customerType", label: "客户属性", width: "80px" },
    { key: "orderNumber", label: "订单编号", width: "180px" },
    { key: "orderImage", label: "订单图片", width: "80px" },
    { key: "size", label: "Size", width: "70px" },
    { key: "domesticTracking", label: "国内单号", width: "140px" },
    { key: "sizeRec", label: "推荐码数", width: "120px" },
    { key: "contactInfo", label: "联系方式", width: "200px" },
    { key: "intlTracking", label: "国际跟踪单号", width: "140px" },
    { key: "originalOrderNo", label: "原订单号", width: "140px" },
    { key: "shipDate", label: "发出日期", width: "100px" },
    { key: "quantity", label: "件数", width: "50px" },
    { key: "source", label: "货源", width: "120px" },
    { key: "orderStatus", label: "订单状态", width: "80px" },
    { key: "amountUsd", label: "总金额$", width: "80px" },
    { key: "amountCny", label: "总金额¥", width: "80px" },
    { key: "sellingPrice", label: "售价", width: "80px" },
    { key: "productCost", label: "产品成本", width: "80px" },
    { key: "productProfit", label: "产品毛利润", width: "90px" },
    { key: "productProfitRate", label: "产品毛利率", width: "90px" },
    { key: "shippingCharged", label: "收取运费(¥)", width: "90px" },
    { key: "shippingActual", label: "实际运费", width: "80px" },
    { key: "shippingProfit", label: "运费利润", width: "80px" },
    { key: "shippingProfitRate", label: "运费利润率", width: "80px" },
    { key: "totalProfit", label: "总利润", width: "80px" },
    { key: "profitRate", label: "利润率", width: "70px" },
    { key: "paymentScreenshot", label: "付款截图", width: "80px" },
    { key: "paymentAmountDisplay", label: "实际收到($)", width: "100px" },
    { key: "receivingAccount", label: "收款账户", width: "120px" },
    { key: "remarks", label: "备注", width: "120px" },
    { key: "paymentStatus", label: "付款状态", width: "80px" },
    { key: "customerName", label: "客户名字", width: "100px" },
    { key: "customerCountry", label: "国家", width: "80px" },
    { key: "customerTier", label: "客户分层", width: "90px" },
    { key: "orderCategory", label: "订购类目", width: "100px" },
    { key: "customerBirthDate", label: "出生日期", width: "100px" },
    { key: "customerEmail", label: "客户邮箱", width: "140px" },
    { key: "wpEntryDate", label: "进入WP日期", width: "110px" },
    { key: "completionStatus", label: "完成状态", width: "90px" },
  ];

  // Build flat rows
  type FlatRow = {
    orderId: number;
    isFirstRow: boolean;
    itemCount: number;
    visibleItemCount: number; // for rowSpan when collapsed
    totalItemCount: number; // total items in the order
    isCollapsed: boolean;
    orderDate: string | null;
    staffName: string | null;
    account: string | null;
    customerWhatsapp: string;
    customerType: string | null;
    orderStatus: string | null;
    itemId?: number;
    orderNumber: string;
    orderImageUrl: string | null;
    size: string | null;
    domesticTrackingNo: string | null;
    logisticsStatus: string | null;
    logisticsStatusText: string | null;
    sizeRecommendation: string | null;
    contactInfo: string | null;
    internationalTrackingNo: string | null;
    originalOrderNo: string | null;
    shipDate: string | null;
    quantity: string | null;
    source: string | null;
    itemStatus: string | null;
    amountUsd: string | null;
    amountCny: string | null;
    sellingPrice: string | null;
    productCost: string | null;
    productProfit: string | null;
    productProfitRate: string | null;
    shippingCharged: string | null;
    shippingActual: string | null;
    shippingProfit: string | null;
    shippingProfitRate: string | null;
    totalProfit: string | null;
    profitRate: string | null;
    paymentScreenshotUrl: string | null;
    paymentAmount: string | null;
    receivingAccount: string | null;
    orderTotalAmountUsd: string | null;
    remarks: string | null;
    paymentStatus: string | null;
    customerName: string | null;
    customerCountry: string | null;
    customerTier: string | null;
    orderCategory: string | null;
    customerBirthDate: string | null;
    customerEmail: string | null;
    wpEntryDate: string | null;
    completionStatus: string | null;
  };

  // Auto-create initial item for orders that have no items
  const autoCreateRef = useRef<Set<number>>(new Set());
  useEffect(() => {
    if (!data?.data) return;
    for (const order of data.data) {
      const items = (order as any).items || [];
      if (items.length === 0 && !autoCreateRef.current.has(order.id)) {
        autoCreateRef.current.add(order.id);
        createItemMutation.mutate({
          orderId: order.id,
          orderNumber: order.orderNumber,
        });
      }
    }
  }, [data]);

  const flatRows: FlatRow[] = useMemo(() => {
    if (!data?.data) return [];
    const rows: FlatRow[] = [];
    for (const order of data.data) {
      const items = (order as any).items || [];
      const isCollapsed = collapsedOrders.has(order.id);
      const totalItemCount = items.length;
      if (items.length === 0) {
        // Temporary placeholder row while auto-creating item
        rows.push({
          orderId: order.id,
          isFirstRow: true,
          itemCount: 0,
          visibleItemCount: 1,
          totalItemCount: 0,
          isCollapsed: false,
          orderDate: order.orderDate ? new Date(order.orderDate).toISOString().split("T")[0] : null,
          staffName: order.staffName,
          account: order.account,
          customerWhatsapp: order.customerWhatsapp,
          customerType: order.customerType,
          orderStatus: order.orderStatus,
          orderNumber: order.orderNumber,
          orderImageUrl: null,
          size: null,
          domesticTrackingNo: null,
          logisticsStatus: null,
          logisticsStatusText: null,
          sizeRecommendation: null,
          contactInfo: null,
          internationalTrackingNo: null,
          originalOrderNo: null,
          shipDate: null,
          quantity: null,
          source: null,
          itemStatus: null,
          amountUsd: order.totalAmountUsd,
          amountCny: order.totalAmountCny,
          sellingPrice: null,
          productCost: null,
          productProfit: null,
          productProfitRate: null,
          shippingCharged: null,
          shippingActual: null,
          shippingProfit: null,
          shippingProfitRate: null,
          totalProfit: order.totalProfit,
          profitRate: order.totalProfitRate,
          paymentScreenshotUrl: null,
          paymentAmount: order.paymentAmount || null,
          receivingAccount: (order as any).receivingAccount || null,
          orderTotalAmountUsd: order.totalAmountUsd || null,
          remarks: order.remarks,
          paymentStatus: order.paymentStatus,
          customerName: (order as any).customerName || null,
          customerCountry: (order as any).customerCountry || null,
          customerTier: (order as any).customerTier || null,
          orderCategory: (order as any).orderCategory || null,
          customerBirthDate: (order as any).customerBirthDate ? new Date((order as any).customerBirthDate).toISOString().split('T')[0] : null,
          customerEmail: (order as any).customerEmail || null,
          wpEntryDate: (order as any).wpEntryDate ? new Date((order as any).wpEntryDate).toISOString().split('T')[0] : null,
          completionStatus: (order as any).completionStatus || '未完成',
        });
      } else {
        // When collapsed, only show the first item row
        const visibleItems = isCollapsed ? [items[0]] : items;
        const visibleItemCount = visibleItems.length;
        visibleItems.forEach((item: any, idx: number) => {
          rows.push({
            orderId: order.id,
            isFirstRow: idx === 0,
            itemCount: items.length,
            visibleItemCount,
            totalItemCount,
            isCollapsed,
            orderDate: idx === 0 ? (order.orderDate ? new Date(order.orderDate).toISOString().split("T")[0] : null) : null,
            staffName: idx === 0 ? order.staffName : null,
            account: idx === 0 ? order.account : null,
            customerWhatsapp: idx === 0 ? order.customerWhatsapp : "",
            customerType: idx === 0 ? order.customerType : null,
            orderStatus: item.itemStatus || (idx === 0 ? order.orderStatus : null),
            orderNumber: item.orderNumber || order.orderNumber,
            orderImageUrl: item.orderImageUrl,
            size: item.size,
            domesticTrackingNo: item.domesticTrackingNo,
            logisticsStatus: item.logisticsStatus || null,
            logisticsStatusText: item.logisticsStatusText || null,
            sizeRecommendation: item.sizeRecommendation,
            contactInfo: item.contactInfo || (idx === 0 ? null : null),
            internationalTrackingNo: item.internationalTrackingNo,
            originalOrderNo: item.originalOrderNo || null,
            shipDate: item.shipDate,
            quantity: item.quantity?.toString() || null,
            source: item.source,
            itemStatus: item.itemStatus,
            amountUsd: item.amountUsd,
            amountCny: item.amountCny,
            sellingPrice: item.sellingPrice,
            productCost: item.productCost,
            productProfit: item.productProfit,
            productProfitRate: item.productProfitRate,
            shippingCharged: item.shippingCharged,
            shippingActual: item.shippingActual,
            shippingProfit: item.shippingProfit,
            shippingProfitRate: item.shippingProfitRate,
            totalProfit: item.totalProfit,
            profitRate: item.profitRate,
            paymentScreenshotUrl: item.paymentScreenshotUrl,
            paymentAmount: item.paymentAmount || (order as any).paymentAmount || null,
            receivingAccount: idx === 0 ? ((order as any).receivingAccount || null) : null,
            orderTotalAmountUsd: order.totalAmountUsd || null,
            remarks: item.remarks,
            paymentStatus: item.paymentStatus || (idx === 0 ? order.paymentStatus : null),
            customerName: idx === 0 ? ((order as any).customerName || null) : null,
            customerCountry: idx === 0 ? ((order as any).customerCountry || null) : null,
            customerTier: idx === 0 ? ((order as any).customerTier || null) : null,
            orderCategory: idx === 0 ? ((order as any).orderCategory || null) : null,
            customerBirthDate: idx === 0 ? ((order as any).customerBirthDate ? new Date((order as any).customerBirthDate).toISOString().split('T')[0] : null) : null,
            customerEmail: idx === 0 ? ((order as any).customerEmail || null) : null,
            wpEntryDate: idx === 0 ? ((order as any).wpEntryDate ? new Date((order as any).wpEntryDate).toISOString().split('T')[0] : null) : null,
            completionStatus: idx === 0 ? ((order as any).completionStatus || '未完成') : null,
            itemId: item.id,
          });
        });
      }
    }
    return rows;
  }, [data, collapsedOrders]);

  // Render a single table row
  const renderRow = (row: FlatRow, rowIdx: number) => {
    const isOrderBoundary = row.isFirstRow;
    const borderTop = isOrderBoundary ? "border-t-2 border-t-emerald-200" : "border-t border-t-gray-100";
    const bgClass = isOrderBoundary ? "bg-white" : "bg-gray-50/50";
    const hasItem = !!row.itemId;

    return (
      <tr
        key={`${row.orderId}-${row.itemId || "main"}-${rowIdx}`}
        className={`${borderTop} ${bgClass} hover:bg-emerald-50/40 transition-colors group`}
      >
        {/* Action buttons */}
        {/* Checkbox column */}
        {row.isFirstRow && (
          <td
            className="py-1 px-1 text-center border-r border-gray-100 sticky left-0 bg-inherit z-[5]"
            rowSpan={row.visibleItemCount}
          >
            <Checkbox
              checked={selectedOrderIds.has(row.orderId)}
              onCheckedChange={() => toggleSelectOrder(row.orderId)}
            />
          </td>
        )}
        <td className="py-1 px-1 text-center border-r border-gray-100 sticky left-[36px] bg-inherit z-[5]">
          {row.isFirstRow ? (
            <div className="flex items-center justify-center gap-0.5">
              {/* Collapse/expand toggle for multi-item orders */}
              {row.totalItemCount > 1 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-gray-500 hover:text-gray-700"
                      onClick={() => toggleCollapse(row.orderId)}
                    >
                      {row.isCollapsed ? (
                        <ChevronDown className="h-3 w-3" />
                      ) : (
                        <ChevronUp className="h-3 w-3" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {row.isCollapsed ? `展开 (${row.totalItemCount} 个子项)` : "折叠子项"}
                  </TooltipContent>
                </Tooltip>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setLocation(`/orders/${row.orderId}`)}>
                    <Eye className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>查看详情</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => setDeleteId(row.orderId)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>删除订单</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-emerald-600 hover:text-emerald-700"
                    onClick={() => {
                      createItemMutation.mutate({
                        orderId: row.orderId,
                        orderNumber: row.orderNumber,
                      });
                    }}
                  >
                    <PlusCircle className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>添加子项</TooltipContent>
              </Tooltip>
              <Popover>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-blue-600 hover:text-blue-700"
                      >
                        <Layers className="h-3 w-3" />
                      </Button>
                    </PopoverTrigger>
                  </TooltipTrigger>
                  <TooltipContent>批量添加子项</TooltipContent>
                </Tooltip>
                <PopoverContent className="w-[200px] p-3" align="start">
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">添加子项数量</p>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={1}
                        max={50}
                        value={bulkAddCount}
                        onChange={(e) => setBulkAddCount(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))}
                        className="h-8 text-sm w-20 text-center"
                      />
                      <Button
                        size="sm"
                        className="h-8 flex-1"
                        disabled={bulkCreateMutation.isPending}
                        onClick={() => {
                          bulkCreateMutation.mutate({
                            orderId: row.orderId,
                            items: Array.from({ length: bulkAddCount }, () => ({
                              orderNumber: row.orderNumber || undefined,
                            })),
                          });
                        }}
                      >
                        {bulkCreateMutation.isPending ? "添加中..." : "确认"}
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-orange-500 hover:text-orange-600"
                    onClick={() => {
                      createReshipmentMutation.mutate({ orderId: row.orderId });
                    }}
                  >
                    <RefreshCw className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>补发</TooltipContent>
              </Tooltip>
            </div>
          ) : hasItem ? (
            <div className="flex items-center justify-center gap-0.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-orange-500 hover:text-orange-600 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => createReshipmentFromItemMutation.mutate({ orderId: row.orderId, itemId: row.itemId! })}
                  >
                    <RefreshCw className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>补发此子项</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive/60 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => setDeleteItemInfo({ id: row.itemId!, orderId: row.orderId })}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>删除此子项</TooltipContent>
              </Tooltip>
            </div>
          ) : null}
        </td>

        {/* 1-4: 日期、客服名字、账号、客户WhatsApp - 使用 rowSpan 合并单元格并垂直居中 */}
        {row.isFirstRow && (
          <>
            <td className="py-1 px-1 border-r border-gray-100 whitespace-nowrap text-center text-[11px] align-middle" rowSpan={row.visibleItemCount || 1}>
              <EditableCell
                value={row.orderDate || ""}
                type="date"
                onSave={(v) => saveOrderField(row.orderId, "orderDate", v)}
                className="font-medium text-gray-700"
              />
            </td>
            <td className="py-1 px-1 border-r border-gray-100 whitespace-nowrap text-center text-[11px] align-middle" rowSpan={row.visibleItemCount || 1}>
              {row.staffName || ""}
            </td>
            <td className="py-1 px-1 border-r border-gray-100 whitespace-nowrap text-center text-[11px] align-middle" rowSpan={row.visibleItemCount || 1}>
              <AccountSelect
                value={row.account || ""}
                onValueChange={(v) => saveOrderField(row.orderId, "account", v)}
                placeholder="账号"
                compact
              />
            </td>
            <td className="py-1 px-1 border-r border-gray-100 whitespace-nowrap text-center text-[11px] align-middle" rowSpan={row.visibleItemCount || 1}>
              <EditableCell
                value={row.customerWhatsapp}
                onSave={(v) => saveOrderField(row.orderId, "customerWhatsapp", v)}
                className="font-medium text-emerald-700"
                placeholder="WhatsApp"
              />
            </td>
          </>
        )}

        {/* 5. 客户属性 - order level, rowSpan合并 */}
        {row.isFirstRow && (
          <td className="py-1 px-1 border-r border-gray-100 whitespace-nowrap text-center text-[11px] align-middle" rowSpan={row.visibleItemCount || 1}>
            <EditableCell
              value={row.customerType || "新零售"}
              type="select"
              selectOptions={["零售复购", "新零售"]}
              onSave={(v) => saveOrderField(row.orderId, "customerType", v)}
              selectColorFn={customerTypeColor}
            />
          </td>
        )}

        {/* 6. 订单编号 - rowSpan合并居中 */}
        {row.isFirstRow && (
          <td className="py-1 px-1 border-r border-gray-100 whitespace-nowrap text-center text-[11px] align-middle" rowSpan={row.visibleItemCount || 1}>
            <button
              onClick={() => setLocation(`/orders/${row.orderId}`)}
              className="text-primary hover:underline text-center font-medium text-[11px]"
            >
              {row.orderNumber}
            </button>
          </td>
        )}

        {/* 7. 订单图片 - item level with upload, paste, delete */}
        <td className="py-1 px-1 border-r border-gray-100 text-center">
          {hasItem ? (
            <ImageUploadCell
              imageUrl={row.orderImageUrl}
              onUploaded={(url) => saveItemField(row.itemId!, row.orderId, "orderImageUrl", url)}
              onRemove={() => saveItemField(row.itemId!, row.orderId, "orderImageUrl", "")}
              onPreview={setPreviewImage}
              uploadMutation={uploadMutation}
            />
          ) : null}
        </td>

        {/* 8. Size - item level editable */}
        <td className="py-1 px-1 border-r border-gray-100 whitespace-nowrap text-center text-[11px]">
          {hasItem ? (
            <EditableCell
              value={row.size || ""}
              onSave={(v) => saveItemField(row.itemId!, row.orderId, "size", v)}
              placeholder="尺码"
              className="font-medium"
            />
          ) : null}
        </td>

        {/* 9. 国内单号 */}
        <td className="py-1 px-1 border-r border-gray-100 whitespace-nowrap text-center text-[11px]">
          {hasItem ? (
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-0.5">
                <EditableCell
                  value={row.domesticTrackingNo || ""}
                  onSave={(v) => saveItemField(row.itemId!, row.orderId, "domesticTrackingNo", v)}
                  placeholder="国内单号"
                />
                {row.domesticTrackingNo && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => { setTrackingNo(row.domesticTrackingNo!); setTrackingType("domestic"); setTrackingOpen(true); }}
                        className="shrink-0 p-0.5 rounded hover:bg-emerald-50 text-emerald-600 hover:text-emerald-700 transition-colors"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top">查询国内物流</TooltipContent>
                  </Tooltip>
                )}
              </div>
              {row.domesticTrackingNo && (
                <TrackingHoverCard trackingNo={row.domesticTrackingNo}>
                  {row.logisticsStatus && row.logisticsStatus !== "unknown" ? (
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-medium border cursor-pointer hover:opacity-80 transition-opacity ${logisticsStatusColor(row.logisticsStatus)}`}>
                      {row.logisticsStatusText || logisticsStatusLabel(row.logisticsStatus)}
                    </span>
                  ) : (
                    <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-medium border cursor-pointer hover:opacity-80 transition-opacity bg-gray-50 text-gray-500 border-gray-200">
                      查看物流
                    </span>
                  )}
                </TrackingHoverCard>
              )}
            </div>
          ) : null}
        </td>

        {/* 10. 推荐码数 */}
        <td className="py-1 px-1 border-r border-gray-100 whitespace-nowrap text-center text-[11px]">
          {hasItem ? (
            <EditableCell
              value={row.sizeRecommendation || ""}
              onSave={(v) => saveItemField(row.itemId!, row.orderId, "sizeRecommendation", v)}
              placeholder="推荐码数"
            />
          ) : null}
        </td>

        {/* 11. 联系方式 - 使用 rowSpan 合并单元格并垂直居中 */}
        {row.isFirstRow && (
          <td className="py-1 px-1 border-r border-gray-100 text-center text-[11px] max-w-[200px] align-middle" rowSpan={row.visibleItemCount || 1}>
            {hasItem ? (
              <EditableCell
                value={row.contactInfo || ""}
                type="textarea"
                onSave={(v) => saveItemField(row.itemId!, row.orderId, "contactInfo", v)}
                placeholder="姓名/电话/地址"
              />
            ) : null}
          </td>
        )}

        {/* 12. 国际跟踪单号 */}
        <td className="py-1 px-1 border-r border-gray-100 whitespace-nowrap text-center text-[11px]">
          {hasItem ? (
            <div className="flex items-center gap-0.5">
              <EditableCell
                value={row.internationalTrackingNo || ""}
                onSave={(v) => saveItemField(row.itemId!, row.orderId, "internationalTrackingNo", v)}
                placeholder="国际单号"
              />
              {row.internationalTrackingNo && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => window.open(`https://t.17track.net/zh-cn#nums=${encodeURIComponent(row.internationalTrackingNo!)}&fc=191512`, '_blank')}
                      className="shrink-0 p-0.5 rounded hover:bg-emerald-50 text-emerald-600 hover:text-emerald-700 transition-colors"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top">在17track查询国际物流</TooltipContent>
                </Tooltip>
              )}
            </div>
          ) : null}
        </td>

        {/* 12.5. 原订单号 */}
        <td className="py-1 px-1 border-r border-gray-100 whitespace-nowrap text-center text-[11px]">
          {hasItem ? (
            <EditableCell
              value={row.originalOrderNo || ""}
              onSave={(v) => saveItemField(row.itemId!, row.orderId, "originalOrderNo", v)}
              placeholder="原订单号"
            />
          ) : null}
        </td>

        {/* 13. 发出日期 */}
        <td className="py-1 px-1 border-r border-gray-100 whitespace-nowrap text-center text-[11px]">
          {hasItem ? (
            <EditableCell
              value={row.shipDate || ""}
              type="date"
              onSave={(v) => saveItemField(row.itemId!, row.orderId, "shipDate", v)}
              placeholder="日期"
            />
          ) : null}
        </td>

        {/* 14. 件数 */}
        <td className="py-1 px-1 border-r border-gray-100 text-center text-[11px]">
          {hasItem ? (
            <EditableCell
              value={row.quantity || ""}
              type="number"
              onSave={(v) => saveItemField(row.itemId!, row.orderId, "quantity", v)}
              placeholder="0"
            />
          ) : null}
        </td>

        {/* 15. 货源 */}
        <td className="py-1 px-1 border-r border-gray-100 whitespace-nowrap text-center text-[11px]">
          {hasItem ? (
            <EditableCell
              value={row.source || ""}
              onSave={(v) => saveItemField(row.itemId!, row.orderId, "source", v)}
              placeholder="货源"
            />
          ) : null}
        </td>

        {/* 16. 订单状态 */}
        <td className="py-1 px-1 border-r border-gray-100 text-center text-[11px]">
          {hasItem ? (
            <EditableCell
              value={row.itemStatus || row.orderStatus || "已报货，待发货"}
              type="select"
              selectOptions={ORDER_STATUSES}
              selectColorFn={statusColor}
              onSave={(v) => saveItemField(row.itemId!, row.orderId, "itemStatus", v)}
            />
          ) : row.isFirstRow ? (
            <EditableCell
              value={row.orderStatus || "已报货，待发货"}
              type="select"
              selectOptions={ORDER_STATUSES}
              selectColorFn={statusColor}
              onSave={(v) => saveOrderField(row.orderId, "orderStatus", v)}
            />
          ) : null}
        </td>

        {/* 17. 总金额$ - editable */}
        <td className="py-1 px-1 border-r border-gray-100 text-center font-mono whitespace-nowrap text-[11px]">
          {hasItem ? (
            <EditableCell
              value={row.amountUsd || ""}
              type="number"
              onSave={(v) => saveItemField(row.itemId!, row.orderId, "amountUsd", v)}
              placeholder="0"
            />
          ) : (
            fmtNum(row.amountUsd) ? `$${fmtNum(row.amountUsd)}` : ""
          )}
        </td>

        {/* 18. 总金额¥ - auto: 总金额$ × 汇率 */}
        <td className="py-1 px-1 border-r border-gray-100 text-center font-mono whitespace-nowrap text-[11px] bg-gray-50/50">
          {fmtNum(row.amountCny) ? `¥${fmtNum(row.amountCny)}` : ""}
        </td>

        {/* 19. 售价 - editable */}
        <td className="py-1 px-1 border-r border-gray-100 text-center font-mono whitespace-nowrap text-[11px]">
          {hasItem ? (
            <EditableCell
              value={row.sellingPrice || ""}
              type="number"
              onSave={(v) => saveItemField(row.itemId!, row.orderId, "sellingPrice", v)}
              placeholder="0"
            />
          ) : null}
        </td>

        {/* 20. 产品成本 - editable */}
        <td className="py-1 px-1 border-r border-gray-100 text-center font-mono whitespace-nowrap text-[11px]">
          {hasItem ? (
            <EditableCell
              value={row.productCost || ""}
              type="number"
              onSave={(v) => saveItemField(row.itemId!, row.orderId, "productCost", v)}
              placeholder="0"
            />
          ) : null}
        </td>

        {/* 21. 产品毛利润 - auto: 售价 - 产品成本 */}
        <td className={`py-1 px-1 border-r border-gray-100 text-center font-mono whitespace-nowrap text-[11px] bg-gray-50/50 ${profitColor(row.productProfit)}`}>
          {fmtNum(row.productProfit)}
        </td>

        {/* 22. 产品毛利率 - auto: 产品毛利润 ÷ 售价 */}
        <td className={`py-1 px-1 border-r border-gray-100 text-center font-mono whitespace-nowrap text-[11px] bg-gray-50/50 ${profitColor(row.productProfitRate)}`}>
          {fmtPct(row.productProfitRate)}
        </td>

        {/* 23. 收取运费(¥) - auto: 总金额¥ - 售价 */}
        <td className="py-1 px-1 border-r border-gray-100 text-center font-mono whitespace-nowrap text-[11px] bg-gray-50/50">
          {fmtNum(row.shippingCharged)}
        </td>

        {/* 24. 实际运费 - editable */}
        <td className="py-1 px-1 border-r border-gray-100 text-center font-mono whitespace-nowrap text-[11px]">
          {hasItem ? (
            <EditableCell
              value={row.shippingActual || ""}
              type="number"
              onSave={(v) => saveItemField(row.itemId!, row.orderId, "shippingActual", v)}
              placeholder="0"
            />
          ) : null}
        </td>

        {/* 25. 运费利润 - auto: 收取运费 - 实际运费 */}
        <td className={`py-1 px-1 border-r border-gray-100 text-center font-mono whitespace-nowrap text-[11px] bg-gray-50/50 ${profitColor(row.shippingProfit)}`}>
          {fmtNum(row.shippingProfit)}
        </td>

        {/* 26. 运费利润率 - auto: 运费利润 ÷ 收取运费 */}
        <td className={`py-1 px-1 border-r border-gray-100 text-center font-mono whitespace-nowrap text-[11px] bg-gray-50/50 ${profitColor(row.shippingProfitRate)}`}>
          {fmtPct(row.shippingProfitRate)}
        </td>

        {/* 27. 总利润 - auto: 产品毛利润 + 运费利润 */}
        <td className={`py-1 px-1 border-r border-gray-100 text-center font-mono whitespace-nowrap text-[11px] font-medium bg-gray-50/50 ${profitColor(row.totalProfit)}`}>
          {fmtNum(row.totalProfit)}
        </td>

        {/* 28. 利润率 - auto: 总利润 ÷ 总金额¥ */}
        <td className={`py-1 px-1 border-r border-gray-100 text-center font-mono whitespace-nowrap text-[11px] bg-gray-50/50 ${profitColor(row.profitRate)}`}>
          {fmtPct(row.profitRate)}
        </td>

        {/* 29. 付款截图 - rowSpan合并居中 */}
        {row.isFirstRow && (
          <td className="py-1 px-1 border-r border-gray-100 text-center align-middle" rowSpan={row.visibleItemCount || 1}>
            <button
              className="w-full h-full flex items-center justify-center cursor-pointer hover:bg-gray-50 rounded transition-colors p-0.5"
              onClick={() => {
                setPaymentPanelOrderId(row.orderId);
                setPaymentPanelOrderNumber(row.orderNumber || "");
                setPaymentPanelTotalUsd(row.orderTotalAmountUsd || "0");
                setPaymentPanelOpen(true);
              }}
              title="查看/管理支付记录"
            >
              <DollarSign className="h-4 w-4 text-green-600" />
            </button>
          </td>
        )}

        {/* 29.5. 付款金额($) - rowSpan合并居中 */}
        {row.isFirstRow && (
          <td className="py-1 px-1 border-r border-gray-100 text-center text-[11px] align-middle" rowSpan={row.visibleItemCount || 1}>
            <button
              className="w-full text-center cursor-pointer hover:bg-gray-50 rounded px-1 py-0.5 transition-colors"
              onClick={() => {
                setPaymentPanelOrderId(row.orderId);
                setPaymentPanelOrderNumber(row.orderNumber || "");
                setPaymentPanelTotalUsd(row.orderTotalAmountUsd || "0");
                setPaymentPanelOpen(true);
              }}
              title="查看/管理支付记录"
            >
              <span className={`font-medium ${parseFloat(row.paymentAmount || "0") > 0 ? "text-green-600" : "text-gray-400"}`}>
                ${parseFloat(row.paymentAmount || "0").toFixed(2)}
              </span>
            </button>
          </td>
        )}

        {/* 29.6. 收款账户 - rowSpan合并居中，从支付记录聚合多项显示 */}
        {row.isFirstRow && (
          <td className="py-1 px-1 border-r border-gray-100 text-center text-[11px] align-middle" rowSpan={row.visibleItemCount || 1}>
            <ReceivingAccountsDisplay orderId={row.orderId} fallbackAccount={row.receivingAccount} />
          </td>
        )}

        {/* 30. 备注 */}
        <td className="py-1 px-1 border-r border-gray-100 text-center text-[11px] max-w-[120px]">
          {hasItem ? (
            <EditableCell
              value={row.remarks || ""}
              type="textarea"
              onSave={(v) => saveItemField(row.itemId!, row.orderId, "remarks", v)}
              placeholder="备注"
            />
          ) : row.isFirstRow ? (
            <EditableCell
              value={row.remarks || ""}
              type="textarea"
              onSave={(v) => saveOrderField(row.orderId, "remarks", v)}
              placeholder="备注"
            />
          ) : null}
        </td>

        {/* 31. 付款状态 - rowSpan合并居中 */}
        {row.isFirstRow && (
          <td className="py-1 px-1 text-center text-[11px] align-middle" rowSpan={row.visibleItemCount || 1}>
            <EditableCell
              value={row.paymentStatus || "未收到"}
              type="select"
              selectOptions={PAYMENT_STATUSES}
              selectColorFn={paymentColor}
              onSave={(v) => saveOrderField(row.orderId, "paymentStatus", v)}
            />
          </td>
        )}

        {/* 客户名字、国家、客户分层、订购类目、出生日期、客户邮箱 - rowSpan合并 */}
        {row.isFirstRow && (
          <>
            <td className="py-1 px-1 text-center text-[11px] align-middle" rowSpan={row.visibleItemCount || 1}>
              <EditableCell
                value={row.customerName || ""}
                type="text"
                onSave={(v) => saveOrderField(row.orderId, "customerName", v)}
                placeholder="客户名字"
              />
            </td>
            <td className="py-1 px-1 text-center text-[11px] align-middle" rowSpan={row.visibleItemCount || 1}>
              <CountrySelect
                value={row.customerCountry || ""}
                onValueChange={(v) => saveOrderField(row.orderId, "customerCountry", v)}
                placeholder="国家"
                compact
              />
            </td>
            <td className="py-1 px-1 text-center text-[11px] align-middle" rowSpan={row.visibleItemCount || 1}>
              <EditableCell
                value={row.customerTier || ""}
                type="select"
                selectOptions={["低质量", "中等质量", "高质量", "批发商-低质量", "批发商-高质量", "经销商-低质量", "经销商-高质量"]}
                onSave={(v) => saveOrderField(row.orderId, "customerTier", v)}
              />
            </td>

            <td className="py-1 px-1 text-center text-[11px] align-middle" rowSpan={row.visibleItemCount || 1}>
              <EditableCell
                value={row.orderCategory || ""}
                type="multiSelect"
                selectOptions={ORDER_CATEGORIES}
                onSave={(v) => saveOrderField(row.orderId, "orderCategory", v)}
                placeholder="订购类目"
              />
            </td>
            <td className="py-1 px-1 text-center text-[11px] align-middle" rowSpan={row.visibleItemCount || 1}>
              <EditableCell
                value={row.customerBirthDate || ""}
                type="date"
                onSave={(v) => saveOrderField(row.orderId, "customerBirthDate", v)}
              />
            </td>
            <td className="py-1 px-1 text-center text-[11px] align-middle" rowSpan={row.visibleItemCount || 1}>
              <EditableCell
                value={row.customerEmail || ""}
                type="text"
                onSave={(v) => saveOrderField(row.orderId, "customerEmail", v)}
                placeholder="客户邮箱"
              />
            </td>
            <td className="py-1 px-1 text-center text-[11px] align-middle" rowSpan={row.visibleItemCount || 1}>
              <EditableCell
                value={row.wpEntryDate || ""}
                type="date"
                onSave={(v) => saveOrderField(row.orderId, "wpEntryDate", v)}
                placeholder="进入WP日期"
              />
            </td>
            {/* 完成状态 */}
            <td className="py-1 px-1 text-center text-[11px] align-middle" rowSpan={row.visibleItemCount || 1}>
              <EditableCell
                value={row.completionStatus || "未完成"}
                type="select"
                selectOptions={["已完成", "未完成"]}
                onSave={(v) => completionStatusMutation.mutate({ orderId: row.orderId, completionStatus: v })}
              />
            </td>
          </>
        )}
      </tr>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">订单管理</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            点击单元格直接编辑 · 支持图片上传 · 利润自动计算
          </p>
        </div>
        <div className="flex gap-2">
          {user?.role === "admin" && (
            <Button
              variant="outline"
              onClick={async () => {
                if (!confirm("确认重算所有订单子项的利润率？\n\n这将根据现有的售价、成本、运费等数据重新计算所有利润率字段。")) return;
                try {
                  toast.info("正在重算利润率，请稍候...");
                  const result = await recalcProfitRates.mutateAsync();
                  toast.success(`利润率重算完成！更新了 ${result.updated} 条子项（共 ${result.totalItems} 条）`);
                  utils.orders.list.invalidate();
                } catch (e: any) {
                  toast.error("重算失败: " + (e.message || "未知错误"));
                }
              }}
              disabled={recalcProfitRates.isPending}
              className="gap-2"
            >
              {recalcProfitRates.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}
              重算利润率
            </Button>
          )}
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={exporting}
            className="gap-2"
          >
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            导出 Excel
          </Button>
          <Button
            variant="outline"
            onClick={() => setExcelImportOpen(true)}
            className="gap-2"
          >
            <FileSpreadsheet className="h-4 w-4" />
            导入 Excel
          </Button>
          <Button
            onClick={() => {
              setEditingId(null);
              setForm(emptyOrderForm);
              setDialogOpen(true);
            }}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            新建订单
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <Card className="border-0 shadow-sm">
        <CardContent className="pt-3 pb-3">
          <div className="flex items-center gap-2 mb-2">
            <Filter className="h-4 w-4 text-emerald-600 shrink-0" />
            <span className="text-sm font-medium text-emerald-700">订单筛选</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFilterExpanded((v) => !v)}
              className="gap-1 text-xs h-6 px-2 text-muted-foreground hover:text-foreground"
            >
              {filterExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {filterExpanded ? "收起" : "展开更多"}
            </Button>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 text-xs h-6 px-2 ml-auto text-red-500 hover:text-red-700 hover:bg-red-50">
                <X className="h-3 w-3" />
                清除全部
              </Button>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-x-3 gap-y-2">
            {/* Row 1 */}
            {/* 开始日期 */}
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">开始日期</Label>
              <Input
                type="date"
                value={filterDateFrom}
                onChange={(e) => { setFilterDateFrom(e.target.value); setPage(1); }}
                className="h-8 text-xs"
              />
            </div>
            {/* 结束日期 */}
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">结束日期</Label>
              <Input
                type="date"
                value={filterDateTo}
                onChange={(e) => { setFilterDateTo(e.target.value); setPage(1); }}
                className="h-8 text-xs"
              />
            </div>
            {/* 客服名字 */}
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">客服名字</Label>
              <Input
                placeholder="输入客服名"
                value={filterStaffName}
                onChange={(e) => { setFilterStaffName(e.target.value); setPage(1); }}
                className="h-8 text-xs"
              />
            </div>
            {/* 账号 */}
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">账号</Label>
              <AccountSelect
                value={filterAccount}
                onValueChange={(v) => { setFilterAccount(v); setPage(1); }}
                showAll
                allLabel="全部账号"
                className="h-8"
              />
            </div>
            {/* 客户WhatsApp */}
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">客户WhatsApp</Label>
              <Input
                placeholder="输入号码"
                value={filterWhatsapp}
                onChange={(e) => { setFilterWhatsapp(e.target.value); setPage(1); }}
                className="h-8 text-xs"
              />
            </div>
          </div>
          {/* Row 2 - collapsible */}
          <div className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-x-3 gap-y-2 overflow-hidden transition-all duration-300 ease-in-out ${filterExpanded ? "mt-2 max-h-[200px] opacity-100" : "max-h-0 opacity-0"}`}>
            {/* 客户属性 */}
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">客户属性</Label>
              <Select value={filterCustomerType} onValueChange={(v) => { setFilterCustomerType(v === "all" ? "" : v); setPage(1); }}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="全部" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  {["零售复购", "新零售"].map((t) => (
                    <SelectItem key={t} value={t}>
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium border ${customerTypeColor(t)}`}>{t}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* 订单编号 */}
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">订单编号</Label>
              <Input
                placeholder="输入编号"
                value={filterOrderNumber}
                onChange={(e) => { setFilterOrderNumber(e.target.value); setPage(1); }}
                className="h-8 text-xs"
              />
            </div>
            {/* 订单状态 */}
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">订单状态</Label>
              <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v === "all" ? "" : v); setPage(1); }}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="全部" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  {ORDER_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium border ${statusColor(s)}`}>{s}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* 付款状态 */}
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">付款状态</Label>
              <Select value={filterPayment} onValueChange={(v) => { setFilterPayment(v === "all" ? "" : v); setPage(1); }}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="全部" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  {PAYMENT_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium border ${paymentColor(s)}`}>{s}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* 国际跟踪单号 */}
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">国际跟踪单号</Label>
              <Input
                placeholder="输入单号"
                value={filterIntlTracking}
                onChange={(e) => { setFilterIntlTracking(e.target.value); setPage(1); }}
                className="h-8 text-xs"
              />
            </div>
          </div>
          {/* Row 3 - collapsible (continued) */}
          <div className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-x-3 gap-y-2 overflow-hidden transition-all duration-300 ease-in-out ${filterExpanded ? "mt-2 max-h-[200px] opacity-100" : "max-h-0 opacity-0"}`}>
            {/* 国内单号状态 */}
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">国内单号状态</Label>
              <Select value={filterLogisticsStatus} onValueChange={(v) => { setFilterLogisticsStatus(v === "all" ? "" : v); setPage(1); }}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="全部" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  {LOGISTICS_STATUSES.filter(s => s.value !== "unknown").map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium border ${s.color}`}>{s.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* 国家 */}
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">国家</Label>
              <CountrySelect
                value={filterCountry}
                onValueChange={(v) => { setFilterCountry(v); setPage(1); }}
                showAll
                allLabel="全部国家"
                className="h-8"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Batch action toolbar */}
      {selectedOrderIds.size > 0 && (
        <Card className="border-0 shadow-sm bg-emerald-50 border-emerald-200">
          <CardContent className="py-2 px-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-emerald-700">
                  已选择 {selectedOrderIds.size} 个订单
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-100"
                  onClick={() => setSelectedOrderIds(new Set())}
                >
                  <X className="h-3 w-3" />
                  取消选择
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  className="h-7 gap-1 text-xs bg-emerald-600 hover:bg-emerald-700"
                  disabled={batchCompletionMutation.isPending}
                  onClick={() => {
                    batchCompletionMutation.mutate({
                      orderIds: Array.from(selectedOrderIds),
                      completionStatus: "已完成",
                    });
                  }}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {batchCompletionMutation.isPending ? "处理中..." : "标记为已完成"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1 text-xs border-orange-300 text-orange-700 hover:bg-orange-50"
                  disabled={batchCompletionMutation.isPending}
                  onClick={() => {
                    batchCompletionMutation.mutate({
                      orderIds: Array.from(selectedOrderIds),
                      completionStatus: "未完成",
                    });
                  }}
                >
                  <XCircle className="h-3.5 w-3.5" />
                  标记为未完成
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Excel-style Table */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 text-center text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
              加载中...
            </div>
          ) : flatRows.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-max min-w-full text-xs border-collapse">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-emerald-600 text-white">
                      <th className="py-2 px-1 text-center font-medium border-r border-emerald-500 whitespace-nowrap sticky left-0 bg-emerald-600 z-20" style={{ width: "36px" }}>
                        <Checkbox
                          checked={data?.data && data.data.length > 0 && selectedOrderIds.size >= data.data.length}
                          onCheckedChange={toggleSelectAll}
                          className="border-white data-[state=checked]:bg-white data-[state=checked]:text-emerald-600"
                        />
                      </th>
                      <th className="py-2 px-2 text-center font-medium border-r border-emerald-500 whitespace-nowrap sticky left-[36px] bg-emerald-600 z-20" style={{ width: "110px" }}>
                        <div className="flex items-center justify-center gap-1">
                          <span>操作</span>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={toggleAllCollapse}
                                className="inline-flex items-center justify-center h-5 w-5 rounded hover:bg-emerald-500 transition-colors"
                              >
                                <ChevronsUpDown className="h-3 w-3" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>全部折叠/展开</TooltipContent>
                          </Tooltip>
                        </div>
                      </th>
                      {columns.map((col) => (
                        <th
                          key={col.key}
                          className="py-2 px-2 text-center font-medium border-r border-emerald-500 whitespace-nowrap"
                          style={{ minWidth: col.width }}
                        >
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {flatRows.map((row, rowIdx) => renderRow(row, rowIdx))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <p className="text-sm text-muted-foreground">共 {data?.total} 条订单</p>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm">{page} / {totalPages}</span>
                    <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="p-12 text-center text-muted-foreground">
              <Package className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>暂无订单数据</p>
              <p className="text-xs mt-1">点击"新建订单"开始创建</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Image Preview Dialog */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="max-w-lg p-2">
          {previewImage && (
            <img src={previewImage} alt="预览" className="w-full rounded" />
          )}
        </DialogContent>
      </Dialog>

      {/* Create/Edit Order Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "编辑订单" : "新建订单"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>订单日期</Label>
                <Input
                  type="date"
                  value={form.orderDate}
                  onChange={(e) => setForm({ ...form, orderDate: e.target.value })}
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
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>客户 WhatsApp *</Label>
                <Input
                  placeholder="+44 7312 035806"
                  value={form.customerWhatsapp}
                  onChange={(e) => setForm({ ...form, customerWhatsapp: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>客户属性</Label>
                <Select value={form.customerType} onValueChange={(v) => setForm({ ...form, customerType: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="零售复购">零售复购</SelectItem>
                    <SelectItem value="新零售">新零售</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>客户名字</Label>
                <Input
                  placeholder="客户名字"
                  value={form.customerName}
                  onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>订单编号 *</Label>
              <Input
                placeholder="例：珠04015806-Zain khan"
                value={form.orderNumber}
                onChange={(e) => setForm({ ...form, orderNumber: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>订单状态</Label>
                <Select value={form.orderStatus} onValueChange={(v) => setForm({ ...form, orderStatus: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ORDER_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium border ${statusColor(s)}`}>{s}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

            </div>
            <div className="space-y-2">
              <Label>备注</Label>
              <Textarea
                placeholder="备注信息"
                value={form.remarks}
                onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
              {createMutation.isPending || updateMutation.isPending ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Excel Import Dialog */}
      <ExcelImportDialog
        open={excelImportOpen}
        onOpenChange={setExcelImportOpen}
        onSuccess={() => utils.orders.list.invalidate()}
      />

      {/* Tracking Dialog */}
      <TrackingDialog
        open={trackingOpen}
        onOpenChange={setTrackingOpen}
        trackingNo={trackingNo}
        type={trackingType}
      />



      {/* Delete Order Confirmation */}
      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除订单</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除此订单及其所有子项吗？此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate({ id: deleteId })}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Item Confirmation */}
      <AlertDialog open={deleteItemInfo !== null} onOpenChange={() => setDeleteItemInfo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除子项</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除此子项吗？删除后订单总额将自动重新计算。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteItemInfo && deleteItemMutation.mutate(deleteItemInfo)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              删除子项
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Payment Records Panel */}
      <PaymentRecordsPanel
        orderId={paymentPanelOrderId}
        orderNumber={paymentPanelOrderNumber}
        totalAmountUsd={paymentPanelTotalUsd}
        open={paymentPanelOpen}
        onOpenChange={setPaymentPanelOpen}
      />
    </div>
  );
}
