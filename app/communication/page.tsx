"use client"

import { useState, useMemo, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import { benevoles as benevolesMock } from "@/lib/mock-data"
import { Calendar, Columns3, Check, X, RotateCcw, Plus, Users, ChevronRight, Heart, MessageCircle, Send, Bookmark, ThumbsUp, MoreHorizontal, Share2, Pencil, Clock, CheckCircle2 } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import SlideOver, { Field, Input, Textarea, Select, FormRow, SaveButton, DeleteButton } from "@/components/SlideOver"
import { fetchPosts, addPost as apiAddPost, updatePost as apiUpdatePost, deletePost as apiDeletePost, uploadPostMedia } from "@/lib/sheets-api"

const STORAGE_REJECTED     = "asso-communication-rejected"

function load<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback
  try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : fallback } catch { return fallback }
}

/** Convertit "14/03/2026" (format Sheet) en "2026-03-14" (parsable par Date). */
function frToIso(d: string): string {
  const m = (d ?? "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : (d ?? "")
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
  preview?: string   // aperçu local (dataURL) pendant l'upload
  url?: string        // URL Drive persistée une fois l'upload terminé
  uploading?: boolean
}

interface PostParticipant { id: number; prenom: string; nom: string }
interface PostParticipants {
  apprenantes: PostParticipant[]
  benevoles: string[]
  formatrices: string[]
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
  sessionId?: number | null
  participants?: PostParticipants
}

interface SessionSlim {
  id: number
  titre: string
  date: string
  beneficiaireIds: number[]
  benevoleIds?: number[]
  intervenantIds?: number[]
}

interface IntervenantSlim {
  ID_Intervenant: string
  Nom: string
  Prenom: string
}

interface BenefSlim {
  id: number
  prenom: string
  nom: string
  droitsImage: boolean            // true seulement si la colonne Sheet vaut "Oui"
  droitsImageRenseigne: boolean   // false si le champ n'a jamais été rempli côté Familles
}

// Formes renvoyées par /api/sheets?action=getAteliers / getBeneficiaires (voir app/ateliers/page.tsx)
interface AtelierSheetRow {
  ID_Atelier: string
  Titre: string
  Categorie: string
  Groupe: string
  Date_Debut: string
  beneficiaireIds: string[]
}

interface BeneficiaireSheetRow {
  ID_Personne: string
  Prenom: string
  Nom: string
  Droit_Image: string
}

const KANBAN_COLS: { id: ValidationStatus; label: string; color: string }[] = [
  { id: "brouillon",                label: "Brouillon",  color: "bg-slate-100 border-slate-200" },
  { id: "à valider",                label: "À valider",  color: "bg-absences-light border-absences/30" },
  { id: "validé",                   label: "Validé",     color: "bg-indigo-50 border-indigo-200" },
  { id: "publié",                   label: "Publié",     color: "bg-emerald-50 border-emerald-200" },
]

// Picto par état — réutilisé dans l'agenda (calendrier) et le kanban pour la lisibilité
const STATUT_ICON: Record<ValidationStatus, LucideIcon> = {
  brouillon:   Pencil,
  "à valider": Clock,
  validé:      Check,
  publié:      CheckCircle2,
}

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
// Aperçu du post (simulation réseau social)
// ──────────────────────────────────────────────
const ASSO_NAME = "Ada Tech School"
const ASSO_HANDLE = "Area Nantes"
const ASSO_INITIALS = "AT"

function PreviewAvatar({ size = 9 }: { size?: 7 | 9 }) {
  const classes = size === 7 ? "w-7 h-7 text-[9px]" : "w-9 h-9 text-xs"
  return (
    <div className={`${classes} rounded-full bg-slate-800 text-white flex items-center justify-center font-bold shrink-0`}>
      {ASSO_INITIALS}
    </div>
  )
}

function PreviewMedia({ media }: { media?: MediaItem[] }) {
  const first = media?.[0]
  if (!first) return null
  const src = first.preview ?? first.url
  if (first.type === "image" && src) {
    return <img src={src} alt={first.nom} className="w-full aspect-video object-cover" />
  }
  return (
    <div className="w-full aspect-video bg-slate-100 flex items-center justify-center text-xs text-muted gap-1.5">
      🎬 Vidéo — {first.nom}
    </div>
  )
}

function PostPreviewCard({ platform, contenu, tags, media }: {
  platform: Plateforme
  contenu: string
  tags?: string
  media?: MediaItem[]
}) {
  const isEmpty = !contenu.trim()
  const texte = isEmpty ? "Votre contenu apparaîtra ici…" : contenu
  const texteClass = isEmpty ? "text-muted/60 italic" : "text-foreground"

  if (platform === "Instagram") {
    return (
      <div className="rounded-2xl border border-border bg-white overflow-hidden text-sm shadow-sm">
        <div className="flex items-center gap-2 p-3">
          <PreviewAvatar size={7} />
          <span className="text-xs font-semibold text-foreground">{ASSO_HANDLE}</span>
          <MoreHorizontal size={14} className="ml-auto text-muted" />
        </div>
        <div className="w-full aspect-square bg-slate-100 flex items-center justify-center overflow-hidden">
          {media?.[0]?.type === "image" && (media[0].preview ?? media[0].url)
            ? <img src={media[0].preview ?? media[0].url} alt="" className="w-full h-full object-cover" />
            : <span className="text-xs text-muted/60">Aucune image</span>}
        </div>
        <div className="flex items-center gap-3 px-3 pt-2.5 text-foreground">
          <Heart size={18} />
          <MessageCircle size={18} />
          <Send size={18} />
          <Bookmark size={18} className="ml-auto" />
        </div>
        <p className="px-3 pt-1.5 pb-0.5 text-xs leading-snug">
          <span className="font-semibold">{ASSO_HANDLE}</span>{" "}
          <span className={texteClass}>{texte}</span>
          {tags && <span className="text-blue-600"> {tags}</span>}
        </p>
        <p className="px-3 pb-3 pt-1 text-[10px] text-muted uppercase tracking-wide">Il y a quelques secondes</p>
      </div>
    )
  }

  if (platform === "Facebook") {
    return (
      <div className="rounded-2xl border border-border bg-white overflow-hidden text-sm shadow-sm">
        <div className="flex items-center gap-2 p-3">
          <PreviewAvatar />
          <div>
            <p className="text-xs font-semibold text-foreground">{ASSO_NAME}</p>
            <p className="text-[10px] text-muted">À l&apos;instant · 🌐</p>
          </div>
          <MoreHorizontal size={14} className="ml-auto text-muted" />
        </div>
        <p className={`px-3 pb-2 whitespace-pre-wrap leading-snug ${texteClass}`}>
          {texte}{tags && <span className="text-blue-600"> {tags}</span>}
        </p>
        <PreviewMedia media={media} />
        <div className="flex items-center justify-between px-3 py-1.5 text-[11px] text-muted border-t border-border">
          <span>👍❤️ 0</span>
          <span>0 commentaires · 0 partages</span>
        </div>
        <div className="flex items-center justify-around px-1 py-1 border-t border-border text-xs font-medium text-muted">
          <span className="flex items-center gap-1.5 py-1.5"><ThumbsUp size={14} /> J&apos;aime</span>
          <span className="flex items-center gap-1.5 py-1.5"><MessageCircle size={14} /> Commenter</span>
          <span className="flex items-center gap-1.5 py-1.5"><Share2 size={14} /> Partager</span>
        </div>
      </div>
    )
  }

  // LinkedIn
  return (
    <div className="rounded-2xl border border-border bg-white overflow-hidden text-sm shadow-sm">
      <div className="flex items-center gap-2 p-3">
        <PreviewAvatar />
        <div>
          <p className="text-xs font-semibold text-foreground">{ASSO_NAME}</p>
          <p className="text-[10px] text-muted">Association · À l&apos;instant · 🌐</p>
        </div>
        <MoreHorizontal size={14} className="ml-auto text-muted" />
      </div>
      <p className={`px-3 pb-2 whitespace-pre-wrap leading-snug ${texteClass}`}>
        {texte}{tags && <span className="text-blue-600"> {tags}</span>}
      </p>
      <PreviewMedia media={media} />
      <div className="flex items-center justify-around px-1 py-1 border-t border-border text-xs font-medium text-muted">
        <span className="flex items-center gap-1.5 py-1.5"><ThumbsUp size={14} /> J&apos;aime</span>
        <span className="flex items-center gap-1.5 py-1.5"><MessageCircle size={14} /> Commenter</span>
        <span className="flex items-center gap-1.5 py-1.5"><Share2 size={14} /> Republier</span>
        <span className="flex items-center gap-1.5 py-1.5"><Send size={14} /> Envoyer</span>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────
// Calendrier éditorial
// ──────────────────────────────────────────────
function CalendrierTab({ posts, onNewPost }: { posts: Post[]; onNewPost: (date: string) => void }) {
  const today = new Date()
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

  const PLATEFORMES: Plateforme[] = ["LinkedIn", "Instagram", "Facebook"]

  const platformCounts = useMemo(() => {
    const counts: Partial<Record<Plateforme, number>> = {}
    Object.values(postsByDay).flat().forEach((p) => {
      p.plateforme.forEach((pl) => {
        counts[pl] = (counts[pl] ?? 0) + 1
      })
    })
    return counts
  }, [postsByDay])

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
          {(Object.keys(statutBg) as ValidationStatus[]).map((s) => {
            const Icon = STATUT_ICON[s]
            return (
              <span key={s} className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${statutBg[s]}`}><Icon size={11} className="shrink-0" /> {s}</span>
            )
          })}
        </div>
      </div>
      <div className="flex items-center gap-2 py-1">
        {PLATEFORMES.filter((pl) => (platformCounts[pl] ?? 0) > 0).map((pl) => (
          <span key={pl} className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${plateformeStyle[pl]}`}>
            <PlatIcon p={pl} /> {platformCounts[pl]}
          </span>
        ))}
        {Object.keys(platformCounts).length === 0 && (
          <span className="text-xs text-muted italic">Aucun post ce mois-ci</span>
        )}
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
              {dayPosts.map((p) => {
                const Icon = STATUT_ICON[p.statut]
                return (
                  <div
                    key={p.id}
                    onClick={(e) => e.stopPropagation()}
                    className={`flex items-center gap-1 mb-0.5 px-1 py-0.5 rounded ${statutBg[p.statut]}`}
                    title={p.statut}
                  >
                    <Icon size={11} className="shrink-0" />
                    <span className="truncate text-[10px] font-medium">{p.titre}</span>
                  </div>
                )
              })}
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
          const StatutIcon = STATUT_ICON[col.id]
          return (
            <div key={col.id} className={`rounded-xl border-2 p-3 flex flex-col gap-3 min-h-48 ${col.color}`}>
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-1.5 text-xs font-semibold text-foreground leading-tight"><StatutIcon size={13} className="shrink-0" /> {col.label}</h3>
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
const ALL_STATUTS: ValidationStatus[] = ["brouillon", "à valider", "validé", "publié"]

// Mappe la forme générique renvoyée par /api/sheets (feuille CONTENUS) vers notre type Post local
function sheetPostToPost(p: {
  id: number
  categorie: string
  date: string
  titre: string
  brief?: string
  contenu?: string
  media: { nom: string; type: string; url?: string }[]
  plateforme: string[]
  plateformeContenu: Record<string, PlatformeContent>
  statut: string
  auteur: string
  sessionId: number | null
  participants?: PostParticipants
}): Post {
  return {
    id: p.id,
    categorie: p.categorie === "atelier" ? "atelier" : "autre",
    date: p.date,
    titre: p.titre,
    brief: p.brief ?? "",
    contenu: p.contenu ?? "",
    media: p.media.map(m => ({ nom: m.nom, type: m.type, url: m.url })),
    plateforme: p.plateforme.filter((pl): pl is Plateforme => (ALL_PLATEFORMES as string[]).includes(pl)),
    plateformeContenu: p.plateformeContenu as Partial<Record<Plateforme, PlatformeContent>>,
    statut: ALL_STATUTS.includes(p.statut as ValidationStatus) ? (p.statut as ValidationStatus) : "brouillon",
    auteur: p.auteur,
    sessionId: p.sessionId,
    participants: p.participants,
  }
}

export default function CommunicationPage() {
  const [tab, setTab] = useState<"calendrier" | "kanban">("calendrier")

  const [posts, setPosts] = useState<Post[]>([])
  const [postsLoading, setPostsLoading] = useState(true)
  const [postsError, setPostsError] = useState<string | null>(null)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [slideOpen, setSlideOpen] = useState(false)
  const [editing, setEditing] = useState<Post | null>(null)
  const [form, setForm] = useState<Omit<Post, "id">>(emptyPost())
  const [activePlatformTab, setActivePlatformTab] = useState<Plateforme>("Instagram")
  const [newFormatrice, setNewFormatrice] = useState("")
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [rejectedIds, setRejectedIds] = useState<number[]>([])

  const [sessions, setSessions]           = useState<SessionSlim[]>([])
  const [beneficiaires, setBeneficiaires] = useState<BenefSlim[]>([])
  const [intervenants, setIntervenants]   = useState<IntervenantSlim[]>([])
  const [generating, setGenerating]       = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [mediaError, setMediaError]       = useState<string | null>(null)

  const loadPosts = useCallback(async () => {
    setPostsLoading(true)
    setPostsError(null)
    try {
      const data = await fetchPosts()
      setPosts(data.map(sheetPostToPost))
    } catch (e) {
      console.error("Échec chargement des posts (Google Sheets)", e)
      setPostsError("Impossible de charger les posts depuis Google Sheets.")
    } finally {
      setPostsLoading(false)
    }
  }, [])

  // Ateliers + bénéficiaires (nom, prénom, droit à l'image) : depuis Google Sheets,
  // pour que le floutage se base sur les vraies fiches Familles, pas sur des données de seed.
  const loadAteliersEtBeneficiaires = useCallback(async () => {
    try {
      const [ateliersRes, benefRes] = await Promise.all([
        fetch("/api/sheets?action=getAteliers"),
        fetch("/api/sheets?action=getBeneficiaires"),
      ])
      const ateliersRows: AtelierSheetRow[] = ateliersRes.ok ? await ateliersRes.json() : []
      const benefRows: BeneficiaireSheetRow[] = benefRes.ok ? await benefRes.json() : []

      setSessions(ateliersRows.map(a => ({
        id: Number(a.ID_Atelier),
        titre: a.Titre || [a.Categorie, a.Groupe].filter(Boolean).join(" · "),
        date: frToIso(a.Date_Debut),
        beneficiaireIds: a.beneficiaireIds.map(Number).filter(n => !isNaN(n)),
      })))

      setBeneficiaires(benefRows.map(b => {
        const raw = String(b.Droit_Image ?? "").trim()
        return {
          id: Number(b.ID_Personne),
          prenom: b.Prenom,
          nom: b.Nom,
          droitsImageRenseigne: raw !== "",
          droitsImage: raw.toLowerCase() === "oui",
        }
      }))
    } catch (e) {
      console.error("Échec chargement ateliers/bénéficiaires (Google Sheets)", e)
      setSessions([])
      setBeneficiaires([])
    }
  }, [])

  useEffect(() => {
    loadPosts()
    loadAteliersEtBeneficiaires()
    setRejectedIds(load<number[]>(STORAGE_REJECTED, []))
  }, [loadPosts, loadAteliersEtBeneficiaires])

  function persistRejected(ids: number[]) { setRejectedIds(ids); localStorage.setItem(STORAGE_REJECTED, JSON.stringify(ids)) }

  async function changeStatus(id: number, status: ValidationStatus) {
    const prev = posts.find(p => p.id === id)
    if (!prev) return
    const prevRejected = rejectedIds
    // Dot rouge : allumé quand "à valider" → "brouillon", éteint dès que le post quitte brouillon
    if (status === "brouillon" && prev.statut === "à valider") {
      persistRejected([...rejectedIds, id])
    } else if (status !== "brouillon" && rejectedIds.includes(id)) {
      persistRejected(rejectedIds.filter(rid => rid !== id))
    }
    setStatusError(null)
    setPosts(posts.map((p) => p.id === id ? { ...p, statut: status } : p))
    try {
      await apiUpdatePost(id, { statut: status })
    } catch (e) {
      console.error("Échec mise à jour du statut (Google Sheets)", e)
      // Le Sheet n'a pas été mis à jour : on annule la mise à jour optimiste
      // pour ne pas afficher un statut qui n'existe pas côté serveur.
      setPosts(posts.map((p) => p.id === id ? { ...p, statut: prev.statut } : p))
      persistRejected(prevRejected)
      setStatusError(`Échec de la mise à jour du statut de « ${prev.titre} ». Réessayez.`)
    }
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

  async function handleSave() {
    setSaving(true)
    setSaveError(null)
    try {
      if (editing) {
        await apiUpdatePost(editing.id, form)
        setPosts(posts.map((p) => p.id === editing.id ? { ...form, id: editing.id } : p))
      } else {
        const res = await apiAddPost(form)
        setPosts([...posts, { ...form, id: res.id }])
      }
      setSlideOpen(false)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Erreur lors de l'enregistrement.")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!editing) return
    try {
      await apiDeletePost(editing.id)
      setPosts(posts.filter((p) => p.id !== editing.id))
      setSlideOpen(false)
    } catch (e) {
      console.error("Échec suppression du post (Google Sheets)", e)
    }
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

  // Un seul média par type (image / vidéo) : un nouvel ajout remplace le précédent du même type,
  // pour correspondre aux colonnes "Image" / "Vidéo" (singulières) de la feuille CONTENUS.
  // ~3 Mo brut ≈ 4 Mo encodés en base64, sous le plafond Vercel (~4,5 Mo/requête, voir CLAUDE.md).
  const MAX_MEDIA_SIZE = 3 * 1024 * 1024

  function handleMediaFiles(files: FileList | null) {
    if (!files) return
    setMediaError(null)
    Array.from(files).forEach(file => {
      if (file.size > MAX_MEDIA_SIZE) {
        setMediaError(`« ${file.name} » dépasse la taille maximale autorisée (3 Mo).`)
        return
      }
      const type: "image" | "video" = file.type.startsWith("image/") ? "image" : "video"
      const reader = new FileReader()
      reader.onload = async (e) => {
        const dataUrl = e.target?.result as string
        const dataBase64 = dataUrl.split(",")[1] ?? ""
        setForm(f => ({
          ...f,
          media: [
            ...(f.media ?? []).filter(m => m.type !== type),
            { nom: file.name, type, preview: dataUrl, uploading: true },
          ],
        }))
        try {
          const res = await uploadPostMedia({ nom: file.name, mimeType: file.type, dataBase64 })
          setForm(f => ({
            ...f,
            media: (f.media ?? []).map(m => (m.type === type && m.nom === file.name) ? { ...m, url: res.url, uploading: false } : m),
          }))
        } catch (err) {
          console.error("Échec upload média (Google Drive)", err)
          setMediaError(`Échec de l'upload de « ${file.name} ». Réessayez avec un fichier plus léger.`)
          setForm(f => ({
            ...f,
            media: (f.media ?? []).filter(m => !(m.type === type && m.nom === file.name)),
          }))
        }
      }
      reader.readAsDataURL(file)
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
    // Bénévoles/formatrices : pas (encore) rattaché aux ateliers côté Sheets — on garde la saisie
    // manuelle déjà en place plutôt que d'écraser ce que la personne a déjà renseigné.
    setForm(f => ({ ...f, sessionId: id, participants: { apprenantes, benevoles: f.participants?.benevoles ?? [], formatrices: f.participants?.formatrices ?? [] } }))
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
      return benef?.droitsImageRenseigne
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

  const previewPlatform = form.plateforme.includes(activePlatformTab) ? activePlatformTab : form.plateforme[0]
  const previewContenu = form.plateformeContenu[previewPlatform]?.contenu?.trim() || form.contenu || ""
  const previewTags = form.plateformeContenu[previewPlatform]?.tags
  const mediaUploading = (form.media ?? []).some(m => m.uploading)

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <header className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Communication</h1>
          <p className="text-sm text-muted mt-1">Calendrier éditorial & circuit de validation des posts</p>
        </div>
        <button onClick={openNew} disabled={postsLoading} className="flex items-center gap-1.5 text-sm font-medium bg-communication-dark text-white px-4 py-2 rounded-xl hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          <Plus size={14} /> Nouveau post
        </button>
      </header>

      <SlideOver open={slideOpen} onClose={() => setSlideOpen(false)} title={editing ? "Modifier le post" : "Nouveau post"} width="xl">
        <form onSubmit={(e) => { e.preventDefault(); handleSave() }}>
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-6 items-start">
        <div className="flex flex-col gap-4">
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

          <Field label="Titre" required hint="ex. Recap atelier HTML/CSS">
            <Input value={form.titre} onChange={e => setForm(f => ({ ...f, titre: e.target.value }))} />
          </Field>

          {form.categorie === "autre" && (
            <Field label="Brief (contexte pour la génération IA)" hint="Décrivez en quelques mots ce que vous voulez communiquer…">
              <Textarea
                rows={2}
                value={form.brief ?? ""}
                onChange={e => setForm(f => ({ ...f, brief: e.target.value }))}
              />
            </Field>
          )}

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span id="contenu-principal-label" className="text-xs font-medium text-foreground">Contenu principal</span>
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
            <p id="contenu-principal-hint" className="text-xs text-muted normal-case tracking-normal font-normal -mt-0.5">Texte du post… ou cliquez sur ✨ Générer avec l&apos;IA</p>
            <Textarea rows={5} aria-labelledby="contenu-principal-label" aria-describedby="contenu-principal-hint" value={form.contenu ?? ""} onChange={e => setForm(f => ({ ...f, contenu: e.target.value }))} />
          </div>

          <Field label="Images / Vidéos">
            <div className="space-y-2">
              <p className="text-[11px] text-muted">Une image et/ou une vidéo par post (un nouvel ajout remplace le précédent du même type).</p>
              {(form.media ?? []).length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {(form.media ?? []).map((m, i) => (
                    <div key={i} className="relative group">
                      {m.type === "image" && (m.preview ?? m.url)
                        ? <img src={m.preview ?? m.url} alt={m.nom} width={64} height={64} loading="lazy" className="h-16 w-16 rounded-lg object-cover border border-border" />
                        : <div className="h-16 w-16 rounded-lg border border-border bg-slate-100 flex items-center justify-center text-[10px] text-muted text-center p-1 leading-tight">{m.type === "video" ? "🎬 Vidéo" : m.nom}</div>
                      }
                      {m.uploading && (
                        <div className="absolute inset-0 bg-black/40 rounded-lg flex items-center justify-center">
                          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        </div>
                      )}
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
              {mediaError && (
                <p className="text-[11px] text-alert bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">{mediaError}</p>
              )}
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
                      <label id="plateforme-contenu-label" className="text-[11px] font-medium text-muted">Contenu spécifique <span className="font-normal">(optionnel — remplace le contenu principal)</span></label>
                      <p id="plateforme-contenu-hint" className="text-xs text-muted normal-case tracking-normal font-normal -mt-0.5">{`Contenu adapté pour ${activePlatformTab}…`}</p>
                      <Textarea rows={3} aria-labelledby="plateforme-contenu-label" aria-describedby="plateforme-contenu-hint" value={form.plateformeContenu[activePlatformTab]?.contenu ?? ""} onChange={e => updatePlatformeContenu(activePlatformTab, "contenu", e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <label id="plateforme-tags-label" className="text-[11px] font-medium text-muted">Tags / Hashtags</label>
                      <p id="plateforme-tags-hint" className="text-xs text-muted normal-case tracking-normal font-normal -mt-0.5">ex. #association #numérique #formation</p>
                      <Input aria-labelledby="plateforme-tags-label" aria-describedby="plateforme-tags-hint" value={form.plateformeContenu[activePlatformTab]?.tags ?? ""} onChange={e => updatePlatformeContenu(activePlatformTab, "tags", e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <label id="plateforme-lien-label" className="text-[11px] font-medium text-muted">Lien</label>
                      <p id="plateforme-lien-hint" className="text-xs text-muted normal-case tracking-normal font-normal -mt-0.5">ex. https://…</p>
                      <Input type="url" aria-labelledby="plateforme-lien-label" aria-describedby="plateforme-lien-hint" value={form.plateformeContenu[activePlatformTab]?.lien ?? ""} onChange={e => updatePlatformeContenu(activePlatformTab, "lien", e.target.value)} />
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
                      aria-label="Nom de l'enseignant·e"
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

          <Field label="Auteur" hint="ex. Nadjat">
            <Input value={form.auteur} onChange={e => setForm(f => ({ ...f, auteur: e.target.value }))} />
          </Field>

          {saveError && (
            <p className="text-[11px] text-alert bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">{saveError}</p>
          )}
          <SaveButton
            accent="communication"
            disabled={saving || mediaUploading}
            label={saving ? "Enregistrement…" : mediaUploading ? "Envoi du média…" : "Enregistrer"}
          />
          {editing && <DeleteButton onClick={handleDelete} />}
        </div>

        <div className="hidden xl:flex xl:flex-col gap-3 xl:sticky xl:top-0">
          <p className="text-xs font-semibold text-muted uppercase tracking-wider">
            Aperçu {form.plateforme.includes(activePlatformTab) && `— ${activePlatformTab}`}
          </p>
          {form.plateforme.length > 0 ? (
            <PostPreviewCard
              platform={previewPlatform}
              contenu={previewContenu}
              tags={previewTags}
              media={form.media}
            />
          ) : (
            <div className="rounded-2xl border border-dashed border-border p-6 text-center text-xs text-muted">
              Sélectionnez une plateforme pour voir l&apos;aperçu.
            </div>
          )}
        </div>
        </div>
        </form>
      </SlideOver>

      {postsError && (
        <div className="mb-6 text-sm text-alert bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
          {postsError}
          <button onClick={loadPosts} className="shrink-0 text-xs font-medium underline hover:no-underline">Réessayer</button>
        </div>
      )}

      {statusError && (
        <div className="mb-6 text-sm text-alert bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
          {statusError}
          <button onClick={() => setStatusError(null)} className="shrink-0 text-xs font-medium underline hover:no-underline">Fermer</button>
        </div>
      )}

      {postsLoading ? (
        <div className="py-20 text-center text-sm text-muted">Chargement des posts…</div>
      ) : (
      <>
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
          { id: "calendrier", icon: <Calendar size={14} />, label: "Calendrier" },
          { id: "kanban",     icon: <Columns3 size={14} />, label: "Suivi" },
        ] as const).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === t.id ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground"}`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === "calendrier" && <CalendrierTab posts={posts} onNewPost={openNewWithDate} />}
      {tab === "kanban"     && <KanbanTab posts={posts} rejectedIds={rejectedIds} onChangeStatus={changeStatus} onEdit={openEdit} />}
      </>
      )}
    </div>
  )
}
