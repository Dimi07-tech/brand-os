"use client";

import { can, formatMoney, type Role } from "@brand-os/shared";
import { FileText, Package, Plus, Search, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Alert, ButtonLink, Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import { formatDate, STATUS_LABELS, TYPE_LABELS, type DocumentSummary, type DocumentType } from "@/lib/documents";
import { useOrganization } from "@/lib/session";

const TABS: { value: DocumentType | "ALL"; label: string }[] = [
  { value: "ALL", label: "Tous" },
  { value: "INVOICE", label: "Factures" },
  { value: "QUOTE", label: "Devis" },
  { value: "CREDIT_NOTE", label: "Avoirs" },
];

// Documents — §4.8, liste des factures et devis (§5.3 : statuts, recherche)
export default function DocumentsPage() {
  const organization = useOrganization();
  const allowed = can(organization.role as Role, "document.create");
  const [documents, setDocuments] = useState<DocumentSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<DocumentType | "ALL">("ALL");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!allowed) return;
    api<{ documents: DocumentSummary[] }>("/documents").then(
      (res) => setDocuments(res.documents),
      (err: Error) => setError(err.message),
    );
  }, [allowed]);

  if (!allowed) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">Documents</h1>
        <Alert tone="info">Les factures et devis sont réservés au propriétaire, aux administrateurs et aux comptables.</Alert>
      </div>
    );
  }

  const term = search.trim().toLowerCase();
  const visible = (documents ?? []).filter(
    (d) =>
      (tab === "ALL" || d.type === tab) &&
      (!term || d.number?.toLowerCase().includes(term) || d.clientName?.toLowerCase().includes(term)),
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Documents</h1>
          <p className="mt-1 text-muted">Vos factures et devis, à vos couleurs.</p>
        </div>
        <div className="flex gap-2">
          <ButtonLink href="/documents/nouveau?type=QUOTE" variant="secondary">
            <Plus className="size-4" aria-hidden /> Devis
          </ButtonLink>
          <ButtonLink href="/documents/nouveau?type=INVOICE">
            <Plus className="size-4" aria-hidden /> Facture
          </ButtonLink>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-sm">
        <Link href="/documents/clients" className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3.5 py-2 font-medium ring-1 ring-border hover:ring-accent">
          <Users className="size-4" aria-hidden /> Clients
        </Link>
        <Link href="/documents/produits" className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3.5 py-2 font-medium ring-1 ring-border hover:ring-accent">
          <Package className="size-4" aria-hidden /> Produits et services
        </Link>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div role="tablist" className="flex gap-1 rounded-full bg-surface p-1 ring-1 ring-border">
          {TABS.map((t) => (
            <button
              key={t.value}
              role="tab"
              aria-selected={tab === t.value}
              onClick={() => setTab(t.value)}
              className={`min-h-9 rounded-full px-4 text-sm font-medium ${tab === t.value ? "bg-accent text-white" : "text-muted"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <label className="relative sm:w-72">
          <span className="sr-only">Rechercher</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Numéro ou client"
            className="min-h-11 w-full rounded-xl border border-border bg-surface pl-9 pr-3 text-sm focus:outline-2 focus:outline-accent"
          />
        </label>
      </div>

      {error && <Alert>{error}</Alert>}
      {documents === null && !error ? (
        <div className="grid min-h-[30dvh] place-items-center text-muted" role="status" aria-label="Chargement">
          <Spinner />
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-14 text-center text-muted">
          <FileText className="size-8" aria-hidden />
          <p>{documents?.length ? "Aucun document ne correspond." : "Aucun document pour l’instant. Créez votre première facture."}</p>
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl bg-surface ring-1 ring-border">
          {visible.map((d) => (
            <li key={d.id}>
              <Link href={`/documents/${d.id}`} className="flex items-center gap-4 px-4 py-3.5 hover:bg-background sm:px-5">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-xs font-bold text-accent">
                  {TYPE_LABELS[d.type].slice(0, 3).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{d.number ?? `${TYPE_LABELS[d.type]} (brouillon)`}</span>
                  <span className="block truncate text-sm text-muted">
                    {d.clientName ?? "Client à préciser"} · {formatDate(d.issuedAt ?? d.updatedAt)}
                  </span>
                </span>
                <span className="hidden text-right sm:block">
                  <span className="block font-semibold tabular-nums">{formatMoney(d.type === "CREDIT_NOTE" ? -d.totalMinor : d.totalMinor, d.currency)}</span>
                  <span className="block text-xs text-muted">TTC</span>
                </span>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_LABELS[d.status].className}`}>{STATUS_LABELS[d.status].label}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
