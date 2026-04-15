import { useState, useRef, useCallback, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
import { Plus, Trash2, Edit, Upload, X, DollarSign, Loader2 } from "lucide-react";
import { toast } from "sonner";

const PAYMENT_TYPES = ["定金", "尾款", "全款", "补款"];

const RECEIVING_ACCOUNTS = [
  "廖欧妹", "苏翊豪", "王国军", "成皇", "谢显禄", "罗胜",
  "闪明", "龚双意", "旺吞", "项小丽", "马各端", "罗丹",
  "支付宝", "飞来汇", "USDT ERC", "SDT（TRC20）"
];

interface PaymentRecordsPanelProps {
  orderId: number;
  orderNumber: string;
  totalAmountUsd: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPaymentChanged?: () => void;
}

export default function PaymentRecordsPanel({
  orderId,
  orderNumber,
  totalAmountUsd,
  open,
  onOpenChange,
  onPaymentChanged,
}: PaymentRecordsPanelProps) {
  const utils = trpc.useUtils();
  const { data: payments, isLoading } = trpc.orderPayments.listByOrder.useQuery(
    { orderId },
    { enabled: open }
  );

  const [addOpen, setAddOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Form state
  const [formType, setFormType] = useState("全款");
  const [formAmount, setFormAmount] = useState("");
  const [formDate, setFormDate] = useState(new Date().toISOString().split("T")[0]);
  const [formAccount, setFormAccount] = useState("");
  const [formRemarks, setFormRemarks] = useState("");
  const [formScreenshot, setFormScreenshot] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Drag state for screenshot areas
  const [dragOverRecord, setDragOverRecord] = useState<number | null>(null);
  const [dragOverForm, setDragOverForm] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const dialogContentRef = useRef<HTMLDivElement>(null);

  const createMutation = trpc.orderPayments.create.useMutation({
    onSuccess: () => {
      toast.success("支付记录已添加");
      utils.orderPayments.listByOrder.invalidate({ orderId });
      utils.orders.list.invalidate();
      setAddOpen(false);
      resetForm();
      onPaymentChanged?.();
    },
    onError: (e) => toast.error("添加失败: " + e.message),
  });

  const updateMutation = trpc.orderPayments.update.useMutation({
    onSuccess: () => {
      toast.success("支付记录已更新");
      utils.orderPayments.listByOrder.invalidate({ orderId });
      utils.orders.list.invalidate();
      setEditId(null);
      resetForm();
      onPaymentChanged?.();
    },
    onError: (e) => toast.error("更新失败: " + e.message),
  });

  const deleteMutation = trpc.orderPayments.delete.useMutation({
    onSuccess: () => {
      toast.success("支付记录已删除");
      utils.orderPayments.listByOrder.invalidate({ orderId });
      utils.orders.list.invalidate();
      setDeleteId(null);
      onPaymentChanged?.();
    },
    onError: (e) => toast.error("删除失败: " + e.message),
  });

  const uploadScreenshotMutation = trpc.orderPayments.uploadScreenshot.useMutation();

  const resetForm = () => {
    setFormType("全款");
    setFormAmount("");
    setFormDate(new Date().toISOString().split("T")[0]);
    setFormAccount("");
    setFormRemarks("");
    setFormScreenshot(null);
  };

  const openAddDialog = () => {
    resetForm();
    setAddOpen(true);
  };

  const openEditDialog = (payment: any) => {
    setFormType(payment.paymentType || "全款");
    setFormAmount(payment.amount || "0");
    setFormDate(payment.paymentDate ? new Date(payment.paymentDate).toISOString().split("T")[0] : "");
    setFormAccount(payment.receivingAccount || "");
    setFormRemarks(payment.remarks || "");
    setFormScreenshot(payment.screenshotUrl || null);
    setEditId(payment.id);
  };

  const handleSubmit = async () => {
    if (!formAmount || parseFloat(formAmount) <= 0) {
      toast.error("请输入有效的支付金额");
      return;
    }

    // If formScreenshot is a base64 data URL, upload to S3 first
    let screenshotUrl = formScreenshot || undefined;
    if (screenshotUrl && screenshotUrl.startsWith("data:")) {
      try {
        setUploading(true);
        const base64Data = screenshotUrl.split(",")[1];
        const mimeMatch = screenshotUrl.match(/data:([^;]+);/);
        const ext = mimeMatch?.[1]?.split("/")[1] || "jpg";
        // We need a temporary paymentId for upload; for new records, create first then upload
        if (editId) {
          const result = await uploadScreenshotMutation.mutateAsync({
            paymentId: editId,
            base64: base64Data,
            filename: `screenshot.${ext}`,
          });
          screenshotUrl = result.url;
        } else {
          // For new records: create without screenshot first, then upload
          const { id: newId } = await createMutation.mutateAsync({
            orderId,
            paymentType: formType,
            amount: formAmount,
            paymentDate: formDate || undefined,
            receivingAccount: formAccount || undefined,
            remarks: formRemarks || undefined,
          });
          // Now upload the screenshot to the newly created record
          await uploadScreenshotMutation.mutateAsync({
            paymentId: newId,
            base64: base64Data,
            filename: `screenshot.${ext}`,
          });
          utils.orderPayments.listByOrder.invalidate({ orderId });
          setUploading(false);
          return; // Already created and uploaded
        }
      } catch {
        toast.error("截图上传失败");
        setUploading(false);
        return;
      }
      setUploading(false);
    }

    if (editId) {
      updateMutation.mutate({
        id: editId,
        paymentType: formType,
        amount: formAmount,
        paymentDate: formDate || undefined,
        receivingAccount: formAccount || undefined,
        remarks: formRemarks || undefined,
        screenshotUrl: screenshotUrl && !screenshotUrl.startsWith("data:") ? screenshotUrl : undefined,
      });
    } else {
      createMutation.mutate({
        orderId,
        paymentType: formType,
        amount: formAmount,
        paymentDate: formDate || undefined,
        receivingAccount: formAccount || undefined,
        remarks: formRemarks || undefined,
      });
    }
  };

  // Core file upload handler
  const handleFileUpload = useCallback(async (file: File, paymentId?: number) => {
    if (file.size > 5 * 1024 * 1024) {
      toast.error("文件大小不能超过 5MB");
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("只支持上传图片文件");
      return;
    }
    setUploading(true);
    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.readAsDataURL(file);
      });
      const base64 = await base64Promise;

      if (paymentId) {
        await uploadScreenshotMutation.mutateAsync({
          paymentId,
          base64,
          filename: file.name,
        });
        utils.orderPayments.listByOrder.invalidate({ orderId });
        toast.success("截图上传成功");
      } else {
        setFormScreenshot(`data:${file.type};base64,${base64}`);
        toast.success("截图已选择，保存后将上传");
      }
    } catch {
      toast.error("截图上传失败");
    } finally {
      setUploading(false);
    }
  }, [orderId]);

  // Paste handler for the main dialog
  useEffect(() => {
    if (!open) return;
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith("image/")) {
          e.preventDefault();
          const file = items[i].getAsFile();
          if (file) {
            // If add/edit dialog is open, paste to form
            if (addOpen || editId !== null) {
              handleFileUpload(file);
            } else {
              // If no dialog open, show toast hint
              toast.info("请先打开添加/编辑支付记录后再粘贴截图");
            }
          }
          break;
        }
      }
    };
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [open, addOpen, editId, handleFileUpload]);

  // Drag & drop helpers for existing record screenshot area
  const handleRecordDragOver = (e: React.DragEvent, paymentId: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverRecord(paymentId);
  };
  const handleRecordDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverRecord(null);
  };
  const handleRecordDrop = (e: React.DragEvent, paymentId: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverRecord(null);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      handleFileUpload(file, paymentId);
    }
  };

  // Drag & drop helpers for form screenshot area
  const handleFormDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverForm(true);
  };
  const handleFormDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverForm(false);
  };
  const handleFormDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverForm(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      handleFileUpload(file);
    }
  };

  const totalPaid = payments?.reduce((sum, p) => sum + parseFloat(p.amount || "0"), 0) ?? 0;
  const totalOrder = parseFloat(totalAmountUsd || "0");
  const remaining = totalOrder - totalPaid;

  const getPaymentTypeBadgeColor = (type: string) => {
    switch (type) {
      case "定金": return "bg-amber-100 text-amber-800 border-amber-200";
      case "尾款": return "bg-blue-100 text-blue-800 border-blue-200";
      case "全款": return "bg-green-100 text-green-800 border-green-200";
      case "补款": return "bg-purple-100 text-purple-800 border-purple-200";
      default: return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" ref={dialogContentRef}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              支付记录 - {orderNumber}
            </DialogTitle>
          </DialogHeader>

          {/* Summary bar */}
          <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg text-sm">
            <div>
              <span className="text-muted-foreground">订单总额:</span>{" "}
              <span className="font-semibold">${totalOrder.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">已付:</span>{" "}
              <span className="font-semibold text-green-600">${totalPaid.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">待付:</span>{" "}
              <span className={`font-semibold ${remaining > 0 ? "text-red-600" : "text-green-600"}`}>
                ${remaining.toFixed(2)}
              </span>
            </div>
            <div className="ml-auto">
              <Badge variant="outline" className={remaining <= 0 && totalPaid > 0 ? "bg-green-100 text-green-800 border-green-200" : remaining > 0 && totalPaid > 0 ? "bg-amber-100 text-amber-800 border-amber-200" : "bg-gray-100 text-gray-800 border-gray-200"}>
                {totalPaid <= 0 ? "未付款" : remaining <= 0 ? "已付清" : "部分付款"}
              </Badge>
            </div>
          </div>

          {/* Payment records list */}
          <div className="space-y-2">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                加载中...
              </div>
            ) : payments && payments.length > 0 ? (
              payments.map((payment) => (
                <div key={payment.id} className="flex items-start gap-3 p-3 border rounded-lg hover:bg-gray-50 transition-colors">
                  {/* Screenshot thumbnail - supports drag & drop */}
                  <div
                    className={`flex-shrink-0 w-14 h-14 rounded border bg-gray-100 flex items-center justify-center overflow-hidden transition-all ${
                      dragOverRecord === payment.id ? "ring-2 ring-green-500 border-green-500 bg-green-50" : ""
                    }`}
                    onDragOver={(e) => handleRecordDragOver(e, payment.id)}
                    onDragLeave={handleRecordDragLeave}
                    onDrop={(e) => handleRecordDrop(e, payment.id)}
                  >
                    {uploading && dragOverRecord === payment.id ? (
                      <Loader2 className="h-4 w-4 animate-spin text-green-500" />
                    ) : payment.screenshotUrl ? (
                      <img
                        src={payment.screenshotUrl}
                        alt="支付截图"
                        className="w-full h-full object-cover cursor-pointer hover:opacity-80"
                        onClick={() => setPreviewImage(payment.screenshotUrl)}
                      />
                    ) : (
                      <label className="cursor-pointer w-full h-full flex flex-col items-center justify-center hover:bg-gray-200 transition-colors">
                        <Upload className="h-4 w-4 text-gray-400" />
                        <span className="text-[8px] text-gray-400 mt-0.5">拖拽/点击</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileUpload(file, payment.id);
                          }}
                        />
                      </label>
                    )}
                  </div>

                  {/* Payment info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className={`text-[10px] ${getPaymentTypeBadgeColor(payment.paymentType)}`}>
                        {payment.paymentType}
                      </Badge>
                      <span className="font-semibold text-sm">${parseFloat(payment.amount || "0").toFixed(2)}</span>
                      {payment.paymentDate && (
                        <span className="text-xs text-muted-foreground">
                          {new Date(payment.paymentDate).toLocaleDateString("zh-CN")}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {payment.receivingAccount && (
                        <span>收款: {payment.receivingAccount}</span>
                      )}
                      {payment.remarks && (
                        <span className="truncate max-w-[200px]">备注: {payment.remarks}</span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex-shrink-0 flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditDialog(payment)}>
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-700" onClick={() => setDeleteId(payment.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-muted-foreground">
                <DollarSign className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">暂无支付记录</p>
                <p className="text-xs mt-1">点击下方按钮添加第一条支付记录</p>
              </div>
            )}
          </div>

          {/* Add button */}
          <div className="flex justify-center pt-2">
            <Button variant="outline" size="sm" className="gap-1" onClick={openAddDialog}>
              <Plus className="h-4 w-4" />
              添加支付记录
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Payment Dialog */}
      <Dialog open={addOpen || editId !== null} onOpenChange={(v) => { if (!v) { setAddOpen(false); setEditId(null); resetForm(); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editId ? "编辑支付记录" : "添加支付记录"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">支付类型</Label>
                <Select value={formType} onValueChange={setFormType}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">支付金额 ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  placeholder="0.00"
                  className="h-9"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">支付日期</Label>
                <Input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">收款账号</Label>
                <Select value={formAccount} onValueChange={setFormAccount}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="选择收款账号" />
                  </SelectTrigger>
                  <SelectContent>
                    {RECEIVING_ACCOUNTS.map((a) => (
                      <SelectItem key={a} value={a}>{a}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">备注</Label>
              <Textarea
                value={formRemarks}
                onChange={(e) => setFormRemarks(e.target.value)}
                placeholder="可选备注信息"
                rows={2}
                className="text-sm"
              />
            </div>

            {/* Screenshot upload area - supports paste, drag, click */}
            <div className="space-y-1.5">
              <Label className="text-xs">支付截图</Label>
              {formScreenshot ? (
                <div className="relative w-20 h-20 border rounded overflow-hidden">
                  <img src={formScreenshot} alt="截图预览" className="w-full h-full object-cover" />
                  <button
                    className="absolute top-0 right-0 bg-red-500 text-white rounded-bl p-0.5"
                    onClick={() => setFormScreenshot(null)}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <div
                  className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-all ${
                    dragOverForm ? "border-green-500 bg-green-50" : "border-gray-300 hover:border-gray-400 hover:bg-gray-50"
                  }`}
                  onDragOver={handleFormDragOver}
                  onDragLeave={handleFormDragLeave}
                  onDrop={handleFormDrop}
                  onClick={() => fileRef.current?.click()}
                >
                  {uploading ? (
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-green-500" />
                  ) : (
                    <>
                      <Upload className="h-6 w-6 mx-auto text-gray-400 mb-1" />
                      <p className="text-xs text-gray-500">点击上传、拖拽图片、或 Ctrl+V 粘贴</p>
                    </>
                  )}
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(file);
                      if (fileRef.current) fileRef.current.value = "";
                    }}
                  />
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAddOpen(false); setEditId(null); resetForm(); }}>
              取消
            </Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
              {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              {editId ? "保存" : "添加"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={deleteId !== null} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>确定要删除这条支付记录吗？删除后订单付款金额将自动重新计算。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteId && deleteMutation.mutate({ id: deleteId })}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Image preview */}
      {previewImage && (
        <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
          <DialogContent className="max-w-3xl p-2">
            <img src={previewImage} alt="支付截图" className="w-full h-auto rounded" />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
