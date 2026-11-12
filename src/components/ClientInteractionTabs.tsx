"use client";

import { useMemo, useState } from "react";
import {
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  Edit2,
  History,
  Pencil,
  Phone,
  Plus,
  Trash2,
  User,
  X,
  Zap,
} from "lucide-react";
import {
  MOTIFS_REFUS,
  RESULTATS_APPEL,
  formatSeconds,
} from "@/lib/b2b-analytics";
import { formatDateTime, cn } from "@/lib/crm";

/** Commerciaux actifs + la valeur courante si elle n'y figure plus (commercial désactivé, par exemple). */
function optionsCommerciaux(actifs: string[], current: string): string[] {
  return current && !actifs.includes(current) ? [...actifs, current] : actifs;
}

const TYPE_LABELS: Record<string, string> = {
  appel: "Appel",
  note: "Note",
  historique: "Historique",
  statut: "Statut",
  rdv: "RDV",
  email: "E-mail",
  sms: "SMS",
};

function typeLabel(type: string): string {
  return TYPE_LABELS[type] ?? "Échange";
}

/** Le résultat d'appel n'a de sens que pour une fiche de type « appel ». */
function resultLabel(call: { type: string; resultat: string }): string {
  if (call.type !== "appel") return "Sans objet";
  return RESULTATS_APPEL.find((r) => r.code === call.resultat)?.label ?? (call.resultat || "Non renseigné");
}

export type CallItem = {
  id: number;
  prospectId: number;
  date: Date | string;
  commercial?: string;
  type: string;
  resultat: string;
  dureeSecondes: number;
  tempsTraitement: number;
  duree: number;
  motifRefus?: string;
  rdvHonore?: string;
  clientSigne?: string;
  resume: string;
};

export function ClientInteractionTabs({
  calls,
  commerciaux,
  commercialDefaut,
  prospectId,
  loggingCall,
  onLogCall,
  onUpdateCall,
  onDeleteCall,
}: {
  calls: CallItem[];
  /** Commerciaux actifs (Paramètres) */
  commerciaux: string[];
  /** Commercial proposé pour une nouvelle fiche d'échange */
  commercialDefaut: string;
  prospectId: number;
  loggingCall: boolean;
  onLogCall: (data: {
    type: "appel" | "note";
    resume: string;
    commercial: string;
    resultat: string;
    dureeSecondes: number;
    tempsTraitement: number;
    motifRefus: string;
    rdvHonore: string;
    clientSigne: string;
  }) => Promise<void>;
  onUpdateCall: (callId: number, field: string, value: string | number) => Promise<void>;
  onDeleteCall?: (callId: number) => Promise<void>;
}) {
  const [selectedCallId, setSelectedCallId] = useState<number | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // État local pour l'édition de l'appel sélectionné
  const [editFormData, setEditFormData] = useState({
    type: "appel",
    resume: "",
    commercial: "",
    resultat: "contact_utile_rappel",
    dureeSecondes: "90",
    tempsTraitement: "25",
    motifRefus: "",
    rdvHonore: "a_venir",
    clientSigne: "non",
  });

  // Formulaire d'ajout rapide de fiche d'interaction
  const [formData, setFormData] = useState({
    type: "appel" as "appel" | "note",
    resume: "",
    commercial: "",
    resultat: "contact_utile_rappel",
    dureeSecondes: "90",
    tempsTraitement: "25",
    motifRefus: "",
    rdvHonore: "a_venir",
    clientSigne: "non",
  });

  const activeCall = useMemo(() => {
    if (isCreatingNew) return null;
    if (selectedCallId) {
      const found = calls.find((c) => c.id === selectedCallId);
      if (found) return found;
    }
    return calls[0] ?? null;
  }, [calls, selectedCallId, isCreatingNew]);

  // Démarre le mode édition en un simple clic
  function startEditing(call: CallItem) {
    setEditFormData({
      type: call.type || "appel",
      resume: call.resume || "",
      commercial: call.commercial || "",
      resultat: call.resultat || "pas_reponse",
      dureeSecondes: String(call.dureeSecondes || (call.duree ? call.duree * 60 : 0)),
      tempsTraitement: String(call.tempsTraitement || 0),
      motifRefus: call.motifRefus || "",
      rdvHonore: call.rdvHonore || "a_venir",
      clientSigne: call.clientSigne || "non",
    });
    setIsEditing(true);
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!activeCall) return;
    await onUpdateCall(activeCall.id, "type", editFormData.type);
    await onUpdateCall(activeCall.id, "resume", editFormData.resume);
    await onUpdateCall(activeCall.id, "commercial", editFormData.commercial);
    await onUpdateCall(activeCall.id, "resultat", editFormData.resultat);
    await onUpdateCall(activeCall.id, "dureeSecondes", Number(editFormData.dureeSecondes) || 0);
    await onUpdateCall(activeCall.id, "tempsTraitement", Number(editFormData.tempsTraitement) || 0);
    await onUpdateCall(activeCall.id, "motifRefus", editFormData.motifRefus);
    await onUpdateCall(activeCall.id, "rdvHonore", editFormData.rdvHonore);
    await onUpdateCall(activeCall.id, "clientSigne", editFormData.clientSigne);
    setIsEditing(false);
  }

  async function handleCreateCall(e: React.FormEvent) {
    e.preventDefault();
    await onLogCall({
      type: formData.type,
      resume: formData.resume.trim() || (formData.type === "appel" ? "Appel téléphonique" : "Note récapitulative"),
      commercial: formData.commercial || commercialDefaut,
      resultat: formData.resultat,
      dureeSecondes: Number(formData.dureeSecondes) || 0,
      tempsTraitement: Number(formData.tempsTraitement) || 0,
      motifRefus: formData.motifRefus,
      rdvHonore: formData.rdvHonore,
      clientSigne: formData.clientSigne,
    });
    setIsCreatingNew(false);
    setFormData({
      type: "appel",
      resume: "",
      commercial: formData.commercial,
      resultat: "contact_utile_rappel",
      dureeSecondes: "90",
      tempsTraitement: "25",
      motifRefus: "",
      rdvHonore: "a_venir",
      clientSigne: "non",
    });
  }

  return (
    <section className="mb-6 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
      {/* En-tête */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
            <History size={15} />
          </span>
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Historique des échanges ({calls.length} fiche{calls.length > 1 ? "s" : ""})
            </h3>
            <p className="text-[11px] text-slate-500">
              Cliquez sur un appel pour le sélectionner, puis modifiez-le en un clic.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setIsCreatingNew(true);
            setIsEditing(false);
            setSelectedCallId(null);
          }}
          className={cn(
            "btn-primary !py-1.5 !px-3 text-xs",
            isCreatingNew ? "!bg-emerald-600" : "",
          )}
        >
          <Plus size={14} /> + Nouvelle fiche
        </button>
      </div>

      {/* Onglets des appels passés */}
      <div className="mb-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
          {calls.map((c, index) => {
            const isSelected = !isCreatingNew && activeCall?.id === c.id;
            const dt = new Date(c.date);
            const dateStr = isNaN(dt.getTime())
              ? `Fiche #${calls.length - index}`
              : `${dt.getDate()}/${dt.getMonth() + 1}`;

            return (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setSelectedCallId(c.id);
                  setIsCreatingNew(false);
                  setIsEditing(false);
                }}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition",
                  isSelected
                    ? "border-blue-500 bg-blue-600 text-white shadow-sm"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-100",
                )}
              >
                <Phone size={12} className={isSelected ? "text-blue-200" : "text-blue-500"} />
                <span>{typeLabel(c.type)} #{calls.length - index}</span>
                <span className={cn("text-[10px]", isSelected ? "text-blue-200" : "text-slate-400")}>
                  ({dateStr})
                </span>
                {c.resultat === "contact_utile_rdv" ? (
                  <span className="h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-white" title="RDV pris" />
                ) : null}
              </button>
            );
          })}

          {calls.length === 0 ? (
            <span className="text-xs text-slate-400 italic">Aucun appel archivé pour ce prospect.</span>
          ) : null}
        </div>
      </div>

      {/* ZONE D'AFFICHAGE & ÉDITION RAPIDE DE L'APPEL */}
      {isCreatingNew ? (
        /* Formulaire création nouvelle fiche */
        <div className="rounded-xl border border-blue-200 bg-white p-4 shadow-sm animate-pop-in">
          <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-700 flex items-center gap-1.5">
              <Plus size={14} /> Consigner une nouvelle communication
            </span>
            <button
              type="button"
              onClick={() => setIsCreatingNew(false)}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              Fermer
            </button>
          </div>

          <form onSubmit={handleCreateCall} className="space-y-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="field-label !mb-1">Type d'échange</label>
                <select
                  className="field !py-1 text-xs"
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as "appel" | "note" })}
                >
                  <option value="appel">Appel téléphonique (+1)</option>
                  <option value="note">Note de cadrage (sans +1)</option>
                </select>
              </div>
              <div>
                <label className="field-label !mb-1">Commercial</label>
                <select
                  className="field !py-1 text-xs"
                  value={formData.commercial || commercialDefaut}
                  onChange={(e) => setFormData({ ...formData, commercial: e.target.value })}
                >
                  <option value="">Non renseigné</option>
                  {optionsCommerciaux(commerciaux, formData.commercial || commercialDefaut).map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="field-label !mb-1">Résultat d'appel</label>
                <select
                  className="field !py-1 text-xs font-semibold"
                  value={formData.resultat}
                  onChange={(e) => setFormData({ ...formData, resultat: e.target.value })}
                >
                  {RESULTATS_APPEL.map((r) => (
                    <option key={r.code} value={r.code}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="field-label !mb-1">Durée en communication (secondes)</label>
                <input
                  type="number"
                  min="0"
                  className="field !py-1 text-xs"
                  value={formData.dureeSecondes}
                  onChange={(e) => setFormData({ ...formData, dureeSecondes: e.target.value })}
                  placeholder="90"
                />
              </div>
              <div>
                <label className="field-label !mb-1">Temps traitement post-appel (s)</label>
                <input
                  type="number"
                  min="0"
                  className="field !py-1 text-xs"
                  value={formData.tempsTraitement}
                  onChange={(e) => setFormData({ ...formData, tempsTraitement: e.target.value })}
                  placeholder="25"
                />
              </div>
            </div>

            {formData.resultat === "contact_utile_refus" ? (
              <div>
                <label className="field-label !mb-1">Motif du refus</label>
                <select
                  className="field !py-1 text-xs"
                  value={formData.motifRefus}
                  onChange={(e) => setFormData({ ...formData, motifRefus: e.target.value })}
                >
                  <option value="">Sélectionner un motif…</option>
                  {MOTIFS_REFUS.map((m) => (
                    <option key={m.code} value={m.code}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {formData.resultat === "contact_utile_rdv" ? (
              <div className="grid grid-cols-2 gap-2 rounded-lg bg-emerald-50 border border-emerald-200 p-2.5">
                <div>
                  <label className="field-label !mb-1 !text-emerald-900">RDV honoré</label>
                  <select
                    className="field !py-1 text-xs"
                    value={formData.rdvHonore}
                    onChange={(e) => setFormData({ ...formData, rdvHonore: e.target.value })}
                  >
                    <option value="a_venir">À venir</option>
                    <option value="oui">Oui (Honoré)</option>
                    <option value="non">Non (No-show)</option>
                  </select>
                </div>
                <div>
                  <label className="field-label !mb-1 !text-emerald-900">Client signé</label>
                  <select
                    className="field !py-1 text-xs"
                    value={formData.clientSigne}
                    onChange={(e) => setFormData({ ...formData, clientSigne: e.target.value })}
                  >
                    <option value="non">Non</option>
                    <option value="oui">Oui (Signé)</option>
                  </select>
                </div>
              </div>
            ) : null}

            <div>
              <label className="field-label !mb-1">Résumé de cette interaction</label>
              <textarea
                className="field min-h-[60px] text-xs"
                value={formData.resume}
                onChange={(e) => setFormData({ ...formData, resume: e.target.value })}
                placeholder="Détails de ce 1er, 2e, 3e, 4e ou 5e échange téléphonique..."
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsCreatingNew(false)}
                className="btn-ghost !py-1 !text-xs"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={loggingCall}
                className="btn-primary !py-1 !text-xs"
              >
                {loggingCall ? "Enregistrement…" : "Ajouter cette fiche"}
              </button>
            </div>
          </form>
        </div>
      ) : activeCall ? (
        /* Fiche d'appel sélectionnée avec EDITION EN UN CLIC */
        <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
                Fiche #{calls.length - calls.findIndex((c) => c.id === activeCall.id)} · {typeLabel(activeCall.type)}
              </span>
              <span className="text-xs text-slate-500 font-medium">
                {formatDateTime(activeCall.date)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                {activeCall.commercial ? `Par ${activeCall.commercial}` : "Commercial non renseigné"}
              </span>

              {/* Bouton Modifier le pavé en un clic */}
              {!isEditing ? (
                <button
                  type="button"
                  onClick={() => startEditing(activeCall)}
                  className="btn-ghost !border-blue-200 !text-blue-700 hover:!bg-blue-50 !py-1 !px-2.5 !text-xs"
                >
                  <Pencil size={12} /> Modifier l'appel
                </button>
              ) : null}

              {onDeleteCall ? (
                <button
                  type="button"
                  onClick={() => onDeleteCall(activeCall.id)}
                  className="icon-btn danger !h-7 !w-7"
                  title="Supprimer cette fiche d'appel"
                >
                  <Trash2 size={13} />
                </button>
              ) : null}
            </div>
          </div>

          {/* MODE LECTURE : Pavés d'attributs cliquables pour modifier */}
          {!isEditing ? (
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
              <button
                type="button"
                onClick={() => startEditing(activeCall)}
                className="text-left rounded-lg bg-slate-50 hover:bg-blue-50 p-2.5 border border-slate-100 hover:border-blue-200 transition group"
                title="Cliquer pour modifier le résultat"
              >
                <span className="flex items-center justify-between text-[10px] uppercase font-bold text-slate-400 group-hover:text-blue-600">
                  Résultat
                  <Edit2 size={10} className="opacity-0 group-hover:opacity-100 transition" />
                </span>
                <span className="font-semibold text-slate-800 block mt-0.5">
                  {resultLabel(activeCall)}
                </span>
              </button>

              <button
                type="button"
                onClick={() => startEditing(activeCall)}
                className="text-left rounded-lg bg-slate-50 hover:bg-blue-50 p-2.5 border border-slate-100 hover:border-blue-200 transition group"
                title="Cliquer pour modifier la durée"
              >
                <span className="flex items-center justify-between text-[10px] uppercase font-bold text-slate-400 group-hover:text-blue-600">
                  Durée conversation
                  <Edit2 size={10} className="opacity-0 group-hover:opacity-100 transition" />
                </span>
                <span className="font-semibold text-slate-800 block mt-0.5">
                  {activeCall.dureeSecondes ? formatSeconds(activeCall.dureeSecondes) : `${activeCall.duree} min`}
                </span>
              </button>

              <button
                type="button"
                onClick={() => startEditing(activeCall)}
                className="text-left rounded-lg bg-slate-50 hover:bg-blue-50 p-2.5 border border-slate-100 hover:border-blue-200 transition group"
                title="Cliquer pour modifier le temps post-appel"
              >
                <span className="flex items-center justify-between text-[10px] uppercase font-bold text-slate-400 group-hover:text-blue-600">
                  Temps post-appel
                  <Edit2 size={10} className="opacity-0 group-hover:opacity-100 transition" />
                </span>
                <span className="font-semibold text-slate-800 block mt-0.5">
                  {activeCall.tempsTraitement ? `${activeCall.tempsTraitement}s` : "0s"}
                </span>
              </button>

              <button
                type="button"
                onClick={() => startEditing(activeCall)}
                className="text-left rounded-lg bg-slate-50 hover:bg-blue-50 p-2.5 border border-slate-100 hover:border-blue-200 transition group"
                title="Cliquer pour modifier l'objection"
              >
                <span className="flex items-center justify-between text-[10px] uppercase font-bold text-slate-400 group-hover:text-blue-600">
                  Objection / Motif
                  <Edit2 size={10} className="opacity-0 group-hover:opacity-100 transition" />
                </span>
                <span className="font-semibold text-slate-800 block mt-0.5">
                  {activeCall.motifRefus
                    ? MOTIFS_REFUS.find((m) => m.code === activeCall.motifRefus)?.label ?? activeCall.motifRefus
                    : "Aucune"}
                </span>
              </button>
            </div>
          ) : (
            /* MODE ÉDITION EN UN CLIC : Formulaire d'édition inline */
            <form
              onSubmit={handleSaveEdit}
              className="mt-3 rounded-xl border border-blue-200 bg-blue-50/50 p-3.5 space-y-3 text-xs animate-pop-in"
            >
              <div className="flex items-center justify-between border-b border-blue-100 pb-1.5">
                <span className="text-xs font-bold text-blue-700 flex items-center gap-1">
                  <Edit2 size={13} /> Édition de l'appel en cours
                </span>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="text-slate-400 hover:text-slate-600"
                  title="Annuler les modifications"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="field-label !mb-1">Résultat d'appel</label>
                  <select
                    className="field !py-1.5 text-xs font-semibold bg-white"
                    value={editFormData.resultat}
                    onChange={(e) => setEditFormData({ ...editFormData, resultat: e.target.value })}
                  >
                    {RESULTATS_APPEL.map((r) => (
                      <option key={r.code} value={r.code}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="field-label !mb-1">Commercial</label>
                  <select
                    className="field !py-1.5 text-xs bg-white"
                    value={editFormData.commercial}
                    onChange={(e) => setEditFormData({ ...editFormData, commercial: e.target.value })}
                  >
                    <option value="">Non renseigné</option>
                    {optionsCommerciaux(commerciaux, editFormData.commercial).map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="field-label !mb-1">Durée conversation (secondes)</label>
                  <input
                    type="number"
                    min="0"
                    className="field !py-1.5 text-xs bg-white font-semibold"
                    value={editFormData.dureeSecondes}
                    onChange={(e) => setEditFormData({ ...editFormData, dureeSecondes: e.target.value })}
                    placeholder="90"
                  />
                  <span className="text-[10px] text-slate-400">
                    Ex: 90 = 1m 30s · 120 = 2 minutes
                  </span>
                </div>
                <div>
                  <label className="field-label !mb-1">Temps post-appel (secondes)</label>
                  <input
                    type="number"
                    min="0"
                    className="field !py-1.5 text-xs bg-white font-semibold"
                    value={editFormData.tempsTraitement}
                    onChange={(e) => setEditFormData({ ...editFormData, tempsTraitement: e.target.value })}
                    placeholder="25"
                  />
                  <span className="text-[10px] text-slate-400">
                    Temps CRM, e-mail récapitulatif
                  </span>
                </div>
              </div>

              <div>
                <label className="field-label !mb-1">Type de fiche</label>
                <select
                  className="field !py-1.5 text-xs bg-white"
                  value={editFormData.type}
                  onChange={(e) => setEditFormData({ ...editFormData, type: e.target.value })}
                >
                  <option value="appel">Appel (compté dans les statistiques)</option>
                  <option value="note">Note (non comptée)</option>
                  <option value="historique">Historique importé (non compté)</option>
                  {!["appel", "note", "historique"].includes(editFormData.type) ? (
                    <option value={editFormData.type}>{typeLabel(editFormData.type)} (non compté)</option>
                  ) : null}
                </select>
              </div>
              <div>
                <label className="field-label !mb-1">Objection / Motif de refus</label>
                <select
                  className="field !py-1.5 text-xs bg-white"
                  value={editFormData.motifRefus}
                  onChange={(e) => setEditFormData({ ...editFormData, motifRefus: e.target.value })}
                >
                  <option value="">Aucune objection</option>
                  {MOTIFS_REFUS.map((m) => (
                    <option key={m.code} value={m.code}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2.5 rounded-lg bg-emerald-50/70 border border-emerald-200/60 p-2.5">
                <div>
                  <label className="field-label !mb-1 !text-emerald-900">RDV honoré</label>
                  <select
                    className="field !py-1 text-xs bg-white"
                    value={editFormData.rdvHonore}
                    onChange={(e) => setEditFormData({ ...editFormData, rdvHonore: e.target.value })}
                  >
                    <option value="a_venir">À venir</option>
                    <option value="oui">Oui (Honoré)</option>
                    <option value="non">Non (No-show)</option>
                  </select>
                </div>
                <div>
                  <label className="field-label !mb-1 !text-emerald-900">Client signé</label>
                  <select
                    className="field !py-1 text-xs bg-white"
                    value={editFormData.clientSigne}
                    onChange={(e) => setEditFormData({ ...editFormData, clientSigne: e.target.value })}
                  >
                    <option value="non">Non</option>
                    <option value="oui">Oui (Signé)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="field-label !mb-1">Compte-rendu de la conversation</label>
                <textarea
                  className="field min-h-[60px] text-xs bg-white"
                  value={editFormData.resume}
                  onChange={(e) => setEditFormData({ ...editFormData, resume: e.target.value })}
                  placeholder="Résumé de l'échange..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="btn-ghost !py-1.5 !text-xs bg-white"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="btn-primary !py-1.5 !text-xs"
                >
                  Enregistrer les modifications
                </button>
              </div>
            </form>
          )}

          {/* Résumé en lecture */}
          {!isEditing ? (
            <div className="mt-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Compte-rendu de la conversation :
              </span>
              <p className="mt-1 rounded-lg bg-slate-50 p-2.5 text-xs text-slate-700 leading-relaxed border border-slate-100">
                {activeCall.resume || "Aucune note consignée pour cet échange."}
              </p>
            </div>
          ) : null}

          {/* Suivi RDV & Signature rapides */}
          {!isEditing ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-600">RDV honoré :</span>
                <select
                  value={activeCall.rdvHonore || "a_venir"}
                  onChange={(e) => void onUpdateCall(activeCall.id, "rdvHonore", e.target.value)}
                  className={cn(
                    "rounded-md border px-2 py-1 text-xs font-bold",
                    activeCall.rdvHonore === "oui"
                      ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                      : activeCall.rdvHonore === "non"
                        ? "border-rose-300 bg-rose-50 text-rose-800"
                        : "border-blue-300 bg-blue-50 text-blue-800",
                  )}
                >
                  <option value="a_venir">À venir</option>
                  <option value="oui">Oui (Honoré)</option>
                  <option value="non">Non (No-show)</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-600">Client signé :</span>
                <select
                  value={activeCall.clientSigne || "non"}
                  onChange={(e) => void onUpdateCall(activeCall.id, "clientSigne", e.target.value)}
                  className={cn(
                    "rounded-md border px-2 py-1 text-xs font-bold",
                    activeCall.clientSigne === "oui"
                      ? "border-emerald-400 bg-emerald-100 text-emerald-900"
                      : "border-slate-200 bg-white text-slate-600",
                  )}
                >
                  <option value="non">Non</option>
                  <option value="oui">Oui (Signé)</option>
                </select>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
