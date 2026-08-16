# CRM WhatsApp 账号与员工权限同步手册

## 目标与边界

本手册仅处理两类主数据：**WhatsApp 账号列表**以及**已有员工登录账号的 CRM 权限**。它不导入客户、订单、报价、付款、物流或每日数据；这些业务数据应在账号和用户映射稳定后，另行按依赖顺序迁移。

整合完成后，CRM 成为目标微店后台的一个模块，二者使用同一套数据库和认证体系。因此此次操作是**一次性导入**，不是在两个系统间持续双向同步。切换后应以目标微店后台中的 CRM 数据为唯一维护来源。

> 绝不复制 CRM 原项目的 `users.id`、`accounts.id`、密码哈希、登录会话或密钥。目标数据库为所有新记录重新生成 ID；账号业务关联按账号名称，员工权限按目标系统已有用户匹配。

## 1. 合并后字段映射

### 1.1 WhatsApp 账号列表

CRM 原账号表为 `accounts`，整合后的表为 `crm_accounts`。`id` 仅是数据库内部主键，不参与业务关联或导入匹配。

| 源 CRM 字段 | 目标 CRM 字段 | 导入规则 |
|---|---|---|
| `accounts.name` | `crm_accounts.name` | 唯一业务键。按去首尾空格后的名称匹配；同名记录更新，不同名记录新增。 |
| `accounts.color` | `crm_accounts.color` | 同名账号可更新颜色；空值使用目标系统默认颜色。 |
| `accounts.sortOrder` | `crm_accounts.sortOrder` | 直接导入；若冲突，按管理员确认的目标排序覆盖。 |
| `accounts.id` | 不导入 | 由目标数据库自动生成。 |
| `createdAt` / `updatedAt` | 不导入 | 使用目标系统导入时间，保留审计可追溯性。 |

客户、订单、报价和每日数据中的 `account` / `whatsAccount` 是**账号名称文本**，不是账号 ID。因此后续迁移业务数据前，必须确认其值全部能在 `crm_accounts.name` 中找到。

### 1.2 员工登录账号与 CRM 角色

目标微店系统的登录用户表为 `users`，既有角色为 `admin / assistant`。新增 CRM 模块时，建议为该表增加可空的 `crmRole` 枚举：`user / warehouse`。目标系统的 `admin` 自动拥有 CRM 管理员权限，不需要写入 `crmRole = 'admin'`。

| CRM 原角色 | 目标 `users.role` | 目标 `users.crmRole` | 迁移原则 |
|---|---|---|---|
| `admin` | 保留既有 `admin` | `NULL` | 仅映射到目标系统中已存在且已确认的管理员，不能自动把 assistant 提升为 admin。 |
| `user` | 保留既有 `assistant` | `user` | 赋予 CRM 客服权限。 |
| `warehouse` | 保留既有 `assistant` | `warehouse` | 赋予 CRM 仓库管理员权限。 |
| 无对应 CRM 账号 | 保留原值 | `NULL` | 不显示 CRM 菜单，也无法调用 CRM 接口。 |

目标微店系统现有 `users` 表不包含 `username` 字段。员工匹配键应遵循以下优先级：**已验证邮箱（`email`）→ 经管理员明确确认且属于同一认证体系的 `openId` → 管理员人工确认的姓名**。姓名不是天然唯一键；若重名、空邮箱、`openId` 不一致或未找到匹配用户，必须停止自动导入并由管理员建立映射，不得猜测。

密码不会迁移。员工应使用目标系统原有登录方式；目标系统中尚不存在的员工，先通过目标系统正常的用户创建流程建立账号，再补充 `crmRole`。

---

# 2. 导入前准备

## 步骤 1：冻结来源与完成备份

选定维护窗口后，停止在旧 CRM 中新增或修改账号、角色和权限，直到导入验收完成。分别备份源 CRM 的账号/用户导出文件以及目标腾讯云数据库，并记录导出时间、操作者和文件 SHA-256 校验值。

```bash
# 在腾讯云目标服务器，先备份目标数据库；替换为真实数据库名。
sudo mysqldump --single-transaction --routines --triggers --events \
  --set-gtid-purged=OFF <TARGET_DB_NAME> \
  | gzip > "/srv/backups/<TARGET_DB_NAME>-before-crm-account-import-$(date +%F-%H%M%S).sql.gz"
```

## 步骤 2：从源 CRM 导出最小数据集

只导出以下非敏感字段。不要导出 `password`、`openId`、`sessionInvalidatedAt`、Cookie、Token、数据库连接字符串或任何密钥。SQL 仅供具备源 CRM 数据库只读权限的管理员执行。

```sql
-- A. WhatsApp 账号列表：建议导出为 CSV。
SELECT
  TRIM(name) AS account_name,
  COALESCE(color, '#94a3b8') AS color,
  COALESCE(sortOrder, 0) AS sort_order
FROM accounts
WHERE TRIM(name) <> ''
ORDER BY sortOrder ASC, name ASC;

-- B. 员工权限候选清单：不导出密码或 openId。
SELECT
  username,
  email,
  name,
  role AS crm_role
FROM users
WHERE deletedAt IS NULL
ORDER BY name ASC, username ASC;
```

将导出文件交给管理员复核。对于员工权限，建议先转为人工确认模板，而非直接执行更新。

| `account_name` | `color` | `sort_order` |
|---|---|---:|
| 待填：CRM 账号名称 | `#94a3b8` 或实际颜色 | `0` |

| `source_username` | `source_email` | `source_name` | `source_crm_role` | `target_open_id` | `target_email` | `confirmed_crm_role` | `reviewer` |
|---|---|---|---|---|---|---|---|
| 待填 | 待填 | 待填 | `user` / `warehouse` / `admin` | 待填 | 待填 | `user` / `warehouse` / 留空 | 待填 |

## 步骤 3：在目标项目先完成 schema 与功能发布

在导入数据之前，目标项目必须已经完成以下代码与数据库迁移：

1. 创建 `crm_accounts` 表，其中 `name` 为唯一键；
2. 在现有 `users` 表新增可空 `crmRole`，其值仅允许 `user` 或 `warehouse`；
3. 后端权限函数应把 `users.role = 'admin'` 映射为 CRM admin，把 `crmRole` 映射为客服或仓库管理员；
4. 前端 CRM 菜单和 `/crm/...` 页面只对有效 CRM 角色显示；
5. 使用目标项目的 `server/storage.ts`，保持现有腾讯云 COS 配置，不引入 CRM 原项目的 Manus 存储配置。

先在目标项目的测试或预发布环境验证迁移，再在腾讯云生产库执行。禁止通过原 CRM 历史迁移覆盖或重建目标已有的 `users`、`orders` 等表。

---

# 3. 执行导入

## 步骤 4：建立临时导入表

在目标数据库中建立仅供本次导入使用的临时表。执行窗口结束并验收后可删除该临时表；正式业务数据只写入 `crm_accounts` 和 `users.crmRole`。

```sql
CREATE TABLE crm_account_import_stage (
  account_name VARCHAR(128) NOT NULL,
  color VARCHAR(32) NULL,
  sort_order INT NULL,
  PRIMARY KEY (account_name)
);

CREATE TABLE crm_user_role_import_stage (
  target_open_id VARCHAR(64) NULL,
  target_email VARCHAR(320) NULL,
  confirmed_crm_role ENUM('user', 'warehouse') NULL,
  reviewer VARCHAR(128) NOT NULL,
  reviewed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

将管理员审核后的 CSV 以受控方式导入临时表。导入前后都应做行数与重复检查；不要把 CSV 放到可公开访问的 Web 目录。

```sql
-- 导入前检查：账号名称不能为空、不能因大小写或空格重复。
SELECT account_name, COUNT(*) AS duplicate_count
FROM crm_account_import_stage
GROUP BY account_name
HAVING COUNT(*) > 1;

-- 角色只能是 user 或 warehouse；admin 由目标 users.role 决定。
SELECT *
FROM crm_user_role_import_stage
WHERE confirmed_crm_role NOT IN ('user', 'warehouse')
   OR (target_open_id IS NULL AND target_email IS NULL);
```

## 步骤 5：预览用户匹配结果，再写入权限

先运行只读预览。任何一条无法匹配、匹配到多名用户、或目标用户不是 `assistant/admin` 的记录都必须人工确认。

```sql
SELECT
  s.target_open_id,
  s.target_email,
  s.confirmed_crm_role,
  u.id AS target_user_id,
  u.name AS target_user_name,
  u.openId AS target_user_open_id,
  u.role AS target_base_role,
  u.crmRole AS current_crm_role
FROM crm_user_role_import_stage AS s
LEFT JOIN users AS u
  ON (s.target_email IS NOT NULL AND u.email = s.target_email)
  OR (s.target_email IS NULL AND s.target_open_id IS NOT NULL AND u.openId = s.target_open_id)
ORDER BY s.target_email, s.target_open_id;
```

确认预览无误后，在事务内导入。以下 SQL 使用“邮箱优先、已确认 `openId` 后备”的匹配规则；执行前应由目标项目开发者根据实际 schema、命名和数据库版本复核。

```sql
START TRANSACTION;

-- 账号按名称新增或更新；目标表的 ID 由数据库自动生成。
INSERT INTO crm_accounts (name, color, sortOrder)
SELECT
  TRIM(account_name),
  COALESCE(NULLIF(color, ''), '#94a3b8'),
  COALESCE(sort_order, 0)
FROM crm_account_import_stage
WHERE TRIM(account_name) <> ''
ON DUPLICATE KEY UPDATE
  color = VALUES(color),
  sortOrder = VALUES(sortOrder);

-- 仅给非 admin 的既有目标用户写入 CRM 角色，不改动其微店基础角色。
UPDATE users AS u
JOIN crm_user_role_import_stage AS s
  ON (s.target_email IS NOT NULL AND u.email = s.target_email)
  OR (s.target_email IS NULL AND s.target_open_id IS NOT NULL AND u.openId = s.target_open_id)
SET u.crmRole = s.confirmed_crm_role
WHERE u.role <> 'admin'
  AND s.confirmed_crm_role IN ('user', 'warehouse');

COMMIT;
```

如预览或导入检查出现不一致，应执行 `ROLLBACK` 而不是继续修改。不要批量修改 `users.role`，不要通过 SQL 创建员工密码，也不要把源 CRM `admin` 映射为目标 `assistant` 的 CRM admin。

---

# 4. 验收与回退

## 步骤 6：数据验收

```sql
-- 账号数量及排序检查。
SELECT id, name, color, sortOrder
FROM crm_accounts
ORDER BY sortOrder ASC, name ASC;

-- 查看拥有 CRM 权限的员工；目标 admin 不依赖 crmRole。
SELECT id, openId, email, name, role, crmRole
FROM users
WHERE role = 'admin' OR crmRole IS NOT NULL
ORDER BY role DESC, name ASC;

-- 查找后续业务数据可能无法匹配的账号名称；业务数据导入后再执行。
SELECT DISTINCT account
FROM crm_orders
WHERE account IS NOT NULL
  AND account <> ''
  AND NOT EXISTS (
    SELECT 1 FROM crm_accounts a WHERE a.name = crm_orders.account
  );
```

| 验收项目 | 合格标准 |
|---|---|
| WhatsApp 账号 | 账号名称唯一、颜色与排序符合源清单，CRM 下拉列表可正常显示。 |
| 微店原功能 | 原有 `users` 角色、商品、微店订单、发布任务和渠道功能无变化。 |
| 管理员 | 目标系统现有 admin 可进入 CRM 管理功能，无需额外提升权限。 |
| CRM 客服 | 确认映射的 assistant 仅可访问其被授予的 CRM 功能和数据。 |
| 仓库管理员 | 确认映射的 assistant 可访问全部 CRM 订单，但不能进入 CRM 系统管理。 |
| 未映射员工 | 没有 CRM 菜单且相关接口返回拒绝访问。 |

## 步骤 7：回退原则

在验收失败但未导入历史业务数据时，回退只需撤销本次新增/修改的权限和账号主数据，不应触碰现有微店用户或订单。回退前先导出本次导入结果，保留审计证据。

```sql
START TRANSACTION;

-- 将本次确认赋权的非管理员用户恢复为无 CRM 权限。
UPDATE users AS u
JOIN crm_user_role_import_stage AS s
  ON (s.target_email IS NOT NULL AND u.email = s.target_email)
  OR (s.target_email IS NULL AND s.target_open_id IS NOT NULL AND u.openId = s.target_open_id)
SET u.crmRole = NULL
WHERE u.role <> 'admin';

-- 仅删除本次导入且没有被任何 CRM 业务数据引用的账号。
DELETE a
FROM crm_accounts AS a
JOIN crm_account_import_stage AS s ON a.name = TRIM(s.account_name)
WHERE NOT EXISTS (SELECT 1 FROM crm_orders o WHERE o.account = a.name)
  AND NOT EXISTS (SELECT 1 FROM crm_daily_data d WHERE d.whatsAccount = a.name)
  AND NOT EXISTS (SELECT 1 FROM crm_quotations q WHERE q.account = a.name);

COMMIT;
```

完成验收后，管理员应宣布旧 CRM 的账号与角色配置停止维护；此后所有账号名称、颜色、排序及 CRM 权限均只在目标微店后台的 CRM 模块中维护。若仍需要周期性同步，必须另行设计单一数据源、去重规则、审计日志与冲突处理机制，不能继续人工双边修改。
