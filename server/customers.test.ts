import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAdminContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "admin-test-user",
    email: "admin@example.com",
    name: "Admin User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("customers CRUD with new fields", () => {
  const ctx = createAdminContext();
  const caller = appRouter.createCaller(ctx);
  let createdId: number;

  it("should create a customer with all fields including customerTier and country", async () => {
    const result = await caller.customers.create({
      whatsapp: "+44-test-" + Date.now(),
      customerType: "新零售",
      contactName: "测试联系人",
      staffName: "客服小王",
      account: "测试账号",
      contactInfo: "WeChat: test123",
      orderCategory: "鞋类",
      customerName: "张三",
      birthDate: "1990-05-15",
      customerEmail: "zhangsan@test.com",
      address: "北京市朝阳区",
      country: "中国",
      customerTier: "高质量",
    });
    expect(result).toHaveProperty("id");
    expect(typeof result.id).toBe("number");
    createdId = result.id;
  });

  it("should retrieve the created customer with all new fields", async () => {
    const customer = await caller.customers.getById({ id: createdId });
    expect(customer).toBeDefined();
    expect(customer!.staffName).toBe("客服小王");
    expect(customer!.account).toBe("测试账号");
    expect(customer!.contactInfo).toBe("WeChat: test123");
    expect(customer!.orderCategory).toBe("鞋类");
    expect(customer!.customerName).toBe("张三");
    expect(customer!.customerEmail).toBe("zhangsan@test.com");
    expect(customer!.address).toBe("北京市朝阳区");
    expect(customer!.country).toBe("中国");
    expect(customer!.customerTier).toBe("高质量");
  });

  it("should update customer fields including customerTier", async () => {
    const result = await caller.customers.update({
      id: createdId,
      orderCategory: "鞋类,服装",
      customerEmail: "updated@test.com",
      customerTier: "中等质量",
      country: "美国",
    });
    expect(result).toEqual({ success: true });

    const customer = await caller.customers.getById({ id: createdId });
    expect(customer!.orderCategory).toBe("鞋类,服装");
    expect(customer!.customerEmail).toBe("updated@test.com");
    expect(customer!.customerTier).toBe("中等质量");
    expect(customer!.country).toBe("美国");
  });

  it("should list customers with filters", async () => {
    const result = await caller.customers.list({
      page: 1,
      pageSize: 50,
    });
    expect(result).toHaveProperty("data");
    expect(result).toHaveProperty("total");
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.total).toBeGreaterThanOrEqual(1);
  });

  it("should list customers with search filter", async () => {
    const result = await caller.customers.list({
      page: 1,
      pageSize: 50,
      search: "+44-test-",
    });
    expect(result.data.length).toBeGreaterThanOrEqual(1);
  });

  it("should sync customer stats without error", async () => {
    const result = await caller.customers.syncStats({ customerId: createdId });
    expect(result).toEqual({ success: true });
  });

  it("should query customer order history", async () => {
    const result = await caller.customers.orderHistory({ customerId: createdId });
    expect(Array.isArray(result)).toBe(true);
  });

  it("should delete the test customer", async () => {
    const result = await caller.customers.delete({ id: createdId });
    expect(result).toEqual({ success: true });

    const customer = await caller.customers.getById({ id: createdId });
    expect(customer).toBeUndefined();
  });
});

describe("order-customer sync", () => {
  const ctx = createAdminContext();
  const caller = appRouter.createCaller(ctx);
  let orderId: number;
  const testWhatsapp = "+86-sync-test-" + Date.now();

  it("should create an order with customer fields and auto-create customer", async () => {
    const result = await caller.orders.create({
      orderDate: "2025-01-15",
      account: "测试账号",
      customerWhatsapp: testWhatsapp,
      customerType: "零售复购",
      orderNumber: "ORD-SYNC-" + Date.now(),
      orderStatus: "处理中",
      paymentStatus: "已付款",
      customerName: "李四",
      customerCountry: "英国",
      customerTier: "低质量",
      orderCategory: "服装",
      customerBirthDate: "1985-03-20",
      customerEmail: "lisi@test.com",
    });
    expect(result).toHaveProperty("id");
    orderId = result.id;
  });

  it("should have auto-created a customer record from the order", async () => {
    const customer = await caller.customers.getByWhatsapp({ whatsapp: testWhatsapp });
    expect(customer).toBeDefined();
    expect(customer!.customerName).toBe("李四");
    expect(customer!.country).toBe("英国");
    expect(customer!.customerTier).toBe("低质量");
    expect(customer!.orderCategory).toBe("服装");
    expect(customer!.customerEmail).toBe("lisi@test.com");
  });

  it("should update order customer fields and sync to customer", async () => {
    await caller.orders.update({
      id: orderId,
      customerName: "李四更新",
      customerCountry: "法国",
      customerTier: "高质量",
    });

    // Verify customer was updated
    const customer = await caller.customers.getByWhatsapp({ whatsapp: testWhatsapp });
    expect(customer).toBeDefined();
    expect(customer!.customerName).toBe("李四更新");
    expect(customer!.country).toBe("法国");
    expect(customer!.customerTier).toBe("高质量");
  });

  afterAll(async () => {
    // Cleanup
    try {
      await caller.orders.delete({ id: orderId });
      const customer = await caller.customers.getByWhatsapp({ whatsapp: testWhatsapp });
      if (customer) {
        await caller.customers.delete({ id: customer.id });
      }
    } catch {}
  });
});
