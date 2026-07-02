"use client"

import { useState, useEffect } from "react"
import { ateliers as ateliersMock, benevoles as benevolesMock, membres as membresMock } from "@/lib/mock-data"
import {
  THEMATIQUES,
  moyenne as notesMoyenne,
  migrate as migrateBenef,
  emptyNotes,
  type NotesPositionnement,
  type Thematique,
  type TypeBeneficiaire,
} from "@/lib/positionnement"
import {
  emptyFiche,
  migrateFiche,
  encadrantsRequis,
  niveauEcole,
  COULEURS_ATELIER,
  type FicheAtelier,
  type CouleurAtelier,
} from "@/lib/atelier"
import {
  composerGroupes,
  saveBrouillon,
  type BeneficiairePourGroupage,
} from "@/lib/group-composer"
import Link from "next/link"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import {
  Plus, Pencil, CalendarDays, Users, UserCheck, ClipboardCheck,
  X, Columns3, Check, AlertTriangle, Sparkles, Shuffle,
  ChevronDown, ChevronRight, Search, GraduationCap, Eye, UserCog,
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
type Audience      = "eleves" | "parents"

interface Session extends FicheAtelier {
  id: number
  categorie: string        // type d'atelier (Littérature, Théâtre…) → colonne Categorie
  groupe: string           // libellé du groupe/niveau (A1, A2…) → colonne Groupe
  titre: string
  description: string
  date: string             // date de début (et date unique côté parents)
  dateFin: string          // date de fin — élèves uniquement (vide pour les parents)
  heure: string
  duree: string
  salle: string
  beneficiaireIds: number[]
  benevoleIds: number[]
  intervenantIds: number[] // animateurs (table INTERVENANT)
  statut: SessionStatut
}

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
  parentIds: number[]
  // Champs issus du Sheet (INSCRIPTION/EVALUATION) — utilisés au groupage (étape 6).
  niveauClasse?: string   // "6eme", "CM2"… (INSCRIPTION "Niveau / Classe")
  disponibilite?: string  // "Jeudi matin"… (INSCRIPTION "Disponibilite")
  niveauCECRL?: string    // "A2-"… (EVALUATION "Niveau attribue")
  typeApprenant?: string  // "FLE" / "Soutien scolaire"
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
// Lecture depuis Google Sheets (table ATELIER) — étape 3a
// ──────────────────────────────────────────────
// Forme renvoyée par /api/sheets?action=getAteliers (cf. route.ts getAteliers).
interface AtelierSheet {
  ID_Atelier: string
  Categorie: string
  Groupe: string
  Titre: string
  Audience: string
  Date_Debut: string
  Date_Fin: string
  Periode: string
  Heure_Debut: string
  Heure_Fin: string
  Salle: string
  Mode_Groupage: string
  Taille_Cible: string
  Ratio_Encadrement: string
  Competences_Ciblees: string[]
  Taches: string
  Besoins: string
  Etapes: string
  Statut: string
  beneficiaireIds: string[]
  intervenants: { ID_Intervenant: string; Heures: string; Role: string }[]
}

const SESSION_STATUTS: SessionStatut[] = ["planifié", "en cours", "terminé", "annulé"]

/** Convertit une ligne ATELIER du Sheet en Session (forme attendue par la page).
 *  Les champs texte multi-lignes (taches/besoins/etapes) sont éclatés par ligne. */
function atelierFromSheet(a: AtelierSheet): Session {
  const toLines = (s: string) => (s ?? "").split(/\r?\n/).map(x => x.trim()).filter(Boolean)
  const statut = SESSION_STATUTS.includes(a.Statut as SessionStatut)
    ? (a.Statut as SessionStatut)
    : "planifié"
  return {
    id: Number(a.ID_Atelier),
    categorie: a.Categorie || "",
    groupe: a.Groupe || "",
    titre: a.Titre || [a.Categorie, a.Groupe].filter(Boolean).join(" · "),
    description: "",
    date: frToIso(a.Date_Debut),
    dateFin: frToIso(a.Date_Fin),
    heure: a.Heure_Debut || "",
    duree: "",
    salle: a.Salle || "",
    beneficiaireIds: a.beneficiaireIds.map(Number).filter(n => !isNaN(n)),
    benevoleIds: [],
    intervenantIds: a.intervenants.map(i => Number(i.ID_Intervenant)).filter(n => !isNaN(n)),
    statut,
    // Champs FicheAtelier
    audience: a.Audience.toLowerCase().startsWith("parent") ? "parents" : "eleves",
    couleur: "teal",
    competencesCiblees: a.Competences_Ciblees as Thematique[],
    ageMin: null,
    ageMax: null,
    tailleGroupeCible: a.Taille_Cible ? Number(a.Taille_Cible) : null,
    ratioEncadrement: a.Ratio_Encadrement ? Number(a.Ratio_Encadrement) : null,
    mixerNiveaux: false,
    modeGroupage: a.Mode_Groupage === "disponibilite" ? "disponibilite" : "notes",
    taches: toLines(a.Taches),
    besoins: toLines(a.Besoins),
    etapes: toLines(a.Etapes),
    personnesImpliqueesIds: [],
    periode: a.Periode || "",
  }
}

// Forme renvoyée par /api/sheets?action=getBeneficiaires.
interface BeneficiaireSheet {
  ID_Personne: string
  type: TypeBeneficiaire
  Prenom: string
  Nom: string
  Date_Naissance: string
  Email: string
  Telephone: string
  Statut_Inscription: string
  Niveau_Classe: string
  Disponibilite: string
  Type_Apprenant: string
  Niveau_CECRL: string
  notes: NotesPositionnement
}

/** Convertit "14/03/1989" (format Sheet) en "1989-03-14" (parsable par Date). */
function frToIso(d: string): string {
  const m = (d ?? "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : (d ?? "")
}

/** Mappe le statut d'inscription du Sheet vers le statut bénéficiaire de la page. */
function statutFromInscription(s: string): StatutBenef {
  const v = (s ?? "").toLowerCase()
  if (v.includes("diplom")) return "diplômé"
  if (v.includes("arret") || v.includes("abandon")) return "abandon"
  return "actif"
}

function beneficiaireFromSheet(b: BeneficiaireSheet): Beneficiaire {
  return {
    id: Number(b.ID_Personne),
    type: b.type,
    prenom: b.Prenom,
    nom: b.Nom,
    dateNaissance: frToIso(b.Date_Naissance),
    email: b.Email,
    telephone: b.Telephone,
    nomParent: "",
    telephoneParent: "",
    emailParent: "",
    dateInscription: "",
    positionnementInitial: b.notes,
    positionnementFinal: emptyNotes(),
    niveau: "débutant",
    notes: "",
    statut: statutFromInscription(b.Statut_Inscription),
    parentIds: [],
    niveauClasse: b.Niveau_Classe,
    disponibilite: b.Disponibilite,
    niveauCECRL: b.Niveau_CECRL,
    typeApprenant: b.Type_Apprenant,
  }
}

// Forme renvoyée par /api/sheets?action=getIntervenants.
interface IntervenantSheet {
  ID_Intervenant: string
  Nom: string
  Prenom: string
  Type: string
  Email: string
  Telephone: string
  Statut: string
}

// ──────────────────────────────────────────────
// Types d'ateliers (liste déroulante éditable, par audience)
// Stockée en localStorage → l'utilisatrice peut ajouter / supprimer des types.
// ──────────────────────────────────────────────
const DEFAULT_TYPES: Record<Audience, string[]> = {
  eleves:  ["Français intensif", "Littérature", "Exposé", "Théâtre", "Marionnettes"],
  parents: ["Débat", "Biographique", "Numérique", "Tri des déchets", "Sortie bibliothèque"],
}
const S_TYPES = (a: Audience) => `asso-atelier-types-${a}`

/** Sélecteur de type d'atelier avec gestion (ajout / suppression) de la liste. */
function CategorieField({
  audience, value, onChange,
}: { audience: Audience; value: string; onChange: (v: string) => void }) {
  const [types, setTypes] = useState<string[]>(DEFAULT_TYPES[audience])
  const [manage, setManage] = useState(false)
  const [newType, setNewType] = useState("")

  useEffect(() => {
    setTypes(load<string[]>(S_TYPES(audience), DEFAULT_TYPES[audience]))
  }, [audience])

  function persistTypes(t: string[]) {
    setTypes(t)
    localStorage.setItem(S_TYPES(audience), JSON.stringify(t))
  }
  function addType() {
    const v = newType.trim()
    if (v && !types.includes(v)) { persistTypes([...types, v]); onChange(v) }
    setNewType("")
  }
  function removeType(t: string) {
    persistTypes(types.filter(x => x !== t))
    if (value === t) onChange("")
  }

  // Inclut la valeur courante même si absente de la liste (ex : type custom venu du Sheet).
  const options = value && !types.includes(value) ? [value, ...types] : types

  return (
    <div>
      <div className="flex items-center gap-2">
        <Select value={value} onChange={e => onChange(e.target.value)}>
          <option value="">— Choisir un type —</option>
          {options.map(t => <option key={t} value={t}>{t}</option>)}
        </Select>
        <button
          type="button"
          onClick={() => setManage(m => !m)}
          className="text-xs text-muted hover:text-foreground whitespace-nowrap underline"
        >
          Gérer les types
        </button>
      </div>
      {manage && (
        <div className="mt-2 rounded-lg border border-border bg-surface p-2">
          <div className="flex flex-wrap gap-1.5 mb-2">
            {types.map(t => (
              <span key={t} className="text-[11px] bg-slate-100 rounded-full pl-2.5 pr-1 py-0.5 flex items-center gap-1">
                {t}
                <button type="button" onClick={() => removeType(t)} className="text-muted hover:text-red-600" aria-label={`Supprimer ${t}`}>
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={newType}
              onChange={e => setNewType(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addType() } }}
              placeholder="Nouveau type…"
              className="flex-1 px-2.5 py-1 text-xs rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-ateliers/30"
            />
            <button type="button" onClick={addType} className="text-xs font-medium text-ateliers-dark hover:underline flex items-center gap-1">
              <Plus size={11} /> Ajouter
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────
// Sélecteur d'élèves — déroulant recherchable, multi-sélection, compact.
// Pas de filtre de disponibilité (l'asso gère les dispos ailleurs). Affiche la
// classe de l'année courante à côté de chaque nom.
// ──────────────────────────────────────────────
function SelecteurBeneficiaires({
  options, selectedIds, onToggle, placeholder,
}: {
  options: Beneficiaire[]
  selectedIds: number[]
  onToggle: (id: number) => void
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const q = search.trim().toLowerCase()
  const filtered = options.filter(b => !q || `${b.prenom} ${b.nom}`.toLowerCase().includes(q))
  const selected = options.filter(b => selectedIds.includes(b.id))
  const allFilteredSelected = filtered.length > 0 && filtered.every(b => selectedIds.includes(b.id))

  function toggleAllFiltered() {
    filtered.forEach(b => {
      const isSel = selectedIds.includes(b.id)
      if (allFilteredSelected && isSel) onToggle(b.id)
      else if (!allFilteredSelected && !isSel) onToggle(b.id)
    })
  }

  return (
    <div>
      {/* Champ compact */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm rounded-lg border border-border bg-surface hover:border-ateliers transition-colors"
      >
        <span className={selected.length ? "text-foreground" : "text-muted"}>
          {selected.length
            ? `${selected.length} élève${selected.length > 1 ? "s" : ""} sélectionné${selected.length > 1 ? "s" : ""}`
            : (placeholder ?? "Sélectionner des élèves…")}
        </span>
        <ChevronDown size={14} className={`text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {/* Puces des sélectionnés */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {selected.map(b => (
            <span key={b.id} className="text-[11px] bg-ateliers-light text-ateliers-dark rounded-full pl-2.5 pr-1 py-0.5 flex items-center gap-1">
              {b.prenom} {b.nom}
              <button type="button" onClick={() => onToggle(b.id)} className="hover:text-red-600" aria-label={`Retirer ${b.prenom} ${b.nom}`}>
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Panneau déroulant */}
      {open && (
        <div className="mt-2 rounded-xl border border-border bg-surface shadow-sm">
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher un nom…"
                className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-ateliers/30"
              />
            </div>
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="text-[11px] text-muted italic text-center py-4">Aucun élève.</p>
            ) : filtered.map(b => {
              const sel = selectedIds.includes(b.id)
              return (
                <button
                  type="button"
                  key={b.id}
                  onClick={() => onToggle(b.id)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-slate-50 text-left"
                >
                  <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${sel ? "bg-ateliers border-ateliers" : "border-border bg-surface"}`}>
                    {sel && <Check size={11} className="text-white" />}
                  </span>
                  <span className="font-medium text-foreground">{b.prenom} {b.nom}</span>
                  <span className="ml-auto text-[10px] text-muted">{b.niveauClasse || "—"}</span>
                </button>
              )
            })}
          </div>
          {filtered.length > 0 && (
            <div className="p-2 border-t border-border flex items-center justify-between">
              <button type="button" onClick={toggleAllFiltered} className="text-[11px] font-medium text-ateliers-dark hover:underline">
                {allFilteredSelected ? "Tout désélectionner" : "Tout sélectionner"}{q && " (filtré)"}
              </button>
              <button type="button" onClick={() => setOpen(false)} className="text-[11px] text-muted hover:text-foreground">Fermer</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** Même sélecteur compact que SelecteurBeneficiaires, adapté aux intervenants
 *  (table INTERVENANT du Sheet). Utilisé dans le formulaire de création d'atelier,
 *  identique pour l'onglet Parents et l'onglet Enfants (le champ ne dépend pas
 *  de l'audience). */
function SelecteurIntervenants({
  options, selectedIds, onToggle, placeholder,
}: {
  options: IntervenantSheet[]
  selectedIds: number[]
  onToggle: (id: number) => void
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const q = search.trim().toLowerCase()
  const withId = options.map(iv => ({ ...iv, id: Number(iv.ID_Intervenant) }))
  const filtered = withId.filter(iv => !q || `${iv.Prenom} ${iv.Nom}`.toLowerCase().includes(q))
  const selected = withId.filter(iv => selectedIds.includes(iv.id))
  const allFilteredSelected = filtered.length > 0 && filtered.every(iv => selectedIds.includes(iv.id))

  function toggleAllFiltered() {
    filtered.forEach(iv => {
      const isSel = selectedIds.includes(iv.id)
      if (allFilteredSelected && isSel) onToggle(iv.id)
      else if (!allFilteredSelected && !isSel) onToggle(iv.id)
    })
  }

  return (
    <div>
      {/* Champ compact */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm rounded-lg border border-border bg-surface hover:border-benevoles transition-colors"
      >
        <span className={selected.length ? "text-foreground" : "text-muted"}>
          {selected.length
            ? `${selected.length} intervenant${selected.length > 1 ? "s" : ""} sélectionné${selected.length > 1 ? "s" : ""}`
            : (placeholder ?? "Sélectionner des intervenants…")}
        </span>
        <ChevronDown size={14} className={`text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {/* Puces des sélectionnés */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {selected.map(iv => (
            <span key={iv.ID_Intervenant} className="text-[11px] bg-benevoles-light text-benevoles-dark rounded-full pl-2.5 pr-1 py-0.5 flex items-center gap-1">
              {iv.Prenom} {iv.Nom}
              <button type="button" onClick={() => onToggle(iv.id)} className="hover:text-red-600" aria-label={`Retirer ${iv.Prenom} ${iv.Nom}`}>
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Panneau déroulant */}
      {open && (
        <div className="mt-2 rounded-xl border border-border bg-surface shadow-sm">
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher un nom…"
                className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-benevoles/30"
              />
            </div>
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="text-[11px] text-muted italic text-center py-4">Aucun intervenant.</p>
            ) : filtered.map(iv => {
              const sel = selectedIds.includes(iv.id)
              return (
                <button
                  type="button"
                  key={iv.ID_Intervenant}
                  onClick={() => onToggle(iv.id)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-slate-50 text-left"
                >
                  <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${sel ? "bg-benevoles border-benevoles" : "border-border bg-surface"}`}>
                    {sel && <Check size={11} className="text-white" />}
                  </span>
                  <span className="font-medium text-foreground">{iv.Prenom} {iv.Nom}</span>
                  <span className="ml-auto text-[10px] text-muted">{iv.Type || "—"}</span>
                </button>
              )
            })}
          </div>
          {filtered.length > 0 && (
            <div className="p-2 border-t border-border flex items-center justify-between">
              <button type="button" onClick={toggleAllFiltered} className="text-[11px] font-medium text-benevoles-dark hover:underline">
                {allFilteredSelected ? "Tout désélectionner" : "Tout sélectionner"}{q && " (filtré)"}
              </button>
              <button type="button" onClick={() => setOpen(false)} className="text-[11px] text-muted hover:text-foreground">Fermer</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
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
// Palette couleurs ateliers (Lot E)
// Classes Tailwind énumérées en clair pour que le compilateur les détecte
// au build (Tailwind v4 ne génère que les classes présentes dans le code source).
// ──────────────────────────────────────────────
const COULEUR_STYLES: Record<CouleurAtelier, {
  swatch:      string // pastille pleine (picker)
  blockBg:     string // fond du bloc atelier
  blockBorder: string // bordure du bloc atelier
  headerBg:    string // bandeau d'en-tête du bloc
  headerText:  string // texte de l'en-tête
  avatarBg:    string // fond des avatars membres
  avatarText:  string // texte des avatars
  dot:         string // petit dot couleur
}> = {
  teal: {
    swatch: "bg-teal-500", blockBg: "bg-teal-50", blockBorder: "border-teal-200",
    headerBg: "bg-teal-100", headerText: "text-teal-900",
    avatarBg: "bg-teal-200", avatarText: "text-teal-900", dot: "bg-teal-500",
  },
  emerald: {
    swatch: "bg-emerald-500", blockBg: "bg-emerald-50", blockBorder: "border-emerald-200",
    headerBg: "bg-emerald-100", headerText: "text-emerald-900",
    avatarBg: "bg-emerald-200", avatarText: "text-emerald-900", dot: "bg-emerald-500",
  },
  amber: {
    swatch: "bg-amber-500", blockBg: "bg-amber-50", blockBorder: "border-amber-200",
    headerBg: "bg-amber-100", headerText: "text-amber-900",
    avatarBg: "bg-amber-200", avatarText: "text-amber-900", dot: "bg-amber-500",
  },
  orange: {
    swatch: "bg-orange-500", blockBg: "bg-orange-50", blockBorder: "border-orange-200",
    headerBg: "bg-orange-100", headerText: "text-orange-900",
    avatarBg: "bg-orange-200", avatarText: "text-orange-900", dot: "bg-orange-500",
  },
  violet: {
    swatch: "bg-violet-500", blockBg: "bg-violet-50", blockBorder: "border-violet-200",
    headerBg: "bg-violet-100", headerText: "text-violet-900",
    avatarBg: "bg-violet-200", avatarText: "text-violet-900", dot: "bg-violet-500",
  },
  slate: {
    swatch: "bg-slate-500", blockBg: "bg-slate-50", blockBorder: "border-slate-200",
    headerBg: "bg-slate-100", headerText: "text-slate-900",
    avatarBg: "bg-slate-200", avatarText: "text-slate-900", dot: "bg-slate-500",
  },
}

// Picker de couleurs réutilisable (utilisé dans le formulaire d'atelier).
function CouleurPicker({
  value, onChange,
}: { value: CouleurAtelier; onChange: (c: CouleurAtelier) => void }) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Couleur de l'atelier">
      {COULEURS_ATELIER.map(c => {
        const sel = value === c.key
        const styles = COULEUR_STYLES[c.key]
        return (
          <button
            key={c.key}
            type="button"
            role="radio"
            aria-checked={sel}
            aria-label={c.label}
            title={c.label}
            onClick={() => onChange(c.key)}
            className={`relative w-9 h-9 rounded-full transition-transform ${styles.swatch} ${
              sel ? "ring-2 ring-offset-2 ring-foreground scale-110" : "hover:scale-105"
            }`}
          >
            {sel && <Check size={16} className="absolute inset-0 m-auto text-white" aria-hidden="true" />}
          </button>
        )
      })}
    </div>
  )
}

// ──────────────────────────────────────────────
// Sous-composant — Hub cards Enfants / Parents
// Détermine le contexte (audience) pour toute la page Ateliers.
// ──────────────────────────────────────────────
function AudienceHubCards({
  audience, counts, onChange,
}: {
  audience: Audience
  counts: Record<Audience, { ateliers: number; benefs: number }>
  onChange: (a: Audience) => void
}) {
  const hubs: Array<{
    id: Audience
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
      id: "eleves",
      label: "Ateliers enfants",
      sublabel: "Élèves mineurs",
      Icon: GraduationCap,
      bgActive: "bg-ateliers",
      borderInactive: "border-ateliers/30",
      textActive: "text-white",
      textInactive: "text-ateliers-dark",
      iconBg: "bg-ateliers-light",
      iconColor: "text-ateliers-dark",
    },
    {
      id: "parents",
      label: "Ateliers parents",
      sublabel: "Parents / adultes",
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
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6" role="tablist" aria-label="Type d'ateliers">
      {hubs.map(h => {
        const active = audience === h.id
        const c = counts[h.id]
        return (
          <button
            key={h.id}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={`hub-panel-${h.id}`}
            id={`hub-tab-${h.id}`}
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
                  <span className="font-semibold tabular-nums">{c.ateliers}</span> atelier{c.ateliers > 1 ? "s" : ""}
                  <span className="mx-1.5 opacity-50">·</span>
                  <span className="font-semibold tabular-nums">{c.benefs}</span> bénéficiaire{c.benefs > 1 ? "s" : ""}
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
  categorie: "", groupe: "",
  titre: "", description: "", date: new Date().toISOString().split("T")[0], dateFin: "",
  heure: "14h00", duree: "2h", salle: "",
  beneficiaireIds: [], benevoleIds: [], intervenantIds: [], statut: "planifié",
  ...emptyFiche(),
})

const emptyGroupe = (): Omit<Groupe, "id"> => ({
  nom: "", type: "niveau", description: "", beneficiaireIds: [],
  atelierId: null,
})

interface IntervenantForm {
  Nom: string
  Prenom: string
  Type: string
  Email: string
  Telephone: string
  Statut: string
}
const emptyIntervenantForm = (): IntervenantForm => ({
  Nom: "", Prenom: "", Type: "", Email: "", Telephone: "", Statut: "actif",
})

// ══════════════════════════════════════════════
// ONGLET ATELIERS
// ══════════════════════════════════════════════
function AteliersTab({
  sessions, beneficiaires, benevoles, groupes, onEdit, onView, onDelete,
}: {
  sessions: Session[]
  beneficiaires: Beneficiaire[]
  benevoles: typeof benevolesMock.liste
  groupes: Groupe[]
  onEdit: (s: Session) => void
  onView: (s: Session) => void
  onDelete: (id: number) => void
}) {
  // ── Filtres + recherche ──
  const [search, setSearch]            = useState("")
  const [filterBenevole, setFilterBenevole]     = useState<string>("tous")
  const [filterDate, setFilterDate]    = useState<"tous" | "semaine" | "mois" | "moisProchain">("tous")

  // Options déduites des données : bénévoles uniques.
  const benevolesPresents = Array.from(new Set(
    sessions.flatMap(s => s.benevoleIds),
  ))
    .map(id => benevoles.find(bv => bv.id === id))
    .filter((bv): bv is (typeof benevoles)[0] => Boolean(bv))
    .sort((a, b) => a.nom.localeCompare(b.nom))

  // Plages de date pré-calculées (locales, ne se mettent pas à jour pendant
  // que la page est ouverte — acceptable).
  const now = new Date()
  const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay() + 1); startOfWeek.setHours(0, 0, 0, 0)
  const endOfWeek = new Date(startOfWeek); endOfWeek.setDate(startOfWeek.getDate() + 6); endOfWeek.setHours(23, 59, 59, 999)
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
  const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const endOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 2, 0, 23, 59, 59, 999)

  function matchDate(d: Date): boolean {
    if (filterDate === "tous") return true
    if (filterDate === "semaine") return d >= startOfWeek && d <= endOfWeek
    if (filterDate === "mois") return d >= startOfMonth && d <= endOfMonth
    if (filterDate === "moisProchain") return d >= startOfNextMonth && d <= endOfNextMonth
    return true
  }

  const q = search.trim().toLowerCase()
  const matches = (s: Session) => {
    if (q && !s.titre.toLowerCase().includes(q) && !s.description.toLowerCase().includes(q)) return false
    if (filterBenevole !== "tous" && !s.benevoleIds.includes(Number(filterBenevole))) return false
    if (!matchDate(new Date(s.date))) return false
    return true
  }

  const sorted   = [...sessions]
    .filter(matches)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  const upcoming = sorted.filter(s => s.statut !== "terminé" && s.statut !== "annulé")
  const past     = sorted.filter(s => s.statut === "terminé" || s.statut === "annulé")

  const filtreActif = q !== "" || filterBenevole !== "tous" || filterDate !== "tous"
  function resetFiltres() {
    setSearch(""); setFilterBenevole("tous"); setFilterDate("tous")
  }

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
    // Palette pilotée par l'audience pour garder la cohérence avec la card Hub.
    const isParents = s.audience === "parents"
    const chipBgTinted = isParents ? "bg-communication/10"   : "bg-ateliers/10"
    const chipBgLight  = isParents ? "bg-communication-light": "bg-ateliers-light"
    const chipText     = isParents ? "text-communication-dark": "text-ateliers-dark"

    return (
      <li className="px-5 py-4 flex items-start gap-4 hover:bg-slate-50 group">
        {/* Date column */}
        <div className="text-center w-14 shrink-0">
          {(() => {
            const d = new Date(s.date)
            const valide = !isNaN(d.getTime())
            return valide ? (
              <>
                <p className="text-xs text-muted">{d.toLocaleDateString("fr-FR", { weekday: "short" })}</p>
                <p className="text-lg font-bold text-foreground">{d.getDate()}</p>
              </>
            ) : (
              <p className="text-lg font-bold text-muted">—</p>
            )
          })()}
          <p className="text-xs text-muted">{s.heure}</p>
        </div>
        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium text-foreground text-sm">{s.titre}</p>
            {/* Le badge "planifié" suit la couleur du hub pour garder le guide
                visuel ; "en cours" / "terminé" / "annulé" gardent leur sémantique. */}
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
              s.statut === "planifié" && isParents
                ? "bg-communication-light text-communication-dark"
                : statutSessionStyle[s.statut]
            }`}>{s.statut}</span>
          </div>
          {s.description && <p className="text-xs text-muted mt-0.5 truncate">{s.description}</p>}
          {/* Compétences ciblées (Lot 2) */}
          {s.competencesCiblees.length > 0 && (
            <div className="flex items-center gap-1 mt-1.5 flex-wrap">
              {s.competencesCiblees.map(c => {
                const t = THEMATIQUES.find(x => x.key === c)
                return t ? (
                  <span key={c} className={`text-[10px] ${chipBgTinted} ${chipText} px-1.5 py-0.5 rounded font-medium`}>
                    {t.short}
                  </span>
                ) : null
              })}
            </div>
          )}
          <div className="flex items-center gap-3 mt-1.5 flex-wrap text-xs text-muted">
            <span>⏱ {s.duree}</span>
            {s.salle     && <span>📍 {s.salle}</span>}
            {s.periode && (
              <span className={`${chipText} font-medium flex items-center gap-1`}>
                <CalendarDays size={10} /> {s.periode}
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 mt-2 flex-wrap">
            {benefs.length > 0 && (
              <div className="flex items-center gap-1.5">
                <Users size={11} className={chipText} />
                <div className="flex gap-1 flex-wrap">
                  {benefs.map(b => (
                    <span key={b.id} className={`text-[10px] ${chipBgLight} ${chipText} px-1.5 py-0.5 rounded-full`}>
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
                  className={`flex items-center gap-1.5 text-xs font-medium ${chipText} hover:underline`}
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
                            <span className={`text-[10px] ${chipBgLight} ${chipText} px-1.5 py-0.5 rounded-full`}>
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
              className={`flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-lg ${chipBgLight} ${chipText} hover:opacity-80 transition-opacity`}
            >
              <ClipboardCheck size={11} /> Émarger
            </Link>
          )}
          <button onClick={() => onView(s)} className="p-1.5 rounded-lg hover:bg-slate-100 text-muted" aria-label="Voir les détails">
            <Eye size={13} />
          </button>
          <button onClick={() => onEdit(s)} className="p-1.5 rounded-lg hover:bg-slate-100 text-muted" aria-label="Modifier">
            <Pencil size={13} />
          </button>
          <button onClick={() => onDelete(s.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-muted hover:text-red-600" aria-label="Supprimer">
            <X size={13} />
          </button>
        </div>
      </li>
    )
  }

  return (
    <div className="space-y-4">
      {/* ── Filtres + recherche ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Rechercher un atelier (titre, description…)"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-ateliers/30"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
              aria-label="Effacer la recherche"
            >
              <X size={13} />
            </button>
          )}
        </div>
        <select
          value={filterBenevole}
          onChange={e => setFilterBenevole(e.target.value)}
          className="text-sm rounded-xl border border-border bg-surface px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ateliers/30"
        >
          <option value="tous">Tous les bénévoles</option>
          {benevolesPresents.map(bv => (
            <option key={bv.id} value={String(bv.id)}>{bv.nom}</option>
          ))}
        </select>
        <select
          value={filterDate}
          onChange={e => setFilterDate(e.target.value as typeof filterDate)}
          className="text-sm rounded-xl border border-border bg-surface px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ateliers/30"
        >
          <option value="tous">Toutes les dates</option>
          <option value="semaine">Cette semaine</option>
          <option value="mois">Ce mois-ci</option>
          <option value="moisProchain">Mois prochain</option>
        </select>
        {filtreActif && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-muted">
              {upcoming.length + past.length} résultat{upcoming.length + past.length > 1 ? "s" : ""}
            </span>
            <button
              type="button"
              onClick={resetFiltres}
              className="text-xs text-muted hover:text-foreground hover:underline"
            >
              Réinitialiser
            </button>
          </div>
        )}
      </div>

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
      {sessions.length > 0 && upcoming.length === 0 && past.length === 0 && (
        <p className="text-center text-sm text-muted py-12 italic">
          Aucun atelier ne correspond aux filtres actuels.
        </p>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════
// ONGLET GROUPES — lecture depuis le Sheet
// Chaque ligne ATELIER = un groupe. On les regroupe visuellement par TYPE
// (Categorie). Cliquer sur un groupe ouvre l'atelier correspondant.
// ══════════════════════════════════════════════
function GroupesTab({
  sessions, beneficiaires, onEdit, onView, onDelete,
}: {
  sessions: Session[]
  beneficiaires: Beneficiaire[]
  onEdit: (s: Session) => void
  onView: (s: Session) => void
  onDelete: (id: number) => void
}) {
  const [search, setSearch] = useState("")

  function getMembers(s: Session): Beneficiaire[] {
    return s.beneficiaireIds
      .map(id => beneficiaires.find(b => b.id === id))
      .filter((b): b is Beneficiaire => Boolean(b))
  }

  // Un "groupe" = un atelier ayant des membres (issu d'une composition validée
  // OU d'une sélection directe théâtre/marionnettes). Les ateliers "type" sans
  // membres (en attente de composition) ne sont pas listés ici.
  const groupes = sessions.filter(s => s.beneficiaireIds.length > 0)

  const q = search.trim().toLowerCase()
  const filtered = groupes.filter(s => {
    if (!q) return true
    if (s.categorie.toLowerCase().includes(q) || s.groupe.toLowerCase().includes(q)) return true
    return getMembers(s).some(b => `${b.prenom} ${b.nom}`.toLowerCase().includes(q))
  })

  // Regroupement par type (Categorie).
  const byCat = new Map<string, Session[]>()
  for (const s of filtered) {
    const k = s.categorie || "Sans type"
    if (!byCat.has(k)) byCat.set(k, [])
    byCat.get(k)!.push(s)
  }
  const sections = Array.from(byCat.entries())
    .map(([titre, grp]) => ({ titre, groupes: grp, couleur: grp[0]?.couleur ?? "teal" as CouleurAtelier }))
    .sort((a, b) => a.titre.localeCompare(b.titre))

  return (
    <div className="space-y-5">
      {/* ── Recherche ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Rechercher un type, un groupe ou un bénéficiaire…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-ateliers/30"
          />
          {search && (
            <button type="button" onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground" aria-label="Effacer">
              <X size={13} />
            </button>
          )}
        </div>
        {q !== "" && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-muted">{filtered.length} résultat{filtered.length > 1 ? "s" : ""}</span>
            <button type="button" onClick={() => setSearch("")} className="text-xs text-muted hover:text-foreground hover:underline">
              Réinitialiser
            </button>
          </div>
        )}
      </div>

      {/* ── Blocs par type ── */}
      {groupes.length === 0 ? (
        <p className="text-center text-sm text-muted py-12 italic">
          Aucun groupe composé. Crée un atelier puis compose ses groupes dans l&apos;onglet « Brouillon groupes ».
        </p>
      ) : sections.length === 0 ? (
        <p className="text-center text-sm text-muted py-12 italic">Aucun groupe ne correspond à la recherche.</p>
      ) : (
        <div className="space-y-4">
          {sections.map(section => {
            const styles = COULEUR_STYLES[section.couleur]
            return (
              <section
                key={section.titre}
                className={`rounded-xl border ${styles.blockBorder} ${styles.blockBg} overflow-hidden`}
                aria-label={`Groupes du type ${section.titre}`}
              >
                <header className={`${styles.headerBg} px-4 py-3 flex items-center justify-between gap-3 border-b ${styles.blockBorder}`}>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${styles.dot}`} aria-hidden="true" />
                    <h3 className={`text-sm font-semibold truncate ${styles.headerText}`}>{section.titre}</h3>
                  </div>
                  <span className={`text-[11px] font-semibold tabular-nums px-2 py-0.5 rounded-full bg-white/70 ${styles.headerText} shrink-0`}>
                    {section.groupes.length} groupe{section.groupes.length > 1 ? "s" : ""}
                  </span>
                </header>

                <ul className="divide-y divide-white/60">
                  {section.groupes.map(s => {
                    const members = getMembers(s)
                    return (
                      <li
                        key={s.id}
                        onClick={() => onView(s)}
                        className="px-4 py-3 flex items-center gap-4 hover:bg-white/60 cursor-pointer group/row"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{s.groupe.trim() || "Groupe"}</p>
                          {s.periode && <p className="text-[10px] text-muted mt-0.5">{s.periode}</p>}
                        </div>

                        <div className="text-center shrink-0 w-12">
                          <p className="text-lg font-bold text-foreground tabular-nums leading-none">{members.length}</p>
                          <p className="text-[10px] text-muted uppercase tracking-wider mt-0.5">membre{members.length > 1 ? "s" : ""}</p>
                        </div>

                        <div className="shrink-0 min-w-0 max-w-xs">
                          {members.length === 0 ? (
                            <span className="text-[11px] text-muted italic">Aucun membre</span>
                          ) : (
                            <div className="flex -space-x-1.5">
                              {members.slice(0, 5).map(b => (
                                <div
                                  key={b.id}
                                  title={`${b.prenom} ${b.nom}`}
                                  className={`w-7 h-7 rounded-full ${styles.avatarBg} border-2 border-white flex items-center justify-center shrink-0`}
                                >
                                  <span className={`text-[10px] font-bold ${styles.avatarText}`}>{initials(b.prenom, b.nom)}</span>
                                </div>
                              ))}
                              {members.length > 5 && (
                                <div className="w-7 h-7 rounded-full bg-white/80 border-2 border-white flex items-center justify-center shrink-0">
                                  <span className="text-[10px] font-bold text-slate-600">+{members.length - 5}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); onEdit(s) }}
                          className="p-1.5 rounded-lg hover:bg-white text-muted opacity-0 group-hover/row:opacity-100 transition-opacity shrink-0"
                          aria-label="Modifier le groupe"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); onDelete(s.id) }}
                          className="p-1.5 rounded-lg hover:bg-white text-muted hover:text-red-600 opacity-0 group-hover/row:opacity-100 transition-opacity shrink-0"
                          aria-label="Supprimer le groupe"
                        >
                          <X size={13} />
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════
// ONGLET GESTION DES INTERVENANTS — lecture/écriture table INTERVENANT
// ══════════════════════════════════════════════
function IntervenantsTab({
  intervenants, onEdit, onNew,
}: {
  intervenants: IntervenantSheet[]
  onEdit: (iv: IntervenantSheet) => void
  onNew: () => void
}) {
  const [search, setSearch] = useState("")
  const q = search.trim().toLowerCase()
  const filtered = intervenants
    .filter(iv => !q || `${iv.Prenom} ${iv.Nom} ${iv.Type}`.toLowerCase().includes(q))
    .sort((a, b) => `${a.Prenom} ${a.Nom}`.localeCompare(`${b.Prenom} ${b.Nom}`))

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Rechercher un intervenant (nom, type…)"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-benevoles/30"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
              aria-label="Effacer la recherche"
            >
              <X size={13} />
            </button>
          )}
        </div>
        {q !== "" && (
          <span className="text-xs text-muted">{filtered.length} résultat{filtered.length > 1 ? "s" : ""}</span>
        )}
      </div>

      {intervenants.length === 0 ? (
        <div className="text-center py-16 bg-surface rounded-xl border border-border">
          <div className="mx-auto mb-4 inline-flex p-3 rounded-full bg-slate-50">
            <UserCog size={32} className="text-slate-300" />
          </div>
          <p className="font-semibold text-foreground">Aucun intervenant</p>
          <p className="text-sm text-muted mt-1 max-w-md mx-auto">
            Ajoute un premier bénévole, stagiaire ou animateur pour pouvoir le rattacher aux ateliers.
          </p>
          <button
            onClick={onNew}
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium bg-slate-900 text-white px-4 py-2 rounded-xl hover:bg-slate-700 transition-colors"
          >
            <Plus size={14} /> Nouvel intervenant
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-sm text-muted py-12 italic">Aucun intervenant ne correspond à la recherche.</p>
      ) : (
        <ul className="bg-surface rounded-xl border border-border divide-y divide-border overflow-hidden">
          {filtered.map(iv => (
            <li
              key={iv.ID_Intervenant}
              onClick={() => onEdit(iv)}
              className="px-5 py-3.5 flex items-center gap-4 hover:bg-slate-50 cursor-pointer group"
            >
              <div className="w-9 h-9 rounded-full bg-benevoles-light flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-benevoles-dark">{initials(iv.Prenom, iv.Nom)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{iv.Prenom} {iv.Nom}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {iv.Type && (
                    <span className="text-[10px] bg-benevoles-light text-benevoles-dark px-1.5 py-0.5 rounded-full">{iv.Type}</span>
                  )}
                  {iv.Email && <span className="text-[11px] text-muted truncate">{iv.Email}</span>}
                  {iv.Telephone && <span className="text-[11px] text-muted">{iv.Telephone}</span>}
                </div>
              </div>
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ${
                iv.Statut === "inactif" ? "bg-slate-100 text-slate-500" : "bg-green-50 text-green-700"
              }`}>
                {iv.Statut || "actif"}
              </span>
              <button
                type="button"
                onClick={e => { e.stopPropagation(); onEdit(iv) }}
                className="p-1.5 rounded-lg hover:bg-white text-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                aria-label={`Modifier ${iv.Prenom} ${iv.Nom}`}
              >
                <Pencil size={13} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════
// PAGE PRINCIPALE
// ══════════════════════════════════════════════
const TABS = [
  { id: "ateliers",      label: "Ateliers",                icon: CalendarDays },
  { id: "brouillon",     label: "Brouillon groupes",       icon: Shuffle },
  { id: "groupes",       label: "Groupes",                 icon: Columns3 },
  { id: "intervenants",  label: "Gestion des intervenants", icon: UserCog },
] as const

type TabId = (typeof TABS)[number]["id"]

export default function AteliersPage() {
  // ── Audience (hub Enfants / Parents) — synchronisée avec l'URL pour
  //    permettre le partage de liens et préserver l'état au refresh / back. ──
  const searchParams = useSearchParams()
  const router       = useRouter()
  const pathname     = usePathname()
  const audience: Audience = searchParams.get("audience") === "parents" ? "parents" : "eleves"
  function setAudience(a: Audience) {
    const params = new URLSearchParams(searchParams.toString())
    params.set("audience", a)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const [tab, setTab] = useState<TabId>("ateliers")
  const [toast, setToast] = useState<{ message: string } | null>(null)

  // Auto-effacement du toast après 6 s
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 6000)
    return () => clearTimeout(t)
  }, [toast])

  // ── Sessions ──
  const [sessions, setSessions]         = useState<Session[]>([])
  const [sessionSlide, setSessionSlide] = useState(false)
  const [editingSession, setEditingSession] = useState<Session | null>(null)
  const [sessionForm, setSessionForm]   = useState<Omit<Session, "id">>(emptySession())
  const [detailSlide, setDetailSlide]   = useState(false)
  const [viewingSession, setViewingSession] = useState<Session | null>(null)
  /** Brouillon des membres édité depuis la vue « Détails » (onglet Groupes) —
   *  permet d'ajouter/retirer des élèves sans passer par le formulaire complet. */
  const [groupMembersDraft, setGroupMembersDraft] = useState<number[]>([])

  // ── Groupes ──
  const [groupes, setGroupes]           = useState<Groupe[]>(ateliersMock.groupes as Groupe[])
  const [groupeSlide, setGroupeSlide]   = useState(false)
  const [editingGroupe, setEditingGroupe] = useState<Groupe | null>(null)
  const [groupeForm, setGroupeForm]     = useState<Omit<Groupe, "id">>(emptyGroupe())

  // ── Bénéficiaires ──
  const [beneficiaires, setBeneficiaires] = useState<Beneficiaire[]>([])

  // ── Bénévoles (read-only) ──
  const benevoles = benevolesMock.liste

  // ── Intervenants / animateurs (depuis le Sheet, table INTERVENANT) ──
  const [intervenants, setIntervenants] = useState<IntervenantSheet[]>([])
  const [intervenantSlide, setIntervenantSlide] = useState(false)
  const [editingIntervenant, setEditingIntervenant] = useState<IntervenantSheet | null>(null)
  const [intervenantForm, setIntervenantForm] = useState(emptyIntervenantForm())

  function reloadIntervenants() {
    return fetch("/api/sheets?action=getIntervenants")
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((rows: IntervenantSheet[]) => setIntervenants(rows))
      .catch(() => setIntervenants([]))
  }

  // ── Membres (liste éditable côté /membres, on lit depuis localStorage pour
  //    refléter les ajouts/modifs faits sur l'autre page) ──
  type Membre = (typeof membresMock.liste)[number]
  const [membres, setMembres] = useState<Membre[]>(membresMock.liste as Membre[])

  function refreshMembres() {
    setMembres(load<Membre[]>(S_MEMBRES, membresMock.liste as Membre[]))
  }

  // État de chargement des ateliers (lecture asynchrone depuis le Sheet).
  const [loadingAteliers, setLoadingAteliers] = useState(true)
  const [erreurAteliers, setErreurAteliers]   = useState<string | null>(null)

  // Recharge la liste des ateliers depuis le Sheet (appelée au boot + après CRUD).
  function reloadAteliers() {
    setLoadingAteliers(true)
    return fetch("/api/sheets?action=getAteliers")
      .then(r => (r.ok ? r.json() : r.json().then(
        (body: { error?: string }) => Promise.reject(new Error(body.error || `HTTP ${r.status}`)),
        () => Promise.reject(new Error(`HTTP ${r.status}`))
      )))
      .then((rows: AtelierSheet[]) => {
        const sessions = rows.map(atelierFromSheet)
        setSessions(sessions)
        // Cross-module : Communication lit "asso-ateliers-sessions" en lecture seule
        // pour préremplir les participants d'un post lié à un atelier.
        localStorage.setItem(S_SESSIONS, JSON.stringify(sessions))
        setErreurAteliers(null)
      })
      .catch((e: Error) => { setSessions([]); setErreurAteliers(e.message) })
      .finally(() => setLoadingAteliers(false))
  }

  // Hydration
  useEffect(() => {
    // ── Ateliers : lecture depuis Google Sheets (table ATELIER).
    reloadAteliers()
    // ── Bénéficiaires : lecture depuis Google Sheets (PERSONNE/INSCRIPTION/EVALUATION) — étape 3b.
    fetch("/api/sheets?action=getBeneficiaires")
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((rows: BeneficiaireSheet[]) => setBeneficiaires(rows.map(beneficiaireFromSheet)))
      .catch(() => setBeneficiaires([]))
    // ── Intervenants : lecture depuis Google Sheets (table INTERVENANT) — étape 4a.
    reloadIntervenants()
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
    // L'atelier hérite de l'audience du hub courant pour rester dans le contexte.
    setEditingSession(null)
    setSessionForm({ ...emptySession(), audience })
    setSessionSlide(true)
  }
  function openEditSession(s: Session) {
    refreshMembres()
    setDetailSlide(false)
    setEditingSession(s)
    setSessionForm({ ...s, beneficiaireIds: [...s.beneficiaireIds], benevoleIds: [...s.benevoleIds] })
    setSessionSlide(true)
  }
  function openViewSession(s: Session) {
    refreshMembres()
    setViewingSession(s)
    setGroupMembersDraft([...s.beneficiaireIds])
    setDetailSlide(true)
  }
  function toggleGroupMember(id: number) {
    setGroupMembersDraft(ids => ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id])
  }
  /** Enregistre le brouillon de membres édité depuis la vue « Détails » —
   *  ré-utilise atelierPayload pour ne pas écraser les autres champs de l'atelier. */
  async function handleUpdateGroupMembers() {
    if (!viewingSession) return
    const payload = atelierPayload({ ...viewingSession, beneficiaireIds: groupMembersDraft })
    try {
      const res = await fetch("/api/sheets", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "updateAtelier", idAtelier: String(viewingSession.id), ...payload }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      await reloadAteliers()
      setViewingSession(v => v ? { ...v, beneficiaireIds: [...groupMembersDraft] } : v)
      setToast({ message: "Membres du groupe mis à jour dans le Sheet." })
    } catch {
      setToast({ message: "Erreur : la mise à jour des membres a échoué." })
    }
  }
  /** Construit le payload d'écriture ATELIER (colonnes du Sheet) depuis le formulaire. */
  function atelierPayload(f: Omit<Session, "id">) {
    const parDispo = /th[eé][aâ]tre|marionnette/i.test(f.categorie)
    return {
      data: {
        Categorie: f.categorie,
        Groupe: f.groupe,
        Titre: [f.categorie, f.groupe].filter(Boolean).join(" · ") || f.titre,
        Audience: f.audience === "parents" ? "Parent" : "Eleve",
        Date_Debut: f.date,
        Date_Fin: f.audience === "parents" ? "" : f.dateFin,  // pas de date de fin côté parents
        Periode: f.periode,
        Heure_Debut: f.heure,
        Heure_Fin: "",
        Salle: f.salle,
        // Parents & ateliers "classiques" → par notes ; théâtre/marionnettes → par disponibilité.
        Mode_Groupage: f.audience !== "parents" && parDispo ? "disponibilite" : "notes",
        Taille_Cible: f.tailleGroupeCible ?? "",
        Ratio_Encadrement: f.ratioEncadrement ?? "",
        Competences_Ciblees: f.competencesCiblees,
        Taches: f.taches,
        Besoins: f.besoins,
        Etapes: f.etapes,
        Statut: f.statut,
      },
      beneficiaireIds: f.beneficiaireIds,
      intervenantIds: f.intervenantIds,
    }
  }
  async function handleSaveSession() {
    const payload = atelierPayload(sessionForm)
    const body = editingSession
      ? { action: "updateAtelier", idAtelier: String(editingSession.id), ...payload }
      : { action: "addAtelier", ...payload }
    try {
      const res = await fetch("/api/sheets", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setSessionSlide(false)
      await reloadAteliers()
      setToast({ message: editingSession ? "Atelier mis à jour dans le Sheet." : "Atelier créé dans le Sheet." })
    } catch {
      setToast({ message: "Erreur : l'enregistrement dans le Sheet a échoué." })
    }
  }
  async function handleDeleteAtelier(id: number) {
    if (!confirm("Supprimer définitivement cet atelier ?")) return
    try {
      const res = await fetch("/api/sheets", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "deleteAtelier", idAtelier: String(id) }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setSessionSlide(false)
      setDetailSlide(false)
      // Détache les groupes locaux (sous-onglet Groupes, créés à la main) qui
      // référençaient cet atelier — sinon ils gardent un atelierId fantôme.
      persistGroupes(groupes.map(g => g.atelierId === id ? { ...g, atelierId: null } : g))
      await reloadAteliers()
      setToast({ message: "Atelier supprimé du Sheet." })
    } catch {
      setToast({ message: "Erreur : la suppression a échoué." })
    }
  }
  /** CRUD direct (sous-onglet Brouillon groupes) sur un groupe déjà composé —
   *  écrit ses membres dans le Sheet sans passer par un brouillon local.
   *  Rejette en cas d'échec pour que l'appelant ne referme pas l'UI à tort. */
  async function updateGroupeValideMembers(atelierId: number, beneficiaireIds: number[]) {
    const source = sessions.find(s => s.id === atelierId)
    if (!source) throw new Error("Atelier introuvable.")
    const payload = atelierPayload({ ...source, beneficiaireIds })
    try {
      const res = await fetch("/api/sheets", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "updateAtelier", idAtelier: String(atelierId), ...payload }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      await reloadAteliers()
      setToast({ message: "Membres du groupe mis à jour dans le Sheet." })
    } catch (e) {
      setToast({ message: "Erreur : la mise à jour des membres a échoué." })
      throw e
    }
  }
  /** Supprime définitivement un groupe déjà composé (sous-onglet Brouillon groupes). */
  async function deleteGroupeValide(atelierId: number) {
    try {
      const res = await fetch("/api/sheets", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "deleteAtelier", idAtelier: String(atelierId) }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      await reloadAteliers()
      setToast({ message: "Groupe supprimé du Sheet." })
    } catch (e) {
      setToast({ message: "Erreur : la suppression a échoué." })
      throw e
    }
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
  function toggleIntervenantInSession(id: number) {
    setSessionForm(f => ({
      ...f,
      intervenantIds: f.intervenantIds.includes(id)
        ? f.intervenantIds.filter(x => x !== id)
        : [...f.intervenantIds, id],
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

  // ── Intervenants CRUD (table INTERVENANT du Sheet) ──
  function openNewIntervenant() {
    setEditingIntervenant(null)
    setIntervenantForm(emptyIntervenantForm())
    setIntervenantSlide(true)
  }
  function openEditIntervenant(iv: IntervenantSheet) {
    setEditingIntervenant(iv)
    setIntervenantForm({
      Nom: iv.Nom, Prenom: iv.Prenom, Type: iv.Type,
      Email: iv.Email, Telephone: iv.Telephone, Statut: iv.Statut || "actif",
    })
    setIntervenantSlide(true)
  }
  async function handleSaveIntervenant() {
    const body = editingIntervenant
      ? { action: "updateIntervenant", idIntervenant: editingIntervenant.ID_Intervenant, data: intervenantForm }
      : { action: "addIntervenant", data: intervenantForm }
    try {
      const res = await fetch("/api/sheets", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setIntervenantSlide(false)
      await reloadIntervenants()
      setToast({ message: editingIntervenant ? "Intervenant mis à jour dans le Sheet." : "Intervenant créé dans le Sheet." })
    } catch {
      setToast({ message: "Erreur : l'enregistrement dans le Sheet a échoué." })
    }
  }
  async function handleDeleteIntervenant(id: string) {
    if (!confirm("Supprimer définitivement cet intervenant ? Il sera retiré de tous les ateliers où il est rattaché.")) return
    try {
      const res = await fetch("/api/sheets", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "deleteIntervenant", idIntervenant: id }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setIntervenantSlide(false)
      await reloadIntervenants()
      // Rafraîchit les ateliers : leurs intervenantIds dérivés d'ATELIER_PARTICIPANT
      // ont changé côté Sheet suite à la cascade de suppression.
      await reloadAteliers()
      setToast({ message: "Intervenant supprimé du Sheet." })
    } catch {
      setToast({ message: "Erreur : la suppression a échoué." })
    }
  }

  // ── Filtrage par audience (Lot D) ──
  // Une session a un champ `audience` ; on filtre toutes les vues par celui-ci.
  // Pour les groupes : on garde ceux dont l'atelier rattaché correspond à
  // l'audience. Les groupes manuels (atelierId=null) sont neutres et
  // apparaissent dans les deux contextes.
  const sessionsForAudience = sessions.filter(s => s.audience === audience)
  const groupesForAudience  = groupes.filter(g => {
    if (g.atelierId === null) return true
    const atelier = sessions.find(s => s.id === g.atelierId)
    return atelier ? atelier.audience === audience : true
  })

  // Bénéficiaires affichés dans le contexte : élèves pour audience=eleves,
  // parents pour audience=parents.
  const benefsForAudience = beneficiaires.filter(b =>
    audience === "eleves" ? b.type === "eleve" : b.type === "parent",
  )

  // ── Counters pour les cartes Hub (calculés sur les données globales) ──
  const hubCounts: Record<Audience, { ateliers: number; benefs: number }> = {
    eleves: {
      ateliers: sessions.filter(s => s.audience === "eleves").length,
      benefs:   beneficiaires.filter(b => b.type === "eleve").length,
    },
    parents: {
      ateliers: sessions.filter(s => s.audience === "parents").length,
      benefs:   beneficiaires.filter(b => b.type === "parent").length,
    },
  }

  // ── Derived stats (audience-aware) ──
  const aVenir         = sessionsForAudience.filter(s => s.statut === "planifié" || s.statut === "en cours").length
  const benefActifs    = benefsForAudience.filter(b => b.statut === "actif").length
  const groupesCount   = sessionsForAudience.filter(s => s.beneficiaireIds.length > 0).length

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
          {tab === "intervenants" && (
            <button
              onClick={openNewIntervenant}
              className="flex items-center gap-1.5 text-sm font-medium bg-slate-900 text-white px-4 py-2 rounded-xl hover:bg-slate-700 transition-colors"
            >
              <Plus size={14} /> Nouvel intervenant
            </button>
          )}
        </div>
      </header>

      {/* Hub cards Enfants / Parents (Lot D) */}
      <AudienceHubCards audience={audience} counts={hubCounts} onChange={setAudience} />

      {/* Stats bar — audience-aware */}
      <div
        id={`hub-panel-${audience}`}
        role="tabpanel"
        aria-labelledby={`hub-tab-${audience}`}
        className="grid grid-cols-3 gap-4 mb-6"
      >
        <div className={`rounded-xl border p-4 ${audience === "parents" ? "bg-communication-light border-communication/20" : "bg-ateliers-light border-ateliers/20"}`}>
          <p className={`text-3xl font-bold ${audience === "parents" ? "text-communication-dark" : "text-ateliers-dark"}`}>{aVenir}</p>
          <p className={`text-sm mt-1 ${audience === "parents" ? "text-communication-dark/70" : "text-ateliers-dark/70"}`}>Ateliers à venir</p>
        </div>
        <div className="bg-surface rounded-xl border border-border p-4">
          <p className="text-3xl font-bold text-foreground">{benefActifs}</p>
          <p className="text-sm text-muted mt-1">{audience === "parents" ? "Parents actifs" : "Élèves actifs"}</p>
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
        loadingAteliers ? (
          <p className="text-center text-sm text-muted py-12">Chargement des ateliers depuis Google Sheets…</p>
        ) : erreurAteliers ? (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            Impossible de charger les ateliers depuis le Sheet ({erreurAteliers}).
          </div>
        ) : (
          <AteliersTab
            sessions={sessionsForAudience}
            beneficiaires={beneficiaires}
            benevoles={benevoles}
            groupes={groupesForAudience}
            onEdit={openEditSession}
            onView={openViewSession}
            onDelete={handleDeleteAtelier}
          />
        )
      )}
      {tab === "groupes" && (
        loadingAteliers ? (
          <p className="text-center text-sm text-muted py-12">Chargement des groupes depuis Google Sheets…</p>
        ) : (
          <GroupesTab
            sessions={sessionsForAudience}
            beneficiaires={beneficiaires}
            onEdit={openEditSession}
            onView={openViewSession}
            onDelete={handleDeleteAtelier}
          />
        )
      )}
      {tab === "brouillon" && (
        <BrouillonGroupesTab
          sessions={sessionsForAudience}
          beneficiaires={benefsForAudience}
          onGroupesValides={async (nouveaux, atelierId) => {
            // Modèle "1 ligne ATELIER = 1 groupe" : on matérialise chaque groupe
            // composé en une nouvelle ligne ATELIER (même type/dates/compétences
            // que l'atelier "type" d'origine), puis on supprime l'atelier "type".
            const source = sessions.find(s => s.id === atelierId)
            if (!source) throw new Error("Atelier source introuvable.")
            try {
              for (let i = 0; i < nouveaux.length; i++) {
                const g = nouveaux[i]
                const payload = atelierPayload({
                  ...source,
                  groupe: `Groupe ${i + 1}`,
                  beneficiaireIds: g.beneficiaireIds,
                })
                const res = await fetch("/api/sheets", {
                  method: "POST", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "addAtelier", ...payload }),
                })
                if (!res.ok) throw new Error(`HTTP ${res.status}`)
              }
              // Supprime l'atelier "type" — remplacé par les lignes-groupes.
              await fetch("/api/sheets", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "deleteAtelier", idAtelier: String(atelierId) }),
              })
              await reloadAteliers()
              setToast({ message: `${nouveaux.length} groupe${nouveaux.length > 1 ? "s" : ""} créé${nouveaux.length > 1 ? "s" : ""} dans le Sheet.` })
            } catch (e) {
              // Rethrow : le brouillon (sous-onglet Brouillon) doit rester intact
              // et ne pas basculer d'onglet tant que l'écriture Sheet n'a pas réussi.
              setToast({ message: "Erreur lors de la création des groupes dans le Sheet." })
              throw e
            }
          }}
          onAtelierBenefsUpdated={() => {
            // Plus nécessaire : l'atelier "type" est remplacé par les lignes-groupes
            // (chacune porte ses propres bénéficiaires). Conservé pour la signature.
          }}
          onValidated={() => {
            // Bascule sur l'onglet Ateliers pour voir les lignes-groupes créées.
            setTab("ateliers")
          }}
          onUpdateGroupeValide={updateGroupeValideMembers}
          onSupprimerGroupeValide={deleteGroupeValide}
        />
      )}
      {tab === "intervenants" && (
        <IntervenantsTab intervenants={intervenants} onEdit={openEditIntervenant} onNew={openNewIntervenant} />
      )}

      {/* ════════════════════════════════════════
          SLIDEOVER — Détails de l'atelier (lecture seule)
      ════════════════════════════════════════ */}
      <SlideOver
        open={detailSlide}
        onClose={() => setDetailSlide(false)}
        title="Détails de l'atelier"
        width="lg"
      >
        {viewingSession && (() => {
          const s = viewingSession
          const bvls = s.benevoleIds
            .map(id => benevoles.find(bv => bv.id === id))
            .filter((bv): bv is (typeof benevoles)[0] => Boolean(bv))
          const intervs = s.intervenantIds
            .map(id => intervenants.find(iv => Number(iv.ID_Intervenant) === id))
            .filter((iv): iv is IntervenantSheet => Boolean(iv))
          const groupesAtelier = groupes.filter(g => g.atelierId === s.id)
          return (
            <div className="flex flex-col gap-5">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-semibold text-foreground">
                    {s.titre || [s.categorie, s.groupe].filter(Boolean).join(" · ")}
                  </h3>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statutSessionStyle[s.statut]}`}>
                    {s.statut}
                  </span>
                </div>
                <p className="text-xs text-muted mt-0.5">
                  {s.audience === "parents" ? "Parents" : "Élèves"} · {s.categorie}{s.groupe && ` · ${s.groupe}`}
                </p>
                {s.description && <p className="text-sm text-foreground mt-2">{s.description}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-[11px] text-muted">Date{s.dateFin ? " de début" : ""}</p>
                  <p className="text-foreground">{s.date || "—"}</p>
                </div>
                {s.dateFin && (
                  <div>
                    <p className="text-[11px] text-muted">Date de fin</p>
                    <p className="text-foreground">{s.dateFin}</p>
                  </div>
                )}
                <div>
                  <p className="text-[11px] text-muted">Heure</p>
                  <p className="text-foreground">{s.heure || "—"}</p>
                </div>
                <div>
                  <p className="text-[11px] text-muted">Durée</p>
                  <p className="text-foreground">{s.duree || "—"}</p>
                </div>
                <div>
                  <p className="text-[11px] text-muted">Salle</p>
                  <p className="text-foreground">{s.salle || "—"}</p>
                </div>
                {s.periode && (
                  <div className="col-span-2">
                    <p className="text-[11px] text-muted">Période</p>
                    <p className="text-foreground">{s.periode}</p>
                  </div>
                )}
              </div>

              {s.competencesCiblees.length > 0 && (
                <div>
                  <p className="text-[11px] text-muted mb-1.5">Compétences ciblées</p>
                  <div className="flex flex-wrap gap-1.5">
                    {s.competencesCiblees.map(c => {
                      const t = THEMATIQUES.find(x => x.key === c)
                      return t ? (
                        <span key={c} className="text-[11px] bg-ateliers-light text-ateliers-dark px-2 py-0.5 rounded-full font-medium">
                          {t.short}
                        </span>
                      ) : null
                    })}
                  </div>
                </div>
              )}

              {(s.taches.length > 0 || s.besoins.length > 0 || s.etapes.length > 0) && (
                <div className="grid grid-cols-1 gap-3">
                  {s.taches.length > 0 && (
                    <div>
                      <p className="text-[11px] text-muted mb-1">Tâches</p>
                      <ul className="text-sm text-foreground list-disc list-inside space-y-0.5">
                        {s.taches.map((t, i) => <li key={i}>{t}</li>)}
                      </ul>
                    </div>
                  )}
                  {s.besoins.length > 0 && (
                    <div>
                      <p className="text-[11px] text-muted mb-1">Besoins</p>
                      <ul className="text-sm text-foreground list-disc list-inside space-y-0.5">
                        {s.besoins.map((t, i) => <li key={i}>{t}</li>)}
                      </ul>
                    </div>
                  )}
                  {s.etapes.length > 0 && (
                    <div>
                      <p className="text-[11px] text-muted mb-1">Étapes</p>
                      <ul className="text-sm text-foreground list-disc list-inside space-y-0.5">
                        {s.etapes.map((t, i) => <li key={i}>{t}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              <div>
                <p className="text-[11px] text-muted mb-1.5">
                  {s.audience === "parents" ? "Parents" : "Élèves"} du groupe ({groupMembersDraft.length})
                </p>
                <SelecteurBeneficiaires
                  options={beneficiaires.filter(b => b.type === (s.audience === "parents" ? "parent" : "eleve"))}
                  selectedIds={groupMembersDraft}
                  onToggle={toggleGroupMember}
                  placeholder={s.audience === "parents" ? "Sélectionner des parents…" : "Sélectionner des élèves…"}
                />
                <button
                  type="button"
                  onClick={handleUpdateGroupMembers}
                  className="mt-2 w-full text-xs font-medium bg-ateliers-light text-ateliers-dark py-2 rounded-lg hover:bg-ateliers/20 transition-colors"
                >
                  Enregistrer les membres
                </button>
              </div>

              <div>
                <p className="text-[11px] text-muted mb-1.5">Intervenants ({intervs.length})</p>
                {intervs.length === 0 ? (
                  <p className="text-sm text-muted italic">Aucun intervenant rattaché.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {intervs.map(iv => (
                      <span key={iv.ID_Intervenant} className="text-[11px] bg-benevoles-light text-benevoles-dark px-2 py-0.5 rounded-full">
                        {iv.Prenom} {iv.Nom}{iv.Type && ` · ${iv.Type}`}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {bvls.length > 0 && (
                <div>
                  <p className="text-[11px] text-muted mb-1.5">Bénévoles ({bvls.length})</p>
                  <div className="flex flex-wrap gap-1.5">
                    {bvls.map(bv => (
                      <span key={bv.id} className="text-[11px] bg-benevoles-light text-benevoles-dark px-2 py-0.5 rounded-full">
                        {bv.nom}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {groupesAtelier.length > 0 && (
                <div>
                  <p className="text-[11px] text-muted mb-1.5">Groupes rattachés ({groupesAtelier.length})</p>
                  <div className="flex flex-col gap-1.5">
                    {groupesAtelier.map(g => (
                      <span key={g.id} className="text-sm text-foreground bg-slate-50 border border-border rounded-lg px-3 py-1.5">
                        {g.nom}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => openEditSession(s)}
                  className="w-full bg-slate-900 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-700 transition-colors"
                >
                  Modifier
                </button>
                <DeleteButton onClick={() => handleDeleteAtelier(s.id)} />
              </div>
            </div>
          )
        })()}
      </SlideOver>

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
          {/* ── Type d'atelier + groupe ── */}
          <FormRow>
            <Field label="Type d'atelier" required>
              <CategorieField
                audience={sessionForm.audience}
                value={sessionForm.categorie}
                onChange={c => setSessionForm(f => ({ ...f, categorie: c }))}
              />
            </Field>
            <Field label="Groupe / niveau">
              <Input
                placeholder="Ex : A1"
                value={sessionForm.groupe}
                onChange={e => setSessionForm(f => ({ ...f, groupe: e.target.value }))}
              />
            </Field>
          </FormRow>

          {/* ── Dates — élèves : début + fin (atelier sur plusieurs jours) ;
              parents : date unique (séance ponctuelle). ── */}
          {sessionForm.audience === "parents" ? (
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
          ) : (
            <>
              <FormRow>
                <Field label="Date de début">
                  <Input
                    type="date"
                    value={sessionForm.date}
                    onChange={e => setSessionForm(f => ({ ...f, date: e.target.value }))}
                  />
                </Field>
                <Field label="Date de fin">
                  <Input
                    type="date"
                    value={sessionForm.dateFin}
                    onChange={e => setSessionForm(f => ({ ...f, dateFin: e.target.value }))}
                  />
                </Field>
              </FormRow>
              <Field label="Heure">
                <Input
                  placeholder="14h00"
                  value={sessionForm.heure}
                  onChange={e => setSessionForm(f => ({ ...f, heure: e.target.value }))}
                />
              </Field>
            </>
          )}
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
            {/* ── Période concernée (champ libre) ── */}
            <Field label="Période concernée">
              <Input
                placeholder="Ex : Vacances de printemps 2026"
                value={sessionForm.periode}
                onChange={e => setSessionForm(f => ({ ...f, periode: e.target.value }))}
              />
            </Field>
          </FormRow>

          {/* ── Couleur de l'atelier (Lot E — vue Groupes) ── */}
          <Field label="Couleur de l'atelier">
            <p className="text-[11px] text-muted mb-2">
              Sert à distinguer visuellement les ateliers dans la vue Groupes.
            </p>
            <CouleurPicker
              value={sessionForm.couleur}
              onChange={c => setSessionForm(f => ({ ...f, couleur: c }))}
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

          {/* ── Paramètres de groupage ──
              Pour les ateliers parents : ni notion d'âge, ni ratio d'encadrement. */}
          <div className="rounded-xl border border-border bg-surface/50 p-3">
            <p className="text-xs font-semibold text-foreground uppercase tracking-wider mb-3">
              Paramètres de groupage
            </p>
            <p className="text-[11px] text-muted mb-3">
              Définissent comment l&apos;algorithme construira les groupes du brouillon.
              {sessionForm.audience !== "parents" && " L'âge des bénéficiaires est géré automatiquement par tranches (6-9, 10-13, 14-18 ans)."}
            </p>
            {sessionForm.audience === "parents" ? (
              <Field label="Taille de groupe cible">
                <Input
                  type="number" min={2} max={30} placeholder="10"
                  value={sessionForm.tailleGroupeCible ?? ""}
                  onChange={e => setSessionForm(f => ({
                    ...f, tailleGroupeCible: e.target.value === "" ? null : Number(e.target.value),
                  }))}
                />
              </Field>
            ) : (
              <>
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
              </>
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
            </div>
          </div>

          {/* Intervenants / animateurs — sélecteur compact recherchable (table INTERVENANT
              du Sheet). Remplace les anciennes sections « Bénévoles » et « Personnes
              impliquées ». Champ commun aux deux audiences (onglet Parents / onglet Enfants) :
              il n'est pas conditionné par sessionForm.audience. */}
          <Field label="Intervenants / animateurs">
            {intervenants.length === 0 ? (
              <p className="text-[11px] text-muted italic">
                Aucun intervenant enregistré. Ajoute-les dans l&apos;onglet INTERVENANT du Google Sheet.
              </p>
            ) : (
              <SelecteurIntervenants
                options={intervenants}
                selectedIds={sessionForm.intervenantIds}
                onToggle={toggleIntervenantInSession}
                placeholder="Sélectionner des intervenants…"
              />
            )}
          </Field>

          {/* Élèves — UNIQUEMENT pour théâtre / marionnettes : sélection manuelle
              (par disponibilité, gérée hors appli). Liste pré-filtrée par niveau
              d'école selon le type. Pour les autres types, la composition se fait
              dans l'onglet « Brouillon groupes ». */}
          {/th[eé][aâ]tre|marionnette/i.test(sessionForm.categorie) && sessionForm.audience !== "parents" && (() => {
            const estMarionnettes = /marionnette/i.test(sessionForm.categorie)
            const niveauxOk: (ReturnType<typeof niveauEcole>)[] = estMarionnettes
              ? ["elementaire", "6e"]
              : ["college", "lycee", "6e"]
            const pool = beneficiaires.filter(b => {
              if (b.type !== "eleve") return false
              const n = niveauEcole(b.niveauClasse)
              return n === null || niveauxOk.includes(n)   // classe inconnue → laissée dispo
            })
            return (
              <Field label="Élèves">
                <p className="text-[11px] text-muted mb-2">
                  {estMarionnettes
                    ? "Marionnettes : élèves d'élémentaire (CP→CM2) et 6e."
                    : "Théâtre : collégiens (5e→3e), lycéens, et 6e (facultatif)."}
                </p>
                <SelecteurBeneficiaires
                  options={pool}
                  selectedIds={sessionForm.beneficiaireIds}
                  onToggle={toggleBenefInSession}
                  placeholder="Sélectionner des élèves…"
                />
              </Field>
            )
          })()}

          <SaveButton />
          {editingSession && <DeleteButton onClick={() => handleDeleteAtelier(editingSession.id)} />}
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
          <FormRow>
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
            <Field label="Atelier rattaché">
              <Select
                value={groupeForm.atelierId === null ? "" : String(groupeForm.atelierId)}
                onChange={e => setGroupeForm(f => ({
                  ...f,
                  atelierId: e.target.value === "" ? null : Number(e.target.value),
                }))}
              >
                <option value="">— Aucun (manuel) —</option>
                {sessions
                  .filter(s => s.statut !== "annulé")
                  .sort((a, b) => a.titre.localeCompare(b.titre))
                  .map(s => (
                    <option key={s.id} value={String(s.id)}>{s.titre}</option>
                  ))}
              </Select>
            </Field>
          </FormRow>
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

      {/* ════════════════════════════════════════
          SLIDEOVER — Intervenant (table INTERVENANT du Sheet)
      ════════════════════════════════════════ */}
      <SlideOver
        open={intervenantSlide}
        onClose={() => setIntervenantSlide(false)}
        title={editingIntervenant ? "Modifier l'intervenant" : "Nouvel intervenant"}
        width="md"
      >
        <form onSubmit={e => { e.preventDefault(); handleSaveIntervenant() }} className="flex flex-col gap-4">
          <FormRow>
            <Field label="Prénom" required>
              <Input
                value={intervenantForm.Prenom}
                onChange={e => setIntervenantForm(f => ({ ...f, Prenom: e.target.value }))}
              />
            </Field>
            <Field label="Nom" required>
              <Input
                value={intervenantForm.Nom}
                onChange={e => setIntervenantForm(f => ({ ...f, Nom: e.target.value }))}
              />
            </Field>
          </FormRow>
          <FormRow>
            <Field label="Type">
              <Input
                placeholder="Bénévole, Stagiaire, Salarié·e…"
                value={intervenantForm.Type}
                onChange={e => setIntervenantForm(f => ({ ...f, Type: e.target.value }))}
              />
            </Field>
            <Field label="Statut">
              <Select
                value={intervenantForm.Statut}
                onChange={e => setIntervenantForm(f => ({ ...f, Statut: e.target.value }))}
              >
                <option value="actif">Actif</option>
                <option value="inactif">Inactif</option>
              </Select>
            </Field>
          </FormRow>
          <FormRow>
            <Field label="Email">
              <Input
                type="email"
                value={intervenantForm.Email}
                onChange={e => setIntervenantForm(f => ({ ...f, Email: e.target.value }))}
              />
            </Field>
            <Field label="Téléphone">
              <Input
                value={intervenantForm.Telephone}
                onChange={e => setIntervenantForm(f => ({ ...f, Telephone: e.target.value }))}
              />
            </Field>
          </FormRow>

          <SaveButton />
          {editingIntervenant && (
            <DeleteButton onClick={() => handleDeleteIntervenant(editingIntervenant.ID_Intervenant)} />
          )}
        </form>
      </SlideOver>

      {/* Toast — confirmation d'action (création / mise à jour / suppression) */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white rounded-xl shadow-2xl px-5 py-4 flex items-center gap-3 max-w-md animate-in slide-in-from-bottom-2">
          <Sparkles size={18} />
          <p className="text-sm font-medium flex-1 min-w-0">{toast.message}</p>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-xs font-semibold bg-white/20 hover:bg-white/30 px-2 py-1 rounded-lg"
            aria-label="Fermer"
          >
            <X size={13} />
          </button>
        </div>
      )}
    </div>
  )
}
