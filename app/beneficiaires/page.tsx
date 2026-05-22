"use client"

import { useState, useEffect } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { ateliers as ateliersMock } from "@/lib/mock-data"
import {
  THEMATIQUES,
  emptyNotes,
  isEmpty as notesIsEmpty,
  moyenne as notesMoyenne,
  migrate as migrateBenef,
  type NotesPositionnement,
  type Thematique,
  type TypeBeneficiaire,
} from "@/lib/positionnement"
import SlideOver, { Field, Input, Select, Textarea, FormRow, SaveButton, DeleteButton } from "@/components/SlideOver"
import { Plus, Pencil, Search, Phone, GraduationCap, Users, UserCheck, X, AlertTriangle } from "lucide-react"

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────
type NiveauBenef = "débutant" | "intermédiaire" | "avancé"
type StatutBenef = "actif" | "diplômé" | "abandon"

interface Beneficiaire {
  id: number
  type: TypeBeneficiaire
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
  /** Pour un élève : ids des parents Beneficiaire (type=parent) qui le rattachent.
   *  Pour un parent : vide (le lien est porté par la fiche élève). */
  parentIds: number[]
  droitsImage?: boolean  // consentement photo/vidéo — utilisé par le module Communication
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
  type: "eleve",
  prenom: "", nom: "", dateNaissance: "", email: "", telephone: "",
  nomParent: "", telephoneParent: "", emailParent: "",
  dateInscription: new Date().toISOString().split("T")[0],
  positionnementInitial: emptyNotes(),
  positionnementFinal:   emptyNotes(),
  niveau: "débutant", notes: "", statut: "actif",
  parentIds: [],
})

// ──────────────────────────────────────────────
// Sous-composant — Hub cards Élèves / Parents
// Sélecteur de population principal, synchronisé avec l'URL (?type=eleve|parent).
// ──────────────────────────────────────────────
function TypeBenefHubCards({
  type, counts, onChange,
}: {
  type: TypeBeneficiaire
  counts: Record<TypeBeneficiaire, { total: number; actifs: number; diplomes: number }>
  onChange: (t: TypeBeneficiaire) => void
}) {
  const hubs: Array<{
    id: TypeBeneficiaire
    label: string
    sublabel: string
    Icon: typeof GraduationCap
    bgActive: string
    borderInactive: string
    textActive: string
    textInactive: string
    iconBg: string
    iconColor: string
  }> = [
    {
      id: "eleve",
      label: "Élèves",
      sublabel: "Enfants & adolescents",
      Icon: GraduationCap,
      bgActive: "bg-ateliers",
      borderInactive: "border-ateliers/30",
      textActive: "text-white",
      textInactive: "text-ateliers-dark",
      iconBg: "bg-ateliers-light",
      iconColor: "text-ateliers-dark",
    },
    {
      id: "parent",
      label: "Parents / adultes",
      sublabel: "Adultes bénéficiaires",
      Icon: UserCheck,
      bgActive: "bg-communication",
      borderInactive: "border-communication/30",
      textActive: "text-white",
      textInactive: "text-communication-dark",
      iconBg: "bg-communication-light",
      iconColor: "text-communication-dark",
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6" role="tablist" aria-label="Type de bénéficiaire">
      {hubs.map(h => {
        const active = type === h.id
        const c = counts[h.id]
        return (
          <button
            key={h.id}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={`benef-hub-panel-${h.id}`}
            id={`benef-hub-tab-${h.id}`}
            onClick={() => onChange(h.id)}
            className={`text-left rounded-2xl p-5 transition-all border-2 ${
              active
                ? `${h.bgActive} ${h.textActive} border-transparent shadow-md`
                : `bg-surface ${h.textInactive} ${h.borderInactive} hover:shadow-sm hover:-translate-y-0.5`
            }`}
          >
            <div className="flex items-start gap-4">
              <span
                className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                  active ? "bg-white/20" : h.iconBg
                }`}
                aria-hidden="true"
              >
                <h.Icon size={24} className={active ? "text-white" : h.iconColor} />
              </span>
              <div className="flex-1 min-w-0">
                <p className={`text-[11px] font-semibold uppercase tracking-wider ${active ? "opacity-90" : "opacity-70"}`}>
                  {h.sublabel}
                </p>
                <p className="text-lg font-bold mt-0.5">{h.label}</p>
                <p className={`text-sm mt-2 ${active ? "opacity-95" : "opacity-80"}`}>
                  <span className="font-semibold tabular-nums">{c.actifs}</span> actif{c.actifs > 1 ? "s" : ""}
                  <span className="mx-1.5 opacity-50">·</span>
                  <span className="font-semibold tabular-nums">{c.total}</span> au total
                </p>
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}

// ──────────────────────────────────────────────
// Page
// ──────────────────────────────────────────────
export default function BeneficiairesPage() {
  // ── Type (hub Élèves / Parents) — synchronisé avec l'URL ──
  const searchParams = useSearchParams()
  const router       = useRouter()
  const pathname     = usePathname()
  const type: TypeBeneficiaire = searchParams.get("type") === "parent" ? "parent" : "eleve"
  function setType(t: TypeBeneficiaire) {
    const params = new URLSearchParams(searchParams.toString())
    params.set("type", t)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const [beneficiaires, setBenef]   = useState<Beneficiaire[]>(ateliersMock.beneficiaires as Beneficiaire[])
  const [groupes, setGroupes]       = useState<Groupe[]>(ateliersMock.groupes as Groupe[])
  const [sessions, setSessions]     = useState<{ id: number; beneficiaireIds: number[]; statut: string }[]>(ateliersMock.sessions)

  const [search, setSearch]         = useState("")
  const [filterStatut, setFilterStatut] = useState<StatutBenef | "tous">("tous")
  const [filterNiveau, setFilterNiveau] = useState<NiveauBenef | "tous">("tous")

  const [slideOpen, setSlideOpen]   = useState(false)
  const [editing, setEditing]       = useState<Beneficiaire | null>(null)
  const [form, setForm]             = useState<Omit<Beneficiaire, "id">>(empty())
  // État local pour le SlideOver d'un parent : ids des élèves rattachés à
  // ce parent (le lien est porté côté élève dans b.parentIds, la cascade se
  // fait au handleSave).
  const [selectedEnfantIds, setSelectedEnfantIds] = useState<number[]>([])

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

  /** Renvoie les ids des élèves rattachés à ce parent (lien porté côté élève). */
  function getEnfantIds(parentId: number): number[] {
    return beneficiaires
      .filter(b => b.type === "eleve" && b.parentIds.includes(parentId))
      .map(b => b.id)
  }

  function openNew() {
    setEditing(null)
    // Pré-sélectionne le type courant du hub.
    setForm({ ...empty(), type })
    setSelectedEnfantIds([])
    setSlideOpen(true)
  }
  function openEdit(b: Beneficiaire) {
    setEditing(b)
    setForm({ ...b })
    setSelectedEnfantIds(b.type === "parent" ? getEnfantIds(b.id) : [])
    setSlideOpen(true)
  }

  function handleSave() {
    const id = editing ? editing.id : Date.now()
    const fiche: Beneficiaire = { ...form, id }
    let updated = editing
      ? beneficiaires.map(x => x.id === editing.id ? fiche : x)
      : [...beneficiaires, fiche]

    // Cascade du lien parent ↔ enfants quand on édite un parent. On compare
    // l'état précédent (calculé) à l'état souhaité (selectedEnfantIds) et on
    // met à jour les parentIds des élèves concernés.
    if (form.type === "parent") {
      const previousEnfantIds = editing ? getEnfantIds(editing.id) : []
      const ajoutes = selectedEnfantIds.filter(eid => !previousEnfantIds.includes(eid))
      const retires = previousEnfantIds.filter(eid => !selectedEnfantIds.includes(eid))

      updated = updated.map(b => {
        if (b.type !== "eleve") return b
        if (ajoutes.includes(b.id) && !b.parentIds.includes(id)) {
          return { ...b, parentIds: [...b.parentIds, id] }
        }
        if (retires.includes(b.id)) {
          return { ...b, parentIds: b.parentIds.filter(p => p !== id) }
        }
        return b
      })
    }

    persist(updated)
    setSlideOpen(false)
  }

  function handleDelete() {
    if (!editing) return
    // Si on supprime un parent, on nettoie les références dans les parentIds
    // des élèves qui le pointaient.
    const updated = beneficiaires
      .filter(x => x.id !== editing.id)
      .map(b => {
        if (editing.type === "parent" && b.type === "eleve" && b.parentIds.includes(editing.id)) {
          return { ...b, parentIds: b.parentIds.filter(p => p !== editing.id) }
        }
        return b
      })
    persist(updated)
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

  // Pool des parents (Beneficiaires type=parent) — utilisée pour le multi-select
  // "Parents rattachés" dans le SlideOver d'édition d'un élève.
  const parentsDisponibles = beneficiaires
    .filter(b => b.type === "parent")
    .sort((a, b) => a.nom.localeCompare(b.nom))

  // Pool des élèves — pour le multi-select "Enfants rattachés" dans le SlideOver
  // d'édition d'un parent.
  const elevesDisponibles = beneficiaires
    .filter(b => b.type === "eleve")
    .sort((a, b) => a.nom.localeCompare(b.nom))

  // ── Counters pour les hub cards (calculés sur les données globales) ──
  const hubCounts: Record<TypeBeneficiaire, { total: number; actifs: number; diplomes: number }> = {
    eleve: {
      total:    beneficiaires.filter(b => b.type === "eleve").length,
      actifs:   beneficiaires.filter(b => b.type === "eleve" && b.statut === "actif").length,
      diplomes: beneficiaires.filter(b => b.type === "eleve" && b.statut === "diplômé").length,
    },
    parent: {
      total:    beneficiaires.filter(b => b.type === "parent").length,
      actifs:   beneficiaires.filter(b => b.type === "parent" && b.statut === "actif").length,
      diplomes: beneficiaires.filter(b => b.type === "parent" && b.statut === "diplômé").length,
    },
  }

  // Filtre : on n'affiche que la population du hub sélectionné. Recherche +
  // filtres statut/niveau s'appliquent ensuite.
  const filtered = beneficiaires.filter(b => {
    if (b.type !== type) return false
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
          <p className="text-sm text-muted mt-1">Fiches d'inscription, contacts et suivi des ateliers</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-1.5 text-sm font-medium bg-slate-900 text-white px-4 py-2 rounded-xl hover:bg-slate-700 transition-colors"
        >
          <Plus size={14} /> Nouveau bénéficiaire
        </button>
      </header>

      {/* Hub cards Élèves / Parents (Lot B) */}
      <TypeBenefHubCards type={type} counts={hubCounts} onChange={setType} />

      {/* Stats — audience-aware */}
      <div
        id={`benef-hub-panel-${type}`}
        role="tabpanel"
        aria-labelledby={`benef-hub-tab-${type}`}
        className="grid grid-cols-3 gap-4 mb-6"
      >
        <div className={`rounded-xl border p-4 ${type === "parent" ? "bg-communication-light border-communication/20" : "bg-ateliers-light border-ateliers/20"}`}>
          <p className={`text-3xl font-bold ${type === "parent" ? "text-communication-dark" : "text-ateliers-dark"}`}>
            {hubCounts[type].actifs}
          </p>
          <p className={`text-sm mt-1 ${type === "parent" ? "text-communication-dark/70" : "text-ateliers-dark/70"}`}>
            {type === "parent" ? "Parents actifs" : "Élèves actifs"}
          </p>
        </div>
        <div className="bg-surface rounded-xl border border-border p-4">
          <p className="text-3xl font-bold text-foreground">{hubCounts[type].diplomes}</p>
          <p className="text-sm text-muted mt-1">Diplômés</p>
        </div>
        <div className="bg-surface rounded-xl border border-border p-4">
          <p className="text-3xl font-bold text-foreground">{hubCounts[type].total}</p>
          <p className="text-sm text-muted mt-1">Total</p>
        </div>
      </div>

      {/* Search + filters (pattern unifié) */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Rechercher par nom, prénom, parent…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-ateliers/30"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground" aria-label="Effacer la recherche">
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

        {(search !== "" || filterStatut !== "tous" || filterNiveau !== "tous") && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-muted">{filtered.length} résultat{filtered.length > 1 ? "s" : ""}</span>
            <button
              type="button"
              onClick={() => { setSearch(""); setFilterStatut("tous"); setFilterNiveau("tous") }}
              className="text-xs text-muted hover:text-foreground hover:underline"
            >
              Réinitialiser
            </button>
          </div>
        )}
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
              // Avatar + badge type couleur (ateliers/teal pour Élève, communication/doré pour Parent).
              const isParent  = b.type === "parent"
              const avatarBg  = isParent ? "bg-communication-light" : "bg-ateliers-light"
              const avatarText = isParent ? "text-communication-dark" : "text-ateliers-dark"
              const enfantsLies = isParent
                ? beneficiaires.filter(x => x.type === "eleve" && x.parentIds.includes(b.id))
                : []

              return (
                <li key={b.id} className="px-5 py-4 flex items-start gap-4 hover:bg-slate-50 group">
                  {/* Avatar */}
                  <div className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${avatarBg}`}>
                    <span className={`text-sm font-bold ${avatarText}`}>{initials(b.prenom, b.nom)}</span>
                  </div>

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    {/* Nom + badge type + age + statut */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-foreground">{b.prenom} {b.nom}</p>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                        isParent
                          ? "bg-communication-light text-communication-dark"
                          : "bg-ateliers-light text-ateliers-dark"
                      }`}>
                        {isParent ? <UserCheck size={10} /> : <GraduationCap size={10} />}
                        {isParent ? "Parent" : "Élève"}
                      </span>
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

                    {/* Contact parent (élèves) OU Enfants rattachés (parents) */}
                    {!isParent && (b.nomParent || b.telephoneParent) && (
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
                    {isParent && enfantsLies.length > 0 && (
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <GraduationCap size={11} className="text-ateliers-dark" />
                        {enfantsLies.map(e => (
                          <span key={e.id} className="text-[10px] bg-ateliers-light text-ateliers-dark px-1.5 py-0.5 rounded-full">
                            {e.prenom} {e.nom}
                          </span>
                        ))}
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

          {/* Section Type de bénéficiaire — sélecteur radio (Lot C) */}
          <div>
            <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">
              Type de bénéficiaire <span className="text-alert">*</span>
            </p>
            <div role="radiogroup" aria-label="Type de bénéficiaire" className="grid grid-cols-2 gap-3">
              {([
                { id: "eleve" as const, label: "Élève", sublabel: "Enfant / adolescent", Icon: GraduationCap,
                  bgActive: "bg-ateliers", textActive: "text-white", borderInactive: "border-ateliers/30", textInactive: "text-ateliers-dark", iconBg: "bg-ateliers-light", iconColor: "text-ateliers-dark" },
                { id: "parent" as const, label: "Parent / Adulte", sublabel: "Adulte bénéficiaire", Icon: UserCheck,
                  bgActive: "bg-communication", textActive: "text-white", borderInactive: "border-communication/30", textInactive: "text-communication-dark", iconBg: "bg-communication-light", iconColor: "text-communication-dark" },
              ]).map(opt => {
                const sel = form.type === opt.id
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="radio"
                    aria-checked={sel}
                    onClick={() => setForm(f => ({ ...f, type: opt.id }))}
                    className={`text-left rounded-xl p-3 transition-all border-2 ${
                      sel
                        ? `${opt.bgActive} ${opt.textActive} border-transparent shadow-sm`
                        : `bg-surface ${opt.textInactive} ${opt.borderInactive} hover:shadow-sm`
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${sel ? "bg-white/20" : opt.iconBg}`} aria-hidden="true">
                        <opt.Icon size={18} className={sel ? "text-white" : opt.iconColor} />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-bold leading-tight">{opt.label}</p>
                        <p className={`text-[11px] mt-0.5 ${sel ? "opacity-90" : "opacity-70"}`}>{opt.sublabel}</p>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

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
                <div className="flex items-center gap-3">
                  <Input
                    type="date"
                    value={form.dateNaissance}
                    onChange={e => setForm(f => ({ ...f, dateNaissance: e.target.value }))}
                  />
                  {(() => {
                    const age = computeAge(form.dateNaissance)
                    if (age === null) return null
                    return (
                      <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-ateliers-light text-ateliers-dark shrink-0">
                        → {age} an{age > 1 ? "s" : ""}
                      </span>
                    )
                  })()}
                </div>
              </Field>
              <FormRow>
                <Field label={form.type === "parent" ? "Email" : "Email (optionnel pour un enfant)"} required={form.type === "parent"}>
                  <Input type="email" placeholder={form.type === "parent" ? "farida@email.fr" : "leila@email.fr"} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                </Field>
                <Field label={form.type === "parent" ? "Téléphone" : "Téléphone (optionnel pour un enfant)"} required={form.type === "parent"}>
                  <Input placeholder="06 12 34 56 78" value={form.telephone} onChange={e => setForm(f => ({ ...f, telephone: e.target.value }))} />
                </Field>
              </FormRow>
            </div>
          </div>

          {/* ── Sections spécifiques ÉLÈVE ── */}
          {form.type === "eleve" && (
            <>
              {/* Contact parent (info admin — peut différer du compte AREA) */}
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

              {/* Parents rattachés (lien vers comptes Parent enregistrés dans AREA) */}
              <div>
                <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <Users size={12} /> Parents rattachés (compte AREA)
                </p>
                <p className="text-[11px] text-muted mb-3">
                  Lien vers les parents enregistrés comme bénéficiaires AREA — utile pour
                  les ateliers adultes. Distinct du contact ci-dessus.
                </p>
                {parentsDisponibles.length === 0 ? (
                  <p className="text-[11px] text-muted italic">
                    Aucun parent enregistré. Bascule sur le hub Parents pour en créer.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {parentsDisponibles.map(p => {
                      const sel = form.parentIds.includes(p.id)
                      return (
                        <button
                          type="button"
                          key={p.id}
                          onClick={() => setForm(f => ({
                            ...f,
                            parentIds: sel
                              ? f.parentIds.filter(id => id !== p.id)
                              : [...f.parentIds, p.id],
                          }))}
                          className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
                            sel
                              ? "bg-ateliers text-white border-ateliers"
                              : "bg-surface text-muted border-border hover:border-ateliers"
                          }`}
                        >
                          {p.prenom} {p.nom}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── Section spécifique PARENT — Enfants rattachés ── */}
          {form.type === "parent" && (
            <div>
              <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <GraduationCap size={12} /> Enfants rattachés
              </p>
              <p className="text-[11px] text-muted mb-3">
                Sélectionne les élèves dont cette personne est le parent.
                La modification est propagée automatiquement aux fiches Élève.
              </p>
              {elevesDisponibles.length === 0 ? (
                <p className="text-[11px] text-muted italic">
                  Aucun élève enregistré. Bascule sur le hub Élèves pour en créer.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {elevesDisponibles.map(e => {
                    const sel = selectedEnfantIds.includes(e.id)
                    return (
                      <button
                        type="button"
                        key={e.id}
                        onClick={() => setSelectedEnfantIds(prev =>
                          sel ? prev.filter(id => id !== e.id) : [...prev, e.id],
                        )}
                        className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
                          sel
                            ? "bg-ateliers text-white border-ateliers"
                            : "bg-surface text-muted border-border hover:border-ateliers"
                        }`}
                      >
                        {e.prenom} {e.nom}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

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
