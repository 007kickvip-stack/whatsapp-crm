import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Database, Download, RotateCcw, Plus, Shield, Clock, HardDrive, Loader2, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function formatDate(dateStr: string | Date | null): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return d.toLocaleString("zh-CN", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

export default function DataBackupPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [isCreating, setIsCreating] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<{ key: string; createdAt: string | Date | null } | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  const utils = trpc.useUtils();
  const { data: backups, isLoading } = trpc.backup.list.useQuery(undefined, { enabled: isAdmin });

  const createBackupMutation = trpc.backup.create.useMutation({
    onSuccess: (data) => {
      toast.success(`备份创建成功！共 ${data.tableCount} 张表，${data.totalRows} 行数据（${formatBytes(data.sizeBytes)}）`);
      utils.backup.list.invalidate();
      setIsCreating(false);
    },
    onError: (err) => {
      toast.error("备份失败: " + err.message);
      setIsCreating(false);
    },
  });

  const restoreMutation = trpc.backup.restore.useMutation({
    onSuccess: (data) => {
      toast.success(`数据恢复成功！共恢复 ${data.restoredTables} 张表，${data.totalRows} 行数据`);
      setRestoreTarget(null);
      setIsRestoring(false);
    },
    onError: (err) => {
      toast.error("恢复失败: " + err.message);
      setIsRestoring(false);
    },
  });

  const handleCreateBackup = () => {
    setIsCreating(true);
    createBackupMutation.mutate();
  };

  const handleRestore = async (key: string) => {
    setIsRestoring(true);
    try {
      // 先获取下载URL
      const { url } = await utils.backup.download.fetch({ key });
      restoreMutation.mutate({ backupUrl: url });
    } catch (err: any) {
      toast.error("获取备份文件失败: " + err.message);
      setIsRestoring(false);
    }
  };

  const handleDownload = async (key: string) => {
    try {
      const { url } = await utils.backup.download.fetch({ key });
      window.open(url, "_blank");
    } catch (err: any) {
      toast.error("获取下载链接失败: " + err.message);
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center text-muted-foreground">
          <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>仅管理员可访问数据备份功能</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">数据备份</h1>
          <p className="text-muted-foreground text-sm mt-1">备份和恢复系统数据，防止数据丢失</p>
        </div>
        <Button
          onClick={handleCreateBackup}
          disabled={isCreating}
          className="gap-2"
        >
          {isCreating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
          {isCreating ? "正在备份..." : "立即备份"}
        </Button>
      </div>

      {/* 说明卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100">
                <Database className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <div className="text-sm font-medium">全量备份</div>
                <div className="text-xs text-muted-foreground">备份所有业务表数据</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <HardDrive className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <div className="text-sm font-medium">云端存储</div>
                <div className="text-xs text-muted-foreground">备份文件安全存储在云端</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100">
                <RotateCcw className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <div className="text-sm font-medium">一键恢复</div>
                <div className="text-xs text-muted-foreground">选择备份版本快速恢复</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 备份历史列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Clock className="w-4 h-4" />
            备份历史
          </CardTitle>
          <CardDescription>最近50次备份记录</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">#</TableHead>
                <TableHead>备份时间</TableHead>
                <TableHead>操作人</TableHead>
                <TableHead>表数</TableHead>
                <TableHead>总行数</TableHead>
                <TableHead>备份文件</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                    加载中...
                  </TableCell>
                </TableRow>
              ) : !backups || backups.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    <Database className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    暂无备份记录，点击"立即备份"创建第一个备份
                  </TableCell>
                </TableRow>
              ) : (
                backups.map((backup, idx) => (
                  <TableRow key={backup.id}>
                    <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                    <TableCell className="font-medium">{formatDate(backup.createdAt)}</TableCell>
                    <TableCell>{backup.userName}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{backup.tableCount} 张表</Badge>
                    </TableCell>
                    <TableCell>{backup.totalRows.toLocaleString()} 行</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                      {backup.key}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 text-xs"
                          onClick={() => handleDownload(backup.key)}
                          disabled={!backup.key}
                        >
                          <Download className="w-3 h-3" />
                          下载
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 text-xs text-amber-600 hover:text-amber-700"
                          onClick={() => setRestoreTarget({ key: backup.key, createdAt: backup.createdAt })}
                          disabled={!backup.key}
                        >
                          <RotateCcw className="w-3 h-3" />
                          恢复
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 注意事项 */}
      <Card className="border-amber-200 bg-amber-50/50">
        <CardContent className="pt-4 pb-4">
          <div className="flex gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm">
              <div className="font-medium text-amber-800 mb-1">注意事项</div>
              <ul className="text-amber-700 space-y-1 list-disc list-inside">
                <li>恢复操作会<strong>覆盖当前所有数据</strong>，请谨慎操作</li>
                <li>建议在恢复前先创建一个新备份，以便需要时可以回退</li>
                <li>备份包含所有业务表（用户、客户、订单、财务等）</li>
                <li>建议定期手动备份，特别是在进行大量数据操作之前</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 恢复确认弹窗 */}
      <AlertDialog open={!!restoreTarget} onOpenChange={(open) => { if (!open) setRestoreTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="w-5 h-5" />
              确认恢复数据？
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>您即将从以下备份恢复数据：</p>
              <p className="font-medium text-foreground">
                备份时间：{restoreTarget ? formatDate(restoreTarget.createdAt) : ""}
              </p>
              <p className="text-red-600 font-medium">
                警告：恢复操作将覆盖当前所有数据，此操作不可撤销！
              </p>
              <p>建议在恢复前先创建一个新备份。</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRestoring}>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-amber-600 hover:bg-amber-700"
              onClick={() => restoreTarget && handleRestore(restoreTarget.key)}
              disabled={isRestoring}
            >
              {isRestoring ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  恢复中...
                </>
              ) : (
                "确认恢复"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
