// ──────────────────────────────────────────────────────────────
// proxy.ts — Next 16 (ex-"middleware", renommé). S'exécute avant chaque
// requête pour RAFRAÎCHIR la session Supabase (sinon les tokens expirent
// et l'utilisateur est déconnecté de façon aléatoire).
//
// ⚠️ Pour l'instant : refresh de session UNIQUEMENT, aucune redirection /
//    blocage — tant que le login n'est pas branché sur Supabase, on ne
//    veut verrouiller personne. L'enforcement (redirect vers /login,
//    401 sur /api) sera activé à l'étape suivante (voir ADR 007).
// ──────────────────────────────────────────────────────────────
import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // Revalide et rafraîchit la session (obligatoire avec @supabase/ssr).
  await supabase.auth.getUser()

  return response
}

export const config = {
  // Exécuté partout sauf assets statiques et fichiers image.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
