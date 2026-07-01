// ──────────────────────────────────────────────────────────────
// GET /api/assiduite — Renvoie les données d'assiduité lues dans le
// Google Sheet (côté serveur). Le Hub Assiduité consomme cette route.
//
// ⚠️ Route serveur : elle seule accède aux credentials du compte de
//    service. Aucun secret n'est envoyé au client (voir ADR 004).
// ──────────────────────────────────────────────────────────────
import { NextResponse } from "next/server"
import { fetchAssiduiteData } from "@/lib/assiduite-server"
import { getServerUser } from "@/lib/supabase/server"

export const runtime = "nodejs"        // googleapis requiert Node
export const dynamic = "force-dynamic" // rendu dynamique ; cache court géré dans la lib (TTL 60 s)

export async function GET() {
  if (!(await getServerUser())) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 })
  }
  try {
    const data = await fetchAssiduiteData()
    return NextResponse.json(data)
  } catch (err) {
    // Détail loggé côté serveur uniquement ; le client reçoit un message
    // générique pour ne pas divulguer la structure interne / les erreurs API.
    console.error("[/api/assiduite]", err)
    return NextResponse.json(
      { error: "Impossible de charger les données pour le moment." },
      { status: 500 },
    )
  }
}
