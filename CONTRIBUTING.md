# Guide de contribution — Gitflow

> Comment on travaille ensemble à 10 sur le même projet.
> Lis ce guide **avant** de modifier quoi que ce soit.

---

## Les 3 branches à connaître

```
main  ──────────────────────────────────────────▶  production (asso-inky.vercel.app)
  ↑ merge uniquement via PR validée
dev   ──────────────────────────────────────────▶  intégration (branche commune)
  ↑ merge uniquement via PR validée
feature/prenom-xxx  ─────────────────────────────▶  ta branche personnelle
```

| Branche | Rôle | Qui peut pusher directement ? |
|---|---|---|
| `main` | Production — ce que voit l'association | **Personne** (PR obligatoire + 1 validation) |
| `dev` | Intégration — le travail combiné de l'équipe | **Personne** (PR obligatoire + 1 validation) |
| `feature/prenom-xxx` | Ton travail en cours | **Toi** uniquement |

---

## Workflow quotidien

### Matin — avant de commencer

```bash
# 1. Va sur dev et récupère les dernières modifications de l'équipe
git checkout dev
git pull origin dev

# 2. Mets à jour ta branche avec les nouveautés
git checkout feature/ton-prenom-xxx
git merge dev
```

### Pendant que tu travailles

```bash
# Sauvegarde ton travail régulièrement (plusieurs fois par jour)
git add .
git commit -m "description courte de ce que tu as fait"

# Exemples de bons messages :
# "ajout filtre par niveau sur la page bénéficiaires"
# "correction affichage date atelier sur mobile"
# "ajout champ email parent dans le formulaire"
```

### Quand tu veux partager ton travail

```bash
# Envoie ta branche sur GitHub
git push origin feature/ton-prenom-xxx
```

Puis sur GitHub :
1. Va sur [github.com/anais0210/asso-pilotage](https://github.com/anais0210/asso-pilotage)
2. Tu verras un bandeau jaune "Compare & pull request" → clique dessus
3. Assure-toi que la cible est **`dev`** (pas `main` !)
4. Décris rapidement ce que tu as fait
5. Clique **"Create pull request"**
6. Préviens quelqu'un dans l'équipe pour qu'il·elle valide

---

## Règles à respecter

### ✅ À faire
- Toujours travailler sur **ta propre branche** `feature/prenom-xxx`
- Faire des petits commits réguliers plutôt qu'un gros à la fin
- Nommer les commits en français, clairement : `"ajout page contact"` pas `"modif"` ou `"update"`
- Cibler **`dev`** dans tes Pull Requests, jamais `main`
- Relire et tester ton travail avant de créer une PR

### ❌ À ne pas faire
- Ne jamais pusher directement sur `main` ou `dev` (les branches sont protégées)
- Ne pas travailler à deux sur la même branche sans le dire
- Ne pas fusionner ta propre PR sans validation d'une autre personne
- Ne pas supprimer les branches des autres

---

## Nommage des branches

Format : `feature/prenom-description-courte`

```bash
# Bien ✅
feature/marie-page-beneficiaires
feature/camille-correction-formulaire
feature/fatoumata-filtre-ateliers
feature/sarah-export-csv

# Pas bien ❌
test
modif-truc
mabranche
```

---

## Cycle complet : de l'idée à la production

```
1. Tu crées ta branche feature
        ↓
2. Tu développes + commits réguliers
        ↓
3. Tu push sur GitHub
        ↓
4. Tu crées une Pull Request → dev
        ↓
5. Une collègue relit et valide (ou demande des corrections)
        ↓
6. La PR est fusionnée dans dev
        ↓
7. Quand dev est stable → PR de dev → main
        ↓
8. main se déploie automatiquement sur Vercel 🚀
```

---

## Commandes utiles

```bash
# Voir sur quelle branche tu es
git branch

# Voir l'état de tes fichiers modifiés
git status

# Voir l'historique des commits
git log --oneline

# Annuler les modifications d'un fichier (attention, irréversible)
git checkout -- nom-du-fichier.tsx

# Récupérer les dernières modifs sans changer de branche
git fetch origin
```

---

## Checklist accessibilité (obligatoire avant merge)

Chaque PR touchant un composant ou une page doit valider ces 6 points :

- [ ] **Navigation clavier** — la fonctionnalité est utilisable au clavier (Tab / Shift+Tab / Enter / Escape)
- [ ] **Contrastes** — vérifiés avec [webaim.org/resources/contrastchecker/](https://webaim.org/resources/contrastchecker/) (ratio ≥ 4.5:1 texte normal, ≥ 3:1 texte grand)
- [ ] **Labels formulaires** — chaque `<input>` / `<select>` / `<textarea>` est lié à son `<label>` via `htmlFor` / `id`
- [ ] **Boutons icône** — tout bouton sans texte visible a un `aria-label` explicite
- [ ] **Focus visible** — pas de `outline: none` sans alternative visible (le ring teal AREA est déjà géré globalement)
- [ ] **axe DevTools** — 0 erreur critique signalée par l'extension axe DevTools (Chrome/Firefox)

> Référence complète : [ADR 005 — Accessibilité](/docs/adr/005-accessibilite) · Outil : [axe DevTools](https://www.deque.com/axe/devtools/)

---

## En cas de conflit

Un conflit arrive quand deux personnes ont modifié le même fichier.
Git te signalera les fichiers en conflit avec des marqueurs `<<<<<<`.

```
<<<<<<< HEAD (tes modifications)
  ton code ici
=======
  le code de l'autre personne
>>>>>>> dev
```

**Que faire :**
1. Ouvre le fichier dans ton éditeur
2. Choisis quelle version garder (ou fusionne les deux)
3. Supprime les marqueurs `<<<<<<`, `=======`, `>>>>>>>`
4. Sauvegarde
5. `git add .` puis `git commit`

En cas de doute : **appelle Anaïs** avant de toucher quoi que ce soit 🙂

---

*Questions ? → [anais.camille.sparesotto@gmail.com](mailto:anais.camille.sparesotto@gmail.com)*
