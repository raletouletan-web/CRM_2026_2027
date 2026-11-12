import { db } from "@/db";
import { calls, prospects } from "@/db/schema";
import { and, desc, eq, gte, ilike, lte, or, type SQL } from "drizzle-orm";
import { badRequest, json } from "@/lib/server";
import { getDefaultCommercialName } from "@/lib/commerciaux";

export const dynamic = "force-dynamic";

// GET /api/b2b/calls — liste des appels avec filtres et jointure prospect
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const commercial = searchParams.get("commercial") ?? "";
  const dateDebut = searchParams.get("dateDebut") ?? "";
  const dateFin = searchParams.get("dateFin") ?? "";
  const mois = searchParams.get("mois") ?? ""; // YYYY-MM
  const jour = searchParams.get("jour") ?? ""; // YYYY-MM-DD
  const resultat = searchParams.get("resultat") ?? "";
  const q = (searchParams.get("q") ?? "").trim();
  const limit = Math.min(2000, Math.max(1, Number(searchParams.get("limit") ?? 500)));

  // Journal « 1 ligne = 1 appel » : uniquement les fiches de type « appel ».
  const conditions: SQL[] = [eq(calls.type, "appel")];

  if (commercial && commercial !== "tous") {
    conditions.push(eq(calls.commercial, commercial));
  }
  if (resultat && resultat !== "tous") {
    conditions.push(eq(calls.resultat, resultat));
  }
  if (jour) {
    const dStart = new Date(`${jour}T00:00:00.000Z`);
    const dEnd = new Date(`${jour}T23:59:59.999Z`);
    conditions.push(and(gte(calls.date, dStart), lte(calls.date, dEnd))!);
  } else if (mois) {
    const [y, m] = mois.split("-").map(Number);
    const dStart = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
    const dEnd = new Date(Date.UTC(y, m, 0, 23, 59, 59));
    conditions.push(and(gte(calls.date, dStart), lte(calls.date, dEnd))!);
  } else {
    if (dateDebut) conditions.push(gte(calls.date, new Date(dateDebut)));
    if (dateFin) conditions.push(lte(calls.date, new Date(dateFin)));
  }

  if (q) {
    const like = `%${q}%`;
    conditions.push(
      or(
        ilike(calls.entreprise, like),
        ilike(calls.telephone, like),
        ilike(calls.commercial, like),
        ilike(calls.resume, like),
        ilike(prospects.nom, like),
        ilike(prospects.prenom, like),
      )!,
    );
  }

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
    .leftJoin(prospects, eq(calls.prospectId, prospects.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(calls.date))
    .limit(limit);

  return json(rows);
}

// POST /api/b2b/calls — consigner un appel de prospection B2B
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return badRequest("JSON invalide");
  }

  let prospectId = Number(body.prospectId ?? 0);
  const commercial = String(body.commercial ?? "").trim() || (await getDefaultCommercialName());
  const entreprise = String(body.entreprise ?? "").trim();
  const telephone = String(body.telephone ?? "").trim();
  const contactNom = String(body.contactNom ?? body.nom ?? "").trim();
  const contactPrenom = String(body.contactPrenom ?? body.prenom ?? "").trim();

  // Si aucun prospect n'est lié, en créer un automatiquement pour préserver l'historique CRM
  if (!prospectId || prospectId <= 0) {
    const [newProspect] = await db
      .insert(prospects)
      .values({
        nom: contactNom || entreprise || "Prospect B2C",
        prenom: contactPrenom,
        telephone,
        entreprise,
        commercialAssigne: commercial,
        source: "Prospection sortante",
        statut: body.resultat === "contact_utile_rdv" ? "rdv_prevu" : "appele",
        nbAppels: 1,
      })
      .returning({ id: prospects.id });
    prospectId = newProspect.id;
  }

  const date = body.date ? new Date(String(body.date)) : new Date();
  const resultat = String(body.resultat ?? "pas_reponse").trim();
  const dureeSecondes = Math.max(0, Number(body.dureeSecondes ?? 0) || 0);
  const tempsTraitement = Math.max(0, Number(body.tempsTraitement ?? 0) || 0);
  const motifRefus = String(body.motifRefus ?? "").trim();
  const rdvHonore = String(body.rdvHonore ?? (resultat === "contact_utile_rdv" ? "a_venir" : "non")).trim();
  const clientSigne = String(body.clientSigne ?? "non").trim();
  const resume = String(body.resume ?? "").trim();

  const [call] = await db
    .insert(calls)
    .values({
      prospectId,
      commercial,
      entreprise,
      telephone,
      date,
      type: "appel",
      resultat,
      dureeSecondes,
      tempsTraitement,
      duree: Math.round(dureeSecondes / 60),
      motifRefus,
      rdvHonore,
      clientSigne,
      resume: resume || (resultat === "contact_utile_rdv" ? "RDV pris" : "Appel sortant B2C"),
    })
    .returning();

  return json(call, { status: 201 });
}
