"use client";

import { toColorValue, type BrandBrief, type LogoSpec, type Palette, type PaletteRole } from "@brand-os/shared";
import { PartyPopper } from "lucide-react";
import { useState } from "react";
import { LogoPreview } from "@/components/logo-preview";
import { ButtonLink, Card, Spinner } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { Brand, Generation } from "@/lib/brand";
import { Questionnaire, type BriefDraft } from "./questionnaire";
import { CustomizeStep, FontsStep, PaletteStep, ProposalsStep, rolesOf, withPalette, type ColorRoles } from "./steps";

// Parcours principal §5.1, étapes 4 à 8 : questionnaire → 6 logos → personnalisation
// → palette → polices → Brand Kit créé.

type Phase = "brief" | "generating" | "proposals" | "customize" | "palette" | "fonts" | "done";

const EMPTY_DRAFT: BriefDraft = {
  name: "",
  slogan: "",
  sector: "",
  audience: [],
  values: [],
  style: "",
  preferredColors: [],
  avoidedColors: [],
};

export function Studio({ existing, organizationName, organizationSector }: { existing: Brand | null; organizationName: string; organizationSector: string }) {
  const [brand, setBrand] = useState<Brand | null>(existing);
  const [phase, setPhase] = useState<Phase>("brief");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [generation, setGeneration] = useState<Generation | null>(null);
  const [palettes, setPalettes] = useState<Palette[]>([]);
  const [paletteAttempt, setPaletteAttempt] = useState(0);
  const [paletteIndex, setPaletteIndex] = useState(0);
  const [palette, setPalette] = useState<Palette | null>(null);
  const [logo, setLogo] = useState<LogoSpec | null>(null);
  const [roles, setRoles] = useState<ColorRoles>({ icon: "primary", text: "text", slogan: "secondary" });
  const [typography, setTypography] = useState({ heading: "", body: "Inter" });

  const initialDraft: BriefDraft = existing?.brief
    ? { ...EMPTY_DRAFT, ...existing.brief, slogan: existing.brief.slogan ?? "" }
    : { ...EMPTY_DRAFT, name: organizationName, sector: organizationSector as BriefDraft["sector"] };

  async function run<T>(task: () => Promise<T>): Promise<T | undefined> {
    setBusy(true);
    setError(null);
    try {
      return await task();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : "Une erreur est survenue.");
      return undefined;
    } finally {
      setBusy(false);
    }
  }

  async function generate(brandId: string, attempt: number) {
    const result = await run(() => api<Generation>(`/brands/${brandId}/generate`, { body: { attempt } }));
    if (result) {
      setGeneration(result);
      setPalettes(result.palettes);
      setPaletteAttempt(0);
    }
    return result;
  }

  async function submitBrief(brief: BrandBrief) {
    const saved = await run(async () =>
      brand
        ? (await api<{ brand: Brand }>(`/brands/${brand.id}/brief`, { method: "PUT", body: brief })).brand
        : (await api<{ brand: Brand }>("/brands", { body: brief })).brand,
    );
    if (!saved) return;
    setBrand(saved);
    setPhase("generating");
    const result = await generate(saved.id, 0);
    setPhase(result ? "proposals" : "brief");
  }

  function selectProposal(index: number) {
    if (!generation) return;
    const proposal = generation.proposals[index]!;
    const sourceIndex = index % generation.palettes.length;
    const source = generation.palettes[sourceIndex]!;
    setLogo(proposal);
    setPaletteIndex(sourceIndex);
    setPalette(source);
    setRoles(rolesOf(proposal, source));
    setTypography((t) => ({ ...t, heading: proposal.font }));
    setPhase("customize");
    window.scrollTo({ top: 0 });
  }

  async function morePalettes() {
    if (!brand) return;
    const next = paletteAttempt + 1;
    const result = await run(() => api<{ palettes: Palette[] }>(`/brands/${brand.id}/palettes/generate`, { body: { attempt: next } }));
    if (result) {
      setPalettes(result.palettes);
      setPaletteAttempt(next);
      setPaletteIndex(0);
      setPalette(result.palettes[0]!);
    }
  }

  function editColor(role: PaletteRole, hex: string) {
    setPalette((p) => p && { ...p, colors: p.colors.map((c) => (c.role === role ? { ...c, ...toColorValue(hex), role } : c)) });
  }

  async function save() {
    if (!brand || !logo || !palette) return;
    const saved = await run(
      async () =>
        (
          await api<{ brand: Brand }>(`/brands/${brand.id}/identity`, {
            method: "PUT",
            body: {
              logo: withPalette({ ...logo, name: logo.name.trim() }, palette, roles),
              palette: { harmony: palette.harmony, colors: palette.colors.map(({ role, hex }) => ({ role, hex })) },
              typography,
            },
          })
        ).brand,
    );
    if (saved) {
      setBrand(saved);
      setPhase("done");
      window.scrollTo({ top: 0 });
    }
  }

  const go = (next: Phase) => () => {
    setError(null);
    setPhase(next);
    window.scrollTo({ top: 0 });
  };

  switch (phase) {
    case "brief":
      return <Questionnaire initial={initialDraft} submitting={busy} error={error} onSubmit={(b) => void submitBrief(b)} />;

    case "generating":
      return <Generating />;

    case "proposals":
      return (
        <ProposalsStep
          generation={generation!}
          loading={busy}
          error={error}
          onMore={() => void generate(brand!.id, generation!.attempt + 1)}
          onSelect={selectProposal}
        />
      );

    case "customize":
      return (
        <CustomizeStep
          logo={logo!}
          palette={palette!}
          roles={roles}
          suggestedIcons={[...new Set(generation!.creative.directions.flatMap((d) => d.iconIds))]}
          onChange={setLogo}
          onRolesChange={setRoles}
          onBack={go("proposals")}
          onNext={go("palette")}
        />
      );

    case "palette":
      return (
        <PaletteStep
          palettes={palettes}
          activeIndex={paletteIndex}
          selected={palette!}
          logo={withPalette(logo!, palette!, roles)}
          loading={busy}
          onSelect={(i) => {
            setPaletteIndex(i);
            setPalette(palettes[i]!);
          }}
          onEdit={editColor}
          onMore={() => void morePalettes()}
          onBack={go("customize")}
          onNext={go("fonts")}
        />
      );

    case "fonts":
      return (
        <FontsStep
          logo={logo!}
          palette={palette!}
          typography={typography}
          saving={busy}
          error={error}
          onChange={setTypography}
          onBack={go("palette")}
          onSave={() => void save()}
        />
      );

    case "done":
      return <Done brand={brand!} />;
  }
}

/** Attente maximale annoncée : 30 secondes (§5.1, étape 5). */
function Generating() {
  return (
    <div className="flex min-h-[50dvh] flex-col items-center justify-center gap-4 text-center" role="status">
      <Spinner />
      <p className="text-lg font-semibold">Création de vos logos…</p>
      <p className="max-w-xs text-sm text-muted">Nous composons 6 propositions à partir de vos réponses. Cela prend quelques secondes.</p>
      <div className="h-1.5 w-48 overflow-hidden rounded-full bg-border">
        <div className="h-full w-1/3 animate-[progress_1.2s_ease-in-out_infinite] rounded-full bg-accent" />
      </div>
    </div>
  );
}

/** Écran de félicitations qui résume la marque (§5.1, étape 8). */
function Done({ brand }: { brand: Brand }) {
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-accent-soft text-accent">
        <PartyPopper className="size-7" aria-hidden />
      </span>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Votre marque est prête !</h1>
        <p className="mt-2 text-muted">Logo, couleurs et polices sont enregistrés dans votre Brand Kit.</p>
      </div>
      <Card className="w-full">
        <div className="rounded-xl bg-white">{brand.logo && <LogoPreview spec={brand.logo} className="h-40 p-6" />}</div>
        <div className="mt-4 flex h-10 overflow-hidden rounded-lg">
          {brand.palette?.colors.map((c) => <span key={c.role} className="flex-1" style={{ background: c.hex }} />)}
        </div>
        <p className="mt-3 text-sm text-muted">
          {brand.typography?.heading} · {brand.typography?.body}
        </p>
      </Card>
      <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
        <ButtonLink href="/ma-marque">Voir mon Brand Kit</ButtonLink>
        <ButtonLink href="/tableau-de-bord" variant="secondary">
          Retour au tableau de bord
        </ButtonLink>
      </div>
    </div>
  );
}
