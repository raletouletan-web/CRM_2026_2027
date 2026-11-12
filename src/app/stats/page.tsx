"use client";

import { useMemo, useState } from "react";
import {
  BarChart3,
  Calendar,
  ChevronDown,
  ChevronRight,
  Clock,
  Coins,
  History,
  Percent,
  Phone,
  Plus,
  TrendingUp,
  User,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { PaiementBadge, StatusBadge, UrgenceBadge } from "@/components/badges";
import { useProspectDrawer } from "@/components/store";
import { useCrmData } from "@/lib/useCrmData";
import type { StatsPayload } from "@/lib/types";
import {
  STATUS,
  STATUS_ORDER,
  URGENCE,
  cn,
  formatEUR,
  formatNumber,
  formatOffre,
  fullName,
  type StatutCode,
  type UrgenceCode,
} from "@/lib/crm";

type DisplayMode = "both" | "qty" | "pct";

function Kpi({
  label,
  value,
  subValue,
  accent,
}: {
  label: string;
  value: string;
  subValue?: string;
  accent: string;
}) {
  return (
    <div className="card p-4 sm:p-5">
      <p className="text-[13px] font-medium text-slate-500">{label}</p>
      <p className={cn("mt-1 text-[26px] font-bold leading-none sm:text-[30px]", accent)}>{value}</p>
      {subValue ? <p className="mt-1.5 text-xs text-slate-400 font-medium">{subValue}</p> : null}
    </div>
  );
}

export default function StatsPage() {
  const { openProspect } = useProspectDrawer();
  const { data: stats, loading } = useCrmData<StatsPayload>("/api/stats");

  // Mode d'affichage demandé : quantité, pourcentage, ou les deux
  const [displayMode, setDisplayMode] = useState<DisplayMode>("both");

  const total = stats?.total && stats.total > 0 ? stats.total : 1;
  const closings = stats?.closings ?? 0;
  const caTotal = stats?.caTotal ?? 0;
  const appels = stats?.appels ?? 0;

  const maxUrgence = Math.max(1, ...Object.values(stats?.parUrgence ?? { chaud: 0, moyen: 0, froid: 0 }));
  const maxOffre = Math.max(1, ...(stats?.closingsParOffre ?? [{ ca: 0 }]).map((o) => o.ca));

  return (
    <>
      <PageHeader
        title="Statistiques CRM"
        subtitle="Analysez vos performances en volumes et pourcentages de conversion"
      >
        {/* Sélecteur de mode d'affichage : Quantité / Pourcentage / Les deux */}
        <div className="flex items-center rounded-xl bg-slate-100 p-1 border border-slate-200">
          <span className="hidden sm:inline-block px-2 text-xs font-semibold text-slate-500">
            Affichage :
          </span>
          <button
            onClick={() => setDisplayMode("both")}
            className={cn(
              "rounded-lg px-2.5 py-1 text-xs font-semibold transition",
              displayMode === "both" ? "bg-white text-blue-700 shadow-sm" : "text-slate-600 hover:text-slate-900",
            )}
          >
            Quantité & %
          </button>
          <button
            onClick={() => setDisplayMode("qty")}
            className={cn(
              "rounded-lg px-2.5 py-1 text-xs font-semibold transition",
              displayMode === "qty" ? "bg-white text-blue-700 shadow-sm" : "text-slate-600 hover:text-slate-900",
            )}
          >
            Quantité seule (N)
          </button>
          <button
            onClick={() => setDisplayMode("pct")}
            className={cn(
              "rounded-lg px-2.5 py-1 text-xs font-semibold transition",
              displayMode === "pct" ? "bg-white text-blue-700 shadow-sm" : "text-slate-600 hover:text-slate-900",
            )}
          >
            Pourcentage seul (%)
          </button>
        </div>
      </PageHeader>

      {/* KPIs principaux */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Kpi
          label="Total Leads"
          value={formatNumber(stats?.total)}
          subValue={
            displayMode === "qty"
              ? "100% de la base"
              : displayMode === "pct"
                ? "100% (base active)"
                : `${formatNumber(stats?.total)} prospects (100%)`
          }
          accent="text-slate-900"
        />
        <Kpi
          label="CA Total"
          value={formatEUR(stats?.caTotal)}
          subValue={
            closings > 0
              ? `${formatEUR(Math.round(caTotal / closings))} / vente moyenne`
              : "0 vente"
          }
          accent="text-emerald-600"
        />
        <Kpi
          label="Taux de Closing"
          value={`${((stats?.tauxClosing ?? 0) * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })}%`}
          subValue={
            displayMode === "pct"
              ? "du volume total des leads"
              : `${closings} ventes signées / ${formatNumber(stats?.total)} leads`
          }
          accent="text-blue-600"
        />
        <Kpi
          label="CA / Lead"
          value={formatEUR(stats?.caParLead)}
          subValue="Revenu moyen généré par prospect"
          accent="text-fuchsia-600"
        />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:mt-4 sm:gap-4 lg:grid-cols-2">
        {/* Répartition par urgence */}
        <section className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-[15px] font-bold text-slate-900">
              <BarChart3 size={16} className="text-blue-600" />
              Répartition par urgence
            </h2>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
              {displayMode === "qty" ? "En nombre" : displayMode === "pct" ? "En %" : "Nombre & %"}
            </span>
          </div>

          <div className="space-y-4">
            {(Object.keys(URGENCE) as UrgenceCode[]).map((u) => {
              const n = stats?.parUrgence?.[u] ?? 0;
              const pct = (n / total) * 100;
              const pctFmt = pct.toLocaleString("fr-FR", { maximumFractionDigits: 1 }) + "%";

              let labelValue = `${n} (${pctFmt})`;
              if (displayMode === "qty") labelValue = `${n} leads`;
              if (displayMode === "pct") labelValue = pctFmt;

              return (
                <div key={u}>
                  <div className="mb-1 flex items-center justify-between text-[13px]">
                    <span className="flex items-center gap-1.5 font-medium text-slate-700">
                      <span className={cn("h-2.5 w-2.5 rounded-full", URGENCE[u].dot)} />
                      {URGENCE[u].label}
                    </span>
                    <span className="font-bold text-slate-900">{labelValue}</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={cn("h-full rounded-full transition-all duration-500", URGENCE[u].bar)}
                      style={{ width: `${Math.max(n > 0 ? 3 : 0, Math.round(pct))}%` }}
                    />
                  </div>
                  {displayMode === "both" ? (
                    <div className="mt-1 flex justify-between text-[11px] text-slate-400">
                      <span>Quantité : <strong className="text-slate-600">{n}</strong></span>
                      <span>Part : <strong className="text-slate-600">{pctFmt}</strong></span>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>

        {/* Closings par offre */}
        <section className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-[15px] font-bold text-slate-900">
              <BarChart3 size={16} className="text-emerald-600" />
              Closings par offre
            </h2>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-600/20">
              {closings} closings total
            </span>
          </div>

          {stats?.closingsParOffre?.length ? (
            <div className="space-y-4">
              {stats.closingsParOffre.map((o) => {
                const pctCount = closings > 0 ? (o.count / closings) * 100 : 0;
                const pctCa = caTotal > 0 ? (o.ca / caTotal) * 100 : 0;

                let countDisplay = `${o.count} (${pctCount.toFixed(0)}%)`;
                if (displayMode === "qty") countDisplay = `${o.count} closing${o.count > 1 ? "s" : ""}`;
                if (displayMode === "pct") countDisplay = `${pctCount.toFixed(1)}% des closings`;

                return (
                  <div key={o.offre}>
                    <div className="mb-1 flex items-center justify-between text-[13px]">
                      <span className="font-bold text-slate-800">Offre {formatOffre(o.offre)}</span>
                      <span className="text-xs font-semibold text-emerald-700">{countDisplay}</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                        style={{ width: `${Math.max(4, Math.round(pctCa))}%` }}
                      />
                    </div>
                    <div className="mt-1 flex justify-between text-[11px] text-slate-400">
                      <span>CA : <strong className="text-slate-700">{formatEUR(o.ca)}</strong> ({pctCa.toFixed(1)}% du CA total)</span>
                      <span>Volume : <strong className="text-slate-700">{o.count}</strong> vente{o.count > 1 ? "s" : ""}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-slate-400">Aucun closing pour le moment</p>
          )}
        </section>
      </div>

      {/* Entonnoir de vente : Quantités ET Pourcentages */}
      <section className="card mt-3 p-5 sm:mt-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-2 text-[15px] font-bold text-slate-900">
              <BarChart3 size={16} className="text-violet-600" />
              Entonnoir de conversion (Pipeline)
            </h2>
            <p className="text-xs text-slate-500">
              Affichage détaillé étape par étape en quantité absolue et part relative
            </p>
          </div>
          <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700">
            Total base : {formatNumber(total)} prospects
          </span>
        </div>

        <div className="space-y-3">
          {STATUS_ORDER.map((code) => {
            const n = stats?.parStatut?.[code] ?? 0;
            const pct = (n / total) * 100;
            const pctFmt = pct.toLocaleString("fr-FR", { maximumFractionDigits: 1 }) + "%";

            return (
              <div key={code} className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3">
                <span className="w-32 shrink-0 text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <span className={cn("h-2 w-2 rounded-full", STATUS[code].dot)} />
                  {STATUS[code].label}
                </span>

                <div className="h-7 flex-1 overflow-hidden rounded-lg bg-slate-100 relative">
                  <div
                    className={cn(
                      "flex h-full items-center justify-end rounded-lg pr-2.5 text-[11px] font-bold text-white transition-all duration-500",
                      STATUS[code].dot,
                    )}
                    style={{ width: `${Math.max(n > 0 ? 4 : 0, Math.round(pct))}%` }}
                  >
                    {n > 0 ? n : ""}
                  </div>
                </div>

                {/* Affichage adaptatif Quantité / Pourcentage */}
                <div className="flex items-center justify-between sm:justify-end gap-3 sm:w-48 shrink-0 text-xs">
                  {displayMode !== "pct" ? (
                    <span className="font-bold text-slate-800">
                      {n} <span className="text-[11px] font-normal text-slate-400">prospects</span>
                    </span>
                  ) : null}

                  {displayMode !== "qty" ? (
                    <span className="font-semibold text-blue-600 rounded bg-blue-50 px-1.5 py-0.5">
                      {pctFmt}
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Statistiques détaillées */}
      <section className="card mt-3 p-5 sm:mt-4">
        <h2 className="mb-4 text-[15px] font-bold text-slate-900">Ratios de productivité & Conversion</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            {
              label: "Total appels passés",
              value: formatNumber(stats?.appels),
              sub: `${((appels / total)).toFixed(2)} appels / lead en moyenne`,
            },
            {
              label: "Closings (ventes)",
              value: formatNumber(stats?.closings),
              sub: `${((closings / total) * 100).toFixed(1)}% taux closing global`,
            },
            {
              label: "Appels par lead",
              value: (stats?.appelsParLead ?? 0).toLocaleString("fr-FR", { maximumFractionDigits: 1 }),
              sub: "Effort de relance moyen",
            },
            {
              label: "Appels par closing",
              value: (stats?.appelsParClosing ?? 0).toLocaleString("fr-FR", { maximumFractionDigits: 1 }),
              sub: "Rendement de l'effort d'appel",
            },
          ].map((s) => (
            <div key={s.label} className="rounded-xl bg-slate-50 p-4 text-center ring-1 ring-slate-100">
              <p className="text-2xl font-bold text-slate-900">{loading ? "…" : s.value}</p>
              <p className="mt-1 text-xs font-semibold text-slate-600">{s.label}</p>
              <p className="mt-0.5 text-[11px] text-slate-400">{s.sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Prospects closés — cliquer sur une ligne ouvre la fiche avec son historique */}
      <section className="card mt-3 mb-6 p-5 sm:mt-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-[15px] font-bold text-slate-900">Prospects closés</h2>
            <p className="text-xs text-slate-500">
              Cliquez sur un prospect pour ouvrir sa fiche complète et consulter l'ensemble de ses fiches d'appels & échanges
            </p>
          </div>
          <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
            {stats?.prospectsCloses?.length ?? 0} contrats
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b-2 border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="pb-2.5 pr-4 font-semibold">Prospect</th>
                <th className="pb-2.5 pr-4 font-semibold">Offre</th>
                <th className="pb-2.5 pr-4 font-semibold">Paiement</th>
                <th className="pb-2.5 text-right font-semibold">Part du CA</th>
                <th className="pb-2.5 text-right font-semibold">CA généré</th>
              </tr>
            </thead>
            <tbody>
              {stats?.prospectsCloses?.map((p) => {
                const partCa = caTotal > 0 ? ((p.caGenere ?? 0) / caTotal) * 100 : 0;
                return (
                  <tr
                    key={p.id}
                    onClick={() => openProspect(p.id)}
                    className="cursor-pointer border-b border-slate-100 transition hover:bg-blue-50/60"
                    title="Cliquer pour ouvrir la fiche client et ses fiches d'appels"
                  >
                    <td className="py-2.5 pr-4 font-bold text-slate-800">{fullName(p)}</td>
                    <td className="py-2.5 pr-4 text-slate-600">{p.offreProposee ? formatOffre(p.offreProposee) : "—"}</td>
                    <td className="py-2.5 pr-4">
                      <PaiementBadge paiement={p.statutPaiement} />
                    </td>
                    <td className="py-2.5 text-right text-xs font-semibold text-slate-500">
                      {partCa.toFixed(1)}%
                    </td>
                    <td className="py-2.5 text-right font-bold text-emerald-600">{formatEUR(p.caGenere)}</td>
                  </tr>
                );
              })}
              {!loading && (stats?.prospectsCloses?.length ?? 0) === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-sm text-slate-400">
                    Aucun prospect clos pour le moment
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
