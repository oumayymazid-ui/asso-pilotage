// ──────────────────────────────────────────────
// Auth — TYPES partagés uniquement.
//
// La logique d'authentification vit désormais dans Supabase
// (voir lib/supabase/*, lib/auth-context.tsx, lib/auth-client.ts et
// docs/explanation/adr/007-auth-supabase.md). Ce fichier ne conserve que les
// types/labels réutilisés dans toute l'app (rôles, forme de l'utilisateur).
// ──────────────────────────────────────────────

export type Role = "super_admin" | "admin" | "formatrice" | "coordinatrice" | "benevole"

export interface AuthUser {
  id: string
  email: string
  nom: string
  prenom: string
  role: Role
  createdAt: string
}

export const ROLE_LABELS: Record<Role, string> = {
  super_admin:    "Super Administratrice",
  admin:          "Administratrice",
  formatrice:     "Formatrice",
  coordinatrice:  "Coordinatrice",
  benevole:       "Bénévole",
}
