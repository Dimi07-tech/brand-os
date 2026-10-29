"use client";

import { CreditCard, Image as ImageIcon, Mail, Megaphone, Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CardPreview } from "@/components/card-preview";
import { BrandFonts } from "@/components/logo-preview";
import { Alert, ButtonLink, Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import type { Brand } from "@/lib/brand";
import { cardInput, fetchActiveBrand, type DesignView } from "@/lib/designs";

const SOON = [
  { icon: ImageIcon, title: "Publications réseaux sociaux", text: "Carré, portrait, stories" },
  { icon: Megaphone, title: "Affiches", text: "A4 et A3" },
  { icon: Mail, title: "Signature e-mail", text: "Gmail et Outlook" },
];

// Créer — supports aux couleurs de la marque (§4.6 à §4.9)
export default function CreatePage() {
  const [state, setState] = useState<{ brand: Brand | null; designs: DesignView[] } | { error: string } | null>(null);

  useEffect(() => {
    Promise.all([fetchActiveBrand(), api<{ designs: DesignView[] }>("/designs")]).then(
      ([brand, { designs }]) => setState({ brand, designs }),
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
  const { brand, designs } = state;

  return (
    <div className="flex flex-col gap-8">
      <BrandFonts />
      <div>
        <h1 className="text-2xl font-semibold">Créer</h1>
        <p className="mt-1 text-muted">Des supports préremplis aux couleurs de votre marque.</p>
      </div>

      {!brand?.logo && (
        <Alert tone="info">
          Créez d’abord votre marque : vos supports utiliseront automatiquement son logo, ses couleurs et ses polices.{" "}
          <Link href="/ma-marque/creer" className="font-semibold underline">
            Créer ma marque
          </Link>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          href="/creer/carte-de-visite"
          aria-disabled={!brand?.logo}
          className={`group flex flex-col gap-3 rounded-2xl border bg-surface p-5 transition-all ${
            brand?.logo ? "border-accent/40 hover:-translate-y-0.5 hover:border-accent hover:shadow-lg" : "pointer-events-none border-border opacity-60"
          }`}
        >
          <span className="grid size-11 place-items-center rounded-xl bg-accent text-white">
            <CreditCard className="size-5" aria-hidden />
          </span>
          <span>
            <span className="block font-semibold">Carte de visite</span>
            <span className="block text-sm text-muted">20 modèles, recto verso, QR code</span>
          </span>
        </Link>
        {SOON.map(({ icon: Icon, title, text }) => (
          <div key={title} className="flex flex-col gap-3 rounded-2xl border border-dashed border-border p-5 opacity-70">
            <span className="grid size-11 place-items-center rounded-xl bg-background text-muted">
              <Icon className="size-5" aria-hidden />
            </span>
            <span>
              <span className="block font-semibold">{title}</span>
              <span className="block text-sm text-muted">{text} · bientôt</span>
            </span>
          </div>
        ))}
      </div>

      {brand?.logo && (
        <section aria-labelledby="mes-cartes">
          <div className="flex items-center justify-between">
            <h2 id="mes-cartes" className="font-semibold">
              Mes cartes de visite
            </h2>
            {designs.length > 0 && (
              <ButtonLink href="/creer/carte-de-visite" variant="secondary" className="min-h-9 px-3">
                <Plus className="size-4" aria-hidden /> Nouvelle
              </ButtonLink>
            )}
          </div>
          {designs.length === 0 ? (
            <p className="mt-3 text-sm text-muted">Aucune carte pour l’instant.</p>
          ) : (
            <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {designs.map((d) => {
                const input = cardInput(brand, d.composition);
                return (
                  <li key={d.id}>
                    <Link href={`/creer/carte-de-visite/${d.id}`} className="group block">
                      {input && <CardPreview input={input} side="front" className="rounded-xl shadow-md transition-transform group-hover:-translate-y-0.5" />}
                      <p className="mt-2 truncate text-sm font-medium">{d.name}</p>
                      <p className="text-xs text-muted">Modifiée le {new Date(d.updatedAt).toLocaleDateString("fr-FR")}</p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
