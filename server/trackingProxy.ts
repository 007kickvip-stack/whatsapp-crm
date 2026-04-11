import type { Express, Request, Response } from "express";
import { sdk } from "./_core/sdk";
import { ENV } from "./_core/env";
import crypto from "crypto";

/**
 * 物流查询代理 - 通过后端服务器请求快递100正式API，解决VPN冲突问题
 * 
 * 快递100实时查询接口文档：
 * - URL: https://poll.kuaidi100.com/poll/query.do
 * - 签名: MD5(param + key + customer) 转32位大写
 * - param: JSON字符串 { com, num, phone? }
 */

interface TrackingData {
  time: string;
  context: string;
  ftime: string;
  location?: string;
  areaCode?: string;
  areaName?: string;
  status?: string;
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
  shunfeng: "顺丰速运",
  yuantong: "圆通速递",
  zhongtong: "中通快递",
  shentong: "申通快递",
  yunda: "韵达快递",
  ems: "EMS",
  tiantian: "天天快递",
  huitongkuaidi: "百世快递",
  debangwuliu: "德邦物流",
  debangkuaidi: "德邦快递",
  jd: "京东物流",
  zhaijisong: "宅急送",
  youzhengguonei: "中国邮政",
  youzhengguoji: "国际邮政",
  guotongkuaidi: "国通快递",
  zhongyouwuliu: "中邮物流",
  annengwuliu: "安能物流",
  jiayiwuliu: "佳怡物流",
  youshuwuliu: "优速快递",
  suning: "苏宁物流",
  danniao: "丹鸟",
  fengwang: "丰网速运",
  jitu: "极兔速递",
  zhonghuanex: "中环快递",
  cainiao: "菜鸟",
  ups: "UPS",
  fedex: "FedEx",
  dhl: "DHL",
  usps: "USPS",
  tnt: "TNT",
  dpd: "DPD",
  aramex: "Aramex",
  yanwen: "燕文物流",
  ydgj: "韵达国际",
  chuanzhiyuan: "传志远",
  disifang: "递四方",
  huanqiu: "环球速运",
};

function getComName(comCode: string): string {
  return COM_CODE_MAP[comCode] || comCode;
}

/**
 * 快递100正式API签名
 * sign = MD5(param + key + customer).toUpperCase()
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
    com,
    num,
    ...(phone ? { phone } : {}),
  });

  const sign = makeSign(param);

  const body = new URLSearchParams({
    customer: ENV.kuaidi100Customer,
    sign,
    param,
  });

  const resp = await fetch("https://poll.kuaidi100.com/poll/query.do", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!resp.ok) {
    throw new Error(`快递100 API 返回 HTTP ${resp.status}`);
  }

  return (await resp.json()) as QueryResult;
}

/**
 * 自动识别快递公司（免费接口，无需签名）
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
    if (autoData.auto && autoData.auto.length > 0) {
      return autoData.auto[0].comCode;
    }
    return null;
  } catch {
    return null;
  }
}

export function registerTrackingProxyRoute(app: Express) {
  // 国内物流查询代理
  app.get("/api/tracking/domestic", async (req: Request, res: Response) => {
    try {
      // 验证用户登录
      const user = await sdk.authenticateRequest(req);
      if (!user) {
        return res.status(401).json({ error: "未登录" });
      }

      const trackingNo = req.query.no as string;
      if (!trackingNo) {
        return res.status(400).json({ error: "缺少单号参数" });
      }

      // Step 1: 自动识别快递公司
      const comCode = await autoDetectCompany(trackingNo);
      if (!comCode) {
        return res.status(404).json({ error: "无法识别该单号对应的快递公司" });
      }

      // Step 2: 使用正式API查询物流信息
      const queryData = await queryKuaidi100(comCode, trackingNo);

      return res.json({
        trackingNo,
        comCode,
        comName: getComName(comCode),
        status: queryData.status,
        state: queryData.state,
        message: queryData.message,
        ischeck: queryData.ischeck,
        data: queryData.data || [],
      });
    } catch (err: any) {
      console.error("Tracking proxy error:", err);
      return res.status(500).json({ error: "查询失败", detail: err.message });
    }
  });

  // 国际物流查询
  app.get("/api/tracking/international", async (req: Request, res: Response) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user) {
        return res.status(401).json({ error: "未登录" });
      }

      const trackingNo = req.query.no as string;
      if (!trackingNo) {
        return res.status(400).json({ error: "缺少单号参数" });
      }

      // 先尝试自动识别快递公司
      const comCode = await autoDetectCompany(trackingNo);

      if (comCode) {
        try {
          // 使用正式API查询
          const queryData = await queryKuaidi100(comCode, trackingNo);
          if (queryData.status === "200" && queryData.data && queryData.data.length > 0) {
            return res.json({
              trackingNo,
              comCode,
              comName: getComName(comCode),
              status: queryData.status,
              state: queryData.state,
              message: queryData.message,
              ischeck: queryData.ischeck,
              data: queryData.data || [],
            });
          }
        } catch (e) {
          // 正式API查询失败，继续尝试其他方式
          console.warn("Kuaidi100 API query failed for international:", e);
        }
      }

      // 如果快递100查不到，返回17track链接
      return res.json({
        trackingNo,
        comCode: "unknown",
        comName: "未知",
        status: "redirect",
        state: "-1",
        message: "无法通过快递100查询，请使用17track查询",
        data: [],
        redirectUrl: `https://www.17track.net/zh-cn/track#nums=${encodeURIComponent(trackingNo)}`,
      });
    } catch (err: any) {
      console.error("International tracking proxy error:", err);
      return res.status(500).json({ error: "查询失败", detail: err.message });
    }
  });
}
