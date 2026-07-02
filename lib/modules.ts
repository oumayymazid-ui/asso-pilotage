// ──────────────────────────────────────────────────────────────
// lib/modules.ts — Modules paramétrables (accès menu + routes).
//
// Source UNIQUE partagée par la sidebar, le tableau de bord, la garde de
// route (AuthGate) et le formulaire d'ajout de membre. Toute modification
// de la liste des modules se fait ICI et se répercute partout.
//
// L'accès est un contrôle de NAVIGATION (quelles pages sont visibles /
// atteignables), pas un filtre de données : chaque page va chercher ses
// propres données. Les permissions sont donc indépendantes entre modules.
// ──────────────────────────────────────────────────────────────

export type ModuleKey =
  | "emargement" | "assiduite" | "finances" | "ateliers"
  | "familles" | "positionnement" | "notes" | "communication"

export interface ModuleDef {
  key: ModuleKey
  label: string
  href: string
}

export const MODULES: ModuleDef[] = [
  { key: "emargement",     label: "Émargement",             href: "/emargement" },
  { key: "assiduite",      label: "Assiduité",              href: "/assiduite" },
  { key: "finances",       label: "Finances",               href: "/finances" },
  { key: "ateliers",       label: "Ateliers",               href: "/ateliers" },
  { key: "familles",       label: "Familles",               href: "/familles" },
  { key: "positionnement", label: "Test de positionnement", href: "/positionnement" },
  { key: "notes",          label: "Notes",                  href: "/notes" },
  { key: "communication",  label: "Communication",          href: "/communication" },
]

export const ALL_MODULE_KEYS: ModuleKey[] = MODULES.map((m) => m.key)

// Modèles rapides pré-cochés dans le formulaire (modifiables ensuite).
export const MODULE_PRESETS: { label: string; keys: ModuleKey[] }[] = [
  { label: "Accès complet",      keys: [...ALL_MODULE_KEYS] },
  { label: "Finances seulement", keys: ["finances"] },
  { label: "Formation",          keys: ["emargement", "assiduite", "ateliers"] },
]

// Chemins toujours accessibles à toute personne connectée.
export const ALWAYS_ALLOWED_PREFIXES = ["/dashboard", "/compte"]

// Chemin réservé aux administratrices (gestion des comptes & des accès).
export const ADMIN_PREFIX = "/membres"

// Clé de module correspondant à un chemin, ou null (page hors périmètre modules).
export function moduleForPath(pathname: string): ModuleKey | null {
  const found = MODULES.find((m) => pathname === m.href || pathname.startsWith(m.href + "/"))
  return found ? found.key : null
}

// Une personne peut-elle atteindre ce chemin ?
export function canAccessPath(
  pathname: string,
  perms: { isAdmin?: boolean; modules?: ModuleKey[] },
): boolean {
  if (ALWAYS_ALLOWED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))) return true
  if (pathname === ADMIN_PREFIX || pathname.startsWith(ADMIN_PREFIX + "/")) return perms.isAdmin === true
  const key = moduleForPath(pathname)
  if (!key) return true // page hors périmètre (ex: /dev) → non bloquée
  return (perms.modules ?? []).includes(key)
}
