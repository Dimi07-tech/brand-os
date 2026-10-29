"use client";

import { clientInputSchema } from "@brand-os/shared";
import { Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Alert, Button, Card, Field, Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import type { Client } from "@/lib/documents";

const EMPTY = { name: "", phone: "", email: "", address: "", ifu: "" };

// US-62 : clients enregistrés, réutilisés dans les factures et devis.
export default function ClientsPage() {
  const [clients, setClients] = useState<Client[] | null>(null);
  const [editing, setEditing] = useState<{ id: string | null; values: typeof EMPTY } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () =>
    api<{ clients: Client[] }>("/clients").then(
      (r) => setClients(r.clients),
      (err: Error) => setError(err.message),
    );
  useEffect(() => {
    api<{ clients: Client[] }>("/clients").then(
      (r) => setClients(r.clients),
      (err: Error) => setError(err.message),
    );
  }, []);

  async function save() {
    if (!editing) return;
    const parsed = clientInputSchema.safeParse(editing.values);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setSaving(true);
    try {
      if (editing.id) await api(`/clients/${editing.id}`, { method: "PUT", body: parsed.data });
      else await api("/clients", { body: parsed.data });
      setEditing(null);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(c: Client) {
    if (!window.confirm(`Supprimer le client « ${c.name} » ? Les documents déjà émis ne sont pas modifiés.`)) return;
    await api(`/clients/${c.id}`, { method: "DELETE" });
    await load();
  }

  const field = (key: keyof typeof EMPTY) => ({
    value: editing?.values[key] ?? "",
    error: errors[key],
    onChange: (e: { target: { value: string } }) => editing && setEditing({ ...editing, values: { ...editing.values, [key]: e.target.value } }),
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <Link href="/documents" className="text-sm text-muted hover:text-foreground">
            ← Documents
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">Clients</h1>
        </div>
        {!editing && (
          <Button onClick={() => { setErrors({}); setEditing({ id: null, values: EMPTY }); }}>
            <Plus className="size-4" aria-hidden /> Client
          </Button>
        )}
      </div>
      {error && <Alert>{error}</Alert>}

      {editing && (
        <Card className="grid gap-4 sm:grid-cols-2">
          <h2 className="font-semibold sm:col-span-2">{editing.id ? "Modifier le client" : "Nouveau client"}</h2>
          <Field label="Nom ou raison sociale" {...field("name")} className="sm:col-span-2" />
          <Field label="Téléphone" type="tel" {...field("phone")} />
          <Field label="E-mail" type="email" {...field("email")} />
          <Field label="Adresse" {...field("address")} />
          <Field label="IFU" inputMode="numeric" hint="13 chiffres, si le client est une entreprise" {...field("ifu")} />
          <div className="flex gap-2 sm:col-span-2">
            <Button onClick={() => void save()} loading={saving}>Enregistrer</Button>
            <Button variant="ghost" onClick={() => setEditing(null)}>Annuler</Button>
          </div>
        </Card>
      )}

      {clients === null ? (
        <div className="grid min-h-[20dvh] place-items-center text-muted" role="status" aria-label="Chargement"><Spinner /></div>
      ) : clients.length === 0 ? (
        <p className="text-muted">Aucun client enregistré.</p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl bg-surface ring-1 ring-border">
          {clients.map((c) => (
            <li key={c.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{c.name}</p>
                <p className="truncate text-sm text-muted">{[c.phone, c.email, c.ifu && `IFU ${c.ifu}`].filter(Boolean).join(" · ") || "—"}</p>
              </div>
              <button type="button" aria-label={`Modifier ${c.name}`} className="grid size-9 place-items-center rounded-lg text-muted hover:bg-background" onClick={() => { setErrors({}); setEditing({ id: c.id, values: { name: c.name, phone: c.phone ?? "", email: c.email ?? "", address: c.address ?? "", ifu: c.ifu ?? "" } }); }}>
                <Pencil className="size-4" />
              </button>
              <button type="button" aria-label={`Supprimer ${c.name}`} className="grid size-9 place-items-center rounded-lg text-muted hover:bg-danger-soft hover:text-danger" onClick={() => void remove(c)}>
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
