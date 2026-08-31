import { appendFile, mkdir, readFile, writeFile } from "fs/promises";
import { dirname } from "path";

async function ensureDirForFile(filePath: string) {
  await mkdir(dirname(filePath), { recursive: true });
}

/**
 * Append-only durable queue: JSON lines. `cursorPath` stores a byte offset of the last
 * successfully delivered line (checkpoint). Crash-safe: acknowledged data is never re-sent.
 */
export async function appendOutboxLine(logPath: string, lineObject: unknown) {
  await ensureDirForFile(logPath);
  await appendFile(logPath, `${JSON.stringify(lineObject)}\n`, "utf8");
}

async function readCursor(cursorPath: string): Promise<number> {
  try {
    const t = await readFile(cursorPath, "utf8");
    const n = parseInt(t.trim(), 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

async function writeCursor(cursorPath: string, offset: number) {
  await ensureDirForFile(cursorPath);
  await writeFile(cursorPath, String(offset), "utf8");
}

/**
 * If the next full line is available, POST it via `deliver` and advance the cursor on success.
 * Returns true if a line was delivered.
 */
export async function deliverNextOutboxLine(
  logPath: string,
  cursorPath: string,
  deliver: (payload: unknown) => Promise<void>,
): Promise<boolean> {
  await ensureDirForFile(logPath);
  let buf: Buffer;
  try {
    buf = await readFile(logPath);
  } catch {
    return false;
  }
  const offset = await readCursor(cursorPath);
  if (offset >= buf.length) return false;
  const slice = buf.subarray(offset);
  const nl = slice.indexOf(10); // '\n'
  if (nl === -1) return false;
  const lineBytes = slice.subarray(0, nl);
  const line = lineBytes.toString("utf8");
  const nextOffset = offset + lineBytes.length + 1;
  let payload: unknown;
  try {
    payload = JSON.parse(line) as unknown;
  } catch {
    await writeCursor(cursorPath, nextOffset);
    return true;
  }
  await deliver(payload);
  await writeCursor(cursorPath, nextOffset);
  return true;
}
