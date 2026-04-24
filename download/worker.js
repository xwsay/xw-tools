// ==========================================
// cf的wokers备份
// ==========================================
const siteConfig = {
  // 仓库里的前端文件地址 (注意修改为你的真实地址)
  githubRawUrl: "https://raw.githubusercontent.com/xwsay/xw-tools/main/download/index.html",
  
  maxStorageBytes: 10 * 1024 * 1024 * 1024, // 10GB 限额
  fixedDownloadPrefix: "PUBLIC_ZONE/", // 固定直链区存放前缀
  burnAfterReadDays: 1, // 阅后即焚文件的兜底清理天数
  textMessageFilename: "__SECRET_TEXT_MSG__.txt", 

  siteTitle: "SecureDrop", 
  logoSvgBase64: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA1MTIgNTEyIj48cmVjdCB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgcng9IjEyMCIgZmlsbD0iIzE3MTcxNyIvPjxwYXRoIGQ9Ik0xMTEuNSA5Ny4zbDMxMi42LTQ5LjctNTkuNCAzNDMuN0wyMzggMjc2LjcgMzA4LjcgMTcybC0xMTguNiA4NC40TDExMS41IDk3LjN6IiBmaWxsPSIjZmZmIiB0cmFuc2Zvcm09InRyYW5zbGF0ZSgyMCA1MCkiLz48L3N2Zz4=",
  
  navCodeDownload: "即焚提取",
  navAdminUpload: "控制台",
  
  msgAuthFailed: "认证失败",
  msgStorageFull: "空间已满",
  msgFormatError: "格式错误",
  msgNotFound: "文件已销毁或未找到",
  msgSysError: "系统内部错误"
};

// ==========================================
// 底层逻辑区 (核心 S3 通信与路由，无需修改)
// ==========================================
class S3Client {
  constructor(env) {
    this.ak = env.S3_ACCESS_KEY;
    this.sk = env.S3_SECRET_KEY;
    this.region = env.S3_REGION || 'auto';
    this.endpoint = (env.S3_ENDPOINT || '').replace(/\/$/, ''); 
  }

  async getSignature(canonicalRequest, amzDate, credentialScope, dateStamp) {
    const hashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalRequest));
    const canonicalRequestHash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
    const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${canonicalRequestHash}`;

    const hmac = async (key, msg) => {
      const cryptoKey = await crypto.subtle.importKey('raw', typeof key === 'string' ? new TextEncoder().encode(key) : key, {name: 'HMAC', hash: 'SHA-256'}, false, ['sign']);
      return new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(msg)));
    };

    const kDate = await hmac(`AWS4${this.sk}`, dateStamp);
    const kRegion = await hmac(kDate, this.region);
    const kService = await hmac(kRegion, 's3');
    const kSigning = await hmac(kService, 'aws4_request');
    const signatureBytes = await hmac(kSigning, stringToSign);
    return Array.from(signatureBytes).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async presign(key, method = 'PUT', expiresIn = 3600) {
    const encodedPath = key.split('/').map(encodeURIComponent).join('/');
    const url = new URL(this.endpoint + (encodedPath.startsWith('/') || !encodedPath ? '' : '/') + encodedPath);

    const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);
    const credentialScope = `${dateStamp}/${this.region}/s3/aws4_request`;

    url.searchParams.set('X-Amz-Algorithm', 'AWS4-HMAC-SHA256');
    url.searchParams.set('X-Amz-Credential', `${this.ak}/${credentialScope}`);
    url.searchParams.set('X-Amz-Date', amzDate);
    url.searchParams.set('X-Amz-Expires', expiresIn.toString());
    url.searchParams.set('X-Amz-SignedHeaders', 'host');

    const canonicalQuery = Array.from(url.searchParams.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');

    const canonicalRequest = `${method}\n${url.pathname}\n${canonicalQuery}\nhost:${url.hostname}\n\nhost\nUNSIGNED-PAYLOAD`;
    const signature = await this.getSignature(canonicalRequest, amzDate, credentialScope, dateStamp);
    
    url.searchParams.set('X-Amz-Signature', signature);
    return url.toString();
  }

  async request(path, options = {}) {
    const encodedPath = path.split('/').map(encodeURIComponent).join('/');
    const url = new URL(this.endpoint + (encodedPath.startsWith('/') || !encodedPath ? '' : '/') + encodedPath);
    if (options.query) Object.entries(options.query).forEach(([k, v]) => url.searchParams.set(k, v));
    
    const method = options.method || 'GET';
    const headers = new Headers(options.headers || {});
    headers.set('host', url.hostname);
    
    const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);
    headers.set('x-amz-date', amzDate);
    headers.set('x-amz-content-sha256', 'UNSIGNED-PAYLOAD');

    const keys = Array.from(headers.keys()).sort();
    const canonicalHeaders = keys.map(k => `${k}:${headers.get(k)}`).join('\n') + '\n';
    const signedHeaders = keys.join(';');
    const canonicalQuery = Array.from(url.searchParams.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
    const canonicalRequest = `${method}\n${url.pathname}\n${canonicalQuery}\n${canonicalHeaders}\n${signedHeaders}\nUNSIGNED-PAYLOAD`;
    const credentialScope = `${dateStamp}/${this.region}/s3/aws4_request`;
    
    const signature = await this.getSignature(canonicalRequest, amzDate, credentialScope, dateStamp);
    headers.set('Authorization', `AWS4-HMAC-SHA256 Credential=${this.ak}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`);
    
    const reqInit = { method, headers, body: options.body };
    if (options.body) Object.assign(reqInit, { duplex: 'half' });
    return fetch(url, reqInit);
  }

  async delete(key) { return this.request(key, { method: 'DELETE' }); }
  
  async list(prefix = '') {
    const res = await this.request('', { query: { 'list-type': '2', prefix } });
    if (!res.ok) return { objects: [], totalSize: 0 };
    const xml = await res.text();
    const objects = [];
    let totalSize = 0;
    
    for (const block of xml.match(/<Contents>.*?<\/Contents>/gs) || []) {
      const [_, key] = block.match(/<Key>(.*?)<\/Key>/) || [];
      const [__, sizeStr] = block.match(/<Size>(.*?)<\/Size>/) || [];
      const [___, date] = block.match(/<LastModified>(.*?)<\/LastModified>/) || [];
      
      if (key) {
        const cleanKey = key.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
        const size = parseInt(sizeStr, 10) || 0;
        objects.push({ key: cleanKey, size, uploaded: date ? new Date(date) : new Date() });
        totalSize += size;
      }
    }
    return { objects, totalSize };
  }
}

// 动态获取 GitHub 界面并注入配置
async function serveHTMLFromGitHub(mode) {
  try {
    const response = await fetch(siteConfig.githubRawUrl, { cf: { cacheTtl: 86400, cacheEverything: true } });
    if (!response.ok) return new Response("Failed to load UI from GitHub", { status: 500 });
    
    let html = await response.text();
    
    // 大佬级变量注入：将代码顶部的配置映射到 HTML 文件里
    html = html.replace(/{{SITE_TITLE}}/g, siteConfig.siteTitle)
               .replace(/{{LOGO_SVG}}/g, siteConfig.logoSvgBase64)
               .replace(/{{MODE}}/g, mode)
               .replace(/{{CFG_JSON}}/g, JSON.stringify(siteConfig));

    return new Response(html, { headers: { 'Content-Type': 'text/html;charset=UTF-8' } });
  } catch (e) {
    return new Response("Error fetching UI", { status: 500 });
  }
}

export default {
  async fetch(request, env, ctx) {
    if (!env.ADMIN_PASSWORD || !env.S3_ENDPOINT || !env.S3_ACCESS_KEY || !env.S3_SECRET_KEY) {
      return new Response("系统未正确配置环境变量", { status: 500 });
    }

    const url = new URL(request.url);
    const s3 = new S3Client(env);
    
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, PUT, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Expose-Headers": "Content-Length, Content-Disposition" 
    };

    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    try {
      if (request.method === 'GET') {
        // UI 路由：去 GitHub 拿货
        if (url.pathname === '/') return serveHTMLFromGitHub('front');
        if (url.pathname === '/admin') return serveHTMLFromGitHub('admin');
        
        // API 路由
        if (url.pathname === '/api/new-code') return generateUniqueCode(env, url.searchParams.get('pw'));
        if (url.pathname === '/api/find') return findObjects(s3, url.searchParams.get('code'));
        if (url.pathname === '/api/admin-list') return listAdminObjects(env, s3, url.searchParams.get('pw'));
        
        if (url.pathname === '/api/direct') {
          const targetKey = url.searchParams.get('key');
          if (!targetKey) return new Response("无效请求", { status: 400 });
          const presignedUrl = await s3.presign(targetKey, 'GET', 3600);
          return Response.redirect(presignedUrl, 302);
        }

        if (url.pathname === '/api/presign-get') {
          const targetKey = url.searchParams.get('key');
          const presignedUrl = await s3.presign(targetKey, 'GET', 3600);
          return new Response(JSON.stringify({ url: presignedUrl }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
        }
      } 
      else if (request.method === 'POST') {
        if (url.pathname === '/api/presign-put') {
           const data = await request.json();
           if (data.pw !== env.ADMIN_PASSWORD) return new Response(siteConfig.msgAuthFailed, { status: 403, headers: corsHeaders });
           const { totalSize } = await s3.list();
           if (totalSize + (data.size || 0) > siteConfig.maxStorageBytes) return new Response(siteConfig.msgStorageFull, { status: 507, headers: corsHeaders });
           
           let targetKey = data.isPublic ? `${siteConfig.fixedDownloadPrefix}${data.filename}` : `${data.code}/${data.filename}`;
           const presignedUrl = await s3.presign(targetKey, 'PUT', 3600);
           return new Response(JSON.stringify({ url: presignedUrl, key: targetKey }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
        }
      }
      else if (request.method === 'DELETE') {
        if (url.pathname === '/api/delete') return deleteAdminObject(env, s3, url.searchParams.get('key'), url.searchParams.get('pw'));
        if (url.pathname === '/api/burn') {
           await s3.delete(url.searchParams.get('key'));
           return new Response("OK", { headers: corsHeaders });
        }
      }
    } catch (e) {
      return new Response(siteConfig.msgSysError + ": " + e.message, { status: 500, headers: corsHeaders });
    }
    return new Response('404 Not Found', { status: 404, headers: corsHeaders });
  },

  async scheduled(event, env, ctx) {
    if (!env.S3_ENDPOINT) return;
    const s3 = new S3Client(env);
    ctx.waitUntil(cleanupOldFiles(s3));
  }
};

const CODE_CHARS = "3456789ABCDEFGHJKLMNPQRSTUVWXY"; 

async function generateUniqueCode(env, password) {
  if (password !== env.ADMIN_PASSWORD) return new Response(siteConfig.msgAuthFailed, { status: 403 });
  let code = "";
  for (let i = 0; i < 4; i++) code += CODE_CHARS.charAt(Math.floor(Math.random() * CODE_CHARS.length));
  return new Response(JSON.stringify({ code }), { headers: { "Content-Type": "application/json" } });
}

async function findObjects(s3, code) {
  if (!code || code.length !== 4) return new Response(siteConfig.msgFormatError, { status: 400 });
  const { objects } = await s3.list(code.toUpperCase() + "/");
  if (objects.length === 0) return new Response(siteConfig.msgNotFound, { status: 404 });
  const files = objects.map(obj => ({ key: obj.key, name: obj.key.substring(5), size: obj.size }));
  return new Response(JSON.stringify(files), { headers: { "Content-Type": "application/json" } });
}

async function listAdminObjects(env, s3, password) {
  if (password !== env.ADMIN_PASSWORD) return new Response(siteConfig.msgAuthFailed, { status: 403 });
  const { objects } = await s3.list();
  return new Response(JSON.stringify(objects), { headers: { "Content-Type": "application/json" } });
}

async function deleteAdminObject(env, s3, key, password) {
  if (password !== env.ADMIN_PASSWORD) return new Response(siteConfig.msgAuthFailed, { status: 403 });
  if (!key) return new Response(siteConfig.msgFormatError, { status: 400 });
  await s3.delete(key);
  return new Response("OK");
}

async function cleanupOldFiles(s3) {
  const MS_LIMIT = siteConfig.burnAfterReadDays * 24 * 60 * 60 * 1000;
  const now = Date.now();
  try {
    const { objects } = await s3.list();
    const keysToDelete = objects
      .filter(obj => (now - obj.uploaded.getTime()) > MS_LIMIT && !obj.key.startsWith(siteConfig.fixedDownloadPrefix))
      .map(obj => obj.key);
    for (const key of keysToDelete) await s3.delete(key);
  } catch (e) {}
}
