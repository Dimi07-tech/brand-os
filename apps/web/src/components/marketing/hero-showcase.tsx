"use client";

import { BRAND_VALUE_LABELS, paletteColor, VISUAL_STYLE_LABELS } from "@brand-os/shared";
import { Check, Sparkles } from "lucide-react";
import { useEffect, useState, type CSSProperties } from "react";
import { LogoPreview } from "@/components/logo-preview";
import { SHOWCASE_BRANDS } from "@/lib/showcase";

const CYCLE_MS = 5200;
const BRANDS = SHOWCASE_BRANDS.slice(0, 4);

const delay = (ms: number): CSSProperties => ({ animationDelay: `${ms}ms` });

/**
 * Démonstration animée du Brand Studio : questionnaire → logo → palette →
 * supports. Tout est vectoriel (SVG et CSS) : net à toutes les résolutions.
 */
export function HeroShowcase() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || paused) return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") setIndex((i) => (i + 1) % BRANDS.length);
    }, CYCLE_MS);
    return () => clearInterval(timer);
  }, [paused]);

  const brand = BRANDS[index]!;
  const primary = paletteColor(brand.palette, "primary");

  return (
    <div
      className="relative mx-auto mb-28 mt-8 w-full max-w-xl lg:max-w-none"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      {/* Halo coloré, aux couleurs de la marque affichée */}
      <div aria-hidden className="pointer-events-none absolute -inset-10 -z-10">
        <div className="animate-blob absolute left-[8%] top-[6%] size-72 rounded-full opacity-40 blur-3xl transition-colors duration-1000" style={{ background: primary }} />
        <div className="animate-blob absolute bottom-[4%] right-[6%] size-80 rounded-full bg-sun opacity-25 blur-3xl" style={{ animationDelay: "-6s" }} />
        <div className="animate-blob absolute bottom-[30%] left-[30%] size-56 rounded-full bg-leaf opacity-15 blur-3xl" style={{ animationDelay: "-12s" }} />
      </div>

      {/* Fenêtre du Brand Studio */}
      <div className="relative overflow-hidden rounded-3xl border border-border bg-surface shadow-[0_30px_80px_-20px_rgba(60,35,10,0.25)]">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <span className="size-3 rounded-full bg-[#ff5f57]" />
          <span className="size-3 rounded-full bg-[#febc2e]" />
          <span className="size-3 rounded-full bg-[#28c840]" />
          <span className="ml-3 truncate rounded-full bg-background px-3 py-1 text-xs text-muted">brandos.bj/ma-marque/creer</span>
        </div>

        <div key={index} className="grid gap-5 p-5 sm:p-7">
          <div className="flex flex-wrap gap-2" aria-hidden>
            {[brand.sectorLabel, VISUAL_STYLE_LABELS[brand.brief.style].label, ...brand.brief.values.map((v) => BRAND_VALUE_LABELS[v])].map((chip, i) => (
              <span key={chip} className="animate-pop rounded-full border border-border bg-background px-3 py-1 text-xs font-medium" style={delay(120 * i)}>
                {chip}
              </span>
            ))}
          </div>

          <div className="animate-fade-up relative rounded-2xl border border-border bg-white" style={delay(650)}>
            <LogoPreview spec={brand.logo} className="h-40 p-6 sm:h-48" />
            <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-semibold text-accent">
              <Sparkles className="size-3" aria-hidden /> Proposition 1 sur 6
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex flex-1 overflow-hidden rounded-xl">
              {brand.palette.colors.map((c, i) => (
                <span key={c.role} className="animate-pop h-11 flex-1" style={{ background: c.hex, ...delay(1100 + 90 * i) }} />
              ))}
            </div>
            <span className="animate-fade-in hidden font-mono text-xs text-muted sm:block" style={delay(1600)}>
              {primary.toUpperCase()}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 border-t border-border py-3" role="group" aria-label="Exemples de marques">
          {BRANDS.map((b, i) => (
            <button
              key={b.brief.name}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Voir l’exemple ${b.brief.name}`}
              aria-pressed={i === index}
              className={`h-2 rounded-full transition-all duration-500 ${i === index ? "w-8 bg-accent" : "w-2 bg-border hover:bg-muted"}`}
            />
          ))}
        </div>
      </div>

      {/* Supports flottants : carte de visite, facture, Brand Kit */}
      <div key={`card-${index}`} aria-hidden className="pointer-events-none">
        <div className="animate-fade-up absolute -bottom-28 -left-2 w-40 sm:-bottom-28 sm:-left-14 sm:w-52" style={delay(1500)}>
          <div className="animate-float" style={{ "--tilt": "-6deg" } as CSSProperties}>
            <div className="flex aspect-[85/55] items-center justify-center rounded-xl p-4 shadow-xl transition-colors duration-700" style={{ background: primary }}>
              <LogoPreview spec={brand.logo} variant="light" className="h-full w-full" />
            </div>
          </div>
        </div>

        <div className="animate-fade-up absolute -right-4 -top-10 hidden w-52 sm:block lg:-right-12" style={delay(1900)}>
          <div className="animate-float rounded-2xl border border-border bg-surface p-3 shadow-xl" style={{ animationDelay: "-2s", "--tilt": "3deg" } as CSSProperties}>
            <div className="flex items-center gap-2 text-xs font-semibold">
              <span className="grid size-6 place-items-center rounded-full bg-success-soft text-success">
                <Check className="size-3.5" />
              </span>
              Brand Kit prêt
            </div>
            <p className="mt-1.5 text-[11px] leading-snug text-muted">7 variantes · SVG · PNG · charte PDF</p>
          </div>
        </div>

        <div className="animate-fade-up absolute -bottom-24 right-0 hidden w-56 sm:block lg:-bottom-20 lg:-right-10" style={delay(2300)}>
          <div className="animate-float rounded-2xl border border-border bg-surface p-3 shadow-xl" style={{ animationDelay: "-4s", "--tilt": "-2deg" } as CSSProperties}>
            <div className="flex items-start justify-between gap-2 border-b-2 pb-2" style={{ borderColor: primary }}>
              <LogoPreview spec={brand.logo} variant="horizontal" className="h-7 w-24 justify-start" />
              <span className="font-display text-xs font-bold" style={{ color: primary }}>
                FACTURE
              </span>
            </div>
            <div className="mt-2 space-y-1 text-[10px] text-muted">
              <div className="flex justify-between"><span>Prestation</span><span>50 000 FCFA</span></div>
              <div className="flex justify-between"><span>TVA 18 %</span><span>9 000 FCFA</span></div>
              <div className="flex justify-between font-semibold text-foreground"><span>Total TTC</span><span>59 000 FCFA</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
