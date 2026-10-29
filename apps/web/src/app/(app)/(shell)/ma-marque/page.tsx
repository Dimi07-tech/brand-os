"use client";

import {
  can,
  getFont,
  LOGO_VARIANT_LABELS,
  LOGO_VARIANTS,
  PALETTE_ROLE_LABELS,
  type PaletteColor,
  type Role,
} from "@brand-os/shared";
import { BookOpen, Check, ChevronRight, Copy, ImageUp, Pencil, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ExportButton } from "@/components/export-button";
import { BrandFonts, LogoPreview } from "@/components/logo-preview";
import { Alert, ButtonLink, Card, Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import type { Brand } from "@/lib/brand";
import type { ExportQuota } from "@/lib/use-export";
import { useOrganization } from "@/lib/session";

// Brand Kit — §4.4 (US-30, US-32), variantes US-24
export default function BrandKitPage() {
  const organization = useOrganization();
  const [state, setState] = useState<{ brand: Brand | null } | { error: string } | null>(null);

  useEffect(() => {
    api<{ brands: Brand[] }>("/brands").then(
      ({ brands }) => setState({ brand: brands[0] ?? null }),
      (err: Error) => setState({ error: err.message }),
    );
  }, []);

  if (state === null) {
    return (
      <div className="grid min-h-[40dvh] place-items-center text-muted" role="status" aria-label="Chargement">
        <Spinner />
      </div>
    );
  }
  if ("error" in state) return <Alert>{state.error}</Alert>;

  const brand = state.brand;
  const canEdit = can(organization.role as Role, "brand.edit");
  if (!brand?.logo) return <StartBrand canEdit={canEdit} />;

  return (
    <div className="flex flex-col gap-6">
      <BrandFonts />
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{brand.name}</h1>
          <p className="mt-1 text-sm text-muted">Brand Kit · version {brand.version}</p>
        </div>
        {canEdit && (
          <ButtonLink href="/ma-marque/creer" variant="secondary">
            <Pencil className="size-4" aria-hidden /> Modifier
          </ButtonLink>
        )}
      </div>

      <Card>
        <h2 className="font-semibold">Logo</h2>
        <div className="mt-4 rounded-xl border border-border bg-white">
          <LogoPreview spec={brand.logo} className="h-48 p-8" />
        </div>
        <h3 className="mt-6 text-sm font-semibold">Variantes</h3>
        <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {LOGO_VARIANTS.filter((v) => v !== "color").map((variant) => (
            <li key={variant} className="flex flex-col gap-2">
              <div
                className="rounded-xl border border-border bg-white"
                style={variant === "light" ? { background: brand.palette?.colors.find((c) => c.role === "primary")?.hex ?? "#c2410c" } : undefined}
              >
                <LogoPreview spec={brand.logo!} variant={variant} className="h-24 p-3" />
              </div>
              <span className="text-xs text-muted">{LOGO_VARIANT_LABELS[variant]}</span>
            </li>
          ))}
        </ul>
      </Card>

      <DownloadCard brandId={brand.id} />

      <Link
        href="/ma-marque/charte"
        className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-5 transition-colors hover:border-accent"
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
          <BookOpen className="size-5" aria-hidden />
        </span>
        <span className="flex-1">
          <span className="block font-semibold">Charte graphique</span>
          <span className="block text-sm text-muted">Relisez les textes, prévisualisez et exportez en PDF.</span>
        </span>
        <ChevronRight className="size-5 text-muted" aria-hidden />
      </Link>

      {brand.palette && (
        <Card>
          <h2 className="font-semibold">Couleurs</h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {brand.palette.colors.map((color) => (
              <ColorSwatch key={color.role} color={color} />
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted">Valeurs CMJN indicatives : faites valider vos couleurs par votre imprimeur.</p>
        </Card>
      )}

      {brand.typography && (
        <Card>
          <h2 className="font-semibold">Polices</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <FontSample label="Titres" family={brand.typography.heading} sample={brand.name} large />
            <FontSample label="Textes" family={brand.typography.body} sample="Facture n° FAC-2026-0001, payable sous 30 jours." />
          </div>
        </Card>
      )}
    </div>
  );
}

// US-31 : pack ZIP de tous les logos, selon les droits de l'offre (§6.2)
function DownloadCard({ brandId }: { brandId: string }) {
  const [quota, setQuota] = useState<ExportQuota | null>(null);
  useEffect(() => {
    api<{ quota: ExportQuota }>("/exports/quota").then(
      (res) => setQuota(res.quota),
      () => setQuota(null),
    );
  }, []);

  return (
    <Card>
      <h2 className="font-semibold">Télécharger mes logos</h2>
      <p className="mt-1 text-sm text-muted">
        Toutes les versions de votre logo dans un fichier ZIP
        {quota?.vector ? " : SVG vectoriels pour l’impression et PNG transparents pour le web." : " : images PNG transparentes."}
      </p>
      {quota?.watermarked && (
        <p className="mt-2 text-sm text-muted">
          Offre Gratuite : les images portent un filigrane. Passez à Starter pour des fichiers sans filigrane et en SVG.
        </p>
      )}
      <div className="mt-4">
        <ExportButton request={{ type: "LOGO_PACK", brandId }}>
          Télécharger le pack (ZIP)
        </ExportButton>
      </div>
      {quota?.limit != null && (
        <p className={`mt-3 text-xs ${quota.warning ? "text-accent" : "text-muted"}`}>
          {quota.used} / {quota.limit} exports utilisés ce mois-ci
        </p>
      )}
    </Card>
  );
}

function StartBrand({ canEdit }: { canEdit: boolean }) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Ma marque</h1>
      {canEdit ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            href="/ma-marque/creer"
            className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-6 transition-colors hover:border-accent"
          >
            <span className="grid size-11 place-items-center rounded-xl bg-accent-soft text-accent">
              <Sparkles className="size-5" aria-hidden />
            </span>
            <span className="font-semibold">Créer ma marque</span>
            <span className="text-sm text-muted">6 questions, puis 6 propositions de logos, de couleurs et de polices.</span>
          </Link>
          <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-border p-6 opacity-70">
            <span className="grid size-11 place-items-center rounded-xl bg-background text-muted">
              <ImageUp className="size-5" aria-hidden />
            </span>
            <span className="font-semibold">J’ai déjà un logo</span>
            <span className="text-sm text-muted">Import de votre logo existant : bientôt disponible.</span>
          </div>
        </div>
      ) : (
        <Alert tone="info">La marque de votre entreprise n’a pas encore été créée.</Alert>
      )}
    </div>
  );
}

// US-32 : copier un code couleur en un clic
function ColorSwatch({ color }: { color: PaletteColor }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(color.hex.toUpperCase());
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Presse-papiers indisponible (contexte non sécurisé) : le code reste affiché.
    }
  }

  return (
    <li className="flex items-center gap-3 rounded-xl border border-border p-3">
      <span className="size-12 shrink-0 rounded-lg border border-border" style={{ background: color.hex }} />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-medium">{PALETTE_ROLE_LABELS[color.role]}</p>
        <p className="text-xs text-muted">
          RGB {color.rgb.join(", ")} · CMJN {color.cmyk.join(", ")}
        </p>
      </div>
      <button
        type="button"
        onClick={() => void copy()}
        className="flex min-h-11 items-center gap-1.5 rounded-lg px-2 font-mono text-sm hover:bg-background"
        aria-label={`Copier ${color.hex.toUpperCase()}`}
      >
        {color.hex.toUpperCase()}
        {copied ? <Check className="size-4 text-success" aria-hidden /> : <Copy className="size-4 text-muted" aria-hidden />}
      </button>
      <span className="sr-only" aria-live="polite">
        {copied ? "Code copié" : ""}
      </span>
    </li>
  );
}

function FontSample({ label, family, sample, large }: { label: string; family: string; sample: string; large?: boolean }) {
  const font = getFont(family);
  return (
    <div className="rounded-xl border border-border p-4">
      <p className="text-xs text-muted">
        {label} · {family}
      </p>
      <p
        className={large ? "mt-2 text-2xl" : "mt-2 text-base"}
        style={{ fontFamily: `'${family}', ${font?.fallback ?? "sans-serif"}`, fontWeight: large ? font?.weight : 400 }}
      >
        {sample}
      </p>
    </div>
  );
}
