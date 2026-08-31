import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth-context";

export default async function AdminAuditPage() {
  const user = await getSessionUser();
  if (!user) return null;
  const rows = await prisma.auditEvent.findMany({
    where: { actor: { organizationId: user.organizationId } },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { actor: true },
  });
  return (
    <div>
      <h1 className="h1">Audit trail</h1>
      <p className="muted">Immutable-style events (actor, entity, correlation when present).</p>
      <table className="card" style={{ marginTop: 16, padding: 0 }}>
        <thead>
          <tr>
            <th>Time (UTC)</th>
            <th>Actor</th>
            <th>Action</th>
            <th>Entity</th>
            <th>Correlation</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.createdAt.toISOString()}</td>
              <td>{r.actor?.email ?? "—"}</td>
              <td>{r.action}</td>
              <td>
                {r.entity} {r.entityId ? `(${r.entityId.slice(0, 8)}…)` : ""}
              </td>
              <td className="muted">{r.correlationId ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
