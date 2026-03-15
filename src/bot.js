require("dotenv").config();

const { Telegraf, Markup } = require("telegraf");
const { createDb } = require("./db");

const BOT_TOKEN = process.env.BOT_TOKEN;
const SUBSCRIPTION_REQUIRED = String(process.env.SUBSCRIPTION_REQUIRED || "true").toLowerCase() === "true";
const REQUIRED_CHANNEL_ID = process.env.REQUIRED_CHANNEL_ID;
const REQUIRED_CHANNEL_URL = process.env.REQUIRED_CHANNEL_URL;
const DATABASE_PATH = process.env.DATABASE_PATH || "./data/promo.sqlite";
const ADMIN_IDS = new Set(
  String(process.env.ADMIN_IDS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
);

if (!BOT_TOKEN) {
  throw new Error("BOT_TOKEN is required");
}

if (SUBSCRIPTION_REQUIRED && (!REQUIRED_CHANNEL_ID || !REQUIRED_CHANNEL_URL)) {
  throw new Error("REQUIRED_CHANNEL_ID and REQUIRED_CHANNEL_URL are required");
}

const bot = new Telegraf(BOT_TOKEN);
const db = createDb(DATABASE_PATH);
const sessionState = new Map();

const translations = {
  ru: {
    buttons: {
      checkSubscription: "✅ Проверить подписку",
      sendPhone: "📱 Отправить номер",
      enterCode: "🎟 Ввести промокод",
      stats: "📊 Моя статистика",
      help: "ℹ️ Как это работает",
      language: "🌐 Сменить язык",
      openChannel: "📢 Открыть канал",
      confirmSubscription: "✅ Я подписался",
      chooseRussian: "🇷🇺 Русский",
      chooseUzbek: "🇺🇿 O'zbekcha"
    },
    messages: {
      chooseLanguage: "🌐 <b>Выберите язык интерфейса</b>",
      welcome:
        "🎉 <b>Добро пожаловать в Bag & Pack Promo</b>\n\nЗдесь вы можете участвовать в акции, отправлять промокоды и смотреть только <b>свою</b> статистику.\n\n🏆 Общий рейтинг участников скрыт.",
      help:
        "ℹ️ <b>Как работает акция</b>\n\n1. Подтвердите участие.\n2. Обязательно отправьте номер телефона.\n3. Вводите промокоды с товаров.\n4. Следите за своей статистикой.\n\n🎁 Побеждает участник с наибольшим количеством принятых кодов.",
      needPhone:
        "📱 <b>Для участия нужно обязательно указать номер телефона</b>\n\nБез номера телефона ботом пользоваться нельзя.\n\nОтправьте номер кнопкой ниже или напишите его вручную в формате <b>+998901234567</b>.",
      enterPhoneFirst:
        "📱 Сначала обязательно отправьте номер телефона. Пока номер не сохранён, остальные функции недоступны.",
      phoneSaved:
        "✅ <b>Номер телефона сохранён</b>\n\nТеперь вы можете пользоваться ботом и отправлять промокоды.",
      phoneAlreadyUsed:
        "⚠️ Этот номер уже используется другим участником. Если это ошибка, свяжитесь с администратором.",
      savePhoneError: "❌ Не удалось сохранить номер телефона. Попробуйте ещё раз.",
      sendOwnPhone: "⚠️ Пожалуйста, отправьте именно свой номер телефона.",
      subscriptionRequired:
        "📢 Чтобы участвовать в акции, сначала подпишитесь на наш Telegram-канал, затем нажмите кнопку проверки.",
      subscriptionNotFound:
        "⚠️ Подписка пока не подтверждена. Подпишитесь на канал и попробуйте ещё раз.",
      subscriptionConfirmedPhone:
        "✅ Подписка подтверждена.\n\nТеперь обязательно отправьте номер телефона.",
      subscriptionConfirmed: "✅ Подписка подтверждена. Теперь можно пользоваться ботом.",
      subscriptionOff: "🧪 Проверка подписки отключена. Сейчас бот работает в тестовом режиме.",
      promptCode:
        "🎟 <b>Введите промокод</b>\n\nОтправьте код одним сообщением. После проверки я покажу, сколько кодов уже принято.",
      codeAccepted:
        "✅ <b>Промокод принят</b>\n\n📦 Товар: <b>{product}</b>\n🎟 Всего ваших кодов: <b>{count}</b>\n\n🔒 Ваше место в общем рейтинге скрыто.",
      codeNotFound: "❌ Такой промокод не найден. Проверьте, правильно ли вы его ввели.",
      codeAlreadyUsed: "⚠️ Этот промокод уже использован другим участником.",
      codeAlreadyUsedByYou: "ℹ️ Этот промокод уже записан на вас.",
      registrationRequired:
        "📱 Сначала завершите регистрацию и обязательно отправьте номер телефона.",
      unknownError: "❌ Что-то пошло не так. Попробуйте ещё раз.",
      statsTitle: "📊 <b>Ваша статистика</b>",
      phoneLine: "📱 Телефон: <b>{phone}</b>",
      totalCodes: "🎟 Принято промокодов: <b>{count}</b>",
      favoriteProduct: "📦 Чаще всего у вас товар: <b>{product}</b> ({count})",
      noFavorite: "📦 Пока ещё нет лидирующего товара.",
      breakdownTitle: "📋 Статистика по товарам:",
      noCodesYet: "Пока нет ни одного принятого кода.",
      hiddenRank: "🔒 Ваше место в общем рейтинге участникам не показывается.",
      languageUpdated: "✅ Язык интерфейса обновлён.",
      adminOnly: "⛔ Эта команда доступна только администратору.",
      leaderboardTitle: "🏆 <b>Топ участников</b>",
      noLeadersYet: "Пока нет участников с принятыми промокодами.",
      noName: "Без имени",
      noPhone: "без телефона",
      codesWord: "кодов",
      adminUserExample: "Пример: /admin_user 998901234567 или /admin_user @username",
      userNotFound: "Участник не найден.",
      participant: "👤 Участник: <b>{name}</b>",
      username: "Username: {username}",
      telegramId: "Telegram ID: {id}",
      enteredCodes: "🎟 Всего кодов: <b>{count}</b>"
    }
  },
  uz: {
    buttons: {
      checkSubscription: "✅ Obunani tekshirish",
      sendPhone: "📱 Telefon yuborish",
      enterCode: "🎟 Promokod kiritish",
      stats: "📊 Mening statistikam",
      help: "ℹ️ Qoidalar",
      language: "🌐 Tilni almashtirish",
      openChannel: "📢 Kanalni ochish",
      confirmSubscription: "✅ A'zo bo'ldim",
      chooseRussian: "🇷🇺 Русский",
      chooseUzbek: "🇺🇿 O'zbekcha"
    },
    messages: {
      chooseLanguage: "🌐 <b>Interfeys tilini tanlang</b>",
      welcome:
        "🎉 <b>Bag & Pack Promo ga xush kelibsiz</b>\n\nBu yerda siz aksiyada qatnashishingiz, promokod yuborishingiz va faqat <b>o'zingizning</b> statistikangizni ko'rishingiz mumkin.\n\n🏆 Umumiy reyting yashiriladi.",
      help:
        "ℹ️ <b>Aksiya qanday ishlaydi</b>\n\n1. Ishtirokni tasdiqlang.\n2. Telefon raqamingizni majburiy yuboring.\n3. Tovar promokodlarini kiriting.\n4. Statistikangizni kuzating.\n\n🎁 Eng ko'p qabul qilingan kod yuborgan ishtirokchi g'olib bo'ladi.",
      needPhone:
        "📱 <b>Ishtirok etish uchun telefon raqami majburiy</b>\n\nTelefon raqamisiz botdan foydalanib bo'lmaydi.\n\nPastdagi tugma orqali yuboring yoki qo'lda <b>+998901234567</b> formatida yozing.",
      enterPhoneFirst:
        "📱 Avval telefon raqamingizni yuboring. Telefon saqlanmaguncha boshqa funksiyalar ochilmaydi.",
      phoneSaved:
        "✅ <b>Telefon raqami saqlandi</b>\n\nEndi botdan foydalanishingiz va promokod yuborishingiz mumkin.",
      phoneAlreadyUsed:
        "⚠️ Bu telefon raqami boshqa ishtirokchi tomonidan ishlatilgan. Xato bo'lsa, administratorga yozing.",
      savePhoneError: "❌ Telefon raqamini saqlab bo'lmadi. Yana urinib ko'ring.",
      sendOwnPhone: "⚠️ Iltimos, aynan o'zingizning telefon raqamingizni yuboring.",
      subscriptionRequired:
        "📢 Aksiyada qatnashish uchun avval Telegram kanalimizga a'zo bo'ling, keyin tekshirish tugmasini bosing.",
      subscriptionNotFound:
        "⚠️ Obuna hali tasdiqlanmadi. Kanalga a'zo bo'lib, yana urinib ko'ring.",
      subscriptionConfirmedPhone:
        "✅ Obuna tasdiqlandi.\n\nEndi telefon raqamingizni majburiy yuboring.",
      subscriptionConfirmed: "✅ Obuna tasdiqlandi. Endi botdan foydalanishingiz mumkin.",
      subscriptionOff: "🧪 Obuna tekshiruvi o'chirilgan. Bot test rejimida ishlayapti.",
      promptCode:
        "🎟 <b>Promokodni kiriting</b>\n\nKodni bitta xabar bilan yuboring. Tekshiruvdan so'ng jami kodlar sonini ko'rsataman.",
      codeAccepted:
        "✅ <b>Promokod qabul qilindi</b>\n\n📦 Tovar: <b>{product}</b>\n🎟 Jami kodlaringiz: <b>{count}</b>\n\n🔒 Umumiy reytingdagi o'rningiz yashirin.",
      codeNotFound: "❌ Bunday promokod topilmadi. To'g'ri kiritilganini tekshiring.",
      codeAlreadyUsed: "⚠️ Bu promokod boshqa ishtirokchi tomonidan ishlatilgan.",
      codeAlreadyUsedByYou: "ℹ️ Bu promokod allaqachon sizga biriktirilgan.",
      registrationRequired:
        "📱 Avval ro'yxatdan o'ting va telefon raqamingizni majburiy yuboring.",
      unknownError: "❌ Nimadir xato ketdi. Yana urinib ko'ring.",
      statsTitle: "📊 <b>Sizning statistikangiz</b>",
      phoneLine: "📱 Telefon: <b>{phone}</b>",
      totalCodes: "🎟 Qabul qilingan promokodlar: <b>{count}</b>",
      favoriteProduct: "📦 Sizda eng ko'p tovar: <b>{product}</b> ({count})",
      noFavorite: "📦 Hozircha yetakchi tovar yo'q.",
      breakdownTitle: "📋 Tovarlar bo'yicha statistika:",
      noCodesYet: "Hozircha qabul qilingan kodlar yo'q.",
      hiddenRank: "🔒 Umumiy reytingdagi o'rningiz boshqa ishtirokchilarga ko'rsatilmaydi.",
      languageUpdated: "✅ Til yangilandi.",
      adminOnly: "⛔ Bu buyruq faqat administrator uchun.",
      leaderboardTitle: "🏆 <b>Ishtirokchilar topi</b>",
      noLeadersYet: "Hozircha qabul qilingan promokodlari bor ishtirokchilar yo'q.",
      noName: "Ismsiz",
      noPhone: "telefon yo'q",
      codesWord: "kod",
      adminUserExample: "Misol: /admin_user 998901234567 yoki /admin_user @username",
      userNotFound: "Ishtirokchi topilmadi.",
      participant: "👤 Ishtirokchi: <b>{name}</b>",
      username: "Username: {username}",
      telegramId: "Telegram ID: {id}",
      enteredCodes: "🎟 Jami kodlar: <b>{count}</b>"
    }
  }
};

function setState(userId, state) {
  sessionState.set(userId, state);
}

function clearState(userId) {
  sessionState.delete(userId);
}

function getState(userId) {
  return sessionState.get(userId);
}

function isAdmin(userId) {
  return ADMIN_IDS.has(String(userId));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function interpolate(template, params = {}) {
  return template.replace(/\{(\w+)\}/g, (_, key) => escapeHtml(params[key] ?? ""));
}

function t(lang, key, params) {
  return interpolate(translations[lang].messages[key], params);
}

function getLanguage(userId) {
  const participant = db.getParticipant(userId);
  return participant?.language === "uz" ? "uz" : "ru";
}

function hasRegisteredPhone(userId) {
  const participant = db.getParticipant(userId);
  return Boolean(participant?.phone);
}

function isPhoneLike(text) {
  const normalized = String(text || "").replace(/[^\d+]/g, "");
  return normalized.length >= 9;
}

function replyHtml(ctx, text, extra = {}) {
  return ctx.reply(text, {
    parse_mode: "HTML",
    ...extra
  });
}

function registrationKeyboard(lang) {
  const buttons = translations[lang].buttons;
  const rows = SUBSCRIPTION_REQUIRED
    ? [[buttons.checkSubscription], [buttons.sendPhone], [buttons.help, buttons.language]]
    : [[buttons.sendPhone], [buttons.help, buttons.language]];

  return Markup.keyboard(rows).resize();
}

function mainKeyboard(lang) {
  const buttons = translations[lang].buttons;
  const rows = SUBSCRIPTION_REQUIRED
    ? [
        [buttons.checkSubscription, buttons.sendPhone],
        [buttons.enterCode, buttons.stats],
        [buttons.help, buttons.language]
      ]
    : [
        [buttons.sendPhone, buttons.enterCode],
        [buttons.stats, buttons.help],
        [buttons.language]
      ];

  return Markup.keyboard(rows).resize();
}

function phoneKeyboard(lang) {
  return Markup.keyboard([[Markup.button.contactRequest(translations[lang].buttons.sendPhone)]])
    .resize()
    .oneTime();
}

function languageKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(translations.ru.buttons.chooseRussian, "lang_ru"),
      Markup.button.callback(translations.uz.buttons.chooseUzbek, "lang_uz")
    ]
  ]);
}

function activeKeyboard(lang, userId) {
  return hasRegisteredPhone(userId) ? mainKeyboard(lang) : registrationKeyboard(lang);
}

function isActionButton(text, key) {
  return Object.values(translations).some((locale) => locale.buttons[key] === text);
}

function formatBreakdownLines(breakdown) {
  return breakdown.map((item) => `• ${escapeHtml(item.product_type)} — ${item.total}`).join("\n");
}

function formatDisplayName(item, lang) {
  if (item.username) {
    return `@${item.username}`;
  }

  return `${item.first_name || ""} ${item.last_name || ""}`.trim() || translations[lang].messages.noName;
}

async function isUserSubscribed(ctx, userId) {
  if (!SUBSCRIPTION_REQUIRED) {
    return true;
  }

  try {
    const member = await ctx.telegram.getChatMember(REQUIRED_CHANNEL_ID, userId);
    return ["creator", "administrator", "member"].includes(member.status);
  } catch (error) {
    console.error("Subscription check failed:", error.message);
    return false;
  }
}

async function ensureSubscribed(ctx, lang) {
  if (!SUBSCRIPTION_REQUIRED) {
    return true;
  }

  const subscribed = await isUserSubscribed(ctx, ctx.from.id);

  if (subscribed) {
    return true;
  }

  await replyHtml(
    ctx,
    t(lang, "subscriptionRequired"),
    Markup.inlineKeyboard([
      [Markup.button.url(translations[lang].buttons.openChannel, REQUIRED_CHANNEL_URL)],
      [Markup.button.callback(translations[lang].buttons.confirmSubscription, "check_subscription")]
    ])
  );

  return false;
}

async function ensureRegistered(ctx, lang) {
  db.saveParticipant(ctx.from);

  if (!(await ensureSubscribed(ctx, lang))) {
    return false;
  }

  if (hasRegisteredPhone(ctx.from.id)) {
    return true;
  }

  setState(ctx.from.id, "awaiting_phone");
  await replyHtml(ctx, t(lang, "needPhone"), phoneKeyboard(lang));
  return false;
}

async function showWelcome(ctx, lang) {
  await replyHtml(ctx, t(lang, "welcome"), activeKeyboard(lang, ctx.from.id));
}

async function showHelp(ctx, lang) {
  await replyHtml(ctx, t(lang, "help"), activeKeyboard(lang, ctx.from.id));
}

async function showLanguageSelector(ctx, lang) {
  await replyHtml(ctx, t(lang, "chooseLanguage"), languageKeyboard());
}

async function sendPrivateStats(ctx, lang) {
  const stats = db.getParticipantPrivateStats(ctx.from.id);

  if (!stats || !stats.participant.phone) {
    await replyHtml(ctx, t(lang, "enterPhoneFirst"), registrationKeyboard(lang));
    return;
  }

  const blocks = [
    t(lang, "statsTitle"),
    t(lang, "phoneLine", { phone: stats.participant.phone }),
    t(lang, "totalCodes", { count: stats.participant.total_codes }),
    stats.favoriteProduct
      ? t(lang, "favoriteProduct", {
          product: stats.favoriteProduct.product_type,
          count: stats.favoriteProduct.total
        })
      : t(lang, "noFavorite"),
    "",
    t(lang, "breakdownTitle"),
    stats.breakdown.length ? formatBreakdownLines(stats.breakdown) : t(lang, "noCodesYet"),
    "",
    t(lang, "hiddenRank")
  ];

  await replyHtml(ctx, blocks.join("\n"), mainKeyboard(lang));
}

bot.start(async (ctx) => {
  db.saveParticipant(ctx.from);
  const lang = getLanguage(ctx.from.id);

  await showLanguageSelector(ctx, lang);

  if (!(await ensureRegistered(ctx, lang))) {
    return;
  }

  await showWelcome(ctx, lang);
});

bot.help(async (ctx) => {
  db.saveParticipant(ctx.from);
  const lang = getLanguage(ctx.from.id);
  await showHelp(ctx, lang);
});

bot.command("lang", async (ctx) => {
  db.saveParticipant(ctx.from);
  const lang = getLanguage(ctx.from.id);
  await showLanguageSelector(ctx, lang);
});

bot.command("menu", async (ctx) => {
  db.saveParticipant(ctx.from);
  const lang = getLanguage(ctx.from.id);
  await showWelcome(ctx, lang);
});

bot.action(/^lang_(ru|uz)$/, async (ctx) => {
  await ctx.answerCbQuery();
  db.saveParticipant(ctx.from);

  const language = ctx.match[1];
  db.saveLanguage(ctx.from.id, language);

  await replyHtml(ctx, t(language, "languageUpdated"), activeKeyboard(language, ctx.from.id));

  if (hasRegisteredPhone(ctx.from.id)) {
    await showWelcome(ctx, language);
    return;
  }

  await replyHtml(ctx, t(language, "needPhone"), phoneKeyboard(language));
});

bot.action("check_subscription", async (ctx) => {
  await ctx.answerCbQuery();
  db.saveParticipant(ctx.from);
  const lang = getLanguage(ctx.from.id);

  if (!SUBSCRIPTION_REQUIRED) {
    await replyHtml(ctx, t(lang, "subscriptionOff"), activeKeyboard(lang, ctx.from.id));
    return;
  }

  const subscribed = await isUserSubscribed(ctx, ctx.from.id);

  if (!subscribed) {
    await replyHtml(ctx, t(lang, "subscriptionNotFound"), registrationKeyboard(lang));
    return;
  }

  if (!hasRegisteredPhone(ctx.from.id)) {
    setState(ctx.from.id, "awaiting_phone");
    await replyHtml(ctx, t(lang, "subscriptionConfirmedPhone"), phoneKeyboard(lang));
    return;
  }

  await replyHtml(ctx, t(lang, "subscriptionConfirmed"), mainKeyboard(lang));
});

bot.on("contact", async (ctx) => {
  db.saveParticipant(ctx.from);
  const lang = getLanguage(ctx.from.id);

  if (!(await ensureSubscribed(ctx, lang))) {
    return;
  }

  const contact = ctx.message.contact;

  if (contact.user_id && contact.user_id !== ctx.from.id) {
    await replyHtml(ctx, t(lang, "sendOwnPhone"), registrationKeyboard(lang));
    return;
  }

  const result = db.savePhone(ctx.from.id, contact.phone_number);

  if (!result.ok) {
    const messageKey = result.error === "phone_already_used" ? "phoneAlreadyUsed" : "savePhoneError";
    await replyHtml(ctx, t(lang, messageKey), registrationKeyboard(lang));
    return;
  }

  clearState(ctx.from.id);
  await replyHtml(ctx, t(lang, "phoneSaved"), mainKeyboard(lang));
});

bot.command("admin_top", async (ctx) => {
  db.saveParticipant(ctx.from);
  const lang = getLanguage(ctx.from.id);

  if (!isAdmin(ctx.from.id)) {
    await replyHtml(ctx, t(lang, "adminOnly"), activeKeyboard(lang, ctx.from.id));
    return;
  }

  const leaders = db.getLeaderboard(20);

  if (!leaders.length) {
    await replyHtml(ctx, t(lang, "noLeadersYet"), activeKeyboard(lang, ctx.from.id));
    return;
  }

  const lines = leaders.map((item, index) => {
    const name = formatDisplayName(item, lang);
    return `${index + 1}. ${escapeHtml(name)} — ${escapeHtml(item.phone || translations[lang].messages.noPhone)} — ${item.total_codes} ${translations[lang].messages.codesWord}`;
  });

  await replyHtml(ctx, `${t(lang, "leaderboardTitle")}\n\n${lines.join("\n")}`, activeKeyboard(lang, ctx.from.id));
});

bot.command("admin_user", async (ctx) => {
  db.saveParticipant(ctx.from);
  const lang = getLanguage(ctx.from.id);

  if (!isAdmin(ctx.from.id)) {
    await replyHtml(ctx, t(lang, "adminOnly"), activeKeyboard(lang, ctx.from.id));
    return;
  }

  const query = ctx.message.text.replace("/admin_user", "").trim();

  if (!query) {
    await replyHtml(ctx, t(lang, "adminUserExample"), activeKeyboard(lang, ctx.from.id));
    return;
  }

  const found = db.findParticipant(query);

  if (!found) {
    await replyHtml(ctx, t(lang, "userNotFound"), activeKeyboard(lang, ctx.from.id));
    return;
  }

  const participant = found.participant;
  const fullName = `${participant.first_name || ""} ${participant.last_name || ""}`.trim() || translations[lang].messages.noName;

  const lines = [
    t(lang, "participant", { name: fullName }),
    t(lang, "username", { username: participant.username ? `@${participant.username}` : "-" }),
    t(lang, "telegramId", { id: participant.telegram_user_id }),
    t(lang, "phoneLine", { phone: participant.phone || "-" }),
    t(lang, "enteredCodes", { count: participant.total_codes }),
    "",
    t(lang, "breakdownTitle"),
    found.breakdown.length ? formatBreakdownLines(found.breakdown) : t(lang, "noCodesYet")
  ];

  await replyHtml(ctx, lines.join("\n"), activeKeyboard(lang, ctx.from.id));
});

bot.hears(/.+/, async (ctx, next) => {
  const text = String(ctx.message.text || "").trim();

  if (!text || text.startsWith("/")) {
    return next();
  }

  db.saveParticipant(ctx.from);
  const lang = getLanguage(ctx.from.id);

  if (isActionButton(text, "language")) {
    await showLanguageSelector(ctx, lang);
    return;
  }

  if (isActionButton(text, "help")) {
    await showHelp(ctx, lang);
    return;
  }

  if (!hasRegisteredPhone(ctx.from.id) && !isActionButton(text, "sendPhone") && !isActionButton(text, "checkSubscription")) {
    setState(ctx.from.id, "awaiting_phone");
    await replyHtml(ctx, t(lang, "needPhone"), phoneKeyboard(lang));
    return;
  }

  if (isActionButton(text, "checkSubscription")) {
    if (!SUBSCRIPTION_REQUIRED) {
      await replyHtml(ctx, t(lang, "subscriptionOff"), activeKeyboard(lang, ctx.from.id));
      return;
    }

    const subscribed = await isUserSubscribed(ctx, ctx.from.id);

    if (!subscribed) {
      await replyHtml(ctx, t(lang, "subscriptionNotFound"), registrationKeyboard(lang));
      return;
    }

    if (!hasRegisteredPhone(ctx.from.id)) {
      setState(ctx.from.id, "awaiting_phone");
      await replyHtml(ctx, t(lang, "subscriptionConfirmedPhone"), phoneKeyboard(lang));
      return;
    }

    await replyHtml(ctx, t(lang, "subscriptionConfirmed"), mainKeyboard(lang));
    return;
  }

  if (isActionButton(text, "sendPhone")) {
    if (!(await ensureSubscribed(ctx, lang))) {
      return;
    }

    setState(ctx.from.id, "awaiting_phone");
    await replyHtml(ctx, t(lang, "needPhone"), phoneKeyboard(lang));
    return;
  }

  if (isActionButton(text, "enterCode")) {
    if (!(await ensureRegistered(ctx, lang))) {
      return;
    }

    setState(ctx.from.id, "awaiting_promo");
    await replyHtml(ctx, t(lang, "promptCode"), mainKeyboard(lang));
    return;
  }

  if (isActionButton(text, "stats")) {
    if (!(await ensureRegistered(ctx, lang))) {
      return;
    }

    await sendPrivateStats(ctx, lang);
    return;
  }

  const state = getState(ctx.from.id);

  if (state === "awaiting_phone" && isPhoneLike(text)) {
    if (!(await ensureSubscribed(ctx, lang))) {
      return;
    }

    const result = db.savePhone(ctx.from.id, text);

    if (!result.ok) {
      const messageKey = result.error === "phone_already_used" ? "phoneAlreadyUsed" : "savePhoneError";
      await replyHtml(ctx, t(lang, messageKey), registrationKeyboard(lang));
      return;
    }

    clearState(ctx.from.id);
    await replyHtml(ctx, t(lang, "phoneSaved"), mainKeyboard(lang));
    return;
  }

  if (state !== "awaiting_promo") {
    if (!hasRegisteredPhone(ctx.from.id)) {
      setState(ctx.from.id, "awaiting_phone");
      await replyHtml(ctx, t(lang, "needPhone"), phoneKeyboard(lang));
      return;
    }

    return next();
  }

  if (!(await ensureRegistered(ctx, lang))) {
    return;
  }

  const result = db.redeemPromoCode(ctx.from.id, text);

  if (!result.ok) {
    const messages = {
      participant_not_registered: "registrationRequired",
      code_not_found: "codeNotFound",
      code_already_used: "codeAlreadyUsed",
      code_already_used_by_you: "codeAlreadyUsedByYou"
    };

    await replyHtml(ctx, t(lang, messages[result.error] || "unknownError"), mainKeyboard(lang));
    return;
  }

  clearState(ctx.from.id);
  const stats = db.getParticipantPrivateStats(ctx.from.id);

  await replyHtml(
    ctx,
    t(lang, "codeAccepted", {
      product: result.productType,
      count: stats?.participant?.total_codes || 0
    }),
    mainKeyboard(lang)
  );
});

bot.catch((error) => {
  console.error("Bot error:", error);
});

bot.launch().then(() => {
  console.log("Bag & Pack promo bot is running");
});

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
