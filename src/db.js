const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const Database = require("better-sqlite3");

function ensureDatabaseDirectory(databasePath) {
  const fullPath = path.resolve(databasePath);
  const dir = path.dirname(fullPath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  return fullPath;
}

function normalizePhone(phone) {
  return String(phone || "").replace(/[^\d+]/g, "");
}

function normalizeCode(code) {
  return String(code || "").trim().toUpperCase();
}

function buildLikeQuery(query) {
  return `%${String(query || "").trim()}%`;
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomChunk(length = 4) {
  let value = "";

  while (value.length < length) {
    const bytes = crypto.randomBytes(length);

    for (const byte of bytes) {
      value += CODE_ALPHABET[byte % CODE_ALPHABET.length];
      if (value.length === length) {
        break;
      }
    }
  }

  return value;
}

function buildSecurePromoCode(prefix) {
  const cleanPrefix = String(prefix || "").trim().toUpperCase();
  return `${cleanPrefix}-${randomChunk(3)}-${randomChunk(3)}`;
}

function createDb(databasePath) {
  const resolvedPath = ensureDatabaseDirectory(databasePath);
  const db = new Database(resolvedPath);

  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS participants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_user_id INTEGER NOT NULL UNIQUE,
      username TEXT,
      first_name TEXT,
      last_name TEXT,
      language TEXT NOT NULL DEFAULT 'ru',
      phone TEXT UNIQUE,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS promo_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      product_type TEXT NOT NULL,
      used_by_participant_id INTEGER,
      used_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (used_by_participant_id) REFERENCES participants(id)
    );

    CREATE TABLE IF NOT EXISTS code_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      participant_id INTEGER NOT NULL,
      promo_code_id INTEGER NOT NULL,
      code TEXT NOT NULL,
      product_type TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (participant_id) REFERENCES participants(id),
      FOREIGN KEY (promo_code_id) REFERENCES promo_codes(id)
    );
  `);

  const participantColumns = db.prepare("PRAGMA table_info(participants)").all();
  if (!participantColumns.some((column) => column.name === "language")) {
    db.exec("ALTER TABLE participants ADD COLUMN language TEXT NOT NULL DEFAULT 'ru'");
  }

  const statements = {
    upsertParticipant: db.prepare(`
      INSERT INTO participants (telegram_user_id, username, first_name, last_name)
      VALUES (@telegram_user_id, @username, @first_name, @last_name)
      ON CONFLICT(telegram_user_id) DO UPDATE SET
        username = excluded.username,
        first_name = excluded.first_name,
        last_name = excluded.last_name,
        updated_at = CURRENT_TIMESTAMP
    `),
    getParticipantByTelegramId: db.prepare(`
      SELECT *
      FROM participants
      WHERE telegram_user_id = ?
    `),
    getParticipantByPhone: db.prepare(`
      SELECT *
      FROM participants
      WHERE phone = ?
    `),
    updatePhone: db.prepare(`
      UPDATE participants
      SET phone = ?, updated_at = CURRENT_TIMESTAMP
      WHERE telegram_user_id = ?
    `),
    updateLanguage: db.prepare(`
      UPDATE participants
      SET language = ?, updated_at = CURRENT_TIMESTAMP
      WHERE telegram_user_id = ?
    `),
    getPromoCodeByCode: db.prepare(`
      SELECT pc.*, p.telegram_user_id
      FROM promo_codes pc
      LEFT JOIN participants p ON p.id = pc.used_by_participant_id
      WHERE pc.code = ?
    `),
    getPromoCodeById: db.prepare(`
      SELECT *
      FROM promo_codes
      WHERE id = ?
    `),
    insertPromoCode: db.prepare(`
      INSERT OR IGNORE INTO promo_codes (code, product_type)
      VALUES (?, ?)
    `),
    markPromoCodeUsed: db.prepare(`
      UPDATE promo_codes
      SET used_by_participant_id = ?, used_at = CURRENT_TIMESTAMP
      WHERE id = ? AND used_by_participant_id IS NULL
    `),
    releasePromoCode: db.prepare(`
      UPDATE promo_codes
      SET used_by_participant_id = NULL, used_at = NULL
      WHERE id = ?
    `),
    deletePromoCodeById: db.prepare(`
      DELETE FROM promo_codes
      WHERE id = ? AND used_by_participant_id IS NULL
    `),
    deleteCodeEntriesByPromoCodeId: db.prepare(`
      DELETE FROM code_entries
      WHERE promo_code_id = ?
    `),
    insertCodeEntry: db.prepare(`
      INSERT INTO code_entries (participant_id, promo_code_id, code, product_type)
      VALUES (?, ?, ?, ?)
    `),
    leaderboard: db.prepare(`
      SELECT
        p.id,
        p.telegram_user_id,
        p.phone,
        p.username,
        p.first_name,
        p.last_name,
        p.language,
        COUNT(ce.id) AS total_codes
      FROM participants p
      LEFT JOIN code_entries ce ON ce.participant_id = p.id
      GROUP BY p.id
      HAVING total_codes > 0
      ORDER BY total_codes DESC, p.created_at ASC
      LIMIT ?
    `),
    participantStats: db.prepare(`
      SELECT
        p.*,
        COUNT(ce.id) AS total_codes
      FROM participants p
      LEFT JOIN code_entries ce ON ce.participant_id = p.id
      WHERE p.telegram_user_id = ?
      GROUP BY p.id
    `),
    participantBreakdown: db.prepare(`
      SELECT
        ce.product_type,
        COUNT(*) AS total
      FROM code_entries ce
      INNER JOIN participants p ON p.id = ce.participant_id
      WHERE p.telegram_user_id = ?
      GROUP BY ce.product_type
      ORDER BY total DESC, ce.product_type ASC
    `),
    searchParticipant: db.prepare(`
      SELECT
        p.*,
        COUNT(ce.id) AS total_codes
      FROM participants p
      LEFT JOIN code_entries ce ON ce.participant_id = p.id
      WHERE p.telegram_user_id = @numericQuery
         OR p.phone = @textQuery
         OR p.username = @usernameQuery
      GROUP BY p.id
      LIMIT 1
    `),
    participantById: db.prepare(`
      SELECT
        p.*,
        COUNT(ce.id) AS total_codes
      FROM participants p
      LEFT JOIN code_entries ce ON ce.participant_id = p.id
      WHERE p.id = ?
      GROUP BY p.id
    `),
    participantBreakdownById: db.prepare(`
      SELECT
        product_type,
        COUNT(*) AS total
      FROM code_entries
      WHERE participant_id = ?
      GROUP BY product_type
      ORDER BY total DESC, product_type ASC
    `),
    participantRecentEntriesById: db.prepare(`
      SELECT code, product_type, created_at
      FROM code_entries
      WHERE participant_id = ?
      ORDER BY id DESC
      LIMIT 20
    `),
    participantsAdminList: db.prepare(`
      SELECT
        p.id,
        p.telegram_user_id,
        p.username,
        p.first_name,
        p.last_name,
        p.phone,
        p.language,
        p.created_at,
        COUNT(ce.id) AS total_codes
      FROM participants p
      LEFT JOIN code_entries ce ON ce.participant_id = p.id
      WHERE (
        @query = ''
        OR p.phone LIKE @likeQuery
        OR p.username LIKE @likeQuery
        OR p.first_name LIKE @likeQuery
        OR p.last_name LIKE @likeQuery
        OR CAST(p.telegram_user_id AS TEXT) LIKE @likeQuery
      )
      GROUP BY p.id
      ORDER BY total_codes DESC, p.created_at ASC
    `),
    promoCodesAll: db.prepare(`
      SELECT
        pc.id,
        pc.code,
        pc.product_type,
        pc.used_at,
        pc.created_at,
        p.phone,
        p.username,
        p.first_name,
        p.last_name
      FROM promo_codes pc
      LEFT JOIN participants p ON p.id = pc.used_by_participant_id
      WHERE (
        @query = ''
        OR pc.code LIKE @likeQuery
        OR pc.product_type LIKE @likeQuery
        OR p.phone LIKE @likeQuery
        OR p.username LIKE @likeQuery
      )
      ORDER BY pc.id DESC
      LIMIT @limit
    `),
    promoCodesUsed: db.prepare(`
      SELECT
        pc.id,
        pc.code,
        pc.product_type,
        pc.used_at,
        pc.created_at,
        p.phone,
        p.username,
        p.first_name,
        p.last_name
      FROM promo_codes pc
      LEFT JOIN participants p ON p.id = pc.used_by_participant_id
      WHERE pc.used_by_participant_id IS NOT NULL
        AND (
          @query = ''
          OR pc.code LIKE @likeQuery
          OR pc.product_type LIKE @likeQuery
          OR p.phone LIKE @likeQuery
          OR p.username LIKE @likeQuery
        )
      ORDER BY pc.id DESC
      LIMIT @limit
    `),
    promoCodesFree: db.prepare(`
      SELECT
        pc.id,
        pc.code,
        pc.product_type,
        pc.used_at,
        pc.created_at,
        p.phone,
        p.username,
        p.first_name,
        p.last_name
      FROM promo_codes pc
      LEFT JOIN participants p ON p.id = pc.used_by_participant_id
      WHERE pc.used_by_participant_id IS NULL
        AND (
          @query = ''
          OR pc.code LIKE @likeQuery
          OR pc.product_type LIKE @likeQuery
          OR p.phone LIKE @likeQuery
          OR p.username LIKE @likeQuery
        )
      ORDER BY pc.id DESC
      LIMIT @limit
    `),
    codeEntriesAdminList: db.prepare(`
      SELECT
        ce.id,
        ce.code,
        ce.product_type,
        ce.created_at,
        p.phone,
        p.username,
        p.first_name,
        p.last_name
      FROM code_entries ce
      LEFT JOIN participants p ON p.id = ce.participant_id
      WHERE (
        @query = ''
        OR ce.code LIKE @likeQuery
        OR ce.product_type LIKE @likeQuery
        OR p.phone LIKE @likeQuery
        OR p.username LIKE @likeQuery
      )
      ORDER BY ce.id DESC
      LIMIT @limit
    `),
    overviewSummary: db.prepare(`
      SELECT
        COUNT(*) AS total_codes,
        SUM(CASE WHEN used_by_participant_id IS NOT NULL THEN 1 ELSE 0 END) AS used_codes,
        SUM(CASE WHEN used_by_participant_id IS NULL THEN 1 ELSE 0 END) AS free_codes
      FROM promo_codes
    `),
    overviewParticipants: db.prepare(`
      SELECT COUNT(*) AS total_participants
      FROM participants
    `),
    overviewActiveParticipants: db.prepare(`
      SELECT COUNT(DISTINCT participant_id) AS total_active
      FROM code_entries
    `),
    overviewTopProducts: db.prepare(`
      SELECT
        product_type,
        COUNT(*) AS total
      FROM code_entries
      GROUP BY product_type
      ORDER BY total DESC, product_type ASC
    `),
    overviewRecentEntries: db.prepare(`
      SELECT
        ce.code,
        ce.product_type,
        ce.created_at,
        p.phone,
        p.username,
        p.first_name,
        p.last_name
      FROM code_entries ce
      LEFT JOIN participants p ON p.id = ce.participant_id
      ORDER BY ce.id DESC
      LIMIT 10
    `),
    productSummary: db.prepare(`
      SELECT
        pc.product_type,
        COUNT(*) AS total_codes,
        SUM(CASE WHEN pc.used_by_participant_id IS NOT NULL THEN 1 ELSE 0 END) AS used_codes,
        SUM(CASE WHEN pc.used_by_participant_id IS NULL THEN 1 ELSE 0 END) AS free_codes
      FROM promo_codes pc
      GROUP BY pc.product_type
      ORDER BY pc.product_type ASC
    `),
    distinctProducts: db.prepare(`
      SELECT product_type
      FROM (
        SELECT DISTINCT product_type FROM promo_codes
        UNION
        SELECT DISTINCT product_type FROM code_entries
      )
      WHERE product_type IS NOT NULL AND TRIM(product_type) != ''
      ORDER BY product_type ASC
    `),
    randomUsedPromoCodeAny: db.prepare(`
      SELECT id, code, product_type
      FROM promo_codes
      WHERE used_by_participant_id IS NOT NULL
      ORDER BY RANDOM()
      LIMIT 1
    `),
    randomUsedPromoCodeByProduct: db.prepare(`
      SELECT id, code, product_type
      FROM promo_codes
      WHERE used_by_participant_id IS NOT NULL
        AND product_type = ?
      ORDER BY RANDOM()
      LIMIT 1
    `),
    usedCodesCountAny: db.prepare(`
      SELECT COUNT(*) AS total
      FROM promo_codes
      WHERE used_by_participant_id IS NOT NULL
    `),
    usedCodesCountByProduct: db.prepare(`
      SELECT COUNT(*) AS total
      FROM promo_codes
      WHERE used_by_participant_id IS NOT NULL
        AND product_type = ?
    `),
    randomFreePromoCodeAny: db.prepare(`
      SELECT id, code, product_type
      FROM promo_codes
      WHERE used_by_participant_id IS NULL
      ORDER BY RANDOM()
      LIMIT 1
    `),
    randomFreePromoCodeByProduct: db.prepare(`
      SELECT id, code, product_type
      FROM promo_codes
      WHERE used_by_participant_id IS NULL
        AND product_type = ?
      ORDER BY RANDOM()
      LIMIT 1
    `),
    freeCodesCountAny: db.prepare(`
      SELECT COUNT(*) AS total
      FROM promo_codes
      WHERE used_by_participant_id IS NULL
    `),
    freeCodesCountByProduct: db.prepare(`
      SELECT COUNT(*) AS total
      FROM promo_codes
      WHERE used_by_participant_id IS NULL
        AND product_type = ?
    `)
  };

  const redeemPromoCode = db.transaction((telegramUserId, rawCode) => {
    const code = normalizeCode(rawCode);
    const participant = statements.getParticipantByTelegramId.get(telegramUserId);

    if (!participant || !participant.phone) {
      return { ok: false, error: "participant_not_registered" };
    }

    const promoCode = statements.getPromoCodeByCode.get(code);

    if (!promoCode) {
      return { ok: false, error: "code_not_found" };
    }

    if (promoCode.used_by_participant_id) {
      return {
        ok: false,
        error: promoCode.telegram_user_id === telegramUserId ? "code_already_used_by_you" : "code_already_used"
      };
    }

    const updated = statements.markPromoCodeUsed.run(participant.id, promoCode.id);

    if (updated.changes === 0) {
      return { ok: false, error: "code_already_used" };
    }

    statements.insertCodeEntry.run(participant.id, promoCode.id, promoCode.code, promoCode.product_type);

    return {
      ok: true,
      productType: promoCode.product_type
    };
  });

  const generatePromoCodesTransaction = db.transaction(({ productType, prefix, count }) => {
    let added = 0;
    let attempts = 0;
    const maxAttempts = Math.max(count * 30, 100);

    while (added < count && attempts < maxAttempts) {
      attempts += 1;
      const code = buildSecurePromoCode(prefix);
      const result = statements.insertPromoCode.run(normalizeCode(code), String(productType).trim());
      if (result.changes > 0) {
        added += 1;
      }
    }

    return { added, attempts };
  });

  const releasePromoCodeTransaction = db.transaction((codeId) => {
    const promoCode = statements.getPromoCodeById.get(codeId);

    if (!promoCode) {
      return { ok: false, error: "code_not_found" };
    }

    statements.releasePromoCode.run(codeId);
    statements.deleteCodeEntriesByPromoCodeId.run(codeId);

    return { ok: true, promoCode };
  });

  function saveParticipant(user) {
    statements.upsertParticipant.run({
      telegram_user_id: user.id,
      username: user.username || null,
      first_name: user.first_name || null,
      last_name: user.last_name || null
    });

    return statements.getParticipantByTelegramId.get(user.id);
  }

  function getParticipant(telegramUserId) {
    return statements.getParticipantByTelegramId.get(telegramUserId);
  }

  function savePhone(telegramUserId, rawPhone) {
    const phone = normalizePhone(rawPhone);
    const existingByPhone = statements.getParticipantByPhone.get(phone);

    if (existingByPhone && existingByPhone.telegram_user_id !== telegramUserId) {
      return { ok: false, error: "phone_already_used" };
    }

    statements.updatePhone.run(phone, telegramUserId);
    return { ok: true, participant: statements.getParticipantByTelegramId.get(telegramUserId) };
  }

  function importPromoCodes(rows) {
    const insertMany = db.transaction((items) => {
      for (const item of items) {
        const code = normalizeCode(item.code);
        const productType = String(item.product_type || "").trim();

        if (!code || !productType) {
          continue;
        }

        statements.insertPromoCode.run(code, productType);
      }
    });

    insertMany(rows);
  }

  function saveLanguage(telegramUserId, language) {
    statements.updateLanguage.run(language, telegramUserId);
    return statements.getParticipantByTelegramId.get(telegramUserId);
  }

  function getParticipantPrivateStats(telegramUserId) {
    const participant = statements.participantStats.get(telegramUserId);

    if (!participant) {
      return null;
    }

    const breakdown = statements.participantBreakdown.all(telegramUserId);
    const favoriteProduct = breakdown[0] || null;

    return {
      participant,
      breakdown,
      favoriteProduct
    };
  }

  function getLeaderboard(limit = 10) {
    return statements.leaderboard.all(limit);
  }

  function findParticipant(query) {
    const trimmed = String(query || "").trim();
    const usernameQuery = trimmed.startsWith("@") ? trimmed.slice(1) : trimmed;
    const numericQuery = Number(trimmed);
    const participant = statements.searchParticipant.get({
      numericQuery: Number.isFinite(numericQuery) ? numericQuery : -1,
      textQuery: trimmed,
      usernameQuery
    });

    if (!participant) {
      return null;
    }

    const breakdown = statements.participantBreakdownById.all(participant.id);
    return { participant, breakdown };
  }

  function getAdminOverview() {
    return {
      summary: statements.overviewSummary.get(),
      participants: statements.overviewParticipants.get(),
      activeParticipants: statements.overviewActiveParticipants.get(),
      topProducts: statements.overviewTopProducts.all(),
      recentEntries: statements.overviewRecentEntries.all(),
      leaderboard: statements.leaderboard.all(10),
      productSummary: statements.productSummary.all()
    };
  }

  function getParticipantsAdmin(query = "") {
    return statements.participantsAdminList.all({
      query: String(query || "").trim(),
      likeQuery: buildLikeQuery(query)
    });
  }

  function getParticipantAdminDetails(participantId) {
    const participant = statements.participantById.get(participantId);
    if (!participant) {
      return null;
    }

    return {
      participant,
      breakdown: statements.participantBreakdownById.all(participantId),
      recentEntries: statements.participantRecentEntriesById.all(participantId)
    };
  }

  function getPromoCodesAdmin({ query = "", status = "all", limit = 500 } = {}) {
    const payload = {
      query: String(query || "").trim(),
      likeQuery: buildLikeQuery(query),
      limit
    };

    if (status === "used") {
      return statements.promoCodesUsed.all(payload);
    }

    if (status === "free") {
      return statements.promoCodesFree.all(payload);
    }

    return statements.promoCodesAll.all(payload);
  }

  function getCodeEntriesAdmin({ query = "", limit = 500 } = {}) {
    return statements.codeEntriesAdminList.all({
      query: String(query || "").trim(),
      likeQuery: buildLikeQuery(query),
      limit
    });
  }

  function getDistinctProducts() {
    return statements.distinctProducts.all().map((row) => row.product_type);
  }

  function createSinglePromoCode({ code, productType }) {
    const normalizedCode = normalizeCode(code);
    const cleanProductType = String(productType || "").trim();

    if (!normalizedCode || !cleanProductType) {
      return { ok: false, error: "invalid_payload" };
    }

    const result = statements.insertPromoCode.run(normalizedCode, cleanProductType);

    if (result.changes === 0) {
      return { ok: false, error: "duplicate_code" };
    }

    return { ok: true };
  }

  function generatePromoCodes({ productType, prefix, count, startIndex = 1 }) {
    const cleanProductType = String(productType || "").trim();
    const cleanPrefix = String(prefix || "").trim().toUpperCase();
    const parsedCount = Number(count);

    if (!cleanProductType || !cleanPrefix || !Number.isInteger(parsedCount) || parsedCount <= 0) {
      return { ok: false, error: "invalid_payload" };
    }

    const generated = generatePromoCodesTransaction({
      productType: cleanProductType,
      prefix: cleanPrefix,
      count: parsedCount
    });

    return { ok: true, added: generated.added, attempts: generated.attempts };
  }

  function releasePromoCode(codeId) {
    const parsedCodeId = Number(codeId);

    if (!Number.isInteger(parsedCodeId) || parsedCodeId <= 0) {
      return { ok: false, error: "invalid_code_id" };
    }

    return releasePromoCodeTransaction(parsedCodeId);
  }

  function deletePromoCode(codeId) {
    const parsedCodeId = Number(codeId);

    if (!Number.isInteger(parsedCodeId) || parsedCodeId <= 0) {
      return { ok: false, error: "invalid_code_id" };
    }

    const promoCode = statements.getPromoCodeById.get(parsedCodeId);
    if (!promoCode) {
      return { ok: false, error: "code_not_found" };
    }

    if (promoCode.used_by_participant_id) {
      return { ok: false, error: "code_is_used" };
    }

    const result = statements.deletePromoCodeById.run(parsedCodeId);
    return { ok: result.changes > 0 };
  }

  function drawRandomPromoCode({ productType = "", status = "used" } = {}) {
    const cleanProductType = String(productType || "").trim();
    const cleanStatus = String(status || "used").trim().toLowerCase() === "free" ? "free" : "used";

    const promoCode =
      cleanStatus === "free"
        ? cleanProductType
          ? statements.randomFreePromoCodeByProduct.get(cleanProductType)
          : statements.randomFreePromoCodeAny.get()
        : cleanProductType
          ? statements.randomUsedPromoCodeByProduct.get(cleanProductType)
          : statements.randomUsedPromoCodeAny.get();

    if (!promoCode) {
      return { ok: false, error: cleanStatus === "free" ? "no_free_codes" : "no_used_codes" };
    }

    const totalCount =
      cleanStatus === "free"
        ? cleanProductType
          ? statements.freeCodesCountByProduct.get(cleanProductType).total
          : statements.freeCodesCountAny.get().total
        : cleanProductType
          ? statements.usedCodesCountByProduct.get(cleanProductType).total
          : statements.usedCodesCountAny.get().total;

    return {
      ok: true,
      promoCode,
      totalCount,
      status: cleanStatus
    };
  }

  return {
    db,
    normalizeCode,
    normalizePhone,
    getParticipant,
    saveParticipant,
    saveLanguage,
    savePhone,
    redeemPromoCode,
    importPromoCodes,
    getParticipantPrivateStats,
    getLeaderboard,
    findParticipant,
    getAdminOverview,
    getParticipantsAdmin,
    getParticipantAdminDetails,
    getPromoCodesAdmin,
    getCodeEntriesAdmin,
    getDistinctProducts,
    createSinglePromoCode,
    generatePromoCodes,
    drawRandomPromoCode,
    releasePromoCode,
    deletePromoCode
  };
}

module.exports = {
  createDb
};
