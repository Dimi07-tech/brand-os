"use client";

import { BUSINESS_CARD_TEMPLATES, type BusinessCardComposition, type CardTone } from "@brand-os/shared";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CardPreview } from "@/components/card-preview";
import { BrandFonts } from "@/components/logo-preview";
import { Alert, Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import type { Brand } from "@/lib/brand";
import { cardInput, fetchActiveBrand, type DesignView } from "@/lib/designs";
import { useOrganization, useSession } from "@/lib/session";

// US-50 : 20 modèles préremplis avec la marque et les coordonnées de l'entreprise.
export default function CardTemplatesPage() {
  const router = useRouter();
  const { user } = useSession();
  const organization = useOrganization();
  const [brand, setBrand] = useState<Brand | null | undefined>(undefined);
  const [tone, setTone] = useState<CardTone | "all">("all");
  const [creating, setCreating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchActiveBrand().then(setBrand, (err: Error) => setError(err.message));
  }, []);

  const preset: Pick<BusinessCardComposition, "fields" | "qr"> = {
    fields: {
      fullName: user.name,
      phone: organization.phone ?? undefined,
      email: organization.email ?? user.email,
      website: organization.website ?? undefined,
      address: [organization.address, organization.city].filter(Boolean).join(", ") || undefined,
    },
    qr: organization.phone ? "whatsapp" : organization.website ? "website" : "none",
  };

  async function choose(templateId: string) {
    if (!brand) return;
    setCreating(templateId);
    setError(null);
    try {
      const { design } = await api<{ design: DesignView }>("/designs", {
        body: { brandId: brand.id, composition: { schemaVersion: 1, kind: "BUSINESS_CARD", templateId, ...preset } },
      });
      router.push(`/creer/carte-de-visite/${design.id}`);
    } catch (err) {
      setError((err as Error).message);
      setCreating(null);
    }
  }

  if (brand === undefined && !error) {
    return (
      <div className="grid min-h-[40dvh] place-items-center text-muted" role="status" aria-label="Chargement">
        <Spinner />
      </div>
    );
  }

  const templates = BUSINESS_CARD_TEMPLATES.filter((t) => tone === "all" || t.tone === tone);

  return (
    <div className="flex flex-col gap-6">
      <BrandFonts />
      <div>
        <Link href="/creer" className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden /> Créer
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Choisissez un modèle</h1>
        <p className="mt-1 text-muted">Tous sont déjà à vos couleurs. Vous modifierez les textes à l’étape suivante.</p>
      </div>

      {error && <Alert>{error}</Alert>}
      {brand && !brand.logo && (
        <Alert tone="info">
          Créez d’abord votre marque.{" "}
          <Link href="/ma-marque/creer" className="font-semibold underline">
            Brand Studio
          </Link>
        </Alert>
      )}

      <div role="radiogroup" aria-label="Style" className="flex gap-2">
        {(
          [
            ["all", "Tous"],
            ["clair", "Clairs"],
            ["couleur", "Couleur"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            role="radio"
            aria-checked={tone === value}
            onClick={() => setTone(value)}
            className={`min-h-10 rounded-full px-4 text-sm font-medium ring-1 ${tone === value ? "bg-accent text-white ring-accent" : "bg-surface ring-border hover:ring-muted"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {brand?.logo && (
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => {
            const input = cardInput(brand, { templateId: template.id, ...preset })!;
            return (
              <li key={template.id}>
                <button
                  type="button"
                  disabled={creating !== null}
                  onClick={() => void choose(template.id)}
                  className="group relative block w-full text-left disabled:opacity-60"
                  aria-label={`Choisir le modèle ${template.name}`}
                >
                  <div className="relative">
                    <CardPreview input={input} side="back" className="absolute inset-0 translate-x-3 translate-y-3 rounded-xl opacity-90 shadow-md transition-transform duration-300 group-hover:translate-x-5 group-hover:translate-y-4" />
                    <CardPreview input={input} side="front" className="relative rounded-xl shadow-lg ring-1 ring-black/5 transition-transform duration-300 group-hover:-translate-y-1" />
                    {creating === template.id && (
                      <div className="absolute inset-0 grid place-items-center rounded-xl bg-white/70">
                        <Spinner />
                      </div>
                    )}
                  </div>
                  <p className="mt-6 text-sm font-medium">{template.name}</p>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
