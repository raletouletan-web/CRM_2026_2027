// Équipe commerciale paramétrable (côté serveur).
// La table `commerciaux` est la référence ; les fiches, les appels et les heures
// stockent le nom du commercial, d'où la propagation lors d'un renommage.

import { db } from "@/db";
import { calls, commerciaux, prospectingHours, prospects } from "@/db/schema";
import { asc, count, eq, sum } from "drizzle-orm";

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type CommercialWithStats = {
  id: number;
  nom: string;
  actif: boolean;
  parDefaut: boolean;
  ordre: number;
  /** Fiches prospects assignées */
  nbProspects: number;
  /** Fiches d'échange (appels, notes…) enregistrées à son nom */
  nbEchanges: number;
  /** Heures de prospection déclarées */
  heures: number;
  nbJoursHeures: number;
};

type Usage = { nom: string; nbProspects: number; nbEchanges: number; heures: number; nbJoursHeures: number };

export function cleanName(value: unknown): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

const key = (name: string) => cleanName(name).toLowerCase();

export function sameName(a: string, b: string): boolean {
  return key(a) === key(b);
}

/** Ce que chaque nom de commercial « possède » dans les données. */
async function usageByName(): Promise<Map<string, Usage>> {
  const [p, c, h] = await Promise.all([
    db
      .select({ nom: prospects.commercialAssigne, n: count() })
      .from(prospects)
      .groupBy(prospects.commercialAssigne),
    db.select({ nom: calls.commercial, n: count() }).from(calls).groupBy(calls.commercial),
    db
      .select({ nom: prospectingHours.commercial, h: sum(prospectingHours.heures), n: count() })
      .from(prospectingHours)
      .groupBy(prospectingHours.commercial),
  ]);

  const map = new Map<string, Usage>();
  const get = (nom: string): Usage | null => {
    const clean = cleanName(nom);
    if (!clean) return null;
    const k = key(clean);
    let u = map.get(k);
    if (!u) {
      u = { nom: clean, nbProspects: 0, nbEchanges: 0, heures: 0, nbJoursHeures: 0 };
      map.set(k, u);
    }
    return u;
  };
  for (const r of p) {
    const u = get(r.nom);
    if (u) u.nbProspects += r.n;
  }
  for (const r of c) {
    const u = get(r.nom);
    if (u) u.nbEchanges += r.n;
  }
  for (const r of h) {
    const u = get(r.nom);
    if (u) {
      u.heures += Number(r.h ?? 0);
      u.nbJoursHeures += r.n;
    }
  }
  return map;
}

/**
 * Liste des commerciaux avec leur volume de données.
 * Synchronise au passage : tout nom présent dans les données mais absent de la liste y est ajouté
 * (première ouverture, import d'un fichier avec une colonne « Commercial »…), et un commercial
 * par défaut est désigné s'il n'y en a aucun.
 */
export async function listCommerciauxWithStats(): Promise<CommercialWithStats[]> {
  const usage = await usageByName();
  const select = () => db.select().from(commerciaux).orderBy(asc(commerciaux.ordre), asc(commerciaux.id));
  let rows = await select();

  const known = new Set(rows.map((r) => key(r.nom)));
  const missing = [...usage.values()]
    .filter((u) => !known.has(key(u.nom)))
    .sort((a, b) => b.nbProspects - a.nbProspects || a.nom.localeCompare(b.nom, "fr"));
  if (missing.length > 0) {
    let ordre = rows.reduce((m, r) => Math.max(m, r.ordre), 0);
    await db
      .insert(commerciaux)
      .values(missing.map((u) => ({ nom: u.nom, ordre: ++ordre })))
      .onConflictDoNothing();
    rows = await select();
  }

  if (!rows.some((r) => r.parDefaut && r.actif)) {
    const actifs = rows.filter((r) => r.actif);
    if (actifs.length > 0) {
      const best = actifs
        .slice()
        .sort(
          (a, b) =>
            (usage.get(key(b.nom))?.nbProspects ?? 0) - (usage.get(key(a.nom))?.nbProspects ?? 0) || a.ordre - b.ordre,
        )[0];
      await db.update(commerciaux).set({ parDefaut: true }).where(eq(commerciaux.id, best.id));
      rows = rows.map((r) => ({ ...r, parDefaut: r.id === best.id }));
    }
  }

  return rows.map((r) => {
    const u = usage.get(key(r.nom));
    return {
      id: r.id,
      nom: r.nom,
      actif: r.actif,
      parDefaut: r.parDefaut,
      ordre: r.ordre,
      nbProspects: u?.nbProspects ?? 0,
      nbEchanges: u?.nbEchanges ?? 0,
      heures: Math.round((u?.heures ?? 0) * 100) / 100,
      nbJoursHeures: u?.nbJoursHeures ?? 0,
    };
  });
}

/** Commercial appliqué quand aucun n'est précisé (nouvelle fiche, import, appel rapide). "" s'il n'y en a aucun. */
export async function getDefaultCommercialName(): Promise<string> {
  const rows = await db
    .select()
    .from(commerciaux)
    .where(eq(commerciaux.actif, true))
    .orderBy(asc(commerciaux.ordre), asc(commerciaux.id));
  return (rows.find((r) => r.parDefaut) ?? rows[0])?.nom ?? "";
}

/** Remplace un nom par un autre dans les fiches, les échanges et les heures. */
export async function renameEverywhere(tx: Tx, from: string, to: string): Promise<void> {
  await tx.update(prospects).set({ commercialAssigne: to }).where(eq(prospects.commercialAssigne, from));
  await tx.update(calls).set({ commercial: to }).where(eq(calls.commercial, from));
  await tx.update(prospectingHours).set({ commercial: to }).where(eq(prospectingHours.commercial, from));
}

/** Désigne un nouveau commercial par défaut parmi les actifs (hors `excludeId`), en préférant `preferId`. */
export async function promoteDefault(tx: Tx, excludeId: number, preferId?: number): Promise<void> {
  const actifs = (
    await tx
      .select()
      .from(commerciaux)
      .where(eq(commerciaux.actif, true))
      .orderBy(asc(commerciaux.ordre), asc(commerciaux.id))
  ).filter((r) => r.id !== excludeId);
  const next = actifs.find((r) => r.id === preferId) ?? actifs[0];
  if (next) await tx.update(commerciaux).set({ parDefaut: true }).where(eq(commerciaux.id, next.id));
}
