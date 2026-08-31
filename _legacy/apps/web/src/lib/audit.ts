import { prisma } from "./prisma";

export async function audit(
  actorId: string | undefined,
  action: string,
  entity: string,
  entityId?: string,
  payload?: unknown,
  correlationId?: string | null,
) {
  await prisma.auditEvent.create({
    data: {
      actorId,
      action,
      entity,
      entityId,
      payload: JSON.stringify(payload ?? {}),
      correlationId: correlationId ?? null,
    },
  });
}
