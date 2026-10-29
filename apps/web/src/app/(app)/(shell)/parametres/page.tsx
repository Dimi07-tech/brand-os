"use client";

import { LogOut, Monitor, Smartphone } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { can, deleteAccountSchema, updateOrganizationSchema, type Role } from "@brand-os/shared";
import { Alert, Button, Card, Field, SelectField } from "@/components/ui";
import { api, type Organization, type Session } from "@/lib/api";
import { ROLE_LABELS, SECTOR_OPTIONS } from "@/lib/labels";
import { useOrganization, useSession } from "@/lib/session";
import { useForm } from "@/lib/use-form";

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Paramètres</h1>
      <CompanySettings />
      <SessionsSettings />
      <AccountSettings />
    </div>
  );
}

const CURRENCY_OPTIONS = [
  { value: "XOF", label: "Franc CFA (XOF)" },
  { value: "EUR", label: "Euro (EUR)" },
  { value: "USD", label: "Dollar US (USD)" },
];

const EDITABLE_FIELDS = [
  "name", "sector", "city", "phone", "email", "currency",
  "address", "website", "rccm", "ifu", "taxRegime", "vatEnabled",
] as const;

// US-10, US-11
function CompanySettings() {
  const organization = useOrganization();
  const { setOrganization } = useSession();
  const editable = can(organization.role as Role, "organization.edit");
  const [saved, setSaved] = useState(false);

  const initial = Object.fromEntries(
    EDITABLE_FIELDS.map((k) => [k, k === "vatEnabled" ? organization.vatEnabled : (organization[k] ?? "")]),
  );
  const form = useForm(updateOrganizationSchema, initial, async (data) => {
    // N'envoie que les champs modifiés (journal d'audit précis, pas d'écrasement).
    const changes = Object.fromEntries(
      Object.entries(data).filter(([k, v]) => v !== (organization[k as keyof Organization] ?? null)),
    );
    if (Object.keys(changes).length === 0) {
      setSaved(true);
      return;
    }
    const res = await api<{ organization: Organization }>(`/organizations/${organization.id}`, {
      method: "PATCH",
      body: changes,
    });
    setOrganization(res.organization);
    setSaved(true);
  });

  return (
    <Card>
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-semibold">Entreprise</h2>
        <span className="text-sm text-muted">Votre rôle : {ROLE_LABELS[organization.role as Role]}</span>
      </div>
      <p className="mt-1 text-sm text-muted">Ces informations apparaissent sur vos factures et devis.</p>

      <form
        onSubmit={(e) => {
          setSaved(false);
          return form.handleSubmit(e);
        }}
        noValidate
        className="mt-6"
      >
        <fieldset disabled={!editable} className="grid gap-5 sm:grid-cols-2">
          {form.formError && <div className="sm:col-span-2"><Alert>{form.formError}</Alert></div>}
          {saved && <div className="sm:col-span-2"><Alert tone="success">Modifications enregistrées.</Alert></div>}
          <Field label="Nom commercial" {...form.field("name")} />
          <SelectField label="Secteur" options={SECTOR_OPTIONS} {...form.field("sector")} />
          <Field label="Ville" {...form.field("city")} />
          <Field label="Adresse" {...form.field("address")} />
          <Field label="Téléphone" type="tel" inputMode="tel" {...form.field("phone")} />
          <Field label="E-mail de contact" type="email" inputMode="email" {...form.field("email")} />
          <Field label="Site web" type="url" inputMode="url" {...form.field("website")} />
          <SelectField label="Devise" options={CURRENCY_OPTIONS} {...form.field("currency")} />

          <h3 className="mt-2 font-semibold sm:col-span-2">Informations légales</h3>
          <Field label="RCCM" placeholder="RB/COT/24 B 12345" {...form.field("rccm")} />
          <Field label="IFU" inputMode="numeric" hint="13 chiffres" {...form.field("ifu")} />
          <Field label="Régime fiscal" placeholder="Ex. TPS, réel simplifié" {...form.field("taxRegime")} />
          <label className="flex min-h-11 items-center gap-3 self-end text-sm font-medium">
            <input
              type="checkbox"
              className="size-5 accent-accent"
              checked={Boolean(form.values.vatEnabled)}
              onChange={(e) => form.setValues((v) => ({ ...v, vatEnabled: e.target.checked }))}
            />
            Entreprise assujettie à la TVA
          </label>

          {editable ? (
            <Button type="submit" loading={form.submitting} className="sm:col-span-2 sm:justify-self-start">
              Enregistrer
            </Button>
          ) : (
            <p className="text-sm text-muted sm:col-span-2">Seuls le propriétaire et les administrateurs peuvent modifier ces informations.</p>
          )}
        </fieldset>
      </form>
    </Card>
  );
}

// US-04
function SessionsSettings() {
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    () =>
      api<{ sessions: Session[] }>("/auth/sessions").then(
        (res) => setSessions(res.sessions),
        (err: Error) => setError(err.message),
      ),
    [],
  );

  useEffect(() => {
    api<{ sessions: Session[] }>("/auth/sessions").then(
      (res) => setSessions(res.sessions),
      (err: Error) => setError(err.message),
    );
  }, []);

  async function revoke(id: string) {
    try {
      await api(`/auth/sessions/${id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <Card>
      <h2 className="font-semibold">Appareils connectés</h2>
      <p className="mt-1 text-sm text-muted">Déconnectez un appareil que vous ne reconnaissez pas.</p>
      {error && <div className="mt-4"><Alert>{error}</Alert></div>}
      <ul className="mt-4 flex flex-col divide-y divide-border">
        {sessions?.map((s) => {
          const device = describeDevice(s.userAgent);
          const Icon = device.mobile ? Smartphone : Monitor;
          return (
            <li key={s.id} className="flex items-center gap-3 py-3">
              <Icon className="size-5 shrink-0 text-muted" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {device.label}
                  {s.current && <span className="ml-2 text-xs font-semibold text-success">Cet appareil</span>}
                </p>
                <p className="text-xs text-muted">Dernière activité : {formatDate(s.lastSeenAt)}</p>
              </div>
              {!s.current && (
                <Button variant="secondary" className="min-h-9 px-3" onClick={() => void revoke(s.id)}>
                  Déconnecter
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

// US-07, RG-04 ; toute action destructrice demande une confirmation (§5.4).
function AccountSettings() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const form = useForm(deleteAccountSchema, { password: "" }, async (data) => {
    await api("/auth/delete-account", { body: data });
    router.replace("/");
  });

  async function logout() {
    setLoggingOut(true);
    await api("/auth/logout", { method: "POST" }).catch(() => undefined);
    router.replace("/connexion");
  }

  return (
    <Card>
      <h2 className="font-semibold">Compte</h2>
      <div className="mt-4 flex flex-col gap-6">
        <Button variant="secondary" className="self-start" loading={loggingOut} onClick={() => void logout()}>
          <LogOut className="size-4" aria-hidden /> Se déconnecter
        </Button>

        <div className="border-t border-border pt-6">
          <h3 className="font-semibold text-danger">Supprimer mon compte</h3>
          <p className="mt-1 text-sm text-muted">
            Votre compte et vos données seront supprimés définitivement après 30 jours. Vous pouvez annuler en vous
            reconnectant pendant ce délai.
          </p>
          {!confirming ? (
            <Button variant="secondary" className="mt-4 text-danger" onClick={() => setConfirming(true)}>
              Supprimer mon compte
            </Button>
          ) : (
            <form onSubmit={form.handleSubmit} noValidate className="mt-4 flex max-w-sm flex-col gap-4">
              {form.formError && <Alert>{form.formError}</Alert>}
              <Field label="Confirmez avec votre mot de passe" type="password" autoComplete="current-password" {...form.field("password")} />
              <div className="flex gap-3">
                <Button type="submit" variant="danger" loading={form.submitting}>
                  Confirmer la suppression
                </Button>
                <Button type="button" variant="ghost" onClick={() => setConfirming(false)}>
                  Annuler
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </Card>
  );
}

function describeDevice(userAgent: string | null): { label: string; mobile: boolean } {
  const ua = userAgent ?? "";
  const os = /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iPhone" : /Windows/.test(ua) ? "Windows" : /Mac OS/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : null;
  const browser = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : null;
  const label = [browser, os].filter(Boolean).join(" sur ") || "Appareil inconnu";
  return { label, mobile: /Android|iPhone|iPad|Mobile/.test(ua) };
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}
