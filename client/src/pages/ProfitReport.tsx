import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, ReferenceLine,
} from "recharts";
import {
  BarChart3, TrendingUp, TrendingDown, DollarSign, Percent, Package, Truck,
  Filter, RotateCcw, AlertTriangle, Settings, ArrowUpRight, ArrowDownRight, Minus,
} from "lucide-react";
import { toast } from "sonner";

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"];

function fmtMoney(val: string | number | null | undefined) {
  const n = parseFloat(String(val || "0"));
  return n.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPct(val: string | number | null | undefined) {
  const n = parseFloat(String(val || "0")) * 100;
  return n.toFixed(1) + "%";
}

function GrowthBadge({ value, label }: { value: number | null; label: string }) {
  if (value === null || value === undefined) return <span className="text-xs text-gray-400">{label}: --</span>;
  const pct = (value * 100).toFixed(1);
  const isPositive = value > 0;
  const isZero = value === 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${isPositive ? "text-emerald-600" : isZero ? "text-gray-500" : "text-red-500"}`}>
      {isPositive ? <ArrowUpRight className="h-3 w-3" /> : isZero ? <Minus className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {label}: {isPositive ? "+" : ""}{pct}%
    </span>
  );
}

export default function ProfitReportPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  // Filters
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [staffName, setStaffName] = useState("");
  const [comparisonTab, setComparisonTab] = useState("monthly");

  // Alert settings dialog
  const [alertDialogOpen, setAlertDialogOpen] = useState(false);
  const [alertRate, setAlertRate] = useState("");
  const [alertEnabled, setAlertEnabled] = useState(true);

  const { data: staffNames } = trpc.profitReport.staffNames.useQuery();

  const queryInput = useMemo(() => ({
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    staffName: (staffName && staffName !== "__all__") ? staffName : undefined,
  }), [startDate, endDate, staffName]);

  const comparisonInput = useMemo(() => ({
    staffName: (staffName && staffName !== "__all__") ? staffName : undefined,
  }), [staffName]);

  const { data: report, isLoading } = trpc.profitReport.summary.useQuery(queryInput, { enabled: isAdmin });
  const { data: monthlyData } = trpc.profitReport.monthlyComparison.useQuery(comparisonInput, { enabled: isAdmin && comparisonTab === "monthly" });
  const { data: quarterlyData } = trpc.profitReport.quarterlyComparison.useQuery(comparisonInput, { enabled: isAdmin && comparisonTab === "quarterly" });
  const { data: alertData } = trpc.profitReport.staffAlerts.useQuery(undefined, { enabled: isAdmin });
  const { data: alertSetting } = trpc.profitReport.alertSetting.useQuery(undefined, { enabled: isAdmin });

  const utils = trpc.useUtils();
  const updateAlertMutation = trpc.profitReport.updateAlertSetting.useMutation({
    onSuccess: () => {
      utils.profitReport.alertSetting.invalidate();
      utils.profitReport.staffAlerts.invalidate();
      toast.success("预警设置已更新");
      setAlertDialogOpen(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const clearFilters = () => {
    setStartDate("");
    setEndDate("");
    setStaffName("");
  };

  const hasFilters = startDate || endDate || staffName;

  const openAlertDialog = () => {
    const currentRate = alertSetting ? parseFloat(String(alertSetting.minProfitRate)) * 100 : 10;
    setAlertRate(currentRate.toFixed(1));
    setAlertEnabled(alertSetting ? alertSetting.enabled === 1 : true);
    setAlertDialogOpen(true);
  };

  const saveAlertSetting = () => {
    const rate = parseFloat(alertRate);
    if (isNaN(rate) || rate < 0 || rate > 100) {
      toast.error("请输入0-100之间的利润率阈值");
      return;
    }
    updateAlertMutation.mutate({ minProfitRate: rate / 100, enabled: alertEnabled });
  };

  if (!isAdmin) {
    return (
      <div className="p-6 text-center text-gray-500">
        <p>仅管理员可查看利润报表</p>
      </div>
    );
  }

  const summary = report?.summary;
  const byStaff = report?.byStaff || [];
  const dailyTrend = report?.dailyTrend || [];
  const alerts = alertData?.alerts || [];
  const alertThreshold = alertSetting ? parseFloat(String(alertSetting.minProfitRate)) : 0.1;

  // Prepare chart data
  const staffChartData = byStaff.map((s: any) => ({
    name: s.staffName || "未知",
    利润: parseFloat(String(s.totalProfit || "0")),
    营收: parseFloat(String(s.totalRevenueCny || "0")),
    订单数: s.orderCount,
  }));

  const trendChartData = dailyTrend.map((d: any) => ({
    date: d.date,
    利润: parseFloat(String(d.totalProfit || "0")),
    营收: parseFloat(String(d.totalRevenueCny || "0")),
    订单数: d.orderCount,
  }));

  // Pie data for profit breakdown
  const productProfit = parseFloat(String(summary?.totalProductProfit || "0"));
  const shippingProfit = parseFloat(String(summary?.totalShippingProfit || "0"));
  const profitPieData = [
    { name: "产品毛利润", value: Math.max(0, productProfit) },
    { name: "运费利润", value: Math.max(0, shippingProfit) },
  ].filter(d => d.value > 0);

  // Monthly/Quarterly comparison chart data
  const comparisonData = comparisonTab === "monthly" ? (monthlyData || []) : (quarterlyData || []);
  const comparisonChartData = comparisonData.map((d: any) => ({
    period: d.period,
    利润: parseFloat(String(d.totalProfit || "0")),
    营收: parseFloat(String(d.totalRevenueCny || "0")),
    订单数: d.orderCount,
    利润率: parseFloat(String(d.avgProfitRate || "0")) * 100,
  }));

  // Latest period growth indicators
  const latestPeriod = comparisonData.length > 0 ? comparisonData[comparisonData.length - 1] : null;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-blue-600" />
            利润统计报表
          </h1>
          <p className="text-sm text-gray-500 mt-1">按时间段、客服维度查看利润数据和趋势分析</p>
        </div>
        <Button variant="outline" size="sm" onClick={openAlertDialog} className="gap-1.5">
          <Settings className="h-4 w-4" />
          预警设置
        </Button>
      </div>

      {/* Profit Alert Banner */}
      {alerts.length > 0 && alertSetting?.enabled === 1 && (
        <Alert variant="destructive" className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle className="text-red-800">利润预警</AlertTitle>
          <AlertDescription className="text-red-700">
            以下 {alerts.length} 位客服的平均利润率低于预警阈值 ({(alertThreshold * 100).toFixed(1)}%)：
            <span className="font-medium ml-1">
              {alerts.map((a: any) => `${a.staffName} (${fmtPct(a.avgProfitRate)})`).join("、")}
            </span>
          </AlertDescription>
        </Alert>
      )}

      {/* Filter Bar */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-end gap-4 flex-wrap">
            <div className="space-y-1">
              <Label className="text-xs text-gray-500 flex items-center gap-1">
                <Filter className="h-3 w-3" />开始日期
              </Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-40 h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">结束日期</Label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-40 h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">客服</Label>
              <Select value={staffName || "__all__"} onValueChange={(v) => setStaffName(v === "__all__" ? "" : v)}>
                <SelectTrigger className="w-36 h-9">
                  <SelectValue placeholder="全部客服" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">全部客服</SelectItem>
                  {staffNames?.map((name: string) => (
                    <SelectItem key={name} value={name}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-red-500 hover:text-red-700 h-9">
                <RotateCcw className="h-3 w-3 mr-1" />清除
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">加载中...</div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Package className="h-4 w-4" />订单数
                </div>
                <p className="text-2xl font-bold text-gray-900 mt-1">{summary?.orderCount || 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <DollarSign className="h-4 w-4" />总营收 (¥)
                </div>
                <p className="text-2xl font-bold text-gray-900 mt-1">¥{fmtMoney(summary?.totalRevenueCny)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <TrendingUp className="h-4 w-4" />总利润 (¥)
                </div>
                <p className="text-2xl font-bold text-emerald-600 mt-1">¥{fmtMoney(summary?.totalProfit)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Percent className="h-4 w-4" />平均利润率
                </div>
                <p className="text-2xl font-bold text-blue-600 mt-1">{fmtPct(summary?.avgProfitRate)}</p>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="h-4 w-4 text-blue-500" />产品利润明细
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">总售价</span>
                    <span className="font-mono">¥{fmtMoney(summary?.totalSellingPrice)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">总产品成本</span>
                    <span className="font-mono text-red-500">-¥{fmtMoney(summary?.totalProductCost)}</span>
                  </div>
                  <div className="border-t pt-2 flex justify-between font-bold">
                    <span>产品毛利润</span>
                    <span className="font-mono text-emerald-600">¥{fmtMoney(summary?.totalProductProfit)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Truck className="h-4 w-4 text-amber-500" />运费利润明细
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">收取运费</span>
                    <span className="font-mono">¥{fmtMoney(summary?.totalShippingCharged)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">实际运费</span>
                    <span className="font-mono text-red-500">-¥{fmtMoney(summary?.totalShippingActual)}</span>
                  </div>
                  <div className="border-t pt-2 flex justify-between font-bold">
                    <span>运费利润</span>
                    <span className="font-mono text-emerald-600">¥{fmtMoney(summary?.totalShippingProfit)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Monthly/Quarterly Comparison Section */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-indigo-500" />
                    同比环比分析
                  </CardTitle>
                  <CardDescription>月度和季度利润对比，分析业务增长趋势</CardDescription>
                </div>
                {latestPeriod && (
                  <div className="flex gap-3 flex-wrap">
                    <GrowthBadge
                      value={comparisonTab === "monthly" ? latestPeriod.momProfitGrowth : latestPeriod.qoqProfitGrowth}
                      label="环比"
                    />
                    <GrowthBadge
                      value={latestPeriod.yoyProfitGrowth}
                      label="同比"
                    />
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <Tabs value={comparisonTab} onValueChange={setComparisonTab} className="w-full">
                <TabsList className="mb-4">
                  <TabsTrigger value="monthly">月度对比</TabsTrigger>
                  <TabsTrigger value="quarterly">季度对比</TabsTrigger>
                </TabsList>

                <TabsContent value="monthly" className="mt-0">
                  {comparisonChartData.length > 0 ? (
                    <div className="space-y-4">
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={comparisonChartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                          <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} unit="%" />
                          <Tooltip
                            formatter={(value: number, name: string) => {
                              if (name === "利润率") return [`${value.toFixed(1)}%`, name];
                              return [`¥${value.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}`, name];
                            }}
                          />
                          <Legend />
                          <Bar yAxisId="left" dataKey="营收" fill="#3b82f6" radius={[4, 4, 0, 0]} opacity={0.7} />
                          <Bar yAxisId="left" dataKey="利润" fill="#10b981" radius={[4, 4, 0, 0]} />
                          <Line yAxisId="right" type="monotone" dataKey="利润率" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
                        </BarChart>
                      </ResponsiveContainer>
                      {/* Growth table */}
                      <ComparisonTable data={comparisonData} type="monthly" />
                    </div>
                  ) : (
                    <div className="text-center py-12 text-gray-400">暂无月度数据</div>
                  )}
                </TabsContent>

                <TabsContent value="quarterly" className="mt-0">
                  {comparisonChartData.length > 0 ? (
                    <div className="space-y-4">
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={comparisonChartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                          <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} unit="%" />
                          <Tooltip
                            formatter={(value: number, name: string) => {
                              if (name === "利润率") return [`${value.toFixed(1)}%`, name];
                              return [`¥${value.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}`, name];
                            }}
                          />
                          <Legend />
                          <Bar yAxisId="left" dataKey="营收" fill="#3b82f6" radius={[4, 4, 0, 0]} opacity={0.7} />
                          <Bar yAxisId="left" dataKey="利润" fill="#10b981" radius={[4, 4, 0, 0]} />
                          <Line yAxisId="right" type="monotone" dataKey="利润率" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
                        </BarChart>
                      </ResponsiveContainer>
                      <ComparisonTable data={comparisonData} type="quarterly" />
                    </div>
                  ) : (
                    <div className="text-center py-12 text-gray-400">暂无季度数据</div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Daily Trend & Pie Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">每日利润趋势</CardTitle>
                <CardDescription>按日期的营收和利润变化趋势</CardDescription>
              </CardHeader>
              <CardContent>
                {trendChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={trendChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip
                        formatter={(value: number, name: string) => [`¥${value.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}`, name]}
                      />
                      <Legend />
                      <Line type="monotone" dataKey="营收" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="利润" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center py-12 text-gray-400">暂无趋势数据</div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">利润构成</CardTitle>
                <CardDescription>产品利润 vs 运费利润</CardDescription>
              </CardHeader>
              <CardContent>
                {profitPieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={profitPieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={90}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {profitPieData.map((_, index) => (
                          <Cell key={index} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => `¥${value.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}`} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center py-12 text-gray-400">暂无利润数据</div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Staff Performance Table & Chart with Alert Highlighting */}
          {byStaff.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">客服利润排名</CardTitle>
                  <CardDescription>按利润降序排列</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={Math.max(200, byStaff.length * 40)}>
                    <BarChart data={staffChartData} layout="vertical" margin={{ left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
                      <Tooltip formatter={(value: number) => `¥${value.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}`} />
                      <Legend />
                      <Bar dataKey="利润" fill="#10b981" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="营收" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">客服利润详情</CardTitle>
                  {alertSetting?.enabled === 1 && (
                    <CardDescription className="flex items-center gap-1 text-xs">
                      <AlertTriangle className="h-3 w-3 text-red-500" />
                      利润率低于 {(alertThreshold * 100).toFixed(1)}% 的行将标红显示
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-center">客服</TableHead>
                        <TableHead className="text-center">订单数</TableHead>
                        <TableHead className="text-center">营收 (¥)</TableHead>
                        <TableHead className="text-center">利润 (¥)</TableHead>
                        <TableHead className="text-center">利润率</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {byStaff.map((s: any, i: number) => {
                        const rate = parseFloat(String(s.avgProfitRate || "0"));
                        const isLow = alertSetting?.enabled === 1 && rate > 0 && rate < alertThreshold;
                        return (
                          <TableRow key={i} className={isLow ? "bg-red-50" : ""}>
                            <TableCell className="text-center font-medium">
                              {isLow && <AlertTriangle className="h-3 w-3 text-red-500 inline mr-1" />}
                              {s.staffName || "未知"}
                            </TableCell>
                            <TableCell className="text-center">{s.orderCount}</TableCell>
                            <TableCell className="text-center font-mono">¥{fmtMoney(s.totalRevenueCny)}</TableCell>
                            <TableCell className="text-center font-mono text-emerald-600">¥{fmtMoney(s.totalProfit)}</TableCell>
                            <TableCell className={`text-center font-mono ${isLow ? "text-red-600 font-bold" : ""}`}>
                              {fmtPct(s.avgProfitRate)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}

      {/* Alert Settings Dialog */}
      <Dialog open={alertDialogOpen} onOpenChange={setAlertDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              利润预警设置
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>最低利润率阈值 (%)</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={alertRate}
                  onChange={e => setAlertRate(e.target.value)}
                  className="w-32"
                  placeholder="10.0"
                />
                <span className="text-sm text-gray-500">%</span>
              </div>
              <p className="text-xs text-gray-500">当客服的平均利润率低于此阈值时，将在报表中高亮提醒</p>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>启用预警</Label>
                <p className="text-xs text-gray-500">关闭后将不再显示预警提示</p>
              </div>
              <Switch checked={alertEnabled} onCheckedChange={setAlertEnabled} />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">取消</Button>
            </DialogClose>
            <Button onClick={saveAlertSetting} disabled={updateAlertMutation.isPending}>
              {updateAlertMutation.isPending ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Comparison table sub-component
function ComparisonTable({ data, type }: { data: any[]; type: "monthly" | "quarterly" }) {
  if (data.length === 0) return null;
  const isMonthly = type === "monthly";
  const chainLabel = isMonthly ? "环比" : "环比";

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-center">{isMonthly ? "月份" : "季度"}</TableHead>
            <TableHead className="text-center">订单数</TableHead>
            <TableHead className="text-center">营收 (¥)</TableHead>
            <TableHead className="text-center">利润 (¥)</TableHead>
            <TableHead className="text-center">利润率</TableHead>
            <TableHead className="text-center">利润{chainLabel}</TableHead>
            <TableHead className="text-center">利润同比</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((d: any, i: number) => {
            const chainGrowth = isMonthly ? d.momProfitGrowth : d.qoqProfitGrowth;
            const yoyGrowth = d.yoyProfitGrowth;
            return (
              <TableRow key={i}>
                <TableCell className="text-center font-medium">{d.period}</TableCell>
                <TableCell className="text-center">{d.orderCount}</TableCell>
                <TableCell className="text-center font-mono">¥{fmtMoney(d.totalRevenueCny)}</TableCell>
                <TableCell className="text-center font-mono text-emerald-600">¥{fmtMoney(d.totalProfit)}</TableCell>
                <TableCell className="text-center font-mono">{fmtPct(d.avgProfitRate)}</TableCell>
                <TableCell className="text-center">
                  <GrowthIndicator value={chainGrowth} />
                </TableCell>
                <TableCell className="text-center">
                  <GrowthIndicator value={yoyGrowth} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function GrowthIndicator({ value }: { value: number | null }) {
  if (value === null || value === undefined) return <span className="text-gray-400">--</span>;
  const pct = (value * 100).toFixed(1);
  const isPositive = value > 0;
  const isZero = value === 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-sm font-medium ${isPositive ? "text-emerald-600" : isZero ? "text-gray-500" : "text-red-500"}`}>
      {isPositive ? <TrendingUp className="h-3.5 w-3.5" /> : isZero ? <Minus className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
      {isPositive ? "+" : ""}{pct}%
    </span>
  );
}
