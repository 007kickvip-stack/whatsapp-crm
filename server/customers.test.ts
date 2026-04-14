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

  it("should create a customer with new fields", async () => {
    const result = await caller.customers.create({
      whatsapp: "+44-test-" + Date.now(),
      customerType: "新零售",
      contactName: "测试联系人",
      staffName: "客服小王",
      account: "测试账号",
      contactInfo: "WeChat: test123",
      customerLevel: "A",
      orderCategory: "鞋类",
      customerName: "张三",
      birthDate: "1990-05-15",
      customerEmail: "zhangsan@test.com",
      address: "北京市朝阳区",
    });
    expect(result).toHaveProperty("id");
    expect(typeof result.id).toBe("number");
    createdId = result.id;
  });

  it("should retrieve the created customer with new fields", async () => {
    const customer = await caller.customers.getById({ id: createdId });
    expect(customer).toBeDefined();
    expect(customer!.staffName).toBe("客服小王");
    expect(customer!.account).toBe("测试账号");
    expect(customer!.contactInfo).toBe("WeChat: test123");
    expect(customer!.customerLevel).toBe("A");
    expect(customer!.orderCategory).toBe("鞋类");
    expect(customer!.customerName).toBe("张三");
    expect(customer!.customerEmail).toBe("zhangsan@test.com");
    expect(customer!.address).toBe("北京市朝阳区");
  });

  it("should update customer new fields", async () => {
    const result = await caller.customers.update({
      id: createdId,
      customerLevel: "VIP",
      orderCategory: "鞋类,服装",
      customerEmail: "updated@test.com",
    });
    expect(result).toEqual({ success: true });

    const customer = await caller.customers.getById({ id: createdId });
    expect(customer!.customerLevel).toBe("VIP");
    expect(customer!.orderCategory).toBe("鞋类,服装");
    expect(customer!.customerEmail).toBe("updated@test.com");
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

  it("should delete the test customer", async () => {
    const result = await caller.customers.delete({ id: createdId });
    expect(result).toEqual({ success: true });

    const customer = await caller.customers.getById({ id: createdId });
    expect(customer).toBeUndefined();
  });
});
