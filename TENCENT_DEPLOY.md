# WhatsApp CRM 腾讯云服务器独立部署指南

**作者**：Manus AI  
**项目名称**：whatsapp-crm  
**适用场景**：将基于 React + Express + tRPC 的 WhatsApp CRM 系统从 Manus 平台迁移并独立部署到腾讯云 CVM / lighthouse（轻量应用服务器）上。

---

## 一、 部署架构与核心决策

将项目从 Manus WebDev 迁移至腾讯云独立服务器，核心在于处理**运行环境**、**数据库**、**认证系统（OAuth）**以及**反向代理与 HTTPS**四个维度的变更。

### 1. 核心组件对比与选型

| 组件维度 | Manus 托管环境 | 腾讯云独立服务器（CVM / 轻量应用服务器） |
| :--- | :--- | :--- |
| **操作系统** | Manus 隔离容器 (Ubuntu) | Ubuntu 22.04 / 24.04 LTS |
| **运行时** | Node.js 22 + pnpm | Node.js 22 + pnpm (通过 nvm 安装) |
| **数据库** | Manus 托管 TiDB (`DATABASE_URL`) | 可继续远程连接 TiDB，或在腾讯云上自建 MySQL |
| **身份认证** | Manus OAuth (`/api/oauth/callback`) | 需调整或替换认证层（见下文说明） |
| **Web 进程管理** | 托管运行时管理 | PM2 进程守护 |
| **反向代理与 TLS** | 平台边缘网关自动处理 | Nginx + Certbot (Let's Encrypt SSL 证书) |

---

## 二、 关键注意事项：关于 Manus OAuth 认证

项目原本使用 Manus OAuth 进行登录授权，其回调地址固定绑定在 `manus.space` 域名。迁移到腾讯云独立服务器后，直连独立域名（如 `w2ccrm.com`），原有的 Manus OAuth 回调将无法匹配。

针对此问题，您有以下两种处理方案：

1. **方案 A（推荐，单租户内部使用）**：如果该系统仅供内部团队使用，建议将认证系统简化为**账号密码登录**或**固定 Token 访问**，修改 `server/_core/context.ts` 及相关的登录路由，移除对 Manus OAuth 的依赖。
2. **方案 B**：保留 Manus 托管后端（保持 Manus 项目处于 Active 状态，仅将前端静态资源或 API 代理进行调整），但由于您当前面临域名封锁问题，强烈建议采用方案 A 直接在独立服务器上实现自包含的账号密码认证体系。

---

## 三、 腾讯云部署详细步骤

### 步骤 1：准备腾讯云服务器
- **购买建议**：选择腾讯云轻量应用服务器（Lighthouse）或 CVM，配置推荐 2核 4G（Ubuntu 22.04 或 24.04 LTS）。
- **防火墙配置**：在腾讯云控制台中放行安全组端口：`80` (HTTP)、`443` (HTTPS)、`3000` (或您自定义的 Node.js 监听端口)。

### 步骤 2：在服务器上安装运行环境
使用 SSH 登录腾讯云服务器，依次执行以下命令安装 Node.js 22、pnpm 和 PM2：

```bash
# 更新系统包
sudo apt update && sudo apt upgrade -y

# 安装 Git 与 Nginx
sudo apt install -y git nginx certbot python3-certbot-nginx

# 安装 Node.js 22 LTS
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# 安装 pnpm
corepack enable
corepack prepare pnpm@latest --activate

# 安装全局 PM2 进程守护工具
sudo npm install -g pm2
```

### 步骤 3：获取并打包项目代码
您可以直接从 GitHub 仓库克隆代码（如果已关联 GitHub），或者在本地打包项目上传至服务器：

```bash
# 假设克隆您的仓库
cd /home/ubuntu
git clone <您的GitHub仓库地址> whatsapp-crm
cd whatsapp-crm

# 安装依赖
pnpm install

# 构建前端生产版本
pnpm build
```

### 步骤 4：配置环境变量
在项目根目录下创建 `.env` 文件，填入必要的环境变量：

```env
NODE_ENV=production
PORT=3000
DATABASE_URL="mysql://用户名:密码@主机地址:端口/数据库名?ssl=true"
JWT_SECRET="您的安全随机字符串"
# 如果保留部分 Forge API，可继续填入原有的 BUILT_IN_FORGE_API_KEY
BUILT_IN_FORGE_API_KEY="您的 Forge API Key"
```

### 步骤 5：使用 PM2 启动后端服务
配置好环境变量后，使用 PM2 启动应用：

```bash
# 使用生产环境配置启动
NODE_ENV=production PORT=3000 pm2 start server/_core/index.ts --name "whatsapp-crm" --interpreter npx --interpreter-args "tsx"

# 设置开机自启
pm2 startup
pm2 save
```

### 步骤 6：配置 Nginx 与 HTTPS 证书
编辑 Nginx 配置文件 `/etc/nginx/sites-available/whatsapp-crm`：

```nginx
server {
    listen 80;
    server_name w2ccrm.com www.w2ccrm.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

启用站点并使用 Certbot 申请免费的 Let's Encrypt HTTPS 证书：

```bash
sudo ln -s /etc/nginx/sites-available/whatsapp-crm /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# 申请 SSL 证书并自动配置重定向
sudo certbot --nginx -d w2ccrm.com -d www.w2ccrm.com
```

---

## 四、 维护与日常操作

- **查看日志**：`pm2 logs whatsapp-crm`
- **重启服务**：`pm2 restart whatsapp-crm`
- **更新代码**：
  ```bash
  git pull
  pnpm install
  pnpm build
  pm2 restart whatsapp-crm
  ```

---
*本文档由 Manus AI 自动生成，旨在协助用户顺利完成系统独立部署。*
