import { useState, useMemo, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Shield, Save, RotateCcw, Eye, EyeOff, Pencil, Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// 订单字段定义 - 与Orders.tsx中的columns保持一致
const ORDER_FIELDS = [
  // 基础信息
  { key: "date", label: "日期", group: "基础信息" },
  { key: "staffName", label: "客服名字", group: "基础信息" },
  { key: "account", label: "账号", group: "基础信息" },
  { key: "whatsapp", label: "客户WhatsApp", group: "基础信息" },
  { key: "customerType", label: "客户属性", group: "基础信息" },
  { key: "orderNumber", label: "订单编号", group: "基础信息" },
  { key: "orderImage", label: "订单图片", group: "基础信息" },
  { key: "size", label: "Size", group: "基础信息" },
  { key: "orderStatus", label: "订单状态", group: "基础信息" },
  { key: "completionStatus", label: "完成状态", group: "基础信息" },
  { key: "remarks", label: "备注", group: "基础信息" },
  // 物流信息
  { key: "domesticTracking", label: "国内单号", group: "物流信息" },
  { key: "sizeRec", label: "推荐码数", group: "物流信息" },
  { key: "contactInfo", label: "联系方式", group: "物流信息" },
  { key: "intlTracking", label: "国际跟踪单号", group: "物流信息" },
  { key: "originalOrderNo", label: "原订单号", group: "物流信息" },
  { key: "shipDate", label: "发出日期", group: "物流信息" },
  { key: "quantity", label: "件数", group: "物流信息" },
  { key: "source", label: "货源", group: "物流信息" },
  // 财务信息
  { key: "amountUsd", label: "总金额$", group: "财务信息" },
  { key: "amountCny", label: "总金额¥", group: "财务信息" },
  { key: "sellingPrice", label: "售价", group: "财务信息" },
  { key: "productCost", label: "产品成本", group: "财务信息" },
  { key: "productProfit", label: "产品毛利润", group: "财务信息" },
  { key: "productProfitRate", label: "产品毛利率", group: "财务信息" },
  { key: "shippingCharged", label: "收取运费(¥)", group: "财务信息" },
  { key: "shippingActual", label: "实际运费", group: "财务信息" },
  { key: "shippingProfit", label: "运费利润", group: "财务信息" },
  { key: "shippingProfitRate", label: "运费利润率", group: "财务信息" },
  { key: "totalProfit", label: "总利润", group: "财务信息" },
  { key: "profitRate", label: "利润率", group: "财务信息" },
  // 付款信息
  { key: "paymentScreenshot", label: "付款截图", group: "付款信息" },
  { key: "paymentAmountDisplay", label: "实际收到($)", group: "付款信息" },
  { key: "receivingAccount", label: "收款账户", group: "付款信息" },
  { key: "paymentStatus", label: "付款状态", group: "付款信息" },
  // 客户信息
  { key: "customerName", label: "客户名字", group: "客户信息" },
  { key: "customerCountry", label: "国家", group: "客户信息" },
  { key: "customerTier", label: "客户分层", group: "客户信息" },
  { key: "orderCategory", label: "订购类目", group: "客户信息" },
  { key: "customerBirthDate", label: "出生日期", group: "客户信息" },
  { key: "customerEmail", label: "客户邮箱", group: "客户信息" },
  { key: "wpEntryDate", label: "进入WP日期", group: "客户信息" },
];

const GROUPS = ["基础信息", "物流信息", "财务信息", "付款信息", "客户信息"];

type PermissionLevel = "hidden" | "readonly" | "editable";

const PERMISSION_OPTIONS: { value: PermissionLevel; label: string; icon: typeof Eye; color: string; bgColor: string }[] = [
  { value: "editable", label: "可编辑", icon: Pencil, color: "text-green-600", bgColor: "bg-green-50 border-green-200" },
  { value: "readonly", label: "只读", icon: Eye, color: "text-amber-600", bgColor: "bg-amber-50 border-amber-200" },
  { value: "hidden", label: "隐藏", icon: EyeOff, color: "text-red-600", bgColor: "bg-red-50 border-red-200" },
];

export default function FieldPermissionsPage() {
  const { user } = useAuth();

  const [selectedRole, setSelectedRole] = useState<string>("user");
  const [permissions, setPermissions] = useState<Record<string, PermissionLevel>>({});
  const [hasChanges, setHasChanges] = useState(false);

  // 获取所有权限配置
  const { data: allPermissions, refetch } = trpc.fieldPermissions.getAll.useQuery();

  // 保存权限
  const updateMutation = trpc.fieldPermissions.update.useMutation({
    onSuccess: () => {
      toast.success(`已更新 ${selectedRole === "admin" ? "管理员" : "客服"} 角色的字段权限`);
      setHasChanges(false);
      refetch();
    },
    onError: (err) => {
      toast.error(`保存失败: ${err.message}`);
    },
  });

  // 当选择角色或数据变化时，加载该角色的权限
  useEffect(() => {
    if (!allPermissions) return;
    const rolePerms = allPermissions.filter(p => p.role === selectedRole);
    const permMap: Record<string, PermissionLevel> = {};
    // 默认所有字段为editable
    ORDER_FIELDS.forEach(f => { permMap[f.key] = "editable"; });
    // 覆盖已配置的权限
    rolePerms.forEach(p => {
      permMap[p.fieldKey] = p.permission as PermissionLevel;
    });
    setPermissions(permMap);
    setHasChanges(false);
  }, [selectedRole, allPermissions]);

  // 按组分组
  const groupedFields = useMemo(() => {
    const groups: Record<string, typeof ORDER_FIELDS> = {};
    GROUPS.forEach(g => { groups[g] = []; });
    ORDER_FIELDS.forEach(f => {
      if (groups[f.group]) groups[f.group].push(f);
    });
    return groups;
  }, []);

  const handlePermissionChange = (fieldKey: string, permission: PermissionLevel) => {
    setPermissions(prev => ({ ...prev, [fieldKey]: permission }));
    setHasChanges(true);
  };

  const handleBatchChange = (group: string, permission: PermissionLevel) => {
    const fields = groupedFields[group];
    if (!fields) return;
    setPermissions(prev => {
      const next = { ...prev };
      fields.forEach(f => { next[f.key] = permission; });
      return next;
    });
    setHasChanges(true);
  };

  const handleSave = () => {
    const permList = Object.entries(permissions).map(([fieldKey, permission]) => ({
      fieldKey,
      permission,
    }));
    updateMutation.mutate({ role: selectedRole, permissions: permList });
  };

  const handleReset = () => {
    // 重新从服务器加载
    if (allPermissions) {
      const rolePerms = allPermissions.filter(p => p.role === selectedRole);
      const permMap: Record<string, PermissionLevel> = {};
      ORDER_FIELDS.forEach(f => { permMap[f.key] = "editable"; });
      rolePerms.forEach(p => {
        permMap[p.fieldKey] = p.permission as PermissionLevel;
      });
      setPermissions(permMap);
      setHasChanges(false);
    }
  };

  // 统计
  const stats = useMemo(() => {
    const counts = { editable: 0, readonly: 0, hidden: 0 };
    Object.values(permissions).forEach(p => { counts[p]++; });
    return counts;
  }, [permissions]);

  if (!user || user.role !== "admin") {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">仅管理员可访问此页面</p>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* 页面标题 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="h-6 w-6 text-emerald-600" />
            <div>
              <h1 className="text-xl font-bold">字段权限配置</h1>
              <p className="text-sm text-muted-foreground">管理不同角色对订单字段的读写权限</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {hasChanges && (
              <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
                有未保存的更改
              </Badge>
            )}
            <Button variant="outline" size="sm" onClick={handleReset} disabled={!hasChanges}>
              <RotateCcw className="h-4 w-4 mr-1" />
              重置
            </Button>
            <Button size="sm" onClick={handleSave} disabled={!hasChanges || updateMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700">
              <Save className="h-4 w-4 mr-1" />
              {updateMutation.isPending ? "保存中..." : "保存配置"}
            </Button>
          </div>
        </div>

        {/* 角色选择和统计 */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">选择角色：</span>
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">客服（普通用户）</SelectItem>
                <SelectItem value="admin">管理员</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
              可编辑 {stats.editable}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              只读 {stats.readonly}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
              隐藏 {stats.hidden}
            </span>
          </div>
        </div>

        {/* 提示信息 */}
        <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
          <Info className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <p><strong>可编辑</strong>：用户可以查看和修改该字段</p>
            <p><strong>只读</strong>：用户可以查看但不能修改该字段</p>
            <p><strong>隐藏</strong>：该字段在订单管理页面中不显示</p>
            <p className="mt-1 text-blue-600">注意：管理员角色的权限修改仅影响管理员在订单页面的默认显示，管理员始终可以通过列显隐控制来查看所有列。</p>
          </div>
        </div>

        {/* 分组字段权限配置 */}
        {GROUPS.map(group => (
          <Card key={group}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">{group}</CardTitle>
                  <CardDescription>{groupedFields[group]?.length || 0} 个字段</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground mr-1">批量设置：</span>
                  {PERMISSION_OPTIONS.map(opt => (
                    <Tooltip key={opt.value}>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className={`h-7 px-2 text-xs ${opt.color}`}
                          onClick={() => handleBatchChange(group, opt.value)}
                        >
                          <opt.icon className="h-3 w-3 mr-1" />
                          {opt.label}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>将该组所有字段设为{opt.label}</TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {groupedFields[group]?.map(field => {
                  const currentPerm = permissions[field.key] || "editable";
                  const currentOpt = PERMISSION_OPTIONS.find(o => o.value === currentPerm) || PERMISSION_OPTIONS[0];
                  return (
                    <div
                      key={field.key}
                      className={`flex items-center justify-between p-3 rounded-lg border ${currentOpt.bgColor} transition-colors`}
                    >
                      <div className="flex items-center gap-2">
                        <currentOpt.icon className={`h-4 w-4 ${currentOpt.color}`} />
                        <span className="text-sm font-medium">{field.label}</span>
                      </div>
                      <Select
                        value={currentPerm}
                        onValueChange={(v) => handlePermissionChange(field.key, v as PermissionLevel)}
                      >
                        <SelectTrigger className="w-[100px] h-7 text-xs bg-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PERMISSION_OPTIONS.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>
                              <span className={`flex items-center gap-1 ${opt.color}`}>
                                <opt.icon className="h-3 w-3" />
                                {opt.label}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </TooltipProvider>
  );
}
