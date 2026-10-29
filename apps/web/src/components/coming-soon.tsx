import type { LucideIcon } from "lucide-react";
import { ButtonLink, Card } from "@/components/ui";

/** Écran provisoire d'un module pas encore développé. */
export function ComingSoon({ title, description, icon: Icon }: { title: string; description: string; icon: LucideIcon }) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <Card className="flex flex-col items-center gap-3 py-12 text-center">
        <span className="grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent">
          <Icon className="size-6" aria-hidden />
        </span>
        <p className="max-w-sm text-muted">{description}</p>
        <p className="text-sm font-medium">Bientôt disponible</p>
        <ButtonLink href="/tableau-de-bord" variant="secondary" className="mt-2">
          Retour au tableau de bord
        </ButtonLink>
      </Card>
    </div>
  );
}
