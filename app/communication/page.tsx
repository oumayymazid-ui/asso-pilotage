"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import Link from "next/link"
import { benevoles as benevolesMock } from "@/lib/mock-data"
import { Calendar, Columns3, Check, X, RotateCcw, Plus, Shuffle, CheckCircle2, XCircle, Users, ChevronRight } from "lucide-react"
import SlideOver, { Field, Input, Textarea, Select, FormRow, SaveButton, DeleteButton } from "@/components/SlideOver"

const STORAGE_POSTS        = "asso-communication-posts"
const STORAGE_REJECTED     = "asso-communication-rejected"
const STORAGE_INTEGRATIONS = "asso-communication-integrations"
const S_SESSIONS           = "asso-ateliers-sessions"
const S_BENEFICIAIRES      = "asso-beneficiaires"

function load<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback
  try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : fallback } catch { return fallback }
}

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────
type ValidationStatus = "brouillon" | "à valider" | "validé" | "publié"
type Plateforme       = "LinkedIn" | "Instagram" | "Facebook"
type CategoriePost    = "atelier" | "autre"

interface PlatformeContent {
  contenu?: string
  tags?: string
  lien?: string
}

interface MediaItem {
  nom: string
  type: string
  preview?: string
}

interface PostParticipant { id: number; prenom: string; nom: string }
interface PostParticipants {
  apprenantes: PostParticipant[]
  benevoles: string[]
  formatrices: string[]
}

interface IntegrationsConfig {
  method: "none" | "zapier" | "supabase"
  zapierWebhookUrl: string
  zapierTriggerOn: "validé" | "publié"
  zapierEnabled: boolean
}

const integrationsInitial: IntegrationsConfig = {
  method: "none",
  zapierWebhookUrl: "",
  zapierTriggerOn: "validé",
  zapierEnabled: false,
}

interface Post {
  id: number
  categorie: CategoriePost
  date: string
  titre: string
  brief?: string
  contenu?: string
  media?: MediaItem[]
  plateforme: Plateforme[]
  plateformeContenu: Partial<Record<Plateforme, PlatformeContent>>
  statut: ValidationStatus
  auteur: string
  evenement?: string | null
  sessionId?: number | null
  participants?: PostParticipants
}

interface SessionSlim {
  id: number
  titre: string
  date: string
  beneficiaireIds: number[]
  benevoleIds: number[]
  formatrice: string
}

interface BenefSlim {
  id: number
  prenom: string
  nom: string
  droitsImage?: boolean
}

// ──────────────────────────────────────────────
// Données initiales
// ──────────────────────────────────────────────
const postsInitiaux: Post[] = [
  { id: 1, categorie: "atelier", date: "2026-05-21", titre: "Recap atelier HTML/CSS",       contenu: "Super séance aujourd'hui avec nos débutantes ! 💻 Elles ont créé leur première page web from scratch…",         plateforme: ["LinkedIn", "Instagram"], plateformeContenu: {}, statut: "à valider",                auteur: "Nadjat",  evenement: "Atelier 21 mai",          sessionId: null, participants: { apprenantes: [], benevoles: [], formatrices: [] } },
  { id: 2, categorie: "autre",   date: "2026-05-23", titre: "Portrait bénévole – Amira",    contenu: "Rencontre avec Amira, bénévole depuis 2 ans. Elle nous parle de ce qui l'a amenée à rejoindre l'association…",    plateforme: ["Instagram"],             plateformeContenu: {}, statut: "brouillon",                  auteur: "Nadjat",  evenement: null,                      sessionId: null },
  { id: 3, categorie: "autre",   date: "2026-05-27", titre: "Annonce portes ouvertes",       contenu: "📣 Portes ouvertes le 7 juin ! Venez découvrir nos ateliers, rencontrer l'équipe et vous inscrire pour la rentrée.", plateforme: ["LinkedIn", "Instagram", "Facebook"], plateformeContenu: {}, statut: "brouillon", auteur: "Nadjat", evenement: "Portes ouvertes 7 juin", sessionId: null },
  { id: 4, categorie: "autre",   date: "2026-06-07", titre: "Live portes ouvertes",          contenu: "🔴 On est EN DIRECT depuis nos portes ouvertes ! Rejoignez-nous pour voir ce qui se passe…",                      plateforme: ["Instagram"],             plateformeContenu: {}, statut: "validé",                     auteur: "Nadjat",  evenement: "Portes ouvertes 7 juin", sessionId: null },
  { id: 5, categorie: "autre",   date: "2026-06-28", titre: "Remise des diplômes Promo 3",   contenu: "Félicitations à toutes les diplômées de la Promo 3 ! 🎓 Quelle fierté de les accompagner jusqu'au bout.",          plateforme: ["LinkedIn", "Instagram", "Facebook"], plateformeContenu: {}, statut: "brouillon", auteur: "Somayeh", evenement: "Remise des diplômes",    sessionId: null },
  { id: 6, categorie: "atelier", date: "2026-05-15", titre: "Témoignage Mariam D.",          contenu: "Mariam partage son parcours : de zéro à la création de son premier site web en 8 semaines.",                       plateforme: ["LinkedIn"],              plateformeContenu: {}, statut: "publié",                     auteur: "Nadjat",  evenement: null,                      sessionId: null, participants: { apprenantes: [], benevoles: [], formatrices: [] } },
]

const KANBAN_COLS: { id: ValidationStatus; label: string; color: string }[] = [
  { id: "brouillon",                label: "Brouillon",  color: "bg-slate-100 border-slate-200" },
  { id: "à valider",                label: "À valider",  color: "bg-absences-light border-absences/30" },
  { id: "validé",                   label: "Validé",     color: "bg-indigo-50 border-indigo-200" },
  { id: "publié",                   label: "Publié",     color: "bg-emerald-50 border-emerald-200" },
]

const PlatIcon = ({ p }: { p: Plateforme }) => {
  if (p === "Instagram") return <span className="text-[10px] font-bold">IG</span>
  if (p === "LinkedIn")  return <span className="text-[10px] font-bold">LI</span>
  return <span className="text-[10px] font-bold">FB</span>
}

const plateformeStyle: Record<Plateforme, string> = {
  LinkedIn:  "bg-blue-100 text-blue-700",
  Instagram: "bg-purple-100 text-purple-700",
  Facebook:  "bg-indigo-100 text-indigo-700",
}

// ──────────────────────────────────────────────
// Calendrier éditorial
// ──────────────────────────────────────────────
function CalendrierTab({ posts, onNewPost }: { posts: Post[]; onNewPost: (date: string) => void }) {
  const today = new Date("2026-05-20")
  const [displayYear, setDisplayYear] = useState(today.getFullYear())
  const [displayMonth, setDisplayMonth] = useState(today.getMonth())

  const year = displayYear
  const month = displayMonth
  const monthLabel = new Date(year, month, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })

  const minDate = new Date(today.getFullYear() - 1, today.getMonth(), 1)
  const maxDate = new Date(today.getFullYear() + 2, today.getMonth(), 1)
  const canGoPrev = new Date(year, month - 1, 1) >= minDate
  const canGoNext = new Date(year, month + 1, 1) <= maxDate

  function prevMonth() {
    if (!canGoPrev) return
    if (month === 0) { setDisplayYear(y => y - 1); setDisplayMonth(11) }
    else { setDisplayMonth(m => m - 1) }
  }

  function nextMonth() {
    if (!canGoNext) return
    if (month === 11) { setDisplayYear(y => y + 1); setDisplayMonth(0) }
    else { setDisplayMonth(m => m + 1) }
  }

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const offset = (firstDay + 6) % 7

  const postsByDay = useMemo(() => {
    const map: Record<number, Post[]> = {}
    posts.forEach((p) => {
      const d = new Date(p.date)
      if (d.getFullYear() === year && d.getMonth() === month) {
        const day = d.getDate()
        if (!map[day]) map[day] = []
        map[day].push(p)
      }
    })
    return map
  }, [posts, year, month])

  const statutDot: Record<ValidationStatus, string> = {
    brouillon:     "bg-slate-300",
    "à valider":   "bg-absences",
    validé:        "bg-indigo-600",
    publié:        "bg-emerald-500",
  }

  const statutBg: Record<ValidationStatus, string> = {
    brouillon:   "bg-slate-100 text-slate-600",
    "à valider": "bg-absences-light text-absences-dark",
    validé:      "bg-indigo-100 text-indigo-700",
    publié:      "bg-emerald-50 text-emerald-700",
  }

  const cells: (number | null)[] = [...Array(offset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button
            onClick={prevMonth}
            disabled={!canGoPrev}
            className="p-1 rounded-lg hover:bg-slate-100 text-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight size={16} className="rotate-180" />
          </button>
          <h2 className="text-base font-semibold capitalize text-foreground w-44 text-center">{monthLabel}</h2>
          <button
            onClick={nextMonth}
            disabled={!canGoNext}
            className="p-1 rounded-lg hover:bg-slate-100 text-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted">
          {Object.entries(statutDot).map(([s, c]) => (
            <span key={s} className="flex items-center gap-1"><span className={`w-2 h-2 rounded-full ${c}`} />{s}</span>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted mb-1">
        {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((d) => <div key={d}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />
          const isToday = day === today.getDate() && year === today.getFullYear() && month === today.getMonth()
          const dayPosts = postsByDay[day] ?? []
          const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
          return (
            <div
              key={i}
              onClick={() => onNewPost(dateStr)}
              className={`min-h-24 rounded-lg border p-1.5 text-xs cursor-pointer ${isToday ? "border-ateliers bg-ateliers-light hover:bg-ateliers-light/80" : "border-border bg-surface hover:bg-slate-50"}`}
            >
              <div className={`font-semibold mb-1 ${isToday ? "text-ateliers-dark" : "text-muted"}`}>{day}</div>
              {dayPosts.map((p) => (
                <div
                  key={p.id}
                  onClick={(e) => e.stopPropagation()}
                  className={`flex items-center gap-1 mb-0.5 px-1 py-0.5 rounded ${statutBg[p.statut]}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statutDot[p.statut]}`} />
                  <span className="truncate text-[10px] font-medium">{p.titre}</span>
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────
// Kanban de validation
// ──────────────────────────────────────────────
function KanbanTab({ posts, rejectedIds = [], onChangeStatus, onEdit }: {
  posts: Post[]
  rejectedIds?: number[]
  onChangeStatus: (id: number, status: ValidationStatus) => void
  onEdit: (p: Post) => void
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Circuit de validation : <span className="font-medium text-foreground">Brouillon → À valider → Validé → Publié</span>.
        Cliquez sur une carte pour l'éditer.
      </p>
      <div className="grid grid-cols-4 gap-4">
        {KANBAN_COLS.map((col) => {
          const allColPosts = posts.filter((p) => p.statut === col.id)
          const colPosts = col.id === "publié"
            ? [...allColPosts].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3)
            : allColPosts
          return (
            <div key={col.id} className={`rounded-xl border-2 p-3 flex flex-col gap-3 min-h-48 ${col.color}`}>
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-foreground leading-tight">{col.label}</h3>
                <span className="text-xs bg-white/70 rounded-full px-2 py-0.5 font-medium text-muted">{allColPosts.length}</span>
              </div>
              {colPosts.map((p) => (
                <div
                  key={p.id}
                  onClick={() => onEdit(p)}
                  className="relative bg-white rounded-xl p-3 shadow-sm border border-white flex flex-col gap-2 cursor-pointer hover:shadow-md hover:border-slate-200 transition-all group"
                >
                  {rejectedIds.includes(p.id) && (
                    <span className="absolute -top-1.5 -right-1.5 w-3 h-3 rounded-full bg-red-500 ring-2 ring-white shadow-sm" />
                  )}
                  <div className="flex items-start justify-between gap-1">
                    <p className="text-xs font-semibold text-foreground leading-snug group-hover:text-ateliers-dark transition-colors">{p.titre}</p>
                    <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${p.categorie === "atelier" ? "bg-ateliers-light text-ateliers-dark" : "bg-slate-100 text-slate-600"}`}>
                      {p.categorie === "atelier" ? "Atelier" : "Autre"}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {p.plateforme.map((pl) => (
                      <span key={pl} className={`flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${plateformeStyle[pl]}`}>
                        <PlatIcon p={pl} /> {pl}
                      </span>
                    ))}
                  </div>
                  <div className="text-[10px] text-muted">
                    {new Date(p.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                  </div>
                  <div className="flex gap-1.5 mt-1" onClick={(e) => e.stopPropagation()}>
                    {p.statut === "brouillon" && (
                      <button onClick={() => onChangeStatus(p.id, "à valider")} className="flex-1 text-[10px] bg-ateliers-light text-ateliers-dark rounded-lg py-1 font-medium hover:opacity-80">Soumettre</button>
                    )}
                    {p.statut === "à valider" && <>
                      <button onClick={() => onChangeStatus(p.id, "validé")} className="flex-1 text-[10px] bg-finances-light text-finances-dark rounded-lg py-1 font-medium hover:opacity-80 flex items-center justify-center gap-1"><Check size={10} /> Valider</button>
                      <button onClick={() => onChangeStatus(p.id, "brouillon")} className="text-[10px] bg-red-50 text-alert rounded-lg px-2 py-1 font-medium hover:opacity-80"><X size={10} /></button>
                    </>}
                    {p.statut === "validé" && <>
                      <button onClick={() => onChangeStatus(p.id, "publié")} className="flex-1 text-[10px] bg-emerald-100 text-emerald-700 rounded-lg py-1 font-medium hover:opacity-80">Marquer publié</button>
                      <button onClick={() => onChangeStatus(p.id, "à valider")} className="text-[10px] bg-slate-100 text-muted rounded-lg px-2 py-1 hover:opacity-80"><RotateCcw size={10} /></button>
                    </>}
                    {p.statut === "publié" && (
                      <span className="flex-1 text-[10px] text-center text-emerald-600 font-medium py-1">✓ Publié</span>
                    )}
                  </div>
                </div>
              ))}
              {colPosts.length === 0 && (
                <div className="flex-1 flex items-center justify-center text-xs text-muted/50 italic">Vide</div>
              )}
              {col.id === "publié" && (
                <Link
                  href="/communication/publies"
                  onClick={e => e.stopPropagation()}
                  className="flex items-center justify-center gap-1 text-[10px] font-medium text-emerald-700 hover:text-emerald-800 bg-white/70 hover:bg-white rounded-lg py-2 transition-colors border border-emerald-200/60"
                >
                  Voir tous les posts publiés <ChevronRight size={10} />
                </Link>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────
// Onglet Intégrations
// ──────────────────────────────────────────────
function IntegrationsTab({ config, onChange, onTest, testStatus }: {
  config: IntegrationsConfig
  onChange: (c: IntegrationsConfig) => void
  onTest: () => void
  testStatus: "idle" | "sending" | "ok" | "error"
}) {
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted">Connectez vos réseaux sociaux pour automatiser la publication des posts validés.</p>
      <div className="grid grid-cols-2 gap-4">
        <div onClick={() => onChange({ ...config, method: "zapier" })} className={`rounded-2xl border-2 p-5 flex flex-col gap-4 cursor-pointer transition-colors ${config.method === "zapier" ? "border-ateliers bg-ateliers-light" : "border-border bg-surface hover:bg-slate-50"}`}>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-base font-bold text-foreground">Zapier / Make</span>
                <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold">Disponible</span>
              </div>
              <p className="text-xs text-muted">Via webhook HTTP — aucun backend requis</p>
            </div>
            <div className={`w-4 h-4 rounded-full border-2 shrink-0 mt-0.5 transition-colors ${config.method === "zapier" ? "border-ateliers bg-ateliers" : "border-slate-300"}`} />
          </div>
          <ul className="text-xs text-muted space-y-1.5">
            <li className="flex items-start gap-1.5"><span className="text-emerald-500 shrink-0 font-bold">✓</span> Fonctionne sans backend</li>
            <li className="flex items-start gap-1.5"><span className="text-emerald-500 shrink-0 font-bold">✓</span> Configure en 10 minutes</li>
            <li className="flex items-start gap-1.5"><span className="text-slate-400 shrink-0">·</span> Compte Zapier ou Make requis</li>
          </ul>
        </div>
        <div className="rounded-2xl border-2 border-border bg-surface p-5 flex flex-col gap-4 opacity-50 cursor-not-allowed">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-base font-bold text-foreground">Supabase</span>
                <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-semibold">Phase 2</span>
              </div>
              <p className="text-xs text-muted">Via Edge Functions — intégration native</p>
            </div>
            <div className="w-4 h-4 rounded-full border-2 border-slate-300 shrink-0 mt-0.5" />
          </div>
          <ul className="text-xs text-muted space-y-1.5">
            <li className="flex items-start gap-1.5"><span className="text-emerald-500 shrink-0 font-bold">✓</span> Tokens OAuth sécurisés côté serveur</li>
            <li className="flex items-start gap-1.5"><span className="text-slate-400 shrink-0">⏳</span> Nécessite la migration Supabase (ADR 001)</li>
          </ul>
        </div>
      </div>
      {config.method === "zapier" && (
        <div className="bg-surface border border-border rounded-2xl p-5 space-y-5">
          <h3 className="text-sm font-semibold text-foreground">Configuration Zapier / Make</h3>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">URL du webhook</label>
            <div className="flex gap-2">
              <input type="url" placeholder="https://hooks.zapier.com/hooks/catch/..." value={config.zapierWebhookUrl} onChange={(e) => onChange({ ...config, zapierWebhookUrl: e.target.value })} className="flex-1 text-sm border border-border rounded-xl px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-ateliers/30" />
              <button type="button" onClick={onTest} disabled={!config.zapierWebhookUrl || testStatus === "sending"} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap">
                {testStatus === "sending" && <span className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />}
                {testStatus === "ok"      && <CheckCircle2 size={13} className="text-emerald-500" />}
                {testStatus === "error"   && <XCircle size={13} className="text-alert" />}
                {testStatus === "idle" && "Tester"}{testStatus === "sending" && "Envoi…"}{testStatus === "ok" && "OK !"}{testStatus === "error" && "Erreur"}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Déclencher quand un post est</label>
            <div className="flex gap-2">
              {(["validé", "publié"] as const).map((v) => (
                <button key={v} type="button" onClick={() => onChange({ ...config, zapierTriggerOn: v })} className={`flex-1 py-2 rounded-xl text-xs font-medium border transition-colors capitalize ${config.zapierTriggerOn === v ? "bg-ateliers-light text-ateliers-dark border-ateliers/30" : "bg-surface border-border text-muted hover:border-slate-400"}`}>{v}</button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between pt-1 border-t border-border">
            <div>
              <p className="text-sm font-medium text-foreground">Activer l'envoi automatique</p>
              <p className="text-xs text-muted mt-0.5">Le webhook sera appelé à chaque changement de statut correspondant</p>
            </div>
            <button type="button" onClick={() => onChange({ ...config, zapierEnabled: !config.zapierEnabled })} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${config.zapierEnabled ? "bg-ateliers" : "bg-slate-200"}`}>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${config.zapierEnabled ? "translate-x-6" : "translate-x-1"}`} />
            </button>
          </div>
          {config.zapierEnabled && config.zapierWebhookUrl && (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 text-xs text-emerald-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              Actif — les posts &ldquo;{config.zapierTriggerOn}&rdquo; déclencheront le webhook
            </div>
          )}
        </div>
      )}
      {config.method === "none" && (
        <div className="text-center py-10 text-muted text-sm">
          <Shuffle size={28} className="mx-auto mb-3 opacity-30" />
          Sélectionnez une méthode d'intégration ci-dessus pour la configurer.
        </div>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────
// Page principale
// ──────────────────────────────────────────────
const emptyParticipants = (): PostParticipants => ({ apprenantes: [], benevoles: [], formatrices: [] })

const emptyPost = (): Omit<Post, "id"> => ({
  categorie: "autre",
  date: new Date().toISOString().split("T")[0],
  titre: "", brief: "", contenu: "",
  media: [],
  plateforme: ["Instagram"],
  plateformeContenu: {},
  statut: "brouillon", auteur: "",
  sessionId: null,
  participants: emptyParticipants(),
})

const ALL_PLATEFORMES: Plateforme[] = ["LinkedIn", "Instagram", "Facebook"]

export default function CommunicationPage() {
  const [tab, setTab] = useState<"calendrier" | "kanban" | "integrations">("calendrier")

  const [posts, setPosts] = useState<Post[]>(postsInitiaux)
  const [slideOpen, setSlideOpen] = useState(false)
  const [editing, setEditing] = useState<Post | null>(null)
  const [form, setForm] = useState<Omit<Post, "id">>(emptyPost())
  const [activePlatformTab, setActivePlatformTab] = useState<Plateforme>("Instagram")
  const [newFormatrice, setNewFormatrice] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [rejectedIds, setRejectedIds] = useState<number[]>([])

  const [integrations, setIntegrations] = useState<IntegrationsConfig>(integrationsInitial)
  const [webhookTestStatus, setWebhookTestStatus] = useState<"idle" | "sending" | "ok" | "error">("idle")

  const [sessions, setSessions]           = useState<SessionSlim[]>([])
  const [beneficiaires, setBeneficiaires] = useState<BenefSlim[]>([])
  const [generating, setGenerating]       = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)

  useEffect(() => {
    const raw = load<Post[]>(STORAGE_POSTS, postsInitiaux)
    // Migration : "en attente de validation" → "à valider"
    const migrated = raw.map(p =>
      (p.statut as string) === "en attente de validation" ? { ...p, statut: "à valider" as ValidationStatus } : p
    )
    if (migrated.some((p, i) => p !== raw[i])) {
      localStorage.setItem(STORAGE_POSTS, JSON.stringify(migrated))
    }
    setPosts(migrated)
    setRejectedIds(load<number[]>(STORAGE_REJECTED, []))
    setIntegrations(load(STORAGE_INTEGRATIONS, integrationsInitial))
    setSessions(load(S_SESSIONS, []))
    setBeneficiaires(load(S_BENEFICIAIRES, []))
  }, [])

  function persistPosts(data: Post[]) { setPosts(data); localStorage.setItem(STORAGE_POSTS, JSON.stringify(data)) }
  function persistRejected(ids: number[]) { setRejectedIds(ids); localStorage.setItem(STORAGE_REJECTED, JSON.stringify(ids)) }
  function persistIntegrations(data: IntegrationsConfig) { setIntegrations(data); localStorage.setItem(STORAGE_INTEGRATIONS, JSON.stringify(data)) }

  async function triggerWebhook(post: Post) {
    if (!integrations.zapierEnabled || !integrations.zapierWebhookUrl || integrations.method !== "zapier") return
    if (post.statut !== integrations.zapierTriggerOn) return
    try {
      await fetch(integrations.zapierWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titre: post.titre, contenu: post.contenu ?? "", plateformes: post.plateforme, auteur: post.auteur, date: post.date }),
      })
    } catch { /* silently ignore */ }
  }

  async function testWebhook() {
    if (!integrations.zapierWebhookUrl) return
    setWebhookTestStatus("sending")
    try {
      await fetch(integrations.zapierWebhookUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ titre: "Test depuis Asso Pilotage", contenu: "Ceci est un test de connexion webhook.", plateformes: ["LinkedIn"], auteur: "Test", date: new Date().toISOString().split("T")[0], evenement: null }) })
      setWebhookTestStatus("ok")
    } catch { setWebhookTestStatus("error") }
    setTimeout(() => setWebhookTestStatus("idle"), 3000)
  }

  function changeStatus(id: number, status: ValidationStatus) {
    const prev = posts.find(p => p.id === id)
    // Dot rouge : allumé quand "à valider" → "brouillon", éteint dès que le post quitte brouillon
    if (status === "brouillon" && prev?.statut === "à valider") {
      persistRejected([...rejectedIds, id])
    } else if (status !== "brouillon" && rejectedIds.includes(id)) {
      persistRejected(rejectedIds.filter(rid => rid !== id))
    }
    const updated = posts.map((p) => p.id === id ? { ...p, statut: status } : p)
    persistPosts(updated)
    const post = updated.find((p) => p.id === id)
    if (post) triggerWebhook({ ...post, statut: status })
  }

  function openNew() {
    setEditing(null)
    const p = emptyPost()
    setForm(p)
    setActivePlatformTab(p.plateforme[0] ?? "Instagram")
    setNewFormatrice("")
    setGenerateError(null)
    setSlideOpen(true)
  }

  function openNewWithDate(date: string) {
    setEditing(null)
    const p = { ...emptyPost(), date }
    setForm(p)
    setActivePlatformTab(p.plateforme[0] ?? "Instagram")
    setNewFormatrice("")
    setGenerateError(null)
    setSlideOpen(true)
  }

  function openEdit(p: Post) {
    setEditing(p)
    setForm({
      ...p,
      brief: p.brief ?? "",
      plateforme: [...p.plateforme],
      media: [...(p.media ?? [])],
      plateformeContenu: { ...p.plateformeContenu },
      participants: p.participants
        ? { ...p.participants, apprenantes: [...p.participants.apprenantes], benevoles: [...p.participants.benevoles], formatrices: [...p.participants.formatrices] }
        : emptyParticipants(),
    })
    setActivePlatformTab(p.plateforme[0] ?? "Instagram")
    setNewFormatrice("")
    setGenerateError(null)
    setSlideOpen(true)
  }

  async function handleGenerate() {
    setGenerateError(null)
    if (!form.titre) { setGenerateError("Renseignez d'abord un titre."); return }
    if (form.categorie === "autre" && !form.brief?.trim()) { setGenerateError("Renseignez un brief pour guider la génération."); return }
    if (!form.plateforme.length) { setGenerateError("Sélectionnez au moins une plateforme."); return }
    setGenerating(true)
    try {
      const session = form.sessionId ? sessions.find(s => s.id === form.sessionId) : null
      const body = {
        categorie: form.categorie,
        titre: form.titre,
        brief: form.brief,
        sessionTitre: session?.titre,
        sessionDate: session?.date,
        apprenantes: form.participants?.apprenantes ?? [],
        benevoles: form.participants?.benevoles ?? [],
        formatrices: form.participants?.formatrices ?? [],
        plateformes: form.plateforme,
      }
      const res = await fetch("/api/generate-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { setGenerateError(data.error ?? "Erreur lors de la génération."); return }
      setForm(f => ({
        ...f,
        contenu: data.contenu ?? f.contenu,
        plateformeContenu: {
          ...f.plateformeContenu,
          ...Object.fromEntries(
            Object.entries(data.plateformeContenu ?? {}).map(([pl, val]) => [
              pl,
              { ...(f.plateformeContenu[pl as Plateforme] ?? {}), ...(val as object) },
            ])
          ),
        },
      }))
    } catch (err: unknown) {
      setGenerateError(err instanceof Error ? err.message : "Erreur réseau.")
    } finally {
      setGenerating(false)
    }
  }

  function handleSave() {
    const updated = editing
      ? posts.map((p) => p.id === editing.id ? { ...form, id: editing.id } : p)
      : [...posts, { ...form, id: Date.now() }]
    persistPosts(updated); setSlideOpen(false)
  }

  function handleDelete() {
    if (!editing) return
    persistPosts(posts.filter((p) => p.id !== editing.id))
    setSlideOpen(false)
  }

  function togglePlateforme(pl: Plateforme) {
    setForm((f) => {
      const newList = f.plateforme.includes(pl) ? f.plateforme.filter((x) => x !== pl) : [...f.plateforme, pl]
      setActivePlatformTab(newList.includes(activePlatformTab) ? activePlatformTab : (newList[0] ?? "Instagram"))
      return { ...f, plateforme: newList }
    })
  }

  function updatePlatformeContenu(pl: Plateforme, key: keyof PlatformeContent, value: string) {
    setForm(f => ({ ...f, plateformeContenu: { ...f.plateformeContenu, [pl]: { ...f.plateformeContenu[pl], [key]: value } } }))
  }

  function handleMediaFiles(files: FileList | null) {
    if (!files) return
    Array.from(files).forEach(file => {
      if (file.type.startsWith("image/")) {
        const reader = new FileReader()
        reader.onload = (e) => setForm(f => ({ ...f, media: [...(f.media ?? []), { nom: file.name, type: "image", preview: e.target?.result as string }] }))
        reader.readAsDataURL(file)
      } else {
        setForm(f => ({ ...f, media: [...(f.media ?? []), { nom: file.name, type: "video" }] }))
      }
    })
  }

  function removeMedia(index: number) {
    setForm(f => ({ ...f, media: (f.media ?? []).filter((_, i) => i !== index) }))
  }

  function handleSessionChange(val: string) {
    const id = val ? Number(val) : null
    if (!id) { setForm(f => ({ ...f, sessionId: null, participants: emptyParticipants() })); return }
    const session = sessions.find(s => s.id === id)
    if (!session) return
    const apprenantes = session.beneficiaireIds
      .map(bid => beneficiaires.find(b => b.id === bid))
      .filter((b): b is BenefSlim => Boolean(b))
      .map(b => ({ id: b.id, prenom: b.prenom, nom: b.nom }))
    const benevoles = session.benevoleIds
      .map(bid => benevolesMock.liste.find(bv => bv.id === bid))
      .filter(Boolean)
      .map(bv => bv!.nom)
    setForm(f => ({ ...f, sessionId: id, participants: { apprenantes, benevoles, formatrices: session.formatrice ? [session.formatrice] : [] } }))
  }

  function removeApprenante(index: number) {
    setForm(f => ({ ...f, participants: { ...f.participants!, apprenantes: f.participants!.apprenantes.filter((_, i) => i !== index) } }))
  }

  function addApprenante(bid: string) {
    if (!bid) return
    const b = beneficiaires.find(b => b.id === Number(bid))
    if (!b) return
    if (form.participants?.apprenantes.some(a => a.id === b.id)) return
    setForm(f => ({ ...f, participants: { ...f.participants!, apprenantes: [...f.participants!.apprenantes, { id: b.id, prenom: b.prenom, nom: b.nom }] } }))
  }

  function removeBenevole(index: number) {
    setForm(f => ({ ...f, participants: { ...f.participants!, benevoles: f.participants!.benevoles.filter((_, i) => i !== index) } }))
  }

  function addBenevole(val: string) {
    if (!val) return
    const bv = benevolesMock.liste.find(b => String(b.id) === val)
    if (!bv) return
    if (form.participants?.benevoles.includes(bv.nom)) return
    setForm(f => ({ ...f, participants: { ...f.participants!, benevoles: [...f.participants!.benevoles, bv.nom] } }))
  }

  function removeFormatrice(index: number) {
    setForm(f => ({ ...f, participants: { ...f.participants!, formatrices: f.participants!.formatrices.filter((_, i) => i !== index) } }))
  }

  function addFormatrice() {
    const name = newFormatrice.trim()
    if (!name || form.participants?.formatrices.includes(name)) return
    setForm(f => ({ ...f, participants: { ...f.participants!, formatrices: [...f.participants!.formatrices, name] } }))
    setNewFormatrice("")
  }

  const flouterList = useMemo(() => {
    if (!form.participants?.apprenantes.length) return []
    return form.participants.apprenantes.filter(a => {
      const benef = beneficiaires.find(b => b.id === a.id)
      return !benef || !benef.droitsImage
    })
  }, [form.participants?.apprenantes, beneficiaires])

  const droitsImageConfigured = useMemo(() =>
    (form.participants?.apprenantes ?? []).some(a => {
      const benef = beneficiaires.find(b => b.id === a.id)
      return benef && "droitsImage" in benef
    }),
    [form.participants?.apprenantes, beneficiaires]
  )

  const currentYear    = new Date().getFullYear()
  const debutAnnee     = new Date(currentYear, 0, 1)
  const nbBrouillons   = posts.filter((p) => p.statut === "brouillon").length
  const aValider       = posts.filter((p) => p.statut === "à valider").length
  const nbPubliesAnnee = posts.filter((p) => p.statut === "publié" && new Date(p.date) >= debutAnnee).length

  const availableBeneficiaires = beneficiaires.filter(b => !form.participants?.apprenantes.some(a => a.id === b.id))
  const availableBenevoles = benevolesMock.liste.filter(bv => !form.participants?.benevoles.includes(bv.nom))

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <header className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Communication</h1>
          <p className="text-sm text-muted mt-1">Calendrier éditorial & circuit de validation des posts</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-1.5 text-sm font-medium bg-slate-900 text-white px-4 py-2 rounded-xl hover:bg-slate-700 transition-colors">
          <Plus size={14} /> Nouveau post
        </button>
      </header>

      <SlideOver open={slideOpen} onClose={() => setSlideOpen(false)} title={editing ? "Modifier le post" : "Nouveau post"} width="lg">
        <form onSubmit={(e) => { e.preventDefault(); handleSave() }} className="flex flex-col gap-4">
          <FormRow>
            <Field label="Catégorie" required>
              <Select value={form.categorie} onChange={e => setForm(f => ({ ...f, categorie: e.target.value as CategoriePost, participants: e.target.value === "atelier" ? (f.participants ?? emptyParticipants()) : emptyParticipants() }))}>
                <option value="atelier">Atelier</option>
                <option value="autre">Autre</option>
              </Select>
            </Field>
            <Field label="État">
              <Select value={form.statut} onChange={e => setForm(f => ({ ...f, statut: e.target.value as ValidationStatus }))}>
                <option value="brouillon">Brouillon</option>
                <option value="à valider">À valider</option>
                <option value="validé">Validé</option>
                <option value="publié">Publié</option>
              </Select>
            </Field>
          </FormRow>

          <Field label="Titre" required>
            <Input placeholder="Ex: Recap atelier HTML/CSS" value={form.titre} onChange={e => setForm(f => ({ ...f, titre: e.target.value }))} />
          </Field>

          {form.categorie === "autre" && (
            <Field label="Brief (contexte pour la génération IA)">
              <Textarea
                rows={2}
                placeholder="Décrivez en quelques mots ce que vous voulez communiquer…"
                value={form.brief ?? ""}
                onChange={e => setForm(f => ({ ...f, brief: e.target.value }))}
              />
            </Field>
          )}

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-foreground">Contenu principal</span>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={generating}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-ateliers-light text-ateliers-dark hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {generating
                  ? <><span className="w-3 h-3 border-2 border-ateliers border-t-transparent rounded-full animate-spin" /> Génération…</>
                  : <>✨ Générer avec l&apos;IA</>
                }
              </button>
            </div>
            {generateError && (
              <p className="text-[11px] text-alert bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">{generateError}</p>
            )}
            <Textarea rows={5} placeholder="Texte du post… ou cliquez sur ✨ Générer avec l'IA" value={form.contenu ?? ""} onChange={e => setForm(f => ({ ...f, contenu: e.target.value }))} />
          </div>

          <Field label="Images / Vidéos">
            <div className="space-y-2">
              {(form.media ?? []).length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {(form.media ?? []).map((m, i) => (
                    <div key={i} className="relative group">
                      {m.preview
                        ? <img src={m.preview} alt={m.nom} className="h-16 w-16 rounded-lg object-cover border border-border" />
                        : <div className="h-16 w-16 rounded-lg border border-border bg-slate-100 flex items-center justify-center text-[10px] text-muted text-center p-1 leading-tight">{m.nom}</div>
                      }
                      <button type="button" onClick={() => removeMedia(i)} className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <X size={9} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={e => { handleMediaFiles(e.target.files); e.target.value = "" }} />
              <button type="button" onClick={() => fileInputRef.current?.click()} className="flex items-center justify-center gap-2 text-xs font-medium text-muted border border-dashed border-border rounded-xl px-4 py-3 w-full hover:border-slate-400 hover:text-foreground transition-colors">
                <Plus size={13} /> Ajouter des images ou vidéos
              </button>
            </div>
          </Field>

          <Field label="Plateformes">
            <div className="flex gap-2">
              {ALL_PLATEFORMES.map((pl) => (
                <button type="button" key={pl} onClick={() => togglePlateforme(pl)}
                  className={`flex-1 py-2 rounded-xl text-xs font-medium border transition-colors ${form.plateforme.includes(pl) ? plateformeStyle[pl] + " border-transparent" : "bg-surface border-border text-muted hover:border-slate-400"}`}
                >
                  {pl}
                </button>
              ))}
            </div>
          </Field>

          {form.plateforme.length > 0 && (
            <Field label="Personnalisation par plateforme">
              <div className="space-y-3">
                <div className="flex gap-1">
                  {form.plateforme.map(pl => (
                    <button type="button" key={pl} onClick={() => setActivePlatformTab(pl)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${activePlatformTab === pl ? plateformeStyle[pl] : "bg-slate-100 text-muted hover:bg-slate-200"}`}
                    >
                      <PlatIcon p={pl} /> {pl}
                    </button>
                  ))}
                </div>
                {form.plateforme.includes(activePlatformTab) && (
                  <div className="border border-border rounded-xl p-3 space-y-3 bg-slate-50">
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-muted">Contenu spécifique <span className="font-normal">(optionnel — remplace le contenu principal)</span></label>
                      <Textarea rows={3} placeholder={`Contenu adapté pour ${activePlatformTab}…`} value={form.plateformeContenu[activePlatformTab]?.contenu ?? ""} onChange={e => updatePlatformeContenu(activePlatformTab, "contenu", e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-muted">Tags / Hashtags</label>
                      <Input placeholder="#association #numérique #formation" value={form.plateformeContenu[activePlatformTab]?.tags ?? ""} onChange={e => updatePlatformeContenu(activePlatformTab, "tags", e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-muted">Lien</label>
                      <Input type="url" placeholder="https://…" value={form.plateformeContenu[activePlatformTab]?.lien ?? ""} onChange={e => updatePlatformeContenu(activePlatformTab, "lien", e.target.value)} />
                    </div>
                  </div>
                )}
              </div>
            </Field>
          )}

          {form.categorie === "atelier" && (
            <div className="border-t border-border pt-4 flex flex-col gap-4">
              <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Users size={14} /> Participants à l&apos;atelier
              </p>

              <Field label="Session associée (optionnel)">
                <Select value={form.sessionId ?? ""} onChange={e => handleSessionChange(e.target.value)}>
                  <option value="">— Sélectionner une session pour importer les participants —</option>
                  {sessions.map(s => (
                    <option key={s.id} value={s.id}>
                      {new Date(s.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })} — {s.titre}
                    </option>
                  ))}
                </Select>
                {sessions.length === 0 && (
                  <p className="text-[11px] text-muted mt-1">Aucune session trouvée — créez des ateliers dans le module Ateliers.</p>
                )}
              </Field>

              <Field label="Apprenantes">
                <div className="space-y-2">
                  {(form.participants?.apprenantes ?? []).length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {(form.participants?.apprenantes ?? []).map((a, i) => (
                        <span key={i} className="flex items-center gap-1 bg-ateliers-light text-ateliers-dark text-xs px-2.5 py-1 rounded-full">
                          {a.prenom} {a.nom}
                          <button type="button" onClick={() => removeApprenante(i)} className="ml-0.5 opacity-60 hover:opacity-100"><X size={10} /></button>
                        </span>
                      ))}
                    </div>
                  )}
                  {availableBeneficiaires.length > 0 && (
                    <select onChange={e => { addApprenante(e.target.value); e.target.value = "" }} className="w-full text-xs border border-border rounded-xl px-3 py-2 bg-background text-muted focus:outline-none focus:ring-2 focus:ring-ateliers/30">
                      <option value="">+ Ajouter une apprenante…</option>
                      {availableBeneficiaires.map(b => <option key={b.id} value={b.id}>{b.prenom} {b.nom}</option>)}
                    </select>
                  )}
                  {beneficiaires.length === 0 && <p className="text-[11px] text-muted italic">Aucun bénéficiaire enregistré.</p>}
                </div>
              </Field>

              <Field label="Bénévoles">
                <div className="space-y-2">
                  {(form.participants?.benevoles ?? []).length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {(form.participants?.benevoles ?? []).map((nom, i) => (
                        <span key={i} className="flex items-center gap-1 bg-benevoles-light text-benevoles-dark text-xs px-2.5 py-1 rounded-full">
                          {nom}
                          <button type="button" onClick={() => removeBenevole(i)} className="ml-0.5 opacity-60 hover:opacity-100"><X size={10} /></button>
                        </span>
                      ))}
                    </div>
                  )}
                  {availableBenevoles.length > 0 && (
                    <select onChange={e => { addBenevole(e.target.value); e.target.value = "" }} className="w-full text-xs border border-border rounded-xl px-3 py-2 bg-background text-muted focus:outline-none focus:ring-2 focus:ring-ateliers/30">
                      <option value="">+ Ajouter un·e bénévole…</option>
                      {availableBenevoles.map(bv => <option key={bv.id} value={bv.id}>{bv.nom}</option>)}
                    </select>
                  )}
                </div>
              </Field>

              <Field label="Enseignant·es / Formatrices">
                <div className="space-y-2">
                  {(form.participants?.formatrices ?? []).length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {(form.participants?.formatrices ?? []).map((nom, i) => (
                        <span key={i} className="flex items-center gap-1 bg-finances-light text-finances-dark text-xs px-2.5 py-1 rounded-full">
                          {nom}
                          <button type="button" onClick={() => removeFormatrice(i)} className="ml-0.5 opacity-60 hover:opacity-100"><X size={10} /></button>
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Nom de l'enseignant·e…"
                      value={newFormatrice}
                      onChange={e => setNewFormatrice(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addFormatrice() } }}
                      className="flex-1 text-xs border border-border rounded-xl px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-ateliers/30"
                    />
                    <button type="button" onClick={addFormatrice} className="px-3 py-2 text-xs font-medium bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-colors whitespace-nowrap">+ Ajouter</button>
                  </div>
                </div>
              </Field>

              {(form.participants?.apprenantes ?? []).length > 0 && (
                <div className="rounded-xl border border-border bg-slate-50 p-3 space-y-2">
                  <p className="text-xs font-semibold text-foreground">Personnes à flouter sur les photos</p>
                  {!droitsImageConfigured ? (
                    <p className="text-[11px] text-muted italic">
                      Le champ &laquo;droit à l&apos;image&raquo; n&apos;est pas encore configuré dans les fiches bénéficiaires.
                    </p>
                  ) : flouterList.length === 0 ? (
                    <p className="text-[11px] text-emerald-700">✓ Tous les participants ont donné leur accord photo.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {flouterList.map((a, i) => (
                        <span key={i} className="text-xs bg-red-50 text-alert px-2.5 py-1 rounded-full font-medium">{a.prenom} {a.nom}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <Field label="Date programmée">
            <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
          </Field>

          <Field label="Auteur">
            <Input placeholder="Nadjat" value={form.auteur} onChange={e => setForm(f => ({ ...f, auteur: e.target.value }))} />
          </Field>

          <SaveButton />
          {editing && <DeleteButton onClick={handleDelete} />}
        </form>
      </SlideOver>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-slate-100 rounded-xl border border-slate-200 p-4">
          <p className="text-3xl font-bold text-slate-700">{nbBrouillons}</p>
          <p className="text-sm text-slate-500 mt-1">En cours de rédaction</p>
        </div>
        <div className="bg-absences-light rounded-xl border border-absences/20 p-4">
          <p className="text-3xl font-bold text-absences-dark">{aValider}</p>
          <p className="text-sm text-absences-dark/70 mt-1">À valider</p>
        </div>
        <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-4">
          <p className="text-3xl font-bold text-emerald-700">{nbPubliesAnnee}</p>
          <p className="text-sm text-emerald-600/70 mt-1">Publiés en {currentYear}</p>
        </div>
      </div>

      <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-lg w-fit">
        {([
          { id: "calendrier",   icon: <Calendar size={14} />, label: "Calendrier" },
          { id: "kanban",       icon: <Columns3 size={14} />, label: "Suivi" },
          { id: "integrations", icon: <Shuffle size={14} />,  label: "Intégrations" },
        ] as const).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === t.id ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground"}`}
          >
            {t.icon} {t.label}
            {t.id === "integrations" && integrations.zapierEnabled && integrations.zapierWebhookUrl && <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />}
          </button>
        ))}
      </div>

      {tab === "calendrier"   && <CalendrierTab posts={posts} onNewPost={openNewWithDate} />}
      {tab === "kanban"       && <KanbanTab posts={posts} rejectedIds={rejectedIds} onChangeStatus={changeStatus} onEdit={openEdit} />}
      {tab === "integrations" && <IntegrationsTab config={integrations} onChange={persistIntegrations} onTest={testWebhook} testStatus={webhookTestStatus} />}
    </div>
  )
}
