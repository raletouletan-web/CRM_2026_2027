import { db } from "@/db";
import { calls, financialSettings, prospectingHours } from "@/db/schema";
import { and, eq, gte, ilike, lte, type SQL } from "drizzle-orm";
import { json } from "@/lib/server";
import { calculateB2BIndicators, safeDiv } from "@/lib/b2b-analytics";

export const dynamic = "force-dynamic";

// GET /api/b2b/stats?vue=mois&mois=2026-11&commercial=tous
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const vue = searchParams.get("vue") ?? "mois"; // jour | mois | annee | tous
  const commercial = searchParams.get("commercial") ?? "tous";
  const now = new Date();
  const defMois = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const defJour = `${defMois}-${String(now.getDate()).padStart(2, "0")}`;
  const defAnnee = String(now.getFullYear());

  const jour = searchParams.get("jour") ?? defJour;
  const mois = searchParams.get("mois") ?? defMois;
  const annee = searchParams.get("annee") ?? defAnnee;

  // Seules les fiches de type « appel » comptent (ni notes, ni changements de statut, ni historique importé).
  const callConditions: SQL[] = [eq(calls.type, "appel")];
  const hoursConditions: SQL[] = [];

  if (commercial && commercial !== "tous") {
    callConditions.push(eq(calls.commercial, commercial));
    hoursConditions.push(eq(prospectingHours.commercial, commercial));
  }

  // Filtrage selon la période
  if (vue === "jour") {
    const dStart = new Date(`${jour}T00:00:00.000Z`);
    const dEnd = new Date(`${jour}T23:59:59.999Z`);
    callConditions.push(and(gte(calls.date, dStart), lte(calls.date, dEnd))!);
    hoursConditions.push(eq(prospectingHours.date, jour));
  } else if (vue === "mois") {
    const [y, m] = mois.split("-").map(Number);
    const dStart = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
    const dEnd = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
    callConditions.push(and(gte(calls.date, dStart), lte(calls.date, dEnd))!);
    hoursConditions.push(ilike(prospectingHours.date, `${mois}%`));
  } else if (vue === "annee") {
    const y = Number(annee);
    const dStart = new Date(Date.UTC(y, 0, 1, 0, 0, 0));
    const dEnd = new Date(Date.UTC(y, 11, 31, 23, 59, 59, 999));
    callConditions.push(and(gte(calls.date, dStart), lte(calls.date, dEnd))!);
    hoursConditions.push(ilike(prospectingHours.date, `${annee}%`));
  }

  // Requête des appels
  const callRows = await db
    .select()
    .from(calls)
    .where(callConditions.length ? and(...callConditions) : undefined);

  // Requête des heures de prospection déclarées
  const hoursRows = await db
    .select()
    .from(prospectingHours)
    .where(hoursConditions.length ? and(...hoursConditions) : undefined);

  const totalHeuresDeclarees = hoursRows.reduce((acc, h) => acc + (h.heures || 0), 0);

  // Requête des paramètres financiers pour le mois ciblé
  const activeMonth = vue === "jour" ? jour.slice(0, 7) : vue === "mois" ? mois : defMois;
  const settingsRows = await db
    .select()
    .from(financialSettings)
    .where(eq(financialSettings.mois, activeMonth))
    .limit(1);

  const coutProspection = settingsRows[0]?.coutProspection ?? 4500;
  const panierMoyen = settingsRows[0]?.panierMoyen ?? 2500;

  // Calculs B2B principaux (Règles exactes du prompt)
  const indicators = calculateB2BIndicators(
    callRows,
    totalHeuresDeclarees,
    coutProspection,
    panierMoyen,
  );

  if (!settingsRows[0]) {
    indicators.alertesDonnees.push(
      `Coût de prospection et panier moyen non renseignés pour ${activeMonth} : le ROI utilise des valeurs par défaut (${coutProspection} € et ${panierMoyen} €). À saisir dans Paramètres.`,
    );
  }

  // Ventilation par commercial (pour comparaison d'équipe)
  const commercialsMap = new Map<string, typeof callRows>();
  for (const c of callRows) {
    const rep = c.commercial || "Non assigné";
    if (!commercialsMap.has(rep)) commercialsMap.set(rep, []);
    commercialsMap.get(rep)!.push(c);
  }

  const breakdownCommerciaux = [...commercialsMap.entries()].map(([rep, repCalls]) => {
    const repHours = hoursRows
      .filter((h) => h.commercial === rep)
      .reduce((acc, h) => acc + (h.heures || 0), 0);
    const repIndicators = calculateB2BIndicators(
      repCalls,
      repHours,
      coutProspection / Math.max(1, commercialsMap.size),
      panierMoyen,
    );
    return {
      commercial: rep,
      totalAppels: repIndicators.appelsTotal,
      decroches: repIndicators.appelsDecroches,
      tauxDecroche: repIndicators.tauxDecroche.formatted,
      contactsUtiles: repIndicators.contactsUtiles,
      tentativesParHeure: repIndicators.tentativesParHeure.formatted,
      rdvPris: repIndicators.rdvPris,
      tauxHonorabilite: repIndicators.tauxHonorabilite.formatted,
      clientsSignes: repIndicators.clientsSignes,
      dmtFormatted: repIndicators.dmtFormatted,
      heuresProspection: repHours,
    };
  });

  // Si vue année : ventilation mois par mois
  let evolutionMensuelle: Array<{
    mois: string;
    totalAppels: number;
    decroches: number;
    tauxDecroche: number;
    contactsUtiles: number;
    rdvPris: number;
    clientsSignes: number;
  }> = [];

  if (vue === "annee") {
    const monthMap = new Map<string, typeof callRows>();
    for (let m = 1; m <= 12; m++) {
      const key = `${annee}-${String(m).padStart(2, "0")}`;
      monthMap.set(key, []);
    }
    for (const c of callRows) {
      const d = new Date(c.date);
      if (!isNaN(d.getTime())) {
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (monthMap.has(key)) monthMap.get(key)!.push(c);
      }
    }
    evolutionMensuelle = [...monthMap.entries()].map(([k, cList]) => {
      const dec = cList.filter((c) =>
        ["barrage", "mauvais_interlocuteur", "contact_utile_refus", "contact_utile_rappel", "contact_utile_rdv"].includes(c.resultat),
      ).length;
      const utiles = cList.filter((c) =>
        ["contact_utile_refus", "contact_utile_rappel", "contact_utile_rdv"].includes(c.resultat),
      ).length;
      const rdv = cList.filter((c) => c.resultat === "contact_utile_rdv").length;
      const sign = cList.filter((c) => c.clientSigne === "oui").length;
      return {
        mois: k,
        totalAppels: cList.length,
        decroches: dec,
        tauxDecroche: safeDiv(dec, cList.length),
        contactsUtiles: utiles,
        rdvPris: rdv,
        clientsSignes: sign,
      };
    });
  }

  return json({
    periode: {
      vue,
      jour,
      mois,
      annee,
      commercial,
      coutProspection,
      panierMoyen,
    },
    indicators,
    breakdownCommerciaux,
    evolutionMensuelle,
  });
}
