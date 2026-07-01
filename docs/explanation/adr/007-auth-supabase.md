# ADR 007 — Authentification réelle via Supabase

- **Statut** : Accepté (implémenté)
- **Date** : 2026-07-01
- **Remplace** : ADR 003 (auth localStorage) — voir `003-auth-localstorage.md`

## Contexte

Jusqu'ici l'app était **100 % navigateur** :
- L'auth vit dans le `localStorage` de chaque navigateur (`lib/auth.ts`, `auth-context.tsx`,
  `AuthGate.tsx`) : comptes, mots de passe (hash non-crypto), session. Le serveur ne
  connaît aucun utilisateur.
- Les Route Handlers `GET /api/assiduite` et `/api/sheets` (module Familles) exposent des
  **données personnelles réelles sans aucun contrôle serveur**. N'importe qui connaissant
  l'URL de production peut les lire.

Vercel Deployment Protection ne convient pas : « Vercel Authentication » n'autorise que les
membres de l'équipe Vercel (les formatrices/bénévoles n'en ont pas), et « Password Protection »
est réservé au plan Pro payant.

## Décision

Introduire **Supabase Auth** comme couche d'authentification réelle (free tier), **pour l'auth
uniquement** — les données métier restent dans Google Sheets.

- Vrais comptes (email + mot de passe), sessions vérifiables côté serveur (JWT en cookie httpOnly
  via `@supabase/ssr`).
- Fonctionne pour des utilisatrices sans compte Vercel.
- Les routes API sont gardées côté serveur par `supabase.auth.getUser()` → `401` si non authentifié.

## Conséquences

- Nouvelle dépendance backend (Supabase) : l'app n'est plus « 100 % navigateur ».
- `lib/auth.ts` (localStorage) est remplacé ; la page de gestion des comptes passe sur l'API admin
  Supabase (service role, côté serveur uniquement).
- **Next 16** : le fichier de proxy s'appelle `proxy.ts` (l'ancien `middleware.ts` est déprécié),
  et `cookies()` est **async**. Le pattern `@supabase/ssr` standard (qui utilise `middleware.ts`)
  est adapté en conséquence.

## Plan d'implémentation

| Étape | Fichier | État |
|---|---|---|
| Deps `@supabase/supabase-js` + `@supabase/ssr` | `package.json` | ✅ |
| Client navigateur | `lib/supabase/client.ts` | ✅ |
| Client serveur (+ `getServerUser`) | `lib/supabase/server.ts` | ✅ |
| Variables d'env | `.env.example` | ✅ |
| Proxy Next 16 (refresh session + protection routes) | `proxy.ts` | ⏳ |
| Rewire login/register/logout → Supabase | `app/login/page.tsx`, `lib/auth-context.tsx` | ⏳ |
| Remplacer `AuthGate` par la session Supabase | `components/AuthGate.tsx` | ⏳ |
| Garde `getServerUser()` → 401 | `app/api/assiduite/route.ts`, `app/api/sheets/route.ts` | ⏳ |
| Gestion des comptes via API admin Supabase | page membres/comptes | ⏳ |
| Retrait de `lib/auth.ts` (localStorage) | — | ⏳ |

## Pré-requis côté humain (à fournir avant le câblage)

1. Créer un projet Supabase (gratuit).
2. Récupérer `Project URL` + `anon public key` (Settings → API) → `.env.local` **et** Vercel.
3. Créer les comptes réels (admin + formatrices/bénévoles) ou activer l'inscription.
