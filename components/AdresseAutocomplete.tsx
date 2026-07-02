"use client"

import { useEffect, useRef, useState } from "react"
import { Input } from "@/components/SlideOver"

export type AdresseChoisie = { adresse: string; codePostal: string; ville: string }

type Suggestion = { label: string; adresse: string; codePostal: string; ville: string }

export default function AdresseAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  onSelect: (a: AdresseChoisie) => void
  placeholder?: string
}) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const ignoreNextFetch = useRef(false)
  const boxRef = useRef<HTMLDivElement>(null)

  // Recherche BAN (Base Adresse Nationale) avec debounce
  useEffect(() => {
    if (ignoreNextFetch.current) { ignoreNextFetch.current = false; return }
    const q = value.trim()
    if (q.length < 3) { setSuggestions([]); setOpen(false); return }
    const ctrl = new AbortController()
    const t = setTimeout(async () => {
      try {
        setLoading(true)
        const res = await fetch(
          `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(q)}&limit=5`,
          { signal: ctrl.signal }
        )
        const data = await res.json()
        const sugg: Suggestion[] = (data.features ?? []).map((f: { properties: Record<string, string> }) => ({
          label: f.properties.label,
          adresse: f.properties.name ?? "",
          codePostal: f.properties.postcode ?? "",
          ville: f.properties.city ?? "",
        }))
        setSuggestions(sugg)
        setOpen(sugg.length > 0)
      } catch {
        /* requête annulée ou réseau indisponible — on ignore */
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => { clearTimeout(t); ctrl.abort() }
  }, [value])

  // Ferme la liste si clic en dehors
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onClickOutside)
    return () => document.removeEventListener("mousedown", onClickOutside)
  }, [])

  function choisir(s: Suggestion) {
    ignoreNextFetch.current = true   // évite de relancer une recherche après remplissage
    onSelect({ adresse: s.adresse, codePostal: s.codePostal, ville: s.ville })
    setSuggestions([])
    setOpen(false)
  }

  return (
    <div ref={boxRef} className="relative">
      <Input
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => { if (suggestions.length) setOpen(true) }}
        placeholder={placeholder ?? "Commencez à taper l'adresse…"}
        aria-label="Rechercher une adresse"
        autoComplete="off"
      />
      {open && (
        <ul className="absolute z-50 mt-1 w-full bg-surface border border-border rounded-xl shadow-lg overflow-hidden max-h-60 overflow-y-auto">
          {loading && suggestions.length === 0 && (
            <li className="px-3 py-2 text-sm text-muted">Recherche…</li>
          )}
          {suggestions.map((s, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => choisir(s)}
                className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-familles-light hover:text-familles-dark transition-colors"
              >
                {s.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
