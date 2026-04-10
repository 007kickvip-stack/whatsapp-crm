/**
 * 华磊科技系统代理模块
 * 通过模拟浏览器请求与华磊系统交互
 */
import { ENV } from "./_core/env";
import * as crypto from "crypto";

// Session management
let sessionCookie = "";
let lastLoginTime = 0;
const SESSION_TIMEOUT = 25 * 60 * 1000; // 25 minutes

/**
 * SHA256 + Base64 encode password (matching hualei's login.js)
 */
function encryptPassword(plain: string): string {
  const hash = crypto.createHash("sha256").update(plain).digest("hex");
  return Buffer.from(hash).toString("base64");
}

/**
 * Login to hualei system and get session cookie
 */
export async function hualeiLogin(): Promise<boolean> {
  const now = Date.now();
  if (sessionCookie && now - lastLoginTime < SESSION_TIMEOUT) {
    return true; // Session still valid
  }

  const baseUrl = ENV.hualeiBaseUrl;
  const username = ENV.hualeiUsername;
  const password = ENV.hualeiPassword;

  if (!username || !password) {
    throw new Error("华磊系统账号或密码未配置");
  }

  const encPwd = encryptPassword(password);

  const response = await fetch(`${baseUrl}/signin.htm`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
    body: `username=${encodeURIComponent(username)}&password=${encodeURIComponent(encPwd)}`,
    redirect: "manual",
  });

  // Extract JSESSIONID from Set-Cookie
  const cookies = response.headers.getSetCookie?.() ?? [];
  let jsessionId = "";
  for (const c of cookies) {
    const match = c.match(/JSESSIONID=([^;]+)/);
    if (match) {
      jsessionId = match[1];
      break;
    }
  }

  // Also try raw headers if getSetCookie not available
  if (!jsessionId) {
    const rawCookie = response.headers.get("set-cookie") ?? "";
    const match = rawCookie.match(/JSESSIONID=([^;]+)/);
    if (match) {
      jsessionId = match[1];
    }
  }

  if (!jsessionId) {
    throw new Error("华磊系统登录失败：未获取到会话Cookie");
  }

  // Verify login success (302 redirect means success)
  if (response.status !== 302 && response.status !== 200) {
    throw new Error(`华磊系统登录失败：HTTP ${response.status}`);
  }

  sessionCookie = `JSESSIONID=${jsessionId}`;
  lastLoginTime = now;
  return true;
}

/**
 * Make authenticated request to hualei system
 */
async function hualeiRequest(
  path: string,
  options: {
    method?: "GET" | "POST";
    body?: string;
    contentType?: string;
  } = {}
): Promise<string> {
  await hualeiLogin();

  const baseUrl = ENV.hualeiBaseUrl;
  const { method = "GET", body, contentType } = options;

  const headers: Record<string, string> = {
    Cookie: sessionCookie,
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  };

  if (contentType) {
    headers["Content-Type"] = contentType;
  } else if (method === "POST") {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: method === "POST" ? body : undefined,
    redirect: "manual",
  });

  // If redirected to login page, session expired
  if (
    response.status === 302 &&
    (response.headers.get("location") ?? "").includes("signin")
  ) {
    sessionCookie = "";
    lastLoginTime = 0;
    await hualeiLogin();
    // Retry
    headers.Cookie = sessionCookie;
    const retry = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: method === "POST" ? body : undefined,
      redirect: "manual",
    });
    return await retry.text();
  }

  return await response.text();
}

// ============ Order Query ============

export interface HualeiOrder {
  createTime: string;
  documentCode: string; // 原单号
  trackingNumber: string; // 转单号
  shippingMethod: string; // 运输方式
  recipientInfo: string; // 收件信息
  declarationInfo: string; // 申报信息
  otherInfo: string; // 其他信息
  remark: string; // 备注
  orderId: string; // 系统内部ID
  status: string; // 状态
}

/**
 * Parse HTML table rows into order objects
 */
function parseOrderListHtml(html: string): HualeiOrder[] {
  const orders: HualeiOrder[] = [];
  // Match table rows
  const rowRegex =
    /<tr[^>]*class="[^"]*orderItem[^"]*"[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;

  while ((rowMatch = rowRegex.exec(html)) !== null) {
    const rowHtml = rowMatch[1];
    const cells: string[] = [];
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let cellMatch;
    while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
      // Strip HTML tags and trim
      cells.push(cellMatch[1].replace(/<[^>]*>/g, "").trim());
    }

    // Extract order_id from row
    const idMatch = rowHtml.match(/order_id[=:][\s'"]*(\d+)/);
    const orderId = idMatch ? idMatch[1] : "";

    if (cells.length >= 7) {
      orders.push({
        createTime: cells[1] || "",
        documentCode: cells[3] || "",
        trackingNumber: cells[4] || "",
        shippingMethod: cells[5] || "",
        recipientInfo: cells[6] || "",
        declarationInfo: cells[7] || "",
        otherInfo: cells[8] || "",
        remark: cells[9] || "",
        orderId,
        status: "",
      });
    }
  }

  return orders;
}

/**
 * Query orders from hualei system
 * @param status NW=草稿, CF=确认, PT=预报, CI=收货, CO=出货, NP=暂不处理
 */
export async function hualeiQueryOrders(
  status?: string,
  startDate?: string,
  endDate?: string,
  documentCode?: string
): Promise<HualeiOrder[]> {
  const params = new URLSearchParams();
  if (status) params.append("order_status", status);
  if (startDate) params.append("startDate", `${startDate} 00:00:00`);
  if (endDate) params.append("endDate", `${endDate} 23:59:59`);
  if (documentCode) params.append("documentCode", documentCode);
  params.append("pager.pageno", "1");
  params.append("pager.pagesize", "200");

  const html = await hualeiRequest(`/orderList.htm?${params.toString()}`);
  return parseOrderListHtml(html);
}

// ============ Fee Query ============

export interface HualeiFeeDetail {
  receiveTime: string; // 收货时间
  documentCode: string; // 原单号
  trackingNumber: string; // 转单号
  shippingMethod: string; // 运输方式
  recipientInfo: string; // 收件信息
  weightInfo: string; // 重量信息
  otherInfo: string; // 其他信息
  feeInfo: string; // 费用信息（运费:xx 燃油:xx 杂费:xx）
  unitPrice: string; // 单价
  totalAmount: string; // 总金额
  remark: string; // 备注
  isPaid: string; // 是否支付
  // Parsed fee fields
  shippingFee: number;
  fuelFee: number;
  miscFee: number;
  total: number;
}

/**
 * Query fee details for given document codes
 */
export async function hualeiQueryFees(
  documentCodes: string[]
): Promise<HualeiFeeDetail[]> {
  const codesStr = documentCodes.join("\n");
  const html = await hualeiRequest("/selectFeeDetails.htm", {
    method: "POST",
    body: `documentCode=${encodeURIComponent(codesStr)}`,
  });

  const fees: HualeiFeeDetail[] = [];
  // Parse the fee table
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;
  let isHeader = true;

  while ((rowMatch = rowRegex.exec(html)) !== null) {
    const rowHtml = rowMatch[1];
    if (rowHtml.includes("<th")) {
      isHeader = true;
      continue;
    }
    if (isHeader) {
      isHeader = false;
      continue;
    }

    const cells: string[] = [];
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let cellMatch;
    while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
      cells.push(cellMatch[1].replace(/<[^>]*>/g, "").trim());
    }

    if (cells.length >= 11) {
      // Parse fee info: "运费:227.80燃油:0杂费:29.00"
      const feeStr = cells[8] || "";
      const shippingMatch = feeStr.match(/运费[:：]?([\d.]+)/);
      const fuelMatch = feeStr.match(/燃油[:：]?([\d.]+)/);
      const miscMatch = feeStr.match(/杂费[:：]?([\d.]+)/);

      const shippingFee = shippingMatch ? parseFloat(shippingMatch[1]) : 0;
      const fuelFee = fuelMatch ? parseFloat(fuelMatch[1]) : 0;
      const miscFee = miscMatch ? parseFloat(miscMatch[1]) : 0;
      const total = parseFloat(cells[10]) || 0;

      fees.push({
        receiveTime: cells[1] || "",
        documentCode: cells[2] || "",
        trackingNumber: cells[3] || "",
        shippingMethod: cells[4] || "",
        recipientInfo: cells[5] || "",
        weightInfo: cells[6] || "",
        otherInfo: cells[7] || "",
        feeInfo: feeStr,
        unitPrice: cells[9] || "",
        totalAmount: cells[10] || "",
        remark: cells[11] || "",
        isPaid: cells[12] || "",
        shippingFee,
        fuelFee,
        miscFee,
        total,
      });
    }
  }

  return fees;
}

// ============ Tracking Query ============

export interface HualeiTrackEvent {
  time: string;
  location: string;
  content: string;
}

/**
 * Query tracking events for an order
 */
export async function hualeiQueryTracking(
  trackingNumber?: string,
  orderId?: string
): Promise<HualeiTrackEvent[]> {
  const params = new URLSearchParams();
  if (trackingNumber) params.append("business_id", trackingNumber);
  if (orderId) params.append("order_id", orderId);

  const text = await hualeiRequest(
    `/viewTrackDetails.htm?${params.toString()}`
  );

  try {
    if (!text || text.trim() === "" || text.trim() === "[]") {
      return [];
    }
    const data = JSON.parse(text);
    if (!Array.isArray(data)) return [];

    return data
      .filter((item: any) => item !== null)
      .map((item: any) => ({
        time: item.track_date || item.trackDate || "",
        location: item.track_location || item.trackLocation || "",
        content: item.track_content || item.trackContent || "",
      }));
  } catch {
    return [];
  }
}

// ============ Create Order ============

export interface HualeiCreateOrderParams {
  productId: string; // 运输方式ID
  country: string; // 国家代码
  consigneeName: string; // 收件人姓名
  consigneeCompany?: string; // 收件人公司
  consigneeState?: string; // 州/省
  consigneeCity?: string; // 城市
  consigneePostcode: string; // 邮编
  consigneeAddress: string; // 地址
  consigneeStreetNo?: string; // 门牌号
  consigneeTelephone?: string; // 电话
  consigneeEmail?: string; // 邮箱
  orderPiece?: string; // 件数
  weight?: string; // 重量(kg)
  length?: string; // 长(cm)
  width?: string; // 宽(cm)
  height?: string; // 高(cm)
  cargoType?: string; // 货物类型
  dutyType?: string; // 关税类型
  customNote?: string; // 备注
  customerInvoiceCode?: string; // 客户订单号
  // 申报信息
  declarations?: Array<{
    skuCode?: string;
    enName: string; // 英文品名
    cnName?: string; // 中文品名
    pieces: number; // 数量
    weight: number; // 重量
    price: number; // 单价(USD)
    hsCode?: string; // 海关编码
  }>;
}

/**
 * Create an order in hualei system
 */
export async function hualeiCreateOrder(
  params: HualeiCreateOrderParams
): Promise<{ success: boolean; message: string; documentCode?: string }> {
  const formData = new URLSearchParams();

  formData.append("single", "single");
  formData.append("orderParam.product_id", params.productId);
  formData.append("orderParam.country", params.country);
  formData.append("orderParam.consignee_name", params.consigneeName);
  formData.append(
    "orderParam.consignee_companyname",
    params.consigneeCompany || ""
  );
  formData.append("orderParam.consignee_state", params.consigneeState || "");
  formData.append("orderParam.consignee_city", params.consigneeCity || "");
  formData.append("orderParam.consignee_postcode", params.consigneePostcode);
  formData.append("orderParam.consignee_address", params.consigneeAddress);
  formData.append(
    "orderParam.consignee_streetno",
    params.consigneeStreetNo || ""
  );
  formData.append(
    "orderParam.consignee_telephone",
    params.consigneeTelephone || ""
  );
  formData.append("orderParam.consignee_email", params.consigneeEmail || "");
  formData.append("orderParam.order_piece", params.orderPiece || "1");
  formData.append("orderParam.cargo_type", params.cargoType || "P");
  formData.append("orderParam.duty_type", params.dutyType || "DDU");
  formData.append("orderParam.order_customnote", params.customNote || "");
  formData.append(
    "orderParam.order_customerinvoicecode",
    params.customerInvoiceCode || ""
  );

  // Weight & dimensions
  formData.append("rulevolume_weight", params.weight || "0.5");
  formData.append("rulevolume_length", params.length || "");
  formData.append("rulevolume_width", params.width || "");
  formData.append("rulevolume_height", params.height || "");

  // Declaration items
  if (params.declarations && params.declarations.length > 0) {
    params.declarations.forEach((decl, i) => {
      formData.append(
        `orderParam.orderInvoiceParam[${i}].sku_code`,
        decl.skuCode || ""
      );
      formData.append(
        `orderParam.orderInvoiceParam[${i}].invoice_ename`,
        decl.enName
      );
      formData.append(
        `orderParam.orderInvoiceParam[${i}].invoice_title`,
        decl.cnName || ""
      );
      formData.append(
        `orderParam.orderInvoiceParam[${i}].invoice_pcs`,
        String(decl.pieces)
      );
      formData.append(
        `orderParam.orderInvoiceParam[${i}].invoice_weight`,
        String(decl.weight)
      );
      formData.append(
        `orderParam.orderInvoiceParam[${i}].invoice_price`,
        String(decl.price)
      );
      formData.append(
        `orderParam.orderInvoiceParam[${i}].hs_code`,
        decl.hsCode || ""
      );
    });
  }

  const html = await hualeiRequest("/createOrder.htm", {
    method: "POST",
    body: formData.toString(),
  });

  // Check for success - look for order number in response
  const successMatch = html.match(
    /订单号[：:]\s*([A-Z0-9]+)/i
  );
  const docCodeMatch = html.match(
    /documentCode[=:]\s*["']?([A-Z0-9]+)/i
  );

  if (
    html.includes("成功") ||
    html.includes("success") ||
    successMatch ||
    docCodeMatch
  ) {
    return {
      success: true,
      message: "订单创建成功",
      documentCode: successMatch?.[1] || docCodeMatch?.[1] || "",
    };
  }

  // Check for error messages
  const errorMatch = html.match(
    /class="[^"]*error[^"]*"[^>]*>([\s\S]*?)<\//i
  );
  const alertMatch = html.match(/alert\(['"]([^'"]+)['"]\)/);

  return {
    success: false,
    message:
      errorMatch?.[1]?.trim() ||
      alertMatch?.[1]?.trim() ||
      "创建订单失败，请检查参数",
  };
}

// ============ Shipping Methods ============

export interface HualeiShippingMethod {
  id: string;
  name: string;
}

/**
 * Get available shipping methods from create order page
 */
export async function hualeiGetShippingMethods(): Promise<
  HualeiShippingMethod[]
> {
  const html = await hualeiRequest("/gotoCreateOrder.htm");

  const methods: HualeiShippingMethod[] = [];
  const optionRegex =
    /<option\s+value="(\d+)"[^>]*>([^<]+)<\/option>/gi;
  let match;

  while ((match = optionRegex.exec(html)) !== null) {
    // Only from the product_id select
    methods.push({
      id: match[1],
      name: match[2].trim(),
    });
  }

  return methods;
}

/**
 * Test connection to hualei system
 */
export async function hualeiTestConnection(): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    // Force re-login
    sessionCookie = "";
    lastLoginTime = 0;
    await hualeiLogin();
    return { success: true, message: "连接成功" };
  } catch (error: any) {
    return { success: false, message: error.message || "连接失败" };
  }
}
