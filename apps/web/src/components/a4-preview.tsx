"use client";

import { useCallback, useState } from "react";

const PAGE_WIDTH_PX = 794; // 210 mm à 96 dpi

/**
 * Aperçu d'un document A4 (même HTML que le PDF) dans un cadre isolé : aucun
 * script n'est autorisé ; « allow-same-origin » sert seulement à mesurer la
 * hauteur du contenu. Mis à l'échelle de la largeur disponible.
 */
export function A4Preview({ html, title }: { html: string; title: string }) {
  const [scale, setScale] = useState(0.5);
  const [height, setHeight] = useState(1123);

  const container = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => setScale(Math.min(1, entry!.contentRect.width / PAGE_WIDTH_PX)));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    // min-w-0 : dans une grille, l'aperçu doit pouvoir rétrécir sous les 794 px du document.
    <div ref={container} className="w-full min-w-0">
      <div className="overflow-hidden rounded-xl bg-white shadow-[0_20px_50px_-24px_rgba(60,35,10,0.35)] ring-1 ring-border" style={{ height: height * scale }}>
        <iframe
          title={title}
          srcDoc={html}
          sandbox="allow-same-origin"
          onLoad={(e) => {
            const doc = e.currentTarget.contentDocument;
            if (doc) setHeight(Math.max(1123, doc.documentElement.scrollHeight));
          }}
          style={{ width: PAGE_WIDTH_PX, height, transform: `scale(${scale})`, transformOrigin: "0 0", border: 0 }}
        />
      </div>
    </div>
  );
}
