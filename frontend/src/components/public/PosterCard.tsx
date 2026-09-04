import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { IconArrowRight, IconMoreVertical } from "../Icons";
import * as api from "../../lib/api";

export default function PosterCard({
  to,
  title,
  posterUrl,
  subtitle,
  fixedWidth,
  progress,
  menu,
  aspect = "portrait",
}: {
  to: string;
  title: string;
  posterUrl?: string;
  subtitle?: string;
  fixedWidth?: boolean;
  /** 0..1 watched fraction — when set, renders a persistent progress bar (Continue Watching). */
  progress?: number;
  /** Optional per-card actions (e.g. "Remove from Continue Watching") — renders a
   * 3-dot trigger. Kept as a sibling of the <Link> below, not nested inside it:
   * a real <button> inside an <a> would be invalid HTML (see the decorative
   * arrow-badge <span> below, which hit the same constraint). */
  menu?: { label: string; onClick: () => void }[];
  /** "landscape" (16:9) suits stills/backdrops — e.g. Continue Watching, which
   * has an actual episode/backdrop image rather than a poster. Defaults to the
   * usual 2:3 poster shape everywhere else. */
  aspect?: "portrait" | "landscape";
}) {
  const [hovered, setHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    window.addEventListener("mousedown", onClickOutside);
    return () => window.removeEventListener("mousedown", onClickOutside);
  }, [menuOpen]);

  const handleClick = () => {
    const match = to.match(/^\/(movie|show)\/([^/]+)/);
    if (!match) return;
    const [, kind, contentId] = match;
    api.logEvent("click", {
      movieId: kind === "movie" ? contentId : undefined,
      showId: kind === "show" ? contentId : undefined,
      metadata: { title },
    });
  };

  return (
    <div
      className="group relative shrink-0"
      style={{ width: fixedWidth ? (aspect === "landscape" ? "clamp(220px, 26vw, 320px)" : "clamp(140px, 15vw, 200px)") : "100%" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Link
        to={to}
        onClick={handleClick}
        className="relative block cursor-pointer overflow-hidden transition-all duration-300"
        style={{
          width: "100%",
          aspectRatio: aspect === "landscape" ? "16/9" : "2/3",
          borderRadius: "var(--r-radius)",
          border: "1px solid var(--r-border)",
          // --r-shadow-lg's blur (70px) is far bigger than any reasonable
          // amount of row padding — the ancestor's overflow-x-auto was hard-
          // clipping it into a visible straight edge on hover instead of a
          // soft glow, so this card just doesn't use it.
          transform: hovered ? "scale(1.04) translateY(-3px)" : "scale(1)",
          zIndex: hovered ? 10 : 1,
        }}
      >
        {/* Each absolutely-positioned child below also gets the card's own
        border-radius, rather than relying only on the parent's overflow-hidden
        to clip them: composited children (img, transformed layers) can bypass
        an ancestor's clip during a transform like the hover scale() above,
        letting their square corners peek out past the rounded card edge. */}
        {posterUrl ? (
          <img src={posterUrl} alt="" className="h-full w-full object-cover" loading="lazy" style={{ borderRadius: "var(--r-radius)" }} />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center p-3 text-center text-sm font-semibold"
            style={{ background: "linear-gradient(150deg, var(--r-surface-alt), var(--r-surface))", color: "var(--r-text-muted)", borderRadius: "var(--r-radius)" }}
          >
            {title}
          </div>
        )}

        {/* Purely decorative — the whole card is already the Link. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full text-xs opacity-0 transition-opacity group-hover:opacity-100"
          style={{ background: "rgba(0,0,0,0.55)", color: "#fff" }}
        >
          <IconArrowRight size={11} />
        </span>

        <div
          // Portrait posters already have the title printed on the artwork, so
          // the overlay is a hover-only reveal. Landscape cards (backdrop
          // stills — Continue Watching) usually don't, so it stays visible.
          className={`pointer-events-none absolute inset-0 flex flex-col items-start justify-end p-2.5 transition-opacity duration-200 group-hover:opacity-100 ${aspect === "landscape" ? "opacity-100" : "opacity-0"}`}
          style={{ background: "linear-gradient(0deg, rgba(0,0,0,0.8), transparent 65%)", borderRadius: "var(--r-radius)" }}
        >
          <span className="text-xs font-bold text-white">{title}</span>
          {subtitle && <span className="text-[10px] text-white/60">{subtitle}</span>}
        </div>

        {progress !== undefined && (
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-1 bg-black/40"
            style={{ borderBottomLeftRadius: "var(--r-radius)", borderBottomRightRadius: "var(--r-radius)" }}
          >
            <div className="h-full" style={{ width: `${Math.min(1, Math.max(0, progress)) * 100}%`, background: "var(--r-accent)" }} />
          </div>
        )}
      </Link>

      {menu && menu.length > 0 && (
        <div ref={menuRef} className="absolute left-2 top-2 z-20">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setMenuOpen((o) => !o);
            }}
            aria-label="More options"
            className="grid h-6 w-6 place-items-center rounded-full opacity-0 transition-opacity group-hover:opacity-100 [@media(hover:none)]:opacity-100"
            style={{ background: "rgba(0,0,0,0.55)", color: "#fff", opacity: menuOpen ? 1 : undefined }}
          >
            <IconMoreVertical size={13} />
          </button>

          {menuOpen && (
            <div
              className="absolute left-0 top-full mt-1 min-w-max overflow-hidden rounded-lg border py-1 shadow-2xl"
              style={{ borderColor: "var(--r-border)", background: "var(--r-surface)", backdropFilter: "blur(var(--r-blur))" }}
            >
              {menu.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setMenuOpen(false);
                    item.onClick();
                  }}
                  className="block w-full whitespace-nowrap px-3 py-2 text-left text-xs font-medium"
                  style={{ color: "var(--r-text)" }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
