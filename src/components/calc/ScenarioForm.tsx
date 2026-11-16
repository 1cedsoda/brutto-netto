import { useForm } from "@tanstack/react-form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ChevronDown, Plus, RotateCcw, X } from "lucide-react";
import { classifyJobs } from "@/lib/tax/scenario";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { SliderInput } from "./SliderInput";
import { useCalcStore, type FormSection, type ScenarioKey } from "@/lib/store";
import { useT, type Key } from "@/lib/i18n";
import { STATES, KRANKENKASSEN, TAX_YEARS, type TaxYear } from "@/lib/tax/constants";
import type {
  Job,
  JobKind,
  RvProposal,
  HealthInsuranceKind,
  ScenarioInput,
  Steuerklasse,
} from "@/lib/tax/types";

const STEUERKLASSEN: { value: Steuerklasse; key: Key }[] = [
  { value: 1, key: "stk.1" },
  { value: 2, key: "stk.2" },
  { value: 3, key: "stk.3" },
  { value: 4, key: "stk.4" },
  { value: 5, key: "stk.5" },
  { value: 6, key: "stk.6" },
];

const EMPLOYMENT_KINDS: { value: JobKind; key: Key }[] = [
  { value: "employee", key: "emp.employee" },
  { value: "minijob", key: "emp.minijob" },
  { value: "self", key: "emp.self" },
];

const RV_PROPOSALS: { value: RvProposal; key: Key }[] = [
  { value: "gruender", key: "rv.gruender" },
  { value: "regel", key: "rv.regel" },
  { value: "einkommen", key: "rv.einkommen" },
];

const HEALTH_KINDS: { value: HealthInsuranceKind; key: Key }[] = [
  { value: "gkv", key: "hk.gkv" },
  { value: "pkv_zuschuss", key: "hk.pkv_zuschuss" },
  { value: "pkv", key: "hk.pkv" },
];

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>;
}

function Section({
  title,
  children,
  onReset,
  resetLabel,
}: {
  title: string;
  children: React.ReactNode;
  onReset?: () => void;
  resetLabel?: string;
}) {
  return (
    <section className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3">
      <div className="flex min-h-6 items-center justify-between gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/80">
          {title}
        </h3>
        {onReset && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 gap-1 px-1.5 text-[11px] font-normal text-muted-foreground hover:text-foreground"
            onClick={onReset}
            title={resetLabel}
            aria-label={`${title}: ${resetLabel}`}
          >
            <RotateCcw className="h-3 w-3" />
            {resetLabel}
          </Button>
        )}
      </div>
      {children}
    </section>
  );
}

function SwitchRow({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-md border px-3 py-2">
      <Label htmlFor={id} className="text-sm">
        {label}
      </Label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function FieldError({ errors }: { errors: unknown[] }) {
  const msg = errors.find(Boolean);
  if (!msg) return null;
  return <p className="text-[11px] text-destructive">{String(msg)}</p>;
}

export function ScenarioForm({ scenarioKey }: { scenarioKey: ScenarioKey }) {
  const t = useT();
  const lang = useCalcStore((s) => s.lang);
  const setScenario = useCalcStore((s) => s.setScenario);
  const initial: ScenarioInput =
    scenarioKey === "A"
      ? useCalcStore.getState().scenarioA
      : useCalcStore.getState().scenarioB;

  const form = useForm({
    defaultValues: initial,
    listeners: {
      onChangeDebounceMs: 30,
      onChange: ({ formApi }) =>
        setScenario(scenarioKey, formApi.state.values as ScenarioInput),
    },
  });

  const id = (s: string) => `${scenarioKey}-${s}`;
  const addJob = useCalcStore((s) => s.addJob);
  const removeJob = useCalcStore((s) => s.removeJob);
  const setJobKind = useCalcStore((s) => s.setJobKind);
  const live = useCalcStore((s) => (scenarioKey === "A" ? s.scenarioA : s.scenarioB));
  const treatments = classifyJobs(live);
  const monthly = initial.grossPeriod === "monthly";
  const hasEmployment = initial.jobs.some((j) => j.kind !== "self");
  const hasOtherSelf = (jobId: string) =>
    initial.jobs.some((j) => j.kind === "self" && j.id !== jobId);
  const levySummary = (job: Job) => {
    const e = job.employer;
    const total = (e.insolvenzgeld ? 0.15 : 0) + e.u1Pct + e.u2Pct + e.unfallPct;
    return `${total.toLocaleString(lang === "de" ? "de-DE" : "en-US", { maximumFractionDigits: 2 })} %`;
  };
  const resetSection = useCalcStore((s) => s.resetSection);
  const reset = (section: FormSection) => ({
    onReset: () => resetSection(scenarioKey, section),
    resetLabel: t("action.resetSection"),
  });

  return (
    <form
      className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5"
      onSubmit={(e) => e.preventDefault()}
    >
      {/* ── Person & Steuer ───────────────────────────────────── */}
      <Section title={t("sec.personTax")} {...reset("personTax")}>
        <form.Field name="year">
          {(field) => (
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs font-medium text-muted-foreground">
                {t("f.year")}
              </Label>
              <ToggleGroup
                type="single"
                value={String(field.state.value)}
                onValueChange={(v) => v && field.handleChange(Number(v) as TaxYear)}
                variant="outline"
                size="sm"
              >
                {TAX_YEARS.map((y) => (
                  <ToggleGroupItem key={y} value={String(y)} className="px-3 text-xs">
                    {y}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
          )}
        </form.Field>

        <Row>
          <form.Field name="steuerklasse">
            {(field) => (
              <div className="grid gap-1.5">
                <Label className="text-xs font-medium text-muted-foreground">
                  {t("f.steuerklasse")}
                </Label>
                <Select
                  value={String(field.state.value)}
                  onValueChange={(v) => field.handleChange(Number(v) as Steuerklasse)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STEUERKLASSEN.map((s) => (
                      <SelectItem key={s.value} value={String(s.value)}>
                        {t(s.key)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </form.Field>

          <form.Field name="bundesland">
            {(field) => (
              <div className="grid gap-1.5">
                <Label className="text-xs font-medium text-muted-foreground">
                  {t("f.bundesland")}
                </Label>
                <Select
                  value={field.state.value}
                  onValueChange={(v) => field.handleChange(v as never)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATES.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </form.Field>
        </Row>

        <form.Field name="age">
          {(field) => (
            <SliderInput
              id={id("age")}
              label={t("f.age")}
              value={field.state.value}
              onChange={field.handleChange}
              min={15}
              max={99}
              suffix={t("f.ageSuffix")}
            />
          )}
        </form.Field>

        <form.Field name="children">
          {(field) => (
            <SliderInput
              id={id("children")}
              label={t("f.children")}
              value={field.state.value}
              onChange={(v) => field.handleChange(Math.round(v))}
              min={0}
              max={10}
              step={1}
            />
          )}
        </form.Field>

        <form.Field name="church">
          {(field) => (
            <SwitchRow
              id={id("church")}
              label={t("f.church")}
              checked={field.state.value}
              onChange={field.handleChange}
            />
          )}
        </form.Field>
      </Section>

      <Separator />

      {/* ── Sozialversicherung ────────────────────────────────── */}
      <Section title={t("sec.social")} {...reset("social")}>
        <form.Field name="health.kind">
          {(field) => (
            <div className="grid gap-1.5">
              <Label className="text-xs font-medium text-muted-foreground">
                {t("f.health")}
              </Label>
              <Select
                value={field.state.value}
                onValueChange={(v) => field.handleChange(v as HealthInsuranceKind)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HEALTH_KINDS.map((h) => (
                    <SelectItem key={h.value} value={h.value}>
                      {t(h.key)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </form.Field>

        <form.Subscribe selector={(s) => s.values.health.kind}>
          {(kind) =>
            kind === "gkv" ? (
              <>
                <form.Field name="health.fundId">
                  {(field) => (
                    <div className="grid gap-1.5">
                      <Label className="text-xs font-medium text-muted-foreground">
                        {t("f.fund")}
                      </Label>
                      <Select
                        value={field.state.value ?? "average"}
                        onValueChange={(v) => {
                          field.handleChange(v);
                          const fund = KRANKENKASSEN.find((k) => k.id === v);
                          if (fund && v !== "custom") {
                            form.setFieldValue("health.zusatzbeitragPct", fund.zusatz);
                          }
                        }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {KRANKENKASSEN.map((k) => (
                            <SelectItem key={k.id} value={k.id}>
                              {k.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </form.Field>
                <form.Field name="health.zusatzbeitragPct">
                  {(field) => (
                    <SliderInput
                      id={id("zusatz")}
                      label={t("f.zusatz")}
                      value={field.state.value}
                      onChange={(v) => {
                        field.handleChange(v);
                        form.setFieldValue("health.fundId", "custom");
                      }}
                      min={0}
                      max={5}
                      step={0.1}
                      suffix="%"
                    />
                  )}
                </form.Field>
              </>
            ) : (
              <>
                <form.Field
                  name="health.privateMonthlyPremium"
                  validators={{
                    onChange: ({ value }) =>
                      value <= 0 ? t("err.premium") : undefined,
                  }}
                >
                  {(field) => (
                    <div>
                      <SliderInput
                        id={id("premium")}
                        label={t("f.premium")}
                        value={field.state.value}
                        onChange={field.handleChange}
                        min={0}
                        max={2000}
                        step={10}
                        suffix="€"
                        hint={
                          kind === "pkv_zuschuss"
                            ? t("hint.zuschuss")
                            : t("hint.noZuschuss")
                        }
                      />
                      <FieldError errors={field.state.meta.errors} />
                    </div>
                  )}
                </form.Field>
                <form.Field name="health.basisPct">
                  {(field) => (
                    <SliderInput
                      id={id("basis")}
                      label={t("f.basis")}
                      value={field.state.value}
                      onChange={(v) => field.handleChange(Math.round(v))}
                      min={0}
                      max={100}
                      step={1}
                      suffix="%"
                      hint={t("hint.basis")}
                    />
                  )}
                </form.Field>
              </>
            )
          }
        </form.Subscribe>

        {hasEmployment && (
          <form.Field name="pensionInsured">
            {(field) => (
              <SwitchRow
                id={id("pension")}
                label={t("f.pension")}
                checked={field.state.value}
                onChange={field.handleChange}
              />
            )}
          </form.Field>
        )}
      </Section>

      <Separator />

      {/* ── Einkommen ─────────────────────────────────────────── */}
      <Section title={t("sec.income")} {...reset("income")}>
        {initial.jobs.map((job, i) => {
          const treatment = treatments[i];
          const multi = initial.jobs.length > 1;
          const overLimit = job.kind === "minijob" && treatment !== "minijob" && treatment !== "minijob-combined";
          const hint = overLimit
            ? t("treat.minijobOver")
            : multi || treatment === "midijob"
              ? t(`treat.${treatment}` as Key)
              : null;
          return (
            <div
              key={job.id}
              className={`grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 ${multi ? "rounded-lg border p-3" : ""}`}
            >
              {multi && (
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-baseline gap-2">
                    <span className="shrink-0 whitespace-nowrap text-sm font-medium">
                      {i === 0 ? t("job.main") : `${t("job.n")} ${i + 1}`}
                    </span>
                    {hint && (
                      <span className="truncate text-[11px] text-muted-foreground">{hint}</span>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                    onClick={() => removeJob(scenarioKey, job.id)}
                    title={t("job.remove")}
                    aria-label={t("job.remove")}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
              <ToggleGroup
                type="single"
                value={job.kind}
                onValueChange={(v) => v && setJobKind(scenarioKey, job.id, v as JobKind)}
                variant="outline"
                size="sm"
                className="w-full"
              >
                {EMPLOYMENT_KINDS.map((k) => (
                  <ToggleGroupItem
                    key={k.value}
                    value={k.value}
                    className="flex-1 text-xs"
                    disabled={k.value === "self" && hasOtherSelf(job.id)}
                  >
                    {t(k.key)}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              {!multi && hint && (
                <p className="-mt-1 text-[11px] text-muted-foreground">{hint}</p>
              )}

              <form.Field
                name={`jobs[${i}].grossAmount`}
                validators={{
                  onChange: ({ value }) =>
                    !multi && (value as number) <= 0 ? t("err.gross") : undefined,
                }}
              >
                {(field) => (
                  <div>
                    <SliderInput
                      id={id(`gross-${i}`)}
                      label={
                        job.kind === "self"
                          ? t("f.profit")
                          : job.kind === "minijob"
                            ? t("f.minijobWage")
                            : t("f.gross")
                      }
                      value={field.state.value as number}
                      onChange={field.handleChange}
                      min={0}
                      max={monthly ? 15000 : 180000}
                      step={monthly ? 50 : 500}
                      suffix="€"
                      rightSlot={
                        <span className="text-[11px] text-muted-foreground">
                          {monthly ? t("f.perMonth") : t("f.perYear")}
                        </span>
                      }
                    />
                    <FieldError errors={field.state.meta.errors} />
                  </div>
                )}
              </form.Field>

              {job.kind === "self" ? (
                <form.Subscribe selector={(s) => s.values.rvCommission}>
                  {(rvCommission) => (
          <div
            className={`grid gap-2 rounded-md border ${
              rvCommission ? "border-amber-500/40 bg-amber-500/5 p-3" : ""
            }`}
          >
            <form.Field name="rvCommission">
              {(field) => (
                <div className={`flex items-center justify-between gap-3 ${rvCommission ? "" : "px-3 py-2"}`}>
                  <Label htmlFor={id("rvCommission")} className="text-sm">
                    {t("f.rvCommission")}
                  </Label>
                  <Switch
                    id={id("rvCommission")}
                    checked={field.state.value}
                    onCheckedChange={field.handleChange}
                  />
                </div>
              )}
            </form.Field>
            {rvCommission ? (
              <>
                <p className="text-[11px] leading-snug text-amber-700 dark:text-amber-500">
                  {t("se.warning")}
                </p>
                <form.Field name="rvProposal">
                  {(field) => (
                    <div className="grid gap-1.5">
                      <Label className="text-xs font-medium text-muted-foreground">
                        {t("f.rvProposal")}
                      </Label>
                      <Select
                        value={field.state.value}
                        onValueChange={(v) => field.handleChange(v as RvProposal)}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {RV_PROPOSALS.map((p) => (
                            <SelectItem key={p.value} value={p.value}>
                              {t(p.key)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </form.Field>
              </>
            ) : (
              <p className="px-3 pb-2 text-[11px] leading-snug text-muted-foreground">
                {t("se.currentLaw")}
              </p>
            )}
          </div>
                  )}
                </form.Subscribe>
              ) : (
                <details className="group rounded-md border">
                  <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-sm">
                    <span>{t("job.employerLevies")}</span>
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      {levySummary(job)}
                      <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
                    </span>
                  </summary>
                  <div className="grid gap-3 border-t px-3 py-3">
                    <form.Field name={`jobs[${i}].employer.insolvenzgeld`}>
                      {(field) => (
                        <SwitchRow
                          id={id(`insolv-${i}`)}
                          label={t("f.insolv")}
                          checked={field.state.value as boolean}
                          onChange={field.handleChange}
                        />
                      )}
                    </form.Field>
                    {(
                      [
                        ["u1Pct", "f.u1", 5, 0.1, undefined],
                        ["u2Pct", "f.u2", 1, 0.01, undefined],
                        ["unfallPct", "f.unfall", 6, 0.1, "hint.unfall"],
                      ] as const
                    ).map(([k, label, max, step, hintKey]) => (
                      <form.Field key={k} name={`jobs[${i}].employer.${k}`}>
                        {(field) => (
                          <SliderInput
                            id={id(`${k}-${i}`)}
                            label={t(label)}
                            value={field.state.value as number}
                            onChange={field.handleChange}
                            min={0}
                            max={max}
                            step={step}
                            suffix="%"
                            hint={hintKey ? t(hintKey) : undefined}
                          />
                        )}
                      </form.Field>
                    ))}
                  </div>
                </details>
              )}
            </div>
          );
        })}

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full gap-1.5 border-dashed text-xs font-normal text-muted-foreground"
          onClick={() =>
            addJob(scenarioKey, initial.jobs.some((j) => j.kind === "minijob") ? "employee" : "minijob")
          }
        >
          <Plus className="h-3.5 w-3.5" />
          {t("job.add")}
        </Button>
      </Section>
    </form>
  );
}
