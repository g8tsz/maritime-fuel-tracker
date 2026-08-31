import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth-context";

export default async function AdminHubsPage() {
  const user = await getSessionUser();
  if (!user) return null;
  const hubs = await prisma.fuelHub.findMany({
    where: { site: { organizationId: user.organizationId } },
    include: {
      site: true,
      station: true,
      berthLine: true,
      edgeDevice: true,
      sensors: { orderBy: { channelIndex: "asc" } },
    },
    orderBy: [{ siteId: "asc" }, { code: "asc" }],
  });
  return (
    <div>
      <h1 className="h1">Fuel hubs (FuelTrace-class)</h1>
      <p className="muted">
        Each hub is a field gateway with a sensor stack (clamp-on flow, temperature, vibration, tank cross-check, etc.).
        Link edge API keys to hubs for fleet inventory and future remote diagnostics.
      </p>
      <div style={{ marginTop: 16, display: "grid", gap: 14 }}>
        {hubs.length === 0 ? (
          <p className="muted">No hubs registered yet.</p>
        ) : (
          hubs.map((h) => (
            <div key={h.id} className="card">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <div>
                  <strong>
                    {h.code}
                  </strong>{" "}
                  <span className="muted">— {h.displayName}</span>
                </div>
                <span className="muted" style={{ fontSize: 13 }}>
                  {h.site.name}
                </span>
              </div>
              <p className="muted" style={{ marginBottom: 8 }}>
                Station: {h.station?.code ?? "—"} · Berth: {h.berthLine?.name ?? "—"} · Edge:{" "}
                {h.edgeDevice?.name ?? "—"} · FW: {h.firmwareVersion ?? "—"}
              </p>
              <table>
                <thead>
                  <tr>
                    <th>Ch</th>
                    <th>Kind</th>
                    <th>Label</th>
                    <th>Active</th>
                  </tr>
                </thead>
                <tbody>
                  {h.sensors.map((s) => (
                    <tr key={s.id}>
                      <td>{s.channelIndex}</td>
                      <td>{s.kind}</td>
                      <td>{s.label ?? "—"}</td>
                      <td>{s.isActive ? "yes" : "no"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
