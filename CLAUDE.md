# Asso Pilotage — Contexte IA

> Ce fichier est lu par les assistants IA (Claude Code, Copilot, Cursor…) en début de session.
> Il donne le contexte projet indispensable pour ne pas casser ce qui existe.

## Ce qu'est ce projet

Dashboard de pilotage pour une association de formation numérique.
**SaaS Next.js** — interface uniquement.
Persistance : `localStorage` pour la plupart des modules. **Exception : le module Familles** est connecté à **Google Sheets** (API REST v4 côté serveur) — voir section "Backend Familles".

## Stack exacte

| Outil | Version | Note critique |
|---|---|---|
| Next.js | **16.2.6** | App Router, conventions différentes du Next.js courant — **lire `AGENTS.md`** |
| Tailwind CSS | **v4** | Config CSS-first dans `globals.css`, **pas de `tailwind.config.ts`** |
| React | 19 | Server Components + `"use client"` explicite |
| TypeScript | 5 | `strict: true` |
| lucide-react | 1.16.0 | Certaines icônes n'existent pas — voir liste dans `AGENTS.md` |
| Gemini API | `fetch` natif (pas de SDK npm) | Génération IA posts Communication + OCR — clé `GEMINI_API_KEY` dans `.env.local` |

## Structure des modules

```
app/
├── login/          Page de connexion / inscription (publique)
├── dashboard/      Vue d'ensemble — KPIs globaux
├── emargement/     Émargement numérique par séance
├── absences/       Suivi absences du jour + historique
├── finances/       Demandes de financement + inscriptions
├── ateliers/       Planning + notes apprenantes + composition groupes
├── communication/  Calendrier éditorial + kanban suivi posts + archive publiés
├── benevoles/      Disponibilités bénévoles + gestion événements
├── membres/        Annuaire membres (rôles, statuts, CRUD)
└── familles/       Bénéficiaires — familles, parents, enfants ✅ NOUVEAU
    ├── page.tsx              Listing 3 onglets (Familles / Parents / Enfants)
    ├── [id]/page.tsx         Fiche famille + ajout membre
    └── [id]/membre/[membreId]/page.tsx  Fiche membre individuelle

components/
├── Sidebar.tsx     Navigation + chip utilisateur connecté
├── SlideOver.tsx   Panneau latéral réutilisable (TOUTES les forms passent par là)
├── StatCard.tsx    Carte KPI dashboard
└── AuthGate.tsx    Protection des routes + affichage conditionnel sidebar

lib/
├── auth.ts             Helpers auth (login, register, logout, getSession)
├── auth-context.tsx    Provider React + hook useAuth()
├── mock-data.ts        Données mockées (absences, finances, ateliers, com, bénévoles)
├── emargement-data.ts  Séances + présences initiales
├── sheets-api.ts       Couche client module Familles (fetch → /api/sheets)
└── google-sheets-server.ts  Clients Sheets + Drive (compte de service, côté serveur)

app/api/
├── generate-post/route.ts  POST — génère contenu + hashtags via Gemini (fetch natif)
│                            Requiert GEMINI_API_KEY dans .env.local
└── sheets/route.ts     API REST Google Sheets v4 du module Familles (voir "Backend Familles")
```

## Conventions impératives

### Couleurs Tailwind v4 — utiliser les classes sémantiques
```tsx
// ✅ Correct
"bg-absences text-finances-dark border-ateliers/20"

// ❌ Interdit
"bg-[var(--color-absences)]"
```
Toutes les couleurs sont définies dans `app/globals.css` sous `@theme inline`.
Chaque module a sa couleur : `absences`, `finances`, `ateliers`, `communication`, `benevoles`.
Variantes disponibles : `{module}`, `{module}-light`, `{module}-dark`.

### Pattern CRUD standard
**Chaque page avec données modifiables** suit ce pattern :
1. `useState` initialisé avec données mock
2. `useEffect` → charge depuis `localStorage` (hydratation)
3. `persist(data)` → `setData(data)` + `localStorage.setItem(...)`
4. `SlideOver` pour les formulaires (jamais de modal inline)
5. `openNew()` / `openEdit(item)` → ouvre le SlideOver

```tsx
// Template type à copier
const [items, setItems] = useState<Item[]>(mockData)
useEffect(() => { setItems(load(STORAGE_KEY, mockData)) }, [])
function persist(data: Item[]) { setItems(data); localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) }
```

### SlideOver — composant central
```tsx
import SlideOver, { Field, Input, Select, Textarea, FormRow, SaveButton, DeleteButton } from "@/components/SlideOver"

<SlideOver open={slideOpen} onClose={() => setSlideOpen(false)} title="..." width="md | lg">
  <form onSubmit={(e) => { e.preventDefault(); handleSave() }} className="flex flex-col gap-4">
    <Field label="Nom" required>
      <Input value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} />
    </Field>
    <SaveButton />
    {editing && <DeleteButton onClick={handleDelete} />}
  </form>
</SlideOver>
```

### Auth
```tsx
import { useAuth } from "@/lib/auth-context"
const { user, logout } = useAuth()
// user : AuthUser | null  →  { id, email, nom, prenom, role, createdAt }
// role : "super_admin" | "admin" | "formatrice" | "coordinatrice" | "benevole"
```
L'authentification passe par **Supabase** (voir `docs/explanation/adr/007-auth-supabase.md`).

### ⚠️ Règle — TOUTES les URLs passent par l'authentification
Toute route de l'application (l'espace « dashboard » et tous ses modules) **exige une
session authentifiée**. Une URL n'est accessible sans connexion que si elle figure
explicitement dans les **exceptions publiques** :
- `/login`
- les pages légales : `/mentions-legales`, `/confidentialite`, `/accessibilite`
  (liste `LEGAL_PATHS` dans `components/AuthGate.tsx`)

Concrètement :
- **Pages** : `components/AuthGate.tsx` redirige tout·e visiteur·se non authentifié·e vers
  `/login` (sauf exceptions ci-dessus). Toute nouvelle page fait donc partie du périmètre
  protégé par défaut — ne l'ajoute JAMAIS à `LEGAL_PATHS`/exceptions sans décision explicite.
- **Routes API** (`app/api/*`) : chaque handler doit commencer par la garde serveur
  `if (!(await getServerUser())) return 401` (`lib/supabase/server.ts`). Toute nouvelle
  route API exposant des données ou appelant un service tiers DOIT être gardée.

### "use client" — règle
Toutes les pages sont `"use client"` (localStorage, état, hooks).
Les composants partagés aussi (`Sidebar`, `SlideOver`, `AuthGate`).
Pas de Server Actions. Le module Familles appelle sa **route interne `/api/sheets`** (API REST Google Sheets v4, voir "Backend Familles") ; les autres modules restent en localStorage.

## Modèle Post (Communication) — **Google Sheets** (feuille `CONTENUS`)

> ⚠️ Depuis la migration Sheets, les posts ne sont plus en `localStorage`. Le module Communication
> lit/écrit dans la feuille `CONTENUS` du Sheet `BDD_Asso_CRM` via `/api/sheets` (voir "Backend
> Communication" plus bas). Seul `asso-communication-rejected` (le repère visuel "dot rouge") reste
> en `localStorage` — c'est une annotation UI locale, pas une donnée métier.

```typescript
type ValidationStatus = "brouillon" | "à valider" | "validé" | "publié"
type CategoriePost = "atelier" | "autre"

interface PlatformeContent { contenu?: string; tags?: string; lien?: string }
interface MediaItem { nom: string; type: string; preview?: string; url?: string }  // preview = local (upload en cours), url = Drive persistée
interface PostParticipant { id: number; prenom: string; nom: string }
interface PostParticipants {
  apprenantes: PostParticipant[]   // IDs → cross-ref avec asso-beneficiaires
  benevoles: string[]              // noms (ref benevolesMock.liste)
  formatrices: string[]            // noms libres
}

interface Post {
  id: number
  categorie: CategoriePost          // atelier | autre
  date: string                       // date programmée ISO
  titre: string
  brief?: string                     // contexte court pour la génération IA (posts "autre")
  contenu?: string                   // contenu principal
  media?: MediaItem[]                // 1 image + 1 vidéo max (colonnes Image/Vidéo singulières du Sheet)
  plateforme: Plateforme[]           // LinkedIn | Instagram | Facebook
  plateformeContenu: Partial<Record<Plateforme, PlatformeContent>>  // surcharge par plateforme
  statut: ValidationStatus
  auteur: string
  sessionId?: number | null          // lien optionnel vers une Session du module Ateliers
  participants?: PostParticipants    // uniquement pour categorie === "atelier"
}
```

**Données cross-module (lecture seule depuis Communication) :**
- `asso-ateliers-sessions` → sessions (pour auto-peupler les participants)
- `asso-beneficiaires` → bénéficiaires (pour résoudre les noms et vérifier `droitsImage`)

**Liste de floutage :** dérivée des apprenantes du post dont `beneficiaire.droitsImage !== true`.
`droitsImage?: boolean` est défini dans l'interface `Beneficiaire` de `/app/beneficiaires/page.tsx` (champ optionnel, non encore affiché dans le formulaire).
Tant qu'il n'est pas configuré, la liste de floutage affiche un message d'alerte et ne liste personne.

**Kanban :** clic sur une carte ouvre directement l'édition (pas de panneau de lecture intermédiaire).

## Page de seed de test (à supprimer avant prod)

`/app/dev/seed/page.tsx` — injecte des données fictives dans le localStorage pour tester
la section participants et le floutage dans Communication.
IDs réservés : 9001–9099. Supprimer ce fichier + le dossier `app/dev/` avant la mise en production.

## Ce qu'il ne faut PAS faire

- ❌ Ne pas créer `tailwind.config.ts` — config dans `globals.css`
- ❌ Ne pas importer `Linkedin`, `Instagram`, `Facebook`, `Kanban` de lucide-react (n'existent pas en v1.16.0)
- ❌ Ne pas utiliser `bg-[var(--color-xxx)]` — utiliser `bg-xxx`
- ❌ Ne pas créer de routes API (`app/api/`) sans décision d'équipe — exceptions validées : `app/api/generate-post/route.ts` (génération IA), `app/api/sheets/route.ts` (backend Google Sheets du module Familles), `app/api/ocr/route.ts` (OCR bulletins d'inscription via Gemini API), `app/api/subventions-sheet/*` (backend Google Sheets de la Veille subventions : lecture CSV + écriture via Web App Apps Script — nécessite `SHEETS_WEBAPP_URL` + `SHEETS_WEBAPP_TOKEN`)
- ❌ Ne pas mettre de données dans l'URL (PII)
- ❌ Ne pas casser le pattern SlideOver existant (cohérence UX)

## Ajouter un nouveau module — en 5 étapes

1. Créer `app/{module}/page.tsx` avec `"use client"`
2. Ajouter les données mock dans `lib/mock-data.ts`
3. Choisir une couleur ou réutiliser une existante dans `globals.css`
4. Ajouter l'entrée dans `components/Sidebar.tsx` (tableau `navItems`)
5. Ajouter une `StatCard` dans `app/dashboard/page.tsx`

→ Guide détaillé : `docs/how-to/add-new-module.md`

## Déploiement

- **GitHub** : `github.com/anais0210/asso-pilotage`
- **Vercel** : `asso-inky.vercel.app` (auto-deploy sur push `main`)
- Compte démo : `admin@asso.fr` / `AdminAsso2026!`

@AGENTS.md

---

## Travaux Diane-GA — contexte de contribution

> Diane-GA travaille sur un **fork** de `anais0210/asso-pilotage`.
> À chaque session, synchroniser le fork avant de coder :
> ```bash
> git fetch upstream
> git checkout main && git merge --ff-only upstream/main
> git push origin main
> git checkout <branche-travail>
> ```

### Dépôts
| Rôle | URL |
|------|-----|
| Fork (push) | `github.com/Diane-GA/asso-pilotage` |
| Upstream (référence) | `github.com/anais0210/asso-pilotage` |

### Branches de travail
| Branche | Cas | Statut |
|---------|-----|--------|
| `cas_4-1-1` | Cas 4.1.1 — améliorations UI calendrier & kanban | Poussée, rebased sur main |
| `Cas_4-1-2` | Cas 4.1.2 — refonte vue Communication | En cours |

---

## Module Communication — état branche Cas_4-1-2

### Structure fichiers
```
app/communication/
├── page.tsx        Page principale : calendrier, onglet Suivi (kanban)
└── publies/
    └── page.tsx    Archive de tous les posts publiés (lecture seule + SlideOver)
```

### Persistance — Communication
| Clé / Source | Type | Contenu |
|-----|------|---------|
| Feuille `CONTENUS` (Google Sheets) | `Post[]` | Tous les posts — voir "Backend Communication" ci-dessous |
| `asso-communication-rejected` (localStorage) | `number[]` | IDs posts repassés en brouillon via ✕ (annotation UI locale, pas dans Sheets) |

### Onglets de la page Communication
1. **Calendrier** — posts uniquement, fond coloré par statut, clic sur une date = nouveau post
2. **Suivi** — kanban 4 colonnes : Brouillon / À valider / Validé / Publié

> ⚠️ L'onglet **Événements** a été entièrement supprimé (Cas_4-1-2).
> Toute l'infrastructure associée a été retirée : type `Evenement`, `TypeEvenement`,
> `EventsTab`, `STORAGE_EVENTS`, `eventsInitiaux`, `emptyEvent`, `TYPE_OPTIONS`.
> Le champ `evenement` (déprécié) a depuis été retiré entièrement de l'interface `Post`
> lors de la migration vers Google Sheets.

### Modifications réalisées en Cas_4-1-2

#### 1. Renommage statut `"en attente de validation"` → `"à valider"`
- Mis à jour partout : type, KANBAN_COLS, statutDot, statutBg, données mock, boutons, formulaire
- **Migration automatique** au chargement : tout post stocké avec l'ancien libellé est corrigé

```tsx
// Dans useEffect — migration au boot
const raw = load<Post[]>(STORAGE_POSTS, postsInitiaux)
const migrated = raw.map(p =>
  (p.statut as string) === "en attente de validation" ? { ...p, statut: "à valider" as ValidationStatus } : p
)
if (migrated.some((p, i) => p !== raw[i])) localStorage.setItem(STORAGE_POSTS, JSON.stringify(migrated))
setPosts(migrated)
```

#### 2. Stat cards (haut de page)
| Carte | Couleur | Calcul |
|-------|---------|--------|
| En cours de rédaction | slate | `statut === "brouillon"` |
| À valider | absences (orange) | `statut === "à valider"` |
| Publiés cette année | emerald | `statut === "publié" && date >= 1er jan année en cours` |

#### 3. Cartes kanban — contenu affiché
- ✅ Titre + badge catégorie (Atelier / Autre)
- ✅ Vignettes réseaux sociaux (LI / IG / FB)
- ✅ Date de publication
- ✅ Boutons de validation
- ❌ Preview contenu texte (supprimée)
- ❌ Compteur participants (supprimé)

#### 4. Dot rouge — posts repassés en brouillon
Quand un post passe de `"à valider"` → `"brouillon"` via le bouton ✕ :
- Un point rouge apparaît en haut à droite de la carte (`absolute -top-1.5 -right-1.5`)
- Persisté dans `asso-communication-rejected` (survit au rechargement)
- Disparaît quand le post repart vers `"à valider"` ou tout autre statut ≠ brouillon

```tsx
// Dans changeStatus() :
if (status === "brouillon" && prev?.statut === "à valider") {
  persistRejected([...rejectedIds, id])
} else if (status !== "brouillon" && rejectedIds.includes(id)) {
  persistRejected(rejectedIds.filter(rid => rid !== id))
}

// Dans la carte kanban :
{rejectedIds.includes(p.id) && (
  <span className="absolute -top-1.5 -right-1.5 w-3 h-3 rounded-full bg-red-500 ring-2 ring-white shadow-sm" />
)}
```

#### 5. Colonne "Publié" — vue limitée + archive
- Affiche les **3 posts les plus récents** (triés par date décroissante)
- Le compteur en badge affiche le total réel
- Bouton **"Voir tous les posts publiés"** → `/communication/publies`
- Page `/communication/publies` : grille 3 colonnes, mêmes cartes que le kanban,
  clic → SlideOver lecture (titre, contenu, plateformes, médias, participants)

### Logique de travail (préférences Diane-GA)
- Travailler par **petites modifications ciblées**, une fonctionnalité à la fois
- Valider TypeScript (`npx tsc --noEmit`) avant chaque commit
- Commits fréquents avec messages descriptifs en français/anglais mixte
- Ne pas modifier ce qui n'est pas dans le périmètre de la branche
- Privilégier la suppression propre (pas de code mort commenté)

<!-- rtk-instructions v2 -->
# RTK (Rust Token Killer) - Token-Optimized Commands

## Golden Rule

**Always prefix commands with `rtk`**. If RTK has a dedicated filter, it uses it. If not, it passes through unchanged. This means RTK is always safe to use.

**Important**: Even in command chains with `&&`, use `rtk`:
```bash
# ❌ Wrong
git add . && git commit -m "msg" && git push

# ✅ Correct
rtk git add . && rtk git commit -m "msg" && rtk git push
```

## RTK Commands by Workflow

### Build & Compile (80-90% savings)
```bash
rtk cargo build         # Cargo build output
rtk cargo check         # Cargo check output
rtk cargo clippy        # Clippy warnings grouped by file (80%)
rtk tsc                 # TypeScript errors grouped by file/code (83%)
rtk lint                # ESLint/Biome violations grouped (84%)
rtk prettier --check    # Files needing format only (70%)
rtk next build          # Next.js build with route metrics (87%)
```

### Test (60-99% savings)
```bash
rtk cargo test          # Cargo test failures only (90%)
rtk go test             # Go test failures only (90%)
rtk jest                # Jest failures only (99.5%)
rtk vitest              # Vitest failures only (99.5%)
rtk playwright test     # Playwright failures only (94%)
rtk pytest              # Python test failures only (90%)
rtk rake test           # Ruby test failures only (90%)
rtk rspec               # RSpec test failures only (60%)
rtk test <cmd>          # Generic test wrapper - failures only
```

### Git (59-80% savings)
```bash
rtk git status          # Compact status
rtk git log             # Compact log (works with all git flags)
rtk git diff            # Compact diff (80%)
rtk git show            # Compact show (80%)
rtk git add             # Ultra-compact confirmations (59%)
rtk git commit          # Ultra-compact confirmations (59%)
rtk git push            # Ultra-compact confirmations
rtk git pull            # Ultra-compact confirmations
rtk git branch          # Compact branch list
rtk git fetch           # Compact fetch
rtk git stash           # Compact stash
rtk git worktree        # Compact worktree
```

Note: Git passthrough works for ALL subcommands, even those not explicitly listed.

### GitHub (26-87% savings)
```bash
rtk gh pr view <num>    # Compact PR view (87%)
rtk gh pr checks        # Compact PR checks (79%)
rtk gh run list         # Compact workflow runs (82%)
rtk gh issue list       # Compact issue list (80%)
rtk gh api              # Compact API responses (26%)
```

### JavaScript/TypeScript Tooling (70-90% savings)
```bash
rtk pnpm list           # Compact dependency tree (70%)
rtk pnpm outdated       # Compact outdated packages (80%)
rtk pnpm install        # Compact install output (90%)
rtk npm run <script>    # Compact npm script output
rtk npx <cmd>           # Compact npx command output
rtk prisma              # Prisma without ASCII art (88%)
```

### Files & Search (60-75% savings)
```bash
rtk ls <path>           # Tree format, compact (65%)
rtk read <file>         # Code reading with filtering (60%)
rtk grep <pattern>      # Search grouped by file (75%). Format flags (-c, -l, -L, -o, -Z) run raw.
rtk find <pattern>      # Find grouped by directory (70%)
```

### Analysis & Debug (70-90% savings)
```bash
rtk err <cmd>           # Filter errors only from any command
rtk log <file>          # Deduplicated logs with counts
rtk json <file>         # JSON structure without values
rtk deps                # Dependency overview
rtk env                 # Environment variables compact
rtk summary <cmd>       # Smart summary of command output
rtk diff                # Ultra-compact diffs
```

### Infrastructure (85% savings)
```bash
rtk docker ps           # Compact container list
rtk docker images       # Compact image list
rtk docker logs <c>     # Deduplicated logs
rtk kubectl get         # Compact resource list
rtk kubectl logs        # Deduplicated pod logs
```

### Network (65-70% savings)
```bash
rtk curl <url>          # Compact HTTP responses (70%)
rtk wget <url>          # Compact download output (65%)
```

### Meta Commands
```bash
rtk gain                # View token savings statistics
rtk gain --history      # View command history with savings
rtk discover            # Analyze Claude Code sessions for missed RTK usage
rtk proxy <cmd>         # Run command without filtering (for debugging)
rtk init                # Add RTK instructions to CLAUDE.md
rtk init --global       # Add RTK to ~/.claude/CLAUDE.md
```

## Token Savings Overview

| Category | Commands | Typical Savings |
|----------|----------|-----------------|
| Tests | vitest, playwright, cargo test | 90-99% |
| Build | next, tsc, lint, prettier | 70-87% |
| Git | status, log, diff, add, commit | 59-80% |
| GitHub | gh pr, gh run, gh issue | 26-87% |
| Package Managers | pnpm, npm, npx | 70-90% |
| Files | ls, read, grep, find | 60-75% |
| Infrastructure | docker, kubectl | 85% |
| Network | curl, wget | 65-70% |

Overall average: **60-90% token reduction** on common development operations.
<!-- /rtk-instructions -->

---

## Module Familles — ce qui a été construit

> ⚠️ **Le module Familles ne suit PAS le pattern localStorage** du reste de l'app.
> Il lit et écrit dans **Google Sheets** via une API REST v4 côté serveur (voir
> section « Backend Familles » ci-dessous). Il n'y a plus de `lib/familles-data.ts`.

### Page listing (`/familles`)
- 2 onglets : **Familles** et **Membres**
- Recherche **par préfixe** (début du nom), tolérante aux accents, tri alphabétique
- Bouton **"+ Ajouter une famille"** (onglet Familles)

### Fiche famille (`/familles/[id]`)
- Infos famille + bouton Modifier (cascade adresse → tous les membres)
- **Autocomplétion d'adresse** via l'API Base Adresse Nationale (`components/AdresseAutocomplete.tsx`)
- Cartes membres + **Journal de suivi** (commentaires)
- Bouton **"+ Ajouter un membre"**

### Fiche membre (`/familles/[id]/membre/[membreId]`)
- Breadcrumb, badges type/statut, état civil, inscriptions, **âge calculé auto** depuis la date de naissance
- **Paiements** : ajout / modification / suppression, rattachés à une inscription (sélecteur d'année)
- **Reste à payer** : champ « Montant du » par inscription → récap payé / attendu / reste (badge rouge/vert)
- **Documents** : upload par catégorie vers Google Drive, consultation (aperçu Drive) + suppression
- **Journal de suivi** : commentaires / appels / emails horodatés, filtrable par type, groupé par date (`components/JournalSuivi.tsx`)

### Couleur du module
`familles` / `familles-light` / `familles-dark` (violet).

---

## Backend Familles — Google Sheets REST API v4 (implémenté)

Le module Familles est connecté à **Google Sheets** via l'**API REST v4** appelée
**côté serveur** avec un **compte de service** (PR #8, puis #9/#10). Ce n'est PAS
Apps Script (une variante Apps Script Web App existait dans les premières PR et a
été abandonnée ; le fichier `apps-script/web-app.gs` est conservé mais n'est plus
utilisé par l'app).

### Architecture
```
Client (pages familles)
  → lib/sheets-api.ts        (fetch vers la route interne, agnostique au transport)
  → app/api/sheets/route.ts  (routeur par "action" : GET = lecture, POST = écriture)
  → lib/google-sheets-server.ts  (clients Sheets + Drive via compte de service)
  → Google Sheet "BDD_Asso_CRM" + Google Drive
```

### Fichiers clés
| Fichier | Rôle |
|---|---|
| `lib/sheets-api.ts` | Couche client. `API_URL = "/api/sheets"`. Fonctions `fetchFamilles`, `addMembre`, `addPaiement`, `updateInscription`, `uploadFichier`, `fetchDocuments`… |
| `app/api/sheets/route.ts` | Route serveur (exception validée à la règle « pas de `app/api/` »). Switch par `action`. |
| `lib/google-sheets-server.ts` | Auth compte de service, helpers `sheetToObjects`/`appendRow`/`updateRowById`/`deleteRowById`/`ensureColumn`, client Drive `uploadToDrive`/`deleteDriveFile`. |

### Google Sheet — `BDD_Asso_CRM`
- ID : `1bOISBPwoU1xa5R4Um0fRASXKFeclJ8jB3A3CUHBMlI8`
- Tables : **FAMILLE**, **PERSONNE** (état civil), **INSCRIPTION** (niveau/statut/`Montant du`), **PAIEMENT**, **EVALUATION**, **DOCUMENTS JOINTS**, EVENEMENT, ASSIDUITE, SCOLARITE…
- L'état civil vit dans PERSONNE ; le niveau/statut dans INSCRIPTION.

### Documents → Google Drive
4 dossiers Drive (un par catégorie, IDs en dur dans `route.ts`) partagés **en Éditeur**
avec le compte de service. Fichier renommé `Nom Prénom - Type - Date.ext`, ligne
ajoutée dans la table `DOCUMENTS JOINTS`.
⚠️ Upload en base64 via la route → plafond Vercel **~4,5 Mo** par requête.

### Variables d'environnement requises (`.env.local` + Vercel)
```
GOOGLE_CLIENT_EMAIL=...@....iam.gserviceaccount.com   # compte de service
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GEMINI_API_KEY=...                                    # OCR bulletins d'inscription (Google AI Studio)
```
- Scopes utilisés : `spreadsheets` + `drive`.
- Le compte de service doit avoir **accès Éditeur** au Sheet `BDD_Asso_CRM` et aux 4 dossiers Drive.
- `NEXT_PUBLIC_SHEETS_API_URL` / `NEXT_PUBLIC_SHEETS_SCRIPT_URL` : **obsolètes**, ne plus utiliser.

### Helpers de mapping (`lib/sheets-api.ts`)
- `calculerAge(dateStr)` — âge depuis une date `JJ/MM/AAAA`
- `getStatut(statut)` — normalise vers `EN COURS` / `ARRÊTÉ` / `SUSPENDU`

> Le reste de l'app (dashboard, absences, ateliers, bénévoles, membres…)
> reste en **localStorage** — Familles et Communication sont passés sur Google Sheets/Drive.

---

## Backend Communication — feuille `CONTENUS` + Drive médias (implémenté)

Même architecture que Familles (`/api/sheets`, compte de service), appliquée aux posts.

### Feuille `CONTENUS` du Sheet `BDD_Asso_CRM`
Colonnes d'origine : `ID | Titre | Contenu principal | Image | Vidéo | Tags | État  | Date programmée | Plateforme RS | Catégorie  | Event ID`
(⚠️ `État ` et `Catégorie ` ont un espace final dans le Sheet — à respecter exactement dans le code).

Colonnes ajoutées via `ensureColumns` (créées automatiquement au premier `addPost`/`updatePost`) pour couvrir la richesse de l'app : `Auteur`, `Brief`, `Plateforme Contenu` (JSON du `plateformeContenu` par réseau), `Participants` (JSON, posts "atelier" uniquement), `Session ID`.

`Event ID` n'est **pas utilisé** par l'app (concept distinct de la feuille `EVENEMENT`, non branché sur les sessions Ateliers) — laissé vide intentionnellement.

### Médias (Image / Vidéo)
- **Une image + une vidéo max par post** (colonnes singulières) — un nouvel ajout du même type remplace le précédent dans le formulaire.
- Upload : `uploadToDrive(nom, mimeType, base64, COMMUNICATION_MEDIA_FOLDER_ID)` puis `makeFilePublic(fileId)` (contrairement aux documents Familles, les médias de posts sont rendus **publics par lien** — nécessaire pour l'aperçu inline dans `PostPreviewCard`, et sans risque car destinés à être publiés).
- `COMMUNICATION_MEDIA_FOLDER_ID` (`lib/google-sheets-server.ts`) : dossier Drive dédié, à partager manuellement en Éditeur avec le compte de service (le compte de service n'est pas membre du Drive partagé existant, donc ne peut pas y créer de dossier lui-même).
- Suppression best-effort du fichier Drive à la suppression d'un post (`deletePost`, extraction du `fileId` depuis l'URL `?id=...`).

### Fichiers clés
| Fichier | Rôle |
|---|---|
| `lib/sheets-api.ts` | `fetchPosts`, `addPost`, `updatePost`, `deletePost`, `uploadPostMedia` |
| `app/api/sheets/route.ts` | Actions `getPosts`/`addPost`/`updatePost`/`deletePost`/`uploadPostMedia`, mapping `rowToPost`/`postWriteMap` |
| `lib/google-sheets-server.ts` | `ensureColumns` (ajout de plusieurs colonnes en 1 lecture), `COMMUNICATION_MEDIA_FOLDER_ID` |

> `asso-communication-rejected` reste en `localStorage` (annotation UI, pas une donnée métier — voir section Communication).
