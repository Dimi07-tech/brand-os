"use client";

import type { CreateExportInput } from "@brand-os/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "./api";

interface ExportView {
  id: string;
  status: "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED" | "TIMED_OUT";
  failed: boolean;
  fileName: string | null;
  download: { url: string; expiresAt: string } | null;
}

export type ExportState =
  | { phase: "idle" }
  | { phase: "working" }
  | { phase: "done"; fileName: string }
  | { phase: "error"; message: string; code?: string };

const POLL_MS = 1000;
const MAX_WAIT_MS = 90_000;

/**
 * Lance un export (tâche de fond côté serveur), suit son avancement, puis
 * déclenche le téléchargement par le lien signé (valable 15 minutes).
 */
export function useExport(request: CreateExportInput) {
  // La demande est décrite par ses valeurs, pas par l'identité de l'objet.
  const requestKey = JSON.stringify(request);
  const [state, setState] = useState<ExportState>({ phase: "idle" });
  // Arrête le suivi si le composant est démonté. Remis à false à chaque montage :
  // en mode strict, React monte, démonte puis remonte le composant.
  const cancelled = useRef(false);
  useEffect(() => {
    cancelled.current = false;
    return () => {
      cancelled.current = true;
    };
  }, []);

  const start = useCallback(async () => {
    setState({ phase: "working" });
    try {
      let current = (await api<{ export: ExportView }>("/exports", { body: JSON.parse(requestKey) as CreateExportInput })).export;
      const deadline = Date.now() + MAX_WAIT_MS;
      while (!current.download && !current.failed) {
        if (cancelled.current) return;
        if (Date.now() > deadline) throw new Error("L’export prend plus de temps que prévu. Réessayez dans un instant.");
        await new Promise((r) => setTimeout(r, POLL_MS));
        current = (await api<{ export: ExportView }>(`/exports/${current.id}`)).export;
      }
      if (current.failed || !current.download) {
        throw new Error("L’export a échoué. Il n’a pas été décompté de votre quota : réessayez.");
      }
      triggerDownload(current.download.url, current.fileName ?? "");
      setState({ phase: "done", fileName: current.fileName ?? "" });
    } catch (err) {
      setState({
        phase: "error",
        message: err instanceof Error ? err.message : "Une erreur est survenue.",
        code: err instanceof ApiError ? err.code : undefined,
      });
    }
  }, [requestKey]);

  return { state, start };
}

/** Téléchargement sans quitter la page (le serveur répond en pièce jointe). */
function triggerDownload(url: string, fileName: string): void {
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export interface ExportQuota {
  plan: string;
  used: number;
  limit: number | null;
  warning: boolean;
  watermarked: boolean;
  vector: boolean;
  guidelines: boolean;
}
