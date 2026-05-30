require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const Anthropic = require('@anthropic-ai/sdk');
const axios = require('axios');

const bot = new Telegraf(process.env.BOT_TOKEN, {
  handlerTimeout: 600000
});
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const userSites = {};

// ─── Генерация сайта ──────────────────────────────────────────────────────────
async function generateSite(description, existingHtml = null, imageBase64 = null) {
  let prompt;

  if (existingHtml) {
    prompt = `Вот текущий HTML сайта мем-токена:\n\n${existingHtml}\n\nВнеси следующее изменение: ${description}\n\nВерни ТОЛЬКО полный обновлённый HTML без объяснений.`;
  } else {
    prompt = `Ты — топовый веб-дизайнер и разработчик крипто-сайтов. Создай ПРОФЕССИОНАЛЬНЫЙ, КРАСИВЫЙ и СЛОЖНЫЙ одностраничный HTML сайт для мем-токена.

Описание токена: ${description}
${imageBase64 ? '\nНа картинке — персонаж/логотип токена. Встрой его как base64 в img тег в hero секцию и используй как основу всего дизайна.' : ''}

═══════════════════════════════════════
ОБЯЗАТЕЛЬНЫЕ ТРЕБОВАНИЯ К ДИЗАЙНУ:
═══════════════════════════════════════

🎨 ВИЗУАЛ:
- Тёмный фон с красивым градиентом или паттерном (не просто чёрный)
- Частицы или звёзды на фоне (анимированные через CSS/JS)
- Неоновые акценты и свечение (box-shadow, text-shadow)
- Стеклянный эффект (glassmorphism) для карточек: backdrop-filter: blur()
- Плавные анимации появления при скролле (Intersection Observer)
- Параллакс эффект на hero секции
- Анимированный градиент на заголовке

🏗️ СЕКЦИИ (все обязательны):
1. НАВИГАЦИЯ — фиксированная, с blur эффектом, ссылки на секции
2. HERO — огромный заголовок, слоган, анимированный логотип, кнопки Buy + Telegram + Twitter
3. ABOUT — история токена, почему он лучший
4. TOKENOMICS — красивая круговая диаграмма через CSS, проценты распределения
5. ROADMAP — красивый таймлайн Q1/Q2/Q3/Q4
6. HOW TO BUY — пошаговая инструкция с иконками
7. МИНИ-ИГРА — кликер: нажимаешь на персонажа и зарабатываешь токены
8. COMMUNITY — ссылки на соцсети
9. FOOTER — копирайт, дисклеймер

⚡ АНИМАЦИИ (все обязательны):
- Печатающийся текст (typewriter effect) в hero
- Счётчик который анимированно считает вверх
- Floating анимация для логотипа
- Hover эффекты на кнопках (scale + glow)
- Появление элементов при скролле (fadeInUp)

🎮 МИНИ-ИГРА:
- Большой персонаж в центре, при клике +1 токен
- Анимация "+1" улетает вверх при клике
- Счётчик токенов, уровни каждые 100 кликов

💎 КОД:
- Всё в одном HTML файле
- Никаких внешних библиотек кроме Google Fonts
- Адаптивный дизайн
- Минимум 500 строк кода

Верни ТОЛЬКО чистый HTML код. Без объяснений. Без markdown. Без \`\`\`.`;
  }

  let messages;
  if (imageBase64 && !existingHtml) {
    messages = [{ role: 'user', content: [
      { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 } },
      { type: 'text', text: prompt }
    ]}];
  } else {
    messages = [{ role: 'user', content: prompt }];
  }

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 8000,
    messages
  });

  let html = response.content[0].text;
  html = html.replace(/```html/g, '').replace(/```/g, '').trim();
  return html;
}

// ─── Генерация описания что было сделано ─────────────────────────────────────
async function generateDescription(description, isEdit = false, editText = '') {
  const prompt = isEdit
    ? `Ты — весёлый бот который только что обновил сайт мем-токена. Изменение которое попросили: "${editText}". Напиши короткое сообщение (3-5 предложений) в неформальном стиле — что именно ты изменил, что добавил, как это выглядит. Без лишних слов, живо и с характером. Можно использовать эмодзи.`
    : `Ты — весёлый бот который только что сделал сайт мем-токена. Описание токена: "${description}". Напиши короткое сообщение (4-6 предложений) в неформальном стиле — придумай имя токену если не указано, расскажи что ты сделал на сайте, какие секции добавил, какая игра, какой дизайн. Без лишних слов, живо и с характером как будто ты реальный чел. Можно использовать эмодзи.`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 300,
    messages: [{ role: 'user', content: prompt }]
  });

  return response.content[0].text;
}

// ─── Скачать фото из Telegram ─────────────────────────────────────────────────
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
    const fileRes = await axios.get(
      `https://api.github.com/repos/${username}/${repoName}/contents/index.html`,
      { headers }
    );
    sha = fileRes.data.sha;
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

  return `https://${username}.github.io/${repoName}`;
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

// ─── /help ────────────────────────────────────────────────────────────────────
bot.help((ctx) => {
  ctx.reply(`📖 Как пользоваться:

/create [описание] — создать сайт текстом
Пример: /create токен GOVNO, желтый слон, tg @mytoken, twitter @mytoken

Или отправь 🖼 картинку с описанием в подписи!

/edit [что изменить] — изменить сайт
Пример: /edit добавь счётчик холдеров и измени цвет на зелёный

/download — получить HTML файл сайта`);
});

// ─── /create ──────────────────────────────────────────────────────────────────
bot.command('create', async (ctx) => {
  const description = ctx.message.text.replace('/create', '').trim();

  if (!description) {
    return ctx.reply('✍️ Напиши описание токена!\n\nПример:\n/create токен PEPE, зелёная лягушка, tg @pepe, twitter @pepe\n\nИли отправь картинку с подписью!');
  }

  const msg = await ctx.reply('⏳ Погнали, делаю сайт... займёт минуту-две, не гони 🔥');

  try {
    const html = await generateSite(description);
    const userId = ctx.from.id;
    const repoName = `token-${userId}`;
    userSites[userId] = { html, repoName };

    await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, '📝 Пишу что сделал...');
    const summary = await generateDescription(description);

    await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, '📤 Деплою...');
    await deployToGitHub(html, repoName);

    await ctx.telegram.deleteMessage(ctx.chat.id, msg.message_id);

    await ctx.reply(summary, Markup.inlineKeyboard([
      [Markup.button.callback('✏️ Редактировать', 'edit_prompt')],
      [Markup.button.callback('📥 Скачать HTML', 'download_html')]
    ]));

    await ctx.replyWithDocument({
      source: Buffer.from(html),
      filename: 'index.html'
    }, { caption: '☝️ Вот твой сайт, открывай в браузере или деплой куда хочешь!' });

  } catch (err) {
    console.error(err);
    await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, `❌ Ошибка: ${err.message}`);
  }
});

// ─── Обработка фото ───────────────────────────────────────────────────────────
bot.on('photo', async (ctx) => {
  const userId = ctx.from.id;
  const caption = ctx.message.caption || '';

  if (!caption) {
    return ctx.reply('✍️ Добавь описание к картинке!\n\nОтправь фото и в подписи напиши:\nнапример: токен BUNNY, tg @bunny, twitter @bunny');
  }

  const msg = await ctx.reply('⏳ О, картинка есть! Делаю сайт с твоим персонажем... минута-две 🔥');

  try {
    const photos = ctx.message.photo;
    const fileId = photos[photos.length - 1].file_id;
    const imageBase64 = await downloadPhoto(ctx, fileId);

    const html = await generateSite(caption, null, imageBase64);
    const repoName = `token-${userId}`;
    userSites[userId] = { html, repoName };

    await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, '📝 Пишу что сделал...');
    const summary = await generateDescription(caption);

    await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, '📤 Деплою...');
    await deployToGitHub(html, repoName);

    await ctx.telegram.deleteMessage(ctx.chat.id, msg.message_id);

    await ctx.reply(summary, Markup.inlineKeyboard([
      [Markup.button.callback('✏️ Редактировать', 'edit_prompt')],
      [Markup.button.callback('📥 Скачать HTML', 'download_html')]
    ]));

    await ctx.replyWithDocument({
      source: Buffer.from(html),
      filename: 'index.html'
    }, { caption: '☝️ Вот твой сайт с персонажем!' });

  } catch (err) {
    console.error(err);
    await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, `❌ Ошибка: ${err.message}`);
  }
});

// ─── /edit ────────────────────────────────────────────────────────────────────
bot.command('edit', async (ctx) => {
  const userId = ctx.from.id;
  const editText = ctx.message.text.replace('/edit', '').trim();

  if (!userSites[userId]) {
    return ctx.reply('❌ Сначала создай сайт командой /create');
  }
  if (!editText) {
    return ctx.reply('✍️ Напиши что изменить!\n\nПример:\n/edit добавь игру кликер и измени цвет на фиолетовый');
  }

  const msg = await ctx.reply('⏳ Ок, вношу изменения... минута 🔧');

  try {
    const { html: oldHtml, repoName } = userSites[userId];
    const newHtml = await generateSite(editText, oldHtml);
    userSites[userId].html = newHtml;

    await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, '📝 Пишу что изменил...');
    const summary = await generateDescription('', true, editText);

    await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, '📤 Обновляю...');
    await deployToGitHub(newHtml, repoName);

    await ctx.telegram.deleteMessage(ctx.chat.id, msg.message_id);

    await ctx.reply(summary, Markup.inlineKeyboard([
      [Markup.button.callback('✏️ Ещё изменение', 'edit_prompt')],
      [Markup.button.callback('📥 Скачать HTML', 'download_html')]
    ]));

    await ctx.replyWithDocument({
      source: Buffer.from(newHtml),
      filename: 'index.html'
    }, { caption: '☝️ Обновлённый сайт!' });

  } catch (err) {
    console.error(err);
    await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, `❌ Ошибка: ${err.message}`);
  }
});

// ─── /download ────────────────────────────────────────────────────────────────
bot.command('download', async (ctx) => {
  const userId = ctx.from.id;
  if (!userSites[userId]) {
    return ctx.reply('❌ Сначала создай сайт командой /create');
  }
  await ctx.replyWithDocument({
    source: Buffer.from(userSites[userId].html),
    filename: 'index.html'
  });
});

// ─── Кнопки ───────────────────────────────────────────────────────────────────
bot.action('edit_prompt', (ctx) => {
  ctx.answerCbQuery();
  ctx.reply('✍️ Напиши что изменить:\n\n/edit [твои изменения]');
});

bot.action('download_html', async (ctx) => {
  ctx.answerCbQuery();
  const userId = ctx.from.id;
  if (userSites[userId]) {
    await ctx.replyWithDocument({
      source: Buffer.from(userSites[userId].html),
      filename: 'index.html'
    });
  }
});

// ─── Запуск ───────────────────────────────────────────────────────────────────
bot.launch();
console.log('🤖 Бот запущен!');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
