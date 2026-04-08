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
} from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";

type OrderForm = {
  orderDate: string;
  account: string;
  customerWhatsapp: string;
  customerType: string;
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
  orderNumber: "",
  orderStatus: "已报货，待发货",
  paymentStatus: "未付款",
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
const PAYMENT_STATUSES = ["未付款", "待付款", "已付款", "部分付款"];

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
    case "定金-新零售": return "bg-pink-400 text-white border-pink-500";
    case "定金-零售复购": return "bg-red-600 text-white border-red-700";
    default: return "bg-gray-100 text-gray-700 border-gray-200";
  }
}

function paymentColor(status: string | null): string {
  switch (status) {
    case "已付款": return "bg-emerald-100 text-emerald-800 border-emerald-300";
    case "待付款": return "bg-amber-100 text-amber-800 border-amber-300";
    case "部分付款": return "bg-blue-100 text-blue-800 border-blue-300";
    case "未付款": return "bg-red-100 text-red-800 border-red-300";
    default: return "bg-gray-100 text-gray-700 border-gray-200";
  }
}

function profitColor(val: string | number | null | undefined): string {
  const n = Number(val);
  if (n > 0) return "text-emerald-600";
  if (n < 0) return "text-red-500";
  return "text-muted-foreground";
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
  type?: "text" | "number" | "date" | "select" | "textarea";
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
// Image upload cell component
// ============================================================
function ImageUploadCell({
  imageUrl,
  onUploaded,
  onPreview,
  uploadMutation,
}: {
  imageUrl: string | null;
  onUploaded: (url: string) => void;
  onPreview: (url: string) => void;
  uploadMutation: any;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

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

  return (
    <div className="flex items-center justify-center gap-1">
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
      {imageUrl ? (
        <button onClick={() => onPreview(imageUrl)} className="inline-flex">
          <img src={imageUrl} alt="" className="h-7 w-7 rounded object-cover border border-emerald-200 hover:border-emerald-400 transition-colors" />
        </button>
      ) : null}
      <button
        onClick={() => fileRef.current?.click()}
        className="inline-flex items-center justify-center h-6 w-6 rounded border border-dashed border-gray-300 hover:border-emerald-400 hover:bg-emerald-50 transition-colors"
        title="上传图片"
      >
        {uploadMutation.isPending ? (
          <Loader2 className="h-3 w-3 animate-spin text-emerald-500" />
        ) : (
          <Upload className="h-3 w-3 text-gray-400" />
        )}
      </button>
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
  const [showFilters, setShowFilters] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterPayment, setFilterPayment] = useState<string>("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterWhatsapp, setFilterWhatsapp] = useState("");
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const utils = trpc.useUtils();
  const queryInput = useMemo(
    () => ({
      page,
      pageSize: 20,
      search: search || undefined,
      orderStatus: filterStatus || undefined,
      paymentStatus: filterPayment || undefined,
      customerWhatsapp: filterWhatsapp || undefined,
      dateFrom: filterDateFrom || undefined,
      dateTo: filterDateTo || undefined,
    }),
    [page, search, filterStatus, filterPayment, filterWhatsapp, filterDateFrom, filterDateTo]
  );

  const { data, isLoading } = trpc.orders.list.useQuery(queryInput);

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
      orderNumber: order.orderNumber || "",
      orderStatus: order.orderStatus || "待处理",
      paymentStatus: order.paymentStatus || "未付款",
      remarks: order.remarks || "",
    });
    setDialogOpen(true);
  };

  const clearFilters = () => {
    setFilterStatus("");
    setFilterPayment("");
    setFilterDateFrom("");
    setFilterDateTo("");
    setFilterWhatsapp("");
    setPage(1);
  };

  const hasActiveFilters =
    filterStatus || filterPayment || filterDateFrom || filterDateTo || filterWhatsapp;
  const totalPages = Math.ceil((data?.total ?? 0) / 20);

  const exportMutation = trpc.export.orders.useMutation();

  const handleExport = async () => {
    setExporting(true);
    try {
      const exportData = await exportMutation.mutateAsync({
        search: search || undefined,
        orderStatus: filterStatus || undefined,
        paymentStatus: filterPayment || undefined,
        customerWhatsapp: filterWhatsapp || undefined,
        dateFrom: filterDateFrom || undefined,
        dateTo: filterDateTo || undefined,
      });
      if (!exportData || exportData.length === 0) {
        toast.error("没有可导出的订单数据");
        return;
      }
      // Build CSV with BOM for Excel compatibility
      const headers = [
        "日期","客服名字","账号","客户WhatsApp","客户属性","订单编号","Size","国内单号",
        "推荐码数","联系方式","国际跟踪单号","发出日期","件数","货源","订单状态",
        "总金额$","总金额￥","售价","产品成本","产品毛利润","产品毛利率",
        "收取运费","实际运费","运费利润","运费利润率","总利润","利润率","备注","付款状态"
      ];
      const rows: string[][] = [];
      for (const order of exportData as any[]) {
        const items = (order.items && order.items.length > 0) ? order.items : [{}];
        for (const item of items) {
          rows.push([
            order.orderDate ? new Date(order.orderDate).toLocaleDateString("zh-CN") : "",
            order.staffName || "",
            order.account || "",
            order.customerWhatsapp || "",
            order.customerType || "",
            item.orderNumber || order.orderNumber || "",
            item.size || "",
            item.domesticTrackingNo || "",
            item.sizeRecommendation || "",
            item.contactInfo || "",
            item.internationalTrackingNo || "",
            item.shipDate || "",
            String(item.quantity || ""),
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
          ]);
        }
      }
      const csvContent = "\uFEFF" + [headers, ...rows].map(row =>
        row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")
      ).join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `订单导出_${new Date().toISOString().split("T")[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success(`成功导出 ${exportData.length} 条订单`);
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
    { key: "remarks", label: "备注", width: "120px" },
    { key: "paymentStatus", label: "付款状态", width: "80px" },
  ];

  // Build flat rows
  type FlatRow = {
    orderId: number;
    isFirstRow: boolean;
    itemCount: number;
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
    sizeRecommendation: string | null;
    contactInfo: string | null;
    internationalTrackingNo: string | null;
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
    remarks: string | null;
    paymentStatus: string | null;
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
      if (items.length === 0) {
        // Temporary placeholder row while auto-creating item
        rows.push({
          orderId: order.id,
          isFirstRow: true,
          itemCount: 0,
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
          sizeRecommendation: null,
          contactInfo: null,
          internationalTrackingNo: null,
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
          remarks: order.remarks,
          paymentStatus: order.paymentStatus,
        });
      } else {
        items.forEach((item: any, idx: number) => {
          rows.push({
            orderId: order.id,
            isFirstRow: idx === 0,
            itemCount: items.length,
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
            sizeRecommendation: item.sizeRecommendation,
            contactInfo: item.contactInfo || (idx === 0 ? null : null),
            internationalTrackingNo: item.internationalTrackingNo,
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
            remarks: item.remarks,
            paymentStatus: item.paymentStatus || (idx === 0 ? order.paymentStatus : null),
            itemId: item.id,
          });
        });
      }
    }
    return rows;
  }, [data]);

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
        <td className="py-1 px-1 text-center border-r border-gray-100 sticky left-0 bg-inherit z-[5]">
          {row.isFirstRow && (
            <div className="flex items-center justify-center gap-0.5">
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
            </div>
          )}
        </td>

        {/* 1. 日期 - order level, editable on first row */}
        <td className="py-1 px-1 border-r border-gray-100 whitespace-nowrap text-center text-[11px]">
          {row.isFirstRow ? (
            <EditableCell
              value={row.orderDate || ""}
              type="date"
              onSave={(v) => saveOrderField(row.orderId, "orderDate", v)}
              className="font-medium text-gray-700"
            />
          ) : null}
        </td>

        {/* 2. 客服名字 - read only */}
        <td className="py-1 px-1 border-r border-gray-100 whitespace-nowrap text-center text-[11px]">
          {row.isFirstRow ? row.staffName || "" : ""}
        </td>

        {/* 3. 账号 - order level editable */}
        <td className="py-1 px-1 border-r border-gray-100 whitespace-nowrap text-center text-[11px]">
          {row.isFirstRow ? (
            <EditableCell
              value={row.account || ""}
              onSave={(v) => saveOrderField(row.orderId, "account", v)}
              placeholder="账号"
            />
          ) : null}
        </td>

        {/* 4. 客户WhatsApp - order level editable */}
        <td className="py-1 px-1 border-r border-gray-100 whitespace-nowrap text-[11px]">
          {row.isFirstRow ? (
            <EditableCell
              value={row.customerWhatsapp}
              onSave={(v) => saveOrderField(row.orderId, "customerWhatsapp", v)}
              className="font-medium text-emerald-700"
              placeholder="WhatsApp"
            />
          ) : null}
        </td>

        {/* 5. 客户属性 - order level select */}
        <td className="py-1 px-1 border-r border-gray-100 whitespace-nowrap text-center text-[11px]">
          {row.isFirstRow ? (
            <EditableCell
              value={row.customerType || "新零售"}
              type="select"
              selectOptions={["新零售", "零售复购", "定金-新零售", "定金-零售复购"]}
              onSave={(v) => saveOrderField(row.orderId, "customerType", v)}
              selectColorFn={customerTypeColor}
            />
          ) : null}
        </td>

        {/* 6. 订单编号 - item level editable */}
        <td className="py-1 px-1 border-r border-gray-100 whitespace-nowrap text-[11px]">
          {hasItem ? (
            <EditableCell
              value={row.orderNumber}
              onSave={(v) => saveItemField(row.itemId!, row.orderId, "orderNumber", v)}
              className="font-medium text-primary"
              placeholder="订单编号"
            />
          ) : (
            <button
              onClick={() => setLocation(`/orders/${row.orderId}`)}
              className="text-primary hover:underline text-left font-medium text-[11px]"
            >
              {row.orderNumber}
            </button>
          )}
        </td>

        {/* 7. 订单图片 - item level with upload */}
        <td className="py-1 px-1 border-r border-gray-100 text-center">
          {hasItem ? (
            <ImageUploadCell
              imageUrl={row.orderImageUrl}
              onUploaded={(url) => saveItemField(row.itemId!, row.orderId, "orderImageUrl", url)}
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
        <td className="py-1 px-1 border-r border-gray-100 whitespace-nowrap text-[11px]">
          {hasItem ? (
            <EditableCell
              value={row.domesticTrackingNo || ""}
              onSave={(v) => saveItemField(row.itemId!, row.orderId, "domesticTrackingNo", v)}
              placeholder="国内单号"
            />
          ) : null}
        </td>

        {/* 10. 推荐码数 */}
        <td className="py-1 px-1 border-r border-gray-100 whitespace-nowrap text-[11px]">
          {hasItem ? (
            <EditableCell
              value={row.sizeRecommendation || ""}
              onSave={(v) => saveItemField(row.itemId!, row.orderId, "sizeRecommendation", v)}
              placeholder="推荐码数"
            />
          ) : null}
        </td>

        {/* 11. 联系方式 */}
        <td className="py-1 px-1 border-r border-gray-100 text-[11px] max-w-[200px]">
          {hasItem ? (
            <EditableCell
              value={row.contactInfo || ""}
              type="textarea"
              onSave={(v) => saveItemField(row.itemId!, row.orderId, "contactInfo", v)}
              placeholder="姓名/电话/地址"
            />
          ) : null}
        </td>

        {/* 12. 国际跟踪单号 */}
        <td className="py-1 px-1 border-r border-gray-100 whitespace-nowrap text-[11px]">
          {hasItem ? (
            <EditableCell
              value={row.internationalTrackingNo || ""}
              onSave={(v) => saveItemField(row.itemId!, row.orderId, "internationalTrackingNo", v)}
              placeholder="国际单号"
            />
          ) : null}
        </td>

        {/* 13. 发出日期 */}
        <td className="py-1 px-1 border-r border-gray-100 whitespace-nowrap text-center text-[11px]">
          {hasItem ? (
            <EditableCell
              value={row.shipDate || ""}
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
        <td className="py-1 px-1 border-r border-gray-100 whitespace-nowrap text-[11px]">
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

        {/* 17. 总金额$ */}
        <td className="py-1 px-1 border-r border-gray-100 text-right font-mono whitespace-nowrap text-[11px]">
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

        {/* 18. 总金额¥ */}
        <td className="py-1 px-1 border-r border-gray-100 text-right font-mono whitespace-nowrap text-[11px]">
          {hasItem ? (
            <EditableCell
              value={row.amountCny || ""}
              type="number"
              onSave={(v) => saveItemField(row.itemId!, row.orderId, "amountCny", v)}
              placeholder="0"
            />
          ) : (
            fmtNum(row.amountCny) ? `¥${fmtNum(row.amountCny)}` : ""
          )}
        </td>

        {/* 19. 售价 */}
        <td className="py-1 px-1 border-r border-gray-100 text-right font-mono whitespace-nowrap text-[11px]">
          {hasItem ? (
            <EditableCell
              value={row.sellingPrice || ""}
              type="number"
              onSave={(v) => saveItemField(row.itemId!, row.orderId, "sellingPrice", v)}
              placeholder="0"
            />
          ) : null}
        </td>

        {/* 20. 产品成本 */}
        <td className="py-1 px-1 border-r border-gray-100 text-right font-mono whitespace-nowrap text-[11px]">
          {hasItem ? (
            <EditableCell
              value={row.productCost || ""}
              type="number"
              onSave={(v) => saveItemField(row.itemId!, row.orderId, "productCost", v)}
              placeholder="0"
            />
          ) : null}
        </td>

        {/* 21. 产品毛利润 - auto calculated, read only */}
        <td className={`py-1 px-1 border-r border-gray-100 text-right font-mono whitespace-nowrap text-[11px] ${profitColor(row.productProfit)}`}>
          {fmtNum(row.productProfit)}
        </td>

        {/* 22. 产品毛利率 - auto calculated, read only */}
        <td className={`py-1 px-1 border-r border-gray-100 text-right font-mono whitespace-nowrap text-[11px] ${profitColor(row.productProfitRate)}`}>
          {fmtPct(row.productProfitRate)}
        </td>

        {/* 23. 收取运费(¥) */}
        <td className="py-1 px-1 border-r border-gray-100 text-right font-mono whitespace-nowrap text-[11px]">
          {hasItem ? (
            <EditableCell
              value={row.shippingCharged || ""}
              type="number"
              onSave={(v) => saveItemField(row.itemId!, row.orderId, "shippingCharged", v)}
              placeholder="0"
            />
          ) : null}
        </td>

        {/* 24. 实际运费 */}
        <td className="py-1 px-1 border-r border-gray-100 text-right font-mono whitespace-nowrap text-[11px]">
          {hasItem ? (
            <EditableCell
              value={row.shippingActual || ""}
              type="number"
              onSave={(v) => saveItemField(row.itemId!, row.orderId, "shippingActual", v)}
              placeholder="0"
            />
          ) : null}
        </td>

        {/* 25. 运费利润 - auto calculated */}
        <td className={`py-1 px-1 border-r border-gray-100 text-right font-mono whitespace-nowrap text-[11px] ${profitColor(row.shippingProfit)}`}>
          {fmtNum(row.shippingProfit)}
        </td>

        {/* 26. 运费利润率 - auto calculated */}
        <td className={`py-1 px-1 border-r border-gray-100 text-right font-mono whitespace-nowrap text-[11px] ${profitColor(row.shippingProfitRate)}`}>
          {fmtPct(row.shippingProfitRate)}
        </td>

        {/* 27. 总利润 - auto calculated */}
        <td className={`py-1 px-1 border-r border-gray-100 text-right font-mono whitespace-nowrap text-[11px] font-medium ${profitColor(row.totalProfit)}`}>
          {fmtNum(row.totalProfit)}
        </td>

        {/* 28. 利润率 - auto calculated */}
        <td className={`py-1 px-1 border-r border-gray-100 text-right font-mono whitespace-nowrap text-[11px] ${profitColor(row.profitRate)}`}>
          {fmtPct(row.profitRate)}
        </td>

        {/* 29. 付款截图 - item level with upload */}
        <td className="py-1 px-1 border-r border-gray-100 text-center">
          {hasItem ? (
            <ImageUploadCell
              imageUrl={row.paymentScreenshotUrl}
              onUploaded={(url) => saveItemField(row.itemId!, row.orderId, "paymentScreenshotUrl", url)}
              onPreview={setPreviewImage}
              uploadMutation={uploadMutation}
            />
          ) : null}
        </td>

        {/* 30. 备注 */}
        <td className="py-1 px-1 border-r border-gray-100 text-[11px] max-w-[120px]">
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

        {/* 31. 付款状态 */}
        <td className="py-1 px-1 text-center text-[11px]">
          {hasItem ? (
            <EditableCell
              value={row.paymentStatus || "未付款"}
              type="select"
              selectOptions={PAYMENT_STATUSES}
              selectColorFn={paymentColor}
              onSave={(v) => saveItemField(row.itemId!, row.orderId, "paymentStatus", v)}
            />
          ) : row.isFirstRow ? (
            <EditableCell
              value={row.paymentStatus || "未付款"}
              type="select"
              selectOptions={PAYMENT_STATUSES}
              selectColorFn={paymentColor}
              onSave={(v) => saveOrderField(row.orderId, "paymentStatus", v)}
            />
          ) : null}
        </td>
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

      {/* Search & Filters */}
      <Card className="border-0 shadow-sm">
        <CardContent className="pt-4 pb-4 space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索订单（编号、WhatsApp、客服名）..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-10"
              />
            </div>
            <Button
              variant={showFilters ? "default" : "outline"}
              onClick={() => setShowFilters(!showFilters)}
              className="gap-2"
            >
              <Filter className="h-4 w-4" />
              筛选
              {hasActiveFilters && (
                <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-[10px]">
                  !
                </Badge>
              )}
            </Button>
          </div>

          {showFilters && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-2 border-t">
              <div className="space-y-1">
                <Label className="text-xs">订单状态</Label>
                <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v === "all" ? "" : v); setPage(1); }}>
                  <SelectTrigger className="h-9">
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
              <div className="space-y-1">
                <Label className="text-xs">付款状态</Label>
                <Select value={filterPayment} onValueChange={(v) => { setFilterPayment(v === "all" ? "" : v); setPage(1); }}>
                  <SelectTrigger className="h-9">
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
              <div className="space-y-1">
                <Label className="text-xs">WhatsApp</Label>
                <Input
                  placeholder="客户号码"
                  value={filterWhatsapp}
                  onChange={(e) => { setFilterWhatsapp(e.target.value); setPage(1); }}
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">开始日期</Label>
                <Input
                  type="date"
                  value={filterDateFrom}
                  onChange={(e) => { setFilterDateFrom(e.target.value); setPage(1); }}
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">结束日期</Label>
                <Input
                  type="date"
                  value={filterDateTo}
                  onChange={(e) => { setFilterDateTo(e.target.value); setPage(1); }}
                  className="h-9"
                />
              </div>
              {hasActiveFilters && (
                <div className="col-span-full">
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 text-xs">
                    <X className="h-3 w-3" />
                    清除筛选
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

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
                      <th className="py-2 px-2 text-center font-medium border-r border-emerald-500 whitespace-nowrap sticky left-0 bg-emerald-600 z-20" style={{ width: "90px" }}>
                        操作
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
                <Input
                  placeholder="WhatsApp 账号"
                  value={form.account}
                  onChange={(e) => setForm({ ...form, account: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
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
                    <SelectItem value="新零售">新零售</SelectItem>
                    <SelectItem value="零售复购">零售复购</SelectItem>
                    <SelectItem value="定金-新零售">定金-新零售</SelectItem>
                    <SelectItem value="定金-零售复购">定金-零售复购</SelectItem>
                  </SelectContent>
                </Select>
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
              <div className="space-y-2">
                <Label>付款状态</Label>
                <Select value={form.paymentStatus} onValueChange={(v) => setForm({ ...form, paymentStatus: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium border ${paymentColor(s)}`}>{s}</span>
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

      {/* Delete Confirmation */}
      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
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
    </div>
  );
}
