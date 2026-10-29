import type { Role, Sector } from "@brand-os/shared";

export const SECTOR_LABELS: Record<Sector, string> = {
  restauration: "Restauration et alimentation",
  "beaute-mode": "Beauté et mode",
  commerce: "Commerce de détail",
  btp: "BTP",
  "services-entreprises": "Services aux entreprises",
  education: "Éducation privée",
  evenementiel: "Événementiel",
  autre: "Autre secteur",
};

export const SECTOR_OPTIONS = Object.entries(SECTOR_LABELS).map(([value, label]) => ({ value, label }));

export const ROLE_LABELS: Record<Role, string> = {
  OWNER: "Propriétaire",
  ADMIN: "Administrateur",
  DESIGNER: "Designer",
  EDITOR: "Éditeur",
  ACCOUNTANT: "Comptable",
  VIEWER: "Lecteur",
  EXTERNAL_CLIENT: "Client externe",
};

export function formatXof(amount: number): string {
  return `${new Intl.NumberFormat("fr-FR").format(amount)} FCFA`;
}
