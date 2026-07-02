"use client"

// ─────────────────────────────────────────────────────────────────────────────
//  Page Veille subventions
//
//  Vue hybride : tableau stylisé (lit le Sheet via /api/subventions-sheet)
//  ou vue iframe directe du Sheet. Édition du statut + suppression de lignes
//  via /api/subventions-sheet/update et /delete, qui relayent à un Web App
//  Apps Script (cf. lib/sheets-webapp.ts).
//
//  Toute la logique pure (parsing, formattage, couleurs) vit dans
//  lib/veille-subventions.ts ; les cellules sont dans _components/cells.tsx.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, Calendar, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, ClipboardCheck, ExternalLink, List, RotateCcw, Search, X } from "lucide-react"
import {
  EMBED_URL,
  OPEN_URL,
  formatMontant,
  isBilanChecked,
  resolveColumns,
  type ResolvedColumns,
  type ResponsablesResponse,
  type SheetErrorResponse,
  type SheetResponse,
  type SheetRow,
} from "@/lib/veille-subventions"
import {
  AtelierCell,
  BilanCell,
  DeadlineCell,
  DeleteRowButton,
  IntituleCell,
  OrganismeCell,
  ResponsableCell,
  StatutCell,
  TypeCell,
} from "./_components/cells"
import { ColumnFilterMenu, type FilterOption } from "./_components/column-filter"

// Colonnes filtrables (multi-sélection via les en-têtes). Clés = clés de ResolvedColumns.
const FILTER_KEYS = ["organisme", "type", "atelier", "statut", "responsable", "bilan"] as const
type FilterKey = (typeof FILTER_KEYS)[number]

// Sentinelle pour l'option « (non renseigné) » (cellule vide) : une valeur
// qui n'entre jamais en collision avec une vraie valeur du Sheet.
const EMPTY_FILTER = "__vide__"

// Pagination : choix du nombre de subventions par page (défaut 10, mémorisé).
const PAGE_SIZE_OPTIONS = [5, 10, 25, 50, 100]
const DEFAULT_PAGE_SIZE = 10
const PAGE_SIZE_KEY = "asso-veille-page-size"

// Tri : colonnes triables + helpers de parsing. Les valeurs vides/inconnues
// renvoient null → toujours reléguées en fin de liste (cf. sortedRows).
type SortKey = "montant" | "date"
type SortDir = "asc" | "desc"
type SortState = { key: SortKey; dir: SortDir } | null

/** Montant → nombre pour le tri. Vide ou 0 → null (placé en fin). */
function montantSortValue(raw: string | undefined): number | null {
  const n = Number((raw ?? "").replace(/[^\d.-]/g, ""))
  return Number.isFinite(n) && n !== 0 ? n : null
}

/** Date (DD/MM/YYYY ou YYYY-MM-DD) → clé numérique AAAAMMJJ. Invalide/vide → null. */
function dateSortValue(raw: string | undefined): number | null {
  const s = (raw ?? "").trim()
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return +iso[1] * 10000 + +iso[2] * 100 + +iso[3]
  const fr = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  if (fr) return +fr[3] * 10000 + +fr[2] * 100 + +fr[1]
  return null
}

type View = "tableau" | "sheet"
type MutationError = { msg: string; hint?: string }

export default function VeilleSubventionsPage() {
  // ── State ───────────────────────────────────────────────────────────────────
  const [data, setData] = useState<SheetResponse | null>(null)
  const [error, setError] = useState<SheetErrorResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<View>("tableau")
  const [search, setSearch] = useState("")
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({})
  const [sort, setSort] = useState<SortState>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [pending, setPending] = useState<Record<string, true>>({})
  const [mutationError, setMutationError] = useState<MutationError | null>(null)
  const [responsables, setResponsables] = useState<string[]>([])

  // ── Data fetching ───────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/subventions-sheet", { cache: "no-store" })
      const body = await res.json()
      if (!res.ok) {
        setError(body as SheetErrorResponse)
        setData(null)
      } else {
        setData(body as SheetResponse)
      }
    } catch (e) {
      setError({ status: 0, error: "Erreur réseau", hint: e instanceof Error ? e.message : String(e) })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // Liste des responsables (feuille « Responsables possibles »). Non bloquant :
  // en cas d'échec, le dropdown garde la valeur actuelle de chaque ligne.
  useEffect(() => {
    let active = true
    fetch("/api/subventions-sheet/responsables", { cache: "no-store" })
      .then((res) => res.json())
      .then((body: ResponsablesResponse) => { if (active) setResponsables(body.responsables ?? []) })
      .catch(() => { if (active) setResponsables([]) })
    return () => { active = false }
  }, [])

  // Préférence « résultats par page » mémorisée (localStorage). Hydratation SSR-safe.
  useEffect(() => {
    const saved = Number(localStorage.getItem(PAGE_SIZE_KEY))
    if (PAGE_SIZE_OPTIONS.includes(saved)) setPageSize(saved)
  }, [])

  // ── Derived state ───────────────────────────────────────────────────────────
  const cols = useMemo<ResolvedColumns | null>(
    () => (data ? resolveColumns(data.headers) : null),
    [data],
  )

  // Options de chaque filtre de colonne, calculées sur TOUTES les lignes (pas
  // seulement les lignes filtrées) : valeurs distinctes + compteur, « (non
  // renseigné) » en dernier pour les cellules vides.
  const filterOptions = useMemo<Record<string, FilterOption[]>>(() => {
    const result: Record<string, FilterOption[]> = {}
    if (!data || !cols) return result
    for (const key of FILTER_KEYS) {
      const colName = cols[key]
      if (!colName) { result[key] = []; continue }
      // Bilan : deux buckets « Coché » / « Non coché » (case à cocher)
      if (key === "bilan") {
        let checked = 0
        for (const r of data.rows) if (isBilanChecked(r[colName])) checked++
        result[key] = [
          { value: "Coché", label: "Coché", count: checked },
          { value: "Non coché", label: "Non coché", count: data.rows.length - checked },
        ]
        continue
      }
      const counts = new Map<string, number>()
      for (const r of data.rows) {
        const v = (r[colName] ?? "").trim() || EMPTY_FILTER
        counts.set(v, (counts.get(v) ?? 0) + 1)
      }
      result[key] = Array.from(counts.entries())
        .map(([value, count]) => ({ value, count, label: value === EMPTY_FILTER ? "(non renseigné)" : value }))
        .sort((a, b) => {
          if (a.value === EMPTY_FILTER) return 1
          if (b.value === EMPTY_FILTER) return -1
          return a.label.localeCompare(b.label, "fr")
        })
    }
    return result
  }, [data, cols])

  const anyFilterActive = Object.values(columnFilters).some((v) => v && v.length > 0)

  const filtered = useMemo(() => {
    if (!data) return []
    const q = search.toLowerCase().trim()
    return data.rows.filter((r) => {
      // Filtres de colonnes : ET entre colonnes, OU à l'intérieur d'une colonne
      for (const key of FILTER_KEYS) {
        const sel = columnFilters[key]
        if (!sel || sel.length === 0) continue
        const colName = cols?.[key]
        if (!colName) continue
        const v = key === "bilan"
          ? (isBilanChecked(r[colName]) ? "Coché" : "Non coché")
          : ((r[colName] ?? "").trim() || EMPTY_FILTER)
        if (!sel.includes(v)) return false
      }
      if (q && !Object.values(r).join(" ").toLowerCase().includes(q)) return false
      return true
    })
  }, [data, cols, search, columnFilters])

  const handleColumnFilterChange = useCallback((key: string, values: string[]) => {
    setColumnFilters((prev) => ({ ...prev, [key]: values }))
  }, [])

  const handleSort = useCallback((key: SortKey, dir: SortDir | null) => {
    setSort(dir === null ? null : { key, dir })
  }, [])

  // Tri appliqué APRÈS le filtrage. Sans tri actif → ordre d'origine conservé.
  // Valeurs vides/inconnues (null) toujours reléguées en fin, quel que soit le sens.
  const sortedRows = useMemo(() => {
    if (!sort || !cols) return filtered
    const colName = sort.key === "montant" ? cols.montantMax : cols.dateLimite
    if (!colName) return filtered
    const valueOf = (r: SheetRow) =>
      sort.key === "montant" ? montantSortValue(r[colName]) : dateSortValue(r[colName])
    const factor = sort.dir === "asc" ? 1 : -1
    return [...filtered].sort((a, b) => {
      const va = valueOf(a)
      const vb = valueOf(b)
      if (va === null && vb === null) return 0
      if (va === null) return 1   // vide → toujours en fin
      if (vb === null) return -1
      return (va - vb) * factor
    })
  }, [filtered, sort, cols])

  // Retour à la page 1 dès que le jeu de résultats ou son ordre change.
  useEffect(() => { setPage(1) }, [search, columnFilters, sort])

  // Pagination : `pageSize` par page, appliquée après recherche + filtres + tri.
  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const pagedRows = useMemo(
    () => sortedRows.slice((safePage - 1) * pageSize, safePage * pageSize),
    [sortedRows, safePage, pageSize],
  )

  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size)
    setPage(1)
    try { localStorage.setItem(PAGE_SIZE_KEY, String(size)) } catch { /* quota/prive : sans effet */ }
  }, [])

  // ── Mutation helper (optimistic update + rollback + toast) ──────────────────
  // Factorise le pattern partagé par handleStatutChange et handleDelete :
  //   1. snapshot des rangées avant modif (rollback en cas d'échec)
  //   2. mise à jour optimiste du state local
  //   3. POST vers l'API ; en cas d'erreur → rollback + toast
  //   4. déverrouille la ligne (pending) quoi qu'il arrive
  const mutateRow = useCallback(async (
    rowId: string,
    optimisticRows: (prev: SheetRow[]) => SheetRow[],
    apiCall: () => Promise<Response>,
  ) => {
    if (!data) return
    const previousRows = data.rows
    setData({ ...data, rows: optimisticRows(previousRows) })
    setPending((p) => ({ ...p, [rowId]: true }))
    try {
      const res = await apiCall()
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setData({ ...data, rows: previousRows })
        setMutationError({ msg: body.error ?? `Erreur HTTP ${res.status}`, hint: body.hint })
      }
    } catch (e) {
      setData({ ...data, rows: previousRows })
      setMutationError({ msg: "Erreur réseau", hint: e instanceof Error ? e.message : String(e) })
    } finally {
      setPending((p) => {
        const next = { ...p }
        delete next[rowId]
        return next
      })
    }
  }, [data])

  const handleStatutChange = useCallback((rowId: string, newStatut: string, idCol: string, statutCol: string) => {
    return mutateRow(
      rowId,
      (rows) => rows.map((r) => (r[idCol] === rowId ? { ...r, [statutCol]: newStatut } : r)),
      () => fetch("/api/subventions-sheet/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: rowId, statut: newStatut }),
      }),
    )
  }, [mutateRow])

  const handleAtelierChange = useCallback((rowId: string, newAtelier: string, idCol: string, atelierCol: string) => {
    return mutateRow(
      rowId,
      (rows) => rows.map((r) => (r[idCol] === rowId ? { ...r, [atelierCol]: newAtelier } : r)),
      () => fetch("/api/subventions-sheet/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: rowId, atelier: newAtelier }),
      }),
    )
  }, [mutateRow])

  const handleBilanChange = useCallback((rowId: string, checked: boolean, idCol: string, bilanCol: string) => {
    return mutateRow(
      rowId,
      (rows) => rows.map((r) => (r[idCol] === rowId ? { ...r, [bilanCol]: checked ? "TRUE" : "FALSE" } : r)),
      () => fetch("/api/subventions-sheet/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: rowId, bilan: checked }),
      }),
    )
  }, [mutateRow])

  const handleResponsableChange = useCallback((rowId: string, newResponsable: string, idCol: string, responsableCol: string) => {
    return mutateRow(
      rowId,
      (rows) => rows.map((r) => (r[idCol] === rowId ? { ...r, [responsableCol]: newResponsable } : r)),
      () => fetch("/api/subventions-sheet/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: rowId, responsable: newResponsable }),
      }),
    )
  }, [mutateRow])

  const handleDelete = useCallback((rowId: string, intitule: string, idCol: string) => {
    const ok = window.confirm(
      `Supprimer définitivement cette subvention ?\n\n« ${intitule || rowId} »\n\nCette action retire la ligne du Google Sheet.`,
    )
    if (!ok) return
    return mutateRow(
      rowId,
      (rows) => rows.filter((r) => r[idCol] !== rowId),
      () => fetch("/api/subventions-sheet/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: rowId }),
      }),
    )
  }, [mutateRow])

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="p-8 max-w-7xl mx-auto">
      <PageHeader view={view} setView={setView} loading={loading} onRefresh={fetchData} />

      {error && <ErrorBanner title={error.error} hint={error.hint} />}
      {mutationError && (
        <ErrorBanner
          title={mutationError.msg}
          hint={mutationError.hint}
          onDismiss={() => setMutationError(null)}
        />
      )}

      {loading && !data && (
        <div className="flex items-center justify-center py-20">
          <div className="w-5 h-5 border-2 border-slate-300 border-t-subventions rounded-full animate-spin" />
        </div>
      )}

      {view === "sheet" && (
        <div className="bg-surface rounded-xl border border-border overflow-hidden">
          <iframe
            title="Veille subventions — Google Sheets"
            src={EMBED_URL}
            className="w-full"
            style={{ height: "75vh", border: 0 }}
          />
        </div>
      )}

      {view === "tableau" && data && cols && (
        <>
          <FilterBar
            search={search}
            onSearchChange={setSearch}
            hasActiveFilters={anyFilterActive}
            onReset={() => setColumnFilters({})}
            count={filtered.length}
            total={data.rows.length}
            page={safePage}
            totalPages={totalPages}
            pageSize={pageSize}
            onPageChange={setPage}
          />

          {sortedRows.length === 0 ? (
            <EmptyState />
          ) : (
            <SubventionsTable
              rows={pagedRows}
              cols={cols}
              pending={pending}
              responsables={responsables}
              filterOptions={filterOptions}
              columnFilters={columnFilters}
              onColumnFilterChange={handleColumnFilterChange}
              sort={sort}
              onSort={handleSort}
              onStatutChange={handleStatutChange}
              onResponsableChange={handleResponsableChange}
              onAtelierChange={handleAtelierChange}
              onBilanChange={handleBilanChange}
              onDelete={handleDelete}
            />
          )}

          {sortedRows.length > 0 && (
            <Pagination
              page={safePage}
              totalPages={totalPages}
              total={sortedRows.length}
              pageSize={pageSize}
              onPageChange={setPage}
              pageSizeOptions={PAGE_SIZE_OPTIONS}
              onPageSizeChange={handlePageSizeChange}
            />
          )}

          <p className="mt-3 text-xs text-muted text-right">
            Dernier fetch : {new Date(data.fetchedAt).toLocaleString("fr-FR")}
          </p>
        </>
      )}
    </div>
  )
}

// ─── Sous-composants de mise en page ─────────────────────────────────────────

interface PageHeaderProps {
  view: View
  setView: (v: View) => void
  loading: boolean
  onRefresh: () => void
}

function PageHeader({ view, setView, loading, onRefresh }: PageHeaderProps) {
  const tabClass = (active: boolean) =>
    `flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
      active ? "bg-subventions-light text-subventions-dark" : "text-muted hover:text-foreground"
    }`

  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <div className="flex items-center gap-2.5">
          <span className="p-2 rounded-lg bg-subventions-light">
            <Search size={18} className="text-subventions-dark" />
          </span>
          <h1 className="text-2xl font-bold text-foreground">Veille subventions</h1>
        </div>
        <p className="text-sm text-muted mt-1">
          Subventions détectées automatiquement par l'agent de veille (mis à jour quotidiennement).
        </p>
      </div>

      <div className="flex items-center gap-2">
        <div role="tablist" aria-label="Mode d'affichage" className="inline-flex rounded-lg border border-border bg-surface p-0.5">
          <button role="tab" aria-selected={view === "tableau"} onClick={() => setView("tableau")} className={tabClass(view === "tableau")}>
            <List size={14} /> Tableau
          </button>
          <button role="tab" aria-selected={view === "sheet"} onClick={() => setView("sheet")} className={tabClass(view === "sheet")}>
            <Calendar size={14} /> Vue Sheets
          </button>
        </div>

        <button
          onClick={onRefresh}
          disabled={loading}
          title="Recharger les données"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border bg-surface text-muted hover:text-foreground disabled:opacity-50"
        >
          <RotateCcw size={14} className={loading ? "animate-spin" : ""} />
          Actualiser
        </button>

        <a
          href={OPEN_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-subventions text-white hover:bg-subventions-dark transition-colors"
        >
          <ExternalLink size={14} /> Ouvrir dans Google Sheets
        </a>
      </div>
    </header>
  )
}

interface ErrorBannerProps {
  title: string
  hint?: string
  onDismiss?: () => void
}

function ErrorBanner({ title, hint, onDismiss }: ErrorBannerProps) {
  return (
    <div role="alert" className="mb-6 bg-red-50 border border-alert/20 rounded-lg px-4 py-3">
      <div className="flex items-start gap-2">
        <AlertTriangle size={16} className="text-alert shrink-0 mt-0.5" />
        <div className="text-sm flex-1">
          <p className="font-semibold text-alert">{title}</p>
          {hint && <p className="text-muted mt-1">{hint}</p>}
        </div>
        {onDismiss && (
          <button onClick={onDismiss} aria-label="Fermer" className="text-muted hover:text-foreground">
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  )
}

interface FilterBarProps {
  search: string
  onSearchChange: (v: string) => void
  hasActiveFilters: boolean
  onReset: () => void
  count: number
  total: number
  page: number
  totalPages: number
  pageSize: number
  onPageChange: (page: number) => void
}

function FilterBar({ search, onSearchChange, hasActiveFilters, onReset, count, total, page, totalPages, pageSize, onPageChange }: FilterBarProps) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <div className="relative flex-1 min-w-[200px] max-w-md">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="search"
          placeholder="Rechercher…"
          aria-label="Rechercher une subvention"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-border bg-surface focus:outline-none focus:border-subventions"
        />
      </div>
      {hasActiveFilters && (
        <button
          onClick={onReset}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-border bg-surface text-muted hover:text-foreground"
        >
          <X size={14} /> Réinitialiser les filtres
        </button>
      )}
      {/* À droite : pager compact si plusieurs pages, sinon le compteur filtré */}
      {totalPages > 1 ? (
        <div className="ml-auto">
          <Pagination compact page={page} totalPages={totalPages} total={count} pageSize={pageSize} onPageChange={onPageChange} />
        </div>
      ) : (
        <span className="text-xs text-muted ml-auto">
          {count} / {total} subvention{total > 1 ? "s" : ""}
        </span>
      )}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="bg-surface rounded-xl border border-border p-10 text-center">
      <p className="text-sm text-muted">Aucune subvention ne correspond aux filtres.</p>
    </div>
  )
}

interface PaginationProps {
  page: number
  totalPages: number
  total: number
  pageSize: number
  onPageChange: (page: number) => void
  /** Version condensée pour la barre du haut (icônes seules, texte réduit). */
  compact?: boolean
  /** Si fourni, affiche le sélecteur « résultats par page » (barre du bas). */
  pageSizeOptions?: number[]
  onPageSizeChange?: (size: number) => void
}

function Pagination({ page, totalPages, total, pageSize, onPageChange, compact, pageSizeOptions, onPageSizeChange }: PaginationProps) {
  const start = (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)

  if (compact) {
    const iconBtn =
      "inline-flex items-center justify-center h-6 w-6 rounded border border-border bg-surface text-muted hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-muted"
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted">
        <span className="tabular-nums whitespace-nowrap">{start}–{end} sur {total}</span>
        <button className={iconBtn} aria-label="Page précédente" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
          <ChevronLeft size={14} />
        </button>
        <span className="tabular-nums whitespace-nowrap">{page} / {totalPages}</span>
        <button className={iconBtn} aria-label="Page suivante" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}>
          <ChevronRight size={14} />
        </button>
      </div>
    )
  }

  const btn =
    "inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-border bg-surface text-muted hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-muted"
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        {pageSizeOptions && onPageSizeChange && (
          <label className="flex items-center gap-1.5 text-xs text-muted">
            Afficher
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              aria-label="Résultats par page"
              className="rounded-lg border border-border bg-surface px-2 py-1 text-xs focus:outline-none focus:border-subventions"
            >
              {pageSizeOptions.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            par page
          </label>
        )}
        <span className="text-xs text-muted tabular-nums">{start}–{end} sur {total}</span>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center gap-2">
          <button className={btn} onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
            <ChevronLeft size={14} /> Précédent
          </button>
          <span className="text-xs text-muted tabular-nums px-1">Page {page} / {totalPages}</span>
          <button className={btn} onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}>
            Suivant <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  )
}

interface SubventionsTableProps {
  rows: SheetRow[]
  cols: ResolvedColumns
  pending: Record<string, true>
  responsables: string[]
  filterOptions: Record<string, FilterOption[]>
  columnFilters: Record<string, string[]>
  onColumnFilterChange: (key: string, values: string[]) => void
  sort: SortState
  onSort: (key: SortKey, dir: SortDir | null) => void
  onStatutChange: (rowId: string, newStatut: string, idCol: string, statutCol: string) => void
  onResponsableChange: (rowId: string, newResponsable: string, idCol: string, responsableCol: string) => void
  onAtelierChange: (rowId: string, newAtelier: string, idCol: string, atelierCol: string) => void
  onBilanChange: (rowId: string, checked: boolean, idCol: string, bilanCol: string) => void
  onDelete: (rowId: string, intitule: string, idCol: string) => void
}

function SubventionsTable({ rows, cols, pending, responsables, filterOptions, columnFilters, onColumnFilterChange, sort, onSort, onStatutChange, onResponsableChange, onAtelierChange, onBilanChange, onDelete }: SubventionsTableProps) {
  // Rend le menu de filtre d'un en-tête si la colonne est résolue et a des valeurs.
  const filterFor = (key: FilterKey, title: string) =>
    cols[key] ? (
      <ColumnFilterMenu
        title={title}
        options={filterOptions[key] ?? []}
        selected={columnFilters[key] ?? []}
        onChange={(v) => onColumnFilterChange(key, v)}
      />
    ) : null

  // Rend le contrôle de tri (▲ • ▼) d'une colonne triable.
  const sortFor = (key: SortKey) => (
    <SortControl active={sort?.key === key ? sort.dir : null} onChange={(dir) => onSort(key, dir)} />
  )

  return (
    <div className="bg-surface rounded-xl border border-border overflow-hidden">
      {/* table-fixed + largeurs en % → colonnes réparties proportionnellement,
          étirées sur grand écran et resserrées sur petit, sans scroll horizontal.
          Chaque subvention occupe 2 lignes : intitulé pleine largeur, puis les colonnes. */}
      <table className="w-full text-sm table-fixed">
        <thead className="bg-slate-50 border-b border-border">
          <tr className="text-center">
            <Th w="w-[19%]">Organisme{filterFor("organisme", "Organisme")}</Th>
            <Th w="w-[8%]">Type{filterFor("type", "Type")}</Th>
            <Th w="w-[8%]">Atelier{filterFor("atelier", "Atelier")}</Th>
            <Th w="w-[12%]">Montant{sortFor("montant")}</Th>
            <Th w="w-[13%]">Date limite{sortFor("date")}</Th>
            <Th w="w-[16%]">Statut{filterFor("statut", "Statut")}</Th>
            <Th w="w-[14%]">Responsable{filterFor("responsable", "Responsable")}</Th>
            <Th w="w-[5%]">
              {cols.bilan ? (
                <ColumnFilterMenu
                  title="Bilan"
                  icon={ClipboardCheck}
                  iconSize={15}
                  options={filterOptions.bilan ?? []}
                  selected={columnFilters.bilan ?? []}
                  onChange={(v) => onColumnFilterChange("bilan", v)}
                />
              ) : (
                <ClipboardCheck size={15} className="text-muted" />
              )}
            </Th>
            <th className="w-[5%] px-1 py-3" aria-label="Actions"></th>
          </tr>
        </thead>
        {rows.map((r, i) => {
          const rowId       = (cols.id && r[cols.id]) || ""
          const intitule    = (cols.intitule && r[cols.intitule]) || ""
          const url         = (cols.url && r[cols.url]) || ""
          const statutValue = (cols.statut && r[cols.statut]) || ""
          const responsableValue = (cols.responsable && r[cols.responsable]) || ""
          const atelierValue = (cols.atelier && r[cols.atelier]) || ""
          const bilanChecked = isBilanChecked(cols.bilan ? r[cols.bilan] : "")
          const isPending   = !!(rowId && pending[rowId])
          const canEdit     = !!(cols.statut && cols.id && rowId)
          const canEditResp = !!(cols.responsable && cols.id && rowId)
          const canEditAtelier = !!(cols.atelier && cols.id && rowId)
          const canEditBilan = !!(cols.bilan && cols.id && rowId)
          const canDelete   = !!(cols.id && rowId)

          // Un <tbody> par subvention regroupe ses 2 lignes (intitulé + colonnes)
          // et permet le survol commun via group-hover.
          return (
            <tbody key={rowId || i} className={`group border-b border-border last:border-0 ${isPending ? "opacity-60" : ""}`}>
              {/* Ligne 1 — bandeau clair mettant en avant l'intitulé + secteurs, sur toute la largeur */}
              <tr>
                <td colSpan={9} className="px-3 py-2 align-top bg-subventions-light border-b border-subventions/10">
                  <IntituleCell intitule={intitule} url={url} secteurs={cols.secteurs ? r[cols.secteurs] : undefined} />
                </td>
              </tr>
              {/* Ligne 2 — toutes les colonnes, alignées sous les en-têtes */}
              <tr className="group-hover:bg-slate-50/50 transition-colors align-top">
                <td className="px-3 pt-3 pb-3">
                  <OrganismeCell raw={cols.organisme ? r[cols.organisme] : ""} />
                </td>
                <td className="px-2 pt-3 pb-3 text-center">
                  <TypeCell type={cols.type ? r[cols.type] : ""} />
                </td>
                <td className="px-2 pt-3 pb-3 text-center">
                  <AtelierCell
                    atelier={atelierValue}
                    intitule={intitule}
                    pending={isPending}
                    editable={canEditAtelier}
                    onChange={(v) => onAtelierChange(rowId, v, cols.id!, cols.atelier!)}
                  />
                </td>
                <td className="px-2 pt-3 pb-3 font-medium text-foreground text-center">
                  {formatMontant(cols.montantMax ? r[cols.montantMax] : undefined)}
                </td>
                <td className="px-2 pt-3 pb-3 text-center">
                  <DeadlineCell raw={cols.dateLimite ? r[cols.dateLimite] : undefined} statut={statutValue} />
                </td>
                <td className="px-2 pt-3 pb-3 text-center">
                  <StatutCell
                    statut={statutValue}
                    intitule={intitule}
                    pending={isPending}
                    editable={canEdit}
                    onChange={(v) => onStatutChange(rowId, v, cols.id!, cols.statut!)}
                  />
                </td>
                <td className="px-2 pt-3 pb-3 text-center">
                  <ResponsableCell
                    responsable={responsableValue}
                    options={responsables}
                    intitule={intitule}
                    pending={isPending}
                    editable={canEditResp}
                    onChange={(v) => onResponsableChange(rowId, v, cols.id!, cols.responsable!)}
                  />
                </td>
                <td className="px-1 pt-3 pb-3 text-center">
                  <BilanCell
                    checked={bilanChecked}
                    intitule={intitule}
                    pending={isPending}
                    editable={canEditBilan}
                    onChange={(c) => onBilanChange(rowId, c, cols.id!, cols.bilan!)}
                  />
                </td>
                <td className="px-1 pt-3 pb-3 text-center">
                  {canDelete && (
                    <DeleteRowButton
                      intitule={intitule || rowId}
                      pending={isPending}
                      onConfirm={() => onDelete(rowId, intitule, cols.id!)}
                    />
                  )}
                </td>
              </tr>
            </tbody>
          )
        })}
      </table>
    </div>
  )
}

interface ThProps {
  children: React.ReactNode
  w?: string
}

function Th({ children, w }: ThProps) {
  return (
    <th className={`${w ?? ""} px-2 py-3 font-semibold text-xs uppercase tracking-wider text-muted`}>
      <span className="inline-flex items-center justify-center gap-1">{children}</span>
    </th>
  )
}

// Contrôle de tri vertical : ▲ (croissant) / • (ordre initial) / ▼ (décroissant).
// Chaque bouton a une zone cliquable confortable (h-4 w-4) + surbrillance au survol.
// L'élément actif est mis en évidence (violet pour les flèches, gris pour le point).
function SortControl({ active, onChange }: { active: SortDir | null; onChange: (dir: SortDir | null) => void }) {
  const btn = (on: boolean, activeColor: string) =>
    `flex h-4 w-4 items-center justify-center rounded transition-colors ${
      on ? activeColor : "text-slate-300 hover:text-slate-500 hover:bg-slate-100"
    }`
  return (
    <span className="inline-flex flex-col items-center gap-px">
      <button type="button" aria-label="Tri croissant" title="Tri croissant" onClick={() => onChange("asc")} className={btn(active === "asc", "text-subventions")}>
        <ChevronUp size={12} />
      </button>
      <button type="button" aria-label="Ordre initial" title="Ordre initial" onClick={() => onChange(null)} className={btn(active === null, "text-slate-500")}>
        <span className="block w-1 h-1 rounded-full bg-current" />
      </button>
      <button type="button" aria-label="Tri décroissant" title="Tri décroissant" onClick={() => onChange("desc")} className={btn(active === "desc", "text-subventions")}>
        <ChevronDown size={12} />
      </button>
    </span>
  )
}
