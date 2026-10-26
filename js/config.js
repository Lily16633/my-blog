// ============================================================
//  网站配置 —— 上线前请填写下面几项
//  详细步骤见同目录下的 README.md
// ============================================================
window.SITE_CONFIG = {
  // 1) Supabase 项目信息
  //    位置：Supabase 控制台 → Project Settings → API
  supabaseUrl: 'https://pdorpdpabvtbtlvqyxdd.supabase.co',
  supabaseAnonKey: 'sb_publishable_UUAjCsT-r9N8LtLbCDAd9g_hf0ItZ2Z',

  // 2) 网站信息（随便改）
  siteName: '拾光小站',
  authorName: '我',
  tagline: '认真生活，慢慢记录',
  aboutText: '这里记录我的想法、读书笔记、日常点滴与健身记录。欢迎你来逛逛。',

  // 3) 管理员邮箱（必须与 supabase-setup.sql 里 is_admin() 填的邮箱一致）
  adminEmail: 'lihua166336419@gmail.com'
};
