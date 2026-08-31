import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { Customer, Delivery, FuelGrade, Site, Vessel } from "@prisma/client";
import { Prisma } from "@prisma/client";

type BdnInput = {
  bdnNumber: string;
  delivery: Delivery & { fuelGrade: FuelGrade };
  site: Site;
  customer: Customer;
  vessel: Vessel | null;
  commercialMassKg: Prisma.Decimal | null;
  commercialVolumeM3: Prisma.Decimal | null;
};

export async function buildBunkerDeliveryNotePdf(input: BdnInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let y = 750;

  const line = (text: string, size = 11, useBold = false) => {
    page.drawText(text, { x: 48, y, size, font: useBold ? bold : font, color: rgb(0.1, 0.1, 0.12) });
    y -= size + 6;
  };

  line("Bunker Delivery Note (BDN)", 16, true);
  line(`Document: ${input.bdnNumber}`);
  line(`Generated (UTC): ${new Date().toISOString()}`);
  y -= 6;
  line(`Site: ${input.site.name} (${input.site.timezone})`, 12, true);
  line(`Customer: ${input.customer.name}`);
  line(`Vessel: ${input.vessel?.name ?? "—"}${input.vessel?.imoNumber ? ` — IMO ${input.vessel.imoNumber}` : ""}`);
  line(`Fuel grade: ${input.delivery.fuelGrade.code} — ${input.delivery.fuelGrade.description}`);
  y -= 6;
  line("Meter trace (totalizer / manual stamps)", 12, true);
  line(`Meter start mass (kg): ${input.delivery.meterStartMassKg?.toString() ?? "—"}`);
  line(`Last cumulative mass (kg): ${input.delivery.edgeLastCumulativeMassKg?.toString() ?? "—"}`);
  line(`Meter stop mass (kg): ${input.delivery.meterStopMassKg?.toString() ?? "—"}`);
  line(`Meter start volume (m³): ${input.delivery.meterStartVolumeM3?.toString() ?? "—"}`);
  line(`Last cumulative volume (m³): ${input.delivery.edgeLastCumulativeVolumeM3?.toString() ?? "—"}`);
  line(`Meter stop volume (m³): ${input.delivery.meterStopVolumeM3?.toString() ?? "—"}`);
  y -= 6;
  if (input.delivery.grossMeteredMassKg != null || input.delivery.lineContentsMassKg != null) {
    line("FuelTrace / line contents (mass)", 12, true);
    line(`Gross metered mass (kg): ${input.delivery.grossMeteredMassKg?.toString() ?? "—"}`);
    line(`Less line contents (kg): ${input.delivery.lineContentsMassKg?.toString() ?? "—"}`);
    line(`Net delivered mass (kg): ${input.delivery.rawMassKg?.toString() ?? "—"}`);
    y -= 6;
  }
  line("Custody quantities (commercial rounding applied)", 12, true);
  line(
    `Mass: ${input.commercialMassKg?.toString() ?? "—"} kg`,
    11,
  );
  line(`Volume: ${input.commercialVolumeM3?.toString() ?? "—"} m³`);
  line(`Delivery ID: ${input.delivery.id}`);
  line(`Started: ${input.delivery.startedAt?.toISOString() ?? "—"}`);
  line(`Ended: ${input.delivery.endedAt?.toISOString() ?? "—"}`);
  y -= 12;
  line("Signatures", 12, true);
  line("Supplier representative: ________________________________");
  line("Vessel / receiver representative: ________________________________");

  return pdf.save();
}
