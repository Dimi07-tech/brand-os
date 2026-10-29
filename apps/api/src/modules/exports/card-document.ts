import { CARD_WITH_BLEED, renderBusinessCard, type BusinessCardInput, type TextEngine } from '@brand-os/shared';

/** Format de page du PDF d'impression : format fini + fond perdu (RG-50). */
export const CARD_PAGE = { width: `${CARD_WITH_BLEED.width}mm`, height: `${CARD_WITH_BLEED.height}mm` };

/**
 * Document HTML de la carte : page 1 recto, page 2 verso, au format fond perdu.
 * Texte vectorisé : aucune police n'est chargée par le navigateur.
 */
export function renderCardDocument(input: BusinessCardInput, engine: TextEngine, watermark: boolean): string {
  const page = (side: 'front' | 'back') => renderBusinessCard(input, side, engine, { bleed: true, watermark }).svg;
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
<style>
@page { size: ${CARD_PAGE.width} ${CARD_PAGE.height}; margin: 0; }
* { margin: 0; padding: 0; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.page { width: ${CARD_PAGE.width}; height: ${CARD_PAGE.height}; overflow: hidden; break-after: page; }
.page:last-child { break-after: auto; }
svg { display: block; }
</style></head>
<body><div class="page">${page('front')}</div><div class="page">${page('back')}</div></body></html>`;
}
