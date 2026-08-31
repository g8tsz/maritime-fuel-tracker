import { prisma } from "@/lib/prisma";
import { processNextJob } from "@/lib/jobs/process-jobs";
import { MBP } from "@/lib/errors/codes";

export async function POST(req: Request) {
  const secret = process.env.INTERNAL_JOB_SECRET;
  if (!secret || req.headers.get("x-mbp-internal-secret") !== secret) {
    return Response.json({ ok: false, code: MBP.jobs.unauthorized }, { status: 401 });
  }
  let n = 0;
  for (let i = 0; i < 25; i++) {
    const more = await processNextJob(prisma);
    if (!more) break;
    n++;
  }
  return Response.json({ ok: true, processed: n });
}
