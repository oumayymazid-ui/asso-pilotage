"use client"

import { useState, useEffect, useCallback, use } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import SlideOver, { Field, Input, Select, FormRow, SaveButton, DeleteButton } from "@/components/SlideOver"
import JournalSuivi from "@/components/JournalSuivi"
import DateInput from "@/components/DateInput"
import { ChevronRight, Plus, Pencil, Upload, FileText, ExternalLink, X } from "lucide-react"
import {
  fetchFamilles, fetchMembre, updateMembre, deleteMembre, fetchPaiements,
  addPaiement, updatePaiement, deletePaiement, updateInscription, uploadFichier,
  fetchDocuments, deleteDocument,
  type FamilleSheet, type MembreSheet, type PaiementSheet, type InscriptionSheet, type DocumentJoint
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
  const [editAttenduId, setEditAttenduId] = useState<string | null>(null)
  const [attenduDraft, setAttenduDraft] = useState("")
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

  function openNewPaiement(idInscription?: string) {
    setPayEditing(false)
    setPayForm({ ID_Inscription: idInscription ?? inscriptions[0]?.ID_Inscription ?? "", Date_Paiement: "", Montant: "", Mode_Paiement: "" })
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

  async function handleSaveAttendu(idInscription: string) {
    await updateInscription(idInscription, { Montant_Du: attenduDraft })
    await loadData()
    setEditAttenduId(null)
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
    { label: "Droit à l'image", value: membre.Droit_Image ? String(membre.Droit_Image) : "" },
    { label: "Charte d'engagement", value: membre.Charte ? String(membre.Charte) : "" },
  ].filter(c => c.value !== "")

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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
          {champsInfos.map(c => (
            <InfoRow key={c.label} label={c.label} value={c.value} />
          ))}
        </div>
      </div>

      {/* Documents — affiché uniquement s'il y en a */}
      {documents.length > 0 && (
        <div className="bg-surface border border-border rounded-xl p-5 mb-6">
          <h2 className="text-sm font-semibold text-foreground mb-3">
            Documents
            <span className="ml-2 text-xs font-normal text-muted">({documents.length})</span>
          </h2>
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
        </div>
      )}

      {/* Journal : commentaires + appels + emails */}
      <JournalSuivi notes={membre.Notes} onSave={handleSaveNotes} />

      {/* Paiements — une carte par année d'inscription, avec ses paiements */}
      <div className="bg-surface border border-border rounded-xl p-5 mb-6">
        <h2 className="text-sm font-semibold text-foreground mb-4">Paiements</h2>

        {inscriptions.length === 0 ? (
          <p className="text-sm text-muted italic">Aucune inscription : impossible d'ajouter un paiement.</p>
        ) : (
          <div className="space-y-3">
            {inscriptions.map(insc => {
              const paiementsInsc = paiements.filter(p => p.ID_Inscription === insc.ID_Inscription)
              const paye = paiementsInsc.reduce((s, p) => s + (Number(p.Montant) || 0), 0)
              const attenduDefini = insc.Montant_Du !== undefined && insc.Montant_Du !== "" && insc.Montant_Du !== null
              const attendu = Number(insc.Montant_Du) || 0
              const reste = attendu - paye
              const enEdition = editAttenduId === insc.ID_Inscription
              return (
                <div key={insc.ID_Inscription} className="rounded-lg border border-border p-4">
                  {/* En-tête : année + statut reste dû */}
                  <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
                    <p className="text-sm font-semibold text-foreground">{insc.Annee_Scolaire || "Inscription"}</p>
                    {attenduDefini && (
                      reste > 0
                        ? <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-absences-light text-absences-dark">Reste dû {reste} €</span>
                        : <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-finances-light text-finances-dark">Soldé</span>
                    )}
                  </div>

                  {/* Montant attendu (modifiable) */}
                  <div className="flex items-center gap-1.5 text-xs text-muted mb-3">
                    {enEdition ? (
                      <>
                        <span>Attendu</span>
                        <input type="number" autoFocus value={attenduDraft}
                          onChange={e => setAttenduDraft(e.target.value)}
                          className="w-20 px-2 py-1 rounded-lg border border-border text-sm" />
                        <button onClick={() => handleSaveAttendu(insc.ID_Inscription)} className="text-familles-dark font-medium hover:underline">OK</button>
                        <button onClick={() => setEditAttenduId(null)} className="text-muted hover:underline">Annuler</button>
                      </>
                    ) : (
                      <>
                        <span>Attendu <span className="font-medium text-foreground">{attenduDefini ? `${attendu} €` : "non défini"}</span></span>
                        <button onClick={() => { setEditAttenduId(insc.ID_Inscription); setAttenduDraft(attenduDefini ? String(attendu) : "") }}
                          aria-label="Modifier le montant attendu" title="Modifier le montant attendu"
                          className="text-familles-dark"><Pencil size={12} /></button>
                      </>
                    )}
                  </div>

                  {/* Paiements de cette année */}
                  {paiementsInsc.length > 0 ? (
                    <ul className="space-y-2 mb-3">
                      {paiementsInsc.map(p => (
                        <li key={p.ID_Paiement} className="flex items-center justify-between gap-3 bg-slate-50 rounded-lg px-3 py-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-sm font-bold text-familles-dark shrink-0">{p.Montant ? `${p.Montant} €` : "—"}</span>
                            {p.Mode_Paiement && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-familles-light text-familles-dark">{p.Mode_Paiement}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-sm text-foreground">{p.Date_Paiement ? dateFrLisible(String(p.Date_Paiement)) : "—"}</span>
                            <button onClick={() => openEditPaiement(p)} aria-label="Modifier ce paiement" title="Modifier ou supprimer"
                              className="p-1.5 rounded-lg text-muted hover:text-familles-dark hover:bg-familles-light transition-colors">
                              <Pencil size={14} />
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-muted italic mb-3">Aucun paiement enregistré.</p>
                  )}

                  <button onClick={() => openNewPaiement(insc.ID_Inscription)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-familles text-white text-xs font-medium hover:bg-familles-dark transition-colors">
                    <Plus size={13} />Ajouter un paiement
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* SlideOver paiement */}
      <SlideOver open={payOpen} onClose={() => setPayOpen(false)} title={payEditing ? "Modifier le paiement" : "Ajouter un paiement"} width="md">
        <form onSubmit={e => { e.preventDefault(); handleSavePaiement() }} className="flex flex-col gap-4">
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
          <SaveButton />
          {payEditing && <DeleteButton onClick={handleDeletePaiement} />}
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
          <Field label="Date d'inscription">
            <DateInput value={form.Date_Inscription != null ? String(form.Date_Inscription) : ""} onChange={v => setForm(f => ({ ...f, Date_Inscription: v }))} />
          </Field>
          <SaveButton />
          <DeleteButton onClick={handleDelete} />
        </form>
      </SlideOver>
    </div>
  )
}
