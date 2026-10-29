import {
  amountInWords,
  computeTotals,
  formatMoney,
  formatQuantity,
  formatRate,
  getFont,
  renderLogoSvg,
  type Currency,
  type DocumentLine,
  type LogoSpec,
  type PaletteColor,
  type TextEngine,
} from '@brand-os/shared';
import { escapeHtml } from './guidelines-template.js';

// Factures, devis et avoirs — §4.8, mentions RG-64. Document HTML autonome rendu
// en PDF A4 par Chromium. Tout texte saisi est échappé.

export interface DocumentParty {
  name: string;
  address?: string | null;
  city?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  ifu?: string | null;
  rccm?: string | null;
  taxRegime?: string | null;
}

export interface DocumentBrand {
  logo: LogoSpec;
  colors: Pick<PaletteColor, 'role' | 'hex'>[];
  typography: { heading: string; body: string };
}

export interface DocumentInput {
  type: 'INVOICE' | 'QUOTE' | 'CREDIT_NOTE';
  number: string | null;
  issuedAt: Date | null;
  dueAt: Date | null;
  currency: Currency;
  lines: DocumentLine[];
  vatEnabled: boolean;
  paymentTerms: string | null;
  notes: string | null;
  issuer: DocumentParty;
  client: DocumentParty | null;
  brand: DocumentBrand | null;
  /** Numéro de la facture annulée, pour un avoir */
  corrects?: string | null;
}

const TITLES = { INVOICE: 'Facture', QUOTE: 'Devis', CREDIT_NOTE: 'Facture d’avoir' } as const;
const ARRETE = {
  INVOICE: 'Arrêtée la présente facture à la somme de',
  QUOTE: 'Arrêté le présent devis à la somme de',
  CREDIT_NOTE: 'Arrêtée la présente facture d’avoir à la somme de',
} as const;

export const DOCUMENT_FONTS = (brand: DocumentBrand | null) =>
  brand ? [...new Set([brand.typography.heading, brand.typography.body])] : ['Inter'];

export function renderDocumentHtml(input: DocumentInput, engine: TextEngine, fontFaceCss: string): string {
  const e = escapeHtml;
  const totals = computeTotals(input.lines, { vatEnabled: input.vatEnabled });
  const money = (minor: number) => e(formatMoney(input.type === 'CREDIT_NOTE' && minor !== 0 ? -minor : minor, input.currency));
  const color = (role: string, fallback: string) => input.brand?.colors.find((c) => c.role === role)?.hex ?? fallback;
  const primary = color('primary', '#c2410c');
  const text = color('text', '#1f1a16');
  const heading = font(input.brand?.typography.heading ?? 'Inter');
  const body = font(input.brand?.typography.body ?? 'Inter');
  const date = (d: Date | null) => (d ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: 'Africa/Porto-Novo' }).format(d) : '—');
  const draft = input.number === null;
  const hasDiscount = totals.lines.some((l) => l.discountBps > 0);
  const logo = input.brand ? renderLogoSvg(input.brand.logo, 'horizontal', engine).svg : '';
  const party = (p: DocumentParty | null) =>
    p
      ? [
          `<strong>${e(p.name)}</strong>`,
          ...[p.address, p.city].filter(Boolean).map((v) => e(v!)),
          ...[p.phone, p.email, p.website].filter(Boolean).map((v) => e(v!)),
          ...(p.ifu ? [`IFU : ${e(p.ifu)}`] : []),
          ...(p.rccm ? [`RCCM : ${e(p.rccm)}`] : []),
        ].join('<br>')
      : '<em>Client à préciser</em>';

  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; font-src data:; img-src data:">
<title>${e(TITLES[input.type])} ${e(input.number ?? 'brouillon')}</title>
<style>
${fontFaceCss}
@page { size: A4; margin: 16mm 15mm 20mm; }
/* Aperçu à l'écran : mêmes marges que la page imprimée */
@media screen { body { padding: 16mm 15mm 20mm; } }
* { box-sizing: border-box; margin: 0; padding: 0; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { font-family: ${body}; color: ${text}; font-size: 9.5pt; line-height: 1.5; }
.top { display: flex; justify-content: space-between; align-items: flex-start; gap: 10mm; padding-bottom: 6mm; border-bottom: 1mm solid ${primary}; }
.logo { width: 62mm; height: 20mm; display: flex; align-items: center; }
.logo svg { max-width: 100%; max-height: 100%; }
.issuer-name { font-family: ${heading}; font-size: 15pt; font-weight: 700; }
.title { text-align: right; }
.title h1 { font-family: ${heading}; font-size: 22pt; color: ${primary}; text-transform: uppercase; letter-spacing: .04em; line-height: 1.1; }
.title .number { font-size: 11pt; font-weight: 700; margin-top: 1.5mm; }
.title .dates { margin-top: 2mm; color: ${mix(text, 0.7)}; font-size: 8.5pt; }
.parties { display: grid; grid-template-columns: 1fr 1fr; gap: 8mm; margin-top: 7mm; }
.party h2 { font-size: 7.5pt; text-transform: uppercase; letter-spacing: .12em; color: ${primary}; margin-bottom: 1.5mm; }
.party.client { background: ${mix(primary, 0.06)}; border-radius: 2mm; padding: 4mm; }
.ref { margin-top: 5mm; font-weight: 600; }
table { width: 100%; border-collapse: collapse; margin-top: 8mm; }
th { background: ${primary}; color: #fff; font-size: 7.5pt; text-transform: uppercase; letter-spacing: .06em; text-align: left; padding: 2.2mm 2.5mm; }
th.num, td.num { text-align: right; white-space: nowrap; }
td { padding: 2.5mm; border-bottom: .2mm solid ${mix(text, 0.12)}; vertical-align: top; }
td .desc { color: ${mix(text, 0.65)}; font-size: 8pt; }
tbody tr { break-inside: avoid; }
.summary { display: flex; justify-content: space-between; gap: 10mm; margin-top: 6mm; break-inside: avoid; }
.words { flex: 1; font-size: 8.5pt; }
.words strong { display: block; margin-top: 1mm; font-size: 9.5pt; }
.totals { width: 72mm; }
.totals div { display: flex; justify-content: space-between; padding: 1.4mm 0; }
.totals .grand { margin-top: 1.5mm; padding: 2.5mm 3mm; background: ${primary}; color: #fff; border-radius: 1.5mm; font-family: ${heading}; font-size: 12pt; font-weight: 700; }
.terms { margin-top: 8mm; font-size: 8.5pt; break-inside: avoid; }
.terms h3 { font-size: 7.5pt; text-transform: uppercase; letter-spacing: .12em; color: ${primary}; margin-bottom: 1mm; }
.terms p + h3 { margin-top: 4mm; }
.draft { position: fixed; top: 40%; left: 0; right: 0; text-align: center; font-family: ${heading}; font-size: 72pt; font-weight: 800; color: ${mix(text, 0.07)}; transform: rotate(-24deg); letter-spacing: .1em; }
</style></head>
<body>
${draft ? '<div class="draft">BROUILLON</div>' : ''}
<header class="top">
  <div>
    ${logo ? `<div class="logo">${logo}</div>` : `<div class="issuer-name">${e(input.issuer.name)}</div>`}
  </div>
  <div class="title">
    <h1>${e(TITLES[input.type])}</h1>
    <div class="number">${e(input.number ?? 'Brouillon')}</div>
    <div class="dates">
      Date : ${e(date(input.issuedAt))}
      ${input.dueAt ? `<br>${input.type === 'QUOTE' ? 'Valable jusqu’au' : 'Échéance'} : ${e(date(input.dueAt))}` : ''}
    </div>
  </div>
</header>

<section class="parties">
  <div class="party"><h2>Émetteur</h2>${party(input.issuer)}</div>
  <div class="party client"><h2>${input.type === 'QUOTE' ? 'Destinataire' : 'Facturé à'}</h2>${party(input.client)}</div>
</section>
${input.corrects ? `<p class="ref">Avoir sur la facture ${e(input.corrects)}, qu’il annule intégralement.</p>` : ''}

<table>
  <thead><tr>
    <th>Désignation</th><th class="num">Qté</th><th class="num">Prix unit. HT</th>${hasDiscount ? '<th class="num">Remise</th>' : ''}${input.vatEnabled ? '<th class="num">TVA</th>' : ''}<th class="num">Total HT</th>
  </tr></thead>
  <tbody>
    ${totals.lines
      .map(
        (l) => `<tr>
      <td>${e(l.label)}${l.description ? `<div class="desc">${e(l.description)}</div>` : ''}</td>
      <td class="num">${e(formatQuantity(l.quantityMilli))}${l.unit ? ` ${e(l.unit)}` : ''}</td>
      <td class="num">${money(l.unitPriceMinor)}</td>
      ${hasDiscount ? `<td class="num">${l.discountBps ? e(formatRate(l.discountBps)) : '—'}</td>` : ''}
      ${input.vatEnabled ? `<td class="num">${e(formatRate(l.vatRateBps))}</td>` : ''}
      <td class="num">${money(l.netMinor)}</td>
    </tr>`,
      )
      .join('')}
  </tbody>
</table>

<section class="summary">
  <div class="words">${ARRETE[input.type]} :<strong>${e(capitalize(amountInWords(totals.totalMinor, input.currency)))}</strong></div>
  <div class="totals">
    ${hasDiscount ? `<div><span>Remises</span><span>${money(-totals.discountMinor)}</span></div>` : ''}
    <div><span>Total HT</span><span>${money(totals.subtotalMinor)}</span></div>
    ${
      input.vatEnabled
        ? totals.vatGroups.map((g) => `<div><span>TVA ${e(formatRate(g.rateBps))}</span><span>${money(g.vatMinor)}</span></div>`).join('') ||
          `<div><span>TVA</span><span>${money(0)}</span></div>`
        : '<div><span>TVA</span><span>Non applicable</span></div>'
    }
    <div class="grand"><span>Total TTC</span><span>${money(totals.totalMinor)}</span></div>
  </div>
</section>

<section class="terms">
  ${input.paymentTerms ? `<h3>Conditions</h3><p>${e(input.paymentTerms)}</p>` : ''}
  ${input.notes ? `<h3>Notes</h3><p>${e(input.notes).replace(/\n/g, '<br>')}</p>` : ''}
</section>

</body></html>`;
}

/** Pied de page légal, répété sur chaque page du PDF (RG-64). */
export function documentFooter(issuer: DocumentParty): string {
  return [issuer.name, issuer.rccm && `RCCM ${issuer.rccm}`, issuer.ifu && `IFU ${issuer.ifu}`, issuer.taxRegime && `Régime : ${issuer.taxRegime}`]
    .filter(Boolean)
    .map((v) => escapeHtml(v as string))
    .join(' · ');
}

function font(family: string): string {
  return `'${family.replace(/'/g, '')}', ${getFont(family)?.fallback ?? 'sans-serif'}`;
}

function mix(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
