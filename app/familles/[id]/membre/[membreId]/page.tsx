"use client"

import { useState, useEffect, useCallback, use } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import SlideOver, { Field, Input, Select, FormRow, SaveButton, DeleteButton } from "@/components/SlideOver"
import JournalSuivi from "@/components/JournalSuivi"
import { ChevronRight, Phone, Mail, Globe, Plus, Pencil, Upload, FileText, ExternalLink, X } from "lucide-react"
import {
  fetchFamilles, fetchMembre, updateMembre, deleteMembre, fetchPaiements,
  addPaiement, updatePaiement, deletePaiement, updateInscription, uploadFichier,
  fetchDocuments, deleteDocument,
  calculerAge, type FamilleSheet, type MembreSheet, type PaiementSheet, type InscriptionSheet, type DocumentJoint
} from "@/lib/sheets-api"

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(",")[1] ?? "")
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// Types de documents (chacun rangé dans son dossier Drive — mapping à venir)
const TYPES_DOCUMENT = [
  "Fiche d'inscription",
  "Droit à l'image",
  "Charte d'engagement",
  "Autorisation de sortie",
]

const niveauStyle: Record<string, string> = {
  "Alpha":  "bg-slate-100 text-slate-600",
  "A1-":    "bg-absences-light text-absences-dark",
  "A1+":    "bg-absences-light text-absences-dark",
  "A2-":    "bg-ateliers-light text-ateliers-dark",
  "A2+/B1": "bg-finances-light text-finances-dark",
}

const statutStyle: Record<string, string> = {
  "EN COURS": "bg-finances-light text-finances-dark",
  "SUSPENDU": "bg-ateliers-light text-ateliers-dark",
  "ARRÊTÉ":   "bg-absences-light text-absences-dark",
  "ARRETE":   "bg-absences-light text-absences-dark",
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
  const [loading, setLoading]   = useState(true)
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
  const [docOpen, setDocOpen]   = useState(false)
  const [docType, setDocType]   = useState("")
  const [docFile, setDocFile]   = useState<File | null>(null)
  const [docSaving, setDocSaving] = useState(false)

  const loadData = useCallback(async () => {
    try {
      const [familles, m, p, docs] = await Promise.all([
        fetchFamilles(),
        fetchMembre(membreId),
        fetchPaiements(membreId),
        fetchDocuments(membreId),
      ])
      setFamille(familles.find(f => f.ID_Famille === id) ?? null)
      setMembre(m)
      setForm(m)
      setPaiements(p)
      setInscriptions(m.inscriptions ?? [])
      setDocuments(docs)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [id, membreId])

  useEffect(() => { loadData() }, [loadData])

  if (loading) return (
    <div className="p-6 flex items-center justify-center min-h-[300px]">
      <p className="text-muted text-sm">Chargement…</p>
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
    } catch (e) { console.error("Upload du document échoué", e) }
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
  const age = membre.Date_Naissance ? calculerAge(String(membre.Date_Naissance)) : null

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
      <div className="bg-surface border border-border rounded-xl p-5 grid grid-cols-1 sm:grid-cols-2 gap-5 mb-6">

        {(membre.Telephone || membre.WhatsApp) && (
          <div className="flex items-start gap-2">
            <Phone size={15} className="text-muted mt-0.5 shrink-0" />
            <div className="space-y-2">
              <InfoRow label="Téléphone" value={String(membre.Telephone || "")} />
              {membre.WhatsApp && membre.WhatsApp !== membre.Telephone && (
                <InfoRow label="WhatsApp" value={String(membre.WhatsApp)} />
              )}
            </div>
          </div>
        )}

        {membre.Email && (
          <div className="flex items-start gap-2">
            <Mail size={15} className="text-muted mt-0.5 shrink-0" />
            <InfoRow label="Email" value={String(membre.Email)} />
          </div>
        )}

        {(membre.Pays_Origine || membre.Langue_Maternelle) && (
          <div className="flex items-start gap-2">
            <Globe size={15} className="text-muted mt-0.5 shrink-0" />
            <div className="space-y-2">
              <InfoRow label="Pays d'origine" value={String(membre.Pays_Origine || "")} />
              <InfoRow label="Langue maternelle" value={String(membre.Langue_Maternelle || "")} />
            </div>
          </div>
        )}

        <div className="space-y-2">
          <InfoRow label="Genre" value={String(membre.Genre || "")} />
          <InfoRow label="Date de naissance" value={String(membre.Date_Naissance || "")} />
          {age !== null && <InfoRow label="Âge" value={`${age} ans`} />}
          <InfoRow label="Nb. enfants accompagnants" value={membre.Nb_Enfants ? String(membre.Nb_Enfants) : null} />
        </div>

        <div className="space-y-2">
          <InfoRow label="Source d'orientation" value={String(membre.Source_Orientation || "")} />
        </div>
      </div>

      {/* Documents */}
      <div className="bg-surface border border-border rounded-xl p-5 mb-6">
        <h2 className="text-sm font-semibold text-foreground mb-3">
          Documents
          {documents.length > 0 && <span className="ml-2 text-xs font-normal text-muted">({documents.length})</span>}
        </h2>
        {documents.length === 0 ? (
          <p className="text-sm text-muted italic">Aucun document. Cliquez sur « Ajouter un document » en haut pour en ajouter.</p>
        ) : (
          <ul className="space-y-2">
            {documents.map(doc => (
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
      </div>

      {/* Journal : commentaires + appels + emails */}
      <JournalSuivi notes={membre.Notes} onSave={handleSaveNotes} />

      {/* Inscriptions */}
      <div className="bg-surface border border-border rounded-xl p-5 mb-6">
        <h2 className="text-sm font-semibold text-foreground mb-3">
          Inscriptions
          {inscriptions.length > 0 && <span className="ml-2 text-xs font-normal text-muted">({inscriptions.length})</span>}
        </h2>
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
              <Input placeholder="JJ/MM/AAAA" value={String(payForm.Date_Paiement ?? "")} onChange={e => setPayForm(f => ({ ...f, Date_Paiement: e.target.value }))} />
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
          <SaveButton />
          {payEditing && <DeleteButton onClick={handleDeletePaiement} />}
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
                <span className="text-xs font-medium text-foreground">{inscEditing.Beneficiaire || "—"}</span>
              </div>
            </div>
          )}
          {/* Champs modifiables */}
          <FormRow>
            <Field label="Année scolaire">
              <Input value={inscForm.Annee_Scolaire} onChange={e => setInscForm(f => ({ ...f, Annee_Scolaire: e.target.value }))} placeholder="2024-2025" />
            </Field>
            <Field label="Type d'apprenant">
              <Select value={inscForm.Type_Apprenant} onChange={e => setInscForm(f => ({ ...f, Type_Apprenant: e.target.value }))}>
                <option value="">—</option>
                <option value="Adulte">Adulte</option>
                <option value="Enfant">Enfant</option>
              </Select>
            </Field>
          </FormRow>
          <Field label="Niveau">
            <Select value={inscForm.Niveau} onChange={e => setInscForm(f => ({ ...f, Niveau: e.target.value }))}>
              <option value="">—</option>
              <option value="Alpha">Alpha</option>
              <option value="A1-">A1-</option>
              <option value="A1+">A1+</option>
              <option value="A2-">A2-</option>
              <option value="A2+/B1">A2+/B1</option>
            </Select>
          </Field>
          <Field label="Disponibilités">
            <Input value={inscForm.Disponibilite} onChange={e => setInscForm(f => ({ ...f, Disponibilite: e.target.value }))} placeholder="ex. Lundi matin, Mercredi" />
          </Field>
          <Field label="Orientation">
            <Input value={inscForm.Orientation} onChange={e => setInscForm(f => ({ ...f, Orientation: e.target.value }))} placeholder="ex. CAF, CPAM…" />
          </Field>
          <FormRow>
            <Field label="Montant d'adhésion (€)">
              <Input type="number" value={inscForm.Montant_Adhesion} onChange={e => setInscForm(f => ({ ...f, Montant_Adhesion: e.target.value }))} placeholder="0" />
            </Field>
            <Field label="Montant d'inscription (€)">
              <Input type="number" value={inscForm.Montant_Inscription} onChange={e => setInscForm(f => ({ ...f, Montant_Inscription: e.target.value }))} placeholder="30" />
            </Field>
          </FormRow>
          <div className="px-3 py-2.5 rounded-xl bg-slate-50 border border-border text-sm text-muted">
            Total dû :{" "}
            <span className="font-semibold text-foreground">
              {(Number(inscForm.Montant_Adhesion) || 0) + (Number(inscForm.Montant_Inscription) || 0)} €
            </span>
          </div>
          <SaveButton />
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
            <Input placeholder="JJ/MM/AAAA" value={String(form.Date_Naissance ?? "")} onChange={e => setForm(f => ({ ...f, Date_Naissance: e.target.value }))} />
          </Field>
          <FormRow>
            <Field label="Niveau">
              <Select value={String(form.Niveau ?? "")} onChange={e => setForm(f => ({ ...f, Niveau: e.target.value }))}>
                <option value="">—</option>
                <option value="Alpha">Alpha</option>
                <option value="A1-">A1-</option>
                <option value="A1+">A1+</option>
                <option value="A2-">A2-</option>
                <option value="A2+/B1">A2+/B1</option>
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
          <SaveButton />
          <DeleteButton onClick={handleDelete} />
        </form>
      </SlideOver>
    </div>
  )
}
