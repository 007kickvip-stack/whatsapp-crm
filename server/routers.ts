import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, adminProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  listUsers, updateUserRole, deleteUser, hardDeleteUser, restoreUser, getUserById, createUser,
  getUserByUsername, verifyPassword, updateUserPassword, updateUserUsername, updateUserHireDate,
  createCustomer, updateCustomer, deleteCustomer, getCustomerById, getCustomerByWhatsapp, listCustomers, syncCustomerStats, syncCustomerFromOrder, getCustomerOrderHistory, getCustomerOrderList,
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
  getDashboardSummary, getStaffRevenueRanking, getMonthlyNewOldCustomerRate,
  getAccountRevenue, getMonthlyRevenue, getStaffMonthlyRevenue,
  getCustomerTypeDistribution, getCustomerTierDistribution,
  getOrderCategoryDistribution, getCountryDistribution,
  createQuotation, updateQuotation, deleteQuotation, getQuotationById, getQuotationWithItems, listQuotations, recalculateQuotationTotals,
  createQuotationItem, updateQuotationItem, deleteQuotationItem, getQuotationItemsByQuotationId,
  getCurrentExchangeRate as getExchangeRateForQuotation,
  createPaypalIncome, updatePaypalIncome, deletePaypalIncome, listPaypalIncome,
  createPaypalExpense, updatePaypalExpense, deletePaypalExpense, listPaypalExpense,
  getPaypalBalanceSummary, syncOrdersToPaypalIncome,
  syncOrderToPaypalIncome, updatePaypalIncomeFromOrder, deletePaypalIncomeByOrderId,
  syncPaymentToPaypalIncome, updatePaypalIncomeFromPayment, deletePaypalIncomeByPaymentId,
  getPaypalIncomeOrderId, repairPaypalIncomeSync, syncActualReceivedToOrder,
  createReshipment, updateReshipment, deleteReshipment, getReshipmentById, listReshipments, getReshipmentsByOriginalOrderId,
  createOrderPayment, updateOrderPayment, deleteOrderPayment, getOrderPaymentsByOrderId, getOrderPaymentById,
  updateUserBaseSalary, updateUserEmploymentInfo,
  listCommissionRules, getActiveCommissionRules, createCommissionRule, updateCommissionRule, deleteCommissionRule, getCommissionRuleById,
  getSalaryReport,
  getSalaryHistory,
  listBonusRules, getActiveBonusRules, createBonusRule, updateBonusRule, deleteBonusRule,
  upsertSalaryAdjustment, listSalaryAdjustments, getSalaryAdjustment,
  updateOrderCompletionStatus, batchUpdateOrderCompletionStatus,
  getSocialInsuranceCost, upsertSocialInsuranceCost, listSocialInsuranceCosts,
  getReshipmentProfitLoss, getSalaryTotalForPeriod, getSocialInsuranceTotalForPeriod,
  listAnnualTargets, upsertAnnualTarget, deleteAnnualTarget, getAnnualTargetProgress,
  recalculateAllItemProfitRates,
  upsertUser,
} from "./db";
import type { SQL } from "drizzle-orm";
import { sdk } from "./_core/sdk";
import { ONE_YEAR_MS } from "@shared/const";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";
import { subscribeTrackingNo, getCallbackUrl } from "./trackingProxy";
import { generateCaptcha, verifyCaptcha } from "./captcha";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
    getCaptcha: publicProcedure.query(() => {
      const { token, svg } = generateCaptcha();
      return { token, svg };
    }),
    loginWithPassword: publicProcedure.input(z.object({
      username: z.string().min(1),
      password: z.string().min(1),
      captchaToken: z.string().min(1),
      captchaCode: z.string().min(1),
    })).mutation(async ({ input, ctx }) => {
      // Verify captcha first
      if (!verifyCaptcha(input.captchaToken, input.captchaCode)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "验证码错误或已过期" });
      }
      const user = await getUserByUsername(input.username);
      if (!user || !user.password) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "用户名或密码错误" });
      }
      // Check if user is soft-deleted
      if (user.deletedAt) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "该账号已被禁用" });
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
      // Update lastSignedIn to mark session as valid (after potential password change)
      await upsertUser({ openId: user.openId, lastSignedIn: new Date() });
      return { success: true, user: { id: user.id, name: user.name, role: user.role } };
    }),
  }),

  // ==================== User Management (Admin Only) ====================
  users: router({
    list: adminProcedure.input(z.object({
      page: z.number().default(1),
      pageSize: z.number().default(20),
      includeDisabled: z.boolean().default(true),
    })).query(({ input }) => listUsers(input.page, input.pageSize, input.includeDisabled)),

    getById: adminProcedure.input(z.object({ id: z.number() })).query(({ input }) => getUserById(input.id)),

    updateRole: adminProcedure.input(z.object({
      userId: z.number(),
      role: z.enum(["user", "admin"]),
    })).mutation(({ input }) => updateUserRole(input.userId, input.role)),

    delete: adminProcedure.input(z.object({ userId: z.number() })).mutation(({ input }) => deleteUser(input.userId)),

    restore: adminProcedure.input(z.object({ userId: z.number() })).mutation(({ input }) => restoreUser(input.userId)),

    hardDelete: adminProcedure.input(z.object({ userId: z.number() })).mutation(async ({ input, ctx }) => {
      // Only allow hard delete of disabled users (not self)
      if (input.userId === ctx.user.id) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '不能删除自己的账号' });
      }
      const target = await getUserById(input.userId);
      if (!target) throw new TRPCError({ code: 'NOT_FOUND', message: '用户不存在' });
      if (!target.deletedAt) throw new TRPCError({ code: 'BAD_REQUEST', message: '只能删除已禁用的用户' });
      await hardDeleteUser(input.userId);
    }),

    create: adminProcedure.input(z.object({
      name: z.string().min(1),
      email: z.string().optional(),
      username: z.string().min(2).optional(),
      password: z.string().min(4).optional(),
      role: z.enum(["user", "admin"]).default("user"),
      hireDate: z.string().optional(),
      baseSalary: z.string().optional(),
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

    updateBaseSalary: adminProcedure.input(z.object({
      userId: z.number(),
      baseSalary: z.string(),
    })).mutation(async ({ input }) => {
      await updateUserBaseSalary(input.userId, input.baseSalary);
      return { success: true };
    }),

    updateEmploymentInfo: adminProcedure.input(z.object({
      userId: z.number(),
      employmentStatus: z.enum(['probation', 'regular']).optional(),
      probationBaseSalary: z.string().optional(),
      regularBaseSalary: z.string().optional(),
      regularDate: z.string().nullable().optional(),
    })).mutation(async ({ input }) => {
      const { userId, ...data } = input;
      await updateUserEmploymentInfo(userId, data);
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
      pageSize: z.number().default(50),
      search: z.string().optional(),
      staffName: z.string().optional(),
      account: z.string().optional(),
      customerType: z.string().optional(),
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
      staffName: z.string().optional(),
      account: z.string().optional(),
      contactInfo: z.string().optional(),
      orderCategory: z.string().optional(),
      customerName: z.string().optional(),
      birthDate: z.string().optional(),
      customerEmail: z.string().optional(),
      customerTier: z.string().optional(),
      wpEntryDate: z.string().optional(),
    })).mutation(async ({ input, ctx }) => {
      const id = await createCustomer({ ...input, createdById: ctx.user.id } as any);
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
      staffName: z.string().optional(),
      account: z.string().optional(),
      contactInfo: z.string().optional(),
      orderCategory: z.string().optional(),
      customerName: z.string().optional(),
      birthDate: z.string().optional(),
      customerEmail: z.string().optional(),
      customerTier: z.string().optional(),
      wpEntryDate: z.string().optional(),
    })).mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      await updateCustomer(id, data as any);
      await logAction(ctx, "update", "customer", id, undefined, JSON.stringify(data));
      return { success: true };
    }),

    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
      await deleteCustomer(input.id);
      await logAction(ctx, "delete", "customer", input.id);
      return { success: true };
    }),

    syncStats: protectedProcedure.input(z.object({
      customerId: z.number().optional(),
    })).mutation(async ({ input }) => {
      await syncCustomerStats(input.customerId);
      return { success: true };
    }),

    orderHistory: protectedProcedure.input(z.object({
      customerId: z.number(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    })).query(({ input }) => getCustomerOrderHistory(input.customerId, input.startDate, input.endDate)),

    orderList: protectedProcedure.input(z.object({
      customerId: z.number(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    })).query(({ input }) => getCustomerOrderList(input.customerId, input.startDate, input.endDate)),
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
      customerCountry: z.string().optional(),
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
      // 客户关联字段
      customerName: z.string().optional(),
      customerCountry: z.string().optional(),
      customerTier: z.string().optional(),
      orderCategory: z.string().optional(),
      customerBirthDate: z.string().optional(),
      customerEmail: z.string().optional(),
      wpEntryDate: z.string().optional(),
    })).mutation(async ({ input, ctx }) => {
      const { orderDate, ...rest } = input;
      const staffName = ctx.user.name || "未知客服";
      const id = await createOrder({
        ...rest,
        orderDate: orderDate ? new Date(orderDate) : null,
        customerBirthDate: rest.customerBirthDate ? new Date(rest.customerBirthDate) : null,
        staffId: ctx.user.id,
        staffName,
      } as any);
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
      // 自动同步客户数据（创建新客户或更新现有客户）
      await syncCustomerFromOrder({
        customerWhatsapp: rest.customerWhatsapp,
        customerName: rest.customerName,
        staffName,
        account: rest.account,
        customerType: rest.customerType,
        customerCountry: rest.customerCountry,
        customerTier: rest.customerTier,
        orderCategory: rest.orderCategory,
        customerBirthDate: rest.customerBirthDate,
        customerEmail: rest.customerEmail,
        staffId: ctx.user.id,
      });
      // 自动同步到PayPal收入表
      await syncOrderToPaypalIncome(id, ctx.user.id);
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
      paymentAmount: z.string().optional(),
      receivingAccount: z.string().optional(),
      remarks: z.string().optional(),
      // 客户关联字段
      customerName: z.string().optional(),
      customerCountry: z.string().optional(),
      customerTier: z.string().optional(),
      orderCategory: z.string().optional(),
      customerBirthDate: z.string().optional(),
      customerEmail: z.string().optional(),
      wpEntryDate: z.string().optional(),
    })).mutation(async ({ input, ctx }) => {
      // 客服只能编辑自己的订单
      if (ctx.user.role !== 'admin') {
        const order = await getOrderById(input.id);
        if (!order || order.staffId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: '您只能编辑自己的订单' });
        }
      }
      const { id, orderDate, customerBirthDate, ...data } = input;
      await updateOrder(id, {
        ...data,
        ...(orderDate !== undefined ? { orderDate: orderDate ? new Date(orderDate) : null } : {}),
        ...(customerBirthDate !== undefined ? { customerBirthDate: customerBirthDate ? new Date(customerBirthDate) : null } : {}),
      } as any);
      // 订单更新后自动同步客户数据
      const updatedOrder = await getOrderById(id);
      if (updatedOrder) {
        await syncCustomerFromOrder({
          customerWhatsapp: updatedOrder.customerWhatsapp,
          customerName: updatedOrder.customerName || undefined,
          staffName: updatedOrder.staffName || undefined,
          account: updatedOrder.account || undefined,
          customerType: updatedOrder.customerType || undefined,
          customerCountry: updatedOrder.customerCountry || undefined,
          customerTier: updatedOrder.customerTier || undefined,
          orderCategory: updatedOrder.orderCategory || undefined,
          customerBirthDate: updatedOrder.customerBirthDate ? String(updatedOrder.customerBirthDate) : undefined,
          customerEmail: updatedOrder.customerEmail || undefined,
          staffId: updatedOrder.staffId,
        });
      }
      // 订单更新时同步更新对应的PayPal收入记录
      await updatePaypalIncomeFromOrder(id);
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
      // 删除订单时清理对应的PayPal收入记录
      await deletePaypalIncomeByOrderId(input.id);
      await deleteOrder(input.id);
      await logAction(ctx, "delete", "order", input.id);
      return { success: true };
    }),

    // 批量删除订单
    batchDelete: adminProcedure.input(z.object({
      orderIds: z.array(z.number()).min(1).max(200),
    })).mutation(async ({ input, ctx }) => {
      let deleted = 0;
      for (const id of input.orderIds) {
        await deletePaypalIncomeByOrderId(id);
        await deleteOrder(id);
        await logAction(ctx, "delete", "order", id);
        deleted++;
      }
      return { deleted };
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
        // 自动同步到PayPal收入表
        await syncOrderToPaypalIncome(orderId, ctx.user.id);
        results.push({ orderId, orderNumber: first.orderNumber });
      }

      await logAction(ctx, "import", "order", undefined, `批量导入 ${results.length} 个订单`, JSON.stringify({ count: results.length, orderNumbers: results.map(r => r.orderNumber) }));
      return { success: true, imported: results.length, orders: results };
    }),

    recalculateAllProfitRates: adminProcedure.mutation(async ({ ctx }) => {
      const result = await recalculateAllItemProfitRates();
      await createAuditLog({
        userId: ctx.user.id,
        userName: ctx.user.name || "未知",
        userRole: ctx.user.role,
        action: "update",
        targetType: "order",
        targetName: `批量重算利润率: 更新${result.updated}条子项`,
        details: JSON.stringify(result),
      });
      return result;
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

      // 如果联系方式变更，同步到客户表
      if (data.contactInfo) {
        const order = await getOrderById(orderId);
        if (order && order.customerWhatsapp) {
          await syncCustomerFromOrder({
            customerWhatsapp: order.customerWhatsapp,
            customerName: order.customerName || undefined,
            contactInfo: data.contactInfo,
          });
        }
      }

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

    // ===== Dashboard V2 =====
    dashboardV2: protectedProcedure.input(z.object({
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      staffId: z.number().optional(),
    }).optional()).query(async ({ input, ctx }) => {
      const isAdmin = ctx.user.role === "admin";
      // 管理员可选择查看某个客服的数据，客服只能看自己的
      const staffId = isAdmin ? (input?.staffId || undefined) : ctx.user.id;
      const filters = { dateFrom: input?.dateFrom, dateTo: input?.dateTo, staffId };
      const [summary, staffRanking, monthlyNewOld, accountRevenue, monthlyRevenue, staffMonthlyRevenue, customerTypeDist, customerTierDist, orderCategoryDist, countryDist] = await Promise.all([
        getDashboardSummary(filters),
        getStaffRevenueRanking(filters),
        getMonthlyNewOldCustomerRate(filters),
        getAccountRevenue(filters),
        getMonthlyRevenue(filters),
        getStaffMonthlyRevenue(filters),
        getCustomerTypeDistribution(filters),
        getCustomerTierDistribution(filters),
        getOrderCategoryDistribution(filters),
        getCountryDistribution(filters),
      ]);
      return { summary, staffRanking, monthlyNewOld, accountRevenue, monthlyRevenue, staffMonthlyRevenue, customerTypeDist, customerTierDist, orderCategoryDist, countryDist };
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
    // 获取利润报表额外数据：补发盈亏、人员工资、人工社保
    extraData: protectedProcedure.input(z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      staffName: z.string().optional(),
    }).optional()).query(async ({ input, ctx }) => {
      const isAdmin = ctx.user.role === "admin";
      const staffName = isAdmin ? input?.staffName : (ctx.user.name || undefined);
      // 补发表盈亏
      const reshipmentData = await getReshipmentProfitLoss({
        startDate: input?.startDate,
        endDate: input?.endDate,
        staffName,
      });
      // 人员工资（仅管理员可见）
      let salaryTotal = 0;
      if (isAdmin) {
        const salaryData = await getSalaryTotalForPeriod({
          startDate: input?.startDate,
          endDate: input?.endDate,
        });
        salaryTotal = salaryData.totalSalary;
      }
      // 人工社保（仅管理员可见）
      let insuranceTotal = "0";
      if (isAdmin) {
        const insuranceData = await getSocialInsuranceTotalForPeriod({
          startDate: input?.startDate,
          endDate: input?.endDate,
        });
        insuranceTotal = insuranceData.totalAmount;
      }
      return {
        reshipmentProfitLoss: reshipmentData.totalProfitLoss,
        reshipmentCount: reshipmentData.count,
        salaryTotal,
        insuranceTotal,
      };
    }),
    // 社保费用管理（管理员）
    getSocialInsurance: adminProcedure.input(z.object({
      yearMonth: z.string().regex(/^\d{4}-\d{2}$/),
    })).query(async ({ input }) => {
      return await getSocialInsuranceCost(input.yearMonth);
    }),
    upsertSocialInsurance: adminProcedure.input(z.object({
      yearMonth: z.string().regex(/^\d{4}-\d{2}$/),
      amount: z.number().min(0),
      remark: z.string().optional(),
    })).mutation(async ({ input, ctx }) => {
      const id = await upsertSocialInsuranceCost({
        yearMonth: input.yearMonth,
        amount: input.amount,
        remark: input.remark,
        createdById: ctx.user.id,
        createdByName: ctx.user.name || "未知",
      });
      await logAction(ctx, "update", "socialInsurance", id ?? 0, `社保费用 ${input.yearMonth}: ¥${input.amount}`, JSON.stringify(input));
      return { id };
    }),
    listSocialInsurance: adminProcedure.query(async () => {
      return await listSocialInsuranceCosts();
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
    // 客服可以查看目标进度（客服看自己的详情 + 团队汇总）
    progress: protectedProcedure.input(z.object({
      yearMonth: z.string().regex(/^\d{4}-\d{2}$/),
    })).query(async ({ input, ctx }) => {
      const allProgress = await getStaffTargetProgress(input.yearMonth);
      if (ctx.user.role === "admin") {
        return { details: allProgress, teamSummary: null };
      }
      // 客服：计算团队汇总，但详情只返回自己的
      const teamSummary = {
        totalProfitTarget: allProgress.reduce((s: number, p: any) => s + parseFloat(p.profitTarget), 0),
        totalActualProfit: allProgress.reduce((s: number, p: any) => s + parseFloat(p.actualProfit), 0),
        totalRevenueTarget: allProgress.reduce((s: number, p: any) => s + parseFloat(p.revenueTarget), 0),
        totalActualRevenue: allProgress.reduce((s: number, p: any) => s + parseFloat(p.actualRevenue), 0),
      };
      const myProgress = allProgress.filter(p => p.staffId === ctx.user.id);
      return { details: myProgress, teamSummary };
    }),
    // 客服列表仅管理员可见
    staffList: adminProcedure.query(async () => {
      return await getStaffList();
    }),
  }),

  // ==================== 年度目标管理 ====================
  annualTargets: router({
    list: protectedProcedure.input(z.object({
      year: z.number().int().min(2020).max(2100),
    })).query(async ({ input, ctx }) => {
      const allTargets = await listAnnualTargets(input.year);
      if (ctx.user.role === "admin") return allTargets;
      // 客服只能看到团队目标和自己的个人目标
      return allTargets.filter(t => t.type === "team" || t.staffId === ctx.user.id);
    }),

    upsert: adminProcedure.input(z.object({
      year: z.number().int().min(2020).max(2100),
      type: z.enum(["team", "individual"]),
      staffId: z.number().optional(),
      staffName: z.string().optional(),
      profitTarget: z.number().min(0),
      revenueTarget: z.number().min(0),
    })).mutation(async ({ input, ctx }) => {
      if (input.type === "individual" && !input.staffId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "个人目标必须指定客服" });
      }
      const result = await upsertAnnualTarget({
        year: input.year,
        type: input.type,
        staffId: input.staffId ?? null,
        staffName: input.staffName ?? null,
        profitTarget: input.profitTarget.toFixed(2),
        revenueTarget: input.revenueTarget.toFixed(2),
        setById: ctx.user.id,
        setByName: ctx.user.name || "未知",
      });
      await logAction(ctx, "upsert", "annualTarget", result.id, `${input.type} ${input.year}${input.staffName ? " " + input.staffName : ""}`, JSON.stringify(input));
      return result;
    }),

    delete: adminProcedure.input(z.object({
      id: z.number(),
    })).mutation(async ({ input, ctx }) => {
      await deleteAnnualTarget(input.id);
      await logAction(ctx, "delete", "annualTarget", input.id);
      return { success: true };
    }),

    progress: protectedProcedure.input(z.object({
      year: z.number().int().min(2020).max(2100),
    })).query(async ({ input, ctx }) => {
      const result = await getAnnualTargetProgress(input.year);
      if (ctx.user.role === "admin") return result;
      // 客服：团队目标可见，个人只看自己的
      return {
        team: result.team,
        individuals: result.individuals.filter(i => i.staffId === ctx.user.id),
      };
    }),
  }),

  // ==================== 提成制度管理 ====================
  commissionRules: router({
    list: adminProcedure.query(async () => {
      return await listCommissionRules();
    }),

    activeList: protectedProcedure.query(async () => {
      return await getActiveCommissionRules();
    }),

    create: adminProcedure.input(z.object({
      name: z.string().min(1),
      minAmount: z.string(),
      maxAmount: z.string().nullable().optional(),
      commissionRate: z.string(),
      commissionType: z.enum(["revenue", "profit", "profitRate"]).optional(),
      sortOrder: z.number().optional(),
    })).mutation(async ({ input, ctx }) => {
      const result = await createCommissionRule({
        ...input,
        createdById: ctx.user.id,
        createdByName: ctx.user.name || "未知",
      });
      return result;
    }),

    update: adminProcedure.input(z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      minAmount: z.string().optional(),
      maxAmount: z.string().nullable().optional(),
      commissionRate: z.string().optional(),
      commissionType: z.enum(["revenue", "profit", "profitRate"]).optional(),
      sortOrder: z.number().optional(),
      isActive: z.number().optional(),
    })).mutation(async ({ input }) => {
      const { id, ...data } = input;
      await updateCommissionRule(id, data);
      return { success: true };
    }),

    delete: adminProcedure.input(z.object({
      id: z.number(),
    })).mutation(async ({ input }) => {
      await deleteCommissionRule(input.id);
      return { success: true };
    }),
  }),

  // ==================== 高利润单特别奖励规则 ====================
  bonusRules: router({
    list: adminProcedure.query(async () => {
      return await listBonusRules();
    }),

    activeList: protectedProcedure.query(async () => {
      return await getActiveBonusRules();
    }),

    create: adminProcedure.input(z.object({
      name: z.string().min(1),
      profitThreshold: z.string(),
      bonusAmount: z.string(),
      sortOrder: z.number().optional(),
    })).mutation(async ({ input, ctx }) => {
      return await createBonusRule({
        ...input,
        createdById: ctx.user.id,
        createdByName: ctx.user.name || "未知",
      });
    }),

    update: adminProcedure.input(z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      profitThreshold: z.string().optional(),
      bonusAmount: z.string().optional(),
      sortOrder: z.number().optional(),
      isActive: z.number().optional(),
    })).mutation(async ({ input }) => {
      const { id, ...data } = input;
      await updateBonusRule(id, data);
      return { success: true };
    }),

    delete: adminProcedure.input(z.object({
      id: z.number(),
    })).mutation(async ({ input }) => {
      await deleteBonusRule(input.id);
      return { success: true };
    }),
  }),

  // ==================== 工资报表 ====================
  salaryReport: router({
    // 获取指定月份的工资报表
    get: adminProcedure.input(z.object({
      yearMonth: z.string().regex(/^\d{4}-\d{2}$/),
    })).query(async ({ input }) => {
      return await getSalaryReport(input.yearMonth);
    }),

    // 获取多月份工资报表（汇总）
    getMulti: adminProcedure.input(z.object({
      yearMonths: z.array(z.string().regex(/^\d{4}-\d{2}$/)).min(1).max(12),
    })).query(async ({ input }) => {
      const allReports = await Promise.all(
        input.yearMonths.map(ym => getSalaryReport(ym))
      );
      // 按staffId汇总
      const staffMap = new Map<number, any>();
      for (const report of allReports) {
        for (const row of report) {
          const existing = staffMap.get(row.staffId);
          if (existing) {
            existing.totalRevenue += row.totalRevenue;
            existing.orderCount += row.orderCount;
            existing.productProfit += row.productProfit;
            existing.shippingProfit += row.shippingProfit;
            existing.totalProfit += row.totalProfit;
            existing.commission += row.commission;
            existing.revenueCommission += row.revenueCommission;
            existing.profitCommission += row.profitCommission;
            existing.profitRateCommission += row.profitRateCommission;
            existing.highProfitBonus += row.highProfitBonus;
            existing.highProfitOrderCount += row.highProfitOrderCount;
            existing.profitDeduction += row.profitDeduction;
            existing.bonus += row.bonus;
            existing.onlineCommission += row.onlineCommission;
            existing.performanceDeduction += row.performanceDeduction;
            existing.totalSalary += row.totalSalary;
            existing.monthCount += 1;
            // 合并提成明细
            if (row.commissionDetails) {
              existing.commissionDetails = [...(existing.commissionDetails || []), ...row.commissionDetails];
            }
          } else {
            staffMap.set(row.staffId, { ...row, monthCount: 1 });
          }
        }
      }
      return Array.from(staffMap.values()).map((r: any) => ({
        ...r,
        commission: Math.round(r.commission * 100) / 100,
        revenueCommission: Math.round(r.revenueCommission * 100) / 100,
        profitCommission: Math.round(r.profitCommission * 100) / 100,
        profitRateCommission: Math.round(r.profitRateCommission * 100) / 100,
        highProfitBonus: Math.round(r.highProfitBonus * 100) / 100,
        profitDeduction: Math.round(r.profitDeduction * 100) / 100,
        bonus: Math.round(r.bonus * 100) / 100,
        onlineCommission: Math.round(r.onlineCommission * 100) / 100,
        performanceDeduction: Math.round(r.performanceDeduction * 100) / 100,
        totalSalary: Math.round(r.totalSalary * 100) / 100,
      }));
    }),

    // 获取历史工资数据（用于图表）
    history: adminProcedure.input(z.object({
      months: z.number().min(1).max(24).optional(),
      staffId: z.number().optional(),
    })).query(async ({ input }) => {
      const months = input.months || 6;
      return await getSalaryHistory(months, input.staffId);
    }),

    // 获取指定月份的工资调整项
    getAdjustments: adminProcedure.input(z.object({
      yearMonth: z.string().regex(/^\d{4}-\d{2}$/),
    })).query(async ({ input }) => {
      return await listSalaryAdjustments(input.yearMonth);
    }),

    // 获取单个客服的工资调整项
    getAdjustment: adminProcedure.input(z.object({
      staffId: z.number(),
      yearMonth: z.string().regex(/^\d{4}-\d{2}$/),
    })).query(async ({ input }) => {
      return await getSalaryAdjustment(input.staffId, input.yearMonth);
    }),

    // 创建或更新工资调整项（仅管理员）
    upsertAdjustment: adminProcedure.input(z.object({
      staffId: z.number(),
      yearMonth: z.string().regex(/^\d{4}-\d{2}$/),
      profitDeduction: z.string().optional(),
      bonus: z.string().optional(),
      onlineCommission: z.string().optional(),
      performanceDeduction: z.string().optional(),
      remark: z.string().optional(),
    })).mutation(async ({ input, ctx }) => {
      return await upsertSalaryAdjustment({
        ...input,
        createdById: ctx.user.id,
        createdByName: ctx.user.name || '未知',
      });
    }),
  }),

  // ==================== 订单完成状态 ====================
  orderCompletion: router({
    // 更新单个订单完成状态
    update: adminProcedure.input(z.object({
      orderId: z.number(),
      completionStatus: z.string(),
    })).mutation(async ({ input }) => {
      return await updateOrderCompletionStatus(input.orderId, input.completionStatus);
    }),

    // 批量更新订单完成状态
    batchUpdate: adminProcedure.input(z.object({
      orderIds: z.array(z.number()),
      completionStatus: z.string(),
    })).mutation(async ({ input }) => {
      return await batchUpdateOrderCompletionStatus(input.orderIds, input.completionStatus);
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

  // ==================== Quotation Routes ====================
  quotations: router({
    list: protectedProcedure.input(z.object({
      page: z.number().default(1),
      pageSize: z.number().default(50),
      search: z.string().optional(),
    })).query(({ input, ctx }) => {
      const isAdmin = ctx.user.role === "admin";
      return listQuotations({
        ...input,
        staffId: isAdmin ? undefined : ctx.user.id,
      });
    }),

    getById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      return getQuotationWithItems(input.id);
    }),

    create: protectedProcedure.input(z.object({
      customerName: z.string().min(1),
      contactInfo: z.string().optional(),
      account: z.string().optional(),
      customerWhatsapp: z.string().optional(),
      remarks: z.string().optional(),
    })).mutation(async ({ input, ctx }) => {
      const staffName = ctx.user.name || "未知客服";
      const id = await createQuotation({
        customerName: input.customerName,
        contactInfo: input.contactInfo || null,
        account: input.account || null,
        customerWhatsapp: input.customerWhatsapp || null,
        remarks: input.remarks || null,
        staffId: ctx.user.id,
        staffName,
      });
      // Auto-create one empty item
      await createQuotationItem({ quotationId: id });
      await logAction(ctx, "create", "quotation", id, input.customerName);
      return { id };
    }),

    update: protectedProcedure.input(z.object({
      id: z.number(),
      customerName: z.string().optional(),
      contactInfo: z.string().optional(),
      staffName: z.string().optional(),
      account: z.string().optional(),
      customerWhatsapp: z.string().optional(),
      status: z.string().optional(),
      remarks: z.string().optional(),
    })).mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      await updateQuotation(id, data as any);
      await logAction(ctx, "update", "quotation", id, undefined, JSON.stringify(data));
      return { success: true };
    }),

    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
      await deleteQuotation(input.id);
      await logAction(ctx, "delete", "quotation", input.id);
      return { success: true };
    }),

    // 一键同步到订单管理
    syncToOrder: protectedProcedure.input(z.object({
      quotationId: z.number(),
    })).mutation(async ({ input, ctx }) => {
      const quotation = await getQuotationWithItems(input.quotationId);
      if (!quotation) throw new TRPCError({ code: "NOT_FOUND", message: "报价表不存在" });
      const staffName = ctx.user.name || "未知客服";
      const customerWhatsapp = quotation.customerWhatsapp || quotation.contactInfo || quotation.customerName || "未知客户";
      // Create order
      const orderId = await createOrder({
        orderDate: new Date(),
        staffName: quotation.staffName || staffName,
        staffId: ctx.user.id,
        account: quotation.account || null,
        customerWhatsapp,
        customerName: quotation.customerName,
        orderNumber: `Q${quotation.id}-${Date.now().toString(36)}`,
        orderStatus: "已报货，待发货",
        paymentStatus: "未付款",
        remarks: quotation.remarks,
      } as any);
      // Create order items from quotation items
      const items = quotation.items || [];
      for (const item of items) {
        await createOrderItem({
          orderId,
          orderImageUrl: item.orderImageUrl,
          size: item.size,
          quantity: item.quantity,
          amountUsd: String(item.amountUsd || "0"),
          amountCny: String(item.amountCny || "0"),
          sellingPrice: String(item.sellingPrice || "0"),
          contactInfo: quotation.contactInfo,
          remarks: item.remarks,
        } as any);
      }
      // Recalculate order totals
      await recalculateOrderTotals(orderId);
      // 自动同步到PayPal收入表
      await syncOrderToPaypalIncome(orderId, ctx.user.id);
      // Mark quotation as synced
      await updateQuotation(input.quotationId, { status: "已同步" } as any);
      await logAction(ctx, "create", "order", orderId, `从报价表#${input.quotationId}同步`, JSON.stringify({ quotationId: input.quotationId }));
      return { orderId };
    }),
  }),

  quotationItems: router({
    create: protectedProcedure.input(z.object({
      quotationId: z.number(),
      orderImageUrl: z.string().optional(),
      productName: z.string().optional(),
      size: z.string().optional(),
      quantity: z.number().optional(),
      amountUsd: z.string().optional(),
      amountCny: z.string().optional(),
      sellingPrice: z.string().optional(),
      remarks: z.string().optional(),
    })).mutation(async ({ input }) => {
      const id = await createQuotationItem(input);
      await recalculateQuotationTotals(input.quotationId);
      return { id };
    }),

    update: protectedProcedure.input(z.object({
      id: z.number(),
      quotationId: z.number(),
      orderImageUrl: z.string().optional(),
      productName: z.string().optional(),
      size: z.string().optional(),
      quantity: z.number().optional(),
      amountUsd: z.string().optional(),
      amountCny: z.string().optional(),
      sellingPrice: z.string().optional(),
      remarks: z.string().optional(),
    })).mutation(async ({ input }) => {
      const { id, quotationId, ...data } = input;
      // Auto-calculate amountCny from amountUsd if amountUsd changed
      if (data.amountUsd !== undefined) {
        const rateObj = await getExchangeRateForQuotation();
        const rate = parseFloat(String(rateObj.rate));
        const usd = parseFloat(data.amountUsd || "0");
        data.amountCny = (usd * rate).toFixed(2);
      }
      await updateQuotationItem(id, data as any);
      await recalculateQuotationTotals(quotationId);
      return { success: true };
    }),

    delete: protectedProcedure.input(z.object({
      id: z.number(),
      quotationId: z.number(),
    })).mutation(async ({ input }) => {
      await deleteQuotationItem(input.id);
      await recalculateQuotationTotals(input.quotationId);
      return { success: true };
    }),
  }),

  // ==================== PayPal Income Routes ====================
  paypalIncome: router({
    list: protectedProcedure.input(z.object({
      page: z.number().default(1),
      pageSize: z.number().default(50),
      search: z.string().optional(),
      receivingAccount: z.string().optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
    })).query(({ input, ctx }) => {
      const staffId = ctx.user.role === "admin" ? undefined : ctx.user.id;
      return listPaypalIncome({ ...input, staffId });
    }),

    create: protectedProcedure.input(z.object({
      incomeDate: z.string().optional(),
      account: z.string().optional(),
      customerWhatsapp: z.string().optional(),
      paymentScreenshotUrl: z.string().optional(),
      paymentAmount: z.string().optional(),
      actualReceived: z.string().optional(),
      isReceived: z.string().optional(),
      receivingAccount: z.string().optional(),
      customerName: z.string().optional(),
      staffName: z.string().optional(),
      paymentType: z.string().optional(),
      orderNumber: z.string().optional(),
      remarks: z.string().optional(),
    })).mutation(async ({ input, ctx }) => {
      const id = await createPaypalIncome({
        ...input,
        incomeDate: input.incomeDate ? new Date(input.incomeDate + "T00:00:00") : null,
        createdById: ctx.user.id,
      } as any);
      await logAction(ctx, "create", "paypalIncome", id);
      return { id };
    }),

    update: protectedProcedure.input(z.object({
      id: z.number(),
      incomeDate: z.string().optional(),
      account: z.string().optional(),
      customerWhatsapp: z.string().optional(),
      paymentScreenshotUrl: z.string().optional(),
      paymentAmount: z.string().optional(),
      actualReceived: z.string().optional(),
      isReceived: z.string().optional(),
      receivingAccount: z.string().optional(),
      customerName: z.string().optional(),
      staffName: z.string().optional(),
      paymentType: z.string().optional(),
      orderNumber: z.string().optional(),
      remarks: z.string().optional(),
    })).mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      const updateData: any = { ...data };
      if (data.incomeDate !== undefined) {
        updateData.incomeDate = data.incomeDate ? new Date(data.incomeDate + "T00:00:00") : null;
      }
      await updatePaypalIncome(id, updateData);
      // 当"实际收到"金额变更时，自动累加同步到订单表并更新付款状态
      if (data.actualReceived !== undefined) {
        const relatedOrderId = await getPaypalIncomeOrderId(id);
        if (relatedOrderId) {
          await syncActualReceivedToOrder(relatedOrderId);
        }
      }
      await logAction(ctx, "update", "paypalIncome", id, undefined, JSON.stringify(data));
      return { success: true };
    }),

    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
      // 先查询orderId，删除后重新累加实际收到金额
      const relatedOrderId = await getPaypalIncomeOrderId(input.id);
      await deletePaypalIncome(input.id);
      if (relatedOrderId) {
        await syncActualReceivedToOrder(relatedOrderId);
      }
      await logAction(ctx, "delete", "paypalIncome", input.id);
      return { success: true };
    }),
  }),

  // ==================== PayPal Expense Routes ====================
  paypalExpense: router({
    list: adminProcedure.input(z.object({
      page: z.number().default(1),
      pageSize: z.number().default(50),
      search: z.string().optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
    })).query(({ input }) => {
      return listPaypalExpense(input);
    }),

    create: adminProcedure.input(z.object({
      expenseDate: z.string().optional(),
      account: z.string().optional(),
      amount: z.string().optional(),
      remarks: z.string().optional(),
    })).mutation(async ({ input, ctx }) => {
      const id = await createPaypalExpense({
        ...input,
        expenseDate: input.expenseDate ? new Date(input.expenseDate + "T00:00:00") : null,
        createdById: ctx.user.id,
      } as any);
      await logAction(ctx, "create", "paypalExpense", id);
      return { id };
    }),

    update: adminProcedure.input(z.object({
      id: z.number(),
      expenseDate: z.string().optional(),
      account: z.string().optional(),
      amount: z.string().optional(),
      remarks: z.string().optional(),
    })).mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      const updateData: any = { ...data };
      if (data.expenseDate !== undefined) {
        updateData.expenseDate = data.expenseDate ? new Date(data.expenseDate + "T00:00:00") : null;
      }
      await updatePaypalExpense(id, updateData);
      await logAction(ctx, "update", "paypalExpense", id, undefined, JSON.stringify(data));
      return { success: true };
    }),

    delete: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
      await deletePaypalExpense(input.id);
      await logAction(ctx, "delete", "paypalExpense", input.id);
      return { success: true };
    }),
  }),

  // ==================== PayPal Balance Summary ====================
  paypalBalance: router({
    summary: adminProcedure.query(async () => {
      return getPaypalBalanceSummary();
    }),
  }),

  // ==================== PayPal Sync from Orders ====================
  paypalSync: router({
    syncFromOrders: adminProcedure.mutation(async ({ ctx }) => {
      const result = await syncOrdersToPaypalIncome(ctx.user.id);
      if (result.created > 0) {
        await logAction(ctx, "sync", "paypalIncome", 0, undefined, `同步${result.created}条订单数据`);
      }
      return result;
    }),
    // 修复同步：更新已有记录中缺失的截图、日期和订单编号
    repairSync: adminProcedure.mutation(async ({ ctx }) => {
      const result = await repairPaypalIncomeSync();
      if (result.updated > 0) {
        await logAction(ctx, "repair", "paypalIncome", 0, undefined, `修复${result.updated}条记录的缺失数据`);
      }
      return result;
    }),
  }),

  // ==================== Reshipment Routes ====================
  reshipments: router({
    list: protectedProcedure.input(z.object({
      page: z.number().default(1),
      pageSize: z.number().default(50),
      search: z.string().optional(),
      staffName: z.string().optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      orderStatus: z.string().optional(),
    })).query(({ input, ctx }) => {
      // 客服只能看自己的补发记录
      const params: any = { ...input };
      if (ctx.user.role !== 'admin') {
        params.staffId = ctx.user.id;
      }
      return listReshipments(params);
    }),

    getById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      return getReshipmentById(input.id);
    }),

    getByOriginalOrderId: protectedProcedure.input(z.object({ orderId: z.number() })).query(async ({ input }) => {
      return getReshipmentsByOriginalOrderId(input.orderId);
    }),

    create: protectedProcedure.input(z.object({
      reshipDate: z.string().optional(),
      staffName: z.string().optional(),
      account: z.string().optional(),
      customerWhatsapp: z.string().optional(),
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
      orderStatus: z.string().optional(),
      totalProfit: z.string().optional(),
      reshipReason: z.string().optional(),
      customerPaidAmount: z.string().optional(),
      reshipCost: z.string().optional(),
      actualShipping: z.string().optional(),
      profitLoss: z.string().optional(),
      originalOrderId: z.number().optional(),
    })).mutation(async ({ input, ctx }) => {
      const id = await createReshipment({
        ...input,
        reshipDate: input.reshipDate ? new Date(input.reshipDate + "T00:00:00") : null,
        shipDate: input.shipDate ? new Date(input.shipDate + "T00:00:00") : null,
        staffId: ctx.user.id,
        createdById: ctx.user.id,
      } as any);
      await logAction(ctx, "create", "reshipment", id);
      return { id };
    }),

    // 从订单创建补发记录（自动填充订单信息）
    createFromOrder: protectedProcedure.input(z.object({
      orderId: z.number(),
      reshipReason: z.string().optional(),
    })).mutation(async ({ input, ctx }) => {
      const order = await getOrderWithItems(input.orderId);
      if (!order) {
        throw new TRPCError({ code: "NOT_FOUND", message: "订单不存在" });
      }
      const today = new Date().toISOString().slice(0, 10);
      const items = order.items || [];
      const ids: number[] = [];
      // 为每个子项创建一条补发记录（保持父子项结构）
      if (items.length === 0) {
        // 没有子项时创建一条空补发记录
        const id = await createReshipment({
          reshipDate: new Date(today + "T00:00:00"),
          staffName: order.staffName || ctx.user.name || null,
          staffId: ctx.user.id,
          account: order.account || null,
          customerWhatsapp: order.customerWhatsapp || null,
          orderNumber: order.orderNumber || null,
          orderImageUrl: null,
          size: null,
          domesticTrackingNo: null,
          sizeRecommendation: null,
          contactInfo: null,
          internationalTrackingNo: null,
            originalOrderNo: null,
            shipDate: null,
            quantity: 1,
          source: null,
          orderStatus: "已报货，待发货",
          totalProfit: String(order.totalProfit || "0"),
          reshipReason: input.reshipReason || null,
          customerPaidAmount: "0",
          reshipCost: "0",
          actualShipping: "0",
          logisticsCompensation: "0",
          profitLoss: String(order.totalProfit || "0"),
          originalOrderId: input.orderId,
          createdById: ctx.user.id,
        } as any);
        ids.push(id);
      } else {
        for (const item of items) {
          const id = await createReshipment({
            reshipDate: new Date(today + "T00:00:00"),
            staffName: order.staffName || ctx.user.name || null,
            staffId: ctx.user.id,
            account: order.account || null,
            customerWhatsapp: order.customerWhatsapp || null,
            orderNumber: item.orderNumber || order.orderNumber || null,
            orderImageUrl: item.orderImageUrl || null,
            size: item.size || null,
            domesticTrackingNo: null,
            sizeRecommendation: item.sizeRecommendation || null,
            contactInfo: item.contactInfo || null,
            internationalTrackingNo: null,
            originalOrderNo: null,
            shipDate: null,
            quantity: item.quantity || 1,
            source: item.source || null,
            orderStatus: "已报货，待发货",
            totalProfit: String(order.totalProfit || "0"),
            reshipReason: input.reshipReason || null,
            customerPaidAmount: "0",
            reshipCost: "0",
            actualShipping: "0",
            logisticsCompensation: "0",
            profitLoss: String(order.totalProfit || "0"),
            originalOrderId: input.orderId,
            createdById: ctx.user.id,
          } as any);
          ids.push(id);
        }
      }
      await logAction(ctx, "create", "reshipment", ids[0], undefined, `从订单#${input.orderId}创建${ids.length}条补发记录`);
      return { ids, count: ids.length };
    }),

    // 从单个子项创建补发记录
    createFromItem: protectedProcedure.input(z.object({
      orderId: z.number(),
      itemId: z.number(),
      reshipReason: z.string().optional(),
    })).mutation(async ({ input, ctx }) => {
      const order = await getOrderWithItems(input.orderId);
      if (!order) {
        throw new TRPCError({ code: "NOT_FOUND", message: "订单不存在" });
      }
      const item = order.items?.find((i: any) => i.id === input.itemId);
      if (!item) {
        throw new TRPCError({ code: "NOT_FOUND", message: "子项不存在" });
      }
      const today = new Date().toISOString().slice(0, 10);
      const id = await createReshipment({
        reshipDate: new Date(today + "T00:00:00"),
        staffName: order.staffName || ctx.user.name || null,
        staffId: ctx.user.id,
        account: order.account || null,
        customerWhatsapp: order.customerWhatsapp || null,
        orderNumber: item.orderNumber || order.orderNumber || null,
        orderImageUrl: item.orderImageUrl || null,
        size: item.size || null,
        domesticTrackingNo: null,
        sizeRecommendation: item.sizeRecommendation || null,
        contactInfo: item.contactInfo || null,
        internationalTrackingNo: null,
        originalOrderNo: null,
        shipDate: null,
        quantity: item.quantity || 1,
        source: item.source || null,
        orderStatus: "已报货，待发货",
        totalProfit: String(order.totalProfit || "0"),
        reshipReason: input.reshipReason || null,
        customerPaidAmount: "0",
        reshipCost: "0",
        actualShipping: "0",
        logisticsCompensation: "0",
        profitLoss: String(order.totalProfit || "0"),
        originalOrderId: input.orderId,
        createdById: ctx.user.id,
      } as any);
      await logAction(ctx, "create", "reshipment", id, undefined, `从订单#${input.orderId}子项#${input.itemId}创建补发记录`);
      return { id };
    }),

    update: protectedProcedure.input(z.object({
      id: z.number(),
      reshipDate: z.string().optional(),
      staffName: z.string().optional(),
      account: z.string().optional(),
      customerWhatsapp: z.string().optional(),
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
      orderStatus: z.string().optional(),
      totalProfit: z.string().optional(),
      reshipReason: z.string().optional(),
      customerPaidAmount: z.string().optional(),
      reshipCost: z.string().optional(),
      actualShipping: z.string().optional(),
      logisticsCompensation: z.string().optional(),
      profitLoss: z.string().optional(),
    })).mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      const updateData: any = { ...data };
      if (data.reshipDate !== undefined) {
        updateData.reshipDate = data.reshipDate ? new Date(data.reshipDate + "T00:00:00") : null;
      }
      if (data.shipDate !== undefined) {
        updateData.shipDate = data.shipDate ? new Date(data.shipDate + "T00:00:00") : null;
      }
      // 自动计算盈亏: 原订单总利润 + 客户补的金额 + 物流赔偿金额 - 补发成本 - 补发实际运费
      if (data.totalProfit !== undefined || data.customerPaidAmount !== undefined || data.reshipCost !== undefined || data.actualShipping !== undefined || data.logisticsCompensation !== undefined) {
        // 需要获取当前记录的完整数据来计算
        const current = await getReshipmentById(id);
        const totalProfit = parseFloat(data.totalProfit ?? String(current?.totalProfit || "0")) || 0;
        const customerPaid = parseFloat(data.customerPaidAmount ?? String(current?.customerPaidAmount || "0")) || 0;
        const logComp = parseFloat(data.logisticsCompensation ?? String(current?.logisticsCompensation || "0")) || 0;
        const cost = parseFloat(data.reshipCost ?? String(current?.reshipCost || "0")) || 0;
        const shipping = parseFloat(data.actualShipping ?? String(current?.actualShipping || "0")) || 0;
        updateData.profitLoss = String(totalProfit + customerPaid + logComp - cost - shipping);
      }
      await updateReshipment(id, updateData);
      await logAction(ctx, "update", "reshipment", id, undefined, JSON.stringify(data));
      return { success: true };
    }),

    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
      await deleteReshipment(input.id);
      await logAction(ctx, "delete", "reshipment", input.id);
      return { success: true };
    }),
  }),

  // ==================== 订单支付记录 ====================
  orderPayments: router({
    // 按订单ID查询所有支付记录
    listByOrder: protectedProcedure.input(z.object({
      orderId: z.number(),
    })).query(async ({ input }) => {
      return getOrderPaymentsByOrderId(input.orderId);
    }),

    // 获取单条支付记录
    getById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      return getOrderPaymentById(input.id);
    }),

    // 创建支付记录
    create: protectedProcedure.input(z.object({
      orderId: z.number(),
      paymentType: z.string().default("全款"),
      amount: z.string().default("0"),
      screenshotUrl: z.string().optional(),
      paymentDate: z.string().optional(),
      receivingAccount: z.string().optional(),
      remarks: z.string().optional(),
    })).mutation(async ({ input, ctx }) => {
      const { paymentDate, ...rest } = input;
      const id = await createOrderPayment({
        ...rest,
        paymentDate: paymentDate ? new Date(paymentDate) : undefined,
        createdById: ctx.user.id,
      } as any);
      // 自动同步到PayPal收入表
      await syncPaymentToPaypalIncome(id, input.orderId, ctx.user.id);
      await logAction(ctx, "create", "orderPayment", id, undefined, `订单ID:${input.orderId} 类型:${input.paymentType} 金额:${input.amount}`);
      return { id };
    }),

    // 更新支付记录
    update: protectedProcedure.input(z.object({
      id: z.number(),
      paymentType: z.string().optional(),
      amount: z.string().optional(),
      screenshotUrl: z.string().optional(),
      paymentDate: z.string().optional(),
      receivingAccount: z.string().optional(),
      remarks: z.string().optional(),
    })).mutation(async ({ input, ctx }) => {
      const { id, paymentDate, ...rest } = input;
      await updateOrderPayment(id, {
        ...rest,
        paymentDate: paymentDate ? new Date(paymentDate) : undefined,
      } as any);
      // 同步更新PayPal收入记录
      await updatePaypalIncomeFromPayment(id);
      await logAction(ctx, "update", "orderPayment", id);
      return { success: true };
    }),

    // 删除支付记录
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
      // 先删除PayPal关联记录
      await deletePaypalIncomeByPaymentId(input.id);
      await deleteOrderPayment(input.id);
      await logAction(ctx, "delete", "orderPayment", input.id);
      return { success: true };
    }),

    // 上传支付截图
    uploadScreenshot: protectedProcedure.input(z.object({
      paymentId: z.number(),
      base64: z.string(),
      filename: z.string(),
    })).mutation(async ({ input }) => {
      const buffer = Buffer.from(input.base64, "base64");
      const ext = input.filename.split(".").pop() || "jpg";
      const key = `payment-screenshots/${input.paymentId}-${nanoid(8)}.${ext}`;
      const { url } = await storagePut(key, buffer, `image/${ext === "png" ? "png" : "jpeg"}`);
      await updateOrderPayment(input.paymentId, { screenshotUrl: url });
      // 上传截图后同步到PayPal收入记录
      await updatePaypalIncomeFromPayment(input.paymentId);
      return { url };
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
