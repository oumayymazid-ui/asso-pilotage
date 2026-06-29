"use client"

import { useState, useEffect, useCallback } from "react"
import { Input } from "@/components/SlideOver"
import { Plus, X, CheckCircle2, Circle, Calendar } from "lucide-react"
import { fetchTaches, addTache, updateTache, deleteTache, type TacheSheet } from "@/lib/sheets-api"

function isoVersFr(iso?: string) {
  if (!iso) return ""
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso
}

function aujourdhuiIso() {
  const d = new Date()
  const p2 = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`
}

export default function TachesBlock({ cibleType, cibleId }: { cibleType: "Membre" | "Famille"; cibleId: string }) {
  const [taches, setTaches] = useState<TacheSheet[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [titre, setTitre] = useState("")
  const [echeance, setEcheance] = useState("")
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try { setTaches(await fetchTaches(cibleType, cibleId)) }
    catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [cibleType, cibleId])

  useEffect(() => { load() }, [load])

  async function handleAdd() {
    if (!titre.trim()) return
    setSaving(true)
    try {
      await addTache({ Cible_Type: cibleType, Cible_ID: cibleId, Titre: titre.trim(), Echeance: echeance, Statut: "A faire" })
      await load()
      setTitre(""); setEcheance(""); setAdding(false)
    } catch (e) { console.error(e) }
    finally { setSaving(false) }
  }

  async function toggle(t: TacheSheet) {
    await updateTache(t.ID_Tache, { Statut: t.Statut === "Fait" ? "A faire" : "Fait" })
    await load()
  }

  async function supprimer(id: string) {
    if (!confirm("Supprimer cette tâche ?")) return
    await deleteTache(id)
    await load()
  }

  const today = aujourdhuiIso()
  // tri : à faire d'abord (par échéance croissante), puis faites
  const triees = [...taches].sort((a, b) => {
    const af = a.Statut === "Fait", bf = b.Statut === "Fait"
    if (af !== bf) return af ? 1 : -1
    return (a.Echeance || "9999").localeCompare(b.Echeance || "9999")
  })
  const nbAFaire = taches.filter(t => t.Statut !== "Fait").length

  return (
    <div className="bg-surface border border-border rounded-xl p-5 mb-6">
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <h2 className="text-sm font-semibold text-foreground">
          Tâches
          {nbAFaire > 0 && <span className="ml-2 text-xs font-normal text-muted">({nbAFaire} à faire)</span>}
        </h2>
        {!adding && (
          <button onClick={() => { setTitre(""); setEcheance(""); setAdding(true) }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-familles text-white text-xs font-medium hover:bg-familles-dark transition-colors">
            <Plus size={13} />Tâche
          </button>
        )}
      </div>

      {adding && (
        <div className="flex flex-col gap-3 mb-4 bg-slate-50 rounded-lg p-3">
          <Input value={titre} onChange={e => setTitre(e.target.value)} placeholder="Que faut-il faire ?" />
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-sm text-muted">
              <Calendar size={14} />
              <span>Échéance</span>
            </div>
            <input type="date" value={echeance} onChange={e => setEcheance(e.target.value)}
              className="px-3 py-2 rounded-xl border border-border bg-surface text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ateliers" />
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleAdd} disabled={saving || !titre.trim()}
              className="px-4 py-2 rounded-lg bg-familles text-white text-sm font-medium hover:bg-familles-dark transition-colors disabled:opacity-60">
              {saving ? "Enregistrement…" : "Ajouter la tâche"}
            </button>
            <button onClick={() => { setAdding(false); setTitre(""); setEcheance("") }} disabled={saving}
              className="px-4 py-2 rounded-lg bg-slate-100 text-slate-600 text-sm font-medium hover:bg-slate-200 transition-colors">Annuler</button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted">Chargement…</p>
      ) : triees.length === 0 && !adding ? (
        <p className="text-sm text-muted italic">Aucune tâche. Cliquez sur « Tâche » pour en créer une.</p>
      ) : (
        <ul className="space-y-2">
          {triees.map(t => {
            const fait = t.Statut === "Fait"
            const enRetard = !fait && t.Echeance && t.Echeance < today
            return (
              <li key={t.ID_Tache} className="flex items-start gap-2.5 group">
                <button onClick={() => toggle(t)} className="mt-0.5 shrink-0" aria-label={fait ? "Marquer à faire" : "Marquer faite"}>
                  {fait
                    ? <CheckCircle2 size={18} className="text-finances-dark" />
                    : <Circle size={18} className="text-muted hover:text-familles-dark transition-colors" />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm ${fait ? "line-through text-muted" : "text-foreground"}`}>{t.Titre}</p>
                  {t.Echeance && (
                    <p className={`text-xs mt-0.5 flex items-center gap-1 ${enRetard ? "text-absences-dark font-medium" : "text-muted"}`}>
                      <Calendar size={11} />
                      {isoVersFr(t.Echeance)}{enRetard ? " · en retard" : ""}
                    </p>
                  )}
                </div>
                <button onClick={() => supprimer(t.ID_Tache)} aria-label="Supprimer cette tâche" title="Supprimer"
                  className="shrink-0 p-1 rounded text-muted hover:text-absences-dark hover:bg-absences-light transition-colors">
                  <X size={14} />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
