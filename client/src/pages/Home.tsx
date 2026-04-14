import { useState, useMemo } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DollarSign,
  TrendingUp,
  Users,
  UserPlus,
  ShoppingCart,
  Star,
  PhoneCall,
  CalendarDays,
  RotateCcw,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts";

const PIE_COLORS = [
  "#10b981", "#f59e0b", "#3b82f6", "#ef4444", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#84cc16",
  "#06b6d4", "#e11d48",
];

function fmt(n: number) {
  return n >= 10000 ? `${(n / 10000).toFixed(1)}万` : n.toLocaleString();
}
function fmtMoney(n: number) {
  return `¥${fmt(n)}`;
}

function StatCard({ title, value, icon: Icon, color, sub }: {
  title: string; value: string | number; icon: any; color: string; sub?: string;
}) {
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="pt-5 pb-4 px-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">{title}</p>
            <p className="text-2xl font-bold tracking-tight">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${color}`}>
            <Icon className="h-5 w-5 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SimplePie({ data, title }: { data: { name: string; value: number }[]; title: string }) {
  if (!data || data.length === 0) return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2"><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
      <CardContent><div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">暂无数据</div></CardContent>
    </Card>
  );
  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2"><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
      <CardContent>
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                labelLine={{ strokeWidth: 1 }}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => [v, "数量"]} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Home() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const queryInput = useMemo(() => ({
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  }), [dateFrom, dateTo]);

  const { data, isLoading } = trpc.stats.dashboardV2.useQuery(queryInput);

  const summary = data?.summary;
  const staffRanking = data?.staffRanking || [];
  const monthlyNewOld = data?.monthlyNewOld || [];
  const accountRevenue = data?.accountRevenue || [];
  const monthlyRevenue = data?.monthlyRevenue || [];
  const staffMonthlyRevenue = data?.staffMonthlyRevenue || [];
  const customerTypeDist = data?.customerTypeDist || [];
  const customerTierDist = data?.customerTierDist || [];
  const orderCategoryDist = data?.orderCategoryDist || [];
  const countryDist = data?.countryDist || [];

  // 个人预估营业额：按客服分组，每个客服一条折线
  const staffMonthlyChartData = useMemo(() => {
    if (!staffMonthlyRevenue.length) return { data: [] as any[], staffNames: [] as string[] };
    const monthSet = new Set<string>();
    const nameSet = new Set<string>();
    staffMonthlyRevenue.forEach((r: any) => { monthSet.add(r.month); nameSet.add(r.staffName || "未知"); });
    const months = Array.from(monthSet).sort();
    const staffNames = Array.from(nameSet);
    const chartData = months.map((month) => {
      const entry: any = { month };
      staffNames.forEach((name) => {
        const row = staffMonthlyRevenue.find((r: any) => r.month === month && (r.staffName || "未知") === name);
        entry[`${name}_revenue`] = row?.totalRevenueCny || 0;
        entry[`${name}_profit`] = row?.totalProfit || 0;
      });
      return entry;
    });
    return { data: chartData, staffNames };
  }, [staffMonthlyRevenue]);

  return (
    <div className="space-y-5">
      {/* Header + Date Filter */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {isAdmin ? "管理员仪表盘" : "我的工作台"}
          </h1>
          <p className="text-muted-foreground mt-0.5 text-sm">
            {isAdmin ? "全局业务数据概览" : "您负责的业务数据"}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-[140px] h-8 text-xs"
            placeholder="开始日期"
          />
          <span className="text-muted-foreground text-sm">至</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-[140px] h-8 text-xs"
            placeholder="结束日期"
          />
          {(dateFrom || dateTo) && (
            <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => { setDateFrom(""); setDateTo(""); }}>
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Summary Cards - Row 1 */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="总营业额"
          value={isLoading ? "..." : fmtMoney(summary?.totalRevenueCny || 0)}
          icon={DollarSign}
          color="bg-emerald-500"
        />
        <StatCard
          title="预估总利润"
          value={isLoading ? "..." : fmtMoney(summary?.estimatedProfit || 0)}
          icon={TrendingUp}
          color="bg-amber-500"
        />
        <StatCard
          title="总回访人数"
          value={isLoading ? "..." : fmt(summary?.totalReturnVisit || 0)}
          icon={PhoneCall}
          color="bg-blue-500"
        />
        <StatCard
          title="总好评人数"
          value={isLoading ? "..." : fmt(summary?.totalPraise || 0)}
          icon={Star}
          color="bg-purple-500"
        />
      </div>

      {/* Summary Cards - Row 2 */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="总进入新客数"
          value={isLoading ? "..." : fmt(summary?.totalNewCustomers || 0)}
          icon={UserPlus}
          color="bg-teal-500"
        />
        <StatCard
          title="新客总成交单数"
          value={isLoading ? "..." : fmt(summary?.newCustomerOrders || 0)}
          icon={ShoppingCart}
          color="bg-cyan-500"
        />
        <StatCard
          title="老客总数"
          value={isLoading ? "..." : fmt(summary?.totalOldCustomers || 0)}
          icon={Users}
          color="bg-indigo-500"
        />
        <StatCard
          title="老客总成交单数"
          value={isLoading ? "..." : fmt(summary?.oldCustomerOrders || 0)}
          icon={ShoppingCart}
          color="bg-rose-500"
        />
      </div>

      {/* Staff Revenue Ranking */}
      {isAdmin && staffRanking.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">客服总营业额排行榜</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={staffRanking} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `¥${fmt(v)}`} />
                  <YAxis type="category" dataKey="staffName" tick={{ fontSize: 11 }} width={70} tickFormatter={(v) => v || "未知"} />
                  <Tooltip formatter={(v: number, name: string) => [fmtMoney(v), name === "totalRevenueCny" ? "营业额" : "利润"]} />
                  <Legend formatter={(v) => v === "totalRevenueCny" ? "营业额" : "利润"} />
                  <Bar dataKey="totalRevenueCny" fill="#10b981" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="totalProfit" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Monthly New/Old Customer Rate + Monthly Revenue */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* 每月新老客成交率折线图 */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">每月新老客成交率</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              {monthlyNewOld.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyNewOld}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} domain={[0, 1]} />
                    <Tooltip formatter={(v: number, name: string) => [`${(v * 100).toFixed(1)}%`, name === "newRate" ? "新客成交率" : "老客成交率"]} />
                    <Legend formatter={(v) => v === "newRate" ? "新客成交率" : "老客成交率"} />
                    <Line type="monotone" dataKey="newRate" stroke="#14b8a6" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="oldRate" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">暂无数据</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 每月预估总营业额、利润图 */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">每月预估总营业额 / 利润</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              {monthlyRevenue.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyRevenue}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `¥${fmt(v)}`} />
                    <Tooltip formatter={(v: number, name: string) => [fmtMoney(v), name === "totalRevenueCny" ? "营业额" : "利润"]} />
                    <Legend formatter={(v) => v === "totalRevenueCny" ? "营业额" : "利润"} />
                    <Bar dataKey="totalRevenueCny" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="totalProfit" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">暂无数据</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Account Revenue + Staff Monthly Revenue */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* 各账号营业额、利润图 */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">各账号营业额 / 利润</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              {accountRevenue.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={accountRevenue} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `¥${fmt(v)}`} />
                    <YAxis type="category" dataKey="account" tick={{ fontSize: 10 }} width={90} />
                    <Tooltip formatter={(v: number, name: string) => [fmtMoney(v), name === "totalRevenueCny" ? "营业额" : "利润"]} />
                    <Legend formatter={(v) => v === "totalRevenueCny" ? "营业额" : "利润"} />
                    <Bar dataKey="totalRevenueCny" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="totalProfit" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">暂无数据</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 个人预估营业额、利润图 */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">个人预估营业额 (按月)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              {staffMonthlyChartData.data.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={staffMonthlyChartData.data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `¥${fmt(v)}`} />
                    <Tooltip formatter={(v: number) => [fmtMoney(v)]} />
                    <Legend />
                    {staffMonthlyChartData.staffNames.map((name, i) => (
                      <Line
                        key={name}
                        type="monotone"
                        dataKey={`${name}_revenue`}
                        name={`${name} 营业额`}
                        stroke={PIE_COLORS[i % PIE_COLORS.length]}
                        strokeWidth={2}
                        dot={{ r: 2 }}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">暂无数据</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pie Charts - 4 in a row */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <SimplePie data={customerTypeDist} title="客户属性分布" />
        <SimplePie data={customerTierDist} title="客户分层分布" />
        <SimplePie data={orderCategoryDist} title="订购类目分布" />
        <SimplePie data={countryDist} title="国家分布" />
      </div>
    </div>
  );
}
