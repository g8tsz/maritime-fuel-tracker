import type { AuthedUser } from "./auth-context";

export function canAccessAdminPortal(user: AuthedUser): boolean {
  return user.memberships.some((m) => m.role === "IT_ADMIN" || m.role === "ORG_ADMIN");
}
