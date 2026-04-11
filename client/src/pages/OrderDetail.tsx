import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Plus,
  Edit,
  Trash2,
  Upload,
  Image,
  Package,
  DollarSign,
  TrendingUp,
  Truck,
} from "lucide-react";
import { toast } from "sonner";
import { useLocation, useParams } from "wouter";
import TrackingHoverCard from "@/components/TrackingHoverCard";

const PAYMENT_STATUSES = ["未付款", "待付款", "已付款", "部分付款"];

type ItemForm = {
  orderNumber: string;
  orderImageUrl: string;
  size: string;
  domesticTrackingNo: string;
  sizeRecommendation: string;
  contactInfo: string;
  internationalTrackingNo: string;
  originalOrderNo: string;
  shipDate: string;
  quantity: number;
  source: string;
  itemStatus: string;
  amountUsd: string;
  amountCny: string;
  sellingPrice: string;
  productCost: string;
  shippingCharged: string;
  shippingActual: string;
  paymentScreenshotUrl: string;
  remarks: string;
  paymentStatus: string;
};

const emptyItemForm: ItemForm = {
  orderNumber: "",
  orderImageUrl: "",
  size: "",
  domesticTrackingNo: "",
  sizeRecommendation: "",
  contactInfo: "",
  internationalTrackingNo: "",
  originalOrderNo: "",
  shipDate: "",
  quantity: 1,
  source: "",
  itemStatus: "",
  amountUsd: "",
  amountCny: "",
  sellingPrice: "",
  productCost: "",
  shippingCharged: "",
  shippingActual: "",
  paymentScreenshotUrl: "",
  remarks: "",
  paymentStatus: "",
};

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const orderId = parseInt(params.id || "0");
  const [, setLocation] = useLocation();
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [itemForm, setItemForm] = useState<ItemForm>(emptyItemForm);
  const [deleteItemId, setDeleteItemId] = useState<number | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const paymentFileInputRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();
  const { data: order, isLoading } = trpc.orders.getById.useQuery(
    { id: orderId },
    { enabled: orderId > 0 }
  );

  const uploadMutation = trpc.upload.image.useMutation();

  const createItemMutation = trpc.orderItems.create.useMutation({
    onSuccess: () => {
      toast.success("订单子项添加成功");
      utils.orders.getById.invalidate({ id: orderId });
      setItemDialogOpen(false);
      setItemForm(emptyItemForm);
    },
    onError: (err) => toast.error(err.message),
  });

  const updateItemMutation = trpc.orderItems.update.useMutation({
    onSuccess: () => {
      toast.success("订单子项更新成功");
      utils.orders.getById.invalidate({ id: orderId });
      setItemDialogOpen(false);
      setEditingItemId(null);
      setItemForm(emptyItemForm);
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteItemMutation = trpc.orderItems.delete.useMutation({
    onSuccess: () => {
      toast.success("订单子项已删除");
      utils.orders.getById.invalidate({ id: orderId });
      setDeleteItemId(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const handleFileUpload = async (
    file: File,
    field: "orderImageUrl" | "paymentScreenshotUrl"
  ) => {
    if (file.size > 5 * 1024 * 1024) {
      toast.error("文件大小不能超过 5MB");
      return;
    }
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1];
        const result = await uploadMutation.mutateAsync({
          base64,
          filename: file.name,
          contentType: file.type,
        });
        setItemForm((prev) => ({ ...prev, [field]: result.url }));
        toast.success("图片上传成功");
      };
      reader.readAsDataURL(file);
    } catch {
      toast.error("图片上传失败");
    }
  };

  const handleEditItem = (item: any) => {
    setEditingItemId(item.id);
    setItemForm({
      orderNumber: item.orderNumber || "",
      orderImageUrl: item.orderImageUrl || "",
      size: item.size || "",
      domesticTrackingNo: item.domesticTrackingNo || "",
      sizeRecommendation: item.sizeRecommendation || "",
      contactInfo: item.contactInfo || "",
      internationalTrackingNo: item.internationalTrackingNo || "",
      originalOrderNo: item.originalOrderNo || "",
      shipDate: item.shipDate || "",
      quantity: item.quantity || 1,
      source: item.source || "",
      itemStatus: item.itemStatus || "",
      amountUsd: item.amountUsd?.toString() || "",
      amountCny: item.amountCny?.toString() || "",
      sellingPrice: item.sellingPrice?.toString() || "",
      productCost: item.productCost?.toString() || "",
      shippingCharged: item.shippingCharged?.toString() || "",
      shippingActual: item.shippingActual?.toString() || "",
      paymentScreenshotUrl: item.paymentScreenshotUrl || "",
      remarks: item.remarks || "",
      paymentStatus: item.paymentStatus || "",
    });
    setItemDialogOpen(true);
  };

  const handleItemSubmit = () => {
    if (editingItemId) {
      updateItemMutation.mutate({
        id: editingItemId,
        orderId,
        ...itemForm,
      });
    } else {
      createItemMutation.mutate({
        orderId,
        ...itemForm,
      });
    }
  };

  // Auto-calculate preview
  const sellingPrice = parseFloat(itemForm.sellingPrice || "0");
  const productCost = parseFloat(itemForm.productCost || "0");
  const productProfit = sellingPrice - productCost;
  const productProfitRate = sellingPrice > 0 ? (productProfit / sellingPrice) * 100 : 0;
  const shippingCharged = parseFloat(itemForm.shippingCharged || "0");
  const shippingActual = parseFloat(itemForm.shippingActual || "0");
  const shippingProfit = shippingCharged - shippingActual;
  const amountCny = parseFloat(itemForm.amountCny || "0");
  const totalProfit = productProfit + shippingProfit;
  const profitRate = amountCny > 0 ? (totalProfit / amountCny) * 100 : 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        加载中...
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <Package className="h-10 w-10 mb-3 opacity-40" />
        <p>订单不存在</p>
        <Button variant="link" onClick={() => setLocation("/orders")} className="mt-2">
          返回订单列表
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/orders")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{order.orderNumber}</h1>
          <p className="text-muted-foreground mt-0.5">
            {order.customerWhatsapp} · {order.staffName || "未分配"}
          </p>
        </div>
        <span className={`inline-block px-2 py-0.5 rounded text-sm font-medium border ${
            order.orderStatus === "已报货，待发货" ? "bg-orange-100 text-orange-800 border-orange-300" :
            order.orderStatus === "待定" ? "bg-yellow-100 text-yellow-800 border-yellow-300" :
            order.orderStatus === "缺货" ? "bg-yellow-200 text-yellow-900 border-yellow-400" :
            order.orderStatus === "已发送qc视频，待确认" ? "bg-green-100 text-green-800 border-green-300" :
            order.orderStatus === "已发送qc视频，已确认" ? "bg-green-200 text-green-900 border-green-400" :
            order.orderStatus === "已发货" ? "bg-emerald-400 text-white border-emerald-500" :
            order.orderStatus === "单号已发给顾客" ? "bg-purple-100 text-purple-800 border-purple-300" :
            order.orderStatus === "顾客已收货" ? "bg-blue-100 text-blue-800 border-blue-300" :
            order.orderStatus === "已退款" ? "bg-red-100 text-red-800 border-red-300" :
            "bg-gray-50 text-gray-700 border-gray-200"
          }`}>{order.orderStatus || "已报货，待发货"}</span>
        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium border ${
          order.paymentStatus === "已付款" ? "bg-emerald-100 text-emerald-800 border-emerald-300" :
          order.paymentStatus === "待付款" ? "bg-amber-100 text-amber-800 border-amber-300" :
          order.paymentStatus === "部分付款" ? "bg-blue-100 text-blue-800 border-blue-300" :
          order.paymentStatus === "未付款" ? "bg-red-100 text-red-800 border-red-300" :
          "bg-gray-100 text-gray-700 border-gray-200"
        }`}>{order.paymentStatus || "未付款"}</span>
      </div>

      {/* Order Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <DollarSign className="h-3.5 w-3.5" />
              总金额 (USD)
            </div>
            <p className="text-2xl font-bold">${Number(order.totalAmountUsd).toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <DollarSign className="h-3.5 w-3.5" />
              总金额 (CNY)
            </div>
            <p className="text-2xl font-bold">¥{Number(order.totalAmountCny).toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <TrendingUp className="h-3.5 w-3.5" />
              总利润
            </div>
            <p className={`text-2xl font-bold ${Number(order.totalProfit) >= 0 ? "text-emerald-600" : "text-red-500"}`}>
              ¥{Number(order.totalProfit).toFixed(2)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Package className="h-3.5 w-3.5" />
              子项数量
            </div>
            <p className="text-2xl font-bold">{order.items?.length ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Order Info */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">订单信息</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground mb-1">订单日期</p>
              <p className="font-medium">{order.orderDate ? new Date(order.orderDate).toLocaleDateString() : "-"}</p>
            </div>
            <div>
              <p className="text-muted-foreground mb-1">客服</p>
              <p className="font-medium">{order.staffName || "-"}</p>
            </div>
            <div>
              <p className="text-muted-foreground mb-1">账号</p>
              <p className="font-medium">{order.account || "-"}</p>
            </div>
            <div>
              <p className="text-muted-foreground mb-1">客户属性</p>
              <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium border ${
                order.customerType === "新零售" ? "bg-yellow-200 text-yellow-900 border-yellow-300" :
                order.customerType === "零售复购" ? "bg-yellow-400 text-yellow-900 border-yellow-500" :
                order.customerType === "定金-新零售" ? "bg-pink-400 text-white border-pink-500" :
                order.customerType === "定金-零售复购" ? "bg-red-600 text-white border-red-700" :
                "bg-gray-100 text-gray-700 border-gray-200"
              }`}>{order.customerType || "-"}</span>
            </div>
            {order.remarks && (
              <div className="col-span-full">
                <p className="text-muted-foreground mb-1">备注</p>
                <p className="font-medium">{order.remarks}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Order Items */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">订单子项</CardTitle>
          <Button
            size="sm"
            onClick={() => {
              setEditingItemId(null);
              setItemForm({ ...emptyItemForm, orderNumber: order.orderNumber });
              setItemDialogOpen(true);
            }}
            className="gap-1"
          >
            <Plus className="h-3.5 w-3.5" />
            添加子项
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {order.items && order.items.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">编号</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">尺码</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">国内单号</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">国际单号</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">原订单号</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">货源</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">金额 $</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">金额 ¥</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">售价</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">成本</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">毛利润</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">总利润</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">图片</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item) => (
                    <tr key={item.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="py-3 px-4 font-medium">{item.orderNumber || "-"}</td>
                      <td className="py-3 px-4">{item.size || "-"}</td>
                      <td className="py-3 px-4 text-xs max-w-[160px]">
                        {item.domesticTrackingNo ? (
                          <div className="flex flex-col gap-1">
                            <span className="font-mono truncate">{item.domesticTrackingNo}</span>
                            <TrackingHoverCard trackingNo={item.domesticTrackingNo}>
                              {(item as any).logisticsStatus && (item as any).logisticsStatus !== "unknown" ? (
                                <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium border cursor-pointer hover:opacity-80 transition-opacity ${
                                  (item as any).logisticsStatus === "in_transit" ? "bg-blue-100 text-blue-800 border-blue-300" :
                                  (item as any).logisticsStatus === "collected" ? "bg-cyan-100 text-cyan-800 border-cyan-300" :
                                  (item as any).logisticsStatus === "delivering" ? "bg-indigo-100 text-indigo-800 border-indigo-300" :
                                  (item as any).logisticsStatus === "signed" ? "bg-emerald-100 text-emerald-800 border-emerald-300" :
                                  (item as any).logisticsStatus === "difficult" ? "bg-red-100 text-red-800 border-red-300" :
                                  (item as any).logisticsStatus === "returned" ? "bg-orange-100 text-orange-800 border-orange-300" :
                                  (item as any).logisticsStatus === "customs" ? "bg-purple-100 text-purple-800 border-purple-300" :
                                  (item as any).logisticsStatus === "refused" ? "bg-red-200 text-red-900 border-red-400" :
                                  "bg-gray-100 text-gray-600 border-gray-200"
                                }`}>
                                  {(item as any).logisticsStatusText || (item as any).logisticsStatus}
                                </span>
                              ) : (
                                <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium border cursor-pointer hover:opacity-80 transition-opacity bg-gray-50 text-gray-500 border-gray-200">
                                  查看物流
                                </span>
                              )}
                            </TrackingHoverCard>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs max-w-[120px] truncate">{item.internationalTrackingNo || "-"}</td>
                      <td className="py-3 px-4 text-xs max-w-[120px] truncate">{(item as any).originalOrderNo || "-"}</td>
                      <td className="py-3 px-4">{item.source || "-"}</td>
                      <td className="py-3 px-4 text-right font-mono">${Number(item.amountUsd).toFixed(2)}</td>
                      <td className="py-3 px-4 text-right font-mono">¥{Number(item.amountCny).toFixed(2)}</td>
                      <td className="py-3 px-4 text-right font-mono">¥{Number(item.sellingPrice).toFixed(2)}</td>
                      <td className="py-3 px-4 text-right font-mono">¥{Number(item.productCost).toFixed(2)}</td>
                      <td className="py-3 px-4 text-right font-mono">
                        <span className={Number(item.productProfit) >= 0 ? "text-emerald-600" : "text-red-500"}>
                          ¥{Number(item.productProfit).toFixed(2)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono">
                        <span className={Number(item.totalProfit) >= 0 ? "text-emerald-600" : "text-red-500"}>
                          ¥{Number(item.totalProfit).toFixed(2)}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-1">
                          {item.orderImageUrl && (
                            <button onClick={() => setImagePreview(item.orderImageUrl)} className="h-8 w-8 rounded border overflow-hidden hover:ring-2 ring-primary transition-all">
                              <img src={item.orderImageUrl} alt="" className="h-full w-full object-cover" />
                            </button>
                          )}
                          {item.paymentScreenshotUrl && (
                            <button onClick={() => setImagePreview(item.paymentScreenshotUrl)} className="h-8 w-8 rounded border overflow-hidden hover:ring-2 ring-primary transition-all">
                              <img src={item.paymentScreenshotUrl} alt="" className="h-full w-full object-cover" />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditItem(item)}>
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteItemId(item.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-12 text-center text-muted-foreground">
              <Package className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>暂无子项</p>
              <p className="text-xs mt-1">点击"添加子项"开始添加商品信息</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Item Create/Edit Dialog */}
      <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingItemId ? "编辑子项" : "添加子项"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {/* Basic Info */}
            <div className="text-sm font-medium text-muted-foreground">基本信息</div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">订单编号</Label>
                <Input value={itemForm.orderNumber} onChange={(e) => setItemForm({ ...itemForm, orderNumber: e.target.value })} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">尺码 (Size)</Label>
                <Input placeholder="xl, 43, EU95" value={itemForm.size} onChange={(e) => setItemForm({ ...itemForm, size: e.target.value })} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">件数</Label>
                <Input type="number" min={1} value={itemForm.quantity} onChange={(e) => setItemForm({ ...itemForm, quantity: parseInt(e.target.value) || 1 })} className="h-9" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">推荐码数</Label>
                <Input value={itemForm.sizeRecommendation} onChange={(e) => setItemForm({ ...itemForm, sizeRecommendation: e.target.value })} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">货源</Label>
                <Input value={itemForm.source} onChange={(e) => setItemForm({ ...itemForm, source: e.target.value })} className="h-9" />
              </div>
            </div>

            <Separator />

            {/* Logistics */}
            <div className="text-sm font-medium text-muted-foreground">物流信息</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">国内单号</Label>
                <Input value={itemForm.domesticTrackingNo} onChange={(e) => setItemForm({ ...itemForm, domesticTrackingNo: e.target.value })} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">国际跟踪单号</Label>
                <Input value={itemForm.internationalTrackingNo} onChange={(e) => setItemForm({ ...itemForm, internationalTrackingNo: e.target.value })} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">原订单号</Label>
                <Input value={itemForm.originalOrderNo} onChange={(e) => setItemForm({ ...itemForm, originalOrderNo: e.target.value })} className="h-9" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">发出日期</Label>
                <Input value={itemForm.shipDate} onChange={(e) => setItemForm({ ...itemForm, shipDate: e.target.value })} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">状态</Label>
                <Input value={itemForm.itemStatus} onChange={(e) => setItemForm({ ...itemForm, itemStatus: e.target.value })} className="h-9" />
              </div>
            </div>

            <Separator />

            {/* Contact Info */}
            <div className="text-sm font-medium text-muted-foreground">联系方式</div>
            <div className="space-y-1.5">
              <Label className="text-xs">收货信息</Label>
              <Textarea
                placeholder="姓名、电话、地址、省/州、城市、邮编、国家"
                value={itemForm.contactInfo}
                onChange={(e) => setItemForm({ ...itemForm, contactInfo: e.target.value })}
                rows={3}
              />
            </div>

            <Separator />

            {/* Financial */}
            <div className="text-sm font-medium text-muted-foreground">财务信息</div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">总金额 ($)</Label>
                <Input type="number" step="0.01" value={itemForm.amountUsd} onChange={(e) => setItemForm({ ...itemForm, amountUsd: e.target.value })} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">总金额 (¥)</Label>
                <Input type="number" step="0.01" value={itemForm.amountCny} onChange={(e) => setItemForm({ ...itemForm, amountCny: e.target.value })} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">售价 (¥)</Label>
                <Input type="number" step="0.01" value={itemForm.sellingPrice} onChange={(e) => setItemForm({ ...itemForm, sellingPrice: e.target.value })} className="h-9" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">产品成本 (¥)</Label>
                <Input type="number" step="0.01" value={itemForm.productCost} onChange={(e) => setItemForm({ ...itemForm, productCost: e.target.value })} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">收取运费 (¥)</Label>
                <Input type="number" step="0.01" value={itemForm.shippingCharged} onChange={(e) => setItemForm({ ...itemForm, shippingCharged: e.target.value })} className="h-9" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">实际运费 (¥)</Label>
              <Input type="number" step="0.01" value={itemForm.shippingActual} onChange={(e) => setItemForm({ ...itemForm, shippingActual: e.target.value })} className="h-9" />
            </div>

            {/* Auto-calculated preview */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
              <div className="font-medium text-muted-foreground mb-2">自动计算预览</div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <span className="text-muted-foreground">产品毛利润:</span>
                  <span className={`ml-2 font-mono font-medium ${productProfit >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                    ¥{productProfit.toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">毛利率:</span>
                  <span className="ml-2 font-mono font-medium">{productProfitRate.toFixed(1)}%</span>
                </div>
                <div>
                  <span className="text-muted-foreground">运费利润:</span>
                  <span className={`ml-2 font-mono font-medium ${shippingProfit >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                    ¥{shippingProfit.toFixed(2)}
                  </span>
                </div>
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-muted-foreground">总利润:</span>
                  <span className={`ml-2 font-mono font-bold ${totalProfit >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                    ¥{totalProfit.toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">利润率:</span>
                  <span className="ml-2 font-mono font-bold">{profitRate.toFixed(1)}%</span>
                </div>
              </div>
            </div>

            <Separator />

            {/* Images */}
            <div className="text-sm font-medium text-muted-foreground">图片附件</div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs">订单图片</Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={itemForm.orderImageUrl}
                    onChange={(e) => setItemForm({ ...itemForm, orderImageUrl: e.target.value })}
                    placeholder="图片 URL"
                    className="h-9 flex-1"
                  />
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(file, "orderImageUrl");
                    }}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadMutation.isPending}
                  >
                    <Upload className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {itemForm.orderImageUrl && (
                  <img src={itemForm.orderImageUrl} alt="" className="h-20 w-20 rounded border object-cover" />
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-xs">付款截图</Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={itemForm.paymentScreenshotUrl}
                    onChange={(e) => setItemForm({ ...itemForm, paymentScreenshotUrl: e.target.value })}
                    placeholder="图片 URL"
                    className="h-9 flex-1"
                  />
                  <input
                    ref={paymentFileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(file, "paymentScreenshotUrl");
                    }}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => paymentFileInputRef.current?.click()}
                    disabled={uploadMutation.isPending}
                  >
                    <Upload className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {itemForm.paymentScreenshotUrl && (
                  <img src={itemForm.paymentScreenshotUrl} alt="" className="h-20 w-20 rounded border object-cover" />
                )}
              </div>
            </div>

            <Separator />

            {/* Payment & Remarks */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">付款状态</Label>
                <Select value={itemForm.paymentStatus || "未付款"} onValueChange={(v) => setItemForm({ ...itemForm, paymentStatus: v })}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                          s === "已付款" ? "bg-emerald-100 text-emerald-800 border-emerald-300" :
                          s === "待付款" ? "bg-amber-100 text-amber-800 border-amber-300" :
                          s === "部分付款" ? "bg-blue-100 text-blue-800 border-blue-300" :
                          s === "未付款" ? "bg-red-100 text-red-800 border-red-300" :
                          "bg-gray-100 text-gray-700 border-gray-200"
                        }`}>{s}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">备注</Label>
                <Input value={itemForm.remarks} onChange={(e) => setItemForm({ ...itemForm, remarks: e.target.value })} className="h-9" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setItemDialogOpen(false)}>取消</Button>
            <Button onClick={handleItemSubmit} disabled={createItemMutation.isPending || updateItemMutation.isPending}>
              {createItemMutation.isPending || updateItemMutation.isPending ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Item Confirmation */}
      <AlertDialog open={deleteItemId !== null} onOpenChange={() => setDeleteItemId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>确定要删除此订单子项吗？此操作不可撤销。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteItemId && deleteItemMutation.mutate({ id: deleteItemId, orderId })}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Image Preview */}
      <Dialog open={imagePreview !== null} onOpenChange={() => setImagePreview(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>图片预览</DialogTitle>
          </DialogHeader>
          {imagePreview && (
            <img src={imagePreview} alt="Preview" className="w-full rounded-lg" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
