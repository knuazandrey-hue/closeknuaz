require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const Anthropic = require('@anthropic-ai/sdk');
const axios = require('axios');

const bot = new Telegraf(process.env.BOT_TOKEN, { handlerTimeout: 600000 });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const userSites = {};

async function describeCharacter(imageBase64) {
  const response = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 300,
    messages: [{ role: 'user', content: [
      { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 } },
      { type: 'text', text: 'Опиши персонажа кратко: цвет, форма, стиль, настроение. 2-3 предложения.' }
    ]}]
  });
  return response.content[0].text;
}

async function generateSite(description, existingHtml = null) {
  let prompt;
  if (existingHtml) {
    prompt = `Вот HTML сайта:\n\n${existingHtml}\n\nИзмени: ${description}\n\nВерни ТОЛЬКО полный HTML.`;
  } else {
    prompt = `Создай одностраничный HTML сайт для мем-токена. Описание: ${description}

СТРОГИЕ ПРАВИЛА:
1. Весь контент должен быть ВИДИМ сразу — НЕ используй opacity:0, visibility:hidden, display:none на секциях
2. Анимации только через @keyframes — не через JS классы
3. Один HTML файл, CSS и JS внутри тегов <style> и <script>
4. Никаких внешних библиотек кроме Google Fonts

СТРУКТУРА САЙТА:

<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background: #05001a; color: #fff; font-family: 'Space Grotesk', sans-serif; }
  
  /* АНИМАЦИИ */
  @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-15px)} }
  @keyframes glow { 0%,100%{text-shadow:0 0 20px #b44dff} 50%{text-shadow:0 0 50px #b44dff, 0 0 80px #7700ff} }
  @keyframes fadeIn { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
  @keyframes gradientBG { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
  @keyframes pulse { 0%,100%{box-shadow:0 0 20px #b44dff} 50%{box-shadow:0 0 50px #b44dff, 0 0 100px #b44dff} }
  @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
  
  /* НАВБАР */
  nav { position:fixed; top:0; width:100%; background:rgba(5,0,26,0.9); backdrop-filter:blur(20px); padding:15px 40px; display:flex; justify-content:space-between; align-items:center; z-index:1000; border-bottom:1px solid rgba(180,77,255,0.3); }
  
  /* HERO */
  .hero { min-height:100vh; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding:100px 20px; background: linear-gradient(135deg, #05001a, #0d0040, #001a05); background-size:400% 400%; animation: gradientBG 8s ease infinite; }
  .hero h1 { font-size:clamp(3rem,8vw,7rem); font-weight:900; background:linear-gradient(90deg,#b44dff,#00ffcc,#ff4dff); -webkit-background-clip:text; -webkit-text-fill-color:transparent; animation:fadeIn 1s ease, glow 3s ease infinite; margin-bottom:20px; }
  .hero p { font-size:1.5rem; color:#ccc; margin-bottom:40px; animation:fadeIn 1.5s ease; }
  .logo-container { font-size:120px; animation:float 3s ease-in-out infinite; margin-bottom:30px; }
  .btn { display:inline-block; padding:15px 35px; margin:10px; border:2px solid #b44dff; color:#b44dff; text-decoration:none; border-radius:50px; font-weight:700; font-size:1rem; transition:all 0.3s; animation:pulse 2s infinite; cursor:pointer; background:transparent; }
  .btn:hover { background:#b44dff; color:#fff; transform:translateY(-3px); }
  .btn.primary { background:linear-gradient(90deg,#b44dff,#7700ff); color:#fff; border:none; }
  
  /* СЕКЦИИ */
  section { padding:100px 20px; max-width:1200px; margin:0 auto; }
  h2 { font-size:3rem; text-align:center; margin-bottom:60px; background:linear-gradient(90deg,#b44dff,#00ffcc); -webkit-background-clip:text; -webkit-text-fill-color:transparent; }
  
  /* КАРТОЧКИ */
  .cards { display:grid; grid-template-columns:repeat(auto-fit,minmax(250px,1fr)); gap:25px; }
  .card { background:rgba(255,255,255,0.05); backdrop-filter:blur(10px); border:1px solid rgba(180,77,255,0.3); border-radius:20px; padding:30px; transition:all 0.3s; }
  .card:hover { transform:translateY(-10px); border-color:#b44dff; box-shadow:0 20px 40px rgba(180,77,255,0.3); }
  
  /* TOKENOMICS */
  .tokenomics-chart { width:250px; height:250px; border-radius:50%; background: conic-gradient(#b44dff 0% 40%, #00ffcc 40% 60%, #ff4dff 60% 75%, #ffaa00 75% 85%, #00aaff 85% 100%); margin:0 auto 40px; position:relative; animation:spin 20s linear infinite; }
  .tokenomics-chart::after { content:''; position:absolute; width:60%; height:60%; background:#05001a; border-radius:50%; top:20%; left:20%; }
  
  /* ROADMAP */
  .timeline { position:relative; padding:20px 0; }
  .timeline-item { display:flex; gap:30px; margin-bottom:40px; padding:25px; background:rgba(255,255,255,0.05); border-radius:15px; border-left:4px solid #b44dff; }
  
  /* ИГРА */
  #game { text-align:center; padding:80px 20px; background:rgba(180,77,255,0.05); }
  #clicker { font-size:100px; cursor:pointer; display:inline-block; animation:float 2s ease-in-out infinite; user-select:none; transition:transform 0.1s; }
  #clicker:active { transform:scale(0.85); }
  .score-board { font-size:2rem; margin:20px 0; color:#b44dff; font-weight:700; }
  
  /* FOOTER */
  footer { text-align:center; padding:40px; border-top:1px solid rgba(180,77,255,0.2); color:#666; }
  
  /* ЧАСТИЦЫ */
  #particles { position:fixed; top:0; left:0; z-index:0; pointer-events:none; }
  
  @media(max-width:768px) { nav { padding:15px; } .hero h1 { font-size:3rem; } }
</style>

СЕКЦИИ:
1. Навигация с логотипом и ссылками
2. Hero: логотип (большой эмодзи или ASCII арт), название, слоган, 3 кнопки (Buy on Pump.fun, Twitter, Telegram)
3. Статы: 3 карточки - Holders: 10,000+, Market Cap: $1M+, Total Supply: 1B
4. About: 3 карточки с описанием токена
5. Tokenomics: круговая диаграмма + список (40% публика, 20% ликвидность, 15% команда, 10% маркетинг, 15% резерв)
6. Roadmap: 4 этапа Q1-Q4
7. How to Buy: 4 шага
8. Игра-кликер: нажимаешь на персонажа = +1 токен, счётчик, уровни
9. Community: карточки соцсетей  
10. Footer с дисклеймером

JS:
- Canvas частицы на фоне
- Кликер с счётчиком и уровнями (каждые 100 кликов новый уровень)
- Typewriter для слогана в hero

Верни ТОЛЬКО HTML начиная с <!DOCTYPE html>. Без объяснений. Без \`\`\`.`;
  }

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 16000,
    messages: [{ role: 'user', content: prompt }]
  });

  let html = response.content[0].text;
  html = html.replace(/```html/g, '').replace(/```/g, '').trim();
  
  // Проверяем что HTML не обрезан
  if (!html.includes('</html>')) {
    html += '\n</body></html>';
  }
  
  return html;
}

async function generateSummary(description, isEdit = false, editText = '') {
  const prompt = isEdit
    ? `Ты весёлый бот. Обновил сайт токена. Что сделал: "${editText}". Напиши 3 предложения текстом, неформально. БЕЗ HTML кода.`
    : `Ты весёлый бот. Сделал сайт мем-токена. Описание: "${description}". Напиши 4 предложения текстом неформально — имя токена, что сделал, дизайн, игра. БЕЗ HTML кода. Говори как живой чел с характером.`;

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 200,
    messages: [{ role: 'user', content: prompt }]
  });
  
  let text = response.content[0].text;
  // Убираем HTML если вдруг попал
  text = text.replace(/<[^>]*>/g, '').replace(/```[\s\S]*?```/g, '').trim();
  return text;
}

async function downloadPhoto(ctx, fileId) {
  const file = await ctx.telegram.getFile(fileId);
  const url = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;
  const response = await axios.get(url, { responseType: 'arraybuffer' });
  return Buffer.from(response.data).toString('base64');
}

async function deployToGitHub(html, repoName) {
  const headers = { Authorization: `token ${process.env.GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json', 'Content-Type': 'application/json' };
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
  await axios.put(`https://api.github.com/repos/${username}/${repoName}/contents/index.html`, { message: 'Update site', content, ...(sha && { sha }) }, { headers });
}

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
    await ctx.replyWithDocument({ source: Buffer.from(html), filename: 'index.html' }, { caption: '☝️ Открывай в браузере!' });
  } catch (err) {
    console.error(err);
    try { await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, `❌ Ошибка: ${err.message}`); } catch(e) {}
  }
}

bot.start((ctx) => ctx.reply(`👋 Зд перцы! Я бот для создания сайтов, меня зовут CloseKnuazAI!\n\nЧо я могу крч рассказываю:\n🌐 /create — создать сайт\n✏️ /edit — редактировать текущий сайт\n📥 /download — скачать HTML файл\n❓ /help — расскажу чд могу поподробнее\n\nКрч жми /create чтобы начать!`));

bot.help((ctx) => ctx.reply(`📖 Как пользоваться:\n\n/create [описание] — создать сайт\nПример: /create токен PEPE, зелёная лягушка, tg @pepe, twitter @pepe\n\nИли отправь 🖼 картинку с подписью!\n\n/edit [что изменить] — изменить сайт\n/download — получить HTML файл`));

bot.command('create', async (ctx) => {
  const description = ctx.message.text.replace('/create', '').trim();
  if (!description) return ctx.reply('✍️ Напиши описание!\n\nПример:\n/create токен PEPE, зелёная лягушка, tg @pepe, twitter @pepe');
  const msg = await ctx.reply('⏳ Погнали! 2-3 минуты 🔥');
  await handleCreate(ctx, description, msg);
});

bot.on('photo', async (ctx) => {
  const caption = ctx.message.caption || '';
  if (!caption) return ctx.reply('✍️ Добавь подпись к картинке!\n\nПример: токен BUNNY, tg @bunny, twitter @bunny');
  const msg = await ctx.reply('⏳ Вижу картинку! 👀');
  try {
    const photos = ctx.message.photo;
    const imageBase64 = await downloadPhoto(ctx, photos[photos.length - 1].file_id);
    await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, '👀 Описываю персонажа...');
    const characterDesc = await describeCharacter(imageBase64);
    await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, '⏳ Делаю сайт... 2-3 минуты 🔥');
    await handleCreate(ctx, `${caption}. Персонаж: ${characterDesc}`, msg);
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
  try {
    const newHtml = await generateSite(editText, userSites[userId].html);
    userSites[userId].html = newHtml;
    await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, '📝 Пишу что изменил...');
    const summary = await generateSummary('', true, editText);
    await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, '📤 Обновляю...');
    await deployToGitHub(newHtml, userSites[userId].repoName);
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

bot.action('edit_prompt', (ctx) => { ctx.answerCbQuery(); ctx.reply('✍️ /edit [что изменить]'); });
bot.action('download_html', async (ctx) => {
  ctx.answerCbQuery();
  const userId = ctx.from.id;
  if (userSites[userId]) await ctx.replyWithDocument({ source: Buffer.from(userSites[userId].html), filename: 'index.html' });
});

bot.launch();
console.log('🤖 Бот запущен!');
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
