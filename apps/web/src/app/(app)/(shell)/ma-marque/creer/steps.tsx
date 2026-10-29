"use client";

import {
  BODY_FONTS,
  checkPalette,
  contrastRatio,
  getIcon,
  HARMONY_LABELS,
  HEADING_FONTS,
  ICONS,
  LOGO_LAYOUT_LABELS,
  LOGO_LAYOUTS,
  PALETTE_ROLE_LABELS,
  PALETTE_ROLES,
  paletteColor,
  type IconContainer,
  type LogoSpec,
  type Palette,
  type PaletteRole,
} from "@brand-os/shared";
import { AlertTriangle, Check, RefreshCw } from "lucide-react";
import { useState, type ReactNode } from "react";
import { LogoPreview } from "@/components/logo-preview";
import { Alert, Button, Card, Field, SelectField } from "@/components/ui";
import type { Generation } from "@/lib/brand";

export type ColorRoles = Record<keyof LogoSpec["colors"], PaletteRole>;

/** Applique les couleurs de la palette au logo, selon le rôle choisi pour chaque élément. */
export function withPalette(logo: LogoSpec, palette: Palette, roles: ColorRoles): LogoSpec {
  return {
    ...logo,
    colors: {
      icon: paletteColor(palette, roles.icon),
      text: paletteColor(palette, roles.text),
      slogan: paletteColor(palette, roles.slogan),
    },
  };
}

/** Retrouve le rôle de palette de chaque couleur d'une proposition. */
export function rolesOf(logo: LogoSpec, palette: Palette): ColorRoles {
  const find = (hex: string, fallback: PaletteRole) => palette.colors.find((c) => c.hex === hex)?.role ?? fallback;
  return { icon: find(logo.colors.icon, "primary"), text: find(logo.colors.text, "text"), slogan: find(logo.colors.slogan, "secondary") };
}

// --- US-21 : propositions --------------------------------------------------

export function ProposalsStep({
  generation,
  loading,
  error,
  onMore,
  onSelect,
}: {
  generation: Generation;
  loading: boolean;
  error: string | null;
  onMore: () => void;
  onSelect: (index: number) => void;
}) {
  const { quota } = generation;
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Vos propositions de logos</h1>
        <p className="mt-1 text-muted">Choisissez celui qui vous plaît : vous pourrez tout personnaliser ensuite.</p>
      </div>
      {error && <Alert>{error}</Alert>}
      {quota.warning && quota.limit !== null && (
        <Alert tone="info">
          Vous avez utilisé {quota.used} générations sur {quota.limit} ce mois-ci.
        </Alert>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {generation.proposals.map((logo, i) => (
          <button
            key={`${generation.attempt}-${i}`}
            type="button"
            onClick={() => onSelect(i)}
            className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-white text-left transition-colors hover:border-accent focus-visible:outline-2 focus-visible:outline-accent"
          >
            <LogoPreview spec={logo} className="h-40 p-6" />
            <span className="flex items-center justify-between border-t border-border bg-surface px-4 py-3 text-sm">
              <span className="text-muted">{generation.creative.directions[Math.floor(i / 2)]?.title}</span>
              <span className="font-semibold text-accent group-hover:underline">Choisir</span>
            </span>
          </button>
        ))}
      </div>
      <div className="flex flex-col items-center gap-2">
        <Button variant="secondary" onClick={onMore} loading={loading}>
          <RefreshCw className="size-4" aria-hidden /> Autres propositions
        </Button>
        {quota.limit !== null && (
          <p className="text-xs text-muted">
            {quota.used} / {quota.limit} générations utilisées ce mois-ci
          </p>
        )}
      </div>
    </div>
  );
}

// --- US-22 : personnalisation ---------------------------------------------

const CONTAINERS: { value: IconContainer; label: string }[] = [
  { value: "none", label: "Sans fond" },
  { value: "circle", label: "Rond" },
  { value: "rounded", label: "Carré arrondi" },
];

const LOGO_COLOR_ROLES: PaletteRole[] = ["primary", "secondary", "accent", "text"];

export function CustomizeStep({
  logo,
  palette,
  roles,
  suggestedIcons,
  onChange,
  onRolesChange,
  onBack,
  onNext,
}: {
  logo: LogoSpec;
  palette: Palette;
  roles: ColorRoles;
  suggestedIcons: string[];
  onChange: (logo: LogoSpec) => void;
  onRolesChange: (roles: ColorRoles) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [allIcons, setAllIcons] = useState(false);
  const preview = withPalette(logo, palette, roles);
  const needsIcon = logo.layout === "icon-left" || logo.layout === "icon-top";
  const iconIds = allIcons ? ICONS.map((i) => i.id) : suggestedIcons;
  const nameError = logo.name.trim() === "" ? "Indiquez le nom" : undefined;

  function set<K extends keyof LogoSpec>(key: K, value: LogoSpec[K]) {
    onChange({ ...logo, [key]: value });
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Personnalisez votre logo</h1>
      <StickyPreview spec={preview} />

      <Card className="flex flex-col gap-5">
        <Field label="Nom" maxLength={40} value={logo.name} error={nameError} onChange={(e) => set("name", e.target.value)} />
        <Field
          label="Slogan"
          maxLength={80}
          value={logo.slogan ?? ""}
          onChange={(e) => set("slogan", e.target.value === "" ? undefined : e.target.value)}
        />
        <SelectField
          label="Police"
          value={logo.font}
          options={HEADING_FONTS.map((f) => ({ value: f.family, label: f.family }))}
          onChange={(e) => set("font", e.target.value)}
        />
        <label className="flex min-h-11 items-center gap-3 text-sm font-medium">
          <input type="checkbox" className="size-5 accent-accent" checked={logo.uppercase} onChange={(e) => set("uppercase", e.target.checked)} />
          Nom en majuscules
        </label>
      </Card>

      <Card className="flex flex-col gap-5">
        <Segmented
          legend="Disposition"
          options={LOGO_LAYOUTS.map((l) => ({ value: l, label: LOGO_LAYOUT_LABELS[l] }))}
          value={logo.layout}
          onChange={(layout) =>
            onChange({ ...logo, layout, iconId: (layout === "icon-left" || layout === "icon-top") && !logo.iconId ? suggestedIcons[0] ?? ICONS[0]!.id : logo.iconId })
          }
        />
        {needsIcon && (
          <fieldset>
            <legend className="text-sm font-medium">Icône</legend>
            <div className="mt-3 grid grid-cols-6 gap-2 sm:grid-cols-8">
              {iconIds.map((id) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={logo.iconId === id}
                  aria-label={getIcon(id)?.label}
                  title={getIcon(id)?.label}
                  onClick={() => set("iconId", id)}
                  className={`grid aspect-square place-items-center rounded-xl border ${
                    logo.iconId === id ? "border-accent bg-accent-soft text-accent" : "border-border text-foreground hover:border-muted"
                  }`}
                >
                  <IconGlyph id={id} />
                </button>
              ))}
            </div>
            {!allIcons && (
              <button type="button" onClick={() => setAllIcons(true)} className="mt-3 text-sm font-medium text-accent underline-offset-4 hover:underline">
                Voir toutes les icônes ({ICONS.length})
              </button>
            )}
          </fieldset>
        )}
        {logo.layout !== "wordmark" && (
          <Segmented legend="Fond de l’icône" options={CONTAINERS} value={logo.iconContainer} onChange={(v) => set("iconContainer", v)} />
        )}
      </Card>

      <Card className="flex flex-col gap-5">
        {(
          [
            ["icon", logo.layout === "wordmark" ? "Trait d’accent" : "Icône"],
            ["text", "Nom"],
            ["slogan", "Slogan"],
          ] as const
        ).map(([element, label]) => (
          <fieldset key={element}>
            <legend className="text-sm font-medium">Couleur : {label}</legend>
            <div className="mt-2 flex gap-3">
              {LOGO_COLOR_ROLES.map((role) => (
                <button
                  key={role}
                  type="button"
                  aria-pressed={roles[element] === role}
                  aria-label={PALETTE_ROLE_LABELS[role]}
                  title={PALETTE_ROLE_LABELS[role]}
                  onClick={() => onRolesChange({ ...roles, [element]: role })}
                  className={`grid size-10 place-items-center rounded-full border border-border ring-offset-2 ring-offset-surface ${roles[element] === role ? "ring-2 ring-accent" : ""}`}
                  style={{ background: paletteColor(palette, role) }}
                >
                  {roles[element] === role && <Check className="size-4 text-white mix-blend-difference" aria-hidden />}
                </button>
              ))}
            </div>
          </fieldset>
        ))}
        <p className="text-xs text-muted">Les couleurs viennent de votre palette, que vous choisirez à l’étape suivante.</p>
      </Card>

      <StepNav onBack={onBack} onNext={onNext} disabled={Boolean(nameError)} />
    </div>
  );
}

// --- US-25 : palette ------------------------------------------------------

export function PaletteStep({
  palettes,
  activeIndex,
  selected,
  logo,
  loading,
  onSelect,
  onEdit,
  onMore,
  onBack,
  onNext,
}: {
  palettes: Palette[];
  /** Palette proposée d'origine (avant retouches). */
  activeIndex: number;
  selected: Palette;
  logo: LogoSpec;
  loading: boolean;
  onSelect: (index: number) => void;
  onEdit: (role: PaletteRole, hex: string) => void;
  onMore: () => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const warnings = checkPalette(selected);
  const background = paletteColor(selected, "background");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Votre palette</h1>
        <p className="mt-1 text-muted">Choisissez une palette, puis ajustez chaque couleur si vous le souhaitez.</p>
      </div>
      <StickyPreview spec={logo} background={background} />

      <div className="grid gap-3 sm:grid-cols-3">
        {palettes.map((p, i) => {
          const active = i === activeIndex;
          return (
            <button
              key={i}
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(i)}
              className={`rounded-2xl border p-3 text-left ${active ? "border-accent ring-1 ring-accent" : "border-border hover:border-muted"}`}
            >
              <span className="flex h-12 overflow-hidden rounded-lg">
                {p.colors.map((c) => (
                  <span key={c.role} className="flex-1" style={{ background: c.hex }} />
                ))}
              </span>
              <span className="mt-2 block text-sm font-medium">{p.harmony ? HARMONY_LABELS[p.harmony] : "Personnalisée"}</span>
            </button>
          );
        })}
      </div>
      <Button variant="secondary" className="self-center" onClick={onMore} loading={loading}>
        <RefreshCw className="size-4" aria-hidden /> Autres palettes
      </Button>

      <Card>
        <h2 className="font-semibold">Ajuster les couleurs</h2>
        <ul className="mt-4 flex flex-col gap-3">
          {PALETTE_ROLES.map((role) => {
            const hex = paletteColor(selected, role);
            return (
              <li key={role} className="flex items-center gap-3">
                <label className="relative size-11 shrink-0 overflow-hidden rounded-xl border border-border" style={{ background: hex }}>
                  <span className="sr-only">Modifier la couleur {PALETTE_ROLE_LABELS[role]}</span>
                  <input type="color" value={hex} onChange={(e) => onEdit(role, e.target.value)} className="absolute inset-0 size-full cursor-pointer opacity-0" />
                </label>
                <span className="flex-1 text-sm font-medium">{PALETTE_ROLE_LABELS[role]}</span>
                <code className="text-sm text-muted">{hex.toUpperCase()}</code>
              </li>
            );
          })}
        </ul>
        {/* RG-22 */}
        {warnings.length > 0 ? (
          <div className="mt-4 flex flex-col gap-2">
            {warnings.map((w) => (
              <Alert key={w.code}>
                <span className="flex gap-2">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {w.message}
                </span>
              </Alert>
            ))}
          </div>
        ) : (
          <p className="mt-4 flex items-center gap-2 text-sm text-success">
            <Check className="size-4" aria-hidden /> Contraste texte/fond : {contrastRatio(paletteColor(selected, "text"), background).toFixed(1).replace(".", ",")}:1, lisible.
          </p>
        )}
      </Card>

      <StepNav onBack={onBack} onNext={onNext} />
    </div>
  );
}

// --- US-26 : polices ------------------------------------------------------

export function FontsStep({
  logo,
  palette,
  typography,
  saving,
  error,
  onChange,
  onBack,
  onSave,
}: {
  logo: LogoSpec;
  palette: Palette;
  typography: { heading: string; body: string };
  saving: boolean;
  error: string | null;
  onChange: (typography: { heading: string; body: string }) => void;
  onBack: () => void;
  onSave: () => void;
}) {
  const heading = HEADING_FONTS.find((f) => f.family === typography.heading)!;
  const body = BODY_FONTS.find((f) => f.family === typography.body)!;
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Vos polices</h1>
        <p className="mt-1 text-muted">Une police pour les titres, une pour les textes de vos documents.</p>
      </div>

      <div className="rounded-2xl border border-border p-6" style={{ background: paletteColor(palette, "background"), color: paletteColor(palette, "text") }}>
        <p className="text-2xl" style={{ fontFamily: `'${heading.family}', ${heading.fallback}`, fontWeight: heading.weight, color: paletteColor(palette, "primary") }}>
          {logo.name}
        </p>
        <p className="mt-3 text-base leading-relaxed" style={{ fontFamily: `'${body.family}', ${body.fallback}` }}>
          {logo.slogan ? `${logo.slogan}. ` : ""}Voici à quoi ressembleront les textes de vos factures, devis et documents.
        </p>
      </div>

      <Card className="flex flex-col gap-5">
        <SelectField
          label="Police des titres"
          value={typography.heading}
          options={HEADING_FONTS.map((f) => ({ value: f.family, label: f.family }))}
          onChange={(e) => onChange({ ...typography, heading: e.target.value })}
        />
        <SelectField
          label="Police des textes"
          value={typography.body}
          options={BODY_FONTS.map((f) => ({ value: f.family, label: f.family }))}
          onChange={(e) => onChange({ ...typography, body: e.target.value })}
        />
        <p className="text-xs text-muted">Toutes les polices proposées sont libres pour un usage commercial.</p>
      </Card>

      {error && <Alert>{error}</Alert>}
      <StepNav onBack={onBack} onNext={onSave} nextLabel="Enregistrer ma marque" loading={saving} />
    </div>
  );
}

// --- Éléments communs -----------------------------------------------------

function StickyPreview({ spec, background = "#ffffff" }: { spec: LogoSpec; background?: string }) {
  return (
    <div className="sticky top-16 z-[5] rounded-2xl border border-border shadow-sm" style={{ background }}>
      <LogoPreview spec={spec} className="h-36 p-5" />
    </div>
  );
}

function Segmented<T extends string>({
  legend,
  options,
  value,
  onChange,
}: {
  legend: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-medium">{legend}</legend>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={value === o.value}
            onClick={() => onChange(o.value)}
            className={`min-h-11 rounded-xl border px-3 text-sm font-medium ${
              value === o.value ? "border-accent bg-accent-soft text-accent" : "border-border hover:border-muted"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function IconGlyph({ id }: { id: string }) {
  const icon = getIcon(id);
  if (!icon) return null;
  return (
    <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {icon.node.map(([tag, attrs], i) => {
        const Tag = tag as "path";
        return <Tag key={i} {...(attrs as Record<string, string>)} />;
      })}
    </svg>
  );
}

function StepNav({
  onBack,
  onNext,
  nextLabel = "Continuer",
  disabled,
  loading,
}: {
  onBack: () => void;
  onNext: () => void;
  nextLabel?: ReactNode;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <div className="flex gap-3">
      <Button variant="secondary" onClick={onBack}>
        Retour
      </Button>
      <Button className="flex-1" onClick={onNext} disabled={disabled} loading={loading}>
        {nextLabel}
      </Button>
    </div>
  );
}
