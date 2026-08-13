# 微店后台整合 WhatsApp CRM 模块：完整操作清单

## 适用范围与目标

本手册适用于已部署在腾讯云 Ubuntu 服务器上的 `weidian-publish-mvp` 微店后台。目标是在**不影响现有商品管理、微店订单、发布任务、渠道、助理及前台功能**的前提下，将 WhatsApp CRM 加入同一套后台的侧边栏，作为权限隔离的独立 CRM 模块。

> 本次整合采用“**同一应用、同一数据库、独立菜单、独立路由、独立接口命名空间、独立数据表前缀**”的方案。不得复制覆盖 CRM 的 `App.tsx`、`DashboardLayout.tsx`、`server/routers.ts`、`server/db.ts` 或 `drizzle/schema.ts` 到目标项目。

| 已确认条件 | 处理结论 |
|---|---|
| 目标项目 | React 19、Express 4、Wouter、MySQL/Drizzle，技术栈可兼容。 |
| 目标数据库现状 | 已有 `users`、`orders` 等业务表，不能覆盖。 |
| CRM 冲突风险 | CRM 同样存在 `users`、`orders` 等表名，必须改为 `crm_` 前缀。 |
| 目标服务器 | 腾讯云新加坡 Ubuntu，4 核、16 GB 内存、180 GB 系统盘；适合先在同机合并应用与 MySQL。 |

## 合并后的边界设计

### 1. 必须遵守的命名规则

| 层级 | 微店系统保留 | CRM 规范 |
|---|---|---|
| 数据库表 | `users`、`orders`、`products` 等现有名称不变 | 所有 CRM 新表使用 `crm_` 前缀。 |
| 前端地址 | `/dashboard`、`/orders` 等现有路由不变 | 全部 CRM 页面置于 `/crm/...`。 |
| tRPC 接口 | 原有根路由不变 | 所有 CRM 接口放于 `trpc.crm.*`。 |
| 前端目录 | 现有页面及组件不移动 | 新代码集中放在 `client/src/features/crm/`。 |
| 后端目录 | 现有路由及数据库帮助函数不覆盖 | 新代码集中放在 `server/routers/crmRouter.ts`、`server/services/crm/`。 |

### 2. 推荐的角色兼容方案

目标项目当前角色为 `admin / assistant`；CRM 需要 `admin / user / warehouse`。为避免把所有既有助理自动授予 CRM 权限，**不要直接改写现有 `users.role` 的业务含义**。推荐在现有 `users` 表新增可空字段 `crmRole`：

| 既有微店角色 | `crmRole` | CRM 实际权限 |
|---|---|---|
| `admin` | 任意值或空 | 视为 CRM `admin`。 |
| `assistant` | `NULL` | 无 CRM 入口与接口权限。 |
| `assistant` | `user` | CRM 客服；只能处理自己被授权的记录。 |
| `assistant` | `warehouse` | CRM 仓库管理员；可查看和编辑全部 CRM 订单。 |

后端应由单一 `requireCrmRole()` 中间件负责判断；前端菜单仅作显示控制，**不能代替后端鉴权**。

---

# 阶段一：先备份，再开始改动

## 步骤 1：确定现有服务与部署路径

通过 SSH 登录腾讯云服务器后，先只执行检查命令。将下列命令的输出保存到运维记录中，特别是应用目录、实际进程名、监听端口及数据库连接方式。

```bash
whoami
hostnamectl
df -h
free -h
sudo ss -lntp
ps -ef | grep -E 'node|pm2|nginx|mysql' | grep -v grep
pm2 list 2>/dev/null || true
sudo systemctl --type=service --state=running | grep -E 'nginx|mysql|mariadb|node|pm2' || true
```

确认以下变量后再执行后续命令；示例中的占位符必须替换为真实值。

```bash
export APP_DIR="/实际的/weidian-publish-mvp/部署目录"
export APP_NAME="PM2中的实际应用名称"
export DB_NAME="现有微店系统实际数据库名称"
export BACKUP_DIR="/srv/backups/weidian-crm-$(date +%F-%H%M%S)"
```

> 如果 `pm2 list` 没有输出，请改用 `systemctl cat <现有服务名>` 找到启动方式。不要同时新建 PM2 和 systemd 两套守护进程。

## 步骤 2：创建可恢复备份

在维护窗口开始前备份**应用代码、环境变量、Nginx 配置和数据库**。不要把备份保存在应用目录或仅保存在同一块未验证磁盘上。

```bash
sudo mkdir -p "$BACKUP_DIR"
sudo tar -C "$(dirname "$APP_DIR")" \
  --exclude="$(basename "$APP_DIR")/node_modules" \
  --exclude="$(basename "$APP_DIR")/dist" \
  -czf "$BACKUP_DIR/app-before-crm.tar.gz" "$(basename "$APP_DIR")"

sudo cp -a /etc/nginx "$BACKUP_DIR/nginx" 2>/dev/null || true
sudo cp -a "$APP_DIR/.env" "$BACKUP_DIR/app.env" 2>/dev/null || true
sudo mysqldump --single-transaction --routines --triggers --events \
  --set-gtid-purged=OFF "$DB_NAME" | gzip > "$BACKUP_DIR/${DB_NAME}-before-crm.sql.gz"

sudo sha256sum "$BACKUP_DIR"/* > "$BACKUP_DIR/SHA256SUMS"
sudo du -sh "$BACKUP_DIR"
```

随后应将数据库备份复制到对象存储或另一台受控设备。**确认备份文件非空且校验文件已生成后，才能进行迁移。**

## 步骤 3：确认本机 MySQL 状态

同机运行 MySQL 是可行的，但应优先复用微店系统正在使用的 MySQL 实例，而不是无故再安装第二个数据库服务。

```bash
sudo systemctl is-active mysql || sudo systemctl is-active mariadb
sudo mysql -e "SELECT VERSION() AS mysql_version;"
sudo mysql -e "SHOW DATABASES;"
```

若现有应用连接的是本机数据库，CRM 仅在**同一个数据库**增加带 `crm_` 前缀的新表。若数据库未在本机运行，应先确认现有 `DATABASE_URL` 指向何处；不要在不知道现有数据源的情况下安装或切换数据库。数据库账户应仅允许 `127.0.0.1` 或 Unix Socket 本地连接，不应向公网开放 3306 端口。

## 步骤 3A：核对并复用生产环境配置

CRM 源码迁移包**刻意不包含** `.env` 或 `.env.example`，以避免传输密码和密钥。因此，目标项目现有的生产环境文件是唯一应被保留和复用的配置来源；不要复制 CRM 原项目的任何环境变量值，也不要把密钥写进 Git、发布包或前端代码。

| 参数类别 | 参数名 | 整合处理方式 |
|---|---|---|
| 数据库与会话 | `DATABASE_URL`、`JWT_SECRET`、`NODE_ENV` | 继续使用目标微店系统现有值。CRM 仅使用同一个 `DATABASE_URL` 新建 `crm_` 表，不能换库或重置 `JWT_SECRET`。 |
| 自托管模式 | `SELF_HOSTED` | 腾讯云部署应保留目标系统当前的自托管设置；不要因导入 CRM 改回 Manus 托管认证逻辑。 |
| 文件存储 | `S3_ENDPOINT`、`S3_REGION`、`S3_BUCKET`、`S3_ACCESS_KEY_ID`、`S3_SECRET_ACCESS_KEY` | 目标项目已经支持腾讯云 COS 的 S3 兼容存储。CRM 图片和付款凭证必须复用目标项目的 `server/storage.ts`，不得复制 CRM 原有依赖 Manus 存储代理的 `server/storage.ts`。 |
| 微店与前台登录 | `WEIDIAN_OAUTH_REDIRECT_URI`、`SHOP_GOOGLE_CLIENT_ID`、`SHOP_GOOGLE_CLIENT_SECRET`、`SHOP_DISCORD_CLIENT_ID`、`SHOP_DISCORD_CLIENT_SECRET`、`SHOP_JWT_SECRET` | 完整保留现有值与用途；CRM 不应修改这些前台或微店登录配置。 |
| 既有后台认证 | `VITE_APP_ID`、`OAUTH_SERVER_URL`、`OWNER_OPEN_ID` | 仅当目标项目当前已经使用时保留；CRM 页面必须接入目标项目认证，不得替换为 CRM 原项目的 Manus OAuth 配置。 |
| CRM 物流跟踪（可选） | `KUAIDI100_KEY`、`KUAIDI100_CUSTOMER` | 仅在需要快递 100 查询/订阅时配置。未启用物流功能时，可先不填，但相应接口应显示“未配置”而不是使整个应用启动失败。 |
| CRM 物流回调基地址（新增） | `PUBLIC_APP_URL` | 新增为目标后台正式 HTTPS 地址，例如 `https://admin.example.com`，不带结尾 `/`。仅用于拼接公开回调地址，不能包含密钥。 |

> 当前 CRM 源码中有 4 处对原 Manus 域名 `whatsappcrm-hh98jc4u.manus.space` 的物流回调引用，位于 `server/routers.ts` 与 `server/trackingProxy.ts`。整合时必须全部替换为基于 `PUBLIC_APP_URL` 的 `${PUBLIC_APP_URL}/api/kuaidi100/callback`，并在快递 100管理后台同步更新回调地址。未完成此项前，不得启用物流订阅。

生产环境文件应位于服务器的共享配置目录（例如 `/srv/weidian-publish/shared/.env`），由运行账户以最小权限读取。发布前只检查变量**是否存在**，不要在终端、日志或聊天中打印变量值。

---

# 阶段二：准备目标项目的合并工作区

## 步骤 4：在目标项目中上传 CRM 迁移包

在 **weidian-publish-mvp 的目标项目**中，而不是在 CRM 原项目中，上传以下两个文件：

| 文件 | 用途 |
|---|---|
| `whatsapp-crm-source-migration.zip` | CRM 源码、schema 与测试参考；不含密钥和业务数据。 |
| `CRM_MODULE_INTEGRATION.md` | 模块清单和原始迁移注意事项。 |

向目标项目的开发任务发送以下实施约束：

```text
请在当前微店后台中以增量方式整合上传的 WhatsApp CRM。
保留当前所有页面、接口、用户与数据；禁止覆盖现有 App.tsx、DashboardLayout.tsx、server/routers.ts、server/db.ts 与 drizzle/schema.ts。
所有新增 CRM 数据表改为 crm_ 前缀；CRM 前端路由统一为 /crm/...；后端接口统一置于 trpc.crm.*。
复用当前认证、数据库连接和主侧边栏。现有 admin 自动具有 CRM admin 权限；assistant 只有 crmRole 为 user 或 warehouse 时显示及访问 CRM。
先完成表结构、后端接口、前端页面、测试和空库验证，再部署到腾讯云。不得迁移 .env、密钥、node_modules、dist 或历史 CRM 业务数据。
```

## 步骤 5：建立模块目录，不复制覆盖入口文件

在目标项目中按下列结构迁移 CRM 页面和服务。现有文件只添加必要的 import、路由注册或 router 挂载。

```text
client/src/features/crm/
  components/
  pages/
  hooks/
  crmRoutes.tsx
  CrmRoute.tsx

server/routers/
  crmRouter.ts
server/services/crm/
  customers.ts
  orders.ts
  analytics.ts
  refunds.ts
  permissions.ts
  audit.ts
```

不要将 CRM 原项目的 `DashboardLayout.tsx` 原样复制。应继续使用微店现有 `DashboardLayout.tsx`，仅增加一组可折叠的 **CRM 管理** 导航项。

---

# 阶段三：数据库结构与权限兼容

## 步骤 6：新增 CRM 角色字段

在目标项目的 Drizzle schema 中，为已有 `users` 表增加可空字段。字段名可与项目现有命名风格一致；以下为推荐定义：

```ts
crmRole: mysqlEnum("crmRole", ["user", "warehouse"]),
```

`admin` 不必写入该字段，因为应根据既有 `users.role === "admin"` 映射为 CRM 管理员。这样不会改变当前微店侧的 `admin / assistant` 逻辑，也不会在迁移时把已有助理批量赋予 CRM 权限。

## 步骤 7：将全部 CRM 表改为 `crm_` 前缀

不要引入 CRM 原项目的 `users` 表。其余 CRM 表必须创建为以下名称：

| CRM 原表 | 合并后表名 |
|---|---|
| `customers` | `crm_customers` |
| `orders` | `crm_orders` |
| `order_items` | `crm_order_items` |
| `audit_logs` | `crm_audit_logs` |
| `exchange_rates` | `crm_exchange_rates` |
| `profit_alert_settings` | `crm_profit_alert_settings` |
| `staff_monthly_targets` | `crm_staff_monthly_targets` |
| `daily_data` | `crm_daily_data` |
| `accounts` | `crm_accounts` |
| `daily_report_notes` | `crm_daily_report_notes` |
| `quotations` / `quotation_items` | `crm_quotations` / `crm_quotation_items` |
| `paypal_income` / `paypal_expense` | `crm_paypal_income` / `crm_paypal_expense` |
| `reshipments` / `order_payments` | `crm_reshipments` / `crm_order_payments` |
| `commission_rules` / `bonus_rules` | `crm_commission_rules` / `crm_bonus_rules` |
| `salary_adjustments` / `social_insurance_costs` | `crm_salary_adjustments` / `crm_social_insurance_costs` |
| `annual_targets` | `crm_annual_targets` |
| `field_permissions` | `crm_field_permissions` |

所有 CRM 引用用户的字段（例如创建人、客服、操作人）应继续保存目标 `users.id`，而不是创建第二套 CRM 用户表。保留 CRM 已有索引，并将索引名称同时加上 `crm_` 前缀，防止 MySQL 索引名冲突。

## 步骤 8：生成并审核增量迁移

只能在目标项目的合并分支或副本中生成新迁移；**禁止导入 CRM 历史迁移文件后直接在生产库执行**。生产迁移必须只包含：新增 `users.crmRole`、创建 `crm_` 表、创建必要索引；不得有 `DROP TABLE`、`TRUNCATE`、重建原 `orders` 或修改原微店订单列的语句。

```bash
pnpm install --frozen-lockfile
pnpm drizzle-kit generate --name add_crm_module
# 人工打开新增的 drizzle/*.sql 文件，审核后才执行下一步。
pnpm drizzle-kit migrate
```

迁移的最低审核标准如下。

| 必查项 | 合格标准 |
|---|---|
| 表操作 | 仅有 `CREATE TABLE crm_*` 与 `ALTER TABLE users ADD crmRole` 等增量语句。 |
| 原微店表 | 不得删除、重命名或清空任何已存在表。 |
| `orders` | 原微店 `orders` 表零改动；CRM 仅使用 `crm_orders`。 |
| 数据 | 不插入模拟客户、模拟订单、虚假评价或生产数据。 |
| 回滚 | 新表和可空角色字段使旧版应用可继续运行；应用失败时优先回退应用版本，而不是删除生产数据。 |

---

# 阶段四：后端接口与认证整合

## 步骤 9：创建 `crm.*` tRPC 命名空间

将 CRM 的全部 procedure 放进 `server/routers/crmRouter.ts`，再在目标根路由中挂载一次：

```ts
export const appRouter = router({
  // 目标项目现有 router 保持不动
  crm: crmRouter,
});
```

整合后接口形式必须类似 `trpc.crm.orders.list`、`trpc.crm.customers.create`、`trpc.crm.analytics.dashboard`。禁止把 CRM 的 `orders.list` 直接放到根级，以免与微店订单接口混淆。

推荐拆分的 CRM 路由模块包括：客户、订单及子项、报价、补发、PayPal、每日数据与报表、利润与目标、账号、汇率、字段权限、工资与提成、审计日志和数据备份。

## 步骤 10：实现统一 CRM 权限保护

在后端实现 `getEffectiveCrmRole(user)` 与 `requireCrmRole()`：既有 `admin` 映射为 CRM `admin`；非 admin 用户仅在 `crmRole` 为 `user` 或 `warehouse` 时可访问。随后让所有 CRM procedure 使用该保护，而非继续依赖 CRM 原项目的 `ctx.user.role` 判断。

| CRM 功能 | admin | user | warehouse |
|---|---:|---:|---:|
| CRM 仪表盘、客户、订单 | 是 | 仅自身授权范围 | 全部订单 |
| 订单成本、实际运费等敏感字段 | 是 | 由 `crm_field_permissions` 控制 | 由 `crm_field_permissions` 控制 |
| 用户、汇率、字段权限、工资规则 | 是 | 否 | 否 |
| 微店原有管理功能 | 按原有规则 | 按原有规则 | 按原有规则 |

CRM 的退款链路必须保留：退款订单或全部退款子项不得计入每日数据、仪表盘、利润、客户累计统计；将退款状态恢复后，客户与统计数据应恢复同步。

---

# 阶段五：前端路由、菜单与页面迁移

## 步骤 11：增加 CRM 路由守卫与统一地址

目标项目使用 Wouter。创建 `CrmRoute`，先加载当前用户，再检查其有效 CRM 角色；未授权时跳转到现有后台的无权限页或仪表盘。将 CRM 页面统一注册为以下地址：

| 菜单组 | 页面 | 建议地址 |
|---|---|---|
| CRM 工作台 | CRM 概览 | `/crm/dashboard` |
| 客户与订单 | 客户管理、订单管理 | `/crm/customers`、`/crm/orders` |
| 业务操作 | 客户报价、补发表、PayPal 收支 | `/crm/quotes`、`/crm/reshipments`、`/crm/paypal` |
| CRM 数据分析 | 每日数据、利润报表、目标管理、客户分析 | `/crm/daily-data`、`/crm/profit-report`、`/crm/targets`、`/crm/customer-analysis` |
| CRM 系统管理 | 用户、账号、汇率、字段权限、操作日志、工资与提成、数据备份 | `/crm/users`、`/crm/accounts`、`/crm/exchange-rates`、`/crm/field-permissions`、`/crm/audit-logs`、`/crm/compensation`、`/crm/backups` |

`/orders` 必须永远继续表示微店订单；`/crm/orders` 才表示 CRM 销售订单。所有 CRM 页面中的返回链接、跳转链接、懒加载预加载映射和面包屑必须同步改成 `/crm/` 前缀。

## 步骤 12：在现有侧边栏增加 CRM 菜单组

在目标项目的 `client/src/components/DashboardLayout.tsx` 内既有 `adminNavGroups` 后新增 `crmNavGroup`；不要删除、重排或重命名微店现有导航项。菜单仅在 `effectiveCrmRole` 存在时显示，系统设置类菜单仅在 CRM admin 时显示。

建议添加一条清晰的视觉分隔与分组标题“CRM 管理”，以区分微店运营与 WhatsApp 客户运营。当前页面标题、选中状态、移动端折叠导航和快捷预加载逻辑也应识别 `/crm/` 路径。

## 步骤 13：迁移页面时复用目标项目公共能力

逐页迁移 CRM 的页面组件、必要子组件及类型；不得把 CRM 项目整体的入口、认证上下文或全局 CSS 覆盖到目标项目。所有数据访问必须改为目标项目已配置的 `trpc` 客户端，所有登录状态使用目标项目认证上下文。

迁移优先级如下：

1. CRM 路由保护、菜单和概览页；
2. 客户管理、订单管理、订单子项与退款恢复；
3. 每日数据、日报/周报、利润、目标、客户分析；
4. 报价、补发、PayPal、账号、汇率和字段权限；
5. 用户、工资提成、审计日志和数据备份。

页面完成后逐页检查加载、空数据、失败提示、权限不足和移动端侧边栏；不得用模拟订单或虚构客户数据填充生产界面。

---

# 阶段六：合并测试与发布包准备

## 步骤 14：本地或目标项目中完成质量检查

代码合并后、生产发布前，必须在目标项目的合并工作区依次运行：

```bash
pnpm check
pnpm test
pnpm build
```

现有 CRM 原项目有 357 条测试通过记录，但合并后的目标项目以其自身测试结果为准。至少新增或改造以下测试：CRM 角色映射、无 CRM 权限拒绝访问、`crm.*` 只操作 `crm_` 表、微店 `/orders` 未受影响、退款扣减与恢复、预估毛利润手动编辑、`/crm/` 路由保护。

## 步骤 15：构建无密钥发布包

不要把 `.env`、数据库备份、`node_modules`、`dist`、日志或当前用户会话打进发布包。确认 `pnpm-lock.yaml` 与新的 Drizzle migration 已在包内。

```bash
cd /目标项目源码目录
tar -czf "../weidian-crm-release-$(date +%F-%H%M%S).tar.gz" \
  --exclude='.env' --exclude='node_modules' --exclude='dist' \
  --exclude='.git' --exclude='.manus-logs' \
  .
sha256sum "../weidian-crm-release-"*.tar.gz
```

通过受控的 SSH/SCP/SFTP 方法上传该发布包到服务器的 releases 目录。上传前后都应校验 SHA-256；不要通过聊天、代码仓库或发布包传输任何数据库密码、JWT 密钥、微店 Token 或第三方服务 Token。

---

# 阶段七：腾讯云生产发布

## 步骤 16：采用“新目录构建、切换软链接”的发布方式

不要直接在当前线上目录解压或编辑。推荐结构如下：

```text
/srv/weidian-publish/
  current -> /srv/weidian-publish/releases/2026xxxx-xxxxxx
  releases/
  shared/
    .env
```

解压到新 release 目录后，复用原来的环境变量文件。以下命令中的目录仅为示例，须与步骤 1 确认的真实部署方式一致。

```bash
export RELEASE_ID="$(date +%Y%m%d-%H%M%S)"
export RELEASE_DIR="/srv/weidian-publish/releases/$RELEASE_ID"
sudo mkdir -p "$RELEASE_DIR" /srv/weidian-publish/shared
sudo tar -xzf /srv/weidian-publish/releases/weidian-crm-release-*.tar.gz -C "$RELEASE_DIR"
sudo cp -a "$APP_DIR/.env" /srv/weidian-publish/shared/.env
sudo ln -sfn /srv/weidian-publish/shared/.env "$RELEASE_DIR/.env"
sudo chown -R "$(whoami)":"$(id -gn)" "$RELEASE_DIR"

cd "$RELEASE_DIR"
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm drizzle-kit migrate
pnpm build
```

如果迁移 SQL 已在开发阶段审核，`pnpm drizzle-kit migrate` 才能在生产环境执行。**不要在生产服务器执行会重新生成迁移文件的 `pnpm db:push`。**

## 步骤 17：切换应用并复用原有进程管理器

在切换软链接前，再次确认数据库迁移成功。随后替换 `current` 链接，并按既有守护方式重载。

```bash
sudo ln -sfn "$RELEASE_DIR" /srv/weidian-publish/current

# 仅在应用原本由 PM2 管理时使用：
pm2 reload "$APP_NAME" --update-env

# 仅在应用原本由 systemd 管理时使用：
# sudo systemctl restart <实际服务名>

sudo nginx -t && sudo systemctl reload nginx
```

如果 PM2 的启动配置把 `cwd` 写死为旧目录，先在 `pm2 describe "$APP_NAME"` 中确认，再更新其现有配置的 `cwd` 为 `/srv/weidian-publish/current` 后重载。不要另起一个未知端口的第二个 Node 进程。

---

# 阶段八：上线验收、监控与回退

## 步骤 18：验证数据库与服务健康

```bash
sudo mysql "$DB_NAME" -e "SHOW TABLES LIKE 'crm\\_%';"
sudo mysql "$DB_NAME" -e "SHOW COLUMNS FROM users LIKE 'crmRole';"
curl -fsS http://127.0.0.1:<现有应用内网端口>/ >/dev/null
pm2 list 2>/dev/null || true
sudo tail -n 100 /var/log/nginx/error.log
```

浏览器验收应由有权限的真实账号完成。不要为了测试而导入真实客户的敏感数据；可使用已获授权的内部测试账号和最少量测试记录，验收后按业务规则清理。

| 验收项 | 预期结果 |
|---|---|
| 原微店仪表盘、商品、订单、发布任务、渠道、助理 | 功能、数据和权限均保持不变。 |
| CRM 菜单可见性 | admin 可见；未设置 `crmRole` 的 assistant 不可见；被授权 user / warehouse 按权限可见。 |
| CRM 客户与订单 | 新建、编辑、订单子项、筛选及关联客户正常。 |
| 退款 | 已退款订单/子项从每日数据、仪表盘、利润与客户累计中扣除；恢复状态后重新同步。 |
| 每日数据 | 预估毛利润可手动编辑，利润率自动重算。 |
| 路由隔离 | 微店订单仍为 `/orders`；CRM 订单为 `/crm/orders`；接口调用均为 `crm.*`。 |
| 安全性 | 数据库无公网 3306；环境变量和密钥未进入发布包或前端代码。 |

## 步骤 19：发生异常时的回退顺序

1. 立即停止继续执行数据库或代码改动，并保存错误日志。
2. 将 `current` 软链接切回上一个正常 release，随后按原有 PM2 或 systemd 方式重载应用。
3. 新增 `crm_` 表和可空 `crmRole` 字段通常不会妨碍旧版应用运行，**不要因为应用回退就删除生产表或清空数据**。
4. 只有确认迁移误操作已影响原微店表或数据时，才在维护窗口按步骤 2 的备份恢复数据库；恢复前先在隔离环境验证备份可用性。
5. 记录问题、相关 SQL、应用日志、版本号和回退时间，修复后从新的 release 重新验证。

## 最终交付物清单

完成后应保留以下可追溯资料：经审核的 CRM 增量 migration、目标项目合并后的源码发布包及校验值、服务器前后备份位置、测试结果、上线验收记录、当前 release 标识和上一个可回退 release 标识。

> 该流程先确保微店原功能安全，再逐步开放 CRM 权限。历史 CRM 客户、订单、每日数据和 PayPal 记录的导入应作为下一阶段独立执行：先映射数据字段、在副本验证、取得业务确认，再按“账号/用户 → 客户 → 订单 → 子项 → 每日数据与付款”的依赖顺序导入。
