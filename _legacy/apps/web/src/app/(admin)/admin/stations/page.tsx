import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth-context";

export default async function AdminStationsListPage() {
  const user = await getSessionUser();
  if (!user) return null;
  const stations = await prisma.station.findMany({
    where: { site: { organizationId: user.organizationId } },
    include: { site: true, berthLines: true, _count: { select: { deliveries: true } } },
    orderBy: [{ siteId: "asc" }, { sortOrder: "asc" }],
  });
  return (
    <div>
      <h1 className="h1">All stations</h1>
      <table className="card" style={{ marginTop: 16, padding: 0 }}>
        <thead>
          <tr>
            <th>Code</th>
            <th>Name</th>
            <th>Site</th>
            <th>Berths</th>
            <th>Deliveries</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {stations.map((s) => (
            <tr key={s.id}>
              <td>{s.code}</td>
              <td>{s.displayName}</td>
              <td>{s.site.name}</td>
              <td>{s.berthLines.map((b) => b.name).join(", ") || "—"}</td>
              <td>{s._count.deliveries}</td>
              <td>
                <Link href={`/admin/stations/${s.id}`}>Open</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
