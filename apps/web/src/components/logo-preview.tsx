"use client";

import {
  approximateTextEngine,
  FONTS,
  fontWeights,
  getFont,
  googleFontsCssUrl,
  renderLogoSvg,
  type LogoSpec,
  type LogoVariant,
  type TextEngine,
} from "@brand-os/shared";
import { useEffect, useMemo, useState } from "react";

const ALL_FONTS_URL = googleFontsCssUrl(FONTS.map((f) => f.family));

/**
 * Charge les polices du catalogue (RG-24) pour les aperçus, sans bloquer
 * l'affichage de la page : la feuille est ajoutée après le premier rendu, et
 * LogoPreview se recalcule dès que la police est disponible. `families` limite
 * le chargement (vitrine, 3G).
 */
export function BrandFonts({ families }: { families?: string[] }) {
  const href = families ? googleFontsCssUrl(families) : ALL_FONTS_URL;
  useEffect(() => {
    if (document.querySelector(`link[data-brand-fonts="${CSS.escape(href)}"]`)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.dataset.brandFonts = href;
    document.head.appendChild(link);
  }, [href]);
  return null;
}

let canvasEngine: TextEngine | null = null;

/** Moteur de texte de l'aperçu : canvas avec les vraies polices une fois chargées, estimation sinon. */
export function previewEngine(fontsReady: boolean): TextEngine {
  return fontsReady ? getCanvasEngine() : approximateTextEngine;
}

/** Mesure par canvas avec la vraie police : l'aperçu a les mêmes proportions que l'export vectorisé. */
function getCanvasEngine(): TextEngine {
  if (canvasEngine) return canvasEngine;
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return approximateTextEngine;
  const supportsSpacing = "letterSpacing" in ctx;
  canvasEngine = {
    measure(text, style) {
      ctx.font = `${style.weight} ${style.size}px '${style.family}', ${getFont(style.family)?.fallback ?? "sans-serif"}`;
      const spacing = style.letterSpacing * style.size;
      if (supportsSpacing) ctx.letterSpacing = `${spacing}px`;
      const width = ctx.measureText(text).width;
      return supportsSpacing ? width : width + spacing * [...text].length;
    },
  };
  return canvasEngine;
}

/** Vrai quand les polices demandées (toutes leurs graisses utilisées) sont chargées. */
export function useFontsReady(families: string[]): boolean {
  const key = families.join("|");
  const [loaded, setLoaded] = useState<string | null>(null);
  useEffect(() => {
    if (typeof document === "undefined" || !("fonts" in document)) return;
    let cancelled = false;
    const loads = key
      .split("|")
      .map((family) => getFont(family))
      .filter((font) => font !== undefined)
      .flatMap((font) => fontWeights(font).map((w) => document.fonts.load(`${w} 16px '${font.family}'`)));
    Promise.all(loads).then(
      () => !cancelled && setLoaded(key),
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [key]);
  return loaded === key;
}

/**
 * Aperçu d'un logo. Le SVG est produit par le moteur partagé, qui échappe tout
 * texte saisi : l'insertion directe dans la page est donc sans risque.
 */
export function LogoPreview({
  spec,
  variant = "color",
  className = "",
}: {
  spec: LogoSpec;
  variant?: LogoVariant;
  className?: string;
}) {
  const fontReady = useFontsReady([spec.font]);
  const { svg } = useMemo(() => renderLogoSvg(spec, variant, previewEngine(fontReady)), [spec, variant, fontReady]);
  return (
    <div
      className={`flex items-center justify-center [&_svg]:h-auto [&_svg]:max-h-full [&_svg]:w-auto [&_svg]:max-w-full ${className}`}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
