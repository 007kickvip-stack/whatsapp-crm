import type { Express, Request, Response } from "express";
import { sdk } from "./_core/sdk";
import { ENV } from "./_core/env";
import crypto from "crypto";
import {
  findOrderItemByDomesticTrackingNo,
  updateLogisticsStatus,
  markLogisticsSubscribed,
  findUnsubscribedItemsWithDomesticTracking,
} from "./db";

/**
 * 物流查询代理 + 快递100订阅推送
 * 
 * 快递100实时查询接口: https://poll.kuaidi100.com/poll/query.do
 * 快递100订阅推送接口: https://poll.kuaidi100.com/poll
 * 签名: MD5(param + key + customer) 转32位大写
 */

interface TrackingData {
  time: string;
  context: string;
  ftime: string;
  location?: string;
  areaCode?: string;
  areaName?: string;
  status?: string;
  statusCode?: string;
}

interface QueryResult {
  nu: string;
  com: string;
  status: string;
  state: string;
  message: string;
  data: TrackingData[];
  condition?: string;
  ischeck?: string;
  comName?: string;
}

interface AutoComResult {
  comCode: string;
  num: string;
  auto: Array<{
    comCode: string;
    id: string;
    noCount: number;
    noPre: string;
  }>;
}

// 快递公司代号到中文名映射
const COM_CODE_MAP: Record<string, string> = {
  shunfeng: "顺丰速运", yuantong: "圆通速递", zhongtong: "中通快递",
  shentong: "申通快递", yunda: "韵达快递", ems: "EMS",
  tiantian: "天天快递", huitongkuaidi: "百世快递", debangwuliu: "德邦物流",
  debangkuaidi: "德邦快递", jd: "京东物流", zhaijisong: "宅急送",
  youzhengguonei: "中国邮政", youzhengguoji: "国际邮政", guotongkuaidi: "国通快递",
  zhongyouwuliu: "中邮物流", annengwuliu: "安能物流", jiayiwuliu: "佳怡物流",
  youshuwuliu: "优速快递", suning: "苏宁物流", danniao: "丹鸟",
  fengwang: "丰网速运", jitu: "极兔速递", zhonghuanex: "中环快递",
  cainiao: "菜鸟", ups: "UPS", fedex: "FedEx", dhl: "DHL",
  usps: "USPS", tnt: "TNT", dpd: "DPD", aramex: "Aramex",
  yanwen: "燕文物流", ydgj: "韵达国际", chuanzhiyuan: "传志远",
  disifang: "递四方", huanqiu: "环球速运",
};

function getComName(comCode: string): string {
  return COM_CODE_MAP[comCode] || comCode;
}

/**
 * 快递100 state 码 → 系统物流状态
 */
const STATE_MAP: Record<string, { status: string; text: string }> = {
  "0": { status: "in_transit", text: "在途" },
  "1": { status: "collected", text: "揽收" },
  "2": { status: "difficult", text: "疑难" },
  "3": { status: "signed", text: "签收" },
  "4": { status: "returned", text: "退签" },
  "5": { status: "delivering", text: "派件" },
  "6": { status: "returned", text: "退回" },
  "7": { status: "in_transit", text: "转投" },
  "8": { status: "customs", text: "清关" },
  "10": { status: "in_transit", text: "待清关" },
  "11": { status: "in_transit", text: "待取件" },
  "12": { status: "in_transit", text: "签收待取" },
  "14": { status: "refused", text: "拒签" },
};

function mapState(state: string): { status: string; text: string } {
  return STATE_MAP[state] || { status: "unknown", text: "未知" };
}

/**
 * 快递100正式API签名
 */
function makeSign(param: string): string {
  const str = param + ENV.kuaidi100Key + ENV.kuaidi100Customer;
  return crypto.createHash("md5").update(str, "utf8").digest("hex").toUpperCase();
}

/**
 * 调用快递100实时查询接口
 */
async function queryKuaidi100(com: string, num: string, phone?: string): Promise<QueryResult> {
  const param = JSON.stringify({
    com, num,
    ...(phone ? { phone } : {}),
  });
  const sign = makeSign(param);
  const body = new URLSearchParams({ customer: ENV.kuaidi100Customer, sign, param });
  const resp = await fetch("https://poll.kuaidi100.com/poll/query.do", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!resp.ok) throw new Error(`快递100 API 返回 HTTP ${resp.status}`);
  return (await resp.json()) as QueryResult;
}

/**
 * 自动识别快递公司
 */
async function autoDetectCompany(trackingNo: string): Promise<string | null> {
  try {
    const autoUrl = `https://www.kuaidi100.com/autonumber/autoComNum?text=${encodeURIComponent(trackingNo)}`;
    const autoResp = await fetch(autoUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Referer": "https://www.kuaidi100.com/",
      },
    });
    if (!autoResp.ok) return null;
    const autoData = (await autoResp.json()) as AutoComResult;
    if (autoData.auto && autoData.auto.length > 0) return autoData.auto[0].comCode;
    return null;
  } catch { return null; }
}

/**
 * 订阅快递100推送
 */
async function subscribeKuaidi100(com: string, num: string, callbackUrl: string, salt: string): Promise<{ result: boolean; returnCode: string; message: string }> {
  const param = JSON.stringify({
    company: com,
    number: num,
    key: ENV.kuaidi100Key,
    parameters: {
      callbackurl: callbackUrl,
      salt,
      resultv2: "4",
    },
  });

  const resp = await fetch("https://poll.kuaidi100.com/poll", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ schema: "json", param }).toString(),
  });

  if (!resp.ok) throw new Error(`快递100订阅 API 返回 HTTP ${resp.status}`);
  return (await resp.json()) as { result: boolean; returnCode: string; message: string };
}

/**
 * 为单个国内单号订阅快递100推送
 */
async function subscribeTrackingNo(itemId: number, trackingNo: string, callbackUrl: string): Promise<boolean> {
  try {
    const comCode = await autoDetectCompany(trackingNo);
    if (!comCode) {
      console.warn(`[Kuaidi100 Subscribe] 无法识别单号 ${trackingNo} 的快递公司`);
      return false;
    }

    const salt = crypto.randomBytes(8).toString("hex");
    const result = await subscribeKuaidi100(comCode, trackingNo, callbackUrl, salt);

    if (result.result || result.returnCode === "200" || result.returnCode === "501") {
      // 501 = 重复订阅，也算成功
      await markLogisticsSubscribed(itemId);
      console.log(`[Kuaidi100 Subscribe] 订阅成功: ${trackingNo} (${comCode}), code: ${result.returnCode}`);
      return true;
    } else {
      console.warn(`[Kuaidi100 Subscribe] 订阅失败: ${trackingNo}, code: ${result.returnCode}, msg: ${result.message}`);
      return false;
    }
  } catch (err: any) {
    console.error(`[Kuaidi100 Subscribe] 订阅异常: ${trackingNo}`, err.message);
    return false;
  }
}

/**
 * 获取回调URL（基于请求的origin或已知域名）
 */
function getCallbackUrl(req?: Request): string {
  // 优先使用请求的 origin
  if (req) {
    const proto = req.headers["x-forwarded-proto"] || req.protocol || "https";
    const host = req.headers["x-forwarded-host"] || req.headers.host;
    if (host) return `${proto}://${host}/api/kuaidi100/callback`;
  }
  // 回退到已知域名
  return "https://whatsappcrm-hh98jc4u.manus.space/api/kuaidi100/callback";
}

export function registerTrackingProxyRoute(app: Express) {
  // ==================== 国内物流查询代理 ====================
  app.get("/api/tracking/domestic", async (req: Request, res: Response) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user) return res.status(401).json({ error: "未登录" });

      const trackingNo = req.query.no as string;
      if (!trackingNo) return res.status(400).json({ error: "缺少单号参数" });

      const comCode = await autoDetectCompany(trackingNo);
      if (!comCode) return res.status(404).json({ error: "无法识别该单号对应的快递公司" });

      const queryData = await queryKuaidi100(comCode, trackingNo);

      // 同时更新数据库中的物流状态
      if (queryData.state) {
        try {
          const item = await findOrderItemByDomesticTrackingNo(trackingNo);
          if (item) {
            const mapped = mapState(queryData.state);
            await updateLogisticsStatus(item.id, {
              logisticsStatus: mapped.status,
              logisticsStatusText: mapped.text,
              logisticsLastUpdate: new Date(),
            });
          }
        } catch (e) {
          console.warn("[Tracking] 更新物流状态失败:", e);
        }
      }

      return res.json({
        trackingNo, comCode,
        comName: getComName(comCode),
        status: queryData.status, state: queryData.state,
        message: queryData.message, ischeck: queryData.ischeck,
        data: queryData.data || [],
      });
    } catch (err: any) {
      console.error("Tracking proxy error:", err);
      return res.status(500).json({ error: "查询失败", detail: err.message });
    }
  });

  // ==================== 国际物流查询 ====================
  app.get("/api/tracking/international", async (req: Request, res: Response) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user) return res.status(401).json({ error: "未登录" });

      const trackingNo = req.query.no as string;
      if (!trackingNo) return res.status(400).json({ error: "缺少单号参数" });

      const comCode = await autoDetectCompany(trackingNo);
      if (comCode) {
        try {
          const queryData = await queryKuaidi100(comCode, trackingNo);
          if (queryData.status === "200" && queryData.data && queryData.data.length > 0) {
            return res.json({
              trackingNo, comCode,
              comName: getComName(comCode),
              status: queryData.status, state: queryData.state,
              message: queryData.message, ischeck: queryData.ischeck,
              data: queryData.data || [],
            });
          }
        } catch (e) {
          console.warn("Kuaidi100 API query failed for international:", e);
        }
      }

      return res.json({
        trackingNo, comCode: "unknown", comName: "未知",
        status: "redirect", state: "-1",
        message: "无法通过快递100查询，请使用17track查询",
        data: [],
        redirectUrl: `https://t.17track.net/zh-cn#nums=${encodeURIComponent(trackingNo)}&fc=191512`,
      });
    } catch (err: any) {
      console.error("International tracking proxy error:", err);
      return res.status(500).json({ error: "查询失败", detail: err.message });
    }
  });

  // ==================== 快递100回调接口（接收推送） ====================
  app.post("/api/kuaidi100/callback", async (req: Request, res: Response) => {
    try {
      // 快递100推送的数据格式: param=JSON字符串&sign=签名
      const paramStr = req.body?.param;
      if (!paramStr) {
        return res.json({ result: true, returnCode: "200", message: "成功" });
      }

      let pushData: any;
      try {
        pushData = typeof paramStr === "string" ? JSON.parse(paramStr) : paramStr;
      } catch {
        console.error("[Kuaidi100 Callback] 解析 param 失败:", paramStr);
        return res.json({ result: true, returnCode: "200", message: "成功" });
      }

      const lastResult = pushData.lastResult;
      if (!lastResult || !lastResult.nu) {
        console.warn("[Kuaidi100 Callback] 缺少 lastResult 或 nu");
        return res.json({ result: true, returnCode: "200", message: "成功" });
      }

      const trackingNo = lastResult.nu;
      const state = lastResult.state || "0";
      const mapped = mapState(state);

      console.log(`[Kuaidi100 Callback] 收到推送: ${trackingNo}, state=${state}, status=${mapped.status}(${mapped.text})`);

      // 查找对应的订单子项并更新物流状态
      const item = await findOrderItemByDomesticTrackingNo(trackingNo);
      if (item) {
        await updateLogisticsStatus(item.id, {
          logisticsStatus: mapped.status,
          logisticsStatusText: mapped.text,
          logisticsLastUpdate: new Date(),
        });
        console.log(`[Kuaidi100 Callback] 已更新 item ${item.id} 物流状态: ${mapped.status}(${mapped.text})`);
      } else {
        console.warn(`[Kuaidi100 Callback] 未找到单号 ${trackingNo} 对应的订单子项`);
      }

      // 必须返回此格式，否则快递100会重复推送
      return res.json({ result: true, returnCode: "200", message: "成功" });
    } catch (err: any) {
      console.error("[Kuaidi100 Callback] 处理异常:", err);
      // 即使出错也返回成功，避免快递100重复推送
      return res.json({ result: true, returnCode: "200", message: "成功" });
    }
  });

  // ==================== 手动触发订阅接口 ====================
  app.post("/api/tracking/subscribe", async (req: Request, res: Response) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user) return res.status(401).json({ error: "未登录" });

      const { trackingNo, itemId } = req.body;
      if (!trackingNo || !itemId) {
        return res.status(400).json({ error: "缺少参数" });
      }

      const callbackUrl = getCallbackUrl(req);
      const success = await subscribeTrackingNo(itemId, trackingNo, callbackUrl);

      return res.json({ success, callbackUrl });
    } catch (err: any) {
      console.error("[Subscribe] 订阅异常:", err);
      return res.status(500).json({ error: "订阅失败", detail: err.message });
    }
  });

  // ==================== 批量订阅未订阅的单号 ====================
  app.post("/api/tracking/subscribe-all", async (req: Request, res: Response) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user) return res.status(401).json({ error: "未登录" });

      const callbackUrl = getCallbackUrl(req);
      const items = await findUnsubscribedItemsWithDomesticTracking();

      let successCount = 0;
      let failCount = 0;

      for (const item of items) {
        if (!item.domesticTrackingNo) continue;
        // 限速：每次订阅间隔 500ms，避免被快递100限流
        await new Promise(resolve => setTimeout(resolve, 500));
        const ok = await subscribeTrackingNo(item.id, item.domesticTrackingNo, callbackUrl);
        if (ok) successCount++;
        else failCount++;
      }

      return res.json({
        total: items.length,
        success: successCount,
        failed: failCount,
        callbackUrl,
      });
    } catch (err: any) {
      console.error("[Subscribe All] 批量订阅异常:", err);
      return res.status(500).json({ error: "批量订阅失败", detail: err.message });
    }
  });
}

// 导出供其他模块使用
export { subscribeTrackingNo, autoDetectCompany, getCallbackUrl, mapState };
