"use client";

import { renderBusinessCard, type BusinessCardInput, type CardSide } from "@brand-os/shared";
import { useMemo } from "react";
import { previewEngine, useFontsReady } from "@/components/logo-preview";

/**
 * Aperçu d'une carte de visite (format fini 85 x 55 mm). Même moteur que le PDF
 * d'impression ; les textes sont mesurés avec les vraies polices dès qu'elles sont chargées.
 */
export function CardPreview({
  input,
  side,
  guides = false,
  className = "",
}: {
  input: BusinessCardInput;
  side: CardSide;
  guides?: boolean;
  className?: string;
}) {
  const ready = useFontsReady([input.logo.font, input.typography.heading, input.typography.body]);
  const { svg } = useMemo(() => renderBusinessCard(input, side, previewEngine(ready), { guides }), [input, side, guides, ready]);
  return (
    <div
      role="img"
      aria-label={side === "front" ? "Recto de la carte" : "Verso de la carte"}
      className={`aspect-[85/55] overflow-hidden [&_svg]:h-full [&_svg]:w-full ${className}`}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
