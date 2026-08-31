import { Prisma } from "@prisma/client";

export type EdgeSampleForAnomaly = {
  signalQuality?: number | null;
  densityKgM3?: Prisma.Decimal | null;
  massRateKgs?: Prisma.Decimal | null;
};

/**
 * Lightweight deterministic scoring (FuelTrace-style); extend with tank cross-check later.
 * Returns points 0–100 (higher = more suspicious / needs review).
 */
export function scoreEdgeSample(prev: EdgeSampleForAnomaly | null, curr: EdgeSampleForAnomaly): { score: number; factors: Record<string, number> } {
  const factors: Record<string, number> = {};
  let score = 0;

  if (curr.signalQuality != null && curr.signalQuality < 70) {
    factors.signal_quality_low = 20;
    score += 20;
  }
  if (curr.signalQuality != null && curr.signalQuality < 50) {
    factors.signal_quality_critical = 15;
    score += 15;
  }

  if (prev?.densityKgM3 != null && curr.densityKgM3 != null) {
    const delta = curr.densityKgM3.sub(prev.densityKgM3).abs();
    // >5 kg/m³ ≈ >0.005 g/cm³ shift called out in product spec
    if (delta.gt(5)) {
      factors.density_deviation = 25;
      score += 25;
    } else if (delta.gt(2)) {
      factors.density_deviation = 10;
      score += 10;
    }
  }

  if (prev?.massRateKgs != null && curr.massRateKgs != null) {
    const a = prev.massRateKgs.abs();
    const b = curr.massRateKgs.abs();
    if (a.gt(0) && b.gt(0)) {
      const ratio = b.div(a);
      const jump = ratio.gt(1.2) || ratio.lt(0.8);
      if (jump) {
        factors.flow_rate_step = 15;
        score += 15;
      }
    }
  }

  return { score: Math.min(100, score), factors };
}

export function mergeFactorScores(existingJson: string, delta: Record<string, number>): string {
  let cur: Record<string, number> = {};
  try {
    cur = JSON.parse(existingJson || "{}") as Record<string, number>;
  } catch {
    cur = {};
  }
  for (const [k, v] of Object.entries(delta)) {
    cur[k] = Math.max(cur[k] ?? 0, v);
  }
  return JSON.stringify(cur);
}
