import { z } from 'zod';
import { HEX_PATTERN } from './color.js';
import { getFont, isAllowedFont } from './fonts.js';
import { getIcon, isKnownIcon } from './icons.js';

// Un logo est une donnée, pas une image (§1.4) : la spécification ci-dessous est
// stockée, et le SVG en est dérivé à la demande (aperçu, variantes, exports).

export const LOGO_LAYOUTS = ['icon-left', 'icon-top', 'monogram', 'wordmark'] as const;
export type LogoLayout = (typeof LOGO_LAYOUTS)[number];

export const LOGO_LAYOUT_LABELS: Record<LogoLayout, string> = {
  'icon-left': 'Icône à gauche',
  'icon-top': 'Icône au-dessus',
  monogram: 'Monogramme',
  wordmark: 'Nom seul',
};

export const ICON_CONTAINERS = ['none', 'circle', 'rounded'] as const;
export type IconContainer = (typeof ICON_CONTAINERS)[number];

const hex = z.string().trim().toLowerCase().regex(HEX_PATTERN, 'Couleur au format #rrggbb attendue');

export const logoSpecSchema = z
  .object({
    schemaVersion: z.literal(1),
    name: z.string().trim().min(1).max(40),
    slogan: z.string().trim().max(80).optional(),
    layout: z.enum(LOGO_LAYOUTS),
    iconId: z.string().refine(isKnownIcon, 'Icône inconnue').nullable(),
    iconContainer: z.enum(ICON_CONTAINERS),
    font: z.string().refine((f) => isAllowedFont(f, 'heading'), 'Police non autorisée'),
    uppercase: z.boolean(),
    letterSpacing: z.number().min(-0.05).max(0.3),
    colors: z.object({ icon: hex, text: hex, slogan: hex }),
  })
  .refine((s) => s.layout === 'monogram' || s.layout === 'wordmark' || s.iconId !== null, {
    message: 'Cette disposition nécessite une icône',
    path: ['iconId'],
  });
export type LogoSpec = z.infer<typeof logoSpecSchema>;

/** Variantes générées automatiquement — US-24. */
export const LOGO_VARIANTS = ['color', 'monochrome', 'light', 'dark', 'icon-only', 'horizontal', 'vertical'] as const;
export type LogoVariant = (typeof LOGO_VARIANTS)[number];

export const LOGO_VARIANT_LABELS: Record<LogoVariant, string> = {
  color: 'Couleur',
  monochrome: 'Monochrome',
  light: 'Clair (sur fond sombre)',
  dark: 'Sombre',
  'icon-only': 'Icône seule',
  horizontal: 'Horizontal',
  vertical: 'Vertical',
};

export interface RenderedLogo {
  svg: string;
  width: number;
  height: number;
}

/**
 * Moteur de texte : mesure et, en option, vectorisation du texte.
 * - navigateur : mesure par canvas avec les polices chargées (aperçu fidèle) ;
 * - serveur : mesure et tracés à partir des fichiers de police (export, RG-23) ;
 * - à défaut : estimation à partir de la largeur moyenne des caractères.
 */
export interface TextEngine {
  /** Largeur du texte en unités SVG, espacement des lettres compris. */
  measure(text: string, style: TextStyle): number;
  /** Tracé SVG (attribut d) du texte, ligne de base en (x, y), aligné à gauche. */
  outline?(text: string, style: TextStyle, x: number, y: number): string;
}

export interface TextStyle {
  family: string;
  weight: number;
  size: number;
  /** En em */
  letterSpacing: number;
}

export const approximateTextEngine: TextEngine = {
  measure(text, style) {
    const font = getFont(style.family);
    const upper = text === text.toUpperCase() && /[A-Z]/.test(text);
    const charWidth = (font?.charWidth ?? 0.6) * (upper ? 1.12 : 1) * (style.weight < 500 ? 0.94 : 1);
    return [...text].length * style.size * (charWidth + style.letterSpacing);
  },
};

const NAME_SIZE = 44;
const SLOGAN_RATIO = 0.36;
const ICON_SIZE = 72;
const GAP = 18;
const PADDING = 12;
/** Les noms ne dépassent pas cette largeur : au-delà, la taille est réduite (contrôle qualité §8.1). */
const MAX_NAME_WIDTH = 420;

/** Rendu SVG d'un logo ou d'une de ses variantes. Tout texte utilisateur est échappé. */
export function renderLogoSvg(
  spec: LogoSpec,
  variant: LogoVariant = 'color',
  engine: TextEngine = approximateTextEngine,
  /** Version claire, quelle que soit la disposition (icône seule, verticale…), pour un fond coloré. */
  options: { onDark?: boolean } = {},
): RenderedLogo {
  const colors = variantColors(spec, options.onDark ? 'light' : variant);
  const layout = variantLayout(spec, variant);
  const font = getFont(spec.font);
  const fontStack = font ? `'${font.family}', ${font.fallback}` : 'sans-serif';
  const weight = font?.weight ?? 700;
  const name = (spec.uppercase || font?.uppercase ? spec.name.toUpperCase() : spec.name).normalize('NFC');
  const slogan = layout === 'icon-only' ? undefined : spec.slogan?.normalize('NFC');

  const nameStyle = (size: number): TextStyle => ({ family: spec.font, weight, size, letterSpacing: spec.letterSpacing });
  const naturalWidth = engine.measure(name, nameStyle(NAME_SIZE));
  const nameSize = Math.max(24, Math.min(NAME_SIZE, (NAME_SIZE * MAX_NAME_WIDTH) / Math.max(naturalWidth, 1)));
  const nameWidth = engine.measure(name, nameStyle(nameSize));
  const sloganStyle: TextStyle = { family: spec.font, weight: 400, size: Math.max(13, nameSize * SLOGAN_RATIO), letterSpacing: 0.02 };
  const sloganWidth = slogan ? engine.measure(slogan, sloganStyle) : 0;
  const textBlockWidth = Math.max(nameWidth, sloganWidth);
  const textBlockHeight = nameSize + (slogan ? sloganStyle.size * 1.6 : 0);

  /** Texte vectorisé si le moteur le permet, sinon élément <text>. */
  const text = (value: string, style: TextStyle, x: number, y: number, fill: string, anchor: 'start' | 'middle', width: number) => {
    const startX = anchor === 'middle' ? x - width / 2 : x;
    if (engine.outline) return `<path d="${engine.outline(value, style, startX, y)}" fill="${fill}"/>`;
    return (
      `<text x="${fmt(startX)}" y="${fmt(y)}" font-family="${escapeXml(fontStack)}" font-size="${fmt(style.size)}" font-weight="${style.weight}" fill="${fill}"` +
      (style.letterSpacing ? ` letter-spacing="${fmt(style.letterSpacing * style.size)}"` : '') +
      `>${escapeXml(value)}</text>`
    );
  };
  const nameText = (x: number, y: number, anchor: 'start' | 'middle') =>
    text(name, nameStyle(nameSize), x, y, colors.text, anchor, nameWidth);
  const sloganText = (x: number, y: number, anchor: 'start' | 'middle') =>
    slogan ? text(slogan, sloganStyle, x, y, colors.slogan, anchor, sloganWidth) : '';

  const symbol = (x: number, y: number, size: number) => {
    if (spec.layout !== 'monogram') return iconMarkup(spec.iconId, x, y, size, colors.icon, colors.onIcon, spec.iconContainer);
    const letters = initials(spec.name);
    const style: TextStyle = { family: spec.font, weight, size: size * (letters.length > 1 ? 0.42 : 0.55), letterSpacing: 0 };
    const shape = spec.iconContainer === 'none' ? 'circle' : spec.iconContainer;
    return (
      containerMarkup(shape, x, y, size, colors.icon) +
      text(letters, style, x + size / 2, y + size / 2 + style.size * 0.35, colors.onIcon, 'middle', engine.measure(letters, style))
    );
  };

  const parts: string[] = [];
  let width: number;
  let height: number;
  const hasSymbol = layout !== 'wordmark' && (spec.iconId !== null || spec.layout === 'monogram');

  if (layout === 'icon-only') {
    width = height = ICON_SIZE + PADDING * 2;
    parts.push(symbol(PADDING, PADDING, ICON_SIZE));
  } else if (layout === 'icon-top' && hasSymbol) {
    width = Math.max(ICON_SIZE, textBlockWidth) + PADDING * 2;
    height = ICON_SIZE + GAP + textBlockHeight + PADDING * 2;
    const cx = width / 2;
    const baseline = PADDING + ICON_SIZE + GAP + nameSize * 0.8;
    parts.push(symbol(cx - ICON_SIZE / 2, PADDING, ICON_SIZE), nameText(cx, baseline, 'middle'), sloganText(cx, baseline + sloganStyle.size * 1.6, 'middle'));
  } else if (hasSymbol) {
    // icon-left, monogramme, horizontal
    const blockHeight = Math.max(ICON_SIZE, textBlockHeight);
    width = ICON_SIZE + GAP + textBlockWidth + PADDING * 2;
    height = blockHeight + PADDING * 2;
    const textX = PADDING + ICON_SIZE + GAP;
    const baseline = PADDING + (blockHeight - textBlockHeight) / 2 + nameSize * 0.8;
    parts.push(
      symbol(PADDING, PADDING + (blockHeight - ICON_SIZE) / 2, ICON_SIZE),
      nameText(textX, baseline, 'start'),
      sloganText(textX, baseline + sloganStyle.size * 1.6, 'start'),
    );
  } else {
    // Nom seul, avec un trait d'accent sous le nom
    width = textBlockWidth + PADDING * 2;
    height = textBlockHeight + nameSize * 0.3 + PADDING * 2;
    const cx = width / 2;
    const baseline = PADDING + nameSize * 0.8;
    const barY = baseline + nameSize * 0.22;
    parts.push(
      nameText(cx, baseline, 'middle'),
      `<rect x="${fmt(cx - nameSize * 0.6)}" y="${fmt(barY)}" width="${fmt(nameSize * 1.2)}" height="${fmt(Math.max(3, nameSize * 0.08))}" rx="2" fill="${colors.icon}"/>`,
      sloganText(cx, barY + sloganStyle.size * 1.9, 'middle'),
    );
  }

  const w = Math.ceil(width);
  const h = Math.ceil(height);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${escapeXml(spec.name)}">` +
    `<title>${escapeXml(spec.name)}</title>${parts.join('')}</svg>`;
  return { svg, width: w, height: h };
}

function variantLayout(spec: LogoSpec, variant: LogoVariant): LogoLayout | 'icon-only' {
  if (variant === 'icon-only') return spec.layout === 'wordmark' ? 'wordmark' : 'icon-only';
  if (variant === 'horizontal') return spec.layout === 'wordmark' ? 'wordmark' : spec.layout === 'monogram' ? 'monogram' : 'icon-left';
  if (variant === 'vertical') return spec.layout === 'wordmark' ? 'wordmark' : 'icon-top';
  return spec.layout;
}

function variantColors(spec: LogoSpec, variant: LogoVariant) {
  if (variant === 'monochrome' || variant === 'dark') {
    const ink = variant === 'monochrome' ? '#000000' : spec.colors.text;
    return { icon: ink, text: ink, slogan: ink, onIcon: '#ffffff' };
  }
  if (variant === 'light') return { icon: '#ffffff', text: '#ffffff', slogan: '#ffffff', onIcon: spec.colors.icon };
  return { ...spec.colors, onIcon: '#ffffff' };
}

function iconMarkup(
  iconId: string | null,
  x: number,
  y: number,
  size: number,
  color: string,
  onContainer: string,
  container: IconContainer,
): string {
  const icon = iconId ? getIcon(iconId) : undefined;
  if (!icon) return '';
  const inner = container === 'none' ? size : size * 0.58;
  const offset = (size - inner) / 2;
  const stroke = container === 'none' ? color : onContainer;
  const scale = inner / 24;
  const nodes = icon.node.map(([tag, attrs]) => `<${tag} ${attributes(attrs)}/>`).join('');
  return (
    containerMarkup(container, x, y, size, color) +
    `<g transform="translate(${fmt(x + offset)} ${fmt(y + offset)}) scale(${fmt(scale)})" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${nodes}</g>`
  );
}

function containerMarkup(container: IconContainer, x: number, y: number, size: number, color: string): string {
  if (container === 'circle') return `<circle cx="${fmt(x + size / 2)}" cy="${fmt(y + size / 2)}" r="${fmt(size / 2)}" fill="${color}"/>`;
  if (container === 'rounded') return `<rect x="${fmt(x)}" y="${fmt(y)}" width="${fmt(size)}" height="${fmt(size)}" rx="${fmt(size * 0.22)}" fill="${color}"/>`;
  return '';
}

/** Initiales du monogramme : « Chez Aïcha » → « CA », « Sodabi » → « S ». */
export function initials(name: string): string {
  const words = name
    .split(/[\s\-_'’]+/)
    .filter((w) => w.length > 0 && !/^(de|du|des|la|le|les|et|chez|l|d)$/i.test(w));
  const source = words.length > 0 ? words : [name];
  return source
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
}

function attributes(attrs: Record<string, string | number | undefined>): string {
  return Object.entries(attrs)
    .filter(([key, value]) => value !== undefined && /^[a-z-]+$/i.test(key) && key !== 'key')
    .map(([key, value]) => `${key}="${escapeXml(String(value))}"`)
    .join(' ');
}

export function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!);
}

function fmt(value: number): string {
  return String(Math.round(value * 100) / 100);
}
