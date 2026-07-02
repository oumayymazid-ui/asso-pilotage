---
type: how-to
---

# Migrer le projet vers les comptes de l'association

Ce guide décrit **pas à pas** comment transférer la propriété technique d'Asso Pilotage
des comptes personnels (actuellement `anais0210`) vers des comptes appartenant à
**l'association**. Objectif : que l'asso soit autonome et propriétaire de son outil,
sans dépendance à un compte personnel.

> ⏱️ Compter **2 à 3 heures**. Prévoir de faire la bascule sur un créneau calme
> (le site peut être indisponible quelques minutes pendant la reconnexion Vercel).

---

## Vue d'ensemble

| Service | Compte actuel | Cible association | Ce qui est transféré |
|---|---|---|---|
| **GitHub** | `anais0210` (perso) | Organisation GitHub de l'asso | Le dépôt `asso-pilotage` (historique, issues, PRs) |
| **Vercel** | Compte perso | Équipe (Team) Vercel de l'asso | Le projet + variables d'env + domaine |
| **Google Cloud** | Projet GCP perso | Projet GCP de l'asso | Le **compte de service** (clés) |
| **Google Sheet + Drive** | Drive perso | Drive de l'asso | Le Sheet `BDD_Asso_CRM` + 4 dossiers de documents |
| **Google AI Studio (Gemini)** | Compte perso | Compte + facturation asso | La clé API (OCR + module Communication) |

### Comptes à créer côté association (préalable)

Avant de commencer, créer :
1. Une **organisation GitHub** (github.com → *Your organizations* → *New organization*, plan gratuit suffisant).
2. Un **compte Google** de l'association (idéalement un **Google Workspace** ou au minimum un compte Gmail dédié, ex. `tech@nom-asso.org`).
3. Un **compte Vercel** rattaché à ce compte, avec une **Team**.
4. Une **clé API Gemini** (Google AI Studio) avec un moyen de paiement de l'asso si nécessaire.

> 💡 Utiliser une **adresse email de l'association** (pas une adresse perso) pour créer
> chacun de ces comptes. C'est le point le plus important de toute la passation.

### Ordre recommandé

Faire dans cet ordre pour minimiser les interruptions :

1. GitHub (transfert du dépôt)
2. Google Cloud + Sheet/Drive (le backend Familles)
3. Gemini (clé API)
4. Vercel (reconnexion + variables d'env) ← **en dernier**, une fois les secrets prêts
5. Vérifications + mise à jour des références dans le code

---

## 1. GitHub — transférer le dépôt

Le transfert **conserve** l'historique, les issues, les pull requests et les stars.
L'ancienne URL redirige automatiquement vers la nouvelle.

1. Sur `github.com/anais0210/asso-pilotage` → **Settings** → onglet **General**.
2. Tout en bas, section **Danger Zone** → **Transfer ownership**.
3. Nouveau propriétaire = **l'organisation de l'association**. Confirmer en tapant le nom du dépôt.
4. Un·e admin de l'organisation accepte le transfert (email de confirmation).
5. Ré-inviter les collaboratrices/collaborateurs dans **Settings → Collaborators and teams** de la nouvelle orga.

**Après le transfert :**

- Mettre à jour le *remote* Git local de chaque personne :
  ```bash
  git remote set-url origin git@github.com:NOM-ORGA-ASSO/asso-pilotage.git
  git remote -v   # vérifier
  ```
- ⚠️ La connexion Vercel↔GitHub **se casse** au transfert : on la refait à l'étape 4.

---

## 2. Google Cloud + Sheet/Drive — le backend Familles

Le module **Familles** lit/écrit dans Google Sheets et stocke des documents dans Google Drive,
via un **compte de service** (voir [ADR 004](../explanation/adr/004-google-sheets-integration.md)).
Deux choses à migrer : les **données** (Sheet + dossiers Drive) et les **clés** (compte de service).

### 2a. Transférer les données (Sheet + Drive)

> 🔑 **Recommandé : transférer la propriété plutôt que recréer.** Les identifiants du Sheet
> et des dossiers sont **codés en dur dans le code** (voir plus bas). Un transfert garde les
> mêmes IDs → **aucune modification de code**. Recréer de zéro obligerait à changer les IDs.

- **Google Sheet** `BDD_Asso_CRM` (ID `1bOISBPwoU1xa5R4Um0fRASXKFeclJ8jB3A3CUHBMlI8`) :
  ouvrir → **Partager** → donner le rôle **Propriétaire** au compte Google de l'asso, puis
  celui-ci accepte le transfert de propriété.
- **Les 4 dossiers Drive** de documents (IDs dans `app/api/sheets/route.ts`) : idem, transférer
  la propriété au compte de l'asso.
- Alternative plus propre à terme : déplacer le Sheet et les dossiers dans un **Drive partagé**
  (*Shared Drive*) appartenant à l'association.

### 2b. Recréer le compte de service

1. [console.cloud.google.com](https://console.cloud.google.com) connecté au **compte Google de l'asso** → créer un **projet** (ex. `asso-pilotage`).
2. **APIs et services → Bibliothèque** → activer **Google Sheets API** *et* **Google Drive API**.
3. **APIs et services → Identifiants → Créer des identifiants → Compte de service**.
4. Sur le compte de service → onglet **Clés → Ajouter une clé → JSON** → télécharger le fichier.
5. Dans le JSON, récupérer :
   - `client_email` → variable `GOOGLE_CLIENT_EMAIL`
   - `private_key` → variable `GOOGLE_PRIVATE_KEY`
6. **Partager** le Sheet `BDD_Asso_CRM` **et** les 4 dossiers Drive avec cet email de compte de service, en rôle **Éditeur**.

> Détail du format de `GOOGLE_PRIVATE_KEY` : voir la section « Variables d'environnement » ci-dessous.

---

## 3. Gemini — clé API (OCR + module Communication)

L'OCR des bulletins d'inscription (`app/api/ocr/route.ts`) et la génération IA des posts
(`app/api/generate-post/route.ts`) utilisent l'API Google Gemini.

1. [aistudio.google.com](https://aistudio.google.com) connecté au compte Google de l'asso → **Get API key**.
2. Copier la clé générée → variable `GEMINI_API_KEY`.
3. Après la bascule, **révoquer l'ancienne clé** personnelle.

---

## 4. Vercel — reconnecter et configurer

À faire **en dernier**, une fois GitHub transféré et les secrets prêts.

1. Se connecter à Vercel avec le compte de l'asso → créer/choisir une **Team**.
2. **Add New → Project → Import** le dépôt `NOM-ORGA-ASSO/asso-pilotage`.
   - Si l'app GitHub de Vercel n'a pas accès à l'orga : *Install / Configure* pour autoriser l'organisation de l'asso.
3. Framework détecté : **Next.js** (rien à changer).
4. **Settings → Environment Variables** — ajouter, pour **Production + Preview + Development** :

   | Nom | Valeur |
   |---|---|
   | `GOOGLE_CLIENT_EMAIL` | l'email du compte de service (étape 2b) |
   | `GOOGLE_PRIVATE_KEY` | la clé privée du compte de service |
   | `GEMINI_API_KEY` | la clé Gemini (étape 3) |

5. **Deploy**. Vérifier le build (0 erreur).
6. **Settings → Domains** : reconfigurer le domaine de production (`asso-pilotage.vercel.app` ou un domaine propre à l'asso).

> L'ancien projet Vercel personnel peut être **supprimé** une fois le nouveau validé.

---

## 5. Après la bascule — références dans le code

Plusieurs fichiers citent en dur l'ancien compte (`anais0210`) ou l'URL Vercel. À mettre à jour :

- `README.md`, `CLAUDE.md`, `CONTRIBUTING.md`
- `docs/how-to/deploy.md`, `docs/tutorials/getting-started.md`
- `app/docs/how-to/deployer/page.tsx`, `app/docs/gitflow/page.tsx`, `app/docs/demarrage/page.tsx`, `app/docs/tutoriels/getting-started/page.tsx`, `app/docs/livraison/page.tsx`
- `LIVRAISON.md`, `DEMARRAGE.md`

Repérer les occurrences :
```bash
grep -rlnE "anais0210|asso-pilotage\.vercel|anais-projects" . | grep -vE "node_modules|package-lock|\.next/"
```

---

## Variables d'environnement (récapitulatif)

`.env.local` (local) **et** Vercel (Production + Preview + Development) :

```
GOOGLE_CLIENT_EMAIL=...@....iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GEMINI_API_KEY=...
```

- `GOOGLE_PRIVATE_KEY` : coller la valeur **exactement comme dans le JSON**, avec les `\n`
  littéraux. Le code les reconvertit en vrais sauts de ligne (`lib/google-sheets-server.ts`).
- Anciennes variables `NEXT_PUBLIC_SHEETS_API_URL` / `NEXT_PUBLIC_SHEETS_SCRIPT_URL` :
  **obsolètes**, ne pas les remettre.

---

## Sécurité — à ne pas oublier

- [ ] **Révoquer** l'ancienne clé Gemini personnelle.
- [ ] **Supprimer** l'ancien compte de service Google (ou sa clé) une fois le nouveau en place.
- [ ] **Retirer** les anciens accès personnels au Sheet / aux dossiers Drive.
- [ ] **Retirer** les collaborateurs qui ne doivent plus avoir accès au dépôt.
- [ ] Changer le mot de passe du **compte démo applicatif** (`admin@asso.fr` / `AdminAsso2026!`).
      L'authentification passe par Supabase (voir [ADR 007](../explanation/adr/007-auth-supabase.md)) — l'ancien
      schéma localStorage décrit dans [ADR 003](../explanation/adr/003-auth-localstorage.md) est obsolète.
- [ ] Ne **jamais** committer le JSON du compte de service ni les clés dans le dépôt.

---

## Checklist finale

- [ ] Dépôt GitHub transféré, collaborateurs ré-invités, remotes locaux mis à jour
- [ ] Sheet `BDD_Asso_CRM` + dossiers Drive appartenant à l'asso
- [ ] Compte de service asso créé, Sheet + dossiers partagés en Éditeur
- [ ] Clé Gemini de l'asso créée
- [ ] Projet Vercel de l'asso déployé avec les 3 variables d'env → build OK
- [ ] Module **Familles** testé en prod (créer/lire/modifier une famille, un paiement, un document)
- [ ] Génération IA testée (module **Communication**)
- [ ] Références `anais0210` / `asso-pilotage.vercel.app` mises à jour dans le code
- [ ] Anciens accès et clés révoqués
