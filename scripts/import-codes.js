require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { createDb } = require("../src/db");

const filePath = process.argv[2];
const databasePath = process.env.DATABASE_PATH || "./data/promo.sqlite";

if (!filePath) {
  console.error("Usage: npm run import:codes -- ./codes.csv");
  process.exit(1);
}

const resolvedFile = path.resolve(filePath);

if (!fs.existsSync(resolvedFile)) {
  console.error(`File not found: ${resolvedFile}`);
  process.exit(1);
}

const db = createDb(databasePath);
const content = fs.readFileSync(resolvedFile, "utf8");
const rows = content
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean)
  .map((line, index) => {
    const [code, product_type] = line.split(",").map((value) => value.trim());

    if (index === 0 && String(code).toLowerCase() === "code" && String(product_type).toLowerCase() === "product_type") {
      return null;
    }

    return { code, product_type };
  })
  .filter(Boolean);

db.importPromoCodes(rows);

console.log(`Imported ${rows.length} promo codes into ${databasePath}`);
