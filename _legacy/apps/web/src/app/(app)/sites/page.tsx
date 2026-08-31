import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth-context";

export default async function SitesPage() {
  const user = await getSessionUser();
  if (!user) return null;
  const sites = await prisma.site.findMany({
    where: { organizationId: user.organizationId },
    include: {
      stations: { orderBy: { sortOrder: "asc" } },
      berthLines: { include: { meter: true, station: true } },
    },
    orderBy: { name: "asc" },
  });
  return (
    <div>
      <h1 className="h1">Sites & berth metering</h1>
      <p className="muted">
        Each <strong>station</strong> is a custody boundary (often one berth line). Meter profiles attach to the berth.
      </p>
      <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
        {sites.map((s) => (
          <div key={s.id} className="card">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <div>
                <div style={{ fontWeight: 700 }}>{s.name}</div>
                <div className="muted" style={{ fontSize: 13 }}>
                  Timezone: {s.timezone}
                </div>
              </div>
            </div>
            {s.stations.length ? (
              <p className="muted" style={{ marginBottom: 0 }}>
                Stations:{" "}
                {s.stations.map((st) => (
                  <span key={st.id}>
                    {st.code} ({st.displayName}){" "}
                  </span>
                ))}
              </p>
            ) : null}
            <table style={{ marginTop: 12 }}>
              <thead>
                <tr>
                  <th>Station</th>
                  <th>Berth line</th>
                  <th>Max rate (m³/h)</th>
                  <th>Meter mode</th>
                </tr>
              </thead>
              <tbody>
                {s.berthLines.map((b) => (
                  <tr key={b.id}>
                    <td>{b.station.code}</td>
                    <td>{b.name}</td>
                    <td>{b.maxRateM3h ?? "—"}</td>
                    <td>{b.meter?.mode ?? "—"}</td>
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
