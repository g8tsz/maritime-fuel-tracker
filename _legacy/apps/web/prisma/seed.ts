import { HubSensorKind, PrismaClient, MeteringMode, PricingBasis, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "crypto";
import { parseMeterIntegrationJson } from "../src/lib/schemas/meter-integration";

const prisma = new PrismaClient();

function hashApiKey(key: string) {
  return createHash("sha256").update(key, "utf8").digest("hex");
}

async function main() {
  await prisma.applicationErrorLog.deleteMany();
  await prisma.jobQueue.deleteMany();
  await prisma.stationMetricRollup.deleteMany();
  await prisma.auditEvent.deleteMany();
  await prisma.invoiceLine.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.reconciliationCase.deleteMany();
  await prisma.measurementReading.deleteMany();
  await prisma.edgeIdempotencyRecord.deleteMany();
  await prisma.bunkerDeliveryNote.deleteMany();
  await prisma.deliveryPreFlightItem.deleteMany();
  await prisma.delivery.deleteMany();
  await prisma.calibrationRecord.deleteMany();
  await prisma.hubSensor.deleteMany();
  await prisma.fuelHub.deleteMany();
  await prisma.edgeDevice.deleteMany();
  await prisma.meterProfile.deleteMany();
  await prisma.berthLine.deleteMany();
  await prisma.station.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.user.deleteMany();
  await prisma.contract.deleteMany();
  await prisma.vessel.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.site.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.fuelGrade.deleteMany();

  const org = await prisma.organization.create({ data: { name: "Demo Bunker Co" } });
  const site = await prisma.site.create({
    data: { organizationId: org.id, name: "Pier 7 — High-flow berth", timezone: "America/New_York" },
  });
  const station = await prisma.station.create({
    data: {
      siteId: site.id,
      code: "STATION-1",
      displayName: "Station 1 — Line A manifold",
      sortOrder: 1,
    },
  });
  const berth = await prisma.berthLine.create({
    data: { siteId: site.id, stationId: station.id, name: "Line A", maxRateM3h: 3500 },
  });
  const integrationJson = JSON.stringify({
    protocol: "modbus_tcp",
    host: "127.0.0.1",
    port: 502,
    holdingRegisters: { massKg: 40001, massRate: 40003 },
    notes: "Replace with vendor map; Coriolis mass preferred for custody.",
  });
  parseMeterIntegrationJson(integrationJson);
  const meterProfile = await prisma.meterProfile.create({
    data: {
      berthLineId: berth.id,
      mode: MeteringMode.CLAMP_ON_ULTRASONIC,
      integrationJson,
    },
  });
  await prisma.calibrationRecord.create({
    data: {
      meterProfileId: meterProfile.id,
      kFactor: "1.0000",
      referenceNote: "Seed baseline K-factor (replace after in-situ calibration).",
    },
  });

  const adminHash = await bcrypt.hash("admin123", 10);
  const itHash = await bcrypt.hash("itadmin123", 10);
  const operatorHash = await bcrypt.hash("operator123", 10);
  const financeHash = await bcrypt.hash("finance123", 10);

  const admin = await prisma.user.create({
    data: {
      organizationId: org.id,
      email: "admin@demo.local",
      passwordHash: adminHash,
      displayName: "Org Admin",
    },
  });
  const itAdmin = await prisma.user.create({
    data: {
      organizationId: org.id,
      email: "itadmin@demo.local",
      passwordHash: itHash,
      displayName: "IT / Control plane",
    },
  });
  const operator = await prisma.user.create({
    data: {
      organizationId: org.id,
      email: "operator@demo.local",
      passwordHash: operatorHash,
      displayName: "Berth Operator",
    },
  });
  const finance = await prisma.user.create({
    data: {
      organizationId: org.id,
      email: "finance@demo.local",
      passwordHash: financeHash,
      displayName: "Finance",
    },
  });

  await prisma.membership.createMany({
    data: [
      { userId: admin.id, siteId: null, role: Role.ORG_ADMIN },
      { userId: itAdmin.id, siteId: null, role: Role.IT_ADMIN },
      { userId: operator.id, siteId: site.id, role: Role.OPERATOR },
      { userId: finance.id, siteId: site.id, role: Role.FINANCE },
    ],
  });

  await prisma.fuelGrade.create({
    data: { code: "VLSFO", description: "Very Low Sulphur Fuel Oil", sulfurPct: 0.5 },
  });
  await prisma.fuelGrade.create({
    data: { code: "MGO", description: "Marine Gas Oil", sulfurPct: 0.1 },
  });

  const customer = await prisma.customer.create({
    data: { organizationId: org.id, name: "Oceanic Lines Ltd", billingEmail: "bunkers@oceanic.example" },
  });
  await prisma.vessel.create({
    data: { organizationId: org.id, name: "MV Demo Trader", imoNumber: "9876543", flag: "Panama" },
  });

  await prisma.contract.create({
    data: {
      organizationId: org.id,
      customerId: customer.id,
      title: "2026 VLSFO frame",
      currency: "USD",
      basis: PricingBasis.PER_MT,
      unitPrice: "750.00",
      taxRate: "0.07",
      roundingKg: 1000,
      roundingM3: 3,
      reconVarianceKg: "500",
    },
  });

  const apiKey = `mbp_edge_${randomBytes(24).toString("base64url")}`;
  const edge = await prisma.edgeDevice.create({
    data: {
      siteId: site.id,
      name: "Pier-7-edge-01",
      apiKeyHash: hashApiKey(apiKey),
    },
  });
  await prisma.fuelHub.create({
    data: {
      siteId: site.id,
      stationId: station.id,
      berthLineId: berth.id,
      code: "PUMP-07",
      displayName: "FuelTrace-class hub — Pier 7 Line A",
      firmwareVersion: "4.2.1-demo",
      edgeDeviceId: edge.id,
      sensors: {
        create: [
          { kind: HubSensorKind.FLOW_CLAMP_ON_ULTRASONIC, label: "Clamp-on ultrasonic pair", channelIndex: 0 },
          { kind: HubSensorKind.TEMP_PIPE_CLAMP, label: "Pipe temperature", channelIndex: 1 },
          { kind: HubSensorKind.VIBRATION_PIPE, label: "Pump / cavitation accelerometer", channelIndex: 2 },
          { kind: HubSensorKind.TANK_LEVEL_ULTRASONIC, label: "Tank cross-check (roof mount)", channelIndex: 3 },
        ],
      },
    },
  });

  // eslint-disable-next-line no-console
  console.log("\n=== Demo users (passwords) ===");
  // eslint-disable-next-line no-console
  console.log("admin@demo.local / admin123");
  // eslint-disable-next-line no-console
  console.log("itadmin@demo.local / itadmin123  (control plane /admin)");
  // eslint-disable-next-line no-console
  console.log("operator@demo.local / operator123");
  // eslint-disable-next-line no-console
  console.log("finance@demo.local / finance123");
  // eslint-disable-next-line no-console
  console.log("\n=== Edge device API key (store in vault) ===");
  // eslint-disable-next-line no-console
  console.log(apiKey);
  // eslint-disable-next-line no-console
  console.log("\nPoint apps/edge-gateway at CLOUD_BASE_URL (this web app) and EDGE_API_KEY.");
  // eslint-disable-next-line no-console
  console.log("Edge v2 URL: /api/edge/v2/readings\n");
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
