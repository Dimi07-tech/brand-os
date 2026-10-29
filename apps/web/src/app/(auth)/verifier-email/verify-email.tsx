"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Alert, ButtonLink, Spinner } from "@/components/ui";
import { api } from "@/lib/api";

// US-02
export function VerifyEmail() {
  const token = useSearchParams().get("token");
  const [state, setState] = useState<"pending" | "done" | { error: string }>("pending");
  // Le lien est à usage unique : en mode strict, React exécute l'effet deux fois.
  const started = useRef(false);

  useEffect(() => {
    if (started.current || !token) return;
    started.current = true;
    api("/auth/verify-email", { body: { token } })
      .then(() => setState("done"))
      .catch((err: Error) => setState({ error: err.message }));
  }, [token]);

  if (!token) return <InvalidLink error="Ce lien est incomplet. Ouvrez le lien reçu par e-mail." />;

  if (state === "pending") {
    return (
      <div role="status" className="flex items-center gap-3 text-muted">
        <Spinner /> Vérification en cours…
      </div>
    );
  }

  if (state === "done") {
    return (
      <>
        <h1 className="text-2xl font-semibold tracking-tight">Adresse confirmée</h1>
        <p className="mt-2 text-muted">Merci ! Vous pouvez maintenant exporter vos créations.</p>
        <ButtonLink href="/tableau-de-bord" className="mt-8">
          Continuer
        </ButtonLink>
      </>
    );
  }

  return <InvalidLink error={state.error} />;
}

function InvalidLink({ error }: { error: string }) {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Lien non valide</h1>
      <div className="mt-6">
        <Alert>{error}</Alert>
      </div>
      <p className="mt-4 text-sm text-muted">
        Depuis votre tableau de bord, vous pouvez demander un nouveau lien de confirmation.
      </p>
      <ButtonLink href="/tableau-de-bord" variant="secondary" className="mt-8">
        Aller au tableau de bord
      </ButtonLink>
    </>
  );
}
