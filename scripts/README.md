# scripts/

Utilitaires hors-application (non embarqués dans le bundle Next.js).

## `seed-sheet.mjs` — Remplissage du Google Sheet AREA

Remplit les onglets **vides** de la base Google Sheet avec un jeu de
démonstration cohérent, en croisant les données déjà présentes.

### Onglets remplis (uniquement s'ils sont vides)

| Onglet                | Contenu généré                                             |
|-----------------------|------------------------------------------------------------|
| `INTERVENANT`         | 8 membres AREA (reprend les évaluateurs FLE existants)     |
| `EVENEMENT`           | Séances FLE / Soutien scolaire réparties sur ~9 semaines   |
| `ASSIDUITE`           | Présences croisées (Événement × Personnes inscrites)       |
| `ATELIER_INTERVENANT` | Intervenants affectés aux ateliers existants               |

**Sécurité** : le script refuse d'écrire dans un onglet qui contient déjà
des lignes de données. Il n'écrase jamais l'existant, il n'ajoute (append)
que dans les onglets vides.

### Prérequis

1. `.env` renseigné (voir `.env.example`) avec un **compte de service** Google.
2. Le Sheet partagé avec le `client_email` du compte de service, rôle **Éditeur**.
3. Node ≥ 20 (utilise `--env-file`, `fetch` et `crypto` natifs — aucune dépendance).

### Lancer

```bash
npm run seed:sheet
```

Aucune dépendance externe : l'auth OAuth (JWT compte de service) et les appels
à l'API Google Sheets sont faits en Node natif.

> Réseau d'entreprise avec proxy SSL : si `fetch` échoue en TLS, fournir le
> bundle CA via `NODE_EXTRA_CA_CERTS` plutôt que de désactiver la vérification.
