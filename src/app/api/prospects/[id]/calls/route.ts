import { db } from "@/db";
import { calls, prospects } from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { badRequest, getProspectOr404, json } from "@/lib/server";
import { getDefaultCommercialName } from "@/lib/commerciaux";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const CALL_TYPES = new Set(["appel", "note", "rdv", "email", "statut", "sms"]);

// GET /api/prospects/:id/calls
export async function GET(_request: Request, ctx: RouteContext) {
  const { id: raw } = await ctx.params;
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) return badRequest("ID invalide");
  const rows = await db
    .select()
    .from(calls)
    .where(eq(calls.prospectId, id))
    .orderBy(desc(calls.date))
    .limit(500);
  return json(rows);
}

// POST /api/prospects/:id/calls — enregistre un appel B2B détaillé et met à jour le prospect
export async function POST(request: Request, ctx: RouteContext) {
  const { id: raw } = await ctx.params;
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) return badRequest("ID invalide");
  const prospect = await getProspectOr404(id);
  if (!prospect) return json({ error: "Prospect introuvable" }, { status: 404 });

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    // body optionnel
  }
  const type = String(body.type ?? "appel");
  const resume = String(body.resume ?? "").trim();
  const commercial =
    String(body.commercial ?? "").trim() || prospect.commercialAssigne || (await getDefaultCommercialName());
  const entreprise = String(body.entreprise ?? prospect.entreprise ?? "").trim();
  const telephone = String(body.telephone ?? prospect.telephone ?? "").trim();
  const resultat = String(body.resultat ?? "pas_reponse").trim();
  const dureeSecondes = Math.max(0, Number(body.dureeSecondes ?? 0) || 0);
  const tempsTraitement = Math.max(0, Number(body.tempsTraitement ?? 0) || 0);
  const motifRefus = String(body.motifRefus ?? "").trim();
  const rdvHonore = String(body.rdvHonore ?? (resultat === "contact_utile_rdv" ? "a_venir" : "non")).trim();
  const clientSigne = String(body.clientSigne ?? "non").trim();

  // Durée en minutes pour rétro-compatibilité
  const duree = Math.round(dureeSecondes / 60) || Math.max(0, Number(body.duree ?? 0) || 0);
  const increment = body.increment !== false;

  const now = body.date ? new Date(String(body.date)) : new Date();
  const [call] = await db
    .insert(calls)
    .values({
      prospectId: id,
      commercial,
      entreprise,
      telephone,
      date: now,
      type: CALL_TYPES.has(type) ? type : "appel",
      resultat,
      dureeSecondes,
      tempsTraitement,
      duree,
      motifRefus,
      rdvHonore,
      clientSigne,
      resume: resume || (resultat === "contact_utile_rdv" ? "RDV pris" : "Appel effectué"),
    })
    .returning();

  // Auto-ajustement intelligent du statut prospect si un RDV est pris ou client signé
  let autoStatut: string | undefined = undefined;
  if (resultat === "contact_utile_rdv" && prospect.statut !== "close") {
    autoStatut = "rdv_prevu";
  } else if (clientSigne === "oui") {
    autoStatut = "close";
  }

  const [updated] = await db
    .update(prospects)
    .set({
      nbAppels: increment ? sql`${prospects.nbAppels} + 1` : prospects.nbAppels,
      dernierContact: type === "appel" ? now : prospect.dernierContact,
      updatedAt: now,
      ...(autoStatut ? { statut: autoStatut } : {}),
      ...(resume && type === "appel" ? { resumeAppel: resume } : {}),
    })
    .where(eq(prospects.id, id))
    .returning();

  return json({ call, prospect: updated }, { status: 201 });
}
