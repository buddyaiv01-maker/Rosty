// Visual language ported from the Rosty_V1 "Liquid Glass" style (D:\Ahnon\Rosty_V1),
// applied as scoped CSS custom properties on the public layout's root element only —
// the Admin CMS keeps its own separate token system (--bg, --surface, etc).
export const LIQUID_GLASS_VARS: Record<string, string> = {
  "--r-bg": "#0d1117",
  "--r-bg-image":
    "radial-gradient(circle at 30% 20%, rgba(226,232,240,0.18), transparent 50%), radial-gradient(circle at 75% 70%, rgba(59,130,246,0.28), transparent 50%)",
  "--r-surface": "rgba(226,232,240,0.08)",
  "--r-surface-alt": "rgba(226,232,240,0.14)",
  "--r-text": "#eef3f9",
  "--r-text-muted": "#9fb0c4",
  "--r-text-dim": "#6b7f97",
  "--r-accent": "#cbd5e1",
  "--r-accent-2": "#60a5fa",
  "--r-border": "rgba(226,232,240,0.25)",
  "--r-radius": "28px",
  "--r-radius-lg": "36px",
  "--r-shadow": "0 8px 32px rgba(0,0,0,0.4)",
  "--r-shadow-lg": "0 30px 70px rgba(96,165,250,0.2)",
  "--r-font-heading": "'Space Grotesk', sans-serif",
  "--r-font-body": "'Inter', system-ui, sans-serif",
  "--r-tracking-heading": "-0.01em",
  "--r-blur": "24px",
};
