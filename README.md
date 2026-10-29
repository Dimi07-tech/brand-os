# Brand OS

**Une entreprise, une identité centralisée, des supports cohérents, depuis un seul espace.**

Brand OS est une plateforme SaaS qui permet à une entreprise de créer son identité visuelle une seule fois — logo, couleurs, polices — puis de l'utiliser automatiquement dans tous ses supports : charte graphique, cartes de visite, factures et devis.

Le produit est pensé pour les entrepreneurs, TPE et PME du Bénin et de l'Afrique de l'Ouest francophone : prix en FCFA, paiement par Mobile Money, interface conçue d'abord pour le smartphone et les connexions lentes.

> Le développement suit un cahier des charges interne (version 2.0, non publié dans ce dépôt). Les identifiants `US-xx` (user stories), `RG-xx` (règles de gestion) et `§x.y` cités dans le code renvoient à ce document.

---

## Sommaire

- [Fonctionnalités](#fonctionnalités)
- [Avancement du MVP](#avancement-du-mvp)
- [Architecture](#architecture)
- [Démarrage rapide](#démarrage-rapide)
- [Commandes](#commandes)
- [Configuration](#configuration)
- [Règles métier garanties](#règles-métier-garanties)
- [Sécurité](#sécurité)
- [Tests](#tests)
- [Structure du dépôt](#structure-du-dépôt)

---

## Fonctionnalités

### Site vitrine
Page d'accueil animée (rendu vectoriel, net en 4K), exemples de marques générées par le moteur, tarifs en FCFA, FAQ. Moins de 1 Mo transféré, affichage du titre en moins d'une seconde.

### Comptes et entreprises
- Inscription, vérification de l'e-mail, mot de passe oublié, sessions actives, suppression du compte avec délai de rétractation de 30 jours.
- Mots de passe Argon2id, refus des mots de passe compromis (Have I Been Pwned, par k-anonymat), verrouillage après 5 échecs.
- Profil de l'entreprise et informations légales béninoises (RCCM, IFU, régime fiscal, assujettissement à la TVA).
- Rôles : Propriétaire, Administrateur, Designer, Éditeur, Comptable, Lecteur.

### Brand Studio
- Questionnaire créatif en 6 étapes : nom, secteur, cible, valeurs, style, couleurs préférées et à éviter.
- 6 propositions de logos **vectoriels**, puis d'autres à la demande ; personnalisation du texte, de la police, de la disposition, de l'icône et des couleurs.
- 3 palettes par règles d'harmonie, modifiables, avec contrôle du contraste WCAG.
- Polices Google Fonts sous licence libre ; icônes Lucide (licence ISC).

### Brand Kit
- Logo en 7 variantes : couleur, monochrome, clair, sombre, icône seule, horizontal, vertical.
- Couleurs en HEX, RGB et CMJN, copiables en un clic.
- Pack ZIP : SVG vectoriels (texte converti en tracés) et PNG transparents 2000 px.
- **Charte graphique PDF** de 7 pages, avec des textes proposés automatiquement puis corrigés par l'utilisateur.

### Cartes de visite
- 20 modèles préremplis avec la marque, recto et verso, QR code vers WhatsApp ou le site.
- Éditeur avec aperçu recto/verso, repères d'impression, enregistrement automatique et gestion des conflits entre onglets.
- **PDF prêt pour l'imprimeur** : 85 × 55 mm + fond perdu de 3 mm, zone de sécurité de 3 mm, couleurs CMJN, rendu vectoriel.

### Factures et devis
- Clients et produits enregistrés.
- Lignes avec quantités décimales, remises et TVA ; totaux, TVA par taux et montant en lettres en direct.
- Numérotation `FAC-2026-0001`, `DEV-2026-0001`, `AV-2026-0001` attribuée à l'émission.
- Document émis figé ; correction par facture d'avoir ; duplication en brouillon.
- PDF A4 aux couleurs de la marque, avec toutes les mentions légales.

---

## Avancement du MVP

| Module (cahier des charges §3.1) | État |
|---|---|
| Comptes et authentification | ✅ Terminé |
| Organisations | ✅ Terminé (une organisation par compte au MVP) |
| Brand Studio | ✅ Terminé (génération par règles ; fournisseur IA à brancher) |
| Brand Kit | ✅ Terminé |
| Charte graphique | ✅ Terminé |
| Cartes de visite | ✅ Terminé |
| Factures et devis | ✅ Terminé |
| Site vitrine | ✅ Terminé |
| Abonnements et paiements Mobile Money | ⏳ À faire (FedaPay ou KkiaPay) |
| Administration minimale | ⏳ À faire |
| Import d'un logo existant | ⏳ À faire |
| Modèle d'IA pour l'analyse du brief | ⏳ À brancher (abstraction prête) |

Critère de réussite du MVP (§3.3) : un entrepreneur crée son compte, obtient un logo, enregistre son Brand Kit, puis télécharge une carte de visite et une facture à ses couleurs. **Ce parcours fonctionne de bout en bout.**

---

## Architecture

Monolithe modulaire en TypeScript : une API découpée en modules, un front web, et des workers pour les tâches longues.

```
                 ┌──────────────────────────────┐
  Navigateur ──▶ │  Web — Next.js 16 (React 19)  │  /api/v1/* relayé vers l'API (même domaine,
                 └──────────────┬───────────────┘   cookie de session HttpOnly)
                                │
                 ┌──────────────▼───────────────┐
                 │  API — NestJS 12             │  Validation Zod, droits par rôle,
                 │  modules : auth, organisations│  quotas par offre
                 │  marques, créations, documents│
                 └───┬──────────┬───────────┬───┘
                     │          │           │
          ┌──────────▼──┐  ┌────▼─────┐  ┌──▼────────────────────┐
          │ PostgreSQL  │  │  Redis   │  │ Worker (BullMQ)        │
          │ + RLS       │  │  files   │  │ ZIP, PDF (Chromium),   │
          └─────────────┘  └──────────┘  │ CMJN (Ghostscript)     │
                                         └──┬─────────────────────┘
                                            │
                                   ┌────────▼─────────┐
                                   │ Stockage objet S3 │  liens signés 15 min
                                   └──────────────────┘
```

| Composant | Choix |
|---|---|
| Langage | TypeScript strict (front et back) |
| Front | Next.js 16, React 19, Tailwind CSS 4 |
| API | NestJS 12, Zod |
| Base de données | PostgreSQL 17+ avec Row Level Security, Prisma 7 |
| Tâches de fond | Redis + BullMQ |
| PDF | Chromium piloté par Playwright ; Ghostscript pour le CMJN ; pdf-lib |
| Vectorisation du texte | opentype.js + polices Fontsource embarquées |
| Images | resvg (SVG → PNG) |
| Monorepo | npm workspaces + Turborepo |

**Le moteur de rendu est partagé** (`packages/shared`) : logos, palettes, cartes de visite et calculs de factures utilisent le même code dans le navigateur (aperçu en direct) et sur le serveur (fichiers définitifs). L'aperçu est donc fidèle au fichier téléchargé.

---

## Démarrage rapide

### Prérequis

- Node.js 24+
- PostgreSQL 17+ et Redis 7+ (installés localement, ou via Docker)
- Chromium (ou Google Chrome) et Ghostscript, pour les exports PDF

Sur Debian, Ubuntu ou Kali :

```bash
sudo apt install postgresql redis-server chromium ghostscript
```

### Installation

```bash
git clone https://github.com/Dimi07-tech/brand-os.git
cd brand-os
cp .env.example .env          # puis renseigner FILE_SIGNING_SECRET (32 caractères aléatoires)
npm install
```

### Services locaux

Au choix :

```bash
npm run services:start                            # PostgreSQL + Redis dans .dev/, sans Docker ni sudo
# ou
docker compose -f infra/docker-compose.yml up -d  # PostgreSQL, Redis, MinIO, Mailpit
```

`npm run services:start` est à relancer après chaque redémarrage de la machine.

### Lancement

```bash
npm run db:migrate    # crée ou met à jour les tables
npm run dev           # web sur :3000, API sur :4000
```

| Adresse | Contenu |
|---|---|
| http://localhost:3000 | Application |
| http://localhost:4000/api/docs | Documentation de l'API (OpenAPI) |
| http://localhost:4000/api/v1/health | État de l'API et de la base |

Sans `SMTP_URL`, les e-mails (vérification, mot de passe oublié, export terminé) sont affichés dans le terminal de l'API au lieu d'être envoyés.

Pour tester une offre payante en local, en attendant le module de paiement :

```bash
PGPASSWORD=brandos psql -h localhost -U brandos -d brandos -c "UPDATE \"Subscription\" SET plan='STARTER';"
```

---

## Commandes

| Commande | Rôle |
|---|---|
| `npm run dev` | Lance le web et l'API en mode développement |
| `npm run build` | Construit tous les paquets |
| `npm run lint` | Analyse statique (ESLint, Oxlint) |
| `npm run typecheck` | Vérification des types |
| `npm run test` | Tests unitaires et de bout en bout |
| `npm run db:migrate` | Crée et applique les migrations Prisma |
| `npm run db:studio` | Explorateur de la base de données |
| `npm run services:start` / `services:stop` | PostgreSQL et Redis locaux |
| `npm run start:worker -w @brand-os/api` | Worker d'exports séparé (production) |

---

## Configuration

Toutes les variables sont décrites dans [`.env.example`](.env.example) et validées au démarrage : l'API refuse de démarrer si une valeur manque ou est invalide.

| Variable | Rôle |
|---|---|
| `DATABASE_URL`, `REDIS_URL` | Base de données et files de tâches |
| `WEB_ORIGIN` | Adresse du site (liens dans les e-mails) |
| `FILE_SIGNING_SECRET` | Signature des liens de téléchargement (32 caractères minimum) |
| `STORAGE_DRIVER` | `local` (développement) ou `s3` (production, avec `S3_*`) |
| `SMTP_URL`, `MAIL_FROM` | Envoi des e-mails ; `SMTP_URL` obligatoire en production |
| `WORKERS_ENABLED` | `true` : l'API traite aussi les exports ; `false` en production avec un worker séparé |
| `CHROMIUM_PATH`, `GHOSTSCRIPT_PATH` | Outils de génération des PDF |
| `PWNED_PASSWORD_CHECK` | Vérification des mots de passe compromis |

---

## Règles métier garanties

Chaque règle ci-dessous est appliquée côté serveur et couverte par des tests automatisés.

| Règle | Garantie |
|---|---|
| RG-10 | Droits vérifiés côté serveur pour chaque action, selon la matrice des rôles |
| RG-20 à RG-22 | Palettes complètes, couleurs en HEX/RGB/CMJN, contraste texte/fond vérifié |
| RG-23 | SVG réellement vectoriels : le texte des logos est converti en tracés |
| RG-24 | Polices sous licence libre uniquement |
| RG-31 | Un document émis garde l'émetteur, le client et la marque tels qu'à l'émission |
| RG-40 | Aucune modification perdue sans avertissement ; conflits entre onglets détectés |
| RG-50 | Cartes de visite : 85 × 55 mm, fond perdu 3 mm, zone de sécurité 3 mm, CMJN |
| RG-60 | Montants calculés côté serveur, en entiers, sans nombre flottant |
| RG-61 | TVA par ligne (18 % par défaut), calculée par taux sur le total ; désactivable |
| RG-62 | Numérotation continue par année, sans trou ni doublon, même en émissions simultanées |
| RG-63 | Facture émise non modifiable ; correction par facture d'avoir |
| RG-64 | Mentions obligatoires sur les factures et devis, montant en lettres |
| RG-70, RG-71 | Quotas par offre vérifiés à chaque opération ; avertissement à 80 %, blocage à 100 % |

---

## Sécurité

- **Isolation entre entreprises en deux barrières** : filtrage dans chaque requête de l'API, puis Row Level Security PostgreSQL. Les requêtes métier s'exécutent sous un rôle restreint (`brandos_app`) qui ne voit que les lignes de l'organisation active.
- **Sessions** par jeton opaque dans un cookie HttpOnly, SameSite ; seule l'empreinte SHA-256 du jeton est stockée.
- **Fichiers** jamais exposés directement : téléchargement par lien signé, valable 15 minutes.
- **Contenu saisi** systématiquement échappé dans les SVG, HTML et PDF générés ; les documents PDF sont rendus sans réseau, avec une politique CSP qui interdit tout script.
- **Limitation du débit** sur les routes sensibles, en-têtes de sécurité (Helmet), validation stricte de toutes les entrées.
- **Journal d'audit** des actions sensibles.

Un audit de sécurité externe est prévu avant le lancement (§9.1).

---

## Tests

```bash
npm run test
```

Plus de 180 tests, dont :

- **Isolation** : aucune lecture, écriture ou modification croisée entre organisations n'aboutit, y compris en contournant l'API.
- **Moteur de marque** : palettes vérifiées sur 300 questionnaires aléatoires ; logos valides et tous différents.
- **Cartes de visite** : plus de 3 000 éléments contrôlés dans la zone de sécurité, sur tous les modèles et toutes les longueurs de texte.
- **Factures** : calculs exacts sur 1 000 documents aléatoires ; 10 émissions simultanées numérotées sans doublon ; une émission refusée ne consomme pas de numéro.
- **Exports** : PDF, ZIP, CMJN et cadres d'impression vérifiés dans les fichiers produits.

Les tests de bout en bout utilisent une vraie base PostgreSQL, un vrai Redis et un vrai Chromium.

---

## Structure du dépôt

```
apps/
  web/                  Front Next.js : vitrine, Brand Studio, Brand Kit, créations, documents
  api/                  API NestJS
    src/modules/        auth, organizations, brands, designs, documents, exports, storage, usage, ai
    test/               tests de bout en bout
packages/
  db/                   Schéma Prisma, migrations (dont RLS), client, tests d'isolation
  shared/               Code commun au front et à l'API
    src/brand/          logos, palettes, couleurs, polices, icônes, charte
    src/cards/          cartes de visite (format, modèles, rendu)
    src/documents/      calculs des factures, montant en lettres
    src/schemas/        validation des entrées (Zod)
infra/                  docker-compose des services locaux
scripts/                services locaux sans Docker
docs/                   documentation interne (non publiée)
```

---

## Licence

© Brand OS — tous droits réservés. Code propriétaire, non destiné à la redistribution.

Composants tiers sous licences libres compatibles avec un usage commercial : polices sous SIL Open Font License (Fontsource, Google Fonts), icônes Lucide (ISC), bibliothèques listées dans `package-lock.json`.
