import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface NumberFieldProps {
  id: string;
  label: string;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
  step?: number;
  min?: number;
  max?: number;
  className?: string;
  hint?: string;
}

/**
 * Numeric input that keeps a local string buffer so the user can clear the
 * field while typing without it snapping back to 0.
 */
export function NumberField({
  id,
  label,
  value,
  onChange,
  suffix,
  step = 1,
  min,
  max,
  className,
  hint,
}: NumberFieldProps) {
  const [text, setText] = useState(String(value));

  // Sync external changes (e.g. reset, swap) into the local buffer.
  useEffect(() => {
    setText(value === 0 ? "0" : String(value));
  }, [value]);

  const commit = (raw: string) => {
    const normalized = raw.replace(",", ".");
    let n = parseFloat(normalized);
    if (Number.isNaN(n)) n = 0;
    if (min !== undefined) n = Math.max(min, n);
    if (max !== undefined) n = Math.min(max, n);
    onChange(n);
  };

  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          inputMode="decimal"
          value={text}
          step={step}
          onChange={(e) => {
            setText(e.target.value);
            commit(e.target.value);
          }}
          onBlur={() => setText(value === 0 ? "0" : String(value))}
          className={cn("tabular-nums", suffix && "pr-9")}
        />
        {suffix && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
      {hint && <p className="text-[11px] leading-tight text-muted-foreground">{hint}</p>}
    </div>
  );
}
