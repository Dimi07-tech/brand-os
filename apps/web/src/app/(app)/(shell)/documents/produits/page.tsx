"use client";

import { formatMoney, formatRate, parseMoney, productInputSchema, type Currency } from "@brand-os/shared";
import { Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Alert, Button, Card, Field, Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import type { Product } from "@/lib/documents";
import { useOrganization } from "@/lib/session";

const EMPTY = { name: "", description: "", unit: "", price: "", vatRateBps: 1800 };

// US-62 : produits et services réutilisables dans les factures et devis.
export default function ProductsPage() {
  const organization = useOrganization();
  const currency = organization.currency as Currency;
  const [products, setProducts] = useState<Product[] | null>(null);
  const [editing, setEditing] = useState<{ id: string | null; values: typeof EMPTY } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () =>
    api<{ products: Product[] }>("/products").then(
      (r) => setProducts(r.products),
      (err: Error) => setError(err.message),
    );
  useEffect(() => {
    api<{ products: Product[] }>("/products").then(
      (r) => setProducts(r.products),
      (err: Error) => setError(err.message),
    );
  }, []);

  async function save() {
    if (!editing) return;
    const price = parseMoney(editing.values.price, currency);
    const parsed = productInputSchema.safeParse({ ...editing.values, unitPriceMinor: price ?? -1 });
    if (!parsed.success || price === null) {
      const next = Object.fromEntries((parsed.error?.issues ?? []).map((i) => [String(i.path[0]), i.message]));
      if (price === null) next.price = currency === "XOF" ? "Montant entier en FCFA" : "Montant invalide";
      setErrors(next);
      return;
    }
    setSaving(true);
    try {
      if (editing.id) await api(`/products/${editing.id}`, { method: "PUT", body: parsed.data });
      else await api("/products", { body: parsed.data });
      setEditing(null);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(p: Product) {
    if (!window.confirm(`Supprimer « ${p.name} » ? Les documents existants ne sont pas modifiés.`)) return;
    await api(`/products/${p.id}`, { method: "DELETE" });
    await load();
  }

  const field = (key: "name" | "description" | "unit" | "price") => ({
    value: editing?.values[key] ?? "",
    error: errors[key] ?? (key === "price" ? errors.unitPriceMinor : undefined),
    onChange: (e: { target: { value: string } }) => editing && setEditing({ ...editing, values: { ...editing.values, [key]: e.target.value } }),
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <Link href="/documents" className="text-sm text-muted hover:text-foreground">← Documents</Link>
          <h1 className="mt-2 text-2xl font-semibold">Produits et services</h1>
        </div>
        {!editing && (
          <Button onClick={() => { setErrors({}); setEditing({ id: null, values: EMPTY }); }}>
            <Plus className="size-4" aria-hidden /> Produit
          </Button>
        )}
      </div>
      {error && <Alert>{error}</Alert>}

      {editing && (
        <Card className="grid gap-4 sm:grid-cols-2">
          <h2 className="font-semibold sm:col-span-2">{editing.id ? "Modifier" : "Nouveau produit ou service"}</h2>
          <Field label="Nom" {...field("name")} className="sm:col-span-2" />
          <Field label={`Prix unitaire HT (${currency === "XOF" ? "FCFA" : currency})`} inputMode="decimal" {...field("price")} />
          <Field label="Unité (facultatif)" placeholder="pièce, heure, kg…" {...field("unit")} />
          {organization.vatEnabled && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="vat" className="text-sm font-medium">TVA</label>
              <select id="vat" value={editing.values.vatRateBps} onChange={(e) => setEditing({ ...editing, values: { ...editing.values, vatRateBps: Number(e.target.value) } })} className="min-h-11 rounded-xl border border-border bg-surface px-3">
                <option value={1800}>18 %</option>
                <option value={0}>0 % (exonéré)</option>
              </select>
            </div>
          )}
          <Field label="Description (facultatif)" {...field("description")} className="sm:col-span-2" />
          <div className="flex gap-2 sm:col-span-2">
            <Button onClick={() => void save()} loading={saving}>Enregistrer</Button>
            <Button variant="ghost" onClick={() => setEditing(null)}>Annuler</Button>
          </div>
        </Card>
      )}

      {products === null ? (
        <div className="grid min-h-[20dvh] place-items-center text-muted" role="status" aria-label="Chargement"><Spinner /></div>
      ) : products.length === 0 ? (
        <p className="text-muted">Aucun produit enregistré. Enregistrez ceux que vous facturez souvent : ils s’ajoutent en un clic.</p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl bg-surface ring-1 ring-border">
          {products.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{p.name}</p>
                <p className="truncate text-sm text-muted">
                  {formatMoney(p.unitPriceMinor, currency)} HT{p.unit ? ` / ${p.unit}` : ""} · TVA {formatRate(p.vatRateBps)}
                </p>
              </div>
              <button type="button" aria-label={`Modifier ${p.name}`} className="grid size-9 place-items-center rounded-lg text-muted hover:bg-background" onClick={() => { setErrors({}); setEditing({ id: p.id, values: { name: p.name, description: p.description ?? "", unit: p.unit ?? "", price: String(p.unitPriceMinor / (currency === "XOF" ? 1 : 100)).replace(".", ","), vatRateBps: p.vatRateBps } }); }}>
                <Pencil className="size-4" />
              </button>
              <button type="button" aria-label={`Supprimer ${p.name}`} className="grid size-9 place-items-center rounded-lg text-muted hover:bg-danger-soft hover:text-danger" onClick={() => void remove(p)}>
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
