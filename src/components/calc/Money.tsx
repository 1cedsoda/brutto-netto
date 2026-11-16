import { cn } from "@/lib/utils";
import { formatEUR, formatDelta } from "@/lib/format";
import { useT } from "@/lib/i18n";
import type { DisplayPeriod } from "@/lib/store";

interface MoneyPairProps {
  monthly: number;
  yearly: number;
  /** which value is emphasised */
  primary: DisplayPeriod;
  sign?: "minus" | "plus";
  /** render as signed delta (+/−) instead of a plain amount */
  delta?: boolean;
  /** scale of the primary line */
  size?: "sm" | "lg";
  align?: "left" | "right";
  /** relative share to display (e.g. "62,5 %"); period-independent */
  share?: string;
  className?: string;
}

/**
 * Shows the monthly and yearly amount together — the chosen period is
 * emphasised, the other is muted underneath. An optional relative share is
 * shown alongside the secondary (muted) line.
 */
export function MoneyPair({
  monthly,
  yearly,
  primary,
  sign,
  delta,
  size = "sm",
  align = "right",
  share,
  className,
}: MoneyPairProps) {
  const t = useT();
  const fmt = (n: number) => {
    const base = delta ? formatDelta(n) : formatEUR(n);
    if (delta || !sign) return base;
    return `${sign === "minus" ? "−" : "+"}${base}`;
  };

  const mTag = t("m.month");
  const yTag = t("m.year");
  const rows: { v: number; tag: string }[] =
    primary === "monthly"
      ? [
          { v: monthly, tag: mTag },
          { v: yearly, tag: yTag },
        ]
      : [
          { v: yearly, tag: yTag },
          { v: monthly, tag: mTag },
        ];

  const justify = align === "right" ? "justify-end" : "justify-start";

  return (
    <div
      className={cn(
        "tabular-nums leading-tight",
        align === "right" ? "text-right" : "text-left",
        className,
      )}
    >
      <div
        className={cn(
          "font-mono",
          size === "lg" ? "text-2xl font-semibold" : "text-sm",
        )}
      >
        {fmt(rows[0].v)}
        <span
          className={cn(
            "ml-0.5 font-sans text-muted-foreground/60",
            size === "lg" ? "text-xs" : "text-[10px]",
          )}
        >
          {rows[0].tag}
        </span>
      </div>
      <div
        className={cn(
          "flex items-baseline gap-1.5 font-mono text-[11px] text-muted-foreground",
          justify,
        )}
      >
        {share && (
          <span className="font-sans font-medium text-muted-foreground">{share}</span>
        )}
        <span>
          {fmt(rows[1].v)}
          <span className="ml-0.5 font-sans text-muted-foreground/50">{rows[1].tag}</span>
        </span>
      </div>
    </div>
  );
}
