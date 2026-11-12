"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Award,
  BarChart2,
  Calendar,
  CheckCircle2,
  Clock,
  Coins,
  DollarSign,
  Filter,
  Lightbulb,
  Phone,
  PhoneCall,
  PhoneForwarded,
  Plus,
  RefreshCw,
  Sliders,
  Target,
  TrendingUp,
  UserCheck,
  Users,
  X,
  Zap,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { useProspectDrawer } from "@/components/store";
import { useCrmData, notifyChange } from "@/lib/useCrmData";
import { useCommerciaux } from "@/lib/useCommerciaux";
import {
  MOTIFS_REFUS,
  RESULTATS_APPEL,
  formatSeconds,
  type B2BPerformanceIndicators,
  type CallRecord,
  type IndicatorComparison,
} from "@/lib/b2b-analytics";
import { cn, formatEUR, formatNumber } from "@/lib/crm";

type B2BStatsResponse = {
  periode: {
    vue: "jour" | "mois" | "annee" | "tous";
    jour: string;
    mois: string;
    annee: string;
    commercial: string;
    coutProspection: number;
    panierMoyen: number;
  };
  indicators: B2BPerformanceIndicators;
  breakdownCommerciaux: Array<{
    commercial: string;
    totalAppels: number;
    decroches: number;
    tauxDecroche: string;
    contactsUtiles: number;
    tentativesParHeure: string;
    rdvPris: number;
    tauxHonorabilite: string;
    clientsSignes: number;
    dmtFormatted: string;
    heuresProspection: number;
  }>;
  evolutionMensuelle?: Array<{
    mois: string;
    totalAppels: number;
    decroches: number;
    tauxDecroche: number;
    contactsUtiles: number;
    rdvPris: number;
    clientsSignes: number;
  }>;
};

export default function PerformanceB2BPage() {
  const { openProspect } = useProspectDrawer();
  // Équipe définie dans Paramètres
  const { actifs: commerciauxActifs, noms: tousCommerciaux, defaut: commercialDefaut } = useCommerciaux();

  // Filtres de sélection
  const [vue, setVue] = useState<"mois" | "jour" | "annee" | "tous">("mois");
  const [mois, setMois] = useState("2026-11");
  const [jour, setJour] = useState("2026-11-11");
  const [annee, setAnnee] = useState("2026");
  const [commercial, setCommercial] = useState("tous");
  // Mode d'affichage demandé : Quantité, Pourcentage, ou les deux
  const [statViewMode, setStatViewMode] = useState<"both" | "qty" | "pct">("both");

  // Modales
  const [openHoursModal, setOpenHoursModal] = useState(false);
  const [openSettingsModal, setOpenSettingsModal] = useState(false);
  const [openQuickCallModal, setOpenQuickCallModal] = useState(false);

  // Formulaire Heures
  const [hoursForm, setHoursForm] = useState({
    commercial: "", // vide = commercial par défaut des Paramètres
    date: "2026-11-11",
    heures: "3.5",
    notes: "",
  });

  // Formulaire Paramètres financiers
  const [settingsForm, setSettingsForm] = useState({
    mois: "2026-11",
    coutProspection: "4500",
    panierMoyen: "2500",
  });

  // Formulaire Nouvel Appel Rapide
  const [callForm, setCallForm] = useState({
    commercial: "", // vide = commercial par défaut des Paramètres
    entreprise: "",
    contactNom: "",
    telephone: "",
    date: "2026-11-11T10:00",
    resultat: "pas_reponse",
    dureeSecondes: "0",
    tempsTraitement: "20",
    motifRefus: "",
    rdvHonore: "a_venir",
    clientSigne: "non",
    resume: "",
  });

  // Construction de l'URL pour les stats
  const statsUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set("vue", vue);
    params.set("commercial", commercial);
    if (vue === "jour") params.set("jour", jour);
    else if (vue === "mois") params.set("mois", mois);
    else if (vue === "annee") params.set("annee", annee);
    return `/api/b2b/stats?${params.toString()}`;
  }, [vue, commercial, jour, mois, annee]);

  // Construction de l'URL pour la liste des appels
  const callsUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (commercial !== "tous") params.set("commercial", commercial);
    if (vue === "jour") params.set("jour", jour);
    else if (vue === "mois") params.set("mois", mois);
    params.set("limit", "100");
    return `/api/b2b/calls?${params.toString()}`;
  }, [commercial, vue, jour, mois]);

  const { data: statsData, loading: statsLoading, reload: reloadStats } = useCrmData<B2BStatsResponse>(statsUrl);
  const { data: callsList, reload: reloadCalls } = useCrmData<CallRecord[]>(callsUrl);

  const ind = statsData?.indicators;

  // Aucune donnée de démonstration n'est injectée à l'ouverture de la page :
  // les indicateurs reposent uniquement sur les appels réellement saisis.

  // Sauvegarde des heures
  async function submitHours(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/b2b/hours", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...hoursForm,
        commercial: hoursForm.commercial || commercialDefaut,
        heures: Number(hoursForm.heures) || 0,
      }),
    });
    setOpenHoursModal(false);
    notifyChange();
  }

  // Sauvegarde des paramètres financiers
  async function submitSettings(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/b2b/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mois: settingsForm.mois,
        coutProspection: Number(settingsForm.coutProspection) || 0,
        panierMoyen: Number(settingsForm.panierMoyen) || 0,
      }),
    });
    setOpenSettingsModal(false);
    notifyChange();
  }

  // Sauvegarde d'un nouvel appel rapide
  async function submitQuickCall(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/b2b/calls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...callForm,
        commercial: callForm.commercial || commercialDefaut,
        dureeSecondes: Number(callForm.dureeSecondes) || 0,
        tempsTraitement: Number(callForm.tempsTraitement) || 0,
      }),
    });
    setOpenQuickCallModal(false);
    setCallForm({
      commercial: callForm.commercial,
      entreprise: "",
      contactNom: "",
      telephone: "",
      date: new Date().toISOString().slice(0, 16),
      resultat: "pas_reponse",
      dureeSecondes: "0",
      tempsTraitement: "20",
      motifRefus: "",
      rdvHonore: "a_venir",
      clientSigne: "non",
      resume: "",
    });
    notifyChange();
  }

  // Mise à jour inline d'un appel (ex: RDV honoré, Client signé)
  async function updateCallInline(callId: number, field: "rdvHonore" | "clientSigne", value: string) {
    await fetch(`/api/b2b/calls/${callId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    notifyChange();
  }

  return (
    <>
      <PageHeader
        title="Performance Commerciale B2C"
        subtitle="Analyste de la performance en prospection sortante : joignabilité, discours, conversion et ROI"
      >
        <button
          onClick={() => setOpenHoursModal(true)}
          className="btn-ghost !border-blue-200 !text-blue-700 hover:!bg-blue-50"
        >
          <Clock size={15} /> Heures prospection
        </button>
        <button
          onClick={() => setOpenSettingsModal(true)}
          className="btn-ghost !border-emerald-200 !text-emerald-700 hover:!bg-emerald-50"
        >
          <Sliders size={15} /> Paramètres ROI
        </button>
        <button
          onClick={() => setOpenQuickCallModal(true)}
          className="btn-primary !bg-emerald-600 hover:!bg-emerald-700"
        >
          <PhoneCall size={15} /> + Appel B2C
        </button>
      </PageHeader>

      {/* Barre de filtrage avancée */}
      <div className="card mb-5 flex flex-wrap items-center gap-3 p-3.5 sm:p-4">
        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
          <Filter size={14} className="text-blue-600" /> Périmètre :
        </div>

        {/* Sélection de la vue */}
        <div className="flex items-center rounded-xl bg-slate-100 p-1">
          {(
            [
              { id: "mois", label: "Mois" },
              { id: "jour", label: "Jour" },
              { id: "annee", label: "Année" },
              { id: "tous", label: "Tout cumul" },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              onClick={() => setVue(item.id)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                vue === item.id ? "bg-white text-blue-700 shadow-sm" : "text-slate-600 hover:text-slate-900",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Sélecteur de date conditionnel */}
        {vue === "mois" ? (
          <input
            type="month"
            value={mois}
            onChange={(e) => setMois(e.target.value)}
            className="field !w-auto !py-1.5 text-xs font-medium"
          />
        ) : null}

        {vue === "jour" ? (
          <input
            type="date"
            value={jour}
            onChange={(e) => setJour(e.target.value)}
            className="field !w-auto !py-1.5 text-xs font-medium"
          />
        ) : null}

        {vue === "annee" ? (
          <select
            value={annee}
            onChange={(e) => setAnnee(e.target.value)}
            className="field !w-auto !py-1.5 text-xs font-medium"
          >
            <option value="2026">2026</option>
            <option value="2025">2025</option>
          </select>
        ) : null}

        {/* Sélecteur de commercial */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-400">Commercial :</span>
          <select
            value={commercial}
            onChange={(e) => setCommercial(e.target.value)}
            className="field !w-auto !py-1.5 text-xs font-medium"
          >
            <option value="tous">Toute l'équipe</option>
            {tousCommerciaux.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* Sélecteur Mode Quantité vs Pourcentage */}
        <div className="flex items-center rounded-xl bg-slate-100 p-1 border border-slate-200">
          <span className="hidden sm:inline-block px-2 text-[11px] font-semibold text-slate-500">
            Stats :
          </span>
          <button
            onClick={() => setStatViewMode("both")}
            className={cn(
              "rounded-lg px-2 py-1 text-xs font-semibold transition",
              statViewMode === "both" ? "bg-white text-blue-700 shadow-sm" : "text-slate-600 hover:text-slate-900",
            )}
          >
            N & %
          </button>
          <button
            onClick={() => setStatViewMode("qty")}
            className={cn(
              "rounded-lg px-2 py-1 text-xs font-semibold transition",
              statViewMode === "qty" ? "bg-white text-blue-700 shadow-sm" : "text-slate-600 hover:text-slate-900",
            )}
          >
            Quantité (N)
          </button>
          <button
            onClick={() => setStatViewMode("pct")}
            className={cn(
              "rounded-lg px-2 py-1 text-xs font-semibold transition",
              statViewMode === "pct" ? "bg-white text-blue-700 shadow-sm" : "text-slate-600 hover:text-slate-900",
            )}
          >
            Pourcentage (%)
          </button>
        </div>

        <button
          onClick={() => {
            reloadStats();
            reloadCalls();
          }}
          className="btn-ghost ml-auto !py-1.5 !text-xs text-slate-600"
          title="Actualiser les calculs"
        >
          <RefreshCw size={13} /> Recalculer
        </button>
      </div>

      {/* Bandeau d'alertes & données manquantes */}
      {ind?.alertesDonnees && ind.alertesDonnees.length > 0 ? (
        <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
          <div className="flex items-start gap-2.5">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-600" />
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-amber-800">
                Précision de l'échantillon & Signalements
              </p>
              <ul className="mt-1 space-y-1 text-xs text-amber-700">
                {ind.alertesDonnees.map((alt, i) => (
                  <li key={i}>• {alt}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : null}

      {/* DIAGNOSTIC DE L'ANALYSTE COMMERCIAL & 3 ACTIONS CONCRÈTES */}
      <section className="mb-6 overflow-hidden rounded-2xl border border-blue-200/80 bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 p-6 text-white shadow-xl shadow-blue-950/10">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700/80 pb-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/20 text-blue-400 ring-1 ring-blue-400/30">
              <Lightbulb size={20} />
            </span>
            <div>
              <h2 className="text-base font-bold text-white">Diagnostic Commercial B2C Automatique</h2>
              <p className="text-xs text-slate-300">
                Périmètre : {commercial === "tous" ? "Équipe globale" : commercial} · Période : {vue === "mois" ? mois : vue === "jour" ? jour : vue}
              </p>
            </div>
          </div>
          <span className="rounded-full bg-blue-500/20 px-3 py-1 text-xs font-semibold text-blue-300 ring-1 ring-blue-400/30">
            Moteur d'analyse B2C actif
          </span>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* Diagnostic synthétique */}
          <div className="space-y-3.5">
            <div>
              <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-400">
                <CheckCircle2 size={14} /> Ce qui fonctionne bien
              </h3>
              <ul className="mt-2 space-y-1.5">
                {ind?.diagnostic?.pointsForts?.map((pt, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-xs leading-relaxed text-slate-200">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                    <span>{pt}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-400">
                <AlertTriangle size={14} /> Points d'écart avec les repères du marché
              </h3>
              <ul className="mt-2 space-y-1.5">
                {ind?.diagnostic?.pointsAttention?.length ? (
                  ind.diagnostic.pointsAttention.map((pt, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-xs leading-relaxed text-slate-200">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                      <span>{pt}</span>
                    </li>
                  ))
                ) : (
                  <li className="text-xs text-slate-300">Aucun écart critique détecté sur la période.</li>
                )}
              </ul>
            </div>

            <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Cause racine probable :</p>
              <p className="mt-1 text-xs font-medium text-blue-200">{ind?.diagnostic?.causeProbable || "Analyse en cours..."}</p>
            </div>
          </div>

          {/* 3 Actions concrètes hiérarchisées */}
          <div>
            <h3 className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-blue-300">
              <Zap size={14} /> 3 Actions prioritaires à tester (classées par impact)
            </h3>
            <div className="space-y-2.5">
              {ind?.actionsRecommandees?.map((act) => (
                <div
                  key={act.priorite}
                  className="rounded-xl border border-slate-700/90 bg-slate-800/80 p-3 transition hover:border-slate-600"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-white">
                      #{act.priorite} · {act.titre}
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                        act.impact === "Impact Fort"
                          ? "bg-rose-500/20 text-rose-300 ring-1 ring-rose-500/40"
                          : act.impact === "Impact Moyen"
                            ? "bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40"
                            : "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40",
                      )}
                    >
                      {act.impact}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-slate-300">{act.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* LES QUATRE FAMILLES D'INDICATEURS */}
      <div className="space-y-6">
        {/* FAMILLE 1 : Activité et productivité */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-800">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-100 text-blue-700">1</span>
              Activité & Productivité
            </h2>
            <span className="text-xs text-slate-400">Cadence horaire et exploitation du temps</span>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
            <IndicatorCard
              title="Volume appels sortants"
              value={formatNumber(ind?.appelsTotal)}
              detail={`${ind?.appelsDecroches ?? 0} décrochés`}
              badgeLabel="Activité brute"
              badgeColor="bg-slate-100 text-slate-700 ring-slate-200"
            />
            <IndicatorComparisonCard
              title="Tentatives par heure"
              comp={ind?.tentativesParHeure}
              helper={`${ind?.heuresProspection ?? 0}h prospection déclarées`}
            />
            <IndicatorComparisonCard
              title="Taux faux numéros"
              comp={ind?.tauxFauxNumeros}
              helper={`${ind?.fauxNumeros ?? 0} numéros non attribués`}
            />
            <IndicatorCard
              title="DMT globale"
              value={ind?.dmtFormatted || "0s"}
              detail="Conversation + post-appel"
              badgeLabel="Cadence CRM"
              badgeColor="bg-indigo-50 text-indigo-700 ring-indigo-200"
            />
            <IndicatorCard
              title="Temps prospection"
              value={`${ind?.heuresProspection?.toFixed(1) ?? "0"} h`}
              detail="Heures réellement passées"
              badgeLabel="Cumul période"
              badgeColor="bg-slate-100 text-slate-700 ring-slate-200"
            />
          </div>
        </section>

        {/* FAMILLE 2 : Joignabilité */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-800">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-sky-100 text-sky-700">2</span>
              Joignabilité & Créneaux Horaires
            </h2>
            <span className="text-xs text-slate-400">Accès aux prospects et moments clés</span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-4">
            <IndicatorComparisonCard
              title="Taux de décroché"
              comp={ind?.tauxDecroche}
              helper={`${ind?.appelsDecroches ?? 0} humains ayant répondu`}
            />
            <IndicatorComparisonCard
              title="Taux contacts utiles"
              comp={ind?.tauxContactsUtiles}
              helper={`${ind?.contactsUtiles ?? 0} prospects joints`}
            />
            <IndicatorComparisonCard
              title="Tentatives avant contact"
              comp={ind?.tentativesAvantContact}
              helper="Appels ÷ contacts utiles"
            />
            {/* Meilleur créneau horaire */}
            <div className="card p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-500">Meilleur créneau horaire</span>
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-600/20">
                  Pic joignabilité
                </span>
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-900">{ind?.meilleurCreneau?.label || "—"}</p>
              <p className="mt-1 text-xs text-emerald-600 font-medium">
                {((ind?.meilleurCreneau?.tauxDecroche ?? 0) * 100).toFixed(1)}% de décroché
                {ind?.meilleurCreneau?.volumeAppels ? ` (${ind.meilleurCreneau.volumeAppels} appels)` : ""}
              </p>
              <p className="mt-1 text-[11px] text-slate-400">Créneau où le taux de réponse est maximal.</p>
            </div>
          </div>

          {/* Graphique de joignabilité heure par heure */}
          <div className="card mt-3 p-4 sm:p-5">
            <h3 className="mb-3 flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-600">
              <span>Taux de décroché par heure d'appel (8h00 - 19h00)</span>
              <span className="text-[11px] font-normal text-slate-400">Volume & taux de réponse humaine</span>
            </h3>
            <div className="grid grid-cols-6 gap-2 sm:grid-cols-12">
              {ind?.creneauxHoraires?.map((slot) => {
                const pct = Math.round(slot.tauxDecroche * 100);
                const isBest = ind.meilleurCreneau?.heure === slot.heure;
                return (
                  <div
                    key={slot.heure}
                    className={cn(
                      "flex flex-col items-center rounded-xl border p-2 transition",
                      isBest ? "border-emerald-300 bg-emerald-50/50" : "border-slate-100 bg-slate-50/50",
                    )}
                  >
                    <span className="text-[11px] font-bold text-slate-700">{slot.heure}h</span>
                    <div className="my-2 flex h-16 w-full items-end justify-center rounded bg-slate-200/60 p-1">
                      <div
                        className={cn(
                          "w-full rounded transition-all duration-500",
                          isBest ? "bg-emerald-500" : pct > 20 ? "bg-blue-500" : "bg-slate-400",
                        )}
                        style={{ height: `${Math.max(8, pct)}%` }}
                        title={`${slot.label} : ${pct}% décroché (${slot.decroches}/${slot.totalAppels})`}
                      />
                    </div>
                    <span className="text-[11px] font-bold text-slate-900">{pct}%</span>
                    <span className="text-[10px] text-slate-400">{slot.totalAppels} app.</span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* FAMILLE 3 : Engagement et discours */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-800">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-100 text-amber-700">3</span>
              Engagement & Discours Commercial
            </h2>
            <span className="text-xs text-slate-400">Qualité des échanges, accroche et objections</span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-4">
            <IndicatorCard
              title="Durée moy. décroché"
              value={ind?.dureeMoyenneDecrocheFormatted || "0s"}
              detail={`${ind?.dureeMoyenneDecrocheSecondes ?? 0} secondes par échange`}
              badgeLabel="Profondeur d'échange"
              badgeColor="bg-amber-50 text-amber-700 ring-amber-200"
            />
            <IndicatorComparisonCard
              title="Part < 30s (rejet immédiat)"
              comp={ind?.partMoins30s}
              helper="Échanges interrompus vite (accroche)"
            />
            <IndicatorComparisonCard
              title="Part > 2 min (qualifié)"
              comp={ind?.partPlus2min}
              helper="Échanges avec un réel intérêt du prospect"
            />
            {/* Motif de refus principal */}
            <div className="card p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-500">Refus principal</span>
                <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 ring-1 ring-rose-600/20">
                  Objection n°1
                </span>
              </div>
              <p className="mt-2 text-lg font-bold text-slate-900">{ind?.motifRefusPrincipal?.label || "Aucun refus"}</p>
              <p className="mt-1 text-xs text-rose-600 font-medium">
                {ind?.motifRefusPrincipal
                  ? `${ind.motifRefusPrincipal.count} refus (${(ind.motifRefusPrincipal.pct * 100).toFixed(0)}% du total)`
                  : "Pas d'objection enregistrée"}
              </p>
              <p className="mt-1 text-[11px] text-slate-400">Motif le plus souvent rencontré.</p>
            </div>
          </div>

          {/* Répartition des motifs de refus */}
          <div className="card mt-3 p-4 sm:p-5">
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-600">
              Répartition des motifs de refus rencontrés
            </h3>
            <div className="space-y-2.5">
              {ind?.repartitionMotifsRefus?.map((m) => {
                const pct = Math.round(m.pct * 100);
                return (
                  <div key={m.code} className="flex items-center gap-3">
                    <span className="w-44 shrink-0 truncate text-xs font-medium text-slate-700">{m.label}</span>
                    <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-amber-500 to-rose-500 transition-all duration-500"
                        style={{ width: `${Math.max(m.count > 0 ? 3 : 0, pct)}%` }}
                      />
                    </div>
                    <span className="w-16 shrink-0 text-right text-xs font-bold text-slate-800">
                      {m.count} ({pct}%)
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* FAMILLE 4 : Conversion, performance & ROI */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-800">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">4</span>
              Conversion, Honorabilité des RDV & ROI
            </h2>
            <span className="text-xs text-slate-400">Transformation, no-show et rentabilité financière</span>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <IndicatorComparisonCard
              title="Taux RDV / appels"
              comp={ind?.tauxRdvParAppels}
              helper={`${ind?.rdvPris ?? 0} RDV pris au total`}
            />
            <IndicatorComparisonCard
              title="Taux RDV / contacts utiles"
              comp={ind?.tauxRdvParContactsUtiles}
              helper={`${ind?.rdvPris ?? 0} RDV pour ${ind?.contactsUtiles ?? 0} prospects joints`}
            />
            <IndicatorComparisonCard
              title="Contacts utiles par RDV"
              comp={ind?.contactsUtilesParRdv}
              helper="Définit l'efficacité de closing RDV"
            />
            <IndicatorComparisonCard
              title="Taux d'honorabilité"
              comp={ind?.tauxHonorabilite}
              helper={`${ind?.rdvHonores ?? 0} honorés / ${ind?.rdvEchus ?? 0} échus (${ind?.rdvAVenir ?? 0} à venir)`}
            />
            <IndicatorComparisonCard
              title="Taux de no-show"
              comp={ind?.tauxNoShow}
              helper={`${ind?.rdvNonHonores ?? 0} rendez-vous manqués`}
            />
            <IndicatorComparisonCard
              title="Conversion RDV → Vente"
              comp={ind?.conversionClientsParRdvHonore}
              helper={`${ind?.clientsSignes ?? 0} clients signés`}
            />
            <IndicatorComparisonCard
              title="Conversion globale"
              comp={ind?.conversionGlobale}
              helper="Clients signés ÷ volume total d'appels"
            />
            <IndicatorComparisonCard
              title="ROI Prospection"
              comp={ind?.roiPct}
              helper={`CA: ${formatEUR(ind?.chiffreAffairesGenere)} · Coût: ${formatEUR(ind?.coutProspection)}`}
            />
          </div>

          {/* Synthèse financière ROI */}
          <div className="card mt-3 grid grid-cols-1 divide-y divide-slate-100 p-4 sm:grid-cols-4 sm:divide-x sm:divide-y-0">
            <div className="p-3">
              <span className="text-xs font-semibold text-slate-400">Coût prospection période</span>
              <p className="mt-1 text-xl font-bold text-slate-900">{formatEUR(ind?.coutProspection)}</p>
              <p className="text-[11px] text-slate-400">Salaires, outils, forfaits</p>
            </div>
            <div className="p-3">
              <span className="text-xs font-semibold text-slate-400">Panier moyen par client</span>
              <p className="mt-1 text-xl font-bold text-slate-900">{formatEUR(ind?.panierMoyen)}</p>
              <p className="text-[11px] text-slate-400">Montant contrat moyen</p>
            </div>
            <div className="p-3">
              <span className="text-xs font-semibold text-slate-400">Chiffre d'affaires généré</span>
              <p className="mt-1 text-xl font-bold text-emerald-600">{formatEUR(ind?.chiffreAffairesGenere)}</p>
              <p className="text-[11px] text-emerald-600">{ind?.clientsSignes ?? 0} contrat(s) signé(s)</p>
            </div>
            <div className="p-3">
              <span className="text-xs font-semibold text-slate-400">Bénéfice net prospection</span>
              <p className="mt-1 text-xl font-bold text-blue-600">
                {formatEUR((ind?.chiffreAffairesGenere ?? 0) - (ind?.coutProspection ?? 0))}
              </p>
              <p className="text-[11px] text-blue-600">ROI : {ind?.roiPct?.formatted || "—"}</p>
            </div>
          </div>
        </section>

        {/* TABLEAU COMPARATIF D'ÉQUIPE (PAR COMMERCIAL) */}
        <section className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                Tableau de bord par commercial (Cumul période)
              </h2>
              <p className="text-xs text-slate-500">
                Règle stricte : tous les ratios cumulés sont recalculés à partir des totaux, jamais moyennés.
              </p>
            </div>
            <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">
              {statsData?.breakdownCommerciaux?.length ?? 0} commerciaux
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead>
                <tr className="border-b-2 border-slate-200 text-slate-400 uppercase tracking-wide">
                  <th className="pb-2.5 font-bold">Commercial</th>
                  <th className="pb-2.5 font-bold">Heures</th>
                  <th className="pb-2.5 font-bold">Appels</th>
                  <th className="pb-2.5 font-bold">Cadence (app/h)</th>
                  <th className="pb-2.5 font-bold">Décrochés</th>
                  <th className="pb-2.5 font-bold">Taux Décroché</th>
                  <th className="pb-2.5 font-bold">DMT</th>
                  <th className="pb-2.5 font-bold">Contacts utiles</th>
                  <th className="pb-2.5 font-bold">RDV Pris</th>
                  <th className="pb-2.5 font-bold">Honorabilité</th>
                  <th className="pb-2.5 font-bold text-right">Signés</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {statsData?.breakdownCommerciaux?.map((row) => {
                  const pctDecrocheNum = row.totalAppels > 0 ? (row.decroches / row.totalAppels) * 100 : 0;
                  const pctUtilesNum = row.totalAppels > 0 ? (row.contactsUtiles / row.totalAppels) * 100 : 0;
                  const pctRdvNum = row.totalAppels > 0 ? (row.rdvPris / row.totalAppels) * 100 : 0;

                  return (
                    <tr key={row.commercial} className="hover:bg-blue-50/40 transition">
                      <td className="py-2.5 font-bold text-slate-800">{row.commercial}</td>
                      <td className="py-2.5 font-medium text-slate-600">{row.heuresProspection.toFixed(1)} h</td>
                      <td className="py-2.5 font-bold text-slate-900">{row.totalAppels}</td>
                      <td className="py-2.5 font-semibold text-blue-600">{row.tentativesParHeure}</td>
                      <td className="py-2.5 text-slate-700">
                        {statViewMode === "pct"
                          ? `${pctDecrocheNum.toFixed(1)}%`
                          : statViewMode === "qty"
                            ? row.decroches
                            : `${row.decroches} (${pctDecrocheNum.toFixed(0)}%)`}
                      </td>
                      <td className="py-2.5 font-semibold text-slate-800">{row.tauxDecroche}</td>
                      <td className="py-2.5 text-slate-600">{row.dmtFormatted}</td>
                      <td className="py-2.5 font-semibold text-purple-700">
                        {statViewMode === "pct"
                          ? `${pctUtilesNum.toFixed(1)}%`
                          : statViewMode === "qty"
                            ? row.contactsUtiles
                            : `${row.contactsUtiles} (${pctUtilesNum.toFixed(0)}%)`}
                      </td>
                      <td className="py-2.5 font-bold text-blue-700">
                        {statViewMode === "pct"
                          ? `${pctRdvNum.toFixed(1)}%`
                          : statViewMode === "qty"
                            ? row.rdvPris
                            : `${row.rdvPris} (${pctRdvNum.toFixed(1)}%)`}
                      </td>
                      <td className="py-2.5 font-semibold text-emerald-700">{row.tauxHonorabilite}</td>
                      <td className="py-2.5 text-right font-bold text-emerald-600">{row.clientsSignes}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* JOURNAL DES APPELS B2B & ÉDITION EN DIRECT (RDV HONORÉ / SIGNÉ) */}
        <section className="card p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                Journal des appels sortants (1 ligne = 1 appel)
              </h2>
              <p className="text-xs text-slate-500">
                Mettez à jour directement l'honorabilité du RDV et la signature sur la même ligne.
              </p>
            </div>
            <span className="text-xs text-slate-400">
              {callsList?.length ?? 0} appels affichés · Cliquez sur une fiche prospect pour ouvrir son tiroir
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-left text-xs">
              <thead>
                <tr className="border-b-2 border-slate-200 text-slate-400 uppercase tracking-wide">
                  <th className="pb-2.5 font-bold">Date & Heure</th>
                  <th className="pb-2.5 font-bold">Commercial</th>
                  <th className="pb-2.5 font-bold">Client / Prospect</th>
                  <th className="pb-2.5 font-bold">Résultat d'appel</th>
                  <th className="pb-2.5 font-bold">Durée / Post-appel</th>
                  <th className="pb-2.5 font-bold">Motif refus</th>
                  <th className="pb-2.5 font-bold">RDV honoré</th>
                  <th className="pb-2.5 font-bold">Client signé</th>
                  <th className="pb-2.5 font-bold">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {callsList?.map((c) => {
                  const resObj = RESULTATS_APPEL.find((r) => r.code === c.resultat);
                  const isRdv = c.resultat === "contact_utile_rdv";
                  const dt = new Date(c.date);
                  const dateFmt = isNaN(dt.getTime())
                    ? "—"
                    : `${dt.toLocaleDateString("fr-FR")} à ${dt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;

                  return (
                    <tr key={c.id} className="hover:bg-slate-50 transition">
                      <td className="py-2.5 text-slate-600 whitespace-nowrap">{dateFmt}</td>
                      <td className="py-2.5 font-semibold text-slate-800 whitespace-nowrap">{c.commercial}</td>
                      <td className="py-2.5">
                        <button
                          onClick={() => c.prospectId && openProspect(c.prospectId)}
                          className="font-bold text-blue-600 hover:underline text-left block"
                          title="Ouvrir la fiche prospect"
                        >
                          {c.entreprise || (c.prospectNom ? `${c.prospectPrenom} ${c.prospectNom}` : "Prospect")}
                        </button>
                        {c.telephone ? <span className="text-[11px] text-slate-400">{c.telephone}</span> : null}
                      </td>
                      <td className="py-2.5 whitespace-nowrap">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold",
                            c.resultat === "contact_utile_rdv"
                              ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20"
                              : c.resultat === "contact_utile_refus"
                                ? "bg-rose-50 text-rose-700 ring-1 ring-rose-600/20"
                                : c.resultat === "contact_utile_rappel"
                                  ? "bg-purple-50 text-purple-700 ring-1 ring-purple-600/20"
                                  : c.resultat === "barrage"
                                    ? "bg-amber-50 text-amber-700 ring-1 ring-amber-600/20"
                                    : "bg-slate-100 text-slate-700",
                          )}
                        >
                          {resObj?.label ?? c.resultat}
                        </span>
                      </td>
                      <td className="py-2.5 text-slate-700 whitespace-nowrap">
                        <span className="font-semibold">{formatSeconds(c.dureeSecondes)}</span>
                        <span className="text-[11px] text-slate-400"> (post: {c.tempsTraitement}s)</span>
                      </td>
                      <td className="py-2.5 text-slate-500 whitespace-nowrap">
                        {c.motifRefus
                          ? MOTIFS_REFUS.find((m) => m.code === c.motifRefus)?.label ?? c.motifRefus
                          : "—"}
                      </td>
                      {/* Sélecteur inline pour RDV honoré */}
                      <td className="py-2.5 whitespace-nowrap">
                        {isRdv || c.rdvHonore ? (
                          <select
                            value={c.rdvHonore || "a_venir"}
                            onChange={(e) => void updateCallInline(c.id, "rdvHonore", e.target.value)}
                            className={cn(
                              "rounded-lg px-2 py-1 text-[11px] font-bold border transition",
                              c.rdvHonore === "oui"
                                ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                                : c.rdvHonore === "non"
                                  ? "border-rose-300 bg-rose-50 text-rose-800"
                                  : "border-blue-300 bg-blue-50 text-blue-800",
                            )}
                          >
                            <option value="a_venir">À venir</option>
                            <option value="oui">Oui (Honoré)</option>
                            <option value="non">Non (No-show)</option>
                          </select>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      {/* Sélecteur inline pour Client signé */}
                      <td className="py-2.5 whitespace-nowrap">
                        <select
                          value={c.clientSigne || "non"}
                          onChange={(e) => void updateCallInline(c.id, "clientSigne", e.target.value)}
                          className={cn(
                            "rounded-lg px-2 py-1 text-[11px] font-bold border transition",
                            c.clientSigne === "oui"
                              ? "border-emerald-400 bg-emerald-100 text-emerald-900"
                              : "border-slate-200 bg-slate-50 text-slate-600",
                          )}
                        >
                          <option value="non">Non</option>
                          <option value="oui">Oui (Signé)</option>
                        </select>
                      </td>
                      <td className="py-2.5 max-w-[200px] truncate text-slate-600" title={c.resume}>
                        {c.resume || "—"}
                      </td>
                    </tr>
                  );
                })}
                {callsList?.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-sm text-slate-400">
                      Aucun appel enregistré sur ce périmètre.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* MODALE : Déclarer des heures de prospection */}
      {openHoursModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="card w-full max-w-md p-6 shadow-2xl animate-pop-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Heures de prospection par jour</h3>
              <button onClick={() => setOpenHoursModal(false)} className="icon-btn">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={submitHours} className="mt-4 space-y-3.5">
              <div>
                <label className="field-label">Commercial</label>
                <select
                  value={hoursForm.commercial || commercialDefaut}
                  onChange={(e) => setHoursForm({ ...hoursForm, commercial: e.target.value })}
                  className="field"
                >
                  {commerciauxActifs.length === 0 ? <option value="">Aucun commercial (à créer dans Paramètres)</option> : null}
                  {commerciauxActifs.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="field-label">Date de la session</label>
                <input
                  type="date"
                  value={hoursForm.date}
                  onChange={(e) => setHoursForm({ ...hoursForm, date: e.target.value })}
                  className="field"
                  required
                />
              </div>
              <div>
                <label className="field-label">Heures réellement passées en prospection</label>
                <input
                  type="number"
                  step="0.25"
                  min="0"
                  max="24"
                  value={hoursForm.heures}
                  onChange={(e) => setHoursForm({ ...hoursForm, heures: e.target.value })}
                  className="field"
                  placeholder="3.5"
                  required
                />
                <span className="mt-1 block text-[11px] text-slate-400">
                  Ex: 3.5 = 3 heures et 30 minutes de phoning dédié.
                </span>
              </div>
              <div>
                <label className="field-label">Notes / Blitz (facultatif)</label>
                <input
                  type="text"
                  value={hoursForm.notes}
                  onChange={(e) => setHoursForm({ ...hoursForm, notes: e.target.value })}
                  className="field"
                  placeholder="Blitz matin secteur BTP"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setOpenHoursModal(false)} className="btn-ghost">
                  Annuler
                </button>
                <button type="submit" className="btn-primary">
                  Enregistrer les heures
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* MODALE : Paramètres ROI & Coûts */}
      {openSettingsModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="card w-full max-w-md p-6 shadow-2xl animate-pop-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Paramètres Financiers & ROI</h3>
              <button onClick={() => setOpenSettingsModal(false)} className="icon-btn">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={submitSettings} className="mt-4 space-y-3.5">
              <div>
                <label className="field-label">Mois concerné</label>
                <input
                  type="month"
                  value={settingsForm.mois}
                  onChange={(e) => setSettingsForm({ ...settingsForm, mois: e.target.value })}
                  className="field"
                  required
                />
              </div>
              <div>
                <label className="field-label">Coût de la prospection du mois (€)</label>
                <input
                  type="number"
                  min="0"
                  value={settingsForm.coutProspection}
                  onChange={(e) => setSettingsForm({ ...settingsForm, coutProspection: e.target.value })}
                  className="field"
                  placeholder="4500"
                  required
                />
                <span className="mt-1 block text-[11px] text-slate-400">
                  Comprend masse salariale chargée, forfaits télécoms et outils CRM.
                </span>
              </div>
              <div>
                <label className="field-label">Panier moyen par client signé (€)</label>
                <input
                  type="number"
                  min="0"
                  value={settingsForm.panierMoyen}
                  onChange={(e) => setSettingsForm({ ...settingsForm, panierMoyen: e.target.value })}
                  className="field"
                  placeholder="2500"
                  required
                />
                <span className="mt-1 block text-[11px] text-slate-400">
                  Valeur moyenne d'un contrat ou d'une vente conclue avec un client particulier.
                </span>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setOpenSettingsModal(false)} className="btn-ghost">
                  Annuler
                </button>
                <button type="submit" className="btn-primary">
                  Mettre à jour le ROI
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* MODALE : Consigner un appel B2B rapide */}
      {openQuickCallModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="card max-h-[90vh] w-full max-w-lg overflow-y-auto p-6 shadow-2xl animate-pop-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Consigner un appel sortant B2C</h3>
              <button onClick={() => setOpenQuickCallModal(false)} className="icon-btn">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={submitQuickCall} className="mt-4 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="field-label">Commercial</label>
                  <select
                    value={callForm.commercial || commercialDefaut}
                    onChange={(e) => setCallForm({ ...callForm, commercial: e.target.value })}
                    className="field"
                  >
                    {commerciauxActifs.length === 0 ? <option value="">Aucun commercial (à créer dans Paramètres)</option> : null}
                  {commerciauxActifs.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="field-label">Date & Heure</label>
                  <input
                    type="datetime-local"
                    value={callForm.date}
                    onChange={(e) => setCallForm({ ...callForm, date: e.target.value })}
                    className="field"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="field-label">Client / Prospect *</label>
                  <input
                    type="text"
                    value={callForm.entreprise}
                    onChange={(e) => setCallForm({ ...callForm, entreprise: e.target.value })}
                    className="field"
                    placeholder="Nom et prénom du client"
                    required
                  />
                </div>
                <div>
                  <label className="field-label">Prospect / Contact</label>
                  <input
                    type="text"
                    value={callForm.contactNom}
                    onChange={(e) => setCallForm({ ...callForm, contactNom: e.target.value })}
                    className="field"
                    placeholder="Prénom Nom"
                  />
                </div>
              </div>

              <div>
                <label className="field-label">Téléphone (facultatif)</label>
                <input
                  type="text"
                  value={callForm.telephone}
                  onChange={(e) => setCallForm({ ...callForm, telephone: e.target.value })}
                  className="field"
                  placeholder="+33 ..."
                />
              </div>

              <div>
                <label className="field-label">Résultat de l'appel (liste fermée)</label>
                <select
                  value={callForm.resultat}
                  onChange={(e) => setCallForm({ ...callForm, resultat: e.target.value })}
                  className="field font-semibold"
                >
                  {RESULTATS_APPEL.map((r) => (
                    <option key={r.code} value={r.code}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="field-label">Durée conversation (secondes)</label>
                  <input
                    type="number"
                    min="0"
                    value={callForm.dureeSecondes}
                    onChange={(e) => setCallForm({ ...callForm, dureeSecondes: e.target.value })}
                    className="field"
                    placeholder="120"
                  />
                  <span className="text-[10px] text-slate-400">Ex: 120 = 2 min</span>
                </div>
                <div>
                  <label className="field-label">Temps traitement post-appel (s)</label>
                  <input
                    type="number"
                    min="0"
                    value={callForm.tempsTraitement}
                    onChange={(e) => setCallForm({ ...callForm, tempsTraitement: e.target.value })}
                    className="field"
                    placeholder="25"
                  />
                  <span className="text-[10px] text-slate-400">Saisie CRM, e-mail récap</span>
                </div>
              </div>

              {callForm.resultat === "contact_utile_refus" ? (
                <div>
                  <label className="field-label">Motif de refus</label>
                  <select
                    value={callForm.motifRefus}
                    onChange={(e) => setCallForm({ ...callForm, motifRefus: e.target.value })}
                    className="field"
                  >
                    <option value="">Sélectionner…</option>
                    {MOTIFS_REFUS.map((m) => (
                      <option key={m.code} value={m.code}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              {callForm.resultat === "contact_utile_rdv" ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 space-y-2">
                  <span className="font-bold text-emerald-800">Suivi du RDV pris</span>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="field-label">RDV honoré</label>
                      <select
                        value={callForm.rdvHonore}
                        onChange={(e) => setCallForm({ ...callForm, rdvHonore: e.target.value })}
                        className="field"
                      >
                        <option value="a_venir">À venir</option>
                        <option value="oui">Oui (Honoré)</option>
                        <option value="non">Non (No-show)</option>
                      </select>
                    </div>
                    <div>
                      <label className="field-label">Client signé</label>
                      <select
                        value={callForm.clientSigne}
                        onChange={(e) => setCallForm({ ...callForm, clientSigne: e.target.value })}
                        className="field"
                      >
                        <option value="non">Non</option>
                        <option value="oui">Oui</option>
                      </select>
                    </div>
                  </div>
                </div>
              ) : null}

              <div>
                <label className="field-label">Résumé / Objections</label>
                <textarea
                  value={callForm.resume}
                  onChange={(e) => setCallForm({ ...callForm, resume: e.target.value })}
                  className="field min-h-[60px]"
                  placeholder="Notes rapides..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setOpenQuickCallModal(false)} className="btn-ghost">
                  Annuler
                </button>
                <button type="submit" className="btn-primary">
                  Enregistrer l'appel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

// Composants de cartes pour les indicateurs

function IndicatorCard({
  title,
  value,
  detail,
  badgeLabel,
  badgeColor,
}: {
  title: string;
  value: string;
  detail: string;
  badgeLabel: string;
  badgeColor: string;
}) {
  return (
    <div className="card p-4 transition hover:shadow-md">
      <div className="flex items-center justify-between gap-1.5">
        <span className="truncate text-xs font-semibold text-slate-500">{title}</span>
        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset", badgeColor)}>
          {badgeLabel}
        </span>
      </div>
      <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500 truncate">{detail}</p>
    </div>
  );
}

function IndicatorComparisonCard({
  title,
  comp,
  helper,
}: {
  title: string;
  comp: IndicatorComparison | undefined;
  helper?: string;
}) {
  if (!comp) {
    return (
      <div className="card p-4">
        <span className="text-xs font-semibold text-slate-400">{title}</span>
        <p className="mt-2 text-2xl font-bold text-slate-300">—</p>
      </div>
    );
  }

  return (
    <div className="card p-4 transition hover:shadow-md">
      <div className="flex items-center justify-between gap-1.5">
        <span className="truncate text-xs font-semibold text-slate-600">{title}</span>
        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset", comp.statusColor)}>
          {comp.statusLabel}
        </span>
      </div>

      <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{comp.formatted}</p>

      <div className="mt-1 flex items-center justify-between gap-1 text-[11px]">
        <span className="text-slate-400">
          Repère : <strong className="text-slate-600">{comp.benchmarkLabel}</strong>
        </span>
        {comp.status === "au-dessus" ? (
          <span className="inline-flex items-center text-rose-600">
            <ArrowUpRight size={12} />
          </span>
        ) : comp.status === "sous" ? (
          <span className="inline-flex items-center text-amber-600">
            <ArrowDownRight size={12} />
          </span>
        ) : comp.status === "dans" ? (
          <span className="inline-flex items-center text-emerald-600">
            <CheckCircle2 size={12} />
          </span>
        ) : null}
      </div>

      {helper ? <p className="mt-1 truncate text-[11px] text-slate-400">{helper}</p> : null}
    </div>
  );
}
