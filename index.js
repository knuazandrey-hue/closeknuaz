require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const Anthropic = require('@anthropic-ai/sdk');
const axios = require('axios');

const bot = new Telegraf(process.env.BOT_TOKEN, { handlerTimeout: 600000 });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const userSites = {};

// ─── Описать персонажа ────────────────────────────────────────────────────────
async function describeCharacter(imageBase64) {
  const response = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 400,
    messages: [{ role: 'user', content: [
      { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 } },
      { type: 'text', text: 'Опиши этого персонажа подробно для веб-дизайнера: цвет, форма, стиль рисунка, детали, настроение, характер. 4-5 предложений. Только описание персонажа.' }
    ]}]
  });
  return response.content[0].text;
}

// ─── Деплой файла на GitHub ───────────────────────────────────────────────────
async function uploadFileToGitHub(content, filename, repoName, isBase64 = false) {
  const headers = {
    Authorization: `token ${process.env.GITHUB_TOKEN}`,
    Accept: 'application/vnd.github.v3+json',
    'Content-Type': 'application/json'
  };
  const username = process.env.GITHUB_USERNAME;

  let sha = null;
  try {
    const r = await axios.get(`https://api.github.com/repos/${username}/${repoName}/contents/${filename}`, { headers });
    sha = r.data.sha;
  } catch (e) {}

  const encoded = isBase64 ? content : Buffer.from(content).toString('base64');
  await axios.put(
    `https://api.github.com/repos/${username}/${repoName}/contents/${filename}`,
    { message: `Update ${filename}`, content: encoded, ...(sha && { sha }) },
    { headers }
  );
}

// ─── Создать репо если нет ────────────────────────────────────────────────────
async function ensureRepo(repoName) {
  const headers = {
    Authorization: `token ${process.env.GITHUB_TOKEN}`,
    Accept: 'application/vnd.github.v3+json',
    'Content-Type': 'application/json'
  };
  const username = process.env.GITHUB_USERNAME;
  try {
    await axios.get(`https://api.github.com/repos/${username}/${repoName}`, { headers });
  } catch (e) {
    await axios.post('https://api.github.com/user/repos', { name: repoName, auto_init: true, private: false }, { headers });
    await new Promise(r => setTimeout(r, 2000));
    try {
      await axios.post(`https://api.github.com/repos/${username}/${repoName}/pages`, { source: { branch: 'main', path: '/' } }, { headers });
    } catch (err) {}
  }
}

// ─── Генерация сайта ──────────────────────────────────────────────────────────
async function generateSite(description, existingHtml = null, hasMascot = false) {
  let prompt;

  if (existingHtml) {
    prompt = `Вот HTML сайта мем-токена:\n\n${existingHtml}\n\nВнеси изменение: ${description}\n\nВерни ТОЛЬКО полный HTML. Без объяснений. Без \`\`\`.`;
  } else {
    const mascotNote = hasMascot
      ? `\nМАСКОТ: Файл mascot.jpg уже загружен в корень сайта. Используй его через <img src="mascot.jpg" alt="mascot"> в hero секции. Сделай его большим (300-400px), с floating анимацией.`
      : '';

    prompt = `Ты — лучший веб-разработчик крипто мем-токенов в мире. Создай ПРОФЕССИОНАЛЬНЫЙ сайт уровня dogwifhat.xyz или bonkcoin.com.

ОПИСАНИЕ ТОКЕНА: ${description}
${mascotNote}

━━━━━━━━━━━━━━━━━━
СТИЛЬ И ДИЗАЙН:
━━━━━━━━━━━━━━━━━━
Вдохновение: dogwifhat.xyz — тёмный фон, огромный маскот, минималистично но с характером
Цвета: тёмно-фиолетовый/тёмно-синий фон (#050016, #0a0030), акценты подбери под тему токена
Шрифты: подключи через Google Fonts — Orbitron или Space Grotesk для заголовков, Inter для текста
Фон: чистый тёмный градиент БЕЗ паттернов и сеток — просто: body { background: linear-gradient(135deg, #050016 0%, #0a0030 100%); }

━━━━━━━━━━━━━━━━━━
СЕКЦИИ (строго по порядку):
━━━━━━━━━━━━━━━━━━

1. NAVBAR — position:fixed, background:rgba(5,0,22,0.95), backdrop-filter:blur(20px), border-bottom: 1px solid rgba(акцент, 0.2)
   Слева: логотип + тикер. Справа: About, Tokenomics, Roadmap, Game + кнопка Buy

2. HERO — min-height:100vh, flex, center
   - Маскот сверху (img или CSS персонаж), floating анимация
   - Название огромное (gradient text: -webkit-background-clip:text)
   - Слоган с typewriter эффектом
   - 3 кнопки: Buy on Pump.fun (яркая), Twitter, Telegram
   - CA адрес (placeholder) с кнопкой copy

3. STATS — 3 карточки в ряд: Holders, Market Cap, Total Supply
   Стиль: glassmorphism (rgba белый 0.05, blur, border rgba)
   Числа анимируются через JS при загрузке страницы

4. ABOUT — 3 карточки с иконками (используй эмодзи как иконки)
   Glassmorphism стиль, текст о токене

5. TOKENOMICS — CSS conic-gradient диаграмма + список справа
   5 категорий: Community 40%, Liquidity 20%, Team 15%, Marketing 15%, Reserve 10%

6. ROADMAP — вертикальный таймлайн, 4 фазы
   Phase 1 ✅ Launch, Phase 2 🔄 Growth, Phase 3 🚀 Moon, Phase 4 🌕 Mars

7. HOW TO BUY — 4 шага в карточках с номерами
   1.Get Phantom Wallet 2.Buy SOL 3.Go to Pump.fun 4.Swap for [token]

8. GAME — кликер
   Заголовок "CLICK TO EARN $[TICKER]"
   Большой маскот/эмодзи в центре, при клике: score++, анимация "+1" летит вверх
   Счётчик токенов, уровни каждые 100 кликов, красивый UI

9. COMMUNITY — 3 большие карточки: Twitter, Telegram, pump.fun
   Кнопки перехода на каждой

10. FOOTER — короткий дисклеймер, copyright

━━━━━━━━━━━━━━━━━━
ОБЯЗАТЕЛЬНЫЕ АНИМАЦИИ (CSS @keyframes только):
━━━━━━━━━━━━━━━━━━
@keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-20px)} }
@keyframes gradientText { 0%{background-position:0%} 100%{background-position:200%} }
@keyframes fadeInUp { from{opacity:0;transform:translateY(30px)} to{opacity:1;transform:translateY(0)} }
@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.7} }
@keyframes clickPop { 0%{transform:scale(1)} 50%{transform:scale(0.85)} 100%{transform:scale(1)} }

Маскот: animation: float 3s ease-in-out infinite
Hero секция: animation: fadeInUp 0.8s ease forwards
Кнопки: transition: all 0.3s, hover { transform:translateY(-3px), box-shadow усиливается }

━━━━━━━━━━━━━━━━━━
JS (в конце перед </body>):
━━━━━━━━━━━━━━━━━━
1. Typewriter для слогана
2. Счётчики stats при загрузке страницы (без IntersectionObserver — просто setTimeout 500ms)
3. Кликер игра (score, level, анимация +1)
4. Copy CA адреса

ВАЖНО:
- Весь контент видим сразу — НЕ используй opacity:0 на секциях!
- Один HTML файл, <style> и <script> внутри
- Минимум 500 строк
- Начни с <!DOCTYPE html>

Верни ТОЛЬКО HTML. Без \`\`\`. Без объяснений.`;
  }

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 16000,
    messages: [{ role: 'user', content: prompt }]
  });

  let html = response.content[0].text;
  html = html.replace(/```html/gi, '').replace(/```/g, '').trim();
  if (!html.includes('</html>')) html += '\n</body></html>';
  return html;
}

// ─── Генерация summary ────────────────────────────────────────────────────────
async function generateSummary(description, isEdit = false, editText = '') {
  const prompt = isEdit
    ? `Ты весёлый бот. Обновил сайт. Изменение: "${editText}". Напиши ТОЛЬКО 2-3 предложения обычного текста неформально. БЕЗ HTML. БЕЗ кода.`
    : `Ты весёлый бот. Сделал сайт мем-токена. Описание: "${description}". Напиши ТОЛЬКО 3-4 предложения обычного текста — имя токена, что добавил, дизайн. БЕЗ HTML. БЕЗ кода. Говори живо.`;

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 150,
    messages: [{ role: 'user', content: prompt }]
  });

  return response.content[0].text.replace(/<[^>]*>/g, '').replace(/```[\s\S]*?```/g, '').trim();
}

// ─── Скачать фото ─────────────────────────────────────────────────────────────
async function downloadPhoto(ctx, fileId) {
  const file = await ctx.telegram.getFile(fileId);
  const url = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;
  const response = await axios.get(url, { responseType: 'arraybuffer' });
  return Buffer.from(response.data);
}

// ─── Создать + задеплоить сайт ────────────────────────────────────────────────
async function handleCreate(ctx, description, msg, imageBuffer = null) {
  const userId = ctx.from.id;
  const repoName = `token-${userId}`;

  try {
    // Шаг 1
    await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, '🏗️ Создаю репозиторий...');
    await ensureRepo(repoName);

    // Шаг 2 — загружаем картинку если есть
    let hasMascot = false;
    if (imageBuffer) {
      await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, '🖼️ Загружаю картинку на сайт...');
      await uploadFileToGitHub(imageBuffer.toString('base64'), 'mascot.jpg', repoName, true);
      hasMascot = true;
    }

    // Шаг 3 — генерируем HTML
    await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, '🎨 Генерирую дизайн и код...');
    const html = await generateSite(description, null, hasMascot);
    userSites[userId] = { html, repoName };

    // Шаг 4 — деплоим
    await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, '📤 Деплою на GitHub...');
    await uploadFileToGitHub(html, 'index.html', repoName);

    // Шаг 5 — summary
    await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, '✍️ Пишу результат...');
    const summary = await generateSummary(description);

    await ctx.telegram.deleteMessage(ctx.chat.id, msg.message_id);

    await ctx.reply(summary, Markup.inlineKeyboard([
      [Markup.button.callback('✏️ Редактировать', 'edit_prompt')],
      [Markup.button.callback('📥 Скачать HTML', 'download_html')]
    ]));

    await ctx.replyWithDocument(
      { source: Buffer.from(html), filename: 'index.html' },
      { caption: `☝️ Открывай в браузере!\n\n🔗 GitHub Pages (2-5 мин): https://${process.env.GITHUB_USERNAME}.github.io/${repoName}` }
    );

  } catch (err) {
    console.error(err);
    try { await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, `❌ Ошибка: ${err.message}`); } catch(e) {}
  }
}

// ─── /start ───────────────────────────────────────────────────────────────────
bot.start((ctx) => ctx.reply(`👋 Зд перцы! Я бот для создания сайтов, меня зовут CloseKnuazAI!\n\nЧо я могу крч рассказываю:\n🌐 /create — создать сайт\n✏️ /edit — редактировать текущий сайт\n📥 /download — скачать HTML файл\n❓ /help — расскажу чд могу поподробнее\n\nКрч жми /create чтобы начать!`));

bot.help((ctx) => ctx.reply(`📖 Как пользоваться:\n\n/create [описание] — создать сайт текстом\nПример: /create токен PEPE, зелёная лягушка, tg @pepe, twitter @pepe\n\nИли отправь 🖼️ картинку с подписью — загружу её на сайт как маскот!\n\n/edit [что изменить] — изменить сайт\n/download — скачать HTML файл`));

bot.command('create', async (ctx) => {
  const description = ctx.message.text.replace('/create', '').trim();
  if (!description) return ctx.reply('✍️ Напиши описание!\n\nПример:\n/create токен PEPE, зелёная лягушка, tg @pepe, twitter @pepe\n\nИли отправь картинку с подписью!');
  const msg = await ctx.reply('⏳ Начинаю...');
  await handleCreate(ctx, description, msg);
});

bot.on('photo', async (ctx) => {
  const caption = ctx.message.caption || '';
  if (!caption) return ctx.reply('✍️ Добавь подпись к картинке!\n\nПример подписи: токен BUNNY, злой кролик, tg @bunny, twitter @bunny');

  const msg = await ctx.reply('👀 Вижу картинку, смотрю на персонажа...');
  try {
    const photos = ctx.message.photo;
    const imageBuffer = await downloadPhoto(ctx, photos[photos.length - 1].file_id);
    const imageBase64 = imageBuffer.toString('base64');

    await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, '🔍 Описываю персонажа...');
    const characterDesc = await describeCharacter(imageBase64);

    const fullDescription = `${caption}. Внешность персонажа-маскота: ${characterDesc}`;
    await handleCreate(ctx, fullDescription, msg, imageBuffer);
  } catch (err) {
    console.error(err);
    try { await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, `❌ Ошибка: ${err.message}`); } catch(e) {}
  }
});

bot.command('edit', async (ctx) => {
  const userId = ctx.from.id;
  const editText = ctx.message.text.replace('/edit', '').trim();
  if (!userSites[userId]) return ctx.reply('❌ Сначала создай сайт командой /create');
  if (!editText) return ctx.reply('✍️ Напиши что изменить!\n\nПример: /edit сделай фон темнее и добавь счётчик');

  const msg = await ctx.reply('🎨 Вношу изменения...');
  try {
    const newHtml = await generateSite(editText, userSites[userId].html);
    userSites[userId].html = newHtml;

    await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, '📤 Обновляю...');
    await uploadFileToGitHub(newHtml, 'index.html', userSites[userId].repoName);

    await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, '✍️ Пишу результат...');
    const summary = await generateSummary('', true, editText);

    await ctx.telegram.deleteMessage(ctx.chat.id, msg.message_id);
    await ctx.reply(summary, Markup.inlineKeyboard([[Markup.button.callback('✏️ Ещё', 'edit_prompt')], [Markup.button.callback('📥 Скачать HTML', 'download_html')]]));
    await ctx.replyWithDocument({ source: Buffer.from(newHtml), filename: 'index.html' }, { caption: '☝️ Обновлённый сайт!' });
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

bot.action('edit_prompt', (ctx) => { ctx.answerCbQuery(); ctx.reply('✍️ Напиши что изменить:\n\n/edit [твои изменения]'); });
bot.action('download_html', async (ctx) => {
  ctx.answerCbQuery();
  const userId = ctx.from.id;
  if (userSites[userId]) await ctx.replyWithDocument({ source: Buffer.from(userSites[userId].html), filename: 'index.html' });
});

bot.launch();
console.log('🤖 Бот запущен!');
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
