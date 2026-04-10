import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Plug, Search, RefreshCw, Truck, DollarSign, Plus, Loader2,
  CheckCircle, XCircle, Package, MapPin, Clock, ChevronDown, ChevronUp,
  ArrowDownToLine
} from "lucide-react";

export default function HualeiIntegration() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  // Tab state
  const [activeTab, setActiveTab] = useState<"query" | "sync" | "create" | "tracking">("query");

  // Query state
  const [queryDocCode, setQueryDocCode] = useState("");
  const [queryStatus, setQueryStatus] = useState("all");
  const [queryStartDate, setQueryStartDate] = useState("");
  const [queryEndDate, setQueryEndDate] = useState("");
  const [queryEnabled, setQueryEnabled] = useState(false);

  // Tracking state
  const [trackingNumber, setTrackingNumber] = useState("");
  const [trackingEnabled, setTrackingEnabled] = useState(false);

  // Sync state
  const [syncDocCodes, setSyncDocCodes] = useState("");
  const [syncItemIds, setSyncItemIds] = useState("");

  // Create order state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    productId: "",
    country: "",
    consigneeName: "",
    consigneeCompany: "",
    consigneeState: "",
    consigneeCity: "",
    consigneePostcode: "",
    consigneeAddress: "",
    consigneeStreetNo: "",
    consigneeTelephone: "",
    consigneeEmail: "",
    orderPiece: "1",
    weight: "0.5",
    length: "",
    width: "",
    height: "",
    cargoType: "P",
    dutyType: "DDU",
    customNote: "",
    customerInvoiceCode: "",
    declEnName: "",
    declCnName: "",
    declPieces: "1",
    declWeight: "0.5",
    declPrice: "10",
    declHsCode: "",
  });

  // Connection test
  const testConnection = trpc.hualei.testConnection.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success(data.message);
      } else {
        toast.error(data.message);
      }
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  // Shipping methods
  const shippingMethodsQuery = trpc.hualei.shippingMethods.useQuery(undefined, {
    enabled: createDialogOpen,
    staleTime: 5 * 60 * 1000,
  });

  // Query orders
  const queryInput = useMemo(() => ({
    status: queryStatus === "all" ? undefined : queryStatus,
    startDate: queryStartDate || undefined,
    endDate: queryEndDate || undefined,
    documentCode: queryDocCode || undefined,
  }), [queryStatus, queryStartDate, queryEndDate, queryDocCode]);

  const ordersQuery = trpc.hualei.queryOrders.useQuery(queryInput, {
    enabled: queryEnabled,
  });

  // Query tracking
  const trackingInput = useMemo(() => ({
    trackingNumber: trackingNumber || undefined,
  }), [trackingNumber]);

  const trackingQuery = trpc.hualei.queryTracking.useQuery(trackingInput, {
    enabled: trackingEnabled && !!trackingNumber,
  });

  // Sync fees mutation
  const syncFees = trpc.hualei.syncFees.useMutation({
    onSuccess: (data) => {
      const successCount = data.filter(r => r.success).length;
      toast.success(`成功同步 ${successCount}/${data.length} 条记录`);
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  // Create order mutation
  const createOrder = trpc.hualei.createOrder.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success(data.message + (data.documentCode ? ` 单号: ${data.documentCode}` : ""));
      } else {
        toast.error(data.message);
      }
      if (data.success) setCreateDialogOpen(false);
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  // Fee query state
  const [feeDocCodes, setFeeDocCodes] = useState("");
  const [feeEnabled, setFeeEnabled] = useState(false);

  const feeInput = useMemo(() => ({
    documentCodes: feeDocCodes.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean),
  }), [feeDocCodes]);

  const feesQuery = trpc.hualei.queryFees.useQuery(feeInput, {
    enabled: feeEnabled && feeInput.documentCodes.length > 0,
  });

  // Handlers
  const handleQueryOrders = () => {
    setQueryEnabled(true);
    ordersQuery.refetch();
  };

  const handleQueryTracking = () => {
    if (!trackingNumber) {
      toast.error("请输入跟踪单号");
      return;
    }
    setTrackingEnabled(true);
    trackingQuery.refetch();
  };

  const handleQueryFees = () => {
    if (!feeDocCodes.trim()) {
      toast.error("请输入原单号");
      return;
    }
    setFeeEnabled(true);
    feesQuery.refetch();
  };

  const handleSyncFees = () => {
    const docCodes = syncDocCodes.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean);
    const itemIds = syncItemIds.split(/[\n,;]+/).map(s => parseInt(s.trim())).filter(n => !isNaN(n));

    if (docCodes.length === 0 || itemIds.length === 0) {
      toast.error("请输入原单号和对应的子项ID");
      return;
    }
    if (docCodes.length !== itemIds.length) {
      toast.error("原单号和子项ID数量不匹配");
      return;
    }

    syncFees.mutate({ documentCodes: docCodes, orderItemIds: itemIds });
  };

  const handleCreateOrder = () => {
    if (!createForm.productId || !createForm.country || !createForm.consigneeName || !createForm.consigneePostcode || !createForm.consigneeAddress) {
      toast.error("请填写必填字段");
      return;
    }

    createOrder.mutate({
      ...createForm,
      declarations: createForm.declEnName ? [{
        enName: createForm.declEnName,
        cnName: createForm.declCnName || undefined,
        pieces: parseInt(createForm.declPieces) || 1,
        weight: parseFloat(createForm.declWeight) || 0.5,
        price: parseFloat(createForm.declPrice) || 10,
        hsCode: createForm.declHsCode || undefined,
      }] : undefined,
    });
  };

  const tabs = [
    { key: "query" as const, label: "查询订单", icon: Search },
    { key: "tracking" as const, label: "物流追踪", icon: Truck },
    { key: "sync" as const, label: "费用同步", icon: ArrowDownToLine },
    { key: "create" as const, label: "创建订单", icon: Plus },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">华磊系统对接</h1>
          <p className="text-muted-foreground mt-1">
            与华磊科技（云集国际物流）系统进行数据同步
          </p>
        </div>
        {isAdmin && (
          <Button
            variant="outline"
            onClick={() => testConnection.mutate()}
            disabled={testConnection.isPending}
          >
            {testConnection.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Plug className="w-4 h-4 mr-2" />
            )}
            测试连接
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b pb-2">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Query Orders Tab */}
      {activeTab === "query" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="w-5 h-5" />
              查询华磊订单
            </CardTitle>
            <CardDescription>从华磊系统查询订单信息，包括跟踪单号和状态</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label>原单号</Label>
                <Input
                  placeholder="输入原单号搜索"
                  value={queryDocCode}
                  onChange={e => setQueryDocCode(e.target.value)}
                />
              </div>
              <div>
                <Label>订单状态</Label>
                <Select value={queryStatus} onValueChange={setQueryStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部</SelectItem>
                    <SelectItem value="NW">草稿</SelectItem>
                    <SelectItem value="CF">已确认</SelectItem>
                    <SelectItem value="PT">已预报</SelectItem>
                    <SelectItem value="CI">已收货</SelectItem>
                    <SelectItem value="CO">已出货</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>开始日期</Label>
                <Input type="date" value={queryStartDate} onChange={e => setQueryStartDate(e.target.value)} />
              </div>
              <div>
                <Label>结束日期</Label>
                <Input type="date" value={queryEndDate} onChange={e => setQueryEndDate(e.target.value)} />
              </div>
            </div>
            <Button onClick={handleQueryOrders} disabled={ordersQuery.isFetching}>
              {ordersQuery.isFetching ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
              查询
            </Button>

            {/* Results */}
            {ordersQuery.data && (
              <div className="mt-4">
                <p className="text-sm text-muted-foreground mb-2">
                  查询到 {ordersQuery.data.length} 条记录
                </p>
                {ordersQuery.data.length > 0 ? (
                  <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/50">
                          <th className="text-left p-3 font-medium">创建时间</th>
                          <th className="text-left p-3 font-medium">原单号</th>
                          <th className="text-left p-3 font-medium">转单号</th>
                          <th className="text-left p-3 font-medium">运输方式</th>
                          <th className="text-left p-3 font-medium">收件信息</th>
                          <th className="text-left p-3 font-medium">备注</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ordersQuery.data.map((order, idx) => (
                          <tr key={idx} className="border-t hover:bg-muted/30">
                            <td className="p-3 whitespace-nowrap">{order.createTime}</td>
                            <td className="p-3 font-mono text-xs">{order.documentCode}</td>
                            <td className="p-3 font-mono text-xs text-blue-600">{order.trackingNumber || "-"}</td>
                            <td className="p-3">{order.shippingMethod}</td>
                            <td className="p-3 max-w-[200px] truncate">{order.recipientInfo}</td>
                            <td className="p-3 max-w-[150px] truncate">{order.remark}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">暂无数据</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tracking Tab */}
      {activeTab === "tracking" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="w-5 h-5" />
              物流追踪
            </CardTitle>
            <CardDescription>输入转单号查询包裹物流轨迹</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <Input
                placeholder="输入转单号"
                value={trackingNumber}
                onChange={e => setTrackingNumber(e.target.value)}
                className="max-w-md"
              />
              <Button onClick={handleQueryTracking} disabled={trackingQuery.isFetching}>
                {trackingQuery.isFetching ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
                查询
              </Button>
            </div>

            {trackingEnabled && trackingQuery.data && (
              <div className="mt-4">
                {trackingQuery.data.length > 0 ? (
                  <div className="space-y-0 relative pl-6">
                    <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-green-200" />
                    {trackingQuery.data.map((event, idx) => (
                      <div key={idx} className="relative flex gap-4 pb-4">
                        <div className={`absolute left-[-17px] top-1 w-3 h-3 rounded-full border-2 ${
                          idx === 0 ? "bg-green-500 border-green-500" : "bg-white border-green-300"
                        }`} />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 text-sm">
                            <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="text-muted-foreground">{event.time}</span>
                            {event.location && (
                              <>
                                <MapPin className="w-3.5 h-3.5 text-muted-foreground ml-2" />
                                <span className="text-muted-foreground">{event.location}</span>
                              </>
                            )}
                          </div>
                          <p className="text-sm mt-1">{event.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>暂无物流轨迹信息</p>
                    <p className="text-xs mt-1">可能包裹尚未揽收或单号有误</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Sync Tab */}
      {activeTab === "sync" && (
        <div className="space-y-6">
          {/* Fee Query */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                查询费用
              </CardTitle>
              <CardDescription>输入原单号查询华磊系统中的运费明细</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>原单号（每行一个，或用逗号分隔）</Label>
                <Textarea
                  placeholder={"HPLONG-001\nHPLONG-002\nHPLONG-003"}
                  value={feeDocCodes}
                  onChange={e => setFeeDocCodes(e.target.value)}
                  rows={3}
                />
              </div>
              <Button onClick={handleQueryFees} disabled={feesQuery.isFetching}>
                {feesQuery.isFetching ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
                查询费用
              </Button>

              {feesQuery.data && feesQuery.data.length > 0 && (
                <div className="overflow-x-auto rounded-lg border mt-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50">
                        <th className="text-left p-3 font-medium">原单号</th>
                        <th className="text-left p-3 font-medium">转单号</th>
                        <th className="text-left p-3 font-medium">运输方式</th>
                        <th className="text-right p-3 font-medium">运费</th>
                        <th className="text-right p-3 font-medium">燃油费</th>
                        <th className="text-right p-3 font-medium">杂费</th>
                        <th className="text-right p-3 font-medium">总费用</th>
                        <th className="text-left p-3 font-medium">是否支付</th>
                      </tr>
                    </thead>
                    <tbody>
                      {feesQuery.data.map((fee, idx) => (
                        <tr key={idx} className="border-t hover:bg-muted/30">
                          <td className="p-3 font-mono text-xs">{fee.documentCode}</td>
                          <td className="p-3 font-mono text-xs text-blue-600">{fee.trackingNumber}</td>
                          <td className="p-3">{fee.shippingMethod}</td>
                          <td className="p-3 text-right">¥{fee.shippingFee.toFixed(2)}</td>
                          <td className="p-3 text-right">¥{fee.fuelFee.toFixed(2)}</td>
                          <td className="p-3 text-right">¥{fee.miscFee.toFixed(2)}</td>
                          <td className="p-3 text-right font-semibold text-orange-600">¥{fee.total.toFixed(2)}</td>
                          <td className="p-3">
                            {fee.isPaid === "是" ? (
                              <span className="text-green-600 flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" />已支付</span>
                            ) : (
                              <span className="text-red-500 flex items-center gap-1"><XCircle className="w-3.5 h-3.5" />未支付</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Sync to CRM */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ArrowDownToLine className="w-5 h-5" />
                同步到CRM
              </CardTitle>
              <CardDescription>将华磊系统的跟踪单号和费用同步到CRM订单子项</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>原单号（每行一个）</Label>
                  <Textarea
                    placeholder={"HPLONG-001\nHPLONG-002"}
                    value={syncDocCodes}
                    onChange={e => setSyncDocCodes(e.target.value)}
                    rows={4}
                  />
                </div>
                <div>
                  <Label>对应的CRM子项ID（每行一个，顺序需对应）</Label>
                  <Textarea
                    placeholder={"101\n102"}
                    value={syncItemIds}
                    onChange={e => setSyncItemIds(e.target.value)}
                    rows={4}
                  />
                </div>
              </div>
              <Button onClick={handleSyncFees} disabled={syncFees.isPending}>
                {syncFees.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                同步费用和跟踪单号
              </Button>

              {syncFees.data && (
                <div className="mt-4 space-y-2">
                  {syncFees.data.map((result, idx) => (
                    <div key={idx} className={`flex items-center gap-2 text-sm p-2 rounded ${result.success ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                      {result.success ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                      <span>{result.documentCode}:</span>
                      {result.success ? (
                        <span>转单号 {result.trackingNumber}, 费用 ¥{result.totalFee?.toFixed(2)}</span>
                      ) : (
                        <span>未找到费用数据</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Create Order Tab */}
      {activeTab === "create" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              创建华磊订单
            </CardTitle>
            <CardDescription>在华磊系统中创建新的物流订单</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              新建物流订单
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Create Order Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>创建华磊物流订单</DialogTitle>
            <DialogDescription>填写收件人信息和包裹信息，在华磊系统中创建物流订单</DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* 运输方式 */}
            <div>
              <Label className="text-base font-semibold">运输方式 *</Label>
              <Select value={createForm.productId} onValueChange={v => setCreateForm(f => ({ ...f, productId: v }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="选择运输方式" />
                </SelectTrigger>
                <SelectContent>
                  {shippingMethodsQuery.data?.map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 收件人信息 */}
            <div>
              <h3 className="text-base font-semibold mb-3">收件人信息</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>国家代码 *</Label>
                  <Input placeholder="如 US, GB, DE" value={createForm.country} onChange={e => setCreateForm(f => ({ ...f, country: e.target.value }))} />
                </div>
                <div>
                  <Label>收件人姓名 *</Label>
                  <Input value={createForm.consigneeName} onChange={e => setCreateForm(f => ({ ...f, consigneeName: e.target.value }))} />
                </div>
                <div>
                  <Label>公司</Label>
                  <Input value={createForm.consigneeCompany} onChange={e => setCreateForm(f => ({ ...f, consigneeCompany: e.target.value }))} />
                </div>
                <div>
                  <Label>州/省</Label>
                  <Input value={createForm.consigneeState} onChange={e => setCreateForm(f => ({ ...f, consigneeState: e.target.value }))} />
                </div>
                <div>
                  <Label>城市</Label>
                  <Input value={createForm.consigneeCity} onChange={e => setCreateForm(f => ({ ...f, consigneeCity: e.target.value }))} />
                </div>
                <div>
                  <Label>邮编 *</Label>
                  <Input value={createForm.consigneePostcode} onChange={e => setCreateForm(f => ({ ...f, consigneePostcode: e.target.value }))} />
                </div>
                <div className="md:col-span-2">
                  <Label>地址 *</Label>
                  <Input value={createForm.consigneeAddress} onChange={e => setCreateForm(f => ({ ...f, consigneeAddress: e.target.value }))} />
                </div>
                <div>
                  <Label>门牌号</Label>
                  <Input value={createForm.consigneeStreetNo} onChange={e => setCreateForm(f => ({ ...f, consigneeStreetNo: e.target.value }))} />
                </div>
                <div>
                  <Label>电话</Label>
                  <Input value={createForm.consigneeTelephone} onChange={e => setCreateForm(f => ({ ...f, consigneeTelephone: e.target.value }))} />
                </div>
                <div>
                  <Label>邮箱</Label>
                  <Input value={createForm.consigneeEmail} onChange={e => setCreateForm(f => ({ ...f, consigneeEmail: e.target.value }))} />
                </div>
              </div>
            </div>

            {/* 包裹信息 */}
            <div>
              <h3 className="text-base font-semibold mb-3">包裹信息</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <Label>件数</Label>
                  <Input value={createForm.orderPiece} onChange={e => setCreateForm(f => ({ ...f, orderPiece: e.target.value }))} />
                </div>
                <div>
                  <Label>重量(kg)</Label>
                  <Input value={createForm.weight} onChange={e => setCreateForm(f => ({ ...f, weight: e.target.value }))} />
                </div>
                <div>
                  <Label>长(cm)</Label>
                  <Input value={createForm.length} onChange={e => setCreateForm(f => ({ ...f, length: e.target.value }))} />
                </div>
                <div>
                  <Label>宽(cm)</Label>
                  <Input value={createForm.width} onChange={e => setCreateForm(f => ({ ...f, width: e.target.value }))} />
                </div>
                <div>
                  <Label>高(cm)</Label>
                  <Input value={createForm.height} onChange={e => setCreateForm(f => ({ ...f, height: e.target.value }))} />
                </div>
                <div>
                  <Label>客户订单号</Label>
                  <Input placeholder="CRM关联单号" value={createForm.customerInvoiceCode} onChange={e => setCreateForm(f => ({ ...f, customerInvoiceCode: e.target.value }))} />
                </div>
                <div>
                  <Label>关税类型</Label>
                  <Select value={createForm.dutyType} onValueChange={v => setCreateForm(f => ({ ...f, dutyType: v }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DDU">DDU</SelectItem>
                      <SelectItem value="DDP">DDP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* 申报信息 */}
            <div>
              <h3 className="text-base font-semibold mb-3">申报信息</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <Label>英文品名</Label>
                  <Input placeholder="如 Shoes" value={createForm.declEnName} onChange={e => setCreateForm(f => ({ ...f, declEnName: e.target.value }))} />
                </div>
                <div>
                  <Label>中文品名</Label>
                  <Input placeholder="如 鞋子" value={createForm.declCnName} onChange={e => setCreateForm(f => ({ ...f, declCnName: e.target.value }))} />
                </div>
                <div>
                  <Label>数量</Label>
                  <Input value={createForm.declPieces} onChange={e => setCreateForm(f => ({ ...f, declPieces: e.target.value }))} />
                </div>
                <div>
                  <Label>重量(kg)</Label>
                  <Input value={createForm.declWeight} onChange={e => setCreateForm(f => ({ ...f, declWeight: e.target.value }))} />
                </div>
                <div>
                  <Label>单价(USD)</Label>
                  <Input value={createForm.declPrice} onChange={e => setCreateForm(f => ({ ...f, declPrice: e.target.value }))} />
                </div>
                <div>
                  <Label>海关编码</Label>
                  <Input value={createForm.declHsCode} onChange={e => setCreateForm(f => ({ ...f, declHsCode: e.target.value }))} />
                </div>
              </div>
            </div>

            {/* 备注 */}
            <div>
              <Label>备注</Label>
              <Textarea
                placeholder="订单备注..."
                value={createForm.customNote}
                onChange={e => setCreateForm(f => ({ ...f, customNote: e.target.value }))}
                rows={2}
              />
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>取消</Button>
              <Button onClick={handleCreateOrder} disabled={createOrder.isPending}>
                {createOrder.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                创建订单
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
