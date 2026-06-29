"use client"

import { useState } from "react"
import { Textarea } from "@/components/SlideOver"
import { Plus, Phone, Mail, X } from "lucide-react"

type Sens = "entrant" | "sortant" | "recu" | "envoye"
export type Entree = {
  type: "commentaire" | "appel" | "email"
  sens?: Sens
  date: string
  heure: string
  texte: string
}

const SENS_VALIDES: Sens[] = ["entrant", "sortant", "recu", "envoye"]

export function parseEntrees(raw?: string | null): Entree[] {
  if (!raw) return []
  try {
    const arr = JSON.parse(String(raw))
    if (Array.isArray(arr)) {
      return arr
        .filter(c => c && typeof c.texte === "string")
        .map(c => ({
          type: c.type === "appel" ? "appel" as const : c.type === "email" ? "email" as const : "commentaire" as const,
          sens: SENS_VALIDES.includes(c.sens) ? c.sens as Sens : undefined,
          date: String(c.date ?? ""),
          heure: String(c.heure ?? ""),
          texte: String(c.texte),
        }))
    }
  } catch {
    return [{ type: "commentaire", date: "", heure: "", texte: String(raw) }]
  }
  return []
}

function horodatage() {
  const now = new Date()
  const p2 = (n: number) => String(n).padStart(2, "0")
  return {
    date: `${p2(now.getDate())}/${p2(now.getMonth() + 1)}/${now.getFullYear()}`,
    heure: `${p2(now.getHours())}:${p2(now.getMinutes())}`,
  }
}

export default function JournalSuivi({
  notes,
  onSave,
  allowCall = true,
  allowEmail = true,
}: {
  notes?: string | null
  onSave: (json: string) => Promise<void>
  allowCall?: boolean
  allowEmail?: boolean
}) {
  const entrees = parseEntrees(notes)

  const [addingComment, setAddingComment] = useState(false)
  const [commentDraft, setCommentDraft] = useState("")
  const [addingCall, setAddingCall] = useState(false)
  const [callSens, setCallSens] = useState<"entrant" | "sortant">("sortant")
  const [callDraft, setCallDraft] = useState("")
  const [addingEmail, setAddingEmail] = useState(false)
  const [emailSens, setEmailSens] = useState<"recu" | "envoye">("envoye")
  const [emailDraft, setEmailDraft] = useState("")
  const [saving, setSaving] = useState(false)

  async function persist(liste: Entree[]) {
    setSaving(true)
    try {
      await onSave(liste.length ? JSON.stringify(liste) : "")
    } catch (e) { console.error(e) }
    finally { setSaving(false) }
  }

  async function handleAddComment() {
    const texte = commentDraft.trim()
    if (!texte) return
    await persist([...parseEntrees(notes), { type: "commentaire", ...horodatage(), texte }])
    setCommentDraft(""); setAddingComment(false)
  }

  async function handleAddCall() {
    await persist([...parseEntrees(notes), { type: "appel", sens: callSens, ...horodatage(), texte: callDraft.trim() }])
    setCallDraft(""); setCallSens("sortant"); setAddingCall(false)
  }

  async function handleAddEmail() {
    await persist([...parseEntrees(notes), { type: "email", sens: emailSens, ...horodatage(), texte: emailDraft.trim() }])
    setEmailDraft(""); setEmailSens("envoye"); setAddingEmail(false)
  }

  async function handleDelete(index: number) {
    if (!confirm("Supprimer cette entrée ?")) return
    const liste = parseEntrees(notes)
    liste.splice(index, 1)
    await persist(liste)
  }

  return (
    <div className="bg-surface border border-border rounded-xl p-5 mb-6">
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <h2 className="text-sm font-semibold text-foreground">
          Suivi
          {entrees.length > 0 && <span className="ml-2 text-xs font-normal text-muted">({entrees.length})</span>}
        </h2>
        {!addingComment && !addingCall && !addingEmail && (
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => { setCommentDraft(""); setAddingComment(true) }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-familles text-white text-xs font-medium hover:bg-familles-dark transition-colors">
              <Plus size={13} />Commentaire
            </button>
            {allowCall && (
              <button onClick={() => { setCallDraft(""); setCallSens("sortant"); setAddingCall(true) }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-benevoles text-white text-xs font-medium hover:bg-benevoles-dark transition-colors">
                <Phone size={13} />Appel
              </button>
            )}
            {allowEmail && (
              <button onClick={() => { setEmailDraft(""); setEmailSens("envoye"); setAddingEmail(true) }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-communication text-white text-xs font-medium hover:bg-communication-dark transition-colors">
                <Mail size={13} />Email
              </button>
            )}
          </div>
        )}
      </div>

      {/* Formulaire commentaire */}
      {addingComment && (
        <div className="flex flex-col gap-3 mb-4 bg-slate-50 rounded-lg p-3">
          <Textarea value={commentDraft} onChange={e => setCommentDraft(e.target.value)} rows={3} placeholder="Écrivez un commentaire…" />
          <div className="flex items-center gap-2">
            <button onClick={handleAddComment} disabled={saving || !commentDraft.trim()}
              className="px-4 py-2 rounded-lg bg-familles text-white text-sm font-medium hover:bg-familles-dark transition-colors disabled:opacity-60">
              {saving ? "Enregistrement…" : "Enregistrer"}
            </button>
            <button onClick={() => { setAddingComment(false); setCommentDraft("") }} disabled={saving}
              className="px-4 py-2 rounded-lg bg-slate-100 text-slate-600 text-sm font-medium hover:bg-slate-200 transition-colors">Annuler</button>
          </div>
        </div>
      )}

      {/* Formulaire appel */}
      {addingCall && (
        <div className="flex flex-col gap-3 mb-4 bg-slate-50 rounded-lg p-3">
          <div>
            <p className="text-xs font-medium text-muted mb-1.5">Sens de l&apos;appel</p>
            <div className="flex gap-2">
              {(["sortant", "entrant"] as const).map(s => (
                <button key={s} type="button" onClick={() => setCallSens(s)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    callSens === s ? "bg-benevoles text-white" : "bg-white border border-border text-muted hover:text-foreground"}`}>
                  <Phone size={13} />{s === "sortant" ? "Sortant" : "Entrant"}
                </button>
              ))}
            </div>
          </div>
          <Textarea value={callDraft} onChange={e => setCallDraft(e.target.value)} rows={3} placeholder="Notes de l'appel (optionnel)…" />
          <div className="flex items-center gap-2">
            <button onClick={handleAddCall} disabled={saving}
              className="px-4 py-2 rounded-lg bg-benevoles text-white text-sm font-medium hover:bg-benevoles-dark transition-colors disabled:opacity-60">
              {saving ? "Enregistrement…" : "Consigner l'appel"}
            </button>
            <button onClick={() => { setAddingCall(false); setCallDraft("") }} disabled={saving}
              className="px-4 py-2 rounded-lg bg-slate-100 text-slate-600 text-sm font-medium hover:bg-slate-200 transition-colors">Annuler</button>
          </div>
        </div>
      )}

      {/* Formulaire email */}
      {addingEmail && (
        <div className="flex flex-col gap-3 mb-4 bg-slate-50 rounded-lg p-3">
          <div>
            <p className="text-xs font-medium text-muted mb-1.5">Sens de l&apos;email</p>
            <div className="flex gap-2">
              {(["envoye", "recu"] as const).map(s => (
                <button key={s} type="button" onClick={() => setEmailSens(s)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    emailSens === s ? "bg-communication text-white" : "bg-white border border-border text-muted hover:text-foreground"}`}>
                  <Mail size={13} />{s === "envoye" ? "Envoyé" : "Reçu"}
                </button>
              ))}
            </div>
          </div>
          <Textarea value={emailDraft} onChange={e => setEmailDraft(e.target.value)} rows={3} placeholder="Objet / résumé de l'email…" />
          <div className="flex items-center gap-2">
            <button onClick={handleAddEmail} disabled={saving}
              className="px-4 py-2 rounded-lg bg-communication text-white text-sm font-medium hover:bg-communication-dark transition-colors disabled:opacity-60">
              {saving ? "Enregistrement…" : "Consigner l'email"}
            </button>
            <button onClick={() => { setAddingEmail(false); setEmailDraft("") }} disabled={saving}
              className="px-4 py-2 rounded-lg bg-slate-100 text-slate-600 text-sm font-medium hover:bg-slate-200 transition-colors">Annuler</button>
          </div>
        </div>
      )}

      {entrees.length === 0 && !addingComment && !addingCall && !addingEmail ? (
        <p className="text-sm text-muted italic">
          {allowCall || allowEmail
            ? "Aucune entrée. Ajoutez un commentaire, un appel ou un email."
            : "Aucun commentaire. Cliquez sur « Commentaire » pour en ajouter un."}
        </p>
      ) : (
        <ul className="space-y-3">
          {entrees.map((c, idx) => ({ c, idx })).reverse().map(({ c, idx }) => (
            <li key={idx} className={`group border-l-2 pl-3 flex items-start justify-between gap-3 ${
              c.type === "appel" ? "border-benevoles/50" : c.type === "email" ? "border-communication/50" : "border-familles/40"}`}>
              <div className="min-w-0">
                <p className="text-xs text-muted mb-0.5 flex items-center gap-1.5 flex-wrap">
                  {c.type === "appel" && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-benevoles-light text-benevoles-dark font-medium">
                      <Phone size={11} />Appel {c.sens === "entrant" ? "entrant" : "sortant"}
                    </span>
                  )}
                  {c.type === "email" && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-communication-light text-communication-dark font-medium">
                      <Mail size={11} />Email {c.sens === "recu" ? "reçu" : "envoyé"}
                    </span>
                  )}
                  {(c.date || c.heure) && <span>{c.date}{c.date && c.heure ? " à " : ""}{c.heure}</span>}
                </p>
                {c.texte && <p className="text-sm text-foreground whitespace-pre-wrap">{c.texte}</p>}
              </div>
              <button onClick={() => handleDelete(idx)} aria-label="Supprimer cette entrée" title="Supprimer"
                className="shrink-0 p-1 rounded text-muted hover:text-absences-dark hover:bg-absences-light transition-colors">
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
