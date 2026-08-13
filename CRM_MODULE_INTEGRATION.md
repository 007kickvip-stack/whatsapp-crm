# WhatsApp CRM 独立模块整合说明

## 目标

将本项目的 **WhatsApp CRM 功能**整合进另一个 Manus 账号下已经存在的后台系统，同时**保留目标后台的现有页面、菜单、用户与业务逻辑**。CRM 应成为目标后台中的一组独立菜单，而不是覆盖整个目标项目。

> 此迁移包仅包含源码、数据库结构和迁移记录；**不包含业务数据库数据、环境变量、登录会话、API 密钥、`node_modules` 或构建产物**。

## CRM 模块范围

| 模块 | 主要代码位置 | 整合后的建议菜单 |
|---|---|---|
| 仪表盘与退款统计 | `client/src/pages/Home.tsx` | CRM 概览 |
| 客户管理 | `client/src/pages/Customers.tsx` | 客户管理 |
| 订单与订单子项 | `client/src/pages/Orders.tsx`、`server/routers.ts`、`server/db.ts` | 订单管理 |
| 客户报价与补发表 | `client/src/pages/CustomerQuote.tsx`、`client/src/pages/Replenishment.tsx` | 客户报价、补发表 |
| PayPal 收支 | `client/src/pages/PayPal.tsx` | PayPal 收支 |
| 每日数据、日报和周报 | `client/src/pages/DailyData.tsx` | 每日数据 |
| 利润、目标、复购分析 | `client/src/pages/ProfitReport.tsx`、`TargetManagement.tsx`、`CustomerAnalysis.tsx` | 数据分析 |
| 用户、账号、汇率、字段权限与操作日志 | `client/src/pages/Users.tsx` 等 | CRM 系统设置 |

## 给目标项目中开发助手的导入指令

在另一个 Manus 账号下的目标项目中，上传此压缩包后，直接发送以下指令：

```text
请将我上传的 whatsapp-crm-source-migration.zip 整合到当前已有后台中。

要求：
1. 保留当前后台全部既有功能、页面、路由、数据库表和用户数据，不覆盖、不删除。
2. 将上传包中的 WhatsApp CRM 作为独立的“CRM”菜单组整合进现有侧边栏；CRM 菜单应包含仪表盘、客户管理、订单管理、报价表、补发表、PayPal 收支、每日数据、利润报表、目标管理、客户分析、工资与提成、用户管理、账号管理、汇率管理、字段权限、操作日志和数据备份。
3. 先完整阅读当前项目和迁移包的 package.json、drizzle/schema.ts、server/routers.ts、server/db.ts、client/src/App.tsx、client/src/components/DashboardLayout.tsx；不得直接用迁移包文件覆盖当前项目文件。
4. 以模块化方式合并：复用目标项目的认证、布局、数据库连接和公共组件；将 CRM 路由、页面、数据库帮助函数分拆/合并到适合当前项目结构的位置。
5. 保留 CRM 的 admin、user、warehouse 三种角色；若目标项目已有角色系统，制定兼容映射，不破坏既有权限。
6. 合并 Drizzle schema 和迁移，禁止删除或重建目标项目已有数据表；如有同名表/字段/路由冲突，请先列出冲突并采用命名空间或兼容迁移处理。
7. 不迁移 .env、任何密钥、node_modules、dist、.git、.manus-logs；在目标项目环境中重新配置 DATABASE_URL、JWT_SECRET 和第三方服务密钥。
8. 每一阶段先运行 TypeScript 检查和 Vitest；最后验证 CRM 的登录权限、客户、订单、子项退款、每日数据和仪表盘统计。
9. 当前迁移包不含历史业务数据；先完成代码和空库迁移，再单独制定客户、订单、订单子项、每日数据、付款记录等数据的导入方案。
```

## 数据库整合原则

CRM 的数据库定义位于 `drizzle/schema.ts`，历史迁移位于 `drizzle/`。目标项目整合时，应先对比两边的表名、外键、用户表和角色枚举。

| 场景 | 正确处理方式 |
|---|---|
| 目标项目没有同类表 | 将 CRM 表和必要索引合并至 schema，生成新的增量迁移并执行。 |
| 目标项目已有 `users` 表 | 复用目标项目用户表；为 CRM 所需角色、状态字段及权限字段做兼容性扩展。 |
| 表名或字段名冲突 | 不覆盖原表；为 CRM 表采用明确前缀或在字段层制定映射。 |
| 需要迁移历史数据 | 先完成目标库结构与空库流程验证；备份后按依赖顺序导入用户/账号、客户、订单、订单子项、每日数据、付款记录。 |

## 不应随迁移包带走的内容

迁移包会排除以下内容：

- `.env`、密钥、Token、Cookie、登录会话和本地数据库连接信息；
- `node_modules/`、`dist/`、`.git/`、`.manus-logs/`；
- 调试记录、截图和临时分析文件；
- 当前 Manus 数据库中的客户、订单、付款等真实业务数据。

## 导入后的验证清单

完成合并后，目标项目需要至少验证：

1. 现有后台原功能和原用户权限均正常；
2. CRM 菜单仅向被授权角色显示；
3. 客户新增、订单新增、子项编辑和退款同步正常；
4. 退款订单不计入每日数据、仪表盘、利润与客户累计统计；
5. 订单或子项从“已退款”恢复为其他状态时，客户信息与统计能够恢复；
6. 每日数据中的预估毛利润可手动填写并自动重新计算利润率；
7. 运行 `pnpm test`、`pnpm check` 均无错误。
