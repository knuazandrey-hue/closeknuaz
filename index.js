require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const Anthropic = require('@anthropic-ai/sdk');
const axios = require('axios');

const bot = new Telegraf(process.env.BOT_TOKEN);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Храним данные пользователей (текущий HTML сайта)
const userSites = {};

// ─── Функция: генерация сайта через Claude ───────────────────────────────────
async function generateSite(description, existingHtml = null) {
  let prompt;
  if (existingHtml) {
    prompt = `Вот текущий HTML сайта мем-токена:\n\n${existingHtml}\n\nВнеси следующее изменение: ${description}\n\nВерни ТОЛЬКО полный обновлённый HTML без объяснений.`;
  } else {
    prompt = `Создай красивый одностраничный HTML сайт для мем-токена криптовалюты.
Описание токена: ${description}

Требования:
- Современный дизайн в стиле крипто/мем (тёмный фон, яркие акценты)
- Секции: Hero (название + слоган), Tokenomics, Roadmap, How to Buy, Community
- Анимации CSS
- Адаптивный (mobile-friendly)
- Кнопки: Buy on pump.fun, Telegram, Twitter
- Весёлый мем-стиль

Верни ТОЛЬКО чистый HTML код без объяснений, без markdown блоков.`;
  }

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt }]
  });

  let html = response.content[0].text;
  html = html.replace(/```html/g, '').replace(/```/g, '').trim();
  return html;
}

// ─── Функция: деплой на GitHub Pages ─────────────────────────────────────────
async function deployToGitHub(html, repoName) {
  const headers = {
    Authorization: `token ${process.env.GITHUB_TOKEN}`,
    Accept: 'application/vnd.github.v3+json',
    'Content-Type': 'application/json'
  };
  const username = process.env.GITHUB_USERNAME;

  // Проверяем существует ли репо
  let sha = null;
  try {
    const fileRes = await axios.get(
      `https://api.github.com/repos/${username}/${repoName}/contents/index.html`,
      { headers }
    );
    sha = fileRes.data.sha;
  } catch (e) {
    // Репо не существует — создаём
    try {
      await axios.post('https://api.github.com/user/repos', {
        name: repoName,
        auto_init: true,
        private: false
      }, { headers });
      await new Promise(r => setTimeout(r, 2000));

      // Включаем GitHub Pages
      await axios.post(
        `https://api.github.com/repos/${username}/${repoName}/pages`,
        { source: { branch: 'main', path: '/' } },
        { headers }
      );
    } catch (err) {
      // Репо уже есть, игнорируем ошибку
    }
  }

  // Загружаем/обновляем index.html
  const content = Buffer.from(html).toString('base64');
  const body = {
    message: 'Update site',
    content,
    ...(sha && { sha })
  };

  await axios.put(
    `https://api.github.com/repos/${username}/${repoName}/contents/index.html`,
    body,
    { headers }
  );

  return `https://${username}.github.io/${repoName}`;
}

// ─── /start ───────────────────────────────────────────────────────────────────
bot.start((ctx) => {
  ctx.reply(
    `👋 Привет! Я бот для создания сайтов мем-токенов!

Что я умею:
🌐 /create — создать новый сайт токена
✏️ /edit — редактировать текущий сайт
📥 /download — скачать HTML файл
❓ /help — помощь

Напиши /create чтобы начать!`
  );
});

// ─── /help ────────────────────────────────────────────────────────────────────
bot.help((ctx) => {
  ctx.reply(
    `📖 Как пользоваться:

/create [описание] — создать сайт
Пример: /create токен PEPE, зелёная лягушка, 1 миллиард монет, смешной

/edit [что изменить] — изменить сайт
Пример: /edit сделай фон чёрным и добавь больше эмодзи

/download — получить HTML файл сайта`
  );
});

// ─── /create ──────────────────────────────────────────────────────────────────
bot.command('create', async (ctx) => {
  const description = ctx.message.text.replace('/create', '').trim();

  if (!description) {
    return ctx.reply('✍️ Напиши описание токена после команды!\n\nПример:\n/create токен DOGE, собака шиба-ину, 420 миллиардов монет, весёлый мем');
  }

  const msg = await ctx.reply('⏳ Генерирую сайт... это займёт 20-30 секунд');

  try {
    const html = await generateSite(description);
    const userId = ctx.from.id;
    const repoName = `token-${userId}`;

    userSites[userId] = { html, repoName };

    await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, '📤 Деплою на GitHub...');

    const url = await deployToGitHub(html, repoName);

    await ctx.telegram.editMessageText(
      ctx.chat.id, msg.message_id, null,
      `✅ Сайт готов!\n\n🔗 ${url}\n\n⚠️ Первый раз GitHub Pages активируется 2-5 минут — потом будет доступен по ссылке.`,
      Markup.inlineKeyboard([
        [Markup.button.callback('✏️ Редактировать', 'edit_prompt')],
        [Markup.button.callback('📥 Скачать HTML', 'download_html')]
      ])
    );
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
    return ctx.reply('✍️ Напиши что изменить!\n\nПример:\n/edit сделай фон чёрным и добавь раздел FAQ');
  }

  const msg = await ctx.reply('⏳ Вношу изменения...');

  try {
    const { html: oldHtml, repoName } = userSites[userId];
    const newHtml = await generateSite(editText, oldHtml);
    userSites[userId].html = newHtml;

    await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, '📤 Обновляю сайт...');

    const url = await deployToGitHub(newHtml, repoName);

    await ctx.telegram.editMessageText(
      ctx.chat.id, msg.message_id, null,
      `✅ Сайт обновлён!\n\n🔗 ${url}\n\n(Изменения появятся через 1-2 минуты)`,
      Markup.inlineKeyboard([
        [Markup.button.callback('✏️ Ещё изменение', 'edit_prompt')],
        [Markup.button.callback('📥 Скачать HTML', 'download_html')]
      ])
    );
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

  const { html } = userSites[userId];
  await ctx.replyWithDocument({
    source: Buffer.from(html),
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
