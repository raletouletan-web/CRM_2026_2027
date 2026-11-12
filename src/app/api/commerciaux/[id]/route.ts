import { db } from "@/db";
import { commerciaux } from "@/db/schema";
import { eq } from "drizzle-orm";
import { badRequest, json } from "@/lib/server";
import {
  cleanName,
  listCommerciauxWithStats,
  promoteDefault,
  renameEverywhere,
  sameName,
} from "@/lib/commerciaux";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

async function resolveId(ctx: RouteContext): Promise<number | null> {
  const { id } = await ctx.params;
  const n = Number(id);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// PATCH /api/commerciaux/:id — { nom?, actif?, parDefaut? }
// Renommer met à jour toutes les fiches, tous les échanges et toutes les heures à ce nom.
export async function PATCH(request: Request, ctx: RouteContext) {
  const id = await resolveId(ctx);
  if (!id) return badRequest("ID invalide");

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return badRequest("JSON invalide");
  }

  const all = await db.select().from(commerciaux);
  const row = all.find((c) => c.id === id);
  if (!row) return json({ error: "Commercial introuvable" }, { status: 404 });

  const nom = body.nom !== undefined ? cleanName(body.nom) : undefined;
  if (nom !== undefined) {
    if (!nom) return badRequest("Le nom du commercial est obligatoire.");
    if (nom.length > 60) return badRequest("Le nom ne peut pas dépasser 60 caractères.");
    if (all.some((c) => c.id !== id && sameName(c.nom, nom))) {
      return json(
        {
          error: `« ${nom} » existe déjà. Pour fusionner deux commerciaux, supprimez l'un en réattribuant ses données à l'autre.`,
        },
        { status: 409 },
      );
    }
  }
  const actif = typeof body.actif === "boolean" ? body.actif : undefined;
  const makeDefault = body.parDefaut === true;

  await db.transaction(async (tx) => {
    if (nom !== undefined && nom !== row.nom) {
      await tx.update(commerciaux).set({ nom }).where(eq(commerciaux.id, id));
      await renameEverywhere(tx, row.nom, nom);
    }
    if (actif !== undefined && actif !== row.actif) {
      await tx
        .update(commerciaux)
        .set(actif ? { actif: true } : { actif: false, parDefaut: false })
        .where(eq(commerciaux.id, id));
      // Un commercial désactivé ne peut pas rester celui par défaut.
      if (!actif && row.parDefaut) await promoteDefault(tx, id);
    }
    if (makeDefault) {
      await tx.update(commerciaux).set({ parDefaut: false });
      await tx.update(commerciaux).set({ parDefaut: true, actif: true }).where(eq(commerciaux.id, id));
    }
  });

  const [updated] = await db.select().from(commerciaux).where(eq(commerciaux.id, id));
  return json(updated);
}

// DELETE /api/commerciaux/:id[?reassignTo=<id>]
// Refusé si des données portent encore son nom, sauf si on les réattribue à un autre commercial.
export async function DELETE(request: Request, ctx: RouteContext) {
  const id = await resolveId(ctx);
  if (!id) return badRequest("ID invalide");

  const list = await listCommerciauxWithStats();
  const row = list.find((c) => c.id === id);
  if (!row) return json({ error: "Commercial introuvable" }, { status: 404 });

  const reassignRaw = new URL(request.url).searchParams.get("reassignTo");
  let target: (typeof list)[number] | undefined;
  if (reassignRaw) {
    target = list.find((c) => c.id === Number(reassignRaw) && c.id !== id);
    if (!target) return badRequest("Commercial de réattribution introuvable.");
  }

  const used = row.nbProspects + row.nbEchanges + row.nbJoursHeures > 0;
  if (used && !target) {
    return json(
      {
        error: `${row.nom} a encore ${row.nbProspects} fiche(s), ${row.nbEchanges} échange(s) et ${row.heures} h de prospection. Réattribuez-les à un autre commercial, ou désactivez-le pour conserver l'historique à son nom.`,
        usage: { nbProspects: row.nbProspects, nbEchanges: row.nbEchanges, heures: row.heures },
      },
      { status: 409 },
    );
  }

  await db.transaction(async (tx) => {
    if (target) await renameEverywhere(tx, row.nom, target.nom);
    await tx.delete(commerciaux).where(eq(commerciaux.id, id));
    if (row.parDefaut) await promoteDefault(tx, id, target?.id);
  });

  return json({ deleted: 1, reassignedTo: target?.nom ?? null });
}
