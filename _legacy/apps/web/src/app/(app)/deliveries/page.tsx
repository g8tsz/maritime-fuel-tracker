import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth-context";

export default async function DeliveriesPage() {
  const user = await getSessionUser();
  if (!user) return null;
  const rows = await prisma.delivery.findMany({
    where: { site: { organizationId: user.organizationId } },
    orderBy: { createdAt: "desc" },
    include: { site: true, customer: true, vessel: true, fuelGrade: true, contract: true },
    take: 50,
  });
  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
        <h1 className="h1" style={{ margin: 0 }}>
          Deliveries
        </h1>
        <Link href="/deliveries/new" style={{ fontWeight: 600 }}>
          New delivery →
        </Link>
      </div>
      <table className="card" style={{ padding: 0, overflow: "hidden" }}>
        <thead>
          <tr>
            <th>Status</th>
            <th>Site</th>
            <th>Customer</th>
            <th>Vessel</th>
            <th>Grade</th>
            <th>Contract</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((d) => (
            <tr key={d.id}>
              <td>{d.status}</td>
              <td>{d.site.name}</td>
              <td>{d.customer.name}</td>
              <td>{d.vessel?.name ?? "—"}</td>
              <td>{d.fuelGrade.code}</td>
              <td>{d.contract?.title ?? "—"}</td>
              <td>
                <Link href={`/deliveries/${d.id}`}>Open</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
