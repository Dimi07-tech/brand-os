"use client";

import {
  AUDIENCE_LABELS,
  AUDIENCES,
  BRAND_VALUE_LABELS,
  BRAND_VALUES,
  brandBriefSchema,
  COLOR_FAMILIES,
  COLOR_FAMILY_INFO,
  getFont,
  VISUAL_STYLE_LABELS,
  VISUAL_STYLES,
  type BrandBrief,
  type ColorFamily,
} from "@brand-os/shared";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Alert, Button, Field } from "@/components/ui";
import { SECTOR_LABELS } from "@/lib/labels";

// Questionnaire créatif en 6 étapes — US-20

export type BriefDraft = {
  name: string;
  slogan: string;
  sector: BrandBrief["sector"] | "";
  audience: BrandBrief["audience"];
  values: BrandBrief["values"];
  style: BrandBrief["style"] | "";
  preferredColors: ColorFamily[];
  avoidedColors: ColorFamily[];
};

/** Police d'exemple de chaque style visuel (étape 5, « choix sur images »). */
const STYLE_SAMPLE_FONT: Record<BrandBrief["style"], string> = {
  moderne: "Montserrat",
  elegant: "Playfair Display",
  audacieux: "Bebas Neue",
  ludique: "Fredoka",
  classique: "Libre Baskerville",
  naturel: "Quicksand",
};

const STEPS: { title: string; subtitle: string; fields: (keyof BriefDraft)[] }[] = [
  { title: "Le nom de votre marque", subtitle: "Tel qu’il apparaîtra sur votre logo.", fields: ["name", "slogan"] },
  { title: "Votre secteur", subtitle: "Pour vous proposer des symboles qui parlent à vos clients.", fields: ["sector"] },
  { title: "Vos clients", subtitle: "À qui vous adressez-vous ? Jusqu’à 3 choix.", fields: ["audience"] },
  { title: "Vos valeurs", subtitle: "Choisissez les 3 mots qui vous ressemblent le plus.", fields: ["values"] },
  { title: "Votre style", subtitle: "Quelle impression votre marque doit-elle donner ?", fields: ["style"] },
  { title: "Vos couleurs", subtitle: "Facultatif : sans préférence, nous choisissons selon votre secteur.", fields: ["preferredColors", "avoidedColors"] },
];

export function Questionnaire({
  initial,
  submitting,
  error,
  onSubmit,
}: {
  initial: BriefDraft;
  submitting: boolean;
  error: string | null;
  onSubmit: (brief: BrandBrief) => void;
}) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<BriefDraft>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const current = STEPS[step]!;
  const last = step === STEPS.length - 1;

  function update<K extends keyof BriefDraft>(key: K, value: BriefDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
    setErrors((e) => ({ ...e, [key]: "" }));
  }

  function next() {
    // Même schéma que l'API, limité aux champs de l'étape courante.
    const parsed = brandBriefSchema.safeParse(draft);
    const stepErrors: Record<string, string> = {};
    for (const issue of parsed.error?.issues ?? []) {
      const field = issue.path[0] as keyof BriefDraft;
      if (current.fields.includes(field)) stepErrors[field] ??= issue.message;
    }
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors);
      return;
    }
    if (last && parsed.success) onSubmit(parsed.data);
    else setStep((s) => s + 1);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-accent">
            Étape {step + 1} sur {STEPS.length}
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border" aria-hidden>
          <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
        </div>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight">{current.title}</h1>
        <p className="mt-1 text-muted">{current.subtitle}</p>
      </div>

      {error && <Alert>{error}</Alert>}

      {step === 0 && (
        <div className="flex flex-col gap-5">
          <Field label="Nom de la marque" maxLength={40} value={draft.name} error={errors.name} onChange={(e) => update("name", e.target.value)} />
          <Field
            label="Slogan (facultatif)"
            maxLength={80}
            placeholder="Ex. Le goût de Cotonou"
            value={draft.slogan}
            error={errors.slogan}
            onChange={(e) => update("slogan", e.target.value)}
          />
        </div>
      )}

      {step === 1 && (
        <ChoiceGrid error={errors.sector}>
          {Object.entries(SECTOR_LABELS).map(([value, label]) => (
            <Choice key={value} selected={draft.sector === value} onClick={() => update("sector", value as BriefDraft["sector"])}>
              {label}
            </Choice>
          ))}
        </ChoiceGrid>
      )}

      {step === 2 && (
        <ChoiceGrid error={errors.audience}>
          {AUDIENCES.map((a) => (
            <Choice key={a} selected={draft.audience.includes(a)} onClick={() => update("audience", toggle(draft.audience, a, 3))}>
              {AUDIENCE_LABELS[a]}
            </Choice>
          ))}
        </ChoiceGrid>
      )}

      {step === 3 && (
        <>
          <p className="-mt-3 text-sm text-muted" aria-live="polite">
            {draft.values.length} sur 3 choisies
          </p>
          <ChoiceGrid error={errors.values} columns="grid-cols-2 sm:grid-cols-3">
            {BRAND_VALUES.map((v) => (
              <Choice
                key={v}
                selected={draft.values.includes(v)}
                disabled={!draft.values.includes(v) && draft.values.length >= 3}
                onClick={() => update("values", toggle(draft.values, v, 3))}
              >
                {BRAND_VALUE_LABELS[v]}
              </Choice>
            ))}
          </ChoiceGrid>
        </>
      )}

      {step === 4 && (
        <ChoiceGrid error={errors.style} columns="grid-cols-2 sm:grid-cols-3">
          {VISUAL_STYLES.map((s) => {
            const font = getFont(STYLE_SAMPLE_FONT[s])!;
            return (
              <Choice key={s} selected={draft.style === s} onClick={() => update("style", s)}>
                <span
                  className="block text-3xl leading-tight"
                  style={{ fontFamily: `'${font.family}', ${font.fallback}`, fontWeight: font.weight }}
                  aria-hidden
                >
                  Aa
                </span>
                <span className="mt-2 block font-semibold">{VISUAL_STYLE_LABELS[s].label}</span>
                <span className="block text-xs font-normal text-muted">{VISUAL_STYLE_LABELS[s].description}</span>
              </Choice>
            );
          })}
        </ChoiceGrid>
      )}

      {step === 5 && (
        <div className="flex flex-col gap-6">
          <ColorPicker
            legend="Couleurs que vous aimez (3 maximum)"
            selected={draft.preferredColors}
            disabled={draft.avoidedColors}
            max={3}
            onChange={(v) => update("preferredColors", v)}
          />
          <ColorPicker
            legend="Couleurs à éviter"
            selected={draft.avoidedColors}
            disabled={draft.preferredColors}
            max={5}
            error={errors.avoidedColors}
            onChange={(v) => update("avoidedColors", v)}
          />
        </div>
      )}

      <div className="flex gap-3">
        {step > 0 && (
          <Button variant="secondary" onClick={() => setStep((s) => s - 1)} aria-label="Étape précédente">
            <ArrowLeft className="size-4" aria-hidden />
          </Button>
        )}
        <Button className="flex-1" onClick={next} loading={submitting}>
          {last ? "Voir mes logos" : "Continuer"}
          {!last && <ArrowRight className="size-4" aria-hidden />}
        </Button>
      </div>
    </div>
  );
}

function toggle<T>(list: readonly T[], item: T, max: number): T[] {
  if (list.includes(item)) return list.filter((i) => i !== item);
  return list.length >= max ? [...list] : [...list, item];
}

function ChoiceGrid({ children, error, columns = "grid-cols-1 sm:grid-cols-2" }: { children: ReactNode; error?: string; columns?: string }) {
  return (
    <div className="flex flex-col gap-2">
      <div className={`grid gap-3 ${columns}`}>{children}</div>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}

function Choice({
  selected,
  disabled,
  onClick,
  children,
}: {
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={`relative min-h-12 rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-40 ${
        selected ? "border-accent bg-accent-soft" : "border-border bg-surface hover:border-muted"
      }`}
    >
      {selected && <Check className="absolute right-3 top-3 size-4 text-accent" aria-hidden />}
      {children}
    </button>
  );
}

function ColorPicker({
  legend,
  selected,
  disabled,
  max,
  error,
  onChange,
}: {
  legend: string;
  selected: ColorFamily[];
  disabled: ColorFamily[];
  max: number;
  error?: string;
  onChange: (value: ColorFamily[]) => void;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-medium">{legend}</legend>
      <div className="mt-3 grid grid-cols-5 gap-3">
        {COLOR_FAMILIES.map((c) => {
          const info = COLOR_FAMILY_INFO[c];
          const isSelected = selected.includes(c);
          return (
            <button
              key={c}
              type="button"
              aria-pressed={isSelected}
              disabled={disabled.includes(c) || (!isSelected && selected.length >= max)}
              onClick={() => onChange(toggle(selected, c, max))}
              className="flex flex-col items-center gap-1.5 text-xs disabled:opacity-30"
            >
              <span
                className={`grid size-11 place-items-center rounded-full ring-offset-2 ring-offset-background ${isSelected ? "ring-2 ring-accent" : ""}`}
                style={{ background: info.swatch }}
              >
                {isSelected && <Check className="size-5 text-white" aria-hidden />}
              </span>
              {info.label}
            </button>
          );
        })}
      </div>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </fieldset>
  );
}
