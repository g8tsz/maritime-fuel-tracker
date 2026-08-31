import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth-context";
import { canAccessAdminPortal } from "@/lib/admin-auth";
import { LogoutButton } from "../login/logout-button";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }
  return (
    <div>
      <header
        style={{
          borderBottom: "1px solid var(--border)",
          background: "#0e1628",
        }}
      >
        <div
          className="row"
          style={{
            maxWidth: 1100,
            margin: "0 auto",
            padding: "14px 20px",
            justifyContent: "space-between",
          }}
        >
          <nav className="row" style={{ gap: 16 }}>
            <Link href="/dashboard" style={{ fontWeight: 700 }}>
              MBP
            </Link>
            <Link href="/dashboard">Dashboard</Link>
            <Link href="/sites">Sites</Link>
            <Link href="/deliveries">Deliveries</Link>
            <Link href="/invoices">Invoices</Link>
            {canAccessAdminPortal(user) ? (
              <Link href="/admin" style={{ fontWeight: 600 }}>
                Admin
              </Link>
            ) : null}
          </nav>
          <div className="row" style={{ gap: 12 }}>
            <span className="muted" style={{ fontSize: 13 }}>
              {user.displayName ?? user.email}
            </span>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
