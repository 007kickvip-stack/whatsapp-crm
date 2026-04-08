import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ClipboardList,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  X,
  Eye,
  Plus,
  Edit,
  Trash2,
  Download,
  LogIn,
  Key,
} from "lucide-react";

const ACTION_LABELS: Record<string, { label: string; color: string; icon: typeof Plus }> = {
  create: { label: "创建", color: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: Plus },
  update: { label: "更新", color: "bg-blue-50 text-blue-700 border-blue-200", icon: Edit },
  delete: { label: "删除", color: "bg-red-50 text-red-700 border-red-200", icon: Trash2 },
  export: { label: "导出", color: "bg-purple-50 text-purple-700 border-purple-200", icon: Download },
  login: { label: "登录", color: "bg-amber-50 text-amber-700 border-amber-200", icon: LogIn },
  setPassword: { label: "设置密码", color: "bg-orange-50 text-orange-700 border-orange-200", icon: Key },
};

const TARGET_LABELS: Record<string, string> = {
  order: "订单",
  customer: "客户",
  user: "用户",
  orderItem: "订单子项",
};

export default function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const [filterAction, setFilterAction] = useState<string>("");
  const [filterTarget, setFilterTarget] = useState<string>("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [detailLog, setDetailLog] = useState<any>(null);

  const queryInput = useMemo(
    () => ({
      page,
      pageSize: 20,
      action: filterAction || undefined,
      targetType: filterTarget || undefined,
      dateFrom: filterDateFrom || undefined,
      dateTo: filterDateTo || undefined,
    }),
    [page, filterAction, filterTarget, filterDateFrom, filterDateTo]
  );

  const { data, isLoading } = trpc.auditLogs.list.useQuery(queryInput);

  const clearFilters = () => {
    setFilterAction("");
    setFilterTarget("");
    setFilterDateFrom("");
    setFilterDateTo("");
    setPage(1);
  };

  const hasActiveFilters = filterAction || filterTarget || filterDateFrom || filterDateTo;
  const totalPages = Math.ceil((data?.total ?? 0) / 20);

  const formatDetails = (details: string | null) => {
    if (!details) return null;
    try {
      return JSON.parse(details);
    } catch {
      return details;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">操作日志</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            查看系统所有关键操作的审计记录
          </p>
        </div>
        <Badge variant="outline" className="text-sm px-3 py-1">
          共 {data?.total ?? 0} 条记录
        </Badge>
      </div>

      {/* Filters */}
      <Card className="border-0 shadow-sm">
        <CardContent className="pt-4 pb-4 space-y-3">
          <div className="flex gap-2">
            <Button
              variant={showFilters ? "default" : "outline"}
              onClick={() => setShowFilters(!showFilters)}
              className="gap-2"
            >
              <Filter className="h-4 w-4" />
              筛选
              {hasActiveFilters && (
                <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-[10px]">
                  !
                </Badge>
              )}
            </Button>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 text-muted-foreground">
                <X className="h-3 w-3" /> 清除筛选
              </Button>
            )}
          </div>

          {showFilters && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">操作类型</label>
                <Select value={filterAction} onValueChange={(v) => { setFilterAction(v === "all" ? "" : v); setPage(1); }}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="全部操作" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部操作</SelectItem>
                    <SelectItem value="create">创建</SelectItem>
                    <SelectItem value="update">更新</SelectItem>
                    <SelectItem value="delete">删除</SelectItem>
                    <SelectItem value="export">导出</SelectItem>
                    <SelectItem value="login">登录</SelectItem>
                    <SelectItem value="setPassword">设置密码</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">目标类型</label>
                <Select value={filterTarget} onValueChange={(v) => { setFilterTarget(v === "all" ? "" : v); setPage(1); }}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="全部类型" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部类型</SelectItem>
                    <SelectItem value="order">订单</SelectItem>
                    <SelectItem value="customer">客户</SelectItem>
                    <SelectItem value="user">用户</SelectItem>
                    <SelectItem value="orderItem">订单子项</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">开始日期</label>
                <Input
                  type="date"
                  value={filterDateFrom}
                  onChange={(e) => { setFilterDateFrom(e.target.value); setPage(1); }}
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">结束日期</label>
                <Input
                  type="date"
                  value={filterDateTo}
                  onChange={(e) => { setFilterDateTo(e.target.value); setPage(1); }}
                  className="h-8 text-xs"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[160px]">时间</TableHead>
                <TableHead className="w-[100px]">操作人</TableHead>
                <TableHead className="w-[80px]">角色</TableHead>
                <TableHead className="w-[80px]">操作</TableHead>
                <TableHead className="w-[80px]">目标类型</TableHead>
                <TableHead className="w-[60px]">目标ID</TableHead>
                <TableHead>描述</TableHead>
                <TableHead className="w-[60px]">详情</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    加载中...
                  </TableCell>
                </TableRow>
              ) : !data?.data?.length ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12">
                    <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                    <p className="text-muted-foreground">暂无操作日志</p>
                  </TableCell>
                </TableRow>
              ) : (
                data.data.map((log: any) => {
                  const actionInfo = ACTION_LABELS[log.action] || { label: log.action, color: "bg-gray-50 text-gray-700 border-gray-200", icon: ClipboardList };
                  const ActionIcon = actionInfo.icon;
                  return (
                    <TableRow key={log.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="text-xs text-muted-foreground font-mono">
                        {new Date(log.createdAt).toLocaleString("zh-CN", {
                          year: "numeric",
                          month: "2-digit",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </TableCell>
                      <TableCell className="font-medium text-sm">{log.userName || "未知"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] ${log.userRole === "admin" ? "border-emerald-300 text-emerald-700" : "border-blue-300 text-blue-700"}`}>
                          {log.userRole === "admin" ? "管理员" : "客服"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] gap-1 ${actionInfo.color}`}>
                          <ActionIcon className="h-3 w-3" />
                          {actionInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {TARGET_LABELS[log.targetType] || log.targetType}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">
                        {log.targetId || "-"}
                      </TableCell>
                      <TableCell className="text-xs max-w-[200px] truncate">
                        {log.targetName || "-"}
                      </TableCell>
                      <TableCell>
                        {log.details && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setDetailLog(log)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            第 {page} / {totalPages} 页，共 {data?.total ?? 0} 条
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
              上一页
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              下一页
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!detailLog} onOpenChange={() => setDetailLog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-emerald-600" />
              操作详情
            </DialogTitle>
          </DialogHeader>
          {detailLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">操作人：</span>
                  <span className="font-medium ml-1">{detailLog.userName}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">角色：</span>
                  <span className="font-medium ml-1">{detailLog.userRole === "admin" ? "管理员" : "客服"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">操作：</span>
                  <span className="font-medium ml-1">{ACTION_LABELS[detailLog.action]?.label || detailLog.action}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">目标：</span>
                  <span className="font-medium ml-1">{TARGET_LABELS[detailLog.targetType] || detailLog.targetType} #{detailLog.targetId || "-"}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground">时间：</span>
                  <span className="font-medium ml-1">{new Date(detailLog.createdAt).toLocaleString("zh-CN")}</span>
                </div>
                {detailLog.targetName && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">描述：</span>
                    <span className="font-medium ml-1">{detailLog.targetName}</span>
                  </div>
                )}
              </div>
              {detailLog.details && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">变更详情：</p>
                  <pre className="bg-muted/50 rounded-lg p-3 text-xs overflow-auto max-h-[300px] whitespace-pre-wrap break-all">
                    {JSON.stringify(formatDetails(detailLog.details), null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
