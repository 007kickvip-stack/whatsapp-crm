import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as ReTooltip,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Legend, BarChart, Bar,
} from "recharts";
import {
  Users, Repeat, Clock, DollarSign, TrendingUp, ArrowUpDown, Search,
  UserCheck, UserX, UserMinus, Crown, ChevronUp, ChevronDown,
} from "lucide-react";

const COLORS = ["#10b981", "#f59e0b", "#ef4444", "#94a3b8"];
const LTV_COLORS = ["#10b981", "#3b82f6", "#f59e0b"];

function fmtMoney(val: string | number | null | undefined) {
  const n = parseFloat(String(val || "0"));
  return "¥" + n.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function ActivityBadge({ activity }: { activity: string }) {
  switch (activity) {
    case "active":
      return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">活跃</Badge>;
    case "silent":
      return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">沉默</Badge>;
    case "lost":
      return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">流失</Badge>;
    default:
      return <Badge variant="outline">未知</Badge>;
  }
}

export default function CustomerAnalysisPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [staffFilter, setStaffFilter] = useState<string>("all");
  const [activityFilter, setActivityFilter] = useState<string>("all");
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("ltv");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [searchText, setSearchText] = useState("");

  // 获取客服列表（管理员用）
  const { data: staffList } = trpc.staffTargets.staffList.useQuery(undefined, { enabled: isAdmin });

  const overviewParams = useMemo(() => {
    const p: { staffName?: string } = {};
    if (isAdmin && staffFilter !== "all") p.staffName = staffFilter;
    return p;
  }, [isAdmin, staffFilter]);

  const listParams = useMemo(() => ({
    staffName: isAdmin && staffFilter !== "all" ? staffFilter : undefined,
    sortBy,
    sortOrder,
    activityFilter: activityFilter as any,
    tierFilter: tierFilter as any,
  }), [isAdmin, staffFilter, sortBy, sortOrder, activityFilter, tierFilter]);

  const trendParams = useMemo(() => {
    const p: { staffName?: string; months?: number } = { months: 12 };
    if (isAdmin && staffFilter !== "all") p.staffName = staffFilter;
    return p;
  }, [isAdmin, staffFilter]);

  const { data: overview, isLoading: overviewLoading } = trpc.repurchase.overview.useQuery(overviewParams);
  const { data: customerData, isLoading: listLoading } = trpc.repurchase.customerList.useQuery(listParams);
  const { data: trendData, isLoading: trendLoading } = trpc.repurchase.trend.useQuery(trendParams);

  // 搜索过滤
  const filteredCustomers = useMemo(() => {
    if (!customerData?.customers) return [];
    if (!searchText.trim()) return customerData.customers;
    const s = searchText.toLowerCase();
    return customerData.customers.filter(c =>
      c.customerName.toLowerCase().includes(s) ||
      c.customerWhatsapp.toLowerCase().includes(s) ||
      c.customerCountry.toLowerCase().includes(s) ||
      c.staffName.toLowerCase().includes(s)
    );
  }, [customerData?.customers, searchText]);

  // 活跃度饼图数据
  const activityPieData = useMemo(() => {
    if (!overview) return [];
    const d = overview.activityDistribution;
    return [
      { name: "活跃 (≤30天)", value: d.active },
      { name: "沉默 (30-90天)", value: d.silent },
      { name: "流失 (>90天)", value: d.lost },
      { name: "未知", value: d.unknown },
    ].filter(item => item.value > 0);
  }, [overview]);

  // LTV分层饼图数据
  const ltvPieData = useMemo(() => {
    if (!customerData?.ltvDistribution) return [];
    const d = customerData.ltvDistribution;
    return [
      { name: `高价值 (≥${fmtMoney(d.highThreshold)})`, value: d.high },
      { name: "中价值", value: d.medium },
      { name: `低价值 (≤${fmtMoney(d.lowThreshold)})`, value: d.low },
    ].filter(item => item.value > 0);
  }, [customerData?.ltvDistribution]);

  // 趋势图数据
  const trendChartData = useMemo(() => {
    if (!trendData) return [];
    return trendData.map(t => ({
      ...t,
      repurchaseRate: parseFloat(t.repurchaseRate),
    }));
  }, [trendData]);

  const toggleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortBy !== field) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-40" />;
    return sortOrder === "desc"
      ? <ChevronDown className="w-3 h-3 ml-1 text-primary" />
      : <ChevronUp className="w-3 h-3 ml-1 text-primary" />;
  };

  return (
    <div className="space-y-6">
      {/* 页面标题和筛选 */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">客户复购分析</h1>
          <p className="text-muted-foreground text-sm mt-1">分析客户复购行为、生命周期价值和活跃度</p>
        </div>
        {isAdmin && (
          <Select value={staffFilter} onValueChange={setStaffFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="全部客服" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部客服</SelectItem>
              {staffList?.filter((s: any) => s.name).map((s: any) => (
                <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* 汇总卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Users className="w-4 h-4" />
              总客户数
            </div>
            <div className="text-2xl font-bold">
              {overviewLoading ? "..." : overview?.totalCustomers || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Repeat className="w-4 h-4" />
              复购客户数
            </div>
            <div className="text-2xl font-bold">
              {overviewLoading ? "..." : overview?.repeatCustomerCount || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <TrendingUp className="w-4 h-4" />
              复购率
            </div>
            <div className="text-2xl font-bold text-primary">
              {overviewLoading ? "..." : `${overview?.repurchaseRate || 0}%`}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Clock className="w-4 h-4" />
              平均复购周期
            </div>
            <div className="text-2xl font-bold">
              {overviewLoading ? "..." : `${overview?.avgRepurchaseCycle || 0}天`}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <DollarSign className="w-4 h-4" />
              平均LTV
            </div>
            <div className="text-2xl font-bold">
              {overviewLoading ? "..." : fmtMoney(overview?.avgLTV)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 图表区域 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 活跃度分布 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">客户活跃度分布</CardTitle>
          </CardHeader>
          <CardContent>
            {activityPieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={activityPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {activityPieData.map((_, idx) => (
                      <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Pie>
                  <ReTooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">暂无数据</div>
            )}
          </CardContent>
        </Card>

        {/* LTV分层 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">客户价值分层 (LTV)</CardTitle>
          </CardHeader>
          <CardContent>
            {ltvPieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={ltvPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {ltvPieData.map((_, idx) => (
                      <Cell key={idx} fill={LTV_COLORS[idx % LTV_COLORS.length]} />
                    ))}
                  </Pie>
                  <ReTooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">暂无数据</div>
            )}
          </CardContent>
        </Card>

        {/* 复购趋势 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">月度复购趋势</CardTitle>
          </CardHeader>
          <CardContent>
            {trendChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={trendChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="yearMonth" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} unit="%" />
                  <ReTooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar yAxisId="left" dataKey="newCustomers" name="新客户" fill="#3b82f6" opacity={0.6} />
                  <Bar yAxisId="left" dataKey="repeatCustomers" name="复购客户" fill="#10b981" opacity={0.6} />
                  <Line yAxisId="right" type="monotone" dataKey="repurchaseRate" name="复购率%" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">暂无数据</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 客户明细表格 */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base font-medium">客户价值明细</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索客户..."
                  className="pl-8 w-[200px] h-9"
                  value={searchText}
                  onChange={e => setSearchText(e.target.value)}
                />
              </div>
              <Select value={activityFilter} onValueChange={setActivityFilter}>
                <SelectTrigger className="w-[120px] h-9">
                  <SelectValue placeholder="活跃度" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="active">活跃</SelectItem>
                  <SelectItem value="silent">沉默</SelectItem>
                  <SelectItem value="lost">流失</SelectItem>
                </SelectContent>
              </Select>
              <Select value={tierFilter} onValueChange={setTierFilter}>
                <SelectTrigger className="w-[120px] h-9">
                  <SelectValue placeholder="价值分层" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部价值</SelectItem>
                  <SelectItem value="high">高价值</SelectItem>
                  <SelectItem value="medium">中价值</SelectItem>
                  <SelectItem value="low">低价值</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px] text-center">#</TableHead>
                  <TableHead>客户名字</TableHead>
                  <TableHead>WhatsApp</TableHead>
                  <TableHead>国家</TableHead>
                  {isAdmin && <TableHead>客服</TableHead>}
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("orderCount")}>
                    <div className="flex items-center">订单数<SortIcon field="orderCount" /></div>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("ltv")}>
                    <div className="flex items-center">LTV (¥)<SortIcon field="ltv" /></div>
                  </TableHead>
                  <TableHead>消费 ($)</TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("avgRepurchaseCycle")}>
                    <div className="flex items-center">复购周期<SortIcon field="avgRepurchaseCycle" /></div>
                  </TableHead>
                  <TableHead>首次下单</TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("lastOrderDate")}>
                    <div className="flex items-center">最近下单<SortIcon field="lastOrderDate" /></div>
                  </TableHead>
                  <TableHead>活跃度</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {listLoading ? (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 12 : 11} className="text-center py-8 text-muted-foreground">
                      加载中...
                    </TableCell>
                  </TableRow>
                ) : filteredCustomers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 12 : 11} className="text-center py-8 text-muted-foreground">
                      暂无数据
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCustomers.map((c, idx) => {
                    // 判断是否高价值客户
                    const isHighValue = customerData?.ltvDistribution
                      ? Number(c.ltv) >= Number(customerData.ltvDistribution.highThreshold)
                      : false;
                    return (
                      <TableRow key={c.customerWhatsapp} className={isHighValue ? "bg-green-50/50" : ""}>
                        <TableCell className="text-center text-muted-foreground text-xs">
                          {idx + 1}
                          {isHighValue && <Crown className="w-3 h-3 text-yellow-500 inline ml-1" />}
                        </TableCell>
                        <TableCell className="font-medium">{c.customerName || "-"}</TableCell>
                        <TableCell className="text-xs">{c.customerWhatsapp}</TableCell>
                        <TableCell>{c.customerCountry || "-"}</TableCell>
                        {isAdmin && <TableCell>{c.staffName || "-"}</TableCell>}
                        <TableCell className="font-medium">{c.orderCount}</TableCell>
                        <TableCell className="font-medium">{fmtMoney(c.ltv)}</TableCell>
                        <TableCell>${Number(c.totalSpentUsd).toLocaleString("en-US", { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell>
                          {Number(c.avgRepurchaseCycle) > 0 ? `${c.avgRepurchaseCycle}天` : "-"}
                        </TableCell>
                        <TableCell className="text-xs">{c.firstOrderDate || "-"}</TableCell>
                        <TableCell className="text-xs">{c.lastOrderDate || "-"}</TableCell>
                        <TableCell><ActivityBadge activity={c.activity} /></TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
          {filteredCustomers.length > 0 && (
            <div className="px-4 py-3 border-t text-sm text-muted-foreground">
              共 {filteredCustomers.length} 位客户
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
