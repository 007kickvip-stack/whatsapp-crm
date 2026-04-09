import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  LineChart, Line, PieChart, Pie, Cell,
} from "recharts";
import { BarChart3, TrendingUp, DollarSign, Percent, Package, Truck, Filter, RotateCcw } from "lucide-react";

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"];

function fmtMoney(val: string | number | null | undefined) {
  const n = parseFloat(String(val || "0"));
  return n.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPct(val: string | number | null | undefined) {
  const n = parseFloat(String(val || "0")) * 100;
  return n.toFixed(1) + "%";
}

export default function ProfitReportPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  // Filters
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [staffName, setStaffName] = useState("");

  const { data: staffNames } = trpc.profitReport.staffNames.useQuery();

  const queryInput = useMemo(() => ({
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    staffName: (staffName && staffName !== "__all__") ? staffName : undefined,
  }), [startDate, endDate, staffName]);

  const { data: report, isLoading } = trpc.profitReport.summary.useQuery(queryInput, {
    enabled: isAdmin,
  });

  const clearFilters = () => {
    setStartDate("");
    setEndDate("");
    setStaffName("");
  };

  const hasFilters = startDate || endDate || staffName;

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

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-blue-600" />
            利润统计报表
          </h1>
          <p className="text-sm text-gray-500 mt-1">按时间段、客服维度查看利润数据和趋势分析</p>
        </div>
      </div>

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

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Daily Trend */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">利润趋势</CardTitle>
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

            {/* Profit Breakdown Pie */}
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

          {/* Staff Performance Table & Chart */}
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
                      {byStaff.map((s: any, i: number) => (
                        <TableRow key={i}>
                          <TableCell className="text-center font-medium">{s.staffName || "未知"}</TableCell>
                          <TableCell className="text-center">{s.orderCount}</TableCell>
                          <TableCell className="text-center font-mono">¥{fmtMoney(s.totalRevenueCny)}</TableCell>
                          <TableCell className="text-center font-mono text-emerald-600">¥{fmtMoney(s.totalProfit)}</TableCell>
                          <TableCell className="text-center font-mono">{fmtPct(s.avgProfitRate)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}
