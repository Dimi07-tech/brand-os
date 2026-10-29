"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import type { DocumentDetail } from "@/lib/documents";
import { DocumentEditor } from "../document-editor";
import { IssuedView } from "../issued-view";

/** Nouveau brouillon : créé à la première saisie valide (enregistrement automatique). */
export function NewDocument() {
  const type = useSearchParams().get("type") === "QUOTE" ? "QUOTE" : "INVOICE";
  const [issued, setIssued] = useState<DocumentDetail | null>(null);
  if (issued) return <IssuedView document={issued} justIssued />;
  return <DocumentEditor initial={null} type={type} onIssued={setIssued} />;
}
