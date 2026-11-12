import { db } from "@/db";
import {
  calls,
  generateExternalId,
  prospectingHours,
  prospects,
  type CallInsert,
  type ProspectInsert,
} from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { badRequest, json } from "@/lib/server";
import { getDefaultCommercialName } from "@/lib/commerciaux";
import { normalizePaiement, normalizeStatut, normalizeUrgence, parseOffreAmount } from "@/lib/crm";
import {
  mapHeaders,
  parseDateCell,
  parseHeureCell,
  parseHistorique,
  parseIntCell,
  type HistoriqueEntry,
  type ImportColumnKey,
} from "@/lib/table-format";

export const dynamic = "force-dynamic";

type Row = Record<string, unknown>;
type Parsed = {
  externalId: string;
  hasFileId: boolean;
  values: Partial<ProspectInsert>;
  historique: HistoriqueEntry[];
};

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * POST /api/prospects/import — { rows: [...], replace?: boolean }
 * Les lignes sont lues côté navigateur (CSV ou XLSX) ; les en-têtes sont ceux du tableau :
 * ID, Nom, Prénom, Téléphone, Email, Situation Pro, Métier Actuel, Diplôme Visé, Financement,
 * Urgence, Statut, Nombre Appels, Dernier Contact, Prochain Rappel, Heure Rappel, Résumé Appel,
 * Objections, Historique Appels, Offre Proposée, Statut Paiement, CA Généré, Date Création.
 *
 * - Une ligne dont l'ID existe déjà met la fiche à jour (pas de doublon).
 * - Seules les colonnes présentes dans le fichier sont écrites.
 * - replace = true : efface d'abord prospects, fiches d'appels et heures de prospection.
 */
export async function POST(request: Request) {
  let body: { rows?: Row[]; replace?: boolean };
  try {
    body = await request.json();
  } catch {
    return badRequest("JSON invalide");
  }
  if (!Array.isArray(body.rows)) return badRequest("rows doit être un tableau");
  const rows = body.rows.filter((r): r is Row => Boolean(r) && typeof r === "object");
  const replace = body.replace === true;

  const headerSet = new Set<string>();
  for (const r of rows.slice(0, 200)) for (const k of Object.keys(r)) headerSet.add(k);
  const analysis = mapHeaders([...headerSet]);
  const headerByKey = new Map<ImportColumnKey, string>();
  for (const rec of analysis.recognized) headerByKey.set(rec.key, rec.header);

  const has = (key: ImportColumnKey) => headerByKey.has(key);
  const cell = (row: Row, key: ImportColumnKey): string => {
    const header = headerByKey.get(key);
    if (!header) return "";
    const v = row[header];
    return v === null || v === undefined ? "" : String(v).trim();
  };

  if (!has("nom") && !has("prenom")) {
    return badRequest("Aucune colonne « Nom » ou « Prénom » reconnue dans le fichier.");
  }

  let skipped = 0;
  let doublons = 0;
  let datesNonReconnues = 0;
  const dateCell = (row: Row, key: ImportColumnKey): Date | null => {
    const raw = cell(row, key);
    if (!raw) return null;
    const d = parseDateCell(raw);
    if (!d) datesNonReconnues++;
    return d;
  };

  const byId = new Map<string, Parsed>();
  for (const row of rows) {
    const nom = cell(row, "nom");
    const prenom = cell(row, "prenom");
    if (!nom && !prenom) {
      skipped++;
      continue;
    }

    const v: Partial<ProspectInsert> = {};
    if (has("nom")) v.nom = nom;
    if (has("prenom")) v.prenom = prenom;
    if (has("telephone")) v.telephone = cell(row, "telephone");
    if (has("email")) v.email = cell(row, "email");
    if (has("situationPro")) v.situationPro = cell(row, "situationPro");
    if (has("metier")) v.metier = cell(row, "metier");
    if (has("diplome")) v.diplome = cell(row, "diplome");
    if (has("financement")) v.financement = cell(row, "financement") || "Non défini";
    if (has("urgence")) v.urgence = normalizeUrgence(cell(row, "urgence"));
    if (has("statut")) v.statut = normalizeStatut(cell(row, "statut"));
    if (has("nbAppels")) v.nbAppels = Math.max(0, parseIntCell(cell(row, "nbAppels")) ?? 0);
    if (has("dernierContact")) v.dernierContact = dateCell(row, "dernierContact");
    if (has("prochainRappel")) v.prochainRappel = dateCell(row, "prochainRappel");
    if (has("heureRappel")) v.heureRappel = parseHeureCell(cell(row, "heureRappel"));
    if (has("resumeAppel")) v.resumeAppel = cell(row, "resumeAppel");
    if (has("objections")) v.objections = cell(row, "objections");
    if (has("offreProposee")) v.offreProposee = cell(row, "offreProposee") || null;
    if (has("statutPaiement")) v.statutPaiement = normalizePaiement(cell(row, "statutPaiement"));
    if (has("caGenere")) {
      // Le CA du fichier fait foi : il est repris tel quel.
      v.caGenere = Math.max(0, parseIntCell(cell(row, "caGenere")) ?? 0);
    } else if (has("offreProposee") && has("statutPaiement")) {
      v.caGenere = v.statutPaiement === "Payé" ? (parseOffreAmount(v.offreProposee) ?? 0) : 0;
    }
    if (has("dateCreation")) {
      const created = dateCell(row, "dateCreation");
      if (created) v.createdAt = created;
    }
    if (has("entreprise")) v.entreprise = cell(row, "entreprise");
    if (has("commercialAssigne") && cell(row, "commercialAssigne")) v.commercialAssigne = cell(row, "commercialAssigne");

    const fileId = cell(row, "id");
    const externalId = fileId || generateExternalId();
    if (byId.has(externalId)) doublons++;
    byId.set(externalId, {
      externalId,
      hasFileId: Boolean(fileId),
      values: v,
      historique: has("historiqueAppels") ? parseHistorique(cell(row, "historiqueAppels")) : [],
    });
  }

  const all = [...byId.values()];
  // Fiches créées sans colonne « Commercial » : commercial par défaut des Paramètres.
  const commercialParDefaut = await getDefaultCommercialName();
  let created = 0;
  let updated = 0;
  let historique = 0;

  await db.transaction(async (tx) => {
    if (replace) {
      await tx.delete(prospects); // les fiches d'appels sont supprimées en cascade
      await tx.delete(prospectingHours);
    }

    // Fiches déjà présentes (même ID) → mise à jour
    const existing = new Map<string, number>();
    if (!replace) {
      const ids = all.filter((p) => p.hasFileId).map((p) => p.externalId);
      for (const part of chunk(ids, 500)) {
        const found = await tx
          .select({ id: prospects.id, externalId: prospects.externalId })
          .from(prospects)
          .where(inArray(prospects.externalId, part));
        for (const f of found) existing.set(f.externalId, f.id);
      }
    }

    const toCreate = all.filter((p) => !existing.has(p.externalId));
    const toUpdate = all.filter((p) => existing.has(p.externalId));
    const idByExternal = new Map<string, number>(existing);

    for (const part of chunk(toCreate, 200)) {
      const inserted = await tx
        .insert(prospects)
        .values(
          part.map((p) => ({
            ...p.values,
            nom: p.values.nom ?? "",
            externalId: p.externalId,
            source: "Import tableau",
            commercialAssigne: p.values.commercialAssigne || commercialParDefaut,
            // « Plus récents » = dernier contact connu, sinon date de création
            updatedAt: p.values.dernierContact ?? p.values.createdAt ?? new Date(),
          })),
        )
        .returning({ id: prospects.id, externalId: prospects.externalId });
      for (const r of inserted) idByExternal.set(r.externalId, r.id);
      created += inserted.length;
    }

    for (const p of toUpdate) {
      await tx
        .update(prospects)
        .set({ ...p.values, updatedAt: new Date() })
        .where(eq(prospects.id, existing.get(p.externalId)!));
      updated++;
    }

    // Historique : repris pour les nouvelles fiches, et pour les fiches mises à jour
    // uniquement si elles n'ont encore aucune fiche d'échange (évite les doublons au ré-import).
    const withHistory = new Set<number>();
    for (const part of chunk([...existing.values()], 500)) {
      const found = await tx
        .selectDistinct({ prospectId: calls.prospectId })
        .from(calls)
        .where(inArray(calls.prospectId, part));
      for (const f of found) withHistory.add(f.prospectId);
    }

    const callRows: CallInsert[] = [];
    for (const p of all) {
      if (p.historique.length === 0) continue;
      const prospectId = idByExternal.get(p.externalId);
      if (!prospectId) continue;
      if (existing.has(p.externalId) && withHistory.has(prospectId)) continue;
      const fallback = p.values.dernierContact ?? p.values.createdAt ?? new Date();
      for (const h of p.historique) {
        callRows.push({
          prospectId,
          date: h.date ?? fallback,
          // « historique » : affiché dans la fiche, mais hors statistiques de performance
          // (le tableau ne donne ni résultat d'appel ni durée).
          type: "historique",
          resultat: "",
          commercial: "",
          resume: h.resume.slice(0, 4000),
        });
      }
    }
    for (const part of chunk(callRows, 500)) {
      await tx.insert(calls).values(part);
      historique += part.length;
    }
  });

  return json(
    {
      imported: created + updated,
      created,
      updated,
      skipped,
      doublons,
      historique,
      datesNonReconnues,
      replaced: replace,
      colonnesReconnues: analysis.recognized.map((r) => r.label),
      colonnesIgnorees: analysis.ignored,
      colonnesManquantes: analysis.missing,
    },
    { status: 201 },
  );
}
