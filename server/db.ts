import { eq, like, and, sql, desc, or, SQL } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, customers, orders, orderItems, InsertCustomer, InsertOrder, InsertOrderItem } from "../drizzle/schema";
import { ENV } from './_core/env';
import { nanoid } from 'nanoid';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ==================== User Helpers ====================

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }
  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }
    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }
    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function listUsers(page: number = 1, pageSize: number = 20) {
  const db = await getDb();
  if (!db) return { data: [], total: 0 };
  const offset = (page - 1) * pageSize;
  const [data, countResult] = await Promise.all([
    db.select().from(users).orderBy(desc(users.createdAt)).limit(pageSize).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(users),
  ]);
  return { data, total: countResult[0]?.count ?? 0 };
}

export async function updateUserRole(userId: number, role: "user" | "admin") {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ role }).where(eq(users.id, userId));
}

export async function deleteUser(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(users).where(eq(users.id, userId));
}

export async function getUserById(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createUser(data: { name: string; email?: string; role?: "user" | "admin" }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const openId = `manual-${nanoid()}`;
  const result = await db.insert(users).values({
    openId,
    name: data.name,
    email: data.email || null,
    role: data.role || "user",
    loginMethod: "manual",
    lastSignedIn: new Date(),
  });
  return { id: result[0].insertId, openId };
}

// ==================== Customer Helpers ====================

export async function createCustomer(data: InsertCustomer) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(customers).values(data);
  return result[0].insertId;
}

export async function updateCustomer(id: number, data: Partial<InsertCustomer>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(customers).set(data).where(eq(customers.id, id));
}

export async function deleteCustomer(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(customers).where(eq(customers.id, id));
}

export async function getCustomerById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getCustomerByWhatsapp(whatsapp: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(customers).where(eq(customers.whatsapp, whatsapp)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function listCustomers(params: {
  page?: number;
  pageSize?: number;
  search?: string;
  createdById?: number;
}) {
  const db = await getDb();
  if (!db) return { data: [], total: 0 };
  const { page = 1, pageSize = 20, search, createdById } = params;
  const offset = (page - 1) * pageSize;
  const conditions: SQL[] = [];
  if (search) {
    conditions.push(
      or(
        like(customers.whatsapp, `%${search}%`),
        like(customers.contactName, `%${search}%`),
        like(customers.country, `%${search}%`)
      )!
    );
  }
  if (createdById) {
    conditions.push(eq(customers.createdById, createdById));
  }
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  const [data, countResult] = await Promise.all([
    db.select().from(customers).where(whereClause).orderBy(desc(customers.createdAt)).limit(pageSize).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(customers).where(whereClause),
  ]);
  return { data, total: countResult[0]?.count ?? 0 };
}

// ==================== Order Helpers ====================

export async function createOrder(data: InsertOrder) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(orders).values(data);
  return result[0].insertId;
}

export async function updateOrder(id: number, data: Partial<InsertOrder>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(orders).set(data).where(eq(orders.id, id));
}

export async function deleteOrder(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Delete order items first
  await db.delete(orderItems).where(eq(orderItems.orderId, id));
  await db.delete(orders).where(eq(orders.id, id));
}

export async function getOrderById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getOrderWithItems(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const [orderResult, itemsResult] = await Promise.all([
    db.select().from(orders).where(eq(orders.id, id)).limit(1),
    db.select().from(orderItems).where(eq(orderItems.orderId, id)).orderBy(orderItems.id),
  ]);
  if (orderResult.length === 0) return undefined;
  return { ...orderResult[0], items: itemsResult };
}

export async function listOrders(params: {
  page?: number;
  pageSize?: number;
  search?: string;
  staffId?: number;
  orderStatus?: string;
  paymentStatus?: string;
  customerWhatsapp?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  const db = await getDb();
  if (!db) return { data: [], total: 0 };
  const { page = 1, pageSize = 20, search, staffId, orderStatus, paymentStatus, customerWhatsapp, dateFrom, dateTo } = params;
  const offset = (page - 1) * pageSize;
  const conditions: SQL[] = [];
  if (search) {
    conditions.push(
      or(
        like(orders.orderNumber, `%${search}%`),
        like(orders.customerWhatsapp, `%${search}%`),
        like(orders.staffName, `%${search}%`)
      )!
    );
  }
  if (staffId) {
    conditions.push(eq(orders.staffId, staffId));
  }
  if (orderStatus) {
    conditions.push(eq(orders.orderStatus, orderStatus));
  }
  if (paymentStatus) {
    conditions.push(eq(orders.paymentStatus, paymentStatus));
  }
  if (customerWhatsapp) {
    conditions.push(like(orders.customerWhatsapp, `%${customerWhatsapp}%`));
  }
  if (dateFrom && dateTo) {
    conditions.push(sql`${orders.orderDate} >= ${dateFrom} AND ${orders.orderDate} <= ${dateTo}`);
  } else if (dateFrom) {
    conditions.push(sql`${orders.orderDate} >= ${dateFrom}`);
  } else if (dateTo) {
    conditions.push(sql`${orders.orderDate} <= ${dateTo}`);
  }
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  const [data, countResult] = await Promise.all([
    db.select().from(orders).where(whereClause).orderBy(desc(orders.createdAt)).limit(pageSize).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(orders).where(whereClause),
  ]);
  // Fetch items for all orders in one query
  const orderIds = data.map(o => o.id);
  let itemsMap: Record<number, typeof orderItems.$inferSelect[]> = {};
  if (orderIds.length > 0) {
    const allItems = await db.select().from(orderItems)
      .where(sql`${orderItems.orderId} IN (${sql.join(orderIds.map(id => sql`${id}`), sql`, `)})`)
      .orderBy(orderItems.id);
    for (const item of allItems) {
      if (!itemsMap[item.orderId]) itemsMap[item.orderId] = [];
      itemsMap[item.orderId].push(item);
    }
  }
  const dataWithItems = data.map(o => ({ ...o, items: itemsMap[o.id] || [] }));
  return { data: dataWithItems, total: countResult[0]?.count ?? 0 };
}

// ==================== Order Item Helpers ====================

export async function createOrderItem(data: InsertOrderItem) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(orderItems).values(data);
  return result[0].insertId;
}

export async function updateOrderItem(id: number, data: Partial<InsertOrderItem>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(orderItems).set(data).where(eq(orderItems.id, id));
}

export async function deleteOrderItem(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(orderItems).where(eq(orderItems.id, id));
}

export async function getOrderItemsByOrderId(orderId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(orderItems).where(eq(orderItems.orderId, orderId)).orderBy(orderItems.id);
}

export async function recalculateOrderTotals(orderId: number) {
  const db = await getDb();
  if (!db) return;
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  let totalUsd = 0, totalCny = 0, totalProfit = 0;
  for (const item of items) {
    totalUsd += Number(item.amountUsd) || 0;
    totalCny += Number(item.amountCny) || 0;
    totalProfit += Number(item.totalProfit) || 0;
  }
  const profitRate = totalCny > 0 ? totalProfit / totalCny : 0;
  await db.update(orders).set({
    totalAmountUsd: totalUsd.toFixed(2),
    totalAmountCny: totalCny.toFixed(2),
    totalProfit: totalProfit.toFixed(2),
    totalProfitRate: profitRate.toFixed(6),
  }).where(eq(orders.id, orderId));
}

// ==================== Statistics Helpers ====================

export async function getOrderStats(staffId?: number) {
  const db = await getDb();
  if (!db) return { totalOrders: 0, totalRevenueCny: 0, totalRevenueUsd: 0, totalProfit: 0, avgProfitRate: 0 };
  const whereClause = staffId ? eq(orders.staffId, staffId) : undefined;
  const result = await db.select({
    totalOrders: sql<number>`count(*)`,
    totalRevenueCny: sql<number>`COALESCE(SUM(totalAmountCny), 0)`,
    totalRevenueUsd: sql<number>`COALESCE(SUM(totalAmountUsd), 0)`,
    totalProfit: sql<number>`COALESCE(SUM(totalProfit), 0)`,
    avgProfitRate: sql<number>`COALESCE(AVG(CASE WHEN totalProfitRate > 0 THEN totalProfitRate ELSE NULL END), 0)`,
  }).from(orders).where(whereClause);
  return result[0] ?? { totalOrders: 0, totalRevenueCny: 0, totalRevenueUsd: 0, totalProfit: 0, avgProfitRate: 0 };
}

export async function getOrderStatusDistribution(staffId?: number) {
  const db = await getDb();
  if (!db) return [];
  const whereClause = staffId ? eq(orders.staffId, staffId) : undefined;
  return db.select({
    status: orders.orderStatus,
    count: sql<number>`count(*)`,
  }).from(orders).where(whereClause).groupBy(orders.orderStatus);
}

export async function getPaymentStatusDistribution(staffId?: number) {
  const db = await getDb();
  if (!db) return [];
  const whereClause = staffId ? eq(orders.staffId, staffId) : undefined;
  return db.select({
    status: orders.paymentStatus,
    count: sql<number>`count(*)`,
  }).from(orders).where(whereClause).groupBy(orders.paymentStatus);
}

export async function getStaffPerformance() {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    staffId: orders.staffId,
    staffName: orders.staffName,
    orderCount: sql<number>`count(*)`,
    totalRevenueCny: sql<number>`COALESCE(SUM(totalAmountCny), 0)`,
    totalRevenueUsd: sql<number>`COALESCE(SUM(totalAmountUsd), 0)`,
    totalProfit: sql<number>`COALESCE(SUM(totalProfit), 0)`,
  }).from(orders).groupBy(orders.staffId, orders.staffName);
}

export async function getRecentOrders(limit: number = 10, staffId?: number) {
  const db = await getDb();
  if (!db) return [];
  const whereClause = staffId ? eq(orders.staffId, staffId) : undefined;
  return db.select().from(orders).where(whereClause).orderBy(desc(orders.createdAt)).limit(limit);
}

export async function getCustomerStats() {
  const db = await getDb();
  if (!db) return { total: 0, byType: [] };
  const [countResult, typeResult] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(customers),
    db.select({
      type: customers.customerType,
      count: sql<number>`count(*)`,
    }).from(customers).groupBy(customers.customerType),
  ]);
  return { total: countResult[0]?.count ?? 0, byType: typeResult };
}

export async function getDailyOrderTrend(days: number = 30, staffId?: number) {
  const db = await getDb();
  if (!db) return [];
  const whereClause = staffId
    ? and(sql`${orders.orderDate} >= DATE_SUB(CURDATE(), INTERVAL ${days} DAY)`, eq(orders.staffId, staffId))
    : sql`${orders.orderDate} >= DATE_SUB(CURDATE(), INTERVAL ${days} DAY)`;
  return db.select({
    date: orders.orderDate,
    count: sql<number>`count(*)`,
    revenue: sql<number>`COALESCE(SUM(totalAmountCny), 0)`,
    profit: sql<number>`COALESCE(SUM(totalProfit), 0)`,
  }).from(orders).where(whereClause).groupBy(orders.orderDate).orderBy(orders.orderDate);
}
