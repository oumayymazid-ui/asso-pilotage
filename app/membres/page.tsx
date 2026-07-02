"use client"

import { useState, useEffect, useCallback } from "react"
import SlideOver, { Field, Input, Select, Textarea, FormRow, SaveButton, DeleteButton } from "@/components/SlideOver"
import Pagination, { usePagination } from "@/components/Pagination"
import { Plus, Pencil, UserCheck, UserX, Users, ShieldCheck } from "lucide-react"
import { type StatutMembre, type AuthUser } from "@/lib/auth"
import { MODULES, MODULE_PRESETS, ALL_MODULE_KEYS, type ModuleKey } from "@/lib/modules"
import { fetchAllUsers, adminCreateUser, adminUpdateUser, adminDeleteUser } from "@/lib/auth-client"

// ──────────────────────────────────────────────
// Source de vérité : Supabase (auth.users + profiles), via /api/admin/users.
// Chaque membre = un compte de connexion + une liste d'accès (modules) + un
// éventuel statut d'administratrice (gestion des comptes).
//
// Le module Ateliers lit la liste des membres depuis un MIROIR localStorage
// (lecture seule, id numérique dérivé) — réécrit après chaque mutation.
// ──────────────────────────────────────────────
const MIRROR_KEY = "asso-membres"

const statutStyle: Record<StatutMembre, string> = {
  "active":     "bg-finances-light text-finances-dark",
  "inactive":   "bg-slate-100 text-muted",
  "en attente": "bg-absences-light text-absences-dark",
}

// Hash déterministe uuid → entier (pour le miroir lu par Ateliers, typé number).
function hashId(uuid: string): number {
  let h = 0
  for (let i = 0; i < uuid.length; i++) h = (Math.imul(31, h) + uuid.charCodeAt(i)) | 0
  return Math.abs(h)
}

interface FormState {
  prenom: string
  nom: string
  email: string
  telephone: string
  statut: StatutMembre
  dateInscription: string
  notes: string
  password: string
  isAdmin: boolean
  modules: ModuleKey[]
}

const emptyForm = (): FormState => ({
  prenom: "", nom: "", email: "", telephone: "",
  statut: "en attente",
  dateInscription: new Date().toISOString().split("T")[0],
  notes: "", password: "",
  isAdmin: false, modules: [],
})

// ──────────────────────────────────────────────
// Page
// ──────────────────────────────────────────────
export default function MembresPage() {
  const [membres, setMembres] = useState<AuthUser[]>([])
  const [loading, setLoading] = useState(true)
  const [slideOpen, setSlideOpen] = useState(false)
  const [editing,   setEditing]   = useState<AuthUser | null>(null)
  const [form,      setForm]      = useState<FormState>(emptyForm())
  const [confirmPwd, setConfirmPwd] = useState("")
  const [error,     setError]     = useState("")
  const [saving,    setSaving]    = useState(false)

  const { page, setPage, pageSize, changePageSize, total, totalPages, pageItems: pagedMembres } = usePagination(membres, "asso-membres-page-size")

  const load = useCallback(async () => {
    setLoading(true)
    const list = await fetchAllUsers()
    setMembres(list)
    // Miroir localStorage pour Ateliers (lecture seule).
    try {
      localStorage.setItem(MIRROR_KEY, JSON.stringify(list.map((u) => ({
        id: hashId(u.id),
        prenom: u.prenom, nom: u.nom, email: u.email,
        telephone: u.telephone ?? "", role: u.role,
        statut: u.statut ?? "en attente",
        dateInscription: u.dateInscription ?? "", notes: u.notes ?? "",
      }))))
    } catch { /* miroir best-effort */ }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function openNew() {
    setEditing(null); setForm(emptyForm()); setConfirmPwd(""); setError(""); setSlideOpen(true)
  }
  function openEdit(m: AuthUser) {
    setEditing(m)
    setForm({
      prenom: m.prenom, nom: m.nom, email: m.email, telephone: m.telephone ?? "",
      statut: m.statut ?? "en attente",
      dateInscription: m.dateInscription || new Date().toISOString().split("T")[0],
      notes: m.notes ?? "", password: "",
      isAdmin: m.isAdmin === true, modules: m.modules ?? [],
    })
    setConfirmPwd(""); setError(""); setSlideOpen(true)
  }

  // ── Sélection des modules ──
  function toggleModule(key: ModuleKey) {
    setForm((f) => ({
      ...f,
      modules: f.modules.includes(key) ? f.modules.filter((k) => k !== key) : [...f.modules, key],
    }))
  }
  function applyPreset(keys: ModuleKey[]) {
    setForm((f) => ({ ...f, modules: [...keys] }))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    if (!editing) {
      // Création d'un compte Supabase (email + mot de passe)
      if (!form.password) { setError("Mot de passe requis."); return }
      if (form.password !== confirmPwd) { setError("Les mots de passe ne correspondent pas."); return }
      if (form.password.length < 6) { setError("Minimum 6 caractères."); return }
      setSaving(true)
      const res = await adminCreateUser({
        email: form.email, password: form.password, nom: form.nom, prenom: form.prenom,
        telephone: form.telephone, statut: form.statut,
        dateInscription: form.dateInscription, notes: form.notes,
        isAdmin: form.isAdmin, modules: form.modules,
      })
      setSaving(false)
      if (!res.ok) { setError(res.error ?? "Erreur."); return }
    } else {
      // Modification d'un compte existant
      const update: Parameters<typeof adminUpdateUser>[1] = {
        prenom: form.prenom, nom: form.nom, email: form.email,
        telephone: form.telephone, statut: form.statut,
        dateInscription: form.dateInscription, notes: form.notes,
        isAdmin: form.isAdmin, modules: form.modules,
      }
      if (form.password) {
        if (form.password !== confirmPwd) { setError("Les mots de passe ne correspondent pas."); return }
        if (form.password.length < 6) { setError("Minimum 6 caractères."); return }
        update.password = form.password
      }
      setSaving(true)
      const res = await adminUpdateUser(editing.id, update)
      setSaving(false)
      if (!res.ok) { setError(res.error ?? "Erreur."); return }
    }

    await load()
    setSlideOpen(false)
  }

  async function handleDelete() {
    if (!editing) return
    setError("")
    const res = await adminDeleteUser(editing.id)
    if (!res.ok) { setError(res.error ?? "Erreur."); return }
    await load()
    setSlideOpen(false)
  }

  // Stats
  const actifs    = membres.filter((m) => m.statut === "active").length
  const admins    = membres.filter((m) => m.isAdmin === true).length
  const enAttente = membres.filter((m) => m.statut === "en attente").length

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <header className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Équipe</h1>
          <p className="text-sm text-muted mt-1">Comptes de l'équipe et accès aux modules</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-1.5 text-sm font-medium bg-brand text-white px-4 py-2 rounded-xl hover:bg-brand-dark transition-colors">
          <Plus size={14} /> Ajouter un membre
        </button>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-finances-light rounded-xl border border-finances/20 p-4">
          <p className="text-3xl font-bold text-finances-dark">{actifs}</p>
          <p className="text-sm text-finances-dark/70 mt-1">Membres actifs</p>
        </div>
        <div className="bg-communication-light rounded-xl border border-communication/20 p-4">
          <p className="text-3xl font-bold text-communication-dark">{admins}</p>
          <p className="text-sm text-communication-dark/70 mt-1">Administratrices</p>
        </div>
        <div className={`rounded-xl border p-4 ${enAttente > 0 ? "bg-absences-light border-absences/20" : "bg-surface border-border"}`}>
          <p className={`text-3xl font-bold ${enAttente > 0 ? "text-absences-dark" : "text-foreground"}`}>{enAttente}</p>
          <p className={`text-sm mt-1 ${enAttente > 0 ? "text-absences-dark/70" : "text-muted"}`}>En attente de validation</p>
        </div>
      </div>

      {/* Liste */}
      <section className="bg-surface rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-foreground text-sm flex items-center gap-2"><Users size={14} /> {membres.length} membre{membres.length > 1 ? "s" : ""}</h2>
        </div>

        {loading ? (
          <p className="text-center text-sm text-muted py-8 italic">Chargement…</p>
        ) : membres.length === 0 ? (
          <p className="text-center text-sm text-muted py-8 italic">Aucun membre trouvé</p>
        ) : (
          <ul className="divide-y divide-border">
            {pagedMembres.map((m) => {
              const nbAcces = m.isAdmin ? ALL_MODULE_KEYS.length : (m.modules?.length ?? 0)
              return (
                <li key={m.id} className="px-5 py-4 flex items-center gap-4 hover:bg-slate-50 group">
                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center shrink-0 text-xs font-bold text-slate-500">
                    {m.prenom[0]}{m.nom[0]}
                  </div>

                  {/* Infos */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground text-sm">{m.prenom} {m.nom}</p>
                    <p className="text-xs text-muted mt-0.5 truncate">{m.email}{m.telephone ? ` · ${m.telephone}` : ""}</p>
                    {m.notes && <p className="text-xs text-slate-400 italic mt-0.5 truncate">{m.notes}</p>}
                  </div>

                  {/* Tags */}
                  <div className="flex items-center gap-2 shrink-0">
                    {m.isAdmin && (
                      <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-communication-light text-communication-dark flex items-center gap-1">
                        <ShieldCheck size={12} /> Admin
                      </span>
                    )}
                    <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
                      {m.isAdmin ? "Tous les accès" : `${nbAcces} accès`}
                    </span>
                    {m.statut && <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statutStyle[m.statut]}`}>{m.statut}</span>}
                    {m.statut === "active" ? <UserCheck size={13} className="text-finances-dark" /> : <UserX size={13} className="text-muted" />}
                    <button onClick={() => openEdit(m)} className="p-1.5 rounded-lg hover:bg-slate-100 text-muted opacity-0 group-hover:opacity-100 transition-opacity">
                      <Pencil size={13} />
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
        {!loading && membres.length > 0 && (
          <div className="px-5 pb-4">
            <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={changePageSize} />
          </div>
        )}
      </section>

      {/* SlideOver */}
      <SlideOver
        open={slideOpen}
        onClose={() => setSlideOpen(false)}
        title={editing ? `Modifier — ${editing.prenom} ${editing.nom}` : "Nouveau membre"}
        subtitle="Compte, informations & accès"
      >
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          {error && <p className="text-sm text-alert bg-red-50 border border-alert/20 px-3 py-2 rounded-lg">{error}</p>}
          <FormRow>
            <Field label="Prénom" required>
              <Input placeholder="Nadjat" value={form.prenom} onChange={e => setForm(f => ({ ...f, prenom: e.target.value }))} />
            </Field>
            <Field label="Nom" required>
              <Input placeholder="B." value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} />
            </Field>
          </FormRow>
          <Field label="Email" required>
            <Input type="email" placeholder="nadjat@asso.fr" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </Field>
          <Field label="Téléphone">
            <Input placeholder="06 12 34 56 78" value={form.telephone} onChange={e => setForm(f => ({ ...f, telephone: e.target.value }))} />
          </Field>
          <FormRow>
            <Field label="Statut">
              <Select value={form.statut} onChange={e => setForm(f => ({ ...f, statut: e.target.value as StatutMembre }))}>
                <option value="active">active</option>
                <option value="inactive">inactive</option>
                <option value="en attente">en attente</option>
              </Select>
            </Field>
            <Field label="Date d'inscription">
              <Input type="date" value={form.dateInscription} onChange={e => setForm(f => ({ ...f, dateInscription: e.target.value }))} />
            </Field>
          </FormRow>

          {/* Compte — mot de passe */}
          <Field label={editing ? "Nouveau mot de passe (laisser vide pour ne pas changer)" : "Mot de passe"} required={!editing}>
            <Input type="password" placeholder="6 caractères min." value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
          </Field>
          {(form.password || !editing) && (
            <Field label="Confirmer le mot de passe" required={!editing}>
              <Input type="password" placeholder="Identique" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} />
            </Field>
          )}

          {/* Accès aux modules */}
          <div className="border border-border rounded-xl p-4 bg-surface">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-foreground">Accès aux modules</p>
              <span className="text-xs text-muted">{form.isAdmin ? "Tous (admin)" : `${form.modules.length}/${ALL_MODULE_KEYS.length}`}</span>
            </div>

            {/* Modèles rapides */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {MODULE_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => applyPreset(p.keys)}
                  className="text-xs px-2.5 py-1 rounded-full border border-border bg-slate-50 text-muted hover:border-slate-400 hover:text-foreground transition-colors"
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Cases par module */}
            <div className={`grid grid-cols-2 gap-1.5 ${form.isAdmin ? "opacity-50 pointer-events-none" : ""}`}>
              {MODULES.map((mod) => {
                const checked = form.isAdmin || form.modules.includes(mod.key)
                return (
                  <label key={mod.key} className="flex items-center gap-2 px-2.5 py-2 rounded-lg border border-border hover:bg-slate-50 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={form.isAdmin}
                      onChange={() => toggleModule(mod.key)}
                      className="w-4 h-4 rounded border-border accent-slate-900"
                    />
                    <span className="text-foreground">{mod.label}</span>
                  </label>
                )
              })}
            </div>
            {form.isAdmin && (
              <p className="text-xs text-muted mt-2 italic">Une administratrice a accès à tous les modules.</p>
            )}
          </div>

          {/* Administratrice */}
          <label className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl border border-border bg-surface cursor-pointer">
            <input
              type="checkbox"
              checked={form.isAdmin}
              onChange={e => setForm(f => ({ ...f, isAdmin: e.target.checked }))}
              className="w-4 h-4 mt-0.5 rounded border-border accent-communication-dark"
            />
            <span>
              <span className="text-sm font-medium text-foreground flex items-center gap-1.5"><ShieldCheck size={13} className="text-communication-dark" /> Administratrice</span>
              <span className="block text-xs text-muted mt-0.5">Peut gérer les comptes de l'équipe et distribuer les accès. Accède à tous les modules.</span>
            </span>
          </label>

          <Field label="Notes">
            <Textarea placeholder="Compétences, disponibilités, commentaire…" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </Field>
          <SaveButton label={saving ? "Enregistrement…" : "Enregistrer"} />
          {editing && <DeleteButton onClick={handleDelete} label="Supprimer ce compte" />}
        </form>
      </SlideOver>
    </div>
  )
}
