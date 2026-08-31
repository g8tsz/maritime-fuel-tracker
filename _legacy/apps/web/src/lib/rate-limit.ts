type Bucket = { count: number; windowStart: number };

const buckets = new Map<string, Bucket>();

function prune(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now - b.windowStart > windowMs) {
    buckets.set(key, { count: 1, windowStart: now });
    return true;
  }
  if (b.count >= max) return false;
  b.count += 1;
  return true;
}

/** Sliding-ish fixed window counter (good enough for single-instance / dev; use Redis in production). */
export function allow(key: string, max: number, windowMs: number): boolean {
  const ok = prune(key, max, windowMs);
  if (buckets.size > 50_000) {
    const now = Date.now();
    for (const [k, v] of buckets) {
      if (now - v.windowStart > windowMs * 2) buckets.delete(k);
    }
  }
  return ok;
}
