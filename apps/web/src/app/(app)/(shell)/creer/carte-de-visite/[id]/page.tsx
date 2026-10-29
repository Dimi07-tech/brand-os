"use client";

import {
  BUSINESS_CARD_TEMPLATES,
  businessCardFieldsSchema,
  can,
  qrContent,
  type BusinessCardComposition,
  type BusinessCardFields,
  type QrTarget,
  type Role,
} from "@brand-os/shared";
import { ArrowLeft, Check, CloudOff, Loader2, RotateCw, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { CardPreview } from "@/components/card-preview";
import { ExportButton } from "@/components/export-button";
import { BrandFonts } from "@/components/logo-preview";
import { Alert, Button, Card, Field, Spinner } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { Brand } from "@/lib/brand";
import { cardInput, fetchActiveBrand, type DesignView } from "@/lib/designs";
import { useOrganization } from "@/lib/session";

// Éditeur de carte de visite — US-50, US-51, US-53 ; enregistrement automatique (§4.6, RG-40).

type FieldsDraft = Record<keyof BusinessCardFields, string>;
type SaveState = "saved" | "dirty" | "saving" | "error";

const SAVE_DELAY_MS = 1200;

const FIELD_LABELS: { key: keyof BusinessCardFields; label: string; type?: string; inputMode?: "tel" | "email" | "url"; hint?: string }[] = [
  { key: "fullName", label: "Nom et prénom" },
  { key: "jobTitle", label: "Fonction" },
  { key: "phone", label: "Téléphone", type: "tel", inputMode: "tel" },
  { key: "whatsapp", label: "WhatsApp", type: "tel", inputMode: "tel", hint: "Si différent du téléphone." },
  { key: "email", label: "E-mail", type: "email", inputMode: "email" },
  { key: "website", label: "Site web", inputMode: "url" },
  { key: "address", label: "Adresse" },
];

const toDraft = (f: BusinessCardFields): FieldsDraft => ({
  fullName: f.fullName,
  jobTitle: f.jobTitle ?? "",
  phone: f.phone ?? "",
  whatsapp: f.whatsapp ?? "",
  email: f.email ?? "",
  website: f.website ?? "",
  address: f.address ?? "",
});

export default function CardEditorPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const organization = useOrganization();
  const canEdit = can(organization.role as Role, "design.create");

  const [brand, setBrand] = useState<Brand | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState("");
  const [qr, setQr] = useState<QrTarget>("none");
  const [draft, setDraft] = useState<FieldsDraft | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [side, setSide] = useState<"front" | "back">("front");
  const [guides, setGuides] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [conflict, setConflict] = useState<DesignView | null>(null);
  const version = useRef(1);
  const lastSaved = useRef<string | null>(null);

  function apply(d: DesignView) {
    version.current = d.version;
    setTemplateId(d.composition.templateId);
    setQr(d.composition.qr);
    setDraft(toDraft(d.composition.fields));
  }
  const onLoaded = useEffectEvent((b: Brand | null, design: DesignView) => {
    setBrand(b);
    apply(design);
  });

  useEffect(() => {
    Promise.all([fetchActiveBrand(), api<{ design: DesignView }>(`/designs/${id}`)]).then(
      ([b, { design }]) => onLoaded(b, design),
      (err: Error) => setLoadError(err.message),
    );
  }, [id]);

  const parsed = draft ? businessCardFieldsSchema.safeParse(draft) : null;
  const fields: BusinessCardFields | null = parsed?.success ? parsed.data : null;
  const composition: BusinessCardComposition | null = fields ? { schemaVersion: 1, kind: "BUSINESS_CARD", templateId, fields, qr } : null;

  async function save(next: BusinessCardComposition, baseVersion = version.current) {
    setSaveState("saving");
    try {
      const { design } = await api<{ design: DesignView }>(`/designs/${id}`, { method: "PUT", body: { composition: next, version: baseVersion } });
      version.current = design.version;
      setSaveState("saved");
      setConflict(null);
    } catch (err) {
      if (err instanceof ApiError && err.code === "VERSION_CONFLICT") {
        const current = (await api<{ design: DesignView }>(`/designs/${id}`).catch(() => null))?.design ?? null;
        setConflict(current);
      }
      setSaveState("error");
    }
  }
  const autoSave = useEffectEvent((serializedComposition: string) => {
    lastSaved.current = serializedComposition;
    void save(JSON.parse(serializedComposition) as BusinessCardComposition);
  });

  // Enregistrement automatique après une courte pause dans la saisie.
  const serialized = composition ? JSON.stringify(composition) : null;
  useEffect(() => {
    if (!serialized || !canEdit || conflict) return;
    if (lastSaved.current === null) {
      lastSaved.current = serialized;
      return;
    }
    if (serialized === lastSaved.current) return;
    setSaveState("dirty");
    const timer = setTimeout(() => autoSave(serialized), SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [serialized, canEdit, conflict]);

  // RG-40 : aucune modification n'est perdue sans avertissement.
  useEffect(() => {
    if (saveState === "saved") return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [saveState]);

  function update(key: keyof BusinessCardFields, value: string) {
    setDraft((d) => d && { ...d, [key]: value });
    const result = businessCardFieldsSchema.shape[key].safeParse(value);
    setErrors((e) => ({ ...e, [key]: result.success ? "" : (result.error.issues[0]?.message ?? "") }));
  }

  async function remove() {
    if (!window.confirm("Supprimer définitivement cette carte de visite ?")) return;
    await api(`/designs/${id}`, { method: "DELETE" });
    router.replace("/creer");
  }

  if (loadError) {
    return (
      <div className="flex flex-col gap-4">
        <Alert>{loadError}</Alert>
        <Link href="/creer" className="font-semibold text-accent underline">
          Retour
        </Link>
      </div>
    );
  }
  if (!brand || !draft) {
    return (
      <div className="grid min-h-[40dvh] place-items-center text-muted" role="status" aria-label="Chargement">
        <Spinner />
      </div>
    );
  }

  // L'aperçu suit la saisie, même incomplète ; seules les données valides sont enregistrées.
  const previewFields: BusinessCardFields = fields ?? {
    fullName: draft.fullName.trim() || " ",
    ...Object.fromEntries(
      Object.entries(draft)
        .filter(([key, value]) => key !== "fullName" && value.trim() !== "")
        .map(([key, value]) => [key, value.trim()]),
    ),
  };
  const input = cardInput(brand, { templateId, qr, fields: previewFields });
  const qrMissing = qr !== "none" && fields && !qrContent(fields, qr);

  return (
    <div className="flex flex-col gap-6">
      <BrandFonts />
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/creer" className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
            <ArrowLeft className="size-4" aria-hidden /> Créer
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">Carte de visite</h1>
        </div>
        <SaveIndicator state={saveState} />
      </div>

      {conflict && (
        <Alert>
          <p className="font-semibold">Cette carte a été modifiée ailleurs (autre onglet ou autre appareil).</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="secondary" className="min-h-9" onClick={() => composition && void save(composition, conflict.version)}>
              Garder ma version
            </Button>
            <Button
              variant="secondary"
              className="min-h-9"
              onClick={() => {
                lastSaved.current = JSON.stringify(conflict.composition);
                apply(conflict);
                setConflict(null);
                setSaveState("saved");
              }}
            >
              Reprendre l’autre version
            </Button>
          </div>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr] lg:items-start">
        {/* Aperçu recto / verso */}
        <div className="flex flex-col gap-4 lg:sticky lg:top-24">
          <div className="[perspective:1600px]">
            <div
              className="relative transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] [transform-style:preserve-3d]"
              style={{ transform: side === "back" ? "rotateY(180deg)" : "none" }}
            >
              {input && (
                <>
                  <CardPreview input={input} side="front" guides={guides} className="rounded-xl shadow-[0_24px_50px_-20px_rgba(60,35,10,0.45)] [backface-visibility:hidden]" />
                  <CardPreview
                    input={input}
                    side="back"
                    guides={guides}
                    className="absolute inset-0 rounded-xl shadow-[0_24px_50px_-20px_rgba(60,35,10,0.45)] [backface-visibility:hidden] [transform:rotateY(180deg)]"
                  />
                </>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div role="radiogroup" aria-label="Face" className="flex rounded-full bg-surface p-1 ring-1 ring-border">
              {(["front", "back"] as const).map((s) => (
                <button
                  key={s}
                  role="radio"
                  aria-checked={side === s}
                  onClick={() => setSide(s)}
                  className={`min-h-9 rounded-full px-4 text-sm font-medium ${side === s ? "bg-accent text-white" : "text-muted"}`}
                >
                  {s === "front" ? "Recto" : "Verso"}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setSide((s) => (s === "front" ? "back" : "front"))} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-foreground">
              <RotateCw className="size-4" aria-hidden /> Retourner
            </button>
            <label className="flex items-center gap-2 text-sm text-muted">
              <input type="checkbox" className="size-4 accent-accent" checked={guides} onChange={(e) => setGuides(e.target.checked)} />
              Repères d’impression
            </label>
          </div>
          {guides && (
            <p className="text-xs text-muted">
              <span className="font-semibold text-[#e11d48]">Trait rouge</span> : coupe (85 × 55 mm). <span className="font-semibold text-[#2563eb]">Pointillés bleus</span> : zone de
              sécurité, que rien d’important ne dépasse. Le PDF ajoute 3 mm de fond perdu tout autour.
            </p>
          )}

          <Card>
            <h2 className="font-semibold">Imprimer</h2>
            <p className="mt-1 text-sm text-muted">PDF recto verso pour l’imprimeur : fond perdu de 3 mm, couleurs CMJN, qualité vectorielle.</p>
            <div className="mt-4">
              {saveState === "saved" && !conflict ? (
                <ExportButton request={{ type: "BUSINESS_CARD_PDF", designId: id }}>Télécharger le PDF</ExportButton>
              ) : (
                <Button disabled className="self-start">
                  Enregistrement en cours…
                </Button>
              )}
            </div>
          </Card>
        </div>

        {/* Contenu */}
        <div className="flex flex-col gap-6">
          <Card>
            <h2 className="font-semibold">Coordonnées</h2>
            <fieldset disabled={!canEdit} className="mt-4 grid gap-4 sm:grid-cols-2">
              {FIELD_LABELS.map(({ key, label, type, inputMode, hint }) => (
                <Field
                  key={key}
                  label={label}
                  type={type}
                  inputMode={inputMode}
                  hint={hint}
                  value={draft[key]}
                  error={errors[key] || undefined}
                  onChange={(e) => update(key, e.target.value)}
                  className={key === "address" ? "sm:col-span-2" : undefined}
                />
              ))}
            </fieldset>
          </Card>

          <Card>
            <h2 className="font-semibold">QR code au verso</h2>
            <fieldset disabled={!canEdit} className="mt-3 grid grid-cols-3 gap-2" aria-label="Destination du QR code">
              {(
                [
                  ["whatsapp", "WhatsApp"],
                  ["website", "Site web"],
                  ["none", "Aucun"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={qr === value}
                  onClick={() => setQr(value)}
                  className={`min-h-11 rounded-xl border text-sm font-medium ${qr === value ? "border-accent bg-accent-soft text-accent" : "border-border hover:border-muted"}`}
                >
                  {label}
                </button>
              ))}
            </fieldset>
            {qrMissing && (
              <p className="mt-3 text-sm text-accent">
                {qr === "whatsapp" ? "Indiquez un numéro de téléphone ou WhatsApp valide pour afficher le QR code." : "Indiquez votre site web pour afficher le QR code."}
              </p>
            )}
          </Card>

          <Card>
            <h2 className="font-semibold">Modèle</h2>
            <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {BUSINESS_CARD_TEMPLATES.map((t) => {
                const thumb = cardInput(brand, { templateId: t.id, qr, fields: previewFields });
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      disabled={!canEdit}
                      aria-pressed={templateId === t.id}
                      aria-label={t.name}
                      title={t.name}
                      onClick={() => setTemplateId(t.id)}
                      className={`block w-full rounded-lg p-1 ring-2 transition ${templateId === t.id ? "ring-accent" : "ring-transparent hover:ring-border"}`}
                    >
                      {thumb && <CardPreview input={thumb} side="front" className="rounded-md shadow-sm" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>

          {canEdit && (
            <Button variant="ghost" className="self-start text-danger" onClick={() => void remove()}>
              <Trash2 className="size-4" aria-hidden /> Supprimer cette carte
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  const content = {
    saved: { icon: <Check className="size-4 text-success" aria-hidden />, text: "Enregistré" },
    dirty: { icon: <Loader2 className="size-4 text-muted" aria-hidden />, text: "Modifications…" },
    saving: { icon: <Loader2 className="size-4 animate-spin text-muted" aria-hidden />, text: "Enregistrement…" },
    error: { icon: <CloudOff className="size-4 text-danger" aria-hidden />, text: "Non enregistré" },
  }[state];
  return (
    <span className="mt-8 inline-flex items-center gap-1.5 text-sm text-muted" aria-live="polite">
      {content.icon}
      {content.text}
    </span>
  );
}
