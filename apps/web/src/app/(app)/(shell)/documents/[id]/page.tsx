"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Alert, Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import type { DocumentDetail } from "@/lib/documents";
import { DocumentEditor } from "../document-editor";
import { IssuedView } from "../issued-view";

export default function DocumentPage() {
  const { id } = useParams<{ id: string }>();
  const [document, setDocument] = useState<DocumentDetail | null>(null);
  const [justIssued, setJustIssued] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ document: DocumentDetail }>(`/documents/${id}`).then(
      (r) => setDocument(r.document),
      (err: Error) => setError(err.message),
    );
  }, [id]);

  if (error) return <Alert>{error}</Alert>;
  if (!document) {
    return (
      <div className="grid min-h-[40dvh] place-items-center text-muted" role="status" aria-label="Chargement">
        <Spinner />
      </div>
    );
  }
  if (document.status !== "DRAFT") return <IssuedView key={document.id} document={document} justIssued={justIssued} />;
  return (
    <DocumentEditor
      key={document.id}
      initial={document}
      type={document.type === "QUOTE" ? "QUOTE" : "INVOICE"}
      onIssued={(issued) => {
        setJustIssued(true);
        setDocument(issued);
      }}
    />
  );
}
