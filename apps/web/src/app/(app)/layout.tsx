import { Suspense, type ReactNode } from "react";
import { Spinner } from "@/components/ui";
import { SessionProvider } from "@/lib/session";

// L'espace connecté dépend de la session et de l'URL, connues seulement dans le
// navigateur : la frontière Suspense permet le pré-rendu des routes dynamiques.
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-dvh place-items-center text-muted" role="status" aria-label="Chargement">
          <Spinner />
        </div>
      }
    >
      <SessionProvider>{children}</SessionProvider>
    </Suspense>
  );
}
