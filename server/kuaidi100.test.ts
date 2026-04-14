import { describe, it, expect } from "vitest";
import crypto from "crypto";

/**
 * 验证快递100 API 密钥配置和签名算法
 */

const KUAIDI100_KEY = process.env.KUAIDI100_KEY ?? "";
const KUAIDI100_CUSTOMER = process.env.KUAIDI100_CUSTOMER ?? "";

function makeSign(param: string): string {
  const str = param + KUAIDI100_KEY + KUAIDI100_CUSTOMER;
  return crypto.createHash("md5").update(str, "utf8").digest("hex").toUpperCase();
}

describe("快递100 API 密钥验证", () => {
  it("KUAIDI100_KEY 环境变量已配置", () => {
    expect(KUAIDI100_KEY).toBeTruthy();
    expect(KUAIDI100_KEY.length).toBeGreaterThan(0);
  });

  it("KUAIDI100_CUSTOMER 环境变量已配置", () => {
    expect(KUAIDI100_CUSTOMER).toBeTruthy();
    expect(KUAIDI100_CUSTOMER.length).toBeGreaterThan(0);
  });

  it("签名算法正确生成32位大写MD5", () => {
    const param = JSON.stringify({ com: "shunfeng", num: "SF1234567890" });
    const sign = makeSign(param);
    expect(sign).toMatch(/^[A-F0-9]{32}$/);
  });

  it("调用快递100正式API验证密钥有效性", { timeout: 15000 }, async () => {
    // 使用一个测试单号调用API，验证密钥是否有效
    // 即使单号不存在，只要密钥有效，API应返回正常响应（非403/401）
    const param = JSON.stringify({ com: "shunfeng", num: "SF0000000000" });
    const sign = makeSign(param);

    const body = new URLSearchParams({
      customer: KUAIDI100_CUSTOMER,
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

    expect(resp.ok).toBe(true);

    const data = await resp.json();
    // 密钥有效时，即使查不到物流，也不会返回签名错误
    // 可能返回 message: "ok" 或 "查无结果" 等
    // 密钥无效时会返回 message 包含 "签名错误" 或 "sign" 相关错误
    const message = (data.message || "").toLowerCase();
    expect(message).not.toContain("sign");
    expect(message).not.toContain("签名");
    expect(message).not.toContain("unauthorized");
    expect(message).not.toContain("customer");
  });
});
