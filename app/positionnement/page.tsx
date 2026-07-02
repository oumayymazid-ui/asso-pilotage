"use client"

import { useState, useEffect } from "react"
import { GraduationCap, Sparkles, RotateCcw, Printer, Copy, Check, AlertTriangle, Volume2, Download } from "lucide-react"
import { NIVEAUX, getNiveau, type NiveauKey } from "@/lib/positionnement-data"
import { exportWord, exportPdf, type GeneratedContent } from "@/lib/export-positionnement"

const ORAL_CATEGORIE_ID = "comprehension-orale"

// contenu généré, par niveau puis par catégorie
type GeneresParNiveau = Record<string, Record<string, GeneratedContent>>

async function fetchFromSheets(): Promise<GeneresParNiveau> {
  try {
    const res = await fetch("/api/sheets?action=getPositionnements")
    if (!res.ok) return {}
    return await res.json()
  } catch {
    return {}
  }
}

// Une ligne de réponse générée par l'API est une suite de points de longueur fixe ;
// on l'affiche comme un vrai trait qui occupe toute la largeur disponible plutôt que
// de compter sur le nombre de caractères pour remplir la ligne visuellement.
const LIGNE_REPONSE_REGEX = /^\.{10,}$/

function ExerciceTexte({ texte }: { texte: string }) {
  return (
    <div className="font-sans text-sm text-foreground leading-relaxed">
      {texte.split("\n").map((line, i) =>
        LIGNE_REPONSE_REGEX.test(line.trim()) ? (
          <div key={i} className="border-b border-slate-400 h-5 print:h-6" aria-hidden="true" />
        ) : (
          <div key={i} className="whitespace-pre-wrap">{line || " "}</div>
        )
      )}
    </div>
  )
}

export default function PositionnementPage() {
  const [niveauKey, setNiveauKey] = useState<NiveauKey>(NIVEAUX[0].key)
  const [generes, setGeneres] = useState<GeneresParNiveau>({})
  const [loadingCat, setLoadingCat] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copiedCat, setCopiedCat] = useState<string | null>(null)
  const [transcriptionVisible, setTranscriptionVisible] = useState<Record<string, boolean>>({})
  const [exporting, setExporting] = useState<"word" | "pdf" | null>(null)
  const [loadingSheets, setLoadingSheets] = useState(true)

  useEffect(() => {
    fetchFromSheets().then((data) => {
      setGeneres(data)
      setLoadingSheets(false)
    })
  }, [])

  const niveau = getNiveau(niveauKey)!
  const contenusNiveau = generes[niveauKey] ?? {}

  function persist(next: GeneresParNiveau) {
    setGeneres(next)
  }

  async function genererCategorie(categorieId: string) {
    setError(null)
    setLoadingCat(categorieId)
    try {
      const res = await fetch("/api/generate-positionnement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ niveau: niveauKey, categorieId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Erreur de génération")
      persist({
        ...generes,
        [niveauKey]: {
          ...(generes[niveauKey] ?? {}),
          [categorieId]: {
            contenu: data.contenu,
            transcription: data.transcription,
            audio: data.audio,
            audioError: data.audioError,
            image: data.image,
            imageError: data.imageError,
          },
        },
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue")
    } finally {
      setLoadingCat(null)
    }
  }

  async function genererTout() {
    for (const cat of niveau.categories) {
      await genererCategorie(cat.id)
    }
  }

  function copier(categorieId: string, texte: string) {
    navigator.clipboard.writeText(texte)
    setCopiedCat(categorieId)
    setTimeout(() => setCopiedCat(null), 1500)
  }

  function imprimer() {
    window.print()
  }

  async function telechargerWord() {
    setExporting("word")
    try {
      await exportWord(niveau, contenusNiveau)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec de l'export Word")
    } finally {
      setExporting(null)
    }
  }

  async function telechargerPdf() {
    setExporting("pdf")
    try {
      await exportPdf(niveau, contenusNiveau)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec de l'export PDF")
    } finally {
      setExporting(null)
    }
  }

  const toutGenere = niveau.categories.length > 0 && niveau.categories.every((c) => contenusNiveau[c.id])
  const auMoinsUnGenere = niveau.categories.some((c) => contenusNiveau[c.id]?.contenu)

  if (loadingSheets) {
    return (
      <div className="p-8 max-w-5xl mx-auto flex items-center gap-3 text-muted text-sm">
        <Sparkles size={16} className="animate-pulse text-positionnement" />
        Chargement des exercices sauvegardés…
      </div>
    )
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <header className="mb-8 flex items-start justify-between gap-4 print:hidden">
        <div>
          <p className="text-sm text-muted">Bénéficiaires</p>
          <h1 className="text-2xl font-bold text-foreground mt-1 flex items-center gap-2">
            <GraduationCap size={22} className="text-positionnement-dark" />
            Test de positionnement
          </h1>
          <p className="text-sm text-muted mt-1">Génère un test de positionnement adapté au niveau du bénéficiaire.</p>
        </div>
        {auMoinsUnGenere && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={telechargerWord}
              disabled={exporting !== null}
              title={!toutGenere ? "Exporte les exercices déjà générés pour ce niveau" : undefined}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-surface border border-border text-foreground text-sm font-medium hover:border-positionnement transition-colors disabled:opacity-50"
            >
              <Download size={15} />
              {exporting === "word" ? "Export…" : "Word"}
            </button>
            <button
              onClick={telechargerPdf}
              disabled={exporting !== null}
              title={!toutGenere ? "Exporte les exercices déjà générés pour ce niveau" : undefined}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-surface border border-border text-foreground text-sm font-medium hover:border-positionnement transition-colors disabled:opacity-50"
            >
              <Download size={15} />
              {exporting === "pdf" ? "Export…" : "PDF"}
            </button>
            <button
              onClick={imprimer}
              title={!toutGenere ? "Imprime les exercices déjà générés pour ce niveau" : undefined}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-positionnement text-white text-sm font-medium hover:bg-positionnement-dark transition-colors"
            >
              <Printer size={15} />
              Imprimer
            </button>
          </div>
        )}
      </header>

      {/* Sélecteur de niveau */}
      <div className="mb-6 print:hidden">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Niveau du test</p>
        <div className="flex flex-wrap gap-2">
          {NIVEAUX.map((n) => (
            <button
              key={n.key}
              onClick={() => setNiveauKey(n.key)}
              className={`px-3.5 py-2 rounded-lg text-sm font-medium border transition-colors ${
                n.key === niveauKey
                  ? "bg-positionnement text-white border-positionnement"
                  : "bg-surface text-foreground border-border hover:border-positionnement"
              }`}
            >
              {n.label}
            </button>
          ))}
        </div>
        <p className="text-sm text-muted mt-2">{niveau.description}</p>
      </div>

      {error && (
        <div role="alert" className="mb-6 flex items-center gap-2 bg-red-50 border border-alert/20 text-alert rounded-lg px-4 py-3 text-sm font-medium print:hidden">
          <AlertTriangle size={16} className="shrink-0" />
          {error}
        </div>
      )}

      <div className="mb-6 print:hidden">
        <button
          onClick={genererTout}
          disabled={loadingCat !== null}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-positionnement text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          <Sparkles size={15} />
          Générer le test complet ({niveau.categories.length} catégorie{niveau.categories.length > 1 ? "s" : ""})
        </button>
      </div>

      {/* En-tête imprimable */}
      <div className="hidden print:block mb-6">
        <h1 className="text-xl font-bold">Test de positionnement — {niveau.label}</h1>
        <p className="text-sm">Nom : ……………………………………  Prénom : ……………………………………  Date : ……………………</p>
      </div>

      <div className="flex flex-col gap-5">
        {niveau.categories.map((cat) => {
          const data = contenusNiveau[cat.id]
          const loading = loadingCat === cat.id
          const isOral = cat.id === ORAL_CATEGORIE_ID
          const transcriptionShown = transcriptionVisible[cat.id]
          return (
            <div key={cat.id} className="bg-surface border border-border rounded-xl p-5 print:border-0 print:p-0 print:break-inside-avoid">
              <div className="flex items-center justify-between gap-3 mb-3 print:mb-2">
                <h2 className="font-semibold text-foreground">
                  {cat.nom} <span className="text-muted font-normal text-sm">/ {cat.bareme}</span>
                </h2>
                <div className="flex items-center gap-2 print:hidden">
                  {data?.contenu && (
                    <button
                      onClick={() => copier(cat.id, data.contenu)}
                      title="Copier le texte"
                      className="p-1.5 rounded-md hover:bg-slate-100 text-muted transition-colors"
                    >
                      {copiedCat === cat.id ? <Check size={14} className="text-finances" /> : <Copy size={14} />}
                    </button>
                  )}
                  <button
                    onClick={() => genererCategorie(cat.id)}
                    disabled={loading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-positionnement-light text-positionnement-dark text-xs font-semibold hover:bg-positionnement/20 transition-colors disabled:opacity-50"
                  >
                    {data?.contenu ? <RotateCcw size={13} /> : <Sparkles size={13} />}
                    {loading ? (isOral ? "Génération + audio…" : "Génération…") : data?.contenu ? "Régénérer" : "Générer"}
                  </button>
                </div>
              </div>

              {data?.contenu ? (
                <>
                  {data.image && (
                    <div className="mb-4">
                      <img
                        src={data.image}
                        alt="Document visuel de l'exercice"
                        className="rounded-lg border border-border max-w-full max-h-72 object-contain"
                      />
                    </div>
                  )}
                  {data.imageError && !data.image && (
                    <div className="mb-3 flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 print:hidden">
                      <AlertTriangle size={13} className="shrink-0" />
                      Image non générée : {data.imageError}
                    </div>
                  )}
                  {isOral && (
                    <div className="mb-4 print:hidden">
                      {data.audio ? (
                        <div className="flex items-center gap-3 bg-positionnement-light/40 border border-positionnement/20 rounded-lg px-3 py-2.5">
                          <Volume2 size={16} className="text-positionnement-dark shrink-0" />
                          <audio controls src={data.audio} className="flex-1 h-9" />
                          <a
                            href={data.audio}
                            download={`comprehension-orale-${niveau.key}.wav`}
                            title="Télécharger l'audio"
                            className="p-1.5 rounded-md hover:bg-white text-muted transition-colors shrink-0"
                          >
                            <Download size={15} />
                          </a>
                        </div>
                      ) : data.audioError ? (
                        <div className="flex items-center gap-2 text-xs text-alert bg-red-50 border border-alert/20 rounded-lg px-3 py-2">
                          <AlertTriangle size={13} className="shrink-0" />
                          Audio non généré : {data.audioError}
                        </div>
                      ) : null}
                      {data.transcription && (
                        <button
                          onClick={() => setTranscriptionVisible((v) => ({ ...v, [cat.id]: !v[cat.id] }))}
                          className="mt-2 text-xs text-muted underline hover:text-foreground"
                        >
                          {transcriptionShown ? "Masquer la transcription (formateur)" : "Afficher la transcription (formateur)"}
                        </button>
                      )}
                      {transcriptionShown && data.transcription && (
                        <p className="mt-2 text-xs text-muted italic bg-slate-50 rounded-lg p-3 whitespace-pre-wrap">{data.transcription}</p>
                      )}
                    </div>
                  )}
                  <ExerciceTexte texte={data.contenu} />
                </>
              ) : (
                <p className="text-sm text-muted italic print:hidden">
                  {loading ? (isOral ? "Génération de l'exercice et de l'audio en cours…" : "Génération de l'exercice en cours…") : "Pas encore généré."}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
