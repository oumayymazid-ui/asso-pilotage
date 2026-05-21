"use client"

/**
 * ⚠️ PAGE DE TEST — À SUPPRIMER AVANT LA MISE EN PRODUCTION
 *
 * Cette page injecte des données fictives dans le localStorage pour tester
 * la section "Participants à l'atelier" et la liste de floutage dans Communication.
 *
 * Pour supprimer toutes les données de test : cliquer "Supprimer données de test"
 * puis supprimer ce fichier (app/dev/seed/page.tsx) et le dossier app/dev/.
 *
 * Identifiants de test : IDs 9001–9099 (bénéficiaires et sessions)
 */

import { useState, useEffect } from "react"
import { AlertTriangle, Check, X } from "lucide-react"

const S_BENEFICIAIRES = "asso-beneficiaires"
const S_SESSIONS      = "asso-ateliers-sessions"
const TEST_ID_START   = 9001

function load<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback
  try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : fallback } catch { return fallback }
}

// ──────────────────────────────────────────────────────────
// Données fictives de test
// ──────────────────────────────────────────────────────────

const testBeneficiaires = [
  // droitsImage: true → accord donné, pas dans la liste de floutage
  { id: 9001, prenom: "Yasmine",  nom: "Benali",   droitsImage: true,  dateNaissance: "2008-03-15", email: "", telephone: "", nomParent: "Karima Benali",   telephoneParent: "06 10 00 01", emailParent: "", dateInscription: "2026-01-10", noteEvaluation: 14, niveau: "intermédiaire", notes: "", statut: "actif" },
  { id: 9002, prenom: "Aïsha",    nom: "Diallo",   droitsImage: true,  dateNaissance: "2007-07-22", email: "", telephone: "", nomParent: "Rokhaya Diallo",  telephoneParent: "06 10 00 02", emailParent: "", dateInscription: "2026-01-10", noteEvaluation: 17, niveau: "avancé",        notes: "", statut: "actif" },
  { id: 9004, prenom: "Nour",     nom: "Hamidi",   droitsImage: true,  dateNaissance: "2009-11-03", email: "", telephone: "", nomParent: "Sara Hamidi",     telephoneParent: "06 10 00 04", emailParent: "", dateInscription: "2026-01-10", noteEvaluation: 12, niveau: "intermédiaire", notes: "", statut: "actif" },
  { id: 9006, prenom: "Sofia",    nom: "Amrani",   droitsImage: true,  dateNaissance: "2008-05-18", email: "", telephone: "", nomParent: "Nadia Amrani",    telephoneParent: "06 10 00 06", emailParent: "", dateInscription: "2026-02-01", noteEvaluation: 9,  niveau: "débutant",      notes: "", statut: "actif" },
  { id: 9008, prenom: "Mariam",   nom: "Koné",     droitsImage: true,  dateNaissance: "2007-09-30", email: "", telephone: "", nomParent: "Aminata Koné",   telephoneParent: "06 10 00 08", emailParent: "", dateInscription: "2026-02-01", noteEvaluation: 16, niveau: "avancé",        notes: "", statut: "actif" },
  { id: 9009, prenom: "Dounia",   nom: "Ferhat",   droitsImage: true,  dateNaissance: "2010-01-12", email: "", telephone: "", nomParent: "Fatna Ferhat",   telephoneParent: "06 10 00 09", emailParent: "", dateInscription: "2026-02-01", noteEvaluation: 11, niveau: "intermédiaire", notes: "", statut: "actif" },

  // droitsImage: false → PAS d'accord → apparaissent dans la liste de floutage
  { id: 9003, prenom: "Fatima",   nom: "Ouhaji",   droitsImage: false, dateNaissance: "2008-12-01", email: "", telephone: "", nomParent: "Bouchra Ouhaji",  telephoneParent: "06 10 00 03", emailParent: "", dateInscription: "2026-01-10", noteEvaluation: 8,  niveau: "débutant",      notes: "Pas de droit à l'image", statut: "actif" },
  { id: 9005, prenom: "Rania",    nom: "Tazi",     droitsImage: false, dateNaissance: "2009-04-27", email: "", telephone: "", nomParent: "Houria Tazi",     telephoneParent: "06 10 00 05", emailParent: "", dateInscription: "2026-01-10", noteEvaluation: 10, niveau: "débutant",      notes: "Pas de droit à l'image", statut: "actif" },
  { id: 9007, prenom: "Leila",    nom: "Boussouf", droitsImage: false, dateNaissance: "2008-08-14", email: "", telephone: "", nomParent: "Zineb Boussouf", telephoneParent: "06 10 00 07", emailParent: "", dateInscription: "2026-02-01", noteEvaluation: 13, niveau: "intermédiaire", notes: "Pas de droit à l'image", statut: "actif" },
  { id: 9010, prenom: "Assia",    nom: "Moukrim",  droitsImage: false, dateNaissance: "2007-06-09", email: "", telephone: "", nomParent: "Malika Moukrim", telephoneParent: "06 10 00 10", emailParent: "", dateInscription: "2026-02-01", noteEvaluation: 7,  niveau: "débutant",      notes: "Pas de droit à l'image", statut: "actif" },
]

// Sessions fictives — benevoleIds référencent benevolesMock.liste (IDs 1–8)
const testSessions = [
  {
    id: 9001,
    titre: "Atelier HTML/CSS — Mai 2026",
    description: "Introduction au HTML et CSS, création d'une première page web.",
    date: "2026-05-21",
    heure: "14:00",
    duree: "2h",
    salle: "Salle B",
    formatrice: "Nadjat",
    beneficiaireIds: [9001, 9002, 9003, 9004, 9005],
    benevoleIds: [1],
    statut: "terminé",
  },
  {
    id: 9002,
    titre: "Atelier JavaScript",
    description: "Bases du JavaScript, manipulation du DOM.",
    date: "2026-06-10",
    heure: "14:00",
    duree: "2h",
    salle: "Salle A",
    formatrice: "Samira",
    beneficiaireIds: [9006, 9007, 9008, 9009, 9010],
    benevoleIds: [2, 4],
    statut: "planifié",
  },
  {
    id: 9003,
    titre: "Atelier Python — Juin 2026",
    description: "Introduction à Python, logique algorithmique.",
    date: "2026-06-24",
    heure: "10:00",
    duree: "3h",
    salle: "Salle C",
    formatrice: "Nadjat",
    beneficiaireIds: [9001, 9003, 9005, 9007, 9010],
    benevoleIds: [1, 6],
    statut: "planifié",
  },
]

// ──────────────────────────────────────────────────────────
// Résumé lisible des données de test
// ──────────────────────────────────────────────────────────
const RESUME = {
  benef: {
    accord: testBeneficiaires.filter(b => b.droitsImage).map(b => `${b.prenom} ${b.nom}`),
    flou:   testBeneficiaires.filter(b => !b.droitsImage).map(b => `${b.prenom} ${b.nom}`),
  },
  sessions: testSessions.map(s => ({
    titre: s.titre,
    date: s.date,
    apprenantes: s.beneficiaireIds.map(id => testBeneficiaires.find(b => b.id === id)).filter(Boolean).map(b => `${b!.prenom} ${b!.nom} ${b!.droitsImage ? "✓" : "⚠ flouter"}`),
    benevoles: s.benevoleIds,
  })),
}

export default function SeedPage() {
  const [status, setStatus] = useState<"idle" | "seeded" | "cleared">("idle")
  const [counts, setCounts] = useState({ benef: 0, sessions: 0 })

  useEffect(() => {
    if (typeof window === "undefined") return
    const benef    = load<{ id: number }[]>(S_BENEFICIAIRES, [])
    const sessions = load<{ id: number }[]>(S_SESSIONS, [])
    setCounts({
      benef:    benef.filter(b => b.id >= TEST_ID_START).length,
      sessions: sessions.filter(s => s.id >= TEST_ID_START).length,
    })
  }, [status])

  function seed() {
    const existingBenef    = load<object[]>(S_BENEFICIAIRES, [])
    const existingSessions = load<object[]>(S_SESSIONS, [])
    const cleanBenef    = existingBenef.filter((b: any) => b.id < TEST_ID_START)
    const cleanSessions = existingSessions.filter((s: any) => s.id < TEST_ID_START)
    localStorage.setItem(S_BENEFICIAIRES, JSON.stringify([...cleanBenef, ...testBeneficiaires]))
    localStorage.setItem(S_SESSIONS, JSON.stringify([...cleanSessions, ...testSessions]))
    setStatus("seeded")
  }

  function unseed() {
    const existingBenef    = load<object[]>(S_BENEFICIAIRES, [])
    const existingSessions = load<object[]>(S_SESSIONS, [])
    localStorage.setItem(S_BENEFICIAIRES, JSON.stringify(existingBenef.filter((b: any) => b.id < TEST_ID_START)))
    localStorage.setItem(S_SESSIONS, JSON.stringify(existingSessions.filter((s: any) => s.id < TEST_ID_START)))
    setStatus("cleared")
  }

  const hasTestData = counts.benef > 0 || counts.sessions > 0

  return (
    <div className="p-8 max-w-3xl mx-auto">
      {/* Bandeau d'avertissement */}
      <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-5 mb-8 flex items-start gap-3">
        <AlertTriangle size={20} className="text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-bold text-amber-800">Page de test — À SUPPRIMER avant production</p>
          <p className="text-sm text-amber-700 mt-1">
            Cette page injecte des données fictives uniquement pour tester la section <strong>Participants à l'atelier</strong> et la <strong>liste de floutage</strong> dans le module Communication.<br />
            Pour nettoyer : cliquer <em>Supprimer données de test</em>, puis supprimer <code>app/dev/seed/page.tsx</code>.
          </p>
        </div>
      </div>

      <h1 className="text-2xl font-bold text-foreground mb-1">Données de test</h1>
      <p className="text-sm text-muted mb-6">
        Injecte {testBeneficiaires.length} bénéficiaires fictifs et {testSessions.length} sessions dans le localStorage.
        IDs réservés : <code>9001–9099</code>.
      </p>

      {/* État actuel */}
      <div className="bg-surface border border-border rounded-2xl p-5 mb-6">
        <p className="text-sm font-semibold text-foreground mb-3">État actuel dans le localStorage</p>
        <div className="flex gap-4">
          <div className={`flex-1 rounded-xl border p-3 text-center ${counts.benef > 0 ? "bg-ateliers-light border-ateliers/30" : "bg-slate-50 border-border"}`}>
            <p className="text-2xl font-bold text-foreground">{counts.benef}</p>
            <p className="text-xs text-muted">bénéficiaires de test</p>
          </div>
          <div className={`flex-1 rounded-xl border p-3 text-center ${counts.sessions > 0 ? "bg-ateliers-light border-ateliers/30" : "bg-slate-50 border-border"}`}>
            <p className="text-2xl font-bold text-foreground">{counts.sessions}</p>
            <p className="text-xs text-muted">sessions de test</p>
          </div>
        </div>
        {status === "seeded" && (
          <div className="mt-3 flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 rounded-xl px-3 py-2">
            <Check size={14} /> Données injectées avec succès.
          </div>
        )}
        {status === "cleared" && (
          <div className="mt-3 flex items-center gap-2 text-sm text-slate-600 bg-slate-100 rounded-xl px-3 py-2">
            <X size={14} /> Données de test supprimées.
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3 mb-8">
        <button
          onClick={seed}
          className="flex-1 bg-slate-900 text-white rounded-xl py-3 text-sm font-semibold hover:bg-slate-700 transition-colors"
        >
          {hasTestData ? "Réinjecter les données de test" : "Injecter les données de test"}
        </button>
        <button
          onClick={unseed}
          disabled={!hasTestData}
          className="flex-1 bg-red-50 text-alert border border-red-200 rounded-xl py-3 text-sm font-semibold hover:bg-red-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Supprimer données de test
        </button>
      </div>

      {/* Résumé des données */}
      <div className="space-y-6">
        {/* Bénéficiaires */}
        <div className="bg-surface border border-border rounded-2xl p-5">
          <p className="text-sm font-semibold text-foreground mb-4">
            Bénéficiaires injectés ({testBeneficiaires.length})
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-emerald-700 mb-2">✓ Accord droit à l'image ({RESUME.benef.accord.length})</p>
              <div className="space-y-1">
                {RESUME.benef.accord.map(nom => (
                  <div key={nom} className="text-xs text-foreground bg-emerald-50 rounded-lg px-2.5 py-1">{nom}</div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-alert mb-2">⚠ À flouter — sans accord ({RESUME.benef.flou.length})</p>
              <div className="space-y-1">
                {RESUME.benef.flou.map(nom => (
                  <div key={nom} className="text-xs text-foreground bg-red-50 rounded-lg px-2.5 py-1">{nom}</div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Sessions */}
        {RESUME.sessions.map((s, i) => (
          <div key={i} className="bg-surface border border-border rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-foreground">{s.titre}</p>
              <span className="text-xs text-muted">{new Date(s.date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</span>
            </div>
            <p className="text-xs font-medium text-muted mb-2">Apprenantes ({s.apprenantes.length})</p>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {s.apprenantes.map(nom => {
                const flou = nom.includes("flouter")
                return (
                  <span key={nom} className={`text-xs px-2.5 py-1 rounded-full font-medium ${flou ? "bg-red-50 text-alert" : "bg-ateliers-light text-ateliers-dark"}`}>
                    {nom}
                  </span>
                )
              })}
            </div>
            <p className="text-xs text-muted">Bénévoles IDs : {s.benevoles.join(", ")} (Amira L., Céline D., etc.)</p>
          </div>
        ))}
      </div>

      {/* Instructions de test */}
      <div className="mt-8 bg-slate-50 border border-border rounded-2xl p-5">
        <p className="text-sm font-semibold text-foreground mb-3">Comment tester</p>
        <ol className="text-xs text-muted space-y-2 list-decimal list-inside">
          <li>Cliquer <strong>Injecter les données de test</strong> ci-dessus</li>
          <li>Aller dans <strong>/communication</strong> → créer ou modifier un post</li>
          <li>Choisir la catégorie <strong>Atelier</strong></li>
          <li>Dans <em>Session associée</em>, sélectionner une des 3 sessions de test</li>
          <li>Les participants s'auto-remplissent — la section <em>Personnes à flouter</em> affiche les 4 sans accord</li>
          <li>Tester aussi l'ajout/suppression manuelle de participants</li>
          <li>Cliquer sur une carte Kanban → édition directe sans étape intermédiaire</li>
        </ol>
      </div>
    </div>
  )
}
