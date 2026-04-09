import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { ArrowRightLeft, TrendingUp, TrendingDown, Minus, History, Edit } from "lucide-react";

export default function ExchangeRatePage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [editOpen, setEditOpen] = useState(false);
  const [newRate, setNewRate] = useState("");
  const [reason, setReason] = useState("");
  const [page, setPage] = useState(1);

  const { data: current, refetch: refetchCurrent } = trpc.exchangeRate.current.useQuery();
  const { data: history, refetch: refetchHistory } = trpc.exchangeRate.list.useQuery(
    { page, pageSize: 15 },
    { enabled: isAdmin }
  );

  const updateMutation = trpc.exchangeRate.update.useMutation({
    onSuccess: (data) => {
      toast.success(`汇率已更新为 ${data.rate}`);
      refetchCurrent();
      refetchHistory();
      setEditOpen(false);
      setNewRate("");
      setReason("");
    },
    onError: (err) => toast.error(err.message),
  });

  const currentRate = current?.rate ? parseFloat(String(current.rate)) : 6.4;
  const totalPages = history ? Math.ceil(history.total / 15) : 1;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ArrowRightLeft className="h-6 w-6 text-emerald-600" />
            汇率管理
          </h1>
          <p className="text-sm text-gray-500 mt-1">管理 USD → CNY 汇率，所有订单计算将使用当前汇率</p>
        </div>
      </div>

      {/* Current Rate Card */}
      <Card className="border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-emerald-700">当前汇率</p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-4xl font-bold text-emerald-800">{currentRate.toFixed(4)}</span>
                <span className="text-lg text-emerald-600">CNY / USD</span>
              </div>
              <p className="text-xs text-emerald-600 mt-2">
                1 USD = {currentRate.toFixed(4)} CNY
              </p>
            </div>
            {isAdmin && (
              <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-emerald-600 hover:bg-emerald-700">
                    <Edit className="h-4 w-4 mr-2" />
                    修改汇率
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>修改汇率</DialogTitle>
                    <DialogDescription>
                      当前汇率: {currentRate.toFixed(4)}。修改后，新创建和编辑的订单将使用新汇率计算。
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>新汇率 (CNY/USD)</Label>
                      <Input
                        type="number"
                        step="0.0001"
                        min="0.0001"
                        placeholder="例如: 7.2500"
                        value={newRate}
                        onChange={(e) => setNewRate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>变更原因 (可选)</Label>
                      <Input
                        placeholder="例如: 汇率市场波动调整"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                      />
                    </div>
                    {newRate && (
                      <div className="p-3 bg-gray-50 rounded-lg text-sm">
                        <p className="text-gray-600">
                          变更预览: <span className="font-mono">{currentRate.toFixed(4)}</span>
                          {" → "}
                          <span className="font-mono font-bold text-emerald-700">{parseFloat(newRate).toFixed(4)}</span>
                        </p>
                        <p className="text-gray-500 mt-1">
                          变化: {((parseFloat(newRate) - currentRate) / currentRate * 100).toFixed(2)}%
                        </p>
                      </div>
                    )}
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setEditOpen(false)}>取消</Button>
                    <Button
                      className="bg-emerald-600 hover:bg-emerald-700"
                      disabled={!newRate || parseFloat(newRate) <= 0 || updateMutation.isPending}
                      onClick={() => updateMutation.mutate({ rate: parseFloat(newRate), reason: reason || undefined })}
                    >
                      {updateMutation.isPending ? "保存中..." : "确认修改"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardContent>
      </Card>

      {/* History Table */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <History className="h-5 w-5 text-gray-500" />
              汇率变更历史
            </CardTitle>
            <CardDescription>所有汇率变更记录，按时间倒序排列</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-center">时间</TableHead>
                  <TableHead className="text-center">原汇率</TableHead>
                  <TableHead className="text-center">变更方向</TableHead>
                  <TableHead className="text-center">新汇率</TableHead>
                  <TableHead className="text-center">变化幅度</TableHead>
                  <TableHead className="text-center">操作人</TableHead>
                  <TableHead className="text-center">原因</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history?.data?.map((record: any) => {
                  const prev = record.previousRate ? parseFloat(String(record.previousRate)) : null;
                  const curr = parseFloat(String(record.rate));
                  const diff = prev !== null ? curr - prev : 0;
                  const pct = prev !== null && prev > 0 ? (diff / prev * 100) : 0;

                  return (
                    <TableRow key={record.id}>
                      <TableCell className="text-center text-sm">
                        {new Date(record.createdAt).toLocaleString("zh-CN")}
                      </TableCell>
                      <TableCell className="text-center font-mono">
                        {prev !== null ? prev.toFixed(4) : "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        {diff > 0 ? (
                          <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
                            <TrendingUp className="h-3 w-3 mr-1" />上升
                          </Badge>
                        ) : diff < 0 ? (
                          <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                            <TrendingDown className="h-3 w-3 mr-1" />下降
                          </Badge>
                        ) : (
                          <Badge variant="outline">
                            <Minus className="h-3 w-3 mr-1" />初始
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center font-mono font-bold">
                        {curr.toFixed(4)}
                      </TableCell>
                      <TableCell className="text-center font-mono">
                        {prev !== null ? (
                          <span className={diff > 0 ? "text-red-600" : diff < 0 ? "text-green-600" : ""}>
                            {diff > 0 ? "+" : ""}{pct.toFixed(2)}%
                          </span>
                        ) : "-"}
                      </TableCell>
                      <TableCell className="text-center text-sm">{record.changedByName}</TableCell>
                      <TableCell className="text-center text-sm text-gray-500">{record.reason || "-"}</TableCell>
                    </TableRow>
                  );
                })}
                {(!history?.data || history.data.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-gray-400 py-8">
                      暂无汇率变更记录
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-4">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                  上一页
                </Button>
                <span className="text-sm text-gray-500">第 {page} / {totalPages} 页</span>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                  下一页
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
