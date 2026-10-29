"use client";

import { formatMoney } from "@brand-os/shared";
import { Copy, FileX2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { A4Preview } from "@/components/a4-preview";
import { ExportButton } from "@/components/export-button";
import { Alert, Button, Card, Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import { formatDate, STATUS_LABELS, TYPE_LABELS, type DocumentDetail } from "@/lib/documents";
import { Dialog } from "./document-editor";

/** Document émis : figé (RG-63). Téléchargement PDF, duplication, avoir. */
export function IssuedView({ document, justIssued }: { document: DocumentDetail; justIssued?: boolean }) {
  const router = useRouter();
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmCredit, setConfirmCredit] = useState(false);

  useEffect(() => {
    api<{ html: string }>(`/documents/${document.id}/preview`).then(
      (r) => setHtml(r.html),
      (err: Error) => setError(err.message),
    );
  }, [document.id]);

  async function action(path: string) {
    setBusy(true);
    setError(null);
    try {
      const { document: created } = await api<{ document: DocumentDetail }>(`/documents/${document.id}/${path}`, { method: "POST" });
      router.push(`/documents/${created.id}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  const status = STATUS_LABELS[document.status];
  const total = document.type === "CREDIT_NOTE" ? -document.totalMinor : document.totalMinor;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/documents" className="text-sm text-muted hover:text-foreground">
          ← Documents
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">
            {TYPE_LABELS[document.type]} {document.number}
          </h1>
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${status.className}`}>{status.label}</span>
        </div>
        <p className="mt-1 text-sm text-muted">
          {document.client?.name} · émis le {formatDate(document.issuedAt)} · {formatMoney(total, document.currency)} TTC
        </p>
      </div>

      {justIssued && <Alert tone="success">Document émis. Son numéro est définitif et son contenu ne peut plus être modifié.</Alert>}
      {document.status === "CANCELLED" && <Alert tone="info">Cette facture a été annulée par une facture d’avoir. Dupliquez-la pour en émettre une version corrigée.</Alert>}
      {error && <Alert>{error}</Alert>}

      <div className="grid gap-6 lg:grid-cols-[1fr_18rem] lg:items-start">
        {html ? (
          <A4Preview html={html} title={`${TYPE_LABELS[document.type]} ${document.number}`} />
        ) : (
          <div className="grid min-h-[40dvh] place-items-center text-muted" role="status" aria-label="Chargement">
            <Spinner />
          </div>
        )}

        <div className="flex flex-col gap-4 lg:sticky lg:top-24">
          <Card>
            <h2 className="font-semibold">Télécharger</h2>
            <p className="mt-1 text-sm text-muted">PDF A4, à envoyer à votre client ou à imprimer.</p>
            <div className="mt-4">
              <ExportButton request={{ type: "BUSINESS_DOCUMENT_PDF", documentId: document.id }}>PDF</ExportButton>
            </div>
          </Card>
          <Button variant="secondary" onClick={() => void action("duplicate")} loading={busy && !confirmCredit}>
            <Copy className="size-4" aria-hidden /> Dupliquer en brouillon
          </Button>
          {document.type === "INVOICE" && document.status === "ISSUED" && (
            <Button variant="ghost" className="text-danger" onClick={() => setConfirmCredit(true)}>
              <FileX2 className="size-4" aria-hidden /> Annuler par un avoir
            </Button>
          )}
          {document.type === "CREDIT_NOTE" && document.correctsId && (
            <Link href={`/documents/${document.correctsId}`} className="text-center text-sm font-medium text-accent hover:underline">
              Voir la facture annulée
            </Link>
          )}
        </div>
      </div>

      {confirmCredit && (
        <Dialog title="Annuler cette facture ?" onClose={() => setConfirmCredit(false)} narrow>
          <div className="flex flex-col gap-4 text-sm">
            <p>
              Une <strong>facture d’avoir</strong> du même montant ({formatMoney(document.totalMinor, document.currency)}) sera émise avec son propre numéro, et la facture{" "}
              {document.number} sera marquée comme annulée. Cette opération est définitive.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setConfirmCredit(false)}>
                Retour
              </Button>
              <Button variant="danger" onClick={() => void action("credit-note")} loading={busy}>
                Émettre l’avoir
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
