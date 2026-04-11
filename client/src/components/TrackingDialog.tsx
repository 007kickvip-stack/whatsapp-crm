import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  Package,
  CheckCircle2,
  Truck,
  MapPin,
  Clock,
  AlertCircle,
  ExternalLink,
  RefreshCw,
} from "lucide-react";

interface TrackingStep {
  time: string;
  context: string;
  ftime: string;
  location?: string;
}

interface TrackingResult {
  trackingNo: string;
  comCode: string;
  comName: string;
  status: string;
  state: string;
  message: string;
  ischeck?: string;
  data: TrackingStep[];
  redirectUrl?: string;
}

interface TrackingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trackingNo: string;
  type: "domestic" | "international";
}

// 物流状态映射
function getStateLabel(state: string): { label: string; color: string; icon: typeof Package } {
  switch (state) {
    case "0":
      return { label: "在途", color: "text-blue-600", icon: Truck };
    case "1":
      return { label: "揽收", color: "text-orange-600", icon: Package };
    case "2":
      return { label: "疑难", color: "text-red-600", icon: AlertCircle };
    case "3":
      return { label: "已签收", color: "text-green-600", icon: CheckCircle2 };
    case "4":
      return { label: "退签", color: "text-yellow-600", icon: AlertCircle };
    case "5":
      return { label: "派件", color: "text-purple-600", icon: MapPin };
    case "6":
      return { label: "退回", color: "text-red-600", icon: AlertCircle };
    default:
      return { label: "未知", color: "text-gray-600", icon: Clock };
  }
}

export default function TrackingDialog({
  open,
  onOpenChange,
  trackingNo,
  type,
}: TrackingDialogProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TrackingResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [iframeLoading, setIframeLoading] = useState(true);

  const fetchTracking = async () => {
    if (!trackingNo) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const resp = await fetch(`/api/tracking/domestic?no=${encodeURIComponent(trackingNo)}`, {
        credentials: "include",
      });
      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || `查询失败 (HTTP ${resp.status})`);
      }

      const data: TrackingResult = await resp.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || "查询失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && trackingNo) {
      if (type === "domestic") {
        fetchTracking();
      } else {
        // 国际单号使用 iframe，重置 iframe loading 状态
        setIframeLoading(true);
      }
    }
    if (!open) {
      setResult(null);
      setError(null);
      setIframeLoading(true);
    }
  }, [open, trackingNo, type]);

  const stateInfo = result ? getStateLabel(result.state) : null;
  const StateIcon = stateInfo?.icon || Package;

  // 国际单号 - 使用 iframe 嵌入 17track
  if (type === "international") {
    const trackUrl = `https://t.17track.net/zh-cn#nums=${encodeURIComponent(trackingNo)}&fc=191512`;

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl h-[80vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-4 pt-4 pb-2 shrink-0">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Package className="h-5 w-5 text-emerald-600" />
              国际物流查询
            </DialogTitle>
          </DialogHeader>

          {/* 单号信息 */}
          <div className="flex items-center justify-between bg-gray-50 mx-4 rounded-lg px-3 py-2 text-sm shrink-0">
            <div>
              <span className="text-gray-500">国际跟踪单号：</span>
              <span className="font-mono font-medium">{trackingNo}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.open(trackUrl, "_blank")}
              className="h-7 px-2 gap-1 text-xs"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              新窗口打开
            </Button>
          </div>

          {/* iframe 嵌入 17track */}
          <div className="flex-1 relative mx-4 mb-4 mt-2 rounded-lg overflow-hidden border">
            {iframeLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-white z-10 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
                <p className="text-sm text-gray-500">正在加载 17track 查询页面...</p>
              </div>
            )}
            <iframe
              src={trackUrl}
              className="w-full h-full border-0"
              onLoad={() => setIframeLoading(false)}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              referrerPolicy="no-referrer"
              title="17track 物流查询"
            />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // 国内单号 - 使用后端代理 API
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Package className="h-5 w-5 text-emerald-600" />
            国内物流查询
          </DialogTitle>
        </DialogHeader>

        {/* 单号信息 */}
        <div className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-sm">
          <div>
            <span className="text-gray-500">国内单号：</span>
            <span className="font-mono font-medium">{trackingNo}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchTracking}
            disabled={loading}
            className="h-7 px-2"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {/* 加载状态 */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            <p className="text-sm text-gray-500">正在查询物流信息...</p>
          </div>
        )}

        {/* 错误状态 */}
        {error && !loading && (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <AlertCircle className="h-10 w-10 text-red-400" />
            <p className="text-sm text-red-600">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchTracking}>
              重试
            </Button>
          </div>
        )}

        {/* 查询结果 */}
        {result && !loading && (
          <div className="flex-1 overflow-y-auto space-y-3 min-h-0">
            {/* 快递公司和状态 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{result.comName}</span>
              </div>
              {stateInfo && (
                <div className={`flex items-center gap-1 text-sm font-medium ${stateInfo.color}`}>
                  <StateIcon className="h-4 w-4" />
                  {stateInfo.label}
                </div>
              )}
            </div>

            {/* 物流轨迹时间线 */}
            {result.data && result.data.length > 0 ? (
              <div className="relative pl-6 space-y-0">
                {result.data.map((step, idx) => (
                  <div key={idx} className="relative pb-4 last:pb-0">
                    {/* 时间线竖线 */}
                    {idx < result.data.length - 1 && (
                      <div className="absolute left-[-16px] top-[10px] bottom-0 w-[2px] bg-gray-200" />
                    )}
                    {/* 时间线圆点 */}
                    <div
                      className={`absolute left-[-20px] top-[6px] w-[10px] h-[10px] rounded-full border-2 ${
                        idx === 0
                          ? "border-emerald-500 bg-emerald-500"
                          : "border-gray-300 bg-white"
                      }`}
                    />
                    {/* 内容 */}
                    <div>
                      <p
                        className={`text-sm leading-relaxed ${
                          idx === 0 ? "text-gray-900 font-medium" : "text-gray-600"
                        }`}
                      >
                        {step.context}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">{step.ftime || step.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 gap-2">
                <Package className="h-8 w-8 text-gray-300" />
                <p className="text-sm text-gray-400">暂无物流信息</p>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
