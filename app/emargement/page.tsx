"use client"

import { useState, useEffect } from "react"
import { ateliers as ateliersMock } from "@/lib/mock-data"
import { Phone, AlertTriangle, CheckCircle, Clock, XCircle, ChevronDown, ClipboardCheck } from "lucide-react"

// ──────────────────────────────────────────────
// Types partagés avec ateliers/page.tsx
// ──────────────────────────────────────────────
type PresenceStatus = "présent" | "absent" | "excusé" | "retard"

interface Session {
  id: number; titre: string; date: string; heure: string
  salle: string; formatrice: string
  beneficiaireIds: number[]; statut: string
}
interface Beneficiaire {
  id: number; prenom: string; nom: string
  telephone: string
  nomParent: string; telephoneParent: string
  dateNaissance?: string
  niveau: string; statut: string
}

// ──────────────────────────────────────────────
// Storage — mêmes clés que la page ateliers
// ──────────────────────────────────────────────
const S_SESSIONS    = "asso-ateliers-sessions"
const S_BENEF       = "asso-beneficiaires"
const S_PRESENCES   = (id: number) => `asso-presences-atelier-${id}`
const S_SELECTED    = "asso-emargement-session"
const SEUIL_ALERTE  = 3  // absences avant alerte décrochage

function loadJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback
  try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : fallback } catch { return fallback }
}

// ──────────────────────────────────────────────
// Config statuts
// ──────────────────────────────────────────────
const STATUS_CONFIG: Record<PresenceStatus, { label: string; bg: string; text: string; icon: React.ReactNode }> = {
  présent: { label: "Présent",  bg: "bg-finances-light",      text: "text-finances-dark",      icon: <CheckCircle size={13} /> },
  absent:  { label: "Absent",   bg: "bg-absences-light",      text: "text-absences-dark",      icon: <XCircle size={13} /> },
  excusé:  { label: "Excusé",   bg: "bg-blue-50",             text: "text-blue-700",            icon: <Clock size={13} /> },
  retard:  { label: "Retard",   bg: "bg-communication-light", text: "text-communication-dark",  icon: <Clock size={13} /> },
}

const STATUS_CYCLE: PresenceStatus[] = ["présent", "absent", "excusé", "retard"]

// ──────────────────────────────────────────────
// Page
// ──────────────────────────────────────────────
export default function EmargementPage() {
  const [sessions, setSessions]       = useState<Session[]>(ateliersMock.sessions as Session[])
  const [beneficiaires, setBenef]     = useState<Beneficiaire[]>(ateliersMock.beneficiaires as Beneficiaire[])
  const [selectedId, setSelectedId]   = useState<number>(0)
  // presences: { sessionId → { benefId → PresenceStatus } }
  const [allPresences, setAllPresences] = useState<Record<number, Record<number, PresenceStatus>>>({})

  // Hydratation
  useEffect(() => {
    const loadedSessions  = loadJson<Session[]>(S_SESSIONS, ateliersMock.sessions as Session[])
    const loadedBenefs    = loadJson<Beneficiaire[]>(S_BENEF, ateliersMock.beneficiaires as Beneficiaire[])
    setSessions(loadedSessions)
    setBenef(loadedBenefs)

    // Pré-sélection depuis le bouton "Émarger" d'un atelier
    const preSelected = loadJson<number>(S_SELECTED, 0)
    const firstId = loadedSessions[0]?.id ?? 0
    setSelectedId(preSelected && loadedSessions.find(s => s.id === preSelected) ? preSelected : firstId)

    // Charger toutes les présences existantes
    const combined: Record<number, Record<number, PresenceStatus>> = {}
    loadedSessions.forEach(s => {
      const p = loadJson<Record<number, PresenceStatus>>(S_PRESENCES(s.id), {})
      if (Object.keys(p).length > 0) combined[s.id] = p
    })
    setAllPresences(combined)
  }, [])

  const session  = sessions.find(s => s.id === selectedId)
  const benefs   = (session?.beneficiaireIds ?? [])
    .map(id => beneficiaires.find(b => b.id === id))
    .filter(Boolean) as Beneficiaire[]
  const seancePresences = allPresences[selectedId] ?? {}

  function toggle(benefId: number) {
    const current = seancePresences[benefId] ?? "présent"
    const next    = STATUS_CYCLE[(STATUS_CYCLE.indexOf(current) + 1) % STATUS_CYCLE.length]
    const updated = { ...allPresences, [selectedId]: { ...seancePresences, [benefId]: next } }
    setAllPresences(updated)
    localStorage.setItem(S_PRESENCES(selectedId), JSON.stringify(updated[selectedId]))
  }

  // Stats séance courante
  const presents  = benefs.filter(b => (seancePresences[b.id] ?? "présent") === "présent").length
  const absents   = benefs.filter(b => (seancePresences[b.id] ?? "présent") === "absent").length
  const excuses   = benefs.filter(b => (seancePresences[b.id] ?? "présent") === "excusé").length
  const taux      = benefs.length > 0 ? Math.round((presents / benefs.length) * 100) : 0
  const aAppeler  = benefs.filter(b => (seancePresences[b.id] ?? "présent") === "absent")

  // Décrochage — total absences sur toutes les séances
  function totalAbsences(benefId: number): number {
    return Object.values(allPresences).reduce((acc, sp) => {
      return acc + (sp[benefId] === "absent" ? 1 : 0)
    }, 0)
  }
  const enDecrochage = beneficiaires.filter(
    b => b.statut === "actif" && totalAbsences(b.id) >= SEUIL_ALERTE
  )

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <header className="mb-6 flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-ateliers-light flex items-center justify-center shrink-0">
          <ClipboardCheck size={20} className="text-ateliers-dark" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Émargement</h1>
          <p className="text-sm text-muted mt-0.5">Feuille de présence en temps réel · alertes décrochage automatiques</p>
        </div>
      </header>

      {/* Sélecteur de séance */}
      <div className="mb-6">
        <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-2">Atelier</label>
        <div className="relative w-full max-w-md">
          <select
            value={selectedId}
            onChange={e => { const id = Number(e.target.value); setSelectedId(id); localStorage.setItem(S_SELECTED, String(id)) }}
            className="w-full appearance-none bg-surface border border-border rounded-xl px-4 py-3 pr-10 text-sm font-medium text-foreground cursor-pointer focus:outline-none focus:ring-2 focus:ring-ateliers"
          >
            {sessions.map(s => (
              <option key={s.id} value={s.id}>
                {new Date(s.date).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })} — {s.titre} · {s.heure}
                {s.salle ? ` · ${s.salle}` : ""}
              </option>
            ))}
          </select>
          <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-8">
        {/* Feuille de présence */}
        <div className="col-span-2 space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-surface rounded-xl border border-border p-3 text-center">
              <p className="text-2xl font-bold text-foreground">{benefs.length}</p>
              <p className="text-xs text-muted mt-0.5">Inscrits</p>
            </div>
            <div className="bg-finances-light rounded-xl border border-finances/20 p-3 text-center">
              <p className="text-2xl font-bold text-finances-dark">{presents}</p>
              <p className="text-xs text-finances-dark/70 mt-0.5">Présents</p>
            </div>
            <div className="bg-absences-light rounded-xl border border-absences/20 p-3 text-center">
              <p className="text-2xl font-bold text-absences-dark">{absents}</p>
              <p className="text-xs text-absences-dark/70 mt-0.5">Absents</p>
            </div>
            <div className="bg-ateliers-light rounded-xl border border-ateliers/20 p-3 text-center">
              <p className="text-2xl font-bold text-ateliers-dark">{taux}%</p>
              <p className="text-xs text-ateliers-dark/70 mt-0.5">Présence</p>
            </div>
          </div>

          {/* Liste bénéficiaires */}
          <div className="bg-surface rounded-xl border border-border overflow-hidden">
            {session && (
              <div className="px-5 py-3 border-b border-border bg-slate-50 flex items-center justify-between">
                <span className="text-xs font-semibold text-muted uppercase tracking-wider">{session.titre}</span>
                <span className="text-xs text-muted">
                  {session.formatrice && `${session.formatrice} · `}{session.heure}
                  {session.salle && ` · ${session.salle}`}
                </span>
              </div>
            )}
            {benefs.length === 0 ? (
              <p className="text-center text-sm text-muted py-8 italic">
                Aucun bénéficiaire inscrit à cet atelier.<br />
                <span className="text-xs">Ajoutez-en depuis la page Ateliers.</span>
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {benefs.map(b => {
                  const status  = seancePresences[b.id] ?? "présent"
                  const config  = STATUS_CONFIG[status]
                  const nbAbs   = totalAbsences(b.id)
                  const alerte  = nbAbs >= SEUIL_ALERTE
                  return (
                    <li key={b.id} className="px-5 py-3.5 flex items-center gap-4">
                      <div className="w-9 h-9 rounded-full bg-ateliers-light flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-ateliers-dark">{b.prenom[0]}{b.nom[0]}</span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-foreground text-sm">{b.prenom} {b.nom}</p>
                          {alerte && (
                            <span className="flex items-center gap-0.5 text-xs text-alert font-medium">
                              <AlertTriangle size={11} /> {nbAbs} abs.
                            </span>
                          )}
                        </div>
                        {status === "absent" && (
                          <div className="mt-0.5 space-y-0.5">
                            {b.telephoneParent && (
                              <a href={`tel:${b.telephoneParent.replace(/\s/g, "")}`} className="text-xs text-absences-dark underline underline-offset-2 block">
                                {b.nomParent} · {b.telephoneParent}
                              </a>
                            )}
                            {!b.telephoneParent && b.telephone && (
                              <a href={`tel:${b.telephone.replace(/\s/g, "")}`} className="text-xs text-absences-dark underline underline-offset-2 block">
                                {b.telephone}
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => toggle(b.id)}
                        title="Cliquer pour changer le statut"
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all hover:opacity-80 ${config.bg} ${config.text}`}
                      >
                        {config.icon}
                        {config.label}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
          <p className="text-xs text-muted text-center">
            Cliquer sur un statut pour le faire tourner : Présent → Absent → Excusé → Retard
          </p>
        </div>

        {/* Panneau latéral */}
        <div className="space-y-4">
          {/* À appeler */}
          <div className="bg-absences-light rounded-xl border border-absences/30 p-4">
            <h3 className="font-semibold text-absences-dark text-sm mb-3 flex items-center gap-2">
              <Phone size={14} /> À appeler ({aAppeler.length})
            </h3>
            {aAppeler.length === 0 ? (
              <p className="text-xs text-absences-dark/60 italic">Aucun appel nécessaire</p>
            ) : (
              <ul className="space-y-3">
                {aAppeler.map(b => {
                  const contact = b.telephoneParent
                    ? { nom: b.nomParent || "Parent", tel: b.telephoneParent }
                    : b.telephone
                      ? { nom: `${b.prenom} ${b.nom}`, tel: b.telephone }
                      : null
                  return (
                    <li key={b.id}>
                      <p className="text-sm font-medium text-absences-dark">{b.prenom} {b.nom}</p>
                      {contact ? (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] text-absences-dark/60">{contact.nom}</span>
                          <a href={`tel:${contact.tel.replace(/\s/g, "")}`} className="text-xs text-absences-dark/80 underline underline-offset-2">
                            {contact.tel}
                          </a>
                        </div>
                      ) : (
                        <span className="text-xs text-absences-dark/50 italic">Aucun contact renseigné</span>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {/* Alertes décrochage */}
          <div className="bg-surface rounded-xl border border-border p-4">
            <h3 className="font-semibold text-foreground text-sm mb-3 flex items-center gap-2">
              <AlertTriangle size={14} className="text-alert" />
              Décrochage ≥ {SEUIL_ALERTE} abs. ({enDecrochage.length})
            </h3>
            {enDecrochage.length === 0 ? (
              <p className="text-xs text-muted italic">Aucune alerte</p>
            ) : (
              <ul className="space-y-2">
                {enDecrochage.map(b => (
                  <li key={b.id} className="flex items-center justify-between text-sm">
                    <span className="font-medium text-foreground">{b.prenom} {b.nom}</span>
                    <span className="text-xs font-semibold text-alert">{totalAbsences(b.id)} abs.</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Récap toutes les séances */}
          <div className="bg-surface rounded-xl border border-border p-4">
            <h3 className="font-semibold text-foreground text-sm mb-3">Toutes les séances</h3>
            <ul className="space-y-1.5">
              {sessions.map(s => {
                const sp     = allPresences[s.id] ?? {}
                const sBenef = s.beneficiaireIds.map(id => beneficiaires.find(b => b.id === id)).filter(Boolean) as Beneficiaire[]
                const sPresents = sBenef.filter(b => (sp[b.id] ?? "présent") === "présent").length
                return (
                  <li key={s.id} className="flex items-center justify-between text-xs">
                    <button
                      onClick={() => { setSelectedId(s.id); localStorage.setItem(S_SELECTED, String(s.id)) }}
                      className={`text-left hover:text-foreground transition-colors truncate flex-1 ${selectedId === s.id ? "font-semibold text-ateliers-dark" : "text-muted"}`}
                    >
                      {new Date(s.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} — {s.titre.split(" ")[0]}
                    </button>
                    <span className={`font-medium ml-2 shrink-0 ${selectedId === s.id ? "text-ateliers-dark" : "text-muted"}`}>
                      {sPresents}/{sBenef.length}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
