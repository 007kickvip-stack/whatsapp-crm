import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  ChevronLeft,
  ChevronRight,
  Wallet,
  TrendingUp,
  DollarSign,
  Users,
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Settings,
  ArrowUpDown,
  Percent,
  BarChart3,
  X,
  Award,
  Star,
  FileEdit,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
} from "recharts";

const COMMISSION_TYPE_LABELS: Record<string, string> = {
  revenue: "按营业额",
  profit: "按利润",
  profitRate: "按利润率",
};

const COMMISSION_TYPE_COLORS: Record<string, string> = {
  revenue: "bg-blue-100 text-blue-700",
  profit: "bg-emerald-100 text-emerald-700",
  profitRate: "bg-purple-100 text-purple-700",
};

const COMMISSION_TYPE_DESCRIPTIONS: Record<string, string> = {
  revenue: "根据客服月营业额(¥)落入的区间，阶梯累加计算提成",
  profit: "根据客服月利润(¥)落入的区间，阶梯累加计算提成",
  profitRate: "根据客服月利润率(%)落入的区间，用总利润乘以对应比例计算提成",
};

export default function SalaryReportPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  // 月份选择
  const [yearMonth, setYearMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  // 提成制度弹窗
  const [showRulesDialog, setShowRulesDialog] = useState(false);
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [editingRule, setEditingRule] = useState<any>(null);
  const [deleteRuleId, setDeleteRuleId] = useState<number | null>(null);
  const [ruleForm, setRuleForm] = useState({
    name: "",
    minAmount: "",
    maxAmount: "",
    commissionRate: "",
    commissionType: "revenue" as string,
    sortOrder: 0,
  });

  // 高利润奖励弹窗
  const [showBonusForm, setShowBonusForm] = useState(false);
  const [editingBonus, setEditingBonus] = useState<any>(null);
  const [deleteBonusId, setDeleteBonusId] = useState<number | null>(null);
  const [bonusForm, setBonusForm] = useState({
    name: "",
    profitThreshold: "",
    bonusAmount: "",
    sortOrder: 0,
  });

  // 历史图表
  const [showHistoryChart, setShowHistoryChart] = useState(false);
  const [historyStaffId, setHistoryStaffId] = useState<number | undefined>(undefined);
  const [historyStaffName, setHistoryStaffName] = useState("");
  const [historyMonths, setHistoryMonths] = useState(6);

  // 管理弹窗tab
  const [rulesTab, setRulesTab] = useState("commission");

  // 工资调整项弹窗
  const [showAdjustmentDialog, setShowAdjustmentDialog] = useState(false);
  const [adjustmentStaffId, setAdjustmentStaffId] = useState<number | null>(null);
  const [adjustmentStaffName, setAdjustmentStaffName] = useState("");
  const [adjustmentForm, setAdjustmentForm] = useState({
    profitDeduction: "",
    bonus: "",
    onlineCommission: "",
    performanceDeduction: "",
    remark: "",
  });

  const utils = trpc.useUtils();

  const stableYearMonth = useMemo(() => yearMonth, [yearMonth]);
  const stableHistoryMonths = useMemo(() => historyMonths, [historyMonths]);
  const stableHistoryStaffId = useMemo(() => historyStaffId, [historyStaffId]);

  // 工资报表数据
  const { data: reportData, isLoading: reportLoading } = trpc.salaryReport.get.useQuery(
    { yearMonth: stableYearMonth },
    { enabled: !!stableYearMonth }
  );

  // 提成规则列表（管理员）
  const { data: rulesData, isLoading: rulesLoading } = trpc.commissionRules.list.useQuery(
    undefined,
    { enabled: isAdmin }
  );

  // 活跃提成规则（所有人可见）
  const { data: activeRules } = trpc.commissionRules.activeList.useQuery();

  // 高利润奖励规则列表（管理员）
  const { data: bonusRulesData, isLoading: bonusRulesLoading } = trpc.bonusRules.list.useQuery(
    undefined,
    { enabled: isAdmin }
  );

  // 活跃高利润奖励规则（所有人可见）
  const { data: activeBonusRules } = trpc.bonusRules.activeList.useQuery();

  // 历史工资数据
  const { data: historyData, isLoading: historyLoading } = trpc.salaryReport.history.useQuery(
    { months: stableHistoryMonths, staffId: stableHistoryStaffId },
    { enabled: showHistoryChart }
  );

  // 提成规则 mutations
  const createRuleMutation = trpc.commissionRules.create.useMutation({
    onSuccess: () => {
      toast.success("提成规则创建成功");
      utils.commissionRules.list.invalidate();
      utils.commissionRules.activeList.invalidate();
      utils.salaryReport.get.invalidate();
      setShowRuleForm(false);
      resetRuleForm();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateRuleMutation = trpc.commissionRules.update.useMutation({
    onSuccess: () => {
      toast.success("提成规则更新成功");
      utils.commissionRules.list.invalidate();
      utils.commissionRules.activeList.invalidate();
      utils.salaryReport.get.invalidate();
      setShowRuleForm(false);
      setEditingRule(null);
      resetRuleForm();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteRuleMutation = trpc.commissionRules.delete.useMutation({
    onSuccess: () => {
      toast.success("提成规则已删除");
      utils.commissionRules.list.invalidate();
      utils.commissionRules.activeList.invalidate();
      utils.salaryReport.get.invalidate();
      setDeleteRuleId(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const toggleRuleActiveMutation = trpc.commissionRules.update.useMutation({
    onSuccess: () => {
      toast.success("状态更新成功");
      utils.commissionRules.list.invalidate();
      utils.commissionRules.activeList.invalidate();
      utils.salaryReport.get.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  // 高利润奖励 mutations
  const createBonusMutation = trpc.bonusRules.create.useMutation({
    onSuccess: () => {
      toast.success("奖励规则创建成功");
      utils.bonusRules.list.invalidate();
      utils.bonusRules.activeList.invalidate();
      utils.salaryReport.get.invalidate();
      setShowBonusForm(false);
      resetBonusForm();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateBonusMutation = trpc.bonusRules.update.useMutation({
    onSuccess: () => {
      toast.success("奖励规则更新成功");
      utils.bonusRules.list.invalidate();
      utils.bonusRules.activeList.invalidate();
      utils.salaryReport.get.invalidate();
      setShowBonusForm(false);
      setEditingBonus(null);
      resetBonusForm();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteBonusMutation = trpc.bonusRules.delete.useMutation({
    onSuccess: () => {
      toast.success("奖励规则已删除");
      utils.bonusRules.list.invalidate();
      utils.bonusRules.activeList.invalidate();
      utils.salaryReport.get.invalidate();
      setDeleteBonusId(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const toggleBonusActiveMutation = trpc.bonusRules.update.useMutation({
    onSuccess: () => {
      toast.success("状态更新成功");
      utils.bonusRules.list.invalidate();
      utils.bonusRules.activeList.invalidate();
      utils.salaryReport.get.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  // 工资调整项 mutation
  const upsertAdjustmentMutation = trpc.salaryReport.upsertAdjustment.useMutation({
    onSuccess: () => {
      toast.success("工资调整项已保存");
      utils.salaryReport.get.invalidate();
      setShowAdjustmentDialog(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const resetRuleForm = () => {
    setRuleForm({ name: "", minAmount: "", maxAmount: "", commissionRate: "", commissionType: "revenue", sortOrder: 0 });
  };

  const resetBonusForm = () => {
    setBonusForm({ name: "", profitThreshold: "", bonusAmount: "", sortOrder: 0 });
  };

  const navigateMonth = (delta: number) => {
    const [y, m] = yearMonth.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setYearMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  const formatMonth = (ym: string) => {
    const [y, m] = ym.split("-");
    return `${y}年${parseInt(m)}月`;
  };

  const formatShortMonth = (ym: string) => {
    const [, m] = ym.split("-");
    return `${parseInt(m)}月`;
  };

  // 计算数据来源月份（上月）
  const dataMonth = useMemo(() => {
    const [y, m] = yearMonth.split("-").map(Number);
    const d = new Date(y, m - 2, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }, [yearMonth]);

  // 汇总数据
  const summary = useMemo(() => {
    if (!reportData || reportData.length === 0) return null;
    return {
      totalBaseSalary: reportData.reduce((s, r) => s + r.baseSalary, 0),
      totalCommission: reportData.reduce((s, r) => s + r.commission, 0),
      totalHighProfitBonus: reportData.reduce((s, r) => s + (r.highProfitBonus || 0), 0),
      totalSalary: reportData.reduce((s, r) => s + r.totalSalary, 0),
      totalRevenue: reportData.reduce((s, r) => s + r.totalRevenue, 0),
      totalProfit: reportData.reduce((s, r) => s + r.totalProfit, 0),
      totalProfitDeduction: reportData.reduce((s, r) => s + ((r as any).profitDeduction || 0), 0),
      totalBonus: reportData.reduce((s, r) => s + ((r as any).bonus || 0), 0),
      totalOnlineCommission: reportData.reduce((s, r) => s + ((r as any).onlineCommission || 0), 0),
      totalPerformanceDeduction: reportData.reduce((s, r) => s + ((r as any).performanceDeduction || 0), 0),
      staffCount: reportData.length,
    };
  }, [reportData]);

  // 历史图表数据
  const chartData = useMemo(() => {
    if (!historyData) return [];
    if (historyStaffId) {
      return historyData.map((d: any) => ({
        month: formatShortMonth(d.yearMonth),
        底薪: d.baseSalary,
        提成: d.commission,
        应发工资: d.totalSalary,
        营业额: d.totalRevenue,
        利润: d.totalProfit,
      }));
    }
    const monthMap = new Map<string, any>();
    for (const d of historyData as any[]) {
      const existing = monthMap.get(d.yearMonth) || {
        month: formatShortMonth(d.yearMonth),
        底薪: 0,
        提成: 0,
        应发工资: 0,
        营业额: 0,
        利润: 0,
      };
      existing.底薪 += d.baseSalary;
      existing.提成 += d.commission;
      existing.应发工资 += d.totalSalary;
      existing.营业额 += d.totalRevenue;
      existing.利润 += d.totalProfit;
      monthMap.set(d.yearMonth, existing);
    }
    return Array.from(monthMap.values());
  }, [historyData, historyStaffId]);

  const handleRuleSubmit = () => {
    if (!ruleForm.name.trim()) { toast.error("请输入规则名称"); return; }
    if (!ruleForm.commissionRate.trim()) { toast.error("请输入提成比例"); return; }
    const rate = parseFloat(ruleForm.commissionRate);
    if (isNaN(rate) || rate < 0 || rate > 100) { toast.error("提成比例应在0-100之间"); return; }
    const payload = {
      name: ruleForm.name.trim(),
      minAmount: ruleForm.minAmount ? parseFloat(ruleForm.minAmount).toFixed(2) : "0",
      maxAmount: ruleForm.maxAmount ? parseFloat(ruleForm.maxAmount).toFixed(2) : null,
      commissionRate: (rate / 100).toFixed(4),
      commissionType: ruleForm.commissionType as "revenue" | "profit" | "profitRate",
      sortOrder: ruleForm.sortOrder,
    };
    if (editingRule) { updateRuleMutation.mutate({ id: editingRule.id, ...payload }); }
    else { createRuleMutation.mutate(payload); }
  };

  const handleBonusSubmit = () => {
    if (!bonusForm.name.trim()) { toast.error("请输入奖励名称"); return; }
    if (!bonusForm.profitThreshold.trim()) { toast.error("请输入利润阈值"); return; }
    if (!bonusForm.bonusAmount.trim()) { toast.error("请输入奖励金额"); return; }
    const threshold = parseFloat(bonusForm.profitThreshold);
    const amount = parseFloat(bonusForm.bonusAmount);
    if (isNaN(threshold) || threshold < 0) { toast.error("利润阈值必须大于等于0"); return; }
    if (isNaN(amount) || amount <= 0) { toast.error("奖励金额必须大于0"); return; }
    const payload = {
      name: bonusForm.name.trim(),
      profitThreshold: threshold.toFixed(2),
      bonusAmount: amount.toFixed(2),
      sortOrder: bonusForm.sortOrder,
    };
    if (editingBonus) { updateBonusMutation.mutate({ id: editingBonus.id, ...payload }); }
    else { createBonusMutation.mutate(payload); }
  };

  const handleAdjustmentSubmit = () => {
    if (!adjustmentStaffId) return;
    upsertAdjustmentMutation.mutate({
      staffId: adjustmentStaffId,
      yearMonth: stableYearMonth,
      profitDeduction: adjustmentForm.profitDeduction || "0",
      bonus: adjustmentForm.bonus || "0",
      onlineCommission: adjustmentForm.onlineCommission || "0",
      performanceDeduction: adjustmentForm.performanceDeduction || "0",
      remark: adjustmentForm.remark,
    });
  };

  const openEditRule = (rule: any) => {
    setEditingRule(rule);
    setRuleForm({
      name: rule.name,
      minAmount: rule.minAmount ? String(parseFloat(rule.minAmount)) : "",
      maxAmount: rule.maxAmount ? String(parseFloat(rule.maxAmount)) : "",
      commissionRate: rule.commissionRate ? String(parseFloat(rule.commissionRate) * 100) : "",
      commissionType: rule.commissionType || "revenue",
      sortOrder: rule.sortOrder || 0,
    });
    setShowRuleForm(true);
  };

  const openEditBonus = (bonus: any) => {
    setEditingBonus(bonus);
    setBonusForm({
      name: bonus.name,
      profitThreshold: bonus.profitThreshold ? String(parseFloat(bonus.profitThreshold)) : "",
      bonusAmount: bonus.bonusAmount ? String(parseFloat(bonus.bonusAmount)) : "",
      sortOrder: bonus.sortOrder || 0,
    });
    setShowBonusForm(true);
  };

  const openAdjustment = (row: any) => {
    setAdjustmentStaffId(row.staffId);
    setAdjustmentStaffName(row.staffName);
    setAdjustmentForm({
      profitDeduction: String((row as any).profitDeduction || 0),
      bonus: String((row as any).bonus || 0),
      onlineCommission: String((row as any).onlineCommission || 0),
      performanceDeduction: String((row as any).performanceDeduction || 0),
      remark: (row as any).adjustmentRemark || "",
    });
    setShowAdjustmentDialog(true);
  };

  const openStaffHistory = (staffId: number, staffName: string) => {
    setHistoryStaffId(staffId);
    setHistoryStaffName(staffName);
    setShowHistoryChart(true);
  };

  const openAllHistory = () => {
    setHistoryStaffId(undefined);
    setHistoryStaffName("全部客服");
    setShowHistoryChart(true);
  };

  const getRangeLabel = (rule: any) => {
    const type = rule.commissionType || "revenue";
    const min = parseFloat(rule.minAmount);
    const max = rule.maxAmount ? parseFloat(rule.maxAmount) : null;
    if (type === "profitRate") {
      return `利润率 ${min}%${max ? ` ~ ${max}%` : "+"}`;
    }
    const label = type === "profit" ? "利润" : "营业额";
    return `${label} ¥${min.toLocaleString()}${max ? ` ~ ¥${max.toLocaleString()}` : "+"}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">客服工资与提成报表</h1>
          <p className="text-muted-foreground mt-1">
            结算{formatMonth(yearMonth)}工资 · 基于{formatMonth(dataMonth)}已完成订单数据
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={openAllHistory}
            variant="outline"
            className="border-blue-200 text-blue-700 hover:bg-blue-50"
          >
            <BarChart3 className="h-4 w-4 mr-2" />
            历史趋势
          </Button>
          {isAdmin && (
            <Button
              onClick={() => setShowRulesDialog(true)}
              variant="outline"
              className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
            >
              <Settings className="h-4 w-4 mr-2" />
              提成制度管理
            </Button>
          )}
        </div>
      </div>

      {/* Month Selector */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" onClick={() => navigateMonth(-1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="text-lg font-semibold min-w-[120px] text-center">
          {formatMonth(yearMonth)}
        </div>
        <Button variant="outline" size="icon" onClick={() => navigateMonth(1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Input
          type="month"
          value={yearMonth}
          onChange={(e) => e.target.value && setYearMonth(e.target.value)}
          className="w-40 ml-2"
        />
      </div>

      {/* 工资构成公式说明 */}
      <Card className="border-0 shadow-sm bg-gradient-to-r from-slate-50 to-gray-50">
        <CardContent className="py-4">
          <div className="flex items-center gap-2 mb-2">
            <FileEdit className="h-4 w-4 text-slate-600" />
            <span className="font-medium text-slate-800">工资构成公式</span>
          </div>
          <div className="text-sm text-slate-700 leading-relaxed">
            <span className="font-semibold text-blue-700">应发工资</span> = 
            <span className="text-emerald-700"> 上月已完成订单总利润</span> − 
            <span className="text-red-600">扣除利润</span> + 
            <span className="text-amber-700">基础提成</span> + 
            <span className="text-orange-600">高利润单特别奖励</span> + 
            <span className="text-purple-600">奖金</span> + 
            <span className="text-cyan-600">线上订单提成</span> − 
            <span className="text-red-600">绩效扣款</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            注：订单数据来源于{formatMonth(dataMonth)}标记为"已完成"的订单 · 扣除利润/奖金/线上订单提成/绩效扣款由管理员手动填写
          </p>
        </CardContent>
      </Card>

      {/* 当前提成规则展示 */}
      {activeRules && activeRules.length > 0 && (
        <Card className="border-0 shadow-sm bg-gradient-to-r from-emerald-50 to-teal-50">
          <CardContent className="py-4">
            <div className="flex items-center gap-2 mb-3">
              <Percent className="h-4 w-4 text-emerald-600" />
              <span className="font-medium text-emerald-800">当前提成制度</span>
            </div>
            <div className="flex flex-wrap gap-3">
              {activeRules.map((rule: any) => (
                <div key={rule.id} className="bg-white/80 rounded-lg px-3 py-2 text-sm border border-emerald-100">
                  <Badge variant="secondary" className={`${COMMISSION_TYPE_COLORS[rule.commissionType || "revenue"]} text-[10px] mr-2`}>
                    {COMMISSION_TYPE_LABELS[rule.commissionType || "revenue"]}
                  </Badge>
                  <span className="text-muted-foreground">{getRangeLabel(rule)}</span>
                  <span className="mx-2 text-emerald-600 font-semibold">
                    {(parseFloat(rule.commissionRate) * 100).toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 当前高利润奖励规则展示 */}
      {activeBonusRules && activeBonusRules.length > 0 && (
        <Card className="border-0 shadow-sm bg-gradient-to-r from-amber-50 to-orange-50">
          <CardContent className="py-4">
            <div className="flex items-center gap-2 mb-3">
              <Award className="h-4 w-4 text-amber-600" />
              <span className="font-medium text-amber-800">高利润单特别奖励</span>
            </div>
            <div className="flex flex-wrap gap-3">
              {activeBonusRules.map((rule: any) => (
                <div key={rule.id} className="bg-white/80 rounded-lg px-3 py-2 text-sm border border-amber-100">
                  <Badge variant="secondary" className="bg-amber-100 text-amber-700 text-[10px] mr-2">
                    高利润奖励
                  </Badge>
                  <span className="text-muted-foreground">
                    单笔利润 ≥ ¥{parseFloat(rule.profitThreshold).toLocaleString()}
                  </span>
                  <span className="mx-2 text-amber-600 font-semibold">
                    奖励 ¥{parseFloat(rule.bonusAmount).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          <Card className="border-0 shadow-sm">
            <CardContent className="py-3 px-4">
              <p className="text-[10px] text-muted-foreground">总利润(已完成)</p>
              <p className="text-lg font-bold mt-0.5 text-emerald-600">¥{summary.totalProfit.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="py-3 px-4">
              <p className="text-[10px] text-muted-foreground">扣除利润</p>
              <p className="text-lg font-bold mt-0.5 text-red-500">-¥{summary.totalProfitDeduction.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="py-3 px-4">
              <p className="text-[10px] text-muted-foreground">总提成</p>
              <p className="text-lg font-bold mt-0.5 text-amber-600">¥{summary.totalCommission.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="py-3 px-4">
              <p className="text-[10px] text-muted-foreground">高利润奖励</p>
              <p className="text-lg font-bold mt-0.5 text-orange-600">¥{summary.totalHighProfitBonus.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="py-3 px-4">
              <p className="text-[10px] text-muted-foreground">总奖金</p>
              <p className="text-lg font-bold mt-0.5 text-purple-600">¥{summary.totalBonus.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="py-3 px-4">
              <p className="text-[10px] text-muted-foreground">线上订单提成</p>
              <p className="text-lg font-bold mt-0.5 text-cyan-600">¥{summary.totalOnlineCommission.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="py-3 px-4">
              <p className="text-[10px] text-muted-foreground">绩效扣款</p>
              <p className="text-lg font-bold mt-0.5 text-red-500">-¥{summary.totalPerformanceDeduction.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-emerald-50">
            <CardContent className="py-3 px-4">
              <p className="text-[10px] text-emerald-700">应发总工资</p>
              <p className="text-lg font-bold mt-0.5 text-emerald-700">¥{summary.totalSalary.toLocaleString()}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Salary Report Table */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          {reportLoading ? (
            <div className="p-12 text-center text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
              加载中...
            </div>
          ) : reportData && reportData.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left py-3 px-3 font-medium text-muted-foreground sticky left-0 bg-muted/30 z-10">客服</th>
                    <th className="text-right py-3 px-3 font-medium text-muted-foreground">订单数</th>
                    <th className="text-right py-3 px-3 font-medium text-muted-foreground">营业额(¥)</th>
                    <th className="text-right py-3 px-3 font-medium text-emerald-700 bg-emerald-50/30">总利润(¥)</th>
                    <th className="text-right py-3 px-3 font-medium text-red-600 bg-red-50/30">扣除利润(¥)</th>
                    <th className="text-right py-3 px-3 font-medium text-amber-700">基础提成(¥)</th>
                    <th className="text-right py-3 px-3 font-medium text-orange-700 bg-orange-50/30">高利润奖励(¥)</th>
                    <th className="text-right py-3 px-3 font-medium text-purple-700 bg-purple-50/30">奖金(¥)</th>
                    <th className="text-right py-3 px-3 font-medium text-cyan-700 bg-cyan-50/30">线上提成(¥)</th>
                    <th className="text-right py-3 px-3 font-medium text-red-600 bg-red-50/30">绩效扣款(¥)</th>
                    <th className="text-right py-3 px-3 font-medium text-emerald-700 bg-emerald-50/50">应发工资(¥)</th>
                    <th className="text-center py-3 px-3 font-medium text-muted-foreground">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.map((row: any) => (
                    <tr key={row.staffId} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="py-3 px-3 sticky left-0 bg-white z-10">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-medium text-xs">
                            {(row.staffName || "?").charAt(0)}
                          </div>
                          <span className="font-medium">{row.staffName}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right">{row.orderCount}</td>
                      <td className="py-3 px-3 text-right">¥{row.totalRevenue.toLocaleString()}</td>
                      <td className="py-3 px-3 text-right bg-emerald-50/30">
                        <span className={row.totalProfit >= 0 ? "text-emerald-600 font-medium" : "text-red-500"}>
                          ¥{row.totalProfit.toLocaleString()}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right bg-red-50/30">
                        {(row.profitDeduction || 0) > 0 ? (
                          <span className="text-red-500">-¥{row.profitDeduction.toLocaleString()}</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span className="text-amber-600 font-medium">¥{row.commission.toLocaleString()}</span>
                      </td>
                      <td className="py-3 px-3 text-right bg-orange-50/30">
                        {(row.highProfitBonus || 0) > 0 ? (
                          <div>
                            <span className="text-orange-700 font-medium">¥{row.highProfitBonus.toLocaleString()}</span>
                            <span className="text-xs text-muted-foreground ml-1">({row.highProfitOrderCount}单)</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right bg-purple-50/30">
                        {(row.bonus || 0) > 0 ? (
                          <span className="text-purple-600 font-medium">¥{row.bonus.toLocaleString()}</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right bg-cyan-50/30">
                        {(row.onlineCommission || 0) > 0 ? (
                          <span className="text-cyan-600 font-medium">¥{row.onlineCommission.toLocaleString()}</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right bg-red-50/30">
                        {(row.performanceDeduction || 0) > 0 ? (
                          <span className="text-red-500">-¥{row.performanceDeduction.toLocaleString()}</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right bg-emerald-50/50">
                        <span className="text-emerald-700 font-bold text-base">¥{row.totalSalary.toLocaleString()}</span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {isAdmin && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                              onClick={() => openAdjustment(row)}
                            >
                              <FileEdit className="h-3.5 w-3.5 mr-1" />
                              调整
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            onClick={() => openStaffHistory(row.staffId, row.staffName)}
                          >
                            <BarChart3 className="h-3.5 w-3.5 mr-1" />
                            历史
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {reportData.length > 1 && summary && (
                  <tfoot>
                    <tr className="border-t-2 bg-muted/20 font-medium">
                      <td className="py-3 px-3 sticky left-0 bg-muted/20 z-10">合计</td>
                      <td className="py-3 px-3 text-right">{reportData.reduce((s: number, r: any) => s + r.orderCount, 0)}</td>
                      <td className="py-3 px-3 text-right">¥{summary.totalRevenue.toLocaleString()}</td>
                      <td className="py-3 px-3 text-right bg-emerald-50/30 text-emerald-600">¥{summary.totalProfit.toLocaleString()}</td>
                      <td className="py-3 px-3 text-right bg-red-50/30 text-red-500">-¥{summary.totalProfitDeduction.toLocaleString()}</td>
                      <td className="py-3 px-3 text-right text-amber-600">¥{summary.totalCommission.toLocaleString()}</td>
                      <td className="py-3 px-3 text-right bg-orange-50/30 text-orange-700">¥{summary.totalHighProfitBonus.toLocaleString()}</td>
                      <td className="py-3 px-3 text-right bg-purple-50/30 text-purple-600">¥{summary.totalBonus.toLocaleString()}</td>
                      <td className="py-3 px-3 text-right bg-cyan-50/30 text-cyan-600">¥{summary.totalOnlineCommission.toLocaleString()}</td>
                      <td className="py-3 px-3 text-right bg-red-50/30 text-red-500">-¥{summary.totalPerformanceDeduction.toLocaleString()}</td>
                      <td className="py-3 px-3 text-right bg-emerald-50/50 text-emerald-700 font-bold">¥{summary.totalSalary.toLocaleString()}</td>
                      <td className="py-3 px-3"></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          ) : (
            <div className="p-12 text-center text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>{formatMonth(yearMonth)} 暂无工资数据</p>
              <p className="text-xs mt-1">请确认{formatMonth(dataMonth)}有已完成的客服订单数据</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ========== Adjustment Dialog ========== */}
      <Dialog open={showAdjustmentDialog} onOpenChange={setShowAdjustmentDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileEdit className="h-5 w-5 text-orange-600" />
              工资调整项 - {adjustmentStaffName}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            设置{formatMonth(yearMonth)}的工资调整项（结算{formatMonth(dataMonth)}数据）
          </p>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-red-600">扣除利润(¥)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0"
                value={adjustmentForm.profitDeduction}
                onChange={(e) => setAdjustmentForm(f => ({ ...f, profitDeduction: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">从总利润中扣除的金额</p>
            </div>
            <div className="space-y-2">
              <Label className="text-purple-600">奖金(¥)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0"
                value={adjustmentForm.bonus}
                onChange={(e) => setAdjustmentForm(f => ({ ...f, bonus: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">额外奖金金额</p>
            </div>
            <div className="space-y-2">
              <Label className="text-cyan-600">线上订单提成(¥)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0"
                value={adjustmentForm.onlineCommission}
                onChange={(e) => setAdjustmentForm(f => ({ ...f, onlineCommission: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">线上订单的额外提成金额</p>
            </div>
            <div className="space-y-2">
              <Label className="text-red-600">绩效扣款(¥)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0"
                value={adjustmentForm.performanceDeduction}
                onChange={(e) => setAdjustmentForm(f => ({ ...f, performanceDeduction: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">绩效考核扣款金额</p>
            </div>
            <div className="space-y-2">
              <Label>备注</Label>
              <Textarea
                placeholder="填写调整说明..."
                value={adjustmentForm.remark}
                onChange={(e) => setAdjustmentForm(f => ({ ...f, remark: e.target.value }))}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdjustmentDialog(false)}>
              取消
            </Button>
            <Button
              onClick={handleAdjustmentSubmit}
              disabled={upsertAdjustmentMutation.isPending}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {upsertAdjustmentMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Save className="h-4 w-4 mr-1" />
              保存调整
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========== History Chart Dialog ========== */}
      <Dialog open={showHistoryChart} onOpenChange={setShowHistoryChart}>
        <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-600" />
              {historyStaffName} - 历史工资与提成趋势
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-3">
              <Label className="text-sm text-muted-foreground whitespace-nowrap">查看范围:</Label>
              <Select value={String(historyMonths)} onValueChange={(v) => setHistoryMonths(Number(v))}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">最近3个月</SelectItem>
                  <SelectItem value="6">最近6个月</SelectItem>
                  <SelectItem value="12">最近12个月</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {historyLoading ? (
              <div className="py-16 text-center text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                加载历史数据中...
              </div>
            ) : chartData.length > 0 ? (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">工资构成（底薪 + 提成）</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `¥${v.toLocaleString()}`} />
                      <Tooltip
                        formatter={(value: number, name: string) => [`¥${value.toLocaleString()}`, name]}
                        contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "13px" }}
                      />
                      <Legend />
                      <Bar dataKey="底薪" stackId="salary" fill="#60a5fa" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="提成" stackId="salary" fill="#34d399" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">营业额与利润趋势</h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `¥${v.toLocaleString()}`} />
                      <Tooltip
                        formatter={(value: number, name: string) => [`¥${value.toLocaleString()}`, name]}
                        contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "13px" }}
                      />
                      <Legend />
                      <Line type="monotone" dataKey="营业额" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                      <Line type="monotone" dataKey="利润" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                      <Line type="monotone" dataKey="应发工资" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">历史数据明细</h3>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/30">
                          <th className="text-left py-2.5 px-3 font-medium text-muted-foreground">月份</th>
                          <th className="text-right py-2.5 px-3 font-medium text-muted-foreground">底薪(¥)</th>
                          <th className="text-right py-2.5 px-3 font-medium text-muted-foreground">营业额(¥)</th>
                          <th className="text-right py-2.5 px-3 font-medium text-muted-foreground">利润(¥)</th>
                          <th className="text-right py-2.5 px-3 font-medium text-muted-foreground">提成(¥)</th>
                          <th className="text-right py-2.5 px-3 font-medium text-emerald-700 bg-emerald-50/50">应发工资(¥)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {chartData.map((row: any, idx: number) => (
                          <tr key={idx} className="border-b last:border-0 hover:bg-muted/20">
                            <td className="py-2.5 px-3 font-medium">{row.month}</td>
                            <td className="py-2.5 px-3 text-right">¥{row.底薪.toLocaleString()}</td>
                            <td className="py-2.5 px-3 text-right">¥{row.营业额.toLocaleString()}</td>
                            <td className="py-2.5 px-3 text-right">¥{row.利润.toLocaleString()}</td>
                            <td className="py-2.5 px-3 text-right text-amber-600">¥{row.提成.toLocaleString()}</td>
                            <td className="py-2.5 px-3 text-right bg-emerald-50/50 text-emerald-700 font-bold">¥{row.应发工资.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-16 text-center text-muted-foreground">
                <BarChart3 className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p>暂无历史工资数据</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ========== Commission & Bonus Rules Management Dialog ========== */}
      <Dialog open={showRulesDialog} onOpenChange={setShowRulesDialog}>
        <DialogContent className="sm:max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-emerald-600" />
              提成制度管理
            </DialogTitle>
          </DialogHeader>
          <Tabs value={rulesTab} onValueChange={setRulesTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="commission" className="flex items-center gap-1.5">
                <Percent className="h-3.5 w-3.5" />
                提成规则
              </TabsTrigger>
              <TabsTrigger value="bonus" className="flex items-center gap-1.5">
                <Award className="h-3.5 w-3.5" />
                高利润单奖励
              </TabsTrigger>
            </TabsList>

            {/* 提成规则 Tab */}
            <TabsContent value="commission" className="space-y-4 mt-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  设置提成规则，支持按营业额、利润或利润率三种模式计算提成
                </p>
                <Button
                  size="sm"
                  onClick={() => { setEditingRule(null); resetRuleForm(); setShowRuleForm(true); }}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  添加规则
                </Button>
              </div>

              {rulesLoading ? (
                <div className="py-8 text-center text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                  加载中...
                </div>
              ) : rulesData && rulesData.length > 0 ? (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left py-2.5 px-3 font-medium text-muted-foreground">规则名称</th>
                        <th className="text-center py-2.5 px-3 font-medium text-muted-foreground">提成模式</th>
                        <th className="text-right py-2.5 px-3 font-medium text-muted-foreground">区间下限</th>
                        <th className="text-right py-2.5 px-3 font-medium text-muted-foreground">区间上限</th>
                        <th className="text-right py-2.5 px-3 font-medium text-muted-foreground">提成比例</th>
                        <th className="text-center py-2.5 px-3 font-medium text-muted-foreground">状态</th>
                        <th className="text-right py-2.5 px-3 font-medium text-muted-foreground">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rulesData.map((rule: any) => {
                        const type = rule.commissionType || "revenue";
                        const isRateMode = type === "profitRate";
                        return (
                          <tr key={rule.id} className="border-b last:border-0 hover:bg-muted/20">
                            <td className="py-2.5 px-3 font-medium">{rule.name}</td>
                            <td className="py-2.5 px-3 text-center">
                              <Badge variant="secondary" className={COMMISSION_TYPE_COLORS[type]}>
                                {COMMISSION_TYPE_LABELS[type]}
                              </Badge>
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              {isRateMode ? `${parseFloat(rule.minAmount)}%` : `¥${parseFloat(rule.minAmount).toLocaleString()}`}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              {rule.maxAmount
                                ? (isRateMode ? `${parseFloat(rule.maxAmount)}%` : `¥${parseFloat(rule.maxAmount).toLocaleString()}`)
                                : <span className="text-muted-foreground">无上限</span>}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">
                                {(parseFloat(rule.commissionRate) * 100).toFixed(1)}%
                              </Badge>
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <button
                                onClick={() => toggleRuleActiveMutation.mutate({ id: rule.id, isActive: rule.isActive ? 0 : 1 })}
                                className="cursor-pointer"
                              >
                                <Badge variant={rule.isActive ? "default" : "outline"} className={rule.isActive ? "bg-emerald-600" : ""}>
                                  {rule.isActive ? "启用" : "禁用"}
                                </Badge>
                              </button>
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditRule(rule)}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteRuleId(rule.id)}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground border rounded-lg">
                  <ArrowUpDown className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p>暂无提成规则</p>
                  <p className="text-xs mt-1">点击"添加规则"创建提成方案</p>
                </div>
              )}

              <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm text-blue-800 space-y-2">
                <p className="font-medium">提成计算说明</p>
                <p><strong>按营业额：</strong>阶梯累加，客服月营业额(¥)落入各区间，区间内金额乘以对应比例。</p>
                <p><strong>按利润：</strong>阶梯累加，客服月利润(¥)落入各区间，区间内金额乘以对应比例。</p>
                <p><strong>按利润率：</strong>根据利润率(%)落入的区间，用总利润乘以对应比例。</p>
                <p className="text-blue-600">三种模式的提成可以同时设置，最终提成为各模式提成之和。</p>
              </div>
            </TabsContent>

            {/* 高利润单奖励 Tab */}
            <TabsContent value="bonus" className="space-y-4 mt-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  当单笔订单总利润超过设定阈值时，给予客服额外固定奖励
                </p>
                <Button
                  size="sm"
                  onClick={() => { setEditingBonus(null); resetBonusForm(); setShowBonusForm(true); }}
                  className="bg-amber-600 hover:bg-amber-700"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  添加奖励规则
                </Button>
              </div>

              {bonusRulesLoading ? (
                <div className="py-8 text-center text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                  加载中...
                </div>
              ) : bonusRulesData && bonusRulesData.length > 0 ? (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left py-2.5 px-3 font-medium text-muted-foreground">奖励名称</th>
                        <th className="text-right py-2.5 px-3 font-medium text-muted-foreground">利润阈值(¥)</th>
                        <th className="text-right py-2.5 px-3 font-medium text-muted-foreground">奖励金额(¥)</th>
                        <th className="text-center py-2.5 px-3 font-medium text-muted-foreground">状态</th>
                        <th className="text-right py-2.5 px-3 font-medium text-muted-foreground">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bonusRulesData.map((bonus: any) => (
                        <tr key={bonus.id} className="border-b last:border-0 hover:bg-muted/20">
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-2">
                              <Star className="h-4 w-4 text-amber-500" />
                              <span className="font-medium">{bonus.name}</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <span className="text-muted-foreground">≥</span>{" "}
                            <span className="font-medium">¥{parseFloat(bonus.profitThreshold).toLocaleString()}</span>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <Badge variant="secondary" className="bg-amber-100 text-amber-700">
                              ¥{parseFloat(bonus.bonusAmount).toLocaleString()}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <button
                              onClick={() => toggleBonusActiveMutation.mutate({ id: bonus.id, isActive: bonus.isActive ? 0 : 1 })}
                              className="cursor-pointer"
                            >
                              <Badge variant={bonus.isActive ? "default" : "outline"} className={bonus.isActive ? "bg-amber-600" : ""}>
                                {bonus.isActive ? "启用" : "禁用"}
                              </Badge>
                            </button>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditBonus(bonus)}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteBonusId(bonus.id)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground border rounded-lg">
                  <Award className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p>暂无高利润单奖励规则</p>
                  <p className="text-xs mt-1">点击"添加奖励规则"设置奖励方案</p>
                </div>
              )}

              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800 space-y-2">
                <p className="font-medium">高利润单奖励说明</p>
                <p>当客服的<strong>单笔订单总利润</strong>达到设定阈值时，该笔订单将获得额外的固定奖励金额。</p>
                <p>支持设置多档阈值，每笔订单取匹配的最高档奖励。</p>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* ========== Add/Edit Rule Form ========== */}
      <Dialog open={showRuleForm} onOpenChange={(open) => { if (!open) { setShowRuleForm(false); setEditingRule(null); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingRule ? "编辑提成规则" : "添加提成规则"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>规则名称 <span className="text-destructive">*</span></Label>
              <Input placeholder="如：第一档、基础提成" value={ruleForm.name} onChange={(e) => setRuleForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>提成模式 <span className="text-destructive">*</span></Label>
              <Select value={ruleForm.commissionType} onValueChange={(v) => setRuleForm(f => ({ ...f, commissionType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="revenue">按营业额 - 根据营业额区间阶梯提成</SelectItem>
                  <SelectItem value="profit">按利润 - 根据利润区间阶梯提成</SelectItem>
                  <SelectItem value="profitRate">按利润率 - 根据利润率区间提成</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{COMMISSION_TYPE_DESCRIPTIONS[ruleForm.commissionType]}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{ruleForm.commissionType === "profitRate" ? "利润率下限(%)" : ruleForm.commissionType === "profit" ? "利润下限(¥)" : "营业额下限(¥)"}</Label>
                <Input type="number" placeholder="0" value={ruleForm.minAmount} onChange={(e) => setRuleForm(f => ({ ...f, minAmount: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>{ruleForm.commissionType === "profitRate" ? "利润率上限(%)" : ruleForm.commissionType === "profit" ? "利润上限(¥)" : "营业额上限(¥)"}</Label>
                <Input type="number" placeholder="留空表示无上限" value={ruleForm.maxAmount} onChange={(e) => setRuleForm(f => ({ ...f, maxAmount: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>提成比例(%) <span className="text-destructive">*</span></Label>
                <Input type="number" step="0.1" placeholder="如 5 表示 5%" value={ruleForm.commissionRate} onChange={(e) => setRuleForm(f => ({ ...f, commissionRate: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>排序</Label>
                <Input type="number" placeholder="0" value={ruleForm.sortOrder} onChange={(e) => setRuleForm(f => ({ ...f, sortOrder: parseInt(e.target.value) || 0 }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowRuleForm(false); setEditingRule(null); }}>取消</Button>
            <Button onClick={handleRuleSubmit} disabled={createRuleMutation.isPending || updateRuleMutation.isPending} className="bg-emerald-600 hover:bg-emerald-700">
              {(createRuleMutation.isPending || updateRuleMutation.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingRule ? "保存修改" : "创建规则"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========== Add/Edit Bonus Rule Form ========== */}
      <Dialog open={showBonusForm} onOpenChange={(open) => { if (!open) { setShowBonusForm(false); setEditingBonus(null); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-amber-600" />
              {editingBonus ? "编辑奖励规则" : "添加奖励规则"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>奖励名称 <span className="text-destructive">*</span></Label>
              <Input placeholder="如：高利润奖励第一档" value={bonusForm.name} onChange={(e) => setBonusForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>单笔订单利润阈值(¥) <span className="text-destructive">*</span></Label>
              <Input type="number" placeholder="如 500 表示单笔利润≥500时触发" value={bonusForm.profitThreshold} onChange={(e) => setBonusForm(f => ({ ...f, profitThreshold: e.target.value }))} />
              <p className="text-xs text-muted-foreground">当单笔订单的总利润达到此金额时触发奖励</p>
            </div>
            <div className="space-y-2">
              <Label>奖励金额(¥) <span className="text-destructive">*</span></Label>
              <Input type="number" placeholder="如 50 表示每笔奖励50元" value={bonusForm.bonusAmount} onChange={(e) => setBonusForm(f => ({ ...f, bonusAmount: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>排序</Label>
              <Input type="number" placeholder="0" value={bonusForm.sortOrder} onChange={(e) => setBonusForm(f => ({ ...f, sortOrder: parseInt(e.target.value) || 0 }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowBonusForm(false); setEditingBonus(null); }}>取消</Button>
            <Button onClick={handleBonusSubmit} disabled={createBonusMutation.isPending || updateBonusMutation.isPending} className="bg-amber-600 hover:bg-amber-700">
              {(createBonusMutation.isPending || updateBonusMutation.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingBonus ? "保存修改" : "创建奖励规则"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Rule Confirmation */}
      <AlertDialog open={deleteRuleId !== null} onOpenChange={() => setDeleteRuleId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>确定要删除此提成规则吗？删除后将影响工资计算。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteRuleId && deleteRuleMutation.mutate({ id: deleteRuleId })} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Bonus Rule Confirmation */}
      <AlertDialog open={deleteBonusId !== null} onOpenChange={() => setDeleteBonusId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>确定要删除此高利润奖励规则吗？删除后将影响工资计算。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteBonusId && deleteBonusMutation.mutate({ id: deleteBonusId })} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
