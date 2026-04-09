import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  CalendarDays, Plus, Pencil, Trash2, RefreshCw, FileText,
  MessageSquare, Users, ShoppingCart, Package, DollarSign, TrendingUp
} from "lucide-react";

function formatDate(d: any): string {
  if (!d) return "";
  const date = new Date(d);
  return date.toISOString().split("T")[0];
}

function formatMoney(v: any): string {
  const n = parseFloat(v) || 0;
  return n.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatPercent(v: any): string {
  const n = parseFloat(v) || 0;
  return (n * 100).toFixed(1) + "%";
}

export default function DailyData() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const today = new Date().toISOString().split("T")[0];
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(today);
  const [staffFilter, setStaffFilter] = useState("__all__");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportDate, setReportDate] = useState(today);

  // 表单状态
  const [form, setForm] = useState({
    reportDate: today,
    staffId: 0,
    staffName: "",
    whatsAccount: "",
    messageCount: 0,
    newCustomerCount: 0,
    newIntentCount: 0,
    returnVisitCount: 0,
    newOrderCount: 0,
    oldOrderCount: 0,
    onlineOrderCount: 0,
    itemCount: 0,
    onlineRevenue: "0",
    telegramPraiseCount: 0,
    referralCount: 0,
  });

  const queryParams = useMemo(() => ({
    startDate,
    endDate,
    staffName: staffFilter === "__all__" ? undefined : staffFilter,
  }), [startDate, endDate, staffFilter]);

  const { data: dailyList = [], isLoading, refetch } = trpc.dailyData.list.useQuery(queryParams);
  const staffListQuery = isAdmin ? trpc.dailyData.staffList.useQuery() : { data: [] };
  const staffList = staffListQuery.data || [];

  const reportQuery = trpc.dailyData.report.useQuery(
    { reportDate, staffName: staffFilter === "__all__" ? undefined : staffFilter },
    { enabled: reportDialogOpen }
  );

  const createMutation = trpc.dailyData.create.useMutation({
    onSuccess: () => {
      toast.success("创建成功");
      setDialogOpen(false);
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.dailyData.update.useMutation({
    onSuccess: () => {
      toast.success("更新成功");
      setDialogOpen(false);
      setEditingId(null);
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.dailyData.delete.useMutation({
    onSuccess: () => {
      toast.success("删除成功");
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const syncMutation = trpc.dailyData.syncOrderData.useMutation({
    onSuccess: () => {
      toast.success("同步成功，订单汇总数据已更新");
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  function resetForm() {
    setForm({
      reportDate: today,
      staffId: 0,
      staffName: "",
      whatsAccount: "",
      messageCount: 0,
      newCustomerCount: 0,
      newIntentCount: 0,
      returnVisitCount: 0,
      newOrderCount: 0,
      oldOrderCount: 0,
      onlineOrderCount: 0,
      itemCount: 0,
      onlineRevenue: "0",
      telegramPraiseCount: 0,
      referralCount: 0,
    });
  }

  function openCreate() {
    resetForm();
    setEditingId(null);
    setDialogOpen(true);
  }

  function openEdit(row: any) {
    setEditingId(row.id);
    setForm({
      reportDate: formatDate(row.reportDate),
      staffId: row.staffId,
      staffName: row.staffName,
      whatsAccount: row.whatsAccount || "",
      messageCount: row.messageCount || 0,
      newCustomerCount: row.newCustomerCount || 0,
      newIntentCount: row.newIntentCount || 0,
      returnVisitCount: row.returnVisitCount || 0,
      newOrderCount: row.newOrderCount || 0,
      oldOrderCount: row.oldOrderCount || 0,
      onlineOrderCount: row.onlineOrderCount || 0,
      itemCount: row.itemCount || 0,
      onlineRevenue: row.onlineRevenue || "0",
      telegramPraiseCount: row.telegramPraiseCount || 0,
      referralCount: row.referralCount || 0,
    });
    setDialogOpen(true);
  }

  function handleSubmit() {
    if (editingId) {
      updateMutation.mutate({
        id: editingId,
        whatsAccount: form.whatsAccount || undefined,
        messageCount: form.messageCount,
        newCustomerCount: form.newCustomerCount,
        newIntentCount: form.newIntentCount,
        returnVisitCount: form.returnVisitCount,
        newOrderCount: form.newOrderCount,
        oldOrderCount: form.oldOrderCount,
        onlineOrderCount: form.onlineOrderCount,
        itemCount: form.itemCount,
        onlineRevenue: form.onlineRevenue,
        telegramPraiseCount: form.telegramPraiseCount,
        referralCount: form.referralCount,
      });
    } else {
      createMutation.mutate({
        reportDate: form.reportDate,
        whatsAccount: form.whatsAccount || undefined,
        messageCount: form.messageCount,
        newCustomerCount: form.newCustomerCount,
        newIntentCount: form.newIntentCount,
        returnVisitCount: form.returnVisitCount,
        newOrderCount: form.newOrderCount,
        oldOrderCount: form.oldOrderCount,
        onlineOrderCount: form.onlineOrderCount,
        itemCount: form.itemCount,
        onlineRevenue: form.onlineRevenue,
        telegramPraiseCount: form.telegramPraiseCount,
        referralCount: form.referralCount,
        ...(isAdmin && form.staffId ? { staffId: form.staffId, staffName: form.staffName } : {}),
      });
    }
  }

  // 汇总当前列表数据
  const totals = useMemo(() => {
    return dailyList.reduce((acc: any, row: any) => {
      acc.messageCount += row.messageCount || 0;
      acc.newCustomerCount += row.newCustomerCount || 0;
      acc.newIntentCount += row.newIntentCount || 0;
      acc.returnVisitCount += row.returnVisitCount || 0;
      acc.newOrderCount += row.newOrderCount || 0;
      acc.oldOrderCount += row.oldOrderCount || 0;
      acc.onlineOrderCount += row.onlineOrderCount || 0;
      acc.itemCount += row.itemCount || 0;
      acc.totalRevenue += parseFloat(row.totalRevenue) || 0;
      acc.onlineRevenue += parseFloat(row.onlineRevenue) || 0;
      acc.productSellingPrice += parseFloat(row.productSellingPrice) || 0;
      acc.shippingCharged += parseFloat(row.shippingCharged) || 0;
      acc.estimatedProfit += parseFloat(row.estimatedProfit) || 0;
      acc.telegramPraiseCount += row.telegramPraiseCount || 0;
      acc.referralCount += row.referralCount || 0;
      return acc;
    }, {
      messageCount: 0, newCustomerCount: 0, newIntentCount: 0, returnVisitCount: 0,
      newOrderCount: 0, oldOrderCount: 0, onlineOrderCount: 0, itemCount: 0,
      totalRevenue: 0, onlineRevenue: 0, productSellingPrice: 0, shippingCharged: 0,
      estimatedProfit: 0, telegramPraiseCount: 0, referralCount: 0,
    });
  }, [dailyList]);

  return (
    <div className="space-y-6">
      {/* 标题和操作栏 */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">每日数据</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {isAdmin ? "查看和管理所有客服的每日工作数据" : "记录和查看您的每日工作数据"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setReportDialogOpen(true)}>
            <FileText className="w-4 h-4 mr-2" />日报表
          </Button>
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" />新增记录
          </Button>
        </div>
      </div>

      {/* 汇总卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs"><MessageSquare className="w-3.5 h-3.5" />消息数</div>
            <p className="text-lg font-bold mt-1">{totals.messageCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs"><Users className="w-3.5 h-3.5" />新客人数</div>
            <p className="text-lg font-bold mt-1">{totals.newCustomerCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs"><ShoppingCart className="w-3.5 h-3.5" />新客单数</div>
            <p className="text-lg font-bold mt-1">{totals.newOrderCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs"><Package className="w-3.5 h-3.5" />件数</div>
            <p className="text-lg font-bold mt-1">{totals.itemCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs"><DollarSign className="w-3.5 h-3.5" />总营业额</div>
            <p className="text-lg font-bold mt-1">¥{formatMoney(totals.totalRevenue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs"><TrendingUp className="w-3.5 h-3.5" />预估毛利润</div>
            <p className="text-lg font-bold mt-1">¥{formatMoney(totals.estimatedProfit)}</p>
          </CardContent>
        </Card>
      </div>

      {/* 筛选栏 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <Label className="text-xs mb-1 block">开始日期</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-40" />
            </div>
            <div>
              <Label className="text-xs mb-1 block">结束日期</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-40" />
            </div>
            {isAdmin && (
              <div>
                <Label className="text-xs mb-1 block">客服</Label>
                <Select value={staffFilter} onValueChange={setStaffFilter}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">全部客服</SelectItem>
                    {staffList.map((s: any) => (
                      <SelectItem key={s.name} value={s.name}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 数据表格 */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-2 text-left font-medium whitespace-nowrap sticky left-0 bg-muted/50 z-10">日期</th>
                  <th className="p-2 text-left font-medium whitespace-nowrap">名字</th>
                  <th className="p-2 text-left font-medium whitespace-nowrap">whats账号</th>
                  <th className="p-2 text-right font-medium whitespace-nowrap">消息数</th>
                  <th className="p-2 text-right font-medium whitespace-nowrap">新客人数</th>
                  <th className="p-2 text-right font-medium whitespace-nowrap">新增意向</th>
                  <th className="p-2 text-right font-medium whitespace-nowrap">回访人数</th>
                  <th className="p-2 text-right font-medium whitespace-nowrap">新客单数</th>
                  <th className="p-2 text-right font-medium whitespace-nowrap">老客单数</th>
                  <th className="p-2 text-right font-medium whitespace-nowrap">线上订单</th>
                  <th className="p-2 text-right font-medium whitespace-nowrap">件数</th>
                  <th className="p-2 text-right font-medium whitespace-nowrap">总营业额</th>
                  <th className="p-2 text-right font-medium whitespace-nowrap">线上营业额</th>
                  <th className="p-2 text-right font-medium whitespace-nowrap">产品售价</th>
                  <th className="p-2 text-right font-medium whitespace-nowrap">收取运费</th>
                  <th className="p-2 text-right font-medium whitespace-nowrap">预估毛利润</th>
                  <th className="p-2 text-right font-medium whitespace-nowrap">预估利润率</th>
                  <th className="p-2 text-right font-medium whitespace-nowrap">电报好评</th>
                  <th className="p-2 text-right font-medium whitespace-nowrap">周转介绍</th>
                  <th className="p-2 text-center font-medium whitespace-nowrap">操作</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={20} className="p-8 text-center text-muted-foreground">加载中...</td></tr>
                ) : dailyList.length === 0 ? (
                  <tr><td colSpan={20} className="p-8 text-center text-muted-foreground">暂无数据，点击"新增记录"开始填写</td></tr>
                ) : (
                  <>
                    {dailyList.map((row: any) => (
                      <tr key={row.id} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="p-2 whitespace-nowrap sticky left-0 bg-background z-10 font-medium">{formatDate(row.reportDate)}</td>
                        <td className="p-2 whitespace-nowrap">{row.staffName}</td>
                        <td className="p-2 whitespace-nowrap text-muted-foreground">{row.whatsAccount || "-"}</td>
                        <td className="p-2 text-right">{row.messageCount || 0}</td>
                        <td className="p-2 text-right">{row.newCustomerCount || 0}</td>
                        <td className="p-2 text-right">{row.newIntentCount || 0}</td>
                        <td className="p-2 text-right">{row.returnVisitCount || 0}</td>
                        <td className="p-2 text-right">{row.newOrderCount || 0}</td>
                        <td className="p-2 text-right">{row.oldOrderCount || 0}</td>
                        <td className="p-2 text-right">{row.onlineOrderCount || 0}</td>
                        <td className="p-2 text-right">{row.itemCount || 0}</td>
                        <td className="p-2 text-right font-medium text-emerald-600">¥{formatMoney(row.totalRevenue)}</td>
                        <td className="p-2 text-right">¥{formatMoney(row.onlineRevenue)}</td>
                        <td className="p-2 text-right">¥{formatMoney(row.productSellingPrice)}</td>
                        <td className="p-2 text-right">¥{formatMoney(row.shippingCharged)}</td>
                        <td className="p-2 text-right font-medium text-blue-600">¥{formatMoney(row.estimatedProfit)}</td>
                        <td className="p-2 text-right">{formatPercent(row.estimatedProfitRate)}</td>
                        <td className="p-2 text-right">{row.telegramPraiseCount || 0}</td>
                        <td className="p-2 text-right">{row.referralCount || 0}</td>
                        <td className="p-2 whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(row)}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="同步订单数据"
                              onClick={() => syncMutation.mutate({ id: row.id })}>
                              <RefreshCw className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                              onClick={() => { if (confirm("确定删除？")) deleteMutation.mutate({ id: row.id }); }}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {/* 汇总行 */}
                    <tr className="border-t-2 bg-muted/50 font-bold">
                      <td className="p-2 sticky left-0 bg-muted/50 z-10">合计</td>
                      <td className="p-2">{dailyList.length}人</td>
                      <td className="p-2"></td>
                      <td className="p-2 text-right">{totals.messageCount}</td>
                      <td className="p-2 text-right">{totals.newCustomerCount}</td>
                      <td className="p-2 text-right">{totals.newIntentCount}</td>
                      <td className="p-2 text-right">{totals.returnVisitCount}</td>
                      <td className="p-2 text-right">{totals.newOrderCount}</td>
                      <td className="p-2 text-right">{totals.oldOrderCount}</td>
                      <td className="p-2 text-right">{totals.onlineOrderCount}</td>
                      <td className="p-2 text-right">{totals.itemCount}</td>
                      <td className="p-2 text-right text-emerald-600">¥{formatMoney(totals.totalRevenue)}</td>
                      <td className="p-2 text-right">¥{formatMoney(totals.onlineRevenue)}</td>
                      <td className="p-2 text-right">¥{formatMoney(totals.productSellingPrice)}</td>
                      <td className="p-2 text-right">¥{formatMoney(totals.shippingCharged)}</td>
                      <td className="p-2 text-right text-blue-600">¥{formatMoney(totals.estimatedProfit)}</td>
                      <td className="p-2 text-right">{totals.totalRevenue > 0 ? formatPercent(totals.estimatedProfit / totals.totalRevenue) : "0.0%"}</td>
                      <td className="p-2 text-right">{totals.telegramPraiseCount}</td>
                      <td className="p-2 text-right">{totals.referralCount}</td>
                      <td className="p-2"></td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 新增/编辑弹窗 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "编辑每日数据" : "新增每日数据"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>日期</Label>
              <Input type="date" value={form.reportDate} onChange={(e) => setForm({ ...form, reportDate: e.target.value })} disabled={!!editingId} />
            </div>
            {isAdmin && !editingId && (
              <div>
                <Label>客服</Label>
                <Select value={form.staffId ? String(form.staffId) : ""} onValueChange={(v) => {
                  const s = staffList.find((s: any) => String(s.id) === v);
                  if (s) setForm({ ...form, staffId: s.id, staffName: s.name });
                }}>
                  <SelectTrigger><SelectValue placeholder="选择客服" /></SelectTrigger>
                  <SelectContent>
                    {staffList.map((s: any) => (
                      <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>whats账号</Label>
              <Input value={form.whatsAccount} onChange={(e) => setForm({ ...form, whatsAccount: e.target.value })} />
            </div>
            <div>
              <Label>消息数</Label>
              <Input type="number" value={form.messageCount} onChange={(e) => setForm({ ...form, messageCount: parseInt(e.target.value) || 0 })} />
            </div>
            <div>
              <Label>新客人数</Label>
              <Input type="number" value={form.newCustomerCount} onChange={(e) => setForm({ ...form, newCustomerCount: parseInt(e.target.value) || 0 })} />
            </div>
            <div>
              <Label>新增意向客户</Label>
              <Input type="number" value={form.newIntentCount} onChange={(e) => setForm({ ...form, newIntentCount: parseInt(e.target.value) || 0 })} />
            </div>
            <div>
              <Label>回访人数</Label>
              <Input type="number" value={form.returnVisitCount} onChange={(e) => setForm({ ...form, returnVisitCount: parseInt(e.target.value) || 0 })} />
            </div>
            <div>
              <Label>新客单数</Label>
              <Input type="number" value={form.newOrderCount} onChange={(e) => setForm({ ...form, newOrderCount: parseInt(e.target.value) || 0 })} />
            </div>
            <div>
              <Label>老客单数</Label>
              <Input type="number" value={form.oldOrderCount} onChange={(e) => setForm({ ...form, oldOrderCount: parseInt(e.target.value) || 0 })} />
            </div>
            <div>
              <Label>线上订单</Label>
              <Input type="number" value={form.onlineOrderCount} onChange={(e) => setForm({ ...form, onlineOrderCount: parseInt(e.target.value) || 0 })} />
            </div>
            <div>
              <Label>件数</Label>
              <Input type="number" value={form.itemCount} onChange={(e) => setForm({ ...form, itemCount: parseInt(e.target.value) || 0 })} />
            </div>
            <div>
              <Label>线上营业额</Label>
              <Input type="number" step="0.01" value={form.onlineRevenue} onChange={(e) => setForm({ ...form, onlineRevenue: e.target.value })} />
            </div>
            <div>
              <Label>电报好评人数</Label>
              <Input type="number" value={form.telegramPraiseCount} onChange={(e) => setForm({ ...form, telegramPraiseCount: parseInt(e.target.value) || 0 })} />
            </div>
            <div>
              <Label>周转介绍</Label>
              <Input type="number" value={form.referralCount} onChange={(e) => setForm({ ...form, referralCount: parseInt(e.target.value) || 0 })} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            总营业额、产品售价、收取运费、预估毛利润、预估利润率将自动从订单表汇总计算
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
              {createMutation.isPending || updateMutation.isPending ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 日报表弹窗 */}
      <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5" />
              {isAdmin ? "团队日报表" : "个人日报表"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex items-end gap-4 mb-4">
            <div>
              <Label className="text-xs mb-1 block">报表日期</Label>
              <Input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} className="w-40" />
            </div>
            {isAdmin && (
              <div>
                <Label className="text-xs mb-1 block">客服</Label>
                <Select value={staffFilter} onValueChange={setStaffFilter}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">全部客服</SelectItem>
                    {staffList.map((s: any) => (
                      <SelectItem key={s.name} value={s.name}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {reportQuery.isLoading ? (
            <div className="p-8 text-center text-muted-foreground">加载中...</div>
          ) : !reportQuery.data || reportQuery.data.rows.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">该日期暂无数据</div>
          ) : (
            <div className="space-y-4">
              {/* 汇总卡片 */}
              {reportQuery.data.totals && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Card className="bg-emerald-50 dark:bg-emerald-950/30">
                    <CardContent className="p-3">
                      <p className="text-xs text-muted-foreground">总营业额</p>
                      <p className="text-xl font-bold text-emerald-600">¥{formatMoney(reportQuery.data.totals.totalRevenue)}</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-blue-50 dark:bg-blue-950/30">
                    <CardContent className="p-3">
                      <p className="text-xs text-muted-foreground">预估毛利润</p>
                      <p className="text-xl font-bold text-blue-600">¥{formatMoney(reportQuery.data.totals.totalEstimatedProfit)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3">
                      <p className="text-xs text-muted-foreground">平均利润率</p>
                      <p className="text-xl font-bold">{formatPercent(reportQuery.data.totals.avgProfitRate)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3">
                      <p className="text-xs text-muted-foreground">客服人数</p>
                      <p className="text-xl font-bold">{reportQuery.data.totals.staffCount}</p>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* 详细表格 */}
              <div className="overflow-x-auto border rounded-lg">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="p-2 text-left font-medium">名字</th>
                      <th className="p-2 text-right font-medium">消息数</th>
                      <th className="p-2 text-right font-medium">新客人数</th>
                      <th className="p-2 text-right font-medium">新增意向</th>
                      <th className="p-2 text-right font-medium">回访人数</th>
                      <th className="p-2 text-right font-medium">新客单数</th>
                      <th className="p-2 text-right font-medium">老客单数</th>
                      <th className="p-2 text-right font-medium">件数</th>
                      <th className="p-2 text-right font-medium">总营业额</th>
                      <th className="p-2 text-right font-medium">产品售价</th>
                      <th className="p-2 text-right font-medium">收取运费</th>
                      <th className="p-2 text-right font-medium">预估毛利润</th>
                      <th className="p-2 text-right font-medium">利润率</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportQuery.data.rows.map((row: any) => (
                      <tr key={row.id} className="border-b hover:bg-muted/30">
                        <td className="p-2 font-medium">{row.staffName}</td>
                        <td className="p-2 text-right">{row.messageCount || 0}</td>
                        <td className="p-2 text-right">{row.newCustomerCount || 0}</td>
                        <td className="p-2 text-right">{row.newIntentCount || 0}</td>
                        <td className="p-2 text-right">{row.returnVisitCount || 0}</td>
                        <td className="p-2 text-right">{row.newOrderCount || 0}</td>
                        <td className="p-2 text-right">{row.oldOrderCount || 0}</td>
                        <td className="p-2 text-right">{row.itemCount || 0}</td>
                        <td className="p-2 text-right font-medium text-emerald-600">¥{formatMoney(row.totalRevenue)}</td>
                        <td className="p-2 text-right">¥{formatMoney(row.productSellingPrice)}</td>
                        <td className="p-2 text-right">¥{formatMoney(row.shippingCharged)}</td>
                        <td className="p-2 text-right font-medium text-blue-600">¥{formatMoney(row.estimatedProfit)}</td>
                        <td className="p-2 text-right">{formatPercent(row.estimatedProfitRate)}</td>
                      </tr>
                    ))}
                    {/* 汇总行 */}
                    {reportQuery.data.totals && (
                      <tr className="border-t-2 bg-muted/50 font-bold">
                        <td className="p-2">合计</td>
                        <td className="p-2 text-right">{reportQuery.data.totals.totalMessages}</td>
                        <td className="p-2 text-right">{reportQuery.data.totals.totalNewCustomers}</td>
                        <td className="p-2 text-right">{reportQuery.data.totals.totalNewIntents}</td>
                        <td className="p-2 text-right">{reportQuery.data.totals.totalReturnVisits}</td>
                        <td className="p-2 text-right">{reportQuery.data.totals.totalNewOrders}</td>
                        <td className="p-2 text-right">{reportQuery.data.totals.totalOldOrders}</td>
                        <td className="p-2 text-right">{reportQuery.data.totals.totalItems}</td>
                        <td className="p-2 text-right text-emerald-600">¥{formatMoney(reportQuery.data.totals.totalRevenue)}</td>
                        <td className="p-2 text-right">¥{formatMoney(reportQuery.data.totals.totalProductSellingPrice)}</td>
                        <td className="p-2 text-right">¥{formatMoney(reportQuery.data.totals.totalShippingCharged)}</td>
                        <td className="p-2 text-right text-blue-600">¥{formatMoney(reportQuery.data.totals.totalEstimatedProfit)}</td>
                        <td className="p-2 text-right">{formatPercent(reportQuery.data.totals.avgProfitRate)}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
