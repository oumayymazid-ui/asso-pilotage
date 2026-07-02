"use client"

import { useState, useEffect, useCallback, use } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import SlideOver, { Field, Input, Select, Textarea, FormRow, SaveButton, DeleteButton } from "@/components/SlideOver"
import JournalSuivi from "@/components/JournalSuivi"
import DateInput from "@/components/DateInput"
import { ChevronRight, ChevronDown, Plus, Pencil, Upload, FileText, ExternalLink, X } from "lucide-react"
import {
  fetchFamilles, fetchMembre, updateMembre, deleteMembre,
  addPaiement, updatePaiement, deletePaiement, addInscription, updateInscription, uploadFichier,
  fetchDocuments, deleteDocument, getCurrentAnneeScolaire, getAnneeScolaireOptions, fetchScolariteFamille,
  type FamilleSheet, type MembreSheet, type PaiementSheet, type InscriptionSheet, type DocumentJoint, type ScolariteEntry
} from "@/lib/sheets-api"

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(",")[1] ?? "")
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// Extrait jour/mois/année d'une date au format ISO (AAAA-MM-JJ) ou FR (JJ/MM/AAAA)
function partsDate(v?: string | null): { d: number; m: number; y: number } | null {
  if (!v) return null
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v))
  if (iso) return { y: +iso[1], m: +iso[2], d: +iso[3] }
  const fr = String(v).split("/")
  if (fr.length === 3) { const d = +fr[0], m = +fr[1], y = +fr[2]; if (d && m && y) return { d, m, y } }
  return null
}

function dateFrLisible(v?: string | null): string {
  const p = partsDate(v)
  if (!p) return v ? String(v) : ""
  return `${String(p.d).padStart(2, "0")}/${String(p.m).padStart(2, "0")}/${p.y}`
}

function ageDepuis(v?: string | null): number | null {
  const p = partsDate(v)
  if (!p) return null
  const t = new Date()
  let age = t.getFullYear() - p.y
  const mm = t.getMonth() - (p.m - 1)
  if (mm < 0 || (mm === 0 && t.getDate() < p.d)) age--
  return age >= 0 ? age : null
}

// Types de documents (chacun rangé dans son dossier Drive — mapping à venir)
const TYPES_DOCUMENT = [
  "Fiche d'inscription",
  "Droit à l'image",
  "Charte d'engagement",
  "Autorisation de sortie",
  "Bulletins",
]

const niveauStyle: Record<string, string> = {
  "CM1":          "bg-ateliers-light text-ateliers-dark",
  "CE2":          "bg-ateliers-light text-ateliers-dark",
  "6eme":         "bg-familles-light text-familles-dark",
  "5eme":         "bg-familles-light text-familles-dark",
  "4eme":         "bg-familles-light text-familles-dark",
  "2nde":         "bg-finances-light text-finances-dark",
  "Terminale CAP":"bg-finances-light text-finances-dark",
}

const statutStyle: Record<string, string> = {
  "EN COURS": "bg-finances-light text-finances-dark",
  "SUSPENDU": "bg-ateliers-light text-ateliers-dark",
  "ARRÊTÉ":   "bg-absences-light text-absences-dark",
  "ARRETE":   "bg-absences-light text-absences-dark",
  "TERMINÉ":  "bg-slate-100 text-slate-600",
  "TERMINE":  "bg-slate-100 text-slate-600",
}

const NIVEAUX = ["CM1", "CE2", "6eme", "5eme", "4eme", "2nde", "Terminale CAP"]
const TYPES_APPRENANT = ["FLE", "Soutien scolaire"]

/** Option supplémentaire si la valeur du Sheet ne figure pas dans la liste prédéfinie */
function ExtraOption({ value, list }: { value: string; list: string[] }) {
  if (!value || list.includes(value)) return null
  return <option value={value}>{value}</option>
}

function parseAnneeScolaireEnd(annee: string): Date | null {
  const match = String(annee).match(/^(\d{2})-(\d{2})$/)
  if (!match) return null
  const endYear = 2000 + parseInt(match[2])
  return new Date(endYear, 7, 31) // 31 août de l'année de fin
}

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  if (!value && value !== 0) return null
  return (
    <div>
      <p className="text-xs text-muted mb-0.5">{label}</p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  )
}

export default function FicheMembrePage({ params }: { params: Promise<{ id: string; membreId: string }> }) {
  const { id, membreId } = use(params)
  const router = useRouter()

  const [famille, setFamille]   = useState<FamilleSheet | null>(null)
  const [membre, setMembre]     = useState<MembreSheet | null>(null)
  const [paiements, setPaiements] = useState<PaiementSheet[]>([])
  const [inscriptions, setInscriptions] = useState<InscriptionSheet[]>([])
  const [documents, setDocuments] = useState<DocumentJoint[]>([])
  const [scolarites, setScolarites] = useState<ScolariteEntry[]>([])
  const [loading, setLoading]   = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [slideOpen, setSlideOpen] = useState(false)
  const [form, setForm]         = useState<Partial<MembreSheet>>({})
  const [payOpen, setPayOpen]   = useState(false)
  const [payEditing, setPayEditing] = useState(false)
  const [payForm, setPayForm]   = useState<Partial<PaiementSheet>>({})
  const [inscOpen, setInscOpen] = useState(false)
  const [inscEditing, setInscEditing] = useState<InscriptionSheet | null>(null)
  const [inscForm, setInscForm] = useState({
    Annee_Scolaire: "", Type_Apprenant: "", Niveau: "",
    Disponibilite: "", Orientation: "",
    Montant_Adhesion: "", Montant_Inscription: "",
  })
  const [reinscOpen, setReinscOpen] = useState(false)
  const [reinscForm, setReinscForm] = useState<Partial<InscriptionSheet>>({})
  const [finOpen, setFinOpen] = useState(false)
  const [finInsc, setFinInsc] = useState<InscriptionSheet | null>(null)
  const [finForm, setFinForm] = useState({ Statut: "", Remarques: "" })
  const [docOpen, setDocOpen]   = useState(false)
  const [docType, setDocType]   = useState("")
  const [docFile, setDocFile]   = useState<File | null>(null)
  const [docSaving, setDocSaving] = useState(false)
  const [openDocTypes, setOpenDocTypes] = useState<string[]>([])

  const loadData = useCallback(async () => {
    setLoadError(false)
    try {
      // getMembre renvoie déjà les paiements → pas d'appel fetchPaiements séparé
      // (évitait de relire INSCRIPTION + PAIEMENT, économie de quota Sheets).
      const [familles, m, docs] = await Promise.all([
        fetchFamilles(),
        fetchMembre(membreId),
        fetchDocuments(membreId),
      ])
      setFamille(familles.find(f => f.ID_Famille === id) ?? null)
      setMembre(m)
      setForm(m)
      setPaiements(m.paiements ?? [])
      setDocuments(docs)

      // Isolé du Promise.all principal : la scolarité est une info annexe, son
      // indisponibilité (table Sheet manquante, etc.) ne doit pas empêcher
      // l'affichage du reste de la fiche membre.
      try {
        setScolarites(await fetchScolariteFamille(id))
      } catch (e) {
        console.error(e)
        setScolarites([])
      }

      // Mise à jour automatique : inscriptions EN COURS dont l'année est échue → Terminé
      const fetchedInscriptions = m.inscriptions ?? []
      const today = new Date()
      const toTerminer = fetchedInscriptions.filter(insc => {
        if (!insc.Statut?.toUpperCase().includes("COURS")) return false
        const end = parseAnneeScolaireEnd(String(insc.Annee_Scolaire))
        return end !== null && today > end
      })
      if (toTerminer.length > 0) {
        await Promise.all(toTerminer.map(insc => updateInscription(insc.ID_Inscription, { Statut: "Terminé" })))
        const m2 = await fetchMembre(membreId)
        setInscriptions(m2.inscriptions ?? [])
      } else {
        setInscriptions(fetchedInscriptions)
      }
    } catch (e) {
      console.error("[familles] échec du chargement du membre", e)
      setLoadError(true)
    }
    finally { setLoading(false) }
  }, [id, membreId])

  useEffect(() => { loadData() }, [loadData])

  if (loading) return (
    <div className="p-6 flex items-center justify-center min-h-[300px]">
      <p className="text-muted text-sm">Chargement…</p>
    </div>
  )

  // Erreur de chargement (souvent le quota Google Sheets, 60 lectures/min) :
  // on ne prétend PAS que le membre n'existe pas, on propose de réessayer.
  if (!membre && loadError) return (
    <div className="p-6">
      <p className="text-foreground font-medium">Impossible de charger la fiche.</p>
      <p className="text-muted text-sm mt-1">Le service de données est momentanément indisponible (quota atteint). Réessaie dans quelques secondes.</p>
      <div className="flex items-center gap-4 mt-3">
        <button onClick={() => { setLoading(true); loadData() }} className="text-familles-dark underline text-sm">Réessayer</button>
        <Link href={`/familles/${id}`} className="text-familles-dark underline text-sm">← Retour</Link>
      </div>
    </div>
  )

  if (!membre) return (
    <div className="p-6">
      <p className="text-muted">Membre introuvable.</p>
      <Link href={`/familles/${id}`} className="text-familles-dark underline text-sm mt-2 inline-block">← Retour</Link>
    </div>
  )

  async function handleSave() {
    await updateMembre(membreId, form)
    await loadData()
    setSlideOpen(false)
  }

  async function handleSaveNotes(json: string) {
    await updateMembre(membreId, { Notes: json })
    await loadData()
  }

  function openNewPaiement() {
    const inscAvecReste = inscriptions
      .map(insc => {
        const paye = paiements.filter(p => p.ID_Inscription === insc.ID_Inscription)
          .reduce((s, p) => s + (Number(p.Montant) || 0), 0)
        const attendu = (Number(insc.Montant_Adhesion) || 0) + (Number(insc.Montant_Inscription) || 0)
        return { insc, reste: attendu - paye }
      })
      .sort((a, b) => b.reste - a.reste)
    const defaultInscId = inscAvecReste[0]?.insc.ID_Inscription ?? inscriptions[0]?.ID_Inscription ?? ""
    setPayEditing(false)
    setPayForm({ ID_Inscription: defaultInscId, Date_Paiement: "", Montant: "", Mode_Paiement: "" })
    setPayOpen(true)
  }

  function openEditPaiement(p: PaiementSheet) {
    setPayEditing(true)
    setPayForm({ ...p })
    setPayOpen(true)
  }

  async function handleSavePaiement() {
    if (payEditing && payForm.ID_Paiement) {
      await updatePaiement(payForm.ID_Paiement, payForm)
    } else {
      await addPaiement(payForm)
    }
    await loadData()
    setPayOpen(false)
  }

  async function handleDeletePaiement() {
    if (payForm.ID_Paiement) await deletePaiement(payForm.ID_Paiement)
    await loadData()
    setPayOpen(false)
  }

  async function handleSaveInscription() {
    if (!inscEditing) return
    await updateInscription(inscEditing.ID_Inscription, {
      Annee_Scolaire:    inscForm.Annee_Scolaire,
      Type_Apprenant:    inscForm.Type_Apprenant,
      Niveau:            inscForm.Niveau,
      Disponibilite:     inscForm.Disponibilite,
      Orientation:       inscForm.Orientation,
      Montant_Adhesion:  inscForm.Montant_Adhesion,
      Montant_Inscription: inscForm.Montant_Inscription,
    })
    await loadData()
    setInscOpen(false)
  }

  function openReinscription() {
    const derniere = [...inscriptions].sort((a, b) =>
      String(b.Annee_Scolaire).localeCompare(String(a.Annee_Scolaire))
    )[0]
    setReinscForm({
      Annee_Scolaire:      getCurrentAnneeScolaire(),
      Type_Apprenant:      derniere?.Type_Apprenant ?? "",
      Niveau:              derniere?.Niveau ?? "",
      Disponibilite:       derniere?.Disponibilite ?? "",
      Orientation:         derniere?.Orientation ?? "",
      Montant_Adhesion:    derniere?.Montant_Adhesion ?? "",
      Montant_Inscription: derniere?.Montant_Inscription ?? "30",
    })
    setReinscOpen(true)
  }

  async function handleSaveReinscription() {
    await addInscription(membreId, reinscForm)
    await loadData()
    setReinscOpen(false)
  }

  async function handleSaveFin() {
    if (!finInsc) return
    await updateInscription(finInsc.ID_Inscription, {
      Statut: finForm.Statut,
      Remarques: finForm.Remarques,
    })
    await loadData()
    setFinOpen(false)
  }

  function openDocument() {
    setDocType("")
    setDocFile(null)
    setDocOpen(true)
  }

  async function handleValiderDocument() {
    if (!docType || !docFile) return
    setDocSaving(true)
    try {
      const dataBase64 = await fileToBase64(docFile)
      await uploadFichier({ idMembre: membreId, categorie: docType, nom: docFile.name, mimeType: docFile.type, dataBase64 })
      await loadData()
      setDocOpen(false)
    } catch { console.error("[familles] échec de l'upload du document") }
    finally { setDocSaving(false) }
  }

  async function handleDeleteDocument(idDoc: string) {
    if (!confirm("Supprimer ce document ?")) return
    await deleteDocument(idDoc)
    await loadData()
  }

  async function handleDelete() {
    await deleteMembre(membreId)
    router.push(`/familles/${id}`)
  }

  const statut = membre.Statut_Inscription?.toString().toUpperCase() ?? ""
  const age = ageDepuis(membre.Date_Naissance)

  // Champs de la carte infos (ordre logique ; seuls les renseignés s'affichent)
  const naissance = dateFrLisible(membre.Date_Naissance)
  const champsInfos: { label: string; value: string }[] = [
    { label: "Téléphone", value: String(membre.Telephone || "") },
    { label: "WhatsApp", value: membre.WhatsApp && membre.WhatsApp !== membre.Telephone ? String(membre.WhatsApp) : "" },
    { label: "Email", value: String(membre.Email || "") },
    { label: "Date de naissance", value: naissance ? (age !== null ? `${naissance} · ${age} ans` : naissance) : "" },
    { label: "Genre", value: String(membre.Genre || "") },
    { label: "Pays d'origine", value: String(membre.Pays_Origine || "") },
    { label: "Langue maternelle", value: String(membre.Langue_Maternelle || "") },
    { label: "Nb. enfants accompagnants", value: membre.Nb_Enfants ? String(membre.Nb_Enfants) : "" },
    { label: "Adresse", value: String(famille?.Adresse_Complete || famille?.Adresse || "") },
    { label: "Contact principal", value: membre.Contact_Principal ? String(membre.Contact_Principal) : "" },
    { label: "Source d'orientation", value: String(membre.Source_Orientation || "") },
  ].filter(c => c.value !== "")

  // Scolarité : la sienne (enfant) et celle des enfants de la famille (parent)
  const estEnfant = membre.Role === "Enfant"
  const maScolarite = scolarites.find(s => s.ID_Membre === membreId) ?? null
  const scolariteEnfants = scolarites.filter(s => s.ID_Membre !== membreId)
  const etabLabel = (e: ScolariteEntry["Etablissement"]) => e ? e.Nom : ""

  const champsScolarite: { label: string; value: string }[] = maScolarite ? [
    { label: "Établissement", value: etabLabel(maScolarite.Etablissement) },
    { label: "Professeur principal", value: maScolarite.ProfPrincipal?.Nom || "" },
    { label: "Téléphone prof.", value: maScolarite.ProfPrincipal?.Telephone || "" },
    { label: "Email prof.", value: maScolarite.ProfPrincipal?.Email || "" },
    { label: "Rencontre prof.", value: maScolarite.Rencontre_Prof || "" },
  ].filter(c => c.value !== "") : []

  // Présence des pièces (Oui/Non) dérivée de DOCUMENTS JOINTS. Toujours affichée.
  const docPresent = (cat: string) => documents.some(d => d.Categorie === cat)
  const piecesStatut = TYPES_DOCUMENT.map(cat => ({ cat, present: docPresent(cat) }))

  return (
    <div className="p-6 max-w-3xl mx-auto">

      {/* Fil d'Ariane */}
      <nav className="flex items-center gap-1.5 text-sm text-muted mb-5 flex-wrap">
        <Link href="/familles" className="hover:text-familles-dark transition-colors">Familles</Link>
        <ChevronRight size={14} />
        <Link href={`/familles/${id}`} className="hover:text-familles-dark transition-colors">
          {famille?.Nom_Famille ?? id}
        </Link>
        <ChevronRight size={14} />
        <span className="text-foreground font-medium">{membre.Prenom}</span>
      </nav>

      {/* En-tête */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-familles-light text-familles-dark">
              {membre.Role || "Membre"}
            </span>
            {membre.Niveau && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${niveauStyle[membre.Niveau] ?? "bg-slate-100 text-slate-600"}`}>
                {membre.Niveau}
              </span>
            )}
            {statut && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statutStyle[statut] ?? "bg-slate-100 text-slate-600"}`}>
                {statut}
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold text-foreground">{membre.Prenom} {membre.Nom}</h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={openDocument}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-familles text-white text-sm font-medium hover:bg-familles-dark transition-colors"
          >
            <Upload size={15} />
            Ajouter un document
          </button>
          <button
            onClick={() => { setForm({ ...membre }); setSlideOpen(true) }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-familles-light text-familles-dark text-sm font-medium hover:bg-familles hover:text-white transition-colors"
          >
            Modifier
          </button>
        </div>
      </div>

      {/* Popup ajout de document */}
      <SlideOver open={docOpen} onClose={() => setDocOpen(false)} title="Ajouter un document" width="md">
        <form onSubmit={e => { e.preventDefault(); handleValiderDocument() }} className="flex flex-col gap-4">
          <Field label="Type de document" required>
            <Select value={docType} onChange={e => setDocType(e.target.value)}>
              <option value="">— Choisir —</option>
              {TYPES_DOCUMENT.map(t => <option key={t} value={t}>{t}</option>)}
            </Select>
          </Field>
          <Field label="Fichier" required>
            <label className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-border bg-surface text-sm text-muted cursor-pointer hover:border-familles transition-colors w-fit">
              <Upload size={15} />
              {docFile ? "Changer de fichier" : "Choisir un fichier"}
              <input type="file" className="hidden" onChange={e => setDocFile(e.target.files?.[0] ?? null)} />
            </label>
            {docFile && <p className="text-xs text-muted mt-1.5">{docFile.name}</p>}
          </Field>
          <button
            type="submit"
            disabled={!docType || !docFile || docSaving}
            className="w-full px-4 py-2.5 rounded-xl bg-familles text-white text-sm font-medium hover:bg-familles-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {docSaving ? "Envoi…" : "Valider"}
          </button>
        </form>
      </SlideOver>

      {/* Carte infos */}
      <div className="bg-surface border border-border rounded-xl p-5 mb-6">
        <h2 className="text-sm font-semibold text-foreground mb-3">Informations personnelles</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
          {champsInfos.map(c => (
            <InfoRow key={c.label} label={c.label} value={c.value} />
          ))}
        </div>
      </div>

      {/* Scolarité — fiche d'un enfant */}
      {estEnfant && champsScolarite.length > 0 && (
        <div className="bg-surface border border-border rounded-xl p-5 mb-6">
          <h2 className="text-sm font-semibold text-foreground mb-3">Scolarité</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
            {champsScolarite.map(c => (
              <InfoRow key={c.label} label={c.label} value={c.value} />
            ))}
          </div>
        </div>
      )}

      {/* Scolarité des enfants — fiche d'un parent */}
      {!estEnfant && scolariteEnfants.length > 0 && (
        <div className="bg-surface border border-border rounded-xl p-5 mb-6">
          <h2 className="text-sm font-semibold text-foreground mb-3">
            Scolarité des enfants
            <span className="ml-2 text-xs font-normal text-muted">({scolariteEnfants.length})</span>
          </h2>
          <ul className="flex flex-col gap-2">
            {scolariteEnfants.map(sc => (
              <li key={sc.ID_Membre}>
                <Link
                  href={`/familles/${id}/membre/${sc.ID_Membre}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border px-4 py-2.5 hover:border-familles/40 hover:bg-familles-light/40 transition-colors"
                >
                  <span className="text-sm font-medium text-familles-dark">{sc.Prenom} {sc.Nom}</span>
                  <span className="text-sm text-muted text-right">{etabLabel(sc.Etablissement) || "Établissement non renseigné"}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Documents : un type par ligne, dépliable pour voir les fichiers joints */}
      <div className="bg-surface border border-border rounded-xl p-5 mb-6">
        <h2 className="text-sm font-semibold text-foreground mb-3">Documents</h2>

        <ul className="divide-y divide-border">
          {piecesStatut.map(({ cat, present }) => {
            const fichiers = documents.filter(d => d.Categorie === cat)
            const ouvert = openDocTypes.includes(cat)
            return (
              <li key={cat}>
                {/* Ligne du type : bouton dépliable (accessible clavier) s'il y a des fichiers, sinon simple ligne */}
                {(() => {
                  const contenu = (
                    <>
                      <span className="flex items-center gap-1.5 text-sm text-foreground">
                        {present
                          ? <ChevronDown size={15} className={`shrink-0 text-muted transition-transform ${ouvert ? "" : "-rotate-90"}`} />
                          : <span className="w-[15px] shrink-0" />}
                        {cat}
                      </span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${present ? "bg-finances-light text-finances-dark" : "bg-slate-100 text-slate-500"}`}>
                        {present ? "Oui" : "Non"}
                      </span>
                    </>
                  )
                  return present ? (
                    <button
                      type="button"
                      aria-expanded={ouvert}
                      onClick={() => setOpenDocTypes(o => o.includes(cat) ? o.filter(c => c !== cat) : [...o, cat])}
                      className="w-full flex items-center justify-between gap-3 py-2.5 cursor-pointer rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-familles"
                    >
                      {contenu}
                    </button>
                  ) : (
                    <div className="flex items-center justify-between gap-3 py-2.5">{contenu}</div>
                  )
                })()}

                {/* Fichiers rattachés à ce type (dépliés) */}
                {present && ouvert && (
                  <ul className="space-y-2 pb-3 pl-[22px]">
                    {fichiers.map(doc => (
                      <li key={doc.ID_Doc} className="flex items-center justify-between gap-3 bg-slate-50 rounded-lg px-4 py-2.5">
                        <a href={doc.URL} target="_blank" rel="noopener noreferrer"
                           className="flex items-center gap-2 min-w-0 text-sm text-familles-dark hover:underline">
                          <FileText size={15} className="shrink-0" />
                          <span className="truncate">{doc.Categorie || "Document"}</span>
                          <ExternalLink size={13} className="shrink-0 text-muted" />
                        </a>
                        <button onClick={() => handleDeleteDocument(doc.ID_Doc)} aria-label="Supprimer ce document" title="Supprimer"
                          className="shrink-0 p-1 rounded text-muted hover:text-absences-dark hover:bg-absences-light transition-colors">
                          <X size={14} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      </div>

      {/* Journal : commentaires + appels + emails */}
      <JournalSuivi notes={membre.Notes} onSave={handleSaveNotes} />

      {/* Inscriptions */}
      <div className="bg-surface border border-border rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between mb-3 gap-2">
          <h2 className="text-sm font-semibold text-foreground">
            Inscriptions
            {inscriptions.length > 0 && <span className="ml-2 text-xs font-normal text-muted">({inscriptions.length})</span>}
          </h2>
          <button onClick={openReinscription}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-familles text-white text-xs font-medium hover:bg-familles-dark transition-colors">
            <Plus size={13} /> {inscriptions.length === 0 ? "Inscription" : "Réinscription"}
          </button>
        </div>
        {inscriptions.length === 0 ? (
          <p className="text-sm text-muted italic">Aucune inscription enregistrée.</p>
        ) : (
          <ul className="space-y-2">
            {inscriptions.map(insc => {
              const montantDu = (Number(insc.Montant_Adhesion) || 0) + (Number(insc.Montant_Inscription) || 0)
              return (
                <li key={insc.ID_Inscription} className="rounded-lg border border-border px-4 py-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <p className="text-sm font-semibold text-foreground">{insc.Annee_Scolaire || "—"}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      {insc.Date_Inscription && (
                        <span className="text-xs text-muted">{insc.Date_Inscription}</span>
                      )}
                      {insc.Statut && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          insc.Statut.toUpperCase().includes("COURS")   ? "bg-finances-light text-finances-dark"  :
                          insc.Statut.toUpperCase().includes("SUSPEN")  ? "bg-ateliers-light text-ateliers-dark"  :
                          insc.Statut.toUpperCase().includes("ARRET")   ? "bg-absences-light text-absences-dark"  :
                          "bg-slate-100 text-slate-600"
                        }`}>
                          {insc.Statut}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 mt-2 flex-wrap">
                    <p className="text-xs text-muted">
                      Montant dû : <span className="font-semibold text-foreground">{montantDu} €</span>
                      <span className="ml-2 text-slate-400">
                        (adhésion {Number(insc.Montant_Adhesion) || 0} € + inscription {Number(insc.Montant_Inscription) || 0} €)
                      </span>
                    </p>
                    <div className="flex flex-col items-end gap-1">
                    <button
                      onClick={() => {
                        setInscEditing(insc)
                        setInscForm({
                          Annee_Scolaire:    String(insc.Annee_Scolaire ?? ""),
                          Type_Apprenant:    String(insc.Type_Apprenant ?? ""),
                          Niveau:            String(insc.Niveau ?? ""),
                          Disponibilite:     String(insc.Disponibilite ?? ""),
                          Orientation:       String(insc.Orientation ?? ""),
                          Montant_Adhesion:  String(insc.Montant_Adhesion ?? ""),
                          Montant_Inscription: String(insc.Montant_Inscription ?? "30"),
                        })
                        setInscOpen(true)
                      }}
                      className="flex items-center gap-1.5 text-xs text-familles-dark hover:underline"
                    >
                      <Pencil size={12} /> Modifier
                    </button>
                    <button
                      onClick={() => {
                        setFinInsc(insc)
                        setFinForm({ Statut: insc.Statut ?? "", Remarques: String(insc.Remarques ?? "") })
                        setFinOpen(true)
                      }}
                      className="flex items-center gap-1.5 text-xs text-absences-dark hover:underline"
                    >
                      <X size={12} /> Mettre fin à l'inscription
                    </button>
                    </div>
                  </div>
                  {insc.Remarques && (
                    <p className="text-xs text-muted mt-1.5">{insc.Remarques}</p>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Paiements */}
      <div className="bg-surface border border-border rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between mb-3 gap-2">
          <h2 className="text-sm font-semibold text-foreground">
            Paiements
            {paiements.length > 0 && <span className="ml-2 text-xs font-normal text-muted">({paiements.length})</span>}
          </h2>
          {inscriptions.length > 0 && (
            <button onClick={openNewPaiement}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-familles text-white text-xs font-medium hover:bg-familles-dark transition-colors">
              <Plus size={13} />Paiement
            </button>
          )}
        </div>

        {/* Bandeau total */}
        {(() => {
          const totalAttendu = inscriptions.reduce((s, insc) =>
            s + (Number(insc.Montant_Adhesion) || 0) + (Number(insc.Montant_Inscription) || 0), 0)
          const totalPaye = paiements.reduce((s, p) => s + (Number(p.Montant) || 0), 0)
          const totalReste = totalAttendu - totalPaye
          if (totalAttendu === 0) return null
          return (
            <div className="mb-4">
              {totalReste > 0
                ? <span className="text-xs px-3 py-1.5 rounded-full font-medium bg-absences-light text-absences-dark">Reste à régler : {totalReste} €</span>
                : <span className="text-xs px-3 py-1.5 rounded-full font-medium bg-finances-light text-finances-dark">Tout est soldé ✓</span>
              }
            </div>
          )
        })()}

        {/* Liste des paiements */}
        {paiements.length === 0 ? (
          <p className="text-sm text-muted italic">
            {inscriptions.length === 0 ? "Aucune inscription : impossible d'ajouter un paiement." : "Aucun paiement enregistré."}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {[...paiements]
              .sort((a, b) => (b.Date_Paiement ?? "").localeCompare(a.Date_Paiement ?? ""))
              .map(p => (
                <li key={p.ID_Paiement} className="flex items-center justify-between gap-3 py-3 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-sm font-bold text-familles-dark shrink-0">{p.Montant} €</span>
                    {p.Mode_Paiement && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-familles-light text-familles-dark">{p.Mode_Paiement}</span>
                    )}
                    {p.Date_Paiement && (
                      <span className="text-xs text-muted">{p.Date_Paiement}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => openEditPaiement(p)} aria-label="Modifier" title="Modifier"
                      className="p-1.5 rounded text-muted hover:text-familles-dark hover:bg-familles-light transition-colors">
                      <Pencil size={13} />
                    </button>
                    <button onClick={async () => {
                        if (!confirm("Supprimer ce paiement ?")) return
                        await deletePaiement(p.ID_Paiement)
                        await loadData()
                      }}
                      aria-label="Supprimer" title="Supprimer"
                      className="p-1.5 rounded text-muted hover:text-absences-dark hover:bg-absences-light transition-colors">
                      <X size={13} />
                    </button>
                  </div>
                </li>
              ))
            }
          </ul>
        )}
      </div>

      {/* SlideOver paiement */}
      <SlideOver open={payOpen} onClose={() => setPayOpen(false)} title={payEditing ? "Modifier le paiement" : "Ajouter un paiement"} width="md">
        <form onSubmit={e => { e.preventDefault(); handleSavePaiement() }} className="flex flex-col gap-4">
          {!payEditing && inscriptions.length > 0 && (
            <Field label="Année scolaire" required>
              <Select value={String(payForm.ID_Inscription ?? "")} onChange={e => setPayForm(f => ({ ...f, ID_Inscription: e.target.value }))}>
                {inscriptions.map(i => (
                  <option key={i.ID_Inscription} value={i.ID_Inscription}>{i.Annee_Scolaire || `Inscription ${i.ID_Inscription}`}</option>
                ))}
              </Select>
            </Field>
          )}
          <FormRow>
            <Field label="Montant (€)" required>
              <Input type="number" value={String(payForm.Montant ?? "")} onChange={e => setPayForm(f => ({ ...f, Montant: e.target.value }))} />
            </Field>
            <Field label="Date de paiement">
              <DateInput value={payForm.Date_Paiement != null ? String(payForm.Date_Paiement) : ""} onChange={v => setPayForm(f => ({ ...f, Date_Paiement: v }))} />
            </Field>
          </FormRow>
          <Field label="Mode de paiement">
            <Select value={String(payForm.Mode_Paiement ?? "")} onChange={e => setPayForm(f => ({ ...f, Mode_Paiement: e.target.value }))}>
              <option value="">—</option>
              <option value="Especes">Espèces</option>
              <option value="Cheque">Chèque</option>
              <option value="Virement">Virement</option>
              <option value="CB">Carte bancaire</option>
            </Select>
          </Field>
          <SaveButton accent="familles" />
          {payEditing && <DeleteButton onClick={handleDeletePaiement} />}
        </form>
      </SlideOver>

      {/* SlideOver réinscription */}
      <SlideOver open={reinscOpen} onClose={() => setReinscOpen(false)} title={inscriptions.length === 0 ? "Inscription" : "Réinscription"} width="md">
        <form onSubmit={e => { e.preventDefault(); handleSaveReinscription() }} className="flex flex-col gap-4">
          <FormRow>
            <Field label="Année scolaire" required>
              <Select value={String(reinscForm.Annee_Scolaire ?? "")} onChange={e => setReinscForm(f => ({ ...f, Annee_Scolaire: e.target.value }))}>
                {getAnneeScolaireOptions().map(y => <option key={y} value={y}>{y}</option>)}
              </Select>
            </Field>
            <Field label="Type d'apprenant">
              <Select value={String(reinscForm.Type_Apprenant ?? "")} onChange={e => setReinscForm(f => ({ ...f, Type_Apprenant: e.target.value }))}>
                <option value="">—</option>
                <ExtraOption value={String(reinscForm.Type_Apprenant ?? "")} list={TYPES_APPRENANT} />
                <option value="FLE">FLE</option>
                <option value="Soutien scolaire">Soutien scolaire</option>
              </Select>
            </Field>
          </FormRow>
          <Field label="Niveau scolaire">
            <Select value={String(reinscForm.Niveau ?? "")} onChange={e => setReinscForm(f => ({ ...f, Niveau: e.target.value }))}>
              <option value="">—</option>
              <ExtraOption value={String(reinscForm.Niveau ?? "")} list={NIVEAUX} />
              <option value="CM1">CM1</option>
              <option value="CE2">CE2</option>
              <option value="6eme">6ème</option>
              <option value="5eme">5ème</option>
              <option value="4eme">4ème</option>
              <option value="2nde">2nde</option>
              <option value="Terminale CAP">Terminale CAP</option>
            </Select>
          </Field>
          <Field label="Disponibilités" hint="ex. Lundi matin, Mercredi">
            <Input value={String(reinscForm.Disponibilite ?? "")} onChange={e => setReinscForm(f => ({ ...f, Disponibilite: e.target.value }))} />
          </Field>
          <Field label="Orientation" hint="ex. CAF, CPAM…">
            <Input value={String(reinscForm.Orientation ?? "")} onChange={e => setReinscForm(f => ({ ...f, Orientation: e.target.value }))} />
          </Field>
          <FormRow>
            <Field label="Montant d'adhésion (€)" hint="ex. 0">
              <Input type="number" value={String(reinscForm.Montant_Adhesion ?? "")} onChange={e => setReinscForm(f => ({ ...f, Montant_Adhesion: e.target.value }))} />
            </Field>
            <Field label="Montant d'inscription (€)" hint="ex. 30">
              <Input type="number" value={String(reinscForm.Montant_Inscription ?? "30")} onChange={e => setReinscForm(f => ({ ...f, Montant_Inscription: e.target.value }))} />
            </Field>
          </FormRow>
          <div className="px-3 py-2.5 rounded-xl bg-slate-50 border border-border text-sm text-muted">
            Total dû :{" "}
            <span className="font-semibold text-foreground">
              {(Number(reinscForm.Montant_Adhesion) || 0) + (Number(reinscForm.Montant_Inscription) || 0)} €
            </span>
          </div>
          <SaveButton accent="familles" />
        </form>
      </SlideOver>

      {/* SlideOver mettre fin à l'inscription */}
      <SlideOver open={finOpen} onClose={() => setFinOpen(false)} title="Mettre fin à l'inscription" width="md">
        <form onSubmit={e => { e.preventDefault(); handleSaveFin() }} className="flex flex-col gap-4">
          {finInsc && (
            <div className="px-3 py-2 rounded-xl bg-slate-50 border border-border text-xs text-muted">
              Inscription {finInsc.Annee_Scolaire || "—"}
            </div>
          )}
          <Field label="Nouveau statut" required>
            <Select value={finForm.Statut} onChange={e => setFinForm(f => ({ ...f, Statut: e.target.value }))}>
              <option value="">— Choisir —</option>
              <option value="Arrêté">Arrêté</option>
              <option value="Suspendu">Suspendu</option>
              <option value="Terminé">Terminé</option>
            </Select>
          </Field>
          <Field label="Remarque" hint="Motif, observations…">
            <Textarea
              value={finForm.Remarques}
              onChange={e => setFinForm(f => ({ ...f, Remarques: e.target.value }))}
            />
          </Field>
          <SaveButton accent="familles" />
        </form>
      </SlideOver>

      {/* SlideOver inscription */}
      <SlideOver open={inscOpen} onClose={() => setInscOpen(false)} title="Modifier l'inscription" width="md">
        <form onSubmit={e => { e.preventDefault(); handleSaveInscription() }} className="flex flex-col gap-4">
          {/* Champs en lecture seule */}
          {inscEditing && (
            <div className="rounded-xl bg-slate-50 border border-border px-4 py-3 flex flex-col gap-2">
              <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-1">Informations non modifiables</p>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted">Statut</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  inscEditing.Statut?.toUpperCase().includes("COURS")  ? "bg-finances-light text-finances-dark"  :
                  inscEditing.Statut?.toUpperCase().includes("SUSPEN") ? "bg-ateliers-light text-ateliers-dark"  :
                  inscEditing.Statut?.toUpperCase().includes("ARRET")  ? "bg-absences-light text-absences-dark"  :
                  "bg-slate-100 text-slate-600"
                }`}>{inscEditing.Statut || "—"}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted">Date d'inscription</span>
                <span className="text-xs font-medium text-foreground">{inscEditing.Date_Inscription || "—"}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted">Bénéficiaire</span>
                <span className="text-xs font-medium text-foreground">{membre.Beneficiaire || "—"}</span>
              </div>
            </div>
          )}
          {/* Champs modifiables */}
          <FormRow>
            <Field label="Année scolaire" hint="ex. 2024-2025">
              <Input value={inscForm.Annee_Scolaire} onChange={e => setInscForm(f => ({ ...f, Annee_Scolaire: e.target.value }))} />
            </Field>
            <Field label="Type d'apprenant">
              <Select value={inscForm.Type_Apprenant} onChange={e => setInscForm(f => ({ ...f, Type_Apprenant: e.target.value }))}>
                <option value="">—</option>
                <ExtraOption value={inscForm.Type_Apprenant} list={TYPES_APPRENANT} />
                <option value="FLE">FLE</option>
                <option value="Soutien scolaire">Soutien scolaire</option>
              </Select>
            </Field>
          </FormRow>
          <Field label="Niveau scolaire">
            <Select value={inscForm.Niveau} onChange={e => setInscForm(f => ({ ...f, Niveau: e.target.value }))}>
              <option value="">—</option>
              <ExtraOption value={inscForm.Niveau} list={NIVEAUX} />
              <option value="CM1">CM1</option>
              <option value="CE2">CE2</option>
              <option value="6eme">6ème</option>
              <option value="5eme">5ème</option>
              <option value="4eme">4ème</option>
              <option value="2nde">2nde</option>
              <option value="Terminale CAP">Terminale CAP</option>
            </Select>
          </Field>
          <Field label="Disponibilités" hint="ex. Lundi matin, Mercredi">
            <Input value={inscForm.Disponibilite} onChange={e => setInscForm(f => ({ ...f, Disponibilite: e.target.value }))} />
          </Field>
          <Field label="Orientation" hint="ex. CAF, CPAM…">
            <Input value={inscForm.Orientation} onChange={e => setInscForm(f => ({ ...f, Orientation: e.target.value }))} />
          </Field>
          <FormRow>
            <Field label="Montant d'adhésion (€)" hint="ex. 0">
              <Input type="number" value={inscForm.Montant_Adhesion} onChange={e => setInscForm(f => ({ ...f, Montant_Adhesion: e.target.value }))} />
            </Field>
            <Field label="Montant d'inscription (€)" hint="ex. 30">
              <Input type="number" value={inscForm.Montant_Inscription} onChange={e => setInscForm(f => ({ ...f, Montant_Inscription: e.target.value }))} />
            </Field>
          </FormRow>
          <div className="px-3 py-2.5 rounded-xl bg-slate-50 border border-border text-sm text-muted">
            Total dû :{" "}
            <span className="font-semibold text-foreground">
              {(Number(inscForm.Montant_Adhesion) || 0) + (Number(inscForm.Montant_Inscription) || 0)} €
            </span>
          </div>
          <SaveButton accent="familles" />
        </form>
      </SlideOver>

      {/* SlideOver modification */}
      <SlideOver
        open={slideOpen}
        onClose={() => setSlideOpen(false)}
        title={`Modifier — ${membre.Prenom}`}
        width="md"
      >
        <form onSubmit={e => { e.preventDefault(); handleSave() }} className="flex flex-col gap-4">
          <Field label="Rôle">
            <Select value={String(form.Role ?? "")} onChange={e => setForm(f => ({ ...f, Role: e.target.value }))}>
              <option value="Adulte">Adulte</option>
              <option value="Enfant">Enfant</option>
            </Select>
          </Field>
          <FormRow>
            <Field label="Prénom" required>
              <Input value={String(form.Prenom ?? "")} onChange={e => setForm(f => ({ ...f, Prenom: e.target.value }))} />
            </Field>
            <Field label="Nom">
              <Input value={String(form.Nom ?? "")} onChange={e => setForm(f => ({ ...f, Nom: e.target.value }))} />
            </Field>
          </FormRow>
          <Field label="Téléphone">
            <Input value={String(form.Telephone ?? "")} onChange={e => setForm(f => ({ ...f, Telephone: e.target.value }))} />
          </Field>
          <Field label="Email">
            <Input type="email" value={String(form.Email ?? "")} onChange={e => setForm(f => ({ ...f, Email: e.target.value }))} />
          </Field>
          <Field label="WhatsApp">
            <Input value={String(form.WhatsApp ?? "")} onChange={e => setForm(f => ({ ...f, WhatsApp: e.target.value }))} />
          </Field>
          <FormRow>
            <Field label="Pays d'origine">
              <Input value={String(form.Pays_Origine ?? "")} onChange={e => setForm(f => ({ ...f, Pays_Origine: e.target.value }))} />
            </Field>
            <Field label="Langue maternelle">
              <Input value={String(form.Langue_Maternelle ?? "")} onChange={e => setForm(f => ({ ...f, Langue_Maternelle: e.target.value }))} />
            </Field>
          </FormRow>
          <Field label="Date de naissance">
            <DateInput value={form.Date_Naissance != null ? String(form.Date_Naissance) : ""} onChange={v => setForm(f => ({ ...f, Date_Naissance: v }))} />
          </Field>
          <FormRow>
            <Field label="Niveau / Classe">
              <Select value={String(form.Niveau ?? "")} onChange={e => setForm(f => ({ ...f, Niveau: e.target.value }))}>
                <option value="">—</option>
                <ExtraOption value={String(form.Niveau ?? "")} list={NIVEAUX} />
                <option value="CM1">CM1</option>
                <option value="CE2">CE2</option>
                <option value="6eme">6ème</option>
                <option value="5eme">5ème</option>
                <option value="4eme">4ème</option>
                <option value="2nde">2nde</option>
                <option value="Terminale CAP">Terminale CAP</option>
              </Select>
            </Field>
            <Field label="Statut">
              <Select value={String(form.Statut_Inscription ?? "")} onChange={e => setForm(f => ({ ...f, Statut_Inscription: e.target.value }))}>
                <option value="">—</option>
                <option value="EN COURS">EN COURS</option>
                <option value="SUSPENDU">SUSPENDU</option>
                <option value="ARRÊTÉ">ARRÊTÉ</option>
              </Select>
            </Field>
          </FormRow>
          <Field label="Date d'inscription">
            <DateInput value={form.Date_Inscription != null ? String(form.Date_Inscription) : ""} onChange={v => setForm(f => ({ ...f, Date_Inscription: v }))} />
          </Field>
          <SaveButton accent="familles" />
          <DeleteButton onClick={handleDelete} />
        </form>
      </SlideOver>
    </div>
  )
}
