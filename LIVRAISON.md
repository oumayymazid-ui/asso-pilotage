# Guide de livraison — Asso Pilotage

> **À mettre à jour** à chaque nouvelle fonctionnalité, intégration ou changement de configuration avant livraison à l'association.
>
> Dernière mise à jour : 2026-07-02

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
- Le suivi des **familles bénéficiaires** (familles, parents, enfants)
- L'**assiduité** et l'émargement des ateliers
- L'organisation des ateliers et la composition des groupes
- Le suivi des financements
- La communication sur les réseaux sociaux
- La gestion des membres de l'équipe

### Stack technique

| Élément | Détail |
|---|---|
| Framework | Next.js 16 (App Router) |
| UI | Tailwind CSS v4, lucide-react, charte graphique **« Estuaire »** (palette teal/vert forêt/doré, Poppins + Inter — voir `docs/reference/charte-graphique-estuaire.md`) |
| Authentification | **Supabase Auth** (comptes réels, sessions serveur) |
| Persistance données | **Hybride** : Google Sheets (Familles, Assiduité, Communication) + `localStorage` (autres modules) |
| Documents / Médias | Google Drive (pièces jointes des fiches membres + images/vidéos des posts) |
| IA | Google Gemini (génération de posts + OCR bulletins) |
| Hébergement | Vercel (déploiement automatique) |
| Dépôt | github.com/anais0210/asso-pilotage |
| URL production | asso-inky.vercel.app |

> **Important — où vivent les données :**
> - **Authentification** : Supabase (comptes partagés, vérifiés côté serveur).
> - **Familles, Assiduité & Communication** : Google Sheets `BDD_Asso_CRM` (données **partagées** entre tous les postes). Images/vidéos des posts sur Google Drive.
> - **Autres modules** (dashboard, émargement, ateliers, finances, membres) : `localStorage` du navigateur → **propres à chaque poste**, pas encore synchronisés (voir section 7).

---

## 2. Fonctionnalités

### Vue d'ensemble (`/dashboard`)
- KPIs globaux : alertes, stats par module
- Accès rapide à tous les modules depuis la page d'accueil
- Compteur d'alertes actives (deadline, salles non confirmées, posts à créer, candidatures en attente)

### Familles / Bénéficiaires (`/familles`) — **Google Sheets**
- Listing avec onglets (Familles / Membres), recherche par préfixe tolérante aux accents, tri alphabétique
- **Fiche famille** : infos (adresse, quartier QVP, composition, contact principal cliquable), **autocomplétion d'adresse** (Base Adresse Nationale), cartes membres, journal de suivi
- **Fiche membre** : état civil, **âge calculé automatiquement**, inscriptions (niveau/statut), **paiements** + reste à payer, **documents** (upload Google Drive — Fiche d'inscription, Droit à l'image, Charte d'engagement, Autorisation de sortie, Bulletins ; statut Oui/Non **dérivé automatiquement** de la présence du fichier, plus de saisie manuelle), journal de suivi (commentaires / appels / emails)
- **Sélecteur de date natif** pour les dates (naissance, inscription, paiement)
- **OCR de bulletins d'inscription (PDF)** : à l'ajout d'un membre, l'upload d'un bulletin PDF **pré-remplit automatiquement** nom, prénom, date de naissance, téléphones, montant (via Google Gemini)

### Assiduité (`/assiduite`) — **Google Sheets**
- Hub connecté en direct au Google Sheet (séances, personnes, présences)
- KPIs de présence globaux + stats par groupe de niveau
- **Alerte décrochage** automatique dès **3 absences** (et « à surveiller » à 2)
- Détail par élève avec tri et **recherche par nom**

### Émargement (`/emargement`)
- Sélection de la séance du jour
- Liste de présence avec statuts : présent / absent / retard
- Signalement automatique si un bénéficiaire cumule 3 absences ou plus
- Persistance de la présence par séance (`localStorage`)

### Finances (`/finances`)
- Suivi des demandes de financement (subventions, appels à projets)
- Statuts : en cours / accordé / refusé / à compléter
- Alertes sur les deadlines proches
- Suivi des inscriptions (formations, ateliers payants)
- CRUD complet via formulaire latéral

### Ateliers (`/ateliers`)
- **Ateliers** : création et suivi des séances (date, heure, salle, formatrice, bénévole affecté·e, bénéficiaires inscrits)
  - Bouton « Émarger » pour aller directement à la feuille de présence
- **Groupes** : composition de groupes par niveau, âge ou mixte, import rapide dans une séance

### Communication (`/communication`) — **Google Sheets** (feuille CONTENUS)
- **Calendrier éditorial** : vue mensuelle des posts planifiés, fond coloré par statut
- **Suivi (Kanban)** : circuit **Brouillon → À valider → Validé → Publié**
  - Clic sur une carte → édition directe
  - Point rouge sur les posts repassés en brouillon depuis « à valider »
  - Colonne « Publié » limitée aux 3 plus récents + archive complète (`/communication/publies`)
- Chaque post : catégorie (atelier / autre), titre, brief, contenu, une image et/ou une vidéo (**stockées sur Google Drive**), plateformes cibles avec personnalisation, date programmée, statut, auteur
- Posts **atelier** : participants (apprenantes, bénévoles, formatrices) importables depuis une session Ateliers + liste automatique des personnes à flouter (droit à l'image)
- **Aperçu visuel** du rendu par réseau social (LinkedIn/Instagram/Facebook) en direct dans le formulaire
- **Génération IA** (bouton ✨) : contenu principal + variante et hashtags par plateforme via Gemini

### Membres (`/membres`)
- Annuaire de l'équipe (salariées, bénévoles, coordinatrices)
- Rôles, statuts, gestion des candidatures, CRUD complet

### Gestion de compte (`/compte`)
- Modification de son profil (prénom, nom, email) et de son mot de passe
- **Admin uniquement** : création, modification et suppression de comptes membres

### Pages légales (`/mentions-legales`, `/confidentialite`, `/accessibilite`)
- Accessibles **sans connexion** (exceptions publiques, voir `AuthGate.tsx`) et depuis l'app connectée (pied de sidebar + pied du tableau de bord)

---

## 3. Accès et comptes

> L'authentification passe désormais par **Supabase** (comptes réels, sessions vérifiées côté serveur).
> **Il n'y a pas d'inscription publique** : les comptes sont créés par une administratrice.

### Compte administrateur

| Champ | Valeur |
|---|---|
| Email | `admin@asso.fr` |
| Mot de passe | *défini à la création du compte* (voir section 5) |
| Rôle | Super administratrice (`super_admin`) |

> ⚠️ **Changer le mot de passe admin** dès la première connexion en production (page `/compte`).

### Rôles disponibles

| Rôle | Accès |
|---|---|
| `super_admin` / `admin` | Accès complet + **gestion des comptes** membres |
| `formatrice` | Tous les modules sauf gestion des comptes |
| `coordinatrice` | Tous les modules sauf gestion des comptes |
| `benevole` | Lecture seule sur la plupart des modules |

### Créer les comptes de l'équipe

1. Se connecter avec le compte admin
2. Aller dans `/compte` → section **Gestion des comptes**
3. Cliquer **Nouveau compte**
4. Remplir prénom, nom, email, mot de passe, rôle
5. Transmettre les identifiants à la personne concernée

> Les comptes sont stockés dans Supabase (partagés entre tous les postes) — contrairement aux anciens comptes `localStorage`.

---

## 4. Déploiement Vercel

### URL de production
```
https://asso-inky.vercel.app
```

### Déploiement automatique
Tout push sur la branche `main` déclenche un déploiement automatique sur Vercel.

### Variables d'environnement (à configurer sur Vercel)

**Vercel → Project Settings → Environment Variables** (Production + Preview) :

| Variable | Obligatoire | Secret | Description |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Oui (auth) | non | URL du projet Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Oui (auth) | non | Clé publishable Supabase (`sb_publishable_…`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Oui (gestion comptes) | **OUI** | Clé service_role Supabase — **jamais** en `NEXT_PUBLIC_` |
| `GOOGLE_CLIENT_EMAIL` | Oui (Familles/Assiduité) | non | Compte de service Google (Sheets + Drive) |
| `GOOGLE_PRIVATE_KEY` | Oui (Familles/Assiduité) | **OUI** | Clé privée du compte de service |
| `GEMINI_API_KEY` | Oui (génération IA posts + OCR bulletins) | **OUI** | Clé Google Gemini — obtenir sur [Google AI Studio](https://aistudio.google.com/) |
| `GOOGLE_SHEET_ID` | Non | non | Requis uniquement par les scripts de seed (l'app utilise l'ID en dur) |

> **En local** : créer un `.env.local` à la racine (voir `.env.example`). Ce fichier est ignoré par git (`.env*`, sauf `!.env.example`).
> Les anciennes variables `NEXT_PUBLIC_SHEETS_SCRIPT_URL` / `NEXT_PUBLIC_SHEETS_API_URL` sont **obsolètes**.

### Déployer manuellement
```bash
git push origin main
# Vercel détecte le push et redéploie automatiquement (~1 min)
```

---

## 5. Configuration après livraison

### Étape 1 — Configurer Supabase (auth)
1. Créer un projet Supabase (gratuit) et récupérer `Project URL` + `publishable key` (Settings → API).
2. Renseigner les 3 variables Supabase dans Vercel **et** `.env.local` (voir section 4).
3. Exécuter la **migration SQL** `supabase/migrations/0001_profiles.sql` dans Supabase → SQL Editor (crée la table `profiles`, le trigger et les RLS).
4. **Désactiver l'inscription publique** : Supabase → Authentication → *Sign In / Providers* → décocher « Allow new users to sign up ».
5. **Créer la 1ʳᵉ admin** :
   ```bash
   node --env-file=.env.local scripts/create-admin.mjs "MotDePasseChoisi"
   ```
   (crée / réinitialise `admin@asso.fr` en `super_admin`).

### Étape 2 — Configurer Google Sheets (Familles + Assiduité)
- Partager le Sheet `BDD_Asso_CRM` **et** les dossiers Drive des documents avec le `GOOGLE_CLIENT_EMAIL` en rôle **Éditeur**.
- Renseigner `GOOGLE_CLIENT_EMAIL` + `GOOGLE_PRIVATE_KEY` (Vercel + `.env.local`).

### Étape 3 — Première connexion
1. Ouvrir `https://asso-inky.vercel.app`
2. Se connecter avec `admin@asso.fr` + le mot de passe choisi à l'étape 1
3. `/compte` → **Changer le mot de passe**

### Étape 4 — Créer les comptes de l'équipe
Voir section 3 (un compte par membre).

### Étape 5 — Saisir les données initiales
- **Familles / Assiduité** : les données vivent dans Google Sheets (partagées) — pas de ressaisie par poste.
- **Autres modules** (ateliers, finances, membres) : encore en `localStorage` → à saisir sur chaque poste tant que la migration n'est pas généralisée (voir section 7).

---

## 6. Intégrations externes

### 6.1 Google Sheets — REST API v4 (implémenté)

Les modules **Familles**, **Assiduité** et **Communication** lisent/écrivent directement dans le
Google Sheet `BDD_Asso_CRM` via l'**API REST v4**, appelée **côté serveur** avec un **compte de
service** (routes internes `/api/sheets` et `/api/assiduite`). Ce n'est pas Apps Script.

- **Tables** : FAMILLE, PERSONNE, INSCRIPTION, PAIEMENT, EVALUATION, DOCUMENTS JOINTS, EVENEMENT, ASSIDUITE, INTERVENANT, **CONTENUS** (posts Communication)…
- **Documents** (Familles) : uploadés dans **Google Drive** (un dossier par catégorie), référencés dans la table DOCUMENTS JOINTS.
- **Médias de posts** (Communication) : une image + une vidéo par post, uploadées dans un dossier Drive dédié et rendues publiques par lien (pour l'aperçu inline), URL stockée directement dans la feuille CONTENUS.
- ⚠️ Plafond ~4,5 Mo par upload (limite Vercel), pour les documents comme pour les médias.
- **Prérequis** : compte de service en rôle **Éditeur** sur le Sheet et les dossiers Drive (voir section 5).

> Détails : `CLAUDE.md` (sections « Backend Familles » et « Backend Communication ») et `lib/google-sheets-server.ts`.

---

### 6.2 Supabase — authentification (implémenté)

Auth réelle (comptes, sessions cookie vérifiées côté serveur), qui remplace l'ancien
système `localStorage`. Toutes les routes API sensibles sont protégées (401 si non
authentifié). Les rôles applicatifs vivent dans la table `profiles`.

> Détails : `docs/explanation/adr/007-auth-supabase.md`, `lib/supabase/*`, `proxy.ts`.

---

### 6.3 OCR bulletins — Google Gemini (implémenté)

`POST /api/ocr` (authentifié) envoie un bulletin d'inscription PDF à **Gemini 2.5 Flash**
et en extrait les champs (nom, prénom, date de naissance, téléphones, montant, date de
signature) pour pré-remplir le formulaire d'ajout de membre.

- **Prérequis** : `GEMINI_API_KEY` dans l'environnement (sinon 500).

> Détails : `docs/explanation/adr/006-ocr-gemini.md`, `app/api/ocr/route.ts`.

---

## 7. Limites actuelles et roadmap

### Limites connues

| Limite | Impact | Piste |
|---|---|---|
| Modules hors Familles/Assiduité/Communication en `localStorage` | Pas de partage entre postes (ateliers, finances, membres) | Étendre le backend partagé (Sheets/Supabase) |
| Pas de notifications | Alertes visibles seulement à la connexion | Notifications (email / Realtime) |
| Upload documents plafonné (~4,5 Mo) | Gros PDF refusés | Upload direct vers Drive/Storage |

### Fonctionnalités prévues

- [ ] Étendre le stockage partagé aux modules encore en `localStorage`
- [ ] Notifications par email (absences, deadlines)
- [ ] Authentification renforcée (2FA)
- [ ] Publication directe réseaux sociaux
- [x] Authentification serveur partagée (Supabase) ✅
- [x] Familles & Assiduité connectés à Google Sheets ✅
- [x] OCR des bulletins d'inscription (Gemini) ✅
- [x] Charte graphique unifiée « Estuaire » (palette, typographie, arrondis) ✅
- [x] Statut des documents fiche membre dérivé automatiquement des pièces jointes ✅

---

## 8. Support et contacts

| Rôle | Contact |
|---|---|
| Développement | anais.camille.sparesotto@gmail.com |
| Dépôt GitHub | github.com/anais0210/asso-pilotage |
| Hébergement | asso-inky.vercel.app (Vercel) |

### En cas de problème

**L'app ne charge pas / connexion impossible** :
1. Vider le cache navigateur (`Ctrl+Shift+R` / `Cmd+Shift+R`)
2. Vérifier les variables Supabase sur Vercel (surtout `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`)
3. Vérifier le statut de Vercel : [vercel.com/status](https://vercel.com/status)

**Familles / Assiduité ne chargent pas** :
- Vérifier `GOOGLE_CLIENT_EMAIL` / `GOOGLE_PRIVATE_KEY` et que le compte de service est **Éditeur** du Sheet.

**L'OCR échoue (500)** :
- Vérifier que `GEMINI_API_KEY` est bien configurée sur Vercel.

**Données `localStorage` disparues** :
- Les modules encore en `localStorage` (ateliers, finances, membres) sont propres au navigateur : un cache vidé = données perdues sur ce poste. Familles, Assiduité et Communication, elles, sont dans Google Sheets.

**Ajouter un·e utilisateur·rice** :
- Seul·e un·e admin peut créer des comptes (page `/compte`).

---

*Document maintenu par l'équipe de développement — à mettre à jour avant chaque livraison.*
