import { db } from "@/db";
import { calls, prospects } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { badRequest, cleanProspectPayload, getProspectOr404, json } from "@/lib/server";
import { parseOffreAmount } from "@/lib/crm";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

async function resolveId(ctx: RouteContext): Promise<number | null> {
  const { id } = await ctx.params;
  const n = Number(id);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// GET /api/prospects/:id — fiche complète avec l'historique des appels
export async function GET(_request: Request, ctx: RouteContext) {
  const id = await resolveId(ctx);
  if (!id) return badRequest("ID invalide");
  const prospect = await getProspectOr404(id);
  if (!prospect) return json({ error: "Prospect introuvable" }, { status: 404 });
  const history = await db
    .select()
    .from(calls)
    .where(eq(calls.prospectId, id))
    .orderBy(desc(calls.date))
    .limit(200);
  return json({ ...prospect, calls: history });
}

// PATCH /api/prospects/:id — mise à jour partielle (fiche client)
export async function PATCH(request: Request, ctx: RouteContext) {
  const id = await resolveId(ctx);
  if (!id) return badRequest("ID invalide");
  const existing = await getProspectOr404(id);
  if (!existing) return json({ error: "Prospect introuvable" }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return badRequest("JSON invalide");
  }
  const payload = cleanProspectPayload(body);

  // Règle CA : recalculée seulement si l'offre, le paiement ou le CA sont modifiés
  // (un simple changement de statut ne touche jamais au CA, importé ou saisi).
  // - « Payé » + offre chiffrée (« 1400 », « 3 x 350€ ») => CA = montant de l'offre ;
  // - sinon le CA envoyé est conservé (offre en texte libre) ;
  // - on repasse à 0 quand on quitte « Payé » sans préciser de CA.
  const merged = { ...existing, ...payload } as typeof existing;
  const touchesCa = "offreProposee" in body || "statutPaiement" in body || "caGenere" in body;
  const montantOffre = parseOffreAmount(merged.offreProposee);
  if (touchesCa && merged.statutPaiement === "Payé" && montantOffre !== null) {
    payload.caGenere = montantOffre;
  } else if (touchesCa && payload.caGenere !== undefined) {
    // valeur explicite conservée
  } else if (touchesCa && existing.statutPaiement === "Payé" && merged.statutPaiement !== "Payé") {
    payload.caGenere = 0;
  } else {
    delete payload.caGenere;
  }

  if (Object.keys(payload).length === 0) return json(existing);

  const [updated] = await db
    .update(prospects)
    .set({ ...payload, updatedAt: new Date() })
    .where(eq(prospects.id, id))
    .returning();

  return json(updated);
}

// DELETE /api/prospects/:id
export async function DELETE(_request: Request, ctx: RouteContext) {
  const id = await resolveId(ctx);
  if (!id) return badRequest("ID invalide");
  const deleted = await db.delete(prospects).where(eq(prospects.id, id)).returning({ id: prospects.id });
  if (deleted.length === 0) return json({ error: "Prospect introuvable" }, { status: 404 });
  return json({ deleted: deleted.length });
}
