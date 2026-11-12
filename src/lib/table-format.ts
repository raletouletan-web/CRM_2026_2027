// Format du tableau d'import / export : les 22 colonnes du fichier du client, dans le même ordre.
// Ce module est pur (aucun accès base de données) : il sert au navigateur comme au serveur.

import type { ProspectRow } from "@/db/schema";
import { STATUS, dateFromInput, toDateInputValue, type StatutCode } from "@/lib/crm";

export type TableColumnKey =
  | "id"
  | "nom"
  | "prenom"
  | "telephone"
  | "email"
  | "situationPro"
  | "metier"
  | "diplome"
  | "financement"
  | "urgence"
  | "statut"
  | "nbAppels"
  | "dernierContact"
  | "prochainRappel"
  | "heureRappel"
  | "resumeAppel"
  | "objections"
  | "historiqueAppels"
  | "offreProposee"
  | "statutPaiement"
  | "caGenere"
  | "dateCreation";

/** Colonnes acceptées à l'import : les 22 du tableau + 2 colonnes facultatives propres au CRM. */
export type ImportColumnKey = TableColumnKey | "entreprise" | "commercialAssigne";

type ColumnDef<K extends string> = { key: K; label: string; aliases: string[] };

/** Les alias sont des en-têtes « normalisés » (sans accent, sans espace, en minuscules). */
export const TABLE_COLUMNS: ColumnDef<TableColumnKey>[] = [
  { key: "id", label: "ID", aliases: ["id", "identifiant"] },
  { key: "nom", label: "Nom", aliases: ["nom", "nomdefamille", "lastname"] },
  { key: "prenom", label: "Prénom", aliases: ["prenom", "firstname"] },
  { key: "telephone", label: "Téléphone", aliases: ["telephone", "tel", "phone", "mobile", "portable"] },
  { key: "email", label: "Email", aliases: ["email", "mail", "courriel"] },
  { key: "situationPro", label: "Situation Pro", aliases: ["situationpro", "situationprofessionnelle", "situation"] },
  { key: "metier", label: "Métier Actuel", aliases: ["metieractuel", "metier", "profession"] },
  { key: "diplome", label: "Diplôme Visé", aliases: ["diplomevise", "diplome"] },
  { key: "financement", label: "Financement", aliases: ["financement"] },
  { key: "urgence", label: "Urgence", aliases: ["urgence", "temperature"] },
  { key: "statut", label: "Statut", aliases: ["statut", "status", "etape"] },
  { key: "nbAppels", label: "Nombre Appels", aliases: ["nombreappels", "nombredappels", "nbappels", "appels"] },
  { key: "dernierContact", label: "Dernier Contact", aliases: ["derniercontact", "datederniercontact"] },
  {
    key: "prochainRappel",
    label: "Prochain Rappel",
    aliases: ["prochainrappel", "dateprochainrappel", "daterappel", "rappel"],
  },
  { key: "heureRappel", label: "Heure Rappel", aliases: ["heurerappel", "heuredurappel", "heure"] },
  {
    key: "resumeAppel",
    label: "Résumé Appel",
    aliases: ["resumeappel", "resumedappel", "resume", "note", "notes", "commentaire"],
  },
  { key: "objections", label: "Objections", aliases: ["objections", "objection"] },
  {
    key: "historiqueAppels",
    label: "Historique Appels",
    aliases: ["historiqueappels", "historiquedesappels", "historique"],
  },
  { key: "offreProposee", label: "Offre Proposée", aliases: ["offreproposee", "offre"] },
  { key: "statutPaiement", label: "Statut Paiement", aliases: ["statutpaiement", "paiement"] },
  { key: "caGenere", label: "CA Généré", aliases: ["cagenere", "ca", "chiffredaffaires"] },
  { key: "dateCreation", label: "Date Création", aliases: ["datecreation", "datedecreation", "creele", "createdat"] },
];

const EXTRA_COLUMNS: ColumnDef<ImportColumnKey>[] = [
  { key: "entreprise", label: "Entreprise", aliases: ["entreprise", "societe", "structure"] },
  { key: "commercialAssigne", label: "Commercial", aliases: ["commercial", "commercialassigne"] },
];

export function normalizeHeader(header: string): string {
  return String(header ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export type HeaderAnalysis = {
  recognized: { header: string; key: ImportColumnKey; label: string }[];
  /** En-têtes du fichier qui ne correspondent à aucune colonne connue (non importés). */
  ignored: string[];
  /** Colonnes du tableau attendu absentes du fichier (libellés). */
  missing: string[];
};

/**
 * Associe les en-têtes d'un fichier aux colonnes du tableau.
 * 1) correspondance exacte (accents, casse, espaces et ponctuation ignorés) ;
 * 2) en-tête tronqué (ex. « Nombre Appe ») s'il ne correspond qu'à une seule colonne restante.
 */
export function mapHeaders(headers: string[]): HeaderAnalysis {
  const defs: ColumnDef<ImportColumnKey>[] = [...TABLE_COLUMNS, ...EXTRA_COLUMNS];
  const taken = new Set<ImportColumnKey>();
  const recognized: HeaderAnalysis["recognized"] = [];
  const ignored: string[] = [];
  const pending: { header: string; norm: string }[] = [];

  for (const header of headers) {
    const norm = normalizeHeader(header);
    if (!norm) continue;
    const def = defs.find((d) => !taken.has(d.key) && d.aliases.includes(norm));
    if (def) {
      taken.add(def.key);
      recognized.push({ header, key: def.key, label: def.label });
    } else {
      pending.push({ header, norm });
    }
  }

  for (const { header, norm } of pending) {
    const candidates =
      norm.length >= 5 ? defs.filter((d) => !taken.has(d.key) && d.aliases.some((a) => a.startsWith(norm))) : [];
    if (candidates.length === 1) {
      taken.add(candidates[0].key);
      recognized.push({ header, key: candidates[0].key, label: candidates[0].label });
    } else {
      ignored.push(header);
    }
  }

  const missing = TABLE_COLUMNS.filter((c) => !taken.has(c.key)).map((c) => c.label);
  return { recognized, ignored, missing };
}

// ---------- Lecture des cellules ----------

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Date d'une cellule : « 12/05/2026 » (jour/mois/année), « 2026-05-12 », ISO complet
 * (« 2026-11-09T15:23:10.993Z ») ou numéro de série Excel. Renvoie null si non reconnue.
 */
export function parseDateCell(value: unknown): Date | null {
  const s = String(value ?? "").trim();
  if (!s) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return dateFromInput(s);

  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(s)) {
    if (/(Z|[+-]\d{2}:?\d{2})$/i.test(s)) {
      const d = new Date(s.replace(" ", "T"));
      return Number.isNaN(d.getTime()) ? null : d;
    }
    // Sans fuseau : heure de Paris
    const base = dateFromInput(s.slice(0, 10));
    const [hh, mm] = s.slice(11, 16).split(":").map(Number);
    return base ? new Date(base.getTime() + (hh * 60 + mm) * 60000) : null;
  }

  const fr = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})(?:[ T,àa]+(\d{1,2})[:h](\d{2}))?/.exec(s);
  if (fr) {
    let day = Number(fr[1]);
    let month = Number(fr[2]);
    let year = Number(fr[3]);
    if (year < 100) year += 2000;
    if (month > 12 && day <= 12) [day, month] = [month, day];
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const base = dateFromInput(`${year}-${pad(month)}-${pad(day)}`);
    if (!base) return null;
    const minutes = fr[4] ? Number(fr[4]) * 60 + Number(fr[5]) : 0;
    return new Date(base.getTime() + minutes * 60000);
  }

  if (/^\d+(\.\d+)?$/.test(s)) {
    const serial = Number(s);
    if (serial > 20000 && serial < 80000) {
      const day = new Date(Math.round((Math.floor(serial) - 25569) * 86400000));
      const base = dateFromInput(day.toISOString().slice(0, 10));
      const minutes = Math.round((serial - Math.floor(serial)) * 1440);
      return base ? new Date(base.getTime() + minutes * 60000) : null;
    }
    return null;
  }

  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Heure d'une cellule → « HH:MM » (« 13:30 », « 13:30:00 », « 13h30 », fraction de jour Excel). */
export function parseHeureCell(value: unknown): string {
  const s = String(value ?? "").trim();
  if (!s) return "";
  const hm = /^(\d{1,2})\s*[:hH]\s*(\d{2})/.exec(s);
  if (hm) {
    const h = Number(hm[1]);
    const m = Number(hm[2]);
    return h < 24 && m < 60 ? `${pad(h)}:${pad(m)}` : "";
  }
  if (/^0?\.\d+$/.test(s)) {
    const total = Math.round(Number(s) * 1440);
    return `${pad(Math.floor(total / 60) % 24)}:${pad(total % 60)}`;
  }
  const iso = /T(\d{2}):(\d{2})/.exec(s);
  if (iso) return `${iso[1]}:${iso[2]}`;
  const hOnly = /^(\d{1,2})\s*[hH]$/.exec(s);
  if (hOnly && Number(hOnly[1]) < 24) return `${pad(Number(hOnly[1]))}:00`;
  return "";
}

/** Nombre entier d'une cellule (« 1 400 € », « 1400,00 », « 3 »). */
export function parseIntCell(value: unknown): number | null {
  const s = String(value ?? "")
    .replace(/[\s\u00a0\u202f€]/g, "")
    .replace(",", ".");
  if (!s) return null;
  const n = Number(s.replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? Math.round(n) : null;
}

// ---------- Colonne « Historique Appels » ----------

export type HistoriqueEntry = { date: Date | null; resume: string };

const LINE_DATE =
  /^(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}(?:[ ,àa]+\d{1,2}[:h]\d{2})?|\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?)\s*[-—–:·|]*\s*(.*)$/;

function parseHistoriqueLine(line: string): HistoriqueEntry {
  const m = LINE_DATE.exec(line);
  if (m) {
    const date = parseDateCell(m[1]);
    if (date) return { date, resume: m[2].trim() || "Échange (historique importé)" };
  }
  return { date: null, resume: line };
}

/**
 * Lit la colonne « Historique Appels ». Deux formes sont acceptées :
 * - un tableau JSON d'objets ({ date, resume/note/... }) ;
 * - du texte, une ligne par échange (séparées par un retour à la ligne ou « | »),
 *   éventuellement préfixée par une date.
 * Le texte non reconnu est conservé tel quel, sans date.
 */
export function parseHistorique(value: unknown): HistoriqueEntry[] {
  const s = String(value ?? "").trim();
  if (!s) return [];

  if (s.startsWith("[") || s.startsWith("{")) {
    try {
      const parsed: unknown = JSON.parse(s);
      const items: unknown[] = Array.isArray(parsed) ? parsed : [parsed];
      const out: HistoriqueEntry[] = [];
      for (const item of items) {
        if (item && typeof item === "object") {
          const o = item as Record<string, unknown>;
          const rawDate = o.date ?? o.datetime ?? o.timestamp ?? o.createdAt ?? o.when;
          let date: Date | null =
            typeof rawDate === "number" && rawDate > 1e11 ? new Date(rawDate) : parseDateCell(rawDate);
          const heure = parseHeureCell(o.heure ?? o.time ?? o.hour);
          if (date && heure && typeof rawDate === "string" && !rawDate.includes(":")) {
            const [h, m] = heure.split(":").map(Number);
            date = new Date(date.getTime() + (h * 60 + m) * 60000);
          }
          const texte = [o.resume, o["résumé"], o.note, o.notes, o.commentaire, o.summary, o.text, o.contenu, o.description].find(
            (x): x is string => typeof x === "string" && x.trim() !== "",
          );
          out.push({ date, resume: (texte ?? JSON.stringify(o)).trim().slice(0, 4000) });
        } else if (item !== null && item !== undefined && String(item).trim()) {
          out.push(parseHistoriqueLine(String(item).trim()));
        }
      }
      return out;
    } catch {
      // pas du JSON valide : traité comme du texte
    }
  }

  return s
    .split(/\r?\n|\s+\|\s+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map(parseHistoriqueLine);
}

const HISTORIQUE_DATE = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** Écrit l'historique sous forme de texte relisible par parseHistorique : « 11/11/2026 10:05 — résumé | … ». */
export function formatHistorique(entries: { date: Date | string; resume: string }[]): string {
  return entries
    .slice()
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map((e) => {
      const d = new Date(e.date);
      const when = Number.isNaN(d.getTime()) ? "" : HISTORIQUE_DATE.format(d).replace(",", "").replace(" à ", " ");
      const texte = (e.resume || "").replace(/\s*\r?\n\s*/g, " ").replace(/\s\|\s/g, " / ").trim();
      return when ? `${when} — ${texte}` : texte;
    })
    .filter(Boolean)
    .join(" | ");
}

// ---------- Export : une fiche → une ligne du tableau ----------

export type TableRow = Record<string, string | number>;

/** Date au format du tableau (jj/mm/aaaa), calculée en heure de Paris. */
export function formatDateFr(d: Date | string | null | undefined): string {
  const iso = toDateInputValue(d);
  if (!iso) return "";
  const [y, m, day] = iso.split("-");
  return `${day}/${m}/${y}`;
}

export function prospectToTableRow(p: ProspectRow, historique: { date: Date | string; resume: string }[]): TableRow {
  const values: Record<TableColumnKey, string | number> = {
    id: p.externalId,
    nom: p.nom,
    prenom: p.prenom,
    telephone: p.telephone,
    email: p.email,
    situationPro: p.situationPro,
    metier: p.metier,
    diplome: p.diplome,
    financement: p.financement,
    urgence: p.urgence,
    statut: STATUS[p.statut as StatutCode]?.label ?? p.statut,
    nbAppels: p.nbAppels,
    dernierContact: formatDateFr(p.dernierContact),
    prochainRappel: formatDateFr(p.prochainRappel),
    heureRappel: p.heureRappel,
    resumeAppel: p.resumeAppel,
    objections: p.objections,
    historiqueAppels: formatHistorique(historique),
    offreProposee: p.offreProposee ?? "",
    statutPaiement: p.statutPaiement,
    caGenere: p.caGenere,
    dateCreation: new Date(p.createdAt).toISOString(),
  };
  const row: TableRow = {};
  for (const col of TABLE_COLUMNS) row[col.label] = values[col.key];
  return row;
}
