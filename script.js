const app = document.querySelector("#app");
const toast = document.querySelector("#toast");

const storeKey = "nuannuan-h5-state-v3";

const defaultPosts = [
  {
    id: "p1",
    text: "明明已经很努力了，为什么还是得不到认可...",
    tag: "焦虑",
    mood: "焦虑",
    time: "10分钟前",
    likes: 892,
    resonance: 2458,
    private: false,
    favorite: true,
  },
  {
    id: "p2",
    text: "一个人走夜路的时候，总是会想很多，想被温柔地接住。",
    tag: "难过",
    mood: "难过",
    time: "29分钟前",
    likes: 732,
    resonance: 1856,
    private: false,
  },
  {
    id: "p3",
    text: "希望明天会是美好的一天呀。",
    tag: "开心",
    mood: "开心",
    time: "1小时前",
    likes: 518,
    resonance: 1220,
    private: false,
  },
];

const defaultState = {
  users: {},
  user: null,
  authMode: "login",
  tab: "companion",
  page: "home",
  filter: "全部",
  posts: defaultPosts,
  liked: {},
  chats: [
    { role: "bot", text: "我在认真听你说。无论是什么情绪，都可以慢慢讲给我听。" },
    { role: "user", text: "今天工作很累，感觉自己什么都做不好..." },
    { role: "bot", text: "听起来你今天承受了很多。先把肩膀放松一点，我们一起把事情拆小，好吗？" },
  ],
  chatLoading: false,
  usageRecords: [
    { type: "AI 陪伴", detail: "完成一次压力安抚对话", time: "今天 21:18" },
    { type: "泄压舱", detail: "戳破 23 个解压泡泡", time: "今天 20:42" },
    { type: "心情共鸣", detail: "收藏了一条匿名心情", time: "昨天 22:05" },
  ],
  journalEntries: [
    { date: "2026-05-16", mood: "平静", text: "今天给自己留了一点安静时间，感觉呼吸轻了一些。" },
  ],
  feedback: [],
  shredLogs: ["考试焦虑", "和朋友吵架", "工作压力大"],
  sharedImages: [],
  woodCount: 36,
  bubbleCount: 23,
  callSeconds: 28,
  videoSeconds: 16,
  doodleColor: "#8066f4",
  privacy: { anonymous: true, randomHistory: true, noRecommend: false },
  theme: { color: "purple", mode: "light", font: "normal" },
  breath: { running: false, step: 0, round: 1 },
};

let state = loadState();
let selectedPublishTag = "压力";
let selectedPublishMood = "焦虑";
let toastTimer = 0;
let callTimer = 0;
let videoTimer = 0;
let breathTimer = 0;
let activeStream = null;

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(storeKey) || "{}");
    return {
      ...defaultState,
      ...saved,
      users: saved.users || defaultState.users,
      posts: saved.posts || defaultState.posts,
      chats: saved.chats || defaultState.chats,
      usageRecords: saved.usageRecords || defaultState.usageRecords,
      journalEntries: saved.journalEntries || defaultState.journalEntries,
      feedback: saved.feedback || defaultState.feedback,
      shredLogs: saved.shredLogs || defaultState.shredLogs,
      sharedImages: saved.sharedImages || defaultState.sharedImages,
      privacy: { ...defaultState.privacy, ...(saved.privacy || {}) },
      theme: { ...defaultState.theme, ...(saved.theme || {}) },
      breath: { ...defaultState.breath, ...(saved.breath || {}) },
    };
  } catch {
    return { ...defaultState };
  }
}

function saveState() {
  localStorage.setItem(storeKey, JSON.stringify(state));
}

function h(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[char]);
}

function showToast(message) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("show");
  toastTimer = setTimeout(() => toast.classList.remove("show"), 1800);
}

function recordUsage(type, detail) {
  state.usageRecords.unshift({ type, detail, time: "刚刚" });
  state.usageRecords = state.usageRecords.slice(0, 30);
  saveState();
}

function applyTheme() {
  document.body.className = "";
  if (state.theme.color !== "purple") document.body.classList.add(`theme-${state.theme.color}`);
  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  if (state.theme.mode === "dark" || (state.theme.mode === "system" && prefersDark)) {
    document.body.classList.add("dark-mode");
  }
  const size = state.theme.font === "large" ? "15px" : state.theme.font === "xlarge" ? "16px" : "14px";
  document.documentElement.style.setProperty("--base-font-size", size);
}

function stopMedia() {
  if (activeStream) {
    activeStream.getTracks().forEach((track) => track.stop());
    activeStream = null;
  }
}

function go(page, tab = state.tab) {
  clearInterval(callTimer);
  clearInterval(videoTimer);
  clearInterval(breathTimer);
  stopMedia();
  state.page = page;
  state.tab = tab;
  saveState();
  render();
}

function render() {
  applyTheme();
  if (!state.user) {
    app.innerHTML = renderAuth();
    bindAuth();
    return;
  }

  app.innerHTML = `
    <section class="phone">
      <div class="status-bar"><span>9:41</span><span>●●● 5G ▰</span></div>
      ${renderCurrentPage()}
      ${renderBottomNav()}
    </section>
  `;
  bindActions();
  if (state.page === "chat") scrollChatToBottom();
}

function renderAuth() {
  const isRegister = state.authMode === "register";
  return `
    <section class="phone">
      <div class="auth">
        <div class="auth-card">
          <div class="auth-logo"><div class="mini-mascot"></div></div>
          <h1>暖暖陪伴</h1>
          <p>在焦虑、孤独或压力大的时刻，给你一个温柔的回应。</p>
          <form id="authForm">
            <label class="field"><span>用户名</span><input id="username" autocomplete="username" placeholder="请输入用户名" /></label>
            <label class="field"><span>密码</span><input id="password" type="password" autocomplete="current-password" placeholder="请输入密码" /></label>
            ${isRegister ? `<label class="field"><span>确认密码</span><input id="confirmPassword" type="password" placeholder="请再次输入密码" /></label>` : ""}
            <div class="auth-actions">
              <button class="primary-btn" type="submit">${isRegister ? "注册并进入" : "登录"}</button>
              <button class="secondary-btn" id="switchAuth" type="button">${isRegister ? "已有账号，去登录" : "注册账号"}</button>
              <button class="ghost-btn" id="demoLogin" type="button">使用演示身份体验</button>
            </div>
          </form>
        </div>
      </div>
    </section>
  `;
}

function renderCurrentPage() {
  const page = state.page;
  if (page === "chat") return renderChat();
  if (page === "analysis") return renderAnalysis();
  if (page === "call") return renderCall();
  if (page === "videoCall") return renderVideoCall();
  if (page === "imageShare") return renderImageShare();
  if (page === "resonancePublish") return renderPublish();
  if (page === "resonanceBrowse") return renderResonanceBrowse();
  if (page.startsWith("resonanceDetail:")) return renderResonanceDetail(page.split(":")[1]);
  if (page === "woodfish") return renderWoodfish();
  if (page === "bubbles") return renderBubbles();
  if (page === "shredder") return renderShredder();
  if (page === "doodle") return renderDoodle();
  if (page === "breathing") return renderBreathing();
  if (page === "moreGames") return renderMoreGames();
  if (page === "journal") return renderJournal();
  if (page === "favorites") return renderFavorites();
  if (page === "usage") return renderUsage();
  if (page === "report") return renderReport();
  if (page === "help") return renderHelp();
  if (page === "privacy") return renderPrivacy();
  if (page === "theme") return renderTheme();
  if (page === "about") return renderAbout();
  if (page.startsWith("policy:")) return renderPolicy(page.split(":")[1]);
  if (state.tab === "resonance") return renderResonanceHome();
  if (state.tab === "relief") return renderReliefHome();
  if (state.tab === "mine") return renderMine();
  return renderHome();
}

function renderBottomNav() {
  const hiddenPages = [
    "chat", "analysis", "call", "videoCall", "imageShare", "resonancePublish",
    "woodfish", "bubbles", "shredder", "doodle", "breathing", "moreGames",
    "journal", "favorites", "usage", "report", "help", "privacy", "theme", "about",
  ];
  const hidden = hiddenPages.includes(state.page) || state.page.startsWith("resonanceDetail:") || state.page.startsWith("policy:");
  if (hidden) return "";
  const tabs = [
    ["companion", "home", "☁", "陪伴"],
    ["resonance", "resonanceHome", "♥", "共鸣"],
    ["relief", "reliefHome", "⌂", "泄压舱"],
    ["mine", "mineHome", "♙", "我的"],
  ];
  return `
    <nav class="bottom-nav">
      ${tabs.map(([tab, page, icon, label]) => `<button class="${state.tab === tab ? "active" : ""}" data-go="${page}" data-tab="${tab}" type="button"><b>${icon}</b>${label}</button>`).join("")}
    </nav>
  `;
}

function pageHead(title, sub = "", back = "home", more = "更多功能正在整理中") {
  return `
    <header class="page-head">
      <button class="back-btn" data-go="${back}" type="button">‹</button>
      <div><h2>${title}</h2>${sub ? `<p>${sub}</p>` : ""}</div>
      <button class="icon-btn" type="button" data-toast="${more}">⋯</button>
    </header>
  `;
}

function mascot() {
  return `
    <div class="mascot">
      <div class="ear left"></div><div class="ear right"></div>
      <div class="mascot-body"></div>
      <div class="mascot-face"></div>
    </div>
  `;
}

function renderHome() {
  return `
    <section class="screen">
      <header class="topbar">
        <button class="icon-btn" data-go="analysis" type="button">♡</button>
        <button class="scene-switch" data-toast="已切换为云朵耳机形象" type="button">切换形象</button>
      </header>
      <div class="home-hero">
        <p class="eyebrow">晚上好，</p>
        <h1>我在这里陪着你</h1>
        <p class="memory-pill">记住：你的感受很重要</p>
        ${mascot()}
      </div>
      <form class="search-row" id="homeTalkForm">
        <input id="homeTalkInput" placeholder="想和我聊聊什么呢？" autocomplete="off" />
        <button class="send-btn" type="submit">⌁</button>
      </form>
      <div class="quick-grid">
        ${["最近有点焦虑...", "和朋友闹矛盾了", "压力好大，睡不着", "没什么，就是想聊聊"].map((text) => `<button data-quick="${text}" type="button">${text}</button>`).join("")}
      </div>
      <div class="mini-panel">
        <div><span>♡</span><p>今日陪伴</p><strong>${Math.max(26, state.chats.length * 3)} 分钟</strong></div>
        <div><span>✦</span><p>情绪温度</p><strong>柔和</strong></div>
      </div>
    </section>
  `;
}

function renderChat() {
  return `
    <section class="screen no-nav">
      ${pageHead("暖暖", "● 在线", "home")}
      <div class="chat-list" id="chatList">
        ${state.chats.map((msg) => `<article class="bubble-row ${msg.role}">${msg.role === "bot" ? `<span class="avatar">☁</span>` : ""}<p>${h(msg.text)}</p></article>`).join("")}
        ${state.chatLoading ? `<article class="typing"><span></span><span></span><span></span></article>` : ""}
      </div>
      <div class="chat-actions">
        <button data-go="call" type="button"><b>☎</b>语音通话</button>
        <button data-go="videoCall" type="button"><b>▣</b>视频通话</button>
        <button data-go="analysis" type="button"><b>☻</b>情绪识别</button>
        <button data-go="imageShare" type="button"><b>▧</b>图片分享</button>
      </div>
      <form class="chat-compose" id="chatForm">
        <input id="chatInput" placeholder="输入你想说的话..." autocomplete="off" />
        <button class="send-btn" type="submit">➤</button>
      </form>
    </section>
  `;
}

function renderAnalysis() {
  return `
    <section class="screen no-nav">
      ${pageHead("情绪分析", "", "chat")}
      <article class="analysis-card">
        <p>我感受到你现在可能：</p>
        <div class="heart">暖</div>
        <h3>焦虑 + 压力</h3>
        <p>强度 75%</p>
        <div class="meter"><span></span></div>
      </article>
      <div class="soft-card" style="margin-top:16px;padding:16px;">
        <strong>暖暖的回应</strong>
        <p style="color:var(--muted);line-height:1.7;">我理解你现在的感受。我们可以先不急着解决所有事，只把下一步变小一点。</p>
        <div class="response-list">
          ${["给你一个温暖的拥抱", "试着和你一起理清思路", "陪你一起做个深呼吸吧"].map((text) => `<button data-reply="${text}" type="button">${text}</button>`).join("")}
        </div>
      </div>
      <button class="primary-btn" style="margin-top:16px;" data-go="chat" type="button">换个话题聊聊</button>
    </section>
  `;
}

function renderCall() {
  setTimeout(startCallTimer, 0);
  return `
    <section class="night-screen">
      <header class="page-head"><button class="back-btn" data-go="chat" type="button">‹</button><div></div><button class="icon-btn" data-toast="通话设置" type="button">⋯</button></header>
      <div class="call-body">
        <div class="call-orb"><div class="mini-mascot"></div></div>
        <h1>暖暖</h1>
        <strong id="callTime">${formatTime(state.callSeconds)}</strong>
        <p class="call-copy">我在认真听你说。慢慢说，没关系的。</p>
      </div>
      <div class="call-controls">
        <button data-toast="已切换静音" type="button">静音</button>
        <button class="hangup" data-go="chat" type="button">挂断</button>
        <button data-toast="已切换语音" type="button">语音</button>
      </div>
    </section>
  `;
}

function renderVideoCall() {
  setTimeout(startVideoTimer, 0);
  return `
    <section class="night-screen video-call">
      <header class="page-head"><button class="back-btn" data-go="chat" type="button">‹</button><div></div><button class="icon-btn" data-toast="视频设置" type="button">⋯</button></header>
      <div class="video-layout">
        <div class="video-main">
          <div class="call-orb"><div class="mini-mascot"></div></div>
          <h1>暖暖</h1>
          <strong id="videoTime">${formatTime(state.videoSeconds)}</strong>
          <p>我会看着你，也会认真听你。</p>
        </div>
        <div class="video-self" id="videoSelf">
          <video id="localVideo" autoplay muted playsinline></video>
          <span>你的画面</span>
        </div>
      </div>
      <div class="call-controls">
        <button id="cameraToggle" type="button">摄像头</button>
        <button class="hangup" data-go="chat" type="button">挂断</button>
        <button data-toast="已切换麦克风" type="button">麦克风</button>
      </div>
    </section>
  `;
}

function renderImageShare() {
  return `
    <section class="screen no-nav">
      ${pageHead("图片分享", "把当下看到的画面分享给暖暖", "chat")}
      <label class="upload-card">
        <input id="imageInput" type="file" accept="image/*" />
        <strong>选择一张图片</strong>
        <span>支持本地预览，暖暖会给你一句温柔回应</span>
      </label>
      <div class="image-grid">
        ${state.sharedImages.length ? state.sharedImages.map((img, index) => `
          <article class="image-card">
            <img src="${img.src}" alt="${h(img.name)}" />
            <div><strong>${h(img.name)}</strong><p>${img.note}</p></div>
            <button data-remove-image="${index}" type="button">删除</button>
          </article>
        `).join("") : `<div class="soft-card empty-state">还没有分享图片。你可以先选一张照片试试。</div>`}
      </div>
    </section>
  `;
}

function startCallTimer() {
  clearInterval(callTimer);
  callTimer = setInterval(() => {
    state.callSeconds += 1;
    const node = document.querySelector("#callTime");
    if (node) node.textContent = formatTime(state.callSeconds);
    saveState();
  }, 1000);
}

function startVideoTimer() {
  clearInterval(videoTimer);
  videoTimer = setInterval(() => {
    state.videoSeconds += 1;
    const node = document.querySelector("#videoTime");
    if (node) node.textContent = formatTime(state.videoSeconds);
    saveState();
  }, 1000);
}

function formatTime(seconds) {
  const min = Math.floor(seconds / 60).toString().padStart(2, "0");
  const sec = (seconds % 60).toString().padStart(2, "0");
  return `${min}:${sec}`;
}

function visiblePosts(filter = "全部") {
  return state.posts
    .filter((post) => !post.private || post.owner === state.user)
    .filter((post) => filter === "全部" || post.tag === filter);
}

function renderPostCard(post) {
  return `
    <article class="post-card" data-detail="${post.id}">
      <div class="post-head"><span class="avatar">●</span><div><strong>匿名用户</strong><small>${post.time}</small></div></div>
      <h3>${h(post.text)}</h3>
      <p>#${post.tag} · ${post.mood}</p>
      <div class="post-foot">
        <button class="like-btn" data-favorite="${post.id}" type="button">${post.favorite ? "★ 已收藏" : "☆ 收藏"}</button>
        <button class="like-btn" data-like="${post.id}" type="button">♥ ${post.likes}</button>
      </div>
    </article>
  `;
}

function renderResonanceHome() {
  const posts = visiblePosts().slice(0, 2);
  return `
    <section class="screen">
      <header class="page-head"><div><h2>心情共鸣</h2><p>此刻的你，不是一个人</p></div><button class="small-pill" data-go="resonanceBrowse" type="button">全部</button></header>
      <article class="resonance-hero"><p>今日心情共鸣</p><strong>${state.posts.reduce((n, p) => n + p.resonance, 0).toLocaleString()}</strong><span>人正在跟相似感受轻轻相遇</span></article>
      <button class="primary-btn" style="margin-top:14px;" data-go="resonancePublish" type="button">发布此刻心情</button>
      <div class="tabs">${["全部", "难过", "焦虑", "迷茫", "开心"].map((tag) => `<button data-browse="${tag}" type="button">${tag}</button>`).join("")}</div>
      <div class="post-list resonance-home-list">${posts.map(renderPostCard).join("")}</div>
    </section>
  `;
}

function renderResonanceBrowse(filter = state.filter || "全部") {
  const posts = visiblePosts(filter);
  return `
    <section class="screen no-nav resonance-browse-screen">
      ${pageHead("共鸣浏览", "", "resonanceHome")}
      <div class="tabs">${["全部", "难过", "焦虑", "迷茫", "开心"].map((tag) => `<button class="${filter === tag ? "selected" : ""}" data-browse="${tag}" type="button">${tag}</button>`).join("")}</div>
      <div class="post-list light-post-list">${posts.length ? posts.map(renderPostCard).join("") : `<div class="soft-card empty-state">还没有这类心情，先发布一条吧。</div>`}</div>
    </section>
  `;
}

function renderPublish() {
  return `
    <section class="screen no-nav">
      <div class="publish-actions"><button class="ghost-btn" data-go="resonanceHome" type="button">取消</button><strong>发布心情</strong><button class="secondary-btn" id="submitPost" type="button">发布</button></div>
      <label class="field"><textarea id="postText" placeholder="此刻的你，想说些什么呢？"></textarea></label>
      <p style="color:var(--muted);font-weight:800;">此刻心情标签</p>
      <div class="tag-row">${["压力", "难过", "迷茫", "开心", "其他"].map((tag) => `<button class="${selectedPublishTag === tag ? "selected" : ""}" data-publish-tag="${tag}" type="button">#${tag}</button>`).join("")}</div>
      <p style="color:var(--muted);font-weight:800;">此刻心情是...</p>
      <div class="emoji-row">${["难过", "焦虑", "平静", "开心", "愤怒"].map((mood) => `<button class="${selectedPublishMood === mood ? "selected" : ""}" data-publish-mood="${mood}" type="button"><b>${moodIcon(mood)}</b>${mood}</button>`).join("")}</div>
      <div class="switch-row"><div><strong>仅自己可见</strong><p style="margin:4px 0 0;color:var(--muted);font-size:12px;">开启后，只有你自己能看到这条心情</p></div><button class="switch" id="privateSwitch" type="button"><i></i></button></div>
    </section>
  `;
}

function moodIcon(mood) {
  return { 难过: "☔", 焦虑: "◔", 平静: "◡", 开心: "☀", 愤怒: "!" }[mood] || "·";
}

function renderResonanceDetail(id) {
  const post = state.posts.find((item) => item.id === id) || state.posts[0];
  const colors = ["#c5b9ff", "#9ce7d9", "#ffc6a8", "#ff9ab5", "#bfc9ff", "#ffd28f", "#d7b8ff", "#ace7ff", "#ffd5e6", "#c4f1cb"];
  return `
    <section class="night-screen">
      <header class="page-head"><button class="back-btn" data-go="resonanceBrowse" type="button">‹</button><div></div><button class="icon-btn" data-toast="更多共鸣操作" type="button">⋯</button></header>
      <article class="post-card" style="background:transparent;box-shadow:none;min-height:auto;padding:20px 0 0;">
        <div class="post-head"><span class="avatar">●</span><div><strong>匿名用户</strong><small>${post.time}</small></div></div>
        <h3>${h(post.text)}</h3>
      </article>
      <div class="detail-panel">
        <strong>${post.resonance.toLocaleString()} 人与你产生共鸣</strong>
        <div class="resonance-dots">${colors.map((c) => `<span style="--dot:${c}"></span>`).join("")}</div>
        <p style="color:var(--muted);line-height:1.7;">共鸣的人也有同样的感受，但我们都在慢慢变好。</p>
        <button class="primary-btn" data-like="${post.id}" type="button">♥ 我也有同感 · ${post.likes}</button>
        <button class="secondary-btn" style="width:100%;margin-top:10px;" data-favorite="${post.id}" type="button">${post.favorite ? "取消收藏" : "收藏这份共鸣"}</button>
      </div>
    </section>
  `;
}

function renderReliefHome() {
  const cards = [
    ["wood", "敲敲木鱼", "敲走负担，静心放松", "woodfish"],
    ["bubble", "解压泡泡", "轻轻戳破，释放压力", "bubbles"],
    ["shred", "情绪粉碎机", "把坏心情暂存再粉碎", "shredder"],
    ["wood", "涂鸦画板", "随心涂鸦，释放情绪", "doodle"],
    ["breathe", "深呼吸练习", "跟随节奏，稳定呼吸", "breathing"],
    ["bubble", "更多玩法", "更多减压玩法合集", "moreGames"],
  ];
  return `
    <section class="screen">
      <header class="page-head"><div><h2>泄压舱</h2><p>选择你的专属泄压方式</p></div></header>
      <div class="relief-grid">${cards.map(([cls, title, sub, page]) => `<button class="relief-card ${cls}" data-relief="${page}" type="button"><strong>${title}</strong><span>${sub}</span></button>`).join("")}</div>
    </section>
  `;
}

function renderWoodfish() {
  return `
    <section class="screen no-nav wood-page">
      ${pageHead("敲敲木鱼", "敲一下，放下一点点", "reliefHome")}
      <div class="woodfish-wrap">
        <button class="woodfish" id="woodfish" type="button"><span></span></button>
        <strong id="woodCount">${state.woodCount}</strong>
        <p>今日功德 +${state.woodCount}</p>
      </div>
      <div class="soft-card mantra-card">
        <strong>此刻提醒</strong>
        <p>允许事情慢一点，也允许自己先喘口气。</p>
      </div>
    </section>
  `;
}

function renderBubbles() {
  const bubbles = Array.from({ length: 13 }, (_, i) => {
    const size = [46, 68, 96, 124, 58, 82][i % 6];
    const left = [8, 42, 67, 18, 72, 50, 28, 80, 12, 58, 35, 70, 22][i];
    const top = [18, 22, 34, 48, 60, 68, 32, 76, 72, 14, 82, 52, 88][i];
    return `<button class="bubble-dot" data-pop style="width:${size}px;height:${size}px;left:${left}%;top:${top}%;animation-delay:${i * 90}ms" type="button"></button>`;
  }).join("");
  return `
    <section class="bubble-stage">
      <header class="page-head"><button class="back-btn" data-go="reliefHome" type="button">‹</button><h2>解压泡泡</h2><button class="icon-btn" data-toast="背景音乐已切换" type="button">♪</button></header>
      ${bubbles}
      <div class="bubble-count">已戳破 ${state.bubbleCount} 个泡泡</div>
    </section>
  `;
}

function renderShredder() {
  return `
    <section class="screen no-nav">
      ${pageHead("情绪粉碎机", "", "reliefHome")}
      <div class="machine-box" id="machineBox"><div class="machine-screen">把烦恼放进来<br />一键粉碎吧！</div></div>
      <label class="field"><textarea id="worryText" style="min-height:90px;" placeholder="写下一个想丢掉的烦恼"></textarea></label>
      <button class="primary-btn" id="shredButton" type="button">粉碎烦恼</button>
      <strong style="display:block;margin-top:18px;">最近粉碎记录</strong>
      <ul class="record-list">${state.shredLogs.slice(0, 5).map((item, index) => `<li><span>${h(item)}</span><small>${index === 0 ? "刚刚" : `${index * 10}分钟前`}</small></li>`).join("")}</ul>
    </section>
  `;
}

function renderDoodle() {
  return `
    <section class="screen no-nav">
      ${pageHead("涂鸦画板", "不用画得漂亮，随心就好", "reliefHome")}
      <canvas id="doodleCanvas" class="doodle-canvas" width="320" height="430"></canvas>
      <div class="doodle-tools">
        ${["#8066f4", "#ff8aae", "#4d9dea", "#4fc5a9", "#ff9a4a", "#17172a"].map((color) => `<button class="color-dot ${state.doodleColor === color ? "selected" : ""}" style="--c:${color}" data-doodle-color="${color}" type="button"></button>`).join("")}
        <button class="secondary-btn" id="clearDoodle" type="button">清空</button>
        <button class="primary-btn" id="saveDoodle" type="button">保存心情</button>
      </div>
    </section>
  `;
}

function renderBreathing() {
  const steps = [["吸气", "4秒"], ["屏住", "2秒"], ["呼气", "6秒"], ["放松", "2秒"]];
  const [label, count] = steps[state.breath.step % steps.length];
  setTimeout(startBreathIfNeeded, 0);
  return `
    <section class="screen no-nav">
      ${pageHead("深呼吸练习", "", "reliefHome")}
      <article class="breath-card">
        <div class="breath-ring ${state.breath.running ? "running" : ""}"><span id="breathLabel">${label}</span><small id="breathCount">${count}</small></div>
        <p>跟着节奏，慢慢呼吸</p>
        <p id="breathRound">${state.breath.round}/6 轮</p>
        <button class="primary-btn" id="breathToggle" type="button">${state.breath.running ? "结束练习" : "开始练习"}</button>
      </article>
    </section>
  `;
}

function renderMoreGames() {
  const games = [
    ["正念倒计时", "给自己 60 秒，什么都不用做。", "mindful"],
    ["情绪天气瓶", "选一个颜色，把今天装进瓶子。", "weather"],
    ["幸运星星", "点亮一颗星，送给今天的自己。", "star"],
  ];
  return `
    <section class="screen no-nav">
      ${pageHead("更多玩法", "轻量减压小工具合集", "reliefHome")}
      <div class="game-list">
        ${games.map(([title, sub, key]) => `<button class="game-card" data-mini-game="${key}" type="button"><strong>${title}</strong><span>${sub}</span></button>`).join("")}
      </div>
      <div class="soft-card mantra-card">
        <strong>今日轻练习</strong>
        <p>找一个舒服的姿势，给自己一句话：我可以先照顾好现在的自己。</p>
      </div>
    </section>
  `;
}

function startBreathIfNeeded() {
  if (!state.breath.running) return;
  clearInterval(breathTimer);
  breathTimer = setInterval(() => {
    state.breath.step += 1;
    if (state.breath.step % 4 === 0) state.breath.round += 1;
    if (state.breath.round > 6) {
      state.breath = { running: false, step: 0, round: 1 };
      showToast("练习完成，辛苦啦");
      recordUsage("深呼吸练习", "完成 6 轮呼吸练习");
      render();
      return;
    }
    saveState();
    render();
  }, 1600);
}

function renderMine() {
  const user = state.users[state.user] || { nickname: "小星星" };
  return `
    <section class="screen">
      <header class="profile-head"><div class="profile-avatar"><div class="mini-mascot"></div></div><div><h2>${h(user.nickname || state.user)}</h2><p>ID: 12345678 · 小包容守护中</p></div></header>
      <article class="journal-card"><div><span>心情日记</span><strong>今天最好的自己</strong></div><button data-go="journal" type="button">去记录</button></article>
      <div class="settings-list">
        <button data-go="favorites" type="button"><span>☆</span>我的收藏<i>›</i></button>
        <button data-go="usage" type="button"><span>▤</span>使用记录<i>›</i></button>
        <button data-go="report" type="button"><span>☑</span>心情报告<i>›</i></button>
        <button data-go="help" type="button"><span>?</span>帮助与反馈<i>›</i></button>
        <button data-go="privacy" type="button"><span>◌</span>隐私设置<i>›</i></button>
        <button data-go="theme" type="button"><span>✦</span>主题设置<i>›</i></button>
        <button data-go="about" type="button"><span>ⓘ</span>关于我们<i>›</i></button>
        <button id="logout" type="button"><span>↩</span>退出登录<i>›</i></button>
      </div>
    </section>
  `;
}

function renderJournal() {
  return `
    <section class="screen no-nav">
      ${pageHead("心情日记", "把今天轻轻放下来", "mineHome")}
      <label class="field"><span>今天的心情</span><input id="journalMood" placeholder="例如：平静、焦虑、开心" /></label>
      <label class="field"><span>想记录的话</span><textarea id="journalText" placeholder="今天发生了什么？你想对自己说什么？"></textarea></label>
      <button class="primary-btn" id="saveJournal" type="button">保存日记</button>
      <div class="record-list journal-list">
        ${state.journalEntries.map((entry) => `<li><span><strong>${entry.date} · ${h(entry.mood)}</strong><br />${h(entry.text)}</span><small>日记</small></li>`).join("")}
      </div>
    </section>
  `;
}

function renderFavorites() {
  const favorites = state.posts.filter((post) => post.favorite);
  return `
    <section class="screen no-nav">
      ${pageHead("我的收藏", "收藏过的共鸣与陪伴片段", "mineHome")}
      <div class="post-list">${favorites.length ? favorites.map(renderPostCard).join("") : `<div class="soft-card empty-state">还没有收藏。遇到有共鸣的心情，可以点一下收藏。</div>`}</div>
    </section>
  `;
}

function renderUsage() {
  return `
    <section class="screen no-nav">
      ${pageHead("使用记录", "你的陪伴和练习足迹", "mineHome")}
      <ul class="record-list">
        ${state.usageRecords.map((item) => `<li><span><strong>${item.type}</strong><br />${h(item.detail)}</span><small>${item.time}</small></li>`).join("")}
      </ul>
    </section>
  `;
}

function renderReport() {
  const moodCounts = state.posts.concat(state.journalEntries.map((entry) => ({ mood: entry.mood }))).reduce((acc, item) => {
    const mood = item.mood || "平静";
    acc[mood] = (acc[mood] || 0) + 1;
    return acc;
  }, {});
  const topMood = Object.entries(moodCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "平静";
  const totalRelief = state.bubbleCount + state.woodCount + state.shredLogs.length;
  return `
    <section class="screen no-nav">
      ${pageHead("心情报告", "近期情绪与陪伴概览", "mineHome")}
      <div class="report-grid">
        <article><strong>${topMood}</strong><span>高频心情</span></article>
        <article><strong>${state.chats.length}</strong><span>陪伴消息</span></article>
        <article><strong>${state.journalEntries.length}</strong><span>日记记录</span></article>
        <article><strong>${totalRelief}</strong><span>泄压互动</span></article>
      </div>
      <div class="soft-card mantra-card">
        <strong>暖暖建议</strong>
        <p>你已经在认真照顾自己了。接下来可以保持每天一次简短记录，再搭配一次 6 轮呼吸练习。</p>
      </div>
      <div class="mood-bars">
        ${Object.entries(moodCounts).map(([mood, count]) => `<div><span>${h(mood)}</span><i style="width:${Math.min(100, count * 28)}%"></i><b>${count}</b></div>`).join("")}
      </div>
    </section>
  `;
}

function renderHelp() {
  return `
    <section class="screen no-nav">
      ${pageHead("帮助与反馈", "遇到问题可以告诉我们", "mineHome")}
      <div class="setting-card">
        ${[
          ["暖暖是真人吗？", "暖暖是 AI 情绪陪伴助手，适合日常倾听和轻量安抚。"],
          ["匿名共鸣安全吗？", "共鸣区默认匿名展示，不展示真实昵称和头像。"],
          ["情绪很严重怎么办？", "如果你有伤害自己或他人的想法，请立刻联系身边可信任的人或当地紧急援助。"],
        ].map(([q, a]) => `<article class="faq-item"><strong>${q}</strong><p>${a}</p></article>`).join("")}
      </div>
      <label class="field"><span>反馈内容</span><textarea id="feedbackText" style="min-height:120px;" placeholder="告诉我们你遇到的问题或建议"></textarea></label>
      <button class="primary-btn" id="submitFeedback" type="button">提交反馈</button>
      <ul class="record-list">${state.feedback.map((item) => `<li><span>${h(item.text)}</span><small>${item.time}</small></li>`).join("")}</ul>
    </section>
  `;
}

function renderPrivacy() {
  const rows = [
    ["anonymous", "匿名模式", "开启后，隐藏你的个人信息"],
    ["randomHistory", "随机使用记录", "开启后，弱化真实使用轨迹"],
    ["noRecommend", "不被推荐", "你的内容不被推荐给他人"],
  ];
  return `
    <section class="screen no-nav">
      ${pageHead("隐私设置", "", "mineHome")}
      <div class="setting-card">
        ${rows.map(([key, title, sub]) => `<div class="setting-row"><div><strong>${title}</strong><small>${sub}</small></div><button class="switch ${state.privacy[key] ? "on" : ""}" data-privacy="${key}" type="button"><i></i></button></div>`).join("")}
      </div>
      <div class="setting-card">
        <button class="settings-list-button secondary-btn" data-toast="已进入隐私密码设置流程" type="button">设置隐私密码</button>
        <button class="settings-list-button secondary-btn" data-toast="已进入修改密码流程" type="button">修改密码</button>
      </div>
    </section>
  `;
}

function renderTheme() {
  const colors = [["purple", "#8066f4"], ["pink", "#fb7ea7"], ["blue", "#4d9dea"], ["green", "#4fc5a9"], ["orange", "#ff9a4a"]];
  return `
    <section class="screen no-nav">
      ${pageHead("主题设置", "", "mineHome")}
      <div class="setting-card"><strong>主题颜色</strong><div class="color-row">${colors.map(([name, c]) => `<button class="color-dot ${state.theme.color === name ? "selected" : ""}" style="--c:${c}" data-theme-color="${name}" type="button"></button>`).join("")}</div></div>
      <div class="setting-card"><strong>界面模式</strong><div class="mode-row">${[["system", "跟随系统"], ["light", "浅色模式"], ["dark", "深色模式"]].map(([mode, label]) => `<button class="${state.theme.mode === mode ? "selected" : ""}" data-theme-mode="${mode}" type="button">${label}</button>`).join("")}</div></div>
      <div class="setting-card"><strong>字体大小</strong><div class="mode-row">${[["normal", "标准"], ["large", "大"], ["xlarge", "超大"]].map(([font, label]) => `<button class="${state.theme.font === font ? "selected" : ""}" data-theme-font="${font}" type="button">${label}</button>`).join("")}</div></div>
    </section>
  `;
}

function renderAbout() {
  return `
    <section class="screen no-nav">
      ${pageHead("关于我们", "", "mineHome")}
      <div class="about-logo"><div class="auth-logo"><div class="mini-mascot"></div></div><h2>暖暖陪伴</h2><p>版本 1.0.0</p><p>温柔陪伴，是我们做的第一件小事。</p></div>
      <div class="settings-list">
        <button data-go="policy:terms" type="button"><span>·</span>用户协议<i>›</i></button>
        <button data-go="policy:privacy" type="button"><span>·</span>隐私政策<i>›</i></button>
        <button data-go="policy:children" type="button"><span>·</span>儿童隐私保护政策<i>›</i></button>
        <button data-go="policy:contact" type="button"><span>·</span>联系我们<i>›</i></button>
      </div>
      <p style="text-align:center;color:var(--muted);margin-top:28px;font-size:12px;">© 2024 暖暖陪伴. All Rights Reserved.</p>
    </section>
  `;
}

function renderPolicy(type) {
  const docs = {
    terms: {
      title: "用户协议",
      intro: "欢迎使用暖暖陪伴。你可以在这里进行 AI 陪伴聊天、匿名心情共鸣、泄压练习和心情记录。",
      items: ["请用友善、合法的方式使用本产品。", "AI 回应仅用于日常情绪陪伴，不替代专业心理咨询或医疗建议。", "你发布的匿名内容应避免包含可识别个人身份的信息。"],
    },
    privacy: {
      title: "隐私政策",
      intro: "我们重视你的隐私。本 H5 原型默认将账号、心情、收藏和设置保存在浏览器本地。",
      items: ["不会在本原型中向远端服务器上传你的数据。", "图片分享仅用于本地预览，不会自动发送给第三方。", "你可以通过浏览器清理站点数据来删除本地记录。"],
    },
    children: {
      title: "儿童隐私保护政策",
      intro: "如未成年人使用本产品，应在监护人知情和指导下进行。",
      items: ["请不要提交真实姓名、学校、住址、电话等敏感信息。", "监护人可以协助查看和清理本地记录。", "若出现严重情绪困扰，请及时寻求监护人或专业人员帮助。"],
    },
    contact: {
      title: "联系我们",
      intro: "如果你有问题、建议或合作意向，可以通过以下方式联系暖暖团队。",
      items: ["邮箱：support@nuannuan.example", "工作时间：周一至周五 10:00-18:00", "紧急风险：请优先联系当地紧急救援或可信任的人。"],
    },
  };
  const doc = docs[type] || docs.terms;
  return `
    <section class="screen no-nav">
      ${pageHead(doc.title, "", "about")}
      <article class="policy-card">
        <p>${doc.intro}</p>
        ${doc.items.map((item) => `<section><strong>${item.split("：")[0]}</strong><p>${item}</p></section>`).join("")}
      </article>
    </section>
  `;
}

function bindAuth() {
  document.querySelector("#switchAuth").addEventListener("click", () => {
    state.authMode = state.authMode === "register" ? "login" : "register";
    render();
  });
  document.querySelector("#demoLogin").addEventListener("click", () => {
    state.users.demo = { password: "demo", nickname: "小星星" };
    state.user = "demo";
    state.authMode = "login";
    recordUsage("登录", "使用演示身份进入应用");
    render();
  });
  document.querySelector("#authForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const username = document.querySelector("#username").value.trim();
    const password = document.querySelector("#password").value;
    if (!username || !password) return showToast("请输入用户名和密码");
    if (state.authMode === "register") {
      const confirm = document.querySelector("#confirmPassword").value;
      if (state.users[username]) return showToast("用户名已存在，请更换");
      if (password !== confirm) return showToast("两次密码不一致");
      state.users[username] = { password, nickname: username };
      state.user = username;
      showToast("注册成功，已自动登录");
      recordUsage("注册", "创建账号并进入应用");
    } else {
      if (!state.users[username] || state.users[username].password !== password) return showToast("用户名或密码错误");
      state.user = username;
      showToast("欢迎回来");
      recordUsage("登录", "账号密码登录");
    }
    saveState();
    render();
  });
}

function bindActions() {
  document.querySelectorAll("[data-go]").forEach((node) => {
    node.addEventListener("click", () => {
      const tab = node.dataset.tab || inferTab(node.dataset.go);
      go(node.dataset.go, tab);
    });
  });

  document.querySelectorAll("[data-toast]").forEach((node) => node.addEventListener("click", () => showToast(node.dataset.toast)));
  document.querySelectorAll("[data-quick]").forEach((node) => node.addEventListener("click", () => sendChat(node.dataset.quick)));

  const homeForm = document.querySelector("#homeTalkForm");
  if (homeForm) {
    homeForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const text = document.querySelector("#homeTalkInput").value.trim() || "我想和你聊聊";
      sendChat(text);
    });
  }

  const chatForm = document.querySelector("#chatForm");
  if (chatForm) {
    chatForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const input = document.querySelector("#chatInput");
      const text = input.value.trim();
      if (!text) return;
      input.value = "";
      sendChat(text);
    });
  }

  document.querySelectorAll("[data-reply]").forEach((node) => node.addEventListener("click", () => sendChat(node.dataset.reply)));
  document.querySelectorAll("[data-browse]").forEach((node) => node.addEventListener("click", () => {
    state.filter = node.dataset.browse;
    go("resonanceBrowse", "resonance");
  }));
  document.querySelectorAll("[data-detail]").forEach((node) => node.addEventListener("click", (event) => {
    if (event.target.closest("[data-like]") || event.target.closest("[data-favorite]")) return;
    go(`resonanceDetail:${node.dataset.detail}`, "resonance");
  }));
  document.querySelectorAll("[data-like]").forEach((node) => node.addEventListener("click", () => likePost(node.dataset.like)));
  document.querySelectorAll("[data-favorite]").forEach((node) => node.addEventListener("click", () => favoritePost(node.dataset.favorite)));
  document.querySelectorAll("[data-publish-tag]").forEach((node) => node.addEventListener("click", () => {
    selectedPublishTag = node.dataset.publishTag;
    render();
  }));
  document.querySelectorAll("[data-publish-mood]").forEach((node) => node.addEventListener("click", () => {
    selectedPublishMood = node.dataset.publishMood;
    render();
  }));

  const privateSwitch = document.querySelector("#privateSwitch");
  if (privateSwitch) privateSwitch.addEventListener("click", () => privateSwitch.classList.toggle("on"));
  const submitPost = document.querySelector("#submitPost");
  if (submitPost) submitPost.addEventListener("click", publishPost);

  document.querySelectorAll("[data-relief]").forEach((node) => node.addEventListener("click", () => go(node.dataset.relief, "relief")));
  document.querySelectorAll("[data-pop]").forEach((node) => node.addEventListener("click", () => {
    node.classList.add("popped");
    state.bubbleCount += 1;
    recordUsage("解压泡泡", "戳破一个泡泡");
    const label = document.querySelector(".bubble-count");
    if (label) label.textContent = `已戳破 ${state.bubbleCount} 个泡泡`;
  }));

  const woodfish = document.querySelector("#woodfish");
  if (woodfish) woodfish.addEventListener("click", knockWoodfish);
  const shredButton = document.querySelector("#shredButton");
  if (shredButton) shredButton.addEventListener("click", shredWorry);
  const breathToggle = document.querySelector("#breathToggle");
  if (breathToggle) breathToggle.addEventListener("click", () => {
    state.breath.running = !state.breath.running;
    if (!state.breath.running) state.breath = { running: false, step: 0, round: 1 };
    saveState();
    render();
  });
  const imageInput = document.querySelector("#imageInput");
  if (imageInput) imageInput.addEventListener("change", handleImageShare);
  document.querySelectorAll("[data-remove-image]").forEach((node) => node.addEventListener("click", () => {
    state.sharedImages.splice(Number(node.dataset.removeImage), 1);
    saveState();
    render();
  }));
  const cameraToggle = document.querySelector("#cameraToggle");
  if (cameraToggle) cameraToggle.addEventListener("click", startCamera);
  initDoodle();
  const clearDoodle = document.querySelector("#clearDoodle");
  if (clearDoodle) clearDoodle.addEventListener("click", clearDoodleCanvas);
  const saveDoodle = document.querySelector("#saveDoodle");
  if (saveDoodle) saveDoodle.addEventListener("click", () => {
    recordUsage("涂鸦画板", "保存了一次心情涂鸦");
    showToast("这份涂鸦心情已经记下");
  });
  document.querySelectorAll("[data-doodle-color]").forEach((node) => node.addEventListener("click", () => {
    state.doodleColor = node.dataset.doodleColor;
    saveState();
    render();
  }));
  document.querySelectorAll("[data-mini-game]").forEach((node) => node.addEventListener("click", () => playMiniGame(node.dataset.miniGame)));

  const saveJournal = document.querySelector("#saveJournal");
  if (saveJournal) saveJournal.addEventListener("click", saveJournalEntry);
  const submitFeedback = document.querySelector("#submitFeedback");
  if (submitFeedback) submitFeedback.addEventListener("click", submitFeedbackForm);

  document.querySelectorAll("[data-privacy]").forEach((node) => node.addEventListener("click", () => {
    state.privacy[node.dataset.privacy] = !state.privacy[node.dataset.privacy];
    recordUsage("隐私设置", `切换${node.dataset.privacy}`);
    render();
  }));
  document.querySelectorAll("[data-theme-color]").forEach((node) => node.addEventListener("click", () => {
    state.theme.color = node.dataset.themeColor;
    recordUsage("主题设置", `切换主题色为 ${node.dataset.themeColor}`);
    render();
  }));
  document.querySelectorAll("[data-theme-mode]").forEach((node) => node.addEventListener("click", () => {
    state.theme.mode = node.dataset.themeMode;
    saveState();
    render();
  }));
  document.querySelectorAll("[data-theme-font]").forEach((node) => node.addEventListener("click", () => {
    state.theme.font = node.dataset.themeFont;
    saveState();
    render();
  }));
  const logout = document.querySelector("#logout");
  if (logout) logout.addEventListener("click", () => {
    state.user = null;
    saveState();
    render();
  });
}

function inferTab(page) {
  if (page.startsWith("resonance")) return "resonance";
  if (["reliefHome", "woodfish", "bubbles", "shredder", "doodle", "breathing", "moreGames"].includes(page)) return "relief";
  if (["mineHome", "journal", "favorites", "usage", "report", "help", "privacy", "theme", "about"].includes(page) || page.startsWith("policy:")) return "mine";
  return "companion";
}

function sendChat(text) {
  state.chats.push({ role: "user", text });
  state.chatLoading = true;
  recordUsage("AI 陪伴", `发送消息：${text.slice(0, 16)}`);
  saveState();
  state.page = "chat";
  state.tab = "companion";
  render();
  scrollChatToBottom();
  requestDeepSeekReply(text);
}

async function requestDeepSeekReply(text) {
  let shouldRenderOnFinish = false;
  try {
    const endpoint = window.location.protocol === "file:" ? "http://localhost:4173/api/chat" : "/api/chat";
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: text,
        history: state.chats.slice(-12).map((item) => ({
          role: item.role === "bot" ? "assistant" : "user",
          content: item.text,
        })),
      }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data?.error || "DeepSeek request failed");
    }

    state.chatLoading = false;
    state.chats.push({ role: "bot", text: "" });
    const botIndex = state.chats.length - 1;
    saveState();
    if (state.page === "chat") render();
    let botBubble = getLastBotBubble();

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      if (!chunk) continue;
      state.chats[botIndex].text += chunk;
      if (state.page === "chat") {
        botBubble ||= getLastBotBubble();
        if (botBubble) {
          botBubble.textContent = state.chats[botIndex].text;
        }
        scrollChatToBottom();
      }
    }

    if (!state.chats[botIndex].text.trim()) {
      state.chats[botIndex].text = aiReply(text);
      if (state.page === "chat") {
        botBubble ||= getLastBotBubble();
        if (botBubble) botBubble.textContent = state.chats[botIndex].text;
      }
    }
  } catch (error) {
    state.chats.push({ role: "bot", text: `${aiReply(text)}\n\n（DeepSeek 暂时连接不上，我先用本地安抚回复陪你一下。）` });
    shouldRenderOnFinish = true;
    showToast("DeepSeek 暂时连接失败，已使用本地回复");
  } finally {
    state.chatLoading = false;
    saveState();
    if (state.page === "chat") {
      if (shouldRenderOnFinish) render();
      scrollChatToBottom();
    }
  }
}

function getLastBotBubble() {
  const bubbles = document.querySelectorAll(".bubble-row.bot p");
  return bubbles[bubbles.length - 1] || null;
}

function scrollChatToBottom() {
  window.setTimeout(() => {
    const screen = document.querySelector(".screen");
    const chatList = document.querySelector("#chatList");
    if (chatList) chatList.scrollTop = chatList.scrollHeight;
    if (screen) screen.scrollTop = screen.scrollHeight;
  }, 0);
}

function aiReply(text) {
  if (/焦虑|压力|睡不着/.test(text)) return "我听见你正在承受压力。我们先一起慢慢呼吸，再把最困扰你的那件事拆成一小步。";
  if (/朋友|矛盾|吵/.test(text)) return "关系里的拉扯会很消耗人。你愿意的话，我们可以一起复盘发生了什么，也照顾一下你的委屈。";
  if (/开心|好/.test(text)) return "真好呀，这份轻盈值得被好好记住。要不要把它存进今天的心情里？";
  return "我在这里。你可以不用组织得很完整，想到哪里说到哪里就好。";
}

function likePost(id) {
  const post = state.posts.find((item) => item.id === id);
  if (!post) return;
  if (state.liked[id]) return showToast("你已经点过赞啦");
  post.likes += 1;
  post.resonance += 1;
  state.liked[id] = true;
  recordUsage("心情共鸣", "点赞了一条匿名心情");
  showToast("已收到你的共鸣");
  render();
}

function favoritePost(id) {
  const post = state.posts.find((item) => item.id === id);
  if (!post) return;
  post.favorite = !post.favorite;
  recordUsage("我的收藏", post.favorite ? "收藏了一条匿名心情" : "取消收藏了一条匿名心情");
  showToast(post.favorite ? "已加入收藏" : "已取消收藏");
  render();
}

function publishPost() {
  const text = document.querySelector("#postText").value.trim();
  if (!text) return showToast("请输入心情内容");
  const isPrivate = document.querySelector("#privateSwitch").classList.contains("on");
  const tag = selectedPublishTag === "压力" ? "焦虑" : selectedPublishTag;
  state.posts.unshift({
    id: `p${Date.now()}`,
    text,
    tag,
    mood: selectedPublishMood,
    time: "刚刚",
    likes: 0,
    resonance: isPrivate ? 1 : 12,
    private: isPrivate,
    owner: state.user,
  });
  recordUsage("心情共鸣", "发布了一条匿名心情");
  showToast("心情已保存到本地模拟数据");
  go("resonanceHome", "resonance");
}

function knockWoodfish() {
  state.woodCount += 1;
  recordUsage("敲敲木鱼", "敲了一次木鱼");
  const count = document.querySelector("#woodCount");
  const wood = document.querySelector("#woodfish");
  if (count) count.textContent = state.woodCount;
  if (wood) {
    wood.classList.remove("hit");
    void wood.offsetWidth;
    wood.classList.add("hit");
  }
  showToast("咚，放下一点点");
}

function shredWorry() {
  const input = document.querySelector("#worryText");
  const text = input.value.trim();
  if (!text) return showToast("先写下一个烦恼吧");
  state.shredLogs.unshift(text);
  recordUsage("情绪粉碎机", `粉碎烦恼：${text.slice(0, 12)}`);
  const box = document.querySelector("#machineBox");
  box.classList.add("shaking");
  showToast("烦恼已粉碎");
  setTimeout(() => render(), 420);
}

function handleImageShare(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    state.sharedImages.unshift({
      name: file.name,
      src: reader.result,
      note: "暖暖看见了这张图片，也看见了你想表达的心情。",
    });
    state.sharedImages = state.sharedImages.slice(0, 6);
    recordUsage("图片分享", `分享图片：${file.name}`);
    showToast("图片已添加到分享列表");
    render();
  };
  reader.readAsDataURL(file);
}

async function startCamera() {
  const video = document.querySelector("#localVideo");
  const card = document.querySelector("#videoSelf");
  if (!video || !navigator.mediaDevices?.getUserMedia) {
    showToast("当前环境不支持摄像头预览，已使用模拟画面");
    return;
  }
  try {
    activeStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    video.srcObject = activeStream;
    card?.classList.add("camera-on");
    recordUsage("视频通话", "开启摄像头预览");
    showToast("摄像头已开启");
  } catch {
    showToast("摄像头无法开启，已保持模拟视频通话");
  }
}

function initDoodle() {
  const canvas = document.querySelector("#doodleCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = 8;
  ctx.strokeStyle = state.doodleColor;
  let drawing = false;

  const point = (event) => {
    const rect = canvas.getBoundingClientRect();
    const touch = event.touches?.[0];
    return {
      x: ((touch?.clientX ?? event.clientX) - rect.left) * (canvas.width / rect.width),
      y: ((touch?.clientY ?? event.clientY) - rect.top) * (canvas.height / rect.height),
    };
  };

  const start = (event) => {
    drawing = true;
    const p = point(event);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    event.preventDefault();
  };
  const move = (event) => {
    if (!drawing) return;
    const p = point(event);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    event.preventDefault();
  };
  const end = () => {
    drawing = false;
  };

  canvas.addEventListener("pointerdown", start);
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointerleave", end);
  canvas.addEventListener("touchstart", start, { passive: false });
  canvas.addEventListener("touchmove", move, { passive: false });
  canvas.addEventListener("touchend", end);
}

function clearDoodleCanvas() {
  const canvas = document.querySelector("#doodleCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  showToast("画板已清空");
}

function playMiniGame(key) {
  const messages = {
    mindful: "正念倒计时开始：先给自己 60 秒安静。",
    weather: "你把今天装进了蓝紫色天气瓶。",
    star: "一颗幸运星已经点亮，送给今天的你。",
  };
  recordUsage("更多玩法", messages[key] || "完成一次轻量玩法");
  showToast(messages[key] || "完成一次轻量玩法");
}

function saveJournalEntry() {
  const mood = document.querySelector("#journalMood").value.trim() || "平静";
  const text = document.querySelector("#journalText").value.trim();
  if (!text) return showToast("先写一点今天的心情吧");
  const date = new Date().toISOString().slice(0, 10);
  state.journalEntries.unshift({ date, mood, text });
  recordUsage("心情日记", `记录了一篇${mood}日记`);
  showToast("日记已保存");
  render();
}

function submitFeedbackForm() {
  const text = document.querySelector("#feedbackText").value.trim();
  if (!text) return showToast("请输入反馈内容");
  state.feedback.unshift({ text, time: "刚刚" });
  recordUsage("帮助与反馈", "提交了一条反馈");
  showToast("反馈已收到，谢谢你");
  render();
}

render();
