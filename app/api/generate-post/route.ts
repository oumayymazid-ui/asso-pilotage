import Anthropic from "@anthropic-ai/sdk"
import { NextResponse } from "next/server"

// POST /api/generate-post
// Génère le contenu d'un post réseaux sociaux via Claude
// Body : GeneratePostRequest
// Response : GeneratePostResponse

interface Participant {
  prenom: string
  nom: string
}

export interface GeneratePostRequest {
  categorie: "atelier" | "autre"
  titre: string
  // Pour les posts "atelier"
  sessionTitre?: string
  sessionDate?: string
  apprenantes?: Participant[]
  benevoles?: string[]
  formatrices?: string[]
  // Pour les posts "autre"
  brief?: string
  // Plateformes ciblées (pour générer des variations)
  plateformes: ("LinkedIn" | "Instagram" | "Facebook")[]
}

export interface GeneratePostResponse {
  contenu: string
  plateformeContenu: Partial<
    Record<"LinkedIn" | "Instagram" | "Facebook", { contenu: string; tags: string }>
  >
}

// Tones courts par plateforme pour le prompt
const TONE: Record<string, string> = {
  LinkedIn:  "pro & inspirant",
  Instagram: "enthousiaste, emojis",
  Facebook:  "convivial & communautaire",
}

function buildPrompt(req: GeneratePostRequest): string {
  // Contexte : atelier (session + participants) ou autre (brief)
  const ctx = req.categorie === "atelier"
    ? [
        `Atelier : ${req.sessionTitre ?? req.titre}`,
        req.sessionDate ? `Date : ${new Date(req.sessionDate).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}` : null,
        (req.apprenantes?.length ?? 0) > 0 ? `${req.apprenantes!.length} apprenante${req.apprenantes!.length > 1 ? "s" : ""}` : null,
        req.benevoles?.length  ? `Bénévoles : ${req.benevoles.join(", ")}` : null,
        req.formatrices?.length ? `Formatrice : ${req.formatrices.join(", ")}` : null,
      ].filter(Boolean).join(" | ")
    : `Brief : ${req.brief ?? req.titre}`

  // Schéma JSON attendu (une ligne par plateforme)
  const schema = `{"contenu":"...","plateformeContenu":{${req.plateformes.map(p => `"${p}":{"contenu":"...","tags":"..."}`).join(",")}}}`

  const tones = req.plateformes.map(p => `${p}=${TONE[p] ?? "adapté"}`).join(", ")

  return `Rédige en français un post réseaux sociaux pour Ada Tech School (asso formation numérique).
${ctx}
Titre : ${req.titre}
Plateformes : ${tones}

Règles : contenu principal 2-3 phrases. Variante courte + hashtags par plateforme.
JSON UNIQUEMENT, sans markdown : ${schema}`
}

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || apiKey.startsWith("sk-ant-VOTRE")) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY non configurée. Ajoutez votre clé dans .env.local." },
      { status: 500 }
    )
  }

  let body: GeneratePostRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide." }, { status: 400 })
  }

  if (!body.titre || !body.categorie || !body.plateformes?.length) {
    return NextResponse.json({ error: "Champs requis manquants (titre, categorie, plateformes)." }, { status: 400 })
  }

  const client = new Anthropic({ apiKey })
  const prompt = buildPrompt(body)

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    })

    const rawText = message.content[0].type === "text" ? message.content[0].text : ""

    // Parse the JSON response
    const parsed: GeneratePostResponse = JSON.parse(rawText)
    return NextResponse.json(parsed)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erreur inconnue"
    return NextResponse.json({ error: `Erreur Claude : ${msg}` }, { status: 500 })
  }
}
