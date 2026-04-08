import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
  UserPlus,
  Loader2,
  KeyRound,
  Eye,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";

export default function UsersPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [page, setPage] = useState(1);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [passwordTarget, setPasswordTarget] = useState<{ id: number; name: string; username?: string | null } | null>(null);
  const [passwordForm, setPasswordForm] = useState({ username: "", password: "", confirmPassword: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [addForm, setAddForm] = useState({
    name: "",
    email: "",
    username: "",
    password: "",
    role: "user" as "user" | "admin",
  });
  const [showAddPassword, setShowAddPassword] = useState(false);

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

  const addUserMutation = trpc.users.create.useMutation({
    onSuccess: () => {
      toast.success("账号创建成功，用户可使用用户名和密码登录");
      utils.users.list.invalidate();
      setShowAddDialog(false);
      setAddForm({ name: "", email: "", username: "", password: "", role: "user" });
    },
    onError: (err) => toast.error(err.message),
  });

  const setPasswordMutation = trpc.users.setPassword.useMutation({
    onSuccess: () => {
      toast.success("登录密码设置成功");
      utils.users.list.invalidate();
      setShowPasswordDialog(false);
      setPasswordForm({ username: "", password: "", confirmPassword: "" });
      setPasswordTarget(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const totalPages = Math.ceil((data?.total ?? 0) / 20);

  const handleAddSubmit = () => {
    if (!addForm.name.trim()) {
      toast.error("请输入用户姓名");
      return;
    }
    if (!addForm.username.trim()) {
      toast.error("请输入登录用户名");
      return;
    }
    if (addForm.username.trim().length < 2) {
      toast.error("用户名至少需要2个字符");
      return;
    }
    if (!addForm.password.trim()) {
      toast.error("请输入登录密码");
      return;
    }
    if (addForm.password.length < 4) {
      toast.error("密码至少需要4个字符");
      return;
    }
    addUserMutation.mutate({
      name: addForm.name.trim(),
      email: addForm.email.trim() || undefined,
      username: addForm.username.trim(),
      password: addForm.password,
      role: addForm.role,
    });
  };

  const handleSetPassword = () => {
    if (!passwordForm.username.trim()) {
      toast.error("请输入登录用户名");
      return;
    }
    if (passwordForm.username.trim().length < 2) {
      toast.error("用户名至少需要2个字符");
      return;
    }
    if (!passwordForm.password.trim()) {
      toast.error("请输入登录密码");
      return;
    }
    if (passwordForm.password.length < 4) {
      toast.error("密码至少需要4个字符");
      return;
    }
    if (passwordForm.password !== passwordForm.confirmPassword) {
      toast.error("两次输入的密码不一致");
      return;
    }
    if (!passwordTarget) return;
    setPasswordMutation.mutate({
      userId: passwordTarget.id,
      username: passwordForm.username.trim(),
      password: passwordForm.password,
    });
  };

  const openPasswordDialog = (u: { id: number; name: string | null; username?: string | null }) => {
    setPasswordTarget({ id: u.id, name: u.name || "未知用户", username: u.username });
    setPasswordForm({
      username: u.username || "",
      password: "",
      confirmPassword: "",
    });
    setShowPassword(false);
    setShowConfirmPassword(false);
    setShowPasswordDialog(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">用户管理</h1>
          <p className="text-muted-foreground mt-1">
            管理系统用户和角色权限
          </p>
        </div>
        <Button
          onClick={() => {
            setAddForm({ name: "", email: "", username: "", password: "", role: "user" });
            setShowAddPassword(false);
            setShowAddDialog(true);
          }}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          <UserPlus className="h-4 w-4 mr-2" />
          添加客服
        </Button>
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
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">用户名</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">邮箱</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">角色</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">登录方式</th>
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
                          <td className="py-3 px-4">
                            {(u as any).username ? (
                              <Badge variant="secondary" className="font-mono text-xs">
                                {(u as any).username}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
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
                          <td className="py-3 px-4">
                            <Badge variant="outline" className="text-xs">
                              {u.loginMethod === "password" ? "密码登录" : u.loginMethod === "manual" ? "手动创建" : "OAuth"}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-muted-foreground">
                            {new Date(u.lastSignedIn).toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-muted-foreground">
                            {new Date(u.createdAt).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                title="设置登录密码"
                                onClick={() => openPasswordDialog(u)}
                              >
                                <KeyRound className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                disabled={isSelf}
                                onClick={() => setDeleteId(u.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
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

      {/* Add User Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-emerald-600" />
              添加客服账号
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="add-name">姓名 <span className="text-destructive">*</span></Label>
              <Input
                id="add-name"
                placeholder="请输入客服姓名"
                value={addForm.name}
                onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-email">邮箱</Label>
              <Input
                id="add-email"
                type="email"
                placeholder="请输入邮箱地址（可选）"
                value={addForm.email}
                onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-username">登录用户名 <span className="text-destructive">*</span></Label>
              <Input
                id="add-username"
                placeholder="请输入登录用户名（至少2个字符）"
                value={addForm.username}
                onChange={(e) => setAddForm((f) => ({ ...f, username: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-password">登录密码 <span className="text-destructive">*</span></Label>
              <div className="relative">
                <Input
                  id="add-password"
                  type={showAddPassword ? "text" : "password"}
                  placeholder="请输入登录密码（至少4个字符）"
                  value={addForm.password}
                  onChange={(e) => setAddForm((f) => ({ ...f, password: e.target.value }))}
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowAddPassword(!showAddPassword)}
                >
                  {showAddPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>角色</Label>
              <Select
                value={addForm.role}
                onValueChange={(v: "user" | "admin") => setAddForm((f) => ({ ...f, role: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">
                    <div className="flex items-center gap-1.5">
                      <UserCog className="h-3.5 w-3.5" />
                      客服
                    </div>
                  </SelectItem>
                  <SelectItem value="admin">
                    <div className="flex items-center gap-1.5">
                      <Shield className="h-3.5 w-3.5" />
                      管理员
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-800">
              <p className="font-medium mb-1">提示</p>
              <p>创建后，客服可使用<strong>用户名和密码</strong>登录系统。请将登录信息告知客服。</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              取消
            </Button>
            <Button
              onClick={handleAddSubmit}
              disabled={addUserMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {addUserMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              创建账号
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Set Password Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-amber-600" />
              设置登录密码
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="rounded-lg bg-muted/50 p-3 text-sm">
              <p>为用户 <strong>{passwordTarget?.name}</strong> 设置登录密码</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pw-username">登录用户名 <span className="text-destructive">*</span></Label>
              <Input
                id="pw-username"
                placeholder="请输入登录用户名"
                value={passwordForm.username}
                onChange={(e) => setPasswordForm((f) => ({ ...f, username: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pw-password">新密码 <span className="text-destructive">*</span></Label>
              <div className="relative">
                <Input
                  id="pw-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="请输入新密码（至少4个字符）"
                  value={passwordForm.password}
                  onChange={(e) => setPasswordForm((f) => ({ ...f, password: e.target.value }))}
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pw-confirm">确认密码 <span className="text-destructive">*</span></Label>
              <div className="relative">
                <Input
                  id="pw-confirm"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="请再次输入密码"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm((f) => ({ ...f, confirmPassword: e.target.value }))}
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
              <p className="font-medium mb-1">提示</p>
              <p>设置后，该用户可在登录页面使用<strong>用户名和密码</strong>登录系统。如果该用户已有密码，将被新密码覆盖。</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPasswordDialog(false)}>
              取消
            </Button>
            <Button
              onClick={handleSetPassword}
              disabled={setPasswordMutation.isPending}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {setPasswordMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              保存密码
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
