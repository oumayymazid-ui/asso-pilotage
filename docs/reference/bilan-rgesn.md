---
type: reference
date: 2026-07-02
---

# Bilan RGESN — Asso Pilotage

Audit du 2026-07-02 sur les 7 critères RGESN prioritaires du projet. Méthode : lecture de
code (fichier:ligne), `next build` pour la taille des bundles. Pas de mesure Lighthouse/
EcoIndex en conditions réelles (serveur dev partagé avec une autre session pendant l'audit).

## Tableau de conformité

| Critère | Intitulé (interprétation retenue) | Statut | Preuve | Écart |
|---|---|---|---|---|
| 4.8 | Les polices sont-elles limitées et optimisées ? | ✅ | [app/layout.tsx](../../app/layout.tsx) — une seule famille (Geist, `next/font/google`, `subsets: ["latin"]`, woff2 auto, `font-display: swap` implicite) | `--font-geist-mono` déclarée dans [app/globals.css:114](../../app/globals.css) mais jamais chargée — variable CSS orpheline, aucun poids réseau associé |
| 4.11 | Les images respectent-elles leurs dimensions intrinsèques et le lazy-loading hors zone visible ? | ⚠️ | 3 `<img>` bruts identifiés et corrigés dans cette session (`width`/`height`/`loading="lazy"`) : [app/communication/page.tsx:1077](../../app/communication/page.tsx), [app/communication/publies/page.tsx:225](../../app/communication/publies/page.tsx) | L'image d'exercice dans [app/positionnement/page.tsx:273](../../app/positionnement/page.tsx) reste sans `width`/`height` (dimensions variables selon le document généré) — non bloquant, image above-the-fold donc pas de lazy-loading requis |
| 4.13 | Pas de dépendance lourde pour un besoin trivial ? | ✅ | `package.json` : pas d'axios/moment/lodash. `docx`/`jspdf`/`googleapis` sont réels mais chargés en `import()` dynamique ou runtime serveur uniquement | — |
| 6.1 | Le service évite-t-il le chargement de bibliothèques superflues côté navigateur ? | ✅ | `googleapis` (Sheets/Drive) et `@anthropic-ai/sdk` ne sont importés que dans `app/api/*/route.ts` (exécution serveur, runtime Node) — aucun poids client | — |
| 6.5 | Le code source est-il exempt de code mort ? | ⚠️→✅ (corrigé) | `app/dev/seed/page.tsx` (page de test, IDs 9001-9099) et `app/api/generate-positionnement/route 2.ts` (copie orpheline pré-authentification, non servie par Next.js car mal nommée) supprimés dans cette session | — |
| 7.2 | Les listes longues sont-elles paginées ou virtualisées ? | ❌ | `.map()` sans pagination ni virtualisation sur des collections potentiellement longues : [app/membres/page.tsx:207](../../app/membres/page.tsx), [app/familles/page.tsx:162,211](../../app/familles/page.tsx), [app/communication/publies/page.tsx:100](../../app/communication/publies/page.tsx), [app/ateliers/page.tsx:1140,1149](../../app/ateliers/page.tsx) | Nécessite une décision de conception (pagination serveur vs. côté client) — voir ADR proposé |
| 7.4 | Le service évite-t-il de transporter/stocker des ressources inutilisées ? | ⚠️ | Les pièces jointes du module Communication sont stockées en base64 dans `localStorage` (`asso-communication-posts`) — [app/communication/page.tsx](../../app/communication/page.tsx), champ `MediaItem.preview` | Alourdit chaque écriture localStorage et n'a pas de limite de taille ; le module Familles, lui, persiste ses documents sur Drive et n'a que ce défaut en apparence — voir ADR proposé |

Légende : ✅ conforme · ⚠️ écart mineur/partiel · ❌ écart significatif · ➖ non applicable

## Mesure — taille des bundles JS (production, `next build`)

Total des chunks JS statiques : **~2,5 Mo** (non gzippé, tous chunks confondus, y compris
code partagé Next.js/React). Le plus gros chunk individuel fait 412 Ko. Pas de mesure
gzip/Brotli effectuée (nécessite un serveur de prod, hors périmètre de cet audit statique).

## Écarts RGPD/RGAA repérés en passant (audit exhaustif à faire séparément)

- **RGPD — faille corrigée** : `app/api/generate-positionnement/route 2.ts` était une copie
  orpheline de la route sans garde `getServerUser()`. Elle n'était pas servie par Next.js
  (seul `route.ts` est reconnu par l'App Router) donc pas exploitable en pratique, mais
  supprimée par prudence.
- **RGPD — logs** : plusieurs `console.error(e)` loggaient l'objet d'erreur complet
  (potentiellement des fragments de réponse OCR contenant des PII extraites d'un bulletin
  d'inscription) — remplacés par des messages génériques dans
  [app/familles/[id]/page.tsx](<../../app/familles/[id]/page.tsx>),
  [app/familles/[id]/membre/[membreId]/page.tsx](<../../app/familles/[id]/membre/[membreId]/page.tsx>)
  et [app/api/ocr/route.ts](../../app/api/ocr/route.ts).
- **RGAA — corrigé** : deux `<div onClick>` sans rôle ni clavier (sélecteur Zapier/Make)
  ~~ont été supprimées avec la fonctionnalité elle-même~~ (feature retirée par ailleurs sur
  `main` pendant cet audit). Un `<input>` sans `label` associé (webhook Zapier) — supprimé
  avec la fonctionnalité. Deux inputs de recherche sans `aria-label` corrigés dans
  [app/ateliers/page.tsx](../../app/ateliers/page.tsx) et [app/familles/page.tsx](../../app/familles/page.tsx).
  Un `<select>` avec `<label>` non associé (`htmlFor`/`id`) corrigé dans
  [app/emargement/page.tsx](../../app/emargement/page.tsx).
- **RGAA — contraste** : 3 badges `bg-slate-100 text-slate-500` mesuraient ~4,34:1 (sous le
  seuil AA de 4,5:1 pour du texte 10px) — passés à `text-slate-600` (~6,9:1) dans
  [app/communication/page.tsx](../../app/communication/page.tsx) et
  [app/ateliers/page.tsx](../../app/ateliers/page.tsx).
- **RGPD — pas d'écart cookies** : aucun tracker tiers détecté, seuls des cookies de session
  Supabase (essentiels, hors périmètre consentement CNIL).

## Non couvert par cet audit (RGPD/RGAA exhaustif à demander séparément)

- Droit à l'effacement/export pour les modules localStorage (finances, ateliers, absences,
  bénévoles, membres, notes) : aucune interface de purge/export visible.
- Mesure de contraste automatisée (axe-core/Lighthouse) sur l'ensemble des pages.
- Absence de CI (`.github/workflows` vide) : pas de gate a11y/perf automatisé.
- `browserslist` absent de `package.json`.
