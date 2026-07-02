"use client"

import { useState, useEffect } from "react"
import { finances as financesMock } from "@/lib/mock-data"
import SlideOver, { Field, Input, Textarea, Select, FormRow, SaveButton, DeleteButton } from "@/components/SlideOver"
import Pagination, { usePagination } from "@/components/Pagination"
import { Plus, Pencil, AlertTriangle } from "lucide-react"

type DemandeStatut = "en cours" | "à compléter" | "accepté" | "rejeté"
type Priorite = "haute" | "normale"
type PaiementStatut = "payé" | "en attente" | "en retard"

interface Demande {
  id: number; type: string; org: string; montant: number
  statut: DemandeStatut; priorite: Priorite; deadline: string
  responsable: string; notes: string
}

interface Inscription {
  id: number; nom: string; montant: number
  statut: PaiementStatut; date: string
}

const statutStyle: Record<string, string> = {
  "en cours":     "bg-blue-100 text-blue-700",
  "à compléter":  "bg-absences-light text-absences-dark",
  "accepté":      "bg-finances-light text-finances-dark",
  "rejeté":       "bg-slate-100 text-slate-500",
}
const paiementStyle: Record<string, string> = {
  "payé":       "bg-finances-light text-finances-dark",
  "en attente": "bg-blue-100 text-blue-700",
  "en retard":  "bg-absences-light text-absences-dark",
}

const STORAGE_D = "asso-demandes"
const STORAGE_I = "asso-inscriptions"

function load<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback
  try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : fallback } catch { return fallback }
}
function save<T>(key: string, v: T) { localStorage.setItem(key, JSON.stringify(v)) }

const emptyDemande = (): Omit<Demande, "id"> => ({
  type: "Subvention", org: "", montant: 0, statut: "en cours",
  priorite: "normale", deadline: "", responsable: "Nadia", notes: "",
})
const emptyInscription = (): Omit<Inscription, "id"> => ({
  nom: "", montant: 50, statut: "en attente", date: new Date().toISOString().split("T")[0],
})

export default function FinancesPage() {
  const [demandes,     setDemandes]     = useState<Demande[]>(financesMock.demandes as Demande[])
  const [inscriptions, setInscriptions] = useState<Inscription[]>(financesMock.inscriptions as Inscription[])
  const [slideOpen,    setSlideOpen]    = useState(false)
  const [slideMode,    setSlideMode]    = useState<"demande" | "inscription">("demande")
  const [editing,      setEditing]      = useState<Demande | Inscription | null>(null)
  const [form,         setForm]         = useState<Record<string, string | number>>({})

  useEffect(() => {
    setDemandes(load(STORAGE_D, financesMock.demandes as Demande[]))
    setInscriptions(load(STORAGE_I, financesMock.inscriptions as Inscription[]))
  }, [])

  function openNew(mode: "demande" | "inscription") {
    setSlideMode(mode)
    setEditing(null)
    setForm(mode === "demande" ? emptyDemande() : emptyInscription())
    setSlideOpen(true)
  }

  function openEdit(item: Demande | Inscription, mode: "demande" | "inscription") {
    setSlideMode(mode)
    setEditing(item)
    setForm({ ...item })
    setSlideOpen(true)
  }

  function handleSaveDemande() {
    const d = form as unknown as Demande
    const updated = editing
      ? demandes.map((x) => x.id === (editing as Demande).id ? { ...d, id: (editing as Demande).id } : x)
      : [...demandes, { ...d, id: Date.now() }]
    setDemandes(updated); save(STORAGE_D, updated); setSlideOpen(false)
  }

  function handleSaveInscription() {
    const ins = form as unknown as Inscription
    const updated = editing
      ? inscriptions.map((x) => x.id === (editing as Inscription).id ? { ...ins, id: (editing as Inscription).id } : x)
      : [...inscriptions, { ...ins, id: Date.now() }]
    setInscriptions(updated); save(STORAGE_I, updated); setSlideOpen(false)
  }

  function handleDelete() {
    if (!editing) return
    if (slideMode === "demande") {
      const updated = demandes.filter((x) => x.id !== (editing as Demande).id)
      setDemandes(updated); save(STORAGE_D, updated)
    } else {
      const updated = inscriptions.filter((x) => x.id !== (editing as Inscription).id)
      setInscriptions(updated); save(STORAGE_I, updated)
    }
    setSlideOpen(false)
  }

  const urgentes = demandes.filter((d) => d.priorite === "haute" && d.statut !== "rejeté" && d.statut !== "accepté")
  const retards  = inscriptions.filter((i) => i.statut === "en retard")
  const montantTotal = demandes.filter((d) => d.statut !== "rejeté").reduce((s, d) => s + Number(d.montant), 0)
  const deadlineCetteSemaine = demandes.filter((d) => {
    if (!d.deadline) return false
    const diff = (new Date(d.deadline).getTime() - Date.now()) / 86400000
    return diff >= 0 && diff <= 7
  }).length

  const demandesPagination     = usePagination(demandes, "asso-finances-demandes-page-size")
  const inscriptionsPagination = usePagination(inscriptions, "asso-finances-inscriptions-page-size")

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Finances</h1>
        <p className="text-sm text-muted mt-1">Demandes de financement & frais d'inscription</p>
      </header>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-surface rounded-xl border border-border p-4">
          <p className="text-3xl font-bold text-foreground">{demandes.filter(d => d.statut === "en cours" || d.statut === "à compléter").length}</p>
          <p className="text-sm text-muted mt-1">Demandes actives</p>
        </div>
        <div className="bg-finances-light rounded-xl border border-finances/20 p-4">
          <p className="text-3xl font-bold text-finances-dark">{montantTotal.toLocaleString("fr")} €</p>
          <p className="text-sm text-finances-dark/70 mt-1">Montant total suivi</p>
        </div>
        <div className="bg-absences-light rounded-xl border border-absences/20 p-4">
          <p className="text-3xl font-bold text-absences-dark">{deadlineCetteSemaine}</p>
          <p className="text-sm text-absences-dark/70 mt-1">Deadline cette semaine</p>
        </div>
      </div>

      {urgentes.length > 0 && (
        <div className="mb-6 bg-absences-light border border-absences/30 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle size={18} className="text-absences-dark shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-absences-dark">{urgentes.length} demande{urgentes.length > 1 ? "s" : ""} prioritaire{urgentes.length > 1 ? "s" : ""}</p>
            <ul className="mt-1 text-absences-dark/80 space-y-0.5">
              {urgentes.map((d) => (
                <li key={d.id}>• {d.org} — deadline {d.deadline ? new Date(d.deadline).toLocaleDateString("fr-FR") : "?"} · {d.statut}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Demandes */}
      <section className="bg-surface rounded-xl border border-border overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-foreground text-sm">Demandes de financement</h2>
          <button onClick={() => openNew("demande")} className="flex items-center gap-1.5 text-xs font-medium bg-finances text-white px-3 py-1.5 rounded-lg hover:bg-finances-dark transition-colors">
            <Plus size={13} /> Ajouter
          </button>
        </div>
        {demandes.length === 0 ? (
          <p className="text-center text-sm text-muted py-8 italic">Aucune demande — cliquez sur Ajouter</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-border">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted">Organisme</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted">Montant</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted">Deadline</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted">Priorité</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted">Statut</th>
                <th className="px-2 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {demandesPagination.pageItems.map((d) => (
                <tr key={d.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3">
                    <p className="font-medium text-foreground">{d.org || "—"}</p>
                    <p className="text-xs text-muted">{d.type}</p>
                  </td>
                  <td className="px-4 py-3 font-semibold text-foreground">{Number(d.montant).toLocaleString("fr")} €</td>
                  <td className="px-4 py-3 text-muted">{d.deadline ? new Date(d.deadline).toLocaleDateString("fr-FR") : "—"}</td>
                  <td className="px-4 py-3">
                    {d.priorite === "haute"
                      ? <span className="text-xs font-semibold text-alert">↑ haute</span>
                      : <span className="text-xs text-muted">normale</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statutStyle[d.statut] ?? "bg-slate-100"}`}>{d.statut}</span>
                  </td>
                  <td className="px-2 py-3">
                    <button onClick={() => openEdit(d, "demande")} className="p-1.5 rounded-lg hover:bg-slate-100 text-muted transition-colors">
                      <Pencil size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {demandes.length > 0 && (
          <div className="px-5 pb-4">
            <Pagination
              page={demandesPagination.page}
              totalPages={demandesPagination.totalPages}
              total={demandesPagination.total}
              pageSize={demandesPagination.pageSize}
              onPageChange={demandesPagination.setPage}
              onPageSizeChange={demandesPagination.changePageSize}
              accentClass="focus:ring-2 focus:ring-finances/30"
            />
          </div>
        )}
      </section>

      {/* Inscriptions */}
      <section className="bg-surface rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-foreground text-sm">Frais d'inscription</h2>
          <div className="flex items-center gap-3">
            {retards.length > 0 && <span className="text-xs text-alert font-medium">{retards.length} en retard</span>}
            <button onClick={() => openNew("inscription")} className="flex items-center gap-1.5 text-xs font-medium bg-finances text-white px-3 py-1.5 rounded-lg hover:bg-finances-dark transition-colors">
              <Plus size={13} /> Ajouter
            </button>
          </div>
        </div>
        {inscriptions.length === 0 ? (
          <p className="text-center text-sm text-muted py-8 italic">Aucune inscription</p>
        ) : (
          <ul className="divide-y divide-border">
            {inscriptionsPagination.pageItems.map((i) => (
              <li key={i.id} className="px-5 py-3 flex items-center justify-between text-sm">
                <span className="font-medium text-foreground">{i.nom || "—"}</span>
                <div className="flex items-center gap-4">
                  <span className="text-muted">{Number(i.montant).toLocaleString("fr")} €</span>
                  <span className="text-xs text-muted">{i.date ? new Date(i.date).toLocaleDateString("fr-FR") : "—"}</span>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${paiementStyle[i.statut] ?? "bg-slate-100"}`}>{i.statut}</span>
                  <button onClick={() => openEdit(i, "inscription")} className="p-1.5 rounded-lg hover:bg-slate-100 text-muted transition-colors">
                    <Pencil size={13} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {inscriptions.length > 0 && (
          <div className="px-5 pb-4">
            <Pagination
              page={inscriptionsPagination.page}
              totalPages={inscriptionsPagination.totalPages}
              total={inscriptionsPagination.total}
              pageSize={inscriptionsPagination.pageSize}
              onPageChange={inscriptionsPagination.setPage}
              onPageSizeChange={inscriptionsPagination.changePageSize}
              accentClass="focus:ring-2 focus:ring-finances/30"
            />
          </div>
        )}
      </section>

      {/* SlideOver */}
      <SlideOver
        open={slideOpen}
        onClose={() => setSlideOpen(false)}
        title={editing ? (slideMode === "demande" ? "Modifier la demande" : "Modifier l'inscription") : (slideMode === "demande" ? "Nouvelle demande" : "Nouvelle inscription")}
        subtitle={slideMode === "demande" ? "Demande de financement" : "Frais d'inscription"}
      >
        {slideMode === "demande" ? (
          <form onSubmit={(e) => { e.preventDefault(); handleSaveDemande() }} className="flex flex-col gap-4">
            <FormRow>
              <Field label="Type" required>
                <Select value={String(form.type ?? "")} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                  <option>Subvention</option><option>Mécénat</option><option>Don</option><option>Autre</option>
                </Select>
              </Field>
              <Field label="Priorité">
                <Select value={String(form.priorite ?? "normale")} onChange={e => setForm(f => ({ ...f, priorite: e.target.value }))}>
                  <option value="normale">Normale</option><option value="haute">Haute</option>
                </Select>
              </Field>
            </FormRow>
            <Field label="Organisme" required>
              <Input placeholder="Ex: Mairie de Paris" value={String(form.org ?? "")} onChange={e => setForm(f => ({ ...f, org: e.target.value }))} />
            </Field>
            <FormRow>
              <Field label="Montant (€)" required>
                <Input type="number" placeholder="0" value={String(form.montant ?? "")} onChange={e => setForm(f => ({ ...f, montant: e.target.value }))} />
              </Field>
              <Field label="Deadline">
                <Input type="date" value={String(form.deadline ?? "")} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} />
              </Field>
            </FormRow>
            <FormRow>
              <Field label="Statut">
                <Select value={String(form.statut ?? "en cours")} onChange={e => setForm(f => ({ ...f, statut: e.target.value }))}>
                  <option>en cours</option><option>à compléter</option><option>accepté</option><option>rejeté</option>
                </Select>
              </Field>
              <Field label="Responsable">
                <Input placeholder="Nadia" value={String(form.responsable ?? "")} onChange={e => setForm(f => ({ ...f, responsable: e.target.value }))} />
              </Field>
            </FormRow>
            <Field label="Notes">
              <Textarea placeholder="Observations, pièces manquantes…" value={String(form.notes ?? "")} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </Field>
            <SaveButton accent="finances" />
            {editing && <DeleteButton onClick={handleDelete} />}
          </form>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); handleSaveInscription() }} className="flex flex-col gap-4">
            <Field label="Nom de l'adhérente" required>
              <Input placeholder="Ex: Leila A." value={String(form.nom ?? "")} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} />
            </Field>
            <FormRow>
              <Field label="Montant (€)">
                <Input type="number" placeholder="50" value={String(form.montant ?? "")} onChange={e => setForm(f => ({ ...f, montant: e.target.value }))} />
              </Field>
              <Field label="Date">
                <Input type="date" value={String(form.date ?? "")} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              </Field>
            </FormRow>
            <Field label="Statut paiement">
              <Select value={String(form.statut ?? "en attente")} onChange={e => setForm(f => ({ ...f, statut: e.target.value }))}>
                <option>payé</option><option>en attente</option><option>en retard</option>
              </Select>
            </Field>
            <SaveButton accent="finances" />
            {editing && <DeleteButton onClick={handleDelete} />}
          </form>
        )}
      </SlideOver>
    </div>
  )
}
