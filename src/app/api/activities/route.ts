import { db } from "@/db";
import { calls, prospects } from "@/db/schema";
import { and, desc, eq, gte, isNotNull } from "drizzle-orm";
import { todayParis, toDateInputValue, dateFromInput } from "@/lib/crm";
import { json } from "@/lib/server";
import type { ActivitiesPayload } from "@/lib/types";

export const dynamic = "force-dynamic";

// GET /api/activities — rappels prévus aujourd'hui + historique des activités du jour
export async function GET() {
  const today = todayParis();

  // Rappels du jour (comparaison en date de Paris)
  const withRappel = await db
    .select()
    .from(prospects)
    .where(isNotNull(prospects.prochainRappel))
    .orderBy(desc(prospects.updatedAt))
    .limit(2000);
  const rappels = withRappel
    .filter((r) => toDateInputValue(r.prochainRappel) === today)
    .sort((a, b) => (a.heureRappel ?? "99:99").localeCompare(b.heureRappel ?? "99:99"));

  // Activités du jour (appels/notes enregistrés aujourd'hui, heure de Paris)
  const startOfDay = dateFromInput(today) ?? new Date(today + "T00:00:00Z");
  const rows = await db
    .select({
      id: calls.id,
      prospectId: calls.prospectId,
      commercial: calls.commercial,
      entreprise: calls.entreprise,
      telephone: calls.telephone,
      date: calls.date,
      type: calls.type,
      resultat: calls.resultat,
      dureeSecondes: calls.dureeSecondes,
      tempsTraitement: calls.tempsTraitement,
      duree: calls.duree,
      motifRefus: calls.motifRefus,
      rdvHonore: calls.rdvHonore,
      clientSigne: calls.clientSigne,
      resume: calls.resume,
      createdAt: calls.createdAt,
      prospectNom: prospects.nom,
      prospectPrenom: prospects.prenom,
    })
    .from(calls)
    .innerJoin(prospects, eq(calls.prospectId, prospects.id))
    .where(and(gte(calls.date, startOfDay)))
    .orderBy(desc(calls.date))
    .limit(200);

  const payload: ActivitiesPayload = { date: today, rappels, activites: rows };
  return json(payload);
}
