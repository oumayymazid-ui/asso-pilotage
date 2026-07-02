---
type: explanation
adr: "008"
statut: proposé
date: 2026-07-02
---

# ADR 008 — Pagination des listes longues et stockage des médias Communication

## Contexte
L'audit RGESN du 2026-07-02 (voir [bilan-rgesn.md](../../reference/bilan-rgesn.md))
identifie deux écarts qui ne peuvent pas être corrigés sans arbitrage produit :

1. Plusieurs listes (`app/membres/page.tsx`, `app/familles/page.tsx`, `app/ateliers/page.tsx`,
   `app/communication/publies/page.tsx`) affichent `.map()` sur la totalité d'une collection,
   sans pagination ni virtualisation (RGESN 7.2). Aujourd'hui les volumes sont faibles (usage
   associatif), donc l'impact réel est nul — mais rien n'empêche la collection de grandir.
2. Le module Communication stocke les aperçus d'images en base64 directement dans
   `localStorage` (`asso-communication-posts`, champ `MediaItem.preview`), sans limite de
   taille ni purge (RGESN 7.4). Le module Familles, lui, persiste ses documents sur Google
   Drive et ne garde en local qu'une référence — modèle plus sobre mais pas transposable
   sans backend dédié pour Communication.

## Options — pagination
- **A. Pagination classique** (page/curseur) : coût dev faible, mais change l'UX (clics
  "page suivante") sur des pages actuellement en défilement continu.
- **B. Virtualisation** (`react-window` ou équivalent) : garde le défilement continu, ajoute
  une dépendance (contraire à RGESN 4.13 sauf si le volume le justifie).
- **C. Ne rien faire tant que les volumes restent petits**, et fixer un seuil (ex. 100
  entrées) au-delà duquel on réévalue.

## Options — médias Communication
- **A. Continuer en base64/localStorage** : aucun coût dev, mais poids illimité et hors de
  toute politique de rétention RGPD.
- **B. Aligner sur le modèle Familles** (upload vers Drive, ne garder qu'une URL en local) :
  cohérent avec l'existant, mais demande une route API dédiée (nouvelle exception à la règle
  "pas de nouvelle route API sans décision d'équipe" du CLAUDE.md) et un compte Drive/dossier
  dédié à Communication.
- **C. Limiter la taille/nombre de médias acceptés côté formulaire** en attendant une
  solution de stockage externe : traite le symptôme (localStorage qui explose), pas la cause.

## Décision
Non tranchée — à valider par l'équipe. Recommandation de cet audit : **B** pour les médias
(cohérence avec le module Familles, déjà outillé), **C** pour la pagination (pas de sur-
ingénierie tant que les volumes réels ne le justifient pas), avec un seuil de 100 entrées à
instrumenter (log ou alerte) pour déclencher une réévaluation vers l'option A.

## Conséquences si non traité
- Pagination : dégradation progressive du temps de rendu et de la fluidité du scroll à mesure
  que l'association grandit — pas de risque RGPD.
- Médias : `localStorage` a une limite navigateur (~5-10 Mo) ; au-delà, les écritures
  échouent silencieusement côté `JSON.stringify` + `setItem`, avec un risque de perte de
  données pour l'utilisateur·rice au moment de la sauvegarde.
