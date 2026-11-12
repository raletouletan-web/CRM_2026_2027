import { db } from "@/db";
import { prospects } from "@/db/schema";
import { and, asc, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import { badRequest, cleanProspectPayload, computeCa, json } from "@/lib/server";
import { getDefaultCommercialName } from "@/lib/commerciaux";
import { isValidStatut, isValidUrgence } from "@/lib/crm";

export const dynamic = "force-dynamic";

// GET /api/prospects?q=&statut=&urgence=&sort=
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  const statut = searchParams.get("statut") ?? "";
  const urgence = searchParams.get("urgence") ?? "";
  const sort = searchParams.get("sort") ?? "recent";

  const conditions: SQL[] = [];
  if (q) {
    const like = `%${q}%`;
    conditions.push(
      or(
        ilike(prospects.nom, like),
        ilike(prospects.prenom, like),
        ilike(prospects.telephone, like),
        ilike(prospects.email, like),
      )!,
    );
  }
  if (statut && statut !== "tous" && isValidStatut(statut)) {
    conditions.push(eq(prospects.statut, statut));
  }
  if (urgence && isValidUrgence(urgence)) {
    conditions.push(eq(prospects.urgence, urgence));
  }

  const orderBy =
    sort === "nom"
      ? [asc(prospects.nom), asc(prospects.prenom)]
      : sort === "rappel"
        ? [asc(prospects.prochainRappel), desc(prospects.updatedAt)]
        : sort === "appels"
          ? [desc(prospects.nbAppels), desc(prospects.updatedAt)]
          : sort === "ca"
            ? [desc(prospects.caGenere), desc(prospects.updatedAt)]
            : [desc(prospects.updatedAt)];

  const rows = await db
    .select()
    .from(prospects)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(...orderBy)
    .limit(2000);

  return json(rows);
}

// POST /api/prospects — création d'un prospect
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return badRequest("JSON invalide");
  }
  const payload = cleanProspectPayload(body);
  const nom = String(payload.nom ?? "").trim();
  const prenom = String(payload.prenom ?? "").trim();
  if (!nom && !prenom) return badRequest("Le nom (ou le prénom) est obligatoire");

  const offre = (payload.offreProposee as string | null | undefined) ?? null;
  const paiement = String(payload.statutPaiement ?? "Non défini");

  const [created] = await db
    .insert(prospects)
    .values({
      ...payload,
      nom: nom || "Sans nom",
      prenom,
      caGenere: computeCa(offre, paiement, (payload.caGenere as number | undefined) ?? 0),
      commercialAssigne: String(payload.commercialAssigne ?? "").trim() || (await getDefaultCommercialName()),
    })
    .returning();

  return json(created, { status: 201 });
}

// DELETE /api/prospects — tout effacer ("Tout effacer" de la vue Prospects)
export async function DELETE() {
  const deleted = await db.delete(prospects).returning({ id: prospects.id });
  return json({ deleted: deleted.length });
}
