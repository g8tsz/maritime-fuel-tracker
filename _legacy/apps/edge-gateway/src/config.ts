import { z } from "zod";

const schema = z.object({
  CLOUD_BASE_URL: z.string().url(),
  EDGE_API_KEY: z.string().min(16),
  SITE_ID: z.string().cuid(),
  BERTH_LINE_ID: z.string().cuid(),
  DELIVERY_ID: z.string().cuid(),
  AGGREGATE_MS: z.coerce.number().int().positive().default(1000),
  OUTBOX_LOG_PATH: z.string().default("./data/outbox.log"),
  OUTBOX_CURSOR_PATH: z.string().optional(),
});

export type EdgeConfig = z.infer<typeof schema> & { outboxCursorPath: string };

export function loadConfig(): EdgeConfig {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.error(parsed.error.flatten().fieldErrors);
    throw new Error("Invalid edge gateway environment");
  }
  const base = parsed.data;
  return {
    ...base,
    outboxCursorPath: base.OUTBOX_CURSOR_PATH ?? `${base.OUTBOX_LOG_PATH}.cursor`,
  };
}
