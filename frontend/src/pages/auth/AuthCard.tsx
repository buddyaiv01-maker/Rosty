import type { ReactNode } from "react";

export function AuthCard({
  title,
  subtitle,
  onBack,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  onBack?: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="flex min-h-screen items-center justify-center px-4"
      style={{
        background: "var(--bg)",
        backgroundImage: "linear-gradient(color-mix(in srgb, var(--bg) 55%, transparent), var(--bg)), url(/cinema-bg.png)",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div
        className="relative w-full max-w-sm rounded-2xl border p-8"
        style={{ background: "color-mix(in srgb, var(--surface) 90%, transparent)", borderColor: "var(--border)", backdropFilter: "blur(12px)" }}
      >
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Go back"
            className="absolute left-5 top-5 grid h-8 w-8 place-items-center rounded-full text-lg"
            style={{ color: "var(--text-muted)" }}
          >
            &larr;
          </button>
        )}

        <div className="mb-6 text-center">
          <img src="/rosty-logo.png" alt="" className="mx-auto mb-3 h-10 w-auto" />
          <h1 className="text-xl font-bold" style={{ color: "var(--text)" }}>
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1.5 text-sm" style={{ color: "var(--text-muted)" }}>
              {subtitle}
            </p>
          )}
        </div>

        {children}
      </div>
    </div>
  );
}

export function AuthButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-opacity disabled:opacity-60"
      style={{ background: "var(--accent)", color: "#fff" }}
    >
      {children}
    </button>
  );
}

export function AuthLink(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      type="button"
      className="text-xs font-medium underline-offset-2 hover:underline disabled:opacity-60"
      style={{ color: "var(--text-muted)" }}
    />
  );
}

export function AuthError({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p className="text-xs" style={{ color: "var(--danger)" }} aria-live="polite">
      {children}
    </p>
  );
}

export function AuthInfo({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p className="text-xs" style={{ color: "var(--text-muted)" }} aria-live="polite">
      {children}
    </p>
  );
}
