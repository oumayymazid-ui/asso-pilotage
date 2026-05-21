"use client"

import { useState, useEffect } from "react"
import { ateliers as ateliersMock, benevoles as benevolesMock, membres as membresMock } from "@/lib/mock-data"
import {
  THEMATIQUES,
  moyenne as notesMoyenne,
  migrate as migrateBenef,
  type NotesPositionnement,
  type Thematique,
} from "@/lib/positionnement"
import {
  emptyFiche,
  migrateFiche,
  encadrantsRequis,
  type FicheAtelier,
} from "@/lib/atelier"
import {
  composerGroupes,
  saveBrouillon,
  type BeneficiairePourGroupage,
} from "@/lib/group-composer"
import Link from "next/link"
import {
  Plus, Pencil, CalendarDays, Users, UserCheck, ClipboardCheck,
  X, Columns3, Check, AlertTriangle, Sparkles, Shuffle,
  ChevronDown, ChevronRight,
} from "lucide-react"
import SlideOver, {
  Field, Input, Select, Textarea, FormRow, SaveButton, DeleteButton,
} from "@/components/SlideOver"
import BrouillonGroupesTab from "./brouillon-tab"

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────
type SessionStatut = "planifié" | "en cours" | "terminé" | "annulé"
type NiveauBenef   = "débutant" | "intermédiaire" | "avancé"
type StatutBenef   = "actif" | "diplômé" | "abandon"
type TypeGroupe    = "niveau" | "âge" | "mixte"

interface Session extends FicheAtelier {
  id: number
  titre: string
  description: string
  date: string
  heure: string
  duree: string
  salle: string
  formatrice: string
  beneficiaireIds: number[]
  benevoleIds: number[]
  statut: SessionStatut
}

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
  type: TypeGroupe
  description: string
  beneficiaireIds: number[]
  /** Atelier source si le groupe vient d'une composition validée.
   *  null pour les groupes créés à la main depuis le sous-onglet Groupes. */
  atelierId: number | null
}

// ──────────────────────────────────────────────
// Storage
// ──────────────────────────────────────────────
const S_SESSIONS  = "asso-ateliers-sessions"
const S_BENEF     = "asso-beneficiaires"
const S_GROUPES   = "asso-groupes"
const S_MEMBRES   = "asso-membres"
const S_PRESENCES = (id: number) => `asso-presences-atelier-${id}`

function load<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback
  try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : fallback } catch { return fallback }
}

// ──────────────────────────────────────────────
// Helpers visuels
// ──────────────────────────────────────────────
const statutSessionStyle: Record<SessionStatut, string> = {
  "planifié":  "bg-ateliers-light text-ateliers-dark",
  "en cours":  "bg-absences-light text-absences-dark",
  "terminé":   "bg-finances-light text-finances-dark",
  "annulé":    "bg-slate-100 text-slate-500",
}

const niveauStyle: Record<NiveauBenef, string> = {
  "débutant":      "bg-absences-light text-absences-dark",
  "intermédiaire": "bg-ateliers-light text-ateliers-dark",
  "avancé":        "bg-finances-light text-finances-dark",
}

const typeGroupeStyle: Record<TypeGroupe, string> = {
  "niveau": "bg-ateliers-light text-ateliers-dark",
  "âge":    "bg-benevoles-light text-benevoles-dark",
  "mixte":  "bg-communication-light text-communication-dark",
}

function computeAge(dateNaissance: string): number {
  return new Date().getFullYear() - new Date(dateNaissance).getFullYear()
}

function initials(prenom: string, nom: string): string {
  return `${prenom[0] ?? ""}${nom[0] ?? ""}`.toUpperCase()
}

// ──────────────────────────────────────────────
// Sous-composant — liste éditable (tâches, besoins, étapes)
// ──────────────────────────────────────────────
function EditableList(props: {
  items: string[]
  onChange: (items: string[]) => void
  placeholder: string
  ordered?: boolean
}) {
  const { items, onChange, placeholder, ordered } = props
  return (
    <div className="flex flex-col gap-1.5">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-[10px] text-muted w-4 shrink-0 text-right">
            {ordered ? `${i + 1}.` : "•"}
          </span>
          <input
            type="text"
            value={item}
            onChange={e => onChange(items.map((x, j) => (j === i ? e.target.value : x)))}
            className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-ateliers/30"
          />
          <button
            type="button"
            onClick={() => onChange(items.filter((_, j) => j !== i))}
            className="p-1 rounded text-muted hover:text-foreground hover:bg-slate-100"
            aria-label="Supprimer cette entrée"
          >
            <X size={12} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, ""])}
        className="self-start flex items-center gap-1 text-xs text-ateliers-dark hover:underline mt-1"
      >
        <Plus size={11} /> {placeholder}
      </button>
    </div>
  )
}

// ──────────────────────────────────────────────
// Empty factories
// ──────────────────────────────────────────────
const emptySession = (): Omit<Session, "id"> => ({
  titre: "", description: "", date: new Date().toISOString().split("T")[0],
  heure: "14h00", duree: "2h", salle: "", formatrice: "",
  beneficiaireIds: [], benevoleIds: [], statut: "planifié",
  ...emptyFiche(),
})

const emptyGroupe = (): Omit<Groupe, "id"> => ({
  nom: "", type: "niveau", description: "", beneficiaireIds: [],
  atelierId: null,
})

// ══════════════════════════════════════════════
// ONGLET ATELIERS
// ══════════════════════════════════════════════
function AteliersTab({
  sessions, beneficiaires, benevoles, groupes, onEdit,
}: {
  sessions: Session[]
  beneficiaires: Beneficiaire[]
  benevoles: typeof benevolesMock.liste
  groupes: Groupe[]
  onEdit: (s: Session) => void
}) {
  const sorted   = [...sessions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  const upcoming = sorted.filter(s => s.statut !== "terminé" && s.statut !== "annulé")
  const past     = sorted.filter(s => s.statut === "terminé" || s.statut === "annulé")
  // État "groupes dépliés" géré au niveau du parent pour ne pas se perdre
  // quand SessionCard (composant interne) est recréé à chaque render.
  const [groupesOuverts, setGroupesOuverts] = useState<Record<number, boolean>>({})
  function toggleGroupes(id: number) {
    setGroupesOuverts(m => ({ ...m, [id]: !m[id] }))
  }

  function SessionCard({ s }: { s: Session }) {
    const benefs = s.beneficiaireIds
      .map(id => beneficiaires.find(b => b.id === id))
      .filter((b): b is Beneficiaire => Boolean(b))
    const bvls = s.benevoleIds
      .map(id => benevoles.find(bv => bv.id === id))
      .filter((bv): bv is (typeof benevoles)[0] => Boolean(bv))
    // Groupes rattachés à cet atelier (rattachement explicite via atelierId).
    const groupesAtelier = groupes.filter(g => g.atelierId === s.id)
    const ouvert = !!groupesOuverts[s.id]

    return (
      <li className="px-5 py-4 flex items-start gap-4 hover:bg-slate-50 group">
        {/* Date column */}
        <div className="text-center w-14 shrink-0">
          <p className="text-xs text-muted">{new Date(s.date).toLocaleDateString("fr-FR", { weekday: "short" })}</p>
          <p className="text-lg font-bold text-foreground">{new Date(s.date).getDate()}</p>
          <p className="text-xs text-muted">{s.heure}</p>
        </div>
        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium text-foreground text-sm">{s.titre}</p>
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statutSessionStyle[s.statut]}`}>{s.statut}</span>
          </div>
          {s.description && <p className="text-xs text-muted mt-0.5 truncate">{s.description}</p>}
          {/* Compétences ciblées (Lot 2) */}
          {s.competencesCiblees.length > 0 && (
            <div className="flex items-center gap-1 mt-1.5 flex-wrap">
              {s.competencesCiblees.map(c => {
                const t = THEMATIQUES.find(x => x.key === c)
                return t ? (
                  <span key={c} className="text-[10px] bg-ateliers/10 text-ateliers-dark px-1.5 py-0.5 rounded font-medium">
                    {t.short}
                  </span>
                ) : null
              })}
            </div>
          )}
          <div className="flex items-center gap-3 mt-1.5 flex-wrap text-xs text-muted">
            <span>⏱ {s.duree}</span>
            {s.salle     && <span>📍 {s.salle}</span>}
            {s.formatrice && <span>👩‍🏫 {s.formatrice}</span>}
            {s.periode && (
              <span className="text-ateliers-dark font-medium flex items-center gap-1">
                <CalendarDays size={10} /> {s.periode}
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 mt-2 flex-wrap">
            {benefs.length > 0 && (
              <div className="flex items-center gap-1.5">
                <Users size={11} className="text-ateliers-dark" />
                <div className="flex gap-1 flex-wrap">
                  {benefs.map(b => (
                    <span key={b.id} className="text-[10px] bg-ateliers-light text-ateliers-dark px-1.5 py-0.5 rounded-full">
                      {b.prenom} {b.nom}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {bvls.length > 0 && (
              <div className="flex items-center gap-1.5">
                <UserCheck size={11} className="text-benevoles-dark" />
                <div className="flex gap-1 flex-wrap">
                  {bvls.map(bv => (
                    <span key={bv.id} className="text-[10px] bg-benevoles-light text-benevoles-dark px-1.5 py-0.5 rounded-full">
                      {bv.nom}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Bloc "Voir les groupes" déroulable ── */}
          <div className="mt-3 pt-3 border-t border-border/60">
            {groupesAtelier.length === 0 ? (
              <p className="text-[11px] text-muted italic">Aucun groupe rattaché.</p>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => toggleGroupes(s.id)}
                  className="flex items-center gap-1.5 text-xs font-medium text-ateliers-dark hover:underline"
                >
                  {ouvert ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                  {ouvert ? "Masquer" : "Voir"} les groupes ({groupesAtelier.length})
                </button>
                {ouvert && (
                  <ul className="mt-2 flex flex-col gap-2">
                    {groupesAtelier.map(g => {
                      const membres = g.beneficiaireIds
                        .map(id => beneficiaires.find(b => b.id === id))
                        .filter((b): b is Beneficiaire => Boolean(b))
                      return (
                        <li key={g.id} className="rounded-lg bg-slate-50 border border-border px-3 py-2">
                          <div className="flex items-center justify-between gap-2 flex-wrap mb-1.5">
                            <p className="text-xs font-semibold text-foreground">{g.nom}</p>
                            <span className="text-[10px] bg-ateliers-light text-ateliers-dark px-1.5 py-0.5 rounded-full">
                              {membres.length} bénéficiaire{membres.length > 1 ? "s" : ""}
                            </span>
                          </div>
                          {membres.length === 0 ? (
                            <p className="text-[10px] text-muted italic">Aucun bénéficiaire.</p>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {membres.map(b => (
                                <span
                                  key={b.id}
                                  className="text-[10px] bg-surface border border-border text-foreground px-2 py-0.5 rounded-full"
                                >
                                  {b.prenom} {b.nom}
                                </span>
                              ))}
                            </div>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </>
            )}
          </div>
        </div>
        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          {s.statut !== "terminé" && s.statut !== "annulé" && (
            <Link
              href="/emargement"
              onClick={() => localStorage.setItem("asso-emargement-session", String(s.id))}
              className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-lg bg-ateliers-light text-ateliers-dark hover:opacity-80 transition-opacity"
            >
              <ClipboardCheck size={11} /> Émarger
            </Link>
          )}
          <button onClick={() => onEdit(s)} className="p-1.5 rounded-lg hover:bg-slate-100 text-muted">
            <Pencil size={13} />
          </button>
        </div>
      </li>
    )
  }

  return (
    <div className="space-y-4">
      {upcoming.length > 0 && (
        <section className="bg-surface rounded-xl border border-border overflow-hidden">
          <div className="px-5 py-3 border-b border-border">
            <h2 className="font-semibold text-foreground text-sm">À venir</h2>
          </div>
          <ul className="divide-y divide-border">
            {upcoming.map(s => <SessionCard key={s.id} s={s} />)}
          </ul>
        </section>
      )}
      {past.length > 0 && (
        <section className="bg-surface rounded-xl border border-border overflow-hidden">
          <div className="px-5 py-3 border-b border-border">
            <h2 className="font-semibold text-muted text-sm">Passés</h2>
          </div>
          <ul className="divide-y divide-border">
            {past.map(s => <SessionCard key={s.id} s={s} />)}
          </ul>
        </section>
      )}
      {sessions.length === 0 && (
        <p className="text-center text-sm text-muted py-12 italic">Aucun atelier planifié</p>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════
// ONGLET GROUPES
// ══════════════════════════════════════════════
function GroupesTab({
  groupes, beneficiaires, onEdit, onUpdateMembers,
}: {
  groupes: Groupe[]
  beneficiaires: Beneficiaire[]
  onEdit: (g: Groupe) => void
  onUpdateMembers: (groupeId: number, beneficiaireIds: number[]) => void
}) {
  const [expandedId, setExpandedId] = useState<number | null>(null)

  function getMembers(g: Groupe): Beneficiaire[] {
    return g.beneficiaireIds
      .map(id => beneficiaires.find(b => b.id === id))
      .filter((b): b is Beneficiaire => Boolean(b))
  }

  function getScoreRange(g: Groupe): string | null {
    if (g.type !== "niveau") return null
    // Moyenne du test initial pour chaque bénéficiaire — pas une note unique.
    const scores = getMembers(g)
      .map(b => notesMoyenne(b.positionnementInitial))
      .filter((n): n is number => n !== null)
    if (scores.length === 0) return null
    return `Moy. ${Math.min(...scores).toFixed(0)}–${Math.max(...scores).toFixed(0)}`
  }

  function getAgeRange(g: Groupe): string | null {
    if (g.type !== "âge") return null
    const ages = getMembers(g)
      .filter(b => b.dateNaissance)
      .map(b => computeAge(b.dateNaissance))
    if (ages.length === 0) return null
    return `${Math.min(...ages)}–${Math.max(...ages)} ans`
  }

  function removeMember(g: Groupe, beneficiaireId: number) {
    onUpdateMembers(g.id, g.beneficiaireIds.filter(id => id !== beneficiaireId))
  }

  return (
    <div className="space-y-4">
      {groupes.length === 0 && (
        <p className="text-center text-sm text-muted py-12 italic">Aucun groupe constitué</p>
      )}
      <div className="grid grid-cols-1 gap-4">
        {groupes.map(g => {
          const members = getMembers(g)
          const isExpanded = expandedId === g.id
          const scoreRange = getScoreRange(g)
          const ageRange   = getAgeRange(g)

          return (
            <div
              key={g.id}
              className="bg-surface rounded-xl border border-border overflow-hidden group"
            >
              {/* Card header */}
              <div
                className="px-5 py-4 flex items-start gap-4 cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => setExpandedId(isExpanded ? null : g.id)}
              >
                {/* Avatars */}
                <div className="flex -space-x-2 shrink-0 mt-0.5">
                  {members.slice(0, 4).map(b => (
                    <div key={b.id} className="w-7 h-7 rounded-full bg-ateliers-light border-2 border-white flex items-center justify-center">
                      <span className="text-[9px] font-bold text-ateliers-dark">{initials(b.prenom, b.nom)}</span>
                    </div>
                  ))}
                  {members.length > 4 && (
                    <div className="w-7 h-7 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center">
                      <span className="text-[9px] font-bold text-slate-500">+{members.length - 4}</span>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-foreground text-sm">{g.nom}</p>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${typeGroupeStyle[g.type]}`}>{g.type}</span>
                    {scoreRange && <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{scoreRange}</span>}
                    {ageRange   && <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{ageRange}</span>}
                  </div>
                  {g.description && <p className="text-xs text-muted mt-0.5">{g.description}</p>}
                  <p className="text-xs text-muted mt-1">
                    {members.length} membre{members.length > 1 ? "s" : ""}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                  <button onClick={() => onEdit(g)} className="p-1.5 rounded-lg hover:bg-slate-100 text-muted">
                    <Pencil size={13} />
                  </button>
                </div>
              </div>

              {/* Expanded member list */}
              {isExpanded && (
                <div className="border-t border-border px-5 py-4">
                  <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Membres</p>
                  {members.length === 0 ? (
                    <p className="text-xs text-muted italic">Aucun membre dans ce groupe</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {members.map(b => (
                        <span
                          key={b.id}
                          className="flex items-center gap-1.5 text-xs bg-ateliers-light text-ateliers-dark px-2.5 py-1 rounded-full"
                        >
                          {b.prenom} {b.nom}
                          <button
                            onClick={() => removeMember(g, b.id)}
                            className="hover:opacity-60 transition-opacity"
                            title="Retirer du groupe"
                          >
                            <X size={10} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════
// PAGE PRINCIPALE
// ══════════════════════════════════════════════
const TABS = [
  { id: "ateliers",  label: "Ateliers",         icon: CalendarDays },
  { id: "brouillon", label: "Brouillon groupes", icon: Shuffle },
  { id: "groupes",   label: "Groupes",          icon: Columns3 },
] as const

type TabId = (typeof TABS)[number]["id"]

export default function AteliersPage() {
  const [tab, setTab] = useState<TabId>("ateliers")
  const [toast, setToast] = useState<{ message: string } | null>(null)

  // Auto-effacement du toast après 6 s
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 6000)
    return () => clearTimeout(t)
  }, [toast])

  // ── Sessions ──
  const [sessions, setSessions]         = useState<Session[]>(ateliersMock.sessions as Session[])
  const [sessionSlide, setSessionSlide] = useState(false)
  const [editingSession, setEditingSession] = useState<Session | null>(null)
  const [sessionForm, setSessionForm]   = useState<Omit<Session, "id">>(emptySession())

  // ── Groupes ──
  const [groupes, setGroupes]           = useState<Groupe[]>(ateliersMock.groupes as Groupe[])
  const [groupeSlide, setGroupeSlide]   = useState(false)
  const [editingGroupe, setEditingGroupe] = useState<Groupe | null>(null)
  const [groupeForm, setGroupeForm]     = useState<Omit<Groupe, "id">>(emptyGroupe())

  // ── Bénéficiaires ──
  const [beneficiaires, setBeneficiaires] = useState<Beneficiaire[]>(ateliersMock.beneficiaires as Beneficiaire[])

  // ── Bénévoles (read-only) ──
  const benevoles = benevolesMock.liste

  // ── Membres (liste éditable côté /membres, on lit depuis localStorage pour
  //    refléter les ajouts/modifs faits sur l'autre page) ──
  type Membre = (typeof membresMock.liste)[number]
  const [membres, setMembres] = useState<Membre[]>(membresMock.liste as Membre[])

  function refreshMembres() {
    setMembres(load<Membre[]>(S_MEMBRES, membresMock.liste as Membre[]))
  }

  // Hydration from localStorage
  useEffect(() => {
    // Migration auto pour les sessions (champs FicheAtelier ajoutés au Lot 2).
    const sessionsRaw = load<Session[]>(S_SESSIONS, ateliersMock.sessions as Session[])
    setSessions(sessionsRaw.map(s => migrateFiche(s) as Session))
    // Migration auto pour les bénéficiaires (note unique → 4 notes du Lot 1).
    const benefsRaw = load<Beneficiaire[]>(S_BENEF, ateliersMock.beneficiaires as Beneficiaire[])
    setBeneficiaires(benefsRaw.map(b => migrateBenef(b) as Beneficiaire))
    // Migration auto des groupes : les anciens enregistrements n'ont pas de
    // champ atelierId, on le force à null pour qu'ils restent affichés dans
    // le sous-onglet Groupes mais pas attachés à un atelier.
    const groupesRaw = load<Groupe[]>(S_GROUPES, ateliersMock.groupes as Groupe[])
    setGroupes(groupesRaw.map(g => ({ ...g, atelierId: g.atelierId ?? null })))
    refreshMembres()
  }, [])

  // ── Sessions CRUD ──
  function persistSessions(data: Session[]) {
    setSessions(data)
    localStorage.setItem(S_SESSIONS, JSON.stringify(data))
  }
  function openNewSession() {
    // Re-lecture des membres : capte un ajout fait sur /membres pendant la session.
    refreshMembres()
    setEditingSession(null); setSessionForm(emptySession()); setSessionSlide(true)
  }
  function openEditSession(s: Session) {
    refreshMembres()
    setEditingSession(s)
    setSessionForm({ ...s, beneficiaireIds: [...s.beneficiaireIds], benevoleIds: [...s.benevoleIds] })
    setSessionSlide(true)
  }
  function handleSaveSession() {
    const isNew = !editingSession
    const id = editingSession ? editingSession.id : Date.now()
    const nouvelle: Session = { ...sessionForm, id }
    const updated = editingSession
      ? sessions.map(x => x.id === id ? nouvelle : x)
      : [...sessions, nouvelle]
    persistSessions(updated); setSessionSlide(false)

    // Auto-génération du brouillon de groupes pour un NOUVEL atelier qui a au
    // moins une compétence cochée. Ça démarre le travail pour la collaboratrice
    // sans qu'elle ait à aller cliquer sur "Générer" depuis l'onglet brouillon.
    if (isNew && nouvelle.competencesCiblees.length > 0) {
      const inputs: BeneficiairePourGroupage[] = beneficiaires.map(b => ({
        id: b.id, prenom: b.prenom, nom: b.nom,
        dateNaissance: b.dateNaissance, statut: b.statut,
        positionnementInitial: b.positionnementInitial,
      }))
      const brouillon = composerGroupes(nouvelle, inputs)
      saveBrouillon(brouillon)
      setToast({
        message: `Brouillon généré : ${brouillon.groupes.length} groupe${brouillon.groupes.length > 1 ? "s" : ""} proposé${brouillon.groupes.length > 1 ? "s" : ""}.`,
      })
    }
  }
  function handleDeleteSession() {
    if (!editingSession) return
    persistSessions(sessions.filter(x => x.id !== editingSession.id))
    setSessionSlide(false)
  }
  function toggleBenefInSession(id: number) {
    setSessionForm(f => ({
      ...f,
      beneficiaireIds: f.beneficiaireIds.includes(id)
        ? f.beneficiaireIds.filter(x => x !== id)
        : [...f.beneficiaireIds, id],
    }))
  }
  function toggleBenevoleInSession(id: number) {
    setSessionForm(f => ({
      ...f,
      benevoleIds: f.benevoleIds.includes(id)
        ? f.benevoleIds.filter(x => x !== id)
        : [...f.benevoleIds, id],
    }))
  }
  function toggleCompetence(t: Thematique) {
    setSessionForm(f => ({
      ...f,
      competencesCiblees: f.competencesCiblees.includes(t)
        ? f.competencesCiblees.filter(x => x !== t)
        : [...f.competencesCiblees, t],
    }))
  }
  function togglePersonne(id: number) {
    setSessionForm(f => ({
      ...f,
      personnesImpliqueesIds: f.personnesImpliqueesIds.includes(id)
        ? f.personnesImpliqueesIds.filter(x => x !== id)
        : [...f.personnesImpliqueesIds, id],
    }))
  }
  function importGroupeIntoSession(groupeId: number) {
    const g = groupes.find(gr => gr.id === groupeId)
    if (!g) return
    setSessionForm(f => {
      const merged = Array.from(new Set([...f.beneficiaireIds, ...g.beneficiaireIds]))
      return { ...f, beneficiaireIds: merged }
    })
  }

  // ── Groupes CRUD ──
  function persistGroupes(data: Groupe[]) {
    setGroupes(data)
    localStorage.setItem(S_GROUPES, JSON.stringify(data))
  }
  function openNewGroupe() {
    setEditingGroupe(null); setGroupeForm(emptyGroupe()); setGroupeSlide(true)
  }
  function openEditGroupe(g: Groupe) {
    setEditingGroupe(g)
    setGroupeForm({ ...g, beneficiaireIds: [...g.beneficiaireIds] })
    setGroupeSlide(true)
  }
  function handleSaveGroupe() {
    const updated = editingGroupe
      ? groupes.map(x => x.id === editingGroupe.id ? { ...groupeForm, id: editingGroupe.id } : x)
      : [...groupes, { ...groupeForm, id: Date.now() }]
    persistGroupes(updated); setGroupeSlide(false)
  }
  function handleDeleteGroupe() {
    if (!editingGroupe) return
    persistGroupes(groupes.filter(x => x.id !== editingGroupe.id))
    setGroupeSlide(false)
  }
  function toggleBenefInGroupe(id: number) {
    setGroupeForm(f => ({
      ...f,
      beneficiaireIds: f.beneficiaireIds.includes(id)
        ? f.beneficiaireIds.filter(x => x !== id)
        : [...f.beneficiaireIds, id],
    }))
  }
  function updateGroupeMembers(groupeId: number, beneficiaireIds: number[]) {
    persistGroupes(groupes.map(g => g.id === groupeId ? { ...g, beneficiaireIds } : g))
  }

  // ── Derived stats ──
  const aVenir         = sessions.filter(s => s.statut === "planifié" || s.statut === "en cours").length
  const benefActifs    = beneficiaires.filter(b => b.statut === "actif").length
  const groupesCount   = groupes.length

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <header className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Ateliers</h1>
          <p className="text-sm text-muted mt-1">Gestion des sessions et des groupes</p>
        </div>
        <div className="flex gap-2">
          {tab === "ateliers" && (
            <button
              onClick={openNewSession}
              className="flex items-center gap-1.5 text-sm font-medium bg-slate-900 text-white px-4 py-2 rounded-xl hover:bg-slate-700 transition-colors"
            >
              <Plus size={14} /> Nouvel atelier
            </button>
          )}
          {tab === "groupes" && (
            <button
              onClick={openNewGroupe}
              className="flex items-center gap-1.5 text-sm font-medium bg-slate-900 text-white px-4 py-2 rounded-xl hover:bg-slate-700 transition-colors"
            >
              <Plus size={14} /> Nouveau groupe
            </button>
          )}
        </div>
      </header>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-ateliers-light rounded-xl border border-ateliers/20 p-4">
          <p className="text-3xl font-bold text-ateliers-dark">{aVenir}</p>
          <p className="text-sm text-ateliers-dark/70 mt-1">Ateliers à venir</p>
        </div>
        <div className="bg-surface rounded-xl border border-border p-4">
          <p className="text-3xl font-bold text-foreground">{benefActifs}</p>
          <p className="text-sm text-muted mt-1">Bénéficiaires actifs</p>
        </div>
        <div className="bg-surface rounded-xl border border-border p-4">
          <p className="text-3xl font-bold text-foreground">{groupesCount}</p>
          <p className="text-sm text-muted mt-1">Groupes constitués</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-lg w-fit">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === id ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground"
            }`}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "ateliers" && (
        <AteliersTab
          sessions={sessions}
          beneficiaires={beneficiaires}
          benevoles={benevoles}
          groupes={groupes}
          onEdit={openEditSession}
        />
      )}
      {tab === "groupes" && (
        <GroupesTab
          groupes={groupes}
          beneficiaires={beneficiaires}
          onEdit={openEditGroupe}
          onUpdateMembers={updateGroupeMembers}
        />
      )}
      {tab === "brouillon" && (
        <BrouillonGroupesTab
          sessions={sessions}
          beneficiaires={beneficiaires}
          onGroupesValides={(nouveaux, atelierId) => {
            // Remplace les groupes deja rattaches a cet atelier (atelierId
            // identique) — sinon, revalider un brouillon dupliquerait les
            // groupes. Garde tous les autres groupes (autres ateliers + ceux
            // crees a la main avec atelierId null).
            const sansAnciens = groupes.filter(g => g.atelierId !== atelierId)
            persistGroupes([...sansAnciens, ...nouveaux])
          }}
          onAtelierBenefsUpdated={(atelierId, benefIds) => {
            // Met à jour la session source : sa liste de bénéficiaires reflète
            // désormais la composition validée. Affiché dans le sous-onglet Ateliers.
            persistSessions(sessions.map(s =>
              s.id === atelierId ? { ...s, beneficiaireIds: benefIds } : s,
            ))
          }}
          onValidated={() => {
            // Bascule sur l'onglet Groupes pour montrer immédiatement le résultat.
            setTab("groupes")
          }}
        />
      )}

      {/* ════════════════════════════════════════
          SLIDEOVER — Atelier / Session
      ════════════════════════════════════════ */}
      <SlideOver
        open={sessionSlide}
        onClose={() => setSessionSlide(false)}
        title={editingSession ? "Modifier l'atelier" : "Nouvel atelier"}
        width="lg"
      >
        <form onSubmit={e => { e.preventDefault(); handleSaveSession() }} className="flex flex-col gap-4">
          {/* ── Titre ── */}
          <Field label="Titre" required>
            <Input
              placeholder="Ex : Atelier théâtre"
              value={sessionForm.titre}
              onChange={e => setSessionForm(f => ({ ...f, titre: e.target.value }))}
            />
          </Field>

          {/* ── Date + horaires / lieu / encadrant ── */}
          <FormRow>
            <Field label="Date">
              <Input
                type="date"
                value={sessionForm.date}
                onChange={e => setSessionForm(f => ({ ...f, date: e.target.value }))}
              />
            </Field>
            <Field label="Heure">
              <Input
                placeholder="14h00"
                value={sessionForm.heure}
                onChange={e => setSessionForm(f => ({ ...f, heure: e.target.value }))}
              />
            </Field>
          </FormRow>
          <FormRow>
            <Field label="Durée">
              <Input
                placeholder="2h"
                value={sessionForm.duree}
                onChange={e => setSessionForm(f => ({ ...f, duree: e.target.value }))}
              />
            </Field>
            <Field label="Salle">
              <Input
                placeholder="Salle A"
                value={sessionForm.salle}
                onChange={e => setSessionForm(f => ({ ...f, salle: e.target.value }))}
              />
            </Field>
          </FormRow>
          <FormRow>
            <Field label="Formatrice">
              <Input
                placeholder="Somayeh"
                value={sessionForm.formatrice}
                onChange={e => setSessionForm(f => ({ ...f, formatrice: e.target.value }))}
              />
            </Field>
            <Field label="Statut">
              <Select
                value={sessionForm.statut}
                onChange={e => setSessionForm(f => ({ ...f, statut: e.target.value as SessionStatut }))}
              >
                <option>planifié</option>
                <option>en cours</option>
                <option>terminé</option>
                <option>annulé</option>
              </Select>
            </Field>
          </FormRow>

          {/* ── Période concernée (champ libre) ── */}
          <Field label="Période concernée">
            <Input
              placeholder="Ex : Vacances de printemps 2026"
              value={sessionForm.periode}
              onChange={e => setSessionForm(f => ({ ...f, periode: e.target.value }))}
            />
          </Field>

          {/* ── Compétences travaillées ── */}
          <div className="rounded-xl border border-ateliers/30 bg-ateliers-light/40 p-3">
            <p className="text-xs font-semibold text-ateliers-dark uppercase tracking-wider mb-2">
              Compétences travaillées
            </p>
            <p className="text-[11px] text-muted mb-3">
              Cochez les thématiques du test de positionnement qui seront travaillées.
              Elles servent à proposer une composition de groupes adaptée.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {THEMATIQUES.map(t => {
                const checked = sessionForm.competencesCiblees.includes(t.key)
                return (
                  <button
                    type="button"
                    key={t.key}
                    onClick={() => toggleCompetence(t.key)}
                    className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg border font-medium transition-colors ${
                      checked
                        ? "bg-ateliers text-white border-ateliers"
                        : "bg-surface text-muted border-border hover:border-ateliers"
                    }`}
                  >
                    <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                      checked ? "bg-white/20 border-white/40" : "bg-surface border-border"
                    }`}>
                      {checked && <Check size={10} />}
                    </span>
                    {t.label}
                  </button>
                )
              })}
            </div>
            {sessionForm.competencesCiblees.length === 0 && (
              <p className="text-[11px] text-amber-700 mt-2 flex items-center gap-1">
                <AlertTriangle size={11} /> Aucune compétence cochée — l&apos;auto-composition de groupes sera désactivée pour cet atelier.
              </p>
            )}
          </div>

          {/* ── Paramètres de groupage ── */}
          <div className="rounded-xl border border-border bg-surface/50 p-3">
            <p className="text-xs font-semibold text-foreground uppercase tracking-wider mb-3">
              Paramètres de groupage
            </p>
            <p className="text-[11px] text-muted mb-3">
              Définissent comment l&apos;algorithme construira les groupes du brouillon.
              L&apos;âge des bénéficiaires est géré automatiquement par tranches (6-9, 10-13, 14-18 ans).
            </p>
            <FormRow>
              <Field label="Taille de groupe cible">
                <Input
                  type="number" min={2} max={30} placeholder="10"
                  value={sessionForm.tailleGroupeCible ?? ""}
                  onChange={e => setSessionForm(f => ({
                    ...f, tailleGroupeCible: e.target.value === "" ? null : Number(e.target.value),
                  }))}
                />
              </Field>
              <Field label="Ratio encadrement (1 pour N)">
                <Input
                  type="number" min={1} max={20} placeholder="(optionnel)"
                  value={sessionForm.ratioEncadrement ?? ""}
                  onChange={e => setSessionForm(f => ({
                    ...f, ratioEncadrement: e.target.value === "" ? null : Number(e.target.value),
                  }))}
                />
              </Field>
            </FormRow>
            {sessionForm.ratioEncadrement !== null && sessionForm.tailleGroupeCible !== null && (
              <p className="text-[11px] text-muted mt-1">
                → {encadrantsRequis(sessionForm.ratioEncadrement, sessionForm.tailleGroupeCible)} encadrant·es
                requis par groupe de {sessionForm.tailleGroupeCible}.
              </p>
            )}
            <label className="flex items-center gap-2 mt-3 cursor-pointer">
              <input
                type="checkbox"
                checked={sessionForm.mixerNiveaux}
                onChange={e => setSessionForm(f => ({ ...f, mixerNiveaux: e.target.checked }))}
                className="rounded border-border"
              />
              <span className="text-xs text-foreground">
                Mélanger les niveaux <span className="text-muted">(par défaut : groupes homogènes)</span>
              </span>
            </label>
          </div>

          {/* ── Organisation ── */}
          <div className="rounded-xl border border-border bg-surface/50 p-3">
            <p className="text-xs font-semibold text-foreground uppercase tracking-wider mb-3">
              Organisation
            </p>
            <div className="flex flex-col gap-4">
              <Field label="Tâches à faire">
                <EditableList
                  items={sessionForm.taches}
                  onChange={taches => setSessionForm(f => ({ ...f, taches }))}
                  placeholder="Ajouter une tâche"
                />
              </Field>
              <Field label="Besoins matériels / humains">
                <EditableList
                  items={sessionForm.besoins}
                  onChange={besoins => setSessionForm(f => ({ ...f, besoins }))}
                  placeholder="Ajouter un besoin"
                />
              </Field>
              <Field label="Étapes d'organisation">
                <EditableList
                  items={sessionForm.etapes}
                  onChange={etapes => setSessionForm(f => ({ ...f, etapes }))}
                  placeholder="Ajouter une étape"
                  ordered
                />
              </Field>
              <Field label="Personnes impliquées (formatrices / coordinatrices)">
                <div className="flex flex-wrap gap-2">
                  {/* On exclut les bénévoles : ils ont leur propre section ci-dessous,
                      avec leurs compétences spécifiques. Éviter le doublon. */}
                  {membres
                    .filter(m => m.role !== "benevole")
                    .map(m => {
                      const sel = sessionForm.personnesImpliqueesIds.includes(m.id)
                      return (
                        <button
                          type="button"
                          key={m.id}
                          onClick={() => togglePersonne(m.id)}
                          className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
                            sel
                              ? "bg-communication text-white border-communication"
                              : "bg-surface text-muted border-border hover:border-communication"
                          }`}
                        >
                          {m.prenom} {m.nom}
                          <span className="ml-1 opacity-60">· {m.role}</span>
                        </button>
                      )
                    })}
                  {membres.filter(m => m.role !== "benevole").length === 0 && (
                    <p className="text-[11px] text-muted italic">
                      Aucune formatrice / coordinatrice enregistrée. Ajoute-les dans l&apos;onglet Membres.
                    </p>
                  )}
                </div>
              </Field>
            </div>
          </div>

          {/* Bénévoles — multi-select */}
          <Field label="Bénévoles">
            <div className="flex flex-wrap gap-2">
              {benevoles.map(bv => {
                const sel = sessionForm.benevoleIds.includes(bv.id)
                return (
                  <button
                    type="button"
                    key={bv.id}
                    onClick={() => toggleBenevoleInSession(bv.id)}
                    className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
                      sel
                        ? "bg-benevoles text-white border-benevoles"
                        : "bg-surface text-muted border-border hover:border-benevoles"
                    }`}
                  >
                    {bv.nom}
                    {bv.competences.length > 0 && (
                      <span className="ml-1 opacity-60">· {bv.competences.join(", ")}</span>
                    )}
                  </button>
                )
              })}
            </div>
          </Field>

          {/* Bénéficiaires — multi-select */}
          <Field label="Bénéficiaires">
            <div className="flex flex-wrap gap-2 mb-2">
              {beneficiaires.map(b => {
                const sel = sessionForm.beneficiaireIds.includes(b.id)
                return (
                  <button
                    type="button"
                    key={b.id}
                    onClick={() => toggleBenefInSession(b.id)}
                    className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
                      sel
                        ? "bg-ateliers text-white border-ateliers"
                        : "bg-surface text-muted border-border hover:border-ateliers"
                    }`}
                  >
                    {b.prenom} {b.nom}
                  </button>
                )
              })}
            </div>
            {/* Import groupe */}
            {groupes.length > 0 && (
              <div className="mt-2 pt-2 border-t border-border">
                <p className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-2">Importer un groupe</p>
                <div className="flex flex-wrap gap-2">
                  {groupes.map(g => (
                    <button
                      type="button"
                      key={g.id}
                      onClick={() => importGroupeIntoSession(g.id)}
                      className="text-xs px-3 py-1.5 rounded-full border font-medium border-ateliers/40 text-ateliers-dark hover:bg-ateliers-light transition-colors"
                    >
                      + {g.nom}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </Field>

          <SaveButton />
          {editingSession && <DeleteButton onClick={handleDeleteSession} />}
        </form>
      </SlideOver>

      {/* ════════════════════════════════════════
          SLIDEOVER — Groupe
      ════════════════════════════════════════ */}
      <SlideOver
        open={groupeSlide}
        onClose={() => setGroupeSlide(false)}
        title={editingGroupe ? "Modifier le groupe" : "Nouveau groupe"}
        width="lg"
      >
        <form onSubmit={e => { e.preventDefault(); handleSaveGroupe() }} className="flex flex-col gap-4">
          <Field label="Nom" required>
            <Input
              placeholder="Ex : Groupe A – Débutants"
              value={groupeForm.nom}
              onChange={e => setGroupeForm(f => ({ ...f, nom: e.target.value }))}
            />
          </Field>
          <Field label="Type">
            <Select
              value={groupeForm.type}
              onChange={e => setGroupeForm(f => ({ ...f, type: e.target.value as TypeGroupe }))}
            >
              <option value="niveau">Niveau</option>
              <option value="âge">Âge</option>
              <option value="mixte">Mixte</option>
            </Select>
          </Field>
          <Field label="Description">
            <Textarea
              placeholder="Critères de composition du groupe…"
              value={groupeForm.description}
              onChange={e => setGroupeForm(f => ({ ...f, description: e.target.value }))}
            />
          </Field>
          <Field label="Membres">
            <div className="flex flex-wrap gap-2">
              {beneficiaires.map(b => {
                const sel = groupeForm.beneficiaireIds.includes(b.id)
                return (
                  <button
                    type="button"
                    key={b.id}
                    onClick={() => toggleBenefInGroupe(b.id)}
                    className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
                      sel
                        ? "bg-ateliers text-white border-ateliers"
                        : "bg-surface text-muted border-border hover:border-ateliers"
                    }`}
                  >
                    {b.prenom} {b.nom}
                  </button>
                )
              })}
            </div>
          </Field>

          <SaveButton />
          {editingGroupe && <DeleteButton onClick={handleDeleteGroupe} />}
        </form>
      </SlideOver>

      {/* Toast — brouillon généré automatiquement */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-amber-500 text-white rounded-xl shadow-2xl px-5 py-4 flex items-center gap-3 max-w-md animate-in slide-in-from-bottom-2">
          <Sparkles size={18} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">Brouillon de groupes prêt</p>
            <p className="text-xs opacity-90">{toast.message}</p>
          </div>
          <button
            type="button"
            onClick={() => { setTab("brouillon"); setToast(null) }}
            className="text-xs font-semibold bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg whitespace-nowrap"
          >
            Voir →
          </button>
        </div>
      )}
    </div>
  )
}
