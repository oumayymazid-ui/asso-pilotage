"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { ChevronRight, Users } from "lucide-react"
import SlideOver from "@/components/SlideOver"
import { fetchPosts } from "@/lib/sheets-api"

// ──────────────────────────────────────────────
// Types (miroir de communication/page.tsx)
// ──────────────────────────────────────────────
type Plateforme    = "LinkedIn" | "Instagram" | "Facebook"
type CategoriePost = "atelier" | "autre"

interface PlatformeContent { contenu?: string; tags?: string; lien?: string }
interface MediaItem        { nom: string; type: string; url?: string }
interface PostParticipant  { id: number; prenom: string; nom: string }
interface PostParticipants { apprenantes: PostParticipant[]; benevoles: string[]; formatrices: string[] }

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
  statut: string
  auteur: string
  sessionId?: number | null
  participants?: PostParticipants
}

// ──────────────────────────────────────────────
// Helpers visuels
// ──────────────────────────────────────────────
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
// Page
// ──────────────────────────────────────────────
export default function PubliesPage() {
  const [posts, setPosts]       = useState<Post[]>([])
  const [selected, setSelected] = useState<Post | null>(null)
  const [slideOpen, setSlideOpen] = useState(false)

  useEffect(() => {
    fetchPosts()
      .then(all => setPosts(
        (all as unknown as Post[]).filter(p => p.statut === "publié").sort((a, b) => b.date.localeCompare(a.date))
      ))
      .catch(e => console.error("Échec chargement des posts publiés (Google Sheets)", e))
  }, [])

  function openPost(p: Post) { setSelected(p); setSlideOpen(true) }

  return (
    <div className="p-8 max-w-5xl mx-auto">

      {/* En-tête */}
      <header className="mb-8 flex items-center gap-3">
        <Link
          href="/communication"
          className="p-1.5 rounded-lg hover:bg-slate-100 text-muted transition-colors"
        >
          <ChevronRight size={18} className="rotate-180" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Posts publiés</h1>
          <p className="text-sm text-muted mt-0.5">
            {posts.length} post{posts.length > 1 ? "s" : ""} · classés du plus récent au plus ancien
          </p>
        </div>
      </header>

      {/* Grille */}
      {posts.length === 0 ? (
        <div className="text-center py-20 text-muted text-sm">
          Aucun post publié pour le moment.
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {posts.map(p => (
            <div
              key={p.id}
              onClick={() => openPost(p)}
              className="bg-white rounded-xl p-3 shadow-sm border border-slate-200 flex flex-col gap-2 cursor-pointer hover:shadow-md hover:border-slate-300 transition-all group"
            >
              {/* Titre + badge catégorie */}
              <div className="flex items-start justify-between gap-1">
                <p className="text-xs font-semibold text-foreground leading-snug group-hover:text-ateliers-dark transition-colors">
                  {p.titre}
                </p>
                <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${p.categorie === "atelier" ? "bg-ateliers-light text-ateliers-dark" : "bg-slate-100 text-slate-600"}`}>
                  {p.categorie === "atelier" ? "Atelier" : "Autre"}
                </span>
              </div>

              {/* Plateformes */}
              <div className="flex flex-wrap gap-1">
                {p.plateforme.map(pl => (
                  <span key={pl} className={`flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${plateformeStyle[pl]}`}>
                    <PlatIcon p={pl} /> {pl}
                  </span>
                ))}
              </div>

              {/* Date */}
              <div className="text-[10px] text-muted">
                {new Date(p.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
              </div>

              {/* Statut */}
              <span className="text-[10px] text-emerald-600 font-medium">✓ Publié</span>
            </div>
          ))}
        </div>
      )}

      {/* SlideOver lecture */}
      <SlideOver
        open={slideOpen}
        onClose={() => setSlideOpen(false)}
        title={selected?.titre ?? ""}
        width="lg"
      >
        {selected && (
          <div className="flex flex-col gap-5">

            {/* Badges + date */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${selected.categorie === "atelier" ? "bg-ateliers-light text-ateliers-dark" : "bg-slate-100 text-slate-600"}`}>
                {selected.categorie === "atelier" ? "Atelier" : "Autre"}
              </span>
              <span className="text-xs bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full font-medium">
                ✓ Publié
              </span>
              <span className="text-xs text-muted ml-auto">
                {new Date(selected.date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
              </span>
            </div>

            {/* Auteur */}
            {selected.auteur && (
              <p className="text-xs text-muted">
                Par <span className="font-medium text-foreground">{selected.auteur}</span>
              </p>
            )}

            {/* Plateformes */}
            <div className="flex flex-wrap gap-1.5">
              {selected.plateforme.map(pl => (
                <span key={pl} className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${plateformeStyle[pl]}`}>
                  <PlatIcon p={pl} /> {pl}
                </span>
              ))}
            </div>

            {/* Contenu principal */}
            {selected.contenu && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-foreground">Contenu</p>
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap bg-slate-50 rounded-xl p-3 border border-border">
                  {selected.contenu}
                </p>
              </div>
            )}

            {/* Contenu par plateforme */}
            {selected.plateforme.some(pl => {
              const pc = selected.plateformeContenu[pl]
              return pc?.contenu || pc?.tags || pc?.lien
            }) && (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-foreground">Personnalisation par plateforme</p>
                {selected.plateforme.map(pl => {
                  const pc = selected.plateformeContenu[pl]
                  if (!pc?.contenu && !pc?.tags && !pc?.lien) return null
                  return (
                    <div key={pl} className="border border-border rounded-xl p-3 space-y-2 bg-slate-50">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${plateformeStyle[pl]}`}>
                        <PlatIcon p={pl} /> {pl}
                      </span>
                      {pc.contenu && (
                        <p className="text-xs text-foreground whitespace-pre-wrap">{pc.contenu}</p>
                      )}
                      {pc.tags && (
                        <p className="text-xs text-muted">{pc.tags}</p>
                      )}
                      {pc.lien && (
                        <a href={pc.lien} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline break-all">
                          {pc.lien}
                        </a>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Médias */}
            {(selected.media ?? []).length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-foreground">Médias</p>
                <div className="flex gap-2 flex-wrap">
                  {(selected.media ?? []).map((m, i) =>
                    m.type === "image" && m.url
                      ? <img key={i} src={m.url} alt={m.nom} className="h-20 w-20 rounded-lg object-cover border border-border" />
                      : <div key={i} className="h-20 w-20 rounded-lg border border-border bg-slate-100 flex items-center justify-center text-[10px] text-muted text-center p-1 leading-tight">{m.type === "video" ? "🎬 Vidéo" : m.nom}</div>
                  )}
                </div>
              </div>
            )}

            {/* Participants (ateliers) */}
            {selected.categorie === "atelier" && selected.participants && (
              selected.participants.apprenantes.length > 0 ||
              selected.participants.benevoles.length > 0 ||
              selected.participants.formatrices.length > 0
            ) && (
              <div className="space-y-3 border-t border-border pt-4">
                <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Users size={13} /> Participants
                </p>
                {(selected.participants!.apprenantes.length > 0) && (
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted font-medium uppercase tracking-wide">Apprenantes</p>
                    <div className="flex flex-wrap gap-1.5">
                      {selected.participants!.apprenantes.map((a, i) => (
                        <span key={i} className="text-xs bg-ateliers-light text-ateliers-dark px-2.5 py-1 rounded-full">
                          {a.prenom} {a.nom}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {(selected.participants!.benevoles.length > 0) && (
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted font-medium uppercase tracking-wide">Bénévoles</p>
                    <div className="flex flex-wrap gap-1.5">
                      {selected.participants!.benevoles.map((nom, i) => (
                        <span key={i} className="text-xs bg-benevoles-light text-benevoles-dark px-2.5 py-1 rounded-full">{nom}</span>
                      ))}
                    </div>
                  </div>
                )}
                {(selected.participants!.formatrices.length > 0) && (
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted font-medium uppercase tracking-wide">Formatrices</p>
                    <div className="flex flex-wrap gap-1.5">
                      {selected.participants!.formatrices.map((nom, i) => (
                        <span key={i} className="text-xs bg-finances-light text-finances-dark px-2.5 py-1 rounded-full">{nom}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
        )}
      </SlideOver>

    </div>
  )
}
