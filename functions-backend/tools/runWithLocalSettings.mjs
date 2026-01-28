import fs from "node:fs";

const settings = JSON.parse(fs.readFileSync("./local.settings.json", "utf-8"));
const values = settings?.Values || {};

for (const [k, v] of Object.entries(values)) {
  process.env[k] = String(v);
}

const script = process.argv[2];
const args = process.argv.slice(3);

if (!script) {
  console.error("Usage: node tools/runWithLocalSettings.mjs <script> [args...]");
  process.exit(1);
}

const { spawn } = await import("node:child_process");
const p = spawn("node", [script, ...args], { stdio: "inherit", env: process.env });
p.on("exit", (code) => process.exit(code ?? 0));
