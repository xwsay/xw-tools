这是一个基于 **“动静分离 + 边缘计算”** 架构的企业级安全文件分发系统。
前端 UI 托管在 GitHub，后端逻辑由 Cloudflare Worker 驱动，文件实体安全地存储在 S3/R2 对象存储中。

## 🏗️ 架构备忘录 (工作原理)
* **网页床 (UI)**：存放在 GitHub (`download/index.html`)。由 Worker 实时动态拉取并注入变量，享受 CDN 极速缓存。
* **调度员 (API)**：部署在 Cloudflare Worker。负责拦截非法请求、校验密码、并向 S3 索取临时上传/下载签名（Presigned URL）。
* **实体库 (Storage)**：Cloudflare R2 或任意兼容 S3 的对象存储。文件实体**绝不**经过 Worker 内存，而是由前端拿着“临时签名”直接与存储桶进行 P2P 级直传/直下，完美绕过 Worker 的体积和时间限制。

---

## 🛠️ 首次部署指南

### 第一步：前端归位
1. 将 `index.html` 文件上传至 GitHub 仓库：`xwsay/xw-tools/main/download/index.html`。
2. **注意**：前端代码中的 `{{占位符}}` 不需要手动修改，Worker 在拉取时会自动替换。

### 第二步：后端就绪
1. 在 Cloudflare 面板创建一个新的 Worker。
2. 将 `worker.js` 代码粘贴进去。
3. **关键修改**：确保代码第 4 行的 `githubRawUrl` 正确指向你的 GitHub Raw 链接。

### 第三步：注入灵魂 (配置环境变量)
在 Cloudflare Worker 的 **Settings (设置) -> Variables (变量)** 中，添加以下 **Secret (加密)** 变量：
* `ADMIN_PASSWORD`：进入控制台的唯一密码。
* `S3_ENDPOINT`：你的对象存储连接地址（例：`https://xxxx.r2.cloudflarestorage.com`）。
* `S3_ACCESS_KEY`：S3 访问密钥 AK。
* `S3_SECRET_KEY`：S3 私有密钥 SK。
*(注：如果不使用自定义区域，`S3_REGION` 变量可不填)*

---

## 💻 日常使用说明

### 👑 管理员模式 (分发文件)
1. 访问路径：`https://你的域名/admin`
2. 输入你在环境变量里设置的 `ADMIN_PASSWORD`。
3. **上传模式选择**：
   * **阅后即焚 (Burn)**：上传后生成 4 位提取码。用户提取一次后，文件会从服务器物理销毁。
   * **固定长效 (Public)**：上传后生成永久直连 URL，点击即可下载，适合作为公开软件安装包的分发。
4. **内容类型**：
   * **File**：拖拽上传实际文件（直传 S3，支持大文件）。
   * **Text**：直接粘贴纯文本（如注册码、外区苹果 ID），系统会自动将其打包成加密文本文件。

### 🧑‍💻 用户模式 (提取文件)
1. 访问路径：`https://你的域名/`
2. 在巨大的输入框内，输入管理员提供的 **4位提取码**。
3. 点击提取。如果是文本，会在网页端直接弹窗显示；如果是文件，会自动触发浏览器下载。

---

## 🔧 维护与修改指南

### 1. 修改系统配置与文案
**不要修改 GitHub 的前端文件！**
进入 Cloudflare Worker 代码的最顶部 `siteConfig` 区域：
* 修改 `siteTitle` 改变网站名称。
* 修改 `maxStorageBytes` 控制网盘总容量上限。
* 修改 `logoSvgBase64` 替换网站 Logo。
* 修改完成后，点击 `Save and deploy` 瞬间全站生效。

### 2. 修改界面颜色与排版
**不要修改 Cloudflare Worker！**
进入 GitHub 的 `download/index.html` 文件，修改 `<style>` 标签内的 CSS 变量（如 `--bg-body`, `--text-main`），保存提交后刷新网页即可生效。

### 3. 空间清理机制
系统内置了定时清理兜底任务。超过 `burnAfterReadDays`（默认 1 天）未被提取的“阅后即焚”死文件，会在 Cloudflare 触发 Scheduled 定时任务时自动清理。你需要在 Cloudflare Worker 的 **Triggers (触发器)** 里添加一个 **Cron Job**（例如每天运行一次 `0 0 * * *`），以激活此自动清理功能。

---

**遇到问题？** 回忆一下：前端样式找 GitHub，业务逻辑找 Worker，身份认证找环境变量。
