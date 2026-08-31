import { headers } from "next/headers";
import { randomUUID } from "crypto";
import { CORRELATION_HEADER } from "@/lib/correlation-constants";

export { CORRELATION_HEADER };

export async function getCorrelationId(): Promise<string> {
  const h = await headers();
  return h.get(CORRELATION_HEADER) ?? randomUUID();
}
