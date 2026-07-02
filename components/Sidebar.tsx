"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  LayoutDashboard,
  Euro,
  BookOpen,
  Megaphone,
  ClipboardCheck,
  UserCircle,
  LogOut,
  UserCog,
  BarChart2,
  UserCheck,
  GraduationCap,
  Search,
  StickyNote,
} from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { moduleForPath } from "@/lib/modules"

const navItems = [
  { href: "/dashboard",     label: "Vue d'ensemble", icon: LayoutDashboard, accent: "bg-slate-100 text-slate-700",                   dot: "bg-slate-500" },
  { href: "/emargement",    label: "Émargement",      icon: ClipboardCheck,  accent: "bg-ateliers-light text-ateliers-dark",           dot: "bg-ateliers" },
  { href: "/assiduite",     label: "Assiduité",        icon: BarChart2,        accent: "bg-absences-light text-absences-dark",            dot: "bg-absences" },
  { href: "/finances",      label: "Finances",        icon: Euro,            accent: "bg-finances-light text-finances-dark",           dot: "bg-finances" },
  { href: "/veille-subventions", label: "Veille subventions", icon: Search,     accent: "bg-subventions-light text-subventions-dark",     dot: "bg-subventions" },
  { href: "/ateliers",       label: "Ateliers",        icon: BookOpen,        accent: "bg-ateliers-light text-ateliers-dark",           dot: "bg-ateliers" },
  { href: "/familles",      label: "Familles",         icon: UserCheck,       accent: "bg-familles-light text-familles-dark",           dot: "bg-familles" },
  { href: "/positionnement", label: "Test de positionnement", icon: GraduationCap, accent: "bg-positionnement-light text-positionnement-dark", dot: "bg-positionnement" },
  { href: "/notes",         label: "Notes",            icon: StickyNote,      accent: "bg-positionnement-light text-positionnement-dark", dot: "bg-positionnement" },
  { href: "/communication", label: "Communication",   icon: Megaphone,       accent: "bg-communication-light text-communication-dark", dot: "bg-communication" },
  { href: "/membres",       label: "Équipe",          icon: UserCog,         accent: "bg-slate-100 text-slate-700",                   dot: "bg-slate-500" },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router   = useRouter()
  const { user, logout } = useAuth()

  function handleLogout() {
    logout()
    router.replace("/login")
  }

  // N'affiche que les entrées autorisées : le tableau de bord toujours,
  // les modules selon `user.modules`, et l'Équipe si administratrice.
  const visibleItems = navItems.filter(({ href }) => {
    if (href === "/dashboard") return true
    if (href === "/membres") return user?.isAdmin === true
    const key = moduleForPath(href)
    return key ? (user?.modules ?? []).includes(key) : true
  })

  return (
    <aside className="w-60 min-h-screen bg-surface border-r border-border flex flex-col shrink-0" aria-label="Menu principal">
      <div className="p-5 border-b border-border flex items-center gap-2.5">
        <Image src="/logo-area.png" alt="" width={28} height={28} className="rounded-lg" />
        <span className="font-semibold text-foreground text-sm tracking-wide">AREA Nantes</span>
      </div>

      <nav className="flex-1 p-3 flex flex-col gap-1 overflow-y-auto" role="navigation">
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-3 py-1.5 mt-1">Opérationnel</p>
        {visibleItems.map(({ href, label, icon: Icon, accent, dot }) => {
          const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? `${accent} font-semibold`
                  : "text-muted hover:bg-slate-50 hover:text-foreground"
              }`}
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${active ? dot : "bg-border"}`} />
              <Icon size={16} className="shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Utilisateur connecté */}
      {user && (
        <div className="p-3 border-t border-border">
          <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg bg-slate-50">
            <Link href="/compte" className="flex items-center gap-2.5 flex-1 min-w-0 group">
              <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center shrink-0 group-hover:bg-slate-300 transition-colors">
                <UserCircle size={16} className="text-slate-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate group-hover:text-slate-900">{user.prenom} {user.nom}</p>
                <p className="text-[10px] text-muted truncate">{user.isAdmin ? "Administratrice" : "Membre de l'équipe"}</p>
              </div>
            </Link>
            <button onClick={handleLogout} title="Se déconnecter" aria-label="Se déconnecter" className="p-1 rounded hover:bg-slate-200 text-muted transition-colors">
              <LogOut size={13} />
            </button>
          </div>
        </div>
      )}

      {/* Liens légaux — accessibles aussi depuis /login (composant non partagé, garder les deux à jour) */}
      <nav aria-label="Pages légales" className="px-4 pb-4 flex flex-wrap gap-x-3 gap-y-1">
        <Link href="/mentions-legales" className="text-[11px] text-muted hover:text-foreground transition-colors">Mentions légales</Link>
        <Link href="/confidentialite" className="text-[11px] text-muted hover:text-foreground transition-colors">Confidentialité</Link>
        <Link href="/accessibilite" className="text-[11px] text-muted hover:text-foreground transition-colors">Accessibilité</Link>
      </nav>
    </aside>
  )
}
