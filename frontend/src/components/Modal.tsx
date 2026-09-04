import { useEffect } from "react";
import { IconClose } from "./Icons";

export default function Modal({
  title,
  onClose,
  children,
  width = "max-w-2xl",
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  width?: string;
}) {
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }} onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className={`max-h-[88vh] w-full ${width} overflow-y-auto rounded-xl border`}
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center justify-between border-b px-6 py-4" style={{ borderColor: "var(--border)" }}>
          <h2 className="text-base font-bold">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-lg text-sm"
            style={{ color: "var(--text-muted)" }}
          >
            <IconClose />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
