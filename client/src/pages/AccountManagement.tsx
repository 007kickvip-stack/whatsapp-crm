import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, GripVertical, Palette } from "lucide-react";

// Predefined color palette
const COLOR_PALETTE = [
  "#f87171", "#fb923c", "#fbbf24", "#a3e635", "#34d399",
  "#22d3ee", "#60a5fa", "#818cf8", "#a78bfa", "#c084fc",
  "#e879f9", "#f472b6", "#fca5a5", "#fdba74", "#fde047",
  "#bef264", "#86efac", "#67e8f9", "#93c5fd", "#a5b4fc",
  "#c4b5fd", "#d8b4fe", "#f0abfc", "#f9a8d4", "#7dd3fc",
  "#94a3b8", "#78716c", "#6b7280", "#9ca3af", "#d1d5db",
];

type AccountItem = {
  id: number;
  name: string;
  color: string | null;
  sortOrder: number | null;
};

export default function AccountManagement() {
  const { user } = useAuth();
  const utils = trpc.useUtils();

  const { data: accountsRaw = [], isLoading } = trpc.accounts.list.useQuery();
  const accounts = accountsRaw as AccountItem[];

  const createMutation = trpc.accounts.create.useMutation({
    onSuccess: () => {
      utils.accounts.list.invalidate();
      toast.success("账号创建成功");
      setDialogOpen(false);
      resetForm();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.accounts.update.useMutation({
    onSuccess: () => {
      utils.accounts.list.invalidate();
      toast.success("账号更新成功");
      setDialogOpen(false);
      resetForm();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.accounts.delete.useMutation({
    onSuccess: () => {
      utils.accounts.list.invalidate();
      toast.success("账号已删除");
    },
    onError: (err) => toast.error(err.message),
  });

  const reorderMutation = trpc.accounts.reorder.useMutation({
    onSuccess: () => {
      utils.accounts.list.invalidate();
    },
  });

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formName, setFormName] = useState("");
  const [formColor, setFormColor] = useState("#94a3b8");
  const [showColorPicker, setShowColorPicker] = useState(false);

  // Drag state
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  function resetForm() {
    setEditingId(null);
    setFormName("");
    setFormColor("#94a3b8");
    setShowColorPicker(false);
  }

  function openCreate() {
    resetForm();
    setDialogOpen(true);
  }

  function openEdit(acc: AccountItem) {
    setEditingId(acc.id);
    setFormName(acc.name);
    setFormColor(acc.color || "#94a3b8");
    setDialogOpen(true);
  }

  function handleSave() {
    if (!formName.trim()) {
      toast.error("账号名称不能为空");
      return;
    }
    if (editingId) {
      updateMutation.mutate({ id: editingId, name: formName.trim(), color: formColor });
    } else {
      createMutation.mutate({ name: formName.trim(), color: formColor });
    }
  }

  function handleDelete(acc: AccountItem) {
    if (confirm(`确定要删除账号 "${acc.name}" 吗？删除后不可恢复。`)) {
      deleteMutation.mutate({ id: acc.id });
    }
  }

  // Drag and drop handlers
  const handleDragStart = useCallback((index: number) => {
    setDragIndex(index);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  }, []);

  const handleDrop = useCallback((index: number) => {
    if (dragIndex === null || dragIndex === index) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }

    const newList = [...accounts];
    const [moved] = newList.splice(dragIndex, 1);
    newList.splice(index, 0, moved);

    const items = newList.map((acc, i) => ({ id: acc.id, sortOrder: i }));
    reorderMutation.mutate({ items });

    setDragIndex(null);
    setDragOverIndex(null);
  }, [dragIndex, accounts, reorderMutation]);

  const handleDragEnd = useCallback(() => {
    setDragIndex(null);
    setDragOverIndex(null);
  }, []);

  if (user?.role !== "admin") {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        仅管理员可访问此页面
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">账号管理</h1>
          <p className="text-sm text-muted-foreground mt-1">
            管理订单表和每日数据表中的账号下拉选项，支持自定义颜色和排序
          </p>
        </div>
        <Button onClick={openCreate} className="gap-1">
          <Plus className="w-4 h-4" />
          新增账号
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-card border rounded-lg p-4">
          <div className="text-2xl font-bold text-foreground">{accounts.length}</div>
          <div className="text-xs text-muted-foreground">账号总数</div>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="text-2xl font-bold text-foreground">
            {new Set(accounts.map((a) => a.color)).size}
          </div>
          <div className="text-xs text-muted-foreground">使用颜色数</div>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="text-2xl font-bold text-emerald-600">可拖拽排序</div>
          <div className="text-xs text-muted-foreground">拖拽左侧图标调整顺序</div>
        </div>
      </div>

      {/* Account list */}
      <div className="bg-card border rounded-lg overflow-hidden">
        <div className="grid grid-cols-[40px_1fr_100px_120px] gap-2 px-4 py-3 bg-muted/50 text-xs font-medium text-muted-foreground border-b">
          <div></div>
          <div>账号名称</div>
          <div className="text-center">颜色</div>
          <div className="text-center">操作</div>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">加载中...</div>
        ) : accounts.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">暂无账号，点击"新增账号"添加</div>
        ) : (
          <div>
            {accounts.map((acc, index) => (
              <div
                key={acc.id}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={() => handleDrop(index)}
                onDragEnd={handleDragEnd}
                className={`
                  grid grid-cols-[40px_1fr_100px_120px] gap-2 px-4 py-3 items-center border-b last:border-b-0
                  transition-all cursor-grab active:cursor-grabbing
                  ${dragIndex === index ? "opacity-50 bg-muted/30" : "hover:bg-muted/20"}
                  ${dragOverIndex === index && dragIndex !== index ? "border-t-2 border-t-emerald-500" : ""}
                `}
              >
                {/* Drag handle */}
                <div className="flex items-center justify-center text-muted-foreground">
                  <GripVertical className="w-4 h-4" />
                </div>

                {/* Name with color dot */}
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block w-3 h-3 rounded-full shrink-0 border border-black/10"
                    style={{ backgroundColor: acc.color || "#94a3b8" }}
                  />
                  <span className="font-medium text-sm text-foreground">{acc.name}</span>
                </div>

                {/* Color preview */}
                <div className="flex items-center justify-center">
                  <span
                    className="inline-block w-6 h-6 rounded border border-black/10"
                    style={{ backgroundColor: acc.color || "#94a3b8" }}
                    title={acc.color || "#94a3b8"}
                  />
                </div>

                {/* Actions */}
                <div className="flex items-center justify-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEdit(acc)}
                    className="h-7 w-7 p-0"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(acc)}
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>{editingId ? "编辑账号" : "新增账号"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Name */}
            <div className="space-y-2">
              <Label>账号名称</Label>
              <Input
                placeholder="输入账号名称"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
              />
            </div>

            {/* Color */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <Palette className="w-3.5 h-3.5" />
                颜色标记
              </Label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowColorPicker(!showColorPicker)}
                  className="w-10 h-10 rounded-lg border-2 border-border hover:border-foreground/50 transition-colors"
                  style={{ backgroundColor: formColor }}
                />
                <Input
                  value={formColor}
                  onChange={(e) => setFormColor(e.target.value)}
                  placeholder="#94a3b8"
                  className="w-32 font-mono text-sm"
                />
                <span className="text-xs text-muted-foreground">点击色块选择预设颜色</span>
              </div>

              {/* Color palette */}
              {showColorPicker && (
                <div className="grid grid-cols-10 gap-1.5 p-3 bg-muted/50 rounded-lg border">
                  {COLOR_PALETTE.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => {
                        setFormColor(c);
                        setShowColorPicker(false);
                      }}
                      className={`w-7 h-7 rounded-md border-2 transition-all hover:scale-110 ${
                        formColor === c ? "border-foreground ring-1 ring-foreground" : "border-transparent"
                      }`}
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button
              onClick={handleSave}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending ? "保存中..." : "保存"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
