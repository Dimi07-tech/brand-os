import {
  BRAND_VALUE_LABELS,
  contrastRatio,
  getFont,
  LOGO_VARIANT_LABELS,
  PALETTE_ROLE_LABELS,
  paletteColor,
  renderLogoSvg,
  type GuidelinesText,
  type LogoSpec,
  type LogoVariant,
  type PaletteColor,
  type TextEngine,
} from '@brand-os/shared';

// Charte graphique — §4.5 (US-40). Document HTML autonome (polices et images
// intégrées), rendu en PDF A4 par Chromium. Tout texte saisi est échappé.

export interface GuidelinesInput {
  name: string;
  slogan: string | null;
  logo: LogoSpec;
  colors: PaletteColor[];
  typography: { heading: string; body: string };
  texts: GuidelinesText;
  version: number;
  date: Date;
  organization: { name: string; city: string | null; phone: string | null; email: string | null; website: string | null };
}

export function renderGuidelinesHtml(input: GuidelinesInput, engine: TextEngine, fontFaceCss: string): string {
  const palette = { colors: input.colors };
  const c = {
    primary: paletteColor(palette, 'primary'),
    secondary: paletteColor(palette, 'secondary'),
    accent: paletteColor(palette, 'accent'),
    background: paletteColor(palette, 'background'),
    text: paletteColor(palette, 'text'),
  };
  const onPrimary = contrastRatio('#ffffff', c.primary) >= 4.5 ? '#ffffff' : c.text;
  const heading = fontStack(input.typography.heading);
  const body = fontStack(input.typography.body);
  const headingWeight = getFont(input.typography.heading)?.weight ?? 700;
  const logo = (variant: LogoVariant = 'color') => renderLogoSvg(input.logo, variant, engine).svg;
  const date = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' }).format(input.date);
  const e = escapeHtml;

  const variants: LogoVariant[] = ['monochrome', 'light', 'dark', 'icon-only', 'horizontal', 'vertical'].filter(
    (v) => !(v === 'icon-only' && input.logo.layout === 'wordmark'),
  ) as LogoVariant[];

  const forbidden = [
    { style: 'transform:scaleX(1.6) scaleY(.75)', label: input.texts.forbiddenUses[0] ?? 'Déformer le logo' },
    { style: 'filter:hue-rotate(150deg) saturate(1.6)', label: input.texts.forbiddenUses[1] ?? 'Changer ses couleurs' },
    { style: 'filter:drop-shadow(6px 6px 3px rgba(0,0,0,.55))', label: input.texts.forbiddenUses[2] ?? 'Ajouter un effet' },
    { style: 'transform:rotate(-14deg)', label: 'Incliner le logo.' },
  ];

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; font-src data:; img-src data:">
<title>Charte graphique — ${e(input.name)}</title>
<style>
${fontFaceCss}
@page { size: A4; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { font-family: ${body}; color: ${c.text}; font-size: 10.5pt; line-height: 1.55; }
h1, h2, h3, .display { font-family: ${heading}; font-weight: ${headingWeight}; line-height: 1.15; }
.page { width: 210mm; height: 297mm; padding: 22mm 20mm 24mm; position: relative; overflow: hidden; page-break-after: always; break-after: page; background: #fff; }
.page:last-child { page-break-after: auto; break-after: auto; }
.eyebrow { font-size: 8.5pt; letter-spacing: .14em; text-transform: uppercase; color: ${c.primary}; font-weight: 600; }
h2 { font-size: 26pt; margin: 3mm 0 8mm; }
h3 { font-size: 13pt; margin: 7mm 0 3mm; }
p + p { margin-top: 3mm; }
.muted { color: ${mix(c.text, 0.68)}; }
.footer { position: absolute; left: 20mm; right: 20mm; bottom: 11mm; display: flex; justify-content: space-between; font-size: 7.5pt; color: ${mix(c.text, 0.55)}; border-top: .3mm solid ${mix(c.text, 0.15)}; padding-top: 2.5mm; }
.box { border: .3mm solid ${mix(c.text, 0.15)}; border-radius: 3mm; }
.grid { display: grid; gap: 5mm; }
.g2 { grid-template-columns: 1fr 1fr; } .g3 { grid-template-columns: repeat(3, 1fr); }
.logo svg { width: 100%; height: 100%; }
.logo { display: flex; align-items: center; justify-content: center; }

/* Couverture */
.cover { background: ${c.background}; padding: 0; display: flex; flex-direction: column; }
.cover .band { flex: 1; display: flex; align-items: center; justify-content: center; padding: 30mm; }
.cover .band .logo { width: 140mm; height: 90mm; }
.cover .meta { background: ${c.primary}; color: ${onPrimary}; padding: 16mm 20mm; }
.cover .meta h1 { font-size: 30pt; }
.cover .meta p { opacity: .9; }

/* Valeurs */
.value { padding: 5mm; border-top: 1.2mm solid ${c.primary}; background: ${c.background}; border-radius: 0 0 2mm 2mm; }
.value h3 { margin: 0 0 2mm; font-size: 12pt; }

/* Logo */
.hero-logo { height: 58mm; padding: 9mm; }
.variant { height: 30mm; padding: 4.5mm; }
.variant.dark { background: #1c1917; border-color: #1c1917; }
.caption { font-size: 8pt; margin-top: 1.5mm; color: ${mix(c.text, 0.6)}; }
.clearspace { position: relative; height: 46mm; display: flex; align-items: center; justify-content: center; }
.clearspace .zone { border: .4mm dashed ${c.accent}; padding: 9mm; background: repeating-linear-gradient(45deg, ${mix(c.accent, 0.08)} 0 2mm, transparent 2mm 4mm); }
.clearspace .zone .logo { width: 70mm; height: 24mm; background: #fff; }

/* Règles */
.rules li { list-style: none; padding: 2.2mm 0 2.2mm 8mm; position: relative; border-bottom: .2mm solid ${mix(c.text, 0.1)}; }
.rules li::before { position: absolute; left: 0; top: 2mm; font-weight: 700; }
.do li::before { content: '✓'; color: #15803d; }
.dont li::before { content: '✕'; color: #b91c1c; }
.forbidden .logo { height: 30mm; padding: 6mm; }
.forbidden .item { position: relative; }
.forbidden .item::after { content: ''; position: absolute; inset: 0; border-radius: 3mm; background: linear-gradient(to top right, transparent calc(50% - .4mm), #b91c1c 50%, transparent calc(50% + .4mm)); opacity: .55; }
.busy { background: repeating-linear-gradient(135deg, ${c.secondary} 0 3mm, ${c.accent} 3mm 6mm, ${c.primary} 6mm 9mm); }

/* Couleurs */
.swatch .chip { height: 34mm; border-radius: 3mm 3mm 0 0; border: .3mm solid ${mix(c.text, 0.12)}; border-bottom: 0; }
.swatch .info { border: .3mm solid ${mix(c.text, 0.12)}; border-radius: 0 0 3mm 3mm; padding: 3.5mm 4mm; font-size: 9pt; }
.swatch .info strong { display: block; font-size: 11pt; margin-bottom: 1mm; }
.swatch code { font-family: ${body}; }

/* Typographie */
.specimen { font-size: 44pt; line-height: 1; }
.alphabet { font-size: 13pt; letter-spacing: .04em; margin-top: 3mm; word-break: break-all; }
.scale > div { padding: 3mm 0; border-bottom: .2mm solid ${mix(c.text, 0.1)}; display: flex; align-items: baseline; gap: 6mm; }
.scale .tag { width: 26mm; flex: none; font-size: 8pt; color: ${mix(c.text, 0.6)}; }

/* Supports */
.card { width: 85mm; height: 55mm; border-radius: 2mm; box-shadow: 0 1mm 4mm rgba(0,0,0,.18); overflow: hidden; position: relative; }
.card.front { background: ${c.primary}; display: flex; align-items: center; justify-content: center; }
.card.front .logo { width: 62mm; height: 34mm; }
.card.back { background: #fff; padding: 7mm; font-size: 8pt; display: flex; flex-direction: column; justify-content: space-between; }
.card.back .logo { width: 34mm; height: 12mm; justify-content: flex-start; }
.card.back .who strong { font-family: ${heading}; font-size: 11pt; display: block; color: ${c.primary}; }
.invoice { padding: 9mm; height: 92mm; }
.invoice .top { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: .8mm solid ${c.primary}; padding-bottom: 5mm; }
.invoice .top .logo { width: 52mm; height: 18mm; justify-content: flex-start; }
.invoice .title { font-family: ${heading}; font-size: 18pt; color: ${c.primary}; text-align: right; }
.invoice table { width: 100%; border-collapse: collapse; margin-top: 6mm; font-size: 8.5pt; }
.invoice th { text-align: left; background: ${c.background}; padding: 2mm; }
.invoice td { padding: 2mm; border-bottom: .2mm solid ${mix(c.text, 0.1)}; }
.invoice .total td { font-weight: 700; color: ${c.primary}; border: 0; }
</style>
</head>
<body>

<section class="page cover">
  <div class="band"><div class="logo">${logo()}</div></div>
  <div class="meta">
    <p class="eyebrow" style="color:${onPrimary};opacity:.8">Charte graphique</p>
    <h1>${e(input.name)}</h1>
    ${input.slogan ? `<p>${e(input.slogan)}</p>` : ''}
    <p style="margin-top:6mm;font-size:9pt">Version ${input.version} · ${e(date)}</p>
  </div>
</section>

<section class="page">
  <p class="eyebrow">01 · La marque</p>
  <h2>Qui nous sommes</h2>
  ${paragraphs(input.texts.presentation)}
  <h3>Notre mission</h3>
  ${paragraphs(input.texts.mission)}
  <h3>Nos valeurs</h3>
  <div class="grid g3" style="margin-top:3mm">
    ${input.texts.values
      .map((v) => `<div class="value"><h3>${e(BRAND_VALUE_LABELS[v.value])}</h3><p>${e(v.description)}</p></div>`)
      .join('')}
  </div>
  ${footer(input, date, 2)}
</section>

<section class="page">
  <p class="eyebrow">02 · Le logo</p>
  <h2>Le logo et ses versions</h2>
  <div class="box logo hero-logo">${logo()}</div>
  <p class="caption">Version principale, à privilégier sur fond clair.</p>
  <div class="grid g3" style="margin-top:6mm">
    ${variants
      .map(
        (v) =>
          `<div><div class="box logo variant${v === 'light' ? ' dark' : ''}">${logo(v)}</div><p class="caption">${e(LOGO_VARIANT_LABELS[v])}</p></div>`,
      )
      .join('')}
  </div>
  <h3>Zone de protection et taille minimale</h3>
  <div class="grid g2" style="align-items:center">
    <div class="clearspace"><div class="zone"><div class="logo">${logo()}</div></div></div>
    <div>
      <p>Aucun texte ni élément graphique ne doit entrer dans la zone hachurée autour du logo : elle est au moins égale à la hauteur du symbole.</p>
      <p>Taille minimale : <strong>2 cm</strong> de large à l’impression, <strong>80 pixels</strong> à l’écran.</p>
    </div>
  </div>
  ${footer(input, date, 3)}
</section>

<section class="page">
  <p class="eyebrow">03 · Règles d’usage</p>
  <h2>Bien utiliser le logo</h2>
  <div class="grid g2">
    <div><h3>À faire</h3><ul class="rules do">${input.texts.usageRules.map((r) => `<li>${e(r)}</li>`).join('')}</ul></div>
    <div><h3>À ne pas faire</h3><ul class="rules dont">${input.texts.forbiddenUses.map((r) => `<li>${e(r)}</li>`).join('')}</ul></div>
  </div>
  <h3>Exemples interdits</h3>
  <div class="grid g3 forbidden" style="margin-top:3mm">
    ${forbidden
      .map((f) => `<div><div class="item box logo"><div class="logo" style="${f.style};width:100%;height:100%">${logo()}</div></div><p class="caption">${e(f.label)}</p></div>`)
      .join('')}
    <div><div class="item box logo busy"><div class="logo" style="width:100%;height:100%">${logo()}</div></div><p class="caption">${e(input.texts.forbiddenUses[3] ?? 'Fond trop chargé')}</p></div>
  </div>
  ${footer(input, date, 4)}
</section>

<section class="page">
  <p class="eyebrow">04 · Couleurs</p>
  <h2>La palette</h2>
  <p class="muted">Utilisez uniquement ces couleurs. Les valeurs CMJN sont indicatives : faites-les valider par votre imprimeur avant une impression importante.</p>
  <div class="grid g3" style="margin-top:8mm">
    ${input.colors
      .map(
        (color) => `<div class="swatch"><div class="chip" style="background:${color.hex}"></div><div class="info">
      <strong>${e(PALETTE_ROLE_LABELS[color.role])}</strong>
      HEX <code>${color.hex.toUpperCase()}</code><br>RGB <code>${color.rgb.join(', ')}</code><br>CMJN <code>${color.cmyk.join(', ')}</code></div></div>`,
      )
      .join('')}
  </div>
  <p class="muted" style="margin-top:8mm">Contraste texte/fond : ${contrastRatio(c.text, c.background).toFixed(1).replace('.', ',')}:1 (minimum recommandé 4,5:1, norme WCAG AA).</p>
  ${footer(input, date, 5)}
</section>

<section class="page">
  <p class="eyebrow">05 · Typographie</p>
  <h2>Les polices</h2>
  <div class="grid g2">
    <div class="box" style="padding:6mm">
      <p class="caption">Titres · ${e(input.typography.heading)}</p>
      <p class="display specimen" style="color:${c.primary}">Aa</p>
      <p class="display alphabet">ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz 0123456789</p>
    </div>
    <div class="box" style="padding:6mm">
      <p class="caption">Textes · ${e(input.typography.body)}</p>
      <p class="specimen" style="font-family:${body}">Aa</p>
      <p class="alphabet" style="font-family:${body}">ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz 0123456789</p>
    </div>
  </div>
  <h3>Hiérarchie</h3>
  <div class="scale">
    <div><span class="tag">Titre</span><span class="display" style="font-size:24pt">${e(input.name)}</span></div>
    <div><span class="tag">Sous-titre</span><span class="display" style="font-size:15pt;color:${c.primary}">${e(input.slogan ?? 'Nos services')}</span></div>
    <div><span class="tag">Texte</span><span>Les textes courants utilisent ${e(input.typography.body)}, en 10 à 12 points pour les documents imprimés.</span></div>
  </div>
  <p class="muted" style="margin-top:6mm">Ces polices sont libres pour un usage commercial (licence SIL Open Font). Elles sont disponibles gratuitement sur Google Fonts.</p>
  ${footer(input, date, 6)}
</section>

<section class="page">
  <p class="eyebrow">06 · Exemples de supports</p>
  <h2>La marque en situation</h2>
  <h3>Carte de visite</h3>
  <div style="display:flex;gap:8mm">
    <div class="card front"><div class="logo">${logo('light')}</div></div>
    <div class="card back">
      <div class="logo">${logo()}</div>
      <div class="who"><strong>Prénom Nom</strong>Fonction<br>${e(input.organization.phone ?? '+229 01 00 00 00 00')}<br>${e(input.organization.email ?? 'contact@exemple.bj')}</div>
    </div>
  </div>
  <h3>En-tête de facture</h3>
  <div class="box invoice">
    <div class="top">
      <div><div class="logo">${logo()}</div><p class="caption">${e(input.organization.name)}${input.organization.city ? ` · ${e(input.organization.city)}` : ''}</p></div>
      <div><p class="title">FACTURE</p><p class="caption" style="text-align:right">FAC-2026-0001</p></div>
    </div>
    <table>
      <tr><th>Désignation</th><th>Qté</th><th>Prix unitaire</th><th>Total</th></tr>
      <tr><td>Prestation</td><td>1</td><td>50 000 FCFA</td><td>50 000 FCFA</td></tr>
      <tr><td>TVA 18 %</td><td></td><td></td><td>9 000 FCFA</td></tr>
      <tr class="total"><td colspan="3">Total TTC</td><td>59 000 FCFA</td></tr>
    </table>
  </div>
  ${footer(input, date, 7)}
</section>

</body>
</html>`;
}

function footer(input: GuidelinesInput, date: string, page: number): string {
  return `<div class="footer"><span>Charte graphique ${escapeHtml(input.name)} · version ${input.version} · ${escapeHtml(date)}</span><span>${page} / 7</span></div>`;
}

function paragraphs(text: string): string {
  return text
    .split(/\n{2,}|\r\n\r\n/)
    .map((p) => `<p>${escapeHtml(p.trim()).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

function fontStack(family: string): string {
  const font = getFont(family);
  return `'${family.replace(/'/g, '')}', ${font?.fallback ?? 'sans-serif'}`;
}

/** Couleur avec opacité, pour les traits et textes secondaires. */
function mix(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);
}
