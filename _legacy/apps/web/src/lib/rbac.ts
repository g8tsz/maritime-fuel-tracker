import type { Membership, Role } from "@prisma/client";

export type Action =
  | "site.read"
  | "site.write"
  | "delivery.read"
  | "delivery.write"
  | "delivery.complete"
  | "invoice.write"
  | "recon.write"
  | "edge.ingest"
  | "admin.fleet.read"
  | "admin.audit.read"
  | "admin.jobs.enqueue";

const adminActions: Action[] = ["admin.fleet.read", "admin.audit.read", "admin.jobs.enqueue"];

const matrix: Record<Role, Action[]> = {
  IT_ADMIN: [...adminActions, "site.read", "delivery.read", "edge.ingest"],
  ORG_ADMIN: [
    "site.read",
    "site.write",
    "delivery.read",
    "delivery.write",
    "delivery.complete",
    "invoice.write",
    "recon.write",
    "edge.ingest",
    ...adminActions,
  ],
  SITE_SUPERVISOR: [
    "site.read",
    "delivery.read",
    "delivery.write",
    "delivery.complete",
    "recon.write",
    "edge.ingest",
  ],
  OPERATOR: ["site.read", "delivery.read", "delivery.write", "delivery.complete", "edge.ingest"],
  FINANCE: ["site.read", "delivery.read", "invoice.write", "recon.write"],
  CUSTOMER_VIEWER: ["site.read", "delivery.read"],
};

export function can(role: Role, action: Action) {
  return matrix[role]?.includes(action) ?? false;
}

export function membershipsForSite(memberships: Membership[], siteId: string) {
  return memberships.filter(
    (m) =>
      m.role === "IT_ADMIN" ||
      m.role === "ORG_ADMIN" ||
      m.siteId === siteId ||
      (m.role === "CUSTOMER_VIEWER" && m.siteId == null),
  );
}

export function highestRoleForSite(memberships: Membership[], siteId: string): Role | null {
  const order: Role[] = [
    "IT_ADMIN",
    "ORG_ADMIN",
    "SITE_SUPERVISOR",
    "FINANCE",
    "OPERATOR",
    "CUSTOMER_VIEWER",
  ];
  const relevant = membershipsForSite(memberships, siteId);
  if (relevant.length === 0) return null;
  let best: Role | null = null;
  for (const r of order) {
    if (relevant.some((m) => m.role === r)) best = r;
  }
  return best;
}

export function canOnSite(memberships: Membership[], siteId: string, action: Action) {
  if (adminActions.includes(action)) {
    return memberships.some((m) => m.role === "IT_ADMIN" || m.role === "ORG_ADMIN");
  }
  const role = highestRoleForSite(memberships, siteId);
  if (!role) return false;
  return can(role, action);
}
