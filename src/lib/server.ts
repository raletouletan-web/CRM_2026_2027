import { db } from "@/db";
import { prospects } from "@/db/schema";
import { eq } from "drizzle-orm";
import { normalizePaiement, normalizeStatut, normalizeUrgence, parseOffreAmount } from "@/lib/crm";

/** Champs du prospect qu'un client est autorisé à écrire. */
const WRITABLE_FIELDS = [
  "nom",
  "prenom",
  "telephone",
  "email",
  "entreprise",
  "commercialAssigne",
  "situationPro",
  "metier",
  "diplome",
  "financement",
  "urgence",
  "statut",
  "nbAppels",
  "dernierContact",
  "prochainRappel",
  "heureRappel",
  "resumeAppel",
  "objections",
  "offreProposee",
  "statutPaiement",
  "caGenere",
  "source",
] as const;

export type ProspectPayload = Partial<Record<(typeof WRITABLE_FIELDS)[number], unknown>>;

function toDate(v: unknown): Date | null {
  if (v === null || v === undefined || v === "") return null;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}

function toInt(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[^\d-]/g, ""));
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function toText(v: unknown): string | undefined {
  if (v === null || v === undefined) return undefined;
  return String(v);
}

/** Nettoie un payload JSON en objet Drizzle partiel et typé. */
export function cleanProspectPayload(body: ProspectPayload): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of WRITABLE_FIELDS) {
    if (!(key in body)) continue;
    const v = body[key];
    switch (key) {
      case "nom":
      case "prenom":
      case "telephone":
      case "email":
      case "entreprise":
      case "commercialAssigne":
      case "situationPro":
      case "metier":
      case "diplome":
      case "financement":
      case "heureRappel":
      case "resumeAppel":
      case "objections":
      case "source":
        out[key] = toText(v) ?? "";
        break;
      case "urgence":
        out[key] = normalizeUrgence(toText(v));
        break;
      case "statut":
        out[key] = normalizeStatut(toText(v));
        break;
      case "statutPaiement":
        out[key] = normalizePaiement(toText(v));
        break;
      case "nbAppels":
      case "caGenere": {
        const n = toInt(v);
        if (n !== null) out[key] = Math.max(0, n);
        break;
      }
      case "offreProposee": {
        // Texte libre, comme dans le tableau (« 1400 », « 3 x 350€ », « FOLLOW UP CPF 2800 »…)
        const t = (toText(v) ?? "").trim();
        out[key] = t === "" ? null : t;
        break;
      }
      case "dernierContact":
      case "prochainRappel":
        out[key] = toDate(v);
        break;
    }
  }
  return out;
}

/**
 * Règle métier (cf. copie d'écran) : le CA généré est calculé automatiquement
 * à partir de l'offre proposée lorsque le statut de paiement est "Payé".
 */
export function computeCa(offre: string | null | undefined, paiement: string, fallback = 0): number {
  if (paiement !== "Payé") return fallback;
  return parseOffreAmount(offre) ?? fallback;
}

export async function getProspectOr404(id: number) {
  const rows = await db.select().from(prospects).where(eq(prospects.id, id)).limit(1);
  return rows[0] ?? null;
}

export function json(data: unknown, init?: ResponseInit): Response {
  return Response.json(data, init);
}

export function badRequest(message: string): Response {
  return Response.json({ error: message }, { status: 400 });
}
