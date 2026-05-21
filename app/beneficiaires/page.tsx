"use client"

import { useState, useEffect } from "react"
import { ateliers as ateliersMock } from "@/lib/mock-data"
import {
  THEMATIQUES,
  emptyNotes,
  isEmpty as notesIsEmpty,
  moyenne as notesMoyenne,
  migrate as migrateBenef,
  type NotesPositionnement,
  type Thematique,
} from "@/lib/positionnement"
import SlideOver, { Field, Input, Select, Textarea, FormRow, SaveButton, DeleteButton } from "@/components/SlideOver"
import { Plus, Pencil, Search, Phone, GraduationCap, Users, X, AlertTriangle } from "lucide-react"

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────
type NiveauBenef = "débutant" | "intermédiaire" | "avancé"
type StatutBenef = "actif" | "diplômé" | "abandon"

interface Beneficiaire {
  id: number
  prenom: string
  nom: string
  dateNaissance: string
  email: string
  telephone: string
  nomParent: string
  telephoneParent: string
  emailParent: string
  dateInscription: string
  positionnementInitial: NotesPositionnement
  positionnementFinal:   NotesPositionnement
  niveau: NiveauBenef
  notes: string
  statut: StatutBenef
}

interface Groupe {
  id: number
  nom: string
  type: string
  description: string
  beneficiaireIds: number[]
}

// ──────────────────────────────────────────────
// Storage
// ──────────────────────────────────────────────
const S_BENEF   = "asso-beneficiaires"
const S_GROUPES = "asso-groupes"
const S_PRESENCES = (id: number) => `asso-presences-atelier-${id}`
const S_SESSIONS  = "asso-ateliers-sessions"

function load<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback
  try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : fallback } catch { return fallback }
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────
function computeAge(dateNaissance: string): number | null {
  if (!dateNaissance) return null
  return new Date().getFullYear() - new Date(dateNaissance).getFullYear()
}

function deriveNiveau(notes: NotesPositionnement): NiveauBenef {
  const m = notesMoyenne(notes)
  if (m === null) return "débutant"
  if (m <= 10) return "débutant"
  if (m <= 16) return "intermédiaire"
  return "avancé"
}

function noteColor(note: number | null): string {
  if (note === null) return "bg-slate-100 text-slate-500"
  if (note <= 7)  return "bg-red-100 text-red-700"
  if (note <= 13) return "bg-orange-100 text-orange-700"
  return "bg-green-100 text-green-700"
}

/** Helper local pour màj une note ciblée dans le formulaire. */
function setNote(
  notes: NotesPositionnement,
  key: Thematique,
  value: string,
): NotesPositionnement {
  const v = value === "" ? null : Math.max(0, Math.min(20, Number(value)))
  return { ...notes, [key]: v }
}

function initials(prenom: string, nom: string): string {
  return `${prenom[0] ?? ""}${nom[0] ?? ""}`.toUpperCase()
}

const niveauStyle: Record<NiveauBenef, string> = {
  "débutant":      "bg-absences-light text-absences-dark",
  "intermédiaire": "bg-ateliers-light text-ateliers-dark",
  "avancé":        "bg-finances-light text-finances-dark",
}

const statutStyle: Record<StatutBenef, string> = {
  "actif":    "bg-finances-light text-finances-dark",
  "diplômé":  "bg-ateliers-light text-ateliers-dark",
  "abandon":  "bg-slate-100 text-slate-500",
}

const empty = (): Omit<Beneficiaire, "id"> => ({
  prenom: "", nom: "", dateNaissance: "", email: "", telephone: "",
  nomParent: "", telephoneParent: "", emailParent: "",
  dateInscription: new Date().toISOString().split("T")[0],
  positionnementInitial: emptyNotes(),
  positionnementFinal:   emptyNotes(),
  niveau: "débutant", notes: "", statut: "actif",
})

// ──────────────────────────────────────────────
// Page
// ──────────────────────────────────────────────
export default function BeneficiairesPage() {
  const [beneficiaires, setBenef]   = useState<Beneficiaire[]>(ateliersMock.beneficiaires as Beneficiaire[])
  const [groupes, setGroupes]       = useState<Groupe[]>(ateliersMock.groupes as Groupe[])
  const [sessions, setSessions]     = useState<{ id: number; beneficiaireIds: number[]; statut: string }[]>(ateliersMock.sessions)

  const [search, setSearch]         = useState("")
  const [filterStatut, setFilterStatut] = useState<StatutBenef | "tous">("tous")
  const [filterNiveau, setFilterNiveau] = useState<NiveauBenef | "tous">("tous")

  const [slideOpen, setSlideOpen]   = useState(false)
  const [editing, setEditing]       = useState<Beneficiaire | null>(null)
  const [form, setForm]             = useState<Omit<Beneficiaire, "id">>(empty())

  useEffect(() => {
    // Migration auto si la donnée vient de l'ancien format (avant le Lot 1).
    const raw = load<Beneficiaire[]>(S_BENEF, ateliersMock.beneficiaires as Beneficiaire[])
    setBenef(raw.map(b => migrateBenef(b) as Beneficiaire))
    setGroupes(load(S_GROUPES, ateliersMock.groupes as Groupe[]))
    setSessions(load(S_SESSIONS, ateliersMock.sessions))
  }, [])

  function persist(data: Beneficiaire[]) {
    setBenef(data)
    localStorage.setItem(S_BENEF, JSON.stringify(data))
  }

  function openNew() { setEditing(null); setForm(empty()); setSlideOpen(true) }
  function openEdit(b: Beneficiaire) { setEditing(b); setForm({ ...b }); setSlideOpen(true) }

  function handleSave() {
    const updated = editing
      ? beneficiaires.map(x => x.id === editing.id ? { ...form, id: editing.id } : x)
      : [...beneficiaires, { ...form, id: Date.now() }]
    persist(updated)
    setSlideOpen(false)
  }

  function handleDelete() {
    if (!editing) return
    persist(beneficiaires.filter(x => x.id !== editing.id))
    setSlideOpen(false)
  }

  // Derived stats on benef
  function getGroupes(id: number): Groupe[] {
    return groupes.filter(g => g.beneficiaireIds.includes(id))
  }

  function getSessionStats(id: number): { total: number; absences: number } {
    const participated = sessions.filter(s => s.beneficiaireIds.includes(id))
    let absences = 0
    participated
      .filter(s => s.statut === "terminé")
      .forEach(s => {
        const p = load<Record<number, string>>(S_PRESENCES(s.id), {})
        if (p[id] === "absent") absences++
      })
    return { total: participated.length, absences }
  }

  // Filters
  const filtered = beneficiaires.filter(b => {
    const q = search.toLowerCase()
    const matchSearch = !q ||
      b.prenom.toLowerCase().includes(q) ||
      b.nom.toLowerCase().includes(q) ||
      b.nomParent.toLowerCase().includes(q)
    const matchStatut = filterStatut === "tous" || b.statut === filterStatut
    const matchNiveau = filterNiveau === "tous" || b.niveau === filterNiveau
    return matchSearch && matchStatut && matchNiveau
  })

  const suggestedNiveau = deriveNiveau(form.positionnementInitial)
  const moyInitial      = notesMoyenne(form.positionnementInitial)
  const aEvaluer        = notesIsEmpty(form.positionnementInitial)

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <header className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Bénéficiaires</h1>
          <p className="text-sm text-muted mt-1">Fiches d'inscription, contacts parents et suivi des ateliers</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-1.5 text-sm font-medium bg-slate-900 text-white px-4 py-2 rounded-xl hover:bg-slate-700 transition-colors"
        >
          <Plus size={14} /> Nouveau bénéficiaire
        </button>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-ateliers-light rounded-xl border border-ateliers/20 p-4">
          <p className="text-3xl font-bold text-ateliers-dark">{beneficiaires.filter(b => b.statut === "actif").length}</p>
          <p className="text-sm text-ateliers-dark/70 mt-1">Actifs</p>
        </div>
        <div className="bg-surface rounded-xl border border-border p-4">
          <p className="text-3xl font-bold text-foreground">{beneficiaires.filter(b => b.statut === "diplômé").length}</p>
          <p className="text-sm text-muted mt-1">Diplômés</p>
        </div>
        <div className="bg-surface rounded-xl border border-border p-4">
          <p className="text-3xl font-bold text-foreground">{beneficiaires.length}</p>
          <p className="text-sm text-muted mt-1">Total</p>
        </div>
      </div>

      {/* Search + filters */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Rechercher par nom, prénom, parent…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-ateliers/30"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground">
              <X size={13} />
            </button>
          )}
        </div>

        <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
          {(["tous", "actif", "diplômé", "abandon"] as const).map(s => (
            <button key={s} onClick={() => setFilterStatut(s)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${filterStatut === s ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground"}`}
            >
              {s === "tous" ? "Tous statuts" : s}
            </button>
          ))}
        </div>

        <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
          {(["tous", "débutant", "intermédiaire", "avancé"] as const).map(n => (
            <button key={n} onClick={() => setFilterNiveau(n)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${filterNiveau === n ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground"}`}
            >
              {n === "tous" ? "Tous niveaux" : n}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 text-muted">
          <Users size={36} className="mx-auto mb-3 opacity-20" />
          <p className="text-sm">{search ? "Aucun résultat pour cette recherche." : "Aucun bénéficiaire enregistré."}</p>
        </div>
      ) : (
        <div className="bg-surface rounded-xl border border-border overflow-hidden">
          <div className="px-5 py-3 border-b border-border">
            <p className="text-xs text-muted">{filtered.length} bénéficiaire{filtered.length > 1 ? "s" : ""}</p>
          </div>
          <ul className="divide-y divide-border">
            {filtered.map(b => {
              const age         = computeAge(b.dateNaissance)
              const benGroups   = getGroupes(b.id)
              const { total, absences } = getSessionStats(b.id)

              return (
                <li key={b.id} className="px-5 py-4 flex items-start gap-4 hover:bg-slate-50 group">
                  {/* Avatar */}
                  <div className="w-11 h-11 rounded-full bg-ateliers-light flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-sm font-bold text-ateliers-dark">{initials(b.prenom, b.nom)}</span>
                  </div>

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    {/* Nom + age + statut */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-foreground">{b.prenom} {b.nom}</p>
                      {age !== null && <span className="text-xs text-muted">{age} ans</span>}
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statutStyle[b.statut]}`}>{b.statut}</span>
                    </div>

                    {/* Évaluation + niveau */}
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      {notesIsEmpty(b.positionnementInitial) ? (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 flex items-center gap-1">
                          <AlertTriangle size={10} /> À évaluer avant attribution
                        </span>
                      ) : (
                        <>
                          {THEMATIQUES.map(t => {
                            const n = b.positionnementInitial[t.key]
                            return (
                              <span
                                key={t.key}
                                title={t.label}
                                className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${noteColor(n)}`}
                              >
                                {t.short.replace(/^[A-Z]\w+\. /, "")} {n ?? "—"}
                              </span>
                            )
                          })}
                        </>
                      )}
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${niveauStyle[b.niveau]}`}>
                        {b.niveau}
                      </span>
                    </div>

                    {/* Contact parent */}
                    {(b.nomParent || b.telephoneParent) && (
                      <div className="flex items-center gap-2 mt-1.5 text-xs text-muted">
                        <span className="font-medium">{b.nomParent}</span>
                        {b.telephoneParent && (
                          <a href={`tel:${b.telephoneParent.replace(/\s/g, "")}`}
                            className="flex items-center gap-1 text-ateliers-dark hover:underline"
                            onClick={e => e.stopPropagation()}
                          >
                            <Phone size={10} /> {b.telephoneParent}
                          </a>
                        )}
                      </div>
                    )}

                    {/* Notes */}
                    {b.notes && (
                      <p className="text-xs text-slate-400 italic mt-1 line-clamp-1">{b.notes}</p>
                    )}

                    {/* Stats + groupes */}
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      <span className="text-[10px] text-muted">
                        {total} atelier{total > 1 ? "s" : ""}
                        {absences > 0 && <span className="text-absences-dark"> · {absences} absence{absences > 1 ? "s" : ""}</span>}
                      </span>
                      {benGroups.map(g => (
                        <span key={g.id} className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                          {g.nom}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Edit button */}
                  <button
                    onClick={() => openEdit(b)}
                    className="p-1.5 rounded-lg hover:bg-slate-100 text-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1"
                  >
                    <Pencil size={13} />
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* ── SlideOver ── */}
      <SlideOver
        open={slideOpen}
        onClose={() => setSlideOpen(false)}
        title={editing ? `${editing.prenom} ${editing.nom}` : "Nouveau bénéficiaire"}
        subtitle="Fiche d'inscription"
        width="lg"
      >
        <form onSubmit={e => { e.preventDefault(); handleSave() }} className="flex flex-col gap-5">

          {/* Section Identité */}
          <div>
            <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <GraduationCap size={12} /> Identité
            </p>
            <div className="flex flex-col gap-3">
              <FormRow>
                <Field label="Prénom" required>
                  <Input placeholder="Leila" value={form.prenom} onChange={e => setForm(f => ({ ...f, prenom: e.target.value }))} />
                </Field>
                <Field label="Nom" required>
                  <Input placeholder="A." value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} />
                </Field>
              </FormRow>
              <Field label="Date de naissance">
                <Input type="date" value={form.dateNaissance} onChange={e => setForm(f => ({ ...f, dateNaissance: e.target.value }))} />
              </Field>
              <FormRow>
                <Field label="Email (optionnel si enfant)">
                  <Input type="email" placeholder="leila@email.fr" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                </Field>
                <Field label="Téléphone (optionnel si enfant)">
                  <Input placeholder="06 12 34 56 78" value={form.telephone} onChange={e => setForm(f => ({ ...f, telephone: e.target.value }))} />
                </Field>
              </FormRow>
            </div>
          </div>

          {/* Section Contact parent */}
          <div>
            <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Phone size={12} /> Contact parent / tuteur
            </p>
            <div className="flex flex-col gap-3">
              <Field label="Nom du parent / tuteur" required>
                <Input placeholder="Farida A." value={form.nomParent} onChange={e => setForm(f => ({ ...f, nomParent: e.target.value }))} />
              </Field>
              <FormRow>
                <Field label="Téléphone" required>
                  <Input placeholder="06 11 22 33 44" value={form.telephoneParent} onChange={e => setForm(f => ({ ...f, telephoneParent: e.target.value }))} />
                </Field>
                <Field label="Email">
                  <Input type="email" placeholder="farida@email.fr" value={form.emailParent} onChange={e => setForm(f => ({ ...f, emailParent: e.target.value }))} />
                </Field>
              </FormRow>
            </div>
          </div>

          {/* Section Inscription */}
          <div>
            <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Inscription</p>
            <div className="flex flex-col gap-3">
              <Field label="Date d'inscription">
                <Input type="date" value={form.dateInscription} onChange={e => setForm(f => ({ ...f, dateInscription: e.target.value }))} />
              </Field>
              <FormRow>
                <Field label="Niveau">
                  <Select value={form.niveau} onChange={e => setForm(f => ({ ...f, niveau: e.target.value as NiveauBenef }))}>
                    <option value="débutant">Débutant</option>
                    <option value="intermédiaire">Intermédiaire</option>
                    <option value="avancé">Avancé</option>
                  </Select>
                </Field>
                <Field label="Statut">
                  <Select value={form.statut} onChange={e => setForm(f => ({ ...f, statut: e.target.value as StatutBenef }))}>
                    <option value="actif">Actif</option>
                    <option value="diplômé">Diplômé</option>
                    <option value="abandon">Abandon</option>
                  </Select>
                </Field>
              </FormRow>
            </div>
          </div>

          {/* Section Test de positionnement (initial + final) */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-muted uppercase tracking-wider">
                Test de positionnement
              </p>
              {aEvaluer && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 flex items-center gap-1">
                  <AlertTriangle size={10} /> À évaluer avant attribution
                </span>
              )}
            </div>

            {/* Test initial — clé pour la composition des groupes */}
            <div className="rounded-xl border border-border bg-surface/50 p-3 mb-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-semibold text-foreground">
                  Initial <span className="text-muted font-normal">— sert à composer les groupes</span>
                </p>
                {moyInitial !== null && (
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${noteColor(Math.round(moyInitial))}`}>
                    moy {moyInitial.toFixed(1)} → {suggestedNiveau}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {THEMATIQUES.map(t => (
                  <Field key={t.key} label={t.label}>
                    <Input
                      type="number" min={0} max={20} placeholder="—/20"
                      value={form.positionnementInitial[t.key] ?? ""}
                      onChange={e => {
                        const next = setNote(form.positionnementInitial, t.key, e.target.value)
                        setForm(f => ({ ...f, positionnementInitial: next, niveau: deriveNiveau(next) }))
                      }}
                    />
                  </Field>
                ))}
              </div>
            </div>

            {/* Test final — mesure d'impact (optionnel) */}
            <div className="rounded-xl border border-border bg-surface/50 p-3">
              <p className="text-[11px] font-semibold text-foreground mb-2">
                Final <span className="text-muted font-normal">— mesure d'impact (optionnel)</span>
              </p>
              <div className="grid grid-cols-2 gap-2">
                {THEMATIQUES.map(t => (
                  <Field key={t.key} label={t.label}>
                    <Input
                      type="number" min={0} max={20} placeholder="—/20"
                      value={form.positionnementFinal[t.key] ?? ""}
                      onChange={e => {
                        const next = setNote(form.positionnementFinal, t.key, e.target.value)
                        setForm(f => ({ ...f, positionnementFinal: next }))
                      }}
                    />
                  </Field>
                ))}
              </div>
            </div>
          </div>

          {/* Section Notes */}
          <Field label="Notes">
            <Textarea
              rows={3}
              placeholder="Observations, besoins particuliers…"
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            />
          </Field>

          <SaveButton />
          {editing && <DeleteButton onClick={handleDelete} />}
        </form>
      </SlideOver>
    </div>
  )
}
