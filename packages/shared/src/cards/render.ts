import { Globe, Mail, MapPin, Phone, type IconNode } from 'lucide';
import { contrastRatio } from '../brand/color.js';
import { getFont } from '../brand/fonts.js';
import { approximateTextEngine, escapeXml, renderLogoSvg, type LogoSpec, type LogoVariant, type TextEngine, type TextStyle } from '../brand/logo.js';
import type { PaletteColor, PaletteRole } from '../brand/palette.js';
import { CARD, CARD_WITH_BLEED, qrContent, qrPath, type BusinessCardFields, type QrTarget } from './format.js';

// Rendu des cartes de visite en SVG, en millimètres. Le même code sert à l'aperçu
// (navigateur) et au PDF d'impression (serveur, texte vectorisé).

export const CARD_LAYOUTS = [
  'classique',
  'bandeau',
  'bandeau-bas',
  'diagonale',
  'cercle',
  'minimal',
  'cadre',
  'moitie',
  'vague',
  'centre',
] as const;
export type CardLayout = (typeof CARD_LAYOUTS)[number];

export const CARD_TONES = ['clair', 'couleur'] as const;
export type CardTone = (typeof CARD_TONES)[number];

const LAYOUT_LABELS: Record<CardLayout, string> = {
  classique: 'Classique',
  bandeau: 'Bandeau',
  'bandeau-bas': 'Pied coloré',
  diagonale: 'Diagonale',
  cercle: 'Cercle',
  minimal: 'Minimal',
  cadre: 'Cadre',
  moitie: 'Deux tons',
  vague: 'Vague',
  centre: 'Centré',
};

export interface CardTemplate {
  id: string;
  name: string;
  layout: CardLayout;
  tone: CardTone;
}

/** Les 20 modèles du MVP (US-50) : 10 mises en page, en version claire ou couleur. */
export const BUSINESS_CARD_TEMPLATES: readonly CardTemplate[] = CARD_LAYOUTS.flatMap((layout) =>
  CARD_TONES.map((tone) => ({
    id: `${layout}-${tone}`,
    name: `${LAYOUT_LABELS[layout]} · ${tone === 'clair' ? 'clair' : 'couleur'}`,
    layout,
    tone,
  })),
);

export function getCardTemplate(id: string): CardTemplate | undefined {
  return BUSINESS_CARD_TEMPLATES.find((t) => t.id === id);
}

export type CardSide = 'front' | 'back';

export interface BusinessCardInput {
  templateId: string;
  logo: LogoSpec;
  colors: Pick<PaletteColor, 'role' | 'hex'>[];
  typography: { heading: string; body: string };
  fields: BusinessCardFields;
  qr: QrTarget;
}

export interface RenderCardOptions {
  /** Document d'impression avec fond perdu (91 x 61 mm), sinon format fini (85 x 55 mm). */
  bleed?: boolean;
  /** Repères : trait de coupe et zone de sécurité (aperçu de l'éditeur). */
  guides?: boolean;
  /** Offre Gratuite (§6.2) */
  watermark?: boolean;
}

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
  kind: 'text' | 'logo' | 'qr' | 'icon';
}

export interface RenderedCard {
  svg: string;
  /** Zones de contenu, en mm depuis le coin du format fini : elles doivent rester dans la zone de sécurité. */
  contentBoxes: Box[];
}

const MIN_TEXT_SIZE = 2.1; // ≈ 6 pt, minimum lisible à l'impression
const ICONS: Record<'phone' | 'mail' | 'web' | 'pin', IconNode> = { phone: Phone, mail: Mail, web: Globe, pin: MapPin };

interface TextOptions {
  x: number;
  y: number;
  size: number;
  font: 'heading' | 'body';
  weight?: number;
  color: string;
  anchor?: 'start' | 'middle';
  maxWidth: number;
  letterSpacing?: number;
}

/** Surface de dessin en coordonnées du format fini (mm), avec suivi des zones de contenu. */
class Canvas {
  readonly parts: string[] = [];
  readonly boxes: Box[] = [];

  constructor(
    private readonly input: BusinessCardInput,
    private readonly engine: TextEngine,
  ) {}

  /** Fond qui déborde dans le fond perdu. */
  fill(color: string): void {
    this.rect(-CARD.bleed, -CARD.bleed, CARD_WITH_BLEED.width, CARD_WITH_BLEED.height, color);
  }

  rect(x: number, y: number, w: number, h: number, color: string, extra = ''): void {
    this.parts.push(`<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="${color}"${extra}/>`);
  }

  circle(cx: number, cy: number, r: number, color: string, opacity = 1): void {
    this.parts.push(`<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="${color}"${opacity < 1 ? ` fill-opacity="${opacity}"` : ''}/>`);
  }

  shape(d: string, color: string, opacity = 1): void {
    this.parts.push(`<path d="${d}" fill="${color}"${opacity < 1 ? ` fill-opacity="${opacity}"` : ''}/>`);
  }

  line(x1: number, y1: number, x2: number, y2: number, color: string, width: number): void {
    this.parts.push(`<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" stroke="${color}" stroke-width="${n(width)}" stroke-linecap="round"/>`);
  }

  frame(inset: number, color: string, width: number): void {
    this.parts.push(
      `<rect x="${n(inset)}" y="${n(inset)}" width="${n(CARD.width - 2 * inset)}" height="${n(CARD.height - 2 * inset)}" fill="none" stroke="${color}" stroke-width="${n(width)}"/>`,
    );
  }

  /** Texte réduit automatiquement s'il dépasse, puis tronqué au minimum lisible. */
  text(value: string | undefined, o: TextOptions): number {
    if (!value) return 0;
    const family = o.font === 'heading' ? this.input.typography.heading : this.input.typography.body;
    const font = getFont(family);
    const weight = o.weight ?? (o.font === 'heading' ? font?.weight ?? 700 : 400);
    let text = value.normalize('NFC');
    const style = (size: number): TextStyle => ({ family, weight, size, letterSpacing: o.letterSpacing ?? 0 });
    let size = o.size;
    let width = this.engine.measure(text, style(size));
    while (width > o.maxWidth && size > MIN_TEXT_SIZE) {
      size = Math.max(MIN_TEXT_SIZE, size * 0.94);
      width = this.engine.measure(text, style(size));
    }
    while (width > o.maxWidth && text.length > 1) {
      text = `${text.slice(0, -2).trimEnd()}…`;
      width = this.engine.measure(text, style(size));
    }
    const x = o.anchor === 'middle' ? o.x - width / 2 : o.x;
    this.boxes.push({ x, y: o.y - size * 0.78, width, height: size * 0.98, kind: 'text' });
    if (this.engine.outline) {
      this.parts.push(`<path d="${this.engine.outline(text, style(size), x, o.y)}" fill="${o.color}"/>`);
    } else {
      this.parts.push(
        `<text x="${n(x)}" y="${n(o.y)}" font-family="${escapeXml(`'${family}', ${font?.fallback ?? 'sans-serif'}`)}" font-size="${n(size)}" font-weight="${weight}" fill="${o.color}"` +
          (o.letterSpacing ? ` letter-spacing="${n(o.letterSpacing * size)}"` : '') +
          `>${escapeXml(text)}</text>`,
      );
    }
    return size;
  }

  /** Logo (ou variante) ajusté dans un cadre, sans déformation ; version claire sur fond coloré. */
  logo(variant: LogoVariant, x: number, y: number, w: number, h: number, options: { align?: 'start' | 'middle'; onDark?: boolean } = {}): void {
    const align = options.align ?? 'middle';
    const rendered = renderLogoSvg(this.input.logo, variant, this.engine, { onDark: options.onDark });
    const scale = Math.min(w / rendered.width, h / rendered.height);
    const dw = rendered.width * scale;
    const dh = rendered.height * scale;
    const dx = align === 'middle' ? x + (w - dw) / 2 : x;
    const dy = y + (h - dh) / 2;
    this.boxes.push({ x: dx, y: dy, width: dw, height: dh, kind: 'logo' });
    this.parts.push(
      rendered.svg
        .replace(/^<svg[^>]*>/, `<svg x="${n(dx)}" y="${n(dy)}" width="${n(dw)}" height="${n(dh)}" viewBox="0 0 ${rendered.width} ${rendered.height}">`)
        .replace(/<title>.*?<\/title>/, ''),
    );
  }

  /** QR code vers WhatsApp ou le site (US-51) ; rien si la cible est absente. */
  qr(x: number, y: number, size: number, color: string, background: string): boolean {
    const content = qrContent(this.input.fields, this.input.qr);
    if (!content) return false;
    const { d, size: modules } = qrPath(content);
    this.boxes.push({ x, y, width: size, height: size, kind: 'qr' });
    this.parts.push(
      `<g transform="translate(${n(x)} ${n(y)}) scale(${n(size / modules)})"><rect width="${modules}" height="${modules}" rx="1.5" fill="${background}"/><path d="${d}" fill="${color}" shape-rendering="crispEdges"/></g>`,
    );
    return true;
  }

  icon(name: keyof typeof ICONS, x: number, y: number, size: number, color: string): void {
    this.boxes.push({ x, y, width: size, height: size, kind: 'icon' });
    const nodes = ICONS[name]
      .map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).filter(([k]) => k !== 'key').map(([k, v]) => `${k}="${escapeXml(String(v))}"`).join(' ')}/>`)
      .join('');
    this.parts.push(
      `<g transform="translate(${n(x)} ${n(y)}) scale(${n(size / 24)})" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${nodes}</g>`,
    );
  }

  /** Coordonnées avec pictogrammes, de haut en bas. Renvoie la position après la dernière ligne. */
  contacts(o: { x: number; y: number; maxWidth: number; color: string; iconColor: string; size?: number; gap?: number; centered?: boolean; withAddress?: boolean }): number {
    const f = this.input.fields;
    const size = o.size ?? 2.35;
    const gap = o.gap ?? 3.7;
    const lines: [keyof typeof ICONS, string | undefined][] = [
      ['phone', f.phone],
      ['mail', f.email],
      ['web', f.website?.replace(/^https?:\/\//, '')],
      ...(o.withAddress === false ? [] : ([['pin', f.address]] as [keyof typeof ICONS, string | undefined][])),
    ];
    let y = o.y;
    for (const [icon, value] of lines) {
      if (!value) continue;
      if (o.centered) {
        this.text(value, { x: o.x, y, size, font: 'body', color: o.color, anchor: 'middle', maxWidth: o.maxWidth });
      } else {
        this.icon(icon, o.x, y - size * 0.85, size * 1.05, o.iconColor);
        this.text(value, { x: o.x + size * 1.65, y, size, font: 'body', color: o.color, maxWidth: o.maxWidth - size * 1.65 });
      }
      y += gap;
    }
    return y;
  }
}

/** Couleur de texte lisible sur un fond donné (WCAG AA). */
function onColor(background: string, text: string): string {
  if (contrastRatio('#ffffff', background) >= 4.5) return '#ffffff';
  if (contrastRatio(text, background) >= 4.5) return text;
  return contrastRatio('#000000', background) >= contrastRatio('#ffffff', background) ? '#000000' : '#ffffff';
}

/** Couleur d'accent lisible (3:1, éléments graphiques et gros texte) sur un fond, sinon repli. */
function accentOn(accent: string, background: string, fallback: string): string {
  return contrastRatio(accent, background) >= 3 ? accent : fallback;
}

export function renderBusinessCard(
  input: BusinessCardInput,
  side: CardSide,
  engine: TextEngine = approximateTextEngine,
  options: RenderCardOptions = {},
): RenderedCard {
  const template = getCardTemplate(input.templateId) ?? BUSINESS_CARD_TEMPLATES[0]!;
  const color = (role: PaletteRole) => input.colors.find((c) => c.role === role)?.hex ?? '#000000';
  const c = { primary: color('primary'), secondary: color('secondary'), accent: color('accent'), background: color('background'), text: color('text') };
  const vivid = template.tone === 'couleur';
  const canvas = new Canvas(input, engine);
  const f = input.fields;

  /** Recto en version couleur : fond de la couleur principale et logo clair. */
  const frontBg = vivid ? c.primary : '#ffffff';
  const ink = onColor(frontBg, c.text);
  const logo = (variant: LogoVariant, x: number, y: number, w: number, h: number, onDark = vivid, align: 'start' | 'middle' = 'middle') =>
    canvas.logo(variant, x, y, w, h, { onDark, align });

  /** Bloc nom + fonction + coordonnées du verso, aligné à gauche. */
  const details = (x: number, y: number, maxWidth: number, bg: string) => {
    const textColor = onColor(bg, c.text);
    canvas.text(f.fullName, { x, y, size: 4.3, font: 'heading', color: textColor, maxWidth });
    canvas.text(f.jobTitle, { x, y: y + 4.4, size: 2.6, font: 'body', weight: 600, color: accentOn(c.primary, bg, textColor), maxWidth });
    return canvas.contacts({ x, y: y + 11.5, maxWidth, color: textColor, iconColor: accentOn(c.primary, bg, textColor) });
  };
  const qrRight = (x = 61, y = 18.5, size = 18) => canvas.qr(x, y, size, c.text, '#ffffff');

  if (side === 'front') {
    canvas.fill(frontBg);
    switch (template.layout) {
      case 'classique':
        logo('color', 12.5, 12, 60, 31);
        break;
      case 'bandeau': {
        canvas.rect(-3, -3, 27, 61, vivid ? c.secondary : c.primary);
        logo('icon-only', 4, 17.5, 16, 20, true);
        logo('color', 29, 14, 50, 27);
        break;
      }
      case 'bandeau-bas': {
        const band = vivid ? '#ffffff' : c.primary;
        canvas.rect(-3, 43, 91, 15, band);
        logo('color', 12.5, 6, 60, 31);
        canvas.text(f.website?.replace(/^https?:\/\//, '') ?? f.phone, { x: 42.5, y: 50, size: 2.6, font: 'body', weight: 600, color: onColor(band, c.primary), anchor: 'middle', maxWidth: 76 });
        break;
      }
      case 'diagonale':
        canvas.shape('M56 -3L88 -3L88 58L44 58Z', vivid ? c.secondary : c.primary);
        canvas.shape('M72 -3L88 -3L88 14Z', c.accent);
        logo('color', 5, 12, 37, 31);
        break;
      case 'cercle':
        canvas.circle(80, -4, 31, vivid ? c.secondary : c.primary);
        canvas.circle(6, 59, 11, c.accent, 0.9);
        logo('color', 6, 18, 44, 24, vivid, 'start');
        break;
      case 'minimal':
        canvas.rect(6, 6, 1.4, 13, c.accent);
        logo('horizontal', 10, 6, 40, 13, vivid, 'start');
        canvas.text(f.fullName, { x: 6, y: 43, size: 4.6, font: 'heading', color: ink, maxWidth: 73 });
        canvas.text(f.jobTitle, { x: 6, y: 48.2, size: 2.6, font: 'body', color: vivid ? ink : accentOn(c.primary, frontBg, ink), maxWidth: 73 });
        break;
      case 'cadre':
        canvas.frame(3, vivid ? '#ffffff' : c.secondary, 0.35);
        logo('color', 14, 11, 57, 33);
        break;
      case 'moitie': {
        const left = vivid ? c.secondary : c.primary;
        const right = vivid ? c.primary : '#ffffff';
        canvas.rect(-3, -3, 45.5, 61, left);
        canvas.rect(42.5, -3, 45.5, 61, right);
        logo('icon-only', 7, 13, 29, 29, true);
        const rightInk = onColor(right, c.text);
        canvas.text(f.fullName, { x: 47, y: 26, size: 4.2, font: 'heading', color: rightInk, maxWidth: 34 });
        canvas.text(f.jobTitle, { x: 47, y: 31, size: 2.5, font: 'body', color: accentOn(c.primary, right, rightInk), maxWidth: 34 });
        canvas.rect(47, 34, 8, 0.8, c.accent);
        break;
      }
      case 'vague':
        canvas.shape('M-3 44C20 37 45 53 88 40L88 58L-3 58Z', vivid ? c.secondary : c.primary);
        canvas.shape('M-3 49C25 42 55 57 88 46L88 58L-3 58Z', c.accent, 0.75);
        logo('color', 12.5, 6, 60, 29);
        break;
      case 'centre':
        logo('vertical', 17, 6, 51, 34);
        canvas.text(f.website?.replace(/^https?:\/\//, ''), { x: 42.5, y: 47.5, size: 2.4, font: 'body', weight: 600, color: vivid ? ink : accentOn(c.primary, frontBg, ink), anchor: 'middle', maxWidth: 70 });
        break;
    }
  } else {
    const backBg = template.layout === 'minimal' || template.layout === 'centre' ? (vivid ? c.primary : c.background) : '#ffffff';
    canvas.fill(backBg);
    const backInk = onColor(backBg, c.text);
    switch (template.layout) {
      case 'classique':
        canvas.rect(-3, -3, 4.6, 61, c.primary);
        details(7, 13.5, qrRight() ? 51 : 72, backBg);
        break;
      case 'bandeau':
        canvas.rect(-3, -3, 6, 61, c.primary);
        details(8, 13.5, qrRight() ? 50 : 71, backBg);
        break;
      case 'bandeau-bas':
        canvas.rect(-3, -3, 91, 4.2, c.primary);
        details(6, 12.5, qrRight(61, 28) ? 52 : 73, backBg);
        break;
      case 'diagonale':
        canvas.shape('M70 58L88 58L88 38Z', c.primary);
        details(6, 12.5, qrRight(60, 12) ? 51 : 73, backBg);
        break;
      case 'cercle':
        canvas.circle(88, 58, 17, c.primary);
        details(6, 12.5, qrRight(60, 9) ? 51 : 73, backBg);
        break;
      case 'minimal': {
        const hasQr = canvas.qr(33.5, 7, 18, c.text, '#ffffff');
        if (hasQr) {
          canvas.text(input.qr === 'whatsapp' ? 'Scannez pour nous écrire sur WhatsApp' : 'Scannez pour visiter notre site', { x: 42.5, y: 30.5, size: 2.2, font: 'body', color: backInk, anchor: 'middle', maxWidth: 74 });
        }
        canvas.contacts({ x: 42.5, y: hasQr ? 37 : 20, maxWidth: 74, color: backInk, iconColor: backInk, centered: true, gap: 3.9, withAddress: !hasQr });
        break;
      }
      case 'cadre': {
        canvas.frame(3, c.secondary, 0.35);
        const hasQr = canvas.qr(65, 35, 14, c.text, '#ffffff');
        const width = hasQr ? 44 : 70;
        const cx = 42.5;
        // À l'intérieur du cadre, avec une marge (le cadre suit la ligne de sécurité).
        canvas.text(f.fullName, { x: cx, y: 15, size: 4.2, font: 'heading', color: backInk, anchor: 'middle', maxWidth: 70 });
        canvas.text(f.jobTitle, { x: cx, y: 20, size: 2.5, font: 'body', color: accentOn(c.primary, backBg, backInk), anchor: 'middle', maxWidth: 70 });
        canvas.line(cx - 6, 23.5, cx + 6, 23.5, c.accent, 0.5);
        canvas.contacts({ x: cx, y: 29, maxWidth: width, color: backInk, iconColor: backInk, centered: true, withAddress: !hasQr });
        break;
      }
      case 'moitie':
        canvas.rect(-3, -3, 91, 4.2, c.primary);
        canvas.rect(-3, 54.8, 91, 4.2, c.accent);
        details(6, 13, qrRight(61, 17) ? 52 : 73, backBg);
        break;
      case 'vague':
        canvas.shape('M-3 -3L88 -3L88 6C60 11 30 1 -3 8Z', c.primary);
        details(6, 17.5, qrRight(61, 19) ? 52 : 73, backBg);
        break;
      case 'centre': {
        const hasQr = canvas.qr(66, 36, 13, c.text, '#ffffff');
        canvas.text(f.fullName, { x: 42.5, y: 13.5, size: 4.3, font: 'heading', color: backInk, anchor: 'middle', maxWidth: 74 });
        canvas.text(f.jobTitle, { x: 42.5, y: 18.5, size: 2.5, font: 'body', color: vivid ? backInk : accentOn(c.primary, backBg, backInk), anchor: 'middle', maxWidth: 74 });
        canvas.line(36.5, 22, 48.5, 22, vivid ? '#ffffff' : c.accent, 0.5);
        canvas.contacts({ x: 42.5, y: 27.5, maxWidth: hasQr ? 44 : 74, color: backInk, iconColor: backInk, centered: true });
        break;
      }
    }
  }

  if (options.watermark) watermark(canvas, engine);
  if (options.guides) guides(canvas);

  const { width, height, bleed } = options.bleed
    ? { ...CARD_WITH_BLEED, bleed: 0 }
    : { width: CARD.width, height: CARD.height, bleed: CARD.bleed };
  const viewBox = options.bleed ? `0 0 ${CARD_WITH_BLEED.width} ${CARD_WITH_BLEED.height}` : `${bleed} ${bleed} ${CARD.width} ${CARD.height}`;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${width}mm" height="${height}mm">` +
    `<g transform="translate(${CARD.bleed} ${CARD.bleed})">${canvas.parts.join('')}</g></svg>`;
  return { svg, contentBoxes: canvas.boxes };
}

function watermark(canvas: Canvas, engine: TextEngine): void {
  const style: TextStyle = { family: 'Inter', weight: 700, size: 3.2, letterSpacing: 0.05 };
  const label = 'BRAND OS · GRATUIT';
  const marks: string[] = [];
  const step = engine.measure(label, style) + 8;
  for (let y = 4; y < 75; y += 10) {
    for (let x = -60; x < 110; x += step) {
      marks.push(engine.outline ? `<path d="${engine.outline(label, style, x, y)}"/>` : `<text x="${n(x)}" y="${n(y)}" font-family="Inter, sans-serif" font-weight="700" font-size="3.2">${label}</text>`);
    }
  }
  canvas.parts.push(`<g fill="#808080" fill-opacity="0.3" transform="rotate(-20 42.5 27.5)">${marks.join('')}</g>`);
}

/** Repères d'impression de l'éditeur : coupe (trait plein) et zone de sécurité (pointillés). */
function guides(canvas: Canvas): void {
  canvas.parts.push(
    `<rect x="0" y="0" width="${CARD.width}" height="${CARD.height}" fill="none" stroke="#e11d48" stroke-width="0.25"/>` +
      `<rect x="${CARD.safe}" y="${CARD.safe}" width="${CARD.width - 2 * CARD.safe}" height="${CARD.height - 2 * CARD.safe}" fill="none" stroke="#2563eb" stroke-width="0.2" stroke-dasharray="1 0.8"/>`,
  );
}

function n(value: number): string {
  return String(Math.round(value * 1000) / 1000);
}
