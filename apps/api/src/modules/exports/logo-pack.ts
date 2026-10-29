import { Resvg } from '@resvg/resvg-js';
import {
  LOGO_VARIANTS,
  PALETTE_ROLE_LABELS,
  renderLogoSvg,
  type LogoSpec,
  type LogoVariant,
  type PaletteColor,
  type TextEngine,
} from '@brand-os/shared';
import { strToU8, zipSync, type Zippable } from 'fflate';

// Pack de logos — US-31 : tous les logos, dans tous les formats autorisés par l'offre.

const VARIANT_FILE_NAMES: Record<LogoVariant, string> = {
  color: 'couleur',
  monochrome: 'monochrome',
  light: 'clair-fond-sombre',
  dark: 'sombre',
  'icon-only': 'icone',
  horizontal: 'horizontal',
  vertical: 'vertical',
};

/** Largeur des PNG : 2000 px, assez pour une impression A4 à 300 dpi sur ~17 cm. */
export const PNG_WIDTH = 2000;

export interface LogoPackInput {
  slug: string;
  name: string;
  logo: LogoSpec;
  colors: PaletteColor[];
  version: number;
  includesVector: boolean;
  watermarked: boolean;
}

export function buildLogoPack(input: LogoPackInput, engine: TextEngine): Uint8Array {
  const files: Zippable = {};
  const dir = `${input.slug}-logos`;
  const variants = LOGO_VARIANTS.filter(
    // Pour un logo « nom seul », la variante icône n'existe pas.
    (v) => !(v === 'icon-only' && input.logo.layout === 'wordmark'),
  );

  for (const variant of variants) {
    const { svg } = renderLogoSvg(input.logo, variant, engine);
    const fileBase = `${input.slug}-${VARIANT_FILE_NAMES[variant]}`;
    if (input.includesVector) files[`${dir}/svg/${fileBase}.svg`] = strToU8(svg);
    const png = rasterize(input.watermarked ? withWatermark(svg, engine) : svg, variant === 'icon-only' ? 1024 : PNG_WIDTH);
    files[`${dir}/png/${fileBase}.png`] = [png, { level: 0 }];
  }

  files[`${dir}/couleurs.txt`] = strToU8(colorsText(input));
  files[`${dir}/LISEZMOI.txt`] = strToU8(readme(input, variants));
  return zipSync(files, { level: 6 });
}

/** SVG → PNG transparent. Le texte est déjà vectorisé : aucun accès aux polices système. */
export function rasterize(svg: string, width: number): Uint8Array {
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: width }, font: { loadSystemFonts: false } });
  return resvg.render().asPng();
}

/** Offre Gratuite : filigrane diagonal répété, semi-transparent (§6.2). */
export function withWatermark(svg: string, engine: TextEngine): string {
  const viewBox = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg);
  if (!viewBox) return svg;
  const [width, height] = [Number(viewBox[1]), Number(viewBox[2])];
  const style = { family: 'Inter', weight: 700, size: Math.max(10, height / 7), letterSpacing: 0.05 };
  const label = 'BRAND OS · GRATUIT';
  const step = engine.measure(label, style) + style.size * 2;
  const marks: string[] = [];
  for (let y = style.size; y < height + width; y += style.size * 3.2) {
    for (let x = -width; x < width * 1.5; x += step) {
      marks.push(`<path d="${engine.outline!(label, style, x, y)}"/>`);
    }
  }
  const layer =
    `<g fill="#7f7f7f" fill-opacity="0.32" transform="rotate(-24 ${width / 2} ${height / 2})">${marks.join('')}</g>`;
  return svg.replace(/<\/svg>$/, `${layer}</svg>`);
}

function colorsText(input: LogoPackInput): string {
  const lines = input.colors.map(
    (c) =>
      `${PALETTE_ROLE_LABELS[c.role].padEnd(12)} HEX ${c.hex.toUpperCase()}   RGB ${c.rgb.join(', ').padEnd(13)}   CMJN ${c.cmyk.join(', ')}`,
  );
  return [
    `Couleurs de la marque ${input.name} — version ${input.version}`,
    '',
    ...lines,
    '',
    'Les valeurs CMJN sont indicatives : faites-les valider par votre imprimeur.',
    '',
  ].join('\r\n');
}

function readme(input: LogoPackInput, variants: readonly LogoVariant[]): string {
  return [
    `Logos de ${input.name} — Brand Kit, version ${input.version}`,
    '',
    'Contenu :',
    ...(input.includesVector
      ? ['- svg/ : fichiers vectoriels, pour l’impression et les grands formats (enseigne, banderole).']
      : []),
    `- png/ : images à fond transparent (${PNG_WIDTH} px de large), pour le web, les réseaux sociaux et les documents.`,
    '- couleurs.txt : codes HEX, RGB et CMJN de vos couleurs.',
    '',
    'Variantes :',
    ...variants.map((v) => `- ${VARIANT_FILE_NAMES[v]}`),
    '',
    ...(input.watermarked
      ? [
          'Ces fichiers portent un filigrane (offre Gratuite).',
          'Passez à l’offre Starter pour des fichiers sans filigrane et les versions vectorielles SVG.',
          '',
        ]
      : []),
    'Règles d’usage : ne déformez pas le logo, ne changez pas ses couleurs, laissez un espace libre autour.',
    'Le détail figure dans votre charte graphique.',
    '',
  ].join('\r\n');
}
