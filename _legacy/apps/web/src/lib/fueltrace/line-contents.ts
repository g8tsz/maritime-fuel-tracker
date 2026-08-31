import { Prisma } from "@prisma/client";

/** Hose internal volume (m³) from length (m) and inner diameter (mm). */
export function hoseVolumeM3(lengthM: number, innerDiameterMm: number): Prisma.Decimal {
  const rM = new Prisma.Decimal(innerDiameterMm).div(1000).div(2);
  const pi = new Prisma.Decimal(Math.PI);
  return pi.mul(rM).mul(rM).mul(new Prisma.Decimal(lengthM));
}

/** Mass in hose (kg) = volume × density (kg/m³). */
export function computeLineContentsMassKg(
  lengthM: number,
  innerDiameterMm: number,
  densityKgM3: Prisma.Decimal,
): Prisma.Decimal {
  return hoseVolumeM3(lengthM, innerDiameterMm).mul(densityKgM3);
}
