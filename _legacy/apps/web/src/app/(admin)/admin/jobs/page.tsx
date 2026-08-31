import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth-context";
import { enqueueRollingRestartStub } from "@/app/actions/admin-jobs";

export default async function AdminJobsPage() {
  const user = await getSessionUser();
  if (!user) return null;
  const jobs = await prisma.jobQueue.findMany({
    where: { organizationId: user.organizationId },
    orderBy: { createdAt: "desc" },
    take: 80,
    include: { station: { include: { site: true } } },
  });
  const stations = await prisma.station.findMany({
    where: { site: { organizationId: user.organizationId } },
    orderBy: { sortOrder: "asc" },
  });
  return (
    <div>
      <h1 className="h1">Job queue</h1>
      <p className="muted">
        Jobs are processed by the internal worker (<code>POST /api/internal/jobs/drain</code> with{" "}
        <code>INTERNAL_JOB_SECRET</code>). Use rolling restart to sequence edge agents one station at a time.
      </p>
      <div className="card" style={{ marginTop: 16 }}>
        <h2 className="h2">Enqueue rolling restart (stub)</h2>
        <p className="muted">Placeholder job — wire to edge supervisor / systemd in production.</p>
        <div className="row" style={{ flexWrap: "wrap" }}>
          {stations.map((s) => (
            <form key={s.id} action={enqueueRollingRestartStub.bind(null, s.id)}>
              <button type="submit" className="secondary">
                Queue restart — {s.code}
              </button>
            </form>
          ))}
        </div>
      </div>
      <h2 className="h2" style={{ marginTop: 24 }}>
        Recent jobs
      </h2>
      <table className="card" style={{ padding: 0 }}>
        <thead>
          <tr>
            <th>Created</th>
            <th>Type</th>
            <th>Station</th>
            <th>Status</th>
            <th>Error</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((j) => (
            <tr key={j.id}>
              <td>{j.createdAt.toISOString()}</td>
              <td>{j.type}</td>
              <td>{j.station ? `${j.station.site.name} / ${j.station.code}` : "—"}</td>
              <td>{j.status}</td>
              <td>{j.lastError ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
