import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the db module
vi.mock("./db", () => ({
  createOrderItem: vi.fn().mockResolvedValue(1),
  recalculateOrderTotals: vi.fn().mockResolvedValue(undefined),
  getCurrentExchangeRate: vi.fn().mockResolvedValue({ rate: "6.4" }),
  getOrderItemById: vi.fn().mockResolvedValue(null),
  getOrderItemsByOrderId: vi.fn().mockResolvedValue([]),
  updateOrderItem: vi.fn().mockResolvedValue(undefined),
  deleteOrderItem: vi.fn().mockResolvedValue(undefined),
}));

// Mock storage
vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({ url: "https://example.com/test.jpg" }),
}));

// Mock nanoid
vi.mock("nanoid", () => ({
  nanoid: () => "test-id",
}));

import { createOrderItem, recalculateOrderTotals, getCurrentExchangeRate } from "./db";

describe("orderItems.bulkCreate logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should calculate derived fields correctly for each item", async () => {
    const exchangeRate = 6.4;
    const item = {
      amountUsd: "50",
      sellingPrice: "200",
      productCost: "100",
      shippingActual: "30",
    };

    const amountUsd = parseFloat(item.amountUsd || "0");
    const amountCny = amountUsd * exchangeRate;
    const sellingPrice = parseFloat(item.sellingPrice || "0");
    const productCost = parseFloat(item.productCost || "0");
    const productProfit = sellingPrice - productCost;
    const productProfitRate = sellingPrice > 0 ? productProfit / sellingPrice : 0;
    const shippingCharged = amountCny - sellingPrice;
    const shippingActual = parseFloat(item.shippingActual || "0");
    const shippingProfit = shippingCharged - shippingActual;
    const shippingProfitRate = shippingCharged > 0 ? shippingProfit / shippingCharged : 0;
    const totalProfit = productProfit + shippingProfit;
    const profitRate = amountCny > 0 ? totalProfit / amountCny : 0;

    expect(amountCny).toBe(320);
    expect(productProfit).toBe(100);
    expect(productProfitRate).toBe(0.5);
    expect(shippingCharged).toBe(120);
    expect(shippingProfit).toBe(90);
    expect(totalProfit).toBe(190);
    expect(profitRate).toBeCloseTo(0.59375);
  });

  it("should handle zero values without division errors", () => {
    const exchangeRate = 6.4;
    const item = {
      amountUsd: "0",
      sellingPrice: "0",
      productCost: "0",
      shippingActual: "0",
    };

    const amountUsd = parseFloat(item.amountUsd || "0");
    const amountCny = amountUsd * exchangeRate;
    const sellingPrice = parseFloat(item.sellingPrice || "0");
    const productCost = parseFloat(item.productCost || "0");
    const productProfit = sellingPrice - productCost;
    const productProfitRate = sellingPrice > 0 ? productProfit / sellingPrice : 0;
    const shippingCharged = amountCny - sellingPrice;
    const shippingActual = parseFloat(item.shippingActual || "0");
    const shippingProfit = shippingCharged - shippingActual;
    const shippingProfitRate = shippingCharged > 0 ? shippingProfit / shippingCharged : 0;
    const totalProfit = productProfit + shippingProfit;
    const profitRate = amountCny > 0 ? totalProfit / amountCny : 0;

    expect(amountCny).toBe(0);
    expect(productProfit).toBe(0);
    expect(productProfitRate).toBe(0);
    expect(shippingCharged).toBe(0);
    expect(shippingProfit).toBe(0);
    expect(shippingProfitRate).toBe(0);
    expect(totalProfit).toBe(0);
    expect(profitRate).toBe(0);
  });

  it("should handle empty/undefined optional fields", () => {
    const item = {
      amountUsd: undefined as string | undefined,
      sellingPrice: "",
      productCost: undefined as string | undefined,
      shippingActual: "",
    };

    const amountUsd = parseFloat(item.amountUsd || "0");
    const sellingPrice = parseFloat(item.sellingPrice || "0");
    const productCost = parseFloat(item.productCost || "0");
    const shippingActual = parseFloat(item.shippingActual || "0");

    expect(amountUsd).toBe(0);
    expect(sellingPrice).toBe(0);
    expect(productCost).toBe(0);
    expect(shippingActual).toBe(0);
  });

  it("should process multiple items and call createOrderItem for each", async () => {
    const items = [
      { amountUsd: "50", sellingPrice: "200", productCost: "100", shippingActual: "30" },
      { amountUsd: "80", sellingPrice: "300", productCost: "150", shippingActual: "40" },
      { amountUsd: "100", sellingPrice: "400", productCost: "200", shippingActual: "50" },
    ];

    const rateObj = await getCurrentExchangeRate();
    const exchangeRateVal = parseFloat(String(rateObj.rate));
    const ids: number[] = [];

    for (const item of items) {
      const amountUsd = parseFloat(item.amountUsd || "0");
      const amountCny = amountUsd * exchangeRateVal;
      const sellingPrice = parseFloat(item.sellingPrice || "0");
      const productCost = parseFloat(item.productCost || "0");
      const productProfit = sellingPrice - productCost;
      const productProfitRate = sellingPrice > 0 ? productProfit / sellingPrice : 0;
      const shippingCharged = amountCny - sellingPrice;
      const shippingActual = parseFloat(item.shippingActual || "0");
      const shippingProfit = shippingCharged - shippingActual;
      const shippingProfitRate = shippingCharged > 0 ? shippingProfit / shippingCharged : 0;
      const totalProfit = productProfit + shippingProfit;
      const profitRate = amountCny > 0 ? totalProfit / amountCny : 0;

      const id = await createOrderItem({
        orderId: 1,
        ...item,
        amountCny: amountCny.toFixed(2),
        shippingCharged: shippingCharged.toFixed(2),
        productProfit: productProfit.toFixed(2),
        productProfitRate: productProfitRate.toFixed(6),
        shippingProfit: shippingProfit.toFixed(2),
        shippingProfitRate: shippingProfitRate.toFixed(6),
        totalProfit: totalProfit.toFixed(2),
        profitRate: profitRate.toFixed(6),
      });
      ids.push(id);
    }

    await recalculateOrderTotals(1);

    expect(createOrderItem).toHaveBeenCalledTimes(3);
    expect(recalculateOrderTotals).toHaveBeenCalledTimes(1);
    expect(recalculateOrderTotals).toHaveBeenCalledWith(1);
    expect(ids).toEqual([1, 1, 1]);
  });
});
