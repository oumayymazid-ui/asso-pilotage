"use client"

import { useState, useEffect, useCallback, useRef, type KeyboardEvent as ReactKeyboardEvent } from "react"
import { ChevronDown, ClipboardCheck, CheckCheck, Search, Check } from "lucide-react"

// ──────────────────────────────────────────────
// Types — lecture depuis Google Sheets (voir app/api/sheets/route.ts)
// ──────────────────────────────────────────────
type PresenceStatus = "présent" | "absent" | "excusé" | "retard"
const STATUTS: PresenceStatus[] = ["présent", "absent", "excusé", "retard"]

interface AtelierSheet {
  ID_Atelier: string
  Categorie: string
  Groupe: string
  Titre: string
  Audience: string
  Date_Debut: string
  Date_Fin: string
  Heure_Debut: string
  Salle: string
  beneficiaireIds: string[]
}
interface BeneficiaireSheet {
  ID_Personne: string
  type: "eleve" | "parent"
  Prenom: string
  Nom: string
}
interface AssiduiteSheet {
  ID_Assiduite: string
  ID_Evenement: string
  ID_Seance: string
  ID_Personne: string
  Statut: string
  Notes: string
}
interface SeanceSheet {
  ID_Seance: string
  ID_Atelier: string
  Nom: string
  Date: string
  Heure_Debut: string
  Heure_Fin: string
  Salle: string
  Statut: string
}

function normStatut(v: string): PresenceStatus {
  const n = (v ?? "").toLowerCase()
  if (n.startsWith("absent")) return "absent"
  if (n.startsWith("excus")) return "excusé"
  if (n.startsWith("retard")) return "retard"
  return "présent"
}

const S_SELECTED = "asso-emargement-session"
const S_SELECTED_SEANCE = "asso-emargement-seance"

/** Convertit "16/02/2026" (format Sheet) en "2026-02-16" pour un tri chronologique correct. */
function frToIsoSort(d: string): string {
  const m = (d ?? "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : (d ?? "")
}

/** Libellé lisible d'un atelier (catégorie · groupe, audience, date). */
function atelierLabel(a: AtelierSheet): string {
  const base = [a.Categorie, a.Groupe].filter(Boolean).join(" · ") || a.Titre
  const audience = a.Audience ? ` (${a.Audience})` : ""
  const date = a.Date_Debut ? ` — ${a.Date_Debut}` : ""
  return `${base}${audience}${date}`
}

/** Normalise (minuscules + sans accents) pour une recherche tolérante. */
const normalize = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()

// ──────────────────────────────────────────────
// Sélecteur d'atelier avec barre de recherche.
// Combobox accessible (clavier + clic) : ouvre un panneau contenant un champ
// de recherche filtrant la liste, pour sélectionner un seul atelier.
// ──────────────────────────────────────────────
function AtelierSelect({
  ateliers,
  selectedId,
  onSelect,
}: {
  ateliers: AtelierSheet[]
  selectedId: string
  onSelect: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [highlight, setHighlight] = useState(0)
  const boxRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = ateliers.find(a => a.ID_Atelier === selectedId)
  const q = normalize(query.trim())
  const filtered = q ? ateliers.filter(a => normalize(atelierLabel(a)).includes(q)) : ateliers

  // Ferme le panneau si clic en dehors.
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onClickOutside)
    return () => document.removeEventListener("mousedown", onClickOutside)
  }, [])

  // Focus le champ de recherche à l'ouverture.
  useEffect(() => {
    if (open) { inputRef.current?.focus(); setHighlight(0) }
  }, [open])

  function choisir(a: AtelierSheet) {
    onSelect(a.ID_Atelier)
    setOpen(false)
    setQuery("")
  }

  function onKeyDown(e: ReactKeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlight(h => Math.min(h + 1, filtered.length - 1)) }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHighlight(h => Math.max(h - 1, 0)) }
    else if (e.key === "Enter") { e.preventDefault(); const a = filtered[highlight]; if (a) choisir(a) }
    else if (e.key === "Escape") { setOpen(false) }
  }

  return (
    <div ref={boxRef} className="relative w-full max-w-md">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-2 bg-surface border border-border rounded-xl px-4 py-3 text-sm font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-ateliers text-left"
      >
        <span className={selected ? "truncate text-foreground" : "truncate text-muted"}>
          {selected ? atelierLabel(selected) : "Sélectionner un atelier…"}
        </span>
        <ChevronDown size={16} className="text-muted shrink-0" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-surface border border-border rounded-xl shadow-lg overflow-hidden">
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => { setQuery(e.target.value); setHighlight(0) }}
                onKeyDown={onKeyDown}
                placeholder="Rechercher un atelier…"
                aria-label="Rechercher un atelier"
                className="w-full text-sm rounded-lg border border-border bg-surface pl-9 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-ateliers/30"
              />
            </div>
          </div>
          <ul role="listbox" className="max-h-60 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted italic">Aucun atelier trouvé.</li>
            ) : (
              filtered.map((a, i) => {
                const isSelected = a.ID_Atelier === selectedId
                return (
                  <li key={a.ID_Atelier} role="option" aria-selected={isSelected}>
                    <button
                      type="button"
                      onClick={() => choisir(a)}
                      onMouseEnter={() => setHighlight(i)}
                      className={`w-full flex items-center gap-2 text-left px-3 py-2 text-sm transition-colors ${
                        i === highlight ? "bg-ateliers-light text-ateliers-dark" : "text-foreground"
                      }`}
                    >
                      <Check size={14} className={isSelected ? "shrink-0 text-ateliers-dark" : "shrink-0 opacity-0"} />
                      <span className="truncate">{atelierLabel(a)}</span>
                    </button>
                  </li>
                )
              })
            )}
          </ul>
        </div>
      )}
    </div>
  )
}

export default function EmargementPage() {
  const [ateliers, setAteliers] = useState<AtelierSheet[]>([])
  const [beneficiaires, setBeneficiaires] = useState<BeneficiaireSheet[]>([])
  const [selectedId, setSelectedId] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [erreur, setErreur] = useState<string | null>(null)

  // ── Séances de l'atelier sélectionné ──
  // "" = pas de séance précise choisie → émargement au niveau de l'atelier entier
  // (rétrocompatible avec les ateliers qui n'ont pas encore de séances définies).
  const [seances, setSeances] = useState<SeanceSheet[]>([])
  const [selectedSeanceId, setSelectedSeanceId] = useState<string>("")

  // État courant de la feuille d'émargement de l'atelier sélectionné :
  // { personneId → { statut, commentaire } }
  const [rows, setRows] = useState<Record<string, { statut: PresenceStatus; commentaire: string }>>({})
  const [savingId, setSavingId] = useState<string | null>(null)

  // ── Chargement initial : tous les ateliers (élèves + parents) + bénéficiaires ──
  useEffect(() => {
    Promise.all([
      fetch("/api/sheets?action=getAteliers").then(r => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))),
      fetch("/api/sheets?action=getBeneficiaires").then(r => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))),
    ])
      .then(([ats, befs]: [AtelierSheet[], BeneficiaireSheet[]]) => {
        setAteliers(ats)
        setBeneficiaires(befs)
        const preSelected = localStorage.getItem(S_SELECTED) ?? ""
        const initial = ats.find(a => a.ID_Atelier === preSelected) ? preSelected : (ats[0]?.ID_Atelier ?? "")
        setSelectedId(initial)
      })
      .catch(e => setErreur(String(e)))
      .finally(() => setLoading(false))
  }, [])

  const atelier = ateliers.find(a => a.ID_Atelier === selectedId)
  const roster = (atelier?.beneficiaireIds ?? [])
    .map(id => beneficiaires.find(b => b.ID_Personne === id))
    .filter((b): b is BeneficiaireSheet => Boolean(b))

  // ── Chargement des séances quand l'atelier change ──
  useEffect(() => {
    if (!selectedId) { setSeances([]); setSelectedSeanceId(""); return }
    fetch(`/api/sheets?action=getSeances&idAtelier=${selectedId}`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((rows: SeanceSheet[]) => {
        const sorted = [...rows].sort((a, b) => frToIsoSort(a.Date).localeCompare(frToIsoSort(b.Date)))
        setSeances(sorted)
        const preSelected = localStorage.getItem(S_SELECTED_SEANCE) ?? ""
        setSelectedSeanceId(sorted.some(s => s.ID_Seance === preSelected) ? preSelected : "")
      })
      .catch(() => { setSeances([]); setSelectedSeanceId("") })
  }, [selectedId])

  // ── Chargement de la feuille d'émargement quand l'atelier ou la séance change ──
  const loadRows = useCallback((atelierId: string, seanceId: string, roster: BeneficiaireSheet[]) => {
    if (!atelierId) { setRows({}); return }
    const params = new URLSearchParams({ action: "getAssiduite", idEvenement: atelierId })
    if (seanceId) params.set("idSeance", seanceId)
    fetch(`/api/sheets?${params.toString()}`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((records: AssiduiteSheet[]) => {
        const byPersonne: Record<string, { statut: PresenceStatus; commentaire: string }> = {}
        roster.forEach(b => { byPersonne[b.ID_Personne] = { statut: "présent", commentaire: "" } })
        records.forEach(r => {
          byPersonne[r.ID_Personne] = { statut: normStatut(r.Statut), commentaire: r.Notes ?? "" }
        })
        setRows(byPersonne)
      })
      .catch(() => setRows({}))
  }, [])

  useEffect(() => {
    if (selectedId) loadRows(selectedId, selectedSeanceId, roster)
    // roster dépend de `ateliers`/`beneficiaires`, déjà stables une fois chargés.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, selectedSeanceId, ateliers, beneficiaires])

  async function persist(personneId: string, statut: PresenceStatus, commentaire: string) {
    setSavingId(personneId)
    try {
      await fetch("/api/sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "upsertAssiduite",
          idEvenement: selectedId,
          idSeance: selectedSeanceId || undefined,
          idPersonne: personneId,
          statut,
          notes: commentaire,
        }),
      })
    } finally {
      setSavingId(null)
    }
  }

  function changeStatut(personneId: string, statut: PresenceStatus) {
    const commentaire = rows[personneId]?.commentaire ?? ""
    setRows(r => ({ ...r, [personneId]: { statut, commentaire } }))
    persist(personneId, statut, commentaire)
  }

  function changeCommentaire(personneId: string, commentaire: string) {
    setRows(r => ({ ...r, [personneId]: { statut: r[personneId]?.statut ?? "présent", commentaire } }))
  }

  // Lit la valeur directement depuis l'événement plutôt que l'état `rows` :
  // au moment du blur, le setRows du onChange précédent peut ne pas avoir
  // encore été appliqué (fermeture obsolète sinon).
  function saveCommentaire(personneId: string, statut: PresenceStatus, commentaire: string) {
    persist(personneId, statut, commentaire)
  }

  async function toutCocherPresent() {
    const updated = { ...rows }
    roster.forEach(b => { updated[b.ID_Personne] = { statut: "présent", commentaire: rows[b.ID_Personne]?.commentaire ?? "" } })
    setRows(updated)
    // Écritures séquentielles : des appends concurrents sur la même feuille
    // Sheets peuvent s'écraser entre eux (pas d'unicité garantie côté API).
    for (const b of roster) {
      await persist(b.ID_Personne, "présent", rows[b.ID_Personne]?.commentaire ?? "")
    }
  }

  const presents = roster.filter(b => (rows[b.ID_Personne]?.statut ?? "présent") === "présent").length

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <header className="mb-6 flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-ateliers-light flex items-center justify-center shrink-0">
          <ClipboardCheck size={20} className="text-ateliers-dark" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Émargement</h1>
          <p className="text-sm text-muted mt-0.5">Feuille de présence par atelier</p>
        </div>
      </header>

      {/* Sélecteur d'atelier */}
      <div className="mb-6">
        <span className="text-xs font-semibold text-muted uppercase tracking-wider block mb-2">Atelier</span>
        <AtelierSelect
          ateliers={ateliers}
          selectedId={selectedId}
          onSelect={id => { setSelectedId(id); localStorage.setItem(S_SELECTED, id) }}
        />
      </div>

      {/* Sélecteur de séance — seulement si l'atelier a des séances définies */}
      {seances.length > 0 && (
        <div className="mb-6">
          <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-2">Séance</label>
          <div className="relative w-full max-w-md">
            <select
              value={selectedSeanceId}
              onChange={e => { setSelectedSeanceId(e.target.value); localStorage.setItem(S_SELECTED_SEANCE, e.target.value) }}
              className="w-full appearance-none bg-surface border border-border rounded-xl px-4 py-3 pr-10 text-sm font-medium text-foreground cursor-pointer focus:outline-none focus:ring-2 focus:ring-ateliers"
            >
              <option value="">Toutes les séances (atelier entier)</option>
              {seances.map(s => (
                <option key={s.ID_Seance} value={s.ID_Seance}>
                  {s.Date}{s.Nom && ` · ${s.Nom}`}
                  {s.Heure_Debut && ` · ${s.Heure_Debut}${s.Heure_Fin ? `–${s.Heure_Fin}` : ""}`}
                </option>
              ))}
            </select>
            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-center text-sm text-muted py-12">Chargement des ateliers depuis Google Sheets…</p>
      ) : erreur ? (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          Impossible de charger les données ({erreur}).
        </div>
      ) : ateliers.length === 0 ? (
        <p className="text-center text-sm text-muted py-12 italic">Aucun atelier disponible.</p>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted">
              {roster.length} participant{roster.length > 1 ? "s" : ""} · {presents} présent{presents > 1 ? "s" : ""}
            </p>
            <button
              type="button"
              onClick={toutCocherPresent}
              disabled={roster.length === 0}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-ateliers-light text-ateliers-dark hover:opacity-80 transition-opacity disabled:opacity-40"
            >
              <CheckCheck size={13} /> Tout cocher présent
            </button>
          </div>

          <div className="bg-surface rounded-xl border border-border overflow-hidden overflow-x-auto">
            {roster.length === 0 ? (
              <p className="text-center text-sm text-muted py-8 italic">
                Aucun bénéficiaire rattaché à cet atelier.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-border text-left">
                    <th className="px-4 py-2.5 font-semibold text-muted text-xs uppercase tracking-wider">Nom</th>
                    <th className="px-4 py-2.5 font-semibold text-muted text-xs uppercase tracking-wider w-40">Statut</th>
                    <th className="px-4 py-2.5 font-semibold text-muted text-xs uppercase tracking-wider">Commentaire</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {roster.map(b => {
                    const row = rows[b.ID_Personne] ?? { statut: "présent" as PresenceStatus, commentaire: "" }
                    return (
                      <tr key={b.ID_Personne}>
                        <td className="px-4 py-2.5">
                          <span className="font-medium text-foreground">{b.Prenom} {b.Nom}</span>
                          <span className="ml-2 text-[10px] text-muted">{b.type === "parent" ? "Parent" : "Élève"}</span>
                        </td>
                        <td className="px-4 py-2.5">
                          <select
                            value={row.statut}
                            onChange={e => changeStatut(b.ID_Personne, e.target.value as PresenceStatus)}
                            disabled={savingId === b.ID_Personne}
                            className="w-full text-sm rounded-lg border border-border bg-surface px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-ateliers/30"
                          >
                            {STATUTS.map(s => (
                              <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-2.5">
                          <input
                            type="text"
                            value={row.commentaire}
                            onChange={e => changeCommentaire(b.ID_Personne, e.target.value)}
                            onBlur={e => saveCommentaire(b.ID_Personne, row.statut, e.target.value)}
                            placeholder="Commentaire…"
                            aria-label={`Commentaire pour ${b.Prenom} ${b.Nom}`}
                            className="w-full text-sm rounded-lg border border-border bg-surface px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-ateliers/30"
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
