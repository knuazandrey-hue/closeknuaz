require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const Anthropic = require('@anthropic-ai/sdk');
const axios = require('axios');
const { jsonrepair } = require('jsonrepair');

const bot = new Telegraf(process.env.BOT_TOKEN, { handlerTimeout: 600000 });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const userSites = {};
const userChats = {};
const userStates = {};
const userLastImage = {};

// ─── Игнорируем старые сообщения при перезапуске ──────────────────────────────
bot.use(async (ctx, next) => {
  const msgTime = ctx.message?.date || ctx.callbackQuery?.message?.date;
  if (msgTime && (Date.now() / 1000 - msgTime) > 30) return; // игнор если >30 сек
  return next();
});

// ─── Глобальный обработчик ошибок ─────────────────────────────────────────────
bot.catch((err, ctx) => {
  console.error('Bot error:', err.message);
});

// ─── Главное меню (кнопки внизу чата) ────────────────────────────────────────
const mainMenu = Markup.keyboard([
  ['🌐 Создать сайт', '🖼 Картинка'],
  ['💡 Идея токена',  '💬 Задать вопрос'],
  ['✏️ Редактировать сайт', '📥 Скачать HTML']
]).resize();

// ════════════════════════════════════════════════════════════
// БЛОК 1: ГЕНЕРАЦИЯ КАРТИНОК
// ════════════════════════════════════════════════════════════

async function enhanceImagePrompt(userPrompt) {
  const r = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 200,
    messages: [{ role: 'user', content: `Переведи на английский и улучши этот промпт для генерации картинки мем-токена/крипто логотипа. Сделай его детальным: стиль, цвета, качество. Оригинал: "${userPrompt}". Верни ТОЛЬКО улучшенный промпт, без объяснений.` }]
  });
  return r.content[0].text.trim();
}

async function generateImage(prompt) {
  const enhanced = await enhanceImagePrompt(prompt);
  const seed = Math.floor(Math.random() * 999999);
  const encoded = encodeURIComponent(enhanced);
  const url = `https://image.pollinations.ai/prompt/${encoded}?width=1024&height=1024&nologo=true&model=flux-pro&seed=${seed}`;
  const r = await axios.get(url, { responseType: 'arraybuffer', timeout: 120000 });
  return { buffer: Buffer.from(r.data), enhancedPrompt: enhanced };
}

// ════════════════════════════════════════════════════════════
// БЛОК 2: ВОПРОСЫ И ЧАТБОТИК
// ════════════════════════════════════════════════════════════

async function askClaude(question, userId) {
  if (!userChats[userId]) userChats[userId] = [];
  userChats[userId].push({ role: 'user', content: question });

  const r = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 1000,
    system: `Ты — CloseKnuazAI, умный и весёлый крипто-ассистент в Telegram. Отвечаешь неформально, с характером, но по делу. 
Специализация: крипта, мем-токены, pump.fun, Solana, запуск токенов, маркетинг в крипте.
Можешь: придумывать идеи токенов, объяснять как работает крипта, помогать с названиями/слоганами, отвечать на любые вопросы.
Стиль: живой, иногда с приколом, используй эмодзи умеренно. Не пиши простыни текста — отвечай компактно.`,
    messages: userChats[userId].slice(-20)
  });

  const answer = r.content[0].text;
  userChats[userId].push({ role: 'assistant', content: answer });
  if (userChats[userId].length > 40) userChats[userId] = userChats[userId].slice(-20);
  return answer;
}

// ════════════════════════════════════════════════════════════
// БЛОК 3: СОЗДАНИЕ САЙТОВ (существующий код)
// ════════════════════════════════════════════════════════════

async function describeCharacter(imageBase64) {
  const r = await anthropic.messages.create({
    model: 'claude-opus-4-6', max_tokens: 500,
    messages: [{ role: 'user', content: [
      { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 } },
      { type: 'text', text: 'Опиши персонажа детально для веб-дизайнера: цвет, форма, стиль, детали, настроение, характер. 5-6 предложений.' }
    ]}]
  });
  return r.content[0].text;
}

async function createDesignPlan(description) {
  const r = await anthropic.messages.create({
    model: 'claude-opus-4-6', max_tokens: 1500,
    messages: [{ role: 'user', content: `Ты — арт-директор топовых крипто-проектов. Проанализируй токен и создай дизайн-план.

ТОКЕН: ${description}

Верни ТОЛЬКО валидный JSON без комментариев и без markdown:
{
  "tokenName": "название",
  "ticker": "ТИКЕР",
  "slogan": "крутой слоган",
  "personality": "характер токена 2-3 предложения",
  "primaryColor": "#7b2fff",
  "secondaryColor": "#00ffcc",
  "bgColorStart": "#05001a",
  "bgColorEnd": "#0a0030",
  "glowColor": "rgba(123, 47, 255, 0.8)",
  "fontTitle": "Orbitron",
  "fontBody": "Inter",
  "visualStyle": "описание стиля",
  "mascotEmoji": "🐸",
  "animationMood": "bouncy",
  "aboutPoints": [
    {"icon":"🚀","title":"заголовок","text":"2 предложения"},
    {"icon":"💎","title":"заголовок","text":"2 предложения"},
    {"icon":"🔥","title":"заголовок","text":"2 предложения"}
  ],
  "roadmap": [
    {"phase":"Phase 1","title":"Launch","items":["пункт1","пункт2","пункт3"],"status":"done"},
    {"phase":"Phase 2","title":"Growth","items":["пункт1","пункт2","пункт3"],"status":"active"},
    {"phase":"Phase 3","title":"Moon","items":["пункт1","пункт2","пункт3"],"status":"upcoming"},
    {"phase":"Phase 4","title":"Mars","items":["пункт1","пункт2","пункт3"],"status":"upcoming"}
  ],
  "tgLink":"#",
  "twitterLink":"#",
  "uniqueFeature":"уникальная фича дизайна для этого токена"
}` }]
  });

  let text = r.content[0].text;

  // Убираем markdown и лишнее
  text = text.replace(/```json/gi, '').replace(/```/g, '').trim();

  // Берём только JSON объект
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}') + 1;
  if (start === -1 || end === 0) throw new Error('Claude не вернул JSON');
  text = text.slice(start, end);

  // Чистим частые проблемы в JSON от Claude
  text = text
    .replace(/,\s*}/g, '}')           // trailing comma в объекте
    .replace(/,\s*]/g, ']')           // trailing comma в массиве
    .replace(/[\x00-\x1F\x7F]/g, ' ') // управляющие символы
    .replace(/\n/g, ' ')               // переносы строк внутри строк
    .replace(/\t/g, ' ');              // табы

  try {
    return JSON.parse(jsonrepair(text));
  } catch (e) {
    // Если всё ещё не парсится — используем дефолтный план
    console.error('JSON parse error:', e.message, '\nText:', text.slice(0, 200));

    // Пробуем достать хотя бы имя токена из описания
    const ticker = (description.match(/\b([A-Z]{2,8})\b/) || ['', 'TOKEN'])[1];
    return {
      tokenName: ticker + ' Token',
      ticker: ticker,
      slogan: 'To the moon and back',
      personality: 'Energetic meme token with big ambitions',
      primaryColor: '#7b2fff',
      secondaryColor: '#00ffcc',
      bgColorStart: '#05001a',
      bgColorEnd: '#0a0030',
      glowColor: 'rgba(123, 47, 255, 0.8)',
      fontTitle: 'Orbitron',
      fontBody: 'Inter',
      visualStyle: 'cyberpunk dark',
      mascotEmoji: '🚀',
      animationMood: 'bouncy',
      aboutPoints: [
        { icon: '🚀', title: 'To The Moon', text: 'Fast and furious token launch. Community driven growth.' },
        { icon: '💎', title: 'Diamond Hands', text: 'Hold strong and get rewarded. True believers win.' },
        { icon: '🔥', title: 'Burn Mechanism', text: 'Deflationary token. Every trade burns supply.' }
      ],
      roadmap: [
        { phase: 'Phase 1', title: 'Launch', items: ['Token launch', 'Community building', 'Pump.fun listing'], status: 'done' },
        { phase: 'Phase 2', title: 'Growth', items: ['10k holders', 'CEX listing', 'Marketing push'], status: 'active' },
        { phase: 'Phase 3', title: 'Moon', items: ['100k holders', 'Major exchange', 'Merch drop'], status: 'upcoming' },
        { phase: 'Phase 4', title: 'Mars', items: ['1M holders', 'DAO launch', 'World domination'], status: 'upcoming' }
      ],
      tgLink: '#',
      twitterLink: '#',
      uniqueFeature: 'Animated particle explosion on button click'
    };
  }
}

async function generateHtml(plan, hasMascot, mascotBase64 = null, progressCallback = null) {
  const mascotHtml = hasMascot && mascotBase64
    ? `<img src="data:image/jpeg;base64,${mascotBase64}" alt="mascot" class="mascot">`
    : `<div class="mascot">${plan.mascotEmoji}</div>`;

  const prompt = `Создай УНИКАЛЬНЫЙ одностраничный HTML сайт для мем-токена по этому плану.

ПЛАН: ${JSON.stringify(plan, null, 2)}
МАСКОТ HTML: ${mascotHtml}

CSS переменные в :root:
--primary: ${plan.primaryColor}
--secondary: ${plan.secondaryColor}
--bg-start: ${plan.bgColorStart}
--bg-end: ${plan.bgColorEnd}
--glow: ${plan.glowColor}

body background: linear-gradient(135deg, var(--bg-start), var(--bg-end)) — только это

ОБЯЗАТЕЛЬНЫЕ @keyframes:
float { 0%,100%{transform:translateY(0) rotate(-2deg)} 50%{transform:translateY(-20px) rotate(2deg)} }
textGlow { 0%,100%{text-shadow:0 0 20px var(--glow)} 50%{text-shadow:0 0 60px var(--glow),0 0 100px var(--glow)} }
fadeInUp { from{opacity:0;transform:translateY(40px)} to{opacity:1;transform:translateY(0)} }
btnPulse { 0%,100%{box-shadow:0 0 20px var(--glow)} 50%{box-shadow:0 0 50px var(--glow),0 0 100px var(--glow)} }
+ уникальная для этого токена (${plan.animationMood})

СЕКЦИИ:
1. NAVBAR fixed, blur фон, лого "${plan.mascotEmoji} $${plan.ticker}", кнопка Buy
2. HERO 100vh: ${mascotHtml} с float 3s infinite, h1 gradient, typewriter слоган, 3 кнопки, CA copy
3. STATS 3 glassmorphism карточки, счётчики JS на setTimeout
4. ABOUT 3 карточки: ${plan.aboutPoints.map(p => p.icon + ' ' + p.title).join(', ')}
5. TOKENOMICS conic-gradient диаграмма + список
6. ROADMAP таймлайн: ${plan.roadmap.map(r => r.phase + '[' + r.status + ']').join(', ')}
7. HOW TO BUY 4 шага
8. GAME кликер — клик по маскоту = +1 токен, анимация "+1", уровни
9. COMMUNITY Twitter, Telegram, Pump.fun
10. FOOTER дисклеймер

JS: Canvas частицы, typewriter, счётчики, кликер, copy CA
УНИКАЛЬНАЯ ФИЧА: ${plan.uniqueFeature}

СТРОГО: весь контент видим сразу (NO opacity:0 на секциях!), один файл.
Верни ТОЛЬКО HTML начиная с <!DOCTYPE html>. Без \`\`\`.`;

  // Стриминг — соединение не рвётся пока Claude пишет
  let html = '';
  let chunkCount = 0;

  const stream = anthropic.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 8000,
    messages: [{ role: 'user', content: prompt }]
  });

  stream.on('text', (text) => {
    html += text;
    chunkCount++;
    // Обновляем прогресс каждые 60 чанков (~30 сек)
    if (progressCallback && chunkCount % 60 === 0) {
      const lines = html.split('\n').length;
      progressCallback(lines).catch(() => {});
    }
  });

  await stream.finalMessage();

  html = html.replace(/```html/gi, '').replace(/```/g, '').trim();
  if (!html.startsWith('<!')) html = '<!DOCTYPE html>\n' + html;
  if (!html.includes('</html>')) html += '\n</body></html>';
  return html;
}

async function ensureRepo(repoName) {
  const h = { Authorization: `token ${process.env.GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json' };
  const u = process.env.GITHUB_USERNAME;
  try { await axios.get(`https://api.github.com/repos/${u}/${repoName}`, { headers: h }); }
  catch {
    await axios.post('https://api.github.com/user/repos', { name: repoName, auto_init: true, private: false }, { headers: h });
    await new Promise(r => setTimeout(r, 2000));
    try { await axios.post(`https://api.github.com/repos/${u}/${repoName}/pages`, { source: { branch: 'main', path: '/' } }, { headers: h }); } catch {}
  }
}

async function uploadFile(content, filename, repoName, isBase64=false) {
  const h = { Authorization: `token ${process.env.GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json', 'Content-Type': 'application/json' };
  const u = process.env.GITHUB_USERNAME;
  let sha = null;
  try { sha = (await axios.get(`https://api.github.com/repos/${u}/${repoName}/contents/${filename}`, { headers: h })).data.sha; } catch {}
  await axios.put(`https://api.github.com/repos/${u}/${repoName}/contents/${filename}`,
    { message: `Update ${filename}`, content: isBase64 ? content : Buffer.from(content).toString('base64'), ...(sha && { sha }) },
    { headers: h });
}

async function handleCreate(ctx, description, msg, imageBuffer=null) {
  const userId = ctx.from.id;
  const repoName = `token-${userId}`;
  try {
    await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, '🧠 Анализирую токен, придумываю дизайн...');
    const plan = await createDesignPlan(description);

    await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, `🎨 Пишу код для $${plan.ticker}...`);
    const mascotBase64 = imageBuffer ? imageBuffer.toString('base64') : null;

    // Передаём колбэк для обновления прогресса
    const progressCallback = async (lines) => {
      try {
        await ctx.telegram.editMessageText(
          ctx.chat.id, msg.message_id, null,
          `✍️ Пишу код для $${plan.ticker}... (~${lines} строк написано)`
        );
      } catch {}
    };

    const html = await generateHtml(plan, !!imageBuffer, mascotBase64, progressCallback);
    userSites[userId] = { html, repoName, plan };

    await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, '📤 Деплою на GitHub...');
    await ensureRepo(repoName);
    await uploadFile(html, 'index.html', repoName);
    if (imageBuffer) await uploadFile(imageBuffer.toString('base64'), 'mascot.jpg', repoName, true);

    const r = await anthropic.messages.create({
      model: 'claude-opus-4-6', max_tokens: 150,
      messages: [{ role: 'user', content: `Ты весёлый бот. Сделал сайт для ${plan.ticker} — ${plan.tokenName}. Слоган: ${plan.slogan}. 3 предложения неформально. БЕЗ HTML.` }]
    });
    const summary = r.content[0].text.replace(/<[^>]*>/g,'').trim();

    await ctx.telegram.deleteMessage(ctx.chat.id, msg.message_id);
    await ctx.reply(summary, Markup.inlineKeyboard([
      [Markup.button.callback('✏️ Редактировать', 'edit_prompt'), Markup.button.callback('📥 Скачать HTML', 'download_html')]
    ]));
    await ctx.replyWithDocument(
      { source: Buffer.from(html), filename: 'index.html' },
      { caption: '☝️ Открывай в браузере!' }
    );
  } catch (err) {
    console.error(err);
    try { await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, `❌ Ошибка: ${err.message}`); } catch {}
  }
}

// ════════════════════════════════════════════════════════════
// КОМАНДЫ БОТА
// ════════════════════════════════════════════════════════════

bot.start((ctx) => ctx.reply(
  `👋 Зд! Я CloseKnuazAI — твой крипто-агент 🤖\n\nЧо умею:\n🌐 Создать сайт мем-токена\n🖼 Сгенерить картинку\n💡 Придумать идею токена\n💬 Ответить на любой вопрос\n\nЖми кнопки внизу 👇`,
  mainMenu
));

bot.help((ctx) => ctx.reply(
  `📖 Команды:\n\n🌐 /create [описание] — сайт токена\nПример: /create токен PEPE, лягушка, tg @pepe\n\n🖼 /image [описание] — картинка\nПример: /image злой кролик в космосе, неон стиль\n\n💡 /idea [тема] — идея токена\nПример: /idea хочу токен про котов\n\n💬 /ask [вопрос] — любой вопрос\nПример: /ask как запустить токен на pump.fun?\n\nИли просто отправь фото с подписью — сделаю сайт с твоим персонажем!`
));

// /create
bot.command('create', async (ctx) => {
  const desc = ctx.message.text.replace('/create','').trim();
  if (!desc) return ctx.reply('✍️ Напиши описание!\nПример: /create токен DOGE, собака, tg @doge, twitter @doge');
  const msg = await ctx.reply('⏳ Начинаю...');
  // Запускаем в фоне — хендлер не ждёт
  handleCreate(ctx, desc, msg).catch(async (err) => {
    try { await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, `❌ Ошибка: ${err.message}`); } catch {}
  });
});

// /image
bot.command('image', async (ctx) => {
  const prompt = ctx.message.text.replace('/image','').trim();
  if (!prompt) return ctx.reply('✍️ Напиши что нарисовать!\nПример: /image злой кролик с лазерными глазами, крипто стиль, неон');
  const msg = await ctx.reply('🎨 Генерирую картинку... ~30 секунд');
  try {
    await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, '🎨 Улучшаю промпт...');
    const { buffer, enhancedPrompt } = await generateImage(prompt);
    userLastImage[ctx.from.id] = { original: prompt, enhanced: enhancedPrompt };
    await ctx.telegram.deleteMessage(ctx.chat.id, msg.message_id);
    await ctx.replyWithPhoto(
      { source: buffer, filename: 'image.jpg' },
      {
        caption: `🖼 Готово!\n\n📝 Промпт: ${enhancedPrompt.slice(0,200)}`,
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback('✏️ Изменить картинку', 'edit_image')],
          [Markup.button.callback('🔄 Другой вариант', 'regen_image')]
        ]).reply_markup
      }
    );
  } catch (err) {
    console.error(err);
    try { await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, `❌ Ошибка генерации: ${err.message}\n\nПопробуй ещё раз или измени промпт`); } catch {}
  }
});

// /idea
bot.command('idea', async (ctx) => {
  const theme = ctx.message.text.replace('/idea','').trim();
  const prompt = theme
    ? `Придумай крутую идею мем-токена на тему: "${theme}". Дай: название, тикер, слоган, концепцию (3-4 предложения), почему это выстрелит. Неформально, с энтузиазмом.`
    : `Придумай случайную крутую идею мем-токена. Дай: название, тикер, слоган, концепцию (3-4 предложения), почему это выстрелит. Неформально, с энтузиазмом.`;
  const msg = await ctx.reply('💡 Думаю...');
  try {
    const answer = await askClaude(prompt, ctx.from.id);
    await ctx.telegram.deleteMessage(ctx.chat.id, msg.message_id);
    await ctx.reply(answer, Markup.inlineKeyboard([
      [Markup.button.callback('🌐 Сделать сайт для этой идеи', 'create_from_idea')],
      [Markup.button.callback('💡 Ещё идея', 'another_idea')]
    ]));
  } catch (err) {
    try { await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, `❌ Ошибка: ${err.message}`); } catch {}
  }
});

// /ask
bot.command('ask', async (ctx) => {
  const question = ctx.message.text.replace('/ask','').trim();
  if (!question) return ctx.reply('✍️ Напиши вопрос!\nПример: /ask как запустить токен на pump.fun?');
  const msg = await ctx.reply('🤔 Думаю...');
  try {
    const answer = await askClaude(question, ctx.from.id);
    await ctx.telegram.deleteMessage(ctx.chat.id, msg.message_id);
    await ctx.reply(answer);
  } catch (err) {
    try { await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, `❌ Ошибка: ${err.message}`); } catch {}
  }
});

// Обычные сообщения — обработка кнопок меню + чатбот
bot.on('text', async (ctx) => {
  if (ctx.message.text.startsWith('/')) return;
  const text = ctx.message.text;
  const userId = ctx.from.id;

  // ── Кнопки главного меню ──
  if (text === '🌐 Создать сайт') {
    userStates[userId] = 'waiting_create';
    return ctx.reply('✍️ Опиши свой токен!\n\nНапример: токен PEPE, зелёная лягушка, tg @pepe, twitter @pepe\n\nИли просто отправь картинку с подписью 👇');
  }

  if (text === '🖼 Картинка') {
    userStates[userId] = 'waiting_image';
    return ctx.reply('🖼 Что нарисовать?\n\nНапример: злой кролик в космосе, неон стиль, крипто логотип');
  }

  if (text === '💡 Идея токена') {
    userStates[userId] = 'waiting_idea';
    return ctx.reply('💡 Напиши тему или направление!\n\nНапример: хочу токен про котов\n\nИли напиши "рандом" — придумаю сам 🎲');
  }

  if (text === '💬 Задать вопрос') {
    userStates[userId] = 'waiting_ask';
    return ctx.reply('💬 Пиши свой вопрос!\n\nЗнаю всё про крипту, pump.fun, Solana, мем-токены и не только 🧠');
  }

  if (text === '✏️ Редактировать сайт') {
    if (!userSites[userId]) return ctx.reply('❌ Сначала создай сайт кнопкой "🌐 Создать сайт"');
    userStates[userId] = 'waiting_edit';
    return ctx.reply('✏️ Что изменить?\n\nНапример: сделай фон темнее, добавь счётчик холдеров, измени цвет на зелёный');
  }

  if (text === '📥 Скачать HTML') {
    if (!userSites[userId]) return ctx.reply('❌ Сначала создай сайт кнопкой "🌐 Создать сайт"');
    return ctx.replyWithDocument({ source: Buffer.from(userSites[userId].html), filename: 'index.html' });
  }

  // ── Обработка состояний (ожидание ввода) ──
  const state = userStates[userId];

  if (state === 'waiting_create') {
    userStates[userId] = null;
    const msg = await ctx.reply('⏳ Начинаю...', mainMenu);
    // Запускаем в фоне
    handleCreate(ctx, text, msg).catch(async (err) => {
      try { await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, `❌ Ошибка: ${err.message}`); } catch {}
    });
    return;
  }

  if (state === 'waiting_image') {
    userStates[userId] = null;
    const msg = await ctx.reply('🎨 Генерирую картинку... ~30 сек');
    try {
      await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, '🎨 Улучшаю промпт...');
      const { buffer, enhancedPrompt } = await generateImage(text);
      userLastImage[userId] = { original: text, enhanced: enhancedPrompt };
      await ctx.telegram.deleteMessage(ctx.chat.id, msg.message_id);
      await ctx.replyWithPhoto(
        { source: buffer, filename: 'image.jpg' },
        {
          caption: `🖼 Готово!\n\n📝 Промпт: ${enhancedPrompt.slice(0,200)}`,
          reply_markup: Markup.inlineKeyboard([
            [Markup.button.callback('✏️ Изменить картинку', 'edit_image')],
            [Markup.button.callback('🔄 Другой вариант', 'regen_image')]
          ]).reply_markup
        }
      );
    } catch (err) {
      try { await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, `❌ Ошибка: ${err.message}`); } catch {}
    }
    return;
  }

  if (state === 'waiting_idea') {
    userStates[userId] = null;
    const msg = await ctx.reply('💡 Думаю...');
    try {
      const prompt = text.toLowerCase() === 'рандом'
        ? 'Придумай случайную крутую идею мем-токена. Название, тикер, слоган, концепция, почему выстрелит. Неформально!'
        : `Придумай крутую идею мем-токена на тему: "${text}". Название, тикер, слоган, концепция, почему выстрелит. Неформально!`;
      const answer = await askClaude(prompt, userId);
      await ctx.telegram.deleteMessage(ctx.chat.id, msg.message_id);
      await ctx.reply(answer, Markup.inlineKeyboard([
        [Markup.button.callback('🌐 Сделать сайт для этой идеи', 'create_from_idea')],
        [Markup.button.callback('💡 Ещё идея', 'another_idea')]
      ]));
    } catch (err) {
      try { await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, `❌ Ошибка: ${err.message}`); } catch {}
    }
    return;
  }

  if (state === 'waiting_ask') {
    userStates[userId] = null;
    const msg = await ctx.reply('🤔 Думаю...');
    try {
      const answer = await askClaude(text, userId);
      await ctx.telegram.deleteMessage(ctx.chat.id, msg.message_id);
      await ctx.reply(answer);
    } catch (err) {
      try { await ctx.telegram.deleteMessage(ctx.chat.id, msg.message_id); } catch {}
    }
    return;
  }

  if (state === 'waiting_image_edit') {
    userStates[userId] = null;
    const last = userLastImage[userId];
    if (!last) return ctx.reply('❌ Нет сохранённой картинки');
    const msg = await ctx.reply('🎨 Изменяю картинку...');
    try {
      // Просим Claude объединить оригинальный промпт с изменением
      const mergeResponse = await anthropic.messages.create({
        model: 'claude-opus-4-6',
        max_tokens: 200,
        messages: [{ role: 'user', content: `Оригинальный промпт картинки: "${last.original}"\nИзменение которое просит пользователь: "${text}"\n\nСоедини их в один улучшенный промпт на английском. Верни ТОЛЬКО промпт, без объяснений.` }]
      });
      const newPrompt = mergeResponse.content[0].text.trim();
      const { buffer, enhancedPrompt } = await generateImage(newPrompt);
      userLastImage[userId] = { original: newPrompt, enhanced: enhancedPrompt };
      await ctx.telegram.deleteMessage(ctx.chat.id, msg.message_id);
      await ctx.replyWithPhoto(
        { source: buffer, filename: 'image.jpg' },
        {
          caption: `🖼 Изменил!\n\n📝 Промпт: ${enhancedPrompt.slice(0,200)}`,
          reply_markup: Markup.inlineKeyboard([
            [Markup.button.callback('✏️ Изменить ещё', 'edit_image')],
            [Markup.button.callback('🔄 Другой вариант', 'regen_image')]
          ]).reply_markup
        }
      );
    } catch (err) {
      try { await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, `❌ Ошибка: ${err.message}`); } catch {}
    }
    return;
  }

  if (state === 'waiting_edit') {
    userStates[userId] = null;
    const msg = await ctx.reply('🎨 Вношу изменения...');
    try {
      const newHtml = await generateHtml({ ...userSites[userId].plan }, false, null);
      userSites[userId].html = newHtml;
      await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, '📤 Обновляю...');
      await uploadFile(newHtml, 'index.html', userSites[userId].repoName);
      await ctx.telegram.deleteMessage(ctx.chat.id, msg.message_id);
      await ctx.reply('✅ Готово!');
      await ctx.replyWithDocument({ source: Buffer.from(newHtml), filename: 'index.html' }, { caption: '☝️ Обновлённый сайт!' });
    } catch (err) {
      try { await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, `❌ Ошибка: ${err.message}`); } catch {}
    }
    return;
  }

  // ── Обычный чат ──
  const msg = await ctx.reply('🤔 Думаю...');
  try {
    const answer = await askClaude(text, userId);
    await ctx.telegram.deleteMessage(ctx.chat.id, msg.message_id);
    await ctx.reply(answer);
  } catch (err) {
    try { await ctx.telegram.deleteMessage(ctx.chat.id, msg.message_id); } catch {}
  }
});

// Фото
bot.on('photo', async (ctx) => {
  const caption = ctx.message.caption || '';
  if (!caption) return ctx.reply('✍️ Добавь подпись к фото!\nПример: токен BUNNY, злой кролик, tg @bunny');
  const msg = await ctx.reply('👀 Вижу картинку, описываю персонажа...');
  // Запускаем в фоне
  (async () => {
    try {
      const imageBuffer = await (async () => {
        const file = await ctx.telegram.getFile(ctx.message.photo[ctx.message.photo.length-1].file_id);
        const r = await axios.get(`https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`, { responseType: 'arraybuffer' });
        return Buffer.from(r.data);
      })();
      const characterDesc = await describeCharacter(imageBuffer.toString('base64'));
      await handleCreate(ctx, `${caption}. Персонаж: ${characterDesc}`, msg, imageBuffer);
    } catch (err) {
      console.error(err);
      try { await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, `❌ Ошибка: ${err.message}`); } catch {}
    }
  })();
});

// /edit
bot.command('edit', async (ctx) => {
  const userId = ctx.from.id;
  const editText = ctx.message.text.replace('/edit','').trim();
  if (!userSites[userId]) return ctx.reply('❌ Сначала создай сайт командой /create');
  if (!editText) return ctx.reply('✍️ Напиши что изменить!\nПример: /edit сделай фон темнее и добавь счётчик');
  const msg = await ctx.reply('🎨 Вношу изменения...');
  try {
    const newHtml = await generateHtml({ ...userSites[userId].plan }, false, null);
    userSites[userId].html = newHtml;
    await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, '📤 Обновляю...');
    await uploadFile(newHtml, 'index.html', userSites[userId].repoName);
    await ctx.telegram.deleteMessage(ctx.chat.id, msg.message_id);
    await ctx.reply('✅ Обновил!', Markup.inlineKeyboard([[Markup.button.callback('✏️ Ещё', 'edit_prompt'), Markup.button.callback('📥 Скачать', 'download_html')]]));
    await ctx.replyWithDocument({ source: Buffer.from(newHtml), filename: 'index.html' }, { caption: '☝️ Обновлённый сайт!' });
  } catch (err) {
    console.error(err);
    try { await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, `❌ Ошибка: ${err.message}`); } catch {}
  }
});

bot.command('download', async (ctx) => {
  const userId = ctx.from.id;
  if (!userSites[userId]) return ctx.reply('❌ Сначала создай сайт командой /create');
  await ctx.replyWithDocument({ source: Buffer.from(userSites[userId].html), filename: 'index.html' });
});

// Кнопки
bot.action('edit_prompt', (ctx) => { ctx.answerCbQuery(); ctx.reply('✍️ /edit [что изменить]'); });
bot.action('download_html', async (ctx) => {
  ctx.answerCbQuery();
  const userId = ctx.from.id;
  if (userSites[userId]) await ctx.replyWithDocument({ source: Buffer.from(userSites[userId].html), filename: 'index.html' });
});

bot.action('edit_image', async (ctx) => {
  ctx.answerCbQuery();
  const userId = ctx.from.id;
  if (!userLastImage[userId]) return ctx.reply('❌ Нет сохранённой картинки. Сначала сгенерируй через кнопку 🖼 Картинка');
  userStates[userId] = 'waiting_image_edit';
  ctx.reply(`✏️ Что изменить в картинке?\n\nТекущий промпт: "${userLastImage[userId].original}"\n\nНапиши что поменять, например:\n— сделай фон белым\n— убери оружие\n— добавь корону\n— на весь экран без круга`);
});

bot.action('regen_image', async (ctx) => {
  ctx.answerCbQuery();
  const userId = ctx.from.id;
  if (!userLastImage[userId]) return ctx.reply('❌ Нет сохранённой картинки');
  const msg = await ctx.reply('🔄 Генерирую другой вариант...');
  try {
    const { buffer, enhancedPrompt } = await generateImage(userLastImage[userId].original);
    userLastImage[userId].enhanced = enhancedPrompt;
    await ctx.telegram.deleteMessage(ctx.chat.id, msg.message_id);
    await ctx.replyWithPhoto(
      { source: buffer, filename: 'image.jpg' },
      {
        caption: `🖼 Другой вариант!\n\n📝 Промпт: ${enhancedPrompt.slice(0,200)}`,
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback('✏️ Изменить картинку', 'edit_image')],
          [Markup.button.callback('🔄 Ещё вариант', 'regen_image')]
        ]).reply_markup
      }
    );
  } catch (err) {
    try { await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, `❌ Ошибка: ${err.message}`); } catch {}
  }
});
bot.action('another_idea', async (ctx) => {
  ctx.answerCbQuery();
  const msg = await ctx.reply('💡 Думаю ещё...');
  try {
    const answer = await askClaude('Придумай ещё одну случайную крутую идею мем-токена, другую тему.', ctx.from.id);
    await ctx.telegram.deleteMessage(ctx.chat.id, msg.message_id);
    await ctx.reply(answer, Markup.inlineKeyboard([[Markup.button.callback('💡 Ещё', 'another_idea')]]));
  } catch {}
});
bot.action('create_from_idea', (ctx) => {
  ctx.answerCbQuery();
  ctx.reply('✍️ Скопируй идею и напиши:\n/create [описание токена из идеи выше]');
});

bot.launch();
console.log('🤖 CloseKnuazAI запущен!');
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
