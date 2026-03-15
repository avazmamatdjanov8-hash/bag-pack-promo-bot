require("dotenv").config();

const { createDb } = require("../src/db");

const databasePath = process.env.DATABASE_PATH || "./data/promo.sqlite";
const { db } = createDb(databasePath);

const participants = db.prepare(`
  SELECT
    p.telegram_user_id,
    p.username,
    p.first_name,
    p.last_name,
    p.phone,
    COUNT(ce.id) AS total_codes
  FROM participants p
  LEFT JOIN code_entries ce ON ce.participant_id = p.id
  GROUP BY p.id
  ORDER BY total_codes DESC, p.created_at ASC
`).all();

const productStats = db.prepare(`
  SELECT
    product_type,
    COUNT(*) AS total_codes
  FROM code_entries
  GROUP BY product_type
  ORDER BY total_codes DESC, product_type ASC
`).all();

const codesSummary = db.prepare(`
  SELECT
    COUNT(*) AS total_codes,
    SUM(CASE WHEN used_by_participant_id IS NOT NULL THEN 1 ELSE 0 END) AS used_codes,
    SUM(CASE WHEN used_by_participant_id IS NULL THEN 1 ELSE 0 END) AS free_codes
  FROM promo_codes
`).get();

console.log("=== Database file ===");
console.log(databasePath);
console.log("");

console.log("=== Promo codes summary ===");
console.table([codesSummary]);
console.log("");

console.log("=== Participants ===");
console.table(participants);
console.log("");

console.log("=== Product stats ===");
console.table(productStats);
