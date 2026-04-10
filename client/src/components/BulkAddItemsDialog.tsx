import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Plus, Trash2, Loader2, Copy } from "lucide-react";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";

type ItemForm = {
  orderNumber: string;
  size: string;
  quantity: string;
  source: string;
  amountUsd: string;
  sellingPrice: string;
  productCost: string;
  shippingActual: string;
  itemStatus: string;
  paymentStatus: string;
  remarks: string;
};

const emptyItem: ItemForm = {
  orderNumber: "",
  size: "",
  quantity: "",
  source: "",
  amountUsd: "",
  sellingPrice: "",
  productCost: "",
  shippingActual: "",
  itemStatus: "已报货，待发货",
  paymentStatus: "未付款",
  remarks: "",
};

const ORDER_STATUSES = [
  "已报货，待发货",
  "待定",
  "缺货",
  "已发送qc视频，待确认",
  "已发送qc视频，已确认",
  "已发货",
  "单号已发给顾客",
  "顾客已收货",
  "已退款",
];

const PAYMENT_STATUSES = ["未付款", "待付款", "已付款", "部分付款"];

export default function BulkAddItemsDialog({
  open,
  onOpenChange,
  orderId,
  orderNumber,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: number;
  orderNumber: string;
  onSuccess?: () => void;
}) {
  const [items, setItems] = useState<ItemForm[]>([
    { ...emptyItem, orderNumber },
    { ...emptyItem, orderNumber },
  ]);

  const bulkCreateMutation = trpc.orderItems.bulkCreate.useMutation({
    onSuccess: (result) => {
      toast.success(`成功添加 ${result.count} 个子项`);
      onOpenChange(false);
      setItems([{ ...emptyItem, orderNumber }, { ...emptyItem, orderNumber }]);
      onSuccess?.();
    },
    onError: (err) => toast.error(err.message),
  });

  const addRow = useCallback(() => {
    setItems((prev) => [...prev, { ...emptyItem, orderNumber }]);
  }, [orderNumber]);

  const duplicateRow = useCallback((idx: number) => {
    setItems((prev) => {
      const copy = [...prev];
      copy.splice(idx + 1, 0, { ...prev[idx] });
      return copy;
    });
  }, []);

  const removeRow = useCallback((idx: number) => {
    setItems((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== idx);
    });
  }, []);

  const updateItem = useCallback((idx: number, field: keyof ItemForm, value: string) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: value };
      return copy;
    });
  }, []);

  const handleSubmit = () => {
    // Filter out completely empty rows
    const validItems = items.filter(
      (item) => item.orderNumber || item.size || item.amountUsd || item.sellingPrice || item.source
    );
    if (validItems.length === 0) {
      toast.error("请至少填写一个子项的信息");
      return;
    }

    bulkCreateMutation.mutate({
      orderId,
      items: validItems.map((item) => ({
        orderNumber: item.orderNumber || undefined,
        size: item.size || undefined,
        quantity: item.quantity ? parseInt(item.quantity) : undefined,
        source: item.source || undefined,
        amountUsd: item.amountUsd || undefined,
        sellingPrice: item.sellingPrice || undefined,
        productCost: item.productCost || undefined,
        shippingActual: item.shippingActual || undefined,
        itemStatus: item.itemStatus || undefined,
        paymentStatus: item.paymentStatus || undefined,
        remarks: item.remarks || undefined,
      })),
    });
  };

  const handleClose = () => {
    onOpenChange(false);
    setItems([{ ...emptyItem, orderNumber }, { ...emptyItem, orderNumber }]);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            批量添加子项
            <span className="text-sm font-normal text-muted-foreground">
              订单 #{orderNumber} · 共 {items.length} 项
            </span>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 max-h-[60vh] pr-2">
          <div className="space-y-3">
            {items.map((item, idx) => (
              <div
                key={idx}
                className="border rounded-lg p-3 bg-gray-50/50 hover:bg-gray-50 transition-colors relative group"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    子项 #{idx + 1}
                  </span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => duplicateRow(idx)}
                      title="复制此行"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive hover:text-destructive"
                      onClick={() => removeRow(idx)}
                      disabled={items.length <= 1}
                      title="删除此行"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">订单编号</Label>
                    <Input
                      value={item.orderNumber}
                      onChange={(e) => updateItem(idx, "orderNumber", e.target.value)}
                      className="h-7 text-xs"
                      placeholder="编号"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Size</Label>
                    <Input
                      value={item.size}
                      onChange={(e) => updateItem(idx, "size", e.target.value)}
                      className="h-7 text-xs"
                      placeholder="尺码"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">件数</Label>
                    <Input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => updateItem(idx, "quantity", e.target.value)}
                      className="h-7 text-xs"
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">货源</Label>
                    <Input
                      value={item.source}
                      onChange={(e) => updateItem(idx, "source", e.target.value)}
                      className="h-7 text-xs"
                      placeholder="货源"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">总金额$</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={item.amountUsd}
                      onChange={(e) => updateItem(idx, "amountUsd", e.target.value)}
                      className="h-7 text-xs"
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">售价</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={item.sellingPrice}
                      onChange={(e) => updateItem(idx, "sellingPrice", e.target.value)}
                      className="h-7 text-xs"
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">产品成本</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={item.productCost}
                      onChange={(e) => updateItem(idx, "productCost", e.target.value)}
                      className="h-7 text-xs"
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">实际运费</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={item.shippingActual}
                      onChange={(e) => updateItem(idx, "shippingActual", e.target.value)}
                      className="h-7 text-xs"
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">订单状态</Label>
                    <Select
                      value={item.itemStatus}
                      onValueChange={(v) => updateItem(idx, "itemStatus", v)}
                    >
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ORDER_STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">付款状态</Label>
                    <Select
                      value={item.paymentStatus}
                      onValueChange={(v) => updateItem(idx, "paymentStatus", v)}
                    >
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PAYMENT_STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1 col-span-2">
                    <Label className="text-[10px] text-muted-foreground">备注</Label>
                    <Input
                      value={item.remarks}
                      onChange={(e) => updateItem(idx, "remarks", e.target.value)}
                      className="h-7 text-xs"
                      placeholder="备注"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="flex items-center justify-between pt-2 border-t">
          <Button variant="outline" size="sm" onClick={addRow} className="gap-1">
            <Plus className="h-3.5 w-3.5" />
            添加一行
          </Button>
          <div className="text-xs text-muted-foreground">
            提示：空行将被自动忽略
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={bulkCreateMutation.isPending}
            className="gap-2"
          >
            {bulkCreateMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                提交中...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                批量添加 ({items.filter((i) => i.orderNumber || i.size || i.amountUsd || i.sellingPrice || i.source).length} 项)
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
