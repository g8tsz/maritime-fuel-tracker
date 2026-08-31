import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth-context";
import { enqueueRollupJobs } from "@/app/actions/admin-jobs";

export default async function AdminStationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return null;
  const station = await prisma.station.findFirst({
    where: { id, site: { organizationId: user.organizationId } },
    include: {
      site: true,
      berthLines: true,
      rollups: { orderBy: { periodStart: "desc" }, take: 48 },
    },
  });
  if (!station) notFound();
  const errors = await prisma.applicationErrorLog.findMany({
    where: { stationId: station.id },
    orderBy: { createdAt: "desc" },
    take: 40,
  });
  return (
    <div>
      <p className="muted" style={{ margin: 0 }}>
        <Link href="/admin">Fleet</Link> / {station.displayName}
      </p>
      <h1 className="h1">{station.displayName}</h1>
      <p className="muted">
        {station.site.name} — {station.code}
      </p>
      <form action={enqueueRollupJobs.bind(null, station.id)} style={{ marginTop: 12 }}>
        <button type="submit">Enqueue hour + day rollup jobs (UTC now)</button>
      </form>
      <h2 className="h2" style={{ marginTop: 24 }}>
        Recent rollups
      </h2>
      <table className="card" style={{ padding: 0 }}>
        <thead>
          <tr>
            <th>Period</th>
            <th>Bucket</th>
            <th>Deliveries</th>
            <th>Σ mass</th>
            <th>Errors</th>
          </tr>
        </thead>
        <tbody>
          {station.rollups.map((r) => (
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
      <h2 className="h2" style={{ marginTop: 24 }}>
        Recent errors
      </h2>
      <table className="card" style={{ padding: 0 }}>
        <thead>
          <tr>
            <th>Time</th>
            <th>Code</th>
            <th>Message</th>
            <th>Correlation</th>
          </tr>
        </thead>
        <tbody>
          {errors.map((e) => (
            <tr key={e.id}>
              <td>{e.createdAt.toISOString()}</td>
              <td>{e.code}</td>
              <td>{e.message}</td>
              <td className="muted">{e.correlationId ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
