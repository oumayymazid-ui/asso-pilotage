"use client"

import { useState, useEffect, useMemo } from "react"
import { ateliers as ateliersMock } from "@/lib/mock-data"
import {
  BarChart2, AlertTriangle, Users, CheckCircle,
  Clock, GraduationCap, CalendarDays, ChevronDown,
} from "lucide-react"

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────
type PresenceStatus = "présent" | "absent" | "excusé" | "retard"
type Periode = "tout" | "mois" | "semaine"
type SortKey = "nom" | "tauxPresence" | "absents" | "seances"
type SortDir = "asc" | "desc"

interface Session {
  id: number
  titre: string
  date: string
  heure: string
  salle: string
  formatrice: string
  beneficiaireIds: number[]
  statut: string
}

interface Beneficiaire {
  id: number
  prenom: string
  nom: string
  niveau: string
  statut: string
}

interface StudentStats {
  benef: Beneficiaire
  seances: number
  presents: number
  absents: number
  excuses: number
  retards: number
  tauxPresence: number
}

interface GroupStats {
  nom: string
  eleves: number
  presents: number
  absents: number
  seancesTotal: number
  tauxPresence: number
  alertes: number
}

// ──────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────
const S_SESSIONS  = "asso-ateliers-sessions"
const S_BENEF     = "asso-beneficiaires"
const S_PRESENCES = (id: number) => `asso-presences-atelier-${id}`
const SEUIL_ALERTE = 3

const GROUPES = ["Débutants", "Intermédiaires", "Avancées"]

const NIVEAU_TO_GROUPE: Record<string, string> = {
  "débutant":       "Débutants",
  "intermédiaire":  "Intermédiaires",
  "avancé":         "Avancées",
}

const GROUPE_COLORS: Record<string, { bg: string; text: string; border: string; bar: string }> = {
  "Débutants":      { bg: "bg-ateliers-light",      text: "text-ateliers-dark",      border: "border-ateliers/20",      bar: "bg-ateliers" },
  "Intermédiaires": { bg: "bg-communication-light",  text: "text-communication-dark",  border: "border-communication/20",  bar: "bg-communication" },
  "Avancées":       { bg: "bg-finances-light",        text: "text-finances-dark",        border: "border-finances/20",        bar: "bg-finances" },
}

const PERIODE_LABELS: Record<Periode, string> = {
  tout:    "Toute la période",
  mois:    "Ce mois",
  semaine: "Cette semaine",
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────
function loadJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback
  try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : fallback } catch { return fallback }
}

function isInPeriod(dateStr: string, periode: Periode): boolean {
  const date = new Date(dateStr)
  const now  = new Date()
  if (periode === "tout") return true
  if (periode === "mois") {
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
  }
  // "semaine" — lundi au dimanche de la semaine courante
  const startW = new Date(now)
  const day = now.getDay()
  startW.setDate(now.getDate() - (day === 0 ? 6 : day - 1))
  startW.setHours(0, 0, 0, 0)
  const endW = new Date(startW)
  endW.setDate(startW.getDate() + 6)
  endW.setHours(23, 59, 59, 999)
  return date >= startW && date <= endW
}

function presenceBar(taux: number) {
  if (taux >= 80) return "bg-finances"
  if (taux >= 60) return "bg-absences"
  return "bg-alert"
}

function presenceText(taux: number) {
  if (taux >= 80) return "text-finances-dark"
  if (taux >= 60) return "text-absences-dark"
  return "text-alert"
}

// ──────────────────────────────────────────────
// Page
// ──────────────────────────────────────────────
export default function AssiduiteePage() {
  const [sessions, setSessions]         = useState<Session[]>(ateliersMock.sessions as Session[])
  const [beneficiaires, setBenef]       = useState<Beneficiaire[]>(ateliersMock.beneficiaires as Beneficiaire[])
  const [allPresences, setAllPresences] = useState<Record<number, Record<number, PresenceStatus>>>({})
  const [periode, setPeriode]           = useState<Periode>("tout")
  const [sortKey, setSortKey]           = useState<SortKey>("tauxPresence")
  const [sortDir, setSortDir]           = useState<SortDir>("asc")

  useEffect(() => {
    const loadedSessions = loadJson<Session[]>(S_SESSIONS, ateliersMock.sessions as Session[])
    const loadedBenefs   = loadJson<Beneficiaire[]>(S_BENEF, ateliersMock.beneficiaires as Beneficiaire[])
    setSessions(loadedSessions)
    setBenef(loadedBenefs)

    const combined: Record<number, Record<number, PresenceStatus>> = {}
    loadedSessions.forEach(s => {
      const p = loadJson<Record<number, PresenceStatus>>(S_PRESENCES(s.id), {})
      if (Object.keys(p).length > 0) combined[s.id] = p
    })
    setAllPresences(combined)
  }, [])

  // Sessions filtrées par période
  const filteredSessions = useMemo(
    () => sessions.filter(s => isInPeriod(s.date, periode)),
    [sessions, periode]
  )

  // Stats par élève
  const studentStats = useMemo((): StudentStats[] => {
    return beneficiaires
      .filter(b => b.statut === "actif")
      .map(b => {
        const mySeances = filteredSessions.filter(s => (s.beneficiaireIds ?? []).includes(b.id))
        let presents = 0, absents = 0, excuses = 0, retards = 0
        mySeances.forEach(s => {
          const status: PresenceStatus = (allPresences[s.id] ?? {})[b.id] ?? "présent"
          if (status === "présent") presents++
          else if (status === "absent")  absents++
          else if (status === "excusé")  excuses++
          else if (status === "retard")  retards++
        })
        const total        = mySeances.length
        const tauxPresence = total > 0 ? Math.round((presents / total) * 100) : 100
        return { benef: b, seances: total, presents, absents, excuses, retards, tauxPresence }
      })
  }, [beneficiaires, filteredSessions, allPresences])

  // Tri du tableau
  const sortedStats = useMemo(() => {
    return [...studentStats].sort((a, b) => {
      let va: string | number
      let vb: string | number
      if (sortKey === "nom") {
        va = `${a.benef.nom} ${a.benef.prenom}`
        vb = `${b.benef.nom} ${b.benef.prenom}`
      } else if (sortKey === "tauxPresence") {
        va = a.tauxPresence; vb = b.tauxPresence
      } else if (sortKey === "absents") {
        va = a.absents; vb = b.absents
      } else {
        va = a.seances; vb = b.seances
      }
      if (typeof va === "string") {
        return sortDir === "asc" ? va.localeCompare(vb as string) : (vb as string).localeCompare(va)
      }
      return sortDir === "asc" ? va - (vb as number) : (vb as number) - va
    })
  }, [studentStats, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc")
    else { setSortKey(key); setSortDir("asc") }
  }

  // Alertes
  const alertes = studentStats.filter(s => s.absents >= SEUIL_ALERTE)
  const risque  = studentStats.filter(s => s.absents === SEUIL_ALERTE - 1)

  // Stats globales
  const globalPresents = studentStats.reduce((acc, s) => acc + s.presents, 0)
  const globalTotal    = studentStats.reduce((acc, s) => acc + s.seances, 0)
  const globalAbsents  = studentStats.reduce((acc, s) => acc + s.absents, 0)
  const tauxGlobal     = globalTotal > 0 ? Math.round((globalPresents / globalTotal) * 100) : 0

  // Stats par groupe
  const groupStats = useMemo((): GroupStats[] => {
    return GROUPES.map(g => {
      const members  = studentStats.filter(s => (NIVEAU_TO_GROUPE[s.benef.niveau] ?? s.benef.niveau) === g)
      const total    = members.reduce((acc, s) => acc + s.seances, 0)
      const presents = members.reduce((acc, s) => acc + s.presents, 0)
      const absents  = members.reduce((acc, s) => acc + s.absents, 0)
      const taux     = total > 0 ? Math.round((presents / total) * 100) : 0
      return {
        nom: g,
        eleves:       members.length,
        seancesTotal: total,
        presents,
        absents,
        tauxPresence: taux,
        alertes:      members.filter(s => s.absents >= SEUIL_ALERTE).length,
      }
    })
  }, [studentStats])

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* En-tête */}
      <header className="mb-6 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-absences-light flex items-center justify-center shrink-0">
            <BarChart2 size={20} className="text-absences-dark" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Hub Assiduité</h1>
            <p className="text-sm text-muted mt-0.5">
              Taux de présence · Alertes décrochage · Vue par groupe et par élève
            </p>
          </div>
        </div>
        {/* Filtre période */}
        <div className="flex items-center gap-1 bg-surface border border-border rounded-xl p-1 shrink-0">
          {(["tout", "mois", "semaine"] as Periode[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriode(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                periode === p ? "bg-absences text-white" : "text-muted hover:text-foreground"
              }`}
            >
              {PERIODE_LABELS[p]}
            </button>
          ))}
        </div>
      </header>

      {/* KPI globaux */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-surface rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle size={15} className="text-finances" />
            <span className="text-[10px] font-semibold text-muted uppercase tracking-wider">Présence globale</span>
          </div>
          <p className="text-3xl font-bold text-foreground">{tauxGlobal}%</p>
          <div className="h-1.5 rounded-full bg-border mt-2 mb-1">
            <div className={`h-full rounded-full ${presenceBar(tauxGlobal)}`} style={{ width: `${tauxGlobal}%` }} />
          </div>
          <p className="text-xs text-muted">{globalPresents} présences · {globalTotal} créneaux</p>
        </div>

        <div className="bg-surface rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <BarChart2 size={15} className="text-absences" />
            <span className="text-[10px] font-semibold text-muted uppercase tracking-wider">Absentéisme</span>
          </div>
          <p className="text-3xl font-bold text-absences-dark">{globalTotal > 0 ? Math.round((globalAbsents / globalTotal) * 100) : 0}%</p>
          <div className="h-1.5 rounded-full bg-border mt-2 mb-1">
            <div className="h-full rounded-full bg-absences" style={{ width: `${globalTotal > 0 ? Math.round((globalAbsents / globalTotal) * 100) : 0}%` }} />
          </div>
          <p className="text-xs text-muted">{globalAbsents} absences · {globalTotal} créneaux</p>
        </div>

        <div className="bg-surface rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={15} className="text-alert" />
            <span className="text-[10px] font-semibold text-muted uppercase tracking-wider">Alertes actives</span>
          </div>
          <p className="text-3xl font-bold text-alert">{alertes.length}</p>
          <p className="text-xs text-muted mt-3">
            {risque.length > 0
              ? <span className="text-absences-dark font-medium">{risque.length} élève{risque.length > 1 ? "s" : ""} en risque</span>
              : "Aucun élève en risque"
            }
          </p>
        </div>

        <div className="bg-surface rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <CalendarDays size={15} className="text-muted" />
            <span className="text-[10px] font-semibold text-muted uppercase tracking-wider">Séances analysées</span>
          </div>
          <p className="text-3xl font-bold text-foreground">{filteredSessions.length}</p>
          <p className="text-xs text-muted mt-3">
            {studentStats.filter(s => s.seances > 0).length} élève{studentStats.filter(s => s.seances > 0).length > 1 ? "s" : ""} concerné{studentStats.filter(s => s.seances > 0).length > 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Alertes décrochage */}
      {(alertes.length > 0 || risque.length > 0) && (
        <section className="mb-8">
          <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
            <AlertTriangle size={13} className="text-alert" />
            Alertes décrochage
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {alertes.map(s => (
              <div key={s.benef.id} className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="inline-flex items-center gap-1 bg-alert text-white text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0">
                      <AlertTriangle size={9} /> ALERTE
                    </span>
                    <span className="text-xs text-muted truncate">
                      {NIVEAU_TO_GROUPE[s.benef.niveau] ?? s.benef.niveau}
                    </span>
                  </div>
                  <p className="font-semibold text-foreground">{s.benef.prenom} {s.benef.nom}</p>
                  <p className="text-xs text-muted mt-0.5">
                    {s.absents} abs. · {s.excuses} excusé{s.excuses > 1 ? "s" : ""} · {s.seances} séances
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-2xl font-bold text-alert">{s.tauxPresence}%</p>
                  <p className="text-xs text-muted">présence</p>
                </div>
              </div>
            ))}
            {risque.map(s => (
              <div key={s.benef.id} className="bg-absences-light border border-absences/30 rounded-xl p-4 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="inline-flex items-center gap-1 bg-absences text-white text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0">
                      <Clock size={9} /> RISQUE
                    </span>
                    <span className="text-xs text-muted truncate">
                      {NIVEAU_TO_GROUPE[s.benef.niveau] ?? s.benef.niveau}
                    </span>
                  </div>
                  <p className="font-semibold text-foreground">{s.benef.prenom} {s.benef.nom}</p>
                  <p className="text-xs text-absences-dark/70 mt-0.5">
                    {s.absents} abs. · encore 1 → décrochage
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-2xl font-bold text-absences-dark">{s.tauxPresence}%</p>
                  <p className="text-xs text-muted">présence</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Vue par groupe */}
      <section className="mb-8">
        <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
          <Users size={13} />
          Vue par groupe
        </h2>
        <div className="grid grid-cols-3 gap-4">
          {groupStats.map(g => {
            const c = GROUPE_COLORS[g.nom] ?? { bg: "bg-slate-100", text: "text-slate-700", border: "border-slate-200", bar: "bg-slate-400" }
            return (
              <div key={g.nom} className={`rounded-xl border p-5 ${c.bg} ${c.border}`}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className={`font-semibold text-sm ${c.text}`}>{g.nom}</h3>
                  {g.alertes > 0 && (
                    <span className="flex items-center gap-0.5 text-xs font-bold text-alert">
                      <AlertTriangle size={11} /> {g.alertes} alerte{g.alertes > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                <p className={`text-4xl font-bold ${c.text} mb-0.5`}>{g.tauxPresence}%</p>
                <p className={`text-xs ${c.text} opacity-60 mb-3`}>taux de présence</p>
                <div className="h-1.5 rounded-full bg-white/60 mb-4 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${c.bar} transition-all`}
                    style={{ width: `${g.tauxPresence}%` }}
                  />
                </div>
                <div className={`grid grid-cols-3 gap-2 text-center ${c.text}`}>
                  <div>
                    <p className="font-bold text-sm">{g.eleves}</p>
                    <p className="text-[10px] opacity-60">élèves</p>
                  </div>
                  <div>
                    <p className="font-bold text-sm">{g.presents}</p>
                    <p className="text-[10px] opacity-60">présences</p>
                  </div>
                  <div>
                    <p className="font-bold text-sm">{g.absents}</p>
                    <p className="text-[10px] opacity-60">absences</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Tableau détaillé par élève */}
      <section>
        <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
          <GraduationCap size={13} />
          Détail par élève
        </h2>
        <div className="bg-surface rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-slate-50">
                {/* Élève */}
                <th className="text-left px-5 py-3">
                  <button
                    onClick={() => toggleSort("nom")}
                    className="flex items-center gap-1 text-xs font-semibold text-muted uppercase tracking-wider hover:text-foreground transition-colors"
                  >
                    Élève
                    <ChevronDown size={11} className={`transition-transform ${sortKey === "nom" && sortDir === "desc" ? "rotate-180" : ""} ${sortKey !== "nom" ? "opacity-30" : ""}`} />
                  </button>
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Groupe</th>
                {/* Séances */}
                <th className="text-center px-4 py-3">
                  <button
                    onClick={() => toggleSort("seances")}
                    className="flex items-center gap-1 text-xs font-semibold text-muted uppercase tracking-wider hover:text-foreground transition-colors mx-auto"
                  >
                    Séances
                    <ChevronDown size={11} className={`transition-transform ${sortKey === "seances" && sortDir === "desc" ? "rotate-180" : ""} ${sortKey !== "seances" ? "opacity-30" : ""}`} />
                  </button>
                </th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Présent</th>
                {/* Absent */}
                <th className="text-center px-4 py-3">
                  <button
                    onClick={() => toggleSort("absents")}
                    className="flex items-center gap-1 text-xs font-semibold text-muted uppercase tracking-wider hover:text-foreground transition-colors mx-auto"
                  >
                    Absent
                    <ChevronDown size={11} className={`transition-transform ${sortKey === "absents" && sortDir === "desc" ? "rotate-180" : ""} ${sortKey !== "absents" ? "opacity-30" : ""}`} />
                  </button>
                </th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Excusé</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Retard</th>
                {/* Taux */}
                <th className="text-right px-5 py-3">
                  <button
                    onClick={() => toggleSort("tauxPresence")}
                    className="flex items-center gap-1 text-xs font-semibold text-muted uppercase tracking-wider hover:text-foreground transition-colors ml-auto"
                  >
                    Taux présence
                    <ChevronDown size={11} className={`transition-transform ${sortKey === "tauxPresence" && sortDir === "desc" ? "rotate-180" : ""} ${sortKey !== "tauxPresence" ? "opacity-30" : ""}`} />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sortedStats.map(s => {
                const alerte      = s.absents >= SEUIL_ALERTE
                const enRisque    = s.absents === SEUIL_ALERTE - 1
                const groupeLabel = NIVEAU_TO_GROUPE[s.benef.niveau] ?? s.benef.niveau
                const gc          = GROUPE_COLORS[groupeLabel]
                return (
                  <tr
                    key={s.benef.id}
                    className={`transition-colors hover:bg-slate-50 ${alerte ? "bg-red-50/40" : ""}`}
                  >
                    {/* Identité */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${alerte ? "bg-red-100" : "bg-ateliers-light"}`}>
                          <span className={`text-xs font-bold ${alerte ? "text-alert" : "text-ateliers-dark"}`}>
                            {s.benef.prenom[0]}{s.benef.nom[0]}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{s.benef.prenom} {s.benef.nom}</p>
                          {alerte && (
                            <span className="text-[10px] text-alert font-semibold flex items-center gap-0.5">
                              <AlertTriangle size={9} /> Décrochage
                            </span>
                          )}
                          {enRisque && !alerte && (
                            <span className="text-[10px] text-absences-dark font-semibold flex items-center gap-0.5">
                              <Clock size={9} /> À surveiller
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    {/* Groupe */}
                    <td className="px-4 py-3.5">
                      {gc ? (
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${gc.bg} ${gc.text}`}>
                          {groupeLabel}
                        </span>
                      ) : (
                        <span className="text-xs text-muted">{groupeLabel}</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-center text-sm text-muted">{s.seances}</td>
                    <td className="px-4 py-3.5 text-center">
                      <span className="font-medium text-finances-dark">{s.presents}</span>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span className={`font-semibold ${
                        s.absents >= SEUIL_ALERTE
                          ? "text-alert"
                          : s.absents > 0
                          ? "text-absences-dark"
                          : "text-muted"
                      }`}>
                        {s.absents}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center text-sm">
                      {s.excuses > 0
                        ? <span className="text-blue-600 font-medium">{s.excuses}</span>
                        : <span className="text-muted">—</span>
                      }
                    </td>
                    <td className="px-4 py-3.5 text-center text-sm">
                      {s.retards > 0
                        ? <span className="text-communication-dark font-medium">{s.retards}</span>
                        : <span className="text-muted">—</span>
                      }
                    </td>
                    {/* Taux avec barre */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-border overflow-hidden shrink-0">
                          <div
                            className={`h-full rounded-full transition-all ${presenceBar(s.tauxPresence)}`}
                            style={{ width: `${s.tauxPresence}%` }}
                          />
                        </div>
                        <span className={`font-bold text-sm w-10 text-right ${presenceText(s.tauxPresence)}`}>
                          {s.tauxPresence}%
                        </span>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {sortedStats.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-sm text-muted italic">
                    Aucune donnée pour cette période.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {sortedStats.length > 0 && (
            <p className="text-xs text-muted text-center py-3 border-t border-border">
              Cliquer sur les en-têtes de colonnes pour trier · Seuil d&apos;alerte : {SEUIL_ALERTE} absences
            </p>
          )}
        </div>
      </section>
    </div>
  )
}
