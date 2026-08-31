import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, "..", "prisma", "dev.db");
try {
  fs.unlinkSync(dbPath);
} catch (e) {
  if (e && e.code !== "ENOENT") throw e;
}
