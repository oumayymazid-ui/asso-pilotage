// ──────────────────────────────────────────────────────────────
// lib/assiduite-server.ts — Agrégation des données d'assiduité
// (lecture Google Sheet), côté SERVEUR uniquement.
//
// ⚠️ Ne JAMAIS importer dans un composant client : accède aux
//    credentials du compte de service via getSheetsClient().
//    Utilisé exclusivement par la route serveur app/api/assiduite.
//
// L'auth + le client Sheets sont RÉUTILISÉS depuis google-sheets-server
// (même compte de service, même Sheet BDD_Asso_CRM que le module Familles).
// Ce fichier ne contient que le mapping propre au Hub Assiduité.
// ──────────────────────────────────────────────────────────────
import { getSheetsClient, SPREADSHEET_ID } from "@/lib/google-sheets-server"

// ── Utils de mapping ──────────────────────────────────────────
const norm = (s: unknown) =>
  String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim()

const a1 = (title: string) => `'${title.replace(/'/g, "''")}'`

// dd/mm/yyyy -> yyyy-mm-dd (laisse tel quel si déjà ISO ou inconnu)
function toISODate(v: string): string {
  const s = String(v ?? "").trim()
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`
  return s
}
// "14:00:00" -> "14:00"
const toHHMM = (v: string) => String(v ?? "").trim().slice(0, 5)

// Transforme une plage en tableau d'objets indexés par entête NORMALISÉE
// (accents/casse ignorés) — le mapping ci-dessous s'appuie sur ces clés.
function toObjects(values: unknown[][]): Record<string, string>[] {
  const headers = (values[0] ?? []).map(norm)
  return values.slice(1)
    .filter((r) => r.some((c) => String(c ?? "").trim() !== ""))
    .map((row) => {
      const o: Record<string, string> = {}
      headers.forEach((h, i) => { o[h] = String(row[i] ?? "") })
      return o
    })
}

// ── Types renvoyés au client (mêmes formes que le Hub Assiduité) ──
export type PresenceStatus = "présent" | "absent" | "excusé" | "retard"
export interface Session {
  id: number; titre: string; date: string; heure: string
  salle: string; formatrice: string; beneficiaireIds: number[]; statut: string
}
export interface Beneficiaire {
  id: number; prenom: string; nom: string; niveau: string; statut: string
}
export interface AssiduiteData {
  sessions: Session[]
  beneficiaires: Beneficiaire[]
  presences: Record<number, Record<number, PresenceStatus>>
}

function normEtat(v: string): PresenceStatus {
  const n = norm(v)
  if (n.startsWith("absent")) return "absent"
  if (n.startsWith("excuse")) return "excusé"
  if (n.startsWith("retard")) return "retard"
  return "présent"
}

// ── Cache mémoire court ───────────────────────────────────────
// Évite un appel Sheets à chaque visite (quota 60 lectures/min/utilisateur).
// TTL volontairement court : les données restent quasi temps réel.
const TTL_MS = 60_000
let cache: { at: number; data: AssiduiteData } | null = null

// ── Lecture + mapping complet ─────────────────────────────────
async function readAssiduiteData(): Promise<AssiduiteData> {
  const sheets = getSheetsClient()
  // 1 seule requête batch pour les 5 onglets (économise le quota Sheets).
  const res = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: SPREADSHEET_ID,
    ranges: ["EVENEMENT2", "PERSONNE", "INSCRIPTION", "ASSIDUITE", "INTERVENANT"].map(a1),
    majorDimension: "ROWS",
  })
  const vr = res.data.valueRanges ?? []
  const rowsAt = (i: number) => (vr[i]?.values ?? []) as unknown[][]

  const evenements  = toObjects(rowsAt(0))
  const personnes   = toObjects(rowsAt(1))
  const inscriptions = toObjects(rowsAt(2))
  const assiduite   = toObjects(rowsAt(3))
  const intervenants = toObjects(rowsAt(4))

  // Intervenants : id -> "Prenom Nom"
  const intName = new Map<string, string>()
  for (const i of intervenants) intName.set(String(i["id"]), `${i["prenom"] ?? ""} ${i["nom"] ?? ""}`.trim())

  // Personnes : id -> {prenom, nom}
  const persName = new Map<string, { prenom: string; nom: string }>()
  for (const p of personnes) persName.set(String(p["id"]), { prenom: p["prenom"] ?? "", nom: p["nom"] ?? "" })

  // Inscription retenue par personne : "En cours" prioritaire, sinon la 1re vue
  const inscByPers = new Map<string, { niveau: string; statut: string }>()
  for (const ins of inscriptions) {
    const pid = String(ins["personne id"])
    const enCours = norm(ins["statut"]) === "en cours"
    const current = inscByPers.get(pid)
    if (!current || enCours) {
      inscByPers.set(pid, {
        niveau: ins["niveau / classe"] || ins["niveau"] || "",
        statut: enCours ? "actif" : "inactif",
      })
    }
  }

  // Bénéficiaires = personnes ayant une inscription
  const beneficiaires: Beneficiaire[] = []
  for (const [pid, insc] of inscByPers) {
    const p = persName.get(pid)
    if (!p) continue
    beneficiaires.push({
      id: Number(pid), prenom: p.prenom, nom: p.nom,
      niveau: insc.niveau, statut: insc.statut,
    })
  }

  // Présences + participants par événement
  const presences: Record<number, Record<number, PresenceStatus>> = {}
  const participants = new Map<number, Set<number>>()
  for (const a of assiduite) {
    const evId = Number(a["evenement2 id"])
    const pId = Number(a["personne id"])
    if (!evId || !pId) continue
    ;(presences[evId] ??= {})[pId] = normEtat(a["etat"])
    let set = participants.get(evId)
    if (!set) { set = new Set(); participants.set(evId, set) }
    set.add(pId)
  }

  // Sessions depuis EVENEMENT2
  const sessions: Session[] = evenements.map((e) => {
    const id = Number(e["id"])
    return {
      id,
      titre: e["titre"] || "",
      date: toISODate(e["date"]),
      heure: toHHMM(e["heure_debut"] || e["heure debut"] || ""),
      salle: e["salle"] || "",
      formatrice: intName.get(String(e["animateur : id_membre_area"] ?? e["animateur"] ?? "")) || "",
      beneficiaireIds: Array.from(participants.get(id) ?? []),
      statut: e["statut"] || "",
    }
  })

  return { sessions, beneficiaires, presences }
}

/** Données d'assiduité avec cache mémoire (TTL 60 s). */
export async function fetchAssiduiteData(): Promise<AssiduiteData> {
  const now = Date.now()
  if (cache && now - cache.at < TTL_MS) return cache.data
  const data = await readAssiduiteData()
  cache = { at: now, data }
  return data
}
