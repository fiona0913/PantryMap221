import fs from "node:fs";
import readline from "node:readline";
import { CosmosClient } from "@azure/cosmos";

const endpoint = process.env.COSMOS_ENDPOINT;
const key = process.env.COSMOS_KEY;

const databaseId = process.env.COSMOS_DATABASE || "microPantry";
const containerId = process.env.COSMOS_CONTAINER_PANTRIES || "pantries";

// 改成你的 jsonl 路径（建议把文件放到 functions-backend/data/ 里）
const inputPath = process.argv[2] || "./data/export_df_cosmos_ready.jsonl";

if (!endpoint || !key) {
  console.error("Missing COSMOS_ENDPOINT or COSMOS_KEY in env vars.");
  process.exit(1);
}

if (!fs.existsSync(inputPath)) {
  console.error(`Input file not found: ${inputPath}`);
  process.exit(1);
}

const client = new CosmosClient({ endpoint, key });
const container = client.database(databaseId).container(containerId);

const rl = readline.createInterface({
  input: fs.createReadStream(inputPath, { encoding: "utf-8" }),
  crlfDelay: Infinity
});

let ok = 0;
let fail = 0;

for await (const line of rl) {
  const trimmed = line.trim();
  if (!trimmed) continue;

  try {
    const doc = JSON.parse(trimmed);

    if (!doc.id) throw new Error("Missing id");

    // upsert = 有则更新，无则创建
    await container.items.upsert(doc);
    ok++;

    if (ok % 50 === 0) console.log(`Upserted ${ok} items...`);
  } catch (e) {
    fail++;
    console.error("Failed line:", trimmed.slice(0, 120), "...");
    console.error("Error:", e?.message || e);
  }
}

console.log(`Done. Success: ${ok}, Failed: ${fail}`);
