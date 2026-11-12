"use client";

import { useRouter } from "next/navigation";
import { BellRing, CalendarClock, CheckCircle2, History, Inbox, PhoneCall, TrendingUp, Wallet, Users } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/badges";
import { Avatar } from "@/components/ProspectCard";
import { useProspectDrawer } from "@/components/store";
import { useCrmData } from "@/lib/useCrmData";
import type { ActivitiesPayload, StatsPayload } from "@/lib/types";
import { STATUS, STATUS_ORDER, cn, formatDate, formatEUR, formatNumber, formatTime, fullName } from "@/lib/crm";

function KpiCard({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="card p-4 sm:p-5">
      <p className="text-[13px] font-medium text-slate-500">{label}</p>
      <p className={cn("mt-1 text-[26px] font-bold leading-none tracking-tight sm:text-[30px]", accent ?? "text-slate-900")}>{value}</p>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { openProspect } = useProspectDrawer();
  const { data: stats } = useCrmData<StatsPayload>("/api/stats");
  const { data: activities } = useCrmData<ActivitiesPayload>("/api/activities");

  const tauxClosing = stats ? Math.round(stats.tauxClosing * 1000) / 10 : 0;

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Vue d'ensemble de votre activité" />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <KpiCard label="Total Leads" value={formatNumber(stats?.total)} />
        <KpiCard label="Appels effectués" value={formatNumber(stats?.appels)} />
        <KpiCard label="Closings" value={formatNumber(stats?.closings)} accent="text-emerald-600" />
        <KpiCard label="CA Total" value={formatEUR(stats?.caTotal)} accent="text-blue-600" />
      </div>

      {/* Cartes colorées */}
      <div className="mt-3 grid grid-cols-1 gap-3 sm:mt-4 sm:gap-4 md:grid-cols-3">
        <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-blue-500 p-5 text-white shadow-lg shadow-blue-600/20">
          <p className="text-[13px] font-medium text-blue-100">Taux de Closing</p>
          <p className="mt-1 text-3xl font-bold">{tauxClosing.toLocaleString("fr-FR")}%</p>
          <p className="mt-1 text-xs text-blue-100">
            {stats?.closings ?? 0} / {stats?.total ?? 0} leads
          </p>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-fuchsia-600 to-purple-600 p-5 text-white shadow-lg shadow-fuchsia-600/20">
          <p className="text-[13px] font-medium text-fuchsia-100">CA / Lead</p>
          <p className="mt-1 text-3xl font-bold">{formatEUR(stats?.caParLead)}</p>
          <p className="mt-1 text-xs text-fuchsia-100">Revenu moyen par prospect</p>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 p-5 text-white shadow-lg shadow-orange-500/20">
          <p className="text-[13px] font-medium text-orange-100">Appels / Closing</p>
          <p className="mt-1 text-3xl font-bold">{(stats?.appelsParClosing ?? 0).toLocaleString("fr-FR", { maximumFractionDigits: 1 })}</p>
          <p className="mt-1 text-xs text-orange-100">Rendement de vos appels</p>
        </div>
      </div>

      {/* Rappels du jour + Historique */}
      <div className="mt-3 grid grid-cols-1 gap-3 sm:mt-4 sm:gap-4 lg:grid-cols-2">
        <section className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-[15px] font-bold text-slate-900">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-500">
                <BellRing size={15} />
              </span>
              Rappels aujourd'hui
            </h2>
            <span className="text-xs font-medium text-slate-400">{activities ? formatDate(activities.date) : "—"}</span>
          </div>
          {activities?.rappels && activities.rappels.length > 0 ? (
            <ul className="space-y-2">
              {activities.rappels.map((r) => (
                <li key={r.id}>
                  <button
                    onClick={() => openProspect(r.id)}
                    className="flex w-full items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-2.5 text-left transition hover:border-blue-300 hover:bg-blue-50/50"
                  >
                    <span className="w-[52px] shrink-0 rounded-lg bg-white px-1.5 py-1 text-center text-xs font-bold text-blue-700 ring-1 ring-slate-200">
                      {r.heureRappel || "--:--"}
                    </span>
                    <Avatar prospect={r} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold text-slate-800">{fullName(r)}</span>
                      <span className="block truncate text-xs text-slate-400">{r.telephone || "—"}</span>
                    </span>
                    <StatusBadge statut={r.statut} className="!py-px !text-[10px]" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
                <CheckCircle2 size={22} />
              </span>
              <p className="mt-3 text-sm text-slate-400">Aucun rappel prévu pour aujourd'hui</p>
            </div>
          )}
        </section>

        <section className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-[15px] font-bold text-slate-900">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <History size={15} />
              </span>
              Historique des activités du jour
            </h2>
            <span className="text-xs font-medium text-slate-400">{activities ? formatDate(activities.date) : "—"}</span>
          </div>
          {activities?.activites && activities.activites.length > 0 ? (
            <ul className="space-y-2">
              {activities.activites.map((a) => (
                <li key={a.id}>
                  <button
                    onClick={() => openProspect(a.prospectId)}
                    className="flex w-full items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-2.5 text-left transition hover:border-blue-300 hover:bg-blue-50/50"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-blue-600 ring-1 ring-slate-200">
                      <PhoneCall size={14} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold text-slate-800">
                        {a.prospectPrenom} <span className="uppercase">{a.prospectNom}</span>
                      </span>
                      <span className="block truncate text-xs text-slate-500">{a.resume}</span>
                    </span>
                    <span className="shrink-0 text-xs font-medium text-slate-400">{formatTime(a.date)}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                <Inbox size={22} />
              </span>
              <p className="mt-3 text-sm text-slate-400">Aucune activité enregistrée aujourd'hui</p>
            </div>
          )}
        </section>
      </div>

      {/* Raccourci vers l'analyse de la performance B2C */}
      <div className="card mt-3 flex flex-wrap items-center justify-between gap-4 border-blue-200 bg-gradient-to-r from-blue-50/80 via-indigo-50/50 to-white p-4 sm:mt-4 sm:p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-600/20">
            <TrendingUp size={20} />
          </span>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Module Analyste Commercial B2C</h3>
            <p className="text-xs text-slate-500">
              Volumes d'appels, joignabilité, qualité du discours, conversion, repères du marché et ROI calculés automatiquement.
            </p>
          </div>
        </div>
        <button
          onClick={() => router.push("/performance")}
          className="btn-primary !bg-blue-600 hover:!bg-blue-700 whitespace-nowrap text-xs"
        >
          Accéder à l'analyse B2C & Diagnostic →
        </button>
      </div>

      {/* Pipeline rapide */}
      <section className="card mt-3 p-5 sm:mt-4">
        <h2 className="mb-3 flex items-center gap-2 text-[15px] font-bold text-slate-900">
          <TrendingUp size={16} className="text-blue-600" />
          Pipeline rapide
        </h2>
        <div className="flex flex-wrap gap-2">
          {STATUS_ORDER.map((code) => (
            <button
              key={code}
              onClick={() => router.push(`/prospects?statut=${code}`)}
              className="group inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] font-medium text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
            >
              <span className={cn("h-2 w-2 rounded-full", STATUS[code].dot)} />
              {STATUS[code].label}
              <span className="rounded-md bg-white px-1.5 py-0.5 text-xs font-bold text-blue-600 ring-1 ring-slate-200 group-hover:ring-blue-200">
                {stats?.parStatut?.[code] ?? 0}
              </span>
            </button>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-100 pt-4 sm:grid-cols-4">
          <button
            onClick={() => router.push("/prospects?urgence=chaud")}
            className="rounded-xl bg-orange-50 px-3 py-2.5 text-left transition hover:bg-orange-100"
          >
            <p className="flex items-center gap-1.5 text-xs font-semibold text-orange-600">
              <Users size={13} /> Prospects chauds
            </p>
            <p className="mt-0.5 text-lg font-bold text-orange-700">{stats?.parUrgence?.chaud ?? 0}</p>
          </button>
          <button
            onClick={() => router.push("/prospects?sort=rappel")}
            className="rounded-xl bg-blue-50 px-3 py-2.5 text-left transition hover:bg-blue-100"
          >
            <p className="flex items-center gap-1.5 text-xs font-semibold text-blue-600">
              <CalendarClock size={13} /> Rappels à venir
            </p>
            <p className="mt-0.5 text-lg font-bold text-blue-700">{stats?.rappelsAujourdhui ?? 0} aujourd'hui</p>
          </button>
          <div className="rounded-xl bg-emerald-50 px-3 py-2.5">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
              <Wallet size={13} /> CA total
            </p>
            <p className="mt-0.5 text-lg font-bold text-emerald-700">{formatEUR(stats?.caTotal)}</p>
          </div>
          <div className="rounded-xl bg-violet-50 px-3 py-2.5">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-violet-600">
              <TrendingUp size={13} /> Nouveaux (7 j)
            </p>
            <p className="mt-0.5 text-lg font-bold text-violet-700">{stats?.nouveauxCetteSemaine ?? 0}</p>
          </div>
        </div>
      </section>
    </>
  );
}
