"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  LayoutDashboard,
  Euro,
  BookOpen,
  Megaphone,
  Heart,
  Map,
  ClipboardCheck,
  UserCircle,
  LogOut,
  UserCog,
  Users,
  BarChart2,
} from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { ROLE_LABELS } from "@/lib/auth"

const navItems = [
  { href: "/dashboard",     label: "Vue d'ensemble", icon: LayoutDashboard, accent: "bg-slate-100 text-slate-700",                   dot: "bg-slate-500" },
  { href: "/emargement",    label: "Émargement",      icon: ClipboardCheck,  accent: "bg-ateliers-light text-ateliers-dark",           dot: "bg-ateliers" },
  { href: "/assiduite",     label: "Assiduité",        icon: BarChart2,        accent: "bg-absences-light text-absences-dark",            dot: "bg-absences" },
  { href: "/finances",      label: "Finances",        icon: Euro,            accent: "bg-finances-light text-finances-dark",           dot: "bg-finances" },
  { href: "/ateliers",       label: "Ateliers",        icon: BookOpen,        accent: "bg-ateliers-light text-ateliers-dark",           dot: "bg-ateliers" },
  { href: "/beneficiaires", label: "Bénéficiaires",   icon: Users,           accent: "bg-ateliers-light text-ateliers-dark",           dot: "bg-ateliers" },
  { href: "/communication", label: "Communication",   icon: Megaphone,       accent: "bg-communication-light text-communication-dark", dot: "bg-communication" },
  { href: "/membres",       label: "Membres",         icon: UserCog,         accent: "bg-slate-100 text-slate-700",                   dot: "bg-slate-500" },
]

const stratItems = [
  { href: "/roadmap", label: "Roadmap stratégique", icon: Map, accent: "bg-slate-100 text-slate-700", dot: "bg-slate-600" },
  { href: "/docs", label: "Documentation", icon: BookOpen, accent: "bg-slate-100 text-slate-700", dot: "bg-slate-500", superAdminOnly: true },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router   = useRouter()
  const { user, logout } = useAuth()

  function handleLogout() {
    logout()
    router.replace("/login")
  }

  return (
    <aside className="w-60 min-h-screen bg-surface border-r border-border flex flex-col shrink-0" aria-label="Menu principal">
      <div className="p-5 border-b border-border flex items-center gap-2.5">
        <span className="bg-brand text-white rounded-lg p-1.5">
          <Heart size={16} />
        </span>
        <span className="font-semibold text-foreground text-sm tracking-wide">AREA Nantes</span>
      </div>

      <nav className="flex-1 p-3 flex flex-col gap-1 overflow-y-auto" role="navigation">
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-3 py-1.5 mt-1">Opérationnel</p>
        {navItems.map(({ href, label, icon: Icon, accent, dot }) => {
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
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-3 py-1.5 mt-3">Stratégie</p>
        {stratItems.filter(item => !item.superAdminOnly || user?.role === "super_admin").map(({ href, label, icon: Icon, accent, dot }) => {
          const active = pathname.startsWith(href)
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
                <p className="text-[10px] text-muted truncate">{ROLE_LABELS[user.role]}</p>
              </div>
            </Link>
            <button onClick={handleLogout} title="Se déconnecter" aria-label="Se déconnecter" className="p-1 rounded hover:bg-slate-200 text-muted transition-colors">
              <LogOut size={13} />
            </button>
          </div>
        </div>
      )}
    </aside>
  )
}
