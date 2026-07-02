"use client"

import { useState, useEffect, useCallback, use } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import SlideOver, { Field, Input, Select, Textarea, FormRow, SaveButton, DeleteButton } from "@/components/SlideOver"
import JournalSuivi from "@/components/JournalSuivi"
import AdresseAutocomplete from "@/components/AdresseAutocomplete"
import DateInput from "@/components/DateInput"
import { ChevronRight, Pencil, Plus, Upload, RotateCcw } from "lucide-react"
import {
  fetchFamilles, fetchMembres, updateFamille, addMembre, deleteMembre, uploadFichier,
  getCurrentAnneeScolaire, getAnneeScolaireOptions,
  type FamilleSheet, type MembreSheet
} from "@/lib/sheets-api"

function parseDateOcr(s?: string): string {
  if (!s) return ""
  const parts = s.split("/")
  if (parts.length !== 3) return ""
  const [d, m, y] = parts
  return `${y}-${m?.padStart(2, "0")}-${d?.padStart(2, "0")}`
}

function normaliserTelephone(tel?: string): string {
  if (!tel) return ""
  // Supprimer tout sauf les chiffres
  const digits = tel.replace(/\D/g, "")
  // Numéro français sans indicatif : s'assurer qu'il commence par 0
  if (digits.length === 9 && !digits.startsWith("0")) return "0" + digits
  if (digits.length === 10) return digits
  // Indicatif +33 → remplacer par 0
  if (digits.startsWith("33") && digits.length === 11) return "0" + digits.slice(2)
  return digits
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(",")[1] ?? "")
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

const niveauStyle: Record<string, string> = {
  "Alpha":   "bg-slate-100 text-slate-600",
  "A1-":     "bg-absences-light text-absences-dark",
  "A1+":     "bg-absences-light text-absences-dark",
  "A2-":     "bg-ateliers-light text-ateliers-dark",
  "A2+/B1":  "bg-finances-light text-finances-dark",
}

const statutStyle: Record<string, string> = {
  "EN COURS": "bg-finances-light text-finances-dark",
  "SUSPENDU": "bg-ateliers-light text-ateliers-dark",
  "ARRÊTÉ":   "bg-absences-light text-absences-dark",
  "ARRETE":   "bg-absences-light text-absences-dark",
}

const emptyMembre = (idFamille: string): Partial<MembreSheet> => ({
  ID_Famille: idFamille,
  Nom: "", Prenom: "", Role: "Adulte",
  Genre: "", Telephone: "", Email: "",
  Langue_Maternelle: "", Pays_Origine: "",
  Beneficiaire: "Non",
  Annee_Scolaire: getCurrentAnneeScolaire(), Niveau: "", Disponibilite: "", Source_Orientation: "",
  Montant_Adhesion: "", Montant_Inscription: "30", Remarques: "",
})

export default function FicheFamillePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()

  const [familles, setFamilles]   = useState<FamilleSheet[]>([])
  const [membres, setMembres]     = useState<MembreSheet[]>([])
  const [loading, setLoading]     = useState(true)
  const [slideOpen, setSlideOpen] = useState(false)
  const [slideMode, setSlideMode] = useState<"edit" | "add">("edit")
  const [familleForm, setFamilleForm] = useState<Partial<FamilleSheet>>({})
  const [membreForm, setMembreForm]   = useState<Partial<MembreSheet>>(emptyMembre(id))
  const [membreFichier, setMembreFichier] = useState<File | null>(null)
  const [ocrLoading, setOcrLoading]       = useState(false)
  const [ocrDone, setOcrDone]             = useState(false)
  const [saving, setSaving]               = useState(false)

  const loadData = useCallback(async () => {
    try {
      const [f, m] = await Promise.all([fetchFamilles(), fetchMembres(id)])
      setFamilles(f)
      setMembres(m)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [id])

  useEffect(() => { loadData() }, [loadData])

  const famille = familles.find(f => f.ID_Famille === id)

  if (loading) return (
    <div className="p-6 flex items-center justify-center min-h-[300px]">
      <p className="text-muted text-sm">Chargement…</p>
    </div>
  )

  if (!famille) return (
    <div className="p-6">
      <p className="text-muted">Famille introuvable.</p>
      <Link href="/familles" className="text-familles-dark underline text-sm mt-2 inline-block">← Retour</Link>
    </div>
  )

  async function handleSaveFamille() {
    await updateFamille(id, familleForm)
    await loadData()
    setSlideOpen(false)
  }

  async function handleOcr(file: File) {
    setOcrLoading(true)
    setOcrDone(false)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const res = await fetch("/api/ocr", { method: "POST", body: formData })
      if (!res.ok) { console.error("[ocr] erreur", await res.text()); return }
      const data = await res.json()
      setMembreForm(f => ({
        ...f,
        Nom:            String(data.nom     ?? f.Nom     ?? ""),
        Prenom:         String(data.prenom  ?? f.Prenom  ?? ""),
        Telephone:      normaliserTelephone(data.telephones?.[0]) || f.Telephone || "",
        Date_Naissance: parseDateOcr(data.date_naissance) || (f.Date_Naissance ?? ""),
      }))
      setOcrDone(true)
    } catch (e) { console.error("[ocr]", e) }
    finally { setOcrLoading(false) }
  }

  async function handleAddMembre() {
    if (saving) return
    setSaving(true)
    const result = await addMembre(membreForm)
    if (result?.ID_Membre) {
      if (membreFichier) {
        try {
          const b64 = await fileToBase64(membreFichier)
          await uploadFichier({
            idMembre:   result.ID_Membre,
            categorie:  "Fiche d'inscription",
            nom:        membreFichier.name,
            mimeType:   membreFichier.type || "application/pdf",
            dataBase64: b64,
          })
        } catch (e) { console.error("[upload doc]", e) }
      }
    }
    await loadData()
    setMembreForm(emptyMembre(id))
    setMembreFichier(null)
    setOcrDone(false)
    setSaving(false)
    setSlideOpen(false)
  }

  async function handleDeleteMembre(idMembre: string) {
    await deleteMembre(idMembre)
    await loadData()
  }

  async function handleSaveNotes(json: string) {
    await updateFamille(id, { Notes: json })
    await loadData()
  }

  const quartier = String(famille.Quartier_QVP ?? "").trim()

  // Dérivé des membres (pas d'appel API supplémentaire)
  const contactPrincipal = membres.find(m => String(m.Contact_Principal ?? "").toLowerCase() === "oui") ?? null
  const nbAdultes = membres.filter(m => m.Role === "Adulte").length
  const nbEnfants = membres.filter(m => m.Role === "Enfant").length
  const composition = [
    nbAdultes ? `${nbAdultes} adulte${nbAdultes > 1 ? "s" : ""}` : "",
    nbEnfants ? `${nbEnfants} enfant${nbEnfants > 1 ? "s" : ""}` : "",
  ].filter(Boolean).join(" · ")

  const champsFamille: { label: string; value: string }[] = [
    { label: "Adresse", value: String(famille.Adresse_Complete || famille.Adresse || "") },
    { label: "Quartier QVP", value: quartier || "Hors QVP" },
    { label: "Composition", value: composition },
    { label: "Nombre de membres", value: String(membres.length) },
  ].filter(c => c.value !== "")

  return (
    <div className="p-6 max-w-4xl mx-auto">

      {/* Fil d'Ariane */}
      <nav className="flex items-center gap-1.5 text-sm text-muted mb-5">
        <Link href="/familles" className="hover:text-familles-dark transition-colors">Familles</Link>
        <ChevronRight size={14} />
        <span className="text-foreground font-medium">{famille.Nom_Famille}</span>
      </nav>

      {/* En-tête */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-familles-dark">{famille.Nom_Famille}</h1>
        </div>
        <button
          onClick={() => { setFamilleForm({ Nom_Famille: famille.Nom_Famille, Adresse: famille.Adresse, Code_Postal: famille.Code_Postal, Ville: famille.Ville, Quartier_QVP: famille.Quartier_QVP }); setSlideMode("edit"); setSlideOpen(true) }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-familles-light text-familles-dark text-sm font-medium hover:bg-familles hover:text-white transition-colors"
        >
          <Pencil size={14} />
          Modifier
        </button>
      </div>

      {/* Infos famille */}
      <div className="bg-surface border border-border rounded-xl p-5 mb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
          {champsFamille.map(c => (
            <div key={c.label}>
              <p className="text-xs text-muted mb-0.5">{c.label}</p>
              <p className="text-sm font-medium text-foreground">{c.value}</p>
            </div>
          ))}
        </div>

        {contactPrincipal && (
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-xs text-muted mb-0.5">Contact principal</p>
            <Link
              href={`/familles/${id}/membre/${contactPrincipal.ID_Membre}`}
              className="text-sm font-medium text-familles-dark hover:underline"
            >
              {contactPrincipal.Prenom} {contactPrincipal.Nom}
            </Link>
          </div>
        )}
      </div>

      {/* Section Membres */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-foreground">
          Membres
          <span className="ml-2 text-xs font-normal text-muted">({membres.length})</span>
        </h2>
        <button
          onClick={() => { setMembreForm(emptyMembre(id)); setMembreFichier(null); setOcrDone(false); setSlideMode("add"); setSlideOpen(true) }}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-familles text-white text-sm font-medium hover:bg-familles-dark transition-colors"
        >
          <Plus size={14} />
          Ajouter un membre
        </button>
      </div>

      {membres.length === 0 && (
        <p className="text-sm text-muted italic text-center py-8">Aucun membre enregistré.</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {membres.map(m => {
          const statut = m.Statut_Inscription?.toString().toUpperCase() ?? ""
          return (
            <Link
              key={m.ID_Membre}
              href={`/familles/${id}/membre/${m.ID_Membre}`}
              className="bg-surface border border-border rounded-lg p-4 hover:border-familles/40 hover:shadow-sm transition-all block"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-foreground">{m.Prenom}</p>
                  <p className="text-xs text-muted mt-0.5">{m.Role} {m.Pays_Origine ? `· ${m.Pays_Origine}` : ""}</p>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-familles-light text-familles-dark">
                  {m.Role}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                {m.Niveau && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${niveauStyle[m.Niveau] ?? "bg-slate-100 text-slate-600"}`}>
                    {m.Niveau}
                  </span>
                )}
                {statut && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statutStyle[statut] ?? "bg-slate-100 text-slate-600"}`}>
                    {statut}
                  </span>
                )}
              </div>
            </Link>
          )
        })}
      </div>

      {/* Journal de suivi de la famille */}
      <div className="mt-8">
        <JournalSuivi notes={famille.Notes} onSave={handleSaveNotes} allowCall={false} allowEmail={false} />
      </div>

      {/* SlideOver — modifier famille */}
      <SlideOver open={slideOpen && slideMode === "edit"} onClose={() => setSlideOpen(false)} title="Modifier la famille" width="md">
        <form onSubmit={e => { e.preventDefault(); handleSaveFamille() }} className="flex flex-col gap-4">
          <Field label="Nom de famille" required>
            <Input value={String(familleForm.Nom_Famille ?? "")} onChange={e => setFamilleForm(f => ({ ...f, Nom_Famille: e.target.value }))} />
          </Field>
          <Field label="Adresse (rue)">
            <AdresseAutocomplete
              value={String(familleForm.Adresse ?? "")}
              onChange={v => setFamilleForm(f => ({ ...f, Adresse: v }))}
              onSelect={a => setFamilleForm(f => ({ ...f, Adresse: a.adresse, Code_Postal: a.codePostal, Ville: a.ville }))}
            />
          </Field>
          <FormRow>
            <Field label="Code postal">
              <Input value={String(familleForm.Code_Postal ?? "")} onChange={e => setFamilleForm(f => ({ ...f, Code_Postal: e.target.value }))} />
            </Field>
            <Field label="Ville">
              <Input value={String(familleForm.Ville ?? "")} onChange={e => setFamilleForm(f => ({ ...f, Ville: e.target.value }))} />
            </Field>
          </FormRow>
          <Field label="Quartier QVP">
            <Input value={String(familleForm.Quartier_QVP ?? "")} onChange={e => setFamilleForm(f => ({ ...f, Quartier_QVP: e.target.value }))} placeholder="ex. Bellevue Nantes" />
          </Field>
          <SaveButton />
          <DeleteButton onClick={() => router.push("/familles")} />
        </form>
      </SlideOver>

      {/* SlideOver — ajouter membre */}
      <SlideOver open={slideOpen && slideMode === "add"} onClose={() => setSlideOpen(false)} title="Ajouter un membre" width="md">
        <form onSubmit={e => { e.preventDefault(); handleAddMembre() }} className="flex flex-col gap-4">
          {/* ── Infos personne ── */}
          <Field label="Catégorie" required>
            <Select value={String(membreForm.Role ?? "Adulte")} onChange={e => setMembreForm(f => ({ ...f, Role: e.target.value }))}>
              <option value="Adulte">Adulte</option>
              <option value="Enfant">Enfant</option>
            </Select>
          </Field>
          <FormRow>
            <Field label="Nom">
              <Input value={String(membreForm.Nom ?? "")} onChange={e => setMembreForm(f => ({ ...f, Nom: e.target.value }))} />
            </Field>
            <Field label="Prénom" required>
              <Input value={String(membreForm.Prenom ?? "")} onChange={e => setMembreForm(f => ({ ...f, Prenom: e.target.value }))} />
            </Field>
          </FormRow>
          <FormRow>
            <Field label="Genre">
              <Select value={String(membreForm.Genre ?? "")} onChange={e => setMembreForm(f => ({ ...f, Genre: e.target.value }))}>
                <option value="">— Choisir —</option>
                <option value="H">H</option>
                <option value="F">F</option>
                <option value="N/A">N/A</option>
              </Select>
            </Field>
            <Field label="Date de naissance">
              <DateInput value={membreForm.Date_Naissance} onChange={v => setMembreForm(f => ({ ...f, Date_Naissance: v }))} />
            </Field>
          </FormRow>
          <FormRow>
            <Field label="Téléphone">
              <Input value={String(membreForm.Telephone ?? "")} onChange={e => setMembreForm(f => ({ ...f, Telephone: e.target.value }))} />
            </Field>
            <Field label="Email">
              <Input type="email" value={String(membreForm.Email ?? "")} onChange={e => setMembreForm(f => ({ ...f, Email: e.target.value }))} />
            </Field>
          </FormRow>
          <FormRow>
            <Field label="Pays d'origine">
              <Input value={String(membreForm.Pays_Origine ?? "")} onChange={e => setMembreForm(f => ({ ...f, Pays_Origine: e.target.value }))} />
            </Field>
            <Field label="Langue maternelle">
              <Input value={String(membreForm.Langue_Maternelle ?? "")} onChange={e => setMembreForm(f => ({ ...f, Langue_Maternelle: e.target.value }))} />
            </Field>
          </FormRow>

          {/* ── Bénéficiaire → inscription ── */}
          <Field label="Bénéficiaire" required>
            <Select value={String(membreForm.Beneficiaire ?? "Non")} onChange={e => setMembreForm(f => ({ ...f, Beneficiaire: e.target.value }))}>
              <option value="Non">Non</option>
              <option value="Oui">Oui</option>
            </Select>
          </Field>

          {membreForm.Beneficiaire === "Oui" && (
            <div className="flex flex-col gap-4 border-l-2 border-familles/30 pl-4">
              <p className="text-xs font-semibold text-familles-dark uppercase tracking-wide">Inscription</p>
              <FormRow>
                <Field label="Année scolaire">
                  <Select value={String(membreForm.Annee_Scolaire ?? "")} onChange={e => setMembreForm(f => ({ ...f, Annee_Scolaire: e.target.value }))}>
                    {getAnneeScolaireOptions().map(y => <option key={y} value={y}>{y}</option>)}
                  </Select>
                </Field>
                <Field label="Type d'apprenant">
                  <Input value={membreForm.Role === "Enfant" ? "Soutien scolaire" : "FLE"} readOnly className="bg-slate-50 text-muted" />
                </Field>
              </FormRow>
              {membreForm.Role === "Enfant" && (
                <Field label="Niveau scolaire">
                  <Input value={String(membreForm.Niveau ?? "")} onChange={e => setMembreForm(f => ({ ...f, Niveau: e.target.value }))} placeholder="ex. CE2, 5ᵉ…" />
                </Field>
              )}
              <FormRow>
                <Field label="Disponibilité">
                  <Input value={String(membreForm.Disponibilite ?? "")} onChange={e => setMembreForm(f => ({ ...f, Disponibilite: e.target.value }))} />
                </Field>
                <Field label="Orientation">
                  <Input value={String(membreForm.Source_Orientation ?? "")} onChange={e => setMembreForm(f => ({ ...f, Source_Orientation: e.target.value }))} />
                </Field>
              </FormRow>
              <FormRow>
                <Field label="Montant d'adhésion (€)">
                  <Input type="number" value={String(membreForm.Montant_Adhesion ?? "")} onChange={e => setMembreForm(f => ({ ...f, Montant_Adhesion: e.target.value }))} />
                </Field>
                <Field label="Montant d'inscription (€)">
                  <Input type="number" value={String(membreForm.Montant_Inscription ?? "")} onChange={e => setMembreForm(f => ({ ...f, Montant_Inscription: e.target.value }))} />
                </Field>
              </FormRow>
              <Field label="Remarques">
                <Textarea value={String(membreForm.Remarques ?? "")} onChange={e => setMembreForm(f => ({ ...f, Remarques: e.target.value }))} />
              </Field>
              <p className="text-xs text-muted">
                Le statut « En cours » et la date d'inscription (aujourd'hui) sont enregistrés automatiquement.
              </p>
            </div>
          )}
          <Field label="Bulletin d'inscription (PDF)">
            <label className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-border bg-surface text-sm text-muted cursor-pointer hover:border-familles transition-colors w-fit">
              <Upload size={15} />
              Choisir un fichier
              <input
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0] ?? null
                  setMembreFichier(file)
                  setOcrDone(false)
                  if (file) handleOcr(file)
                }}
              />
            </label>
            {ocrLoading && (
              <p className="flex items-center gap-1.5 text-xs text-muted mt-1.5">
                <RotateCcw size={12} className="animate-spin" />
                Analyse du bulletin en cours…
              </p>
            )}
            {!ocrLoading && ocrDone && (
              <p className="text-xs text-finances-dark mt-1.5">Champs pré-remplis ✓</p>
            )}
            {!ocrLoading && !ocrDone && membreFichier && (
              <p className="text-xs text-muted mt-1.5">{membreFichier.name}</p>
            )}
          </Field>
          <SaveButton label={saving ? "Enregistrement…" : "Enregistrer"} />
        </form>
      </SlideOver>
    </div>
  )
}
