---
type: tutorial
---

# Prise en main du projet

**Objectif** : cloner le projet, le faire tourner en local, comprendre sa structure, et être prêt à contribuer.
**Durée estimée** : 20 minutes.
**Prérequis** : Node.js ≥ 18, npm, accès au repo GitHub.

---

## Étape 1 — Cloner et installer

```bash
git clone https://github.com/anais0210/asso-pilotage.git
cd asso-pilotage
npm install
```

## Étape 2 — Lancer en développement

```bash
npm run dev -- --port 3001
```

Ouvrir [http://localhost:3001](http://localhost:3001).

Connexion avec le compte démo : `admin@asso.fr` / `AdminAsso2026!`.

> **Pourquoi le port 3001 ?** Le port 3000 est souvent occupé par d'autres projets du workspace. C'est une convention locale — Vercel utilise le port configuré automatiquement.

## Étape 3 — Explorer l'interface

L'application comporte 9 modules accessibles via la sidebar :

1. **Vue d'ensemble** — point d'entrée, KPIs par module
2. **Émargement** — sélecteur de séance, toggle présence par apprenante
3. **Absences** — liste du jour, cycle de statut au clic
4. **Finances** — demandes de financement + frais d'inscription
5. **Ateliers** — planning + notes + composition des groupes
6. **Communication** — calendrier éditorial + kanban de validation
7. **Bénévoles** — disponibilités + assignation aux événements
8. **Membres** — annuaire de l'équipe
9. **Roadmap stratégique** — matrice impact/facilité

**Important** : toutes les données sont stockées en `localStorage`. Elles persistent entre les rechargements mais sont perdues si on vide le cache navigateur. C'est intentionnel pour cette phase (voir [ADR 001](../explanation/adr/001-no-backend.md)).

## Étape 4 — Comprendre la structure des fichiers

```
app/               Pages (une par module)
components/        Composants partagés
lib/               Données mock + helpers auth
docs/              Cette documentation
CLAUDE.md          Contexte pour les assistants IA
AGENTS.md          Avertissements techniques stack
```

Chaque page dans `app/` est un fichier `page.tsx` autonome avec `"use client"` en première ligne.

## Étape 5 — Faire sa première modification

Ouvrir `app/dashboard/page.tsx` et changer le titre :

```tsx
<h1 className="text-2xl font-bold text-foreground">Vue d'ensemble</h1>
```

Sauvegarder — le HMR rechargera automatiquement la page.

## Étape 6 — Vérifier que TypeScript est content

```bash
npx tsc --noEmit
```

Aucune erreur attendue. **Ne jamais commit avec des erreurs TypeScript** — le build Vercel échouera.

## Étape 7 — Pousser et déployer

```bash
git add .
git commit -m "feat: ma première modification"
git push
```

Vercel déclenche automatiquement un déploiement sur `main`. Voir le résultat sur [asso-inky.vercel.app](https://asso-inky.vercel.app).

---

## Ce que tu viens d'apprendre

- La stack (Next.js 16 + Tailwind v4 + localStorage)
- Comment lancer le projet en local
- La structure des modules
- Le cycle dev → commit → deploy

**Prochaine étape** : [Ajouter un nouveau module](../how-to/add-new-module.md)
