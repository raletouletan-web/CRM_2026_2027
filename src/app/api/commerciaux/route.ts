import { db } from "@/db";
import { commerciaux } from "@/db/schema";
import { badRequest, json } from "@/lib/server";
import { cleanName, listCommerciauxWithStats, sameName } from "@/lib/commerciaux";

export const dynamic = "force-dynamic";

// GET /api/commerciaux — l'équipe, avec le volume de données de chacun
export async function GET() {
  const list = await listCommerciauxWithStats();
  const defaut = (list.find((c) => c.parDefaut && c.actif) ?? list.find((c) => c.actif))?.nom ?? "";
  return json({ commerciaux: list, defaut });
}

// POST /api/commerciaux — { nom } : ajoute un commercial
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return badRequest("JSON invalide");
  }
  const nom = cleanName(body.nom);
  if (!nom) return badRequest("Le nom du commercial est obligatoire.");
  if (nom.length > 60) return badRequest("Le nom ne peut pas dépasser 60 caractères.");

  const existing = await db.select().from(commerciaux);
  if (existing.some((c) => sameName(c.nom, nom))) {
    return json({ error: `« ${nom} » existe déjà dans l'équipe.` }, { status: 409 });
  }

  const ordre = existing.reduce((m, c) => Math.max(m, c.ordre), 0) + 1;
  const hasDefault = existing.some((c) => c.parDefaut && c.actif);
  const [created] = await db
    .insert(commerciaux)
    .values({ nom, ordre, actif: true, parDefaut: !hasDefault })
    .returning();
  return json(created, { status: 201 });
}
