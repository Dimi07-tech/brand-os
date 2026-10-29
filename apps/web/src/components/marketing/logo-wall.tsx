"use client";

import type { CSSProperties } from "react";
import { LogoPreview } from "@/components/logo-preview";
import { SHOWCASE_BRANDS, type ShowcaseBrand } from "@/lib/showcase";

/** Défilement continu des marques d'exemple ; pause au survol. */
export function LogoWall() {
  const half = Math.ceil(SHOWCASE_BRANDS.length / 2);
  return (
    <div className="flex flex-col gap-5 [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
      <Row brands={SHOWCASE_BRANDS.slice(0, half)} duration="46s" />
      <Row brands={SHOWCASE_BRANDS.slice(half)} duration="52s" reverse />
    </div>
  );
}

function Row({ brands, duration, reverse }: { brands: ShowcaseBrand[]; duration: string; reverse?: boolean }) {
  // Contenu dupliqué : la boucle reprend sans saut à -50 %.
  const items = [...brands, ...brands, ...brands, ...brands];
  return (
    <div className="group flex overflow-hidden">
      <ul
        className="animate-marquee flex w-max shrink-0 gap-5 pr-5 group-hover:[animation-play-state:paused]"
        style={{ "--duration": duration, animationDirection: reverse ? "reverse" : "normal" } as CSSProperties}
      >
        {items.map((brand, i) => (
          <li
            key={i}
            aria-hidden={i >= brands.length || undefined}
            className="flex w-64 shrink-0 flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-sm transition-transform duration-300 hover:-translate-y-1 sm:w-72"
          >
            <LogoPreview spec={brand.logo} className="h-32 p-5" />
            <div className="flex items-center justify-between gap-3 border-t border-border bg-surface px-4 py-2.5">
              <span className="truncate text-xs text-muted">{brand.sectorLabel}</span>
              <span className="flex shrink-0 overflow-hidden rounded-full">
                {brand.palette.colors.slice(0, 3).map((c) => (
                  <span key={c.role} className="size-3.5" style={{ background: c.hex }} />
                ))}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
