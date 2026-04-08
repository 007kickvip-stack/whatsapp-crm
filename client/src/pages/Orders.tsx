import { useState, useMemo } from "react";
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
  Image as ImageIcon,
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
  orderStatus: "待处理",
  paymentStatus: "未付款",
  remarks: "",
};

const ORDER_STATUSES = ["待处理", "已发货", "已签收", "已完成", "已取消"];
const PAYMENT_STATUSES = ["未付款", "待付款", "已付款", "部分付款"];

// Format number to 2 decimal places, return "-" for 0 or null
function fmtNum(val: string | number | null | undefined): string {
  const n = Number(val);
  if (!val && val !== 0) return "";
  return n === 0 ? "0" : n.toFixed(2);
}

// Format percentage
function fmtPct(val: string | number | null | undefined): string {
  const n = Number(val);
  if (!val && val !== 0) return "";
  return n === 0 ? "0%" : (n * 100).toFixed(1) + "%";
}

// Status color mapping
function statusColor(status: string | null): string {
  switch (status) {
    case "已完成": return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "已发货": return "bg-blue-50 text-blue-700 border-blue-200";
    case "已签收": return "bg-teal-50 text-teal-700 border-teal-200";
    case "待处理": return "bg-amber-50 text-amber-700 border-amber-200";
    case "已取消": return "bg-red-50 text-red-700 border-red-200";
    default: return "bg-gray-50 text-gray-700 border-gray-200";
  }
}

function paymentColor(status: string | null): string {
  switch (status) {
    case "已付款": return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "待付款": return "bg-amber-50 text-amber-700 border-amber-200";
    case "部分付款": return "bg-blue-50 text-blue-700 border-blue-200";
    case "未付款": return "bg-red-50 text-red-700 border-red-200";
    default: return "bg-gray-50 text-gray-700 border-gray-200";
  }
}

// Profit color
function profitColor(val: string | number | null | undefined): string {
  const n = Number(val);
  if (n > 0) return "text-emerald-600";
  if (n < 0) return "text-red-500";
  return "text-muted-foreground";
}

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

  const createMutation = trpc.orders.create.useMutation({
    onSuccess: (result) => {
      toast.success("订单创建成功");
      utils.orders.list.invalidate();
      setDialogOpen(false);
      setForm(emptyOrderForm);
      setLocation(`/orders/${result.id}`);
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

  // Column definitions matching the Excel template exactly
  const columns = [
    { key: "date", label: "日期", width: "90px", sticky: false },
    { key: "staffName", label: "客服名字", width: "80px", sticky: false },
    { key: "account", label: "账号", width: "70px", sticky: false },
    { key: "whatsapp", label: "客户WhatsApp", width: "140px", sticky: false },
    { key: "customerType", label: "客户属性", width: "80px", sticky: false },
    { key: "orderNumber", label: "订单编号", width: "180px", sticky: false },
    { key: "orderImage", label: "订单图片", width: "70px", sticky: false },
    { key: "size", label: "Size", width: "70px", sticky: false },
    { key: "domesticTracking", label: "国内单号", width: "140px", sticky: false },
    { key: "sizeRec", label: "推荐码数", width: "120px", sticky: false },
    { key: "contactInfo", label: "联系方式", width: "200px", sticky: false },
    { key: "intlTracking", label: "国际跟踪单号", width: "140px", sticky: false },
    { key: "shipDate", label: "发出日期", width: "100px", sticky: false },
    { key: "quantity", label: "件数", width: "50px", sticky: false },
    { key: "source", label: "货源", width: "120px", sticky: false },
    { key: "orderStatus", label: "订单状态", width: "80px", sticky: false },
    { key: "amountUsd", label: "总金额$", width: "80px", sticky: false },
    { key: "amountCny", label: "总金额¥", width: "80px", sticky: false },
    { key: "sellingPrice", label: "售价", width: "80px", sticky: false },
    { key: "productCost", label: "产品成本", width: "80px", sticky: false },
    { key: "productProfit", label: "产品毛利润", width: "90px", sticky: false },
    { key: "productProfitRate", label: "产品毛利率", width: "90px", sticky: false },
    { key: "shippingCharged", label: "收取运费(¥)", width: "90px", sticky: false },
    { key: "shippingActual", label: "实际运费", width: "80px", sticky: false },
    { key: "shippingProfit", label: "运费利润", width: "80px", sticky: false },
    { key: "shippingProfitRate", label: "运费利润率", width: "80px", sticky: false },
    { key: "totalProfit", label: "总利润", width: "80px", sticky: false },
    { key: "profitRate", label: "利润率", width: "70px", sticky: false },
    { key: "paymentScreenshot", label: "付款截图", width: "70px", sticky: false },
    { key: "remarks", label: "备注", width: "120px", sticky: false },
    { key: "paymentStatus", label: "付款状态", width: "80px", sticky: false },
  ];

  // Build flat rows: for each order, if it has items, each item is a row.
  // The first item row shows order-level fields (date, staff, whatsapp, customerType).
  // Subsequent item rows show only item-level fields (like the Excel template).
  // If no items, show one row with order-level fields only.
  type FlatRow = {
    orderId: number;
    isFirstRow: boolean;
    itemCount: number; // total items in this order
    // Order-level fields (only shown on first row)
    orderDate: string | null;
    staffName: string | null;
    account: string | null;
    customerWhatsapp: string;
    customerType: string | null;
    orderStatus: string | null;
    // Item-level fields
    itemId?: number;
    orderNumber: string;
    orderImageUrl: string | null;
    size: string | null;
    domesticTrackingNo: string | null;
    sizeRecommendation: string | null;
    contactInfo: string | null;
    internationalTrackingNo: string | null;
    shipDate: string | null;
    quantity: number | null;
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

  const flatRows: FlatRow[] = useMemo(() => {
    if (!data?.data) return [];
    const rows: FlatRow[] = [];
    for (const order of data.data) {
      const items = (order as any).items || [];
      if (items.length === 0) {
        // Order with no items - show one row
        rows.push({
          orderId: order.id,
          isFirstRow: true,
          itemCount: 0,
          orderDate: order.orderDate ? new Date(order.orderDate).toLocaleDateString("zh-CN") : null,
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
        // Order with items - each item is a row
        items.forEach((item: any, idx: number) => {
          rows.push({
            orderId: order.id,
            isFirstRow: idx === 0,
            itemCount: items.length,
            orderDate: idx === 0 ? (order.orderDate ? new Date(order.orderDate).toLocaleDateString("zh-CN") : null) : null,
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
            contactInfo: idx === 0 ? item.contactInfo : null,
            internationalTrackingNo: item.internationalTrackingNo,
            shipDate: item.shipDate,
            quantity: item.quantity,
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
          });
        });
      }
    }
    return rows;
  }, [data]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">订单管理</h1>
          <p className="text-muted-foreground mt-1">
            按模版表格形式展示所有订单及子项
          </p>
        </div>
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
                      <SelectItem key={s} value={s}>{s}</SelectItem>
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
                      <SelectItem key={s} value={s}>{s}</SelectItem>
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
            <div className="p-12 text-center text-muted-foreground">加载中...</div>
          ) : flatRows.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-max min-w-full text-xs border-collapse">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-emerald-600 text-white">
                      {/* Action column */}
                      <th className="py-2 px-2 text-center font-medium border-r border-emerald-500 whitespace-nowrap" style={{ width: "70px" }}>
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
                    {flatRows.map((row, rowIdx) => {
                      const isOrderBoundary = row.isFirstRow;
                      const borderTop = isOrderBoundary ? "border-t-2 border-t-emerald-200" : "border-t border-t-gray-100";
                      const bgClass = isOrderBoundary ? "bg-white" : "bg-gray-50/50";

                      return (
                        <tr
                          key={`${row.orderId}-${rowIdx}`}
                          className={`${borderTop} ${bgClass} hover:bg-emerald-50/40 transition-colors`}
                        >
                          {/* Action buttons - only on first row */}
                          <td className="py-1.5 px-1 text-center border-r border-gray-100">
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
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => {
                                      const order = data?.data?.find((o: any) => o.id === row.orderId);
                                      if (order) handleEdit(order);
                                    }}>
                                      <Edit className="h-3 w-3" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>编辑订单</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => setDeleteId(row.orderId)}>
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>删除订单</TooltipContent>
                                </Tooltip>
                              </div>
                            )}
                          </td>

                          {/* 1. 日期 */}
                          <td className="py-1.5 px-2 border-r border-gray-100 whitespace-nowrap text-center">
                            {row.isFirstRow ? (
                              <span className="font-medium text-gray-700">{row.orderDate || ""}</span>
                            ) : null}
                          </td>

                          {/* 2. 客服名字 */}
                          <td className="py-1.5 px-2 border-r border-gray-100 whitespace-nowrap text-center">
                            {row.isFirstRow ? row.staffName || "" : ""}
                          </td>

                          {/* 3. 账号 */}
                          <td className="py-1.5 px-2 border-r border-gray-100 whitespace-nowrap text-center">
                            {row.isFirstRow ? row.account || "" : ""}
                          </td>

                          {/* 4. 客户WhatsApp */}
                          <td className="py-1.5 px-2 border-r border-gray-100 whitespace-nowrap">
                            {row.isFirstRow ? (
                              <span className="font-medium text-emerald-700">{row.customerWhatsapp}</span>
                            ) : null}
                          </td>

                          {/* 5. 客户属性 */}
                          <td className="py-1.5 px-2 border-r border-gray-100 whitespace-nowrap text-center">
                            {row.isFirstRow && row.customerType ? (
                              <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                row.customerType === "零售复购"
                                  ? "bg-blue-50 text-blue-700"
                                  : "bg-orange-50 text-orange-700"
                              }`}>
                                {row.customerType}
                              </span>
                            ) : null}
                          </td>

                          {/* 6. 订单编号 */}
                          <td className="py-1.5 px-2 border-r border-gray-100 whitespace-nowrap">
                            <button
                              onClick={() => setLocation(`/orders/${row.orderId}`)}
                              className="text-primary hover:underline text-left font-medium"
                            >
                              {row.orderNumber}
                            </button>
                          </td>

                          {/* 7. 订单图片 */}
                          <td className="py-1.5 px-2 border-r border-gray-100 text-center">
                            {row.orderImageUrl ? (
                              <button onClick={() => setPreviewImage(row.orderImageUrl)} className="inline-flex items-center justify-center">
                                <img src={row.orderImageUrl} alt="" className="h-6 w-6 rounded object-cover border" />
                              </button>
                            ) : null}
                          </td>

                          {/* 8. Size */}
                          <td className="py-1.5 px-2 border-r border-gray-100 whitespace-nowrap text-center font-medium">
                            {row.size || ""}
                          </td>

                          {/* 9. 国内单号 */}
                          <td className="py-1.5 px-2 border-r border-gray-100 whitespace-nowrap text-[10px]">
                            {row.domesticTrackingNo || ""}
                          </td>

                          {/* 10. 推荐码数 */}
                          <td className="py-1.5 px-2 border-r border-gray-100 whitespace-nowrap text-[10px]">
                            {row.sizeRecommendation || ""}
                          </td>

                          {/* 11. 联系方式 */}
                          <td className="py-1.5 px-2 border-r border-gray-100 max-w-[200px]">
                            {row.contactInfo ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="text-[10px] leading-tight truncate max-w-[200px] cursor-help">
                                    {row.contactInfo.split("\n")[0]}...
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="bottom" className="max-w-sm whitespace-pre-wrap text-xs">
                                  {row.contactInfo}
                                </TooltipContent>
                              </Tooltip>
                            ) : null}
                          </td>

                          {/* 12. 国际跟踪单号 */}
                          <td className="py-1.5 px-2 border-r border-gray-100 whitespace-nowrap text-[10px]">
                            {row.internationalTrackingNo || ""}
                          </td>

                          {/* 13. 发出日期 */}
                          <td className="py-1.5 px-2 border-r border-gray-100 whitespace-nowrap text-center text-[10px]">
                            {row.shipDate || ""}
                          </td>

                          {/* 14. 件数 */}
                          <td className="py-1.5 px-2 border-r border-gray-100 text-center">
                            {row.quantity || ""}
                          </td>

                          {/* 15. 货源 */}
                          <td className="py-1.5 px-2 border-r border-gray-100 whitespace-nowrap text-[10px]">
                            {row.source || ""}
                          </td>

                          {/* 16. 订单状态 */}
                          <td className="py-1.5 px-2 border-r border-gray-100 text-center">
                            {(row.itemStatus || (row.isFirstRow ? row.orderStatus : null)) ? (
                              <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium border ${statusColor(row.itemStatus || row.orderStatus)}`}>
                                {row.itemStatus || row.orderStatus}
                              </span>
                            ) : null}
                          </td>

                          {/* 17. 总金额$ */}
                          <td className="py-1.5 px-2 border-r border-gray-100 text-right font-mono whitespace-nowrap">
                            {fmtNum(row.amountUsd) ? `$${fmtNum(row.amountUsd)}` : ""}
                          </td>

                          {/* 18. 总金额¥ */}
                          <td className="py-1.5 px-2 border-r border-gray-100 text-right font-mono whitespace-nowrap">
                            {fmtNum(row.amountCny) ? `¥${fmtNum(row.amountCny)}` : ""}
                          </td>

                          {/* 19. 售价 */}
                          <td className="py-1.5 px-2 border-r border-gray-100 text-right font-mono whitespace-nowrap">
                            {fmtNum(row.sellingPrice)}
                          </td>

                          {/* 20. 产品成本 */}
                          <td className="py-1.5 px-2 border-r border-gray-100 text-right font-mono whitespace-nowrap">
                            {fmtNum(row.productCost)}
                          </td>

                          {/* 21. 产品毛利润 */}
                          <td className={`py-1.5 px-2 border-r border-gray-100 text-right font-mono whitespace-nowrap ${profitColor(row.productProfit)}`}>
                            {fmtNum(row.productProfit)}
                          </td>

                          {/* 22. 产品毛利率 */}
                          <td className={`py-1.5 px-2 border-r border-gray-100 text-right font-mono whitespace-nowrap ${profitColor(row.productProfitRate)}`}>
                            {fmtPct(row.productProfitRate)}
                          </td>

                          {/* 23. 收取运费(¥) */}
                          <td className="py-1.5 px-2 border-r border-gray-100 text-right font-mono whitespace-nowrap">
                            {fmtNum(row.shippingCharged)}
                          </td>

                          {/* 24. 实际运费 */}
                          <td className="py-1.5 px-2 border-r border-gray-100 text-right font-mono whitespace-nowrap">
                            {fmtNum(row.shippingActual)}
                          </td>

                          {/* 25. 运费利润 */}
                          <td className={`py-1.5 px-2 border-r border-gray-100 text-right font-mono whitespace-nowrap ${profitColor(row.shippingProfit)}`}>
                            {fmtNum(row.shippingProfit)}
                          </td>

                          {/* 26. 运费利润率 */}
                          <td className={`py-1.5 px-2 border-r border-gray-100 text-right font-mono whitespace-nowrap ${profitColor(row.shippingProfitRate)}`}>
                            {fmtPct(row.shippingProfitRate)}
                          </td>

                          {/* 27. 总利润 */}
                          <td className={`py-1.5 px-2 border-r border-gray-100 text-right font-mono whitespace-nowrap font-medium ${profitColor(row.totalProfit)}`}>
                            {fmtNum(row.totalProfit)}
                          </td>

                          {/* 28. 利润率 */}
                          <td className={`py-1.5 px-2 border-r border-gray-100 text-right font-mono whitespace-nowrap ${profitColor(row.profitRate)}`}>
                            {fmtPct(row.profitRate)}
                          </td>

                          {/* 29. 付款截图 */}
                          <td className="py-1.5 px-2 border-r border-gray-100 text-center">
                            {row.paymentScreenshotUrl ? (
                              <button onClick={() => setPreviewImage(row.paymentScreenshotUrl)} className="inline-flex items-center justify-center">
                                <img src={row.paymentScreenshotUrl} alt="" className="h-6 w-6 rounded object-cover border" />
                              </button>
                            ) : null}
                          </td>

                          {/* 30. 备注 */}
                          <td className="py-1.5 px-2 border-r border-gray-100 max-w-[120px]">
                            {row.remarks ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="text-[10px] truncate max-w-[120px] cursor-help">
                                    {row.remarks}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="bottom" className="max-w-sm whitespace-pre-wrap text-xs">
                                  {row.remarks}
                                </TooltipContent>
                              </Tooltip>
                            ) : null}
                          </td>

                          {/* 31. 付款状态 */}
                          <td className="py-1.5 px-2 text-center">
                            {row.paymentStatus ? (
                              <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium border ${paymentColor(row.paymentStatus)}`}>
                                {row.paymentStatus}
                              </span>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
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
                      <SelectItem key={s} value={s}>{s}</SelectItem>
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
                      <SelectItem key={s} value={s}>{s}</SelectItem>
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
