(function () {
  'use strict';

  const cfg = window.SITE_CONFIG || {};
  const configured = !!(cfg.supabaseUrl && /\.supabase\.co/.test(cfg.supabaseUrl) && cfg.supabaseAnonKey && !/YOUR-|your-/.test(cfg.supabaseAnonKey));
  const siteName = cfg.siteName || '拾光小站';
  const tagline = cfg.tagline || '认真生活，慢慢记录';

  let sb = null;
  if (configured && window.supabase) {
    sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
  }
  // 注意：新版 marked 已移除 setOptions，渲染时按需传入 options（见 renderMarkdown）

  const CATEGORIES = [
    { key: '想法', icon: '💭', cls: 'c-green' },
    { key: '读书笔记', icon: '📚', cls: 'c-amber' },
    { key: '日常点滴', icon: '☀️', cls: 'c-sun' },
    { key: '健身记录', icon: '💪', cls: 'c-coral' }
  ];
  const CAT_MAP = Object.fromEntries(CATEGORIES.map(c => [c.key, c]));

  let session = null;
  const state = { category: '全部', search: '', posts: [], liked: new Set(), counts: { likes: {}, comments: {} } };

  const $app = document.getElementById('app');

  /* ---------- 工具函数 ---------- */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function fmtDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return isNaN(d) ? '' : d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
  }
  function excerpt(md, len) {
    len = len || 120;
    const t = String(md || '').replace(/[#>*`\-\[\]()!_~|]/g, '').replace(/\s+/g, ' ').trim();
    return t.length > len ? t.slice(0, len) + '…' : t;
  }
  function catIcon(key) { return (CAT_MAP[key] && CAT_MAP[key].icon) || '🍃'; }
  function catCls(key) { return (CAT_MAP[key] && CAT_MAP[key].cls) || 'c-green'; }
  function getUserKey() {
    let k = localStorage.getItem('like_key');
    if (!k) {
      k = (crypto.randomUUID ? crypto.randomUUID() : 'k-' + Math.random().toString(36).slice(2) + Date.now().toString(36));
      localStorage.setItem('like_key', k);
    }
    return k;
  }
  function toast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg; el.hidden = false;
    clearTimeout(el._t);
    el._t = setTimeout(function () { el.hidden = true; }, 2600);
  }
  function isAdmin() {
    if (!session || !session.user) return false;
    if (cfg.adminEmail && !/you@example|your@|@example/.test(cfg.adminEmail)) return session.user.email === cfg.adminEmail;
    return true;
  }
  function renderMarkdown(md) {
    if (!md) return '';
    return window.marked ? marked.parse(md, { breaks: true, gfm: true }) : esc(md).replace(/\n/g, '<br>');
  }
  function debounce(fn, ms) {
    let t;
    return function () {
      const args = arguments;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(null, args); }, ms);
    };
  }

  /* ---------- 数据 ---------- */
  async function loadPosts() {
    if (!sb) return [];
    const { data, error } = await sb.from('posts').select('*').order('created_at', { ascending: false });
    if (error) { toast('加载文章失败：' + error.message); return []; }
    return data || [];
  }
  async function loadCounts() {
    const likes = {}, comments = {};
    if (!sb) return { likes, comments };
    const [l, c] = await Promise.all([
      sb.from('post_like_counts').select('*'),
      sb.from('post_comment_counts').select('*')
    ]);
    (l.data || []).forEach(function (r) { likes[r.post_id] = Number(r.cnt) || 0; });
    (c.data || []).forEach(function (r) { comments[r.post_id] = Number(r.cnt) || 0; });
    return { likes, comments };
  }
  async function getLiked() {
    if (!sb) return new Set();
    const { data } = await sb.rpc('get_user_likes', { p_user_key: getUserKey() });
    return new Set((data || []).map(String));
  }
  async function refreshFeed() {
    const res = await Promise.all([loadPosts(), loadCounts(), getLiked()]);
    state.posts = res[0]; state.counts = res[1]; state.liked = res[2];
  }
  async function getPost(id) {
    const { data, error } = await sb.from('posts').select('*').eq('id', id).single();
    if (error) { toast('文章不存在：' + error.message); return null; }
    return data;
  }
  async function loadComments(id) {
    if (!sb) return [];
    const { data, error } = await sb.from('comments').select('*').eq('post_id', id).order('created_at', { ascending: true });
    if (error) return [];
    return data || [];
  }

  /* ---------- 认证 ---------- */
  async function signIn(email, password) {
    const { data, error } = await sb.auth.signInWithPassword({ email: email, password: password });
    if (error) throw error;
    session = data.session;
  }
  async function signUp(email, password) {
    const { data, error } = await sb.auth.signUp({ email: email, password: password });
    if (error) throw error;
    if (data.session) session = data.session;
  }
  async function signOut() { await sb.auth.signOut(); session = null; }

  /* ---------- 顶栏状态 ---------- */
  function updateNav() {
    document.getElementById('brandName').textContent = siteName;
    document.getElementById('navAuth').textContent = isAdmin() ? '退出' : '登录';
  }

  /* ---------- 渲染 ---------- */
  function heroArt() {
    return '<svg viewBox="0 0 220 220" width="220" height="220" fill="none" aria-hidden="true">' +
      '<circle cx="110" cy="110" r="100" fill="#FBE9D1"/>' +
      '<path d="M110 200 C110 125 110 85 110 30" stroke="#5C8D6F" stroke-width="6" stroke-linecap="round"/>' +
      '<path d="M110 80 C60 70 30 80 18 100 C42 111 82 106 110 95 Z" fill="#8FBF9F"/>' +
      '<path d="M110 130 C160 120 190 130 202 150 C180 162 140 157 110 145 Z" fill="#6FA98B"/>' +
      '<path d="M110 58 C82 40 56 42 46 56 C72 62 96 60 110 66 Z" fill="#A9D3B5"/>' +
      '<path d="M110 160 C142 145 167 148 178 162 C152 171 126 167 110 165 Z" fill="#8FBF9F"/>' +
      '</svg>';
  }

  async function renderHome() {
    const prevFocus = document.activeElement && document.activeElement.id === 'searchInput';
    if (!configured) return renderSetup();

    await refreshFeed();

    const q = state.search.trim().toLowerCase();
    const filtered = state.posts.filter(function (p) {
      const okCat = state.category === '全部' || p.category === state.category;
      const okSearch = !q ||
        (p.title || '').toLowerCase().indexOf(q) >= 0 ||
        (p.content || '').toLowerCase().indexOf(q) >= 0 ||
        (p.tags || []).join(' ').toLowerCase().indexOf(q) >= 0;
      return okCat && okSearch;
    });

    const total = state.posts.length;
    const catTabs = [['全部', '🌼']].concat(CATEGORIES.map(function (c) { return [c.key, c.icon]; }))
      .map(function (pair) {
        return '<button class="chip' + (state.category === pair[0] ? ' active' : '') + '" data-cat="' + esc(pair[0]) + '">' + pair[1] + ' ' + esc(pair[0]) + '</button>';
      }).join('');

    const cards = filtered.map(function (p) {
      const likeN = state.counts.likes[p.id] || 0;
      const comN = state.counts.comments[p.id] || 0;
      const liked = state.liked.has(p.id);
      const tags = (p.tags || []).slice(0, 4).map(function (t) { return '<span class="tag">#' + esc(t) + '</span>'; }).join('');
      return '<article class="post-card" data-id="' + p.id + '">' +
        '<div class="post-card-top"><span class="cat-badge ' + catCls(p.category) + '">' + catIcon(p.category) + ' ' + esc(p.category) + '</span><time>' + fmtDate(p.created_at) + '</time></div>' +
        '<h2 class="post-card-title">' + esc(p.title) + '</h2>' +
        '<p class="post-card-excerpt">' + esc(excerpt(p.content)) + '</p>' +
        '<div class="post-card-tags">' + tags + '</div>' +
        '<div class="post-card-foot">' +
          '<button class="like-btn' + (liked ? ' liked' : '') + '" data-like="' + p.id + '">' + (liked ? '❤️' : '🤍') + ' <span>' + likeN + '</span></button>' +
          '<span class="meta">💬 ' + comN + '</span>' +
        '</div></article>';
    }).join('');

    $app.innerHTML =
      '<section class="hero"><div class="container hero-inner">' +
        '<div class="hero-text">' +
          '<h1>你好，欢迎来到' + esc(siteName) + ' 🌿</h1>' +
          '<p class="hero-sub">' + esc(tagline) + ' · 已记录 ' + total + ' 篇文章</p>' +
          '<button class="btn btn-primary btn-lg" id="heroWrite">✏️ 写一篇新文章</button>' +
        '</div>' +
        '<div class="hero-art">' + heroArt() + '</div>' +
      '</div></section>' +
      '<section class="feed container">' +
        '<div class="feed-toolbar">' +
          '<div class="cat-tabs">' + catTabs + '</div>' +
          '<div class="search-box"><input type="search" id="searchInput" placeholder="搜索文章…" value="' + esc(state.search) + '" /></div>' +
        '</div>' +
        '<div class="post-grid">' + (cards || '<div class="empty">🌱 这里还空空的，去写第一篇吧～</div>') + '</div>' +
      '</section>';

    bindHome();
    if (prevFocus) {
      const si = document.getElementById('searchInput');
      si.focus(); si.setSelectionRange(si.value.length, si.value.length);
    }
  }

  function bindHome() {
    document.querySelectorAll('.chip').forEach(function (el) {
      el.addEventListener('click', function () { state.category = el.dataset.cat; renderHome(); });
    });
    const si = document.getElementById('searchInput');
    if (si) si.addEventListener('input', debounce(function () { state.search = si.value; renderHome(); }, 250));
    document.querySelectorAll('[data-like]').forEach(function (el) {
      el.addEventListener('click', function (e) { e.stopPropagation(); toggleLike(el.dataset.like); });
    });
    document.querySelectorAll('.post-card').forEach(function (el) {
      el.addEventListener('click', function () { location.hash = '#/post/' + el.dataset.id; });
    });
    const hw = document.getElementById('heroWrite');
    if (hw) hw.addEventListener('click', openWrite);
  }

  async function renderPost(id) {
    if (!configured) return renderSetup();
    $app.innerHTML = '<div class="container loading">加载中…</div>';

    const post = await getPost(id);
    if (!post) { location.hash = '#/'; return; }

    const res = await Promise.all([loadComments(id), getLiked()]);
    const comments = res[0];
    state.liked = res[1];

    const lc = await sb.from('post_like_counts').select('cnt').eq('post_id', id).maybeSingle();
    const likeN = Number(lc && lc.data && lc.data.cnt) || 0;
    const liked = state.liked.has(id);
    const canEdit = isAdmin();

    const tags = (post.tags || []).map(function (t) { return '<span class="tag">#' + esc(t) + '</span>'; }).join('');
    const commentHtml = comments.map(renderComment).join('') || '<p class="muted">还没有评论，来说点什么吧～</p>';

    $app.innerHTML =
      '<article class="post-detail container">' +
        '<a class="back" href="#/">← 返回首页</a>' +
        '<div class="post-head"><span class="cat-badge ' + catCls(post.category) + '">' + catIcon(post.category) + ' ' + esc(post.category) + '</span><time>' + fmtDate(post.created_at) + '</time></div>' +
        '<h1 class="post-title">' + esc(post.title) + '</h1>' +
        '<div class="post-tags">' + tags + '</div>' +
        '<div class="post-actions">' +
          '<button class="like-btn' + (liked ? ' liked' : '') + '" id="detailLike">' + (liked ? '❤️' : '🤍') + ' 喜欢 · ' + likeN + '</button>' +
          (canEdit ? '<a class="btn btn-ghost" href="#/edit/' + post.id + '">✏️ 编辑</a><button class="btn btn-danger" id="deletePost">🗑 删除</button>' : '') +
        '</div>' +
        '<div class="post-content">' + renderMarkdown(post.content) + '</div>' +
        '<section class="comments">' +
          '<h2>💬 评论（' + comments.length + '）</h2>' +
          '<div class="comment-list">' + commentHtml + '</div>' +
          '<form class="comment-form" id="commentForm">' +
            '<input id="commentAuthor" placeholder="你的昵称（可留空）" maxlength="30" />' +
            '<textarea id="commentContent" placeholder="写下你的想法…" required maxlength="1000"></textarea>' +
            '<button class="btn btn-primary" type="submit">发表评论</button>' +
          '</form>' +
        '</section>' +
      '</article>';

    document.getElementById('detailLike').addEventListener('click', function () {
      toggleLike(post.id, function () { renderPost(post.id); });
    });
    const del = document.getElementById('deletePost');
    if (del) del.addEventListener('click', async function () {
      if (!confirm('确定删除《' + post.title + '》吗？删除后无法恢复。')) return;
      const { error } = await sb.from('posts').delete().eq('id', post.id);
      if (error) toast('删除失败：' + error.message);
      else { toast('已删除'); location.hash = '#/'; }
    });
    document.querySelectorAll('[data-del]').forEach(function (el) {
      el.addEventListener('click', async function () {
        if (!confirm('删除这条评论？')) return;
        const { error } = await sb.from('comments').delete().eq('id', el.dataset.del);
        if (error) toast('删除失败：' + error.message);
        else renderPost(post.id);
      });
    });
    document.getElementById('commentForm').addEventListener('submit', async function (e) {
      e.preventDefault();
      const author = document.getElementById('commentAuthor').value.trim() || '匿名';
      const content = document.getElementById('commentContent').value.trim();
      if (!content) return;
      const { error } = await sb.from('comments').insert({ post_id: post.id, author: author, content: content });
      if (error) toast('评论失败：' + error.message);
      else { toast('评论成功 🌟'); renderPost(post.id); }
    });
  }

  function renderComment(c) {
    const del = isAdmin() ? '<button class="comment-del" data-del="' + c.id + '">删除</button>' : '';
    return '<div class="comment">' +
      '<div class="comment-head"><strong>' + esc(c.author) + '</strong><time>' + fmtDate(c.created_at) + '</time>' + del + '</div>' +
      '<p>' + esc(c.content).replace(/\n/g, '<br>') + '</p>' +
      '</div>';
  }

  async function renderWrite(id) {
    if (!configured) return renderSetup();
    if (!isAdmin()) { openAuth(); if (!id) location.hash = '#/'; return; }

    let post = { title: '', content: '', category: '想法', tags: [] };
    if (id) {
      post = await getPost(id);
      if (!post) { location.hash = '#/'; return; }
    }

    const catOptions = CATEGORIES.map(function (c) {
      return '<option value="' + esc(c.key) + '"' + (post.category === c.key ? ' selected' : '') + '>' + c.icon + ' ' + esc(c.key) + '</option>';
    }).join('');

    $app.innerHTML =
      '<section class="editor container">' +
        '<h1>' + (id ? '编辑文章' : '写一篇新文章') + ' ✍️</h1>' +
        '<input class="editor-title" id="postTitle" placeholder="标题…" value="' + esc(post.title) + '" />' +
        '<div class="editor-meta">' +
          '<select id="postCategory">' + catOptions + '</select>' +
          '<input id="postTags" placeholder="标签，用逗号分隔，如：读书, 村上春树" value="' + esc((post.tags || []).join(', ')) + '" />' +
        '</div>' +
        '<div class="editor-toolbar">' +
          '<span class="muted">正文（支持 Markdown）</span>' +
          '<div class="toolbar-btns">' +
            '<button type="button" data-before="**" data-after="**" title="粗体">B</button>' +
            '<button type="button" data-before="*" data-after="*" title="斜体">I</button>' +
            '<button type="button" data-line="## " title="小标题">H</button>' +
            '<button type="button" data-line="- " title="列表">•</button>' +
            '<button type="button" data-line="> " title="引用">”</button>' +
            '<button type="button" id="previewBtn">预览</button>' +
          '</div>' +
        '</div>' +
        '<textarea id="postContent" class="editor-content" placeholder="写点什么…">' + esc(post.content) + '</textarea>' +
        '<div id="postPreview" class="editor-preview" hidden></div>' +
        '<div class="editor-actions">' +
          '<button class="btn btn-primary" id="savePost">' + (id ? '保存修改' : '发布文章') + ' 🌱</button>' +
          '<a class="btn btn-ghost" href="#/">取消</a>' +
        '</div>' +
      '</section>';

    const ta = document.getElementById('postContent');
    const pv = document.getElementById('postPreview');
    const pvBtn = document.getElementById('previewBtn');
    function togglePreview() {
      const on = pv.hidden;
      pv.hidden = !on;
      ta.hidden = on;
      if (on) pv.innerHTML = renderMarkdown(ta.value);
      pvBtn.textContent = on ? '编辑' : '预览';
    }
    pvBtn.addEventListener('click', togglePreview);
    document.querySelectorAll('[data-before], [data-line]').forEach(function (b) {
      b.addEventListener('click', function () {
        const s = ta.selectionStart, e = ta.selectionEnd;
        const sel = ta.value.slice(s, e);
        const before = b.dataset.line != null ? '\n' + b.dataset.line : (b.dataset.before || '');
        const after = b.dataset.line != null ? '' : (b.dataset.after || '');
        ta.setRangeText(before + sel + after, s, e, 'end');
        ta.focus();
      });
    });

    document.getElementById('savePost').addEventListener('click', async function () {
      const title = document.getElementById('postTitle').value.trim();
      const category = document.getElementById('postCategory').value;
      const tags = document.getElementById('postTags').value.split(/[,，]/).map(function (s) { return s.trim(); }).filter(Boolean);
      const content = ta.value.trim();
      if (!title) return toast('请先写个标题～');
      if (!content) return toast('正文不能为空～');
      const payload = { title: title, category: category, tags: tags, content: content, updated_at: new Date().toISOString() };
      let err;
      if (id) {
        const r = await sb.from('posts').update(payload).eq('id', id);
        err = r.error;
      } else {
        const r = await sb.from('posts').insert(payload);
        err = r.error;
      }
      if (err) return toast('保存失败：' + err.message);
      toast('已发布 🌱');
      location.hash = '#/';
    });
  }

  function renderAbout() {
    $app.innerHTML =
      '<section class="about container">' +
        '<div class="about-card">' +
          '<h1>🍃 关于' + esc(siteName) + '</h1>' +
          '<p class="about-text">' + esc(cfg.aboutText || '这里记录我的想法、读书笔记、日常点滴与健身记录。') + '</p>' +
          '<div class="about-tags">' + CATEGORIES.map(function (c) { return '<span class="cat-badge ' + c.cls + '">' + c.icon + ' ' + esc(c.key) + '</span>'; }).join('') + '</div>' +
        '</div>' +
      '</section>';
  }

  function renderSetup() {
    $app.innerHTML =
      '<section class="about container"><div class="setup-card">' +
        '<h1>🌱 还差最后一步就能上线啦</h1>' +
        '<p>网站还没连接到数据库（Supabase）。请按 <strong>README.md</strong> 里的步骤：</p>' +
        '<ol>' +
          '<li>在 Supabase 注册并创建项目</li>' +
          '<li>运行 <code>supabase-setup.sql</code></li>' +
          '<li>把 URL 和 anon key 填进 <code>js/config.js</code></li>' +
          '<li>重新部署 / 刷新即可</li>' +
        '</ol>' +
      '</div></section>';
  }

  /* ---------- 点赞 ---------- */
  async function toggleLike(postId, after) {
    if (!sb) { toast('尚未配置数据库'); return; }
    const { data, error } = await sb.rpc('toggle_like', { p_post_id: postId, p_user_key: getUserKey() });
    if (error) { toast('操作失败：' + error.message); return; }
    const cnt = Number(data) || 0;
    state.counts.likes[postId] = cnt;
    if (state.liked.has(postId)) state.liked.delete(postId);
    else state.liked.add(postId);
    if (after) after();
    else renderHome();
  }

  /* ---------- 写文章入口 ---------- */
  function openWrite() {
    if (!configured) { renderSetup(); return; }
    if (!isAdmin()) { pendingWrite = true; openAuth(); return; }
    location.hash = '#/write';
  }

  /* ---------- 登录弹窗 ---------- */
  let authMode = 'signin';
  let pendingWrite = false;
  function openAuth() { document.getElementById('authModal').hidden = false; setAuthMode('signin'); }
  function closeAuth() { document.getElementById('authModal').hidden = true; }
  function setAuthMode(mode) {
    authMode = mode;
    const signin = mode === 'signin';
    document.getElementById('authTitle').textContent = signin ? '登录' : '注册';
    document.getElementById('authSub').textContent = signin ? '登录后即可发布和管理文章' : '注册一个账号（注册后需在 Supabase 里设为管理员）';
    document.getElementById('authSubmit').textContent = signin ? '登录' : '注册';
    document.getElementById('authToggle').textContent = signin ? '第一次来？注册账号' : '已有账号？去登录';
    document.getElementById('authMsg').textContent = '';
  }
  async function handleAuthSubmit(e) {
    e.preventDefault();
    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value;
    const msg = document.getElementById('authMsg');
    try {
      if (authMode === 'signin') {
        await signIn(email, password);
        msg.textContent = '';
        closeAuth();
        toast('欢迎回来 🌿');
        updateNav();
        if (pendingWrite && isAdmin()) { pendingWrite = false; location.hash = '#/write'; }
        else router();
      } else {
        await signUp(email, password);
        if (session) {
          closeAuth();
          toast('注册成功 🌱（记得在 Supabase 里把邮箱设为管理员）');
          updateNav();
          if (pendingWrite && isAdmin()) { pendingWrite = false; location.hash = '#/write'; }
          else router();
        } else {
          msg.textContent = '注册请求已发送，请到邮箱确认后再登录。';
        }
      }
    } catch (err) {
      msg.textContent = '出错了：' + (err.message || '请检查邮箱和密码');
    }
  }

  /* ---------- 路由 ---------- */
  function router() {
    const hash = location.hash || '#/';
    const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
    const route = parts[0] || 'home';
    window.scrollTo(0, 0);
    if (route === 'home') return renderHome();
    if (route === 'post' && parts[1]) return renderPost(parts[1]);
    if (route === 'write') return renderWrite();
    if (route === 'edit' && parts[1]) return renderWrite(parts[1]);
    if (route === 'about') return renderAbout();
    return renderHome();
  }

  /* ---------- 初始化 ---------- */
  async function init() {
    document.title = siteName + ' · ' + tagline;
    document.getElementById('footerName').textContent = siteName;
    updateNav();

    document.getElementById('navWrite').addEventListener('click', openWrite);
    document.getElementById('navAuth').addEventListener('click', function () {
      if (isAdmin()) {
        signOut().then(function () {
          toast('已退出');
          updateNav();
          if (location.hash.indexOf('#/write') === 0 || location.hash.indexOf('#/edit') === 0) location.hash = '#/';
          else router();
        });
      } else {
        openAuth();
      }
    });

    document.getElementById('authClose').addEventListener('click', closeAuth);
    document.getElementById('authToggle').addEventListener('click', function (e) {
      e.preventDefault();
      setAuthMode(authMode === 'signin' ? 'signup' : 'signin');
    });
    document.getElementById('authForm').addEventListener('submit', handleAuthSubmit);

    window.addEventListener('hashchange', router);

    if (sb) {
      const { data } = await sb.auth.getSession();
      session = data.session;
      updateNav();
      sb.auth.onAuthStateChange(function (_evt, sess) { session = sess; updateNav(); });
    }

    router();
  }

  init();
})();
