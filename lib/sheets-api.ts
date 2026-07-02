// ──────────────────────────────────────────────
// lib/sheets-api.ts
// Couche d'accès Google Sheets — nouvelle base structurée
// ──────────────────────────────────────────────

// Route interne Next.js (API REST Google Sheets v4 côté serveur — voir app/api/sheets/route.ts)
const API_URL = "/api/sheets"

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
  Beneficiaire?: string
  Statut_Inscription: string
  Niveau: string
  Type_Apprenant?: string
  Source_Orientation: string
  Date_Inscription?: string
  Nb_Enfants: number | string
  Notes: string
  // Champs d'inscription (payload de création uniquement, quand Beneficiaire === "Oui")
  Annee_Scolaire?: string
  Disponibilite?: string
  Montant_Adhesion?: string | number
  Montant_Inscription?: string | number
  Remarques?: string
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
  Montant_Adhesion: string | number
  Montant_Inscription?: string | number
  Montant_Du?: string | number
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

// Format canonique d'année scolaire : "25-26" (attendu par parseAnneeScolaireEnd
// et le tri des inscriptions — ne pas écrire d'autre format dans le Sheet)
export function getCurrentAnneeScolaire(): string {
  const now = new Date()
  const baseYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1
  const y1 = String(baseYear % 100).padStart(2, "0")
  const y2 = String((baseYear + 1) % 100).padStart(2, "0")
  return `${y1}-${y2}`
}

export function getAnneeScolaireOptions(): string[] {
  const now = new Date()
  const baseYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1
  return [-1, 0, 1].map(offset => {
    const y1 = String((baseYear + offset) % 100).padStart(2, "0")
    const y2 = String((baseYear + offset + 1) % 100).padStart(2, "0")
    return `${y1}-${y2}`
  })
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

export async function addInscription(idMembre: string, data: Partial<InscriptionSheet>): Promise<{ ok: boolean, ID_Inscription: string }> {
  return apiPost({ action: "addInscription", idMembre, data }) as Promise<{ ok: boolean, ID_Inscription: string }>
}

export async function updateInscription(idInscription: string, data: Partial<InscriptionSheet>): Promise<{ ok: boolean }> {
  return apiPost({ action: "updateInscription", idInscription, data }) as Promise<{ ok: boolean }>
}

// ── Upload de fichier (Drive) ───────────────────
export async function uploadFichier(data: {
  idMembre?: string
  categorie?: string
  nom: string
  mimeType: string
  dataBase64: string
}): Promise<{ ok: boolean; url: string; fileId: string }> {
  return apiPost({ action: "uploadFichier", ...data }) as Promise<{ ok: boolean; url: string; fileId: string }>
}

export interface DocumentJoint {
  ID_Doc: string
  URL: string
  Categorie: string
}

export async function fetchDocuments(idMembre: string): Promise<DocumentJoint[]> {
  return apiGet("getDocuments", { idMembre }) as Promise<DocumentJoint[]>
}

export async function deleteDocument(idDoc: string): Promise<{ ok: boolean }> {
  return apiPost({ action: "deleteDocument", idDoc }) as Promise<{ ok: boolean }>
}

// ── CONTENUS (Communication) ───────────────────

export interface PostMedia {
  nom: string
  type: string
  url?: string
}

export interface PostParticipantsSheet {
  apprenantes: { id: number; prenom: string; nom: string }[]
  benevoles: string[]
  formatrices: string[]
}

export interface PostSheet {
  id: number
  categorie: string
  date: string
  titre: string
  brief?: string
  contenu?: string
  media: PostMedia[]
  plateforme: string[]
  plateformeContenu: Record<string, { contenu?: string; tags?: string; lien?: string }>
  statut: string
  auteur: string
  sessionId: number | null
  participants?: PostParticipantsSheet
}

export async function fetchPosts(): Promise<PostSheet[]> {
  return apiGet("getPosts") as Promise<PostSheet[]>
}

export async function addPost(data: Record<string, unknown>): Promise<{ ok: boolean; id: number }> {
  return apiPost({ action: "addPost", data }) as Promise<{ ok: boolean; id: number }>
}

export async function updatePost(id: number, data: Record<string, unknown>): Promise<{ ok: boolean }> {
  return apiPost({ action: "updatePost", id, data }) as Promise<{ ok: boolean }>
}

export async function deletePost(id: number): Promise<{ ok: boolean }> {
  return apiPost({ action: "deletePost", id }) as Promise<{ ok: boolean }>
}

export async function uploadPostMedia(data: {
  nom: string
  mimeType: string
  dataBase64: string
}): Promise<{ ok: boolean; url: string; fileId: string }> {
  return apiPost({ action: "uploadPostMedia", ...data }) as Promise<{ ok: boolean; url: string; fileId: string }>
}

// ── Indicateur de configuration ────────────────
export function isApiConfigured(): boolean {
  return !!API_URL
}
