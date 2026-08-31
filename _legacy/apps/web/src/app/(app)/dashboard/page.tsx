import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth-context";

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) return null;
  const orgId = user.organizationId;
  const [deliveries, sites, invoices] = await Promise.all([
    prisma.delivery.count({
      where: { site: { organizationId: orgId } },
    }),
    prisma.site.count({ where: { organizationId: orgId } }),
    prisma.invoice.count({ where: { customer: { organizationId: orgId } } }),
  ]);
  return (
    <div>
      <h1 className="h1">Operations overview</h1>
      <p className="muted">Multi-site bunker station control with custody-aware deliveries.</p>
      <div className="row" style={{ marginTop: 16 }}>
        <div className="card" style={{ minWidth: 200 }}>
          <div className="muted">Sites</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{sites}</div>
        </div>
        <div className="card" style={{ minWidth: 200 }}>
          <div className="muted">Deliveries</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{deliveries}</div>
        </div>
        <div className="card" style={{ minWidth: 200 }}>
          <div className="muted">Invoices</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{invoices}</div>
        </div>
      </div>
      <div style={{ marginTop: 20 }} className="card">
        <h2 className="h2">Quick links</h2>
        <ul>
          <li>
            <Link href="/deliveries/new">Create delivery nomination</Link>
          </li>
          <li>
            <Link href="/sites">Review berth lines and metering profiles</Link>
          </li>
        </ul>
      </div>
    </div>
  );
}
