import { useEffect, useState } from "react";
import { Navigate, NavLink, Outlet, useLocation } from "react-router-dom";
import { IconDashboard, IconFilm, IconTV, IconScan, IconStar, IconSettings, IconMenu, IconClose, IconLogout } from "../components/Icons";
import { useAuth } from "../state/AuthContext";

const NAV_ITEMS = [
  { to: "/admin", label: "Dashboard", Icon: IconDashboard, end: true },
  { to: "/admin/movies", label: "Movies", Icon: IconFilm },
  { to: "/admin/tv-shows", label: "TV Shows", Icon: IconTV },
  { to: "/admin/scan", label: "Scan Library", Icon: IconScan },
  { to: "/admin/hero-banner", label: "Hero Banner", Icon: IconStar },
  { to: "/admin/settings", label: "Settings", Icon: IconSettings },
];

export default function AdminLayout() {
  const { session, logout } = useAuth();
  const [status, setStatus] = useState<{ online: boolean; address?: string }>({ online: false });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch("/api/settings");
        if (!res.ok) throw new Error();
        const s = await res.json();
        if (!cancelled) setStatus({ online: true, address: `${window.location.hostname}:${s.server_port}` });
      } catch {
        if (!cancelled) setStatus({ online: false });
      }
    };
    check();
    const interval = setInterval(check, 15000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Close the mobile drawer whenever the route changes (nav click, back button, etc).
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Backend already rejects non-admin writes here (403), but without this a
  // regular viewer could still land on the page and watch every mutation fail.
  if (session && session.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg)" }}>
      <div
        className="sticky top-0 z-30 flex items-center gap-3 border-b px-4 py-3 md:hidden"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      >
        <button
          onClick={() => setSidebarOpen(true)}
          aria-label="Open menu"
          className="grid h-8 w-8 place-items-center rounded-lg"
          style={{ color: "var(--text-muted)" }}
        >
          <IconMenu size={20} />
        </button>
        <p className="text-sm font-bold">Rosty Admin</p>
      </div>

      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setSidebarOpen(false)} aria-hidden="true" />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col gap-1 border-r p-4 transition-transform duration-200 md:static md:z-auto md:w-60 ${
          sidebarOpen ? "" : "admin-sidebar-hidden"
        }`}
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      >
        <div className="mb-6 flex items-center justify-between gap-2 px-2">
          <div className="flex items-center gap-2">
            <img src="/rosty-logo.png" alt="Rosty" className="h-6 w-auto" />
            <p className="text-[10px] uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
              Admin
            </p>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            aria-label="Close menu"
            className="grid h-8 w-8 place-items-center rounded-lg md:hidden"
            style={{ color: "var(--text-muted)" }}
          >
            <IconClose size={16} />
          </button>
        </div>

        {NAV_ITEMS.map(({ to, label, Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive ? "" : "hover:bg-white/5"
              }`
            }
            style={({ isActive }) => ({
              background: isActive ? "var(--surface-alt)" : "transparent",
              color: isActive ? "var(--text)" : "var(--text-muted)",
            })}
          >
            <Icon />
            {label}
          </NavLink>
        ))}

        {session && (
          <button
            onClick={logout}
            title={`Log out (${session.email})`}
            className="mt-auto flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors hover:bg-white/5"
            style={{ color: "var(--text-muted)" }}
          >
            <IconLogout />
            Log out
          </button>
        )}

        <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: "var(--surface-alt)" }}>
          <span className="h-2 w-2 rounded-full" style={{ background: status.online ? "var(--success)" : "var(--danger)" }} />
          <div className="text-xs">
            <p style={{ color: "var(--text)" }}>{status.online ? "Server online" : "Server offline"}</p>
            <p style={{ color: "var(--text-dim)" }}>{status.address ?? "Not reachable"}</p>
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <Outlet />
      </main>
    </div>
  );
}
