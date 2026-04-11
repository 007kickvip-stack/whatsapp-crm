import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, adminProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  listUsers, updateUserRole, deleteUser, getUserById, createUser,
  getUserByUsername, verifyPassword, updateUserPassword, updateUserUsername, updateUserHireDate,
  createCustomer, updateCustomer, deleteCustomer, getCustomerById, getCustomerByWhatsapp, listCustomers,
  createOrder, updateOrder, deleteOrder, getOrderById, getOrderWithItems, listOrders,
  createOrderItem, updateOrderItem, deleteOrderItem, getOrderItemById, getOrderItemsByOrderId, recalculateOrderTotals,
  getOrderStats, getOrderStatusDistribution, getPaymentStatusDistribution,
  getStaffPerformance, getRecentOrders, getCustomerStats, getDailyOrderTrend,
  createAuditLog, listAuditLogs, exportOrders,
  getCurrentExchangeRate, listExchangeRates, createExchangeRate,
  getProfitReport, getDistinctStaffNames,
  getMonthlyProfitComparison, getQuarterlyProfitComparison,
  getProfitAlertSetting, upsertProfitAlertSetting, getStaffProfitAlerts,
  listStaffMonthlyTargets, upsertStaffMonthlyTarget, deleteStaffMonthlyTarget,
  getStaffTargetProgress, getStaffList,
  getDailyOrderSummary, listDailyData, createDailyData, updateDailyData, deleteDailyData,
  getDailyDataById, getDailyReportByStaff, getDailyReportByAccount, getDailyReportDrillDown, syncOrderDataToDailyData, getDistinctOrderAccounts,
  listDailyReportNotes, createDailyReportNote, updateDailyReportNote, deleteDailyReportNote, getDailyReportNoteById,
  listAccounts, createAccount, updateAccount, deleteAccount, reorderAccounts,
  findOrderItemByDomesticTrackingNo, markLogisticsSubscribed,
} from "./db";
import { sdk } from "./_core/sdk";
import { ONE_YEAR_MS } from "@shared/const";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";
import { subscribeTrackingNo, getCallbackUrl } from "./trackingProxy";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
    loginWithPassword: publicProcedure.input(z.object({
      username: z.string().min(1),
      password: z.string().min(1),
    })).mutation(async ({ input, ctx }) => {
      const user = await getUserByUsername(input.username);
      if (!user || !user.password) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "用户名或密码错误" });
      }
      const valid = verifyPassword(input.password, user.password);
      if (!valid) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "用户名或密码错误" });
      }
      // Create session token and set cookie
      const sessionToken = await sdk.createSessionToken(user.openId, {
        name: user.name || "",
        expiresInMs: ONE_YEAR_MS,
      });
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      return { success: true, user: { id: user.id, name: user.name, role: user.role } };
    }),
  }),

  // ==================== User Management (Admin Only) ====================
  users: router({
    list: adminProcedure.input(z.object({
      page: z.number().default(1),
      pageSize: z.number().default(20),
    })).query(({ input }) => listUsers(input.page, input.pageSize)),

    getById: adminProcedure.input(z.object({ id: z.number() })).query(({ input }) => getUserById(input.id)),

    updateRole: adminProcedure.input(z.object({
      userId: z.number(),
      role: z.enum(["user", "admin"]),
    })).mutation(({ input }) => updateUserRole(input.userId, input.role)),

    delete: adminProcedure.input(z.object({ userId: z.number() })).mutation(({ input }) => deleteUser(input.userId)),

    create: adminProcedure.input(z.object({
      name: z.string().min(1),
      email: z.string().optional(),
      username: z.string().min(2).optional(),
      password: z.string().min(4).optional(),
      role: z.enum(["user", "admin"]).default("user"),
      hireDate: z.string().optional(),
    })).mutation(async ({ input }) => {
      if (input.username) {
        const existing = await getUserByUsername(input.username);
        if (existing) {
          throw new TRPCError({ code: "CONFLICT", message: "用户名已存在" });
        }
      }
      const result = await createUser(input);
      return result;
    }),

    updateHireDate: adminProcedure.input(z.object({
      userId: z.number(),
      hireDate: z.string().nullable(),
    })).mutation(async ({ input }) => {
      await updateUserHireDate(input.userId, input.hireDate);
      return { success: true };
    }),

    setPassword: adminProcedure.input(z.object({
      userId: z.number(),
      username: z.string().min(2),
      password: z.string().min(4),
    })).mutation(async ({ input }) => {
      // Check if username is taken by another user
      const existing = await getUserByUsername(input.username);
      if (existing && existing.id !== input.userId) {
        throw new TRPCError({ code: "CONFLICT", message: "用户名已被其他用户使用" });
      }
      await updateUserUsername(input.userId, input.username);
      await updateUserPassword(input.userId, input.password);
      return { success: true };
    }),
  }),

  // ==================== Customer Management ====================
  customers: router({
    list: protectedProcedure.input(z.object({
      page: z.number().default(1),
      pageSize: z.number().default(20),
      search: z.string().optional(),
    })).query(({ input, ctx }) => {
      const isAdmin = ctx.user.role === "admin";
      return listCustomers({
        ...input,
        createdById: isAdmin ? undefined : ctx.user.id,
      });
    }),

    getById: protectedProcedure.input(z.object({ id: z.number() })).query(({ input }) => getCustomerById(input.id)),

    getByWhatsapp: protectedProcedure.input(z.object({ whatsapp: z.string() })).query(({ input }) => getCustomerByWhatsapp(input.whatsapp)),

    create: protectedProcedure.input(z.object({
      whatsapp: z.string().min(1),
      customerType: z.string().optional(),
      contactName: z.string().optional(),
      telephone: z.string().optional(),
      address: z.string().optional(),
      province: z.string().optional(),
      city: z.string().optional(),
      cityCode: z.string().optional(),
      country: z.string().optional(),
    })).mutation(async ({ input, ctx }) => {
      const id = await createCustomer({ ...input, createdById: ctx.user.id });
      await logAction(ctx, "create", "customer", id, input.whatsapp, JSON.stringify(input));
      return { id };
    }),

    update: protectedProcedure.input(z.object({
      id: z.number(),
      whatsapp: z.string().optional(),
      customerType: z.string().optional(),
      contactName: z.string().optional(),
      telephone: z.string().optional(),
      address: z.string().optional(),
      province: z.string().optional(),
      city: z.string().optional(),
      cityCode: z.string().optional(),
      country: z.string().optional(),
    })).mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      await updateCustomer(id, data);
      await logAction(ctx, "update", "customer", id, undefined, JSON.stringify(data));
      return { success: true };
    }),

    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
      await deleteCustomer(input.id);
      await logAction(ctx, "delete", "customer", input.id);
      return { success: true };
    }),
  }),

  // ==================== Order Management ====================
  orders: router({
    list: protectedProcedure.input(z.object({
      page: z.number().default(1),
      pageSize: z.number().default(20),
      search: z.string().optional(),
      staffName: z.string().optional(),
      account: z.string().optional(),
      customerType: z.string().optional(),
      orderNumber: z.string().optional(),
      orderStatus: z.string().optional(),
      paymentStatus: z.string().optional(),
      customerWhatsapp: z.string().optional(),
      internationalTrackingNo: z.string().optional(),
      logisticsStatus: z.string().optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
    })).query(({ input, ctx }) => {
      const isAdmin = ctx.user.role === "admin";
      return listOrders({
        ...input,
        staffId: isAdmin ? undefined : ctx.user.id,
      });
    }),

    getById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input, ctx }) => {
      const order = await getOrderWithItems(input.id);
      if (!order) return undefined;
      // 客服只能查看自己的订单
      if (ctx.user.role !== 'admin' && order.staffId !== ctx.user.id) {
        throw new TRPCError({ code: 'FORBIDDEN', message: '您只能查看自己的订单' });
      }
      return order;
    }),

    create: protectedProcedure.input(z.object({
      orderDate: z.string().optional(),
      account: z.string().optional(),
      customerWhatsapp: z.string().min(1),
      customerId: z.number().optional(),
      customerType: z.string().optional(),
      orderNumber: z.string().min(1),
      orderStatus: z.string().optional(),
      paymentStatus: z.string().optional(),
      remarks: z.string().optional(),
    })).mutation(async ({ input, ctx }) => {
      const { orderDate, ...rest } = input;
      const id = await createOrder({
        ...rest,
        orderDate: orderDate ? new Date(orderDate) : null,
        staffId: ctx.user.id,
        staffName: ctx.user.name || "未知客服",
      });
      // Auto-create an initial order item so the order is immediately editable in the table
      await createOrderItem({
        orderId: id,
        orderNumber: rest.orderNumber,
        amountCny: "0.00",
        shippingCharged: "0.00",
        productProfit: "0.00",
        productProfitRate: "0.000000",
        shippingProfit: "0.00",
        shippingProfitRate: "0.000000",
        totalProfit: "0.00",
        profitRate: "0.000000",
      });
      await logAction(ctx, "create", "order", id, rest.orderNumber, JSON.stringify(input));
      return { id };
    }),

    update: protectedProcedure.input(z.object({
      id: z.number(),
      orderDate: z.string().optional(),
      account: z.string().optional(),
      customerWhatsapp: z.string().optional(),
      customerType: z.string().optional(),
      orderNumber: z.string().optional(),
      orderStatus: z.string().optional(),
      paymentStatus: z.string().optional(),
      remarks: z.string().optional(),
    })).mutation(async ({ input, ctx }) => {
      // 客服只能编辑自己的订单
      if (ctx.user.role !== 'admin') {
        const order = await getOrderById(input.id);
        if (!order || order.staffId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: '您只能编辑自己的订单' });
        }
      }
      const { id, orderDate, ...data } = input;
      await updateOrder(id, {
        ...data,
        ...(orderDate !== undefined ? { orderDate: orderDate ? new Date(orderDate) : null } : {}),
      });
      await logAction(ctx, "update", "order", id, undefined, JSON.stringify(data));
      return { success: true };
    }),

    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
      // 客服只能删除自己的订单
      if (ctx.user.role !== 'admin') {
        const order = await getOrderById(input.id);
        if (!order || order.staffId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: '您只能删除自己的订单' });
        }
      }
      await deleteOrder(input.id);
      await logAction(ctx, "delete", "order", input.id);
      return { success: true };
    }),

    bulkImport: protectedProcedure.input(z.object({
      rows: z.array(z.object({
        orderDate: z.string().optional(),
        account: z.string().optional(),
        customerWhatsapp: z.string().min(1),
        customerType: z.string().optional(),
        orderNumber: z.string().min(1),
        orderStatus: z.string().optional(),
        paymentStatus: z.string().optional(),
        remarks: z.string().optional(),
        // Item-level fields
        size: z.string().optional(),
        domesticTrackingNo: z.string().optional(),
        sizeRecommendation: z.string().optional(),
        contactInfo: z.string().optional(),
        internationalTrackingNo: z.string().optional(),
        shipDate: z.string().optional(),
        quantity: z.number().optional(),
        source: z.string().optional(),
        amountUsd: z.string().optional(),
        amountCny: z.string().optional(),
        sellingPrice: z.string().optional(),
        productCost: z.string().optional(),
        shippingCharged: z.string().optional(),
        shippingActual: z.string().optional(),
        originalOrderNo: z.string().optional(),
      })),
    })).mutation(async ({ input, ctx }) => {
      const results: { orderId: number; orderNumber: string }[] = [];
      // Group rows by orderNumber + customerWhatsapp to merge items under same order
      const orderGroups = new Map<string, typeof input.rows>();
      for (const row of input.rows) {
        const key = `${row.orderNumber}||${row.customerWhatsapp}`;
        if (!orderGroups.has(key)) orderGroups.set(key, []);
        orderGroups.get(key)!.push(row);
      }

      for (const [, groupRows] of Array.from(orderGroups)) {
        const first = groupRows[0];
        // Auto-create customer if not exists
        let existingCustomer = await getCustomerByWhatsapp(first.customerWhatsapp);
        let customerId: number | undefined;
        if (!existingCustomer) {
          customerId = await createCustomer({
            whatsapp: first.customerWhatsapp,
            customerType: first.customerType || "新零售",
            createdById: ctx.user.id,
          });
        } else {
          customerId = existingCustomer.id;
        }

        // Create order
        const orderId = await createOrder({
          orderDate: first.orderDate ? new Date(first.orderDate) : null,
          account: first.account || undefined,
          customerWhatsapp: first.customerWhatsapp,
          customerId,
          customerType: first.customerType || "新零售",
          orderNumber: first.orderNumber,
          orderStatus: first.orderStatus || "已报货，待发货",
          paymentStatus: first.paymentStatus || "未付款",
          remarks: first.remarks || undefined,
          staffId: ctx.user.id,
          staffName: ctx.user.name || "未知客服",
        });

        // Create order items for each row in the group
        const currentRate = await getCurrentExchangeRate();
        const exchangeRateVal = parseFloat(String(currentRate.rate));
        for (const row of groupRows) {
          const amountUsd = parseFloat(row.amountUsd || "0");
          const amountCny = amountUsd * exchangeRateVal;
          const sellingPrice = parseFloat(row.sellingPrice || "0");
          const productCost = parseFloat(row.productCost || "0");
          const productProfit = sellingPrice - productCost;
          const productProfitRate = sellingPrice > 0 ? productProfit / sellingPrice : 0;
          const shippingCharged = amountCny - sellingPrice;
          const shippingActual = parseFloat(row.shippingActual || "0");
          const shippingProfit = shippingCharged - shippingActual;
          const shippingProfitRate = shippingCharged > 0 ? shippingProfit / shippingCharged : 0;
          const totalProfit = productProfit + shippingProfit;
          const profitRate = amountCny > 0 ? totalProfit / amountCny : 0;

          await createOrderItem({
            orderId,
            orderNumber: row.orderNumber,
            size: row.size || undefined,
            domesticTrackingNo: row.domesticTrackingNo || undefined,
            sizeRecommendation: row.sizeRecommendation || undefined,
            contactInfo: row.contactInfo || undefined,
            internationalTrackingNo: row.internationalTrackingNo || undefined,
            shipDate: row.shipDate || undefined,
            quantity: row.quantity || 1,
            source: row.source || undefined,
            amountUsd: row.amountUsd || "0",
            amountCny: amountCny.toFixed(2),
            sellingPrice: row.sellingPrice || "0",
            productCost: row.productCost || "0",
            shippingCharged: shippingCharged.toFixed(2),
            shippingActual: row.shippingActual || "0",
            productProfit: productProfit.toFixed(2),
            productProfitRate: productProfitRate.toFixed(6),
            shippingProfit: shippingProfit.toFixed(2),
            shippingProfitRate: shippingProfitRate.toFixed(6),
            totalProfit: totalProfit.toFixed(2),
            profitRate: profitRate.toFixed(6),
            remarks: row.remarks || undefined,
            paymentStatus: row.paymentStatus || undefined,
            originalOrderNo: row.originalOrderNo || undefined,
          });
        }

        await recalculateOrderTotals(orderId);
        results.push({ orderId, orderNumber: first.orderNumber });
      }

      await logAction(ctx, "import", "order", undefined, `批量导入 ${results.length} 个订单`, JSON.stringify({ count: results.length, orderNumbers: results.map(r => r.orderNumber) }));
      return { success: true, imported: results.length, orders: results };
    }),
  }),

  // ==================== Order Items ====================
  orderItems: router({
    listByOrder: protectedProcedure.input(z.object({ orderId: z.number() })).query(({ input }) => getOrderItemsByOrderId(input.orderId)),

    create: protectedProcedure.input(z.object({
      orderId: z.number(),
      orderNumber: z.string().optional(),
      orderImageUrl: z.string().optional(),
      size: z.string().optional(),
      domesticTrackingNo: z.string().optional(),
      sizeRecommendation: z.string().optional(),
      contactInfo: z.string().optional(),
      internationalTrackingNo: z.string().optional(),
      originalOrderNo: z.string().optional(),
      shipDate: z.string().optional(),
      quantity: z.number().optional(),
      source: z.string().optional(),
      itemStatus: z.string().optional(),
      amountUsd: z.string().optional(),
      amountCny: z.string().optional(),
      sellingPrice: z.string().optional(),
      productCost: z.string().optional(),
      shippingCharged: z.string().optional(),
      shippingActual: z.string().optional(),
      paymentScreenshotUrl: z.string().optional(),
      remarks: z.string().optional(),
      paymentStatus: z.string().optional(),
    })).mutation(async ({ input }) => {
      // Auto-calculate derived fields using formulas
      const rateObj = await getCurrentExchangeRate();
      const exchangeRateVal = parseFloat(String(rateObj.rate));
      const amountUsd = parseFloat(input.amountUsd || "0");
      const amountCny = amountUsd * exchangeRateVal; // 总金额¥ = 总金额$ × 汇率
      const sellingPrice = parseFloat(input.sellingPrice || "0");
      const productCost = parseFloat(input.productCost || "0");
      const productProfit = sellingPrice - productCost; // 产品毛利润
      const productProfitRate = sellingPrice > 0 ? productProfit / sellingPrice : 0;
      const shippingCharged = amountCny - sellingPrice; // 收取运费(¥) = 总金额¥ - 售价
      const shippingActual = parseFloat(input.shippingActual || "0");
      const shippingProfit = shippingCharged - shippingActual; // 运费利润
      const shippingProfitRate = shippingCharged > 0 ? shippingProfit / shippingCharged : 0;
      const totalProfit = productProfit + shippingProfit; // 总利润
      const profitRate = amountCny > 0 ? totalProfit / amountCny : 0; // 利润率

      const id = await createOrderItem({
        ...input,
        amountCny: amountCny.toFixed(2),
        shippingCharged: shippingCharged.toFixed(2),
        productProfit: productProfit.toFixed(2),
        productProfitRate: productProfitRate.toFixed(6),
        shippingProfit: shippingProfit.toFixed(2),
        shippingProfitRate: shippingProfitRate.toFixed(6),
        totalProfit: totalProfit.toFixed(2),
        profitRate: profitRate.toFixed(6),
      });

      // 自动订阅快递100推送（异步，不阻塞主流程）
      if (input.domesticTrackingNo) {
        const callbackUrl = "https://whatsappcrm-hh98jc4u.manus.space/api/kuaidi100/callback";
        subscribeTrackingNo(id, input.domesticTrackingNo, callbackUrl).catch(e =>
          console.warn("[Auto Subscribe] 创建时自动订阅失败:", e.message)
        );
      }

      // Recalculate order totals
      await recalculateOrderTotals(input.orderId);
      return { id };
    }),

    update: protectedProcedure.input(z.object({
      id: z.number(),
      orderId: z.number(),
      orderNumber: z.string().optional(),
      orderImageUrl: z.string().optional(),
      size: z.string().optional(),
      domesticTrackingNo: z.string().optional(),
      sizeRecommendation: z.string().optional(),
      contactInfo: z.string().optional(),
      internationalTrackingNo: z.string().optional(),
      originalOrderNo: z.string().optional(),
      shipDate: z.string().optional(),
      quantity: z.number().optional(),
      source: z.string().optional(),
      itemStatus: z.string().optional(),
      amountUsd: z.string().optional(),
      amountCny: z.string().optional(),
      sellingPrice: z.string().optional(),
      productCost: z.string().optional(),
      shippingCharged: z.string().optional(),
      shippingActual: z.string().optional(),
      paymentScreenshotUrl: z.string().optional(),
      remarks: z.string().optional(),
      paymentStatus: z.string().optional(),
    })).mutation(async ({ input }) => {
      const { id, orderId, ...data } = input;
      // Fetch current item to merge partial updates
      const currentItem = await getOrderItemById(id);
      const merged = {
        amountUsd: data.amountUsd ?? currentItem?.amountUsd ?? "0",
        sellingPrice: data.sellingPrice ?? currentItem?.sellingPrice ?? "0",
        productCost: data.productCost ?? currentItem?.productCost ?? "0",
        shippingActual: data.shippingActual ?? currentItem?.shippingActual ?? "0",
      };

      // Auto-calculate derived fields using formulas
      const rateObj2 = await getCurrentExchangeRate();
      const exchangeRateVal2 = parseFloat(String(rateObj2.rate));
      const amountUsd = parseFloat(merged.amountUsd || "0");
      const amountCny = amountUsd * exchangeRateVal2; // 总金额¥ = 总金额$ × 汇率
      const sellingPrice = parseFloat(merged.sellingPrice || "0");
      const productCost = parseFloat(merged.productCost || "0");
      const productProfit = sellingPrice - productCost; // 产品毛利润 = 售价 - 产品成本
      const productProfitRate = sellingPrice > 0 ? productProfit / sellingPrice : 0; // 产品毛利率
      const shippingCharged = amountCny - sellingPrice; // 收取运费(¥) = 总金额¥ - 售价
      const shippingActual = parseFloat(merged.shippingActual || "0");
      const shippingProfit = shippingCharged - shippingActual; // 运费利润
      const shippingProfitRate = shippingCharged > 0 ? shippingProfit / shippingCharged : 0; // 运费利润率
      const totalProfit = productProfit + shippingProfit; // 总利润
      const profitRate = amountCny > 0 ? totalProfit / amountCny : 0; // 利润率

      await updateOrderItem(id, {
        ...data,
        amountCny: amountCny.toFixed(2),
        shippingCharged: shippingCharged.toFixed(2),
        productProfit: productProfit.toFixed(2),
        productProfitRate: productProfitRate.toFixed(6),
        shippingProfit: shippingProfit.toFixed(2),
        shippingProfitRate: shippingProfitRate.toFixed(6),
        totalProfit: totalProfit.toFixed(2),
        profitRate: profitRate.toFixed(6),
      });

      // 如果国内单号变更，自动重新订阅快递100推送
      if (data.domesticTrackingNo && data.domesticTrackingNo !== currentItem?.domesticTrackingNo) {
        const callbackUrl = "https://whatsappcrm-hh98jc4u.manus.space/api/kuaidi100/callback";
        subscribeTrackingNo(id, data.domesticTrackingNo, callbackUrl).catch(e =>
          console.warn("[Auto Subscribe] 更新时自动订阅失败:", e.message)
        );
      }

      await recalculateOrderTotals(orderId);
      return { success: true };
    }),

    delete: protectedProcedure.input(z.object({
      id: z.number(),
      orderId: z.number(),
    })).mutation(async ({ input }) => {
      await deleteOrderItem(input.id);
      await recalculateOrderTotals(input.orderId);
      return { success: true };
    }),

    bulkCreate: protectedProcedure.input(z.object({
      orderId: z.number(),
      items: z.array(z.object({
        orderNumber: z.string().optional(),
        size: z.string().optional(),
        domesticTrackingNo: z.string().optional(),
        sizeRecommendation: z.string().optional(),
        contactInfo: z.string().optional(),
        internationalTrackingNo: z.string().optional(),
        originalOrderNo: z.string().optional(),
        shipDate: z.string().optional(),
        quantity: z.number().optional(),
        source: z.string().optional(),
        itemStatus: z.string().optional(),
        amountUsd: z.string().optional(),
        sellingPrice: z.string().optional(),
        productCost: z.string().optional(),
        shippingActual: z.string().optional(),
        remarks: z.string().optional(),
        paymentStatus: z.string().optional(),
      })),
    })).mutation(async ({ input }) => {
      const rateObj = await getCurrentExchangeRate();
      const exchangeRateVal = parseFloat(String(rateObj.rate));
      const ids: number[] = [];

      for (const item of input.items) {
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
          orderId: input.orderId,
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

        // 自动订阅快递100推送（异步）
        if (item.domesticTrackingNo) {
          const callbackUrl = "https://whatsappcrm-hh98jc4u.manus.space/api/kuaidi100/callback";
          subscribeTrackingNo(id, item.domesticTrackingNo, callbackUrl).catch(e =>
            console.warn("[Auto Subscribe] bulkCreate 自动订阅失败:", e.message)
          );
        }
      }

      await recalculateOrderTotals(input.orderId);
      return { ids, count: ids.length };
    }),
  }),

  // ==================== File Upload ====================
  upload: router({
    image: protectedProcedure.input(z.object({
      base64: z.string(),
      filename: z.string(),
      contentType: z.string().default("image/jpeg"),
    })).mutation(async ({ input }) => {
      const buffer = Buffer.from(input.base64, "base64");
      const key = `orders/${nanoid()}-${input.filename}`;
      const { url } = await storagePut(key, buffer, input.contentType);
      return { url };
    }),
  }),

  // ==================== Statistics (Dashboard) ====================
  stats: router({
    overview: protectedProcedure.query(async ({ ctx }) => {
      const isAdmin = ctx.user.role === "admin";
      const staffId = isAdmin ? undefined : ctx.user.id;
      const [orderStats, customerStats, statusDist, paymentDist] = await Promise.all([
        getOrderStats(staffId),
        getCustomerStats(staffId),
        getOrderStatusDistribution(staffId),
        getPaymentStatusDistribution(staffId),
      ]);
      return { orderStats, customerStats, statusDist, paymentDist };
    }),

    staffPerformance: adminProcedure.query(() => getStaffPerformance()),

    recentOrders: protectedProcedure.input(z.object({
      limit: z.number().default(10),
    })).query(({ input, ctx }) => {
      const isAdmin = ctx.user.role === "admin";
      return getRecentOrders(input.limit, isAdmin ? undefined : ctx.user.id);
    }),

    dailyTrend: protectedProcedure.input(z.object({
      days: z.number().default(30),
    })).query(({ input, ctx }) => {
      const isAdmin = ctx.user.role === "admin";
      return getDailyOrderTrend(input.days, isAdmin ? undefined : ctx.user.id);
    }),
  }),

  // ==================== Audit Logs ====================
  auditLogs: router({
    list: adminProcedure.input(z.object({
      page: z.number().default(1),
      pageSize: z.number().default(20),
      userId: z.number().optional(),
      action: z.string().optional(),
      targetType: z.string().optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
    })).query(({ input }) => listAuditLogs(input)),
  }),

  // ==================== Order Export ====================
  export: router({
    orders: protectedProcedure.input(z.object({
      search: z.string().optional(),
      staffName: z.string().optional(),
      account: z.string().optional(),
      customerType: z.string().optional(),
      orderNumber: z.string().optional(),
      orderStatus: z.string().optional(),
      paymentStatus: z.string().optional(),
      customerWhatsapp: z.string().optional(),
      internationalTrackingNo: z.string().optional(),
      logisticsStatus: z.string().optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
    })).mutation(async ({ input, ctx }) => {
      const isAdmin = ctx.user.role === "admin";
      const data = await exportOrders({
        ...input,
        staffId: isAdmin ? undefined : ctx.user.id,
      });
      // Log the export action
      await createAuditLog({
        userId: ctx.user.id,
        userName: ctx.user.name || "未知",
        userRole: ctx.user.role,
        action: "export",
        targetType: "order",
        targetName: `导出 ${data.length} 条订单`,
        details: JSON.stringify({ filters: input, count: data.length }),
      });
      return data;
    }),
  }),

  // ==================== Exchange Rate Management ====================
  exchangeRate: router({
    current: protectedProcedure.query(async () => {
      return await getCurrentExchangeRate();
    }),
    list: adminProcedure.input(z.object({
      page: z.number().default(1),
      pageSize: z.number().default(20),
    }).optional()).query(async ({ input }) => {
      return await listExchangeRates(input?.page || 1, input?.pageSize || 20);
    }),
    update: adminProcedure.input(z.object({
      rate: z.number().min(0.0001).max(9999),
      reason: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      const current = await getCurrentExchangeRate();
      const result = await createExchangeRate({
        rate: String(input.rate),
        previousRate: current.rate,
        changedById: ctx.user.id,
        changedByName: ctx.user.name || "未知",
        reason: input.reason || undefined,
      });
      await logAction(ctx, "update", "exchangeRate", result.id, `汇率变更: ${current.rate} → ${input.rate}`, JSON.stringify({ previousRate: current.rate, newRate: input.rate, reason: input.reason }));
      return { id: result.id, rate: input.rate };
    }),
  }),

  // ==================== Profit Report ====================
  profitReport: router({
    summary: protectedProcedure.input(z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      staffName: z.string().optional(),
    }).optional()).query(async ({ input, ctx }) => {
      const isAdmin = ctx.user.role === "admin";
      // 客服只能看自己的数据，强制设置 staffName
      const staffName = isAdmin ? input?.staffName : (ctx.user.name || undefined);
      return await getProfitReport({
        startDate: input?.startDate,
        endDate: input?.endDate,
        staffName,
      });
    }),
    staffNames: protectedProcedure.query(async () => {
      return await getDistinctStaffNames();
    }),
    monthlyComparison: protectedProcedure.input(z.object({
      staffName: z.string().optional(),
    }).optional()).query(async ({ input, ctx }) => {
      const isAdmin = ctx.user.role === "admin";
      const staffName = isAdmin ? input?.staffName : (ctx.user.name || undefined);
      return await getMonthlyProfitComparison(staffName);
    }),
    quarterlyComparison: protectedProcedure.input(z.object({
      staffName: z.string().optional(),
    }).optional()).query(async ({ input, ctx }) => {
      const isAdmin = ctx.user.role === "admin";
      const staffName = isAdmin ? input?.staffName : (ctx.user.name || undefined);
      return await getQuarterlyProfitComparison(staffName);
    }),
    // Profit alert settings (admin only)
    alertSetting: adminProcedure.query(async () => {
      return await getProfitAlertSetting();
    }),
    updateAlertSetting: adminProcedure.input(z.object({
      minProfitRate: z.number().min(0).max(1),
      enabled: z.boolean(),
    })).mutation(async ({ input, ctx }) => {
      const result = await upsertProfitAlertSetting({
        minProfitRate: input.minProfitRate.toFixed(6),
        enabled: input.enabled ? 1 : 0,
        updatedById: ctx.user.id,
        updatedByName: ctx.user.name || "\u672a\u77e5",
      });
      await logAction(ctx, "update", "profitAlertSetting", result.id, `\u5229\u6da6\u9884\u8b66\u9608\u503c: ${(input.minProfitRate * 100).toFixed(1)}%`, JSON.stringify(input));
      return result;
    }),
    staffAlerts: adminProcedure.query(async () => {
      const setting = await getProfitAlertSetting();
      if (!setting.enabled) return { alerts: [], setting };
      const minRate = parseFloat(String(setting.minProfitRate));
      const alerts = await getStaffProfitAlerts(minRate);
      return { alerts, setting };
    }),
  }),

  // ==================== Staff Monthly Targets ====================
  staffTargets: router({
    // 客服可以查看目标列表（但前端会过滤只显示自己的）
    list: protectedProcedure.input(z.object({
      yearMonth: z.string().regex(/^\d{4}-\d{2}$/),
    })).query(async ({ input, ctx }) => {
      const allTargets = await listStaffMonthlyTargets(input.yearMonth);
      if (ctx.user.role === "admin") return allTargets;
      // 客服只能看自己的目标
      return allTargets.filter(t => t.staffId === ctx.user.id);
    }),
    // 设定目标仅管理员
    upsert: adminProcedure.input(z.object({
      staffId: z.number(),
      staffName: z.string().min(1),
      yearMonth: z.string().regex(/^\d{4}-\d{2}$/),
      profitTarget: z.number().min(0),
      revenueTarget: z.number().min(0),
    })).mutation(async ({ input, ctx }) => {
      const result = await upsertStaffMonthlyTarget({
        staffId: input.staffId,
        staffName: input.staffName,
        yearMonth: input.yearMonth,
        profitTarget: input.profitTarget.toFixed(2),
        revenueTarget: input.revenueTarget.toFixed(2),
        setById: ctx.user.id,
        setByName: ctx.user.name || "\u672a\u77e5",
      });
      await logAction(ctx, "upsert", "staffTarget", result.id, `${input.staffName} ${input.yearMonth}`, JSON.stringify(input));
      return result;
    }),
    // 删除目标仅管理员
    delete: adminProcedure.input(z.object({
      id: z.number(),
    })).mutation(async ({ input, ctx }) => {
      await deleteStaffMonthlyTarget(input.id);
      await logAction(ctx, "delete", "staffTarget", input.id);
      return { success: true };
    }),
    // 客服可以查看目标进度（但只能看自己的）
    progress: protectedProcedure.input(z.object({
      yearMonth: z.string().regex(/^\d{4}-\d{2}$/),
    })).query(async ({ input, ctx }) => {
      const allProgress = await getStaffTargetProgress(input.yearMonth);
      if (ctx.user.role === "admin") return allProgress;
      // 客服只能看自己的进度
      return allProgress.filter(p => p.staffId === ctx.user.id);
    }),
    // 客服列表仅管理员可见
    staffList: adminProcedure.query(async () => {
      return await getStaffList();
    }),
  }),

  // ==================== 每日数据 ====================
  dailyData: router({
    // 查询每日数据列表
    list: protectedProcedure.input(z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      staffName: z.string().optional(),
    })).query(async ({ input, ctx }) => {
      const isAdmin = ctx.user.role === "admin";
      const params: any = { ...input };
      if (!isAdmin) {
        // 客服只能看自己的数据
        params.staffId = ctx.user.id;
        params.staffName = ctx.user.name || undefined;
      }
      return await listDailyData(params);
    }),

    // 创建每日数据
    create: protectedProcedure.input(z.object({
      reportDate: z.string(),
      whatsAccount: z.string().optional(),
      messageCount: z.number().optional(),
      newCustomerCount: z.number().optional(),
      newIntentCount: z.number().optional(),
      returnVisitCount: z.number().optional(),
      newOrderCount: z.number().optional(),
      oldOrderCount: z.number().optional(),
      onlineOrderCount: z.number().optional(),
      itemCount: z.number().optional(),
      onlineRevenue: z.string().optional(),
      telegramPraiseCount: z.number().optional(),
      referralCount: z.number().optional(),
      // 管理员可以为其他客服创建
      staffId: z.number().optional(),
      staffName: z.string().optional(),
    })).mutation(async ({ input, ctx }) => {
      const isAdmin = ctx.user.role === "admin";
      const staffId = isAdmin && input.staffId ? input.staffId : ctx.user.id;
      const staffName = isAdmin && input.staffName ? input.staffName : (ctx.user.name || "未知");

      // 获取订单汇总数据（按 whatsAccount 匹配订单表的 account 字段）
      const account = input.whatsAccount || "";
      const summary = account
        ? await getDailyOrderSummary(account, input.reportDate)
        : { totalRevenue: "0", productSellingPrice: "0", shippingCharged: "0", estimatedProfit: "0" };
      const totalRev = parseFloat(summary.totalRevenue) || 0;
      const estProfit = parseFloat(summary.estimatedProfit) || 0;
      const profitRate = totalRev > 0 ? (estProfit / totalRev).toFixed(6) : "0";

      const result = await createDailyData({
        reportDate: new Date(input.reportDate),
        staffId,
        staffName,
        whatsAccount: input.whatsAccount || null,
        messageCount: input.messageCount ?? 0,
        newCustomerCount: input.newCustomerCount ?? 0,
        newIntentCount: input.newIntentCount ?? 0,
        returnVisitCount: input.returnVisitCount ?? 0,
        newOrderCount: input.newOrderCount ?? 0,
        oldOrderCount: input.oldOrderCount ?? 0,
        onlineOrderCount: input.onlineOrderCount ?? 0,
        itemCount: input.itemCount ?? 0,
        totalRevenue: summary.totalRevenue,
        onlineRevenue: input.onlineRevenue || "0",
        productSellingPrice: summary.productSellingPrice,
        shippingCharged: summary.shippingCharged,
        estimatedProfit: summary.estimatedProfit,
        estimatedProfitRate: profitRate,
        telegramPraiseCount: input.telegramPraiseCount ?? 0,
        referralCount: input.referralCount ?? 0,
      });

      await logAction(ctx, "create", "dailyData", result.id, `${staffName} ${input.reportDate}`);
      return result;
    }),

    // 更新每日数据
    update: protectedProcedure.input(z.object({
      id: z.number(),
      whatsAccount: z.string().optional(),
      messageCount: z.number().optional(),
      newCustomerCount: z.number().optional(),
      newIntentCount: z.number().optional(),
      returnVisitCount: z.number().optional(),
      newOrderCount: z.number().optional(),
      oldOrderCount: z.number().optional(),
      onlineOrderCount: z.number().optional(),
      itemCount: z.number().optional(),
      onlineRevenue: z.string().optional(),
      telegramPraiseCount: z.number().optional(),
      referralCount: z.number().optional(),
    })).mutation(async ({ input, ctx }) => {
      const existing = await getDailyDataById(input.id);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "记录不存在" });

      // 客服只能编辑自己的数据
      if (ctx.user.role !== "admin" && existing.staffId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "无权编辑其他客服的数据" });
      }

      const { id, ...updateData } = input;
      await updateDailyData(id, updateData);
      await logAction(ctx, "update", "dailyData", id);
      return { success: true };
    }),

    // 删除每日数据
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
      const existing = await getDailyDataById(input.id);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "记录不存在" });

      // 客服只能删除自己的数据
      if (ctx.user.role !== "admin" && existing.staffId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "无权删除其他客服的数据" });
      }

      await deleteDailyData(input.id);
      await logAction(ctx, "delete", "dailyData", input.id);
      return { success: true };
    }),

    // 同步订单汇总数据
    syncOrderData: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
      const existing = await getDailyDataById(input.id);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "记录不存在" });

      if (ctx.user.role !== "admin" && existing.staffId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "无权操作" });
      }

      if (!existing.whatsAccount) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "请先选择whats账号后再同步" });
      }
      // Normalize reportDate to YYYY-MM-DD format
      const reportDateStr = existing.reportDate instanceof Date
        ? existing.reportDate.toISOString().split('T')[0]
        : String(existing.reportDate).includes('T')
          ? String(existing.reportDate).split('T')[0]
          : String(existing.reportDate);
      return await syncOrderDataToDailyData(input.id, existing.whatsAccount, reportDateStr);
    }),

    // 获取订单表中所有不重复的 account 列表（用于 whats账号下拉选择）
    accountList: protectedProcedure.query(async () => {
      return await getDistinctOrderAccounts();
    }),

    // 日报表 - 管理员按客服维度，客服按账号维度
    report: protectedProcedure.input(z.object({
      reportDate: z.string(),
      staffName: z.string().optional(),
    })).query(async ({ input, ctx }) => {
      const isAdmin = ctx.user.role === "admin";
      if (isAdmin) {
        // 管理员：按客服维度汇总（合并同一客服的所有账号数据）
        const staffFilter = input.staffName || undefined;
        return await getDailyReportByStaff(input.reportDate, staffFilter);
      } else {
        // 客服：按账号维度展示（每行一个账号的数据）
        const staffName = ctx.user.name || "";
        return await getDailyReportByAccount(input.reportDate, staffName);
      }
    }),

    // 管理员下钻 - 查看某个客服下所有账号的明细数据
    drillDown: adminProcedure.input(z.object({
      reportDate: z.string(),
      staffName: z.string(),
    })).query(async ({ input }) => {
      return await getDailyReportDrillDown(input.reportDate, input.staffName);
    }),

    // 获取客服列表（仅管理员）
    staffList: adminProcedure.query(async () => {
      return await getStaffList();
    }),

    // 日报表备注 CRUD
    notesList: protectedProcedure.input(z.object({
      reportDate: z.string(),
    })).query(async ({ input }) => {
      return await listDailyReportNotes(input.reportDate);
    }),

    createNote: protectedProcedure.input(z.object({
      reportDate: z.string(),
      content: z.string().min(1, "备注内容不能为空"),
    })).mutation(async ({ input, ctx }) => {
      // Use SQL string directly to avoid timezone issues with new Date()
      return await createDailyReportNote({
        reportDate: input.reportDate,
        userId: ctx.user.id,
        userName: ctx.user.name || "未知",
        userRole: ctx.user.role,
        content: input.content,
      });
    }),

    updateNote: protectedProcedure.input(z.object({
      id: z.number(),
      content: z.string().min(1, "备注内容不能为空"),
    })).mutation(async ({ input, ctx }) => {
      const note = await getDailyReportNoteById(input.id);
      if (!note) throw new TRPCError({ code: "NOT_FOUND", message: "备注不存在" });
      // 只能编辑自己的备注，除非是管理员
      if (note.userId !== ctx.user.id && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "无权编辑他人的备注" });
      }
      return await updateDailyReportNote(input.id, input.content);
    }),

    deleteNote: protectedProcedure.input(z.object({
      id: z.number(),
    })).mutation(async ({ input, ctx }) => {
      const note = await getDailyReportNoteById(input.id);
      if (!note) throw new TRPCError({ code: "NOT_FOUND", message: "备注不存在" });
      // 只能删除自己的备注，除非是管理员
      if (note.userId !== ctx.user.id && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "无权删除他人的备注" });
      }
      return await deleteDailyReportNote(input.id);
    }),
  }),

  // ==================== 账号管理 ====================
  accounts: router({
    list: protectedProcedure.query(async () => {
      return await listAccounts();
    }),

    create: adminProcedure.input(z.object({
      name: z.string().min(1, "账号名称不能为空"),
      color: z.string().optional(),
      sortOrder: z.number().optional(),
    })).mutation(async ({ input, ctx }) => {
      const result = await createAccount(input);
      await logAction(ctx, "create", "account", result.id, input.name, JSON.stringify(input));
      return result;
    }),

    update: adminProcedure.input(z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      color: z.string().optional(),
      sortOrder: z.number().optional(),
    })).mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      const result = await updateAccount(id, data);
      await logAction(ctx, "update", "account", id, input.name, JSON.stringify(data));
      return result;
    }),

    delete: adminProcedure.input(z.object({
      id: z.number(),
    })).mutation(async ({ input, ctx }) => {
      const result = await deleteAccount(input.id);
      await logAction(ctx, "delete", "account", input.id);
      return result;
    }),

    reorder: adminProcedure.input(z.object({
      items: z.array(z.object({ id: z.number(), sortOrder: z.number() })),
    })).mutation(async ({ input, ctx }) => {
      const result = await reorderAccounts(input.items);
      await logAction(ctx, "update", "account", undefined, "批量排序", JSON.stringify(input.items));
      return result;
    }),
  }),
});

// ==================== Audit Log Helper for Routers ====================
// Call this in mutation handlers to log actions
export async function logAction(ctx: { user: { id: number; name: string | null; role: string } }, action: string, targetType: string, targetId?: number, targetName?: string, details?: string) {
  await createAuditLog({
    userId: ctx.user.id,
    userName: ctx.user.name || "未知",
    userRole: ctx.user.role,
    action,
    targetType,
    targetId: targetId ?? undefined,
    targetName: targetName ?? undefined,
    details: details ?? undefined,
  });
}

export type AppRouter = typeof appRouter;
