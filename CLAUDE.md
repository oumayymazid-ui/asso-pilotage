# Asso Pilotage — Contexte IA

> Ce fichier est lu par les assistants IA (Claude Code, Copilot, Cursor…) en début de session.
> Il donne le contexte projet indispensable pour ne pas casser ce qui existe.

## Ce qu'est ce projet

Dashboard de pilotage pour une association de formation numérique (Ada Tech School).
**SaaS Next.js** — interface uniquement, pas de backend pour l'instant.
Persistance : `localStorage` (voir ADR 001). Données mockées dans `lib/`.

## Stack exacte

| Outil | Version | Note critique |
|---|---|---|
| Next.js | **16.2.6** | App Router, conventions différentes du Next.js courant — **lire `AGENTS.md`** |
| Tailwind CSS | **v4** | Config CSS-first dans `globals.css`, **pas de `tailwind.config.ts`** |
| React | 19 | Server Components + `"use client"` explicite |
| TypeScript | 5 | `strict: true` |
| lucide-react | 1.16.0 | Certaines icônes n'existent pas — voir liste dans `AGENTS.md` |
| @anthropic-ai/sdk | ^0.97.1 | Génération IA posts Communication — clé dans `.env.local` |

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
└── roadmap/        Matrice impact/facilité + suivi sous-actions

components/
├── Sidebar.tsx     Navigation + chip utilisateur connecté
├── SlideOver.tsx   Panneau latéral réutilisable (TOUTES les forms passent par là)
├── StatCard.tsx    Carte KPI dashboard
└── AuthGate.tsx    Protection des routes + affichage conditionnel sidebar

lib/
├── auth.ts         Helpers auth (login, register, logout, getSession)
├── auth-context.tsx Provider React + hook useAuth()
├── mock-data.ts    Données mockées (absences, finances, ateliers, com, bénévoles)
├── emargement-data.ts Séances + présences initiales
└── roadmap-data.ts  6 thèmes, 16 use cases, 43 sous-actions

app/api/
└── generate-post/route.ts  POST — génère contenu + hashtags via Claude (Anthropic SDK)
                             Requiert ANTHROPIC_API_KEY dans .env.local
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
// role : "admin" | "formatrice" | "coordinatrice" | "benevole"
```

### "use client" — règle
Toutes les pages sont `"use client"` (localStorage, état, hooks).
Les composants partagés aussi (`Sidebar`, `SlideOver`, `AuthGate`).
Pas de Server Actions, pas d'API routes dans ce projet (voir ADR 001).

## Modèle Post (Communication)

```typescript
// ⚠️ "en attente de validation" a été renommé "à valider" (branche Cas_4-1-2)
// Migration auto localStorage au chargement — voir useEffect dans communication/page.tsx
type ValidationStatus = "brouillon" | "à valider" | "validé" | "publié"
type CategoriePost = "atelier" | "autre"

interface PlatformeContent { contenu?: string; tags?: string; lien?: string }
interface MediaItem { nom: string; type: string; preview?: string }
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
  media?: MediaItem[]                // images (dataURL) ou vidéos (nom uniquement)
  plateforme: Plateforme[]           // LinkedIn | Instagram | Facebook
  plateformeContenu: Partial<Record<Plateforme, PlatformeContent>>  // surcharge par plateforme
  statut: ValidationStatus
  auteur: string
  evenement?: string | null          // ⚠️ deprecated UI — champ conservé pour compat localStorage
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

Webhook Zapier : déclenché sur `"validé"` ou `"publié"`.

## Page de seed de test (à supprimer avant prod)

`/app/dev/seed/page.tsx` — injecte des données fictives dans le localStorage pour tester
la section participants et le floutage dans Communication.
IDs réservés : 9001–9099. Supprimer ce fichier + le dossier `app/dev/` avant la mise en production.

## Ce qu'il ne faut PAS faire

- ❌ Ne pas créer `tailwind.config.ts` — config dans `globals.css`
- ❌ Ne pas importer `Linkedin`, `Instagram`, `Facebook`, `Kanban` de lucide-react (n'existent pas en v1.16.0)
- ❌ Ne pas utiliser `bg-[var(--color-xxx)]` — utiliser `bg-xxx`
- ❌ Ne pas créer de routes API (`app/api/`) sans décision d'équipe — exception : `app/api/generate-post/route.ts` (génération IA, décidé en session)
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
- Compte démo : `admin@asso.fr` / `admin1234`

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
├── page.tsx        Page principale : calendrier, onglet Suivi (kanban), intégrations
└── publies/
    └── page.tsx    Archive de tous les posts publiés (lecture seule + SlideOver)
```

### Clés localStorage — Communication
| Clé | Type | Contenu |
|-----|------|---------|
| `asso-communication-posts` | `Post[]` | Tous les posts |
| `asso-communication-rejected` | `number[]` | IDs posts repassés en brouillon via ✕ |
| `asso-communication-integrations` | `IntegrationsConfig` | Config webhook Zapier |

### Onglets de la page Communication
1. **Calendrier** — posts uniquement, fond coloré par statut, clic sur une date = nouveau post
2. **Suivi** — kanban 4 colonnes : Brouillon / À valider / Validé / Publié
3. **Intégrations** — webhook Zapier/Make

> ⚠️ L'onglet **Événements** a été entièrement supprimé (Cas_4-1-2).
> Toute l'infrastructure associée a été retirée : type `Evenement`, `TypeEvenement`,
> `EventsTab`, `STORAGE_EVENTS`, `eventsInitiaux`, `emptyEvent`, `TYPE_OPTIONS`.
> Le champ `evenement` reste dans l'interface `Post` pour compatibilité localStorage
> mais n'est plus affiché ni éditable.

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