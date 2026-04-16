import { describe, it, expect, vi } from "vitest";
import { generateCaptcha, verifyCaptcha, getCaptchaStoreSize } from "./captcha";

describe("Captcha Module", () => {
  it("should generate a captcha with token and SVG", () => {
    const result = generateCaptcha();
    expect(result.token).toBeTruthy();
    expect(result.token.length).toBe(32); // 16 bytes hex = 32 chars
    expect(result.svg).toContain("<svg");
    expect(result.svg).toContain("</svg>");
    expect(result.code).toBeTruthy();
    expect(result.code.length).toBe(4);
  });

  it("should generate unique tokens for each captcha", () => {
    const c1 = generateCaptcha();
    const c2 = generateCaptcha();
    expect(c1.token).not.toBe(c2.token);
  });

  it("should verify correct captcha code (case insensitive)", () => {
    const { token, code } = generateCaptcha();
    expect(verifyCaptcha(token, code)).toBe(true);
  });

  it("should verify correct captcha code in lowercase", () => {
    const { token, code } = generateCaptcha();
    expect(verifyCaptcha(token, code.toLowerCase())).toBe(true);
  });

  it("should reject incorrect captcha code", () => {
    const { token } = generateCaptcha();
    expect(verifyCaptcha(token, "ZZZZ")).toBe(false);
  });

  it("should reject invalid token", () => {
    expect(verifyCaptcha("nonexistent-token", "ABCD")).toBe(false);
  });

  it("should consume captcha after verification (one-time use)", () => {
    const { token, code } = generateCaptcha();
    // First verification should succeed
    expect(verifyCaptcha(token, code)).toBe(true);
    // Second verification with same token should fail
    expect(verifyCaptcha(token, code)).toBe(false);
  });

  it("should consume captcha even after failed verification", () => {
    const { token, code } = generateCaptcha();
    // Failed attempt
    expect(verifyCaptcha(token, "WRONG")).toBe(false);
    // Correct code should also fail since token is consumed
    expect(verifyCaptcha(token, code)).toBe(false);
  });

  it("should generate SVG with noise elements", () => {
    const { svg } = generateCaptcha();
    // Should contain noise lines
    expect(svg).toContain("<line");
    // Should contain noise dots
    expect(svg).toContain("<circle");
    // Should contain text characters
    expect(svg).toContain("<text");
    // Should contain bezier curves
    expect(svg).toContain("<path");
  });

  it("should only use allowed characters (no confusing chars)", () => {
    // Generate many captchas and check characters
    for (let i = 0; i < 50; i++) {
      const { code } = generateCaptcha();
      for (const char of code) {
        expect("ABCDEFGHJKLMNPQRSTUVWXYZ23456789").toContain(char);
        // Should not contain confusing characters
        expect(["I", "O", "0", "1"]).not.toContain(char);
      }
    }
  });

  it("should track store size", () => {
    const sizeBefore = getCaptchaStoreSize();
    generateCaptcha();
    generateCaptcha();
    expect(getCaptchaStoreSize()).toBeGreaterThanOrEqual(sizeBefore + 2);
  });
});

// ==================== Auth Router Captcha Integration ====================
describe("Auth Router - Captcha Integration", () => {
  // Mock dependencies
  vi.mock("./db", async () => {
    const actual = await vi.importActual("./db") as any;
    return {
      ...actual,
      getUserByUsername: vi.fn().mockResolvedValue(null),
      verifyPassword: vi.fn().mockReturnValue(false),
    };
  });

  it("getCaptcha should return token and svg", async () => {
    // Import after mocks
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller({
      user: null,
      req: {} as any,
      res: { cookie: vi.fn(), clearCookie: vi.fn() } as any,
    });

    const result = await caller.auth.getCaptcha();
    expect(result.token).toBeTruthy();
    expect(result.svg).toContain("<svg");
  });

  it("loginWithPassword should reject invalid captcha", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller({
      user: null,
      req: {} as any,
      res: { cookie: vi.fn(), clearCookie: vi.fn() } as any,
    });

    await expect(
      caller.auth.loginWithPassword({
        username: "test",
        password: "test",
        captchaToken: "invalid-token",
        captchaCode: "ABCD",
      })
    ).rejects.toThrow("验证码错误或已过期");
  });

  it("loginWithPassword should reject expired/used captcha", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller({
      user: null,
      req: {} as any,
      res: { cookie: vi.fn(), clearCookie: vi.fn() } as any,
    });

    // Generate a captcha and use it
    const captcha = await caller.auth.getCaptcha();
    // Use it with wrong code to consume it
    try {
      await caller.auth.loginWithPassword({
        username: "test",
        password: "test",
        captchaToken: captcha.token,
        captchaCode: "WRONG",
      });
    } catch {}

    // Try again with same token
    await expect(
      caller.auth.loginWithPassword({
        username: "test",
        password: "test",
        captchaToken: captcha.token,
        captchaCode: "ABCD",
      })
    ).rejects.toThrow("验证码错误或已过期");
  });
});
