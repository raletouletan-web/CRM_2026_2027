import { db } from "@/db";
import { calls, prospects } from "@/db/schema";
import { asc, desc, inArray } from "drizzle-orm";
import { json } from "@/lib/server";
import { prospectToTableRow } from "@/lib/table-format";

export const dynamic = "force-dynamic";

// GET /api/prospects/export — toutes les fiches au format du tableau (22 colonnes, mêmes en-têtes).
export async function GET() {
  const rows = await db.select().from(prospects).orderBy(desc(prospects.updatedAt)).limit(10000);

  // Colonne « Historique Appels » : appels saisis dans le CRM + lignes d'historique importées.
  const history = await db
    .select({ prospectId: calls.prospectId, date: calls.date, resume: calls.resume })
    .from(calls)
    .where(inArray(calls.type, ["appel", "historique"]))
    .orderBy(asc(calls.date));

  const byProspect = new Map<number, { date: Date; resume: string }[]>();
  for (const h of history) {
    const list = byProspect.get(h.prospectId) ?? [];
    list.push({ date: h.date, resume: h.resume });
    byProspect.set(h.prospectId, list);
  }

  return json(rows.map((p) => ({ id: p.id, row: prospectToTableRow(p, byProspect.get(p.id) ?? []) })));
}
