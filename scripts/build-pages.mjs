import { cpSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const rawBase = process.env.API_BASE_URL || "";
let base;
try {
  base = new URL(rawBase);
} catch {
  throw new Error("API_BASE_URL must be the HTTPS origin of the Render service.");
}
if (base.protocol !== "https:" || base.username || base.password || base.pathname !== "/" || base.search || base.hash) {
  throw new Error("API_BASE_URL must be a plain HTTPS origin without a path or credentials.");
}

const outputDir = join(import.meta.dirname, "..", "site");
mkdirSync(outputDir, { recursive: true });
cpSync(join(import.meta.dirname, "..", "public"), outputDir, { recursive: true });
writeFileSync(join(outputDir, "config.js"), `window.FEELING_FACE_API_BASE_URL = ${JSON.stringify(base.origin)};\n`);
console.log(`GitHub Pages files prepared for ${base.origin}`);
