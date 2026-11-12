import { db } from "@/db";
import { prospectingHours } from "@/db/schema";
import { and, desc, eq, ilike } from "drizzle-orm";
import { badRequest, json } from "@/lib/server";

export const dynamic = "force-dynamic";

// GET /api/b2b/hours?commercial=&mois=YYYY-MM&jour=YYYY-MM-DD
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const commercial = searchParams.get("commercial") ?? "";
  const mois = searchParams.get("mois") ?? "";
  const jour = searchParams.get("jour") ?? "";

  const conditions = [];
  if (commercial && commercial !== "tous") {
    conditions.push(eq(prospectingHours.commercial, commercial));
  }
  if (jour) {
    conditions.push(eq(prospectingHours.date, jour));
  } else if (mois) {
    conditions.push(ilike(prospectingHours.date, `${mois}%`));
  }

  const rows = await db
    .select()
    .from(prospectingHours)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(prospectingHours.date));

  return json(rows);
}

// POST /api/b2b/hours — enregistrer ou mettre à jour les heures de prospection
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return badRequest("JSON invalide");
  }

  const commercial = String(body.commercial ?? "").trim();
  const date = String(body.date ?? "").trim(); // YYYY-MM-DD
  const heures = Math.max(0, Number(body.heures ?? 0) || 0);
  const notes = String(body.notes ?? "").trim();

  if (!commercial || !date) {
    return badRequest("Le commercial et la date sont requis.");
  }

  // Chercher si existant pour cette date + commercial
  const existing = await db
    .select()
    .from(prospectingHours)
    .where(and(eq(prospectingHours.commercial, commercial), eq(prospectingHours.date, date)))
    .limit(1);

  if (existing[0]) {
    const [updated] = await db
      .update(prospectingHours)
      .set({
        heures,
        notes: notes || existing[0].notes,
        updatedAt: new Date(),
      })
      .where(eq(prospectingHours.id, existing[0].id))
      .returning();
    return json(updated);
  }

  const [created] = await db
    .insert(prospectingHours)
    .values({
      commercial,
      date,
      heures,
      notes,
    })
    .returning();

  return json(created, { status: 201 });
}
