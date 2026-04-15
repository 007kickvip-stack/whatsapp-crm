import { useState, useRef, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Plus,
  Trash2,
  Search,
  Upload,
  X,
  Loader2,
  Image as ImageIcon,
  Wallet,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ChevronDown,
  RefreshCw,
  Filter,
  Calendar,
} from "lucide-react";
import AccountSelect from "@/components/AccountSelect";

// ============================================================
// Constants
// ============================================================
const RECEIVING_ACCOUNTS = [
  "廖欧妹",
  "苏翊豪",
  "王国军",
  "成皇",
  "谢显禄",
  "罗胜",
  "闪明",
  "龚双意",
  "旺吞",
  "项小丽",
  "马各端",
  "罗丹",
  "支付宝",
  "飞来汇",
  "USDT ERC",
  "SDT（TRC20）",
];

const IS_RECEIVED_OPTIONS = ["是", "否"];

// ============================================================
// Helper: format number
// ============================================================
function fmtNum(val: string | number | null | undefined): string {
  const n = parseFloat(String(val || "0"));
  return isNaN(n) ? "0.00" : n.toFixed(2);
}

// ============================================================
// Editable Cell Component
// ============================================================
function EditableCell({
  value,
  onSave,
  placeholder = "",
  className = "",
  type = "text",
}: {
  value: string;
  onSave: (v: string) => void;
  placeholder?: string;
  className?: string;
  type?: "text" | "number";
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

  if (!editing) {
    return (
      <div
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
        className={`cursor-text min-h-[22px] px-0.5 py-0.5 rounded hover:bg-emerald-50 transition-colors ${className}`}
      >
        {value || (
          <span className="text-gray-300 italic text-[10px]">
            {placeholder || "点击编辑"}
          </span>
        )}
      </div>
    );
  }

  return (
    <input
      ref={inputRef}
      type={type}
      step={type === "number" ? "0.01" : undefined}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        setEditing(false);
        if (draft !== value) onSave(draft);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          setEditing(false);
          if (draft !== value) onSave(draft);
        }
        if (e.key === "Escape") {
          setEditing(false);
          setDraft(value);
        }
      }}
      className="w-full border border-emerald-300 rounded px-1 py-0.5 text-[11px] outline-none focus:ring-1 focus:ring-emerald-400 bg-white"
    />
  );
}

// ============================================================
// Receiving Account Select Dropdown
// ============================================================
function ReceivingAccountSelect({
  value,
  onValueChange,
  compact = false,
  showAll = false,
}: {
  value: string;
  onValueChange: (v: string) => void;
  compact?: boolean;
  showAll?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center gap-1 border rounded transition-colors text-left
          ${
            compact
              ? "border-gray-200 px-1 py-0.5 text-[11px] hover:bg-emerald-50 focus:ring-1 focus:ring-emerald-400"
              : "border-input bg-background px-2 py-1.5 text-xs hover:bg-accent/50 focus:ring-1 focus:ring-ring"
          }
          ${open ? "ring-1 ring-emerald-400" : ""}
          ${!value ? "text-muted-foreground" : ""}
        `}
      >
        <span className="truncate flex-1">
          {value || (showAll ? "全部账户" : "选择收款账户")}
        </span>
        <ChevronDown
          className={`shrink-0 text-muted-foreground transition-transform ${
            compact ? "w-3 h-3" : "w-3.5 h-3.5"
          } ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[160px] bg-popover border border-border rounded-md shadow-lg max-h-[280px] overflow-y-auto text-[11px]">
          <button
            type="button"
            onClick={() => {
              onValueChange("");
              setOpen(false);
            }}
            className={`w-full px-2 py-1.5 hover:bg-accent/50 text-left text-muted-foreground ${
              !value ? "bg-accent font-medium" : ""
            }`}
          >
            {showAll ? "全部账户" : "选择收款账户"}
          </button>
          {RECEIVING_ACCOUNTS.map((acct) => (
            <button
              key={acct}
              type="button"
              onClick={() => {
                onValueChange(acct);
                setOpen(false);
              }}
              className={`w-full px-2 py-1.5 hover:bg-accent/50 text-left ${
                value === acct ? "bg-accent text-accent-foreground font-medium" : ""
              }`}
            >
              {acct}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Is Received Select Dropdown
// ============================================================
const PAYMENT_TYPE_OPTIONS = ["定金", "尾款", "全款", "补款"];

const PAYMENT_TYPE_COLORS: Record<string, string> = {
  "定金": "text-blue-700 bg-blue-50 border-blue-200",
  "尾款": "text-purple-700 bg-purple-50 border-purple-200",
  "全款": "text-emerald-700 bg-emerald-50 border-emerald-200",
  "补款": "text-orange-700 bg-orange-50 border-orange-200",
};

function PaymentTypeSelect({
  value,
  onValueChange,
}: {
  value: string;
  onValueChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [open]);

  const colorClass = PAYMENT_TYPE_COLORS[value] || "text-muted-foreground";

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center gap-1 border border-gray-200 rounded px-1.5 py-0.5 text-[11px] hover:bg-gray-50 focus:ring-1 focus:ring-emerald-400 transition-colors text-left
          ${open ? "ring-1 ring-emerald-400" : ""}
          ${value ? colorClass : "text-muted-foreground"}
        `}
      >
        <span className="truncate flex-1">{value || "-"}</span>
        <ChevronDown
          className={`shrink-0 text-muted-foreground transition-transform w-3 h-3 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[80px] bg-popover border border-border rounded-md shadow-lg text-[11px]">
          {PAYMENT_TYPE_OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => {
                onValueChange(opt);
                setOpen(false);
              }}
              className={`w-full px-2 py-1.5 hover:bg-accent/50 text-left ${
                value === opt ? "bg-accent text-accent-foreground font-medium" : ""
              }`}
            >
              <span className={PAYMENT_TYPE_COLORS[opt] || ""}>{opt}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function IsReceivedSelect({
  value,
  onValueChange,
}: {
  value: string;
  onValueChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center gap-1 border border-gray-200 rounded px-1.5 py-0.5 text-[11px] hover:bg-emerald-50 focus:ring-1 focus:ring-emerald-400 transition-colors text-left
          ${open ? "ring-1 ring-emerald-400" : ""}
          ${value === "是" ? "text-emerald-700 bg-emerald-50 border-emerald-200" : value === "否" ? "text-red-600 bg-red-50 border-red-200" : "text-muted-foreground"}
        `}
      >
        <span className="truncate flex-1">{value || "选择"}</span>
        <ChevronDown
          className={`shrink-0 text-muted-foreground transition-transform w-3 h-3 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[80px] bg-popover border border-border rounded-md shadow-lg text-[11px]">
          {IS_RECEIVED_OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => {
                onValueChange(opt);
                setOpen(false);
              }}
              className={`w-full px-2 py-1.5 hover:bg-accent/50 text-left ${
                value === opt ? "bg-accent text-accent-foreground font-medium" : ""
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Image Upload for payment screenshot
// ============================================================
function ImageUploadCell({
  url,
  onUpload,
}: {
  url: string | null;
  onUpload: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("请选择图片文件");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("图片大小不能超过5MB");
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/trpc/upload.image", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      const imageUrl = data?.result?.data?.url;
      if (imageUrl) {
        onUpload(imageUrl);
        toast.success("图片上传成功");
      }
    } catch {
      toast.error("图片上传失败");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex items-center gap-1">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
      {url ? (
        <div className="flex items-center gap-1">
          <img
            src={url}
            alt="截图"
            className="w-7 h-7 object-cover rounded border cursor-pointer hover:opacity-80"
            onClick={() => setPreview(true)}
          />
          <button
            onClick={() => fileRef.current?.click()}
            className="text-[10px] text-emerald-600 hover:text-emerald-700"
          >
            换
          </button>
        </div>
      ) : (
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-0.5 text-[10px] text-gray-400 hover:text-emerald-600 transition-colors"
        >
          {uploading ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Upload className="w-3 h-3" />
          )}
          <span>上传</span>
        </button>
      )}

      {/* Image preview dialog */}
      {preview && url && (
        <Dialog open={preview} onOpenChange={setPreview}>
          <DialogContent className="max-w-lg">
            <img src={url} alt="付款截图" className="w-full rounded" />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ============================================================
// Filter Bar Component
// ============================================================
function FilterBar({
  dateFrom,
  dateTo,
  receivingAccount,
  onDateFromChange,
  onDateToChange,
  onReceivingAccountChange,
  onReset,
}: {
  dateFrom: string;
  dateTo: string;
  receivingAccount: string;
  onDateFromChange: (v: string) => void;
  onDateToChange: (v: string) => void;
  onReceivingAccountChange: (v: string) => void;
  onReset: () => void;
}) {
  const hasFilter = dateFrom || dateTo || receivingAccount;

  return (
    <div className="bg-white rounded-xl border border-gray-100 px-4 py-3 mb-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <Filter className="w-3.5 h-3.5" />
          <span className="font-medium">数据筛选</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <Calendar className="w-3 h-3 text-gray-400" />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => onDateFromChange(e.target.value)}
              className="border border-gray-200 rounded px-2 py-1 text-xs bg-transparent focus:ring-1 focus:ring-emerald-400 outline-none"
              placeholder="开始日期"
            />
          </div>
          <span className="text-gray-300 text-xs">至</span>
          <div className="flex items-center gap-1">
            <input
              type="date"
              value={dateTo}
              onChange={(e) => onDateToChange(e.target.value)}
              className="border border-gray-200 rounded px-2 py-1 text-xs bg-transparent focus:ring-1 focus:ring-emerald-400 outline-none"
            />
          </div>
        </div>
        <div className="w-40">
          <ReceivingAccountSelect
            value={receivingAccount}
            onValueChange={onReceivingAccountChange}
            showAll
          />
        </div>
        {hasFilter && (
          <Button
            variant="outline"
            size="sm"
            onClick={onReset}
            className="h-7 text-xs text-gray-500"
          >
            <X className="w-3 h-3 mr-1" />
            清除筛选
          </Button>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Balance Cards
// ============================================================
function BalanceCards({
  balanceData,
  isLoading,
}: {
  balanceData: Array<{
    account: string;
    income: number;
    expense: number;
    balance: number;
  }>;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 mb-6">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-xl border border-gray-100 p-3 animate-pulse"
          >
            <div className="h-3 bg-gray-200 rounded w-16 mb-2" />
            <div className="h-5 bg-gray-200 rounded w-20 mb-1" />
            <div className="h-2 bg-gray-100 rounded w-24" />
          </div>
        ))}
      </div>
    );
  }

  if (!balanceData || balanceData.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-6 mb-6 text-center text-gray-400 text-sm">
        暂无余额数据，请先添加收入或支出记录
      </div>
    );
  }

  // Calculate total
  const totalIncome = balanceData.reduce((s, b) => s + b.income, 0);
  const totalExpense = balanceData.reduce((s, b) => s + b.expense, 0);
  const totalBalance = totalIncome - totalExpense;

  return (
    <div className="mb-4">
      {/* Total summary card */}
      <div className="grid grid-cols-3 gap-3 mb-3">
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-4 text-white shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 opacity-80" />
            <span className="text-xs opacity-80">总收入</span>
          </div>
          <div className="text-xl font-bold">${fmtNum(totalIncome)}</div>
        </div>
        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-4 text-white shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="w-4 h-4 opacity-80" />
            <span className="text-xs opacity-80">总支出</span>
          </div>
          <div className="text-xl font-bold">${fmtNum(totalExpense)}</div>
        </div>
        <div
          className={`bg-gradient-to-br ${
            totalBalance >= 0
              ? "from-blue-500 to-blue-600"
              : "from-orange-500 to-orange-600"
          } rounded-xl p-4 text-white shadow-sm`}
        >
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-4 h-4 opacity-80" />
            <span className="text-xs opacity-80">总余额</span>
          </div>
          <div className="text-xl font-bold">${fmtNum(totalBalance)}</div>
        </div>
      </div>

      {/* Per-account balance cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
        {balanceData.map((b) => (
          <div
            key={b.account}
            className="bg-white rounded-lg border border-gray-100 p-2.5 hover:shadow-sm transition-shadow"
          >
            <div className="text-[11px] text-gray-500 truncate mb-1 font-medium">
              {b.account}
            </div>
            <div
              className={`text-sm font-bold ${
                b.balance >= 0 ? "text-emerald-600" : "text-red-500"
              }`}
            >
              ${fmtNum(b.balance)}
            </div>
            <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-400">
              <span>
                入 <span className="text-emerald-500">{fmtNum(b.income)}</span>
              </span>
              <span>
                出 <span className="text-red-400">{fmtNum(b.expense)}</span>
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Income Table
// ============================================================
function IncomeTable({
  dateFrom,
  dateTo,
  receivingAccountFilter,
}: {
  dateFrom: string;
  dateTo: string;
  receivingAccountFilter: string;
}) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const utils = trpc.useUtils();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [dateFrom, dateTo, receivingAccountFilter]);

  const { data, isLoading } = trpc.paypalIncome.list.useQuery({
    page,
    pageSize: 50,
    search: search || undefined,
    receivingAccount: receivingAccountFilter || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });

  const createMut = trpc.paypalIncome.create.useMutation({
    onSuccess: () => {
      utils.paypalIncome.list.invalidate();
      utils.paypalBalance.summary.invalidate();
      toast.success("已添加收入记录");
    },
  });

  const updateMut = trpc.paypalIncome.update.useMutation({
    onSuccess: () => {
      utils.paypalIncome.list.invalidate();
      utils.paypalBalance.summary.invalidate();
    },
  });

  const deleteMut = trpc.paypalIncome.delete.useMutation({
    onSuccess: () => {
      utils.paypalIncome.list.invalidate();
      utils.paypalBalance.summary.invalidate();
      toast.success("已删除收入记录");
    },
  });

  const syncMut = trpc.paypalSync.syncFromOrders.useMutation({
    onSuccess: (result) => {
      utils.paypalIncome.list.invalidate();
      utils.paypalBalance.summary.invalidate();
      if (result.created > 0) {
        toast.success(`已补充同步 ${result.created} 条历史订单记录`);
      } else {
        toast.info("所有订单已同步，无需补充");
      }
    },
    onError: () => {
      toast.error("同步失败");
    },
  });

  const repairMut = trpc.paypalSync.repairSync.useMutation({
    onSuccess: (result) => {
      utils.paypalIncome.list.invalidate();
      if (result.updated > 0) {
        toast.success(`已修复 ${result.updated} 条记录的缺失数据（截图/日期/订单编号）`);
      } else {
        toast.info("所有记录数据完整，无需修复");
      }
    },
    onError: () => {
      toast.error("修复同步失败");
    },
  });

  const rows = data?.data || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / 50);

  const handleAddRow = () => {
    const today = new Date().toISOString().slice(0, 10);
    createMut.mutate({ incomeDate: today });
  };

  const handleUpdate = (id: number, field: string, value: string) => {
    updateMut.mutate({ id, [field]: value } as any);
  };

  const handleDelete = (id: number) => {
    if (confirm("确定删除此收入记录？")) {
      deleteMut.mutate({ id });
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/50">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-emerald-600" />
          <h3 className="text-sm font-semibold text-gray-800">收入记录</h3>
          <span className="text-[11px] text-gray-400">共 {total} 条</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="搜索..."
              className="h-7 pl-7 text-xs w-40"
            />
          </div>
          {isAdmin && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => syncMut.mutate()}
                disabled={syncMut.isPending}
                className="h-7 text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                title="订单创建时会自动同步，此按钮用于补充同步历史订单"
              >
                {syncMut.isPending ? (
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                ) : (
                  <RefreshCw className="w-3 h-3 mr-1" />
                )}
                补充同步
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => repairMut.mutate()}
                disabled={repairMut.isPending}
                className="h-7 text-xs border-blue-200 text-blue-700 hover:bg-blue-50"
                title="修复已有记录中缺失的截图、日期和订单编号"
              >
                {repairMut.isPending ? (
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                ) : (
                  <RefreshCw className="w-3 h-3 mr-1" />
                )}
                修复同步
              </Button>
              <Button
                size="sm"
                onClick={handleAddRow}
                disabled={createMut.isPending}
                className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700"
              >
                <Plus className="w-3 h-3 mr-1" />
                新增
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="bg-gray-50 text-gray-500 border-b border-gray-100">
              <th className="px-2 py-2 text-center font-medium w-[90px]">日期</th>
              <th className="px-2 py-2 text-center font-medium w-[100px]">订单编号</th>
              <th className="px-2 py-2 text-center font-medium w-[80px]">账号</th>
              <th className="px-2 py-2 text-center font-medium w-[90px]">客户名字</th>
              <th className="px-2 py-2 text-center font-medium w-[120px]">客户WhatsApp</th>
              <th className="px-2 py-2 text-center font-medium w-[60px]">付款截图</th>
              <th className="px-2 py-2 text-center font-medium w-[70px]">支付类型</th>
              <th className="px-2 py-2 text-center font-medium w-[90px]">付款金额($)</th>
              <th className="px-2 py-2 text-center font-medium w-[100px]">实际收到($)</th>
              <th className="px-2 py-2 text-center font-medium w-[80px]">是否收到</th>
              <th className="px-2 py-2 text-center font-medium w-[110px]">收款账户</th>
              <th className="px-2 py-2 text-center font-medium w-[70px]">客服名字</th>
              <th className="px-2 py-2 text-center font-medium">备注</th>
              {isAdmin && <th className="px-2 py-2 text-center font-medium w-[40px]">操作</th>}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={14} className="text-center py-8 text-gray-400">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={14} className="text-center py-8 text-gray-400">
                  暂无收入记录
                </td>
              </tr>
            ) : (
              rows.map((row: any) => (
                <tr
                  key={row.id}
                  className="border-b border-gray-50 hover:bg-emerald-50/30 transition-colors"
                >
                  <td className="px-2 py-1.5 text-center">
                    <input
                      type="date"
                      value={row.incomeDate || ""}
                      onChange={(e) =>
                        handleUpdate(row.id, "incomeDate", e.target.value)
                      }
                      className="border border-gray-200 rounded px-1 py-0.5 text-[11px] w-full bg-transparent text-center"
                    />
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <EditableCell
                      value={row.orderNumber || ""}
                      onSave={(v) =>
                        handleUpdate(row.id, "orderNumber", v)
                      }
                      placeholder="订单编号"
                      className="text-center text-xs font-mono"
                    />
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <AccountSelect
                      value={row.account || ""}
                      onValueChange={(v) => handleUpdate(row.id, "account", v)}
                      compact
                      placeholder="账号"
                    />
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <EditableCell
                      value={row.customerName || ""}
                      onSave={(v) =>
                        handleUpdate(row.id, "customerName", v)
                      }
                      placeholder="客户名字"
                      className="text-center"
                    />
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <EditableCell
                      value={row.customerWhatsapp || ""}
                      onSave={(v) =>
                        handleUpdate(row.id, "customerWhatsapp", v)
                      }
                      placeholder="WhatsApp"
                      className="text-center"
                    />
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <ImageUploadCell
                      url={row.paymentScreenshotUrl}
                      onUpload={(url) =>
                        handleUpdate(row.id, "paymentScreenshotUrl", url)
                      }
                    />
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <PaymentTypeSelect
                      value={row.paymentType || ""}
                      onValueChange={(v) =>
                        handleUpdate(row.id, "paymentType", v)
                      }
                    />
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <EditableCell
                      value={fmtNum(row.paymentAmount)}
                      onSave={(v) =>
                        handleUpdate(row.id, "paymentAmount", v)
                      }
                      type="number"
                      className="text-center"
                    />
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <EditableCell
                      value={fmtNum(row.actualReceived)}
                      onSave={(v) =>
                        handleUpdate(row.id, "actualReceived", v)
                      }
                      type="number"
                      className="text-center"
                    />
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <IsReceivedSelect
                      value={row.isReceived || "否"}
                      onValueChange={(v) =>
                        handleUpdate(row.id, "isReceived", v)
                      }
                    />
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <ReceivingAccountSelect
                      value={row.receivingAccount || ""}
                      onValueChange={(v) =>
                        handleUpdate(row.id, "receivingAccount", v)
                      }
                      compact
                    />
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <EditableCell
                      value={row.staffName || ""}
                      onSave={(v) => handleUpdate(row.id, "staffName", v)}
                      placeholder="客服"
                      className="text-center"
                    />
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <EditableCell
                      value={row.remarks || ""}
                      onSave={(v) => handleUpdate(row.id, "remarks", v)}
                      placeholder="备注"
                      className="text-center"
                    />
                  </td>
                  {isAdmin && (
                    <td className="px-2 py-1.5 text-center">
                      <button
                        onClick={() => handleDelete(row.id)}
                        className="text-gray-300 hover:text-red-500 transition-colors"
                        title="删除"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-2 border-t border-gray-100 bg-gray-50/30">
          <span className="text-[11px] text-gray-400">
            第 {page}/{totalPages} 页
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="h-6 text-[10px] px-2"
            >
              上一页
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="h-6 text-[10px] px-2"
            >
              下一页
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Expense Table
// ============================================================
function ExpenseTable({
  dateFrom,
  dateTo,
}: {
  dateFrom: string;
  dateTo: string;
}) {
  const utils = trpc.useUtils();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [dateFrom, dateTo]);

  const { data, isLoading } = trpc.paypalExpense.list.useQuery({
    page,
    pageSize: 50,
    search: search || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });

  const createMut = trpc.paypalExpense.create.useMutation({
    onSuccess: () => {
      utils.paypalExpense.list.invalidate();
      utils.paypalBalance.summary.invalidate();
      toast.success("已添加支出记录");
    },
  });

  const updateMut = trpc.paypalExpense.update.useMutation({
    onSuccess: () => {
      utils.paypalExpense.list.invalidate();
      utils.paypalBalance.summary.invalidate();
    },
  });

  const deleteMut = trpc.paypalExpense.delete.useMutation({
    onSuccess: () => {
      utils.paypalExpense.list.invalidate();
      utils.paypalBalance.summary.invalidate();
      toast.success("已删除支出记录");
    },
  });

  const rows = data?.data || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / 50);

  const handleAddRow = () => {
    const today = new Date().toISOString().slice(0, 10);
    createMut.mutate({ expenseDate: today });
  };

  const handleUpdate = (id: number, field: string, value: string) => {
    updateMut.mutate({ id, [field]: value } as any);
  };

  const handleDelete = (id: number) => {
    if (confirm("确定删除此支出记录？")) {
      deleteMut.mutate({ id });
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/50">
        <div className="flex items-center gap-2">
          <TrendingDown className="w-4 h-4 text-red-500" />
          <h3 className="text-sm font-semibold text-gray-800">支出记录</h3>
          <span className="text-[11px] text-gray-400">共 {total} 条</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="搜索..."
              className="h-7 pl-7 text-xs w-40"
            />
          </div>
          <Button
            size="sm"
            onClick={handleAddRow}
            disabled={createMut.isPending}
            className="h-7 text-xs bg-red-500 hover:bg-red-600"
          >
            <Plus className="w-3 h-3 mr-1" />
            新增
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="bg-gray-50 text-gray-500 border-b border-gray-100">
              <th className="px-3 py-2 text-left font-medium w-[120px]">日期</th>
              <th className="px-3 py-2 text-left font-medium w-[120px]">账号</th>
              <th className="px-3 py-2 text-right font-medium w-[120px]">金额($)</th>
              <th className="px-3 py-2 text-left font-medium">备注</th>
              <th className="px-3 py-2 text-center font-medium w-[50px]">操作</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className="text-center py-8 text-gray-400">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-8 text-gray-400">
                  暂无支出记录
                </td>
              </tr>
            ) : (
              rows.map((row: any) => (
                <tr
                  key={row.id}
                  className="border-b border-gray-50 hover:bg-red-50/30 transition-colors"
                >
                  <td className="px-3 py-1.5">
                    <input
                      type="date"
                      value={row.expenseDate || ""}
                      onChange={(e) =>
                        handleUpdate(row.id, "expenseDate", e.target.value)
                      }
                      className="border border-gray-200 rounded px-1 py-0.5 text-[11px] w-full bg-transparent"
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <AccountSelect
                      value={row.account || ""}
                      onValueChange={(v) => handleUpdate(row.id, "account", v)}
                      compact
                      placeholder="账号"
                    />
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <EditableCell
                      value={fmtNum(row.amount)}
                      onSave={(v) => handleUpdate(row.id, "amount", v)}
                      type="number"
                      className="text-right"
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <EditableCell
                      value={row.remarks || ""}
                      onSave={(v) => handleUpdate(row.id, "remarks", v)}
                      placeholder="备注"
                    />
                  </td>
                  <td className="px-3 py-1.5 text-center">
                    <button
                      onClick={() => handleDelete(row.id)}
                      className="text-gray-300 hover:text-red-500 transition-colors"
                      title="删除"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-2 border-t border-gray-100 bg-gray-50/30">
          <span className="text-[11px] text-gray-400">
            第 {page}/{totalPages} 页
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="h-6 text-[10px] px-2"
            >
              上一页
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="h-6 text-[10px] px-2"
            >
              下一页
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Main PayPal Page
// ============================================================
export default function PaypalPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { data: balanceData, isLoading: balanceLoading } =
    trpc.paypalBalance.summary.useQuery(undefined, { enabled: isAdmin });

  const [activeTab, setActiveTab] = useState<"income" | "expense">("income");

  // Shared filter state
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [receivingAccountFilter, setReceivingAccountFilter] = useState("");

  const handleResetFilters = () => {
    setDateFrom("");
    setDateTo("");
    setReceivingAccountFilter("");
  };

  return (
    <div className="space-y-4">
      {/* Page title */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-emerald-50 rounded-lg">
          <Wallet className="w-5 h-5 text-emerald-600" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-900">PayPal 收支管理</h1>
          <p className="text-xs text-gray-400">管理PayPal收入和支出记录</p>
        </div>
      </div>

      {/* Balance Cards - 仅管理员可见 */}
      {isAdmin && (
        <BalanceCards
          balanceData={balanceData || []}
          isLoading={balanceLoading}
        />
      )}

      {/* Filter Bar */}
      <FilterBar
        dateFrom={dateFrom}
        dateTo={dateTo}
        receivingAccount={receivingAccountFilter}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        onReceivingAccountChange={setReceivingAccountFilter}
        onReset={handleResetFilters}
      />

      {/* Tab Switch - 仅管理员可见支出Tab */}
      {isAdmin && (
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 w-fit">
          <button
            onClick={() => setActiveTab("income")}
            className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeTab === "income"
                ? "bg-white text-emerald-700 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5 inline mr-1" />
            收入
          </button>
          <button
            onClick={() => setActiveTab("expense")}
            className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeTab === "expense"
                ? "bg-white text-red-600 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <TrendingDown className="w-3.5 h-3.5 inline mr-1" />
            支出
          </button>
        </div>
      )}

      {/* Tables */}
      {(!isAdmin || activeTab === "income") ? (
        <IncomeTable
          dateFrom={dateFrom}
          dateTo={dateTo}
          receivingAccountFilter={receivingAccountFilter}
        />
      ) : (
        <ExpenseTable dateFrom={dateFrom} dateTo={dateTo} />
      )}
    </div>
  );
}
