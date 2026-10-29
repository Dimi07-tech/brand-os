"use client";

import { Check, CreditCard, FileText, IdCard, Image as ImageIcon, MailWarning, Palette, Receipt, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { PLAN_DEFINITIONS } from "@brand-os/shared";
import { BrandFonts, LogoPreview } from "@/components/logo-preview";
import { Alert, Button, Card } from "@/components/ui";
import { api } from "@/lib/api";
import type { Brand } from "@/lib/brand";
import { useOrganization, useSession } from "@/lib/session";

// Tableau de bord — §4.10
const ONBOARDING_STEPS = [
  { label: "Créer votre marque", href: "/ma-marque/creer", icon: Sparkles },
  { label: "Valider votre palette", href: "/ma-marque", icon: Palette },
  { label: "Créer votre carte de visite", href: "/creer/carte-de-visite", icon: IdCard },
  { label: "Créer votre première facture", href: "/documents/nouveau?type=INVOICE", icon: Receipt },
];

const QUICK_ACTIONS = [
  { label: "Nouvelle facture", href: "/documents/nouveau?type=INVOICE", icon: Receipt },
  { label: "Nouvelle carte", href: "/creer/carte-de-visite", icon: CreditCard },
  { label: "Nouveau visuel", href: "/creer", icon: ImageIcon },
];

export default function DashboardPage() {
  const { user } = useSession();
  const organization = useOrganization();
  const [brand, setBrand] = useState<Brand | null>(null);
  const [cards, setCards] = useState(0);
  const [invoices, setInvoices] = useState(0);
  useEffect(() => {
    api<{ brands: Brand[] }>("/brands").then(
      ({ brands }) => setBrand(brands[0] ?? null),
      () => setBrand(null),
    );
    api<{ designs: unknown[] }>("/designs").then(
      ({ designs }) => setCards(designs.length),
      () => setCards(0),
    );
    // Réservé aux rôles qui gèrent les factures : sinon 403, l'étape reste à faire.
    api<{ documents: { type: string; status: string }[] }>("/documents?type=INVOICE").then(
      ({ documents }) => setInvoices(documents.filter((d) => d.status !== "DRAFT").length),
      () => setInvoices(0),
    );
  }, []);
  // Étapes faites, dans l'ordre : marque, palette (enregistrées ensemble), carte, facture émise.
  const done = [Boolean(brand?.logo), Boolean(brand?.palette), cards > 0, invoices > 0];
  const completed = done.filter(Boolean).length;
  const free = PLAN_DEFINITIONS.FREE.quotas;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Bonjour {user.name.split(" ")[0]}</h1>
        <p className="mt-1 text-muted">{organization.name}</p>
      </div>

      {!user.emailVerified && <VerifyEmailBanner email={user.email} />}

      {brand?.logo && (
        <Link href="/ma-marque" className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-4 transition-colors hover:border-accent">
          <BrandFonts />
          <span className="w-32 shrink-0 rounded-lg bg-white">
            <LogoPreview spec={brand.logo} className="h-16 p-2" />
          </span>
          <span className="min-w-0">
            <span className="block text-xs text-muted">Marque active</span>
            <span className="block truncate font-semibold">{brand.name}</span>
          </span>
        </Link>
      )}

      <Card>
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="font-semibold">Premiers pas</h2>
          <span className="text-sm text-muted">
            {completed} sur {ONBOARDING_STEPS.length}
          </span>
        </div>
        <div
          className="mt-3 h-2 overflow-hidden rounded-full bg-background"
          role="progressbar"
          aria-valuenow={completed}
          aria-valuemin={0}
          aria-valuemax={ONBOARDING_STEPS.length}
          aria-label="Progression des premiers pas"
        >
          <div className="h-full rounded-full bg-accent" style={{ width: `${(completed / ONBOARDING_STEPS.length) * 100}%` }} />
        </div>
        <ol className="mt-4 flex flex-col">
          {ONBOARDING_STEPS.map(({ label, href, icon: Icon }, i) => (
            <li key={label}>
              <Link href={href} className="flex min-h-12 items-center gap-3 rounded-xl px-2 hover:bg-background">
                <span className="grid size-8 shrink-0 place-items-center rounded-full border border-border text-sm text-muted">
                  {done[i] ? <Check className="size-4 text-success" aria-label="Fait" /> : i + 1}
                </span>
                <Icon className="size-4 text-muted" aria-hidden />
                <span className="text-sm font-medium">{label}</span>
              </Link>
            </li>
          ))}
        </ol>
      </Card>

      <section aria-labelledby="actions">
        <h2 id="actions" className="font-semibold">
          Actions rapides
        </h2>
        <div className="mt-3 grid grid-cols-3 gap-3">
          {QUICK_ACTIONS.map(({ label, href, icon: Icon }) => (
            <Link
              key={label}
              href={href}
              className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-surface p-4 text-center text-sm font-medium transition-colors hover:border-accent"
            >
              <Icon className="size-6 text-accent" aria-hidden />
              {label}
            </Link>
          ))}
        </div>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <h2 className="font-semibold">Documents récents</h2>
          <div className="mt-4 flex flex-col items-center gap-2 py-6 text-center text-sm text-muted">
            <FileText className="size-8" aria-hidden />
            Vos factures, devis et visuels apparaîtront ici.
          </div>
        </Card>
        <Card>
          <div className="flex items-baseline justify-between">
            <h2 className="font-semibold">Votre offre</h2>
            <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent">Gratuit</span>
          </div>
          <ul className="mt-4 flex flex-col gap-2 text-sm text-muted">
            <li>{free.aiGenerationsPerMonth} générations IA par mois</li>
            <li>{free.hdExportsPerMonth} exports haute définition (avec filigrane)</li>
            <li>{free.businessDocumentsPerMonth} factures ou devis par mois</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}

// US-02 : l'adresse doit être vérifiée avant d'exporter.
function VerifyEmailBanner({ email }: { email: string }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | { error: string }>("idle");

  async function resend() {
    setState("sending");
    try {
      await api("/auth/resend-verification", { method: "POST" });
      setState("sent");
    } catch (err) {
      setState({ error: (err as Error).message });
    }
  }

  return (
    <Alert tone="info">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-start gap-2">
          <MailWarning className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
          <span>
            Confirmez votre adresse <strong>{email}</strong> pour pouvoir exporter vos créations.
            {state === "sent" && " Un nouveau lien vient de vous être envoyé."}
            {typeof state === "object" && ` ${state.error}`}
          </span>
        </p>
        {state !== "sent" && (
          <Button variant="secondary" className="shrink-0" loading={state === "sending"} onClick={() => void resend()}>
            Renvoyer le lien
          </Button>
        )}
      </div>
    </Alert>
  );
}
