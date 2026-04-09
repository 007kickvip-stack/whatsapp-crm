import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, date } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Role: admin (管理员) | user (客服)
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  username: varchar("username", { length: 64 }).unique(),
  password: varchar("password", { length: 255 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * 客户表 - 以 WhatsApp 号码为主要标识
 */
export const customers = mysqlTable("customers", {
  id: int("id").autoincrement().primaryKey(),
  whatsapp: varchar("whatsapp", { length: 32 }).notNull().unique(),
  customerType: varchar("customerType", { length: 32 }).default("新零售"),
  contactName: varchar("contactName", { length: 128 }),
  telephone: varchar("telephone", { length: 64 }),
  address: text("address"),
  province: varchar("province", { length: 128 }),
  city: varchar("city", { length: 128 }),
  cityCode: varchar("cityCode", { length: 32 }),
  country: varchar("country", { length: 64 }),
  createdById: int("createdById"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = typeof customers.$inferInsert;

/**
 * 订单表 - 主订单信息
 */
export const orders = mysqlTable("orders", {
  id: int("id").autoincrement().primaryKey(),
  orderDate: date("orderDate"),
  staffName: varchar("staffName", { length: 64 }),
  staffId: int("staffId"),
  account: varchar("account", { length: 64 }),
  customerWhatsapp: varchar("customerWhatsapp", { length: 32 }).notNull(),
  customerId: int("customerId"),
  customerType: varchar("customerType", { length: 32 }),
  orderNumber: varchar("orderNumber", { length: 128 }).notNull(),
  orderStatus: varchar("orderStatus", { length: 64 }).default("已报货，待发货"),
  paymentStatus: varchar("paymentStatus", { length: 64 }).default("未付款"),
  remarks: text("remarks"),
  // 汇总金额（所有子项合计）
  totalAmountUsd: decimal("totalAmountUsd", { precision: 12, scale: 2 }).default("0"),
  totalAmountCny: decimal("totalAmountCny", { precision: 12, scale: 2 }).default("0"),
  totalProfit: decimal("totalProfit", { precision: 12, scale: 2 }).default("0"),
  totalProfitRate: decimal("totalProfitRate", { precision: 8, scale: 6 }).default("0"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Order = typeof orders.$inferSelect;
export type InsertOrder = typeof orders.$inferInsert;

/**
 * 订单子项表 - 每个商品/尺码独立记录
 */
export const orderItems = mysqlTable("order_items", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull(),
  orderNumber: varchar("orderNumber", { length: 128 }),
  orderImageUrl: text("orderImageUrl"),
  size: varchar("size", { length: 32 }),
  domesticTrackingNo: varchar("domesticTrackingNo", { length: 128 }),
  sizeRecommendation: text("sizeRecommendation"),
  contactInfo: text("contactInfo"),
  internationalTrackingNo: varchar("internationalTrackingNo", { length: 128 }),
  shipDate: varchar("shipDate", { length: 128 }),
  quantity: int("quantity").default(1),
  source: varchar("source", { length: 128 }),
  itemStatus: varchar("itemStatus", { length: 64 }),
  // 金额字段
  amountUsd: decimal("amountUsd", { precision: 12, scale: 2 }).default("0"),
  amountCny: decimal("amountCny", { precision: 12, scale: 2 }).default("0"),
  sellingPrice: decimal("sellingPrice", { precision: 12, scale: 2 }).default("0"),
  productCost: decimal("productCost", { precision: 12, scale: 2 }).default("0"),
  productProfit: decimal("productProfit", { precision: 12, scale: 2 }).default("0"),
  productProfitRate: decimal("productProfitRate", { precision: 8, scale: 6 }).default("0"),
  shippingCharged: decimal("shippingCharged", { precision: 12, scale: 2 }).default("0"),
  shippingActual: decimal("shippingActual", { precision: 12, scale: 2 }).default("0"),
  shippingProfit: decimal("shippingProfit", { precision: 12, scale: 2 }).default("0"),
  shippingProfitRate: decimal("shippingProfitRate", { precision: 8, scale: 6 }).default("0"),
  totalProfit: decimal("totalProfit", { precision: 12, scale: 2 }).default("0"),
  profitRate: decimal("profitRate", { precision: 8, scale: 6 }).default("0"),
  paymentScreenshotUrl: text("paymentScreenshotUrl"),
  remarks: text("remarks"),
  paymentStatus: varchar("paymentStatus", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type OrderItem = typeof orderItems.$inferSelect;
export type InsertOrderItem = typeof orderItems.$inferInsert;

/**
 * 操作日志表 - 记录系统关键操作
 */
export const auditLogs = mysqlTable("audit_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  userName: varchar("userName", { length: 128 }),
  userRole: varchar("userRole", { length: 32 }),
  action: varchar("action", { length: 64 }).notNull(), // create, update, delete, export, login
  targetType: varchar("targetType", { length: 64 }).notNull(), // order, customer, user, orderItem
  targetId: int("targetId"),
  targetName: varchar("targetName", { length: 255 }),
  details: text("details"), // JSON string with change details
  ipAddress: varchar("ipAddress", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;

/**
 * 汇率表 - 记录汇率变更历史
 */
export const exchangeRates = mysqlTable("exchange_rates", {
  id: int("id").autoincrement().primaryKey(),
  rate: decimal("rate", { precision: 10, scale: 4 }).notNull(),
  previousRate: decimal("previousRate", { precision: 10, scale: 4 }),
  changedById: int("changedById").notNull(),
  changedByName: varchar("changedByName", { length: 128 }),
  reason: text("reason"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ExchangeRate = typeof exchangeRates.$inferSelect;
export type InsertExchangeRate = typeof exchangeRates.$inferInsert;

/**
 * 利润预警阈值配置表
 */
export const profitAlertSettings = mysqlTable("profit_alert_settings", {
  id: int("id").autoincrement().primaryKey(),
  minProfitRate: decimal("minProfitRate", { precision: 8, scale: 6 }).notNull().default("0.100000"), // 默认10%
  enabled: int("enabled").notNull().default(1), // 1=启用, 0=禁用
  updatedById: int("updatedById").notNull(),
  updatedByName: varchar("updatedByName", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ProfitAlertSetting = typeof profitAlertSettings.$inferSelect;
export type InsertProfitAlertSetting = typeof profitAlertSettings.$inferInsert;
