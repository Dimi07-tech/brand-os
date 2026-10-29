"use client";

import {
  amountInWords,
  clientInputSchema,
  computeTotals,
  DEFAULT_VAT_BPS,
  documentLineSchema,
  formatMoney,
  formatQuantity,
  formatRate,
  parseMoney,
  parseQuantity,
  type Currency,
  type DocumentKind,
  type DocumentLine,
} from "@brand-os/shared";
import { AlertTriangle, Check, Eye, Loader2, Plus, Send, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useState } from "react";
import { A4Preview } from "@/components/a4-preview";
import { Alert, Button, Card, Field, Spinner, TextAreaField } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { parsePercent, TYPE_LABELS, type Client, type DocumentDetail, type Product } from "@/lib/documents";
import { useOrganization } from "@/lib/session";

// Éditeur de facture ou devis (brouillon) — US-60 à US-62. Totaux en direct avec
// le même calcul que le serveur (RG-60, RG-61) ; enregistrement automatique.

interface LineDraft {
  key: number;
  /** Champs déjà quittés par l'utilisateur : leurs erreurs s'affichent. */
  touched: string[];
  label: string;
  description: string;
  unit: string;
  quantity: string;
  unitPrice: string;
  discount: string;
  vatRateBps: number;
}

let nextKey = 1;
const emptyLine = (): LineDraft => ({ key: nextKey++, touched: [], label: "", description: "", unit: "", quantity: "1", unitPrice: "", discount: "", vatRateBps: DEFAULT_VAT_BPS });

function toDraft(line: DocumentLine, currency: Currency): LineDraft {
  const decimals = currency === "XOF" ? 0 : 2;
  return {
    key: nextKey++,
    touched: [],
    label: line.label,
    description: line.description ?? "",
    unit: line.unit ?? "",
    quantity: formatQuantity(line.quantityMilli).replace(/\s/g, ""),
    unitPrice: (line.unitPriceMinor / 10 ** decimals).toFixed(decimals).replace(".", ","),
    discount: line.discountBps ? String(line.discountBps / 100).replace(".", ",") : "",
    vatRateBps: line.vatRateBps,
  };
}

/** Ligne saisie → ligne valide, ou message d'erreur par champ. */
function parseLine(d: LineDraft, currency: Currency): { line?: DocumentLine; errors: Partial<Record<keyof LineDraft, string>> } {
  const errors: Partial<Record<keyof LineDraft, string>> = {};
  const quantityMilli = parseQuantity(d.quantity);
  const unitPriceMinor = parseMoney(d.unitPrice, currency);
  const discountBps = parsePercent(d.discount);
  if (!d.label.trim()) errors.label = "Désignation requise";
  if (quantityMilli === null || quantityMilli === 0) errors.quantity = "Quantité invalide";
  if (unitPriceMinor === null) errors.unitPrice = currency === "XOF" ? "Montant entier en FCFA" : "Montant invalide";
  if (discountBps === null) errors.discount = "Entre 0 et 100 %";
  if (Object.keys(errors).length) return { errors };
  const parsed = documentLineSchema.safeParse({
    label: d.label,
    description: d.description,
    unit: d.unit,
    quantityMilli,
    unitPriceMinor,
    discountBps,
    vatRateBps: d.vatRateBps,
  });
  if (!parsed.success) return { errors: { label: parsed.error.issues[0]?.message } };
  return { line: parsed.data, errors };
}

type SaveState = "saved" | "dirty" | "saving" | "error" | "invalid";

export function DocumentEditor({
  initial,
  type,
  onIssued,
}: {
  initial: DocumentDetail | null;
  type: DocumentKind;
  onIssued: (document: DocumentDetail) => void;
}) {
  const router = useRouter();
  const organization = useOrganization();
  const currency = (initial?.currency ?? organization.currency) as Currency;
  const vatEnabled = organization.vatEnabled;

  const [id, setId] = useState<string | null>(initial?.id ?? null);
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [clientId, setClientId] = useState<string>(initial?.clientId ?? "");
  const [lines, setLines] = useState<LineDraft[]>(() => (initial?.lines.length ? initial.lines.map((l) => toDraft(l, currency)) : [emptyLine()]));
  const [dueDate, setDueDate] = useState(initial?.dueAt?.slice(0, 10) ?? "");
  const [paymentTerms, setPaymentTerms] = useState(initial?.paymentTerms ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newClient, setNewClient] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [issuing, setIssuing] = useState(false);
  // Après une tentative d'aperçu ou d'émission, toutes les erreurs s'affichent.
  const [showAllErrors, setShowAllErrors] = useState(false);

  useEffect(() => {
    api<{ clients: Client[] }>("/clients").then((r) => setClients(r.clients), () => undefined);
    api<{ products: Product[] }>("/products").then((r) => setProducts(r.products), () => undefined);
  }, []);

  const parsed = lines.map((l) => parseLine(l, currency));
  const validLines = parsed.flatMap((p) => (p.line ? [p.line] : []));
  const allValid = validLines.length === lines.length && lines.length > 0;
  const totals = computeTotals(validLines, { vatEnabled });

  const payload = allValid
    ? {
        clientId: clientId || null,
        lines: validLines,
        dueDate: dueDate || null,
        paymentTerms: paymentTerms.trim() || undefined,
        notes: notes.trim() || undefined,
      }
    : null;
  const serialized = payload ? JSON.stringify(payload) : null;
  // Dernier contenu enregistré ; l'état affiché en découle (aucun état dupliqué).
  const [savedSerialized, setSavedSerialized] = useState<string | null>(() => (initial ? serialized : null));
  const saveState: SaveState = !serialized
    ? "invalid"
    : saving
      ? "saving"
      : saveFailed
        ? "error"
        : serialized === savedSerialized
          ? "saved"
          : "dirty";

  async function save(body: string): Promise<string | null> {
    setSaving(true);
    setSaveFailed(false);
    setError(null);
    try {
      const data = JSON.parse(body) as object;
      const { document } = id
        ? await api<{ document: DocumentDetail }>(`/documents/${id}`, { method: "PUT", body: data })
        : await api<{ document: DocumentDetail }>("/documents", { body: { ...data, type } });
      if (!id) {
        setId(document.id);
        setPaymentTerms(document.paymentTerms ?? "");
        window.history.replaceState(null, "", `/documents/${document.id}`);
      }
      setSavedSerialized(body);
      return document.id;
    } catch (err) {
      setError((err as Error).message);
      setSaveFailed(true);
      return null;
    } finally {
      setSaving(false);
    }
  }

  const autoSave = useEffectEvent((body: string) => void save(body));
  useEffect(() => {
    if (!serialized || serialized === savedSerialized) return;
    const timer = setTimeout(() => autoSave(serialized), 1200);
    return () => clearTimeout(timer);
  }, [serialized, savedSerialized]);

  // Aucune modification perdue sans avertissement (RG-40).
  useEffect(() => {
    if (saveState === "saved") return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [saveState]);

  function updateLine(key: number, patch: Partial<LineDraft>) {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function addProduct(productId: string) {
    const p = products.find((x) => x.id === productId);
    if (!p) return;
    const line = toDraft({ label: p.name, description: p.description ?? undefined, unit: p.unit ?? undefined, quantityMilli: 1000, unitPriceMinor: p.unitPriceMinor, discountBps: 0, vatRateBps: p.vatRateBps }, currency);
    setLines((ls) => (ls.length === 1 && !ls[0]!.label && !ls[0]!.unitPrice ? [line] : [...ls, line]));
  }

  async function ensureSaved(): Promise<string | null> {
    if (!serialized) return null;
    if (id && serialized === savedSerialized) return id;
    return save(serialized);
  }

  async function openPreview() {
    setShowAllErrors(true);
    const docId = await ensureSaved();
    if (!docId) return;
    try {
      setPreview((await api<{ html: string }>(`/documents/${docId}/preview`)).html);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function issue() {
    setIssuing(true);
    setError(null);
    try {
      const docId = await ensureSaved();
      if (!docId) throw new Error("Corrigez les lignes avant d’émettre le document.");
      const { document } = await api<{ document: DocumentDetail }>(`/documents/${docId}/issue`, { method: "POST" });
      onIssued(document);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : (err as Error).message);
      setConfirming(false);
    } finally {
      setIssuing(false);
    }
  }

  async function removeDraft() {
    if (!window.confirm("Supprimer ce brouillon ?")) return;
    if (id) await api(`/documents/${id}`, { method: "DELETE" });
    setSavedSerialized(serialized);
    router.replace("/documents");
  }

  const label = TYPE_LABELS[type];
  const missingLegal = !organization.ifu || !organization.rccm;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/documents" className="text-sm text-muted hover:text-foreground">
            ← Documents
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">
            {label} <span className="text-base font-normal text-muted">· brouillon</span>
          </h1>
        </div>
        <SaveIndicator state={saveState} />
      </div>

      {error && <Alert>{error}</Alert>}

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem] lg:items-start">
        <div className="flex flex-col gap-6">
          {/* Client */}
          <Card>
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold">{type === "QUOTE" ? "Destinataire" : "Client"}</h2>
              {!newClient && (
                <button type="button" onClick={() => setNewClient(true)} className="text-sm font-semibold text-accent hover:underline">
                  + Nouveau client
                </button>
              )}
            </div>
            {newClient ? (
              <NewClientForm
                onCancel={() => setNewClient(false)}
                onCreated={(c) => {
                  setClients((cs) => [...cs, c].sort((a, b) => a.name.localeCompare(b.name)));
                  setClientId(c.id);
                  setNewClient(false);
                }}
              />
            ) : (
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                aria-label="Client"
                className="mt-3 min-h-11 w-full rounded-xl border border-border bg-surface px-3.5 text-base"
              >
                <option value="">Choisir un client…</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </Card>

          {/* Lignes */}
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-semibold">Lignes</h2>
              {products.length > 0 && (
                <select
                  value=""
                  onChange={(e) => addProduct(e.target.value)}
                  aria-label="Ajouter un produit enregistré"
                  className="min-h-10 rounded-xl border border-border bg-surface px-3 text-sm"
                >
                  <option value="">+ Produit enregistré…</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {formatMoney(p.unitPriceMinor, currency)}
                    </option>
                  ))}
                </select>
              )}
            </div>
            {!vatEnabled && <p className="mt-2 text-sm text-muted">TVA non applicable : votre entreprise est déclarée non assujettie (Paramètres).</p>}

            <ol className="mt-4 flex flex-col gap-4">
              {lines.map((l, i) => {
                const allErrors = parsed[i]!.errors;
                const shown = (key: keyof LineDraft) => (showAllErrors || l.touched.includes(key) ? allErrors[key] : undefined);
                const blur = (key: keyof LineDraft) => () => !l.touched.includes(key) && updateLine(l.key, { touched: [...l.touched, key] });
                const net = totals.lines[validLines.indexOf(parsed[i]!.line!)]?.netMinor;
                return (
                  <li key={l.key} className="rounded-xl border border-border p-4">
                    <div className="flex items-start gap-3">
                      <span className="mt-2.5 text-xs font-semibold text-muted">{i + 1}</span>
                      <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-6">
                        <Field label="Désignation" value={l.label} error={shown("label")} onBlur={blur("label")} onChange={(e) => updateLine(l.key, { label: e.target.value })} className="col-span-2 sm:col-span-6" />
                        <Field label="Qté" inputMode="decimal" value={l.quantity} error={shown("quantity")} onBlur={blur("quantity")} onChange={(e) => updateLine(l.key, { quantity: e.target.value })} />
                        <Field label="Unité" placeholder="pièce" value={l.unit} onChange={(e) => updateLine(l.key, { unit: e.target.value })} />
                        <Field
                          label={`Prix unit. HT (${currency === "XOF" ? "FCFA" : currency})`}
                          inputMode="decimal"
                          value={l.unitPrice}
                          error={shown("unitPrice")}
                          onBlur={blur("unitPrice")}
                          onChange={(e) => updateLine(l.key, { unitPrice: e.target.value })}
                          className="col-span-2"
                        />
                        <Field label="Remise %" inputMode="decimal" placeholder="0" value={l.discount} error={shown("discount")} onBlur={blur("discount")} onChange={(e) => updateLine(l.key, { discount: e.target.value })} />
                        {vatEnabled ? (
                          <div className="flex flex-col gap-1.5">
                            <label htmlFor={`vat-${l.key}`} className="text-sm font-medium">
                              TVA
                            </label>
                            <select
                              id={`vat-${l.key}`}
                              value={l.vatRateBps}
                              onChange={(e) => updateLine(l.key, { vatRateBps: Number(e.target.value) })}
                              className="min-h-11 rounded-xl border border-border bg-surface px-2.5"
                            >
                              <option value={1800}>18 %</option>
                              <option value={0}>0 % (exonéré)</option>
                            </select>
                          </div>
                        ) : (
                          <div />
                        )}
                        <Field label="Détail (facultatif)" value={l.description} onChange={(e) => updateLine(l.key, { description: e.target.value })} className="col-span-2 sm:col-span-4" />
                        <div className="col-span-2 flex items-end justify-end">
                          <p className="text-right">
                            <span className="block text-xs text-muted">Total HT</span>
                            <span className="font-semibold tabular-nums">{net !== undefined ? formatMoney(net, currency) : "—"}</span>
                          </p>
                        </div>
                      </div>
                      {lines.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}
                          aria-label={`Supprimer la ligne ${i + 1}`}
                          className="grid size-9 shrink-0 place-items-center rounded-lg text-muted hover:bg-danger-soft hover:text-danger"
                        >
                          <X className="size-4" />
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
            <Button variant="secondary" className="mt-4" onClick={() => setLines((ls) => [...ls, emptyLine()])}>
              <Plus className="size-4" aria-hidden /> Ajouter une ligne
            </Button>
          </Card>

          <Card className="grid gap-4 sm:grid-cols-2">
            <Field label={type === "QUOTE" ? "Valable jusqu’au" : "Date d’échéance"} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            <div />
            <TextAreaField label="Conditions" rows={2} maxLength={300} value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} className="sm:col-span-2" />
            <TextAreaField label="Notes (facultatif)" rows={2} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} className="sm:col-span-2" />
          </Card>
        </div>

        {/* Totaux et actions */}
        <div className="flex flex-col gap-4 lg:sticky lg:top-24">
          <Card>
            <dl className="flex flex-col gap-2 text-sm">
              {totals.discountMinor > 0 && <Row label="Remises" value={`-${formatMoney(totals.discountMinor, currency)}`} />}
              <Row label="Total HT" value={formatMoney(totals.subtotalMinor, currency)} />
              {vatEnabled ? totals.vatGroups.map((g) => <Row key={g.rateBps} label={`TVA ${formatRate(g.rateBps)}`} value={formatMoney(g.vatMinor, currency)} />) : <Row label="TVA" value="Non applicable" />}
            </dl>
            <div className="mt-3 flex items-baseline justify-between rounded-xl bg-accent px-4 py-3 text-white">
              <span className="font-semibold">Total TTC</span>
              <span className="font-display text-xl font-bold tabular-nums">{formatMoney(totals.totalMinor, currency)}</span>
            </div>
            <p className="mt-3 text-xs text-muted first-letter:uppercase">{amountInWords(totals.totalMinor, currency)}</p>
          </Card>

          <Button variant="secondary" onClick={() => void openPreview()} disabled={!allValid}>
            <Eye className="size-4" aria-hidden /> Aperçu
          </Button>
          <Button
            onClick={() => {
              setShowAllErrors(true);
              setConfirming(true);
            }}
            disabled={!allValid || !clientId}
          >
            <Send className="size-4" aria-hidden /> Émettre {type === "QUOTE" ? "le devis" : "la facture"}
          </Button>
          {!clientId && <p className="text-center text-xs text-muted">Choisissez un client pour émettre.</p>}
          <Button variant="ghost" className="text-danger" onClick={() => void removeDraft()}>
            <Trash2 className="size-4" aria-hidden /> Supprimer le brouillon
          </Button>
        </div>
      </div>

      {preview && (
        <Dialog title="Aperçu" onClose={() => setPreview(null)}>
          <A4Preview html={preview} title={`Aperçu ${label.toLowerCase()}`} />
        </Dialog>
      )}

      {confirming && (
        <Dialog title={`Émettre ${type === "QUOTE" ? "le devis" : "la facture"} ?`} onClose={() => setConfirming(false)} narrow>
          <div className="flex flex-col gap-4 text-sm">
            <p>
              Un numéro définitif lui sera attribué et elle <strong>ne pourra plus être modifiée</strong>.
              {type === "INVOICE" && " Pour la corriger ensuite, il faudra émettre une facture d’avoir."}
            </p>
            {missingLegal && (
              <Alert tone="info">
                <span className="flex gap-2">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <span>
                    Votre RCCM ou votre IFU n’est pas renseigné : il n’apparaîtra pas sur le document.{" "}
                    <Link href="/parametres" className="font-semibold underline">
                      Compléter
                    </Link>
                  </span>
                </span>
              </Alert>
            )}
            {/* RG-65 */}
            <p className="rounded-xl bg-background p-3 text-xs text-muted">
              Brand OS assure la mise en forme de vos documents. Si votre entreprise est assujettie à la TVA, l’émission de factures normalisées via le dispositif e-MECeF de la DGI reste à votre charge.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setConfirming(false)}>
                Annuler
              </Button>
              <Button onClick={() => void issue()} loading={issuing}>
                Émettre
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}

function NewClientForm({ onCreated, onCancel }: { onCreated: (c: Client) => void; onCancel: () => void }) {
  const [values, setValues] = useState({ name: "", phone: "", email: "", address: "", ifu: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  async function submit() {
    const parsed = clientInputSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setSaving(true);
    try {
      onCreated((await api<{ client: Client }>("/clients", { body: parsed.data })).client);
    } catch (err) {
      setErrors({ name: (err as Error).message });
    } finally {
      setSaving(false);
    }
  }

  const field = (key: keyof typeof values) => ({
    value: values[key],
    error: errors[key],
    onChange: (e: { target: { value: string } }) => setValues((v) => ({ ...v, [key]: e.target.value })),
  });

  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <Field label="Nom ou raison sociale" {...field("name")} className="sm:col-span-2" />
      <Field label="Téléphone" type="tel" {...field("phone")} />
      <Field label="E-mail" type="email" {...field("email")} />
      <Field label="Adresse" {...field("address")} />
      <Field label="IFU (facultatif)" inputMode="numeric" {...field("ifu")} />
      <div className="flex gap-2 sm:col-span-2">
        <Button onClick={() => void submit()} loading={saving}>
          Enregistrer le client
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Annuler
        </Button>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}

export function Dialog({ title, onClose, children, narrow }: { title: string; onClose: () => void; children: React.ReactNode; narrow?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div
        className={`animate-fade-up max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-background p-5 sm:rounded-3xl sm:p-6 ${narrow ? "max-w-md" : "max-w-3xl"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Fermer" className="grid size-9 place-items-center rounded-full hover:bg-surface">
            <X className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  const content = {
    saved: { icon: <Check className="size-4 text-success" aria-hidden />, text: "Enregistré" },
    dirty: { icon: <Loader2 className="size-4 text-muted" aria-hidden />, text: "Modifications…" },
    saving: { icon: <Spinner />, text: "Enregistrement…" },
    error: { icon: <AlertTriangle className="size-4 text-danger" aria-hidden />, text: "Non enregistré" },
    invalid: { icon: <AlertTriangle className="size-4 text-accent" aria-hidden />, text: "À compléter" },
  }[state];
  return (
    <span className="mt-8 inline-flex items-center gap-1.5 text-sm text-muted" aria-live="polite">
      {content.icon}
      {content.text}
    </span>
  );
}
