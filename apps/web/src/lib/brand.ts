import type { BrandBrief, CreativeBrief, LogoSpec, Palette, PaletteColor } from "@brand-os/shared";

export interface Brand {
  id: string;
  name: string;
  slogan: string | null;
  brief: BrandBrief | null;
  logo: LogoSpec | null;
  version: number;
  palette: { colors: PaletteColor[] } | null;
  typography: { heading: string; body: string } | null;
}

export interface Generation {
  generationId: string;
  attempt: number;
  creative: CreativeBrief;
  palettes: Palette[];
  proposals: LogoSpec[];
  quota: { used: number; limit: number | null; warning: boolean };
}
