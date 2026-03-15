const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const items = [
  { prefix: "PAK", productType: "Пакеты", count: 100 },
  { prefix: "STR", productType: "Стрейч-пленки", count: 100 },
  { prefix: "MLK", productType: "Мешки для лука", count: 100 }
];

const outputPath = path.resolve(process.argv[2] || "./codes.generated.csv");
const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const usedCodes = new Set();

function randomChunk(length = 4) {
  let value = "";

  while (value.length < length) {
    const bytes = crypto.randomBytes(length);

    for (const byte of bytes) {
      value += alphabet[byte % alphabet.length];
      if (value.length === length) {
        break;
      }
    }
  }

  return value;
}

function makeCode(prefix) {
  return `${prefix}-${randomChunk(3)}-${randomChunk(3)}`;
}

const lines = ["code,product_type"];

for (const item of items) {
  let added = 0;

  while (added < item.count) {
    const code = makeCode(item.prefix);

    if (usedCodes.has(code)) {
      continue;
    }

    usedCodes.add(code);
    lines.push(`${code},${item.productType}`);
    added += 1;
  }
}

fs.writeFileSync(outputPath, `${lines.join("\n")}\n`, "utf8");

console.log(`Generated ${lines.length - 1} secure promo codes into ${outputPath}`);
