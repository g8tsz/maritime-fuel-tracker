import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth-context";

export default async function AdminErrorsPage() {
  const user = await getSessionUser();
  if (!user) return null;
  const sites = await prisma.site.findMany({
    where: { organizationId: user.organizationId },
    select: { id: true },
  });
  const siteIds = sites.map((s) => s.id);
  const stations = await prisma.station.findMany({
    where: { siteId: { in: siteIds } },
    select: { id: true },
  });
  const stationIds = stations.map((s) => s.id);
  const rows =
    siteIds.length === 0
      ? []
      : await prisma.applicationErrorLog.findMany({
          where: {
            OR: [
              ...(stationIds.length ? [{ stationId: { in: stationIds } }] : []),
              { siteId: { in: siteIds } },
            ],
          },
          orderBy: { createdAt: "desc" },
          take: 100,
          include: { station: { include: { site: true } } },
        });
  return (
    <div>
      <h1 className="h1">Application errors</h1>
      <p className="muted">Structured codes for edge/API failures (see also JSON logs on the server).</p>
      <table className="card" style={{ marginTop: 16, padding: 0 }}>
        <thead>
          <tr>
            <th>Time (UTC)</th>
            <th>Code</th>
            <th>HTTP</th>
            <th>Station</th>
            <th>Correlation</th>
            <th>Message</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.createdAt.toISOString()}</td>
              <td>{r.code}</td>
              <td>{r.httpStatus ?? "—"}</td>
              <td>{r.station ? `${r.station.site.name} / ${r.station.code}` : "—"}</td>
              <td className="muted">{r.correlationId ?? "—"}</td>
              <td>{r.message}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
