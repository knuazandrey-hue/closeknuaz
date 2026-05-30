require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const Anthropic = require('@anthropic-ai/sdk');
const axios = require('axios');

const bot = new Telegraf(process.env.BOT_TOKEN, {
  handlerTimeout: 600000
});
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const userSites = {};

// ─── Описать персонажа с картинки ─────────────────────────────────────────────
async function describeCharacter(imageBase64) {
  const response = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 300,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 } },
        { type: 'text', text: 'Опиши персонажа подробно для веб-дизайнера: цвет, форма, стиль, детали, настроение. 3-4 предложения. Только описание.' }
      ]
    }]
  });
  return response.content[0].text;
}

// ─── Генерация сайта ──────────────────────────────────────────────────────────
async function generateSite(description, existingHtml = null) {
  let prompt;

  if (existingHtml) {
    prompt = `Вот текущий HTML сайта мем-токена:\n\n${existingHtml}\n\nВнеси изменение: ${description}\n\nВерни ТОЛЬКО полный обновлённый HTML без объяснений.`;
  } else {
    prompt = `Ты — лучший в мире разработчик крипто-сайтов. Создай ПОТРЯСАЮЩИЙ одностраничный HTML сайт для мем-токена. Сайт должен выглядеть как топовые крипто-проекты 2024 года.

ОПИСАНИЕ ТОКЕНА: ${description}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ОБЯЗАТЕЛЬНЫЙ КОД АНИМАЦИЙ — ВСТАВЬ ЭТО:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. ЧАСТИЦЫ НА ФОНЕ (Canvas):
<canvas id="particles" style="position:fixed;top:0;left:0;z-index:0;pointer-events:none"></canvas>
<script>
const canvas = document.getElementById('particles');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
const particles = Array.from({length: 100}, () => ({
  x: Math.random() * canvas.width,
  y: Math.random() * canvas.height,
  r: Math.random() * 2 + 0.5,
  dx: (Math.random() - 0.5) * 0.5,
  dy: (Math.random() - 0.5) * 0.5,
  alpha: Math.random() * 0.5 + 0.2
}));
function animateParticles() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  particles.forEach(p => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(180, 100, 255, ' + p.alpha + ')';
    ctx.fill();
    p.x += p.dx; p.y += p.dy;
    if (p.x < 0 || p.x > canvas.width) p.dx *= -1;
    if (p.y < 0 || p.y > canvas.height) p.dy *= -1;
  });
  requestAnimationFrame(animateParticles);
}
animateParticles();
window.addEventListener('resize', () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; });
</script>

2. TYPEWRITER ЭФФЕКТ:
<script>
function typeWriter(element, text, speed = 80) {
  let i = 0;
  element.innerHTML = '';
  function type() {
    if (i < text.length) {
      element.innerHTML += text.charAt(i);
      i++;
      setTimeout(type, speed);
    }
  }
  type();
}
window.addEventListener('load', () => {
  const el = document.getElementById('typewriter');
  if (el) typeWriter(el, el.getAttribute('data-text'));
});
</script>

3. СЧЁТЧИКИ:
<script>
function animateCounter(el, target, duration = 2000) {
  let start = 0;
  const step = target / (duration / 16);
  const timer = setInterval(() => {
    start += step;
    if (start >= target) { el.textContent = target.toLocaleString(); clearInterval(timer); return; }
    el.textContent = Math.floor(start).toLocaleString();
  }, 16);
}
const observer = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      const el = e.target;
      animateCounter(el, parseInt(el.getAttribute('data-target')));
      observer.unobserve(el);
    }
  });
});
document.querySelectorAll('.counter').forEach(el => observer.observe(el));
</script>

4. ПОЯВЛЕНИЕ ПРИ СКРОЛЛЕ:
<style>
.reveal { opacity: 0; transform: translateY(40px); transition: all 0.7s ease; }
.reveal.visible { opacity: 1; transform: translateY(0); }
</style>
<script>
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
}, { threshold: 0.1 });
document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));
</script>

5. FLOATING АНИМАЦИЯ:
<style>
@keyframes float { 0%,100% { transform: translateY(0px); } 50% { transform: translateY(-20px); } }
@keyframes glow { 0%,100% { filter: drop-shadow(0 0 10px #b44dff); } 50% { filter: drop-shadow(0 0 30px #b44dff) drop-shadow(0 0 60px #7700ff); } }
@keyframes gradientShift { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
@keyframes fadeInUp { from { opacity:0; transform:translateY(30px); } to { opacity:1; transform:translateY(0); } }
.floating { animation: float 3s ease-in-out infinite; }
.glowing { animation: glow 2s ease-in-out infinite; }
</style>

6. ИГРА КЛИКЕР:
<div id="game-section" style="text-align:center; padding:80px 20px;">
  <h2>🎮 CLICK TO EARN</h2>
  <div style="font-size:2em; margin:10px 0;">Tokens: <span id="score">0</span> | Level: <span id="level">1</span></div>
  <div id="clicker-btn" style="font-size:80px; cursor:pointer; display:inline-block; user-select:none;" class="floating">🪙</div>
  <div id="click-effects" style="position:relative; height:50px;"></div>
</div>
<script>
let score = 0, level = 1;
document.getElementById('clicker-btn').addEventListener('click', function(e) {
  score++;
  if (score % 100 === 0) { level++; document.getElementById('level').textContent = level; }
  document.getElementById('score').textContent = score;
  const el = document.createElement('div');
  el.textContent = '+1';
  el.style.cssText = 'position:absolute; color:#b44dff; font-weight:bold; font-size:1.5em; pointer-events:none; animation: fadeInUp 1s forwards;';
  el.style.left = (Math.random() * 80 + 10) + '%';
  document.getElementById('click-effects').appendChild(el);
  setTimeout(() => el.remove(), 1000);
  this.style.transform = 'scale(0.9)';
  setTimeout(() => this.style.transform = '', 100);
});
</script>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
СЕКЦИИ САЙТА:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. NAVBAR — фиксированная, background: rgba(0,0,0,0.8), backdrop-filter: blur(20px)
2. HERO — полный экран, огромный заголовок с id="typewriter" data-text="НАЗВАНИЕ ТОКЕНА", SVG или CSS логотип персонажа с floating+glowing, кнопки с неоном
3. STATS BAR — 3 счётчика: Holders (<span class="counter" data-target="10000">), Market Cap, Total Supply  
4. ABOUT — glassmorphism карточки (background: rgba(255,255,255,0.05), backdrop-filter: blur(10px), border: 1px solid rgba(255,255,255,0.1))
5. TOKENOMICS — CSS круговая диаграмма conic-gradient
6. ROADMAP — вертикальный таймлайн с иконками ✅/🔄/🔮
7. HOW TO BUY — 4 шага в карточках
8. GAME — кликер как выше
9. COMMUNITY — карточки соцсетей
10. FOOTER

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CSS ТРЕБОВАНИЯ:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- background: linear-gradient(135deg, #0a0015 0%, #0d0030 50%, #000a1a 100%) — основной фон
- Акцентный цвет: #b44dff (фиолетовый) + #00ffcc (циан) — адаптируй под тему токена
- Все кнопки: border: 2px solid акцент, box-shadow: 0 0 20px акцент, transition все
- Hover кнопок: transform: translateY(-3px), box-shadow усиливается
- Google Font: Space Grotesk или Orbitron для заголовков
- Все секции: padding: 100px 20px, max-width: 1200px, margin: 0 auto
- Добавь класс reveal всем секциям

ВАЖНО: Напиши КАК МИНИМУМ 700 строк кода. Сделай реально красиво — это портфолио работа.

Верни ТОЛЬКО HTML. Без объяснений. Без \`\`\`.`;
  }

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 8000,
    messages: [{ role: 'user', content: prompt }]
  });

  let html = response.content[0].text;
  html = html.replace(/```html/g, '').replace(/```/g, '').trim();
  return html;
}

// ─── Генерация описания что было сделано ─────────────────────────────────────
async function generateSummary(description, isEdit = false, editText = '') {
  const prompt = isEdit
    ? `Ты весёлый бот. Обновил сайт мем-токена. Изменение: "${editText}". Напиши 3-4 предложения неформально что изменил. Эмодзи можно.`
    : `Ты весёлый бот. Сделал сайт мем-токена. Описание: "${description}". Напиши 4-5 предложений неформально — придумай имя если нет, расскажи что сделал, дизайн, игра. Говори как живой чел. Эмодзи можно.`;

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 300,
    messages: [{ role: 'user', content: prompt }]
  });
  return response.content[0].text;
}

// ─── Скачать фото ─────────────────────────────────────────────────────────────
async function downloadPhoto(ctx, fileId) {
  const file = await ctx.telegram.getFile(fileId);
  const url = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;
  const response = await axios.get(url, { responseType: 'arraybuffer' });
  return Buffer.from(response.data).toString('base64');
}

// ─── Деплой на GitHub Pages ───────────────────────────────────────────────────
async function deployToGitHub(html, repoName) {
  const headers = {
    Authorization: `token ${process.env.GITHUB_TOKEN}`,
    Accept: 'application/vnd.github.v3+json',
    'Content-Type': 'application/json'
  };
  const username = process.env.GITHUB_USERNAME;
  let sha = null;
  try {
    const r = await axios.get(`https://api.github.com/repos/${username}/${repoName}/contents/index.html`, { headers });
    sha = r.data.sha;
  } catch (e) {
    try {
      await axios.post('https://api.github.com/user/repos', { name: repoName, auto_init: true, private: false }, { headers });
      await new Promise(r => setTimeout(r, 2000));
      await axios.post(`https://api.github.com/repos/${username}/${repoName}/pages`, { source: { branch: 'main', path: '/' } }, { headers });
    } catch (err) {}
  }
  const content = Buffer.from(html).toString('base64');
  await axios.put(
    `https://api.github.com/repos/${username}/${repoName}/contents/index.html`,
    { message: 'Update site', content, ...(sha && { sha }) },
    { headers }
  );
}

// ─── Общий обработчик ─────────────────────────────────────────────────────────
async function handleCreate(ctx, description, msg) {
  const userId = ctx.from.id;
  const repoName = `token-${userId}`;
  try {
    const html = await generateSite(description);
    userSites[userId] = { html, repoName };

    await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, '📝 Пишу что сделал...');
    const summary = await generateSummary(description);

    await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, '📤 Деплою...');
    await deployToGitHub(html, repoName);
    await ctx.telegram.deleteMessage(ctx.chat.id, msg.message_id);

    await ctx.reply(summary, Markup.inlineKeyboard([
      [Markup.button.callback('✏️ Редактировать', 'edit_prompt')],
      [Markup.button.callback('📥 Скачать HTML', 'download_html')]
    ]));
    await ctx.replyWithDocument(
      { source: Buffer.from(html), filename: 'index.html' },
      { caption: '☝️ Открывай в браузере!' }
    );
  } catch (err) {
    console.error(err);
    try { await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, `❌ Ошибка: ${err.message}`); } catch(e) {}
  }
}

// ─── /start ───────────────────────────────────────────────────────────────────
bot.start((ctx) => {
  ctx.reply(`👋 Зд перцы! Я бот для создания сайтов, меня зовут CloseKnuazAI!

Чо я могу крч рассказываю:
🌐 /create — создать сайт
✏️ /edit — редактировать текущий сайт
📥 /download — скачать HTML файл
❓ /help — расскажу чд могу поподробнее

Крч жми /create чтобы начать!`);
});

bot.help((ctx) => {
  ctx.reply(`📖 Как пользоваться:

/create [описание] — создать сайт
Пример: /create токен PEPE, зелёная лягушка, tg @pepe, twitter @pepe

Или отправь 🖼 картинку с подписью!

/edit [что изменить] — изменить сайт
/download — получить HTML файл`);
});

bot.command('create', async (ctx) => {
  const description = ctx.message.text.replace('/create', '').trim();
  if (!description) return ctx.reply('✍️ Напиши описание!\n\nПример:\n/create токен PEPE, зелёная лягушка, tg @pepe, twitter @pepe');
  const msg = await ctx.reply('⏳ Погнали! Делаю красивый сайт... 2-3 минуты 🔥');
  await handleCreate(ctx, description, msg);
});

bot.on('photo', async (ctx) => {
  const caption = ctx.message.caption || '';
  if (!caption) return ctx.reply('✍️ Добавь подпись к картинке!\n\nПример: токен BUNNY, tg @bunny, twitter @bunny');

  const msg = await ctx.reply('⏳ Вижу картинку! Смотрю на персонажа... 👀');
  try {
    const photos = ctx.message.photo;
    const fileId = photos[photos.length - 1].file_id;
    const imageBase64 = await downloadPhoto(ctx, fileId);

    await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, '👀 Описываю персонажа...');
    const characterDesc = await describeCharacter(imageBase64);
    const fullDescription = `${caption}. Персонаж: ${characterDesc}`;

    await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, '⏳ Делаю сайт... 2-3 минуты 🔥');
    await handleCreate(ctx, fullDescription, msg);
  } catch (err) {
    console.error(err);
    try { await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, `❌ Ошибка: ${err.message}`); } catch(e) {}
  }
});

bot.command('edit', async (ctx) => {
  const userId = ctx.from.id;
  const editText = ctx.message.text.replace('/edit', '').trim();
  if (!userSites[userId]) return ctx.reply('❌ Сначала создай сайт командой /create');
  if (!editText) return ctx.reply('✍️ Напиши что изменить!');

  const msg = await ctx.reply('⏳ Вношу изменения... 🔧');
  const { html: oldHtml, repoName } = userSites[userId];
  try {
    const newHtml = await generateSite(editText, oldHtml);
    userSites[userId].html = newHtml;

    await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, '📝 Пишу что изменил...');
    const summary = await generateSummary('', true, editText);

    await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, '📤 Обновляю...');
    await deployToGitHub(newHtml, repoName);
    await ctx.telegram.deleteMessage(ctx.chat.id, msg.message_id);

    await ctx.reply(summary, Markup.inlineKeyboard([
      [Markup.button.callback('✏️ Ещё изменение', 'edit_prompt')],
      [Markup.button.callback('📥 Скачать HTML', 'download_html')]
    ]));
    await ctx.replyWithDocument(
      { source: Buffer.from(newHtml), filename: 'index.html' },
      { caption: '☝️ Обновлённый сайт!' }
    );
  } catch (err) {
    console.error(err);
    try { await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, `❌ Ошибка: ${err.message}`); } catch(e) {}
  }
});

bot.command('download', async (ctx) => {
  const userId = ctx.from.id;
  if (!userSites[userId]) return ctx.reply('❌ Сначала создай сайт командой /create');
  await ctx.replyWithDocument({ source: Buffer.from(userSites[userId].html), filename: 'index.html' });
});

bot.action('edit_prompt', (ctx) => {
  ctx.answerCbQuery();
  ctx.reply('✍️ Напиши что изменить:\n\n/edit [твои изменения]');
});

bot.action('download_html', async (ctx) => {
  ctx.answerCbQuery();
  const userId = ctx.from.id;
  if (userSites[userId]) {
    await ctx.replyWithDocument({ source: Buffer.from(userSites[userId].html), filename: 'index.html' });
  }
});

bot.launch();
console.log('🤖 Бот запущен!');
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
