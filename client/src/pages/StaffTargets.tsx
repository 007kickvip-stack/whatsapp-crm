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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Target, Plus, Pencil, Trash2, TrendingUp, DollarSign,
  ChevronLeft, ChevronRight, CheckCircle2, AlertCircle,
  Calendar, Users, User,
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

function getCurrentYear() {
  return new Date().getFullYear();
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

// ==================== Progress Card Component ====================
function ProgressCard({ item, isAdmin, onEdit, onDelete, type }: {
  item: any;
  isAdmin: boolean;
  onEdit?: (item: any) => void;
  onDelete?: (id: number, name: string) => void;
  type: "individual" | "team";
}) {
  const profitPct = Math.min(item.profitProgress * 100, 100);
  const revenuePct = Math.min(item.revenueProgress * 100, 100);
  const profitDone = parseFloat(item.profitGap) <= 0;
  const revenueDone = parseFloat(item.revenueGap) <= 0;

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {type === "team" ? (
            <Users className="h-4 w-4 text-indigo-500" />
          ) : (
            <User className="h-4 w-4 text-gray-500" />
          )}
          <span className="font-semibold text-gray-900">
            {type === "team" ? "团队目标" : item.staffName}
          </span>
          <span className="text-xs text-gray-400">订单 {item.orderCount} 笔</span>
        </div>
        {isAdmin && onEdit && onDelete && (
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(item)}>
              <Pencil className="h-3.5 w-3.5 text-gray-400" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDelete(item.targetId, type === "team" ? "团队目标" : item.staffName)}>
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
            <span className="font-mono text-emerald-600">¥{fmtMoney(item.actualProfit)}</span>
            <span className="text-gray-400 mx-1">/</span>
            <span className="font-mono">¥{fmtMoney(item.profitTarget)}</span>
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
              <AlertCircle className="h-3 w-3" /> 差距 ¥{fmtMoney(item.profitGap)}
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
            <span className="font-mono text-blue-600">¥{fmtMoney(item.actualRevenue)}</span>
            <span className="text-gray-400 mx-1">/</span>
            <span className="font-mono">¥{fmtMoney(item.revenueTarget)}</span>
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
              <AlertCircle className="h-3 w-3" /> 差距 ¥{fmtMoney(item.revenueGap)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ==================== Monthly Targets Tab ====================
function MonthlyTargetsTab() {
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
  const { data: progressData, isLoading: progressLoading } = trpc.staffTargets.progress.useQuery(ymInput);
  const { data: staffList } = trpc.staffTargets.staffList.useQuery(undefined, { enabled: isAdmin });

  const utils = trpc.useUtils();

  const progress = progressData?.details || [];
  const teamSummary = progressData?.teamSummary || null;

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

  const assignedStaffIds = new Set((targets || []).map((t: any) => t.staffId));
  const availableStaff = editingTarget
    ? staffList || []
    : (staffList || []).filter((s: any) => !assignedStaffIds.has(s.staffId));

  const totalProfitTarget = teamSummary
    ? teamSummary.totalProfitTarget
    : progress.reduce((sum: number, p: any) => sum + parseFloat(p.profitTarget), 0);
  const totalActualProfit = teamSummary
    ? teamSummary.totalActualProfit
    : progress.reduce((sum: number, p: any) => sum + parseFloat(p.actualProfit), 0);
  const totalRevenueTarget = teamSummary
    ? teamSummary.totalRevenueTarget
    : progress.reduce((sum: number, p: any) => sum + parseFloat(p.revenueTarget), 0);
  const totalActualRevenue = teamSummary
    ? teamSummary.totalActualRevenue
    : progress.reduce((sum: number, p: any) => sum + parseFloat(p.actualRevenue), 0);
  const overallProfitProgress = totalProfitTarget > 0 ? totalActualProfit / totalProfitTarget : 0;
  const overallRevenueProgress = totalRevenueTarget > 0 ? totalActualRevenue / totalRevenueTarget : 0;

  const hasTeamData = teamSummary ? (teamSummary.totalProfitTarget > 0 || teamSummary.totalRevenueTarget > 0) : progress.length > 0;

  return (
    <div className="space-y-6">
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
            {isAdmin && (
              <Button onClick={openCreateDialog} size="sm" className="gap-1.5 ml-4">
                <Plus className="h-4 w-4" />
                设定目标
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Overall Team Summary Cards */}
      {hasTeamData && (
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
            <CardTitle className="text-base">{isAdmin ? "客服目标完成详情" : "我的目标完成详情"}</CardTitle>
            <CardDescription>{formatYearMonth(yearMonth)} {isAdmin ? "各客服目标完成率和差距分析" : "您的目标完成率和差距分析"}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {progress.map((p: any) => (
                <ProgressCard
                  key={p.targetId}
                  item={p}
                  isAdmin={isAdmin}
                  type="individual"
                  onEdit={(item) => openEditDialog({
                    staffId: item.staffId,
                    profitTarget: item.profitTarget,
                    revenueTarget: item.revenueTarget,
                  })}
                  onDelete={(id, name) => handleDelete(id, name)}
                />
              ))}
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
      {isAdmin && targets && targets.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">目标设定记录</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-center">客服</TableHead>
                  <TableHead className="text-center">利润目标 (¥)</TableHead>
                  <TableHead className="text-center">营业额目标 (¥)</TableHead>
                  <TableHead className="text-center">设定人</TableHead>
                  <TableHead className="text-center">更新时间</TableHead>
                  <TableHead className="text-center">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {targets.map((t: any) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-center font-medium">{t.staffName}</TableCell>
                    <TableCell className="text-center font-mono">¥{fmtMoney(t.profitTarget)}</TableCell>
                    <TableCell className="text-center font-mono">¥{fmtMoney(t.revenueTarget)}</TableCell>
                    <TableCell className="text-center text-gray-500">{t.setByName || "未知"}</TableCell>
                    <TableCell className="text-center text-gray-500 text-xs">
                      {new Date(t.updatedAt).toLocaleString("zh-CN")}
                    </TableCell>
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
              {editingTarget ? "修改目标" : "设定客服月度目标"}
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

// ==================== Annual Targets Tab ====================
function AnnualTargetsTab() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [year, setYear] = useState(getCurrentYear);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTarget, setEditingTarget] = useState<any>(null);
  const [formType, setFormType] = useState<"team" | "individual">("team");
  const [formStaffId, setFormStaffId] = useState("");
  const [formProfitTarget, setFormProfitTarget] = useState("");
  const [formRevenueTarget, setFormRevenueTarget] = useState("");

  const yearInput = useMemo(() => ({ year }), [year]);

  const { data: targets, isLoading: targetsLoading } = trpc.annualTargets.list.useQuery(yearInput);
  const { data: progressData, isLoading: progressLoading } = trpc.annualTargets.progress.useQuery(yearInput);
  const { data: staffList } = trpc.staffTargets.staffList.useQuery(undefined, { enabled: isAdmin });

  const utils = trpc.useUtils();

  const upsertMutation = trpc.annualTargets.upsert.useMutation({
    onSuccess: () => {
      utils.annualTargets.list.invalidate();
      utils.annualTargets.progress.invalidate();
      toast.success(editingTarget ? "年度目标已更新" : "年度目标已设定");
      setDialogOpen(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.annualTargets.delete.useMutation({
    onSuccess: () => {
      utils.annualTargets.list.invalidate();
      utils.annualTargets.progress.invalidate();
      toast.success("年度目标已删除");
    },
    onError: (err) => toast.error(err.message),
  });

  const openCreateDialog = (type: "team" | "individual") => {
    setEditingTarget(null);
    setFormType(type);
    setFormStaffId("");
    setFormProfitTarget("");
    setFormRevenueTarget("");
    setDialogOpen(true);
  };

  const openEditDialog = (target: any) => {
    setEditingTarget(target);
    setFormType(target.type || (target.staffId ? "individual" : "team"));
    setFormStaffId(target.staffId ? String(target.staffId) : "");
    setFormProfitTarget(String(parseFloat(String(target.profitTarget))));
    setFormRevenueTarget(String(parseFloat(String(target.revenueTarget))));
    setDialogOpen(true);
  };

  const handleSave = () => {
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

    if (formType === "individual") {
      const staffId = parseInt(formStaffId);
      const staff = staffList?.find((s: any) => s.staffId === staffId);
      if (!staff) {
        toast.error("请选择客服");
        return;
      }
      upsertMutation.mutate({
        year,
        type: "individual",
        staffId,
        staffName: staff.staffName,
        profitTarget,
        revenueTarget,
      });
    } else {
      upsertMutation.mutate({
        year,
        type: "team",
        profitTarget,
        revenueTarget,
      });
    }
  };

  const handleDelete = (id: number, name: string) => {
    if (confirm(`确定删除 ${name} 的年度目标吗？`)) {
      deleteMutation.mutate({ id });
    }
  };

  const teamTarget = (targets || []).find((t: any) => t.type === "team");
  const individualTargets = (targets || []).filter((t: any) => t.type === "individual");
  const assignedStaffIds = new Set(individualTargets.map((t: any) => t.staffId));
  const availableStaff = editingTarget
    ? staffList || []
    : (staffList || []).filter((s: any) => !assignedStaffIds.has(s.staffId));

  const teamProgress = progressData?.team || null;
  const individualProgress = progressData?.individuals || [];

  return (
    <div className="space-y-6">
      {/* Year Selector */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setYear(prev => prev - 1)}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <span className="text-lg font-semibold text-gray-900 min-w-[100px] text-center">
              {year} 年
            </span>
            <Button variant="ghost" size="icon" onClick={() => setYear(prev => prev + 1)}>
              <ChevronRight className="h-5 w-5" />
            </Button>
            {isAdmin && (
              <div className="flex gap-2 ml-4">
                {!teamTarget && (
                  <Button onClick={() => openCreateDialog("team")} size="sm" className="gap-1.5" variant="outline">
                    <Users className="h-4 w-4" />
                    设定团队目标
                  </Button>
                )}
                <Button onClick={() => openCreateDialog("individual")} size="sm" className="gap-1.5">
                  <Plus className="h-4 w-4" />
                  设定个人目标
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Team Annual Target Progress */}
      {teamProgress ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-indigo-500" />
              {year}年 团队年度目标
            </CardTitle>
            <CardDescription>全团队年度利润和营业额目标完成进度</CardDescription>
          </CardHeader>
          <CardContent>
            <ProgressCard
              item={teamProgress}
              isAdmin={isAdmin}
              type="team"
              onEdit={(item) => openEditDialog({ ...item, type: "team" })}
              onDelete={(id, name) => handleDelete(id, name)}
            />
          </CardContent>
        </Card>
      ) : teamTarget ? null : (
        isAdmin && (
          <Card>
            <CardContent className="py-8 text-center text-gray-400">
              <Users className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p>{year}年 暂未设定团队年度目标</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => openCreateDialog("team")}>
                <Plus className="h-4 w-4 mr-1" /> 设定团队目标
              </Button>
            </CardContent>
          </Card>
        )
      )}

      {/* Individual Annual Target Progress */}
      {targetsLoading || progressLoading ? (
        <div className="text-center py-12 text-gray-400">加载中...</div>
      ) : individualProgress.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4 text-blue-500" />
              {isAdmin ? "个人年度目标完成详情" : "我的年度目标完成详情"}
            </CardTitle>
            <CardDescription>{year}年 {isAdmin ? "各客服年度目标完成率和差距分析" : "您的年度目标完成率和差距分析"}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {individualProgress.map((p: any) => (
                <ProgressCard
                  key={p.targetId}
                  item={p}
                  isAdmin={isAdmin}
                  type="individual"
                  onEdit={(item) => openEditDialog({ ...item, type: "individual" })}
                  onDelete={(id, name) => handleDelete(id, name)}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-gray-400">
            <Target className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p>{year}年 {isAdmin ? "暂未设定任何个人年度目标" : "暂未为您设定年度目标"}</p>
            {isAdmin && (
              <Button variant="outline" size="sm" className="mt-3" onClick={() => openCreateDialog("individual")}>
                <Plus className="h-4 w-4 mr-1" /> 设定个人目标
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Annual Target Records Table */}
      {isAdmin && (targets || []).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">年度目标设定记录</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-center">类型</TableHead>
                  <TableHead className="text-center">客服</TableHead>
                  <TableHead className="text-center">利润目标 (¥)</TableHead>
                  <TableHead className="text-center">营业额目标 (¥)</TableHead>
                  <TableHead className="text-center">设定人</TableHead>
                  <TableHead className="text-center">更新时间</TableHead>
                  <TableHead className="text-center">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(targets || []).map((t: any) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        t.type === "team" ? "bg-indigo-50 text-indigo-700" : "bg-blue-50 text-blue-700"
                      }`}>
                        {t.type === "team" ? <Users className="h-3 w-3" /> : <User className="h-3 w-3" />}
                        {t.type === "team" ? "团队" : "个人"}
                      </span>
                    </TableCell>
                    <TableCell className="text-center font-medium">{t.type === "team" ? "全团队" : t.staffName}</TableCell>
                    <TableCell className="text-center font-mono">¥{fmtMoney(t.profitTarget)}</TableCell>
                    <TableCell className="text-center font-mono">¥{fmtMoney(t.revenueTarget)}</TableCell>
                    <TableCell className="text-center text-gray-500">{t.setByName || "未知"}</TableCell>
                    <TableCell className="text-center text-gray-500 text-xs">
                      {new Date(t.updatedAt).toLocaleString("zh-CN")}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditDialog(t)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => handleDelete(t.id, t.type === "team" ? "团队目标" : t.staffName)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
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
              <Calendar className="h-5 w-5 text-indigo-500" />
              {editingTarget ? "修改年度目标" : `设定${formType === "team" ? "团队" : "个人"}年度目标`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="text-sm text-gray-500 bg-gray-50 rounded-md px-3 py-2 text-center">
              {year} 年 · {formType === "team" ? "团队目标" : "个人目标"}
            </div>
            {formType === "individual" && (
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
            )}
            <div className="space-y-2">
              <Label>年度利润目标 (¥)</Label>
              <Input
                type="number"
                min="0"
                step="1000"
                value={formProfitTarget}
                onChange={e => setFormProfitTarget(e.target.value)}
                placeholder="例如: 60000"
              />
            </div>
            <div className="space-y-2">
              <Label>年度营业额目标 (¥)</Label>
              <Input
                type="number"
                min="0"
                step="1000"
                value={formRevenueTarget}
                onChange={e => setFormRevenueTarget(e.target.value)}
                placeholder="例如: 240000"
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

// ==================== Main Page ====================
export default function StaffTargetsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [activeTab, setActiveTab] = useState("monthly");

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
            {isAdmin ? "为团队和个人设定月度/年度目标，跟踪完成进度" : "查看您的月度和年度目标完成进度"}
          </p>
        </div>
      </div>

      {/* Tab Switcher */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="monthly" className="gap-1.5">
            <Calendar className="h-4 w-4" />
            月度目标
          </TabsTrigger>
          <TabsTrigger value="annual" className="gap-1.5">
            <TrendingUp className="h-4 w-4" />
            年度目标
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {activeTab === "monthly" ? <MonthlyTargetsTab /> : <AnnualTargetsTab />}
    </div>
  );
}
