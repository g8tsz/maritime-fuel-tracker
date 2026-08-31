import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth-context";
import { canAccessAdminPortal } from "@/lib/admin-auth";
import { LogoutButton } from "../../login/logout-button";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user || !canAccessAdminPortal(user)) {
    redirect("/dashboard");
  }
  return (
    <div>
      <header style={{ borderBottom: "1px solid var(--border)", background: "#0f1a30" }}>
        <div
          className="row"
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            padding: "14px 20px",
            justifyContent: "space-between",
          }}
        >
          <nav className="row" style={{ gap: 16 }}>
            <Link href="/admin" style={{ fontWeight: 800 }}>
              MBP Admin
            </Link>
            <Link href="/admin">Fleet</Link>
            <Link href="/admin/stations">Stations</Link>
            <Link href="/admin/hubs">Hubs</Link>
            <Link href="/admin/jobs">Jobs</Link>
            <Link href="/admin/errors">Errors</Link>
            <Link href="/admin/audit">Audit</Link>
            <Link href="/dashboard">Operator UI →</Link>
          </nav>
          <div className="row" style={{ gap: 12 }}>
            <span className="muted" style={{ fontSize: 13 }}>
              {user.displayName ?? user.email}
            </span>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "20px" }}>{children}</main>
    </div>
  );
}
