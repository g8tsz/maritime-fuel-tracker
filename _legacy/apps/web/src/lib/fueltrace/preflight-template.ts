export type PreflightTemplateItem = { key: string; label: string; required: boolean };

/** Default FuelTrace-style pre-bunker items; created when bunkering starts. */
export const FUELTRACE_PREFLIGHT_ITEMS: PreflightTemplateItem[] = [
  { key: "hub_sensors_ok", label: "Hub connected; sensors acceptable / signal quality OK", required: true },
  { key: "pump_power_ok", label: "Pump power confirmed on", required: true },
  { key: "valves_ok", label: "Valves in correct position for delivery", required: true },
  { key: "hose_photo", label: "Photo evidence: hose connection at manifold (attach note if offline)", required: true },
  { key: "hub_zero_photo", label: "Photo evidence: Hub display / zero reading captured", required: true },
  { key: "tamper_seals_ok", label: "Tamper seals visually inspected — intact", required: false },
  { key: "zero_flow_verified", label: "Zero-flow verification completed (see Zero check below)", required: true },
];
