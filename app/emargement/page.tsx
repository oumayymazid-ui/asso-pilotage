"use client"

import { useState, useEffect, useCallback } from "react"
import { ChevronDown, ClipboardCheck, CheckCheck } from "lucide-react"

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
  ID_Personne: string
  Statut: string
  Notes: string
}

function normStatut(v: string): PresenceStatus {
  const n = (v ?? "").toLowerCase()
  if (n.startsWith("absent")) return "absent"
  if (n.startsWith("excus")) return "excusé"
  if (n.startsWith("retard")) return "retard"
  return "présent"
}

const S_SELECTED = "asso-emargement-session"

export default function EmargementPage() {
  const [ateliers, setAteliers] = useState<AtelierSheet[]>([])
  const [beneficiaires, setBeneficiaires] = useState<BeneficiaireSheet[]>([])
  const [selectedId, setSelectedId] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [erreur, setErreur] = useState<string | null>(null)

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

  // ── Chargement de la feuille d'émargement quand l'atelier change ──
  const loadRows = useCallback((atelierId: string, roster: BeneficiaireSheet[]) => {
    if (!atelierId) { setRows({}); return }
    fetch(`/api/sheets?action=getAssiduite&idEvenement=${atelierId}`)
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
    if (selectedId) loadRows(selectedId, roster)
    // roster dépend de `ateliers`/`beneficiaires`, déjà stables une fois chargés.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, ateliers, beneficiaires])

  async function persist(personneId: string, statut: PresenceStatus, commentaire: string) {
    setSavingId(personneId)
    try {
      await fetch("/api/sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "upsertAssiduite",
          idEvenement: selectedId,
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
        <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-2">Atelier</label>
        <div className="relative w-full max-w-md">
          <select
            value={selectedId}
            onChange={e => { setSelectedId(e.target.value); localStorage.setItem(S_SELECTED, e.target.value) }}
            className="w-full appearance-none bg-surface border border-border rounded-xl px-4 py-3 pr-10 text-sm font-medium text-foreground cursor-pointer focus:outline-none focus:ring-2 focus:ring-ateliers"
          >
            {ateliers.map(a => (
              <option key={a.ID_Atelier} value={a.ID_Atelier}>
                {[a.Categorie, a.Groupe].filter(Boolean).join(" · ") || a.Titre}
                {a.Audience && ` (${a.Audience})`}
                {a.Date_Debut && ` — ${a.Date_Debut}`}
              </option>
            ))}
          </select>
          <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
        </div>
      </div>

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
