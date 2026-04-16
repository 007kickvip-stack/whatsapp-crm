import React, { useState, useMemo } from "react";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
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
  CalendarDays,
  Check,
  Download,
  FileImage,
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

  // 权限守卫：仅管理员可访问
  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <div className="text-4xl mb-4">🔒</div>
            <h2 className="text-xl font-semibold mb-2">无访问权限</h2>
            <p className="text-muted-foreground">工资与提成报表仅管理员可查看，请联系管理员。</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 月份选择 - 支持多月份
  const [yearMonth, setYearMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [selectedMonths, setSelectedMonths] = useState<string[]>(() => {
    const now = new Date();
    return [`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`];
  });
  const [multiMonthOpen, setMultiMonthOpen] = useState(false);
  const isMultiMonth = selectedMonths.length > 1;

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

  // 提成明细展开/折叠状态
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const toggleRowExpand = (staffId: number) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(staffId)) {
        next.delete(staffId);
      } else {
        next.add(staffId);
      }
      return next;
    });
  };

  // 工资条导出状态
  const [exportingSlipId, setExportingSlipId] = useState<number | null>(null);
  const [showSlipPreview, setShowSlipPreview] = useState(false);
  const [slipPreviewData, setSlipPreviewData] = useState<any>(null);

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
  const stableSelectedMonths = useMemo(() => [...selectedMonths].sort(), [selectedMonths]);
  const stableHistoryMonths = useMemo(() => historyMonths, [historyMonths]);
  const stableHistoryStaffId = useMemo(() => historyStaffId, [historyStaffId]);

  // 工资报表数据 - 单月
  const { data: singleReportData, isLoading: singleReportLoading } = trpc.salaryReport.get.useQuery(
    { yearMonth: stableYearMonth },
    { enabled: !isMultiMonth && !!stableYearMonth }
  );

  // 工资报表数据 - 多月
  const { data: multiReportData, isLoading: multiReportLoading } = trpc.salaryReport.getMulti.useQuery(
    { yearMonths: stableSelectedMonths },
    { enabled: isMultiMonth && stableSelectedMonths.length > 1 }
  );

  const reportData = isMultiMonth ? multiReportData : singleReportData;
  const reportLoading = isMultiMonth ? multiReportLoading : singleReportLoading;

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
    const newYm = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    setYearMonth(newYm);
    setSelectedMonths([newYm]);
  };

  // 生成最近12个月份列表供多月选择
  const availableMonths = useMemo(() => {
    const months: string[] = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    return months;
  }, []);

  const toggleMonth = (ym: string) => {
    setSelectedMonths(prev => {
      if (prev.includes(ym)) {
        if (prev.length === 1) return prev; // 至少保留一个
        return prev.filter(m => m !== ym);
      }
      return [...prev, ym];
    });
  };

  const selectSingleMonth = (ym: string) => {
    setYearMonth(ym);
    setSelectedMonths([ym]);
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

  // 多月模式的数据来源月份描述
  const dataMonthsDesc = useMemo(() => {
    if (!isMultiMonth) return formatMonth(dataMonth);
    const sorted = [...selectedMonths].sort();
    return sorted.map(ym => {
      const [y, m] = ym.split("-").map(Number);
      const d = new Date(y, m - 2, 1);
      return formatMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }).join("、");
  }, [isMultiMonth, selectedMonths, dataMonth]);

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
      yearMonth: isMultiMonth ? selectedMonths.sort()[0] : stableYearMonth,
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

  // 工资条生成与导出
  const exportSalarySlip = async (row: any) => {
    setExportingSlipId(row.staffId);
    try {
      const monthLabel = isMultiMonth
        ? selectedMonths.sort().map((ym: string) => formatMonth(ym)).join("+")
        : formatMonth(yearMonth);
      const dataMonthLabel = isMultiMonth ? dataMonthsDesc : formatMonth(dataMonth);

      // Canvas 布局参数
      const scale = 2;
      const padding = 36;
      const contentWidth = 680;
      const totalWidth = contentWidth + padding * 2;
      const font = "'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif";

      // 计算提成明细行数
      const details = (row.commissionDetails || []).filter((d: any) => d.participatesInCommission);
      const allDetails = row.commissionDetails || [];
      const hasDetails = allDetails.length > 0;
      const isProbation = row.employmentStatus === 'probation';

      // 预计算高度
      let y = 0;
      const headerH = 100;
      const infoSectionH = 80;
      const salaryBreakdownH = 220;
      const detailHeaderH = hasDetails ? 45 : 0;
      const detailRowH = 26;
      const detailTableH = hasDetails ? (detailHeaderH + 30 + allDetails.length * detailRowH + (details.length > 0 ? 30 : 0)) : 0;
      const probationNoteH = isProbation ? 40 : 0;
      const footerH = 60;
      const totalH = headerH + infoSectionH + salaryBreakdownH + detailTableH + probationNoteH + footerH + 20;

      const canvas = document.createElement("canvas");
      canvas.width = totalWidth * scale;
      canvas.height = totalH * scale;
      const ctx = canvas.getContext("2d")!;
      ctx.scale(scale, scale);

      // 圆角矩形辅助函数
      const roundRect = (x: number, ry: number, w: number, h: number, r: number) => {
        ctx.beginPath();
        ctx.moveTo(x + r, ry);
        ctx.lineTo(x + w - r, ry);
        ctx.quadraticCurveTo(x + w, ry, x + w, ry + r);
        ctx.lineTo(x + w, ry + h - r);
        ctx.quadraticCurveTo(x + w, ry + h, x + w - r, ry + h);
        ctx.lineTo(x + r, ry + h);
        ctx.quadraticCurveTo(x, ry + h, x, ry + h - r);
        ctx.lineTo(x, ry + r);
        ctx.quadraticCurveTo(x, ry, x + r, ry);
        ctx.closePath();
      };

      // === 背景 ===
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, totalWidth, totalH);

      // === 头部标题栏 ===
      y = 0;
      ctx.fillStyle = "#059669";
      ctx.fillRect(0, 0, totalWidth, 60);
      ctx.fillStyle = "#ffffff";
      ctx.font = `bold 22px ${font}`;
      ctx.textAlign = "center";
      ctx.fillText("工资条", totalWidth / 2, 28);
      ctx.font = `13px ${font}`;
      ctx.fillStyle = "#d1fae5";
      ctx.fillText(`结算月份：${monthLabel}  ·  数据来源：${dataMonthLabel}已完成订单`, totalWidth / 2, 50);
      y = 70;

      // === 员工信息区 ===
      ctx.fillStyle = "#f0fdf4";
      roundRect(padding, y, contentWidth, 55, 8);
      ctx.fill();
      ctx.strokeStyle = "#bbf7d0";
      ctx.lineWidth = 1;
      roundRect(padding, y, contentWidth, 55, 8);
      ctx.stroke();

      ctx.fillStyle = "#111827";
      ctx.font = `bold 16px ${font}`;
      ctx.textAlign = "left";
      ctx.fillText(row.staffName || "未知", padding + 16, y + 24);

      // 员工状态标签
      const statusText = row.employmentStatus === 'probation' ? '试用期' : row.employmentStatus === 'mid_month_regular' ? '月中转正' : '正式员工';
      const statusBg = row.employmentStatus === 'probation' ? '#fef3c7' : row.employmentStatus === 'mid_month_regular' ? '#dbeafe' : '#d1fae5';
      const statusColor = row.employmentStatus === 'probation' ? '#92400e' : row.employmentStatus === 'mid_month_regular' ? '#1d4ed8' : '#047857';
      ctx.font = `11px ${font}`;
      const statusW = ctx.measureText(statusText).width + 14;
      const statusX = padding + 16 + ctx.measureText(row.staffName || '未知').width + 12;
      ctx.fillStyle = statusBg;
      roundRect(statusX, y + 12, statusW, 20, 4);
      ctx.fill();
      ctx.fillStyle = statusColor;
      ctx.font = `bold 11px ${font}`;
      ctx.fillText(statusText, statusX + 7, y + 26);

      // 订单数 & 营业额
      ctx.font = `12px ${font}`;
      ctx.fillStyle = "#6b7280";
      ctx.fillText(`订单数：${row.orderCount}单  ·  营业额：¥${row.totalRevenue.toLocaleString()}  ·  总利润：¥${row.totalProfit.toLocaleString()}`, padding + 16, y + 45);
      y += 65;

      // === 工资明细区 ===
      y += 10;
      ctx.fillStyle = "#111827";
      ctx.font = `bold 14px ${font}`;
      ctx.textAlign = "left";
      ctx.fillText("工资明细", padding, y + 14);
      y += 28;

      // 工资明细表格
      const salaryItems = [
        { label: "底薪", value: row.baseSalary || 0, color: "#2563eb", detail: row.baseSalaryDetail || null, isAdd: true },
        { label: "总利润(已完成)", value: row.totalProfit, color: "#059669", detail: null, isAdd: true },
        { label: "扣除利润", value: row.profitDeduction || 0, color: "#dc2626", detail: null, isAdd: false },
        { label: "基础提成", value: row.commission, color: "#d97706", detail: null, isAdd: true },
        { label: "高利润单奖励", value: row.highProfitBonus || 0, color: "#ea580c", detail: row.highProfitOrderCount ? `${row.highProfitOrderCount}单` : null, isAdd: true },
        { label: "奖金", value: row.bonus || 0, color: "#7c3aed", detail: null, isAdd: true },
        { label: "线上订单提成", value: row.onlineCommission || 0, color: "#0891b2", detail: null, isAdd: true },
        { label: "绩效扣款", value: row.performanceDeduction || 0, color: "#dc2626", detail: null, isAdd: false },
      ];

      const itemH = 22;
      const labelX = padding + 12;
      const valueX = padding + contentWidth - 12;

      salaryItems.forEach((item) => {
        // 交替背景
        ctx.fillStyle = salaryItems.indexOf(item) % 2 === 0 ? "#f9fafb" : "#ffffff";
        ctx.fillRect(padding, y, contentWidth, itemH);

        // 标签
        ctx.fillStyle = "#374151";
        ctx.font = `13px ${font}`;
        ctx.textAlign = "left";
        const prefix = item.isAdd ? "+" : "-";
        ctx.fillText(`${prefix} ${item.label}`, labelX, y + 15);

        // 明细注释
        if (item.detail) {
          const detailX = labelX + ctx.measureText(`${prefix} ${item.label}`).width + 8;
          ctx.fillStyle = "#9ca3af";
          ctx.font = `11px ${font}`;
          ctx.fillText(`(${item.detail})`, detailX, y + 15);
        }

        // 金额
        ctx.fillStyle = item.color;
        ctx.font = `bold 13px ${font}`;
        ctx.textAlign = "right";
        const sign = item.isAdd ? "" : "-";
        ctx.fillText(`${sign}¥${item.value.toLocaleString()}`, valueX, y + 15);
        y += itemH;
      });

      // 分割线
      y += 4;
      ctx.strokeStyle = "#059669";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(padding + contentWidth, y);
      ctx.stroke();
      y += 8;

      // 应发工资总额
      ctx.fillStyle = "#f0fdf4";
      roundRect(padding, y, contentWidth, 36, 6);
      ctx.fill();
      ctx.fillStyle = "#374151";
      ctx.font = `bold 14px ${font}`;
      ctx.textAlign = "left";
      ctx.fillText("应发工资", labelX, y + 23);
      ctx.fillStyle = "#059669";
      ctx.font = `bold 20px ${font}`;
      ctx.textAlign = "right";
      ctx.fillText(`¥${row.totalSalary.toLocaleString()}`, valueX, y + 25);
      y += 46;

      // === 提成明细表 ===
      if (hasDetails && !isProbation) {
        ctx.fillStyle = "#111827";
        ctx.font = `bold 14px ${font}`;
        ctx.textAlign = "left";
        ctx.fillText(`提成明细 · ${allDetails.length}笔订单`, padding, y + 14);
        y += 28;

        // 明细表头
        const detailCols = ["订单编号", "客户名", "日期", "营业额", "产品利润", "运费利润", "总利润", "高利润奖励"];
        const detailColWidths = [100, 80, 75, 80, 80, 80, 80, 80];
        const detailTableWidth = detailColWidths.reduce((a, b) => a + b, 0);
        const detailStartX = padding + (contentWidth - detailTableWidth) / 2;

        // 表头背景
        ctx.fillStyle = "#f3f4f6";
        roundRect(detailStartX, y, detailTableWidth, 24, 4);
        ctx.fill();
        ctx.fillStyle = "#374151";
        ctx.font = `bold 10px ${font}`;
        ctx.textAlign = "center";
        let dx = detailStartX;
        detailCols.forEach((col, i) => {
          ctx.fillText(col, dx + detailColWidths[i] / 2, y + 16);
          dx += detailColWidths[i];
        });
        y += 26;

        // 明细数据行
        allDetails.forEach((detail: any, idx: number) => {
          ctx.fillStyle = idx % 2 === 0 ? "#ffffff" : "#f9fafb";
          ctx.fillRect(detailStartX, y, detailTableWidth, detailRowH);
          if (!detail.participatesInCommission) {
            ctx.fillStyle = "#f3f4f6";
            ctx.fillRect(detailStartX, y, detailTableWidth, detailRowH);
          }
          // 底部边线
          ctx.strokeStyle = "#e5e7eb";
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(detailStartX, y + detailRowH);
          ctx.lineTo(detailStartX + detailTableWidth, y + detailRowH);
          ctx.stroke();

          const opacity = detail.participatesInCommission ? 1 : 0.5;
          ctx.globalAlpha = opacity;
          ctx.font = `10px ${font}`;
          ctx.textAlign = "center";
          ctx.fillStyle = "#111827";
          const vals = [
            detail.orderNumber || '-',
            (detail.customerName || '-').length > 6 ? (detail.customerName || '-').slice(0, 6) + '..' : (detail.customerName || '-'),
            detail.orderDate || '-',
            `¥${detail.revenue.toLocaleString()}`,
            `¥${detail.productProfit.toLocaleString()}`,
            `¥${detail.shippingProfit.toLocaleString()}`,
            `¥${detail.totalProfit.toLocaleString()}`,
            detail.highProfitBonus > 0 ? `¥${detail.highProfitBonus.toLocaleString()}` : '-',
          ];
          dx = detailStartX;
          vals.forEach((v, i) => {
            if (i === 6) {
              ctx.fillStyle = detail.totalProfit >= 0 ? "#059669" : "#dc2626";
            } else if (i === 7 && detail.highProfitBonus > 0) {
              ctx.fillStyle = "#ea580c";
            } else {
              ctx.fillStyle = "#111827";
            }
            ctx.fillText(v, dx + detailColWidths[i] / 2, y + 17);
            dx += detailColWidths[i];
          });
          ctx.globalAlpha = 1;
          y += detailRowH;
        });

        // 合计行
        if (details.length > 0) {
          ctx.fillStyle = "#fef3c7";
          ctx.fillRect(detailStartX, y, detailTableWidth, 26);
          ctx.fillStyle = "#92400e";
          ctx.font = `bold 10px ${font}`;
          ctx.textAlign = "center";
          const totals = details.reduce((acc: any, d: any) => ({
            revenue: acc.revenue + d.revenue,
            productProfit: acc.productProfit + d.productProfit,
            shippingProfit: acc.shippingProfit + d.shippingProfit,
            totalProfit: acc.totalProfit + d.totalProfit,
            highProfitBonus: acc.highProfitBonus + d.highProfitBonus,
          }), { revenue: 0, productProfit: 0, shippingProfit: 0, totalProfit: 0, highProfitBonus: 0 });
          const tvals = [
            '参与提成合计', '', '',
            `¥${totals.revenue.toLocaleString()}`,
            `¥${totals.productProfit.toLocaleString()}`,
            `¥${totals.shippingProfit.toLocaleString()}`,
            `¥${totals.totalProfit.toLocaleString()}`,
            `¥${totals.highProfitBonus.toLocaleString()}`,
          ];
          dx = detailStartX;
          tvals.forEach((v, i) => {
            if (i === 0) ctx.textAlign = "center";
            ctx.fillText(v, dx + detailColWidths[i] / 2, y + 17);
            dx += detailColWidths[i];
          });
          y += 30;
        }
      } else if (isProbation && hasDetails) {
        ctx.fillStyle = "#92400e";
        ctx.font = `12px ${font}`;
        ctx.textAlign = "center";
        ctx.fillText("试用期员工无提成，仅发放底薪", totalWidth / 2, y + 20);
        y += 40;
      }

      // === 底部 ===
      y += 10;
      ctx.strokeStyle = "#e5e7eb";
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(padding + contentWidth, y);
      ctx.stroke();
      y += 12;
      ctx.fillStyle = "#9ca3af";
      ctx.font = `11px ${font}`;
      ctx.textAlign = "center";
      ctx.fillText(`生成时间：${new Date().toLocaleString("zh-CN")}  ·  WhatsApp CRM 工资系统`, totalWidth / 2, y + 10);

      // 下载
      const link = document.createElement("a");
      link.download = `工资条_${row.staffName}_${isMultiMonth ? selectedMonths.sort().join('_') : yearMonth}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast.success(`${row.staffName} 的工资条已保存`);
    } catch (err) {
      console.error("导出工资条失败:", err);
      toast.error("导出失败，请尝试截图保存");
    } finally {
      setExportingSlipId(null);
    }
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
            {isMultiMonth
              ? `汇总${selectedMonths.length}个月工资数据`
              : `结算${formatMonth(yearMonth)}工资 · 基于${formatMonth(dataMonth)}已完成订单数据`}
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
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="outline" size="icon" onClick={() => navigateMonth(-1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="text-lg font-semibold min-w-[120px] text-center">
          {isMultiMonth
            ? `${selectedMonths.length}个月份汇总`
            : formatMonth(yearMonth)}
        </div>
        <Button variant="outline" size="icon" onClick={() => navigateMonth(1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Input
          type="month"
          value={yearMonth}
          onChange={(e) => {
            if (e.target.value) {
              setYearMonth(e.target.value);
              setSelectedMonths([e.target.value]);
            }
          }}
          className="w-40 ml-2"
        />
        <Popover open={multiMonthOpen} onOpenChange={setMultiMonthOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2">
              <CalendarDays className="h-4 w-4" />
              多月份选择
              {isMultiMonth && (
                <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 ml-1">
                  {selectedMonths.length}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-3" align="start">
            <div className="space-y-1">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium">选择月份</p>
                {isMultiMonth && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs text-muted-foreground"
                    onClick={() => selectSingleMonth(yearMonth)}
                  >
                    重置为单月
                  </Button>
                )}
              </div>
              {availableMonths.map((ym) => (
                <label
                  key={ym}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/50 cursor-pointer text-sm"
                >
                  <Checkbox
                    checked={selectedMonths.includes(ym)}
                    onCheckedChange={() => toggleMonth(ym)}
                  />
                  <span className={selectedMonths.includes(ym) ? "font-medium" : ""}>
                    {formatMonth(ym)}
                  </span>
                </label>
              ))}
            </div>
          </PopoverContent>
        </Popover>
        {isMultiMonth && (
          <div className="flex flex-wrap gap-1.5">
            {selectedMonths.sort().map(ym => (
              <Badge key={ym} variant="secondary" className="bg-emerald-50 text-emerald-700 gap-1">
                {formatMonth(ym)}
                <button
                  onClick={() => {
                    if (selectedMonths.length > 1) {
                      setSelectedMonths(prev => prev.filter(m => m !== ym));
                    }
                  }}
                  className="ml-0.5 hover:text-red-500"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
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
            <span className="text-blue-600">底薪</span> + 
            <span className="text-emerald-700">上月已完成订单总利润</span> − 
            <span className="text-red-600">扣除利润</span> + 
            <span className="text-amber-700">基础提成</span> + 
            <span className="text-orange-600">高利润单特别奖励</span> + 
            <span className="text-purple-600">奖金</span> + 
            <span className="text-cyan-600">线上订单提成</span> − 
            <span className="text-red-600">绩效扣款</span>
          </div>
          <div className="mt-2 text-xs text-slate-600 space-y-0.5">
            <p>• <strong>试用期员工</strong>：底薪 = 试用期底薪，无提成（基础提成 + 高利润奖励 = 0）</p>
            <p>• <strong>正式员工</strong>：底薪 = 正式底薪，按规则计算提成</p>
            <p>• <strong>月中转正</strong>：底薪按天数比例计算，提成只算转正后的订单</p>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            注：订单数据来源于{isMultiMonth ? dataMonthsDesc : formatMonth(dataMonth)}标记为“已完成”的订单 · 扣除利润/奖金/线上订单提成/绩效扣款由管理员手动填写
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
                    <th className="text-center py-3 px-3 font-medium text-muted-foreground">状态</th>
                    <th className="text-right py-3 px-3 font-medium text-blue-700 bg-blue-50/30">底薪(¥)</th>
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
                    <React.Fragment key={row.staffId}>
                    <tr className="border-b hover:bg-muted/20 transition-colors cursor-pointer" onClick={() => toggleRowExpand(row.staffId)}>
                      <td className="py-3 px-3 sticky left-0 bg-white z-10">
                        <div className="flex items-center gap-2">
                          <button
                            className="h-5 w-5 flex items-center justify-center rounded hover:bg-muted/40 transition-colors flex-shrink-0"
                            onClick={(e) => { e.stopPropagation(); toggleRowExpand(row.staffId); }}
                          >
                            {expandedRows.has(row.staffId) ? (
                              <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                          </button>
                          <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-medium text-xs">
                            {(row.staffName || "?").charAt(0)}
                          </div>
                          <span className="font-medium">{row.staffName}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center">
                        {row.employmentStatus === 'probation' ? (
                          <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200 text-[10px]">试用期</Badge>
                        ) : row.employmentStatus === 'mid_month_regular' ? (
                          <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200 text-[10px]">月中转正</Badge>
                        ) : (
                          <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200 text-[10px]">正式</Badge>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right bg-blue-50/30">
                        <span className="text-blue-700 font-medium">¥{(row.baseSalary || 0).toLocaleString()}</span>
                        {row.baseSalaryDetail && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">{row.baseSalaryDetail}</p>
                        )}
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
                              onClick={(e) => { e.stopPropagation(); openAdjustment(row); }}
                            >
                              <FileEdit className="h-3.5 w-3.5 mr-1" />
                              调整
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-teal-600 hover:text-teal-700 hover:bg-teal-50"
                            onClick={(e) => { e.stopPropagation(); exportSalarySlip(row); }}
                            disabled={exportingSlipId === row.staffId}
                          >
                            {exportingSlipId === row.staffId ? (
                              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                            ) : (
                              <Download className="h-3.5 w-3.5 mr-1" />
                            )}
                            工资条
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            onClick={(e) => { e.stopPropagation(); openStaffHistory(row.staffId, row.staffName); }}
                          >
                            <BarChart3 className="h-3.5 w-3.5 mr-1" />
                            历史
                          </Button>
                        </div>
                      </td>
                    </tr>
                    {/* 提成明细展开行 */}
                    {expandedRows.has(row.staffId) && (
                      <tr className="bg-slate-50/80">
                        <td colSpan={14} className="p-0">
                          <div className="px-6 py-3">
                            {row.employmentStatus === 'probation' ? (
                              <div className="text-center py-4 text-amber-600 text-sm">
                                <Badge className="bg-amber-100 text-amber-700 border-amber-200 mr-2">试用期</Badge>
                                试用期员工无提成，仅发放底薪
                              </div>
                            ) : row.commissionDetails && row.commissionDetails.length > 0 ? (
                              <div>
                                <div className="flex items-center justify-between mb-2">
                                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                    提成明细 · {row.commissionDetails.length} 笔订单
                                  </h4>
                                  {row.employmentStatus === 'mid_month_regular' && (
                                    <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-[10px]">
                                      月中转正：仅转正后订单参与提成计算
                                    </Badge>
                                  )}
                                </div>
                                <div className="border rounded-lg overflow-hidden bg-white">
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="bg-muted/40 border-b">
                                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">订单编号</th>
                                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">客户名</th>
                                        <th className="text-center py-2 px-3 font-medium text-muted-foreground">日期</th>
                                        <th className="text-right py-2 px-3 font-medium text-muted-foreground">营业额(¥)</th>
                                        <th className="text-right py-2 px-3 font-medium text-muted-foreground">产品利润(¥)</th>
                                        <th className="text-right py-2 px-3 font-medium text-muted-foreground">运费利润(¥)</th>
                                        <th className="text-right py-2 px-3 font-medium text-emerald-700">总利润(¥)</th>
                                        <th className="text-center py-2 px-3 font-medium text-muted-foreground">参与提成</th>
                                        <th className="text-right py-2 px-3 font-medium text-orange-700">高利润奖励(¥)</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {row.commissionDetails.map((detail: any, idx: number) => (
                                        <tr key={idx} className={`border-b last:border-0 ${!detail.participatesInCommission ? 'opacity-50 bg-gray-50' : 'hover:bg-muted/20'}`}>
                                          <td className="py-1.5 px-3 font-mono text-xs">{detail.orderNumber || '-'}</td>
                                          <td className="py-1.5 px-3">{detail.customerName || '-'}</td>
                                          <td className="py-1.5 px-3 text-center text-muted-foreground">{detail.orderDate || '-'}</td>
                                          <td className="py-1.5 px-3 text-right">¥{detail.revenue.toLocaleString()}</td>
                                          <td className="py-1.5 px-3 text-right">¥{detail.productProfit.toLocaleString()}</td>
                                          <td className="py-1.5 px-3 text-right">¥{detail.shippingProfit.toLocaleString()}</td>
                                          <td className="py-1.5 px-3 text-right font-medium">
                                            <span className={detail.totalProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}>
                                              ¥{detail.totalProfit.toLocaleString()}
                                            </span>
                                          </td>
                                          <td className="py-1.5 px-3 text-center">
                                            {detail.participatesInCommission ? (
                                              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]">是</Badge>
                                            ) : (
                                              <Badge className="bg-gray-100 text-gray-500 border-gray-200 text-[10px]">否</Badge>
                                            )}
                                          </td>
                                          <td className="py-1.5 px-3 text-right">
                                            {detail.highProfitBonus > 0 ? (
                                              <span className="text-orange-600 font-medium">¥{detail.highProfitBonus.toLocaleString()}</span>
                                            ) : (
                                              <span className="text-muted-foreground">-</span>
                                            )}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                    {row.commissionDetails.filter((d: any) => d.participatesInCommission).length > 0 && (
                                      <tfoot>
                                        <tr className="border-t bg-muted/20 font-medium text-xs">
                                          <td colSpan={3} className="py-1.5 px-3 text-muted-foreground">
                                            参与提成计算的订单合计
                                          </td>
                                          <td className="py-1.5 px-3 text-right">
                                            ¥{row.commissionDetails.filter((d: any) => d.participatesInCommission).reduce((s: number, d: any) => s + d.revenue, 0).toLocaleString()}
                                          </td>
                                          <td className="py-1.5 px-3 text-right">
                                            ¥{row.commissionDetails.filter((d: any) => d.participatesInCommission).reduce((s: number, d: any) => s + d.productProfit, 0).toLocaleString()}
                                          </td>
                                          <td className="py-1.5 px-3 text-right">
                                            ¥{row.commissionDetails.filter((d: any) => d.participatesInCommission).reduce((s: number, d: any) => s + d.shippingProfit, 0).toLocaleString()}
                                          </td>
                                          <td className="py-1.5 px-3 text-right text-emerald-600">
                                            ¥{row.commissionDetails.filter((d: any) => d.participatesInCommission).reduce((s: number, d: any) => s + d.totalProfit, 0).toLocaleString()}
                                          </td>
                                          <td className="py-1.5 px-3"></td>
                                          <td className="py-1.5 px-3 text-right text-orange-600">
                                            ¥{row.commissionDetails.filter((d: any) => d.participatesInCommission).reduce((s: number, d: any) => s + d.highProfitBonus, 0).toLocaleString()}
                                          </td>
                                        </tr>
                                      </tfoot>
                                    )}
                                  </table>
                                </div>
                              </div>
                            ) : (
                              <div className="text-center py-4 text-muted-foreground text-sm">
                                暂无订单提成明细
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                    </React.Fragment>
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
              <p>{isMultiMonth ? `所选${selectedMonths.length}个月份` : formatMonth(yearMonth)} 暂无工资数据</p>
              <p className="text-xs mt-1">请确认{isMultiMonth ? "对应月份" : formatMonth(dataMonth)}有已完成的客服订单数据</p>
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
