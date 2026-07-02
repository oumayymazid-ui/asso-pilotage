# 🚀 Démarrage rapide — Asso Pilotage

> Ce guide est pour **tout le monde**, même sans expérience de code.
> Suis chaque étape dans l'ordre — ça prend environ **15 minutes** la première fois.

---

## Étape 1 — Installer Node.js

Node.js est le moteur qui fait tourner le projet sur ton ordinateur.

1. Va sur **[nodejs.org](https://nodejs.org)**
2. Télécharge la version **LTS** (le bouton vert à gauche)
3. Lance l'installateur et clique "Suivant" jusqu'à la fin
4. Vérifie que c'est bien installé : ouvre un terminal et tape :
   ```
   node --version
   ```
   Tu dois voir quelque chose comme `v20.x.x` ✅

> **Ouvrir un terminal :**
> - Mac : `Cmd + Espace` → tape "Terminal" → Entrée
> - Windows : touche Windows → tape "PowerShell" → Entrée

---

## Étape 2 — Installer Git

Git permet de télécharger le projet et de sauvegarder ton travail.

1. Va sur **[git-scm.com/downloads](https://git-scm.com/downloads)**
2. Télécharge et installe la version pour ton système
3. Vérifie :
   ```
   git --version
   ```
   Tu dois voir `git version 2.x.x` ✅

---

## Étape 3 — Créer un compte GitHub

GitHub est l'endroit où le code du projet est stocké.

1. Va sur **[github.com](https://github.com)** → "Sign up"
2. Crée ton compte avec ton email professionnel
3. Transmets ton **nom d'utilisateur GitHub** à Anaïs pour être ajouté·e au projet

> ⚠️ Tu ne pourras pas télécharger ni modifier le projet sans être ajouté·e.

---

## Étape 4 — Télécharger le projet

Dans ton terminal, tape ces commandes **une par une** (copie-colle chaque ligne) :

```bash
# Va dans ton dossier Documents
cd ~/Documents

# Télécharge le projet
git clone https://github.com/anais0210/asso-pilotage.git

# Entre dans le dossier du projet
cd asso-pilotage
```

---

## Étape 5 — Installer les dépendances

Toujours dans le terminal (tu dois être dans le dossier `asso-pilotage`) :

```bash
npm install
```

> Cette commande télécharge tous les outils nécessaires. C'est normal si ça prend 1-2 minutes.

---

## Étape 6 — Lancer le projet

```bash
npm run dev
```

Tu dois voir apparaître :
```
▲ Next.js 16.2.6
- Local: http://localhost:3000
✓ Ready in ...ms
```

Ouvre ton navigateur et va sur **[http://localhost:3000](http://localhost:3000)** 🎉

> **Compte de connexion (développement) :**
> Email : `admin@asso.fr` — Mot de passe : `AdminAsso2026!`

---

## Étape 7 — Créer ta branche de travail

Avant de modifier quoi que ce soit, crée ta propre branche :

```bash
# Récupère les dernières modifications
git checkout dev
git pull origin dev

# Crée ta branche (remplace "prenom" par ton prénom en minuscules)
git checkout -b feature/prenom-description-courte
```

**Exemples de noms de branches :**
```
feature/marie-page-beneficiaires
feature/camille-correction-formulaire
feature/fatoumata-ajout-filtre-ateliers
```

---

## Arrêter / relancer le projet

Pour **arrêter** le serveur : dans le terminal, appuie sur `Ctrl + C`

Pour **relancer** :
```bash
npm run dev
```

---

## En cas de problème

**"command not found: npm"** → Node.js n'est pas installé, reprends l'étape 1

**La page ne s'ouvre pas** → Vérifie que le terminal affiche bien "Ready" et essaie [http://localhost:3000](http://localhost:3000)

**Erreur rouge dans le terminal** → Copie le message d'erreur et envoie-le à Anaïs

**Le code d'une autre personne est apparu** → Tu es sur la mauvaise branche. Fais `git checkout feature/ton-prenom-xxx`

---

*Une fois le projet lancé, lis [CONTRIBUTING.md](./CONTRIBUTING.md) pour comprendre comment sauvegarder et partager ton travail.*
