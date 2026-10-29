import type { Currency, DocumentLine } from "@brand-os/shared";

export type DocumentType = "INVOICE" | "QUOTE" | "CREDIT_NOTE";
export type DocumentStatus = "DRAFT" | "ISSUED" | "PAID" | "PARTIALLY_PAID" | "CANCELLED" | "ACCEPTED" | "REJECTED";

export interface DocumentSummary {
  id: string;
  type: DocumentType;
  status: DocumentStatus;
  number: string | null;
  currency: Currency;
  subtotalMinor: number;
  vatMinor: number;
  totalMinor: number;
  issuedAt: string | null;
  dueAt: string | null;
  correctsId: string | null;
  updatedAt: string;
  clientName?: string | null;
}

export interface Party {
  name: string;
  address?: string | null;
  city?: string | null;
  phone?: string | null;
  email?: string | null;
  ifu?: string | null;
  rccm?: string | null;
  vatEnabled?: boolean;
}

export interface DocumentDetail extends DocumentSummary {
  clientId: string | null;
  lines: DocumentLine[];
  discountMinor: number;
  paymentTerms: string | null;
  notes: string | null;
  client: Party | null;
  issuer: Party | null;
}

export interface Client {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  ifu: string | null;
}

export interface Product {
  id: string;
  name: string;
  description: string | null;
  unit: string | null;
  unitPriceMinor: number;
  vatRateBps: number;
}

export const TYPE_LABELS: Record<DocumentType, string> = { INVOICE: "Facture", QUOTE: "Devis", CREDIT_NOTE: "Avoir" };

export const STATUS_LABELS: Record<DocumentStatus, { label: string; className: string }> = {
  DRAFT: { label: "Brouillon", className: "bg-background text-muted ring-1 ring-border" },
  ISSUED: { label: "Émis", className: "bg-success-soft text-success" },
  PAID: { label: "Payée", className: "bg-success-soft text-success" },
  PARTIALLY_PAID: { label: "Payée en partie", className: "bg-accent-soft text-accent" },
  CANCELLED: { label: "Annulée", className: "bg-danger-soft text-danger" },
  ACCEPTED: { label: "Accepté", className: "bg-success-soft text-success" },
  REJECTED: { label: "Refusé", className: "bg-danger-soft text-danger" },
};

/** Pourcentage saisi (« 12,5 ») → points de base, ou null si invalide. */
export function parsePercent(input: string): number | null {
  const normalized = input.replace(/\s|%/g, "").replace(",", ".");
  if (normalized === "") return 0;
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const bps = Math.round(Number(normalized) * 100);
  return bps <= 10_000 ? bps : null;
}

export function formatDate(iso: string | null): string {
  return iso ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(iso)) : "—";
}
