import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, Copy } from "lucide-react";
import { useCalcStore } from "@/lib/store";
import { calculate } from "@/lib/tax/calculate";
import { scenarioToText } from "@/lib/export";
import { useT } from "@/lib/i18n";

/** Copies the current scenario(s) — inputs and results — as plain text. */
export function CopyButton() {
  const t = useT();
  const [copied, setCopied] = useState(false);

  const onClick = async () => {
    const s = useCalcStore.getState();
    const text = s.compareMode
      ? [
          scenarioToText(s.scenarioA, calculate(s.scenarioA), "Szenario A"),
          scenarioToText(s.scenarioB, calculate(s.scenarioB), "Szenario B"),
        ].join("\n\n────────────────────────\n\n")
      : scenarioToText(s.scenarioA, calculate(s.scenarioA));

    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback for browsers without the async clipboard API.
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Button variant="outline" size="sm" onClick={onClick}>
      {copied ? (
        <Check className="mr-1.5 h-3.5 w-3.5 text-emerald-600" />
      ) : (
        <Copy className="mr-1.5 h-3.5 w-3.5" />
      )}
      {copied ? t("action.copied") : t("action.copy")}
    </Button>
  );
}
