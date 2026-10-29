"use client";

import { ArrowRight, ImageUp, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { createOrganizationSchema } from "@brand-os/shared";
import { Alert, Button, Field, SelectField, Wordmark } from "@/components/ui";
import { api, type Organization } from "@/lib/api";
import { SECTOR_OPTIONS } from "@/lib/labels";
import { useSession } from "@/lib/session";
import { useForm } from "@/lib/use-form";

// Parcours principal §5.1 étape 3, puis choix du parcours (§5.1 / §5.2)
export default function WelcomePage() {
  const { user, organization } = useSession();

  return (
    <div className="flex min-h-dvh flex-col px-4 py-6">
      <Wordmark />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
        <p className="text-sm font-medium text-accent">Étape {organization ? 2 : 1} sur 2</p>
        {organization ? <ChoosePath name={organization.name} /> : <CreateOrganization firstName={user.name.split(" ")[0]!} />}
      </main>
    </div>
  );
}

function CreateOrganization({ firstName }: { firstName: string }) {
  const { setOrganization } = useSession();
  const form = useForm(
    createOrganizationSchema,
    { name: "", sector: "" as never, city: "" },
    async (data) => {
      const { organization } = await api<{ organization: Organization }>("/organizations", { body: data });
      setOrganization(organization);
    },
  );

  return (
    <>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Bienvenue, {firstName} !</h1>
      <p className="mt-2 text-muted">Parlez-nous de votre entreprise. Vous pourrez tout modifier plus tard.</p>
      <form onSubmit={form.handleSubmit} noValidate className="mt-8 flex flex-col gap-5">
        {form.formError && <Alert>{form.formError}</Alert>}
        <Field label="Nom de l’entreprise" placeholder="Ex. Chez Aïcha" autoComplete="organization" {...form.field("name")} />
        <SelectField label="Secteur d’activité" placeholder="Choisissez un secteur" options={SECTOR_OPTIONS} {...form.field("sector")} />
        <Field label="Ville" placeholder="Ex. Cotonou" autoComplete="address-level2" {...form.field("city")} />
        <Button type="submit" loading={form.submitting}>
          Continuer <ArrowRight className="size-4" aria-hidden />
        </Button>
      </form>
    </>
  );
}

function ChoosePath({ name }: { name: string }) {
  const router = useRouter();
  useEffect(() => router.prefetch("/tableau-de-bord"), [router]);

  return (
    <>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Où en est {name} ?</h1>
      <p className="mt-2 text-muted">Choisissez votre point de départ.</p>
      <div className="mt-8 flex flex-col gap-3">
        <PathCard
          href="/ma-marque/creer"
          icon={<Sparkles className="size-5" aria-hidden />}
          title="Créer ma marque"
          description="Répondez à quelques questions, l’IA vous propose des logos, des couleurs et des polices."
        />
        <PathCard
          href="/ma-marque"
          icon={<ImageUp className="size-5" aria-hidden />}
          title="J’ai déjà un logo"
          description="Importez-le : nous en extrayons les couleurs pour créer votre Brand Kit."
        />
      </div>
      <Link href="/tableau-de-bord" className="mt-6 text-center text-sm font-medium text-muted underline-offset-4 hover:underline">
        Plus tard, aller au tableau de bord
      </Link>
    </>
  );
}

function PathCard({ href, icon, title, description }: { href: string; icon: React.ReactNode; title: string; description: string }) {
  return (
    <Link
      href={href}
      className="flex items-start gap-4 rounded-2xl border border-border bg-surface p-5 transition-colors hover:border-accent focus-visible:outline-2 focus-visible:outline-accent"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">{icon}</span>
      <span>
        <span className="block font-semibold">{title}</span>
        <span className="mt-1 block text-sm text-muted">{description}</span>
      </span>
    </Link>
  );
}
