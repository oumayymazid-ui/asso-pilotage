import { NextRequest, NextResponse } from "next/server"
import { getServerUser } from "@/lib/supabase/server"

const GEMINI_MODEL = "gemini-2.5-flash"

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    nom:            { type: "STRING", description: "Nom de famille de l'adhérent" },
    prenom:         { type: "STRING", description: "Prénom(s) de l'adhérent" },
    date_naissance: { type: "STRING", description: "Date de naissance au format JJ/MM/AAAA" },
    telephones: {
      type: "ARRAY",
      description: "Numéro(s) de téléphone sans espaces ni points (ex: 0461902945)",
      items: { type: "STRING" },
    },
    montant_total:  { type: "NUMBER", description: "Montant total inscription + adhésion en euros" },
    date_signature: { type: "STRING", description: "Date de signature au format JJ/MM/AAAA" },
  },
  required: ["nom", "prenom", "date_naissance", "telephones", "montant_total", "date_signature"],
}

export async function POST(request: NextRequest) {
  if (!(await getServerUser())) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 })
  }
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY non configurée" }, { status: 500 })
  }

  let pdfBase64: string
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File | null
    if (!file) return NextResponse.json({ error: "Fichier manquant" }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    pdfBase64 = buffer.toString("base64")
  } catch {
    return NextResponse.json({ error: "Impossible de lire le fichier" }, { status: 400 })
  }

  const payload = {
    contents: [
      {
        parts: [
          {
            inlineData: {
              mimeType: "application/pdf",
              data: pdfBase64,
            },
          },
          {
            text:
              "Tu es un assistant spécialisé en OCR de documents manuscrits en français. " +
              "Extrais les informations du bulletin d'inscription AREA ci-joint. " +
              "ATTENTION aux confusions fréquentes dans ce type d'écriture : " +
              "chiffres 1/7, 4/9, 3/8 ; lettres N/M, a/u, e/c. " +
              "Lis chaque champ indépendamment en te concentrant sur chaque lettre. " +
              "Pour les téléphones, le premier chiffre est toujours 0. " +
              "Pour les dates, utilise le format JJ/MM/AAAA. " +
              "Retourne uniquement les données manuscrites, pas le texte imprimé.",
          },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
      temperature: 0,
    },
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error("[ocr] Gemini error", res.status, err)
      return NextResponse.json({ error: `Gemini ${res.status}` }, { status: 502 })
    }

    const result = await res.json()
    const raw = result?.candidates?.[0]?.content?.parts?.[0]?.text
    if (!raw) return NextResponse.json({ error: "Réponse Gemini vide" }, { status: 502 })

    return NextResponse.json(JSON.parse(raw))
  } catch {
    console.error("[ocr] échec de l'analyse du document")
    return NextResponse.json({ error: "Échec de l'analyse du document" }, { status: 500 })
  }
}
