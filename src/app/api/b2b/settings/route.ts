import { db } from "@/db";
import { financialSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { badRequest, json } from "@/lib/server";

export const dynamic = "force-dynamic";

// GET /api/b2b/settings?mois=YYYY-MM
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mois = searchParams.get("mois") ?? new Date().toISOString().slice(0, 7);

  const rows = await db
    .select()
    .from(financialSettings)
    .where(eq(financialSettings.mois, mois))
    .limit(1);

  if (rows[0]) {
    return json({ ...rows[0], configure: true });
  }

  // Valeurs par défaut si non encore configuré
  return json({
    mois,
    coutProspection: 4500,
    panierMoyen: 2500,
    configure: false,
  });
}

// POST /api/b2b/settings — enregistrer ou mettre à jour les paramètres financiers
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return badRequest("JSON invalide");
  }

  const mois = String(body.mois ?? new Date().toISOString().slice(0, 7)).trim();
  const coutProspection = Math.max(0, Number(body.coutProspection ?? 4500) || 0);
  const panierMoyen = Math.max(0, Number(body.panierMoyen ?? 2500) || 0);

  const existing = await db
    .select()
    .from(financialSettings)
    .where(eq(financialSettings.mois, mois))
    .limit(1);

  if (existing[0]) {
    const [updated] = await db
      .update(financialSettings)
      .set({
        coutProspection,
        panierMoyen,
        updatedAt: new Date(),
      })
      .where(eq(financialSettings.id, existing[0].id))
      .returning();
    return json(updated);
  }

  const [created] = await db
    .insert(financialSettings)
    .values({
      mois,
      coutProspection,
      panierMoyen,
    })
    .returning();

  return json(created, { status: 201 });
}
