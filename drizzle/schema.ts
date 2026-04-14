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
  hireDate: date("hireDate"),
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
  // 新增字段
  staffName: varchar("staffName", { length: 64 }),
  account: varchar("account", { length: 64 }),
  contactInfo: text("contactInfo"), // 联系方式（更详细的联系信息）
  totalOrderCount: int("totalOrderCount").default(0), // 累计订单数
  totalSpentUsd: decimal("totalSpentUsd", { precision: 12, scale: 2 }).default("0"), // 累计消费金额($)
  totalSpentCny: decimal("totalSpentCny", { precision: 12, scale: 2 }).default("0"), // 累计消费金额(¥)
  firstOrderDate: date("firstOrderDate"), // 首次下单日期
  customerLevel: varchar("customerLevel", { length: 32 }), // 顾客等级
  orderCategory: varchar("orderCategory", { length: 255 }), // 订购类目
  customerName: varchar("customerName", { length: 128 }), // 客户名字
  birthDate: date("birthDate"), // 出生日期
  customerEmail: varchar("customerEmail", { length: 320 }), // 客户邮箱
  customerTier: varchar("customerTier", { length: 32 }), // 客户分层
  wpEntryDate: date("wpEntryDate"), // 进入WP日期
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
  // 客户关联字段（从客户表同步）
  customerName: varchar("customerName", { length: 128 }),
  customerCountry: varchar("customerCountry", { length: 64 }),
  customerTier: varchar("customerTier", { length: 32 }),
  customerLevel: varchar("customerLevel", { length: 32 }),
  orderCategory: varchar("orderCategory", { length: 255 }),
  customerBirthDate: date("customerBirthDate"),
  customerEmail: varchar("customerEmail", { length: 320 }),
  wpEntryDate: date("wpEntryDate"), // 进入WP日期
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
  originalOrderNo: varchar("originalOrderNo", { length: 128 }),
  logisticsStatus: varchar("logisticsStatus", { length: 32 }).default("unknown"), // unknown, collected, in_transit, delivering, signed, returned, difficult, customs, refused
  logisticsStatusText: varchar("logisticsStatusText", { length: 64 }), // 物流状态中文描述
  logisticsLastUpdate: timestamp("logisticsLastUpdate"), // 物流最后更新时间
  logisticsSubscribed: int("logisticsSubscribed").default(0), // 是否已订阅快递100推送 0=否 1=是
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

/**
 * 客服月度目标表 - 记录每个客服每月的利润和营业额目标
 */
export const staffMonthlyTargets = mysqlTable("staff_monthly_targets", {
  id: int("id").autoincrement().primaryKey(),
  staffId: int("staffId").notNull(),
  staffName: varchar("staffName", { length: 128 }).notNull(),
  yearMonth: varchar("yearMonth", { length: 7 }).notNull(), // 格式: "2026-04"
  profitTarget: decimal("profitTarget", { precision: 12, scale: 2 }).notNull().default("0"),
  revenueTarget: decimal("revenueTarget", { precision: 12, scale: 2 }).notNull().default("0"),
  setById: int("setById").notNull(),
  setByName: varchar("setByName", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type StaffMonthlyTarget = typeof staffMonthlyTargets.$inferSelect;
export type InsertStaffMonthlyTarget = typeof staffMonthlyTargets.$inferInsert;

/**
 * 每日数据表 - 记录每个客服每天的工作数据
 * 部分字段自动从订单表汇总，部分手动输入
 */
export const dailyData = mysqlTable("daily_data", {
  id: int("id").autoincrement().primaryKey(),
  reportDate: date("reportDate").notNull(),
  staffId: int("staffId").notNull(),
  staffName: varchar("staffName", { length: 128 }).notNull(),
  whatsAccount: varchar("whatsAccount", { length: 64 }), // whats账号
  // 手动输入字段
  messageCount: int("messageCount").default(0), // 消息数
  newCustomerCount: int("newCustomerCount").default(0), // 新客人数
  newIntentCount: int("newIntentCount").default(0), // 新增意向客户
  returnVisitCount: int("returnVisitCount").default(0), // 回访人数
  newOrderCount: int("newOrderCount").default(0), // 新客单数
  oldOrderCount: int("oldOrderCount").default(0), // 老客单数
  onlineOrderCount: int("onlineOrderCount").default(0), // 线上订单
  itemCount: int("itemCount").default(0), // 件数
  // 自动汇总字段（从订单表计算）
  totalRevenue: decimal("totalRevenue", { precision: 12, scale: 2 }).default("0"), // 总营业额 = orders.totalAmountCny
  onlineRevenue: decimal("onlineRevenue", { precision: 12, scale: 2 }).default("0"), // 线上营业额（手动输入）
  productSellingPrice: decimal("productSellingPrice", { precision: 12, scale: 2 }).default("0"), // 产品售价 = order_items.sellingPrice
  shippingCharged: decimal("shippingCharged", { precision: 12, scale: 2 }).default("0"), // 收取运费 = order_items.shippingCharged
  estimatedProfit: decimal("estimatedProfit", { precision: 12, scale: 2 }).default("0"), // 预估毛利润 = order_items.productProfit
  estimatedProfitRate: decimal("estimatedProfitRate", { precision: 8, scale: 6 }).default("0"), // 预估利润率
  // 其他手动输入字段
  telegramPraiseCount: int("telegramPraiseCount").default(0), // 电报好评人数
  referralCount: int("referralCount").default(0), // 周转介绍
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DailyData = typeof dailyData.$inferSelect;
export type InsertDailyData = typeof dailyData.$inferInsert;

/**
 * 账号管理表 - 管理订单表和每日数据表中的账号下拉选项
 */
export const accounts = mysqlTable("accounts", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 128 }).notNull().unique(),
  color: varchar("color", { length: 32 }).default("#94a3b8"), // 颜色标记（hex）
  sortOrder: int("sortOrder").default(0), // 排序顺序
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Account = typeof accounts.$inferSelect;
export type InsertAccount = typeof accounts.$inferInsert;

/**
 * 日报表备注表 - 管理员和客服在日报表中写总结/反映问题
 */
export const dailyReportNotes = mysqlTable("daily_report_notes", {
  id: int("id").autoincrement().primaryKey(),
  reportDate: date("reportDate").notNull(),
  userId: int("userId").notNull(),
  userName: varchar("userName", { length: 128 }).notNull(),
  userRole: varchar("userRole", { length: 32 }).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DailyReportNote = typeof dailyReportNotes.$inferSelect;
export type InsertDailyReportNote = typeof dailyReportNotes.$inferInsert;
