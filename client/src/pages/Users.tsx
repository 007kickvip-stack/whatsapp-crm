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
  CalendarDays,
  DollarSign,
  Pencil,
  Ban,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";

export default function UsersPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [page, setPage] = useState(1);
  const [disableId, setDisableId] = useState<number | null>(null);
  const [restoreId, setRestoreId] = useState<number | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [showSalaryDialog, setShowSalaryDialog] = useState(false);
  const [salaryTarget, setSalaryTarget] = useState<{ id: number; name: string; baseSalary: string } | null>(null);
  const [salaryForm, setSalaryForm] = useState("");
  const [showEmploymentDialog, setShowEmploymentDialog] = useState(false);
  const [employmentTarget, setEmploymentTarget] = useState<any>(null);
  const [employmentForm, setEmploymentForm] = useState({
    employmentStatus: 'regular' as 'probation' | 'regular',
    probationBaseSalary: '',
    regularBaseSalary: '',
    regularDate: '',
  });
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
    hireDate: "",
    baseSalary: "",
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

  const { data, isLoading } = trpc.users.list.useQuery({ page, pageSize: 20, includeDisabled: true });

  const updateRoleMutation = trpc.users.updateRole.useMutation({
    onSuccess: () => {
      toast.success("角色更新成功");
      utils.users.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const disableMutation = trpc.users.delete.useMutation({
    onSuccess: () => {
      toast.success("用户已禁用，其登录会话已失效");
      utils.users.list.invalidate();
      setDisableId(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const restoreMutation = trpc.users.restore.useMutation({
    onSuccess: () => {
      toast.success("用户已恢复，可重新登录");
      utils.users.list.invalidate();
      setRestoreId(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const addUserMutation = trpc.users.create.useMutation({
    onSuccess: () => {
      toast.success("账号创建成功，用户可使用用户名和密码登录");
      utils.users.list.invalidate();
      setShowAddDialog(false);
      setAddForm({ name: "", email: "", username: "", password: "", role: "user", hireDate: "", baseSalary: "" });
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

  const updateSalaryMutation = trpc.users.updateBaseSalary.useMutation({
    onSuccess: () => {
      toast.success("底薪更新成功");
      utils.users.list.invalidate();
      setShowSalaryDialog(false);
      setSalaryTarget(null);
      setSalaryForm("");
    },
    onError: (err) => toast.error(err.message),
  });

  const updateEmploymentMutation = trpc.users.updateEmploymentInfo.useMutation({
    onSuccess: () => {
      toast.success("员工薪资信息更新成功");
      utils.users.list.invalidate();
      setShowEmploymentDialog(false);
      setEmploymentTarget(null);
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
      hireDate: addForm.hireDate || undefined,
      baseSalary: addForm.baseSalary || undefined,
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

  const openSalaryDialog = (u: any) => {
    setSalaryTarget({ id: u.id, name: u.name || "未知用户", baseSalary: u.baseSalary || "0" });
    setSalaryForm(u.baseSalary ? String(parseFloat(u.baseSalary)) : "");
    setShowSalaryDialog(true);
  };

  const openEmploymentDialog = (u: any) => {
    setEmploymentTarget(u);
    setEmploymentForm({
      employmentStatus: u.employmentStatus || 'regular',
      probationBaseSalary: u.probationBaseSalary ? String(parseFloat(u.probationBaseSalary)) : '',
      regularBaseSalary: u.regularBaseSalary ? String(parseFloat(u.regularBaseSalary)) : (u.baseSalary ? String(parseFloat(u.baseSalary)) : ''),
      regularDate: u.regularDate ? new Date(u.regularDate).toISOString().split('T')[0] : '',
    });
    setShowEmploymentDialog(true);
  };

  const handleSaveEmployment = () => {
    if (!employmentTarget) return;
    const data: any = { userId: employmentTarget.id };
    data.employmentStatus = employmentForm.employmentStatus;
    if (employmentForm.probationBaseSalary) {
      data.probationBaseSalary = parseFloat(employmentForm.probationBaseSalary).toFixed(2);
    }
    if (employmentForm.regularBaseSalary) {
      data.regularBaseSalary = parseFloat(employmentForm.regularBaseSalary).toFixed(2);
    }
    data.regularDate = employmentForm.regularDate || null;
    updateEmploymentMutation.mutate(data);
  };

  const handleSetSalary = () => {
    if (!salaryTarget) return;
    const val = salaryForm.trim();
    if (val && isNaN(parseFloat(val))) {
      toast.error("请输入有效的数字");
      return;
    }
    updateSalaryMutation.mutate({
      userId: salaryTarget.id,
      baseSalary: val ? parseFloat(val).toFixed(2) : "0",
    });
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
            setAddForm({ name: "", email: "", username: "", password: "", role: "user", hireDate: "", baseSalary: "" });
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
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">员工状态</th>
                      <th className="text-right py-3 px-4 font-medium text-muted-foreground">薪资设置</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">入职时间</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">最后登录</th>
                      <th className="text-right py-3 px-4 font-medium text-muted-foreground">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.data.map((u) => {
                      const isSelf = u.id === user?.id;
                      const isDisabled = !!(u as any).deletedAt;
                      return (
                        <tr key={u.id} className={`border-b last:border-0 hover:bg-muted/20 transition-colors ${isDisabled ? 'opacity-50 bg-muted/10' : ''}`}>
                          <td className="py-3 px-4 text-muted-foreground">{u.id}</td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{u.name || "-"}</span>
                              {isSelf && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                                  我
                                </Badge>
                              )}
                              {isDisabled && (
                                <Badge className="bg-red-100 text-red-600 hover:bg-red-100 border-red-200 text-[10px] px-1.5 py-0 h-4">
                                  已禁用
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
                            {(u as any).employmentStatus === 'probation' ? (
                              <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200">试用期</Badge>
                            ) : (
                              <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200">正式</Badge>
                            )}
                            {(u as any).regularDate && (u as any).employmentStatus === 'regular' && (
                              <span className="ml-1.5 text-xs text-muted-foreground">
                                {new Date((u as any).regularDate).toLocaleDateString()}转正
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              className="inline-flex items-center gap-1 text-sm hover:text-emerald-600 transition-colors cursor-pointer"
                              onClick={() => openEmploymentDialog(u)}
                            >
                              <span className="font-medium">
                                {(u as any).employmentStatus === 'probation'
                                  ? ((u as any).probationBaseSalary && parseFloat((u as any).probationBaseSalary) > 0
                                    ? `¥${parseFloat((u as any).probationBaseSalary).toLocaleString()}`
                                    : <span className="text-muted-foreground/50">未设置</span>)
                                  : ((u as any).regularBaseSalary && parseFloat((u as any).regularBaseSalary) > 0
                                    ? `¥${parseFloat((u as any).regularBaseSalary).toLocaleString()}`
                                    : ((u as any).baseSalary && parseFloat((u as any).baseSalary) > 0
                                      ? `¥${parseFloat((u as any).baseSalary).toLocaleString()}`
                                      : <span className="text-muted-foreground/50">未设置</span>))}
                              </span>
                              <Pencil className="h-3 w-3 text-muted-foreground/50" />
                            </button>
                          </td>
                          <td className="py-3 px-4 text-muted-foreground">
                            {(u as any).hireDate ? new Date((u as any).hireDate).toLocaleDateString() : <span className="text-muted-foreground/50">-</span>}
                          </td>
                          <td className="py-3 px-4 text-muted-foreground">
                            {new Date(u.lastSignedIn).toLocaleString()}
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
                              {isDisabled ? (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                  title="恢复用户"
                                  onClick={() => setRestoreId(u.id)}
                                >
                                  <RotateCcw className="h-3.5 w-3.5" />
                                </Button>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  disabled={isSelf}
                                  title="禁用用户"
                                  onClick={() => setDisableId(u.id)}
                                >
                                  <Ban className="h-3.5 w-3.5" />
                                </Button>
                              )}
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
            <div className="grid grid-cols-2 gap-4">
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
              <div className="space-y-2">
                <Label htmlFor="add-baseSalary">底薪(¥)</Label>
                <Input
                  id="add-baseSalary"
                  type="number"
                  placeholder="如 3000"
                  value={addForm.baseSalary}
                  onChange={(e) => setAddForm((f) => ({ ...f, baseSalary: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-hireDate">入职时间</Label>
              <Input
                id="add-hireDate"
                type="date"
                value={addForm.hireDate}
                onChange={(e) => setAddForm((f) => ({ ...f, hireDate: e.target.value }))}
              />
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

      {/* Set Salary Dialog */}
      <Dialog open={showSalaryDialog} onOpenChange={setShowSalaryDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-emerald-600" />
              设置底薪
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="rounded-lg bg-muted/50 p-3 text-sm">
              <p>为 <strong>{salaryTarget?.name}</strong> 设置底薪</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="salary-amount">底薪金额(¥)</Label>
              <Input
                id="salary-amount"
                type="number"
                placeholder="请输入底薪金额"
                value={salaryForm}
                onChange={(e) => setSalaryForm(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSalaryDialog(false)}>
              取消
            </Button>
            <Button
              onClick={handleSetSalary}
              disabled={updateSalaryMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {updateSalaryMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              保存
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

      {/* Employment Info Dialog */}
      <Dialog open={showEmploymentDialog} onOpenChange={setShowEmploymentDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-emerald-600" />
              员工薪资设置
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="rounded-lg bg-muted/50 p-3 text-sm">
              <p>为 <strong>{employmentTarget?.name || '未知用户'}</strong> 设置薪资信息</p>
            </div>
            <div className="space-y-2">
              <Label>员工状态</Label>
              <Select
                value={employmentForm.employmentStatus}
                onValueChange={(v: 'probation' | 'regular') => setEmploymentForm(f => ({ ...f, employmentStatus: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="probation">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-amber-500" />
                      试用期
                    </div>
                  </SelectItem>
                  <SelectItem value="regular">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      正式员工
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>试用期底薪(¥)</Label>
                <Input
                  type="number"
                  placeholder="如 2500"
                  value={employmentForm.probationBaseSalary}
                  onChange={(e) => setEmploymentForm(f => ({ ...f, probationBaseSalary: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>正式底薪(¥)</Label>
                <Input
                  type="number"
                  placeholder="如 3500"
                  value={employmentForm.regularBaseSalary}
                  onChange={(e) => setEmploymentForm(f => ({ ...f, regularBaseSalary: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>转正日期</Label>
              <Input
                type="date"
                value={employmentForm.regularDate}
                onChange={(e) => setEmploymentForm(f => ({ ...f, regularDate: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">设置转正日期后，状态会自动变为正式员工</p>
            </div>
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm text-blue-800">
              <p className="font-medium mb-1">工资计算规则</p>
              <ul className="space-y-1 text-xs">
                <li>• <strong>试用期</strong>：底薪 = 试用期底薪，无提成</li>
                <li>• <strong>正式员工</strong>：底薪 = 正式底薪，按规则计算提成</li>
                <li>• <strong>月中转正</strong>：底薪按天数比例计算，提成只算转正后的订单</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEmploymentDialog(false)}>
              取消
            </Button>
            <Button
              onClick={handleSaveEmployment}
              disabled={updateEmploymentMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {updateEmploymentMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disable Confirmation */}
      <AlertDialog open={disableId !== null} onOpenChange={() => setDisableId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认禁用</AlertDialogTitle>
            <AlertDialogDescription>
              禁用后该用户将无法登录系统，但所有数据（订单、客户等）将完整保留。您可以随时恢复该用户。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => disableId && disableMutation.mutate({ userId: disableId })}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              确认禁用
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Restore Confirmation */}
      <AlertDialog open={restoreId !== null} onOpenChange={() => setRestoreId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认恢复</AlertDialogTitle>
            <AlertDialogDescription>
              恢复后该用户将可以重新登录系统。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => restoreId && restoreMutation.mutate({ userId: restoreId })}
              className="bg-emerald-600 text-white hover:bg-emerald-700"
            >
              确认恢复
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
