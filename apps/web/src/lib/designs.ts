import type { BusinessCardComposition, BusinessCardInput } from "@brand-os/shared";
import { api } from "./api";
import type { Brand } from "./brand";

export interface DesignView {
  id: string;
  brandId: string;
  name: string;
  composition: BusinessCardComposition;
  version: number;
  updatedAt: string;
}

/** Marque active, avec son identité enregistrée (logo, couleurs, polices). */
export async function fetchActiveBrand(): Promise<Brand | null> {
  const { brands } = await api<{ brands: Brand[] }>("/brands");
  return brands[0] ?? null;
}

/** Données de rendu d'une carte : composition + Brand Kit. */
export function cardInput(brand: Brand, composition: Pick<BusinessCardComposition, "templateId" | "fields" | "qr">): BusinessCardInput | null {
  if (!brand.logo || !brand.palette || !brand.typography) return null;
  return {
    templateId: composition.templateId,
    fields: composition.fields,
    qr: composition.qr,
    logo: brand.logo,
    colors: brand.palette.colors,
    typography: brand.typography,
  };
}
