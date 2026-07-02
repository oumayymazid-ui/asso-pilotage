"use client"

import { useState, useEffect } from "react"
import { StickyNote, Search, GraduationCap, UserCheck, Sparkles, X } from "lucide-react"
import { NIVEAUX_CECRL } from "@/lib/positionnement"

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────
type Session = "initial" | "final"
type TypeBenef = "eleve" | "parent"

interface BeneficiaireRow {
  id: string
  type: TypeBenef
  prenom: string
  nom: string
}

interface EvalForm {
  idEvaluation: string | null
  niveau: string
  compEcrite: string
  compOrale: string
  exprEcrite: string
  exprOrale: string
  date: string
  evaluateur: string
}

function emptyEvalForm(): EvalForm {
  return { idEvaluation: null, niveau: "", compEcrite: "", compOrale: "", exprEcrite: "", exprOrale: "", date: "", evaluateur: "" }
}

// Forme renvoyée par /api/sheets?action=getBeneficiaires (cf. route.ts getBeneficiaires).
interface BeneficiaireSheet {
  ID_Personne: string
  type: TypeBenef
  Prenom: string
  Nom: string
}

// Forme renvoyée par /api/sheets?action=getEvaluations (cf. route.ts getEvaluations).
interface EvaluationSheet {
  ID_Evaluation: string
  ID_Personne: string
  Session: Session
  Date: string
  Niveau: string
  Comprehension_Ecrite: number | null
  Comprehension_Orale: number | null
  Expression_Ecrite: number | null
  Expression_Orale: number | null
  Evaluateur: string
}

const SESSIONS: { key: Session; label: string }[] = [
  { key: "initial", label: "Évaluation initiale" },
  { key: "final", label: "Évaluation finale" },
]

export default function NotesPage() {
  const [session, setSession] = useState<Session>("initial")
  const [beneficiaires, setBeneficiaires] = useState<BeneficiaireRow[]>([])
  const [evaluations, setEvaluations] = useState<Record<string, Record<Session, EvalForm>>>({})
  const [search, setSearch] = useState("")
  const [typeFiltre, setTypeFiltre] = useState<"tous" | TypeBenef>("tous")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string } | null>(null)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  function reload() {
    setLoading(true)
    Promise.all([
      fetch("/api/sheets?action=getBeneficiaires").then(r => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))),
      fetch("/api/sheets?action=getEvaluations").then(r => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))),
    ])
      .then(([benefRows, evalRows]: [BeneficiaireSheet[], EvaluationSheet[]]) => {
        setBeneficiaires(
          benefRows
            .map(b => ({ id: b.ID_Personne, type: b.type, prenom: b.Prenom, nom: b.Nom }))
            .sort((a, b) => `${a.prenom} ${a.nom}`.localeCompare(`${b.prenom} ${b.nom}`)),
        )
        const map: Record<string, Record<Session, EvalForm>> = {}
        for (const e of evalRows) {
          const pid = e.ID_Personne
          if (!map[pid]) map[pid] = { initial: emptyEvalForm(), final: emptyEvalForm() }
          map[pid][e.Session] = {
            idEvaluation: e.ID_Evaluation,
            niveau: e.Niveau ?? "",
            compEcrite: e.Comprehension_Ecrite === null ? "" : String(e.Comprehension_Ecrite),
            compOrale: e.Comprehension_Orale === null ? "" : String(e.Comprehension_Orale),
            exprEcrite: e.Expression_Ecrite === null ? "" : String(e.Expression_Ecrite),
            exprOrale: e.Expression_Orale === null ? "" : String(e.Expression_Orale),
            date: e.Date ?? "",
            evaluateur: e.Evaluateur ?? "",
          }
        }
        setEvaluations(map)
        setError(null)
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { reload() }, [])

  function getForm(id: string): EvalForm {
    return evaluations[id]?.[session] ?? emptyEvalForm()
  }

  function updateLocal(id: string, patch: Partial<EvalForm>) {
    setEvaluations(m => {
      const current = m[id] ?? { initial: emptyEvalForm(), final: emptyEvalForm() }
      return { ...m, [id]: { ...current, [session]: { ...current[session], ...patch } } }
    })
  }

  async function saveRow(id: string) {
    const form = getForm(id)
    setSavingId(id)
    try {
      const res = await fetch("/api/sheets", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "upsertEvaluation",
          idPersonne: id,
          session,
          data: {
            Niveau: form.niveau,
            Comprehension_Ecrite: form.compEcrite === "" ? "" : Number(form.compEcrite),
            Comprehension_Orale: form.compOrale === "" ? "" : Number(form.compOrale),
            Expression_Ecrite: form.exprEcrite === "" ? "" : Number(form.exprEcrite),
            Expression_Orale: form.exprOrale === "" ? "" : Number(form.exprOrale),
            Date: form.date,
            Evaluateur: form.evaluateur,
          },
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      updateLocal(id, { idEvaluation: json.ID_Evaluation })
    } catch {
      setToast({ message: "Erreur : l'enregistrement de la note a échoué." })
    } finally {
      setSavingId(null)
    }
  }

  async function clearRow(id: string) {
    const form = getForm(id)
    if (!form.idEvaluation) return
    if (!confirm("Effacer cette évaluation ?")) return
    setSavingId(id)
    try {
      const res = await fetch("/api/sheets", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "deleteEvaluation", idEvaluation: form.idEvaluation }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      updateLocal(id, emptyEvalForm())
    } catch {
      setToast({ message: "Erreur : la suppression a échoué." })
    } finally {
      setSavingId(null)
    }
  }

  const q = search.trim().toLowerCase()
  const filtres = beneficiaires.filter(b => {
    if (typeFiltre !== "tous" && b.type !== typeFiltre) return false
    if (q && !`${b.prenom} ${b.nom}`.toLowerCase().includes(q)) return false
    return true
  })
  const nbEvalues = beneficiaires.filter(b => {
    const f = evaluations[b.id]?.[session]
    return f && f.idEvaluation !== null
  }).length

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <StickyNote size={22} className="text-positionnement-dark" />
          Notes
        </h1>
        <p className="text-sm text-muted mt-1">
          Saisie rapide des notes d&apos;évaluation des élèves et parents.
        </p>
      </header>

      {/* Toggle Évaluation initiale / finale */}
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
          {SESSIONS.map(s => (
            <button
              key={s.key}
              onClick={() => setSession(s.key)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                session === s.key ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        {!loading && !error && (
          <p className="text-xs text-muted">
            {nbEvalues} / {beneficiaires.length} évalué{nbEvalues > 1 ? "s" : ""} ({SESSIONS.find(s => s.key === session)?.label.toLowerCase()})
          </p>
        )}
      </div>

      {/* Filtres + recherche */}
      <div className="flex items-center gap-2 flex-wrap mb-4">
        <div className="relative flex-1 min-w-48">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Rechercher un élève ou un parent…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-positionnement/30"
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
          value={typeFiltre}
          onChange={e => setTypeFiltre(e.target.value as "tous" | TypeBenef)}
          className="text-sm rounded-xl border border-border bg-surface px-3 py-2 focus:outline-none focus:ring-2 focus:ring-positionnement/30"
        >
          <option value="tous">Tous</option>
          <option value="eleve">Élèves</option>
          <option value="parent">Parents</option>
        </select>
        {(q !== "" || typeFiltre !== "tous") && (
          <span className="text-xs text-muted">{filtres.length} résultat{filtres.length > 1 ? "s" : ""}</span>
        )}
      </div>

      {/* Suggestions pour le champ Niveau — saisie libre acceptée (ex : niveaux
          intermédiaires "A2+/B1") au-delà de ces valeurs courantes. */}
      <datalist id="niveaux-cecrl">
        {NIVEAUX_CECRL.map(n => <option key={n} value={n} />)}
      </datalist>

      {loading ? (
        <p className="text-center text-sm text-muted py-12">Chargement depuis Google Sheets…</p>
      ) : error ? (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          Impossible de charger les données depuis le Sheet ({error}).
        </div>
      ) : filtres.length === 0 ? (
        <p className="text-center text-sm text-muted py-12 italic">Aucun bénéficiaire ne correspond à la recherche.</p>
      ) : (
        <div className="bg-surface rounded-xl border border-border overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-border text-left">
                <th className="px-4 py-2.5 font-semibold text-muted text-xs uppercase tracking-wider">Nom</th>
                <th className="px-3 py-2.5 font-semibold text-muted text-xs uppercase tracking-wider w-28">Niveau</th>
                <th className="px-3 py-2.5 font-semibold text-muted text-xs uppercase tracking-wider w-24">Comp. écrite</th>
                <th className="px-3 py-2.5 font-semibold text-muted text-xs uppercase tracking-wider w-24">Comp. orale</th>
                <th className="px-3 py-2.5 font-semibold text-muted text-xs uppercase tracking-wider w-24">Expr. écrite</th>
                <th className="px-3 py-2.5 font-semibold text-muted text-xs uppercase tracking-wider w-24">Expr. orale</th>
                <th className="px-3 py-2.5 font-semibold text-muted text-xs uppercase tracking-wider w-36">Date</th>
                <th className="px-3 py-2.5 font-semibold text-muted text-xs uppercase tracking-wider">Évaluateur</th>
                <th className="px-3 py-2.5 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtres.map(b => {
                const form = getForm(b.id)
                const busy = savingId === b.id
                const Icon = b.type === "parent" ? UserCheck : GraduationCap
                return (
                  <tr key={b.id} className={busy ? "opacity-60" : undefined}>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <span className="flex items-center gap-1.5">
                        <Icon size={12} className={b.type === "parent" ? "text-communication-dark" : "text-ateliers-dark"} />
                        <span className="font-medium text-foreground">{b.prenom} {b.nom}</span>
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        list="niveaux-cecrl"
                        value={form.niveau}
                        onChange={e => updateLocal(b.id, { niveau: e.target.value })}
                        onBlur={() => saveRow(b.id)}
                        disabled={busy}
                        placeholder="—"
                        title="Ex : A2+, B1- — ou un niveau intermédiaire comme A2+/B1"
                        className="w-full text-sm rounded-lg border border-border bg-surface px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-positionnement/30"
                      />
                    </td>
                    {(["compEcrite", "compOrale", "exprEcrite", "exprOrale"] as const).map(field => (
                      <td key={field} className="px-3 py-2">
                        <input
                          type="number" min={0} max={20} step={0.5}
                          value={form[field]}
                          onChange={e => updateLocal(b.id, { [field]: e.target.value })}
                          onBlur={() => saveRow(b.id)}
                          disabled={busy}
                          placeholder="—"
                          className="w-full text-sm rounded-lg border border-border bg-surface px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-positionnement/30"
                        />
                      </td>
                    ))}
                    <td className="px-3 py-2">
                      <input
                        type="date"
                        value={form.date}
                        onChange={e => updateLocal(b.id, { date: e.target.value })}
                        onBlur={() => saveRow(b.id)}
                        disabled={busy}
                        className="w-full text-sm rounded-lg border border-border bg-surface px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-positionnement/30"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={form.evaluateur}
                        onChange={e => updateLocal(b.id, { evaluateur: e.target.value })}
                        onBlur={() => saveRow(b.id)}
                        disabled={busy}
                        placeholder="Nom…"
                        className="w-full text-sm rounded-lg border border-border bg-surface px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-positionnement/30"
                      />
                    </td>
                    <td className="px-3 py-2">
                      {form.idEvaluation && (
                        <button
                          type="button"
                          onClick={() => clearRow(b.id)}
                          disabled={busy}
                          title="Effacer cette évaluation"
                          aria-label={`Effacer l'évaluation de ${b.prenom} ${b.nom}`}
                          className="p-1.5 rounded-lg text-muted hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                        >
                          <X size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Toast — confirmation d'erreur */}
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
