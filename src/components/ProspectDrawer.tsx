"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BadgeEuro,
  CalendarClock,
  Check,
  FileText,
  History,
  Mail,
  Phone,
  Plus,
  RefreshCw,
  Target,
  Trash2,
  User,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import {
  FINANCEMENTS,
  SITUATIONS_PRO,
  STATUS,
  STATUS_ORDER,
  STATUTS_PAIEMENT,
  URGENCE,
  cn,
  formatDateTime,
  formatDate,
  formatEUR,
  fullName,
  parseOffreAmount,
  initials,
  toDateInputValue,
  type StatutCode,
  type UrgenceCode,
} from "@/lib/crm";
import {
  MOTIFS_REFUS,
  RESULTATS_APPEL,
  formatSeconds,
} from "@/lib/b2b-analytics";
import { useCrmData, notifyChange } from "@/lib/useCrmData";
import { useCommerciaux } from "@/lib/useCommerciaux";
import type { ProspectDetail } from "@/lib/types";
import { useProspectDrawer } from "@/components/store";
import { StatusBadge, UrgenceBadge } from "@/components/badges";
import { Avatar } from "@/components/ProspectCard";
import { ClientInteractionTabs } from "@/components/ClientInteractionTabs";

type FormState = {
  nom: string;
  prenom: string;
  telephone: string;
  email: string;
  entreprise: string;
  commercialAssigne: string;
  situationPro: string;
  metier: string;
  diplome: string;
  financement: string;
  urgence: UrgenceCode;
  statut: StatutCode;
  nbAppels: number;
  dernierContact: string;
  prochainRappel: string;
  heureRappel: string;
  resumeAppel: string;
  objections: string;
  offreProposee: string;
  statutPaiement: string;
  caGenere: number;
};

/** Ajoute la valeur courante à une liste de choix si elle n'y figure pas (valeur venue de l'import). */
function withCurrent(options: string[], current: string): string[] {
  return current && !options.includes(current) ? [...options, current] : options;
}

function blankForm(): FormState {
  return {
    nom: "",
    prenom: "",
    telephone: "",
    email: "",
    entreprise: "",
    commercialAssigne: "",
    situationPro: "",
    metier: "",
    diplome: "",
    financement: "Non défini",
    urgence: "moyen",
    statut: "nouveau_lead",
    nbAppels: 0,
    dernierContact: "",
    prochainRappel: "",
    heureRappel: "",
    resumeAppel: "",
    objections: "",
    offreProposee: "",
    statutPaiement: "Non défini",
    caGenere: 0,
  };
}

function toForm(p: ProspectDetail): FormState {
  return {
    nom: p.nom ?? "",
    prenom: p.prenom ?? "",
    telephone: p.telephone ?? "",
    email: p.email ?? "",
    entreprise: p.entreprise ?? "",
    commercialAssigne: p.commercialAssigne ?? "",
    situationPro: p.situationPro ?? "",
    metier: p.metier ?? "",
    diplome: p.diplome ?? "",
    financement: p.financement || "Non défini",
    urgence: (p.urgence as UrgenceCode) ?? "moyen",
    statut: (p.statut as StatutCode) ?? "nouveau_lead",
    nbAppels: p.nbAppels ?? 0,
    dernierContact: toDateInputValue(p.dernierContact),
    prochainRappel: toDateInputValue(p.prochainRappel),
    heureRappel: p.heureRappel ?? "",
    resumeAppel: p.resumeAppel ?? "",
    objections: p.objections ?? "",
    offreProposee: p.offreProposee !== null && p.offreProposee !== undefined ? String(p.offreProposee) : "",
    statutPaiement: p.statutPaiement || "Non défini",
    caGenere: p.caGenere ?? 0,
  };
}

const CALL_TYPE_ICON: Record<string, typeof Phone> = {
  appel: Phone,
  note: FileText,
  rdv: CalendarClock,
  email: Mail,
  statut: RefreshCw,
  sms: Mail,
};

function SectionTitle({ icon: Icon, children }: { icon: typeof User; children: React.ReactNode }) {
  return (
    <h3 className="mb-3 flex items-center gap-2 text-[13px] font-bold uppercase tracking-wide text-slate-700">
      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
        <Icon size={13} />
      </span>
      {children}
    </h3>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("block", className)}>
      <span className="field-label">
        {label}
      </span>
      {children}
    </label>
  );
}

export function ProspectDrawer() {
  const { drawer, closeDrawer } = useProspectDrawer();
  // Équipe définie dans Paramètres
  const { actifs: commerciauxActifs, defaut: commercialDefaut } = useCommerciaux();
  const isNew = drawer.mode === "new";
  const detailUrl =
    drawer.open && !isNew && drawer.prospectId ? `/api/prospects/${drawer.prospectId}` : null;
  const { data: detail, loading, reload } = useCrmData<ProspectDetail>(detailUrl);

  const [form, setForm] = useState<FormState>(blankForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loggingCall, setLoggingCall] = useState(false);
  const [initialStatut, setInitialStatut] = useState<StatutCode>("nouveau_lead");

  // Remplit le formulaire quand la fiche demandée est chargée
  useEffect(() => {
    if (drawer.open && isNew) {
      setForm(blankForm());
      setInitialStatut("nouveau_lead");
    }
  }, [drawer.open, isNew]);

  useEffect(() => {
    if (drawer.open && !isNew && detail && detail.id === drawer.prospectId) {
      setForm(toForm(detail));
      setInitialStatut((detail.statut as StatutCode) ?? "nouveau_lead");
      setError(null);
    }
  }, [drawer.open, isNew, detail, drawer.prospectId]);

  // Échap ferme le tiroir
  useEffect(() => {
    if (!drawer.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDrawer();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [drawer.open, closeDrawer]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  // CA : automatique si « Payé » et offre chiffrée ; sinon saisie libre (offre en texte libre).
  const montantOffre = useMemo(() => parseOffreAmount(form.offreProposee), [form.offreProposee]);
  const caAuto = form.statutPaiement === "Payé" && montantOffre !== null;
  const caPreview = caAuto ? (montantOffre ?? 0) : form.caGenere;

  /**
   * Bouton « +1 » : appel rapide au nom du commercial de la fiche.
   * Le résultat et la durée ne sont pas inventés : ils restent « non renseignés »
   * et se complètent dans la fiche d'appel (onglet de l'historique).
   */
  async function logCall() {
    if (!drawer.prospectId || loggingCall) return;
    setLoggingCall(true);
    try {
      await fetch(`/api/prospects/${drawer.prospectId}/calls`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "appel",
          increment: true,
          commercial: form.commercialAssigne || commercialDefaut,
          resultat: "",
          dureeSecondes: 0,
          tempsTraitement: 0,
        }),
      });
      await reload();
      notifyChange();
    } finally {
      setLoggingCall(false);
    }
  }

  async function updateCallInline(callId: number, field: string, value: string | number) {
    await fetch(`/api/b2b/calls/${callId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    await reload();
    notifyChange();
  }

  async function deleteCall(callId: number) {
    if (!window.confirm("Supprimer cette fiche d'appel ?")) return;
    await fetch(`/api/b2b/calls/${callId}`, { method: "DELETE" });
    await reload();
    notifyChange();
  }

  async function handleLogInteraction(data: {
    type: "appel" | "note";
    resume: string;
    commercial: string;
    resultat: string;
    dureeSecondes: number;
    tempsTraitement: number;
    motifRefus: string;
    rdvHonore: string;
    clientSigne: string;
  }) {
    if (!drawer.prospectId || loggingCall) return;
    setLoggingCall(true);
    try {
      await fetch(`/api/prospects/${drawer.prospectId}/calls`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          increment: data.type === "appel",
          duree: Math.round(data.dureeSecondes / 60),
        }),
      });
      await reload();
      notifyChange();
    } finally {
      setLoggingCall(false);
    }
  }

  async function save() {
    if (saving) return;
    if (!form.nom.trim() && !form.prenom.trim()) {
      setError("Le nom (ou le prénom) est obligatoire.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        nom: form.nom.trim(),
        prenom: form.prenom.trim(),
        telephone: form.telephone.trim(),
        email: form.email.trim(),
        entreprise: form.entreprise.trim(),
        commercialAssigne: form.commercialAssigne.trim() || (isNew ? commercialDefaut : ""),
        situationPro: form.situationPro,
        metier: form.metier.trim(),
        diplome: form.diplome.trim(),
        financement: form.financement,
        urgence: form.urgence,
        statut: form.statut,
        nbAppels: Math.max(0, Number(form.nbAppels) || 0),
        dernierContact: form.dernierContact ? new Date(form.dernierContact + "T00:00:00").toISOString() : null,
        prochainRappel: form.prochainRappel ? new Date(form.prochainRappel + "T00:00:00").toISOString() : null,
        heureRappel: form.heureRappel,
        resumeAppel: form.resumeAppel,
        objections: form.objections,
        offreProposee: form.offreProposee.trim() || null,
        caGenere: Math.max(0, Number(caPreview) || 0),
        statutPaiement: form.statutPaiement,
      };
      const res = await fetch(
        isNew ? "/api/prospects" : `/api/prospects/${drawer.prospectId}`,
        {
          method: isNew ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error ?? `HTTP ${res.status}`);
      }
      // Journalise un changement de statut dans l'historique (sans incrémenter les appels)
      if (!isNew && drawer.prospectId && form.statut !== initialStatut) {
        await fetch(`/api/prospects/${drawer.prospectId}/calls`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "statut",
            resume: `Statut : ${STATUS[initialStatut]?.label ?? initialStatut} → ${STATUS[form.statut]?.label ?? form.statut}`,
            increment: false,
          }),
        });
      }
      notifyChange();
      closeDrawer();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (isNew || !drawer.prospectId) return;
    if (!window.confirm(`Supprimer définitivement « ${fullName(form)} » et tout son historique ?`)) return;
    const res = await fetch(`/api/prospects/${drawer.prospectId}`, { method: "DELETE" });
    if (res.ok) {
      notifyChange();
      closeDrawer();
    }
  }

  const open = drawer.open;
  const prospectForHeader = detail && !isNew ? detail : null;

  return (
    <>
      {/* Overlay */}
      <div
        onClick={closeDrawer}
        className={cn(
          "fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[2px] transition-opacity duration-300",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />
      {/* Panneau */}
      <aside
        aria-hidden={!open}
        className={cn(
          "fixed right-0 top-0 z-50 flex h-full w-full max-w-[620px] flex-col bg-white shadow-2xl transition-transform duration-300 ease-out",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            {prospectForHeader ? (
              <Avatar prospect={prospectForHeader} />
            ) : (
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">
                {form.prenom || form.nom ? initials({ nom: form.nom, prenom: form.prenom }) : <User size={18} />}
              </span>
            )}
            <div className="min-w-0">
              <h2 className="truncate text-[17px] font-bold text-slate-900">
                {isNew ? "Nouveau prospect" : "Modifier le prospect"}
              </h2>
              {!isNew && prospectForHeader ? (
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                  <span className="truncate text-xs text-slate-500">{fullName(prospectForHeader)}</span>
                  <StatusBadge statut={prospectForHeader.statut} className="!py-px !text-[10px]" />
                  <UrgenceBadge urgence={prospectForHeader.urgence} className="!py-px !text-[10px]" />
                </div>
              ) : null}
            </div>
          </div>
          <button onClick={closeDrawer} className="icon-btn !h-9 !w-9" title="Fermer (Échap)">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="scrollbar-thin flex-1 overflow-y-auto px-5 py-5">
          {open && !isNew && loading && !detail ? (
            <div className="flex h-40 items-center justify-center text-sm text-slate-400">Chargement de la fiche…</div>
          ) : null}

          {/* Identité */}
          <section className="mb-6">
            <SectionTitle icon={User}>Identité</SectionTitle>
            {!isNew && detail && detail.id === drawer.prospectId ? (
              <p className="-mt-1 mb-3 text-[11px] text-slate-400">
                ID : <span className="font-mono text-slate-500">{detail.externalId}</span> · Fiche créée le{" "}
                {formatDate(detail.createdAt)}
              </p>
            ) : null}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Nom *">
                <input className="field" value={form.nom} onChange={(e) => set("nom", e.target.value)} placeholder="Nom" />
              </Field>
              <Field label="Prénom *">
                <input className="field" value={form.prenom} onChange={(e) => set("prenom", e.target.value)} placeholder="Prénom" />
              </Field>
              <Field label="Entreprise">
                <input className="field" value={form.entreprise} onChange={(e) => set("entreprise", e.target.value)} placeholder="Société / structure (facultatif)" />
              </Field>
              <Field label="Commercial assigné">
                <select
                  className="field"
                  value={form.commercialAssigne || (isNew ? commercialDefaut : "")}
                  onChange={(e) => set("commercialAssigne", e.target.value)}
                >
                  <option value="">Non attribué</option>
                  {withCurrent(commerciauxActifs, form.commercialAssigne).map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Téléphone">
                <input className="field" value={form.telephone} onChange={(e) => set("telephone", e.target.value)} placeholder="+33 6 …" />
              </Field>
              <Field label="Email">
                <input className="field" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="email@exemple.com" />
              </Field>
            </div>
          </section>

          {/* Profil */}
          <section className="mb-6">
            <SectionTitle icon={Target}>Profil</SectionTitle>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Situation pro">
                <select className="field" value={form.situationPro} onChange={(e) => set("situationPro", e.target.value)}>
                  <option value="">Sélectionner…</option>
                  {withCurrent(SITUATIONS_PRO, form.situationPro).map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Métier actuel">
                <input className="field" value={form.metier} onChange={(e) => set("metier", e.target.value)} placeholder="Métier actuel" />
              </Field>
              <Field label="Diplôme visé">
                <input className="field" value={form.diplome} onChange={(e) => set("diplome", e.target.value)} placeholder="Diplôme visé" />
              </Field>
              <Field label="Financement">
                <select className="field" value={form.financement} onChange={(e) => set("financement", e.target.value)}>
                  {withCurrent(FINANCEMENTS, form.financement).map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Urgence" className="sm:col-span-2">
                <select className="field" value={form.urgence} onChange={(e) => set("urgence", e.target.value as UrgenceCode)}>
                  {(Object.keys(URGENCE) as UrgenceCode[]).map((u) => (
                    <option key={u} value={u}>
                      {URGENCE[u].label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </section>

          {/* Suivi commercial */}
          <section className="mb-6">
            <SectionTitle icon={Phone}>Suivi commercial</SectionTitle>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Statut">
                <select className="field" value={form.statut} onChange={(e) => set("statut", e.target.value as StatutCode)}>
                  {STATUS_ORDER.map((s) => (
                    <option key={s} value={s}>
                      {STATUS[s].label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Nombre d'appels">
                <div className="flex items-center gap-2">
                  <input
                    className="field flex-1"
                    type="number"
                    min={0}
                    value={form.nbAppels}
                    onChange={(e) => set("nbAppels", Math.max(0, Number(e.target.value) || 0))}
                  />
                  {!isNew ? (
                    <button
                      type="button"
                      onClick={() => void logCall()}
                      disabled={loggingCall}
                      className="btn-primary shrink-0 !rounded-lg !px-2.5 !py-2.5"
                      title="Enregistrer un appel (+1)"
                    >
                      <Phone size={14} />
                      +1
                    </button>
                  ) : null}
                </div>
              </Field>
              <Field label="Dernier contact">
                <input type="date" className="field" value={form.dernierContact} onChange={(e) => set("dernierContact", e.target.value)} />
              </Field>
              <Field label="Date prochain rappel">
                <input type="date" className="field" value={form.prochainRappel} onChange={(e) => set("prochainRappel", e.target.value)} />
              </Field>
              <Field label="Heure du rappel">
                <input type="time" className="field" value={form.heureRappel} onChange={(e) => set("heureRappel", e.target.value)} />
              </Field>
              <Field label="Comptage (appels)">
                <div className="flex items-center gap-2 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                  <Zap size={13} className="text-amber-500" />
                  {form.nbAppels} appel{form.nbAppels > 1 ? "s" : ""} enregistré{form.nbAppels > 1 ? "s" : ""}
                </div>
              </Field>
              <Field label="Résumé appel" className="sm:col-span-2">
                <textarea
                  className="field min-h-[84px] resize-y"
                  value={form.resumeAppel}
                  onChange={(e) => set("resumeAppel", e.target.value)}
                  placeholder="Résumé du dernier appel…"
                />
              </Field>
              <Field label="Objections" className="sm:col-span-2">
                <textarea
                  className="field min-h-[64px] resize-y"
                  value={form.objections}
                  onChange={(e) => set("objections", e.target.value)}
                  placeholder="Objections rencontrées…"
                />
              </Field>
            </div>
          </section>

          {/* Multi-fiches d'interactions & historisations par client */}
          {!isNew && drawer.prospectId ? (
            <ClientInteractionTabs
              commerciaux={commerciauxActifs}
              commercialDefaut={form.commercialAssigne || commercialDefaut}
              calls={detail?.calls ?? []}
              prospectId={drawer.prospectId}
              loggingCall={loggingCall}
              onLogCall={handleLogInteraction}
              onUpdateCall={updateCallInline}
              onDeleteCall={deleteCall}
            />
          ) : null}

          {/* Closing */}
          <section className="mb-4">
            <SectionTitle icon={BadgeEuro}>Closing</SectionTitle>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="Offre proposée">
                <input
                  className="field"
                  type="text"
                  value={form.offreProposee}
                  onChange={(e) => set("offreProposee", e.target.value)}
                  placeholder="1400, 3 x 350€, FOLLOW UP…"
                />
              </Field>
              <Field label="Statut paiement">
                <select
                  className="field"
                  value={form.statutPaiement}
                  onChange={(e) => {
                    const v = e.target.value;
                    // En quittant « Payé », le CA repart de 0 (il reste modifiable).
                    setForm((f) => ({
                      ...f,
                      statutPaiement: v,
                      caGenere: f.statutPaiement === "Payé" && v !== "Payé" ? 0 : f.caGenere,
                    }));
                  }}
                >
                  {withCurrent(STATUTS_PAIEMENT, form.statutPaiement).map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="CA généré (€)">
                <div className="relative">
                  <input
                    className="field pr-8 font-semibold text-slate-800"
                    type="number"
                    min={0}
                    disabled={caAuto}
                    value={caPreview}
                    onChange={(e) => set("caGenere", Math.max(0, Number(e.target.value) || 0))}
                  />
                  <Wallet size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500" />
                </div>
              </Field>
            </div>
            <p className="mt-1.5 text-[11px] text-slate-400">
              {caAuto
                ? `Calculé automatiquement à partir de l'offre car « Payé » — ${formatEUR(caPreview)}.`
                : "Automatique si « Payé » avec une offre chiffrée (ex. 1400 ou 3 x 350€). Sinon, le CA se saisit ici."}
            </p>
          </section>

          {error ? (
            <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-[13px] font-medium text-rose-600 ring-1 ring-rose-200">{error}</p>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 border-t border-slate-200 bg-white px-5 py-3.5">
          {!isNew ? (
            <button type="button" onClick={() => void remove()} className="btn-danger-ghost mr-auto" title="Supprimer ce prospect">
              <Trash2 size={15} /> <span className="hidden sm:inline">Supprimer</span>
            </button>
          ) : null}
          <button type="button" onClick={closeDrawer} className="btn-ghost !bg-slate-100 !px-5">
            Annuler
          </button>
          <button type="button" onClick={() => void save()} disabled={saving} className="btn-primary flex-1 justify-center !py-2.5 sm:flex-none sm:!px-10">
            <Check size={16} strokeWidth={2.6} />
            {saving ? "Enregistrement…" : isNew ? "Créer le prospect" : "Enregistrer"}
          </button>
        </div>
      </aside>
    </>
  );
}
