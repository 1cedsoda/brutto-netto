import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ArrowLeftRight, Copy, Moon, RotateCcw, Sun, Undo2 } from "lucide-react";
import { ScenarioForm } from "./ScenarioForm";
import { ResultsPanel } from "./ResultsPanel";
import { CompareView } from "./CompareView";
import { CopyButton } from "./CopyButton";
import { useCalcStore } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { LegalLinks } from "@/legal/LegalLinks";

function prefersDark() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

export default function Calculator() {
  const t = useT();
  const compareMode = useCalcStore((s) => s.compareMode);
  const setCompareMode = useCalcStore((s) => s.setCompareMode);
  const display = useCalcStore((s) => s.display);
  const setDisplay = useCalcStore((s) => s.setDisplay);
  const lang = useCalcStore((s) => s.lang);
  const setLang = useCalcStore((s) => s.setLang);
  const theme = useCalcStore((s) => s.theme);
  const setTheme = useCalcStore((s) => s.setTheme);
  const formVersion = useCalcStore((s) => s.formVersion);
  const swap = useCalcStore((s) => s.swap);
  const copyAToB = useCalcStore((s) => s.copyAToB);
  const reset = useCalcStore((s) => s.reset);
  const clear = useCalcStore((s) => s.clear);

  const isDark = theme === "dark" || (theme === "system" && prefersDark());

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  return (
    <TooltipProvider delayDuration={150}>
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-10">
        {/* Header */}
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {t("app.title")}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{t("app.subtitle")}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <ToggleGroup
              type="single"
              value={display}
              onValueChange={(v) => v && setDisplay(v as "monthly" | "yearly")}
              variant="outline"
              size="sm"
            >
              <ToggleGroupItem value="monthly" className="px-3 text-xs">
                {t("period.month")}
              </ToggleGroupItem>
              <ToggleGroupItem value="yearly" className="px-3 text-xs">
                {t("period.year")}
              </ToggleGroupItem>
            </ToggleGroup>

            <ToggleGroup
              type="single"
              value={compareMode ? "compare" : "single"}
              onValueChange={(v) => v && setCompareMode(v === "compare")}
              variant="outline"
              size="sm"
            >
              <ToggleGroupItem value="single" className="px-3 text-xs">
                {t("mode.single")}
              </ToggleGroupItem>
              <ToggleGroupItem value="compare" className="px-3 text-xs">
                {t("mode.compare")}
              </ToggleGroupItem>
            </ToggleGroup>

            <CopyButton />

            <ToggleGroup
              type="single"
              value={lang}
              onValueChange={(v) => v && setLang(v as "de" | "en")}
              variant="outline"
              size="sm"
            >
              <ToggleGroupItem value="de" className="px-2.5 text-xs">
                DE
              </ToggleGroupItem>
              <ToggleGroupItem value="en" className="px-2.5 text-xs">
                EN
              </ToggleGroupItem>
            </ToggleGroup>

            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              aria-label="Theme"
              onClick={() => setTheme(isDark ? "light" : "dark")}
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
        </header>

        {/* Compare-mode actions */}
        {compareMode && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={copyAToB}>
              <Copy className="mr-1.5 h-3.5 w-3.5" /> {t("action.copyAtoB")}
            </Button>
            <Button variant="outline" size="sm" onClick={swap}>
              <ArrowLeftRight className="mr-1.5 h-3.5 w-3.5" /> {t("action.swap")}
            </Button>
          </div>
        )}

        {compareMode ? (
          <CompareView />
        ) : (
          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(320px,380px)_1fr]">
            <div className="lg:sticky lg:top-6 lg:self-start">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-1">
                  <CardTitle className="mr-auto text-base">{t("action.inputs")}</CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-muted-foreground"
                    onClick={() => reset("A")}
                  >
                    <RotateCcw className="mr-1 h-3 w-3" /> {t("action.defaults")}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-muted-foreground"
                    onClick={() => clear("A")}
                  >
                    <Undo2 className="mr-1 h-3 w-3" /> {t("action.reset")}
                  </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <ScenarioForm key={`A-${formVersion}`} scenarioKey="A" />
                </CardContent>
              </Card>
            </div>
            <ResultsPanel scenarioKey="A" />
          </div>
        )}

        <footer className="mt-10 space-y-2 border-t pt-4 text-xs text-muted-foreground">
          <p>{t("app.footer")}</p>
          <LegalLinks sourceLabel={t("app.source")} />
        </footer>
      </div>
    </TooltipProvider>
  );
}
