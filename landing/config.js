/**
 * ==========================================
 * 小闻说 | 官方发布页配置表格
 * 修改说明：只需修改引号内的内容，保存即生效
 * ==========================================
 */
const siteConfig = {
  // 1. SEO 权重配置
  seo: {
    title: "小闻说 | 官方发布页",
    description: "小闻说官方最新防失联地址发布页，消除技术门槛，工具为你所用。",
    icon: "https://img.xwsay.com/Piclist/20260130180233761.ico",
    url: "https://www.xwsay.com" // 你的权重域名
  },

  // 2. 个人品牌信息
  profile: {
    avatar: "https://img.xwsay.com/Piclist/20260404224434259.webp", 
    name: "小闻说",
    bio: "消除技术门槛 · 工具为你所用",
    bookmarkBtn: "点击收藏本页防失联"
  },

  // 3. 右上角辅助入口
  blogLink: {
    text: "作者博客",
    link: "https://blog.xwsay.com"
  },

  // 4. 核心功能链接 (你可以根据需要增减)
  urls: [
    {
      title: "教程手册", 
      desc: "保姆级实操指南与跨境工具教程",
      link: "https://docs.xwsay.com" 
    },
    {
      title: "安全下载中心",
      desc: "阅后即焚、极速分发的工具分发站",
      link: "https://download.xwsay.com" 
    },
    {
      title: "地址生成器",
      desc: "免税州 Apple ID 注册信息一键生成",
      link: "https://address.xwsay.com" 
    }
  ],

  // 5. 底部信息
  contact: {
    email: "x@xwsay.com",
    text: "站点邮箱：x@xwsay.com"
  },
  footer: "© 2023-2026 小闻说. All rights reserved."
};
