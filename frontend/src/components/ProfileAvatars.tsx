import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// Simple stroke-style icons, same conventions as components/Icons.tsx
// (viewBox 0 0 24 24, currentColor stroke) — a small fixed catalog since
// there's no existing asset suited to "profile picture" avatars.
type IconProps = { size?: number };
const base = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

function CatIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
      <path d="M5 9 3 4l5 3M19 9l2-5-5 3" />
      <circle cx="12" cy="13" r="7" />
      <path d="M9 13h.01M15 13h.01M10 16c.6.6 1.4.6 2 0" />
    </svg>
  );
}

function FoxIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
      <path d="M4 5l4 5M20 5l-4 5" />
      <path d="M4 5l3 1M20 5l-3 1" />
      <path d="M6.5 10a6 6 0 0 1 11 0c0 4-2 8-5.5 9.5C8.5 18 6.5 14 6.5 10Z" />
      <path d="M12 12v3M10 11h.01M14 11h.01" />
    </svg>
  );
}

function OwlIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
      <path d="M12 3c-4 0-7 3-7 8 0 5.5 3 9.5 7 9.5s7-4 7-9.5c0-5-3-8-7-8Z" />
      <circle cx="9" cy="11" r="2" />
      <circle cx="15" cy="11" r="2" />
      <path d="M12 13l-1 2h2l-1-2Z" />
    </svg>
  );
}

function RobotIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
      <rect x="5" y="8" width="14" height="11" rx="2" />
      <path d="M12 8V5M9 3h6" />
      <circle cx="9.5" cy="13" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="13" r="1.2" fill="currentColor" stroke="none" />
      <path d="M9 16.5h6" />
    </svg>
  );
}

function AlienIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
      <path d="M12 3C7 3 4 8 5 13c.6 3 3 7 7 8 4-1 6.4-5 7-8 1-5-2-10-7-10Z" />
      <ellipse cx="9" cy="12" rx="1.6" ry="2.4" />
      <ellipse cx="15" cy="12" rx="1.6" ry="2.4" />
    </svg>
  );
}

function GhostIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
      <path d="M5 20V11a7 7 0 0 1 14 0v9l-2.5-2-2 2-2.5-2-2 2-2.5-2Z" />
      <path d="M9 11h.01M15 11h.01" />
    </svg>
  );
}

function BearIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
      <circle cx="6" cy="6" r="2" />
      <circle cx="18" cy="6" r="2" />
      <circle cx="12" cy="13" r="8" />
      <path d="M9.5 13h.01M14.5 13h.01" />
      <path d="M10.5 16.5c1 .8 2 .8 3 0" />
    </svg>
  );
}

function PandaIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
      <circle cx="6" cy="6" r="2.2" fill="currentColor" stroke="none" />
      <circle cx="18" cy="6" r="2.2" fill="currentColor" stroke="none" />
      <circle cx="12" cy="13" r="8" />
      <ellipse cx="9" cy="13" rx="1.8" ry="2.2" fill="currentColor" stroke="none" />
      <ellipse cx="15" cy="13" rx="1.8" ry="2.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

function RabbitIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
      <path d="M9 9C8 5 8.5 2 10 2s1.5 4 1 7M15 9c1-4 .5-7-1-7s-1.5 4-1 7" />
      <circle cx="12" cy="14" r="7" />
      <path d="M9.5 14h.01M14.5 14h.01M10.5 17c1 .6 2 .6 3 0" />
    </svg>
  );
}

function AstronautIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 11a4 4 0 0 1 8 0c0 2.5-1.5 5-4 6-2.5-1-4-3.5-4-6Z" />
      <path d="M8 9c1.5 1 6.5 1 8 0" />
    </svg>
  );
}

export const PROFILE_AVATARS: { key: string; label: string; Icon: React.ComponentType<IconProps>; color: string }[] = [
  { key: "cat", label: "Cat", Icon: CatIcon, color: "#f59e0b" },
  { key: "fox", label: "Fox", Icon: FoxIcon, color: "#ea580c" },
  { key: "owl", label: "Owl", Icon: OwlIcon, color: "#7c3aed" },
  { key: "robot", label: "Robot", Icon: RobotIcon, color: "#0ea5e9" },
  { key: "alien", label: "Alien", Icon: AlienIcon, color: "#22c55e" },
  { key: "ghost", label: "Ghost", Icon: GhostIcon, color: "#64748b" },
  { key: "bear", label: "Bear", Icon: BearIcon, color: "#a16207" },
  { key: "panda", label: "Panda", Icon: PandaIcon, color: "#334155" },
  { key: "rabbit", label: "Rabbit", Icon: RabbitIcon, color: "#ec4899" },
  { key: "astronaut", label: "Astronaut", Icon: AstronautIcon, color: "#6366f1" },
];

const DEFAULT_AVATAR = PROFILE_AVATARS[0];

export function avatarByKey(key: string) {
  return PROFILE_AVATARS.find((a) => a.key === key) ?? DEFAULT_AVATAR;
}

export function ProfileAvatarIcon({ avatarKey, size = 40 }: { avatarKey: string; size?: number }) {
  const avatar = avatarByKey(avatarKey);
  return (
    <div
      className="grid shrink-0 place-items-center rounded-full"
      style={{ width: size, height: size, background: avatar.color, color: "#0b0d10" }}
    >
      <avatar.Icon size={Math.round(size * 0.55)} />
    </div>
  );
}

/** Button that opens a popover list of every avatar (icon + label) — a native
 * <select> can't render SVGs inside <option>, so this is the functional
 * equivalent of "choose an SVG from a dropdown."
 *
 * The popover portals to document.body instead of rendering as a normal
 * absolutely-positioned child: this dropdown gets used inside Modal (e.g. the
 * "Add a profile" picker), and Modal's card is `overflow-y-auto` — any
 * ordinary absolute-positioned popover nested inside that gets silently
 * clipped by it instead of floating over the rest of the page. Portaling
 * (with `fixed` positioning computed from the trigger's own bounding rect)
 * escapes that entirely, and works identically in every other, unclipped
 * usage too. */
export function AvatarDropdown({ value, onChange }: { value: string; onChange: (key: string) => void }) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (popoverRef.current && !popoverRef.current.contains(target)) setOpen(false);
    };
    window.addEventListener("mousedown", onClickOutside);
    return () => window.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const toggle = () => {
    if (!open && triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      setRect({ top: r.bottom + 4, left: r.left, width: r.width });
    }
    setOpen((o) => !o);
  };

  const selected = avatarByKey(value);

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        className="flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-sm"
        style={{ background: "var(--surface-alt)", borderColor: "var(--border)", color: "var(--text)" }}
      >
        <ProfileAvatarIcon avatarKey={selected.key} size={28} />
        <span className="flex-1 text-left">{selected.label}</span>
        <span style={{ color: "var(--text-dim)" }}>{open ? "▲" : "▼"}</span>
      </button>

      {open &&
        rect &&
        createPortal(
          <div
            ref={popoverRef}
            className="fixed z-[1000] grid max-h-64 grid-cols-2 gap-1 overflow-y-auto rounded-lg border p-2 shadow-2xl"
            style={{ top: rect.top, left: rect.left, width: rect.width, background: "var(--surface)", borderColor: "var(--border)" }}
          >
            {PROFILE_AVATARS.map((a) => (
              <button
                key={a.key}
                type="button"
                onClick={() => {
                  onChange(a.key);
                  setOpen(false);
                }}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-medium"
                style={{ background: a.key === value ? "var(--surface-alt)" : "transparent", color: "var(--text)" }}
              >
                <ProfileAvatarIcon avatarKey={a.key} size={24} />
                {a.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}
