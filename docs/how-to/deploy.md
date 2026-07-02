---
type: how-to
---

# Déployer sur Vercel

## Déploiement automatique (recommandé)

Tout push sur `main` déclenche un déploiement automatique :

```bash
git push origin main
```

Vercel est connecté au repo GitHub `anais0210/asso-pilotage`.
Délai de build : ~30-40 secondes.

## Vérifier le déploiement

```bash
vercel ls --prod
```

Ou dans le dashboard Vercel : [vercel.com/anais-projects-d34cd3c6/asso](https://vercel.com/anais-projects-d34cd3c6/asso)

**URL de production stable** : [asso-pilotage.vercel.app](https://asso-pilotage.vercel.app)

## Avant de pousser — checklist

```bash
npx tsc --noEmit          # 0 erreur TypeScript obligatoire
npm run build             # build local optionnel (prend ~30s)
```

## Déploiement manuel (si besoin)

```bash
vercel --prod --yes
```

## Variables d'environnement

Actuellement le projet **n'a pas de variables d'environnement** (pas de backend, pas de clés API).

Si tu en ajoutes :
1. Ne jamais les committer dans le repo
2. Les ajouter dans Vercel : Settings → Environment Variables
3. Les préfixer `NEXT_PUBLIC_` si elles doivent être accessibles côté client

## Rollback

```bash
vercel rollback           # retourne au déploiement précédent
```
