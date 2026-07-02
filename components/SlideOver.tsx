"use client"

import React, { useEffect, useRef } from "react"
import { X } from "lucide-react"

interface SlideOverProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: React.ReactNode
  width?: "sm" | "md" | "lg" | "xl"
}

export default function SlideOver({ open, onClose, title, subtitle, children, width = "md" }: SlideOverProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) document.body.style.overflow = "hidden"
    else document.body.style.overflow = ""
    return () => { document.body.style.overflow = "" }
  }, [open])

  useEffect(() => {
    if (!open) return
    const firstFocusable = panelRef.current?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    firstFocusable?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
  }, [open, onClose])

  const widthClass = { sm: "max-w-sm", md: "max-w-md", lg: "max-w-lg", xl: "max-w-4xl" }[width]

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        className={`fixed inset-0 bg-black/30 z-40 transition-opacity duration-200 ${open ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={onClose}
      />
      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="slideover-title"
        className={`fixed inset-y-0 right-0 ${widthClass} w-full bg-surface shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-in-out ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        <div className="flex items-start justify-between px-6 py-5 border-b border-border">
          <div>
            <h2 id="slideover-title" className="font-semibold text-foreground text-base">{title}</h2>
            {subtitle && <p className="text-sm text-muted mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} aria-label="Fermer" className="p-1.5 rounded-lg hover:bg-slate-100 text-muted transition-colors mt-0.5">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Composants de formulaire réutilisables
// ─────────────────────────────────────────────────────────────────────────────
export function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  const fieldId = label.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")

  const childWithId = React.Children.map(children, child => {
    if (React.isValidElement(child)) {
      return React.cloneElement(child as React.ReactElement<{ id?: string }>, { id: fieldId })
    }
    return child
  })

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={fieldId} className="text-xs font-semibold text-muted uppercase tracking-wider">
        {label}{required && <span className="text-alert ml-0.5">*</span>}
      </label>
      {childWithId}
    </div>
  )
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full px-3 py-2.5 rounded-xl border border-border bg-surface text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ateliers placeholder:text-slate-300 ${props.className ?? ""}`}
    />
  )
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      rows={3}
      {...props}
      className={`w-full px-3 py-2.5 rounded-xl border border-border bg-surface text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ateliers placeholder:text-slate-300 resize-none ${props.className ?? ""}`}
    />
  )
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full px-3 py-2.5 rounded-xl border border-border bg-surface text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ateliers ${props.className ?? ""}`}
    />
  )
}

export function FormRow({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>
}

// Accents par module — classes statiques (Tailwind ne génère pas les classes dynamiques).
// Modules dorés (communication/absences/subventions) : variante -dark pour le contraste du texte blanc.
const SAVE_ACCENTS = {
  brand:          "bg-brand hover:bg-brand-dark",
  ateliers:       "bg-ateliers hover:bg-ateliers-dark",
  benevoles:      "bg-benevoles hover:bg-benevoles-dark",
  positionnement: "bg-positionnement hover:bg-positionnement-dark",
  finances:       "bg-finances hover:bg-finances-dark",
  familles:       "bg-familles hover:bg-familles-dark",
  communication:  "bg-communication-dark hover:opacity-90",
  absences:       "bg-absences-dark hover:opacity-90",
  subventions:    "bg-subventions-dark hover:opacity-90",
} as const

export function SaveButton({ onClick, label = "Enregistrer", disabled, accent = "brand" }: { onClick?: () => void; label?: string; disabled?: boolean; accent?: keyof typeof SAVE_ACCENTS }) {
  return (
    <button
      type="submit"
      onClick={onClick}
      disabled={disabled}
      className={`w-full ${SAVE_ACCENTS[accent]} text-white py-2.5 rounded-xl text-sm font-semibold transition-colors mt-2 disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      {label}
    </button>
  )
}

export function DeleteButton({ onClick, label = "Supprimer" }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full border border-alert/30 text-alert py-2 rounded-xl text-sm font-medium hover:bg-red-50 transition-colors"
    >
      {label}
    </button>
  )
}
