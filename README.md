# 拾光小站 🌿

一个温馨、明亮、生机盎然的个人博客网站。支持写想法、读书笔记、日常点滴、健身记录，带有分类标签、搜索、点赞、评论，只有站长本人能发文。

- 前端：原生 HTML / CSS / JS（无需安装任何东西，无需构建）
- 数据库 / 登录 / 评论 / 点赞：**Supabase**（免费）
- 托管：**GitHub Pages**（免费）

---

## 一、目录结构

```
my-blog/
├── index.html            页面骨架
├── css/style.css         样式
├── js/config.js          ★ 需要你填写的配置
├── js/app.js             网站逻辑
├── supabase-setup.sql    ★ 需要在 Supabase 里运行的初始化脚本
├── .gitignore
└── README.md
```

上线一共要做三件事：**建 Supabase 数据库 → 填配置 → 部署到 GitHub Pages**。

---

## 二、第一步：搭建 Supabase 数据库（约 5 分钟）

1. 打开 <https://supabase.com>，点 **Start your project**，用邮箱注册（免费）。
2. 登录后点 **New project**：
   - Name：随便填，比如 `my-blog`
   - Database Password：设置一个密码（**记下来**，后面可能要用）
   - Region：选一个离你近的，如 `Southeast Asia (Singapore)`
   - 点 **Create new project**，等 1–2 分钟初始化完成。
3. 进入项目后，左侧菜单点 **SQL Editor** → **New query**。
4. 打开本项目的 `supabase-setup.sql`，复制全部内容，粘贴到编辑框里。
5. **把 `is_admin()` 函数里的 `'you@example.com'` 换成你自己的邮箱**（这就是你的登录账号）。
6. 点 **Run**，看到 "Success" 即完成。

### 关闭邮箱确认（让你注册后能立刻登录）

左侧菜单 **Authentication** → **Providers** → **Email**，把 **Confirm email** 关掉，点 **Save**。

### 记录两个关键信息

左侧菜单 **Project Settings** → **API**，找到并复制：
- **Project URL**（形如 `https://xxxx.supabase.co`）
- **anon public** 那一行的 key（`anon key`）

---

## 三、第二步：填写配置

打开 `js/config.js`，把三处填好：

```js
window.SITE_CONFIG = {
  supabaseUrl: 'https://xxxx.supabase.co',   // ← 填 Project URL
  supabaseAnonKey: '你的 anon key',           // ← 填 anon key

  siteName: '拾光小站',                       // 网站名，随便改
  authorName: '我',
  tagline: '认真生活，慢慢记录',
  aboutText: '这里记录我的想法、读书笔记、日常点滴与健身记录。',

  adminEmail: 'you@example.com'               // ← 与 SQL 里填的邮箱一致
};
```

---

## 四、第三步：部署到 GitHub Pages

### 方法 A：命令行（推荐，如果你装了 GitHub CLI）

```bash
# 1) 进入项目目录
cd my-blog

# 2) 初始化 git 并提交
git init
git add .
git commit -m "init: 个人博客"

# 3) 在 GitHub 上新建一个仓库（例如叫 my-blog），然后：
git remote add origin https://github.com/你的用户名/my-blog.git
git branch -M main
git push -u origin main
```

> 如果本机登录了 `gh`，也可以一条命令建仓并推送：
> ```bash
> gh repo create my-blog --public --source=. --push
> ```

### 方法 B：网页操作

1. 打开 <https://github.com/new>，新建一个仓库，名字如 `my-blog`，选 **Public**。
2. 把 `my-blog` 文件夹里的所有文件上传到这个仓库。
3. 进入仓库 → **Settings** → **Pages**：
   - Source 选 **Deploy from a branch**
   - Branch 选 `main` / `(root)`
   - 点 **Save**
4. 等 1 分钟左右，页面上会显示网址：
   `https://你的用户名.github.io/my-blog/`

打开这个网址，你的网站就上线了 🎉

---

## 五、第一次使用（重要）

1. 打开你的网站，点右上角 **登录**。
2. 点 **「第一次来？注册账号」**，用你填在 SQL 里的那个邮箱 + 一个密码注册。
3. 注册并登录后，右上角会出现 **✏️ 写文章**，点它就能发文了。
4. 访客（未登录的人）只能浏览、搜索、点赞、评论，不能发文。

> 提示：注册的账号已经在 SQL 里被设为管理员，登录后即可写文章。如果登录后看不到「写文章」，确认 `config.js` 的 `adminEmail` 与 `supabase-setup.sql` 里的邮箱完全一致。

---

## 六、写文章支持 Markdown

正文编辑器支持 Markdown，例如：

```markdown
## 小标题
**粗体**、*斜体*

- 列表项一
- 列表项二

> 引用一段话

[链接文字](https://example.com)
```

编辑时点「预览」可以实时查看效果。

---

## 七、常见问题

**Q：点「写文章」提示保存失败 / 权限不足？**
A：确认两点：① 你已登录管理员账号；② `config.js` 的 `adminEmail` 与 SQL 里的一致。

**Q：注册后收不到确认邮件？**
A：按「第一步」末尾的方法，在 Supabase 的 Authentication → Providers → Email 里关闭 Confirm email。

**Q：改完 `config.js` 后网站没变化？**
A：重新部署（重新 push / 重新上传）后，强制刷新浏览器（Ctrl+F5）。

**Q：想改分类（比如加一个「旅行」）？**
A：在 `js/app.js` 顶部的 `CATEGORIES` 数组里加一项即可，数据库里的 `category` 字段是自由文本，无需改表结构。
