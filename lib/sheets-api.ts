// ──────────────────────────────────────────────
// lib/sheets-api.ts
// Couche d'accès Google Sheets — nouvelle base structurée
// ──────────────────────────────────────────────

// URL à renseigner dans .env.local : NEXT_PUBLIC_SHEETS_API_URL=https://script.google.com/...
const API_URL = process.env.NEXT_PUBLIC_SHEETS_API_URL ?? ""

// ── Types correspondant à la nouvelle base ─────

export interface MembreSheet {
  ID_Membre: string
  ID_Famille: string
  Nom: string
  Prenom: string
  Role: "Adulte" | "Enfant" | string          // = Catégorie dans le CRM
  Contact_Principal?: string
  Genre: string
  Date_Naissance: string
  Langue_Maternelle: string
  Pays_Origine: string
  Telephone: string
  Email: string
  WhatsApp: string
  Droit_Image?: string
  Charte?: string
  Statut_Inscription: string
  Niveau: string
  Type_Apprenant?: string
  Source_Orientation: string
  Nb_Enfants: number | string
  Notes: string
}

export interface FamilleSheet {
  ID_Famille: string
  Nom_Famille: string
  Adresse: string                 // rue
  Code_Postal?: string
  Ville?: string
  Adresse_Complete?: string       // rue + CP + ville (affichage)
  Quartier_QVP: string
  Notes?: string                  // journal de suivi (JSON)
  Nb_Membres: number | string
  Date_Creation: string
  membres?: MembreSheet[]
  statut?: string
  nbMembres?: number
}

export interface InscriptionSheet {
  ID_Inscription: string
  ID_Membre: string
  Annee_Scolaire: string
  Type_Apprenant: string
  Statut: string
  Niveau: string
  Disponibilite: string
  Orientation: string
  Date_Inscription: string
  Beneficiaire: string
  Montant_Adhesion: string | number
  Remarques: string
}

export interface PaiementSheet {
  ID_Paiement: string
  ID_Membre: string
  ID_Inscription?: string
  Date_Paiement: string
  Montant: string | number
  Mode_Paiement: string
  Date_Depot_Banque: string
  Date_Virement: string
}

// ── Helpers ────────────────────────────────────

function str(v: unknown): string {
  return v !== null && v !== undefined ? String(v) : ""
}

export function calculerAge(dateStr: string): number | null {
  if (!dateStr) return null
  const parts = dateStr.split("/")
  if (parts.length !== 3) return null
  const [day, month, year] = parts.map(Number)
  if (isNaN(day) || isNaN(month) || isNaN(year) || year < 1900) return null
  const today = new Date()
  const naissance = new Date(year, month - 1, day)
  let age = today.getFullYear() - naissance.getFullYear()
  const m = today.getMonth() - naissance.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < naissance.getDate())) age--
  return age >= 0 ? age : null
}

export function getStatut(statut: string): "EN COURS" | "ARRÊTÉ" | "SUSPENDU" | string {
  if (!statut) return ""
  const s = statut.toUpperCase()
  if (s.includes("COURS")) return "EN COURS"
  if (s.includes("ARRET") || s.includes("ARRÊT")) return "ARRÊTÉ"
  if (s.includes("SUSPEN")) return "SUSPENDU"
  return statut
}

// ── Appels API ─────────────────────────────────

async function apiGet(action: string, params: Record<string, string> = {}): Promise<unknown> {
  if (!API_URL) throw new Error("API_URL non configurée")
  const qs = new URLSearchParams({ action, ...params }).toString()
  const res = await fetch(`${API_URL}?${qs}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

async function apiPost(body: unknown): Promise<unknown> {
  if (!API_URL) throw new Error("API_URL non configurée")
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

// ── LECTURE ─────────────────────────────────────

export async function fetchFamilles(): Promise<FamilleSheet[]> {
  const data = await apiGet("getFamilles") as FamilleSheet[]
  return data
}

export async function fetchMembres(idFamille?: string): Promise<MembreSheet[]> {
  const params: Record<string, string> = idFamille ? { idFamille } : {}
  const data = await apiGet("getMembres", params) as MembreSheet[]
  return data
}

export async function fetchMembre(idMembre: string): Promise<MembreSheet & { inscriptions: InscriptionSheet[], paiements: PaiementSheet[] }> {
  const data = await apiGet("getMembre", { idMembre })
  return data as MembreSheet & { inscriptions: InscriptionSheet[], paiements: PaiementSheet[] }
}

export async function fetchPaiements(idMembre: string): Promise<PaiementSheet[]> {
  const data = await apiGet("getPaiements", { idMembre }) as PaiementSheet[]
  return data
}

// ── ÉCRITURE ────────────────────────────────────

export async function addFamille(data: Partial<FamilleSheet>): Promise<{ ok: boolean, ID_Famille: string }> {
  return apiPost({ action: "addFamille", data }) as Promise<{ ok: boolean, ID_Famille: string }>
}

export async function updateFamille(idFamille: string, data: Partial<FamilleSheet>): Promise<{ ok: boolean }> {
  return apiPost({ action: "updateFamille", idFamille, data }) as Promise<{ ok: boolean }>
}

export async function addMembre(data: Partial<MembreSheet>): Promise<{ ok: boolean, ID_Membre: string }> {
  return apiPost({ action: "addMembre", data }) as Promise<{ ok: boolean, ID_Membre: string }>
}

export async function updateMembre(idMembre: string, data: Partial<MembreSheet>): Promise<{ ok: boolean }> {
  return apiPost({ action: "updateMembre", idMembre, data }) as Promise<{ ok: boolean }>
}

export async function deleteMembre(idMembre: string): Promise<{ ok: boolean }> {
  return apiPost({ action: "deleteMembre", idMembre }) as Promise<{ ok: boolean }>
}

// ── Paiements (écriture) ────────────────────────

export async function addPaiement(data: Partial<PaiementSheet>): Promise<{ ok: boolean, ID_Paiement: string }> {
  return apiPost({ action: "addPaiement", data }) as Promise<{ ok: boolean, ID_Paiement: string }>
}

export async function updatePaiement(idPaiement: string, data: Partial<PaiementSheet>): Promise<{ ok: boolean }> {
  return apiPost({ action: "updatePaiement", idPaiement, data }) as Promise<{ ok: boolean }>
}

export async function deletePaiement(idPaiement: string): Promise<{ ok: boolean }> {
  return apiPost({ action: "deletePaiement", idPaiement }) as Promise<{ ok: boolean }>
}

// ── Indicateur de configuration ────────────────
export function isApiConfigured(): boolean {
  return !!API_URL
}
