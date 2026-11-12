"use client";

import { useEffect, useState } from "react";
import { Check, Coins, Plus, Star, Trash2, UserCheck, UserX, Users, X } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { useCommerciaux, type Commercial } from "@/lib/useCommerciaux";
import { useCrmData, notifyChange } from "@/lib/useCrmData";
import { cn } from "@/lib/crm";

type FinancialSettings = { mois: string; coutProspection: number; panierMoyen: number; configure?: boolean };

function plural(n: number, singular: string, pluralForm: string): string {
  return `${n} ${n > 1 ? pluralForm : singular}`;
}

export default function ParametresPage() {
  const { all, defaut, loading } = useCommerciaux();
  const actifs = all.filter((c) => c.actif);
  const inactifs = all.length - actifs.length;

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [toDelete, setToDelete] = useState<Commercial | null>(null);
  const [reassignTo, setReassignTo] = useState("");

  // Paramètres financiers (par mois)
  const [mois, setMois] = useState("");
  const [cout, setCout] = useState("");
  const [panier, setPanier] = useState("");
  const [financeSaved, setFinanceSaved] = useState(false);
  const { data: finance } = useCrmData<FinancialSettings>(mois ? `/api/b2b/settings?mois=${mois}` : null);

  useEffect(() => {
    const d = new Date();
    setMois(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }, []);

  useEffect(() => {
    if (finance && finance.mois === mois) {
      setCout(String(finance.coutProspection));
      setPanier(String(finance.panierMoyen));
    }
  }, [finance, mois]);

  async function api(url: string, init: RequestInit): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json" } });
      const j = await res.json().catch(() => null);
      if (!res.ok) throw new Error(j?.error ?? `HTTP ${res.status}`);
      notifyChange();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function addCommercial(e: React.FormEvent) {
    e.preventDefault();
    const nom = newName.trim();
    if (!nom) return;
    if (await api("/api/commerciaux", { method: "POST", body: JSON.stringify({ nom }) })) setNewName("");
  }

  async function rename(c: Commercial) {
    const nom = (drafts[c.id] ?? c.nom).trim();
    if (!nom || nom === c.nom) {
      cancelDraft(c.id);
      return;
    }
    if (await api(`/api/commerciaux/${c.id}`, { method: "PATCH", body: JSON.stringify({ nom }) })) cancelDraft(c.id);
  }

  function cancelDraft(id: number) {
    setDrafts((d) => {
      const next = { ...d };
      delete next[id];
      return next;
    });
  }

  function askDelete(c: Commercial) {
    setError(null);
    const used = c.nbProspects + c.nbEchanges + c.nbJoursHeures > 0;
    if (used) {
      setReassignTo("");
      setToDelete(c);
      return;
    }
    if (window.confirm(`Supprimer « ${c.nom} » de l'équipe ?`)) {
      void api(`/api/commerciaux/${c.id}`, { method: "DELETE" });
    }
  }

  async function confirmDeleteWithReassign() {
    if (!toDelete || !reassignTo) return;
    if (await api(`/api/commerciaux/${toDelete.id}?reassignTo=${reassignTo}`, { method: "DELETE" })) setToDelete(null);
  }

  async function saveFinance(e: React.FormEvent) {
    e.preventDefault();
    setFinanceSaved(false);
    const ok = await api("/api/b2b/settings", {
      method: "POST",
      body: JSON.stringify({ mois, coutProspection: Number(cout) || 0, panierMoyen: Number(panier) || 0 }),
    });
    if (ok) setFinanceSaved(true);
  }

  return (
    <>
      <PageHeader title="Paramètres" subtitle="Équipe commerciale et paramètres de calcul" />

      {error ? (
        <p className="mb-4 flex items-start justify-between gap-3 rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 ring-1 ring-rose-200">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="shrink-0 text-rose-400 hover:text-rose-600" title="Fermer">
            <X size={16} />
          </button>
        </p>
      ) : null}

      {/* ÉQUIPE COMMERCIALE */}
      <section className="card p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Users size={18} />
            </span>
            <div>
              <h2 className="text-[15px] font-bold text-slate-900">Équipe commerciale</h2>
              <p className="text-xs text-slate-500">
                Ces noms alimentent toutes les listes « Commercial » : fiches prospects, fiches d'appel, heures de
                prospection et filtres de performance.
              </p>
            </div>
          </div>
          <div className="rounded-xl bg-slate-50 px-4 py-2 text-center ring-1 ring-slate-100">
            <p className="text-2xl font-bold leading-none text-slate-900">{loading && all.length === 0 ? "…" : actifs.length}</p>
            <p className="mt-1 text-[11px] font-medium text-slate-500">
              {actifs.length > 1 ? "commerciaux actifs" : "commercial actif"}
              {inactifs > 0 ? ` · ${inactifs} désactivé${inactifs > 1 ? "s" : ""}` : ""}
            </p>
          </div>
        </div>

        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
          {all.map((c) => {
            const draft = drafts[c.id];
            const dirty = draft !== undefined && draft.trim() !== c.nom;
            return (
              <li key={c.id} className={cn("flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-3", !c.actif && "bg-slate-50/70")}>
                <div className="flex min-w-[220px] flex-1 items-center gap-2">
                  <input
                    className={cn("field !py-1.5", !c.actif && "text-slate-400")}
                    value={draft ?? c.nom}
                    maxLength={60}
                    onChange={(e) => setDrafts((d) => ({ ...d, [c.id]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void rename(c);
                      if (e.key === "Escape") cancelDraft(c.id);
                    }}
                    aria-label={`Nom du commercial ${c.nom}`}
                  />
                  {dirty ? (
                    <>
                      <button className="btn-primary !px-2.5 !py-1.5 text-xs" disabled={busy} onClick={() => void rename(c)}>
                        <Check size={14} /> Enregistrer
                      </button>
                      <button className="btn-ghost !px-2 !py-1.5 text-xs" disabled={busy} onClick={() => cancelDraft(c.id)}>
                        Annuler
                      </button>
                    </>
                  ) : null}
                </div>

                <p className="w-full text-xs text-slate-400 sm:w-auto">
                  {plural(c.nbProspects, "fiche", "fiches")} · {plural(c.nbEchanges, "échange", "échanges")} ·{" "}
                  {c.heures.toLocaleString("fr-FR")} h
                </p>

                <div className="ml-auto flex items-center gap-1.5">
                  {c.parDefaut && c.actif ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-600/20">
                      <Star size={12} className="fill-amber-400 text-amber-500" /> Par défaut
                    </span>
                  ) : c.actif ? (
                    <button
                      className="btn-ghost !px-2.5 !py-1 text-xs"
                      disabled={busy}
                      onClick={() => void api(`/api/commerciaux/${c.id}`, { method: "PATCH", body: JSON.stringify({ parDefaut: true }) })}
                      title="Utilisé quand aucun commercial n'est précisé (nouvelle fiche, import, appel rapide)"
                    >
                      <Star size={12} /> Définir par défaut
                    </button>
                  ) : (
                    <span className="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600">Désactivé</span>
                  )}
                  <button
                    className="btn-ghost !px-2.5 !py-1 text-xs"
                    disabled={busy}
                    onClick={() => void api(`/api/commerciaux/${c.id}`, { method: "PATCH", body: JSON.stringify({ actif: !c.actif }) })}
                    title={
                      c.actif
                        ? "Ne sera plus proposé dans les listes ; son historique reste à son nom"
                        : "Proposer de nouveau ce commercial dans les listes"
                    }
                  >
                    {c.actif ? <UserX size={13} /> : <UserCheck size={13} />}
                    {c.actif ? "Désactiver" : "Réactiver"}
                  </button>
                  <button className="icon-btn danger" disabled={busy} onClick={() => askDelete(c)} title="Supprimer">
                    <Trash2 size={15} />
                  </button>
                </div>
              </li>
            );
          })}
          {!loading && all.length === 0 ? (
            <li className="px-4 py-8 text-center text-sm text-slate-400">
              Aucun commercial pour le moment. Ajoutez le premier ci-dessous.
            </li>
          ) : null}
        </ul>

        <form onSubmit={addCommercial} className="mt-3 flex flex-wrap items-center gap-2">
          <input
            className="field min-w-[220px] flex-1"
            placeholder="Nom du nouveau commercial"
            value={newName}
            maxLength={60}
            onChange={(e) => setNewName(e.target.value)}
          />
          <button type="submit" className="btn-primary" disabled={busy || !newName.trim()}>
            <Plus size={15} strokeWidth={2.6} /> Ajouter un commercial
          </button>
        </form>

        <ul className="mt-4 list-disc space-y-1 pl-5 text-xs text-slate-500">
          <li>
            <strong>Renommer</strong> met à jour toutes les fiches, tous les échanges et toutes les heures déjà enregistrés à ce
            nom.
          </li>
          <li>
            <strong>Désactiver</strong> retire le commercial des listes de saisie, mais conserve son historique et ses
            statistiques.
          </li>
          <li>
            <strong>Supprimer</strong> n'est possible que s'il n'a plus de données, ou en les réattribuant à un autre commercial.
          </li>
          <li>
            Le commercial <strong>par défaut</strong>
            {defaut ? ` (${defaut})` : ""} est appliqué quand aucun n'est précisé : nouvelle fiche, import d'un tableau, appel
            rapide « +1 ».
          </li>
        </ul>
      </section>

      {/* PARAMÈTRES FINANCIERS */}
      <section className="card mt-4 p-5">
        <div className="mb-4 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <Coins size={18} />
          </span>
          <div>
            <h2 className="text-[15px] font-bold text-slate-900">Paramètres financiers (calcul du ROI)</h2>
            <p className="text-xs text-slate-500">
              ROI = (clients signés × panier moyen − coût de prospection) ÷ coût de prospection. Ces valeurs se règlent mois par
              mois.
            </p>
          </div>
        </div>

        <form onSubmit={saveFinance} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <label className="block">
            <span className="field-label">Mois</span>
            <input
              type="month"
              className="field"
              value={mois}
              onChange={(e) => {
                setMois(e.target.value);
                setFinanceSaved(false);
              }}
              required
            />
          </label>
          <label className="block">
            <span className="field-label">Coût de la prospection du mois (€)</span>
            <input type="number" min={0} className="field" value={cout} onChange={(e) => setCout(e.target.value)} required />
          </label>
          <label className="block">
            <span className="field-label">Panier moyen par client signé (€)</span>
            <input type="number" min={0} className="field" value={panier} onChange={(e) => setPanier(e.target.value)} required />
          </label>
          <div className="flex items-end">
            <button type="submit" className="btn-primary w-full justify-center" disabled={busy || !mois}>
              <Check size={15} /> Enregistrer
            </button>
          </div>
        </form>

        {financeSaved ? (
          <p className="mt-3 text-xs font-medium text-emerald-700">Paramètres enregistrés pour {mois}.</p>
        ) : finance && finance.mois === mois && finance.configure === false ? (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-200">
            Rien n'est encore enregistré pour {mois} : les montants affichés sont des valeurs par défaut, utilisées dans le
            calcul du ROI tant que vous ne saisissez pas les vôtres.
          </p>
        ) : null}
      </section>

      {/* Suppression avec réattribution */}
      {toDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[2px]">
          <div className="card animate-pop-in w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Supprimer {toDelete.nom}</h3>
              <button onClick={() => setToDelete(null)} className="icon-btn" title="Fermer">
                <X size={18} />
              </button>
            </div>
            <p className="mt-4 text-sm text-slate-600">
              Ce commercial a encore {plural(toDelete.nbProspects, "fiche assignée", "fiches assignées")},{" "}
              {plural(toDelete.nbEchanges, "échange", "échanges")} et {toDelete.heures.toLocaleString("fr-FR")} h de
              prospection. Pour le supprimer, ces données doivent être réattribuées.
            </p>
            <label className="mt-4 block">
              <span className="field-label">Réattribuer ses données à</span>
              <select className="field" value={reassignTo} onChange={(e) => setReassignTo(e.target.value)}>
                <option value="">Choisir un commercial…</option>
                {all
                  .filter((o) => o.id !== toDelete.id)
                  .map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.nom}
                      {o.actif ? "" : " (désactivé)"}
                    </option>
                  ))}
              </select>
            </label>
            <p className="mt-2 text-xs text-slate-500">
              Ses appels compteront alors dans les statistiques du commercial choisi. Pour garder l'historique à son nom,
              utilisez plutôt « Désactiver ».
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => setToDelete(null)} disabled={busy}>
                Annuler
              </button>
              <button className="btn-danger-ghost" disabled={busy || !reassignTo} onClick={() => void confirmDeleteWithReassign()}>
                <Trash2 size={15} /> Réattribuer et supprimer
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
