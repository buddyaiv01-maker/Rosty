import { useEffect, useRef, useState } from "react";
import { Link, Navigate, Outlet, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { IconChevronDown, IconLogout, IconSearch, IconSettings } from "../components/Icons";
import { ProfileAvatarIcon } from "../components/ProfileAvatars";
import { useAuth } from "../state/AuthContext";
import { useProfiles } from "../state/ProfileContext";
import { LIQUID_GLASS_VARS } from "../theme/liquidGlass";

const NAV_LINKS: { label: string; to: string }[] = [
  { label: "Home", to: "/" },
  { label: "Movies", to: "/movies" },
  { label: "TV Shows", to: "/tv-shows" },
  { label: "Watchlist", to: "/watchlist" },
];

function PillNav() {
  const location = useLocation();

  const activeTo = NAV_LINKS.find((l) => (l.to === "/" ? location.pathname === "/" : location.pathname.startsWith(l.to)))?.to;
  const searchActive = location.pathname === "/search";

  return (
    <div
      className="no-scrollbar flex max-w-full items-center gap-1 overflow-x-auto rounded-full px-2 py-2"
      style={{
        background: "var(--r-surface)",
        backdropFilter: "blur(var(--r-blur))",
        border: "1px solid var(--r-border)",
        boxShadow: "var(--r-shadow)",
      }}
    >
      {/* Same navigate-away pattern as Home/Movies/TV Shows/Watchlist — the
          Search page itself owns the actual search box and does the work. */}
      <Link to="/search">
        <motion.span
          whileTap={{ scale: 0.88 }}
          aria-label="Search"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full"
          style={{ color: searchActive ? "var(--r-bg)" : "var(--r-text-muted)", background: searchActive ? "var(--r-text)" : "transparent" }}
        >
          <IconSearch size={16} />
        </motion.span>
      </Link>

      {NAV_LINKS.map((l) => {
        const isActive = activeTo === l.to;
        return (
          <Link key={l.to} to={l.to}>
            <motion.span
              whileTap={{ scale: 0.93 }}
              className="relative block whitespace-nowrap px-2.5 py-2 text-sm font-medium sm:px-4"
              style={{ color: isActive ? "var(--r-bg)" : "var(--r-text-muted)", fontWeight: isActive ? 600 : 500 }}
            >
              {isActive && (
                <motion.span
                  layoutId="pill-active-bg"
                  className="absolute inset-0 rounded-full"
                  style={{ background: "var(--r-text)" }}
                  transition={{ type: "spring", stiffness: 500, damping: 32 }}
                />
              )}
              <span className="relative z-10">{l.label}</span>
            </motion.span>
          </Link>
        );
      })}
    </div>
  );
}

function MenuItem({ icon, label, onClick, to }: { icon: React.ReactNode; label: string; onClick?: () => void; to?: string }) {
  const className = "flex w-full items-center gap-2.5 whitespace-nowrap px-3 py-2.5 text-left text-sm font-medium";
  const style = { color: "var(--r-text)" };
  if (to) {
    return (
      <Link to={to} onClick={onClick} className={className} style={style}>
        {icon}
        {label}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={className} style={style}>
      {icon}
      {label}
    </button>
  );
}

function AccountMenu({
  session,
  logout,
  activeProfile,
  profiles,
  switchProfile,
}: {
  session: ReturnType<typeof useAuth>["session"];
  logout: () => void;
  activeProfile: ReturnType<typeof useProfiles>["activeProfile"];
  profiles: ReturnType<typeof useProfiles>["profiles"];
  switchProfile: () => void;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  // Computed locally (not passed as a prop) so TS can narrow `activeProfile`
  // from `showProfileControls` below — narrowing an aliased condition only
  // works within the same scope, not across independently-typed props.
  const showProfileControls = !!activeProfile;

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onClickOutside);
    return () => window.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  if (!session) return null;

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Account menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-4"
        style={{
          background: open ? "var(--r-surface-alt)" : "var(--r-surface)",
          backdropFilter: "blur(var(--r-blur))",
          border: "1px solid var(--r-border)",
        }}
      >
        {showProfileControls ? (
          <ProfileAvatarIcon avatarKey={activeProfile.avatarKey} size={28} />
        ) : (
          <span className="grid h-7 w-7 place-items-center rounded-full" style={{ background: "var(--r-surface-alt)", color: "var(--r-text-muted)" }}>
            <IconSettings size={15} />
          </span>
        )}
        {showProfileControls && (
          <span className="hidden max-w-[8rem] truncate text-xs font-medium sm:inline" style={{ color: "var(--r-text-muted)" }}>
            {activeProfile.name}
          </span>
        )}
        <span className="shrink-0" style={{ color: "var(--r-text-dim)" }}>
          <IconChevronDown size={12} />
        </span>
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-20 mt-2 min-w-[11rem] overflow-hidden rounded-xl border py-1 shadow-2xl"
          style={{ borderColor: "var(--r-border)", background: "var(--r-surface)", backdropFilter: "blur(var(--r-blur))" }}
        >
          {showProfileControls && (
            <div className="truncate px-3 py-2 text-xs font-medium" style={{ color: "var(--r-text-dim)" }}>
              {activeProfile.name}
            </div>
          )}
          {showProfileControls && profiles.length > 1 && (
            <MenuItem
              icon={<ProfileAvatarIcon avatarKey={activeProfile.avatarKey} size={16} />}
              label="Switch Profile"
              onClick={() => {
                setOpen(false);
                switchProfile();
              }}
            />
          )}
          <MenuItem icon={<IconSettings size={15} />} label="Settings" to="/settings" onClick={() => setOpen(false)} />
          <MenuItem
            icon={<IconLogout size={15} />}
            label="Log out"
            onClick={() => {
              setOpen(false);
              logout();
            }}
          />
        </div>
      )}
    </div>
  );
}

export default function PublicLayout() {
  const { session, logout } = useAuth();
  const { profiles, activeProfile, switchProfile } = useProfiles();
  const [scrolled, setScrolled] = useState(false);

  // The nav has no background of its own (see below) so the Home hero can
  // show through it at the very top of the page — but that same transparency
  // means anything else scrolled underneath it (every other page, and Home's
  // own rows once you scroll past the hero) bleeds straight through instead
  // of being covered, which reads as the nav's content overlapping/garbling
  // with whatever's now behind it. Gaining a background back as soon as
  // there's been any scroll at all fixes that everywhere but the initial
  // hero reveal.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Admins are CMS-only — no browsing/watching as a viewer. Mirrors
  // AdminLayout's reverse redirect (non-admins bounced out of /admin). Once
  // past this, session is never "admin" below, so profile controls just
  // need an activeProfile.
  if (session?.role === "admin") {
    return <Navigate to="/admin" replace />;
  }

  return (
    <div
      className="min-h-screen"
      style={{ ...LIQUID_GLASS_VARS, background: "var(--r-bg)", backgroundImage: "var(--r-bg-image)", color: "var(--r-text)", fontFamily: "var(--r-font-body)" } as React.CSSProperties}
    >
      {/* PillNav and AccountMenu each carry their own translucent capsule
      background regardless, but the bar itself only gains a background once
      scrolled — transparent at the very top so the Home hero backdrop shows
      through, opaque-ish everywhere else so scrolled content doesn't bleed
      through it. Pinned via `fixed`, not `sticky`, specifically so it's
      removed from layout flow — Home's hero then extends up behind it instead
      of getting pushed down by the nav's own height.
      Height is 78px at this padding below the sm breakpoint, 86px at/above it
      (measured, not guessed) — pt-20/sm:pt-[88px] below on the page wrapper and
      the matching -mt/h values on Home's hero (see Home.tsx) both key off these
      same two numbers, rounded up a couple px for safety. */}
      <nav
        className="fixed inset-x-0 top-0 z-40 flex items-center justify-between gap-2 px-4 py-3 transition-[background,backdrop-filter] duration-200 sm:gap-4 sm:px-8 sm:py-4"
        style={{
          background: scrolled ? "color-mix(in srgb, var(--r-bg) 75%, transparent)" : "transparent",
          backdropFilter: scrolled ? "blur(16px)" : "none",
        }}
      >
        <Link
          to="/"
          className="shrink-0 text-lg font-extrabold"
          style={{ fontFamily: "var(--r-font-heading)", letterSpacing: "var(--r-tracking-heading)", color: "var(--r-accent)" }}
        >
          <span className="sm:hidden">L</span>
          <span className="hidden sm:inline">LANStream</span>
        </Link>

        <div className="flex min-w-0 flex-1 justify-center">
          <PillNav />
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <AccountMenu session={session} logout={logout} activeProfile={activeProfile} profiles={profiles} switchProfile={switchProfile} />
        </div>
      </nav>

      {/* Pushes every page down by the nav's real height, since `fixed` no longer
      reserves that space itself. Home's hero cancels this out via its own
      negative margin-top (see Home.tsx) to sit behind the nav instead. */}
      <div className="pt-20 sm:pt-[88px]">
        <Outlet />
      </div>
    </div>
  );
}
