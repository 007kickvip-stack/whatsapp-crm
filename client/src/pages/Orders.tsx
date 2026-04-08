import { useState, useMemo, useCallback, useRef } from "react";
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">订单管理</h1>
          <p className="text-muted-foreground mt-1">
            创建和管理客户订单
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

      {/* Order List */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 text-center text-muted-foreground">加载中...</div>
          ) : data?.data && data.data.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">订单编号</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">日期</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">客户 WhatsApp</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">客服</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">订单状态</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">付款状态</th>
                      <th className="text-right py-3 px-4 font-medium text-muted-foreground">金额 $</th>
                      <th className="text-right py-3 px-4 font-medium text-muted-foreground">金额 ¥</th>
                      <th className="text-right py-3 px-4 font-medium text-muted-foreground">利润</th>
                      <th className="text-right py-3 px-4 font-medium text-muted-foreground">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.data.map((order) => (
                      <tr key={order.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                        <td className="py-3 px-4 font-medium">
                          <button
                            onClick={() => setLocation(`/orders/${order.id}`)}
                            className="text-primary hover:underline text-left"
                          >
                            {order.orderNumber}
                          </button>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">
                          {order.orderDate ? new Date(order.orderDate).toLocaleDateString() : "-"}
                        </td>
                        <td className="py-3 px-4">{order.customerWhatsapp}</td>
                        <td className="py-3 px-4">{order.staffName || "-"}</td>
                        <td className="py-3 px-4">
                          <Badge variant="secondary" className="font-normal">
                            {order.orderStatus || "待处理"}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <Badge
                            variant={order.paymentStatus === "已付款" ? "default" : "outline"}
                            className="font-normal"
                          >
                            {order.paymentStatus || "未付款"}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-right font-mono">
                          ${Number(order.totalAmountUsd).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono">
                          ¥{Number(order.totalAmountCny).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono">
                          <span className={Number(order.totalProfit) >= 0 ? "text-emerald-600" : "text-red-500"}>
                            ¥{Number(order.totalProfit).toFixed(2)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setLocation(`/orders/${order.id}`)}>
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(order)}>
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteId(order.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <p className="text-sm text-muted-foreground">共 {data.total} 条记录</p>
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
