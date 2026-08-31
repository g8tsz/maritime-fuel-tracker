import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth-context";
import {
  completeDeliveryManual,
  generateBdn,
  issueInvoice,
  startDelivery,
  submitReconciliation,
} from "@/app/actions/deliveries";
import { markZeroVerificationAction, saveHoseProfileAction, togglePreflightItem } from "@/app/actions/fueltrace";
import { canOnSite } from "@/lib/rbac";
import { EstimateForm } from "./estimate-form";

export default async function DeliveryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return null;
  const d = await prisma.delivery.findFirst({
    where: { id, site: { organizationId: user.organizationId } },
    include: {
      site: true,
      berthLine: { include: { meter: true } },
      customer: true,
      vessel: true,
      fuelGrade: true,
      contract: true,
      readings: { orderBy: { observedAt: "desc" }, take: 25 },
      preFlightItems: { orderBy: { key: "asc" } },
      bdn: true,
      reconCase: true,
      invoiceLines: { include: { invoice: true } },
    },
  });
  if (!d) notFound();

  const canWrite = canOnSite(user.memberships, d.siteId, "delivery.write");
  const canComplete = canOnSite(user.memberships, d.siteId, "delivery.complete");
  const canInvoice = canOnSite(user.memberships, d.siteId, "invoice.write");
  const canRecon = canOnSite(user.memberships, d.siteId, "recon.write");

  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <p className="muted" style={{ margin: 0 }}>
            <Link href="/deliveries">Deliveries</Link> / {d.id.slice(0, 8)}…
          </p>
          <h1 className="h1" style={{ marginTop: 6 }}>
            {d.customer.name} — {d.fuelGrade.code}
          </h1>
        </div>
        <div className="muted" style={{ fontSize: 13 }}>
          Status: <strong style={{ color: "var(--text)" }}>{d.status}</strong>
        </div>
      </div>

      <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
        <div className="card">
          <h2 className="h2">Pre-bunker estimate</h2>
          {d.contract ? (
            <p className="muted" style={{ marginTop: 0 }}>
              Contract: {d.contract.title} — basis {d.contract.basis}, unit price {d.contract.unitPrice.toString()}{" "}
              {d.contract.currency}, tax {d.contract.taxRate.toString()}.
            </p>
          ) : (
            <p className="muted">Attach a contract to unlock automated cost estimates.</p>
          )}
          {canWrite ? (
            <EstimateForm
              deliveryId={d.id}
              defaultMass={d.estMassKg?.toString() ?? ""}
              defaultVolume={d.estVolumeM3?.toString() ?? ""}
            />
          ) : null}
          {d.estCost ? (
            <p style={{ marginBottom: 0 }}>
              Estimated total (incl. tax): <strong>{d.estCost.toString()}</strong> {d.contract?.currency}
            </p>
          ) : null}
        </div>

        <div className="card">
          <h2 className="h2">Operations</h2>
          <div className="row">
            {canWrite && d.status === "DRAFT" ? (
              <form action={startDelivery.bind(null, d.id)}>
                <button type="submit">Start bunkering</button>
              </form>
            ) : null}
            {canComplete && d.status === "IN_PROGRESS" ? (
              <form action={completeDeliveryManual.bind(null, d.id)} className="row" style={{ alignItems: "end", flexWrap: "wrap", gap: 12 }}>
                <label>
                  Net raw mass (kg)
                  <input name="rawMassKg" placeholder="Required unless gross+hose below" />
                </label>
                <label>
                  Gross metered mass (kg)
                  <input name="grossMeteredMassKg" placeholder="Optional — with hose + density" />
                </label>
                <label>
                  Hose length (m)
                  <input name="hoseLengthM" defaultValue={d.hoseLengthM ?? ""} />
                </label>
                <label>
                  Hose inner Ø (mm)
                  <input name="hoseInnerDiameterMm" defaultValue={d.hoseInnerDiameterMm ?? ""} />
                </label>
                <label>
                  Raw volume (m³)
                  <input name="rawVolumeM3" />
                </label>
                <label>
                  Avg temp (°C)
                  <input name="avgTempC" />
                </label>
                <label>
                  Density (kg/m³)
                  <input name="densityKgM3" />
                </label>
                <label>
                  VCF standard ref
                  <input name="vcfStandard" placeholder="e.g. ISO-91-1" />
                </label>
                <button type="submit">Complete (manual custody)</button>
              </form>
            ) : null}
          </div>
          <p className="muted" style={{ marginTop: 8, marginBottom: 0 }}>
            For <strong>gross + hose correction</strong>, density must be on this form; hose length and inner diameter can come
            from the saved hose profile above if you left those fields blank here.
          </p>
          <p className="muted" style={{ marginBottom: 0 }}>
            Live meter totals can also be updated via the edge gateway while status is <code>IN_PROGRESS</code>. Edge payloads
            may include <code>signalQuality</code>, <code>pressureBar</code>, <code>tankLevelM</code>, and <code>pumpRunning</code> for FuelTrace-style
            cross-checks.
          </p>
        </div>

        {d.status === "IN_PROGRESS" ? (
          <div className="card">
            <h2 className="h2">FuelTrace — pre-bunker checklist</h2>
            <p className="muted" style={{ marginTop: 0 }}>
              All <strong>required</strong> items must be completed before custody close. Use <em>Record zero check</em> to stamp
              zero-flow verification (also ticks the zero item).
            </p>
            <table style={{ marginTop: 12 }}>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Required</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {d.preFlightItems.map((it) => (
                  <tr key={it.id}>
                    <td>{it.label}</td>
                    <td>{it.required ? "yes" : "no"}</td>
                    <td>{it.completedAt ? it.completedAt.toISOString() : "open"}</td>
                    <td>
                      {canWrite ? (
                        <span className="row" style={{ gap: 8 }}>
                          <form action={togglePreflightItem} style={{ display: "inline" }}>
                            <input type="hidden" name="deliveryId" value={d.id} />
                            <input type="hidden" name="key" value={it.key} />
                            <input type="hidden" name="setDone" value="true" />
                            <button type="submit">Mark done</button>
                          </form>
                          <form action={togglePreflightItem} style={{ display: "inline" }}>
                            <input type="hidden" name="deliveryId" value={d.id} />
                            <input type="hidden" name="key" value={it.key} />
                            <input type="hidden" name="setDone" value="false" />
                            <button type="submit">Clear</button>
                          </form>
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {canWrite ? (
              <div style={{ marginTop: 16 }}>
                <h3 className="h2" style={{ fontSize: 16 }}>
                  Record zero check
                </h3>
                <form action={markZeroVerificationAction} className="row" style={{ alignItems: "end", gap: 12 }}>
                  <input type="hidden" name="deliveryId" value={d.id} />
                  <label>
                    Zero drift (kg/h, optional)
                    <input name="zeroDriftKgPerHr" placeholder="e.g. 0.003" />
                  </label>
                  <button type="submit">Stamp zero verification</button>
                </form>
              </div>
            ) : null}
            {canWrite ? (
              <div style={{ marginTop: 20 }}>
                <h3 className="h2" style={{ fontSize: 16 }}>
                  Hose profile (saved separately)
                </h3>
                <form action={saveHoseProfileAction} className="row" style={{ alignItems: "end", gap: 12 }}>
                  <input type="hidden" name="deliveryId" value={d.id} />
                  <label>
                    Hose length (m)
                    <input name="hoseLengthM" defaultValue={d.hoseLengthM ?? ""} />
                  </label>
                  <label>
                    Hose inner Ø (mm)
                    <input name="hoseInnerDiameterMm" defaultValue={d.hoseInnerDiameterMm ?? ""} />
                  </label>
                  <button type="submit">Save hose profile</button>
                </form>
              </div>
            ) : null}
          </div>
        ) : null}

        {d.status !== "DRAFT" ? (
          <div className="card">
            <h2 className="h2">FuelTrace — integrity snapshot</h2>
            <table>
              <tbody>
                <tr>
                  <td className="muted">Anomaly score (0–100)</td>
                  <td>{d.anomalyScore ?? "—"}</td>
                </tr>
                <tr>
                  <td className="muted">Anomaly factors (max severity)</td>
                  <td style={{ fontFamily: "monospace", fontSize: 12 }}>{d.anomalyFactorsJson || "{}"}</td>
                </tr>
                <tr>
                  <td className="muted">Gross metered mass (kg)</td>
                  <td>{d.grossMeteredMassKg?.toString() ?? "—"}</td>
                </tr>
                <tr>
                  <td className="muted">Line contents (kg)</td>
                  <td>{d.lineContentsMassKg?.toString() ?? "—"}</td>
                </tr>
                <tr>
                  <td className="muted">Zero verification (UTC)</td>
                  <td>{d.zeroVerificationPassedAt?.toISOString() ?? "—"}</td>
                </tr>
                <tr>
                  <td className="muted">Recorded zero drift (kg/h)</td>
                  <td>{d.zeroDriftKgPerHr?.toString() ?? "—"}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : null}

        <div className="card">
          <h2 className="h2">Custody snapshot</h2>
          <table>
            <tbody>
              <tr>
                <td className="muted">Meter start mass (kg)</td>
                <td>{d.meterStartMassKg?.toString() ?? "—"}</td>
              </tr>
              <tr>
                <td className="muted">Last cumulative mass (kg)</td>
                <td>{d.edgeLastCumulativeMassKg?.toString() ?? "—"}</td>
              </tr>
              <tr>
                <td className="muted">Gross metered mass (kg)</td>
                <td>{d.grossMeteredMassKg?.toString() ?? "—"}</td>
              </tr>
              <tr>
                <td className="muted">Line contents (kg)</td>
                <td>{d.lineContentsMassKg?.toString() ?? "—"}</td>
              </tr>
              <tr>
                <td className="muted">Net raw mass (kg)</td>
                <td>{d.rawMassKg?.toString() ?? "—"}</td>
              </tr>
              <tr>
                <td className="muted">Commercial mass</td>
                <td>{d.commercialMassKg?.toString() ?? "—"}</td>
              </tr>
              <tr>
                <td className="muted">Meter start volume (m³)</td>
                <td>{d.meterStartVolumeM3?.toString() ?? "—"}</td>
              </tr>
              <tr>
                <td className="muted">Last cumulative volume (m³)</td>
                <td>{d.edgeLastCumulativeVolumeM3?.toString() ?? "—"}</td>
              </tr>
              <tr>
                <td className="muted">Net raw volume (m³)</td>
                <td>{d.rawVolumeM3?.toString() ?? "—"}</td>
              </tr>
              <tr>
                <td className="muted">Commercial volume</td>
                <td>{d.commercialVolumeM3?.toString() ?? "—"}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="card">
          <h2 className="h2">BDN & billing</h2>
          <div className="row">
            {canWrite && d.status === "COMPLETED" ? (
              <form action={generateBdn.bind(null, d.id)}>
                <button type="submit">{d.bdn ? "Regenerate BDN PDF" : "Generate BDN PDF"}</button>
              </form>
            ) : null}
            {d.bdn ? (
              <Link href={`/api/deliveries/${d.id}/bdn`} target="_blank">
                Download BDN ({d.bdn.number})
              </Link>
            ) : null}
            {canInvoice && d.status === "COMPLETED" && !d.invoiceLines[0] ? (
              <form action={issueInvoice.bind(null, d.id)}>
                <button type="submit">Issue invoice</button>
              </form>
            ) : null}
            {d.invoiceLines[0] ? (
              <p className="muted" style={{ margin: 0 }}>
                Invoicing locked — this delivery already has invoice {d.invoiceLines[0].invoice.number}.
              </p>
            ) : null}
          </div>
          {d.invoiceLines[0] ? (
            <p className="muted" style={{ marginBottom: 0 }}>
              Linked invoice: {d.invoiceLines[0].invoice.number} ({d.invoiceLines[0].invoice.status})
            </p>
          ) : null}
        </div>

        <div className="card">
          <h2 className="h2">Reconciliation</h2>
          {d.reconCase ? (
            <p>
              Ship reported mass: {d.reconCase.shipReportedMassKg?.toString()} kg — variance{" "}
              {d.reconCase.varianceKg?.toString()} kg — <strong>{d.reconCase.status}</strong>
            </p>
          ) : (
            <p className="muted">No ship receipt captured yet.</p>
          )}
          {canRecon && d.status === "COMPLETED" ? (
            <form action={submitReconciliation.bind(null, d.id)} className="row" style={{ alignItems: "end" }}>
              <label>
                Ship reported mass (kg)
                <input name="shipReportedMassKg" required />
              </label>
              <label>
                Notes
                <input name="notes" />
              </label>
              <button type="submit">Submit reconciliation</button>
            </form>
          ) : null}
        </div>

        <div className="card">
          <h2 className="h2">Recent readings</h2>
          <table>
            <thead>
              <tr>
                <th>Time (UTC)</th>
                <th>Mass kg</th>
                <th>Volume m³</th>
                <th>Temp °C</th>
                <th>Sig.Q</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {d.readings.map((r) => (
                <tr key={r.id}>
                  <td>{r.observedAt.toISOString()}</td>
                  <td>{r.massKg?.toString() ?? "—"}</td>
                  <td>{r.volumeM3?.toString() ?? "—"}</td>
                  <td>{r.tempC?.toString() ?? "—"}</td>
                  <td>{r.signalQuality ?? "—"}</td>
                  <td>{r.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
