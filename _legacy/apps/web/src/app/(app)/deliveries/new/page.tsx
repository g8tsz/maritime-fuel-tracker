import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth-context";
import { createDelivery } from "@/app/actions/deliveries";

export default async function NewDeliveryPage() {
  const user = await getSessionUser();
  if (!user) return null;
  const orgId = user.organizationId;
  const [sites, customers, vessels, grades, contracts] = await Promise.all([
    prisma.site.findMany({
      where: { organizationId: orgId },
      include: { berthLines: true },
      orderBy: { name: "asc" },
    }),
    prisma.customer.findMany({ where: { organizationId: orgId }, orderBy: { name: "asc" } }),
    prisma.vessel.findMany({ where: { organizationId: orgId }, orderBy: { name: "asc" } }),
    prisma.fuelGrade.findMany({ orderBy: { code: "asc" } }),
    prisma.contract.findMany({ where: { organizationId: orgId }, include: { customer: true } }),
  ]);
  return (
    <div>
      <h1 className="h1">New delivery nomination</h1>
      <p className="muted">Creates a draft delivery. Estimates, custody completion, BDN, and invoicing happen on the delivery record.</p>
      <form action={createDelivery} className="card" style={{ marginTop: 16, display: "grid", gap: 12, maxWidth: 640 }}>
        <label>
          Site
          <select name="siteId" required defaultValue={sites[0]?.id}>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Berth line
          <select name="berthLineId" required>
            {sites.flatMap((s) =>
              s.berthLines.map((b) => (
                <option key={b.id} value={b.id}>
                  {s.name} — {b.name}
                </option>
              )),
            )}
          </select>
        </label>
        <label>
          Customer
          <select name="customerId" required>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Vessel (optional)
          <select name="vesselId">
            <option value="">—</option>
            {vessels.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Fuel grade
          <select name="fuelGradeId" required>
            {grades.map((g) => (
              <option key={g.id} value={g.id}>
                {g.code} — {g.description}
              </option>
            ))}
          </select>
        </label>
        <label>
          Contract (recommended for billing)
          <select name="contractId">
            <option value="">—</option>
            {contracts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title} ({c.customer.name})
              </option>
            ))}
          </select>
        </label>
        <button type="submit">Create draft delivery</button>
      </form>
    </div>
  );
}
