import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth-context";

export default async function InvoicesPage() {
  const user = await getSessionUser();
  if (!user) return null;
  const rows = await prisma.invoice.findMany({
    where: { customer: { organizationId: user.organizationId } },
    orderBy: { createdAt: "desc" },
    include: { customer: true, lines: { include: { delivery: true } } },
    take: 50,
  });
  return (
    <div>
      <h1 className="h1">Invoices</h1>
      <table className="card" style={{ padding: 0, overflow: "hidden" }}>
        <thead>
          <tr>
            <th>Number</th>
            <th>Customer</th>
            <th>Status</th>
            <th>Total</th>
            <th>Issued</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((inv) => (
            <tr key={inv.id}>
              <td>{inv.number}</td>
              <td>{inv.customer.name}</td>
              <td>{inv.status}</td>
              <td>
                {inv.total.toString()} {inv.currency}
              </td>
              <td>{inv.issuedAt?.toISOString() ?? "—"}</td>
              <td>
                {inv.lines[0]?.deliveryId ? (
                  <Link href={`/deliveries/${inv.lines[0].deliveryId}`}>Delivery</Link>
                ) : (
                  "—"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
