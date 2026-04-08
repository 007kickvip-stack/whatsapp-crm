import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
  Plus,
  Search,
  Edit,
  Trash2,
  Phone,
  MapPin,
  Globe,
  Users,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";

type CustomerForm = {
  whatsapp: string;
  customerType: string;
  contactName: string;
  telephone: string;
  address: string;
  province: string;
  city: string;
  cityCode: string;
  country: string;
};

const emptyForm: CustomerForm = {
  whatsapp: "",
  customerType: "新零售",
  contactName: "",
  telephone: "",
  address: "",
  province: "",
  city: "",
  cityCode: "",
  country: "",
};

export default function CustomersPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<CustomerForm>(emptyForm);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.customers.list.useQuery({
    page,
    pageSize: 20,
    search: search || undefined,
  });

  const createMutation = trpc.customers.create.useMutation({
    onSuccess: () => {
      toast.success("客户创建成功");
      utils.customers.list.invalidate();
      setDialogOpen(false);
      setForm(emptyForm);
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.customers.update.useMutation({
    onSuccess: () => {
      toast.success("客户更新成功");
      utils.customers.list.invalidate();
      setDialogOpen(false);
      setEditingId(null);
      setForm(emptyForm);
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

  const handleSubmit = () => {
    if (!form.whatsapp.trim()) {
      toast.error("WhatsApp 号码不能为空");
      return;
    }
    if (editingId) {
      updateMutation.mutate({ id: editingId, ...form });
    } else {
      createMutation.mutate(form);
    }
  };

  const handleEdit = (customer: any) => {
    setEditingId(customer.id);
    setForm({
      whatsapp: customer.whatsapp || "",
      customerType: customer.customerType || "新零售",
      contactName: customer.contactName || "",
      telephone: customer.telephone || "",
      address: customer.address || "",
      province: customer.province || "",
      city: customer.city || "",
      cityCode: customer.cityCode || "",
      country: customer.country || "",
    });
    setDialogOpen(true);
  };

  const totalPages = Math.ceil((data?.total ?? 0) / 20);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">客户管理</h1>
          <p className="text-muted-foreground mt-1">
            管理您的 WhatsApp 客户信息
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingId(null);
            setForm(emptyForm);
            setDialogOpen(true);
          }}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          新增客户
        </Button>
      </div>

      {/* Search */}
      <Card className="border-0 shadow-sm">
        <CardContent className="pt-4 pb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索客户（WhatsApp、姓名、国家）..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Customer List */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 text-center text-muted-foreground">
              加载中...
            </div>
          ) : data?.data && data.data.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                        WhatsApp
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                        姓名
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                        客户属性
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                        国家
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                        城市
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                        创建时间
                      </th>
                      <th className="text-right py-3 px-4 font-medium text-muted-foreground">
                        操作
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.data.map((customer) => (
                      <tr
                        key={customer.id}
                        className="border-b last:border-0 hover:bg-muted/20 transition-colors"
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Phone className="h-3.5 w-3.5 text-primary" />
                            <span className="font-medium">
                              {customer.whatsapp}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          {customer.contactName || "-"}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium border ${
                            customer.customerType === "新零售" ? "bg-yellow-200 text-yellow-900 border-yellow-300" :
                            customer.customerType === "零售复购" ? "bg-yellow-400 text-yellow-900 border-yellow-500" :
                            customer.customerType === "定金-新零售" ? "bg-pink-400 text-white border-pink-500" :
                            customer.customerType === "定金-零售复购" ? "bg-red-600 text-white border-red-700" :
                            "bg-gray-100 text-gray-700 border-gray-200"
                          }`}>
                            {customer.customerType || "新零售"}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5">
                            <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                            {customer.country || "-"}
                          </div>
                        </td>
                        <td className="py-3 px-4">{customer.city || "-"}</td>
                        <td className="py-3 px-4 text-muted-foreground">
                          {new Date(customer.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleEdit(customer)}
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => setDeleteId(customer.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <p className="text-sm text-muted-foreground">
                    共 {data.total} 条记录
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
                    <span className="text-sm">
                      {page} / {totalPages}
                    </span>
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
          ) : (
            <div className="p-12 text-center text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>暂无客户数据</p>
              <p className="text-xs mt-1">点击"新增客户"开始添加</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "编辑客户" : "新增客户"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>WhatsApp 号码 *</Label>
                <Input
                  placeholder="+44 7312 035806"
                  value={form.whatsapp}
                  onChange={(e) =>
                    setForm({ ...form, whatsapp: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>客户属性</Label>
                <Select
                  value={form.customerType}
                  onValueChange={(v) =>
                    setForm({ ...form, customerType: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="新零售">新零售</SelectItem>
                    <SelectItem value="零售复购">零售复购</SelectItem>
                    <SelectItem value="定金-新零售">定金-新零售</SelectItem>
                    <SelectItem value="定金-零售复购">定金-零售复购</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>联系人姓名</Label>
                <Input
                  placeholder="姓名"
                  value={form.contactName}
                  onChange={(e) =>
                    setForm({ ...form, contactName: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>电话</Label>
                <Input
                  placeholder="电话号码"
                  value={form.telephone}
                  onChange={(e) =>
                    setForm({ ...form, telephone: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>地址</Label>
              <Textarea
                placeholder="详细地址"
                value={form.address}
                onChange={(e) =>
                  setForm({ ...form, address: e.target.value })
                }
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>省/州</Label>
                <Input
                  placeholder="省/州"
                  value={form.province}
                  onChange={(e) =>
                    setForm({ ...form, province: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>城市</Label>
                <Input
                  placeholder="城市"
                  value={form.city}
                  onChange={(e) =>
                    setForm({ ...form, city: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>邮编</Label>
                <Input
                  placeholder="邮编"
                  value={form.cityCode}
                  onChange={(e) =>
                    setForm({ ...form, cityCode: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>国家</Label>
                <Input
                  placeholder="国家"
                  value={form.country}
                  onChange={(e) =>
                    setForm({ ...form, country: e.target.value })
                  }
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending
                ? "保存中..."
                : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={deleteId !== null}
        onOpenChange={() => setDeleteId(null)}
      >
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
