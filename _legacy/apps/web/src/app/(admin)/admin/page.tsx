import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth-context";

export default async function AdminFleetPage() {
  const user = await getSessionUser();
  if (!user) return null;
  const orgId = user.organizationId;
  const stations = await prisma.station.findMany({
    where: { site: { organizationId: orgId } },
    include: {
      site: true,
      rollups: { orderBy: { periodStart: "desc" }, take: 3 },
      _count: { select: { deliveries: true } },
    },
    orderBy: [{ siteId: "asc" }, { sortOrder: "asc" }],
  });
  const edgeDevices = await prisma.edgeDevice.findMany({
    where: { site: { organizationId: orgId } },
    include: { site: true },
  });
  return (
    <div>
      <h1 className="h1">Fleet overview</h1>
      <p className="muted">Per-station rollups (latest buckets) and edge device last-seen.</p>
      <div className="card" style={{ marginTop: 16 }}>
        <h2 className="h2">Edge devices</h2>
        <table>
          <thead>
            <tr>
              <th>Site</th>
              <th>Device</th>
              <th>Last seen (UTC)</th>
            </tr>
          </thead>
          <tbody>
            {edgeDevices.map((e) => (
              <tr key={e.id}>
                <td>{e.site.name}</td>
                <td>{e.name}</td>
                <td>{e.lastSeenAt?.toISOString() ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
        {stations.map((s) => (
          <div key={s.id} className="card">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <div>
                <strong>{s.displayName}</strong>{" "}
                <span className="muted">
                  ({s.code}) — {s.site.name}
                </span>
              </div>
              <Link href={`/admin/stations/${s.id}`}>Details →</Link>
            </div>
            <p className="muted" style={{ margin: "8px 0" }}>
              Deliveries (all time): {s._count.deliveries}
            </p>
            <table>
              <thead>
                <tr>
                  <th>Period start (UTC)</th>
                  <th>Granularity</th>
                  <th>Deliveries</th>
                  <th>Σ mass kg</th>
                  <th>Errors</th>
                </tr>
              </thead>
              <tbody>
                {s.rollups.map((r) => (
                  <tr key={r.id}>
                    <td>{r.periodStart.toISOString()}</td>
                    <td>{r.granularity}</td>
                    <td>{r.deliveryCount}</td>
                    <td>{r.totalRawMassKg?.toString() ?? "—"}</td>
                    <td>{r.errorCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}
