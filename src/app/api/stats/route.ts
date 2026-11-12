import { db } from "@/db";
import { prospects } from "@/db/schema";
import { desc } from "drizzle-orm";
import { todayParis, toDateInputValue } from "@/lib/crm";
import { json } from "@/lib/server";
import type { StatsPayload } from "@/lib/types";

export const dynamic = "force-dynamic";

// GET /api/stats — toutes les statistiques agrégées (dashboard + page Statistiques)
export async function GET() {
  const rows = await db
    .select()
    .from(prospects)
    .orderBy(desc(prospects.updatedAt))
    .limit(5000);

  const total = rows.length;
  const appels = rows.reduce((s, r) => s + (r.nbAppels ?? 0), 0);
  const closes = rows.filter((r) => r.statut === "close");
  const closings = closes.length;
  const caTotal = rows.reduce((s, r) => s + (r.caGenere ?? 0), 0);

  const parStatut: Record<string, number> = {};
  const parUrgence: Record<string, number> = { chaud: 0, moyen: 0, froid: 0 };
  for (const r of rows) {
    parStatut[r.statut] = (parStatut[r.statut] ?? 0) + 1;
    if (r.urgence === "chaud" || r.urgence === "froid") parUrgence[r.urgence] += 1;
    else parUrgence.moyen += 1;
  }

  const offreMap = new Map<string, { offre: string; count: number; ca: number }>();
  for (const r of closes) {
    const offre = (r.offreProposee ?? "").trim() || "Non renseignée";
    const cur = offreMap.get(offre) ?? { offre, count: 0, ca: 0 };
    cur.count += 1;
    cur.ca += r.caGenere ?? 0;
    offreMap.set(offre, cur);
  }
  const closingsParOffre = [...offreMap.values()].sort((a, b) => b.ca - a.ca);

  const today = todayParis();
  const rappelsAujourdhui = rows.filter((r) => r.prochainRappel && toDateInputValue(r.prochainRappel) === today).length;

  const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const nouveauxCetteSemaine = rows.filter((r) => new Date(r.createdAt) >= weekAgo).length;

  const prospectsCloses = closes
    .slice()
    .sort((a, b) => (b.caGenere ?? 0) - (a.caGenere ?? 0))
    .slice(0, 100);

  const payload: StatsPayload = {
    total,
    appels,
    closings,
    caTotal,
    tauxClosing: total > 0 ? closings / total : 0,
    caParLead: total > 0 ? caTotal / total : 0,
    appelsParClosing: closings > 0 ? appels / closings : 0,
    appelsParLead: total > 0 ? appels / total : 0,
    parStatut,
    parUrgence,
    closingsParOffre,
    prospectsCloses,
    rappelsAujourdhui,
    nouveauxCetteSemaine,
  };

  return json(payload);
}
