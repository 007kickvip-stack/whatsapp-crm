import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ShoppingCart,
  DollarSign,
  TrendingUp,
  Users,
  Package,
  ArrowUpRight,
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

const COLORS = [
  "oklch(0.65 0.15 160)",
  "oklch(0.72 0.12 80)",
  "oklch(0.55 0.12 160)",
  "oklch(0.60 0.15 30)",
  "oklch(0.60 0.10 280)",
  "oklch(0.70 0.10 200)",
];

export default function Home() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const { data: overview, isLoading: overviewLoading } =
    trpc.stats.overview.useQuery();
  const { data: recentOrders } = trpc.stats.recentOrders.useQuery({
    limit: 8,
  });
  const { data: dailyTrend } = trpc.stats.dailyTrend.useQuery({ days: 30 });
  const { data: staffPerformance } = trpc.stats.staffPerformance.useQuery(
    undefined,
    { enabled: isAdmin }
  );

  const stats = overview?.orderStats;
  const statusDist = overview?.statusDist || [];
  const paymentDist = overview?.paymentDist || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {isAdmin ? "管理员仪表盘" : "我的工作台"}
        </h1>
        <p className="text-muted-foreground mt-1">
          {isAdmin
            ? "查看所有订单和业务数据概览"
            : "查看您负责的客户和订单数据"}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-0 shadow-sm bg-gradient-to-br from-primary/5 to-primary/10">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              订单总数
            </CardTitle>
            <ShoppingCart className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {overviewLoading ? "..." : stats?.totalOrders ?? 0}
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-emerald-100/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              总营收 (CNY)
            </CardTitle>
            <DollarSign className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {overviewLoading
                ? "..."
                : `¥${Number(stats?.totalRevenueCny ?? 0).toLocaleString()}`}
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-amber-50 to-amber-100/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              总利润
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {overviewLoading
                ? "..."
                : `¥${Number(stats?.totalProfit ?? 0).toLocaleString()}`}
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-50 to-blue-100/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              客户总数
            </CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {overviewLoading
                ? "..."
                : overview?.customerStats?.total ?? 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Daily Trend */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">订单趋势 (近30天)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              {dailyTrend && dailyTrend.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dailyTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) => {
                        if (!v) return "";
                        const d = new Date(v);
                        return `${d.getMonth() + 1}/${d.getDate()}`;
                      }}
                    />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(value: number, name: string) => [
                        name === "revenue" || name === "profit"
                          ? `¥${value.toLocaleString()}`
                          : value,
                        name === "count"
                          ? "订单数"
                          : name === "revenue"
                            ? "营收"
                            : "利润",
                      ]}
                    />
                    <Legend
                      formatter={(value) =>
                        value === "count"
                          ? "订单数"
                          : value === "revenue"
                            ? "营收"
                            : "利润"
                      }
                    />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke="oklch(0.45 0.12 160)"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="profit"
                      stroke="oklch(0.72 0.12 80)"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                  暂无数据
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Order Status Distribution */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">订单状态分布</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              {statusDist.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusDist.map((s) => ({
                        name: s.status || "未知",
                        value: s.count,
                      }))}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={3}
                      dataKey="value"
                      label={({ name, percent }) =>
                        `${name} ${(percent * 100).toFixed(0)}%`
                      }
                    >
                      {statusDist.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                  暂无数据
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payment Status Distribution */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">付款状态分布</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              {paymentDist.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={paymentDist.map((s) => ({
                        name: s.status || "未知",
                        value: s.count,
                      }))}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={3}
                      dataKey="value"
                      label={({ name, percent }) =>
                        `${name} ${(percent * 100).toFixed(0)}%`
                      }
                    >
                      {paymentDist.map((s, index) => (
                        <Cell
                          key={`payment-cell-${index}`}
                          fill={
                            s.status === "已付款" ? "oklch(0.65 0.15 160)" :
                            s.status === "待付款" ? "oklch(0.75 0.15 80)" :
                            s.status === "部分付款" ? "oklch(0.60 0.15 250)" :
                            s.status === "未付款" ? "oklch(0.60 0.20 25)" :
                            COLORS[index % COLORS.length]
                          }
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                  暂无数据
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Staff Performance (Admin Only) */}
      {isAdmin && staffPerformance && staffPerformance.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">客服业绩排名</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={staffPerformance}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="staffName"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => v || "未知"}
                  />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      name === "totalProfit" || name === "totalRevenueCny"
                        ? `¥${value.toLocaleString()}`
                        : value,
                      name === "orderCount"
                        ? "订单数"
                        : name === "totalRevenueCny"
                          ? "营收"
                          : "利润",
                    ]}
                  />
                  <Legend
                    formatter={(value) =>
                      value === "orderCount"
                        ? "订单数"
                        : value === "totalRevenueCny"
                          ? "营收"
                          : "利润"
                    }
                  />
                  <Bar
                    dataKey="orderCount"
                    fill="oklch(0.45 0.12 160)"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="totalProfit"
                    fill="oklch(0.72 0.12 80)"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Orders */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">最近订单</CardTitle>
          <a
            href="/orders"
            className="text-sm text-primary hover:underline flex items-center gap-1"
          >
            查看全部 <ArrowUpRight className="h-3 w-3" />
          </a>
        </CardHeader>
        <CardContent>
          {recentOrders && recentOrders.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-3 px-2 font-medium">
                      订单编号
                    </th>
                    <th className="text-left py-3 px-2 font-medium">
                      客户 WhatsApp
                    </th>
                    <th className="text-left py-3 px-2 font-medium">客服</th>
                    <th className="text-left py-3 px-2 font-medium">状态</th>
                    <th className="text-left py-3 px-2 font-medium">付款</th>
                    <th className="text-right py-3 px-2 font-medium">
                      金额 (CNY)
                    </th>
                    <th className="text-right py-3 px-2 font-medium">利润</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((order) => (
                    <tr
                      key={order.id}
                      className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                    >
                      <td className="py-3 px-2 font-medium">
                        <a
                          href={`/orders/${order.id}`}
                          className="text-primary hover:underline"
                        >
                          {order.orderNumber}
                        </a>
                      </td>
                      <td className="py-3 px-2">{order.customerWhatsapp}</td>
                      <td className="py-3 px-2">
                        {order.staffName || "-"}
                      </td>
                      <td className="py-3 px-2">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium border ${
                          order.orderStatus === "已报货，待发货" ? "bg-orange-100 text-orange-800 border-orange-300" :
                          order.orderStatus === "待定" ? "bg-yellow-100 text-yellow-800 border-yellow-300" :
                          order.orderStatus === "缺货" ? "bg-yellow-200 text-yellow-900 border-yellow-400" :
                          order.orderStatus === "已发送qc视频，待确认" ? "bg-green-100 text-green-800 border-green-300" :
                          order.orderStatus === "已发送qc视频，已确认" ? "bg-green-200 text-green-900 border-green-400" :
                          order.orderStatus === "已发货" ? "bg-emerald-400 text-white border-emerald-500" :
                          order.orderStatus === "单号已发给顾客" ? "bg-purple-100 text-purple-800 border-purple-300" :
                          order.orderStatus === "顾客已收货" ? "bg-blue-100 text-blue-800 border-blue-300" :
                          order.orderStatus === "已退款" ? "bg-red-100 text-red-800 border-red-300" :
                          "bg-gray-50 text-gray-700 border-gray-200"
                        }`}>
                          {order.orderStatus || "已报货，待发货"}
                        </span>
                      </td>
                      <td className="py-3 px-2">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium border ${
                          order.paymentStatus === "已付款" ? "bg-emerald-100 text-emerald-800 border-emerald-300" :
                          order.paymentStatus === "待付款" ? "bg-amber-100 text-amber-800 border-amber-300" :
                          order.paymentStatus === "部分付款" ? "bg-blue-100 text-blue-800 border-blue-300" :
                          order.paymentStatus === "未付款" ? "bg-red-100 text-red-800 border-red-300" :
                          "bg-gray-100 text-gray-700 border-gray-200"
                        }`}>
                          {order.paymentStatus || "未付款"}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-right">
                        ¥{Number(order.totalAmountCny).toLocaleString()}
                      </td>
                      <td className="py-3 px-2 text-right">
                        <span
                          className={
                            Number(order.totalProfit) >= 0
                              ? "text-emerald-600"
                              : "text-red-500"
                          }
                        >
                          ¥{Number(order.totalProfit).toLocaleString()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>暂无订单数据</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
