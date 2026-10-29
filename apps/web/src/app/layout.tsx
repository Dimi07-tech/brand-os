import type { Metadata, Viewport } from "next";
import "./globals.css";

// Polices de l'interface (Bricolage Grotesque, Plus Jakarta Sans — licence OFL),
// embarquées dans public/fonts et déclarées dans globals.css : aucune dépendance
// réseau au build ni à l'affichage. Les fichiers « latin » sont préchargés.
const PRELOADED_FONTS = ["/fonts/bricolage-grotesque-latin-wght-normal.woff2", "/fonts/plus-jakarta-sans-latin-wght-normal.woff2"];

export const metadata: Metadata = {
  title: "Brand OS — votre identité visuelle, du logo à la facture",
  description:
    "Créez votre logo, vos couleurs et vos documents professionnels en quelques minutes, sans graphiste. Prix en FCFA, pensé pour le Bénin.",
};

export const viewport: Viewport = {
  themeColor: "#fbf7f1",
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className="h-full antialiased">
      <head>
        {PRELOADED_FONTS.map((href) => (
          <link key={href} rel="preload" href={href} as="font" type="font/woff2" crossOrigin="anonymous" />
        ))}
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
