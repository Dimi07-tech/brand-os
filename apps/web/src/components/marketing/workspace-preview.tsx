"use client";

import { paletteColor } from "@brand-os/shared";
import { Download, FileText, House, Palette, Plus, Receipt, Settings, Sparkles } from "lucide-react";
import type { CSSProperties } from "react";
import { LogoPreview } from "@/components/logo-preview";
import { SHOWCASE_BRANDS } from "@/lib/showcase";

const brand = SHOWCASE_BRANDS[0]!;
const NAV = [
  { icon: House, label: "Accueil", active: true },
  { icon: Palette, label: "Ma marque" },
  { icon: Plus, label: "Créer" },
  { icon: FileText, label: "Documents" },
  { icon: Settings, label: "Paramètres" },
];
const ACTIVITY = [
  { icon: Sparkles, text: "Logo validé · 6 propositions", time: "il y a 2 min" },
  { icon: Palette, text: "Palette et polices enregistrées", time: "il y a 1 min" },
  { icon: Download, text: "Pack de logos téléchargé (ZIP)", time: "à l’instant" },
  { icon: Receipt, text: "Facture FAC-2026-0001 à vos couleurs", time: "bientôt" },
];

const delay = (ms: number): CSSProperties => ({ animationDelay: `${ms}ms` });

/** Illustration de l'espace de travail : tout ce qui concerne la marque, au même endroit. */
export function WorkspacePreview() {
  const primary = paletteColor(brand.palette, "primary");
  return (
    <div aria-hidden className="reveal overflow-hidden rounded-3xl border border-border bg-background shadow-[0_30px_80px_-24px_rgba(60,35,10,0.28)]">
      <div className="flex">
        <div className="hidden w-44 shrink-0 flex-col gap-1 border-r border-border bg-surface p-4 sm:flex">
          <div className="mb-4 flex items-center gap-2 text-sm font-bold">
            <span className="grid size-6 place-items-center rounded-md bg-accent text-[11px] text-white">B</span> Brand OS
          </div>
          {NAV.map(({ icon: Icon, label, active }) => (
            <div key={label} className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium ${active ? "bg-accent-soft text-accent" : "text-muted"}`}>
              <Icon className="size-4" /> {label}
            </div>
          ))}
        </div>

        <div className="flex-1 space-y-4 p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-display text-lg font-bold">Bonjour Aïcha</p>
              <p className="text-xs text-muted">Chez Aïcha · Offre Starter</p>
            </div>
            <span className="rounded-full bg-success-soft px-2.5 py-1 text-[11px] font-semibold text-success">E-mail vérifié</span>
          </div>

          <div className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-3">
            <div className="w-28 shrink-0 rounded-lg bg-white">
              <LogoPreview spec={brand.logo} className="h-14 p-2" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] text-muted">Marque active · version 1</p>
              <div className="mt-2 flex h-3 overflow-hidden rounded-full">
                {brand.palette.colors.map((c) => (
                  <span key={c.role} className="flex-1" style={{ background: c.hex }} />
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Premiers pas", value: "2 / 4", bar: 50 },
              { label: "Générations IA", value: "3 / 60", bar: 5 },
              { label: "Exports", value: "Illimités", bar: 100 },
            ].map((tile, i) => (
              <div key={tile.label} className="rounded-xl border border-border bg-surface p-3">
                <p className="text-[10px] text-muted">{tile.label}</p>
                <p className="mt-1 font-display text-sm font-bold">{tile.value}</p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-background">
                  <div className="reveal h-full origin-left rounded-full" style={{ width: `${tile.bar}%`, background: primary, ...delay(150 * i) }} />
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-border bg-surface p-3">
            <p className="mb-2 text-xs font-semibold">Activité récente</p>
            <ul className="space-y-1.5">
              {ACTIVITY.map(({ icon: Icon, text, time }, i) => (
                <li key={text} className="reveal flex items-center gap-2.5 rounded-lg px-1.5 py-1.5" style={delay(100 * i)}>
                  <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
                    <Icon className="size-3.5" />
                  </span>
                  <span className="flex-1 truncate text-xs">{text}</span>
                  <span className="shrink-0 text-[10px] text-muted">{time}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
