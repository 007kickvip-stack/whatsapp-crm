import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  Trash2,
  Shield,
  UserCog,
  ChevronLeft,
  ChevronRight,
  Users,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";

export default function UsersPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [page, setPage] = useState(1);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const utils = trpc.useUtils();

  // Redirect non-admin users
  if (user?.role !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <ShieldAlert className="h-10 w-10 mb-3 opacity-40" />
        <p>您没有权限访问此页面</p>
        <Button variant="link" onClick={() => setLocation("/")} className="mt-2">
          返回首页
        </Button>
      </div>
    );
  }

  const { data, isLoading } = trpc.users.list.useQuery({ page, pageSize: 20 });

  const updateRoleMutation = trpc.users.updateRole.useMutation({
    onSuccess: () => {
      toast.success("角色更新成功");
      utils.users.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.users.delete.useMutation({
    onSuccess: () => {
      toast.success("用户已删除");
      utils.users.list.invalidate();
      setDeleteId(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const totalPages = Math.ceil((data?.total ?? 0) / 20);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">用户管理</h1>
        <p className="text-muted-foreground mt-1">
          管理系统用户和角色权限
        </p>
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 text-center text-muted-foreground">加载中...</div>
          ) : data?.data && data.data.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">ID</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">姓名</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">邮箱</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">角色</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">最后登录</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">注册时间</th>
                      <th className="text-right py-3 px-4 font-medium text-muted-foreground">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.data.map((u) => {
                      const isSelf = u.id === user?.id;
                      return (
                        <tr key={u.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                          <td className="py-3 px-4 text-muted-foreground">{u.id}</td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{u.name || "-"}</span>
                              {isSelf && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                                  我
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-muted-foreground">{u.email || "-"}</td>
                          <td className="py-3 px-4">
                            <Select
                              value={u.role}
                              onValueChange={(v: "user" | "admin") => {
                                if (isSelf) {
                                  toast.error("不能修改自己的角色");
                                  return;
                                }
                                updateRoleMutation.mutate({ userId: u.id, role: v });
                              }}
                              disabled={isSelf}
                            >
                              <SelectTrigger className="h-8 w-28">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="admin">
                                  <div className="flex items-center gap-1.5">
                                    <Shield className="h-3 w-3" />
                                    管理员
                                  </div>
                                </SelectItem>
                                <SelectItem value="user">
                                  <div className="flex items-center gap-1.5">
                                    <UserCog className="h-3 w-3" />
                                    客服
                                  </div>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="py-3 px-4 text-muted-foreground">
                            {new Date(u.lastSignedIn).toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-muted-foreground">
                            {new Date(u.createdAt).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              disabled={isSelf}
                              onClick={() => setDeleteId(u.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <p className="text-sm text-muted-foreground">共 {data.total} 条记录</p>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm">{page} / {totalPages}</span>
                    <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="p-12 text-center text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>暂无用户数据</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除此用户吗？此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate({ userId: deleteId })}
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
