import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Target, Plus, Pencil, Trash2, TrendingUp, DollarSign,
  ChevronLeft, ChevronRight, CheckCircle2, AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

function fmtMoney(val: string | number | null | undefined) {
  const n = parseFloat(String(val || "0"));
  return n.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getCurrentYearMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatYearMonth(ym: string) {
  const [y, m] = ym.split("-");
  return `${y}年${parseInt(m)}月`;
}

function shiftMonth(ym: string, delta: number) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function StaffTargetsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [yearMonth, setYearMonth] = useState(getCurrentYearMonth);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTarget, setEditingTarget] = useState<any>(null);
  const [formStaffId, setFormStaffId] = useState("");
  const [formProfitTarget, setFormProfitTarget] = useState("");
  const [formRevenueTarget, setFormRevenueTarget] = useState("");

  const ymInput = useMemo(() => ({ yearMonth }), [yearMonth]);

  const { data: targets, isLoading: targetsLoading } = trpc.staffTargets.list.useQuery(ymInput);
  const { data: progress, isLoading: progressLoading } = trpc.staffTargets.progress.useQuery(ymInput);
  const { data: staffList } = trpc.staffTargets.staffList.useQuery(undefined, { enabled: isAdmin });

  const utils = trpc.useUtils();

  const upsertMutation = trpc.staffTargets.upsert.useMutation({
    onSuccess: () => {
      utils.staffTargets.list.invalidate();
      utils.staffTargets.progress.invalidate();
      toast.success(editingTarget ? "目标已更新" : "目标已设定");
      setDialogOpen(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.staffTargets.delete.useMutation({
    onSuccess: () => {
      utils.staffTargets.list.invalidate();
      utils.staffTargets.progress.invalidate();
      toast.success("目标已删除");
    },
    onError: (err) => toast.error(err.message),
  });

  const openCreateDialog = () => {
    setEditingTarget(null);
    setFormStaffId("");
    setFormProfitTarget("");
    setFormRevenueTarget("");
    setDialogOpen(true);
  };

  const openEditDialog = (target: any) => {
    setEditingTarget(target);
    setFormStaffId(String(target.staffId));
    setFormProfitTarget(String(parseFloat(String(target.profitTarget))));
    setFormRevenueTarget(String(parseFloat(String(target.revenueTarget))));
    setDialogOpen(true);
  };

  const handleSave = () => {
    const staffId = parseInt(formStaffId);
    const staff = staffList?.find((s: any) => s.staffId === staffId);
    if (!staff) {
      toast.error("请选择客服");
      return;
    }
    const profitTarget = parseFloat(formProfitTarget);
    const revenueTarget = parseFloat(formRevenueTarget);
    if (isNaN(profitTarget) || profitTarget < 0) {
      toast.error("请输入有效的利润目标");
      return;
    }
    if (isNaN(revenueTarget) || revenueTarget < 0) {
      toast.error("请输入有效的营业额目标");
      return;
    }
    upsertMutation.mutate({
      staffId,
      staffName: staff.staffName,
      yearMonth,
      profitTarget,
      revenueTarget,
    });
  };

  const handleDelete = (id: number, staffName: string) => {
    if (confirm(`确定删除 ${staffName} 的目标吗？`)) {
      deleteMutation.mutate({ id });
    }
  };

  // 客服和管理员都可以查看目标管理，后端会自动过滤数据

  // Already-assigned staff IDs for this month
  const assignedStaffIds = new Set((targets || []).map((t: any) => t.staffId));
  const availableStaff = editingTarget
    ? staffList || []
    : (staffList || []).filter((s: any) => !assignedStaffIds.has(s.staffId));

  // Summary stats from progress
  const totalProfitTarget = (progress || []).reduce((sum: number, p: any) => sum + parseFloat(p.profitTarget), 0);
  const totalActualProfit = (progress || []).reduce((sum: number, p: any) => sum + parseFloat(p.actualProfit), 0);
  const totalRevenueTarget = (progress || []).reduce((sum: number, p: any) => sum + parseFloat(p.revenueTarget), 0);
  const totalActualRevenue = (progress || []).reduce((sum: number, p: any) => sum + parseFloat(p.actualRevenue), 0);
  const overallProfitProgress = totalProfitTarget > 0 ? totalActualProfit / totalProfitTarget : 0;
  const overallRevenueProgress = totalRevenueTarget > 0 ? totalActualRevenue / totalRevenueTarget : 0;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Target className="h-6 w-6 text-indigo-600" />
            客服目标管理
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {isAdmin ? "为每个客服设定月度利润和营业额目标，跟踪完成进度" : "查看您的月度目标完成进度"}
          </p>
        </div>
        {isAdmin && (
          <Button onClick={openCreateDialog} className="gap-1.5">
            <Plus className="h-4 w-4" />
            设定目标
          </Button>
        )}
      </div>

      {/* Month Selector */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setYearMonth(prev => shiftMonth(prev, -1))}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <span className="text-lg font-semibold text-gray-900 min-w-[120px] text-center">
              {formatYearMonth(yearMonth)}
            </span>
            <Button variant="ghost" size="icon" onClick={() => setYearMonth(prev => shiftMonth(prev, 1))}>
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Overall Summary Cards */}
      {progress && progress.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
                团队利润目标
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">目标</span>
                  <span className="font-mono font-medium">¥{fmtMoney(totalProfitTarget)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">已完成</span>
                  <span className="font-mono font-medium text-emerald-600">¥{fmtMoney(totalActualProfit)}</span>
                </div>
                <Progress value={Math.min(overallProfitProgress * 100, 100)} className="h-3" />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>完成率 {(overallProfitProgress * 100).toFixed(1)}%</span>
                  <span className={totalActualProfit >= totalProfitTarget ? "text-emerald-600" : "text-amber-600"}>
                    {totalActualProfit >= totalProfitTarget ? "已达标" : `差距 ¥${fmtMoney(totalProfitTarget - totalActualProfit)}`}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-blue-500" />
                团队营业额目标
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">目标</span>
                  <span className="font-mono font-medium">¥{fmtMoney(totalRevenueTarget)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">已完成</span>
                  <span className="font-mono font-medium text-blue-600">¥{fmtMoney(totalActualRevenue)}</span>
                </div>
                <Progress value={Math.min(overallRevenueProgress * 100, 100)} className="h-3" />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>完成率 {(overallRevenueProgress * 100).toFixed(1)}%</span>
                  <span className={totalActualRevenue >= totalRevenueTarget ? "text-emerald-600" : "text-amber-600"}>
                    {totalActualRevenue >= totalRevenueTarget ? "已达标" : `差距 ¥${fmtMoney(totalRevenueTarget - totalActualRevenue)}`}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Staff Progress Detail */}
      {targetsLoading || progressLoading ? (
        <div className="text-center py-12 text-gray-400">加载中...</div>
      ) : progress && progress.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">客服目标完成详情</CardTitle>
            <CardDescription>{formatYearMonth(yearMonth)} 各客服目标完成率和差距分析</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {progress.map((p: any) => {
                const profitPct = Math.min(p.profitProgress * 100, 100);
                const revenuePct = Math.min(p.revenueProgress * 100, 100);
                const profitDone = parseFloat(p.profitGap) <= 0;
                const revenueDone = parseFloat(p.revenueGap) <= 0;
                return (
                  <div key={p.targetId} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900">{p.staffName}</span>
                        <span className="text-xs text-gray-400">订单 {p.orderCount} 笔</span>
                      </div>
                      {isAdmin && (
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                            openEditDialog({
                              staffId: p.staffId,
                              profitTarget: p.profitTarget,
                              revenueTarget: p.revenueTarget,
                            });
                          }}>
                            <Pencil className="h-3.5 w-3.5 text-gray-400" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(p.targetId, p.staffName)}>
                            <Trash2 className="h-3.5 w-3.5 text-red-400" />
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Profit Progress */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500 flex items-center gap-1">
                          <TrendingUp className="h-3.5 w-3.5" /> 利润目标
                        </span>
                        <span className="text-xs">
                          <span className="font-mono text-emerald-600">¥{fmtMoney(p.actualProfit)}</span>
                          <span className="text-gray-400 mx-1">/</span>
                          <span className="font-mono">¥{fmtMoney(p.profitTarget)}</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Progress value={profitPct} className="h-2 flex-1" />
                        <span className={`text-xs font-medium min-w-[50px] text-right ${profitDone ? "text-emerald-600" : profitPct >= 80 ? "text-amber-600" : "text-red-500"}`}>
                          {profitPct.toFixed(1)}%
                        </span>
                      </div>
                      <div className="text-xs text-right">
                        {profitDone ? (
                          <span className="text-emerald-600 flex items-center justify-end gap-0.5">
                            <CheckCircle2 className="h-3 w-3" /> 已达标
                          </span>
                        ) : (
                          <span className="text-amber-600 flex items-center justify-end gap-0.5">
                            <AlertCircle className="h-3 w-3" /> 差距 ¥{fmtMoney(p.profitGap)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Revenue Progress */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500 flex items-center gap-1">
                          <DollarSign className="h-3.5 w-3.5" /> 营业额目标
                        </span>
                        <span className="text-xs">
                          <span className="font-mono text-blue-600">¥{fmtMoney(p.actualRevenue)}</span>
                          <span className="text-gray-400 mx-1">/</span>
                          <span className="font-mono">¥{fmtMoney(p.revenueTarget)}</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Progress value={revenuePct} className="h-2 flex-1" />
                        <span className={`text-xs font-medium min-w-[50px] text-right ${revenueDone ? "text-emerald-600" : revenuePct >= 80 ? "text-amber-600" : "text-red-500"}`}>
                          {revenuePct.toFixed(1)}%
                        </span>
                      </div>
                      <div className="text-xs text-right">
                        {revenueDone ? (
                          <span className="text-emerald-600 flex items-center justify-end gap-0.5">
                            <CheckCircle2 className="h-3 w-3" /> 已达标
                          </span>
                        ) : (
                          <span className="text-amber-600 flex items-center justify-end gap-0.5">
                            <AlertCircle className="h-3 w-3" /> 差距 ¥{fmtMoney(p.revenueGap)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-gray-400">
            <Target className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>{formatYearMonth(yearMonth)} {isAdmin ? "暂未设定任何客服目标" : "暂未为您设定目标"}</p>
            {isAdmin && (
              <Button variant="outline" size="sm" className="mt-3" onClick={openCreateDialog}>
                <Plus className="h-4 w-4 mr-1" /> 立即设定
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Target History Table */}
      {targets && targets.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{isAdmin ? "目标设定记录" : "我的目标记录"}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-center">客服</TableHead>
                  <TableHead className="text-center">利润目标 (¥)</TableHead>
                  <TableHead className="text-center">营业额目标 (¥)</TableHead>
                  {isAdmin && <TableHead className="text-center">设定人</TableHead>}
                  <TableHead className="text-center">更新时间</TableHead>
                  {isAdmin && <TableHead className="text-center">操作</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {targets.map((t: any) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-center font-medium">{t.staffName}</TableCell>
                    <TableCell className="text-center font-mono">¥{fmtMoney(t.profitTarget)}</TableCell>
                    <TableCell className="text-center font-mono">¥{fmtMoney(t.revenueTarget)}</TableCell>
                    {isAdmin && <TableCell className="text-center text-gray-500">{t.setByName || "未知"}</TableCell>}
                    <TableCell className="text-center text-gray-500 text-xs">
                      {new Date(t.updatedAt).toLocaleString("zh-CN")}
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-center">
                        <div className="flex justify-center gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditDialog(t)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => handleDelete(t.id, t.staffName)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-indigo-500" />
              {editingTarget ? "修改目标" : "设定客服目标"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="text-sm text-gray-500 bg-gray-50 rounded-md px-3 py-2 text-center">
              {formatYearMonth(yearMonth)}
            </div>
            <div className="space-y-2">
              <Label>选择客服</Label>
              <Select value={formStaffId} onValueChange={setFormStaffId} disabled={!!editingTarget}>
                <SelectTrigger>
                  <SelectValue placeholder="请选择客服" />
                </SelectTrigger>
                <SelectContent>
                  {availableStaff.map((s: any) => (
                    <SelectItem key={s.staffId} value={String(s.staffId)}>{s.staffName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>利润目标 (¥)</Label>
              <Input
                type="number"
                min="0"
                step="100"
                value={formProfitTarget}
                onChange={e => setFormProfitTarget(e.target.value)}
                placeholder="例如: 5000"
              />
            </div>
            <div className="space-y-2">
              <Label>营业额目标 (¥)</Label>
              <Input
                type="number"
                min="0"
                step="100"
                value={formRevenueTarget}
                onChange={e => setFormRevenueTarget(e.target.value)}
                placeholder="例如: 20000"
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">取消</Button>
            </DialogClose>
            <Button onClick={handleSave} disabled={upsertMutation.isPending}>
              {upsertMutation.isPending ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
