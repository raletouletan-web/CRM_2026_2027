import { db } from "@/db";
import { calls, prospects } from "@/db/schema";
import { eq } from "drizzle-orm";
import { badRequest, json } from "@/lib/server";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

// PATCH /api/b2b/calls/:id — mise à jour ultérieure (ex: RDV honoré, client signé)
export async function PATCH(request: Request, ctx: RouteContext) {
  const { id: raw } = await ctx.params;
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) return badRequest("ID invalide");

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return badRequest("JSON invalide");
  }

  const existing = await db.select().from(calls).where(eq(calls.id, id)).limit(1);
  if (!existing[0]) return json({ error: "Appel introuvable" }, { status: 404 });

  const patch: Partial<typeof calls.$inferInsert> = {};

  if (body.rdvHonore !== undefined) patch.rdvHonore = String(body.rdvHonore);
  if (body.clientSigne !== undefined) patch.clientSigne = String(body.clientSigne);
  if (body.type !== undefined) patch.type = String(body.type);
  if (body.resultat !== undefined) patch.resultat = String(body.resultat);
  if (body.commercial !== undefined) patch.commercial = String(body.commercial);
  if (body.entreprise !== undefined) patch.entreprise = String(body.entreprise);
  if (body.telephone !== undefined) patch.telephone = String(body.telephone);
  if (body.resume !== undefined) patch.resume = String(body.resume);
  if (body.motifRefus !== undefined) patch.motifRefus = String(body.motifRefus);
  if (body.dureeSecondes !== undefined) {
    const s = Math.max(0, Number(body.dureeSecondes) || 0);
    patch.dureeSecondes = s;
    patch.duree = Math.round(s / 60);
  }
  if (body.tempsTraitement !== undefined) {
    patch.tempsTraitement = Math.max(0, Number(body.tempsTraitement) || 0);
  }

  const [updated] = await db
    .update(calls)
    .set(patch)
    .where(eq(calls.id, id))
    .returning();

  // Si le client est marqué signé "oui", synchroniser le prospect si lié
  if (body.clientSigne === "oui" && existing[0].prospectId) {
    await db
      .update(prospects)
      .set({ statut: "close", statutPaiement: "Payé", updatedAt: new Date() })
      .where(eq(prospects.id, existing[0].prospectId));
  }

  return json(updated);
}

// DELETE /api/b2b/calls/:id
export async function DELETE(_request: Request, ctx: RouteContext) {
  const { id: raw } = await ctx.params;
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) return badRequest("ID invalide");

  const deleted = await db.delete(calls).where(eq(calls.id, id)).returning({ id: calls.id });
  if (deleted.length === 0) return json({ error: "Appel introuvable" }, { status: 404 });
  return json({ deleted: deleted.length });
}
