import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Plus,
  Search,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Users,
  Filter,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  X,
  BarChart3,
} from "lucide-react";
import { toast } from "sonner";
import AccountSelect from "@/components/AccountSelect";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
} from "recharts";

// 客户属性颜色映射
const customerTypeColors: Record<string, string> = {
  "新零售": "bg-yellow-200 text-yellow-900 border-yellow-300",
  "零售复购": "bg-yellow-400 text-yellow-900 border-yellow-500",
};

// 客户属性选项
const customerTypeOptions = ["零售复购", "新零售"];

// 客户分层选项
const customerTiers = ["低质量", "中等质量", "高质量", "批发商-低质量", "批发商-高质量", "经销商-低质量", "经销商-高质量"];

// 表格列定义 - 按用户要求的顺序
const columns = [
  { key: "index", label: "序号", width: "w-[50px]", editable: false },
  { key: "firstOrderDate", label: "首次下单日期", width: "w-[110px]", editable: false, type: "date" },
  { key: "staffName", label: "客服名字", width: "w-[90px]", editable: true, type: "text" },
  { key: "account", label: "账号", width: "w-[120px]", editable: true, type: "account" },
  { key: "customerName", label: "客户名字", width: "w-[100px]", editable: true, type: "text" },
  { key: "whatsapp", label: "客户WhatsApp", width: "w-[140px]", editable: true, type: "text" },
  { key: "customerEmail", label: "客户邮箱", width: "w-[160px]", editable: true, type: "text" },
  { key: "contactInfo", label: "联系方式", width: "w-[120px]", editable: true, type: "text" },
  { key: "country", label: "国家", width: "w-[80px]", editable: true, type: "text" },
  { key: "totalOrderCount", label: "累计订单数", width: "w-[90px]", editable: false, type: "number" },
  { key: "totalSpentUsd", label: "累计消费($)", width: "w-[100px]", editable: false, type: "money" },
  { key: "totalSpentCny", label: "累计消费(¥)", width: "w-[100px]", editable: false, type: "money" },
  { key: "customerType", label: "客户属性", width: "w-[110px]", editable: true, type: "customerType" },
  { key: "customerTier", label: "客户分层", width: "w-[90px]", editable: true, type: "tier" },
  { key: "orderCategory", label: "订购类目", width: "w-[120px]", editable: true, type: "text" },
  { key: "birthDate", label: "出生日期", width: "w-[110px]", editable: true, type: "date" },
];

// 订单状态颜色映射
const orderStatusColors: Record<string, string> = {
  "已报货，待发货": "bg-blue-100 text-blue-800 border-blue-200",
  "待定": "bg-gray-100 text-gray-800 border-gray-200",
  "缺货": "bg-red-100 text-red-800 border-red-200",
  "已发货": "bg-green-100 text-green-800 border-green-200",
  "已发送qc视频，待确认": "bg-yellow-100 text-yellow-800 border-yellow-200",
  "已发送qc视频，已确认": "bg-emerald-100 text-emerald-800 border-emerald-200",
  "单号已发给顾客": "bg-purple-100 text-purple-800 border-purple-200",
};

const paymentStatusColors: Record<string, string> = {
  "未付款": "bg-red-100 text-red-800 border-red-200",
  "已付款": "bg-green-100 text-green-800 border-green-200",
  "已付定金": "bg-yellow-100 text-yellow-800 border-yellow-200",
  "尾款已付": "bg-emerald-100 text-emerald-800 border-emerald-200",
};

// 客户详情组件（折线图 + 历史订单列表）
function CustomerDetail({ customerId }: { customerId: number }) {
  const [dateRange, setDateRange] = useState<"all" | "30d" | "90d" | "180d" | "1y">("all");
  const [activeTab, setActiveTab] = useState<"chart" | "orders">("orders");
  
  const dateParams = useMemo(() => {
    if (dateRange === "all") return {};
    const now = new Date();
    const days = dateRange === "30d" ? 30 : dateRange === "90d" ? 90 : dateRange === "180d" ? 180 : 365;
    const start = new Date(now.getTime() - days * 86400000);
    return {
      startDate: start.toISOString().split("T")[0],
      endDate: now.toISOString().split("T")[0],
    };
  }, [dateRange]);

  const { data: chartData, isLoading: chartLoading } = trpc.customers.orderHistory.useQuery({
    customerId,
    ...dateParams,
  });

  const { data: orderList, isLoading: ordersLoading } = trpc.customers.orderList.useQuery({
    customerId,
    ...dateParams,
  });

  const processedChartData = useMemo(() => {
    if (!chartData || chartData.length === 0) return [];
    return chartData.map((d: any) => ({
      date: d.date ? new Date(d.date).toLocaleDateString("zh-CN", { month: "short", day: "numeric" }) : "未知",
      rawDate: d.date,
      orderCount: d.orderCount,
      totalUsd: Number(d.totalUsd),
      totalCny: Number(d.totalCny),
    }));
  }, [chartData]);

  return (
    <div className="px-4 py-3 bg-muted/30">
      {/* 头部：标签页 + 时间筛选 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1">
          <Button
            variant={activeTab === "orders" ? "default" : "ghost"}
            size="sm"
            className="h-6 px-3 text-[11px]"
            onClick={() => setActiveTab("orders")}
          >
            历史订单
          </Button>
          <Button
            variant={activeTab === "chart" ? "default" : "ghost"}
            size="sm"
            className="h-6 px-3 text-[11px]"
            onClick={() => setActiveTab("chart")}
          >
            消费趋势
          </Button>
        </div>
        <div className="flex items-center gap-1">
          {(["all", "30d", "90d", "180d", "1y"] as const).map((r) => (
            <Button
              key={r}
              variant={dateRange === r ? "default" : "ghost"}
              size="sm"
              className="h-5 px-2 text-[10px]"
              onClick={() => setDateRange(r)}
            >
              {r === "all" ? "全部" : r === "30d" ? "30天" : r === "90d" ? "90天" : r === "180d" ? "半年" : "1年"}
            </Button>
          ))}
        </div>
      </div>

      {/* 历史订单列表 */}
      {activeTab === "orders" && (
        <div className="max-h-[300px] overflow-y-auto">
          {ordersLoading ? (
            <div className="py-4 text-center text-xs text-muted-foreground">加载中...</div>
          ) : !orderList || orderList.length === 0 ? (
            <div className="py-4 text-center text-xs text-muted-foreground">暂无订单数据</div>
          ) : (
            <table className="w-full text-[11px]">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="py-1.5 px-2 text-left font-medium text-gray-600">订单日期</th>
                  <th className="py-1.5 px-2 text-left font-medium text-gray-600">订单编号</th>
                  <th className="py-1.5 px-2 text-center font-medium text-gray-600">客户属性</th>
                  <th className="py-1.5 px-2 text-center font-medium text-gray-600">订单状态</th>
                  <th className="py-1.5 px-2 text-center font-medium text-gray-600">付款状态</th>
                  <th className="py-1.5 px-2 text-right font-medium text-gray-600">金额($)</th>
                  <th className="py-1.5 px-2 text-right font-medium text-gray-600">金额(¥)</th>
                  <th className="py-1.5 px-2 text-left font-medium text-gray-600">备注</th>
                </tr>
              </thead>
              <tbody>
                {orderList.map((order: any) => (
                  <tr key={order.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="py-1.5 px-2 text-gray-700">
                      {order.orderDate ? new Date(order.orderDate).toLocaleDateString("zh-CN") : "-"}
                    </td>
                    <td className="py-1.5 px-2 font-medium text-primary">{order.orderNumber || "-"}</td>
                    <td className="py-1.5 px-2 text-center">
                      {order.customerType ? (
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium border ${customerTypeColors[order.customerType] || "bg-gray-100 text-gray-700 border-gray-200"}`}>
                          {order.customerType}
                        </span>
                      ) : "-"}
                    </td>
                    <td className="py-1.5 px-2 text-center">
                      {order.orderStatus ? (
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium border ${orderStatusColors[order.orderStatus] || "bg-gray-100 text-gray-700 border-gray-200"}`}>
                          {order.orderStatus}
                        </span>
                      ) : "-"}
                    </td>
                    <td className="py-1.5 px-2 text-center">
                      {order.paymentStatus ? (
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium border ${paymentStatusColors[order.paymentStatus] || "bg-gray-100 text-gray-700 border-gray-200"}`}>
                          {order.paymentStatus}
                        </span>
                      ) : "-"}
                    </td>
                    <td className="py-1.5 px-2 text-right text-gray-700">
                      {order.totalAmountUsd ? `$${Number(order.totalAmountUsd).toFixed(2)}` : "-"}
                    </td>
                    <td className="py-1.5 px-2 text-right text-gray-700">
                      {order.totalAmountCny ? `¥${Number(order.totalAmountCny).toFixed(2)}` : "-"}
                    </td>
                    <td className="py-1.5 px-2 text-gray-500 max-w-[150px] truncate">{order.remarks || "-"}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 font-medium">
                  <td className="py-1.5 px-2">合计</td>
                  <td className="py-1.5 px-2">{orderList.length} 笔订单</td>
                  <td colSpan={3}></td>
                  <td className="py-1.5 px-2 text-right text-emerald-700">
                    ${orderList.reduce((sum: number, o: any) => sum + Number(o.totalAmountUsd || 0), 0).toFixed(2)}
                  </td>
                  <td className="py-1.5 px-2 text-right text-emerald-700">
                    ¥{orderList.reduce((sum: number, o: any) => sum + Number(o.totalAmountCny || 0), 0).toFixed(2)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      )}

      {/* 消费趋势折线图 */}
      {activeTab === "chart" && (
        <div>
          {chartLoading ? (
            <div className="py-4 text-center text-xs text-muted-foreground">加载中...</div>
          ) : processedChartData.length === 0 ? (
            <div className="py-4 text-center text-xs text-muted-foreground">暂无订单数据</div>
          ) : (
            <div className="h-[160px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={processedChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
                  <RechartsTooltip
                    contentStyle={{ fontSize: 11, borderRadius: 8 }}
                    formatter={(value: number, name: string) => {
                      if (name === "orderCount") return [value, "订单数"];
                      if (name === "totalUsd") return [`$${value.toFixed(2)}`, "消费($)"];
                      if (name === "totalCny") return [`¥${value.toFixed(2)}`, "消费(¥)"];
                      return [value, name];
                    }}
                  />
                  <Legend
                    formatter={(value: string) => {
                      if (value === "orderCount") return "订单数";
                      if (value === "totalUsd") return "消费($)";
                      if (value === "totalCny") return "消费(¥)";
                      return value;
                    }}
                    wrapperStyle={{ fontSize: 10 }}
                  />
                  <Line yAxisId="left" type="monotone" dataKey="orderCount" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                  <Line yAxisId="right" type="monotone" dataKey="totalUsd" stroke="#10b981" strokeWidth={1.5} dot={{ r: 2 }} strokeDasharray="4 2" />
                  <Line yAxisId="right" type="monotone" dataKey="totalCny" stroke="#f59e0b" strokeWidth={1.5} dot={{ r: 2 }} strokeDasharray="4 2" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function CustomersPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editingCell, setEditingCell] = useState<{ id: number; field: string } | null>(null);
  const [editValue, setEditValue] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filterStaffName, setFilterStaffName] = useState("");
  const [filterAccount, setFilterAccount] = useState("");
  const [filterCustomerType, setFilterCustomerType] = useState("");

  const [showNewRow, setShowNewRow] = useState(false);
  const [expandedCustomers, setExpandedCustomers] = useState<Set<number>>(new Set());
  const [newCustomer, setNewCustomer] = useState<Record<string, string>>({
    whatsapp: "",
    staffName: "",
    account: "",
    contactInfo: "",
    customerType: "新零售",
    address: "",

    orderCategory: "",
    customerName: "",
    birthDate: "",
    customerEmail: "",
    country: "",
    customerTier: "",
  });

  const utils = trpc.useUtils();

  const queryInput = useMemo(() => ({
    page,
    pageSize: 50,
    search: search || undefined,
    staffName: filterStaffName || undefined,
    account: filterAccount || undefined,
    customerType: filterCustomerType || undefined,
  }), [page, search, filterStaffName, filterAccount, filterCustomerType]);

  const { data, isLoading } = trpc.customers.list.useQuery(queryInput);

  const createMutation = trpc.customers.create.useMutation({
    onSuccess: () => {
      toast.success("客户创建成功");
      utils.customers.list.invalidate();
      setShowNewRow(false);
      setNewCustomer({
        whatsapp: "", staffName: "", account: "", contactInfo: "",
        customerType: "新零售", address: "",
        orderCategory: "", customerName: "", birthDate: "", customerEmail: "",
        country: "", customerTier: "",
      });
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.customers.update.useMutation({
    onSuccess: () => {
      utils.customers.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.customers.delete.useMutation({
    onSuccess: () => {
      toast.success("客户已删除");
      utils.customers.list.invalidate();
      setDeleteId(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const syncStatsMutation = trpc.customers.syncStats.useMutation({
    onSuccess: () => {
      toast.success("统计数据已同步");
      utils.customers.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  // 切换折线图展开
  const toggleChart = useCallback((id: number) => {
    setExpandedCustomers(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // 开始编辑单元格
  const startEdit = useCallback((id: number, field: string, currentValue: string) => {
    setEditingCell({ id, field });
    setEditValue(currentValue || "");
  }, []);

  // 保存编辑
  const saveEdit = useCallback(() => {
    if (!editingCell) return;
    const { id, field } = editingCell;
    updateMutation.mutate({ id, [field]: editValue || undefined });
    setEditingCell(null);
    setEditValue("");
  }, [editingCell, editValue, updateMutation]);

  // 取消编辑
  const cancelEdit = useCallback(() => {
    setEditingCell(null);
    setEditValue("");
  }, []);

  // 键盘事件处理
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      saveEdit();
    } else if (e.key === "Escape") {
      cancelEdit();
    }
  }, [saveEdit, cancelEdit]);

  // 自动聚焦编辑输入框
  useEffect(() => {
    if (editingCell && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingCell]);

  // 创建新客户
  const handleCreateCustomer = () => {
    if (!newCustomer.whatsapp.trim()) {
      toast.error("客户WhatsApp不能为空");
      return;
    }
    createMutation.mutate(newCustomer as any);
  };

  // 获取单元格显示值
  const getCellValue = (customer: any, col: typeof columns[0], rowIndex: number) => {
    if (col.key === "index") return String((page - 1) * 50 + rowIndex + 1);
    const val = customer[col.key];
    if (val === null || val === undefined) return "";
    if (col.type === "money") return Number(val).toFixed(2);
    if (col.type === "date" && val) {
      try {
        const d = new Date(val);
        return d.toISOString().split("T")[0];
      } catch { return String(val); }
    }
    return String(val);
  };

  const totalPages = Math.ceil((data?.total ?? 0) / 50);
  const hasActiveFilters = filterStaffName || filterAccount || filterCustomerType;

  // 渲染可编辑单元格
  const renderCell = (customer: any, col: typeof columns[0], rowIndex: number) => {
    const cellValue = getCellValue(customer, col, rowIndex);
    const isEditing = editingCell?.id === customer.id && editingCell?.field === col.key;

    // 序号列
    if (col.key === "index") {
      return <span className="text-muted-foreground text-xs">{cellValue}</span>;
    }

    // 不可编辑列
    if (!col.editable) {
      if (col.type === "money") {
        return <span className="font-mono text-xs">{cellValue !== "0.00" ? cellValue : "-"}</span>;
      }
      if (col.type === "number") {
        return <span className="font-mono text-xs">{Number(cellValue) > 0 ? cellValue : "-"}</span>;
      }
      if (col.type === "date") {
        return <span className="text-xs">{cellValue || "-"}</span>;
      }
      return <span className="text-xs">{cellValue || "-"}</span>;
    }

    // 编辑中
    if (isEditing) {
      // 客户属性下拉
      if (col.type === "customerType") {
        return (
          <Select value={editValue} onValueChange={(v) => {
            updateMutation.mutate({ id: customer.id, [col.key]: v });
            setEditingCell(null);
          }}>
            <SelectTrigger className="h-7 text-xs border-primary">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {customerTypeOptions.map(t => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      }

      // 客户分层下拉
      if (col.type === "tier") {
        return (
          <Select value={editValue} onValueChange={(v) => {
            updateMutation.mutate({ id: customer.id, [col.key]: v });
            setEditingCell(null);
          }}>
            <SelectTrigger className="h-7 text-xs border-primary">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {customerTiers.map(t => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      }
      // 账号下拉
      if (col.type === "account") {
        return (
          <AccountSelect
            value={editValue}
            onValueChange={(v: string) => {
              updateMutation.mutate({ id: customer.id, [col.key]: v });
              setEditingCell(null);
            }}
            compact
          />
        );
      }
      // 日期输入
      if (col.type === "date") {
        return (
          <input
            type="date"
            ref={editInputRef as any}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={saveEdit}
            onKeyDown={handleKeyDown}
            className="w-full h-7 text-xs border border-primary rounded px-1 bg-background"
          />
        );
      }
      // 文本输入
      return (
        <input
          ref={editInputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={saveEdit}
          onKeyDown={handleKeyDown}
          className="w-full h-7 text-xs border border-primary rounded px-1 bg-background"
        />
      );
    }

    // 显示模式
    if (col.type === "customerType") {
      const colorClass = customerTypeColors[cellValue] || "bg-gray-100 text-gray-700 border-gray-200";
      return (
        <span
          className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium border cursor-pointer ${colorClass}`}
          onClick={() => startEdit(customer.id, col.key, cellValue)}
        >
          {cellValue || "新零售"}
        </span>
      );
    }

    if (col.type === "tier") {
      if (!cellValue) {
        return (
          <span
            className="text-xs cursor-pointer hover:bg-muted/50 block w-full min-h-[20px] px-0.5 rounded text-muted-foreground/40"
            onClick={() => startEdit(customer.id, col.key, cellValue)}
          >-</span>
        );
      }
      const tierColors: Record<string, string> = {
        "高价值": "bg-emerald-100 text-emerald-800 border-emerald-200",
        "中价值": "bg-blue-100 text-blue-800 border-blue-200",
        "低价值": "bg-gray-100 text-gray-700 border-gray-200",
        "新客户": "bg-purple-100 text-purple-800 border-purple-200",
        "流失客户": "bg-red-100 text-red-800 border-red-200",
      };
      const colorClass = tierColors[cellValue] || "bg-gray-100 text-gray-700 border-gray-200";
      return (
        <span
          className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium border cursor-pointer ${colorClass}`}
          onClick={() => startEdit(customer.id, col.key, cellValue)}
        >
          {cellValue}
        </span>
      );
    }

    return (
      <span
        className="text-xs cursor-pointer hover:bg-muted/50 block w-full min-h-[20px] px-0.5 rounded"
        onClick={() => startEdit(customer.id, col.key, cellValue)}
      >
        {cellValue || <span className="text-muted-foreground/40">-</span>}
      </span>
    );
  };

  // 渲染新建行的单元格
  const renderNewCell = (col: typeof columns[0]) => {
    if (col.key === "index") return <span className="text-muted-foreground text-xs">新</span>;
    if (!col.editable) return <span className="text-muted-foreground/40 text-xs">自动</span>;

    if (col.type === "customerType") {
      return (
        <Select value={newCustomer.customerType || "新零售"} onValueChange={(v) => setNewCustomer(prev => ({ ...prev, customerType: v }))}>
          <SelectTrigger className="h-7 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {customerTypeOptions.map(t => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    if (col.type === "tier") {
      return (
        <Select value={newCustomer.customerTier || ""} onValueChange={(v) => setNewCustomer(prev => ({ ...prev, customerTier: v }))}>
          <SelectTrigger className="h-7 text-xs">
            <SelectValue placeholder="-" />
          </SelectTrigger>
          <SelectContent>
            {customerTiers.map(t => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
    if (col.type === "account") {
      return (
        <AccountSelect
          value={newCustomer.account || ""}
          onValueChange={(v: string) => setNewCustomer(prev => ({ ...prev, account: v }))}
          compact
        />
      );
    }
    if (col.type === "date") {
      return (
        <input
          type="date"
          value={newCustomer[col.key] || ""}
          onChange={(e) => setNewCustomer(prev => ({ ...prev, [col.key]: e.target.value }))}
          className="w-full h-7 text-xs border rounded px-1 bg-background"
        />
      );
    }
    return (
      <input
        value={newCustomer[col.key] || ""}
        onChange={(e) => setNewCustomer(prev => ({ ...prev, [col.key]: e.target.value }))}
        placeholder={col.key === "whatsapp" ? "必填" : ""}
        className={`w-full h-7 text-xs border rounded px-1 bg-background ${col.key === "whatsapp" ? "border-orange-300" : ""}`}
      />
    );
  };

  return (
    <div className="space-y-4">
      {/* 顶部标题栏 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">客户管理</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">
            管理客户信息，共 {data?.total ?? 0} 条记录
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={() => syncStatsMutation.mutate({})}
                disabled={syncStatsMutation.isPending}
                className="gap-1.5"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${syncStatsMutation.isPending ? "animate-spin" : ""}`} />
                同步统计
              </Button>
            </TooltipTrigger>
            <TooltipContent>从订单表自动同步累计订单数、消费金额、首次下单日期</TooltipContent>
          </Tooltip>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="gap-1.5"
          >
            <Filter className="h-3.5 w-3.5" />
            筛选
            {hasActiveFilters && <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">!</Badge>}
            {showFilters ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </Button>
          <Button
            size="sm"
            onClick={() => setShowNewRow(true)}
            className="gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            新增客户
          </Button>
        </div>
      </div>

      {/* 筛选栏 */}
      {showFilters && (
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-3 pb-3">
            <div className="grid grid-cols-5 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">搜索</label>
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="WhatsApp/姓名/邮箱..."
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                    className="pl-8 h-8 text-xs"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">客服名字</label>
                <Input
                  placeholder="全部"
                  value={filterStaffName}
                  onChange={(e) => { setFilterStaffName(e.target.value); setPage(1); }}
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">账号</label>
                <Input
                  placeholder="全部"
                  value={filterAccount}
                  onChange={(e) => { setFilterAccount(e.target.value); setPage(1); }}
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">客户属性</label>
                <Select value={filterCustomerType} onValueChange={(v) => { setFilterCustomerType(v === "all" ? "" : v); setPage(1); }}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="全部" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部</SelectItem>
                    {customerTypeOptions.map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

            </div>
            {hasActiveFilters && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs text-muted-foreground">已筛选</span>
                <Button variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={() => {
                  setSearch(""); setFilterStaffName(""); setFilterAccount("");
                  setFilterCustomerType(""); setPage(1);
                }}>
                  <X className="h-3 w-3" /> 清除全部
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 表格 */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 text-center text-muted-foreground">加载中...</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-[#D9F3FD]">
                      {columns.map((col) => (
                        <th
                          key={col.key}
                          className={`${col.width} text-center py-2 px-2 font-bold text-xs text-black border border-gray-200 whitespace-nowrap`}
                        >
                          {col.label}
                        </th>
                      ))}
                      <th className="w-[80px] text-center py-2 px-2 font-bold text-xs text-black border border-gray-200">
                        操作
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* 新建行 */}
                    {showNewRow && (
                      <tr className="bg-green-50 border-b border-gray-200">
                        {columns.map((col) => (
                          <td key={col.key} className={`${col.width} py-1 px-1.5 text-center border border-gray-200`}>
                            {renderNewCell(col)}
                          </td>
                        ))}
                        <td className="py-1 px-1 text-center border border-gray-200">
                          <div className="flex items-center justify-center gap-0.5">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-green-600 hover:text-green-700"
                              onClick={handleCreateCustomer}
                              disabled={createMutation.isPending}
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground"
                              onClick={() => setShowNewRow(false)}
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )}
                    {/* 数据行 */}
                    {data?.data && data.data.length > 0 ? (
                      data.data.map((customer, idx) => (
                        <>
                          <tr
                            key={customer.id}
                            className="border-b border-gray-200 hover:bg-muted/20 transition-colors"
                          >
                            {columns.map((col) => (
                              <td
                                key={col.key}
                                className={`${col.width} py-1 px-1.5 text-center border border-gray-100 align-middle`}
                              >
                                {renderCell(customer, col, idx)}
                              </td>
                            ))}
                            <td className="py-1 px-1 text-center border border-gray-100">
                              <div className="flex items-center justify-center gap-0.5">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className={`h-6 w-6 ${expandedCustomers.has(customer.id) ? "text-primary" : "text-muted-foreground"}`}
                                      onClick={() => toggleChart(customer.id)}
                                    >
                                      <BarChart3 className="h-3 w-3" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>查看下单趋势</TooltipContent>
                                </Tooltip>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-destructive hover:text-destructive"
                                  onClick={() => setDeleteId(customer.id)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                          {/* 折叠折线图 */}
                          {expandedCustomers.has(customer.id) && (
                            <tr key={`chart-${customer.id}`}>
                              <td colSpan={columns.length + 1} className="p-0 border border-gray-100">
                                <CustomerDetail customerId={customer.id} />
                              </td>
                            </tr>
                          )}
                        </>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={columns.length + 1} className="py-12 text-center text-muted-foreground">
                          <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
                          <p>暂无客户数据</p>
                          <p className="text-xs mt-1">点击"新增客户"开始添加</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* 分页 */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <p className="text-sm text-muted-foreground">
                    共 {data?.total ?? 0} 条记录，第 {page}/{totalPages} 页
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm">{page} / {totalPages}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* 删除确认 */}
      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除此客户吗？此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate({ id: deleteId })}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
