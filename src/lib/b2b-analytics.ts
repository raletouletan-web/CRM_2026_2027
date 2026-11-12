// Moteur d'analyse de la performance commerciale — Prospection téléphonique B2C

export const RESULTATS_APPEL = [
  { code: "faux_numero", label: "Faux numéro / non attribué", isDecroche: false, isContactUtile: false, isRdv: false },
  { code: "pas_reponse", label: "Pas de réponse / occupé", isDecroche: false, isContactUtile: false, isRdv: false },
  { code: "repondeur", label: "Répondeur", isDecroche: false, isContactUtile: false, isRdv: false },
  { code: "barrage", label: "Barrage (standard / secrétaire)", isDecroche: true, isContactUtile: false, isRdv: false },
  { code: "mauvais_interlocuteur", label: "Mauvais interlocuteur", isDecroche: true, isContactUtile: false, isRdv: false },
  { code: "contact_utile_refus", label: "Contact utile – refus", isDecroche: true, isContactUtile: true, isRdv: false },
  { code: "contact_utile_rappel", label: "Contact utile – rappel à programmer", isDecroche: true, isContactUtile: true, isRdv: false },
  { code: "contact_utile_rdv", label: "Contact utile – RDV pris", isDecroche: true, isContactUtile: true, isRdv: true },
] as const;

export type ResultatAppelCode = (typeof RESULTATS_APPEL)[number]["code"];

export const MOTIFS_REFUS = [
  { code: "pas_budget", label: "Pas de budget" },
  { code: "deja_equipe", label: "Déjà équipé" },
  { code: "mauvais_moment", label: "Mauvais moment" },
  { code: "pas_bon_interlocuteur", label: "Pas le bon interlocuteur" },
  { code: "autre", label: "Autre" },
] as const;

export type MotifRefusCode = (typeof MOTIFS_REFUS)[number]["code"];

export type CallRecord = {
  id: number;
  prospectId: number;
  date: Date | string;
  commercial: string;
  entreprise: string;
  telephone: string;
  prospectNom?: string;
  prospectPrenom?: string;
  type: string;
  resultat: string;
  dureeSecondes: number;
  tempsTraitement: number;
  duree: number;
  motifRefus: string;
  rdvHonore: "a_venir" | "oui" | "non" | string;
  clientSigne: "oui" | "non" | string;
  resume: string;
};

export type BenchmarkStatus = "sous" | "dans" | "au-dessus" | "non_disponible";

export type IndicatorComparison = {
  value: number | null;
  formatted: string;
  benchmarkLabel: string;
  status: BenchmarkStatus;
  statusLabel: string;
  statusColor: string; // tailwind classes
  explanation: string;
};

export type HourlySlotStat = {
  heure: number; // 8 to 19
  label: string; // "09h - 10h"
  totalAppels: number;
  decroches: number;
  tauxDecroche: number; // 0..1
};

export type B2BPerformanceIndicators = {
  // 1. Activité & productivité
  appelsTotal: number;
  appelsDecroches: number;
  heuresProspection: number;
  tentativesParHeure: IndicatorComparison;
  fauxNumeros: number;
  tauxFauxNumeros: IndicatorComparison;
  dmtSecondes: number;
  dmtFormatted: string;

  // 2. Joignabilité
  tauxDecroche: IndicatorComparison;
  contactsUtiles: number;
  tauxContactsUtiles: IndicatorComparison;
  tentativesAvantContact: IndicatorComparison;
  meilleurCreneau: {
    heure: number | null;
    label: string;
    tauxDecroche: number;
    volumeAppels: number;
  };
  creneauxHoraires: HourlySlotStat[];

  // 3. Engagement & discours
  dureeMoyenneDecrocheSecondes: number;
  dureeMoyenneDecrocheFormatted: string;
  partMoins30s: IndicatorComparison;
  partPlus2min: IndicatorComparison;
  motifRefusPrincipal: { code: string; label: string; count: number; pct: number } | null;
  repartitionMotifsRefus: Array<{ code: string; label: string; count: number; pct: number }>;

  // 4. Conversion & performance
  rdvPris: number;
  tauxRdvParAppels: IndicatorComparison;
  tauxRdvParContactsUtiles: IndicatorComparison;
  contactsUtilesParRdv: IndicatorComparison;
  rdvEchus: number;
  rdvHonores: number;
  rdvNonHonores: number;
  rdvAVenir: number;
  tauxHonorabilite: IndicatorComparison;
  tauxNoShow: IndicatorComparison;
  clientsSignes: number;
  conversionClientsParRdvHonore: IndicatorComparison;
  conversionGlobale: IndicatorComparison;
  panierMoyen: number;
  coutProspection: number;
  chiffreAffairesGenere: number;
  roiPct: IndicatorComparison;

  // Diagnostic & Recommandations
  diagnostic: {
    pointsForts: string[];
    pointsAttention: string[];
    causeProbable: string;
  };
  actionsRecommandees: Array<{
    priorite: number;
    titre: string;
    impact: "Impact Fort" | "Impact Moyen" | "Impact Rapide";
    description: string;
  }>;
  alertesDonnees: string[];
};

export function isFauxNumero(res: string): boolean {
  return res === "faux_numero";
}

export function isDecroche(res: string): boolean {
  return [
    "barrage",
    "mauvais_interlocuteur",
    "contact_utile_refus",
    "contact_utile_rappel",
    "contact_utile_rdv",
  ].includes(res);
}

export function isContactUtile(res: string): boolean {
  return [
    "contact_utile_refus",
    "contact_utile_rappel",
    "contact_utile_rdv",
  ].includes(res);
}

export function isRdvPris(res: string): boolean {
  return res === "contact_utile_rdv";
}

export function formatSeconds(sec: number): string {
  if (!sec || isNaN(sec)) return "0s";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  if (m === 0) return `${s}s`;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

export function safeDiv(num: number, den: number): number {
  if (!den || den === 0 || isNaN(num) || isNaN(den)) return 0;
  return num / den;
}

/**
 * Moteur de calcul complet : prend une liste d'appels, les heures de prospection déclarées
 * et les paramètres financiers du mois.
 */
export function calculateB2BIndicators(
  calls: CallRecord[],
  heuresProspection: number,
  coutProspection: number,
  panierMoyen: number,
): B2BPerformanceIndicators {
  const alertesDonnees: string[] = [];

  const appelsTotal = calls.length;
  if (appelsTotal < 30) {
    alertesDonnees.push(
      `Échantillon restreint (${appelsTotal} appel${appelsTotal > 1 ? "s" : ""}) : les ratios sont à interpréter avec prudence (repère de fiabilité statistique B2C ≥ 30 appels).`,
    );
  }
  if (heuresProspection <= 0) {
    alertesDonnees.push(
      "Heures de prospection non renseignées ou nulles : cadence horaire estimée sur une base par défaut (3,5 h/jour).",
    );
  }

  const effectiveHours = heuresProspection > 0 ? heuresProspection : Math.max(1, Math.round(appelsTotal / 12));

  let fauxNumeros = 0;
  let sansResultat = 0;
  let decroches = 0;
  let contactsUtiles = 0;
  let rdvPris = 0;

  let totalDureeDecroches = 0;
  let totalTempsTraitementDecroches = 0;
  let decrochesMoins30s = 0;
  let decrochesPlus2min = 0;

  const refusCounts: Record<string, number> = {
    pas_budget: 0,
    deja_equipe: 0,
    mauvais_moment: 0,
    pas_bon_interlocuteur: 0,
    autre: 0,
  };

  let rdvHonores = 0;
  let rdvNonHonores = 0;
  let rdvAVenir = 0;
  let clientsSignes = 0;

  // Créneaux horaires heure par heure (8h à 19h)
  const creneauxMap = new Map<number, { total: number; decroches: number }>();
  for (let h = 8; h <= 19; h++) {
    creneauxMap.set(h, { total: 0, decroches: 0 });
  }

  for (const c of calls) {
    const res = c.resultat;
    const isFaux = isFauxNumero(res);
    const isDec = isDecroche(res);
    const isUtile = isContactUtile(res);
    const isRdv = isRdvPris(res);

    if (!res) sansResultat++;
    if (isFaux) fauxNumeros++;
    if (isDec) decroches++;
    if (isUtile) contactsUtiles++;
    if (isRdv) rdvPris++;

    const dur = c.dureeSecondes || (c.duree ? c.duree * 60 : 0);
    const post = c.tempsTraitement || 0;

    if (isDec) {
      totalDureeDecroches += dur;
      totalTempsTraitementDecroches += post;
      if (dur < 30) decrochesMoins30s++;
      if (dur >= 120) decrochesPlus2min++;
    }

    if (res === "contact_utile_refus" || c.motifRefus) {
      const motif = c.motifRefus || "autre";
      refusCounts[motif] = (refusCounts[motif] ?? 0) + 1;
    }

    if (isRdv) {
      const honore = c.rdvHonore || "a_venir";
      if (honore === "oui") rdvHonores++;
      else if (honore === "non") rdvNonHonores++;
      else rdvAVenir++;
    }

    if (c.clientSigne === "oui") {
      clientsSignes++;
    }

    // Heure d'appel
    const d = new Date(c.date);
    if (!isNaN(d.getTime())) {
      // fuseau heure locale/Europe
      const h = d.getHours();
      if (creneauxMap.has(h)) {
        const cur = creneauxMap.get(h)!;
        cur.total++;
        if (isDec) cur.decroches++;
      }
    }
  }

  if (sansResultat > 0) {
    alertesDonnees.push(
      `${sansResultat} appel${sansResultat > 1 ? "s" : ""} sans résultat renseigné (ex. bouton « +1 ») : compté${sansResultat > 1 ? "s" : ""} dans le volume d'appels, mais dans aucune catégorie (décroché, contact utile, RDV). À compléter dans la fiche d'appel.`,
    );
  }

  // Créneaux horaires
  const creneauxHoraires: HourlySlotStat[] = [];
  let meilleurH: number | null = null;
  let meilleurTaux = -1;
  let meilleurVolume = 0;

  for (let h = 8; h <= 19; h++) {
    const data = creneauxMap.get(h) ?? { total: 0, decroches: 0 };
    const taux = safeDiv(data.decroches, data.total);
    creneauxHoraires.push({
      heure: h,
      label: `${String(h).padStart(2, "0")}h - ${String(h + 1).padStart(2, "0")}h`,
      totalAppels: data.total,
      decroches: data.decroches,
      tauxDecroche: taux,
    });
    // Seuil de 3 appels minimum pour élire le meilleur créneau
    if (data.total >= 3 && taux > meilleurTaux) {
      meilleurTaux = taux;
      meilleurH = h;
      meilleurVolume = data.total;
    }
  }

  // 1. Activité & productivité
  const tentativesParHeureVal = safeDiv(appelsTotal, effectiveHours);
  const statusCadence: BenchmarkStatus =
    tentativesParHeureVal < 9 ? "sous" : tentativesParHeureVal > 17 ? "au-dessus" : "dans";

  const tauxFauxNumVal = safeDiv(fauxNumeros, appelsTotal);
  const statusFauxNum: BenchmarkStatus =
    tauxFauxNumVal > 0.05 ? "au-dessus" : "dans"; // alerte si > 5% faux numéros

  const dmtSecondes = safeDiv(totalDureeDecroches + totalTempsTraitementDecroches, decroches);

  // 2. Joignabilité
  const tauxDecrocheVal = safeDiv(decroches, appelsTotal);
  const statusDecroche: BenchmarkStatus =
    tauxDecrocheVal < 0.1 ? "sous" : tauxDecrocheVal > 0.4 ? "au-dessus" : "dans";

  const tauxContactsUtilesVal = safeDiv(contactsUtiles, appelsTotal);
  const tentativesAvantContactVal = safeDiv(appelsTotal, contactsUtiles);
  const statusTentativesContact: BenchmarkStatus =
    tentativesAvantContactVal === 0
      ? "non_disponible"
      : tentativesAvantContactVal < 6
        ? "sous" // très bon
        : tentativesAvantContactVal > 11
          ? "au-dessus" // difficile à joindre
          : "dans";

  // 3. Engagement & discours
  const dureeMoyDecrocheSec = safeDiv(totalDureeDecroches, decroches);
  const partMoins30sVal = safeDiv(decrochesMoins30s, decroches);
  const statusMoins30s: BenchmarkStatus = partMoins30sVal > 0.35 ? "au-dessus" : "dans";

  const partPlus2minVal = safeDiv(decrochesPlus2min, decroches);
  const statusPlus2min: BenchmarkStatus = partPlus2minVal < 0.15 ? "sous" : "dans";

  const totalRefus = Object.values(refusCounts).reduce((a, b) => a + b, 0);
  const repartitionMotifsRefus = MOTIFS_REFUS.map((m) => {
    const c = refusCounts[m.code] ?? 0;
    return {
      code: m.code,
      label: m.label,
      count: c,
      pct: safeDiv(c, totalRefus),
    };
  }).sort((a, b) => b.count - a.count);

  const motifRefusPrincipal =
    repartitionMotifsRefus.length > 0 && repartitionMotifsRefus[0].count > 0
      ? repartitionMotifsRefus[0]
      : null;

  // 4. Conversion & performance
  const rdvEchus = rdvHonores + rdvNonHonores;
  if (rdvAVenir > 0) {
    alertesDonnees.push(
      `${rdvAVenir} RDV pris ${rdvAVenir > 1 ? "sont encore à venir et ont été exclus" : "est encore à venir et a été exclu"} du calcul du taux d'honorabilité et de no-show pour éviter de fausser la conversion.`,
    );
  }

  const tauxRdvAppelsVal = safeDiv(rdvPris, appelsTotal);
  const tauxRdvContactsUtilesVal = safeDiv(rdvPris, contactsUtiles);
  const contactsUtilesParRdvVal = safeDiv(contactsUtiles, rdvPris);
  const statusContactsParRdv: BenchmarkStatus =
    contactsUtilesParRdvVal === 0
      ? "non_disponible"
      : contactsUtilesParRdvVal < 4
        ? "sous" // exceptionnel
        : contactsUtilesParRdvVal > 10
          ? "au-dessus" // besoin de trop de contacts utiles
          : "dans";

  const tauxHonorabiliteVal = safeDiv(rdvHonores, rdvEchus);
  const tauxNoShowVal = rdvEchus > 0 ? 1 - tauxHonorabiliteVal : 0;
  const statusHonorabilite: BenchmarkStatus =
    rdvEchus === 0 ? "non_disponible" : tauxHonorabiliteVal < 0.7 ? "sous" : "dans";

  const convClientsParRdvHonoreVal = safeDiv(clientsSignes, rdvHonores);
  const convGlobaleVal = safeDiv(clientsSignes, appelsTotal);

  const chiffreAffaires = clientsSignes * panierMoyen;
  const roiVal = coutProspection > 0 ? (chiffreAffaires - coutProspection) / coutProspection : 0;

  // Diagnostic automatique
  const pointsForts: string[] = [];
  const pointsAttention: string[] = [];
  let causeProbable = "";

  if (tauxDecrocheVal >= 0.2) {
    pointsForts.push(`Taux de décroché élevé (${(tauxDecrocheVal * 100).toFixed(1)}%), joignabilité supérieure à la médiane marché.`);
  } else if (tauxDecrocheVal < 0.12 && appelsTotal >= 20) {
    pointsAttention.push(`Faible joignabilité (${(tauxDecrocheVal * 100).toFixed(1)}% vs 15%-25% marché). Fichier ou créneaux à optimiser.`);
    causeProbable += "Fichier de prospection usé ou créneaux d'appel inadaptés. ";
  }

  if (tentativesParHeureVal >= 9 && tentativesParHeureVal <= 17) {
    pointsForts.push(`Cadence de prospection équilibrée (${tentativesParHeureVal.toFixed(1)} appels/h), en plein dans le repère B2C.`);
  } else if (tentativesParHeureVal > 17) {
    pointsAttention.push(`Cadence très élevée (${tentativesParHeureVal.toFixed(1)} appels/h) : risque de sous-qualification post-appel.`);
    causeProbable += "Prospection trop rapide sans préparation suffisante des fiches. ";
  } else if (tentativesParHeureVal < 9 && effectiveHours > 0) {
    pointsAttention.push(`Cadence faible (${tentativesParHeureVal.toFixed(1)} appels/h vs repère 9-17/h). Productivité en retrait.`);
  }

  if (tauxFauxNumVal > 0.05) {
    pointsAttention.push(`Taux de faux numéros anormalement haut (${(tauxFauxNumVal * 100).toFixed(1)}% > 5%). Fichier à nettoyer d'urgence.`);
    causeProbable += "Qualité de base de données dégradée (numéros obsolètes ou mal sourcés). ";
  }

  if (partMoins30sVal > 0.35 && decroches >= 5) {
    pointsAttention.push(`35%+ des appels décrochés durent moins de 30 secondes (${(partMoins30sVal * 100).toFixed(1)}%). Rejet d'accroche.`);
    causeProbable += "Accroche commerciale frontale provoquant un rejet immédiat par le prospect. ";
  } else if (partPlus2minVal >= 0.25) {
    pointsForts.push(`Forte capacité d'engagement : ${(partPlus2minVal * 100).toFixed(1)}% des décrochés dépassent 2 minutes de conversation.`);
  }

  if (contactsUtilesParRdvVal > 0 && contactsUtilesParRdvVal <= 8) {
    pointsForts.push(`Excellente transformation des prospects : 1 RDV obtenu pour ${contactsUtilesParRdvVal.toFixed(1)} contacts utiles (repère 4-10).`);
  } else if (contactsUtilesParRdvVal > 10) {
    pointsAttention.push(`Transformation en RDV faible : il faut ${contactsUtilesParRdvVal.toFixed(1)} prospects joints pour caler un RDV (repère 4-10).`);
    causeProbable += "Discours de qualification non percutant ou proposition de valeur pas assez incitative lors du call. ";
  }

  if (rdvEchus >= 3 && tauxHonorabiliteVal < 0.7) {
    pointsAttention.push(`Taux de no-show élevé (${(tauxNoShowVal * 100).toFixed(1)}%). Fuite de valeur sur les RDV programmés.`);
    causeProbable += "Manque de confirmation par e-mail/SMS ou délais de RDV trop éloignés (+5 jours ouvrés). ";
  }

  if (pointsForts.length === 0) {
    pointsForts.push("Collecte rigoureuse des résultats d'appels démarrée sur l'équipe commerciale.");
  }
  if (!causeProbable) {
    causeProbable = "Performance globale équilibrée et conforme aux repères B2C.";
  }

  // 3 Actions concrètes recommandées
  const actionsRecommandees = [
    {
      priorite: 1,
      titre:
        tauxFauxNumVal > 0.05
          ? "Nettoyer et enrichir la base de prospection"
          : partMoins30sVal > 0.35
            ? "Refondre l'accroche des 15 premières secondes"
            : "Concentrer les sessions sur les créneaux à fort décroché",
      impact: "Impact Fort" as const,
      description:
        tauxFauxNumVal > 0.05
          ? "Supprimer les numéros non attribués et passer les listes au filtre d'un outil d'enrichissement (Dropcontact / Kaspr) avant toute session."
          : partMoins30sVal > 0.35
            ? "Passer d'une présentation descendante à une question d'ouverture orientée douleur métier (ex: 'Raison de mon appel : comment gérez-vous aujourd'hui...?')."
            : `Focaliser les blitz d'appels sur le créneau identifié (${meilleurH ? `${meilleurH}h-${meilleurH + 1}h` : "9h-11h et 14h-16h"}) pour maximiser le taux de décroché.`,
    },
    {
      priorite: 2,
      titre:
        contactsUtilesParRdvVal > 10
          ? "Affûter le pitch de closing du RDV"
          : "Systématiser la confirmation des RDV sous 15 minutes",
      impact: "Impact Moyen" as const,
      description:
        contactsUtilesParRdvVal > 10
          ? "Rendre la promesse de valeur du RDV concrète ('audit de 20 min', 'comparatif chiffré') plutôt que vague ('démo de notre outil')."
          : "Envoyer immédiatement une invitation d'agenda accompagnée d'une synthèse courte et d'un SMS de rappel H-2h pour verrouiller l'honorabilité.",
    },
    {
      priorite: 3,
      titre: "Établir une routine de traitement post-appel calibrée (< 60s)",
      impact: "Impact Rapide" as const,
      description:
        "Utiliser les champs normalisés du CRM pour consigner l'objection et le statut en moins de 45 secondes et maintenir la cadence entre 10 et 14 appels/h.",
    },
  ];

  return {
    appelsTotal,
    appelsDecroches: decroches,
    heuresProspection: effectiveHours,
    tentativesParHeure: makeComparison(
      tentativesParHeureVal,
      `${tentativesParHeureVal.toFixed(1)} / h`,
      "9 à 17 / h",
      statusCadence,
      "Cadence d'appels par heure de prospection dédiée.",
    ),
    fauxNumeros,
    tauxFauxNumeros: makeComparison(
      tauxFauxNumVal,
      `${(tauxFauxNumVal * 100).toFixed(1)}%`,
      "< 5%",
      statusFauxNum,
      "Qualité du fichier de prospection (taux de numéros invalides).",
    ),
    dmtSecondes: Math.round(dmtSecondes),
    dmtFormatted: formatSeconds(dmtSecondes),

    tauxDecroche: makeComparison(
      tauxDecrocheVal,
      `${(tauxDecrocheVal * 100).toFixed(1)}%`,
      "10% à 40%",
      statusDecroche,
      "Proportion d'appels où un humain a répondu (standard ou interlocuteur).",
    ),
    contactsUtiles,
    tauxContactsUtiles: makeComparison(
      tauxContactsUtilesVal,
      `${(tauxContactsUtilesVal * 100).toFixed(1)}%`,
      "5% à 15%",
      tauxContactsUtilesVal < 0.05 ? "sous" : tauxContactsUtilesVal > 0.2 ? "au-dessus" : "dans",
      "Proportion d'appels ayant abouti à un échange direct avec le prospect.",
    ),
    tentativesAvantContact: makeComparison(
      tentativesAvantContactVal,
      tentativesAvantContactVal > 0 ? `${tentativesAvantContactVal.toFixed(1)} appels` : "—",
      "~8 appels",
      statusTentativesContact,
      "Nombre d'appels nécessaires en moyenne pour joindre directement un prospect en B2C.",
    ),
    meilleurCreneau: {
      heure: meilleurH,
      label: meilleurH !== null ? `${String(meilleurH).padStart(2, "0")}h - ${String(meilleurH + 1).padStart(2, "0")}h` : "9h - 11h (repère B2C)",
      tauxDecroche: meilleurTaux > 0 ? meilleurTaux : 0.25,
      volumeAppels: meilleurVolume,
    },
    creneauxHoraires,

    dureeMoyenneDecrocheSecondes: Math.round(dureeMoyDecrocheSec),
    dureeMoyenneDecrocheFormatted: formatSeconds(dureeMoyDecrocheSec),
    partMoins30s: makeComparison(
      partMoins30sVal,
      `${(partMoins30sVal * 100).toFixed(1)}%`,
      "< 35%",
      statusMoins30s,
      "Échanges décrochés interrompus sous 30s (rejet immédiat de l'accroche).",
    ),
    partPlus2min: makeComparison(
      partPlus2minVal,
      `${(partPlus2minVal * 100).toFixed(1)}%`,
      "> 20%",
      statusPlus2min,
      "Échanges décrochés de plus de 2 minutes (intérêt et qualification réelle).",
    ),
    motifRefusPrincipal,
    repartitionMotifsRefus,

    rdvPris,
    tauxRdvParAppels: makeComparison(
      tauxRdvAppelsVal,
      `${(tauxRdvAppelsVal * 100).toFixed(1)}%`,
      "1% à 3%",
      tauxRdvAppelsVal < 0.01 ? "sous" : tauxRdvAppelsVal > 0.04 ? "au-dessus" : "dans",
      "RDV obtenus rapportés au volume global d'appels.",
    ),
    tauxRdvParContactsUtiles: makeComparison(
      tauxRdvContactsUtilesVal,
      `${(tauxRdvContactsUtilesVal * 100).toFixed(1)}%`,
      "10% à 25%",
      tauxRdvContactsUtilesVal < 0.1 ? "sous" : tauxRdvContactsUtilesVal > 0.3 ? "au-dessus" : "dans",
      "Taux de conversion d'un prospect joint en rendez-vous.",
    ),
    contactsUtilesParRdv: makeComparison(
      contactsUtilesParRdvVal,
      contactsUtilesParRdvVal > 0 ? `${contactsUtilesParRdvVal.toFixed(1)} contacts` : "—",
      "4 à 10 contacts",
      statusContactsParRdv,
      "Nombre de prospects joints nécessaires pour obtenir un RDV.",
    ),
    rdvEchus,
    rdvHonores,
    rdvNonHonores,
    rdvAVenir,
    tauxHonorabilite: makeComparison(
      rdvEchus > 0 ? tauxHonorabiliteVal : null,
      rdvEchus > 0 ? `${(tauxHonorabiliteVal * 100).toFixed(1)}%` : "—",
      "70% à 85%",
      statusHonorabilite,
      "Proportion de RDV échus effectivement honorés (hors RDV à venir).",
    ),
    tauxNoShow: makeComparison(
      rdvEchus > 0 ? tauxNoShowVal : null,
      rdvEchus > 0 ? `${(tauxNoShowVal * 100).toFixed(1)}%` : "—",
      "< 25%",
      rdvEchus === 0 ? "non_disponible" : tauxNoShowVal > 0.3 ? "au-dessus" : "dans",
      "Proportion de rendez-vous manqués / annulés au dernier moment.",
    ),
    clientsSignes,
    conversionClientsParRdvHonore: makeComparison(
      rdvHonores > 0 ? convClientsParRdvHonoreVal : null,
      rdvHonores > 0 ? `${(convClientsParRdvHonoreVal * 100).toFixed(1)}%` : "—",
      "20% à 35%",
      rdvHonores === 0 ? "non_disponible" : convClientsParRdvHonoreVal < 0.2 ? "sous" : "dans",
      "Taux de signature des prospects ayant honoré leur RDV.",
    ),
    conversionGlobale: makeComparison(
      convGlobaleVal,
      `${(convGlobaleVal * 100).toFixed(2)}%`,
      "0.3% à 1.5%",
      convGlobaleVal < 0.003 ? "sous" : "dans",
      "Ventes signées rapportées à l'ensemble des tentatives d'appels.",
    ),
    panierMoyen,
    coutProspection,
    chiffreAffairesGenere: chiffreAffaires,
    roiPct: makeComparison(
      coutProspection > 0 ? roiVal : null,
      coutProspection > 0 ? `${(roiVal * 100).toFixed(0)}%` : "—",
      "> 50%",
      coutProspection === 0 ? "non_disponible" : roiVal < 0 ? "sous" : roiVal > 1 ? "au-dessus" : "dans",
      "Retour sur investissement : (CA généré − Coût) ÷ Coût.",
    ),

    diagnostic: {
      pointsForts,
      pointsAttention,
      causeProbable,
    },
    actionsRecommandees,
    alertesDonnees,
  };
}

function makeComparison(
  val: number | null,
  formatted: string,
  benchmarkLabel: string,
  status: BenchmarkStatus,
  explanation: string,
): IndicatorComparison {
  let statusLabel = "Dans repère";
  let statusColor = "bg-emerald-50 text-emerald-700 ring-emerald-600/20";
  if (status === "sous") {
    statusLabel = "Sous repère";
    statusColor = "bg-amber-50 text-amber-700 ring-amber-600/25";
  } else if (status === "au-dessus") {
    statusLabel = "Au-dessus repère";
    statusColor = "bg-rose-50 text-rose-700 ring-rose-600/25";
  } else if (status === "non_disponible") {
    statusLabel = "Non disponible";
    statusColor = "bg-slate-100 text-slate-500 ring-slate-400/20";
  }

  return {
    value: val,
    formatted,
    benchmarkLabel,
    status,
    statusLabel,
    statusColor,
    explanation,
  };
}
