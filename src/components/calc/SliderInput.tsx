import { useCallback, useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

/** Rate at which slider/input changes are propagated upstream while dragging. */
export const SLIDER_UPDATE_FPS = 30;
export const SLIDER_UPDATE_MS = Math.round(1000 / SLIDER_UPDATE_FPS);

interface SliderInputProps {
  id: string;
  label?: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  hint?: string;
  /** Optional element rendered at the right of the label row (e.g. a toggle). */
  rightSlot?: React.ReactNode;
  className?: string;
}

/**
 * A number entry that pairs a slider with a free-text numeric input.
 * The thumb/field update instantly, but the upstream `onChange` is throttled to
 * SLIDER_UPDATE_FPS so dragging doesn't recompute the whole result every frame.
 */
export function SliderInput({
  id,
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
  hint,
  rightSlot,
  className,
}: SliderInputProps) {
  const [text, setText] = useState(String(value));
  // Local value drives the thumb/field immediately; upstream is throttled.
  const [local, setLocal] = useState(value);

  useEffect(() => {
    setText(value === 0 ? "0" : String(value));
    setLocal(value);
  }, [value]);

  const lastEmit = useRef(0);
  const trailing = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (trailing.current) clearTimeout(trailing.current);
    },
    [],
  );

  // Throttle propagation to ~SLIDER_UPDATE_FPS, with a trailing call so the
  // final value always lands.
  const emit = useCallback(
    (n: number) => {
      const now = performance.now();
      const elapsed = now - lastEmit.current;
      if (trailing.current) {
        clearTimeout(trailing.current);
        trailing.current = null;
      }
      if (elapsed >= SLIDER_UPDATE_MS) {
        lastEmit.current = now;
        onChange(n);
      } else {
        trailing.current = setTimeout(() => {
          lastEmit.current = performance.now();
          onChange(n);
        }, SLIDER_UPDATE_MS - elapsed);
      }
    },
    [onChange],
  );

  const commit = (raw: string) => {
    const normalized = raw.replace(",", ".");
    let n = parseFloat(normalized);
    if (Number.isNaN(n)) n = 0;
    if (n < min) n = min;
    setLocal(n);
    emit(n);
  };

  const sliderValue = Math.min(Math.max(local, min), max);

  return (
    <div className={cn("grid gap-2", className)}>
      {(label || rightSlot) && (
        <div className="flex min-h-5 items-center justify-between gap-2">
          {label ? (
            <Label htmlFor={id} className="text-xs font-medium text-muted-foreground">
              {label}
            </Label>
          ) : (
            <span />
          )}
          {rightSlot}
        </div>
      )}
      <div className="flex items-center gap-3">
        <Slider
          value={[sliderValue]}
          min={min}
          max={max}
          step={step}
          onValueChange={(v) => {
            setLocal(v[0]);
            setText(String(v[0]));
            emit(v[0]);
          }}
          className="flex-1"
          aria-label={label}
        />
        <div className="relative w-24 shrink-0">
          <Input
            id={id}
            inputMode="decimal"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              commit(e.target.value);
            }}
            onBlur={() => setText(value === 0 ? "0" : String(value))}
            className={cn("h-8 px-2 text-right text-sm tabular-nums", suffix && "pr-6")}
          />
          {suffix && (
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
              {suffix}
            </span>
          )}
        </div>
      </div>
      {hint && <p className="text-[11px] leading-tight text-muted-foreground">{hint}</p>}
    </div>
  );
}
