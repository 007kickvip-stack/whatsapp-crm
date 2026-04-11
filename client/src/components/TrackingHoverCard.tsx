import { useState, useCallback, useRef } from "react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  Loader2,
  Package,
  CheckCircle2,
  Truck,
  MapPin,
  AlertCircle,
  Clock,
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
  data: TrackingStep[];
}

// 物流状态映射
function getStateInfo(state: string): { label: string; color: string; icon: typeof Package } {
  switch (state) {
    case "0": return { label: "在途", color: "text-blue-600", icon: Truck };
    case "1": return { label: "揽收", color: "text-orange-600", icon: Package };
    case "2": return { label: "疑难", color: "text-red-600", icon: AlertCircle };
    case "3": return { label: "已签收", color: "text-emerald-600", icon: CheckCircle2 };
    case "4": return { label: "退签", color: "text-yellow-600", icon: AlertCircle };
    case "5": return { label: "派件", color: "text-purple-600", icon: MapPin };
    case "6": return { label: "退回", color: "text-red-600", icon: AlertCircle };
    default: return { label: "未知", color: "text-gray-600", icon: Clock };
  }
}

interface TrackingHoverCardProps {
  trackingNo: string;
  children: React.ReactNode;
}

export default function TrackingHoverCard({ trackingNo, children }: TrackingHoverCardProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TrackingResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef(false);
  const lastTrackingRef = useRef("");

  const fetchTracking = useCallback(async () => {
    if (!trackingNo) return;
    // 如果已经成功获取过相同单号的数据，不重复请求
    if (fetchedRef.current && lastTrackingRef.current === trackingNo && result) return;

    setLoading(true);
    setError(null);

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
      fetchedRef.current = true;
      lastTrackingRef.current = trackingNo;
    } catch (err: any) {
      setError(err.message || "查询失败");
    } finally {
      setLoading(false);
    }
  }, [trackingNo, result]);

  const handleRefresh = async (e: React.MouseEvent) => {
    e.stopPropagation();
    fetchedRef.current = false;
    setResult(null);
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(`/api/tracking/domestic?no=${encodeURIComponent(trackingNo)}`, {
        credentials: "include",
      });
      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || `查询失败`);
      }
      const data: TrackingResult = await resp.json();
      setResult(data);
      fetchedRef.current = true;
      lastTrackingRef.current = trackingNo;
    } catch (err: any) {
      setError(err.message || "查询失败");
    } finally {
      setLoading(false);
    }
  };

  const stateInfo = result ? getStateInfo(result.state) : null;
  const StateIcon = stateInfo?.icon || Package;
  // 只显示前5条轨迹
  const displaySteps = result?.data?.slice(0, 5) || [];
  const hasMore = (result?.data?.length || 0) > 5;

  return (
    <HoverCard openDelay={300} closeDelay={100} onOpenChange={(open) => { if (open) fetchTracking(); }}>
      <HoverCardTrigger asChild>
        {children}
      </HoverCardTrigger>
      <HoverCardContent
        side="bottom"
        align="start"
        className="w-[360px] p-0 shadow-lg border border-gray-200"
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b rounded-t-md">
          <div className="flex items-center gap-1.5">
            <Package className="h-3.5 w-3.5 text-emerald-600" />
            <span className="text-xs font-medium text-gray-700">物流详情</span>
          </div>
          <div className="flex items-center gap-2">
            {result && stateInfo && (
              <div className={`flex items-center gap-1 text-xs font-medium ${stateInfo.color}`}>
                <StateIcon className="h-3 w-3" />
                {stateInfo.label}
              </div>
            )}
            <button
              onClick={handleRefresh}
              className="p-0.5 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors"
              title="刷新"
            >
              <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* 单号信息 */}
        <div className="px-3 py-1.5 border-b bg-white">
          <div className="flex items-center gap-1 text-[10px]">
            <span className="text-gray-400">单号:</span>
            <span className="font-mono text-gray-600">{trackingNo}</span>
            {result?.comName && (
              <>
                <span className="text-gray-300 mx-0.5">·</span>
                <span className="text-gray-500">{result.comName}</span>
              </>
            )}
          </div>
        </div>

        {/* 内容区域 */}
        <div className="max-h-[260px] overflow-y-auto">
          {/* 加载中 */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-emerald-500" />
              <p className="text-xs text-gray-400">正在查询...</p>
            </div>
          )}

          {/* 错误 */}
          {error && !loading && (
            <div className="flex flex-col items-center justify-center py-6 gap-2">
              <AlertCircle className="h-5 w-5 text-red-400" />
              <p className="text-xs text-red-500">{error}</p>
            </div>
          )}

          {/* 物流轨迹 */}
          {result && !loading && displaySteps.length > 0 && (
            <div className="px-3 py-2 space-y-0">
              {displaySteps.map((step, idx) => (
                <div key={idx} className="relative pl-4 pb-3 last:pb-1">
                  {/* 竖线 */}
                  {idx < displaySteps.length - 1 && (
                    <div className="absolute left-[5px] top-[10px] bottom-0 w-[1.5px] bg-gray-200" />
                  )}
                  {/* 圆点 */}
                  <div
                    className={`absolute left-0 top-[5px] w-[12px] h-[12px] rounded-full border-2 ${
                      idx === 0
                        ? "border-emerald-500 bg-emerald-500 shadow-sm shadow-emerald-200"
                        : "border-gray-300 bg-white"
                    }`}
                  />
                  {/* 内容 */}
                  <div className="ml-1">
                    <p className={`text-[11px] leading-relaxed ${idx === 0 ? "text-gray-900 font-medium" : "text-gray-500"}`}>
                      {step.context}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{step.ftime || step.time}</p>
                  </div>
                </div>
              ))}
              {hasMore && (
                <div className="text-center py-1">
                  <span className="text-[10px] text-gray-400">还有 {(result.data?.length || 0) - 5} 条记录...</span>
                </div>
              )}
            </div>
          )}

          {/* 无数据 */}
          {result && !loading && displaySteps.length === 0 && (
            <div className="flex flex-col items-center justify-center py-6 gap-1.5">
              <Package className="h-5 w-5 text-gray-300" />
              <p className="text-xs text-gray-400">暂无物流信息</p>
            </div>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
