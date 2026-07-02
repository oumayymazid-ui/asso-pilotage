"use client"

import { useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { type AuthUser } from "@/lib/auth"
import { updateOwnProfile, updateOwnPassword } from "@/lib/auth-client"
import { Field, Input } from "@/components/SlideOver"
import { UserCircle } from "lucide-react"

// ──────────────────────────────────────────────
// Formulaire profil (section Mon profil)
//
// La gestion des comptes collaborateur·ices (création / édition / suppression)
// vit désormais uniquement dans le module Équipe (/membres). Cette page ne
// concerne que le profil de l'utilisateur·ice connecté·e.
// ──────────────────────────────────────────────
function ProfilSection({ user, onUpdated }: {
  user: AuthUser
  onUpdated: () => void
}) {
  const [form, setForm] = useState({ prenom: user.prenom, nom: user.nom, email: user.email })
  const [pwdForm, setPwdForm] = useState({ newPwd: "", confirmPwd: "" })
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  async function handleSaveProfil(e: React.FormEvent) {
    e.preventDefault()
    setError(""); setSuccess("")
    const res = await updateOwnProfile({ prenom: form.prenom, nom: form.nom, email: form.email })
    if (!res.ok) { setError(res.error ?? "Erreur."); return }
    setSuccess("Profil mis à jour.")
    onUpdated()
  }

  async function handleChangePwd(e: React.FormEvent) {
    e.preventDefault()
    setError(""); setSuccess("")
    if (!pwdForm.newPwd) { setError("Nouveau mot de passe requis."); return }
    if (pwdForm.newPwd !== pwdForm.confirmPwd) { setError("Les mots de passe ne correspondent pas."); return }
    if (pwdForm.newPwd.length < 6) { setError("Minimum 6 caractères."); return }
    const res = await updateOwnPassword(pwdForm.newPwd)
    if (!res.ok) { setError(res.error ?? "Erreur."); return }
    setPwdForm({ newPwd: "", confirmPwd: "" })
    setSuccess("Mot de passe modifié.")
  }

  return (
    <div className="space-y-6">
      {/* Avatar + identité */}
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 border border-border flex items-center justify-center">
          <UserCircle size={32} className="text-slate-400" />
        </div>
        <div>
          <p className="font-semibold text-foreground text-lg">{user.prenom} {user.nom}</p>
          <p className="text-sm text-muted">{user.email}</p>
          <span className="mt-1 inline-block text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
            {user.isAdmin ? "Administratrice" : "Membre de l'équipe"}
          </span>
        </div>
      </div>

      {error && <p className="text-sm text-alert bg-red-50 border border-alert/20 px-4 py-2.5 rounded-xl">{error}</p>}
      {success && <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 px-4 py-2.5 rounded-xl">{success}</p>}

      {/* Modifier profil */}
      <div className="bg-surface border border-border rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Informations personnelles</h3>
        <form onSubmit={handleSaveProfil} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Prénom" required>
              <Input value={form.prenom} onChange={e => setForm(f => ({ ...f, prenom: e.target.value }))} />
            </Field>
            <Field label="Nom" required>
              <Input value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} />
            </Field>
          </div>
          <Field label="Email" required>
            <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </Field>
          <button type="submit" className="self-start px-5 py-2 bg-brand text-white rounded-xl text-sm font-medium hover:bg-brand-dark transition-colors">
            Enregistrer
          </button>
        </form>
      </div>

      {/* Changer mot de passe */}
      <div className="bg-surface border border-border rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Changer le mot de passe</h3>
        <form onSubmit={handleChangePwd} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Nouveau mot de passe" hint="6 caractères min." required>
              <Input type="password" value={pwdForm.newPwd} onChange={e => setPwdForm(f => ({ ...f, newPwd: e.target.value }))} />
            </Field>
            <Field label="Confirmer" hint="Identique au nouveau mot de passe" required>
              <Input type="password" value={pwdForm.confirmPwd} onChange={e => setPwdForm(f => ({ ...f, confirmPwd: e.target.value }))} />
            </Field>
          </div>
          <button type="submit" className="self-start px-5 py-2 bg-brand text-white rounded-xl text-sm font-medium hover:bg-brand-dark transition-colors">
            Modifier le mot de passe
          </button>
        </form>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────
// Page principale
// ──────────────────────────────────────────────
export default function ComptePage() {
  const { user, refresh } = useAuth()

  if (!user) return null

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Mon compte</h1>
        <p className="text-sm text-muted mt-1">Gérez vos informations personnelles et vos préférences</p>
      </header>

      <div className="space-y-10">
        <ProfilSection user={user} onUpdated={refresh} />
      </div>
    </div>
  )
}
