"use client"

import { useState, useEffect, useCallback, use } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import SlideOver, { Field, Input, Select, FormRow, SaveButton, DeleteButton } from "@/components/SlideOver"
import JournalSuivi from "@/components/JournalSuivi"
import { ChevronRight, Phone, Mail, Globe } from "lucide-react"
import {
  fetchFamilles, fetchMembre, updateMembre, deleteMembre, fetchPaiements,
  calculerAge, type FamilleSheet, type MembreSheet, type PaiementSheet
} from "@/lib/sheets-api"

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
  const [loading, setLoading]   = useState(true)
  const [slideOpen, setSlideOpen] = useState(false)
  const [form, setForm]         = useState<Partial<MembreSheet>>({})

  const loadData = useCallback(async () => {
    try {
      const [familles, m, p] = await Promise.all([
        fetchFamilles(),
        fetchMembre(membreId),
        fetchPaiements(membreId),
      ])
      setFamille(familles.find(f => f.ID_Famille === id) ?? null)
      setMembre(m)
      setForm(m)
      setPaiements(p)
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
        <button
          onClick={() => { setForm({ ...membre }); setSlideOpen(true) }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-familles-light text-familles-dark text-sm font-medium hover:bg-familles hover:text-white transition-colors shrink-0"
        >
          Modifier
        </button>
      </div>

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

      {/* Journal : commentaires + appels + emails */}
      <JournalSuivi notes={membre.Notes} onSave={handleSaveNotes} />

      {/* Paiements */}
      {paiements.length > 0 && (
        <div className="bg-surface border border-border rounded-xl p-5 mb-6">
          <h2 className="text-sm font-semibold text-foreground mb-4">
            Paiements
            <span className="ml-2 text-xs font-normal text-muted">({paiements.length})</span>
          </h2>
          <div className="space-y-2">
            {paiements.map(p => (
              <div key={p.ID_Paiement} className="flex items-center justify-between gap-3 bg-slate-50 rounded-lg px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-sm font-bold text-familles-dark shrink-0">
                    {p.Montant ? `${p.Montant} €` : "—"}
                  </span>
                  {p.Mode_Paiement && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-familles-light text-familles-dark">
                      {p.Mode_Paiement}
                    </span>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-medium text-foreground">{p.Date_Paiement || "—"}</p>
                  {p.Date_Virement && (
                    <p className="text-xs text-muted">Virement {p.Date_Virement}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
