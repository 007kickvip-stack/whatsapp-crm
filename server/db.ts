import { eq, like, and, sql, desc, or, SQL, inArray, isNotNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, customers, orders, orderItems, InsertCustomer, InsertOrder, InsertOrderItem, auditLogs, InsertAuditLog, exchangeRates, InsertExchangeRate, profitAlertSettings, InsertProfitAlertSetting, staffMonthlyTargets, InsertStaffMonthlyTarget, dailyData, InsertDailyData, accounts, InsertAccount, dailyReportNotes, InsertDailyReportNote } from "../drizzle/schema";
import { ENV } from './_core/env';
import { nanoid } from 'nanoid';
import { createHash, randomBytes } from 'crypto';

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

// ==================== Password Helpers ====================

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = createHash('sha256').update(salt + password).digest('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(':');
  if (!salt || !hash) return false;
  const computed = createHash('sha256').update(salt + password).digest('hex');
  return computed === hash;
}

export async function createUser(data: { name: string; email?: string; role?: "user" | "admin"; username?: string; password?: string; hireDate?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const openId = `manual-${nanoid()}`;
  const hashedPassword = data.password ? hashPassword(data.password) : null;
  const result = await db.insert(users).values({
    openId,
    name: data.name,
    email: data.email || null,
    username: data.username || null,
    password: hashedPassword,
    role: data.role || "user",
    hireDate: data.hireDate ? new Date(data.hireDate + "T00:00:00") : null,
    loginMethod: "password",
    lastSignedIn: new Date(),
  });
  return { id: result[0].insertId, openId };
}

export async function getUserByUsername(username: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateUserPassword(userId: number, password: string) {
  const db = await getDb();
  if (!db) return;
  const hashedPassword = hashPassword(password);
  await db.update(users).set({ password: hashedPassword }).where(eq(users.id, userId));
}

export async function updateUserHireDate(userId: number, hireDate: string | null) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ hireDate: hireDate ? new Date(hireDate + "T00:00:00") : null }).where(eq(users.id, userId));
}

export async function updateUserUsername(userId: number, username: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ username }).where(eq(users.id, userId));
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
  staffName?: string;
  account?: string;
  customerType?: string;

}) {
  const db = await getDb();
  if (!db) return { data: [], total: 0 };
  const { page = 1, pageSize = 50, search, createdById, staffName, account, customerType } = params;
  const offset = (page - 1) * pageSize;
  const conditions: SQL[] = [];
  if (search) {
    conditions.push(
      or(
        like(customers.whatsapp, `%${search}%`),
        like(customers.contactName, `%${search}%`),
        like(customers.country, `%${search}%`),
        like(customers.customerName, `%${search}%`),
        like(customers.customerEmail, `%${search}%`)
      )!
    );
  }
  if (createdById) {
    conditions.push(eq(customers.createdById, createdById));
  }
  if (staffName) {
    conditions.push(eq(customers.staffName, staffName));
  }
  if (account) {
    conditions.push(eq(customers.account, account));
  }
  if (customerType) {
    conditions.push(eq(customers.customerType, customerType));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  const [data, countResult] = await Promise.all([
    db.select().from(customers).where(whereClause).orderBy(desc(customers.createdAt)).limit(pageSize).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(customers).where(whereClause),
  ]);
  return { data, total: countResult[0]?.count ?? 0 };
}

/**
 * 同步客户统计数据（累计订单数、累计消费金额、首次下单日期）
 * 从订单表自动汇总到客户表，通过customerName匹配
 */
export async function syncCustomerStats(customerId?: number) {
  const db = await getDb();
  if (!db) return;
  
  let customerList;
  if (customerId) {
    const c = await db.select().from(customers).where(eq(customers.id, customerId)).limit(1);
    customerList = c;
  } else {
    customerList = await db.select().from(customers);
  }
  
  for (const customer of customerList) {
    // 通过customerName或whatsapp匹配订单
    const matchConditions: SQL[] = [];
    if (customer.customerName) {
      matchConditions.push(
        or(
          eq(orders.customerName, customer.customerName),
          eq(orders.customerWhatsapp, customer.whatsapp)
        )!
      );
    } else {
      matchConditions.push(eq(orders.customerWhatsapp, customer.whatsapp));
    }
    
    const statsResult = await db.select({
      orderCount: sql<number>`COUNT(*)`,
      totalUsd: sql<string>`COALESCE(SUM(totalAmountUsd), 0)`,
      totalCny: sql<string>`COALESCE(SUM(totalAmountCny), 0)`,
      firstDate: sql<string>`MIN(orderDate)`,
    }).from(orders).where(and(...matchConditions));
    
    const stats = statsResult[0];
    if (stats) {
      await db.update(customers).set({
        totalOrderCount: stats.orderCount || 0,
        totalSpentUsd: String(stats.totalUsd || "0"),
        totalSpentCny: String(stats.totalCny || "0"),
        firstOrderDate: stats.firstDate ? new Date(stats.firstDate) : null,
      }).where(eq(customers.id, customer.id));
    }
  }
}

/**
 * 订单创建/更新时自动同步客户数据
 * 1. 如果客户不存在，自动创建新客户
 * 2. 同步客户统计数据
 */
export async function syncCustomerFromOrder(orderData: {
  customerWhatsapp: string;
  customerName?: string | null;
  staffName?: string | null;
  account?: string | null;
  customerType?: string | null;
  customerCountry?: string | null;
  customerTier?: string | null;
  orderCategory?: string | null;
  customerBirthDate?: string | Date | null;
  customerEmail?: string | null;
  contactInfo?: string | null;
  staffId?: number | null;
}) {
  const db = await getDb();
  if (!db) return;
  
  // 查找客户：先按customerName查找，再按whatsapp查找
  let customer = null;
  if (orderData.customerName) {
    const byName = await db.select().from(customers)
      .where(eq(customers.customerName, orderData.customerName)).limit(1);
    if (byName.length > 0) customer = byName[0];
  }
  if (!customer) {
    const byWhatsapp = await db.select().from(customers)
      .where(eq(customers.whatsapp, orderData.customerWhatsapp)).limit(1);
    if (byWhatsapp.length > 0) customer = byWhatsapp[0];
  }
  
  if (!customer) {
    // 自动创建新客户
    const newCustomerData: any = {
      whatsapp: orderData.customerWhatsapp,
      customerName: orderData.customerName || null,
      staffName: orderData.staffName || null,
      account: orderData.account || null,
      customerType: orderData.customerType || "新零售",
      country: orderData.customerCountry || null,
      customerTier: orderData.customerTier || null,
      orderCategory: orderData.orderCategory || null,
      contactInfo: orderData.contactInfo || null,
      birthDate: orderData.customerBirthDate ? new Date(orderData.customerBirthDate as string) : null,
      customerEmail: orderData.customerEmail || null,
      createdById: orderData.staffId || null,
    };
    const result = await db.insert(customers).values(newCustomerData);
    const customerId = result[0].insertId;
    await syncCustomerStats(customerId);
    return customerId;
  } else {
    // 更新客户信息（同步字段）
    const updateData: any = {};
    if (orderData.staffName) updateData.staffName = orderData.staffName;
    if (orderData.account) updateData.account = orderData.account;
    if (orderData.customerName) updateData.customerName = orderData.customerName;
    if (orderData.customerType) updateData.customerType = orderData.customerType;
    if (orderData.customerCountry) updateData.country = orderData.customerCountry;
    if (orderData.customerTier) updateData.customerTier = orderData.customerTier;
    if (orderData.orderCategory) updateData.orderCategory = orderData.orderCategory;
    if (orderData.contactInfo) updateData.contactInfo = orderData.contactInfo;
    if (orderData.customerBirthDate) updateData.birthDate = new Date(orderData.customerBirthDate as string);
    if (orderData.customerEmail) updateData.customerEmail = orderData.customerEmail;
    
    if (Object.keys(updateData).length > 0) {
      await db.update(customers).set(updateData).where(eq(customers.id, customer.id));
    }
    // 同步统计数据
    await syncCustomerStats(customer.id);
    return customer.id;
  }
}

/**
 * 获取客户订单历史数据（用于折线图）
 */
export async function getCustomerOrderHistory(customerId: number, startDate?: string, endDate?: string) {
  const db = await getDb();
  if (!db) return [];
  
  const customer = await db.select().from(customers).where(eq(customers.id, customerId)).limit(1);
  if (customer.length === 0) return [];
  
  const conditions: SQL[] = [];
  // 通过customerName或whatsapp匹配
  if (customer[0].customerName) {
    conditions.push(
      or(
        eq(orders.customerName, customer[0].customerName),
        eq(orders.customerWhatsapp, customer[0].whatsapp)
      )!
    );
  } else {
    conditions.push(eq(orders.customerWhatsapp, customer[0].whatsapp));
  }
  if (startDate) conditions.push(sql`${orders.orderDate} >= ${startDate}`);
  if (endDate) conditions.push(sql`${orders.orderDate} <= ${endDate}`);
  
  const result = await db.select({
    date: orders.orderDate,
    orderCount: sql<number>`COUNT(*)`,
    totalUsd: sql<string>`COALESCE(SUM(${orders.totalAmountUsd}), 0)`,
    totalCny: sql<string>`COALESCE(SUM(${orders.totalAmountCny}), 0)`,
  }).from(orders)
    .where(and(...conditions))
    .groupBy(orders.orderDate)
    .orderBy(orders.orderDate);
  
  return result.map(r => ({
    date: r.date ? String(r.date) : null,
    orderCount: Number(r.orderCount || 0),
    totalUsd: String(r.totalUsd || "0"),
    totalCny: String(r.totalCny || "0"),
  }));
}

/**
 * 获取客户的详细订单列表（用于客户详情页展示）
 */
export async function getCustomerOrderList(customerId: number, startDate?: string, endDate?: string) {
  const db = await getDb();
  if (!db) return [];
  
  const customer = await db.select().from(customers).where(eq(customers.id, customerId)).limit(1);
  if (customer.length === 0) return [];
  
  const conditions: SQL[] = [];
  if (customer[0].customerName) {
    conditions.push(
      or(
        eq(orders.customerName, customer[0].customerName),
        eq(orders.customerWhatsapp, customer[0].whatsapp)
      )!
    );
  } else {
    conditions.push(eq(orders.customerWhatsapp, customer[0].whatsapp));
  }
  if (startDate) conditions.push(sql`${orders.orderDate} >= ${startDate}`);
  if (endDate) conditions.push(sql`${orders.orderDate} <= ${endDate}`);
  
  const result = await db.select({
    id: orders.id,
    orderDate: orders.orderDate,
    orderNumber: orders.orderNumber,
    orderStatus: orders.orderStatus,
    paymentStatus: orders.paymentStatus,
    totalAmountUsd: orders.totalAmountUsd,
    totalAmountCny: orders.totalAmountCny,
    customerType: orders.customerType,
    remarks: orders.remarks,
  }).from(orders)
    .where(and(...conditions))
    .orderBy(desc(orders.orderDate));
  
  return result;
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
  staffName?: string;
  account?: string;
  customerType?: string;
  orderNumber?: string;
  orderStatus?: string;
  paymentStatus?: string;
  customerWhatsapp?: string;
  internationalTrackingNo?: string;
  logisticsStatus?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  const db = await getDb();
  if (!db) return { data: [], total: 0 };
  const { page = 1, pageSize = 20, search, staffId, staffName, account, customerType, orderNumber, orderStatus, paymentStatus, customerWhatsapp, internationalTrackingNo, logisticsStatus, dateFrom, dateTo } = params;
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
  if (staffName) {
    conditions.push(like(orders.staffName, `%${staffName}%`));
  }
  if (account) {
    conditions.push(like(orders.account, `%${account}%`));
  }
  if (customerType) {
    conditions.push(eq(orders.customerType, customerType));
  }
  if (orderNumber) {
    conditions.push(like(orders.orderNumber, `%${orderNumber}%`));
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
  if (internationalTrackingNo) {
    conditions.push(sql`${orders.id} IN (SELECT ${orderItems.orderId} FROM ${orderItems} WHERE ${orderItems.internationalTrackingNo} LIKE ${'%' + internationalTrackingNo + '%'})`);
  }
  if (logisticsStatus) {
    conditions.push(sql`${orders.id} IN (SELECT ${orderItems.orderId} FROM ${orderItems} WHERE ${orderItems.logisticsStatus} = ${logisticsStatus})`);
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

export async function getOrderItemById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(orderItems).where(eq(orderItems.id, id)).limit(1);
  return rows[0];
}

export async function findOrderItemsByOrderNumbers(orderNums: string[]) {
  const db = await getDb();
  if (!db || orderNums.length === 0) return [];
  return db.select({
    item: orderItems,
    orderId: orderItems.orderId,
  }).from(orderItems).where(inArray(orderItems.orderNumber, orderNums));
}

export async function findOrderItemsByOriginalOrderNos(origNos: string[]) {
  const db = await getDb();
  if (!db || origNos.length === 0) return [];
  return db.select({
    item: orderItems,
    orderId: orderItems.orderId,
  }).from(orderItems).where(inArray(orderItems.originalOrderNo, origNos));
}

/**
 * 根据国内单号查找订单子项
 */
export async function findOrderItemByDomesticTrackingNo(trackingNo: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(orderItems).where(eq(orderItems.domesticTrackingNo, trackingNo)).limit(1);
  return rows[0];
}

/**
 * 查找所有有国内单号但未订阅的子项
 */
export async function findUnsubscribedItemsWithDomesticTracking() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(orderItems)
    .where(and(
      isNotNull(orderItems.domesticTrackingNo),
      sql`${orderItems.domesticTrackingNo} != ''`,
      eq(orderItems.logisticsSubscribed, 0)
    ));
}

/**
 * 更新物流状态
 */
export async function updateLogisticsStatus(id: number, data: {
  logisticsStatus: string;
  logisticsStatusText: string;
  logisticsLastUpdate: Date;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(orderItems).set(data).where(eq(orderItems.id, id));
}

/**
 * 标记子项已订阅快递100推送
 */
export async function markLogisticsSubscribed(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(orderItems).set({ logisticsSubscribed: 1 }).where(eq(orderItems.id, id));
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

export async function getCustomerStats(createdById?: number) {
  const db = await getDb();
  if (!db) return { total: 0, byType: [] };
  const whereClause = createdById ? eq(customers.createdById, createdById) : undefined;
  const [countResult, typeResult] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(customers).where(whereClause),
    db.select({
      type: customers.customerType,
      count: sql<number>`count(*)`,
    }).from(customers).where(whereClause).groupBy(customers.customerType),
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

// ==================== Audit Log Helpers ====================

export async function createAuditLog(data: InsertAuditLog) {
  const db = await getDb();
  if (!db) return;
  try {
    await db.insert(auditLogs).values(data);
  } catch (error) {
    console.error("[AuditLog] Failed to create log:", error);
  }
}

export async function listAuditLogs(params: {
  page?: number;
  pageSize?: number;
  userId?: number;
  action?: string;
  targetType?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  const db = await getDb();
  if (!db) return { data: [], total: 0 };
  const { page = 1, pageSize = 20, userId, action, targetType, dateFrom, dateTo } = params;
  const offset = (page - 1) * pageSize;
  const conditions: SQL[] = [];
  if (userId) {
    conditions.push(eq(auditLogs.userId, userId));
  }
  if (action) {
    conditions.push(eq(auditLogs.action, action));
  }
  if (targetType) {
    conditions.push(eq(auditLogs.targetType, targetType));
  }
  if (dateFrom && dateTo) {
    conditions.push(sql`${auditLogs.createdAt} >= ${dateFrom} AND ${auditLogs.createdAt} <= ${dateTo}`);
  } else if (dateFrom) {
    conditions.push(sql`${auditLogs.createdAt} >= ${dateFrom}`);
  } else if (dateTo) {
    conditions.push(sql`${auditLogs.createdAt} <= ${dateTo}`);
  }
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  const [data, countResult] = await Promise.all([
    db.select().from(auditLogs).where(whereClause).orderBy(desc(auditLogs.createdAt)).limit(pageSize).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(auditLogs).where(whereClause),
  ]);
  return { data, total: countResult[0]?.count ?? 0 };
}

// ==================== Order Export Helpers ====================

export async function exportOrders(params: {
  staffId?: number;
  search?: string;
  staffName?: string;
  account?: string;
  customerType?: string;
  orderNumber?: string;
  orderStatus?: string;
  paymentStatus?: string;
  customerWhatsapp?: string;
  internationalTrackingNo?: string;
  logisticsStatus?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  const db = await getDb();
  if (!db) return [];
  const { search, staffId, staffName, account, customerType, orderNumber, orderStatus, paymentStatus, customerWhatsapp, internationalTrackingNo, logisticsStatus, dateFrom, dateTo } = params;
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
  if (staffName) {
    conditions.push(like(orders.staffName, `%${staffName}%`));
  }
  if (account) {
    conditions.push(like(orders.account, `%${account}%`));
  }
  if (customerType) {
    conditions.push(eq(orders.customerType, customerType));
  }
  if (orderNumber) {
    conditions.push(like(orders.orderNumber, `%${orderNumber}%`));
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
  if (internationalTrackingNo) {
    conditions.push(sql`${orders.id} IN (SELECT ${orderItems.orderId} FROM ${orderItems} WHERE ${orderItems.internationalTrackingNo} LIKE ${'%' + internationalTrackingNo + '%'})`);
  }
  if (logisticsStatus) {
    conditions.push(sql`${orders.id} IN (SELECT ${orderItems.orderId} FROM ${orderItems} WHERE ${orderItems.logisticsStatus} = ${logisticsStatus})`);
  }
  if (dateFrom && dateTo) {
    conditions.push(sql`${orders.orderDate} >= ${dateFrom} AND ${orders.orderDate} <= ${dateTo}`);
  } else if (dateFrom) {
    conditions.push(sql`${orders.orderDate} >= ${dateFrom}`);
  } else if (dateTo) {
    conditions.push(sql`${orders.orderDate} <= ${dateTo}`);
  }
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  // Get all matching orders (no pagination for export)
  const data = await db.select().from(orders).where(whereClause).orderBy(desc(orders.createdAt));
  // Fetch items for all orders
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
  return data.map(o => ({ ...o, items: itemsMap[o.id] || [] }));
}


// ============================================================
// Exchange Rate helpers
// ============================================================

export async function getCurrentExchangeRate() {
  const db = await getDb();
  if (!db) return { rate: "6.4000" };
  const rows = await db.select().from(exchangeRates).orderBy(desc(exchangeRates.id)).limit(1);
  return rows[0] || { rate: "6.4000" };
}

export async function listExchangeRates(page = 1, pageSize = 20) {
  const db = await getDb();
  if (!db) return { data: [], total: 0 };
  const offset = (page - 1) * pageSize;
  const [data, countResult] = await Promise.all([
    db.select().from(exchangeRates).orderBy(desc(exchangeRates.id)).limit(pageSize).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(exchangeRates),
  ]);
  return { data, total: countResult[0]?.count || 0 };
}

export async function createExchangeRate(data: InsertExchangeRate) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(exchangeRates).values(data);
  return { id: result[0].insertId };
}

// ============================================================
// Profit Report helpers
// ============================================================

export async function getProfitReport(params: {
  startDate?: string;
  endDate?: string;
  staffName?: string;
}) {
  const db = await getDb();
  if (!db) return { summary: null, byStaff: [], dailyTrend: [] };

  // Build WHERE conditions for raw SQL
  const whereParts: SQL[] = [];
  if (params.startDate) whereParts.push(sql`o.orderDate >= ${params.startDate}`);
  if (params.endDate) whereParts.push(sql`o.orderDate <= ${params.endDate}`);
  if (params.staffName) whereParts.push(sql`o.staffName = ${params.staffName}`);
  const whereSQL = whereParts.length > 0 ? sql`WHERE ${sql.join(whereParts, sql` AND `)}` : sql``;

  // Summary totals from orders table
  const summaryResult = await db.execute(sql`
    SELECT
      COUNT(DISTINCT o.id) as orderCount,
      COALESCE(SUM(o.totalAmountCny), 0) as totalRevenueCny,
      COALESCE(SUM(o.totalAmountUsd), 0) as totalRevenueUsd,
      COALESCE(SUM(o.totalProfit), 0) as totalProfit,
      COALESCE(AVG(CASE WHEN o.totalProfitRate > 0 THEN o.totalProfitRate ELSE NULL END), 0) as avgProfitRate
    FROM orders o
    ${whereSQL}
  `);
  const summaryRow = (summaryResult as any)[0]?.[0] || {};

  // Sub-item level aggregation for product/shipping breakdown
  const breakdownResult = await db.execute(sql`
    SELECT
      COALESCE(SUM(i.sellingPrice), 0) as totalSellingPrice,
      COALESCE(SUM(i.productCost), 0) as totalProductCost,
      COALESCE(SUM(i.productProfit), 0) as totalProductProfit,
      COALESCE(SUM(i.shippingCharged), 0) as totalShippingCharged,
      COALESCE(SUM(i.shippingActual), 0) as totalShippingActual,
      COALESCE(SUM(i.shippingProfit), 0) as totalShippingProfit,
      COALESCE(SUM(i.totalProfit), 0) as totalItemProfit
    FROM order_items i
    JOIN orders o ON i.orderId = o.id
    ${whereSQL}
  `);
  const breakdown = (breakdownResult as any)[0]?.[0] || {};

  const summary = {
    orderCount: summaryRow.orderCount || 0,
    totalRevenueCny: String(summaryRow.totalRevenueCny || "0"),
    totalRevenueUsd: String(summaryRow.totalRevenueUsd || "0"),
    totalProfit: String(summaryRow.totalProfit || "0"),
    avgProfitRate: String(summaryRow.avgProfitRate || "0"),
    totalSellingPrice: String(breakdown.totalSellingPrice || "0"),
    totalProductCost: String(breakdown.totalProductCost || "0"),
    totalProductProfit: String(breakdown.totalProductProfit || "0"),
    totalShippingCharged: String(breakdown.totalShippingCharged || "0"),
    totalShippingActual: String(breakdown.totalShippingActual || "0"),
    totalShippingProfit: String(breakdown.totalShippingProfit || "0"),
  };

  // By staff
  const byStaffResult = await db.execute(sql`
    SELECT
      o.staffName as staffName,
      COUNT(DISTINCT o.id) as orderCount,
      COALESCE(SUM(o.totalAmountCny), 0) as totalRevenueCny,
      COALESCE(SUM(o.totalProfit), 0) as totalProfit,
      COALESCE(AVG(CASE WHEN o.totalProfitRate > 0 THEN o.totalProfitRate ELSE NULL END), 0) as avgProfitRate
    FROM orders o
    ${whereSQL}
    GROUP BY o.staffName
    ORDER BY totalProfit DESC
  `);
  const byStaff = ((byStaffResult as any)[0] || []).map((r: any) => ({
    staffName: r.staffName,
    orderCount: r.orderCount,
    totalRevenueCny: String(r.totalRevenueCny || "0"),
    totalProfit: String(r.totalProfit || "0"),
    avgProfitRate: String(r.avgProfitRate || "0"),
  }));

  // Daily trend
  const dailyTrendResult = await db.execute(sql`
    SELECT
      DATE_FORMAT(o.orderDate, '%Y-%m-%d') as date,
      COUNT(DISTINCT o.id) as orderCount,
      COALESCE(SUM(o.totalAmountCny), 0) as totalRevenueCny,
      COALESCE(SUM(o.totalProfit), 0) as totalProfit
    FROM orders o
    ${whereSQL}
    GROUP BY DATE_FORMAT(o.orderDate, '%Y-%m-%d')
    ORDER BY date ASC
  `);
  const dailyTrend = ((dailyTrendResult as any)[0] || []).map((r: any) => ({
    date: r.date,
    orderCount: r.orderCount,
    totalRevenueCny: String(r.totalRevenueCny || "0"),
    totalProfit: String(r.totalProfit || "0"),
  }));

  return { summary, byStaff, dailyTrend };
}

export async function getDistinctStaffNames() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.selectDistinct({ staffName: orders.staffName }).from(orders).where(sql`${orders.staffName} IS NOT NULL AND ${orders.staffName} != ''`);
  return rows.map(r => r.staffName).filter(Boolean) as string[];
}

// ============================================================
// Monthly / Quarterly Comparison helpers
// ============================================================

export async function getMonthlyProfitComparison(staffName?: string) {
  const db = await getDb();
  if (!db) return [];

  const staffFilter = staffName ? sql`AND o.staffName = ${staffName}` : sql``;

  // Get monthly aggregated data for the last 24 months
  const result = await db.execute(sql`
    SELECT
      DATE_FORMAT(o.orderDate, '%Y-%m') as period,
      COUNT(DISTINCT o.id) as orderCount,
      COALESCE(SUM(o.totalAmountCny), 0) as totalRevenueCny,
      COALESCE(SUM(o.totalProfit), 0) as totalProfit,
      COALESCE(AVG(CASE WHEN o.totalProfitRate > 0 THEN o.totalProfitRate ELSE NULL END), 0) as avgProfitRate
    FROM orders o
    WHERE o.orderDate IS NOT NULL
      AND o.orderDate >= DATE_SUB(CURDATE(), INTERVAL 24 MONTH)
      ${staffFilter}
    GROUP BY DATE_FORMAT(o.orderDate, '%Y-%m')
    ORDER BY period ASC
  `);

  const rows = ((result as any)[0] || []).map((r: any) => ({
    period: r.period,
    orderCount: Number(r.orderCount || 0),
    totalRevenueCny: String(r.totalRevenueCny || "0"),
    totalProfit: String(r.totalProfit || "0"),
    avgProfitRate: String(r.avgProfitRate || "0"),
  }));

  // Calculate MoM (环比) and YoY (同比)
  return rows.map((row: any, index: number) => {
    const prevMonth = rows[index - 1];
    const [year, month] = row.period.split("-").map(Number);
    const lastYearPeriod = `${year - 1}-${String(month).padStart(2, "0")}`;
    const lastYearRow = rows.find((r: any) => r.period === lastYearPeriod);

    const currentProfit = parseFloat(row.totalProfit);
    const currentRevenue = parseFloat(row.totalRevenueCny);

    // MoM (环比)
    let momProfitGrowth: number | null = null;
    let momRevenueGrowth: number | null = null;
    if (prevMonth) {
      const prevProfit = parseFloat(prevMonth.totalProfit);
      const prevRevenue = parseFloat(prevMonth.totalRevenueCny);
      momProfitGrowth = prevProfit !== 0 ? (currentProfit - prevProfit) / Math.abs(prevProfit) : null;
      momRevenueGrowth = prevRevenue !== 0 ? (currentRevenue - prevRevenue) / Math.abs(prevRevenue) : null;
    }

    // YoY (同比)
    let yoyProfitGrowth: number | null = null;
    let yoyRevenueGrowth: number | null = null;
    if (lastYearRow) {
      const lyProfit = parseFloat(lastYearRow.totalProfit);
      const lyRevenue = parseFloat(lastYearRow.totalRevenueCny);
      yoyProfitGrowth = lyProfit !== 0 ? (currentProfit - lyProfit) / Math.abs(lyProfit) : null;
      yoyRevenueGrowth = lyRevenue !== 0 ? (currentRevenue - lyRevenue) / Math.abs(lyRevenue) : null;
    }

    return {
      ...row,
      momProfitGrowth,
      momRevenueGrowth,
      yoyProfitGrowth,
      yoyRevenueGrowth,
    };
  });
}

export async function getQuarterlyProfitComparison(staffName?: string) {
  const db = await getDb();
  if (!db) return [];

  const staffFilter = staffName ? sql`AND o.staffName = ${staffName}` : sql``;

  const result = await db.execute(sql`
    SELECT
      CONCAT(YEAR(o.orderDate), '-Q', QUARTER(o.orderDate)) as period,
      COUNT(DISTINCT o.id) as orderCount,
      COALESCE(SUM(o.totalAmountCny), 0) as totalRevenueCny,
      COALESCE(SUM(o.totalProfit), 0) as totalProfit,
      COALESCE(AVG(CASE WHEN o.totalProfitRate > 0 THEN o.totalProfitRate ELSE NULL END), 0) as avgProfitRate
    FROM orders o
    WHERE o.orderDate IS NOT NULL
      AND o.orderDate >= DATE_SUB(CURDATE(), INTERVAL 8 QUARTER)
      ${staffFilter}
    GROUP BY CONCAT(YEAR(o.orderDate), '-Q', QUARTER(o.orderDate)), YEAR(o.orderDate), QUARTER(o.orderDate)
    ORDER BY YEAR(o.orderDate) ASC, QUARTER(o.orderDate) ASC
  `);

  const rows = ((result as any)[0] || []).map((r: any) => ({
    period: r.period,
    orderCount: Number(r.orderCount || 0),
    totalRevenueCny: String(r.totalRevenueCny || "0"),
    totalProfit: String(r.totalProfit || "0"),
    avgProfitRate: String(r.avgProfitRate || "0"),
  }));

  // Calculate QoQ (环比) and YoY (同比)
  return rows.map((row: any, index: number) => {
    const prevQuarter = rows[index - 1];
    // Parse period like "2026-Q1"
    const match = row.period.match(/(\d{4})-Q(\d)/);
    const year = match ? parseInt(match[1]) : 0;
    const quarter = match ? parseInt(match[2]) : 0;
    const lastYearPeriod = `${year - 1}-Q${quarter}`;
    const lastYearRow = rows.find((r: any) => r.period === lastYearPeriod);

    const currentProfit = parseFloat(row.totalProfit);
    const currentRevenue = parseFloat(row.totalRevenueCny);

    let qoqProfitGrowth: number | null = null;
    let qoqRevenueGrowth: number | null = null;
    if (prevQuarter) {
      const prevProfit = parseFloat(prevQuarter.totalProfit);
      const prevRevenue = parseFloat(prevQuarter.totalRevenueCny);
      qoqProfitGrowth = prevProfit !== 0 ? (currentProfit - prevProfit) / Math.abs(prevProfit) : null;
      qoqRevenueGrowth = prevRevenue !== 0 ? (currentRevenue - prevRevenue) / Math.abs(prevRevenue) : null;
    }

    let yoyProfitGrowth: number | null = null;
    let yoyRevenueGrowth: number | null = null;
    if (lastYearRow) {
      const lyProfit = parseFloat(lastYearRow.totalProfit);
      const lyRevenue = parseFloat(lastYearRow.totalRevenueCny);
      yoyProfitGrowth = lyProfit !== 0 ? (currentProfit - lyProfit) / Math.abs(lyProfit) : null;
      yoyRevenueGrowth = lyRevenue !== 0 ? (currentRevenue - lyRevenue) / Math.abs(lyRevenue) : null;
    }

    return {
      ...row,
      qoqProfitGrowth,
      qoqRevenueGrowth,
      yoyProfitGrowth,
      yoyRevenueGrowth,
    };
  });
}

// ============================================================
// Profit Alert Settings helpers
// ============================================================

export async function getProfitAlertSetting() {
  const db = await getDb();
  if (!db) return { id: 0, minProfitRate: "0.100000", enabled: 1, updatedByName: null };
  const rows = await db.select().from(profitAlertSettings).orderBy(desc(profitAlertSettings.id)).limit(1);
  if (rows.length === 0) {
    return { id: 0, minProfitRate: "0.100000", enabled: 1, updatedByName: null };
  }
  return rows[0];
}

export async function upsertProfitAlertSetting(data: { minProfitRate: string; enabled: number; updatedById: number; updatedByName: string }) {
  const db = await getDb();
  if (!db) return { id: 0 };
  // Always insert a new row to keep history
  const result = await db.insert(profitAlertSettings).values({
    minProfitRate: data.minProfitRate,
    enabled: data.enabled,
    updatedById: data.updatedById,
    updatedByName: data.updatedByName,
  });
  return { id: Number(result[0].insertId) };
}

export async function getStaffProfitAlerts(minProfitRate: number) {
  const db = await getDb();
  if (!db) return [];

  const result = await db.execute(sql`
    SELECT
      o.staffName,
      COUNT(DISTINCT o.id) as orderCount,
      COALESCE(SUM(o.totalAmountCny), 0) as totalRevenueCny,
      COALESCE(SUM(o.totalProfit), 0) as totalProfit,
      COALESCE(AVG(CASE WHEN o.totalProfitRate > 0 THEN o.totalProfitRate ELSE NULL END), 0) as avgProfitRate
    FROM orders o
    WHERE o.staffName IS NOT NULL AND o.staffName != ''
    GROUP BY o.staffName
    HAVING avgProfitRate < ${minProfitRate} AND avgProfitRate > 0
    ORDER BY avgProfitRate ASC
  `);

  return ((result as any)[0] || []).map((r: any) => ({
    staffName: r.staffName,
    orderCount: Number(r.orderCount || 0),
    totalRevenueCny: String(r.totalRevenueCny || "0"),
    totalProfit: String(r.totalProfit || "0"),
    avgProfitRate: String(r.avgProfitRate || "0"),
  }));
}

// ============================================================
// Staff Monthly Targets helpers
// ============================================================

export async function listStaffMonthlyTargets(yearMonth: string) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(staffMonthlyTargets)
    .where(eq(staffMonthlyTargets.yearMonth, yearMonth))
    .orderBy(staffMonthlyTargets.staffName);
}

export async function getStaffMonthlyTarget(staffId: number, yearMonth: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(staffMonthlyTargets)
    .where(and(
      eq(staffMonthlyTargets.staffId, staffId),
      eq(staffMonthlyTargets.yearMonth, yearMonth),
    ))
    .limit(1);
  return rows[0] || null;
}

export async function upsertStaffMonthlyTarget(data: {
  staffId: number;
  staffName: string;
  yearMonth: string;
  profitTarget: string;
  revenueTarget: string;
  setById: number;
  setByName: string;
}) {
  const db = await getDb();
  if (!db) return { id: 0 };

  // Check if target already exists for this staff+month
  const existing = await getStaffMonthlyTarget(data.staffId, data.yearMonth);
  if (existing) {
    await db.update(staffMonthlyTargets)
      .set({
        profitTarget: data.profitTarget,
        revenueTarget: data.revenueTarget,
        setById: data.setById,
        setByName: data.setByName,
      })
      .where(eq(staffMonthlyTargets.id, existing.id));
    return { id: existing.id };
  }

  const result = await db.insert(staffMonthlyTargets).values({
    staffId: data.staffId,
    staffName: data.staffName,
    yearMonth: data.yearMonth,
    profitTarget: data.profitTarget,
    revenueTarget: data.revenueTarget,
    setById: data.setById,
    setByName: data.setByName,
  });
  return { id: Number(result[0].insertId) };
}

export async function deleteStaffMonthlyTarget(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(staffMonthlyTargets).where(eq(staffMonthlyTargets.id, id));
}

/**
 * 获取客服月度目标完成率分析
 * 返回每个客服的目标、实际完成值和完成率
 */
export async function getStaffTargetProgress(yearMonth: string) {
  const db = await getDb();
  if (!db) return [];

  // Get all targets for this month
  const targets = await listStaffMonthlyTargets(yearMonth);
  if (targets.length === 0) return [];

  // Get actual performance for each staff in this month
  // 营收从 orders 表获取，利润使用 order_items 的产品毛利润（productProfit）之和
  const result = await db.execute(sql`
    SELECT
      o.staffName,
      o.staffId,
      COUNT(o.id) as orderCount,
      COALESCE(SUM(o.totalAmountCny), 0) as actualRevenue,
      COALESCE((
        SELECT SUM(i.productProfit)
        FROM order_items i
        INNER JOIN orders o2 ON i.orderId = o2.id
        WHERE DATE_FORMAT(o2.orderDate, '%Y-%m') = ${yearMonth}
          AND o2.staffId = o.staffId
      ), 0) as actualProfit
    FROM orders o
    WHERE DATE_FORMAT(o.orderDate, '%Y-%m') = ${yearMonth}
      AND o.staffId IS NOT NULL
    GROUP BY o.staffId, o.staffName
  `);

  const actualMap = new Map<number, { staffName: string; orderCount: number; actualRevenue: string; actualProfit: string }>();
  for (const r of (result as any)[0] || []) {
    actualMap.set(Number(r.staffId), {
      staffName: r.staffName,
      orderCount: Number(r.orderCount || 0),
      actualRevenue: String(r.actualRevenue || "0"),
      actualProfit: String(r.actualProfit || "0"),
    });
  }

  return targets.map(t => {
    const actual = actualMap.get(t.staffId) || { staffName: t.staffName, orderCount: 0, actualRevenue: "0", actualProfit: "0" };
    const profitTarget = parseFloat(String(t.profitTarget));
    const revenueTarget = parseFloat(String(t.revenueTarget));
    const actualProfit = parseFloat(actual.actualProfit);
    const actualRevenue = parseFloat(actual.actualRevenue);

    const profitProgress = profitTarget > 0 ? actualProfit / profitTarget : 0;
    const revenueProgress = revenueTarget > 0 ? actualRevenue / revenueTarget : 0;
    const profitGap = profitTarget - actualProfit;
    const revenueGap = revenueTarget - actualRevenue;

    return {
      targetId: t.id,
      staffId: t.staffId,
      staffName: t.staffName,
      yearMonth: t.yearMonth,
      profitTarget: String(t.profitTarget),
      revenueTarget: String(t.revenueTarget),
      actualProfit: actual.actualProfit,
      actualRevenue: actual.actualRevenue,
      orderCount: actual.orderCount,
      profitProgress: Math.round(profitProgress * 10000) / 10000, // 4 decimal places
      revenueProgress: Math.round(revenueProgress * 10000) / 10000,
      profitGap: profitGap.toFixed(2),
      revenueGap: revenueGap.toFixed(2),
    };
  });
}

/**
 * 获取所有有订单的客服列表（含ID和名称）
 */
export async function getStaffList() {
  const db = await getDb();
  if (!db) return [];
  const result = await db.execute(sql`
    SELECT DISTINCT u.id as staffId, u.name as staffName
    FROM users u
    WHERE u.role IN ('user', 'admin')
      AND u.name IS NOT NULL AND u.name != ''
    ORDER BY u.name ASC
  `);
  return ((result as any)[0] || []).map((r: any) => ({
    staffId: Number(r.staffId),
    staffName: String(r.staffName),
  }));
}

// ==================== 每日数据 ====================

/**
 * 从订单表自动汇总某个客服某天的数据
 */
export async function getDailyOrderSummary(account: string, reportDate: string) {
  const db = await getDb();
  if (!db) return { totalRevenue: "0", productSellingPrice: "0", shippingCharged: "0", estimatedProfit: "0" };

  // Normalize reportDate to YYYY-MM-DD format
  const dateStr = String(reportDate);
  const normalizedDate = dateStr.includes('T')
    ? dateStr.split('T')[0]
    : dateStr.match(/\d{4}-\d{2}-\d{2}/)?.[0] || dateStr;

  const [rows] = await db.execute(sql`
    SELECT
      COALESCE(SUM(o.totalAmountCny), 0) as totalRevenue,
      COALESCE((
        SELECT SUM(oi.sellingPrice)
        FROM order_items oi
        JOIN orders o2 ON oi.orderId = o2.id
        WHERE o2.account = ${account} AND DATE(o2.orderDate) = ${normalizedDate}
      ), 0) as productSellingPrice,
      COALESCE((
        SELECT SUM(oi.shippingCharged)
        FROM order_items oi
        JOIN orders o2 ON oi.orderId = o2.id
        WHERE o2.account = ${account} AND DATE(o2.orderDate) = ${normalizedDate}
      ), 0) as shippingCharged,
      COALESCE((
        SELECT SUM(oi.productProfit)
        FROM order_items oi
        JOIN orders o2 ON oi.orderId = o2.id
        WHERE o2.account = ${account} AND DATE(o2.orderDate) = ${normalizedDate}
      ), 0) as estimatedProfit
    FROM orders o
    WHERE o.account = ${account} AND DATE(o.orderDate) = ${normalizedDate}
  `);
  const row = (rows as unknown as any[])[0] || {};
  return {
    totalRevenue: String(row.totalRevenue || "0"),
    productSellingPrice: String(row.productSellingPrice || "0"),
    shippingCharged: String(row.shippingCharged || "0"),
    estimatedProfit: String(row.estimatedProfit || "0"),
  };
}

/**
 * 获取订单表中所有不重复的 account 值
 */
export async function getDistinctOrderAccounts() {
  const db = await getDb();
  if (!db) return [];

  const [rows] = await db.execute(sql`
    SELECT DISTINCT account FROM orders WHERE account IS NOT NULL AND account != '' ORDER BY account ASC
  `);
  return (rows as unknown as any[]).map((r: any) => r.account as string);
}

/**
 * 查询每日数据列表
 */
export async function listDailyData(params: {
  startDate?: string;
  endDate?: string;
  staffName?: string;
  staffId?: number;
}) {
  const db = await getDb();
  if (!db) return [];

  const conditions: SQL[] = [];
  if (params.startDate) conditions.push(sql`d.reportDate >= ${params.startDate}`);
  if (params.endDate) conditions.push(sql`d.reportDate <= ${params.endDate}`);
  if (params.staffName) conditions.push(sql`d.staffName = ${params.staffName}`);
  if (params.staffId) conditions.push(sql`d.staffId = ${params.staffId}`);

  const whereClause = conditions.length > 0
    ? sql`WHERE ${sql.join(conditions, sql` AND `)}`
    : sql``;

  const [rows] = await db.execute(sql`
    SELECT * FROM daily_data d
    ${whereClause}
    ORDER BY d.reportDate DESC, d.staffName ASC
  `);
  return rows as unknown as any[];
}

/**
 * 创建每日数据记录
 */
export async function createDailyData(data: InsertDailyData) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(dailyData).values(data);
  return { id: result[0].insertId };
}

/**
 * 更新每日数据记录
 */
export async function updateDailyData(id: number, data: Partial<InsertDailyData>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(dailyData).set(data).where(eq(dailyData.id, id));
  return { success: true };
}

/**
 * 删除每日数据记录
 */
export async function deleteDailyData(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(dailyData).where(eq(dailyData.id, id));
  return { success: true };
}

/**
 * 获取单条每日数据
 */
export async function getDailyDataById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(dailyData).where(eq(dailyData.id, id));
  return rows[0] || null;
}

/**
 * 生成日报表数据 - 管理员按客服维度汇总（合并同一客服的所有账号数据）
 */
export async function getDailyReportByStaff(reportDate: string, staffName?: string) {
  const db = await getDb();
  if (!db) return { rows: [], totals: null };

  const conditions: SQL[] = [sql`DATE(d.reportDate) = ${reportDate}`];
  if (staffName) conditions.push(sql`d.staffName = ${staffName}`);

  const whereClause = sql`WHERE ${sql.join(conditions, sql` AND `)}`;

  // 按客服维度汇总
  const [rows] = await db.execute(sql`
    SELECT
      d.staffId,
      d.staffName,
      SUM(d.messageCount) as messageCount,
      SUM(d.newCustomerCount) as newCustomerCount,
      SUM(d.newIntentCount) as newIntentCount,
      SUM(d.returnVisitCount) as returnVisitCount,
      SUM(d.newOrderCount) as newOrderCount,
      SUM(d.oldOrderCount) as oldOrderCount,
      SUM(d.onlineOrderCount) as onlineOrderCount,
      SUM(d.itemCount) as itemCount,
      SUM(d.totalRevenue) as totalRevenue,
      SUM(d.onlineRevenue) as onlineRevenue,
      SUM(d.productSellingPrice) as productSellingPrice,
      SUM(d.shippingCharged) as shippingCharged,
      SUM(d.estimatedProfit) as estimatedProfit,
      CASE WHEN SUM(d.totalRevenue) > 0
        THEN SUM(d.estimatedProfit) / SUM(d.totalRevenue)
        ELSE 0 END as estimatedProfitRate,
      SUM(d.telegramPraiseCount) as telegramPraiseCount,
      SUM(d.referralCount) as referralCount
    FROM daily_data d
    ${whereClause}
    GROUP BY d.staffId, d.staffName
    ORDER BY d.staffName ASC
  `);

  // 计算汇总
  const [totalsRows] = await db.execute(sql`
    SELECT
      COUNT(DISTINCT d.staffId) as staffCount,
      SUM(d.messageCount) as totalMessages,
      SUM(d.newCustomerCount) as totalNewCustomers,
      SUM(d.newIntentCount) as totalNewIntents,
      SUM(d.returnVisitCount) as totalReturnVisits,
      SUM(d.newOrderCount) as totalNewOrders,
      SUM(d.oldOrderCount) as totalOldOrders,
      SUM(d.onlineOrderCount) as totalOnlineOrders,
      SUM(d.itemCount) as totalItems,
      SUM(d.totalRevenue) as totalRevenue,
      SUM(d.onlineRevenue) as totalOnlineRevenue,
      SUM(d.productSellingPrice) as totalProductSellingPrice,
      SUM(d.shippingCharged) as totalShippingCharged,
      SUM(d.estimatedProfit) as totalEstimatedProfit,
      CASE WHEN SUM(d.totalRevenue) > 0 
        THEN SUM(d.estimatedProfit) / SUM(d.totalRevenue) 
        ELSE 0 END as avgProfitRate,
      SUM(d.telegramPraiseCount) as totalTelegramPraise,
      SUM(d.referralCount) as totalReferrals
    FROM daily_data d
    ${whereClause}
  `);

  return {
    rows: rows as unknown as any[],
    totals: (totalsRows as unknown as any[])[0] || null,
  };
}

/**
 * 生成日报表数据 - 客服按账号维度展示（每行一个账号的数据）
 */
export async function getDailyReportByAccount(reportDate: string, staffName: string) {
  const db = await getDb();
  if (!db) return { rows: [], totals: null };

  const [rows] = await db.execute(sql`
    SELECT * FROM daily_data d
    WHERE DATE(d.reportDate) = ${reportDate}
      AND d.staffName = ${staffName}
    ORDER BY d.whatsAccount ASC
  `);

  // 计算汇总
  const [totalsRows] = await db.execute(sql`
    SELECT
      COUNT(*) as accountCount,
      SUM(d.messageCount) as totalMessages,
      SUM(d.newCustomerCount) as totalNewCustomers,
      SUM(d.newIntentCount) as totalNewIntents,
      SUM(d.returnVisitCount) as totalReturnVisits,
      SUM(d.newOrderCount) as totalNewOrders,
      SUM(d.oldOrderCount) as totalOldOrders,
      SUM(d.onlineOrderCount) as totalOnlineOrders,
      SUM(d.itemCount) as totalItems,
      SUM(d.totalRevenue) as totalRevenue,
      SUM(d.onlineRevenue) as totalOnlineRevenue,
      SUM(d.productSellingPrice) as totalProductSellingPrice,
      SUM(d.shippingCharged) as totalShippingCharged,
      SUM(d.estimatedProfit) as totalEstimatedProfit,
      CASE WHEN SUM(d.totalRevenue) > 0 
        THEN SUM(d.estimatedProfit) / SUM(d.totalRevenue) 
        ELSE 0 END as avgProfitRate,
      SUM(d.telegramPraiseCount) as totalTelegramPraise,
      SUM(d.referralCount) as totalReferrals
    FROM daily_data d
    WHERE DATE(d.reportDate) = ${reportDate}
      AND d.staffName = ${staffName}
  `);

  return {
    rows: rows as unknown as any[],
    totals: (totalsRows as unknown as any[])[0] || null,
  };
}

/**
 * 管理员下钻 - 根据日期和客服名字查询该客服下所有账号的明细数据
 */
export async function getDailyReportDrillDown(reportDate: string, staffName: string) {
  const db = await getDb();
  if (!db) return [];

  const [rows] = await db.execute(sql`
    SELECT * FROM daily_data d
    WHERE DATE(d.reportDate) = ${reportDate}
      AND d.staffName = ${staffName}
    ORDER BY d.whatsAccount ASC
  `);

  return rows as unknown as any[];
}

// ==================== 日报表备注 ====================

/**
 * 获取某日的所有备注
 */
export async function listDailyReportNotes(reportDate: string) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(dailyReportNotes)
    .where(sql`DATE(${dailyReportNotes.reportDate}) = ${reportDate}`)
    .orderBy(dailyReportNotes.createdAt);
  return rows;
}

/**
 * 创建日报表备注
 */
export async function createDailyReportNote(data: Omit<InsertDailyReportNote, 'reportDate'> & { reportDate: string | Date }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Ensure reportDate is stored as a proper date string without timezone shift
  const dateStr = typeof data.reportDate === 'string' ? data.reportDate : data.reportDate.toISOString().slice(0, 10);
  const result = await db.insert(dailyReportNotes).values({
    ...data,
    reportDate: sql`${dateStr}`,
  } as any);
  return { id: result[0].insertId };
}

/**
 * 更新日报表备注
 */
export async function updateDailyReportNote(id: number, content: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(dailyReportNotes).set({ content }).where(eq(dailyReportNotes.id, id));
  return { success: true };
}

/**
 * 删除日报表备注
 */
export async function deleteDailyReportNote(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(dailyReportNotes).where(eq(dailyReportNotes.id, id));
  return { success: true };
}

/**
 * 获取单条备注
 */
export async function getDailyReportNoteById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(dailyReportNotes).where(eq(dailyReportNotes.id, id));
  return rows[0] || null;
}

/**
 * 批量同步订单汇总数据到每日数据表
 */
export async function syncOrderDataToDailyData(id: number, whatsAccount: string, reportDate: string) {
  if (!whatsAccount) return { success: false, message: "请先选择whats账号" };
  const summary = await getDailyOrderSummary(whatsAccount, reportDate);
  const totalRev = parseFloat(summary.totalRevenue) || 0;
  const estProfit = parseFloat(summary.estimatedProfit) || 0;
  const profitRate = totalRev > 0 ? (estProfit / totalRev).toFixed(6) : "0";

  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(dailyData).set({
    totalRevenue: summary.totalRevenue,
    productSellingPrice: summary.productSellingPrice,
    shippingCharged: summary.shippingCharged,
    estimatedProfit: summary.estimatedProfit,
    estimatedProfitRate: profitRate,
  }).where(eq(dailyData.id, id));
  return { success: true };
}

// ==================== 账号管理 ====================

/**
 * 获取所有账号列表（按 sortOrder 排序）
 */
export async function listAccounts() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(accounts).orderBy(accounts.sortOrder);
  return rows;
}

/**
 * 创建新账号
 */
export async function createAccount(data: { name: string; color?: string; sortOrder?: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Get max sortOrder if not provided
  if (data.sortOrder === undefined) {
    const [rows] = await db.execute(sql`SELECT COALESCE(MAX(sortOrder), -1) + 1 as nextOrder FROM accounts`);
    data.sortOrder = (rows as any)[0]?.nextOrder || 0;
  }
  const result = await db.insert(accounts).values({
    name: data.name,
    color: data.color || "#94a3b8",
    sortOrder: data.sortOrder,
  });
  return { id: result[0].insertId };
}

/**
 * 更新账号
 */
export async function updateAccount(id: number, data: { name?: string; color?: string; sortOrder?: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const updateData: any = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.color !== undefined) updateData.color = data.color;
  if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;
  await db.update(accounts).set(updateData).where(eq(accounts.id, id));
  return { success: true };
}

/**
 * 删除账号
 */
export async function deleteAccount(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(accounts).where(eq(accounts.id, id));
  return { success: true };
}

/**
 * 批量更新账号排序
 */
export async function reorderAccounts(items: { id: number; sortOrder: number }[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  for (const item of items) {
    await db.update(accounts).set({ sortOrder: item.sortOrder }).where(eq(accounts.id, item.id));
  }
  return { success: true };
}


// ==================== Dashboard V2 统计函数 ====================

interface DashboardFilters {
  dateFrom?: string;
  dateTo?: string;
  staffId?: number;
}

function buildDateCondition(dateFrom?: string, dateTo?: string) {
  const conditions: SQL[] = [];
  if (dateFrom) conditions.push(sql`${orders.orderDate} >= ${dateFrom}`);
  if (dateTo) conditions.push(sql`${orders.orderDate} <= ${dateTo}`);
  return conditions;
}

/**
 * 仪表盘汇总数据（支持日期筛选）
 */
export async function getDashboardSummary(filters: DashboardFilters) {
  const db = await getDb();
  if (!db) return {
    totalRevenueCny: 0, estimatedProfit: 0, totalReturnVisit: 0, totalPraise: 0,
    totalNewCustomers: 0, newCustomerOrders: 0, totalOldCustomers: 0, oldCustomerOrders: 0,
  };

  const conditions: SQL[] = [];
  if (filters.dateFrom) conditions.push(sql`o.orderDate >= ${filters.dateFrom}`);
  if (filters.dateTo) conditions.push(sql`o.orderDate <= ${filters.dateTo}`);
  if (filters.staffId) conditions.push(sql`o.staffId = ${filters.staffId}`);
  const whereStr = conditions.length > 0 ? sql.join([sql`WHERE `, sql.join(conditions, sql` AND `)], sql``) : sql``;

  // 总营业额 & 预估总利润（从order_items汇总）
  const revenueResult = await db.execute(sql`
    SELECT 
      COALESCE(SUM(oi.amountCny), 0) as totalRevenueCny,
      COALESCE(SUM(oi.productProfit), 0) as estimatedProfit
    FROM order_items oi
    JOIN orders o ON oi.orderId = o.id
    ${whereStr}
  `);
  const rev = (revenueResult as any)[0]?.[0] || { totalRevenueCny: 0, estimatedProfit: 0 };

  // 从每日数据表汇总回访人数和好评人数
  const dailyConditions: SQL[] = [];
  if (filters.dateFrom) dailyConditions.push(sql`dd.reportDate >= ${filters.dateFrom}`);
  if (filters.dateTo) dailyConditions.push(sql`dd.reportDate <= ${filters.dateTo}`);
  if (filters.staffId) dailyConditions.push(sql`dd.staffId = ${filters.staffId}`);
  const dailyWhereStr = dailyConditions.length > 0 ? sql.join([sql`WHERE `, sql.join(dailyConditions, sql` AND `)], sql``) : sql``;

  const dailyResult = await db.execute(sql`
    SELECT 
      COALESCE(SUM(dd.returnVisitCount), 0) as totalReturnVisit,
      COALESCE(SUM(dd.telegramPraiseCount), 0) as totalPraise,
      COALESCE(SUM(dd.newCustomerCount), 0) as totalNewCustomers,
      COALESCE(SUM(dd.newOrderCount), 0) as newCustomerOrders,
      COALESCE(SUM(dd.oldOrderCount), 0) as oldCustomerOrders
    FROM daily_data dd
    ${dailyWhereStr}
  `);
  const daily = (dailyResult as any)[0]?.[0] || { totalReturnVisit: 0, totalPraise: 0, totalNewCustomers: 0, newCustomerOrders: 0, oldCustomerOrders: 0 };

  // 老客总数：在customers表中有多次订单的客户数
  const oldCustConditions: SQL[] = [];
  if (filters.staffId) oldCustConditions.push(sql`o.staffId = ${filters.staffId}`);
  if (filters.dateFrom) oldCustConditions.push(sql`o.orderDate >= ${filters.dateFrom}`);
  if (filters.dateTo) oldCustConditions.push(sql`o.orderDate <= ${filters.dateTo}`);
  const oldCustWhere = oldCustConditions.length > 0 ? sql.join([sql`WHERE `, sql.join(oldCustConditions, sql` AND `)], sql``) : sql``;

  const oldCustResult = await db.execute(sql`
    SELECT COUNT(*) as cnt FROM (
      SELECT customerWhatsapp FROM orders o ${oldCustWhere}
      GROUP BY customerWhatsapp HAVING COUNT(*) > 1
    ) t
  `);
  const totalOldCustomers = Number((oldCustResult as any)[0]?.[0]?.cnt || 0);

  return {
    totalRevenueCny: Number(rev.totalRevenueCny),
    estimatedProfit: Number(rev.estimatedProfit),
    totalReturnVisit: Number(daily.totalReturnVisit),
    totalPraise: Number(daily.totalPraise),
    totalNewCustomers: Number(daily.totalNewCustomers),
    newCustomerOrders: Number(daily.newCustomerOrders),
    totalOldCustomers,
    oldCustomerOrders: Number(daily.oldCustomerOrders),
  };
}

/**
 * 客服总营业额排行榜
 */
export async function getStaffRevenueRanking(filters: DashboardFilters) {
  const db = await getDb();
  if (!db) return [];
  const conditions: SQL[] = [];
  if (filters.dateFrom) conditions.push(sql`orderDate >= ${filters.dateFrom}`);
  if (filters.dateTo) conditions.push(sql`orderDate <= ${filters.dateTo}`);
  if (filters.staffId) conditions.push(sql`staffId = ${filters.staffId}`);
  const whereStr = conditions.length > 0 ? sql.join([sql`WHERE `, sql.join(conditions, sql` AND `)], sql``) : sql``;

  const result = await db.execute(sql`
    SELECT staffName, staffId,
      COUNT(*) as orderCount,
      COALESCE(SUM(totalAmountCny), 0) as totalRevenueCny,
      COALESCE(SUM(totalProfit), 0) as totalProfit
    FROM orders ${whereStr}
    GROUP BY staffId, staffName
    ORDER BY totalRevenueCny DESC
  `);
  return ((result as any)[0] || []).map((r: any) => ({
    staffName: r.staffName,
    staffId: r.staffId,
    orderCount: Number(r.orderCount),
    totalRevenueCny: Number(r.totalRevenueCny),
    totalProfit: Number(r.totalProfit),
  }));
}

/**
 * 每月新老客成交率
 */
export async function getMonthlyNewOldCustomerRate(filters: DashboardFilters) {
  const db = await getDb();
  if (!db) return [];
  const conditions: SQL[] = [];
  if (filters.dateFrom) conditions.push(sql`reportDate >= ${filters.dateFrom}`);
  if (filters.dateTo) conditions.push(sql`reportDate <= ${filters.dateTo}`);
  if (filters.staffId) conditions.push(sql`staffId = ${filters.staffId}`);
  const whereStr = conditions.length > 0 ? sql.join([sql`WHERE `, sql.join(conditions, sql` AND `)], sql``) : sql``;

  const result = await db.execute(sql`
    SELECT 
      DATE_FORMAT(reportDate, '%Y-%m') as month,
      COALESCE(SUM(newOrderCount), 0) as newOrders,
      COALESCE(SUM(oldOrderCount), 0) as oldOrders,
      COALESCE(SUM(newOrderCount) + SUM(oldOrderCount), 0) as totalOrders
    FROM daily_data ${whereStr}
    GROUP BY DATE_FORMAT(reportDate, '%Y-%m')
    ORDER BY month
  `);
  return ((result as any)[0] || []).map((r: any) => ({
    month: r.month,
    newOrders: Number(r.newOrders),
    oldOrders: Number(r.oldOrders),
    totalOrders: Number(r.totalOrders),
    newRate: Number(r.totalOrders) > 0 ? Number(r.newOrders) / Number(r.totalOrders) : 0,
    oldRate: Number(r.totalOrders) > 0 ? Number(r.oldOrders) / Number(r.totalOrders) : 0,
  }));
}

/**
 * 各账号营业额、利润
 */
export async function getAccountRevenue(filters: DashboardFilters) {
  const db = await getDb();
  if (!db) return [];
  const conditions: SQL[] = [];
  if (filters.dateFrom) conditions.push(sql`orderDate >= ${filters.dateFrom}`);
  if (filters.dateTo) conditions.push(sql`orderDate <= ${filters.dateTo}`);
  if (filters.staffId) conditions.push(sql`staffId = ${filters.staffId}`);
  const whereStr = conditions.length > 0 ? sql.join([sql`WHERE `, sql.join(conditions, sql` AND `)], sql``) : sql``;

  const result = await db.execute(sql`
    SELECT account,
      COUNT(*) as orderCount,
      COALESCE(SUM(totalAmountCny), 0) as totalRevenueCny,
      COALESCE(SUM(totalProfit), 0) as totalProfit
    FROM orders ${whereStr}
    GROUP BY account
    ORDER BY totalRevenueCny DESC
  `);
  return ((result as any)[0] || []).map((r: any) => ({
    account: r.account || "未知",
    orderCount: Number(r.orderCount),
    totalRevenueCny: Number(r.totalRevenueCny),
    totalProfit: Number(r.totalProfit),
  }));
}

/**
 * 每月预估总营业额、利润
 */
export async function getMonthlyRevenue(filters: DashboardFilters) {
  const db = await getDb();
  if (!db) return [];
  const conditions: SQL[] = [];
  if (filters.dateFrom) conditions.push(sql`orderDate >= ${filters.dateFrom}`);
  if (filters.dateTo) conditions.push(sql`orderDate <= ${filters.dateTo}`);
  if (filters.staffId) conditions.push(sql`staffId = ${filters.staffId}`);
  const whereStr = conditions.length > 0 ? sql.join([sql`WHERE `, sql.join(conditions, sql` AND `)], sql``) : sql``;

  const result = await db.execute(sql`
    SELECT 
      DATE_FORMAT(orderDate, '%Y-%m') as month,
      COALESCE(SUM(totalAmountCny), 0) as totalRevenueCny,
      COALESCE(SUM(totalProfit), 0) as totalProfit,
      COUNT(*) as orderCount
    FROM orders ${whereStr}
    GROUP BY DATE_FORMAT(orderDate, '%Y-%m')
    ORDER BY month
  `);
  return ((result as any)[0] || []).map((r: any) => ({
    month: r.month,
    totalRevenueCny: Number(r.totalRevenueCny),
    totalProfit: Number(r.totalProfit),
    orderCount: Number(r.orderCount),
  }));
}

/**
 * 个人预估营业额、利润（按客服分组的月度数据）
 */
export async function getStaffMonthlyRevenue(filters: DashboardFilters) {
  const db = await getDb();
  if (!db) return [];
  const conditions: SQL[] = [];
  if (filters.dateFrom) conditions.push(sql`orderDate >= ${filters.dateFrom}`);
  if (filters.dateTo) conditions.push(sql`orderDate <= ${filters.dateTo}`);
  if (filters.staffId) conditions.push(sql`staffId = ${filters.staffId}`);
  const whereStr = conditions.length > 0 ? sql.join([sql`WHERE `, sql.join(conditions, sql` AND `)], sql``) : sql``;

  const result = await db.execute(sql`
    SELECT 
      staffName, staffId,
      DATE_FORMAT(orderDate, '%Y-%m') as month,
      COALESCE(SUM(totalAmountCny), 0) as totalRevenueCny,
      COALESCE(SUM(totalProfit), 0) as totalProfit,
      COUNT(*) as orderCount
    FROM orders ${whereStr}
    GROUP BY staffId, staffName, DATE_FORMAT(orderDate, '%Y-%m')
    ORDER BY staffName, month
  `);
  return ((result as any)[0] || []).map((r: any) => ({
    staffName: r.staffName,
    staffId: r.staffId,
    month: r.month,
    totalRevenueCny: Number(r.totalRevenueCny),
    totalProfit: Number(r.totalProfit),
    orderCount: Number(r.orderCount),
  }));
}

/**
 * 客户属性分布饼状图
 */
export async function getCustomerTypeDistribution(filters: DashboardFilters) {
  const db = await getDb();
  if (!db) return [];
  const conditions: SQL[] = [];
  if (filters.staffId) conditions.push(sql`createdById = ${filters.staffId}`);
  const whereStr = conditions.length > 0 ? sql.join([sql`WHERE `, sql.join(conditions, sql` AND `)], sql``) : sql``;

  const result = await db.execute(sql`
    SELECT customerType as name, COUNT(*) as value
    FROM customers ${whereStr}
    GROUP BY customerType
    ORDER BY value DESC
  `);
  return ((result as any)[0] || []).map((r: any) => ({
    name: r.name || "未设置",
    value: Number(r.value),
  }));
}

/**
 * 客户分层分布饼状图
 */
export async function getCustomerTierDistribution(filters: DashboardFilters) {
  const db = await getDb();
  if (!db) return [];
  const conditions: SQL[] = [];
  if (filters.staffId) conditions.push(sql`createdById = ${filters.staffId}`);
  const whereStr = conditions.length > 0 ? sql.join([sql`WHERE `, sql.join(conditions, sql` AND `)], sql``) : sql``;

  const result = await db.execute(sql`
    SELECT customerTier as name, COUNT(*) as value
    FROM customers ${whereStr}
    GROUP BY customerTier
    ORDER BY value DESC
  `);
  return ((result as any)[0] || []).map((r: any) => ({
    name: r.name || "未设置",
    value: Number(r.value),
  }));
}

/**
 * 订购类目分布饼状图
 */
export async function getOrderCategoryDistribution(filters: DashboardFilters) {
  const db = await getDb();
  if (!db) return [];
  const conditions: SQL[] = [];
  if (filters.dateFrom) conditions.push(sql`orderDate >= ${filters.dateFrom}`);
  if (filters.dateTo) conditions.push(sql`orderDate <= ${filters.dateTo}`);
  if (filters.staffId) conditions.push(sql`staffId = ${filters.staffId}`);
  const whereStr = conditions.length > 0 ? sql.join([sql`WHERE `, sql.join(conditions, sql` AND `)], sql``) : sql``;

  // 订购类目可能是逗号分隔的多选值，需要拆分后统计
  const result = await db.execute(sql`
    SELECT orderCategory as name FROM orders ${whereStr}
  `);
  const rows = (result as any)[0] || [];
  const countMap = new Map<string, number>();
  for (const r of rows) {
    const cats = (r.name || "").split(",").map((s: string) => s.trim()).filter(Boolean);
    if (cats.length === 0) {
      countMap.set("未设置", (countMap.get("未设置") || 0) + 1);
    } else {
      for (const cat of cats) {
        countMap.set(cat, (countMap.get(cat) || 0) + 1);
      }
    }
  }
  return Array.from(countMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

/**
 * 国家分布饼状图
 */
export async function getCountryDistribution(filters: DashboardFilters) {
  const db = await getDb();
  if (!db) return [];
  const conditions: SQL[] = [];
  if (filters.staffId) conditions.push(sql`createdById = ${filters.staffId}`);
  const whereStr = conditions.length > 0 ? sql.join([sql`WHERE `, sql.join(conditions, sql` AND `)], sql``) : sql``;

  const result = await db.execute(sql`
    SELECT country as name, COUNT(*) as value
    FROM customers ${whereStr}
    GROUP BY country
    ORDER BY value DESC
  `);
  return ((result as any)[0] || []).map((r: any) => ({
    name: r.name || "未设置",
    value: Number(r.value),
  }));
}
