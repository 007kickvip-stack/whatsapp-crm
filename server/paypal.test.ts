import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database module
vi.mock("./db", () => ({
  createPaypalIncome: vi.fn().mockResolvedValue(1),
  updatePaypalIncome: vi.fn().mockResolvedValue(undefined),
  deletePaypalIncome: vi.fn().mockResolvedValue(undefined),
  listPaypalIncome: vi.fn().mockResolvedValue({
    data: [
      {
        id: 1,
        incomeDate: "2026-04-10",
        account: "Account1",
        customerName: "张三",
        customerWhatsapp: "+86 13800138000",
        paymentScreenshotUrl: null,
        paymentAmount: "100.00",
        actualReceived: "95.00",
        isReceived: "是",
        receivingAccount: "廖欧妹",
        staffName: "客服A",
        remarks: "测试收入",
        createdById: 1,
      },
    ],
    total: 1,
  }),
  syncOrdersToPaypalIncome: vi.fn().mockResolvedValue({ created: 3 }),
  syncOrderToPaypalIncome: vi.fn().mockResolvedValue(undefined),
  updatePaypalIncomeFromOrder: vi.fn().mockResolvedValue(undefined),
  deletePaypalIncomeByOrderId: vi.fn().mockResolvedValue(undefined),
  createPaypalExpense: vi.fn().mockResolvedValue(2),
  updatePaypalExpense: vi.fn().mockResolvedValue(undefined),
  deletePaypalExpense: vi.fn().mockResolvedValue(undefined),
  listPaypalExpense: vi.fn().mockResolvedValue({
    data: [
      {
        id: 1,
        expenseDate: "2026-04-10",
        account: "Account1",
        amount: "50.00",
        remarks: "测试支出",
        createdById: 1,
      },
    ],
    total: 1,
  }),
  getPaypalBalanceSummary: vi.fn().mockResolvedValue([
    { account: "廖欧妹", income: 95, expense: 50, balance: 45 },
    { account: "苏翊豪", income: 200, expense: 0, balance: 200 },
  ]),
  createAuditLog: vi.fn().mockResolvedValue(undefined),
  // Other mocks needed by the router
  createQuotation: vi.fn(),
  updateQuotation: vi.fn(),
  deleteQuotation: vi.fn(),
  getQuotationById: vi.fn(),
  getQuotationWithItems: vi.fn(),
  listQuotations: vi.fn().mockResolvedValue({ data: [], total: 0 }),
  recalculateQuotationTotals: vi.fn(),
  createQuotationItem: vi.fn(),
  updateQuotationItem: vi.fn(),
  deleteQuotationItem: vi.fn(),
  getQuotationItemsByQuotationId: vi.fn(),
  createOrder: vi.fn(),
  createOrderItem: vi.fn(),
  recalculateOrderTotals: vi.fn(),
  getCurrentExchangeRate: vi.fn().mockResolvedValue({ rate: "7.00" }),
  getOrderById: vi.fn(),
  updateOrder: vi.fn(),
  getOrderItemById: vi.fn(),
  updateOrderItem: vi.fn(),
  syncCustomerFromOrder: vi.fn(),
  deleteOrder: vi.fn(),
  listOrders: vi.fn().mockResolvedValue({ data: [], total: 0 }),
  deleteOrderItem: vi.fn(),
  getOrderItemsByOrderId: vi.fn().mockResolvedValue([]),
  syncPaymentToPaypalIncome: vi.fn().mockResolvedValue(undefined),
  updatePaypalIncomeFromPayment: vi.fn().mockResolvedValue(undefined),
  deletePaypalIncomeByPaymentId: vi.fn().mockResolvedValue(undefined),
  getPaypalIncomeOrderId: vi.fn().mockResolvedValue(null),
  syncActualReceivedToOrder: vi.fn().mockResolvedValue(undefined),
  createReshipment: vi.fn(),
  updateReshipment: vi.fn(),
  deleteReshipment: vi.fn(),
  getReshipmentById: vi.fn(),
  listReshipments: vi.fn().mockResolvedValue({ data: [], total: 0 }),
  getReshipmentsByOriginalOrderId: vi.fn().mockResolvedValue([]),
  createOrderPayment: vi.fn(),
  updateOrderPayment: vi.fn(),
  deleteOrderPayment: vi.fn(),
  getOrderPaymentsByOrderId: vi.fn().mockResolvedValue([]),
  getOrderPaymentById: vi.fn(),
}));

// Mock other dependencies
vi.mock("./_core/sdk", () => ({ sdk: {} }));
vi.mock("./_core/cookies", () => ({
  COOKIE_NAME: "session",
  getSessionCookieOptions: vi.fn().mockReturnValue({}),
}));
vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({ url: "https://example.com/test.png" }),
}));
vi.mock("./trackingProxy", () => ({
  subscribeTrackingNo: vi.fn().mockResolvedValue(undefined),
  getCallbackUrl: vi.fn().mockReturnValue("https://example.com/callback"),
}));

import { appRouter } from "./routers";
import {
  createPaypalIncome,
  updatePaypalIncome,
  deletePaypalIncome,
  listPaypalIncome,
  createPaypalExpense,
  updatePaypalExpense,
  deletePaypalExpense,
  listPaypalExpense,
  getPaypalBalanceSummary,
  syncOrdersToPaypalIncome,
} from "./db";

const adminCtx = {
  user: { id: 1, name: "Test Admin", role: "admin" as const, openId: "admin-open-id", email: null },
  req: {} as any,
  res: { clearCookie: vi.fn() } as any,
};

const staffCtx = {
  user: { id: 2, name: "Test Staff", role: "user" as const, openId: "staff-open-id", email: null },
  req: {} as any,
  res: { clearCookie: vi.fn() } as any,
};

const caller = appRouter.createCaller(adminCtx as any);
const staffCaller = appRouter.createCaller(staffCtx as any);

// ==================== PayPal Income Tests ====================
describe("PayPal Income CRUD", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should list income records (admin sees all - no staffId filter)", async () => {
    const result = await caller.paypalIncome.list({ page: 1, pageSize: 50 });
    expect(result.data).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.data[0].receivingAccount).toBe("廖欧妹");
    expect(listPaypalIncome).toHaveBeenCalledWith({
      page: 1,
      pageSize: 50,
      search: undefined,
      receivingAccount: undefined,
      dateFrom: undefined,
      dateTo: undefined,
      staffId: undefined,
    });
  });

  it("should list income records (staff sees only own records - staffId filter applied)", async () => {
    await staffCaller.paypalIncome.list({ page: 1, pageSize: 50 });
    expect(listPaypalIncome).toHaveBeenCalledWith({
      page: 1,
      pageSize: 50,
      search: undefined,
      receivingAccount: undefined,
      dateFrom: undefined,
      dateTo: undefined,
      staffId: 2,
    });
  });

  it("should list income with receivingAccount filter", async () => {
    await caller.paypalIncome.list({ page: 1, pageSize: 50, receivingAccount: "廖欧妹" });
    expect(listPaypalIncome).toHaveBeenCalledWith({
      page: 1,
      pageSize: 50,
      search: undefined,
      receivingAccount: "廖欧妹",
      dateFrom: undefined,
      dateTo: undefined,
      staffId: undefined,
    });
  });

  it("should list income with search filter", async () => {
    await caller.paypalIncome.list({ page: 1, pageSize: 50, search: "测试" });
    expect(listPaypalIncome).toHaveBeenCalledWith({
      page: 1,
      pageSize: 50,
      search: "测试",
      receivingAccount: undefined,
      dateFrom: undefined,
      dateTo: undefined,
      staffId: undefined,
    });
  });

  it("should list income with customerName in results", async () => {
    const result = await caller.paypalIncome.list({ page: 1, pageSize: 50 });
    expect(result.data[0].customerName).toBe("张三");
  });

  it("should list income with date range filter", async () => {
    await caller.paypalIncome.list({ page: 1, pageSize: 50, dateFrom: "2026-04-01", dateTo: "2026-04-30" });
    expect(listPaypalIncome).toHaveBeenCalledWith({
      page: 1,
      pageSize: 50,
      search: undefined,
      receivingAccount: undefined,
      dateFrom: "2026-04-01",
      dateTo: "2026-04-30",
      staffId: undefined,
    });
  });

  it("should create an income record with customerName", async () => {
    const result = await caller.paypalIncome.create({
      incomeDate: "2026-04-10",
      account: "Account1",
      customerName: "张三",
      customerWhatsapp: "+86 13800138000",
      paymentAmount: "100.00",
      actualReceived: "95.00",
      isReceived: "是",
      receivingAccount: "廖欧妹",
      staffName: "客服A",
      remarks: "测试收入",
    });
    expect(result.id).toBe(1);
    expect(createPaypalIncome).toHaveBeenCalledTimes(1);
    const callArgs = (createPaypalIncome as any).mock.calls[0][0];
    expect(callArgs.account).toBe("Account1");
    expect(callArgs.customerName).toBe("张三");
    expect(callArgs.receivingAccount).toBe("廖欧妹");
    expect(callArgs.paymentAmount).toBe("100.00");
    expect(callArgs.createdById).toBe(1);
  });

  it("should create income with date conversion", async () => {
    await caller.paypalIncome.create({
      incomeDate: "2026-04-15",
      paymentAmount: "50.00",
    });
    const callArgs = (createPaypalIncome as any).mock.calls[0][0];
    expect(callArgs.incomeDate).toBeInstanceOf(Date);
  });

  it("should create income without date", async () => {
    await caller.paypalIncome.create({
      paymentAmount: "50.00",
    });
    const callArgs = (createPaypalIncome as any).mock.calls[0][0];
    expect(callArgs.incomeDate).toBeNull();
  });

  it("should update an income record", async () => {
    const result = await caller.paypalIncome.update({
      id: 1,
      paymentAmount: "200.00",
      isReceived: "否",
    });
    expect(result.success).toBe(true);
    expect(updatePaypalIncome).toHaveBeenCalledTimes(1);
    const callArgs = (updatePaypalIncome as any).mock.calls[0];
    expect(callArgs[0]).toBe(1);
    expect(callArgs[1].paymentAmount).toBe("200.00");
    expect(callArgs[1].isReceived).toBe("否");
  });

  it("should update income date field", async () => {
    await caller.paypalIncome.update({
      id: 1,
      incomeDate: "2026-05-01",
    });
    const callArgs = (updatePaypalIncome as any).mock.calls[0][1];
    expect(callArgs.incomeDate).toBeInstanceOf(Date);
  });

  it("should delete an income record", async () => {
    const result = await caller.paypalIncome.delete({ id: 1 });
    expect(result.success).toBe(true);
    expect(deletePaypalIncome).toHaveBeenCalledWith(1);
  });
});

// ==================== PayPal Expense Permission Tests ====================
describe("PayPal Expense Permission Control", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should allow admin to list expenses", async () => {
    const result = await caller.paypalExpense.list({ page: 1, pageSize: 50 });
    expect(result.data).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it("should deny staff from listing expenses", async () => {
    await expect(staffCaller.paypalExpense.list({ page: 1, pageSize: 50 })).rejects.toThrow();
  });

  it("should deny staff from creating expenses", async () => {
    await expect(staffCaller.paypalExpense.create({
      expenseDate: "2026-04-10",
      account: "Account1",
      amount: "50.00",
    })).rejects.toThrow();
  });

  it("should deny staff from deleting expenses", async () => {
    await expect(staffCaller.paypalExpense.delete({ id: 1 })).rejects.toThrow();
  });
});

// ==================== PayPal Balance Summary Permission Tests ====================
describe("PayPal Balance Summary Permission Control", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should allow admin to view balance summary", async () => {
    const result = await caller.paypalBalance.summary();
    expect(result).toHaveLength(2);
  });

  it("should deny staff from viewing balance summary", async () => {
    await expect(staffCaller.paypalBalance.summary()).rejects.toThrow();
  });
});

// ==================== PayPal Sync Permission Tests ====================
describe("PayPal Sync Permission Control", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should allow admin to sync orders", async () => {
    const result = await caller.paypalSync.syncFromOrders();
    expect(result.created).toBe(3);
  });

  it("should deny staff from syncing orders", async () => {
    await expect(staffCaller.paypalSync.syncFromOrders()).rejects.toThrow();
  });
});

// ==================== PayPal Expense Tests ====================
describe("PayPal Expense CRUD", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should list expense records", async () => {
    const result = await caller.paypalExpense.list({ page: 1, pageSize: 50 });
    expect(result.data).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.data[0].amount).toBe("50.00");
    expect(listPaypalExpense).toHaveBeenCalledWith({
      page: 1,
      pageSize: 50,
      search: undefined,
      dateFrom: undefined,
      dateTo: undefined,
    });
  });

  it("should list expense with search filter", async () => {
    await caller.paypalExpense.list({ page: 1, pageSize: 50, search: "测试" });
    expect(listPaypalExpense).toHaveBeenCalledWith({
      page: 1,
      pageSize: 50,
      search: "测试",
      dateFrom: undefined,
      dateTo: undefined,
    });
  });

  it("should create an expense record", async () => {
    const result = await caller.paypalExpense.create({
      expenseDate: "2026-04-10",
      account: "Account1",
      amount: "50.00",
      remarks: "测试支出",
    });
    expect(result.id).toBe(2);
    expect(createPaypalExpense).toHaveBeenCalledTimes(1);
    const callArgs = (createPaypalExpense as any).mock.calls[0][0];
    expect(callArgs.account).toBe("Account1");
    expect(callArgs.amount).toBe("50.00");
    expect(callArgs.createdById).toBe(1);
  });

  it("should create expense with date conversion", async () => {
    await caller.paypalExpense.create({
      expenseDate: "2026-04-15",
      amount: "30.00",
    });
    const callArgs = (createPaypalExpense as any).mock.calls[0][0];
    expect(callArgs.expenseDate).toBeInstanceOf(Date);
  });

  it("should create expense without date", async () => {
    await caller.paypalExpense.create({
      amount: "30.00",
    });
    const callArgs = (createPaypalExpense as any).mock.calls[0][0];
    expect(callArgs.expenseDate).toBeNull();
  });

  it("should update an expense record", async () => {
    const result = await caller.paypalExpense.update({
      id: 1,
      amount: "75.00",
      remarks: "更新支出",
    });
    expect(result.success).toBe(true);
    expect(updatePaypalExpense).toHaveBeenCalledTimes(1);
    const callArgs = (updatePaypalExpense as any).mock.calls[0];
    expect(callArgs[0]).toBe(1);
    expect(callArgs[1].amount).toBe("75.00");
    expect(callArgs[1].remarks).toBe("更新支出");
  });

  it("should update expense date field", async () => {
    await caller.paypalExpense.update({
      id: 1,
      expenseDate: "2026-05-01",
    });
    const callArgs = (updatePaypalExpense as any).mock.calls[0][1];
    expect(callArgs.expenseDate).toBeInstanceOf(Date);
  });

  it("should delete an expense record", async () => {
    const result = await caller.paypalExpense.delete({ id: 1 });
    expect(result.success).toBe(true);
    expect(deletePaypalExpense).toHaveBeenCalledWith(1);
  });
});

// ==================== PayPal Balance Summary Tests ====================
describe("PayPal Balance Summary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return balance summary by account", async () => {
    const result = await caller.paypalBalance.summary();
    expect(result).toHaveLength(2);
    expect(result[0].account).toBe("廖欧妹");
    expect(result[0].income).toBe(95);
    expect(result[0].expense).toBe(50);
    expect(result[0].balance).toBe(45);
    expect(result[1].account).toBe("苏翊豪");
    expect(result[1].balance).toBe(200);
    expect(getPaypalBalanceSummary).toHaveBeenCalledTimes(1);
  });
});

// ==================== PayPal Sync From Orders Tests ====================
describe("PayPal Sync From Orders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should sync orders to paypal income", async () => {
    const result = await caller.paypalSync.syncFromOrders();
    expect(result.created).toBe(3);
    expect(syncOrdersToPaypalIncome).toHaveBeenCalledTimes(1);
  });
});

// ==================== Staff Income Access Tests ====================
describe("Staff PayPal Income Access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should allow staff to create income records", async () => {
    const result = await staffCaller.paypalIncome.create({
      paymentAmount: "100.00",
      receivingAccount: "廖欧妹",
    });
    expect(result.id).toBe(1);
    const callArgs = (createPaypalIncome as any).mock.calls[0][0];
    expect(callArgs.createdById).toBe(2); // staff user id
  });

  it("should allow staff to update income records", async () => {
    const result = await staffCaller.paypalIncome.update({
      id: 1,
      paymentAmount: "150.00",
    });
    expect(result.success).toBe(true);
  });

  it("should allow staff to delete income records", async () => {
    const result = await staffCaller.paypalIncome.delete({ id: 1 });
    expect(result.success).toBe(true);
  });
});
