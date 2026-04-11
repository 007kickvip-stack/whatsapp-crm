import type { Express, Request, Response } from "express";
import { sdk } from "./_core/sdk";

/**
 * 物流查询代理 - 通过后端服务器请求快递100接口，解决VPN冲突问题
 * 
 * 流程：
 * 1. 先调用 autoComNum 接口根据单号自动识别快递公司
 * 2. 再调用 query 接口获取物流轨迹
 */

interface TrackingData {
  time: string;
  context: string;
  ftime: string;
  location?: string;
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
};

function getComName(comCode: string): string {
  return COM_CODE_MAP[comCode] || comCode;
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
      const autoUrl = `https://www.kuaidi100.com/autonumber/autoComNum?text=${encodeURIComponent(trackingNo)}`;
      const autoResp = await fetch(autoUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Referer": "https://www.kuaidi100.com/",
        },
      });
      
      if (!autoResp.ok) {
        return res.status(502).json({ error: "无法识别快递公司", detail: `HTTP ${autoResp.status}` });
      }

      const autoData = (await autoResp.json()) as AutoComResult;
      
      if (!autoData.auto || autoData.auto.length === 0) {
        return res.status(404).json({ error: "无法识别该单号对应的快递公司" });
      }

      const comCode = autoData.auto[0].comCode;

      // Step 2: 查询物流信息
      const queryUrl = `https://www.kuaidi100.com/query?type=${encodeURIComponent(comCode)}&postid=${encodeURIComponent(trackingNo)}`;
      const queryResp = await fetch(queryUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Referer": "https://www.kuaidi100.com/",
        },
      });

      if (!queryResp.ok) {
        return res.status(502).json({ error: "查询物流信息失败", detail: `HTTP ${queryResp.status}` });
      }

      const queryData = (await queryResp.json()) as QueryResult;

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

  // 国际物流查询 - 使用17track的方式，返回跳转链接（17track全球可访问）
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

      // 国际物流也尝试用快递100查询
      const autoUrl = `https://www.kuaidi100.com/autonumber/autoComNum?text=${encodeURIComponent(trackingNo)}`;
      const autoResp = await fetch(autoUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Referer": "https://www.kuaidi100.com/",
        },
      });

      if (autoResp.ok) {
        const autoData = (await autoResp.json()) as AutoComResult;
        if (autoData.auto && autoData.auto.length > 0) {
          const comCode = autoData.auto[0].comCode;
          const queryUrl = `https://www.kuaidi100.com/query?type=${encodeURIComponent(comCode)}&postid=${encodeURIComponent(trackingNo)}`;
          const queryResp = await fetch(queryUrl, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
              "Referer": "https://www.kuaidi100.com/",
            },
          });

          if (queryResp.ok) {
            const queryData = (await queryResp.json()) as QueryResult;
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
          }
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
