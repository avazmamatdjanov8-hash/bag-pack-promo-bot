require("dotenv").config();

const http = require("http");
const { URL, URLSearchParams } = require("url");
const { createDb } = require("./db");

const DATABASE_PATH = process.env.DATABASE_PATH || "./data/promo.sqlite";
const IS_CLOUD = Boolean(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID || process.env.PORT);
const ADMIN_PORT = Number(process.env.PORT || process.env.ADMIN_PORT || 3000);
const ADMIN_HOST = process.env.ADMIN_HOST || (IS_CLOUD ? "0.0.0.0" : "127.0.0.1");
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "change_this_password";
const { db, getAdminOverview, getParticipantsAdmin, getParticipantAdminDetails, getPromoCodesAdmin, getCodeEntriesAdmin, getDistinctProducts, createSinglePromoCode, generatePromoCodes, drawRandomPromoCode, releasePromoCode, deletePromoCode } =
  createDb(DATABASE_PATH);

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function redirect(res, location) {
  res.statusCode = 302;
  res.setHeader("Location", location);
  res.end();
}

function unauthorized(res) {
  res.statusCode = 401;
  res.setHeader("WWW-Authenticate", 'Basic realm="BagPackAdmin"');
  res.end("Authorization required");
}

function isAuthorized(req) {
  if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
    return true;
  }

  const header = req.headers.authorization || "";

  if (!header.startsWith("Basic ")) {
    return false;
  }

  const raw = Buffer.from(header.slice(6), "base64").toString("utf8");
  const separatorIndex = raw.indexOf(":");

  if (separatorIndex === -1) {
    return false;
  }

  const username = raw.slice(0, separatorIndex);
  const password = raw.slice(separatorIndex + 1);

  return username === ADMIN_USERNAME && password === ADMIN_PASSWORD;
}

function pageLayout({ title, active, content, notice }) {
  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root {
      --bg: #f5ede0;
      --bg-deep: #ead9bf;
      --card: rgba(255, 252, 247, 0.94);
      --line: rgba(111, 92, 68, 0.18);
      --text: #2b2219;
      --muted: #6d5e4e;
      --accent: #1d6f5b;
      --accent-strong: #145241;
      --accent-soft: #e5f3ee;
      --warn: #b0701d;
      --danger: #a34735;
      --shadow: 0 24px 60px rgba(44, 33, 20, 0.1);
      --radius: 24px;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: var(--text);
      font-family: Georgia, "Trebuchet MS", serif;
      background:
        radial-gradient(circle at top left, rgba(29, 111, 91, 0.14), transparent 32%),
        radial-gradient(circle at top right, rgba(176, 112, 29, 0.12), transparent 26%),
        linear-gradient(180deg, var(--bg-deep), var(--bg));
      min-height: 100vh;
    }
    a { color: inherit; }
    .shell {
      max-width: 1320px;
      margin: 0 auto;
      padding: 24px 18px 40px;
    }
    .hero {
      display: grid;
      grid-template-columns: 1.4fr 1fr;
      gap: 18px;
      margin-bottom: 18px;
    }
    .hero-card, .card, .panel, .table-card {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      backdrop-filter: blur(10px);
    }
    .hero-card {
      padding: 26px;
      overflow: hidden;
      position: relative;
    }
    .hero-card::after {
      content: "";
      position: absolute;
      width: 180px;
      height: 180px;
      right: -36px;
      top: -50px;
      border-radius: 50%;
      background: rgba(29, 111, 91, 0.09);
    }
    h1, h2, h3 {
      margin: 0;
      font-family: "Palatino Linotype", Georgia, serif;
      letter-spacing: 0.02em;
    }
    .subtitle {
      margin-top: 10px;
      max-width: 640px;
      line-height: 1.55;
      color: var(--muted);
      font-size: 15px;
    }
    .hero-meta {
      display: grid;
      gap: 12px;
      padding: 22px;
    }
    .muted { color: var(--muted); }
    .nav {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 22px;
    }
    .nav a {
      text-decoration: none;
      padding: 11px 16px;
      border-radius: 999px;
      border: 1px solid var(--line);
      background: rgba(255, 255, 255, 0.65);
      font-size: 14px;
    }
    .nav a.active {
      background: var(--accent);
      border-color: var(--accent);
      color: #fff;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 14px;
      margin-bottom: 18px;
    }
    .stat-card {
      padding: 18px;
      border-radius: 20px;
      background: rgba(255, 255, 255, 0.72);
      border: 1px solid var(--line);
    }
    .stat-card .value {
      font-size: 34px;
      margin-top: 8px;
      font-weight: 700;
      font-family: "Palatino Linotype", Georgia, serif;
    }
    .grid-2 {
      display: grid;
      grid-template-columns: 1.08fr 0.92fr;
      gap: 18px;
    }
    .table-card, .panel {
      padding: 20px;
    }
    .section-title {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      align-items: baseline;
      margin-bottom: 16px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }
    th, td {
      text-align: left;
      padding: 12px 10px;
      border-bottom: 1px solid rgba(111, 92, 68, 0.12);
      vertical-align: top;
    }
    th {
      color: var(--muted);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .badge {
      display: inline-block;
      padding: 5px 10px;
      border-radius: 999px;
      font-size: 12px;
      border: 1px solid transparent;
      background: var(--accent-soft);
      color: var(--accent-strong);
    }
    .badge.warn {
      background: #fff2df;
      color: var(--warn);
      border-color: rgba(176, 112, 29, 0.18);
    }
    .badge.danger {
      background: #fdeae7;
      color: var(--danger);
      border-color: rgba(163, 71, 53, 0.16);
    }
    .filters, .stack {
      display: grid;
      gap: 12px;
    }
    .filters.inline {
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      align-items: end;
    }
    label {
      display: grid;
      gap: 6px;
      font-size: 13px;
      color: var(--muted);
    }
    input, select, textarea {
      width: 100%;
      border-radius: 16px;
      border: 1px solid rgba(111, 92, 68, 0.16);
      background: rgba(255, 255, 255, 0.9);
      padding: 12px 14px;
      font: inherit;
      color: var(--text);
    }
    textarea {
      min-height: 190px;
      resize: vertical;
      line-height: 1.5;
    }
    .actions {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }
    button, .button-link {
      border: 0;
      border-radius: 16px;
      padding: 12px 16px;
      background: var(--accent);
      color: #fff;
      cursor: pointer;
      text-decoration: none;
      font: inherit;
    }
    .button-link.secondary, button.secondary {
      background: #f0e7d9;
      color: var(--text);
    }
    button.warn {
      background: var(--danger);
    }
    .notice {
      margin-bottom: 18px;
      padding: 14px 16px;
      border-radius: 18px;
      border: 1px solid rgba(29, 111, 91, 0.15);
      background: rgba(229, 243, 238, 0.84);
    }
    .split {
      display: grid;
      grid-template-columns: 1.1fr 0.9fr;
      gap: 18px;
    }
    .small {
      font-size: 12px;
      color: var(--muted);
      line-height: 1.5;
    }
    .empty {
      padding: 24px;
      text-align: center;
      color: var(--muted);
      border: 1px dashed rgba(111, 92, 68, 0.24);
      border-radius: 18px;
      background: rgba(255, 255, 255, 0.45);
    }
    .row-actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .row-actions form {
      margin: 0;
    }
    .fortune-wrap {
      display: grid;
      gap: 16px;
    }
    .fortune-stage {
      position: relative;
      display: grid;
      place-items: center;
      min-height: 250px;
      padding: 12px 0 8px;
    }
    .fortune-wheel {
      width: 220px;
      height: 220px;
      border-radius: 50%;
      border: 10px solid rgba(255, 255, 255, 0.9);
      box-shadow: inset 0 0 0 1px rgba(111, 92, 68, 0.1), 0 20px 45px rgba(44, 33, 20, 0.14);
      background:
        conic-gradient(
          from -18deg,
          #1d6f5b 0deg 45deg,
          #e0a34a 45deg 90deg,
          #c95f45 90deg 135deg,
          #edd8b2 135deg 180deg,
          #4f8578 180deg 225deg,
          #f1b96b 225deg 270deg,
          #a34735 270deg 315deg,
          #f5e8d0 315deg 360deg
        );
      position: relative;
    }
    .fortune-wheel::after {
      content: "";
      position: absolute;
      inset: 50%;
      width: 74px;
      height: 74px;
      transform: translate(-50%, -50%);
      border-radius: 50%;
      background: rgba(255, 252, 247, 0.95);
      border: 1px solid rgba(111, 92, 68, 0.14);
      box-shadow: 0 8px 18px rgba(44, 33, 20, 0.12);
    }
    .fortune-wheel::before {
      content: "B&P";
      position: absolute;
      inset: 50%;
      transform: translate(-50%, -50%);
      z-index: 2;
      font-weight: 700;
      color: var(--accent-strong);
      letter-spacing: 0.08em;
    }
    .fortune-arrow {
      position: absolute;
      top: 4px;
      width: 0;
      height: 0;
      border-left: 16px solid transparent;
      border-right: 16px solid transparent;
      border-top: 28px solid var(--danger);
      filter: drop-shadow(0 8px 10px rgba(44, 33, 20, 0.16));
    }
    .fortune-result {
      padding: 16px 18px;
      border-radius: 18px;
      background: rgba(229, 243, 238, 0.82);
      border: 1px solid rgba(29, 111, 91, 0.14);
    }
    .fortune-code {
      font-size: 28px;
      line-height: 1.2;
      margin: 6px 0;
      font-weight: 700;
      letter-spacing: 0.06em;
      word-break: break-word;
    }
    @media (max-width: 980px) {
      .hero,
      .grid-2,
      .split {
        grid-template-columns: 1fr;
      }
    }
    @media (max-width: 720px) {
      table {
        display: block;
        overflow-x: auto;
        white-space: nowrap;
      }
    }
  </style>
</head>
<body>
  <div class="shell">
    <div class="hero">
      <div class="hero-card">
        <h1>Bag & Pack Admin</h1>
        <div class="subtitle">Панель управления промо-акцией. Здесь можно смотреть участников, контролировать коды, выпускать новые серии промокодов и управлять базой без командной строки.</div>
        <div class="nav">
          ${navLink("/", "dashboard", active, "Обзор")}
          ${navLink("/participants", "participants", active, "Участники")}
          ${navLink("/codes", "codes", active, "Промокоды")}
          ${navLink("/entries", "entries", active, "Вводы")}
          ${navLink("/manage", "manage", active, "Управление")}
        </div>
      </div>
      <div class="hero-card hero-meta">
        <div><b>Файл базы</b><div class="small">${escapeHtml(DATABASE_PATH)}</div></div>
        <div><b>Адрес панели</b><div class="small">http://localhost:${ADMIN_PORT}</div></div>
        <div><b>Режим</b><div class="small">Локальная админка для работы через браузер</div></div>
      </div>
    </div>
    ${notice ? `<div class="notice">${escapeHtml(notice)}</div>` : ""}
    ${content}
  </div>
</body>
</html>`;
}

function navLink(href, key, active, label) {
  return `<a href="${href}" class="${active === key ? "active" : ""}">${escapeHtml(label)}</a>`;
}

function card(title, value, subtitle) {
  return `<div class="stat-card"><div class="muted">${escapeHtml(title)}</div><div class="value">${escapeHtml(value)}</div>${subtitle ? `<div class="small">${escapeHtml(subtitle)}</div>` : ""}</div>`;
}

function renderTable(headers, rows, emptyText = "Пока нет данных.") {
  if (!rows.length) {
    return `<div class="empty">${escapeHtml(emptyText)}</div>`;
  }

  return `<div class="table-card"><table><thead><tr>${headers.map((item) => `<th>${escapeHtml(item)}</th>`).join("")}</tr></thead><tbody>${rows
    .map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`)
    .join("")}</tbody></table></div>`;
}

function renderNoticeFromUrl(url) {
  return url.searchParams.get("notice") || "";
}

function makeQuery(basePath, params) {
  const query = new URLSearchParams(params);
  const queryString = query.toString();
  return queryString ? `${basePath}?${queryString}` : basePath;
}

function formatPerson(item) {
  if (item.username) {
    return `@${item.username}`;
  }

  return `${item.first_name || ""} ${item.last_name || ""}`.trim() || "Без имени";
}

function dashboardPage(url) {
  const overview = getAdminOverview();
  const notice = renderNoticeFromUrl(url);

  const statCards = `
    <div class="stats-grid">
      ${card("Всего промокодов", overview.summary.total_codes || 0)}
      ${card("Использовано", overview.summary.used_codes || 0)}
      ${card("Свободно", overview.summary.free_codes || 0)}
      ${card("Участников", overview.participants.total_participants || 0)}
      ${card("Активных участников", overview.activeParticipants.total_active || 0)}
    </div>
  `;

  const productRows = overview.productSummary.map((item) => [
    escapeHtml(item.product_type),
    `<span class="badge">${item.total_codes || 0}</span>`,
    `<span class="badge">${item.used_codes || 0}</span>`,
    `<span class="badge warn">${item.free_codes || 0}</span>`
  ]);

  const leaderboardRows = overview.leaderboard.map((item, index) => [
    escapeHtml(String(index + 1)),
    escapeHtml(formatPerson(item)),
    escapeHtml(item.phone || "-"),
    `<span class="badge">${item.total_codes}</span>`
  ]);

  const recentRows = overview.recentEntries.map((item) => [
    escapeHtml(item.code),
    escapeHtml(item.product_type),
    escapeHtml(item.phone || "-"),
    escapeHtml(formatPerson(item)),
    escapeHtml(item.created_at)
  ]);

  const content = `
    ${statCards}
    <div class="grid-2">
      <div class="stack">
        <div class="section-title"><h2>Сводка по товарам</h2><div class="small">Где промокоды уже активнее всего</div></div>
        ${renderTable(["Товар", "Всего кодов", "Использовано", "Свободно"], productRows, "Пока по товарам нет данных.")}
      </div>
      <div class="stack">
        <div class="section-title"><h2>Топ участников</h2><div class="small">Рейтинг только для администратора</div></div>
        ${renderTable(["Место", "Участник", "Телефон", "Кодов"], leaderboardRows, "Пока нет принятых кодов.")}
      </div>
    </div>
    <div style="margin-top:18px;" class="section-title"><h2>Последние вводы</h2><a class="button-link secondary" href="/entries">Открыть весь журнал</a></div>
    ${renderTable(["Код", "Товар", "Телефон", "Участник", "Время"], recentRows, "Пока никто не ввёл ни одного кода.")}
  `;

  return pageLayout({
    title: "Обзор",
    active: "dashboard",
    content,
    notice
  });
}

function participantsPage(url) {
  const query = (url.searchParams.get("q") || "").trim();
  const selectedId = Number(url.searchParams.get("id") || 0);
  const participants = getParticipantsAdmin(query);
  const details = selectedId ? getParticipantAdminDetails(selectedId) : null;

  const rows = participants.map((item) => [
    `<a href="${makeQuery("/participants", { q: query, id: item.id })}">${escapeHtml(formatPerson(item))}</a>`,
    escapeHtml(String(item.telegram_user_id)),
    escapeHtml(item.phone || "-"),
    `<span class="badge">${escapeHtml(item.language || "ru")}</span>`,
    `<span class="badge">${item.total_codes}</span>`
  ]);

  const detailContent = details
    ? `
      <div class="panel">
        <div class="section-title"><h2>Карточка участника</h2><div class="small">Подробная информация и история кодов</div></div>
        <div class="stack">
          <div><b>${escapeHtml(formatPerson(details.participant))}</b></div>
          <div class="small">Telegram ID: ${escapeHtml(details.participant.telegram_user_id)}</div>
          <div class="small">Телефон: ${escapeHtml(details.participant.phone || "-")}</div>
          <div class="small">Язык: ${escapeHtml(details.participant.language || "ru")}</div>
          <div class="small">Всего кодов: ${escapeHtml(details.participant.total_codes)}</div>
        </div>
      </div>
      <div class="panel">
        <div class="section-title"><h3>Статистика по товарам</h3></div>
        ${details.breakdown.length
          ? details.breakdown.map((item) => `<div class="small">${escapeHtml(item.product_type)}: ${escapeHtml(item.total)}</div>`).join("")
          : `<div class="empty">Пока нет введённых кодов.</div>`}
      </div>
      <div class="panel">
        <div class="section-title"><h3>Последние коды участника</h3></div>
        ${details.recentEntries.length
          ? details.recentEntries
              .map(
                (item) =>
                  `<div class="small"><b>${escapeHtml(item.code)}</b> - ${escapeHtml(item.product_type)} - ${escapeHtml(item.created_at)}</div>`
              )
              .join("")
          : `<div class="empty">История ввода пока пуста.</div>`}
      </div>
    `
    : `
      <div class="panel">
        <div class="section-title"><h2>Карточка участника</h2></div>
        <div class="empty">Выберите участника из списка слева, чтобы увидеть подробности.</div>
      </div>
    `;

  const content = `
    <div class="split">
      <div class="stack">
        <div class="panel">
          <form class="filters inline" method="GET" action="/participants">
            <label>Поиск участника
              <input type="text" name="q" value="${escapeHtml(query)}" placeholder="Телефон, username, имя или Telegram ID" />
            </label>
            <div class="actions"><button type="submit">Найти</button><a class="button-link secondary" href="/participants">Сбросить</a></div>
          </form>
        </div>
        <div class="section-title"><h2>Список участников</h2><div class="small">Отсортировано по количеству кодов</div></div>
        ${renderTable(["Участник", "Telegram ID", "Телефон", "Язык", "Кодов"], rows, "Пока нет зарегистрированных участников.")}
      </div>
      <div class="stack">${detailContent}</div>
    </div>
  `;

  return pageLayout({
    title: "Участники",
    active: "participants",
    content,
    notice: renderNoticeFromUrl(url)
  });
}

function renderCodeActions(code) {
  const releaseForm = code.used_at
    ? `
      <form method="POST" action="/actions/release-code">
        <input type="hidden" name="codeId" value="${escapeHtml(code.id)}" />
        <button class="secondary" type="submit">Освободить</button>
      </form>
    `
    : "";

  const deleteForm = !code.used_at
    ? `
      <form method="POST" action="/actions/delete-code">
        <input type="hidden" name="codeId" value="${escapeHtml(code.id)}" />
        <button class="warn" type="submit">Удалить</button>
      </form>
    `
    : "";

  return `<div class="row-actions">${releaseForm}${deleteForm}</div>`;
}

function codesPage(url) {
  const query = (url.searchParams.get("q") || "").trim();
  const status = url.searchParams.get("status") || "all";
  const codes = getPromoCodesAdmin({ query, status, limit: 500 });
  const products = getDistinctProducts();

  const rows = codes.map((item) => [
    `<b>${escapeHtml(item.code)}</b>`,
    escapeHtml(item.product_type),
    item.used_at ? `<span class="badge">Использован</span>` : `<span class="badge warn">Свободен</span>`,
    escapeHtml(item.phone || "-"),
    escapeHtml(formatPerson(item)),
    escapeHtml(item.used_at || item.created_at || "-"),
    renderCodeActions(item)
  ]);

  const productHints = products.length
    ? `<div class="small">Текущие типы товаров: ${products.map((item) => escapeHtml(item)).join(", ")}</div>`
    : `<div class="small">Пока товаров нет. Добавьте первую серию промокодов ниже.</div>`;

  const content = `
    <div class="stack">
      <div class="panel">
        <form class="filters inline" method="GET" action="/codes">
          <label>Поиск
            <input type="text" name="q" value="${escapeHtml(query)}" placeholder="Код, товар, телефон или username" />
          </label>
          <label>Статус
            <select name="status">
              <option value="all" ${status === "all" ? "selected" : ""}>Все</option>
              <option value="used" ${status === "used" ? "selected" : ""}>Использованные</option>
              <option value="free" ${status === "free" ? "selected" : ""}>Свободные</option>
            </select>
          </label>
          <div class="actions"><button type="submit">Применить</button><a class="button-link secondary" href="/codes">Сбросить</a></div>
        </form>
      </div>
      <div class="section-title"><h2>Промокоды</h2><div class="small">Показаны последние 500 записей</div></div>
      ${renderTable(["Код", "Товар", "Статус", "Телефон", "Участник", "Дата", "Действия"], rows, "Промокоды пока не добавлены.")}
      <div class="panel">
        <div class="section-title"><h2>Быстрое добавление одного кода</h2><div class="small">Без CSV и скриптов</div></div>
        ${productHints}
        <form class="filters inline" method="POST" action="/actions/create-code">
          <label>Тип товара
            <input type="text" name="productType" placeholder="Например: Пакеты" />
          </label>
          <label>Промокод
            <input type="text" name="code" placeholder="Например: PAK-000201" />
          </label>
          <div class="actions"><button type="submit">Добавить код</button></div>
        </form>
      </div>
    </div>
  `;

  return pageLayout({
    title: "Промокоды",
    active: "codes",
    content,
    notice: renderNoticeFromUrl(url)
  });
}

function entriesPage(url) {
  const query = (url.searchParams.get("q") || "").trim();
  const rows = getCodeEntriesAdmin({ query, limit: 500 }).map((item) => [
    `<b>${escapeHtml(item.code)}</b>`,
    escapeHtml(item.product_type),
    escapeHtml(item.phone || "-"),
    escapeHtml(formatPerson(item)),
    escapeHtml(item.created_at)
  ]);

  const content = `
    <div class="stack">
      <div class="panel">
        <form class="filters inline" method="GET" action="/entries">
          <label>Поиск по журналу
            <input type="text" name="q" value="${escapeHtml(query)}" placeholder="Код, товар, телефон или username" />
          </label>
          <div class="actions"><button type="submit">Найти</button><a class="button-link secondary" href="/entries">Сбросить</a></div>
        </form>
      </div>
      <div class="section-title"><h2>История ввода промокодов</h2><div class="small">Последние 500 записей</div></div>
      ${renderTable(["Код", "Товар", "Телефон", "Участник", "Время"], rows, "История пока пуста.")}
    </div>
  `;

  return pageLayout({
    title: "Вводы",
    active: "entries",
    content,
    notice: renderNoticeFromUrl(url)
  });
}

function managePage(url) {
  const products = getDistinctProducts();
  const wheelCode = (url.searchParams.get("wheelCode") || "").trim();
  const wheelProduct = (url.searchParams.get("wheelProduct") || "").trim();
  const wheelMode = (url.searchParams.get("wheelMode") || "used").trim() === "free" ? "free" : "used";
  const wheelCount = url.searchParams.get("wheelCount") || "";
  const wheelOptions = [`<option value="">Любой товар</option>`]
    .concat(
      products.map(
        (item) => `<option value="${escapeHtml(item)}"${wheelProduct === item ? " selected" : ""}>${escapeHtml(item)}</option>`
      )
    )
    .join("");
  const wheelModeLabel = wheelMode === "free" ? "свободный" : "использованный";
  const wheelCountLabel = wheelMode === "free" ? "Свободных кодов в этой категории" : "Использованных кодов в этой категории";
  const wheelResult = wheelCode
    ? `
      <div class="fortune-result">
        <div class="small">Выпал товар: ${escapeHtml(wheelProduct || "Любой товар")}</div>
        <div class="fortune-code">${escapeHtml(wheelCode)}</div>
        <div class="small">${escapeHtml(wheelCountLabel)}: ${escapeHtml(wheelCount || "0")}</div>
      </div>
    `
    : `<div class="small">Нажмите кнопку, и админка выберет один случайный ${escapeHtml(wheelModeLabel)} промокод.</div>`;
  const productList = products.length
    ? products.map((item) => `<span class="badge">${escapeHtml(item)}</span>`).join(" ")
    : `<span class="small">Пока нет сохранённых товаров.</span>`;

  const content = `
    <div class="grid-2">
      <div class="stack">
        <div class="panel">
          <div class="section-title"><h2>Сгенерировать серию промокодов</h2><div class="small">Создание пачки кодов за один шаг</div></div>
          <form class="filters" method="POST" action="/actions/generate-codes">
            <label>Тип товара
              <input type="text" name="productType" placeholder="Например: Пакеты" required />
            </label>
            <label>Префикс кода
              <input type="text" name="prefix" placeholder="Например: PAK" required />
            </label>
            <label>Сколько кодов создать
              <input type="number" name="count" value="100" min="1" max="10000" required />
            </label>
            <div class="small">Формат будет таким: <b>PAK-7M4-Q2R</b>. Префикс сохраняет тип товара, остальная часть генерируется случайно и остаётся удобной для ручного ввода.</div>
            <div class="actions"><button type="submit">Создать серию</button></div>
          </form>
        </div>
        <div class="panel">
          <div class="section-title"><h2>Добавить коды вручную</h2><div class="small">Подходит для вставки списка из Excel</div></div>
          <form class="filters" method="POST" action="/actions/import-codes">
            <label>Тип товара по умолчанию
              <input type="text" name="productType" placeholder="Если в строках не указан товар" />
            </label>
            <label>Список кодов
              <textarea name="codesText" placeholder="Можно вставлять в двух форматах:

PAK-000301
PAK-000302

или

PAK-000401,Пакеты
STR-000401,Стрейч-пленка"></textarea>
            </label>
            <div class="actions"><button type="submit">Импортировать</button></div>
          </form>
        </div>
      </div>
      <div class="stack">
        <div class="panel">
          <div class="section-title"><h2>Колесо удачи</h2><div class="small">Только для администратора</div></div>
          <div class="fortune-wrap">
            <div class="fortune-stage">
              <div class="fortune-arrow"></div>
              <div class="fortune-wheel"></div>
            </div>
            ${wheelResult}
            <form class="filters" method="POST" action="/actions/draw-wheel">
              <label>Какие коды крутить
                <select name="status">
                  <option value="used" ${wheelMode === "used" ? "selected" : ""}>Использованные</option>
                  <option value="free" ${wheelMode === "free" ? "selected" : ""}>Свободные</option>
                </select>
              </label>
              <label>Из какого товара выбирать код
                <select name="productType">${wheelOptions}</select>
              </label>
              <div class="actions"><button type="submit">Крутить колесо</button></div>
            </form>
          </div>
        </div>
        <div class="panel">
          <div class="section-title"><h2>Текущие товары</h2><div class="small">Все товарные категории, уже найденные в базе</div></div>
          <div class="actions">${productList}</div>
        </div>
        <div class="panel">
          <div class="section-title"><h2>Быстрые действия</h2><div class="small">Чтобы не искать нужные разделы вручную</div></div>
          <div class="actions">
            <a class="button-link" href="/codes">Открыть список кодов</a>
            <a class="button-link secondary" href="/participants">Открыть участников</a>
            <a class="button-link secondary" href="/entries">Открыть историю вводов</a>
            <a class="button-link secondary" href="/export/participants.csv">Выгрузить участников</a>
            <a class="button-link secondary" href="/export/codes.csv">Выгрузить промокоды</a>
            <a class="button-link secondary" href="/export/entries.csv">Выгрузить историю</a>
          </div>
        </div>
        <div class="panel">
          <div class="section-title"><h2>Что можно делать без команд</h2></div>
          <div class="small">1. Создавать серии промокодов по товару через форму.</div>
          <div class="small">2. Добавлять отдельные коды или вставлять список вручную.</div>
          <div class="small">3. Крутить колесо удачи и получать случайный свободный или использованный код.</div>
          <div class="small">4. Освобождать использованный код прямо из списка промокодов.</div>
          <div class="small">5. Удалять свободные коды, которые не нужны.</div>
        </div>
      </div>
    </div>
  `;

  return pageLayout({
    title: "Управление",
    active: "manage",
    content,
    notice: renderNoticeFromUrl(url)
  });
}

function parseManualCodes(codesText, defaultProductType) {
  const lines = String(codesText || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const items = [];
  let skipped = 0;

  for (const line of lines) {
    const parts = line.split(/[;,]/).map((part) => part.trim()).filter(Boolean);

    if (parts.length >= 2) {
      items.push({ code: parts[0], productType: parts.slice(1).join(", ") });
      continue;
    }

    if (parts.length === 1 && defaultProductType) {
      items.push({ code: parts[0], productType: defaultProductType });
      continue;
    }

    skipped += 1;
  }

  return { items, skipped };
}

async function handlePost(req, res, url) {
  const body = await readBody(req);
  const form = new URLSearchParams(body);
  const path = url.pathname;

  if (path === "/actions/generate-codes") {
    const result = generatePromoCodes({
      productType: form.get("productType"),
      prefix: form.get("prefix"),
      count: form.get("count")
    });

    const notice = result.ok
      ? `Создано ${result.added} промокодов.`
      : "Не удалось создать серию. Проверьте поля формы.";
    return redirect(res, makeQuery("/manage", { notice }));
  }

  if (path === "/actions/create-code") {
    const result = createSinglePromoCode({
      code: form.get("code"),
      productType: form.get("productType")
    });

    let notice = "Код добавлен.";
    if (!result.ok) {
      notice = result.error === "duplicate_code" ? "Такой код уже существует." : "Не удалось добавить код.";
    }

    return redirect(res, makeQuery("/codes", { notice }));
  }

  if (path === "/actions/import-codes") {
    const productType = String(form.get("productType") || "").trim();
    const parsed = parseManualCodes(form.get("codesText"), productType);

    let added = 0;
    let duplicates = 0;

    for (const item of parsed.items) {
      const result = createSinglePromoCode(item);
      if (result.ok) {
        added += 1;
      } else if (result.error === "duplicate_code") {
        duplicates += 1;
      }
    }

    const notice = `Импорт завершён: добавлено ${added}, дублей ${duplicates}, пропущено строк ${parsed.skipped}.`;
    return redirect(res, makeQuery("/manage", { notice }));
  }

  if (path === "/actions/draw-wheel") {
    const productType = String(form.get("productType") || "").trim();
    const status = String(form.get("status") || "used").trim();
    const result = drawRandomPromoCode({ productType, status });

    if (!result.ok) {
      const label = status === "free" ? "свободных промокодов" : "использованных промокодов";
      const notice = productType ? `Для товара "${productType}" нет ${label}.` : `${label[0].toUpperCase()}${label.slice(1)} нет.`;
      return redirect(res, makeQuery("/manage", { notice }));
    }

    return redirect(
      res,
      makeQuery("/manage", {
        notice: "Колесо выбрало промокод.",
        wheelCode: result.promoCode.code,
        wheelProduct: result.promoCode.product_type,
        wheelCount: result.totalCount,
        wheelMode: result.status
      })
    );
  }

  if (path === "/actions/release-code") {
    const result = releasePromoCode(form.get("codeId"));
    const notice = result.ok ? "Код снова сделан свободным." : "Не удалось освободить код.";
    return redirect(res, makeQuery("/codes", { notice }));
  }

  if (path === "/actions/delete-code") {
    const result = deletePromoCode(form.get("codeId"));
    const notice = result.ok ? "Свободный код удалён." : "Удалить можно только существующий свободный код.";
    return redirect(res, makeQuery("/codes", { notice }));
  }

  res.statusCode = 404;
  res.end("Not Found");
}

function exportCsv(res, rows, headers, filename) {
  const csvLines = [`sep=;`, headers.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(";")];

  for (const row of rows) {
    csvLines.push(
      row
        .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
        .join(";")
    );
  }

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.end(`\uFEFF${csvLines.join("\n")}`);
}

function handleExport(res, url) {
  if (url.pathname === "/export/participants.csv") {
    const rows = getParticipantsAdmin("").map((item) => [
      item.telegram_user_id,
      formatPerson(item),
      item.phone || "",
      item.language || "",
      item.total_codes
    ]);

    return exportCsv(res, rows, ["Telegram ID", "Участник", "Телефон", "Язык", "Кодов"], "participants.csv");
  }

  if (url.pathname === "/export/codes.csv") {
    const rows = getPromoCodesAdmin({ query: "", status: "all", limit: 100000 }).map((item) => [
      item.code,
      item.product_type,
      item.used_at ? "Использован" : "Свободен",
      item.phone || "",
      formatPerson(item),
      item.used_at || ""
    ]);

    return exportCsv(res, rows, ["Промокод", "Товар", "Статус", "Телефон", "Участник", "Дата"], "promo_codes.csv");
  }

  if (url.pathname === "/export/entries.csv") {
    const rows = getCodeEntriesAdmin({ query: "", limit: 100000 }).map((item) => [
      item.code,
      item.product_type,
      item.phone || "",
      formatPerson(item),
      item.created_at
    ]);

    return exportCsv(res, rows, ["Промокод", "Товар", "Телефон", "Участник", "Дата"], "code_entries.csv");
  }

  res.statusCode = 404;
  res.end("Not Found");
}

const server = http.createServer(async (req, res) => {
  if (!isAuthorized(req)) {
    return unauthorized(res);
  }

  const url = new URL(req.url, `http://localhost:${ADMIN_PORT}`);

  if (req.method === "POST") {
    return handlePost(req, res, url);
  }

  if (url.pathname.startsWith("/export/")) {
    return handleExport(res, url);
  }

  let html = "";

  if (url.pathname === "/") {
    html = dashboardPage(url);
  } else if (url.pathname === "/participants") {
    html = participantsPage(url);
  } else if (url.pathname === "/codes") {
    html = codesPage(url);
  } else if (url.pathname === "/entries") {
    html = entriesPage(url);
  } else if (url.pathname === "/manage") {
    html = managePage(url);
  } else {
    res.statusCode = 404;
    html = pageLayout({
      title: "Не найдено",
      active: "",
      content: `<div class="panel"><div class="empty">Страница не найдена.</div></div>`
    });
  }

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(html);
});

server.listen(ADMIN_PORT, ADMIN_HOST, () => {
  console.log(`Admin panel is running at http://localhost:${ADMIN_PORT}`);
});

