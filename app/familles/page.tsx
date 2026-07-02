"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { Search, Plus } from "lucide-react"
import SlideOver, { Field, Input, FormRow, SaveButton } from "@/components/SlideOver"
import AdresseAutocomplete from "@/components/AdresseAutocomplete"
import Pagination, { usePagination } from "@/components/Pagination"
import { fetchFamilles, fetchMembres, addFamille, isApiConfigured, type FamilleSheet, type MembreSheet } from "@/lib/sheets-api"

type Onglet = "familles" | "membres"

const niveauStyle: Record<string, string> = {
  "Alpha":   "bg-slate-100 text-slate-600",
  "A1-":     "bg-absences-light text-absences-dark",
  "A1+":     "bg-absences-light text-absences-dark",
  "A2-":     "bg-ateliers-light text-ateliers-dark",
  "A2+/B1":  "bg-finances-light text-finances-dark",
}

const statutStyle: Record<string, string> = {
  "EN COURS":  "bg-finances-light text-finances-dark",
  "SUSPENDU":  "bg-ateliers-light text-ateliers-dark",
  "ARRÊTÉ":    "bg-absences-light text-absences-dark",
  "ARRETE":    "bg-absences-light text-absences-dark",
}

const emptyForm = { Nom_Famille: "", Adresse: "", Code_Postal: "", Ville: "", Quartier_QVP: "" }

export default function FamillesPage() {
  const [onglet, setOnglet]       = useState<Onglet>("familles")
  const [familles, setFamilles]   = useState<FamilleSheet[]>([])
  const [membres, setMembres]     = useState<MembreSheet[]>([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState("")
  const [slideOpen, setSlideOpen] = useState(false)
  const [form, setForm]           = useState(emptyForm)
  const apiOk = isApiConfigured()

  const loadData = useCallback(async () => {
    if (!apiOk) { setLoading(false); return }
    try {
      const [f, m] = await Promise.all([fetchFamilles(), fetchMembres()])
      setFamilles(f)
      setMembres(m)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [apiOk])

  useEffect(() => { loadData() }, [loadData])
  function switchOnglet(o: Onglet) { setOnglet(o); setSearch("") }

  async function handleSaveFamille() {
    await addFamille({ Nom_Famille: form.Nom_Famille, Adresse: form.Adresse, Code_Postal: form.Code_Postal, Ville: form.Ville, Quartier_QVP: form.Quartier_QVP })
    await loadData()
    setForm(emptyForm)
    setSlideOpen(false)
  }

  // normalise (minuscules + sans accents) pour une recherche tolérante
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  const q = norm(search.trim())

  // recherche sur le DÉBUT du nom (préfixe), puis tri alphabétique
  const filteredFamilles = familles
    .filter(f => norm(f.Nom_Famille ?? "").startsWith(q))
    .sort((a, b) => (a.Nom_Famille ?? "").localeCompare(b.Nom_Famille ?? "", "fr"))

  const filteredMembres = membres
    .filter(m => norm(m.Prenom ?? "").startsWith(q) || norm(m.Nom ?? "").startsWith(q))
    .sort((a, b) => (a.Prenom ?? "").localeCompare(b.Prenom ?? "", "fr"))

  const famillesPagination = usePagination(filteredFamilles, "asso-familles-page-size")
  const membresPagination  = usePagination(filteredMembres, "asso-familles-membres-page-size")

  const tabs = [
    { key: "familles" as Onglet, label: "Familles", count: familles.length },
    { key: "membres"  as Onglet, label: "Membres",  count: membres.length },
  ]

  if (!apiOk) return (
    <div className="p-6 max-w-2xl mx-auto mt-12 text-center">
      <div className="bg-ateliers-light rounded-xl p-8">
        <h2 className="text-lg font-semibold text-ateliers-dark mb-2">Configuration requise</h2>
        <p className="text-sm text-muted mb-4">
          Le module Familles est connecté à Google Sheets.<br />
          Il faut déployer le Web App Apps Script et ajouter l&apos;URL dans <code className="bg-white px-1 rounded">.env.local</code>.
        </p>
        <code className="text-xs bg-white rounded px-3 py-2 block text-left">
          NEXT_PUBLIC_SHEETS_API_URL=https://script.google.com/...
        </code>
      </div>
    </div>
  )

  if (loading) return (
    <div className="p-6 flex items-center justify-center min-h-[300px]">
      <p className="text-muted text-sm">Chargement des données…</p>
    </div>
  )

  return (
    <div className="p-6 max-w-6xl mx-auto">

      {/* En-tête */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-familles-dark">Bénéficiaires</h1>
          <p className="text-sm text-muted mt-0.5">Familles et membres suivis par l&apos;association</p>
        </div>
        {onglet === "familles" && (
          <button
            onClick={() => { setForm(emptyForm); setSlideOpen(true) }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-familles text-white text-sm font-medium hover:bg-familles-dark transition-colors shrink-0"
          >
            <Plus size={14} />
            Ajouter une famille
          </button>
        )}
      </div>

      {/* Onglets + recherche */}
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => switchOnglet(t.key)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
                onglet === t.key
                  ? "bg-surface text-familles-dark shadow-sm"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {t.label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                onglet === t.key ? "bg-familles-light text-familles-dark" : "bg-white text-muted"
              }`}>
                {t.count}
              </span>
            </button>
          ))}
        </div>

        <div className="relative w-72">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            aria-label={onglet === "familles" ? "Rechercher par nom de famille" : "Rechercher un membre"}
            placeholder={onglet === "familles" ? "Rechercher par nom de famille…" : "Rechercher un membre…"}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-familles/30 focus:border-familles"
          />
        </div>
      </div>

      {/* ── Onglet Familles ── */}
      {onglet === "familles" && (
        filteredFamilles.length === 0
          ? <p className="text-muted text-sm text-center mt-16">Aucune famille trouvée.</p>
          : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {famillesPagination.pageItems.map(famille => {
                  const membresF = membres.filter(m => m.ID_Famille === famille.ID_Famille)
                  return (
                    <Link
                      key={famille.ID_Famille}
                      href={`/familles/${famille.ID_Famille}`}
                      className="bg-surface border border-border rounded-xl p-5 hover:border-familles/40 hover:shadow-sm transition-all block"
                    >
                      <p className="text-lg font-bold text-familles-dark">{famille.Nom_Famille || "—"}</p>
                      {(famille.Adresse_Complete || famille.Adresse) && (
                        <p className="text-xs text-slate-400 mt-1">{famille.Adresse_Complete || famille.Adresse}</p>
                      )}
                      <div className="mt-4 flex items-center justify-between gap-2">
                        {String(famille.Quartier_QVP ?? "").trim()
                          ? <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-familles-light text-familles-dark">
                              QVP {String(famille.Quartier_QVP).toUpperCase()}
                            </span>
                          : <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-500">Hors QVP</span>
                        }
                        <span className="text-xs text-muted">
                          {membresF.length} membre{membresF.length > 1 ? "s" : ""}
                        </span>
                      </div>
                    </Link>
                  )
                })}
              </div>
              <Pagination
                page={famillesPagination.page}
                totalPages={famillesPagination.totalPages}
                total={famillesPagination.total}
                pageSize={famillesPagination.pageSize}
                onPageChange={famillesPagination.setPage}
                onPageSizeChange={famillesPagination.changePageSize}
                accentClass="focus:ring-2 focus:ring-familles/30"
              />
            </>
          )
      )}

      {/* ── Onglet Membres ── */}
      {onglet === "membres" && (
        filteredMembres.length === 0
          ? <p className="text-muted text-sm text-center mt-16">Aucun membre trouvé.</p>
          : (
            <div className="bg-surface border border-border rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-border">
                <p className="text-xs text-muted">{filteredMembres.length} membre{filteredMembres.length > 1 ? "s" : ""}</p>
              </div>
              <div className="px-5 py-2 flex items-center gap-4 bg-slate-50 border-b border-border text-xs font-semibold text-muted">
                <div className="w-9 shrink-0" />
                <span className="flex-1">Membre</span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="w-20 text-center">Niveau</span>
                  <span className="w-28 text-center">Statut</span>
                  <span className="w-24 text-center">Pays</span>
                </div>
              </div>
              <ul className="divide-y divide-border">
                {membresPagination.pageItems.map(m => {
                  const famille = familles.find(f => f.ID_Famille === m.ID_Famille)
                  const statut = m.Statut_Inscription?.toString().toUpperCase() ?? ""
                  return (
                    <li key={m.ID_Membre}>
                      <Link
                        href={`/familles/${m.ID_Famille}/membre/${m.ID_Membre}`}
                        className="px-5 py-4 flex items-center gap-4 hover:bg-slate-50 transition-colors block"
                      >
                        <div className="w-9 h-9 rounded-full bg-familles-light flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-familles-dark">
                            {(m.Prenom?.[0] ?? "?").toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-foreground">{m.Prenom}</p>
                          <p className="text-xs text-muted">{famille?.Nom_Famille ?? m.ID_Famille}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="w-20 flex justify-center">
                            {m.Niveau && (
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${niveauStyle[m.Niveau] ?? "bg-slate-100 text-slate-600"}`}>
                                {m.Niveau}
                              </span>
                            )}
                          </div>
                          <div className="w-28 flex justify-center">
                            {statut && (
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statutStyle[statut] ?? "bg-slate-100 text-slate-600"}`}>
                                {statut}
                              </span>
                            )}
                          </div>
                          <div className="w-24 text-center">
                            <span className="text-xs text-muted">{m.Pays_Origine || "—"}</span>
                          </div>
                        </div>
                      </Link>
                    </li>
                  )
                })}
              </ul>
              <div className="px-5 pb-4">
                <Pagination
                  page={membresPagination.page}
                  totalPages={membresPagination.totalPages}
                  total={membresPagination.total}
                  pageSize={membresPagination.pageSize}
                  onPageChange={membresPagination.setPage}
                  onPageSizeChange={membresPagination.changePageSize}
                  accentClass="focus:ring-2 focus:ring-familles/30"
                />
              </div>
            </div>
          )
      )}

      {/* SlideOver nouvelle famille */}
      <SlideOver open={slideOpen} onClose={() => setSlideOpen(false)} title="Ajouter une famille" width="md">
        <form onSubmit={e => { e.preventDefault(); handleSaveFamille() }} className="flex flex-col gap-4">
          <Field label="Nom de famille" required>
            <Input value={form.Nom_Famille} onChange={e => setForm(f => ({ ...f, Nom_Famille: e.target.value }))} />
          </Field>
          <Field label="Adresse (rue)">
            <AdresseAutocomplete
              value={form.Adresse}
              onChange={v => setForm(f => ({ ...f, Adresse: v }))}
              onSelect={a => setForm(f => ({ ...f, Adresse: a.adresse, Code_Postal: a.codePostal, Ville: a.ville }))}
            />
          </Field>
          <FormRow>
            <Field label="Code postal">
              <Input value={form.Code_Postal} onChange={e => setForm(f => ({ ...f, Code_Postal: e.target.value }))} />
            </Field>
            <Field label="Ville">
              <Input value={form.Ville} onChange={e => setForm(f => ({ ...f, Ville: e.target.value }))} />
            </Field>
          </FormRow>
          <Field label="Quartier QVP">
            <Input value={form.Quartier_QVP} onChange={e => setForm(f => ({ ...f, Quartier_QVP: e.target.value }))} placeholder="ex. Bellevue Nantes" />
          </Field>
          <SaveButton accent="familles" />
        </form>
      </SlideOver>
    </div>
  )
}
