#!/usr/bin/env node
// ──────────────────────────────────────────────────────────────
// seed-sheet.mjs — Remplit les onglets VIDES du Google Sheet AREA
// avec un jeu de données de démonstration cohérent.
//
// Onglets ciblés (uniquement s'ils sont vides) :
//   • Événements            (généré)
//   • Assiduité             (croisé : Événements × Personnes inscrites)
//   • Membres AREA          (généré, réutilise les évaluateurs FLE existants)
//   • Ateliers-Intervenants (croisé : Ateliers existants × Membres)
//
// Sécurité : n'écrit JAMAIS dans un onglet qui contient déjà des lignes.
// Aucune dépendance externe (JWT signé avec node:crypto, API REST via fetch).
//
// Usage :  node --env-file=.env scripts/seed-sheet.mjs
//          node --env-file=.env scripts/seed-sheet.mjs --dry-run
// ──────────────────────────────────────────────────────────────

import crypto from "node:crypto"

const DRY_RUN = process.argv.includes("--dry-run")

const SHEET_ID = process.env.GOOGLE_SHEET_ID
const SA_EMAIL = process.env.GOOGLE_CLIENT_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
let   SA_KEY   = process.env.GOOGLE_PRIVATE_KEY

// ── Garde-fous credentials ────────────────────────────────────
function fail(msg) { console.error(`\n❌ ${msg}\n`); process.exit(1) }

if (!SHEET_ID) fail("GOOGLE_SHEET_ID manquant dans .env")
if (!SA_EMAIL || SA_EMAIL.includes("COLLER_ICI"))
  fail("GOOGLE_CLIENT_EMAIL manquant/placeholder dans .env")
if (!SA_KEY || SA_KEY.includes("COLLER_ICI"))
  fail("GOOGLE_PRIVATE_KEY manquant/placeholder dans .env")
SA_KEY = SA_KEY.replace(/\\n/g, "\n") // \n littéraux -> vrais retours ligne

// ── Utils ─────────────────────────────────────────────────────
const b64url = (buf) =>
  Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")

// Enlève accents + casse pour comparer les entêtes de façon robuste
const norm = (s) =>
  String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim()

// Notation A1 sûre pour un titre d'onglet (espaces, apostrophes…)
const a1 = (title) => `'${String(title).replace(/'/g, "''")}'`

// PRNG déterministe -> re-run reproductible
function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rng = mulberry32(20260701)
const rint = (min, max) => Math.floor(rng() * (max - min + 1)) + min
const pick = (arr) => arr[Math.floor(rng() * arr.length)]
const weighted = (pairs) => { // [[val, poids], ...]
  const total = pairs.reduce((s, [, w]) => s + w, 0)
  let r = rng() * total
  for (const [v, w] of pairs) { if ((r -= w) <= 0) return v }
  return pairs[0][0]
}

// ── Auth : JWT service account -> access token ────────────────
async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000)
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))
  const claim = b64url(JSON.stringify({
    iss: SA_EMAIL,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }))
  const input = `${header}.${claim}`
  const signature = b64url(crypto.sign("RSA-SHA256", Buffer.from(input), SA_KEY))
  const assertion = `${input}.${signature}`

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  })
  const json = await res.json()
  if (!res.ok) fail(`Auth Google échouée : ${JSON.stringify(json)}`)
  return json.access_token
}

// ── Client Sheets minimal ─────────────────────────────────────
function sheetsClient(token) {
  const base = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}`
  const auth = { Authorization: `Bearer ${token}` }
  return {
    async listTabs() {
      const res = await fetch(`${base}?fields=sheets.properties(title,sheetId)`, { headers: auth })
      const json = await res.json()
      if (!res.ok) fail(`Lecture métadonnées échouée : ${JSON.stringify(json)}`)
      return (json.sheets ?? []).map((s) => s.properties.title)
    },
    async getValues(title) {
      const res = await fetch(`${base}/values/${encodeURIComponent(a1(title))}`, { headers: auth })
      const json = await res.json()
      if (!res.ok) fail(`Lecture "${title}" échouée : ${JSON.stringify(json)}`)
      return json.values ?? []
    },
    async append(title, rows) {
      const url = `${base}/values/${encodeURIComponent(a1(title) + "!A1")}:append`
        + `?valueInputOption=RAW&insertDataOption=INSERT_ROWS`
      const res = await fetch(url, {
        method: "POST", headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({ values: rows }),
      })
      const json = await res.json()
      if (!res.ok) fail(`Écriture "${title}" échouée : ${JSON.stringify(json)}`)
      return json.updates?.updatedRows ?? 0
    },
  }
}

// ── Localise un onglet par signature d'entête ─────────────────
function findTab(tabsData, requiredHeaders) {
  const req = requiredHeaders.map(norm)
  for (const [title, values] of Object.entries(tabsData)) {
    const headers = (values[0] ?? []).map(norm)
    if (req.every((r) => headers.some((h) => h.includes(r)))) return { title, values }
  }
  return null
}

// Construit une ligne alignée sur l'ordre RÉEL des colonnes de l'onglet.
// spec = [ [ (headerNorm)=>bool, (record)=>value ], ... ]
function buildRow(headers, spec, record) {
  return headers.map((h) => {
    const hn = norm(h)
    for (const [test, fn] of spec) { if (test(hn)) { const v = fn(record); return v == null ? "" : v } }
    return ""
  })
}

// ── MAIN ──────────────────────────────────────────────────────
const token = DRY_RUN ? null : await getAccessToken()
const sheets = DRY_RUN ? null : sheetsClient(token)

console.log(`\n📊 Google Sheet : ${SHEET_ID}${DRY_RUN ? "  (DRY-RUN, aucune écriture)" : ""}`)

// En DRY-RUN on ne peut pas lire le Sheet -> on informe et on sort.
if (DRY_RUN) {
  console.log("\nℹ️  --dry-run : le script a besoin d'un accès réel pour lire les onglets existants.")
  console.log("   Renseigne .env puis relance sans --dry-run.\n")
  process.exit(0)
}

const titles = await sheets.listTabs()
console.log(`   Onglets trouvés : ${titles.join(", ")}`)

// Charge le contenu de tous les onglets
const tabsData = {}
for (const t of titles) tabsData[t] = await sheets.getValues(t)

// Repère les onglets par signature
const T_PERSONNES  = findTab(tabsData, ["Famille ID", "Prenom", "Categorie"])
const T_INSCRIPT   = findTab(tabsData, ["Annee scolaire", "Type apprenant"])
const T_ATELIERS   = findTab(tabsData, ["Categorie", "Groupe", "Audience"])
const T_EVAL       = findTab(tabsData, ["Note comprehension ecrite"])
const T_EVENEMENTS = findTab(tabsData, ["Titre", "Heure_debut", "Animateur"])
const T_ASSIDUITE  = findTab(tabsData, ["Evenement ID", "Personne ID", "ETAT"])
const T_MEMBRES    = findTab(tabsData, ["Nom", "Prenom", "Type", "Statut"])
const T_INTERV     = findTab(tabsData, ["Atelier ID", "Intervenant ID"])

// Helpers de lecture (index de colonne par nom d'entête)
function colIndex(values, name) {
  const headers = (values[0] ?? []).map(norm)
  return headers.findIndex((h) => h.includes(norm(name)))
}
function rowsOf(tab) { return (tab?.values ?? []).slice(1).filter((r) => r.some((c) => String(c).trim() !== "")) }

// Vérifie qu'un onglet cible est bien vide avant d'écrire
function assertEmpty(tab, label) {
  if (!tab) fail(`Onglet "${label}" introuvable (entêtes non reconnues).`)
  const data = rowsOf(tab)
  if (data.length > 0) {
    console.log(`   ⏭️  "${tab.title}" contient déjà ${data.length} ligne(s) -> IGNORÉ (sécurité).`)
    return false
  }
  return true
}

// ── Données sources ───────────────────────────────────────────
const persoVals = T_PERSONNES.values
const P_ID = colIndex(persoVals, "ID")
const P_NOM = colIndex(persoVals, "Nom")
const P_PRENOM = colIndex(persoVals, "Prenom")
const personnes = rowsOf(T_PERSONNES).map((r) => ({
  id: r[P_ID], nom: r[P_NOM], prenom: r[P_PRENOM],
}))

const inscVals = T_INSCRIPT.values
const I_PID = colIndex(inscVals, "Personne ID")
const I_TYPE = colIndex(inscVals, "Type apprenant")
const I_STATUT = colIndex(inscVals, "Statut")
const I_NIVEAU = colIndex(inscVals, "Niveau")
const inscriptions = rowsOf(T_INSCRIPT).map((r) => ({
  personneId: r[I_PID], type: r[I_TYPE], statut: r[I_STATUT], niveau: r[I_NIVEAU],
}))
// Personnes actuellement inscrites (statut "En cours")
const inscritsActifs = inscriptions.filter((i) => norm(i.statut) === "en cours")

const ateliersVals = T_ATELIERS.values
const A_ID = colIndex(ateliersVals, "ID")
const ateliersRows = rowsOf(T_ATELIERS).map((r) => ({ id: r[A_ID] }))

// ── Génération : MEMBRES AREA ─────────────────────────────────
// Réutilise les évaluateurs FLE existants pour rester cohérent.
const MEMBRES = [
  { nom: "Belkacem",  prenom: "Nadjat",    type: "Animatrice",     statut: "Actif" }, // = "Nadjat B."
  { nom: "Fournier",  prenom: "Frederic",  type: "Animateur",      statut: "Actif" }, // = "Frederic F."
  { nom: "Tanguy",    prenom: "Maribelle", type: "Animatrice",     statut: "Actif" }, // = "Maribelle T."
  { nom: "Lefevre",   prenom: "Sophie",    type: "Benevole",       statut: "Actif" },
  { nom: "Moreau",    prenom: "Julien",    type: "Benevole",       statut: "Actif" },
  { nom: "Petit",     prenom: "Claire",    type: "Coordinatrice",  statut: "Actif" },
  { nom: "Garcia",    prenom: "Hugo",      type: "Benevole",       statut: "Actif" },
  { nom: "Rousseau",  prenom: "Amelie",    type: "Benevole",       statut: "Inactif" },
].map((m, i) => ({
  id: i + 1, ...m,
  email: `${norm(m.prenom)}.${norm(m.nom)}@area-nantes.org`,
  telephone: `02 40 ${String(rint(10, 99))} ${String(rint(10, 99))} ${String(rint(10, 99))}`,
}))
const membreIds = MEMBRES.map((m) => m.id)

// ── Génération : ÉVÉNEMENTS ───────────────────────────────────
// Séances FLE / Soutien scolaire réparties sur l'année scolaire 25-26.
const CAT_SLOTS = {
  "FLE":              [["10:00", "12:00"], ["14:00", "16:00"]],
  "Soutien scolaire": [["10:00", "12:00"], ["14:00", "16:30"]],
  "Atelier":          [["14:00", "16:00"]],
  "Sortie":           [["09:30", "17:00"]],
}
function dateSemaine(weekOffset, weekday) {
  // point de départ : lundi 15/09/2025 ; weekday 1=lundi..6=samedi
  const start = new Date(Date.UTC(2025, 8, 15))
  const d = new Date(start)
  d.setUTCDate(start.getUTCDate() + weekOffset * 7 + (weekday - 1))
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`
}

const EVENEMENTS = []
let evId = 1
for (let week = 0; week < 9; week++) {
  const plan = [
    { cat: "FLE",              jour: 2, titre: "Cours FLE" },
    { cat: "Soutien scolaire", jour: 3, titre: "Soutien scolaire" },
    { cat: "FLE",              jour: 4, titre: "Cours FLE" },
    { cat: "Soutien scolaire", jour: 6, titre: "Soutien scolaire" },
  ]
  for (const p of plan) {
    const [hd, hf] = pick(CAT_SLOTS[p.cat])
    const date = dateSemaine(week, p.jour)
    EVENEMENTS.push({
      id: evId++,
      titre: `${p.titre} · sem. ${week + 1}`,
      date, heureDebut: hd, heureFin: hf,
      // "si l'info n'existe pas -> chiffre aléatoire" : animateur = membre au hasard
      animateur: pick(membreIds),
      categorie: p.cat,
      statut: "Réalisé",
    })
  }
}
// Deux ateliers/sorties ponctuels
EVENEMENTS.push({ id: evId++, titre: "Atelier théâtre", date: dateSemaine(5, 3), heureDebut: "14:00", heureFin: "16:00", animateur: pick(membreIds), categorie: "Atelier", statut: "Réalisé" })
EVENEMENTS.push({ id: evId++, titre: "Sortie musée", date: dateSemaine(7, 6), heureDebut: "09:30", heureFin: "17:00", animateur: pick(membreIds), categorie: "Sortie", statut: "Planifié" })

// ── Génération : ASSIDUITÉ (Événement × Personnes inscrites) ──
const ASSIDUITE = []
let asId = 1
const ETATS = [["Présent", 74], ["Absent", 12], ["Excusé", 9], ["Retard", 5]]
const COMMENTS_ABS = ["Malade", "Absence non justifiée", "Problème de transport", "Rendez-vous médical"]
const COMMENTS_EXC = ["Prévenu la veille", "Garde d'enfant", "Convocation administrative"]

for (const ev of EVENEMENTS) {
  // Publics ciblés selon la catégorie de l'événement
  let cible
  if (ev.categorie === "FLE") cible = inscritsActifs.filter((i) => norm(i.type) === "fle")
  else if (ev.categorie === "Soutien scolaire") cible = inscritsActifs.filter((i) => norm(i.type) === "soutien scolaire")
  else cible = inscritsActifs // atelier / sortie : tout le monde peut venir

  // Un sous-ensemble présent à cette séance
  const participants = cible.filter(() => rng() < 0.85)
  for (const ins of participants) {
    const etat = weighted(ETATS)
    let comment = ""
    if (etat === "Absent" && rng() < 0.5) comment = pick(COMMENTS_ABS)
    if (etat === "Excusé") comment = pick(COMMENTS_EXC)
    ASSIDUITE.push({
      id: asId++,
      evenementId: ev.id,
      personneId: ins.personneId,
      etat,
      commentaire: comment,
    })
  }
}

// ── Génération : ATELIERS-INTERVENANTS ───────────────────────
const INTERV = []
let inId = 1
for (const at of ateliersRows) {
  const nb = rint(1, 2)
  const chosen = new Set()
  while (chosen.size < nb) chosen.add(pick(membreIds))
  let first = true
  for (const mid of chosen) {
    INTERV.push({
      id: inId++,
      atelierId: at.id,
      intervenantId: mid,
      heures: rint(2, 4),
      role: first ? "Animateur" : "Co-animateur",
    })
    first = false
  }
}

// ── Écriture ──────────────────────────────────────────────────
async function writeTab(tab, label, records, spec) {
  if (!assertEmpty(tab, label)) return
  const headers = tab.values[0]
  const rows = records.map((rec) => buildRow(headers, spec, rec))
  const n = await sheets.append(tab.title, rows)
  console.log(`   ✅ "${tab.title}" : ${n} ligne(s) écrite(s).`)
}

console.log("\n✍️  Écriture des onglets vides…")

// MEMBRES AREA
await writeTab(T_MEMBRES, "Membres AREA", MEMBRES, [
  [(h) => h === "id", (r) => r.id],
  [(h) => h.includes("nom") && !h.includes("prenom"), (r) => r.nom],
  [(h) => h.includes("prenom"), (r) => r.prenom],
  [(h) => h.includes("type"), (r) => r.type],
  [(h) => h.includes("email"), (r) => r.email],
  [(h) => h.includes("telephone") || h.includes("tel"), (r) => r.telephone],
  [(h) => h.includes("statut"), (r) => r.statut],
])

// ÉVÉNEMENTS
await writeTab(T_EVENEMENTS, "Événements", EVENEMENTS, [
  [(h) => h === "id", (r) => r.id],
  [(h) => h.includes("titre"), (r) => r.titre],
  [(h) => h.includes("date"), (r) => r.date],
  [(h) => h.includes("heure_debut") || h.includes("heure debut"), (r) => r.heureDebut],
  [(h) => h.includes("heure_fin") || h.includes("heure fin"), (r) => r.heureFin],
  [(h) => h.includes("animateur"), (r) => r.animateur],
  [(h) => h.includes("categorie"), (r) => r.categorie],
  [(h) => h.includes("statut"), (r) => r.statut],
])

// ASSIDUITÉ
await writeTab(T_ASSIDUITE, "Assiduité", ASSIDUITE, [
  [(h) => h === "id", (r) => r.id],
  [(h) => h.includes("evenement"), (r) => r.evenementId],
  [(h) => h.includes("personne"), (r) => r.personneId],
  [(h) => h.includes("etat"), (r) => r.etat],
  [(h) => h.includes("commentaire"), (r) => r.commentaire],
])

// ATELIERS-INTERVENANTS
await writeTab(T_INTERV, "Ateliers-Intervenants", INTERV, [
  [(h) => h === "id", (r) => r.id],
  [(h) => h.includes("atelier"), (r) => r.atelierId],
  [(h) => h.includes("intervenant"), (r) => r.intervenantId],
  [(h) => h.includes("heure"), (r) => r.heures],
  [(h) => h.includes("role"), (r) => r.role],
])

console.log("\n🎉 Terminé.\n")
