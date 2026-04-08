import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, adminProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  listUsers, updateUserRole, deleteUser, getUserById, createUser,
  getUserByUsername, verifyPassword, updateUserPassword, updateUserUsername,
  createCustomer, updateCustomer, deleteCustomer, getCustomerById, getCustomerByWhatsapp, listCustomers,
  createOrder, updateOrder, deleteOrder, getOrderById, getOrderWithItems, listOrders,
  createOrderItem, updateOrderItem, deleteOrderItem, getOrderItemsByOrderId, recalculateOrderTotals,
  getOrderStats, getOrderStatusDistribution, getPaymentStatusDistribution,
  getStaffPerformance, getRecentOrders, getCustomerStats, getDailyOrderTrend,
  createAuditLog, listAuditLogs, exportOrders,
} from "./db";
import { sdk } from "./_core/sdk";
import { ONE_YEAR_MS } from "@shared/const";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";

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
      orderStatus: z.string().optional(),
      paymentStatus: z.string().optional(),
      customerWhatsapp: z.string().optional(),
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
      // Auto-calculate profit fields
      const sellingPrice = parseFloat(input.sellingPrice || "0");
      const productCost = parseFloat(input.productCost || "0");
      const productProfit = sellingPrice - productCost;
      const productProfitRate = sellingPrice > 0 ? productProfit / sellingPrice : 0;

      const shippingCharged = parseFloat(input.shippingCharged || "0");
      const shippingActual = parseFloat(input.shippingActual || "0");
      const shippingProfit = shippingCharged - shippingActual;
      const shippingProfitRate = shippingCharged > 0 ? shippingProfit / shippingCharged : 0;

      const amountCny = parseFloat(input.amountCny || "0");
      const totalProfit = productProfit + shippingProfit;
      const profitRate = amountCny > 0 ? totalProfit / amountCny : 0;

      const id = await createOrderItem({
        ...input,
        productProfit: productProfit.toFixed(2),
        productProfitRate: productProfitRate.toFixed(6),
        shippingProfit: shippingProfit.toFixed(2),
        shippingProfitRate: shippingProfitRate.toFixed(6),
        totalProfit: totalProfit.toFixed(2),
        profitRate: profitRate.toFixed(6),
      });

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
      // Auto-calculate profit fields
      const sellingPrice = parseFloat(data.sellingPrice || "0");
      const productCost = parseFloat(data.productCost || "0");
      const productProfit = sellingPrice - productCost;
      const productProfitRate = sellingPrice > 0 ? productProfit / sellingPrice : 0;

      const shippingCharged = parseFloat(data.shippingCharged || "0");
      const shippingActual = parseFloat(data.shippingActual || "0");
      const shippingProfit = shippingCharged - shippingActual;
      const shippingProfitRate = shippingCharged > 0 ? shippingProfit / shippingCharged : 0;

      const amountCny = parseFloat(data.amountCny || "0");
      const totalProfit = productProfit + shippingProfit;
      const profitRate = amountCny > 0 ? totalProfit / amountCny : 0;

      await updateOrderItem(id, {
        ...data,
        productProfit: productProfit.toFixed(2),
        productProfitRate: productProfitRate.toFixed(6),
        shippingProfit: shippingProfit.toFixed(2),
        shippingProfitRate: shippingProfitRate.toFixed(6),
        totalProfit: totalProfit.toFixed(2),
        profitRate: profitRate.toFixed(6),
      });

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
      orderStatus: z.string().optional(),
      paymentStatus: z.string().optional(),
      customerWhatsapp: z.string().optional(),
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
