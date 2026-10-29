"use client";

import { BRAND_VALUE_LABELS, can, guidelinesTextSchema, type GuidelinesText, type Role } from "@brand-os/shared";
import { ArrowLeft, Eye, PenLine } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ExportButton } from "@/components/export-button";
import { Alert, Button, Card, Spinner, TextAreaField } from "@/components/ui";
import { api } from "@/lib/api";
import type { Brand } from "@/lib/brand";
import { useOrganization } from "@/lib/session";
import type { ExportQuota } from "@/lib/use-export";

// Charte graphique — §4.5 : textes corrigés avant l'export (US-41), aperçu page
// par page (§5.3), export PDF (US-40).

type Draft = Omit<GuidelinesText, "usageRules" | "forbiddenUses"> & { usageRules: string; forbiddenUses: string };

const toDraft = (t: GuidelinesText): Draft => ({ ...t, usageRules: t.usageRules.join("\n"), forbiddenUses: t.forbiddenUses.join("\n") });
const lines = (text: string) => text.split("\n").map((l) => l.trim()).filter(Boolean);
const fromDraft = (d: Draft): unknown => ({ ...d, usageRules: lines(d.usageRules), forbiddenUses: lines(d.forbiddenUses) });

export default function GuidelinesPage() {
  const organization = useOrganization();
  const canEdit = can(organization.role as Role, "brand.edit");
  const [brand, setBrand] = useState<Brand | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [quota, setQuota] = useState<ExportQuota | null>(null);
  const [tab, setTab] = useState<"texts" | "preview">("texts");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [previewKey, setPreviewKey] = useState(0);

  useEffect(() => {
    (async () => {
      const { brands } = await api<{ brands: Brand[] }>("/brands");
      const current = brands[0];
      if (!current?.logo) throw new Error("Créez d’abord votre marque dans le Brand Studio.");
      const [{ texts }, q] = await Promise.all([
        api<{ texts: GuidelinesText }>(`/brands/${current.id}/guidelines`),
        api<{ quota: ExportQuota }>("/exports/quota"),
      ]);
      setBrand(current);
      setDraft(toDraft(texts));
      setQuota(q.quota);
    })().catch((err: Error) => setLoadError(err.message));
  }, []);

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => d && { ...d, [key]: value });
    setSaved(false);
    setErrors((e) => ({ ...e, [key]: "" }));
  }

  async function save() {
    if (!brand || !draft) return;
    const parsed = guidelinesTextSchema.safeParse(fromDraft(draft));
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[issue.path.slice(0, issue.path[0] === "values" ? 2 : 1).join(".")] ??= issue.message;
      setErrors(next);
      return;
    }
    setSaving(true);
    try {
      await api(`/brands/${brand.id}/guidelines`, { method: "PUT", body: parsed.data });
      setSaved(true);
      setPreviewKey((k) => k + 1);
    } catch (err) {
      setErrors({ _form: (err as Error).message });
    } finally {
      setSaving(false);
    }
  }

  if (loadError) {
    return (
      <div className="flex flex-col gap-4">
        <Alert>{loadError}</Alert>
        <Link href="/ma-marque" className="font-semibold text-accent underline">
          Retour à ma marque
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

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/ma-marque" className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden /> Ma marque
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Charte graphique</h1>
        <p className="mt-1 text-sm text-muted">Version {brand.version} · 7 pages</p>
      </div>

      <Card>
        <h2 className="font-semibold">Exporter en PDF</h2>
        {quota && !quota.guidelines ? (
          <p className="mt-1 text-sm text-muted">La charte PDF est disponible à partir de l’offre Starter. Vous pouvez déjà relire et corriger ses textes.</p>
        ) : (
          <p className="mt-1 text-sm text-muted">Enregistrez vos corrections avant d’exporter. Nous vous prévenons par e-mail quand le PDF est prêt.</p>
        )}
        <div className="mt-4">
          <ExportButton request={{ type: "GUIDELINES_PDF", brandId: brand.id }} variant={quota?.guidelines ? "primary" : "secondary"}>
            Exporter la charte (PDF)
          </ExportButton>
        </div>
      </Card>

      <div role="tablist" aria-label="Charte graphique" className="grid grid-cols-2 gap-2 rounded-xl bg-surface p-1 ring-1 ring-border">
        {(
          [
            ["texts", "Textes", PenLine],
            ["preview", "Aperçu", Eye],
          ] as const
        ).map(([value, label, Icon]) => (
          <button
            key={value}
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={`flex min-h-11 items-center justify-center gap-2 rounded-lg text-sm font-medium ${tab === value ? "bg-accent-soft text-accent" : "text-muted"}`}
          >
            <Icon className="size-4" aria-hidden /> {label}
          </button>
        ))}
      </div>

      {tab === "texts" ? (
        <Card className="flex flex-col gap-5">
          {!canEdit && <Alert tone="info">Votre rôle permet de consulter la charte, pas de la modifier.</Alert>}
          <p className="text-sm text-muted">Ces textes ont été proposés à partir de vos réponses au questionnaire. Adaptez-les à votre façon de parler.</p>
          <fieldset disabled={!canEdit} className="flex flex-col gap-5">
            <TextAreaField label="Présentation de la marque" rows={5} maxLength={1200} value={draft.presentation} error={errors.presentation} onChange={(e) => update("presentation", e.target.value)} />
            <TextAreaField label="Mission" rows={3} maxLength={600} value={draft.mission} error={errors.mission} onChange={(e) => update("mission", e.target.value)} />
            {draft.values.map((v, i) => (
              <TextAreaField
                key={v.value}
                label={`Valeur : ${BRAND_VALUE_LABELS[v.value]}`}
                rows={2}
                maxLength={300}
                value={v.description}
                error={errors[`values.${i}`]}
                onChange={(e) => update("values", draft.values.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))}
              />
            ))}
            <TextAreaField label="Règles d’usage" hint="Une règle par ligne (8 au maximum)." rows={6} value={draft.usageRules} error={errors.usageRules} onChange={(e) => update("usageRules", e.target.value)} />
            <TextAreaField label="Interdits" hint="Un interdit par ligne (8 au maximum)." rows={6} value={draft.forbiddenUses} error={errors.forbiddenUses} onChange={(e) => update("forbiddenUses", e.target.value)} />
          </fieldset>
          {errors._form && <Alert>{errors._form}</Alert>}
          {saved && <Alert tone="success">Textes enregistrés.</Alert>}
          {canEdit && (
            <Button onClick={() => void save()} loading={saving} className="self-start">
              Enregistrer les textes
            </Button>
          )}
        </Card>
      ) : (
        <Preview key={previewKey} brandId={brand.id} />
      )}
    </div>
  );
}

const PAGE_WIDTH_PX = 794; // 210 mm à 96 dpi
const PAGE_HEIGHT_PX = 1123; // 297 mm

/**
 * Aperçu page par page (§5.3) : le même HTML que le PDF, dans un cadre isolé
 * (sandbox sans scripts), mis à l'échelle de l'écran.
 */
function Preview({ brandId }: { brandId: string }) {
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState(0.4);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api<{ html: string }>(`/brands/${brandId}/guidelines/preview`).then(
      (res) => setHtml(res.html),
      (err: Error) => setError(err.message),
    );
  }, [brandId]);

  const measure = useCallback((node: HTMLDivElement | null) => {
    containerRef.current = node;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => setScale(Math.min(1, entry!.contentRect.width / PAGE_WIDTH_PX)));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  if (error) return <Alert>{error}</Alert>;
  if (!html) {
    return (
      <div className="grid min-h-[30dvh] place-items-center text-muted" role="status" aria-label="Chargement de l’aperçu">
        <Spinner />
      </div>
    );
  }

  const height = PAGE_HEIGHT_PX * 7;
  return (
    <div ref={measure} className="w-full">
      <div className="overflow-hidden rounded-xl border border-border bg-stone-200" style={{ height: height * scale }}>
        <iframe
          title="Aperçu de la charte graphique"
          srcDoc={html}
          sandbox=""
          style={{ width: PAGE_WIDTH_PX, height, transform: `scale(${scale})`, transformOrigin: "0 0", border: 0, background: "#fff" }}
        />
      </div>
    </div>
  );
}
