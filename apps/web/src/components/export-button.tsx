"use client";

import type { CreateExportInput } from "@brand-os/shared";
import { Check, Download } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Alert, Button } from "@/components/ui";
import { useExport } from "@/lib/use-export";

/** Bouton d'export avec suivi de la tâche de fond et messages d'erreur utiles (§5.4). */
export function ExportButton({
  request,
  children,
  variant = "primary",
}: {
  request: CreateExportInput;
  children: ReactNode;
  variant?: "primary" | "secondary";
}) {
  const { state, start } = useExport(request);

  return (
    <div className="flex flex-col gap-3">
      <Button variant={variant} loading={state.phase === "working"} onClick={() => void start()} className="self-start">
        {state.phase === "done" ? <Check className="size-4" aria-hidden /> : <Download className="size-4" aria-hidden />}
        {state.phase === "working" ? "Préparation…" : children}
      </Button>
      <div aria-live="polite">
        {state.phase === "working" && (
          <p className="text-sm text-muted">Nous préparons vos fichiers. Le téléchargement démarre automatiquement.</p>
        )}
        {state.phase === "done" && <p className="text-sm text-success">Téléchargement lancé : {state.fileName}</p>}
        {state.phase === "error" && (
          <Alert tone={state.code === "PLAN_REQUIRED" || state.code === "QUOTA_EXCEEDED" ? "info" : "danger"}>
            {state.message}{" "}
            {state.code === "EMAIL_NOT_VERIFIED" && (
              <Link href="/tableau-de-bord" className="font-semibold underline">
                Renvoyer le lien de confirmation
              </Link>
            )}
            {(state.code === "PLAN_REQUIRED" || state.code === "QUOTA_EXCEEDED") && (
              <Link href="/#tarifs" className="font-semibold underline">
                Voir les offres
              </Link>
            )}
          </Alert>
        )}
      </div>
    </div>
  );
}
