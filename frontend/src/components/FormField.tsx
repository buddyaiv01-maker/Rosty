import { IconClose } from "./Icons";

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
        {label}
      </span>
      {children}
      {hint && (
        <span className="text-[11px]" style={{ color: "var(--text-dim)" }}>
          {hint}
        </span>
      )}
    </label>
  );
}

const inputClass = "w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--accent)]";
const inputStyle = { background: "var(--surface-alt)", borderColor: "var(--border)", color: "var(--text)" };

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={inputClass} style={inputStyle} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${inputClass} resize-none`} style={inputStyle} rows={props.rows ?? 3} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={inputClass} style={inputStyle} />;
}

export function ChipInput({
  values,
  onChange,
  placeholder,
  options,
}: {
  values: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  options?: string[];
}) {
  const add = (v: string) => {
    const trimmed = v.trim();
    if (trimmed && !values.includes(trimmed)) onChange([...values, trimmed]);
  };

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {values.map((v) => (
          <span
            key={v}
            className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
            style={{ background: "var(--surface-alt)", border: "1px solid var(--border)" }}
          >
            {v}
            <button onClick={() => onChange(values.filter((x) => x !== v))} aria-label={`Remove ${v}`} style={{ color: "var(--text-dim)" }}>
              <IconClose size={11} />
            </button>
          </span>
        ))}
      </div>
      {options ? (
        <select
          value=""
          onChange={(e) => e.target.value && add(e.target.value)}
          className={inputClass}
          style={inputStyle}
        >
          <option value="">{placeholder ?? "Add…"}</option>
          {options.filter((o) => !values.includes(o)).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : (
        <input
          placeholder={placeholder}
          className={inputClass}
          style={inputStyle}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(e.currentTarget.value);
              e.currentTarget.value = "";
            }
          }}
          onBlur={(e) => {
            // Losing focus with unsubmitted text (tabbing away, clicking Save) would
            // otherwise silently drop it instead of committing it as a chip.
            if (e.currentTarget.value.trim()) {
              add(e.currentTarget.value);
              e.currentTarget.value = "";
            }
          }}
        />
      )}
    </div>
  );
}

export function FilePicker({
  label,
  fileName,
  onPick,
  accept,
}: {
  label: string;
  fileName?: string;
  onPick: (file: File) => void;
  accept?: string;
}) {
  return (
    <label
      className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-dashed px-3 py-2.5 text-sm transition-colors hover:border-[var(--accent)]"
      style={{ borderColor: "var(--border)", background: "var(--surface-alt)" }}
    >
      <span style={{ color: fileName ? "var(--text)" : "var(--text-dim)" }}>{fileName ?? label}</span>
      <span
        className="shrink-0 rounded-md px-2.5 py-1 text-xs font-semibold"
        style={{ background: "var(--surface)", color: "var(--text-muted)" }}
      >
        Browse
      </span>
      <input
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => e.target.files?.[0] && onPick(e.target.files[0])}
      />
    </label>
  );
}
