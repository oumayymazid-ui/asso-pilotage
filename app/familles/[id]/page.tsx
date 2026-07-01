"use client"

import { useState, useEffect, useCallback, use } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import SlideOver, { Field, Input, Select, FormRow, SaveButton, DeleteButton } from "@/components/SlideOver"
import JournalSuivi from "@/components/JournalSuivi"
import AdresseAutocomplete from "@/components/AdresseAutocomplete"
import { ChevronRight, Pencil, Plus } from "lucide-react"
import {
  fetchFamilles, fetchMembres, updateFamille, addMembre, deleteMembre,
  type FamilleSheet, type MembreSheet
} from "@/lib/sheets-api"

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
  Genre: "", Telephone: "", Email: "", WhatsApp: "",
  Langue_Maternelle: "", Pays_Origine: "",
  Niveau: "", Statut_Inscription: "", Notes: "",
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

  async function handleAddMembre() {
    await addMembre(membreForm)
    await loadData()
    setMembreForm(emptyMembre(id))
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
            <p className="text-sm font-medium text-foreground">{contactPrincipal.Prenom} {contactPrincipal.Nom}</p>
            <p className="text-xs text-muted mt-0.5">
              {[contactPrincipal.Telephone, contactPrincipal.Email].filter(Boolean).join("  ·  ") || "Aucune coordonnée"}
            </p>
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
          onClick={() => { setMembreForm(emptyMembre(id)); setSlideMode("add"); setSlideOpen(true) }}
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
          <Field label="Rôle" required>
            <Select value={String(membreForm.Role ?? "Adulte")} onChange={e => setMembreForm(f => ({ ...f, Role: e.target.value }))}>
              <option value="Adulte">Adulte</option>
              <option value="Enfant">Enfant</option>
            </Select>
          </Field>
          <Field label="Prénom" required>
            <Input value={String(membreForm.Prenom ?? "")} onChange={e => setMembreForm(f => ({ ...f, Prenom: e.target.value }))} />
          </Field>
          <Field label="Nom">
            <Input value={String(membreForm.Nom ?? "")} onChange={e => setMembreForm(f => ({ ...f, Nom: e.target.value }))} />
          </Field>
          <Field label="Téléphone">
            <Input value={String(membreForm.Telephone ?? "")} onChange={e => setMembreForm(f => ({ ...f, Telephone: e.target.value }))} />
          </Field>
          <Field label="Email">
            <Input type="email" value={String(membreForm.Email ?? "")} onChange={e => setMembreForm(f => ({ ...f, Email: e.target.value }))} />
          </Field>
          <Field label="Pays d'origine">
            <Input value={String(membreForm.Pays_Origine ?? "")} onChange={e => setMembreForm(f => ({ ...f, Pays_Origine: e.target.value }))} />
          </Field>
          <Field label="Langue maternelle">
            <Input value={String(membreForm.Langue_Maternelle ?? "")} onChange={e => setMembreForm(f => ({ ...f, Langue_Maternelle: e.target.value }))} />
          </Field>
          <Field label="Niveau">
            <Select value={String(membreForm.Niveau ?? "")} onChange={e => setMembreForm(f => ({ ...f, Niveau: e.target.value }))}>
              <option value="">— Choisir —</option>
              <option value="Alpha">Alpha</option>
              <option value="A1-">A1-</option>
              <option value="A1+">A1+</option>
              <option value="A2-">A2-</option>
              <option value="A2+/B1">A2+/B1</option>
            </Select>
          </Field>
          <Field label="Statut">
            <Select value={String(membreForm.Statut_Inscription ?? "")} onChange={e => setMembreForm(f => ({ ...f, Statut_Inscription: e.target.value }))}>
              <option value="">— Choisir —</option>
              <option value="EN COURS">EN COURS</option>
              <option value="SUSPENDU">SUSPENDU</option>
              <option value="ARRÊTÉ">ARRÊTÉ</option>
            </Select>
          </Field>
          <SaveButton />
        </form>
      </SlideOver>
    </div>
  )
}
