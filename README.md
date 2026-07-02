# Asso Pilotage

Dashboard de pilotage pour une association de formation numérique.
**Next.js 16.2.6 · React 19 · Tailwind v4 · TypeScript**
Auth **Supabase** · données **Google Sheets** (API REST v4 — Familles, Assiduité, **Ateliers**, Communication) + `localStorage` (autres modules) · IA **Gemini** (posts & OCR bulletins)

🌐 **Production** : [asso-pilotage.vercel.app](https://asso-pilotage.vercel.app)
📦 **Repo** : [github.com/anais0210/asso-pilotage](https://github.com/anais0210/asso-pilotage)

---

## Démarrage rapide

```bash
npm install
cp .env.example .env.local   # puis renseigner Supabase / Google / IA
npm run dev -- --port 3001   # http://localhost:3001
```

L'app nécessite un projet Supabase configuré (voir [`LIVRAISON.md`](LIVRAISON.md) §5 et [ADR 007](docs/explanation/adr/007-auth-supabase.md)).
**Il n'y a plus de compte démo en dur** : l'admin (`admin@asso.fr`) est créé via `scripts/create-admin.mjs` (mot de passe choisi à la création).

---

## Documentation (Diataxis)

La documentation suit le framework [Diataxis](https://diataxis.fr) — quatre quadrants distincts.

### 📚 Tutorials — Apprendre pas à pas
Pour comprendre le projet et faire sa première contribution.

- [Prise en main du projet](docs/tutorials/getting-started.md)

### 🔧 How-to — Recettes pratiques
Pour accomplir une tâche précise, quand on sait ce qu'on veut faire.

- [Ajouter un nouveau module](docs/how-to/add-new-module.md)
- [Ajouter le CRUD à un module](docs/how-to/add-crud-to-module.md)
- [Déployer sur Vercel](docs/how-to/deploy.md)
- [Migrer le projet vers l'association](docs/how-to/migration-association.md)
- [Livraison à l'association](LIVRAISON.md)

### 📖 Reference — Référence technique
Pour savoir comment quelque chose fonctionne.

- [Architecture générale](docs/reference/architecture.md)
- [Composants partagés (SlideOver, Sidebar…)](docs/reference/components.md)
- [Tokens de couleur Tailwind](docs/reference/color-tokens.md)
- [Modèles de données](docs/reference/data-models.md)

### 💡 Explanation — Décisions & contexte
Pour comprendre pourquoi les choses sont faites ainsi.

- [ADR 001 — Pas de backend (localStorage first)](docs/explanation/adr/001-no-backend.md)
- [ADR 002 — Tailwind v4 CSS-first](docs/explanation/adr/002-tailwind-v4-css-first.md)
- [ADR 003 — Auth localStorage](docs/explanation/adr/003-auth-localstorage.md) *(remplacé par ADR 007)*
- [ADR 004 — Intégration Google Sheets (Familles/Assiduité, API REST v4)](docs/explanation/adr/004-google-sheets-integration.md)
- [ADR 005 — Accessibilité](docs/explanation/adr/005-accessibilite.md)
- [ADR 006 — OCR des bulletins (Gemini)](docs/explanation/adr/006-ocr-gemini.md)
- [ADR 007 — Authentification réelle via Supabase](docs/explanation/adr/007-auth-supabase.md)

---

## Modules

| Module | URL | Description |
|---|---|---|
| Vue d'ensemble | `/dashboard` | KPIs globaux, alertes |
| Familles | `/familles` | Familles & membres — **Google Sheets** (paiements, documents Drive, suivi, **OCR bulletins**) |
| Assiduité | `/assiduite` | Hub assiduité — **Google Sheets** (présences, alertes décrochage, recherche élève) |
| Émargement | `/emargement` | Présences par séance |
| Finances | `/finances` | Demandes de financement + inscriptions |
| Ateliers | `/ateliers` | Planning, notes apprenantes, composition de groupes |
| Communication | `/communication` | Calendrier éditorial + kanban (Brouillon → À valider → Validé → Publié) + génération IA (Gemini) |
| Membres | `/membres` | Annuaire équipe |
| Mon compte | `/compte` | Profil + mot de passe (+ **gestion des comptes** pour les admins) |

> **Auth & routes API** : toutes les routes `/api/*` (`sheets`, `assiduite`, `ocr`, `generate-post`, `admin/users`) sont protégées par la session Supabase (401 si non authentifié).

---

## Chantier en cours — Module Ateliers sur Google Sheets

Le module **Ateliers** est branché sur **Google Sheets** (API REST v4, via `app/api/sheets/route.ts`).
Nécessite un fichier **`.env.local`** avec `GOOGLE_CLIENT_EMAIL` et `GOOGLE_PRIVATE_KEY` (compte de service ayant accès au classeur `BDD_Asso_CRM`).

### Tables Google Sheets dédiées aux ateliers
| Table | Rôle |
|---|---|
| `EVENEMENT2` | table partagée avec d'autres types d'événements (cours, sortie…) — ce module ne lit/écrit que les lignes `Type = "atelier"`. 1 ligne = 1 atelier-groupe (`Categorie` = type, `Groupe` = niveau, dates, mode de groupage, organisation…) |
| `ATELIER_PARTICIPANT` | jointure atelier ↔ participant, colonne `Role` (`Beneficiaire` → `PERSONNE` / `Intervenant` → `INTERVENANT`) + `Heures`/`Fonction` pour les intervenants |
| `INTERVENANT` | membres de l'asso : enseignantes FLE / stagiaires FLE / bénévoles / salariées |

### ✅ Fait
- **Lecture** depuis le Sheet : ateliers, bénéficiaires (`PERSONNE` + `INSCRIPTION` + `EVALUATION`), intervenants.
- **Écriture** : création / édition / suppression d'atelier + synchronisation des jointures. Dates stockées au format **JJ/MM/AAAA**.
- Correction du bug d'émargement (vraies colonnes `ASSIDUITE` : `Evenement ID / Personne ID / ETAT / Commentaire`).
- **Formulaire** refondu : date début + fin (élèves) / date unique (parents), **liste déroulante de type éditable**, section **intervenants** (sélecteur compact recherchable, commun aux onglets Enfants et Parents), retrait de la sélection bénéficiaires + « importer un groupe ».
- **Composition des groupes** :
  - Élèves *par notes* → barrière de **cycle scolaire** (primaire+6e / collège+lycée), déduit de la **classe** (repli sur l'âge).
  - **Théâtre / marionnettes** → sélection **directe** des élèves (sélecteur compact recherchable, filtré par niveau : marionnettes = élémentaire+6e, théâtre = collège+lycée+6e), **sans brouillon** → affichés directement dans l'onglet **Groupes**.
  - Parents *par notes* (pas de cycle).
- Toujours l'**inscription la plus récente** retenue (élève réinscrit chaque année → nouveau niveau).
- Validation d'un brouillon → écrit les groupes dans le Sheet (1 ligne `EVENEMENT2` par groupe).

### ⏳ Reste à faire
- **Étape 7** — émargement **par groupe** : ajouter une colonne `Groupe ID` à `ASSIDUITE`.
- **Étape 8** — **dashboard par type d'atelier** (quantitatif + qualitatif) : ajouter à `EVENEMENT2` les colonnes heures salariés / stagiaires / bénévoles + objectifs atteints.
- Décision base de données : scinder `INSCRIPTION."Niveau / Classe"` en `Niveau CECRL` + `Classe scolaire` (proposé, non fait).

> ⚠️ Ne pas créer de données de test accentuées via `curl` (l'outil terminal casse l'UTF-8 → `U+FFFD`). Passer par le formulaire de l'appli ou un script Node (qui gère l'UTF-8).

---

## Pour les assistants IA

Lire dans cet ordre avant de coder :
1. `CLAUDE.md` — contexte projet, conventions, pièges
2. `AGENTS.md` — avertissements techniques stack
3. `docs/how-to/add-new-module.md` — si ajout de module
