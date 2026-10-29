import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  CreditCard,
  FileText,
  Layers,
  MessageCircleQuestion,
  Palette,
  PenTool,
  Smartphone,
  Sparkles,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { IDENTITY_PACK_PRICE_XOF, PLAN_DEFINITIONS, type Plan } from "@brand-os/shared";
import { BrandFonts } from "@/components/logo-preview";
import { HeroShowcase } from "@/components/marketing/hero-showcase";
import { LogoWall } from "@/components/marketing/logo-wall";
import { SiteHeader } from "@/components/marketing/site-header";
import { WorkspacePreview } from "@/components/marketing/workspace-preview";
import { ButtonLink, Wordmark } from "@/components/ui";
import { formatXof } from "@/lib/labels";
import { SHOWCASE_BRANDS } from "@/lib/showcase";

// Site vitrine — §5.3 : promesse, exemples de marques, tarifs, inscription.

const SHOWCASE_FONTS = [...new Set(SHOWCASE_BRANDS.map((b) => b.logo.font))];

const STEPS = [
  { icon: MessageCircleQuestion, title: "Répondez à 6 questions", text: "Votre nom, votre secteur, vos clients, vos valeurs, votre style et vos couleurs. Deux minutes suffisent." },
  { icon: Sparkles, title: "Choisissez votre logo", text: "6 propositions vectorielles, variées. D’autres en un clic. Vous ajustez le texte, la police et les couleurs." },
  { icon: Palette, title: "Votre Brand Kit est prêt", text: "Logo en 7 versions, palette HEX, RGB et CMJN, polices et charte graphique, réunis au même endroit." },
  { icon: FileText, title: "Créez vos supports", text: "Cartes de visite, factures et devis se remplissent automatiquement aux couleurs de votre marque." },
];

const FEATURES: { icon: typeof Layers; title: string; text: string; soon?: boolean }[] = [
  { icon: Layers, title: "Une seule source officielle", text: "Fini le logo envoyé par WhatsApp en basse qualité : toute l’équipe utilise les bons fichiers." },
  { icon: PenTool, title: "Logos vraiment vectoriels", text: "SVG nets à toutes les tailles, de l’icône d’application à l’enseigne, et PNG transparents." },
  { icon: BookOpen, title: "Charte graphique PDF", text: "Votre marque expliquée en 7 pages : règles d’usage, couleurs, polices et exemples." },
  { icon: CreditCard, title: "Cartes de visite", text: "20 modèles, recto verso, QR code WhatsApp, PDF prêt pour l’imprimeur.", soon: true },
  { icon: FileText, title: "Factures et devis", text: "Calculs en FCFA, TVA à 18 %, numérotation automatique sans doublon.", soon: true },
  { icon: Wallet, title: "Mobile Money", text: "Payez votre abonnement par MTN MoMo, Moov Money ou carte bancaire.", soon: true },
];

const PLANS: { plan: Plan; name: string; audience: string; highlights: string[]; featured?: boolean }[] = [
  { plan: "FREE", name: "Gratuit", audience: "Pour découvrir", highlights: ["1 marque", "12 générations IA par mois", "2 exports par mois (filigrane)", "3 factures ou devis par mois"] },
  { plan: "STARTER", name: "Starter", audience: "Entrepreneurs et indépendants", highlights: ["Logo en SVG, sans filigrane", "Charte graphique PDF", "60 générations IA par mois", "30 factures ou devis par mois"] },
  { plan: "PRO", name: "Pro", audience: "TPE et PME actives", highlights: ["2 marques, 3 membres", "Exports et factures illimités", "200 générations IA par mois", "Support e-mail et WhatsApp"], featured: true },
  { plan: "BUSINESS", name: "Business", audience: "PME avec une équipe", highlights: ["5 marques, 10 membres", "600 générations IA par mois", "50 Go de stockage", "Support prioritaire"] },
];

const FAQ = [
  {
    q: "Faut-il savoir dessiner ou installer un logiciel ?",
    a: "Non. Brand OS fonctionne dans le navigateur, sur smartphone comme sur ordinateur, même avec une connexion mobile lente. Vous répondez à des questions simples, nous faisons le reste.",
  },
  {
    q: "Puis-je utiliser mon logo librement ?",
    a: "Oui : vous recevez un droit d’usage commercial complet sur les logos créés avec Brand OS. Les icônes et polices proposées sont sous licence libre pour un usage commercial.",
  },
  {
    q: "Mon logo est-il unique ? Puis-je le déposer comme marque ?",
    a: "Un logo généré n’est pas garanti unique ni enregistrable. Avant un dépôt, faites une recherche d’antériorité auprès de l’OAPI (Organisation africaine de la propriété intellectuelle), compétente pour le Bénin.",
  },
  {
    q: "Mes factures seront-elles conformes à la DGI ?",
    a: "Brand OS met vos factures et devis en forme, avec toutes les mentions utiles (RCCM, IFU, TVA). Si votre entreprise est assujettie à la TVA, l’émission de factures normalisées via le dispositif e-MECeF reste à votre charge.",
  },
  {
    q: "Que se passe-t-il si j’arrête mon abonnement ?",
    a: "Vos données restent consultables pendant 90 jours, en lecture seule. Aucun fichier n’est supprimé pendant ce délai : vous avez le temps de tout récupérer.",
  },
  {
    q: "Mes données sont-elles protégées ?",
    a: "Chaque entreprise est strictement isolée des autres, les mots de passe sont chiffrés et les fichiers ne sont accessibles que par des liens temporaires. Nous respectons le Code du numérique béninois et l’APDP.",
  },
];

export default function HomePage() {
  return (
    <div className="flex min-h-dvh flex-col overflow-x-clip">
      <BrandFonts families={SHOWCASE_FONTS} />
      <SiteHeader />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative">
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_70%_20%,rgba(245,158,11,0.12),transparent_70%),radial-gradient(40%_40%_at_10%_80%,rgba(194,65,12,0.08),transparent_70%)]" />
          <div className="mx-auto grid max-w-7xl items-center gap-16 px-4 pb-24 pt-10 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:gap-12 lg:pb-32 lg:pt-16 2xl:max-w-[96rem]">
            <div className="text-center lg:text-left">
              <p className="animate-fade-up inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3.5 py-1.5 text-sm font-medium text-muted">
                <span className="flex overflow-hidden rounded-sm" aria-hidden>
                  <span className="h-3 w-1.5 bg-[#008751]" />
                  <span className="flex h-3 w-3 flex-col"><span className="flex-1 bg-[#fcd116]" /><span className="flex-1 bg-[#e8112d]" /></span>
                </span>
                Pensé pour les entreprises du Bénin
              </p>
              <h1 className="mt-6 font-display text-[clamp(2.6rem,6vw,5.4rem)] font-extrabold leading-[1.02] text-balance">
                Votre marque, <span className="bg-gradient-to-r from-accent via-[#e0641e] to-sun bg-clip-text text-transparent">du logo à la facture.</span>
              </h1>
              <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted text-pretty lg:mx-0 lg:text-xl">
                Créez votre logo, vos couleurs et vos documents professionnels en quelques minutes, sans graphiste. Tout reste au même endroit, toujours à jour.
              </p>
              <div className="animate-fade-up mt-9 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start" style={{ animationDelay: "240ms" }}>
                <ButtonLink href="/inscription" className="h-13 rounded-full px-7 text-base shadow-[0_10px_30px_-10px_rgba(194,65,12,0.6)]">
                  Créer ma marque gratuitement <ArrowRight className="size-4" aria-hidden />
                </ButtonLink>
                <a href="#comment-ca-marche" className="inline-flex h-13 items-center rounded-full px-6 text-base font-semibold text-foreground hover:bg-surface">
                  Voir comment ça marche
                </a>
              </div>
              <ul className="animate-fade-up mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted lg:justify-start" style={{ animationDelay: "320ms" }}>
                {["Sans carte bancaire", "Prix en FCFA", "Premier logo en moins de 10 min"].map((t) => (
                  <li key={t} className="flex items-center gap-1.5">
                    <Check className="size-4 text-success" aria-hidden /> {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="animate-fade-up px-4 sm:px-10 lg:px-6" style={{ animationDelay: "200ms" }}>
              <HeroShowcase />
            </div>
          </div>
        </section>

        {/* Exemples */}
        <section id="exemples" className="scroll-mt-24 py-16 lg:py-24" aria-labelledby="exemples-titre">
          <div className="reveal mx-auto max-w-3xl px-4 text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-accent">Exemples</p>
            <h2 id="exemples-titre" className="mt-3 text-3xl font-bold sm:text-4xl lg:text-5xl">Une identité pour chaque métier</h2>
            <p className="mt-4 text-lg text-muted">Ces marques fictives ont été créées par Brand OS, à partir des 6 réponses de leur questionnaire.</p>
          </div>
          <div className="mt-12">
            <LogoWall />
          </div>
        </section>

        {/* Comment ça marche */}
        <section id="comment-ca-marche" className="scroll-mt-24 py-20 lg:py-28" aria-labelledby="etapes-titre">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 2xl:max-w-[96rem]">
            <div className="reveal mx-auto max-w-3xl text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-accent">Comment ça marche</p>
              <h2 id="etapes-titre" className="mt-3 text-3xl font-bold sm:text-4xl lg:text-5xl">De zéro à une marque complète, en 4 étapes</h2>
            </div>
            <ol className="relative mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <div aria-hidden className="absolute left-[12%] right-[12%] top-9 hidden h-px bg-gradient-to-r from-transparent via-border to-transparent lg:block" />
              {STEPS.map(({ icon: Icon, title, text }, i) => (
                <li key={title} className="reveal group relative rounded-3xl border border-border bg-surface p-7 transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-[0_20px_50px_-20px_rgba(60,35,10,0.25)]">
                  <div className="flex items-center justify-between">
                    <span className="grid size-12 place-items-center rounded-2xl bg-accent text-white shadow-[0_10px_24px_-10px_rgba(194,65,12,0.8)] transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6">
                      <Icon className="size-6" aria-hidden />
                    </span>
                    <span className="font-display text-5xl font-extrabold text-border">{i + 1}</span>
                  </div>
                  <h3 className="mt-6 text-xl font-bold">{title}</h3>
                  <p className="mt-2 leading-relaxed text-muted">{text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Espace de travail */}
        <section id="fonctionnalites" className="scroll-mt-24 bg-surface py-20 lg:py-28" aria-labelledby="espace-titre">
          <div className="mx-auto grid max-w-7xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-2 2xl:max-w-[96rem]">
            <div className="reveal">
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-accent">Votre espace</p>
              <h2 id="espace-titre" className="mt-3 text-3xl font-bold sm:text-4xl lg:text-5xl">Toute votre marque, en un coup d’œil</h2>
              <p className="mt-5 text-lg leading-relaxed text-muted">
                Votre tableau de bord montre où vous en êtes : la marque active, ce qui reste à faire, vos derniers documents et ce que vous avez consommé ce mois-ci.
              </p>
              <ul className="mt-8 space-y-4">
                {[
                  "La marque est une donnée, pas une image : changez une couleur, elle suit partout.",
                  "Vos collaborateurs utilisent toujours les fichiers officiels.",
                  "Chaque version de votre marque est conservée.",
                ].map((t) => (
                  <li key={t} className="flex gap-3">
                    <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-success-soft text-success">
                      <Check className="size-3.5" aria-hidden />
                    </span>
                    <span className="leading-relaxed">{t}</span>
                  </li>
                ))}
              </ul>
            </div>
            <WorkspacePreview />
          </div>

          <div className="mx-auto mt-24 grid max-w-7xl gap-5 px-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-3 2xl:max-w-[96rem]">
            {FEATURES.map(({ icon: Icon, title, text, soon }) => (
              <div key={title} className="reveal group rounded-3xl border border-border bg-background p-7 transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1 hover:border-accent/40 hover:shadow-[0_20px_50px_-24px_rgba(60,35,10,0.3)]">
                <div className="flex items-center justify-between">
                  <span className="grid size-11 place-items-center rounded-xl bg-accent-soft text-accent transition-transform duration-300 group-hover:scale-110">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  {soon && <span className="rounded-full bg-surface px-2.5 py-1 text-xs font-semibold text-muted ring-1 ring-border">Bientôt</span>}
                </div>
                <h3 className="mt-5 text-lg font-bold">{title}</h3>
                <p className="mt-2 leading-relaxed text-muted">{text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Pensé pour le Bénin */}
        <section className="py-20 lg:py-28" aria-labelledby="local-titre">
          <div className="reveal mx-auto grid max-w-7xl gap-6 px-4 sm:px-6 md:grid-cols-3 2xl:max-w-[96rem]">
            <div className="md:col-span-3">
              <h2 id="local-titre" className="text-3xl font-bold sm:text-4xl lg:text-5xl">Pensé ici, pour vous</h2>
            </div>
            {[
              { icon: Wallet, title: "Prix en FCFA", text: "À partir de 0 FCFA. Paiement par Mobile Money ou carte, sans engagement." },
              { icon: Smartphone, title: "Mobile d’abord", text: "Conçu pour le smartphone et les connexions lentes : la page d’accueil pèse moins de 1 Mo." },
              { icon: Sparkles, title: "Vos secteurs", text: "Restauration, beauté, BTP, commerce, éducation, événementiel : des symboles qui parlent à vos clients." },
            ].map(({ icon: Icon, title, text }) => (
              <div key={title} className="rounded-3xl bg-gradient-to-br from-accent-soft to-surface p-7 ring-1 ring-border">
                <Icon className="size-7 text-accent" aria-hidden />
                <h3 className="mt-5 text-xl font-bold">{title}</h3>
                <p className="mt-2 leading-relaxed text-muted">{text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Tarifs */}
        <section id="tarifs" className="scroll-mt-24 bg-surface py-20 lg:py-28" aria-labelledby="tarifs-titre">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 2xl:max-w-[96rem]">
            <div className="reveal mx-auto max-w-3xl text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-accent">Tarifs</p>
              <h2 id="tarifs-titre" className="mt-3 text-3xl font-bold sm:text-4xl lg:text-5xl">Des prix en FCFA, sans surprise</h2>
              <p className="mt-4 text-lg text-muted">Commencez gratuitement. Changez d’offre quand vous voulez.</p>
            </div>
            <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {PLANS.map(({ plan, name, audience, highlights, featured }) => {
                const price = PLAN_DEFINITIONS[plan].monthlyPriceXof;
                return (
                  <div
                    key={plan}
                    className={`reveal relative flex flex-col rounded-3xl p-7 transition-transform duration-300 hover:-translate-y-1 ${
                      featured ? "bg-gradient-to-br from-accent to-[#e0641e] text-white shadow-[0_30px_60px_-24px_rgba(194,65,12,0.65)]" : "bg-background ring-1 ring-border"
                    }`}
                  >
                    {featured && <span className="absolute -top-3 left-7 rounded-full bg-sun px-3 py-1 text-xs font-bold text-foreground">Recommandé</span>}
                    <h3 className="text-xl font-bold">{name}</h3>
                    <p className={`mt-1 text-sm ${featured ? "text-white/85" : "text-muted"}`}>{audience}</p>
                    <p className="mt-6">
                      <span className="font-display text-4xl font-extrabold">{price === 0 ? "0" : new Intl.NumberFormat("fr-FR").format(price)}</span>
                      <span className={`ml-1 text-sm ${featured ? "text-white/85" : "text-muted"}`}>FCFA / mois</span>
                    </p>
                    <ul className="mt-6 flex flex-1 flex-col gap-3 text-sm">
                      {highlights.map((h) => (
                        <li key={h} className="flex gap-2">
                          <Check className={`mt-0.5 size-4 shrink-0 ${featured ? "text-white" : "text-success"}`} aria-hidden /> {h}
                        </li>
                      ))}
                    </ul>
                    <Link
                      href="/inscription"
                      className={`mt-8 inline-flex min-h-11 items-center justify-center rounded-full px-5 text-sm font-semibold transition-colors ${
                        featured ? "bg-white text-accent hover:bg-accent-soft" : "bg-surface ring-1 ring-border hover:ring-accent"
                      }`}
                    >
                      {price === 0 ? "Commencer" : `Choisir ${name}`}
                    </Link>
                  </div>
                );
              })}
            </div>
            <p className="mt-10 text-center text-muted">
              Pas envie d’un abonnement ? Le <strong className="text-foreground">Pack Identité</strong> (logo, Brand Kit et charte) à {formatXof(IDENTITY_PACK_PRICE_XOF)}, en une fois. Offre Agency pour les graphistes et agences : {formatXof(PLAN_DEFINITIONS.AGENCY.monthlyPriceXof)} / mois.
            </p>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="scroll-mt-24 py-20 lg:py-28" aria-labelledby="faq-titre">
          <div className="mx-auto max-w-3xl px-4">
            <h2 id="faq-titre" className="reveal text-center text-3xl font-bold sm:text-4xl lg:text-5xl">Vos questions</h2>
            <div className="mt-12 divide-y divide-border rounded-3xl bg-surface ring-1 ring-border">
              {FAQ.map(({ q, a }) => (
                <details key={q} className="group px-6 sm:px-8">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-6 text-left text-lg font-semibold [&::-webkit-details-marker]:hidden">
                    {q}
                    <ChevronDown className="size-5 shrink-0 text-muted transition-transform duration-300 group-open:rotate-180" aria-hidden />
                  </summary>
                  <p className="pb-6 leading-relaxed text-muted">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Appel à l'action */}
        <section className="px-4 pb-20 sm:px-6 lg:pb-28">
          <div className="reveal relative mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-gradient-to-br from-accent via-[#d4561a] to-[#e88a1a] px-6 py-16 text-center text-white sm:px-12 lg:py-24 2xl:max-w-[96rem]">
            <div aria-hidden className="animate-blob absolute -right-20 -top-20 size-80 rounded-full bg-white/15 blur-2xl" />
            <div aria-hidden className="animate-blob absolute -bottom-24 -left-16 size-96 rounded-full bg-sun/30 blur-3xl" style={{ animationDelay: "-9s" }} />
            <h2 className="relative mx-auto max-w-3xl text-3xl font-extrabold sm:text-5xl lg:text-6xl">Votre marque mérite mieux qu’un logo perdu dans WhatsApp.</h2>
            <p className="relative mx-auto mt-5 max-w-xl text-lg text-white/90">Créez-la en quelques minutes, gratuitement.</p>
            <Link
              href="/inscription"
              className="relative mt-10 inline-flex h-14 items-center gap-2 rounded-full bg-white px-8 text-base font-bold text-accent shadow-xl transition-transform duration-300 hover:scale-105"
            >
              Créer ma marque gratuitement <ArrowRight className="size-5" aria-hidden />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-surface">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-12 sm:flex-row sm:items-start sm:justify-between sm:px-6 2xl:max-w-[96rem]">
          <div className="max-w-xs">
            <Wordmark />
            <p className="mt-3 text-sm text-muted">L’identité visuelle des entreprises africaines francophones. Cotonou, Bénin.</p>
          </div>
          <nav aria-label="Pied de page" className="grid grid-cols-2 gap-x-12 gap-y-3 text-sm">
            <a href="#comment-ca-marche" className="text-muted hover:text-foreground">Comment ça marche</a>
            <a href="#tarifs" className="text-muted hover:text-foreground">Tarifs</a>
            <a href="#exemples" className="text-muted hover:text-foreground">Exemples</a>
            <a href="#faq" className="text-muted hover:text-foreground">Questions</a>
            <Link href="/connexion" className="text-muted hover:text-foreground">Se connecter</Link>
            <Link href="/inscription" className="text-muted hover:text-foreground">Créer un compte</Link>
          </nav>
        </div>
        <p className="border-t border-border py-6 text-center text-xs text-muted">© Brand OS · Cotonou, Bénin</p>
      </footer>
    </div>
  );
}
