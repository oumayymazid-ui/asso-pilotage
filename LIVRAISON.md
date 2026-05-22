# Guide de livraison — Asso Pilotage

> **À mettre à jour** à chaque nouvelle fonctionnalité, intégration ou changement de configuration avant livraison à l'association.
>
> Dernière mise à jour : 2026-05-20

---

## Table des matières

1. [Présentation](#1-présentation)
2. [Fonctionnalités](#2-fonctionnalités)
3. [Accès et comptes](#3-accès-et-comptes)
4. [Déploiement Vercel](#4-déploiement-vercel)
5. [Configuration après livraison](#5-configuration-après-livraison)
6. [Intégrations externes](#6-intégrations-externes)
7. [Limites actuelles et roadmap](#7-limites-actuelles-et-roadmap)
8. [Support et contacts](#8-support-et-contacts)

---

## 1. Présentation

**Asso Pilotage** est un tableau de bord de gestion interne pour une association de formation numérique.

Il centralise :
- Le suivi des bénéficiaires (enfants + contact parent)
- L'organisation et l'émargement des ateliers
- Le suivi des financements
- La communication sur les réseaux sociaux
- La gestion des membres de l'équipe
- La roadmap stratégique

### Stack technique

| Élément | Détail |
|---|---|
| Framework | Next.js 16 (App Router) |
| UI | Tailwind CSS v4, lucide-react |
| Persistance | `localStorage` navigateur (pas de base de données) |
| Hébergement | Vercel (déploiement automatique) |
| Dépôt | github.com/anais0210/asso-pilotage |
| URL production | asso-inky.vercel.app |

> **Important** : toutes les données sont stockées dans le navigateur (`localStorage`). Chaque utilisateur·rice a ses propres données locales. Il n'y a pas de synchronisation entre les postes à ce stade (voir phase 2 en section 7).

---

## 2. Fonctionnalités

### Vue d'ensemble (`/dashboard`)
- KPIs globaux : alertes, stats par module
- Accès rapide à tous les modules depuis la page d'accueil
- Compteur d'alertes actives (deadline, salles non confirmées, posts à créer, candidatures en attente)

### Émargement (`/emargement`)
- Sélection de la séance du jour
- Liste de présence des bénéficiaires avec statuts : présent / absent / retard
- Signalement automatique si un bénéficiaire cumule 3 absences ou plus
- Contact parent affiché directement (téléphone cliquable) pour les absents
- Persistance de la présence par séance (`localStorage`)

### Finances (`/finances`)
- Suivi des demandes de financement (subventions, appels à projets)
- Statuts : en cours / accordé / refusé / à compléter
- Alertes sur les deadlines proches
- Suivi des inscriptions (formations, ateliers payants)
- CRUD complet via formulaire latéral

### Ateliers (`/ateliers`)
- **Ateliers** : création et suivi des séances (date, heure, salle, formatrice, bénévole affecté·e, bénéficiaires inscrits)
  - Bouton "Émarger" pour aller directement à la feuille de présence
- **Groupes** : composition de groupes par niveau, âge ou mixte
  - Gestion des membres par groupe
  - Badges niveau (débutant / intermédiaire / avancé) et tranche d'âge
  - Import rapide d'un groupe dans une séance

### Bénéficiaires (`/beneficiaires`)
- Liste complète avec recherche (prénom, nom, parent)
- Filtres : statut (actif / diplômé / abandon) et niveau
- Fiche complète : identité enfant, contact parent, note d'évaluation, niveau auto-calculé
- Statistiques : nombre d'ateliers suivis, absences, groupes
- CRUD complet via formulaire latéral
- Note d'évaluation (0–20) → dérive automatiquement le niveau :
  - ≤ 10 : débutant
  - 11–16 : intermédiaire
  - ≥ 17 : avancé

### Communication (`/communication`)
- **Calendrier éditorial** : vue mensuelle des posts planifiés avec leurs statuts
- **Kanban de validation** : circuit Brouillon → En attente de validation → Validé → Publié
- **Événements** : création et gestion des événements de l'association, liables aux posts
- **Intégrations réseaux sociaux** : connexion Zapier / Make via webhook (voir section 6)
- CRUD posts et événements
- Chaque post contient : catégorie (atelier / autre), titre, brief (contexte IA), contenu principal, médias (images/vidéos), plateformes cibles avec personnalisation par plateforme (contenu spécifique, tags, lien), date programmée, état, auteur, événement lié
- Posts **atelier** : liste de participants structurée (apprenantes, bénévoles, enseignant·es), importable depuis une session du module Ateliers, + liste automatique des personnes à flouter (basée sur le droit à l'image — champ `droitsImage` à configurer dans les fiches bénéficiaires)
- Clic sur une carte Kanban → édition directe (sans étape intermédiaire)
- **Génération IA** : bouton ✨ "Générer avec l'IA" dans le formulaire — génère le contenu principal + une variante par plateforme + des hashtags via Claude (Anthropic). Pour les posts "atelier" : contexte automatique depuis la session. Pour les posts "autre" : basé sur un brief libre saisi par l'utilisateur.

### Membres (`/membres`)
- Annuaire de l'équipe (salariées, bénévoles, coordinatrices)
- Rôles : admin / formatrice / coordinatrice / bénévole
- Statuts : active / inactive / en attente
- Gestion des candidatures (validation / refus)
- CRUD complet

### Roadmap stratégique (`/roadmap`)
- Matrice impact / facilité des projets
- Vue par thème (6 thèmes, 16 use cases, 43 sous-actions)
- Suivi d'avancement par sous-action (à faire / en cours / fait)

### Gestion de compte (`/compte`)
- Modification du profil (prénom, nom, email, mot de passe)
- Suppression de son propre compte
- **Admin uniquement** : création, modification et suppression de comptes membres

---

## 3. Accès et comptes

### Compte administrateur par défaut

| Champ | Valeur |
|---|---|
| Email | `admin@asso.fr` |
| Mot de passe | `admin1234` |
| Rôle | Administratrice |

> ⚠️ **Changer le mot de passe admin** dès la première connexion en production (page `/compte`).

### Rôles disponibles

| Rôle | Accès |
|---|---|
| `admin` | Accès complet + gestion des comptes membres |
| `formatrice` | Tous les modules sauf gestion des comptes |
| `coordinatrice` | Tous les modules sauf gestion des comptes |
| `benevole` | Lecture seule sur la plupart des modules |

### Créer les comptes de l'équipe

1. Se connecter avec le compte admin
2. Aller dans `/compte` → section **Gestion des comptes**
3. Cliquer **Nouveau compte**
4. Remplir prénom, nom, email, mot de passe, rôle
5. Transmettre les identifiants à la personne concernée

---

## 4. Déploiement Vercel

### URL de production
```
https://asso-inky.vercel.app
```

### Déploiement automatique
Tout push sur la branche `main` déclenche un déploiement automatique sur Vercel.

### Variables d'environnement (à configurer sur Vercel)

Aller dans **Vercel → Project Settings → Environment Variables** :

| Variable | Obligatoire | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Oui (pour la génération IA) | Clé API Anthropic — obtenir sur [console.anthropic.com](https://console.anthropic.com/) |

> **En local** : créer un fichier `.env.local` à la racine du projet :
> ```
> ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxx
> ```
> Ce fichier est ignoré par git (`.env*` dans `.gitignore`).

> **Phase 2** : quand l'intégration Google Apps Script sera activée, ajouter :
> ```
> NEXT_PUBLIC_SHEETS_SCRIPT_URL=https://script.google.com/macros/s/xxx/exec
> ```

### Déployer manuellement

```bash
git push origin main
# Vercel détecte le push et redéploie automatiquement (~1 min)
```

---

## 5. Configuration après livraison

### Étape 1 — Première connexion
1. Ouvrir `https://asso-inky.vercel.app`
2. Se connecter avec `admin@asso.fr` / `admin1234`
3. Aller dans `/compte` → **Changer le mot de passe**

### Étape 2 — Créer les comptes de l'équipe
Voir section 3 — créer un compte par membre de l'équipe (4 personnes).

### Étape 3 — Saisir les données initiales
Chaque membre de l'équipe doit saisir les données dans son navigateur :

- **Bénéficiaires** (`/beneficiaires`) : importer la liste complète
- **Groupes** (`/ateliers` → Groupes) : créer les groupes existants
- **Ateliers** (`/ateliers`) : planifier les prochaines séances
- **Financements** (`/finances`) : saisir les demandes en cours
- **Membres** (`/membres`) : compléter la liste de l'équipe

> ⚠️ **Rappel** : les données sont stockées localement dans chaque navigateur. Chaque personne a sa propre instance. La synchronisation entre postes est prévue en **phase 2** (Supabase).

### Étape 4 — Configurer l'intégration réseaux sociaux (optionnel)
Voir section 6.

---

## 6. Intégrations externes

### 6.1 Réseaux sociaux — Zapier / Make (disponible)

Permet de publier automatiquement les posts approuvés sur LinkedIn, Instagram et Facebook.

**Configuration dans l'app** :
1. Aller dans `/communication` → onglet **Intégrations**
2. Sélectionner **Zapier / Make**
3. Créer un compte Zapier (gratuit) ou Make (gratuit jusqu'à 1 000 ops/mois)
4. Créer un Zap/scénario avec déclencheur **Webhook → Catch Hook**
5. Copier l'URL du webhook dans l'app
6. Connecter LinkedIn, Instagram for Business, Facebook Pages dans Zapier/Make
7. Choisir le déclencheur (post "approuvé" ou "publié")
8. Activer le toggle

**Liens** :
- [zapier.com](https://zapier.com)
- [make.com](https://make.com)

---

### 6.2 Google Sheets (phase 1 — CSV, phase 2 — Apps Script)

L'association gère ses données dans Google Sheets. Trois phases d'intégration sont prévues :

| Phase | Méthode | Statut |
|---|---|---|
| Phase 1 | Export / Import CSV manuel | À implémenter |
| Phase 2 | Google Apps Script (webhook HTTP) | Prévu |
| Phase 3 | Migration Supabase complète | Long terme |

**Structure attendue des Google Sheets** (mise à jour chantier 2.1 — composition de groupes) :

Sheet **"Bénéficiaires"** :
- Identité : `id | prenom | nom | dateNaissance | email | telephone | nomParent | telephoneParent | emailParent | dateInscription | niveau | statut | notes`
- Notes test initial : `init_comprehensionEcrite | init_comprehensionOrale | init_expressionEcrite | init_expressionOrale`
- Notes test final : `final_comprehensionEcrite | final_comprehensionOrale | final_expressionEcrite | final_expressionOrale`

Sheet **"Ateliers"** :
- Identité : `id | titre | description | date | heure | duree | salle | formatrice | statut`
- Public : `ageMin | ageMax | tailleGroupeCible | ratioEncadrement | mixerNiveaux`
- Compétences ciblées : `comp_comprehensionEcrite | comp_comprehensionOrale | comp_expressionEcrite | comp_expressionOrale`
- Organisation (JSON) : `taches | besoins | etapes | personnesImpliqueesIds`
- Participants : `beneficiaireIds | benevoleIds`

Sheet **"Groupes"** :
`id | nom | atelierId | type | description | beneficiaireIds | etat | dateValidation`
> `etat` ∈ {`brouillon`, `valide`}

Sheet **"Présences"** :
`sessionId | beneficiaireId | statut | date`

> Voir `docs/explanation/adr/004-google-sheets-integration.md` (mapping détaillé)
> et `docs/how-to/composition-groupes.md` (guide d'utilisation).

---

### 6.3 Supabase (phase 2 — base de données partagée)

Migration prévue pour synchroniser les données entre tous les postes de l'équipe et permettre la publication directe sur les réseaux sociaux sans outil tiers.

> Voir `docs/explanation/adr/001-persistance-locale.md` pour le détail.

---

## 7. Limites actuelles et roadmap

### Limites connues en phase 1

| Limite | Impact | Solution phase 2 |
|---|---|---|
| Données en `localStorage` | Pas de partage entre postes | Migration Supabase |
| Pas de notifications | Alertes visibles seulement à la connexion | Push notifications (Supabase Realtime) |
| Export CSV non implémenté | Saisie manuelle depuis Google Sheets | Boutons export/import CSV |
| Publication réseaux sociaux via Zapier | Dépendance service tiers | Direct via Supabase Edge Functions |
| Pas de gestion de fichiers | Pas de pièces jointes | Supabase Storage |

### Fonctionnalités prévues (phase 2)

- [ ] Export / Import CSV bénéficiaires et présences
- [ ] Synchronisation Google Sheets via Apps Script
- [ ] Base de données Supabase partagée (multi-utilisateurs)
- [ ] Authentification renforcée (2FA)
- [ ] Publication directe réseaux sociaux (sans Zapier)
- [ ] Notifications par email (absences, deadlines)

---

## 8. Support et contacts

| Rôle | Contact |
|---|---|
| Développement | anais.camille.sparesotto@gmail.com |
| Dépôt GitHub | github.com/anais0210/asso-pilotage |
| Hébergement | asso-inky.vercel.app (Vercel) |

### En cas de problème

**L'app ne charge pas** :
1. Vider le cache navigateur (`Ctrl+Shift+R` / `Cmd+Shift+R`)
2. Vérifier le statut de Vercel : [vercel.com/status](https://vercel.com/status)

**Les données ont disparu** :
- Les données sont dans le `localStorage` du navigateur. Si le cache a été vidé, les données sont perdues.
- → Prévoir une sauvegarde régulière via export CSV (à implémenter en phase 2)

**Ajouter un·e utilisateur·rice** :
- Seul·e un·e admin peut créer des comptes (page `/compte`)

---

*Document maintenu par l'équipe de développement — à mettre à jour avant chaque livraison.*
