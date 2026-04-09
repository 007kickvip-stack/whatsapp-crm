import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  CalendarDays, Plus, Trash2, RefreshCw, FileText,
  MessageSquare, Users, ShoppingCart, Package, DollarSign, TrendingUp
} from "lucide-react";

function formatDate(d: any): string {
  if (!d) return "";
  const date = new Date(d);
  return date.toISOString().split("T")[0];
}

function formatMoney(v: any): string {
  const n = parseFloat(v) || 0;
  return n.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatPercent(v: any): string {
  const n = parseFloat(v) || 0;
  return (n * 100).toFixed(1) + "%";
}

// ============================================================
// Inline editable cell component (same pattern as Orders page)
// ============================================================
function EditableCell({
  value,
  onSave,
  type = "text",
  className = "",
  placeholder = "",
  disabled = false,
}: {
  value: string;
  onSave: (val: string) => void;
  type?: "text" | "number";
  className?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const commit = () => {
    setEditing(false);
    if (draft !== value) {
      onSave(draft);
    }
  };

  const cancel = () => {
    setEditing(false);
    setDraft(value);
  };

  if (disabled) {
    return (
      <div className={`min-h-[24px] px-1 py-0.5 text-center ${className}`}>
        {value || <span className="text-gray-300">-</span>}
      </div>
    );
  }

  if (!editing) {
    return (
      <div
        onClick={() => { setDraft(value); setEditing(true); }}
        className={`cursor-text min-h-[24px] px-1 py-0.5 rounded hover:bg-emerald-50 transition-colors text-center ${className}`}
        title="点击编辑"
      >
        {value || <span className="text-gray-300 italic text-[10px]">{placeholder || "点击编辑"}</span>}
      </div>
    );
  }

  return (
    <input
      ref={inputRef}
      type={type === "number" ? "number" : "text"}
      step={type === "number" ? "0.01" : undefined}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") cancel();
      }}
      className="w-full border border-emerald-400 rounded px-1 py-0.5 text-[11px] text-center focus:outline-none focus:ring-1 focus:ring-emerald-400 bg-white"
      placeholder={placeholder}
    />
  );
}

// ============================================================
// Account select cell - dropdown for whats account
// ============================================================
function AccountSelectCell({
  value,
  accounts,
  onSave,
  disabled = false,
}: {
  value: string;
  accounts: string[];
  onSave: (val: string) => void;
  disabled?: boolean;
}) {
  if (disabled) {
    return (
      <div className="min-h-[24px] px-1 py-0.5 text-center text-[11px]">
        {value || <span className="text-gray-300">-</span>}
      </div>
    );
  }

  return (
    <select
      value={value || ""}
      onChange={(e) => {
        if (e.target.value !== value) {
          onSave(e.target.value);
        }
      }}
      className="w-full border border-gray-200 rounded px-0.5 py-0.5 text-[11px] text-center focus:outline-none focus:ring-1 focus:ring-emerald-400 bg-white cursor-pointer hover:bg-emerald-50 transition-colors"
      title="选择whats账号"
    >
      <option value="">选择账号</option>
      {accounts.map((acc) => (
        <option key={acc} value={acc}>{acc}</option>
      ))}
    </select>
  );
}

export default function DailyData() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const utils = trpc.useUtils();

  const today = new Date().toISOString().split("T")[0];
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(today);
  const [staffFilter, setStaffFilter] = useState("__all__");
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportDate, setReportDate] = useState(today);

  // New record creation state
  const [showNewRow, setShowNewRow] = useState(false);
  const [newRowDate, setNewRowDate] = useState(today);
  const [newRowStaffId, setNewRowStaffId] = useState<number>(0);
  const [newRowStaffName, setNewRowStaffName] = useState("");
  const [newRowAccount, setNewRowAccount] = useState("");

  const queryParams = useMemo(() => ({
    startDate,
    endDate,
    staffName: staffFilter === "__all__" ? undefined : staffFilter,
  }), [startDate, endDate, staffFilter]);

  const { data: dailyList = [], isLoading } = trpc.dailyData.list.useQuery(queryParams);
  const staffListQuery = isAdmin ? trpc.dailyData.staffList.useQuery() : { data: [] };
  const staffList = staffListQuery.data || [];

  // 获取订单表中所有不重复的 account 列表
  const { data: accountList = [] } = trpc.dailyData.accountList.useQuery();

  const reportQuery = trpc.dailyData.report.useQuery(
    { reportDate, staffName: staffFilter === "__all__" ? undefined : staffFilter },
    { enabled: reportDialogOpen }
  );

  const createMutation = trpc.dailyData.create.useMutation({
    onSuccess: () => {
      toast.success("创建成功");
      setShowNewRow(false);
      setNewRowAccount("");
      utils.dailyData.list.invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateMutation = trpc.dailyData.update.useMutation({
    onSuccess: () => {
      toast.success("已保存");
      utils.dailyData.list.invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = trpc.dailyData.delete.useMutation({
    onSuccess: () => {
      toast.success("删除成功");
      utils.dailyData.list.invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const syncMutation = trpc.dailyData.syncOrderData.useMutation({
    onSuccess: () => {
      toast.success("同步成功");
      utils.dailyData.list.invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  // 保存字段后自动同步：当修改 whatsAccount 时，保存后自动触发同步
  const saveFieldAndSync = useCallback(
    (id: number, field: string, value: string) => {
      const numFields = [
        "messageCount", "newCustomerCount", "newIntentCount", "returnVisitCount",
        "newOrderCount", "oldOrderCount", "onlineOrderCount", "itemCount",
        "telegramPraiseCount", "referralCount"
      ];
      const decimalFields = ["onlineRevenue"];

      let parsed: any = value;
      if (numFields.includes(field)) {
        parsed = parseInt(value) || 0;
      } else if (decimalFields.includes(field)) {
        parsed = value;
      }

      if (field === "whatsAccount") {
        // 保存 whatsAccount 后自动触发同步
        updateMutation.mutate({ id, [field]: parsed } as any, {
          onSuccess: () => {
            toast.success("已保存");
            utils.dailyData.list.invalidate();
            // 自动同步订单数据
            if (value) {
              syncMutation.mutate({ id });
            }
          },
        });
      } else {
        updateMutation.mutate({ id, [field]: parsed } as any);
      }
    },
    []
  );

  // Create new record (with optional whatsAccount)
  function handleCreateRow() {
    createMutation.mutate({
      reportDate: newRowDate,
      ...(isAdmin && newRowStaffId ? { staffId: newRowStaffId, staffName: newRowStaffName } : {}),
      ...(newRowAccount ? { whatsAccount: newRowAccount } : {}),
    });
  }

  // 汇总当前列表数据
  const totals = useMemo(() => {
    return dailyList.reduce((acc: any, row: any) => {
      acc.messageCount += row.messageCount || 0;
      acc.newCustomerCount += row.newCustomerCount || 0;
      acc.newIntentCount += row.newIntentCount || 0;
      acc.returnVisitCount += row.returnVisitCount || 0;
      acc.newOrderCount += row.newOrderCount || 0;
      acc.oldOrderCount += row.oldOrderCount || 0;
      acc.onlineOrderCount += row.onlineOrderCount || 0;
      acc.itemCount += row.itemCount || 0;
      acc.totalRevenue += parseFloat(row.totalRevenue) || 0;
      acc.onlineRevenue += parseFloat(row.onlineRevenue) || 0;
      acc.productSellingPrice += parseFloat(row.productSellingPrice) || 0;
      acc.shippingCharged += parseFloat(row.shippingCharged) || 0;
      acc.estimatedProfit += parseFloat(row.estimatedProfit) || 0;
      acc.telegramPraiseCount += row.telegramPraiseCount || 0;
      acc.referralCount += row.referralCount || 0;
      return acc;
    }, {
      messageCount: 0, newCustomerCount: 0, newIntentCount: 0, returnVisitCount: 0,
      newOrderCount: 0, oldOrderCount: 0, onlineOrderCount: 0, itemCount: 0,
      totalRevenue: 0, onlineRevenue: 0, productSellingPrice: 0, shippingCharged: 0,
      estimatedProfit: 0, telegramPraiseCount: 0, referralCount: 0,
    });
  }, [dailyList]);

  const thClass = "py-1.5 px-1 text-center font-medium whitespace-nowrap text-[11px] border-r border-gray-100";
  const tdClass = "py-1 px-1 text-center border-r border-gray-100 whitespace-nowrap text-[11px]";

  return (
    <div className="space-y-4">
      {/* 标题和操作栏 */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">每日数据</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {isAdmin ? "查看和管理所有客服的每日工作数据" : "记录和查看您的每日工作数据"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setReportDialogOpen(true)}>
            <FileText className="w-4 h-4 mr-1" />日报表
          </Button>
          <Button size="sm" onClick={() => setShowNewRow(true)}>
            <Plus className="w-4 h-4 mr-1" />新增记录
          </Button>
        </div>
      </div>

      {/* 汇总卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs"><MessageSquare className="w-3.5 h-3.5" />消息数</div>
            <p className="text-lg font-bold mt-1">{totals.messageCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs"><Users className="w-3.5 h-3.5" />新客人数</div>
            <p className="text-lg font-bold mt-1">{totals.newCustomerCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs"><ShoppingCart className="w-3.5 h-3.5" />新客单数</div>
            <p className="text-lg font-bold mt-1">{totals.newOrderCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs"><Package className="w-3.5 h-3.5" />件数</div>
            <p className="text-lg font-bold mt-1">{totals.itemCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs"><DollarSign className="w-3.5 h-3.5" />总营业额</div>
            <p className="text-lg font-bold mt-1 text-emerald-600">¥{formatMoney(totals.totalRevenue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs"><TrendingUp className="w-3.5 h-3.5" />预估毛利润</div>
            <p className="text-lg font-bold mt-1 text-blue-600">¥{formatMoney(totals.estimatedProfit)}</p>
          </CardContent>
        </Card>
      </div>

      {/* 筛选栏 */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <Label className="text-xs mb-1 block">开始日期</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-36 h-8 text-xs" />
            </div>
            <div>
              <Label className="text-xs mb-1 block">结束日期</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-36 h-8 text-xs" />
            </div>
            {isAdmin && (
              <div>
                <Label className="text-xs mb-1 block">客服</Label>
                <Select value={staffFilter} onValueChange={setStaffFilter}>
                  <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">全部客服</SelectItem>
                    {staffList.map((s: any, idx: number) => (
                      <SelectItem key={s.staffId || `staff-${idx}`} value={s.staffName}>{s.staffName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 内联编辑数据表格 */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] border-collapse">
              <thead>
                <tr className="border-b bg-rose-50 text-gray-700">
                  <th className={`${thClass} sticky left-0 bg-rose-50 z-10 min-w-[80px]`}>日期</th>
                  <th className={`${thClass} min-w-[60px]`}>名字</th>
                  <th className={`${thClass} min-w-[120px]`}>whats账号</th>
                  <th className={`${thClass} min-w-[55px]`}>消息数</th>
                  <th className={`${thClass} min-w-[60px]`}>新客人数</th>
                  <th className={`${thClass} min-w-[60px]`}>新增意向</th>
                  <th className={`${thClass} min-w-[60px]`}>回访人数</th>
                  <th className={`${thClass} min-w-[60px]`}>新客单数</th>
                  <th className={`${thClass} min-w-[60px]`}>老客单数</th>
                  <th className={`${thClass} min-w-[60px]`}>线上订单</th>
                  <th className={`${thClass} min-w-[50px]`}>件数</th>
                  <th className={`${thClass} min-w-[80px]`}>总营业额</th>
                  <th className={`${thClass} min-w-[80px]`}>线上营业额</th>
                  <th className={`${thClass} min-w-[80px]`}>产品售价</th>
                  <th className={`${thClass} min-w-[80px]`}>收取运费</th>
                  <th className={`${thClass} min-w-[80px]`}>预估毛利润</th>
                  <th className={`${thClass} min-w-[70px]`}>预估利润率</th>
                  <th className={`${thClass} min-w-[55px]`}>电报好评</th>
                  <th className={`${thClass} min-w-[60px]`}>周转介绍</th>
                  <th className="py-1.5 px-1 text-center font-medium whitespace-nowrap text-[11px] min-w-[80px]">操作</th>
                </tr>
              </thead>
              <tbody>
                {/* New row for creating */}
                {showNewRow && (
                  <tr className="border-b bg-emerald-50/50">
                    <td className={`${tdClass} sticky left-0 bg-emerald-50/50 z-10`}>
                      <input
                        type="date"
                        value={newRowDate}
                        onChange={(e) => setNewRowDate(e.target.value)}
                        className="w-full border border-emerald-400 rounded px-1 py-0.5 text-[11px] text-center focus:outline-none focus:ring-1 focus:ring-emerald-400 bg-white"
                      />
                    </td>
                    <td className={tdClass}>
                      {isAdmin ? (
                        <select
                          value={newRowStaffId}
                          onChange={(e) => {
                            const s = staffList.find((s: any) => String(s.staffId) === e.target.value);
                            if (s) { setNewRowStaffId(s.staffId); setNewRowStaffName(s.staffName); }
                          }}
                          className="w-full border border-emerald-400 rounded px-0.5 py-0.5 text-[11px] text-center focus:outline-none focus:ring-1 focus:ring-emerald-400 bg-white"
                        >
                          <option value={0}>选择客服</option>
                          {staffList.map((s: any) => (
                            <option key={s.staffId} value={s.staffId}>{s.staffName}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-gray-500">{user?.name || "-"}</span>
                      )}
                    </td>
                    {/* whats账号 - 下拉选择 */}
                    <td className={tdClass}>
                      <select
                        value={newRowAccount}
                        onChange={(e) => setNewRowAccount(e.target.value)}
                        className="w-full border border-emerald-400 rounded px-0.5 py-0.5 text-[11px] text-center focus:outline-none focus:ring-1 focus:ring-emerald-400 bg-white"
                      >
                        <option value="">选择账号</option>
                        {accountList.map((acc: string) => (
                          <option key={acc} value={acc}>{acc}</option>
                        ))}
                      </select>
                    </td>
                    <td colSpan={16} className={tdClass}>
                      <span className="text-gray-400 text-[10px]">创建后可编辑各字段，选择账号后自动同步订单数据</span>
                    </td>
                    <td className="py-1 px-1 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          size="sm"
                          className="h-6 px-2 text-[10px]"
                          onClick={handleCreateRow}
                          disabled={createMutation.isPending || (isAdmin && !newRowStaffId)}
                        >
                          {createMutation.isPending ? "..." : "确定"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-[10px]"
                          onClick={() => setShowNewRow(false)}
                        >
                          取消
                        </Button>
                      </div>
                    </td>
                  </tr>
                )}

                {isLoading ? (
                  <tr><td colSpan={20} className="p-8 text-center text-muted-foreground">加载中...</td></tr>
                ) : dailyList.length === 0 && !showNewRow ? (
                  <tr><td colSpan={20} className="p-8 text-center text-muted-foreground">暂无数据，点击"新增记录"开始填写</td></tr>
                ) : (
                  <>
                    {dailyList.map((row: any) => (
                      <tr key={row.id} className="border-b hover:bg-muted/30 transition-colors group">
                        {/* 日期 - 不可编辑 */}
                        <td className={`${tdClass} sticky left-0 bg-background group-hover:bg-muted/30 z-10 font-medium`}>
                          {formatDate(row.reportDate)}
                        </td>
                        {/* 名字 - 不可编辑 */}
                        <td className={`${tdClass} font-medium`}>
                          {row.staffName}
                        </td>
                        {/* whats账号 - 下拉选择，选择后自动同步 */}
                        <td className={tdClass}>
                          <AccountSelectCell
                            value={row.whatsAccount || ""}
                            accounts={accountList}
                            onSave={(v) => saveFieldAndSync(row.id, "whatsAccount", v)}
                          />
                        </td>
                        {/* 消息数 */}
                        <td className={tdClass}>
                          <EditableCell
                            value={String(row.messageCount || 0)}
                            onSave={(v) => saveFieldAndSync(row.id, "messageCount", v)}
                            type="number"
                          />
                        </td>
                        {/* 新客人数 */}
                        <td className={tdClass}>
                          <EditableCell
                            value={String(row.newCustomerCount || 0)}
                            onSave={(v) => saveFieldAndSync(row.id, "newCustomerCount", v)}
                            type="number"
                          />
                        </td>
                        {/* 新增意向 */}
                        <td className={tdClass}>
                          <EditableCell
                            value={String(row.newIntentCount || 0)}
                            onSave={(v) => saveFieldAndSync(row.id, "newIntentCount", v)}
                            type="number"
                          />
                        </td>
                        {/* 回访人数 */}
                        <td className={tdClass}>
                          <EditableCell
                            value={String(row.returnVisitCount || 0)}
                            onSave={(v) => saveFieldAndSync(row.id, "returnVisitCount", v)}
                            type="number"
                          />
                        </td>
                        {/* 新客单数 */}
                        <td className={tdClass}>
                          <EditableCell
                            value={String(row.newOrderCount || 0)}
                            onSave={(v) => saveFieldAndSync(row.id, "newOrderCount", v)}
                            type="number"
                          />
                        </td>
                        {/* 老客单数 */}
                        <td className={tdClass}>
                          <EditableCell
                            value={String(row.oldOrderCount || 0)}
                            onSave={(v) => saveFieldAndSync(row.id, "oldOrderCount", v)}
                            type="number"
                          />
                        </td>
                        {/* 线上订单 */}
                        <td className={tdClass}>
                          <EditableCell
                            value={String(row.onlineOrderCount || 0)}
                            onSave={(v) => saveFieldAndSync(row.id, "onlineOrderCount", v)}
                            type="number"
                          />
                        </td>
                        {/* 件数 */}
                        <td className={tdClass}>
                          <EditableCell
                            value={String(row.itemCount || 0)}
                            onSave={(v) => saveFieldAndSync(row.id, "itemCount", v)}
                            type="number"
                          />
                        </td>
                        {/* 总营业额 - 自动汇总，不可编辑 */}
                        <td className={`${tdClass} font-medium text-emerald-600`}>
                          <EditableCell
                            value={`¥${formatMoney(row.totalRevenue)}`}
                            onSave={() => {}}
                            disabled
                            className="text-emerald-600 font-medium"
                          />
                        </td>
                        {/* 线上营业额 - 可编辑 */}
                        <td className={tdClass}>
                          <EditableCell
                            value={String(parseFloat(row.onlineRevenue) || 0)}
                            onSave={(v) => saveFieldAndSync(row.id, "onlineRevenue", v)}
                            type="number"
                          />
                        </td>
                        {/* 产品售价 - 自动汇总，不可编辑 */}
                        <td className={tdClass}>
                          <EditableCell
                            value={`¥${formatMoney(row.productSellingPrice)}`}
                            onSave={() => {}}
                            disabled
                          />
                        </td>
                        {/* 收取运费 - 自动汇总，不可编辑 */}
                        <td className={tdClass}>
                          <EditableCell
                            value={`¥${formatMoney(row.shippingCharged)}`}
                            onSave={() => {}}
                            disabled
                          />
                        </td>
                        {/* 预估毛利润 - 自动汇总，不可编辑 */}
                        <td className={`${tdClass} font-medium text-blue-600`}>
                          <EditableCell
                            value={`¥${formatMoney(row.estimatedProfit)}`}
                            onSave={() => {}}
                            disabled
                            className="text-blue-600 font-medium"
                          />
                        </td>
                        {/* 预估利润率 - 自动计算，不可编辑 */}
                        <td className={tdClass}>
                          <EditableCell
                            value={formatPercent(row.estimatedProfitRate)}
                            onSave={() => {}}
                            disabled
                          />
                        </td>
                        {/* 电报好评 */}
                        <td className={tdClass}>
                          <EditableCell
                            value={String(row.telegramPraiseCount || 0)}
                            onSave={(v) => saveFieldAndSync(row.id, "telegramPraiseCount", v)}
                            type="number"
                          />
                        </td>
                        {/* 周转介绍 */}
                        <td className={tdClass}>
                          <EditableCell
                            value={String(row.referralCount || 0)}
                            onSave={(v) => saveFieldAndSync(row.id, "referralCount", v)}
                            type="number"
                          />
                        </td>
                        {/* 操作 */}
                        <td className="py-1 px-1 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-0.5">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              title="同步订单数据"
                              onClick={() => syncMutation.mutate({ id: row.id })}
                              disabled={!row.whatsAccount}
                            >
                              <RefreshCw className={`w-3 h-3 ${syncMutation.isPending ? "animate-spin" : ""}`} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-destructive"
                              title="删除"
                              onClick={() => { if (confirm("确定删除该记录？")) deleteMutation.mutate({ id: row.id }); }}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {/* 汇总行 */}
                    <tr className="border-t-2 bg-amber-50/50 font-bold text-[11px]">
                      <td className={`${tdClass} sticky left-0 bg-amber-50/50 z-10 font-bold`}>合计</td>
                      <td className={`${tdClass} font-bold`}>{dailyList.length}条</td>
                      <td className={tdClass}></td>
                      <td className={`${tdClass} font-bold`}>{totals.messageCount}</td>
                      <td className={`${tdClass} font-bold`}>{totals.newCustomerCount}</td>
                      <td className={`${tdClass} font-bold`}>{totals.newIntentCount}</td>
                      <td className={`${tdClass} font-bold`}>{totals.returnVisitCount}</td>
                      <td className={`${tdClass} font-bold`}>{totals.newOrderCount}</td>
                      <td className={`${tdClass} font-bold`}>{totals.oldOrderCount}</td>
                      <td className={`${tdClass} font-bold`}>{totals.onlineOrderCount}</td>
                      <td className={`${tdClass} font-bold`}>{totals.itemCount}</td>
                      <td className={`${tdClass} font-bold text-emerald-600`}>¥{formatMoney(totals.totalRevenue)}</td>
                      <td className={`${tdClass} font-bold`}>¥{formatMoney(totals.onlineRevenue)}</td>
                      <td className={`${tdClass} font-bold`}>¥{formatMoney(totals.productSellingPrice)}</td>
                      <td className={`${tdClass} font-bold`}>¥{formatMoney(totals.shippingCharged)}</td>
                      <td className={`${tdClass} font-bold text-blue-600`}>¥{formatMoney(totals.estimatedProfit)}</td>
                      <td className={`${tdClass} font-bold`}>{totals.totalRevenue > 0 ? formatPercent(totals.estimatedProfit / totals.totalRevenue) : "0.0%"}</td>
                      <td className={`${tdClass} font-bold`}>{totals.telegramPraiseCount}</td>
                      <td className={`${tdClass} font-bold`}>{totals.referralCount}</td>
                      <td className={tdClass}></td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 日报表弹窗 */}
      <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5" />
              {isAdmin ? "团队日报表" : "个人日报表"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex items-end gap-4 mb-4">
            <div>
              <Label className="text-xs mb-1 block">报表日期</Label>
              <Input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} className="w-40" />
            </div>
            {isAdmin && (
              <div>
                <Label className="text-xs mb-1 block">客服</Label>
                <Select value={staffFilter} onValueChange={setStaffFilter}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">全部客服</SelectItem>
                    {staffList.map((s: any, idx: number) => (
                      <SelectItem key={s.staffId || `staff-${idx}`} value={s.staffName}>{s.staffName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {reportQuery.isLoading ? (
            <div className="p-8 text-center text-muted-foreground">加载中...</div>
          ) : !reportQuery.data || reportQuery.data.rows.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">该日期暂无数据</div>
          ) : (
            <div className="space-y-4">
              {/* 汇总卡片 */}
              {reportQuery.data.totals && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Card className="bg-emerald-50 dark:bg-emerald-950/30">
                    <CardContent className="p-3">
                      <p className="text-xs text-muted-foreground">总营业额</p>
                      <p className="text-xl font-bold text-emerald-600">¥{formatMoney(reportQuery.data.totals.totalRevenue)}</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-blue-50 dark:bg-blue-950/30">
                    <CardContent className="p-3">
                      <p className="text-xs text-muted-foreground">预估毛利润</p>
                      <p className="text-xl font-bold text-blue-600">¥{formatMoney(reportQuery.data.totals.totalEstimatedProfit)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3">
                      <p className="text-xs text-muted-foreground">平均利润率</p>
                      <p className="text-xl font-bold">{formatPercent(reportQuery.data.totals.avgProfitRate)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3">
                      <p className="text-xs text-muted-foreground">客服人数</p>
                      <p className="text-xl font-bold">{reportQuery.data.totals.staffCount}</p>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* 详细表格 */}
              <div className="overflow-x-auto border rounded-lg">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="border-b bg-rose-50">
                      <th className={thClass}>名字</th>
                      <th className={thClass}>whats账号</th>
                      <th className={thClass}>消息数</th>
                      <th className={thClass}>新客人数</th>
                      <th className={thClass}>新增意向</th>
                      <th className={thClass}>回访人数</th>
                      <th className={thClass}>新客单数</th>
                      <th className={thClass}>老客单数</th>
                      <th className={thClass}>件数</th>
                      <th className={thClass}>总营业额</th>
                      <th className={thClass}>产品售价</th>
                      <th className={thClass}>收取运费</th>
                      <th className={thClass}>预估毛利润</th>
                      <th className="py-1.5 px-1 text-center font-medium whitespace-nowrap text-[11px]">利润率</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportQuery.data.rows.map((row: any) => (
                      <tr key={row.id} className="border-b hover:bg-muted/30">
                        <td className={`${tdClass} font-medium`}>{row.staffName}</td>
                        <td className={tdClass}>{row.whatsAccount || "-"}</td>
                        <td className={tdClass}>{row.messageCount || 0}</td>
                        <td className={tdClass}>{row.newCustomerCount || 0}</td>
                        <td className={tdClass}>{row.newIntentCount || 0}</td>
                        <td className={tdClass}>{row.returnVisitCount || 0}</td>
                        <td className={tdClass}>{row.newOrderCount || 0}</td>
                        <td className={tdClass}>{row.oldOrderCount || 0}</td>
                        <td className={tdClass}>{row.itemCount || 0}</td>
                        <td className={`${tdClass} font-medium text-emerald-600`}>¥{formatMoney(row.totalRevenue)}</td>
                        <td className={tdClass}>¥{formatMoney(row.productSellingPrice)}</td>
                        <td className={tdClass}>¥{formatMoney(row.shippingCharged)}</td>
                        <td className={`${tdClass} font-medium text-blue-600`}>¥{formatMoney(row.estimatedProfit)}</td>
                        <td className="py-1 px-1 text-center whitespace-nowrap text-[11px]">{formatPercent(row.estimatedProfitRate)}</td>
                      </tr>
                    ))}
                    {/* 汇总行 */}
                    {reportQuery.data.totals && (
                      <tr className="border-t-2 bg-amber-50/50 font-bold">
                        <td className={`${tdClass} font-bold`}>合计</td>
                        <td className={tdClass}></td>
                        <td className={`${tdClass} font-bold`}>{reportQuery.data.totals.totalMessages}</td>
                        <td className={`${tdClass} font-bold`}>{reportQuery.data.totals.totalNewCustomers}</td>
                        <td className={`${tdClass} font-bold`}>{reportQuery.data.totals.totalNewIntents}</td>
                        <td className={`${tdClass} font-bold`}>{reportQuery.data.totals.totalReturnVisits}</td>
                        <td className={`${tdClass} font-bold`}>{reportQuery.data.totals.totalNewOrders}</td>
                        <td className={`${tdClass} font-bold`}>{reportQuery.data.totals.totalOldOrders}</td>
                        <td className={`${tdClass} font-bold`}>{reportQuery.data.totals.totalItems}</td>
                        <td className={`${tdClass} font-bold text-emerald-600`}>¥{formatMoney(reportQuery.data.totals.totalRevenue)}</td>
                        <td className={`${tdClass} font-bold`}>¥{formatMoney(reportQuery.data.totals.totalProductSellingPrice)}</td>
                        <td className={`${tdClass} font-bold`}>¥{formatMoney(reportQuery.data.totals.totalShippingCharged)}</td>
                        <td className={`${tdClass} font-bold text-blue-600`}>¥{formatMoney(reportQuery.data.totals.totalEstimatedProfit)}</td>
                        <td className="py-1 px-1 text-center whitespace-nowrap text-[11px] font-bold">{formatPercent(reportQuery.data.totals.avgProfitRate)}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
