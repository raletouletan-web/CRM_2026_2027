// Constantes et helpers partagés client/serveur pour le CRM de prospection.

export type StatutCode =
  | "nouveau_lead"
  | "a_appeler"
  | "appele"
  | "relance"
  | "rdv_prevu"
  | "close"
  | "perdu";

export type UrgenceCode = "chaud" | "moyen" | "froid";

export const STATUS_ORDER: StatutCode[] = [
  "nouveau_lead",
  "a_appeler",
  "appele",
  "relance",
  "rdv_prevu",
  "close",
  "perdu",
];

export const STATUS: Record<StatutCode, { label: string; badge: string; column: string; dot: string }> = {
  nouveau_lead: {
    label: "Nouveau lead",
    badge: "bg-blue-50 text-blue-700 ring-blue-600/20",
    column: "bg-blue-50/60 border-blue-100",
    dot: "bg-blue-500",
  },
  a_appeler: {
    label: "À appeler",
    badge: "bg-amber-50 text-amber-700 ring-amber-600/25",
    column: "bg-amber-50/60 border-amber-100",
    dot: "bg-amber-500",
  },
  appele: {
    label: "Appelé",
    badge: "bg-sky-50 text-sky-700 ring-sky-600/20",
    column: "bg-sky-50/60 border-sky-100",
    dot: "bg-sky-500",
  },
  relance: {
    label: "Relance",
    badge: "bg-orange-50 text-orange-700 ring-orange-600/25",
    column: "bg-orange-50/60 border-orange-100",
    dot: "bg-orange-500",
  },
  rdv_prevu: {
    label: "RDV prévu",
    badge: "bg-violet-50 text-violet-700 ring-violet-600/20",
    column: "bg-violet-50/60 border-violet-100",
    dot: "bg-violet-500",
  },
  close: {
    label: "Closé",
    badge: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
    column: "bg-emerald-50/60 border-emerald-100",
    dot: "bg-emerald-500",
  },
  perdu: {
    label: "Perdu",
    badge: "bg-rose-50 text-rose-700 ring-rose-600/20",
    column: "bg-slate-50 border-slate-200",
    dot: "bg-rose-400",
  },
};

export const URGENCE: Record<UrgenceCode, { label: string; badge: string; bar: string; dot: string }> = {
  chaud: {
    label: "Chaud",
    badge: "bg-orange-500 text-white",
    bar: "bg-orange-500",
    dot: "bg-orange-500",
  },
  moyen: {
    label: "Moyen",
    badge: "bg-amber-400 text-white",
    bar: "bg-amber-400",
    dot: "bg-amber-400",
  },
  froid: {
    label: "Froid",
    badge: "bg-sky-400 text-white",
    bar: "bg-sky-400",
    dot: "bg-sky-400",
  },
};

export const SITUATIONS_PRO = [
  "Salarié(e)",
  "Indépendant(e)",
  "Demandeur d'emploi",
  "Étudiant(e)",
  "Retraité(e)",
  "Autre",
];

export const FINANCEMENTS = [
  "Non défini",
  "CPF",
  "OPCO",
  "Pôle emploi (AIF)",
  "Autofinancement",
  "Prêt bancaire",
  "Paiement échelonné",
];

export const STATUTS_PAIEMENT = ["Non défini", "Non proposé", "Payé", "En attente", "Échelonné", "Refusé"];

// Normalise un libellé saisi ("RDV prévu", "rdv_prevu", "RDV prevu") vers le code interne.
export function normalizeStatut(input: string | null | undefined): StatutCode {
  if (!input) return "nouveau_lead";
  const s = input.trim().toLowerCase();
  const map: Record<string, StatutCode> = {
    "nouveau lead": "nouveau_lead",
    nouveau_lead: "nouveau_lead",
    nouveau: "nouveau_lead",
    "à appeler": "a_appeler",
    "a appeler": "a_appeler",
    a_appeler: "a_appeler",
    appelé: "appele",
    appele: "appele",
    appel: "appele",
    relance: "relance",
    "rdv prévu": "rdv_prevu",
    "rdv prevu": "rdv_prevu",
    rdv_prevu: "rdv_prevu",
    rdv: "rdv_prevu",
    closé: "close",
    ferme: "close",
    close: "close",
    gagné: "close",
    perdu: "perdu",
    lost: "perdu",
  };
  return map[s] ?? "nouveau_lead";
}

export function normalizeUrgence(input: string | null | undefined): UrgenceCode {
  const s = (input ?? "").trim().toLowerCase();
  if (s === "chaud" || s === "chaud 🔥" || s.includes("chaud")) return "chaud";
  if (s === "froid" || s.includes("froid")) return "froid";
  return "moyen";
}

export function normalizePaiement(input: string | null | undefined): string {
  const raw = (input ?? "").trim();
  const s = raw.toLowerCase();
  if (!s) return "Non défini";
  if (s === "payé" || s === "paye" || s === "payée" || s === "paid") return "Payé";
  if (s.includes("propos")) return "Non proposé";
  if (s.includes("attente")) return "En attente";
  if (s.includes("échel") || s.includes("echel")) return "Échelonné";
  if (s === "refusé" || s === "refuse") return "Refusé";
  if (s === "non défini" || s === "non defini") return "Non défini";
  // Valeur inconnue : conservée telle quelle plutôt que perdue.
  return raw;
}

export function isValidStatut(v: string): v is StatutCode {
  return (STATUS_ORDER as string[]).includes(v);
}

export function isValidUrgence(v: string): v is UrgenceCode {
  return v === "chaud" || v === "moyen" || v === "froid";
}

// ---------- Formattage ----------

export function fullName(p: { nom: string; prenom: string }): string {
  return `${p.prenom ? p.prenom + " " : ""}${p.nom}`.trim() || "Sans nom";
}

export function initials(p: { nom: string; prenom: string }): string {
  const n = (p.nom ?? "").trim();
  const pr = (p.prenom ?? "").trim();
  const a = pr ? pr[0] : n ? n[0] : "?";
  const b = n ? n[0] : "";
  return (a + b).toUpperCase();
}

export function formatEUR(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "0";
  return new Intl.NumberFormat("fr-FR").format(n);
}

export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(dt);
}

export function formatDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(dt);
}

export function formatTime(d: Date | string | null | undefined): string {
  if (!d) return "";
  const dt = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return "";
  return new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(dt);
}

// "yyyy-mm-dd" pour aujourd'hui en Europe/Paris (fuseau des copies d'écran).
export function todayParis(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
}

export function toDateInputValue(d: Date | string | null | undefined): string {
  if (!d) return "";
  const dt = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return "";
  // en-CA => yyyy-mm-dd, en heure de Paris pour rester cohérent avec l'affichage
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(dt);
}

export function dateFromInput(v: string): Date | null {
  if (!v) return null;
  // v = yyyy-mm-dd interprété à minuit, heure de Paris
  const [y, m, d] = v.split("-").map(Number);
  if (!y || !m || !d) return null;
  const utc = Date.UTC(y, m - 1, d, 0, 0, 0);
  // Heure affichée à Paris quand il est minuit UTC ce jour-là = décalage horaire (1 h ou 2 h)
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(new Date(utc));
  const offsetHours = Number(parts.find((p) => p.type === "hour")?.value ?? 0) % 24;
  return new Date(utc - offsetHours * 3600 * 1000);
}

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

// ---------- Offre proposée (texte libre) ----------

/**
 * Montant d'une offre saisie en texte libre, uniquement si elle est sans ambiguïté :
 * « 1400 », « 1 400 € », « 3 x 350€ » (=> 1050). Renvoie null pour un texte comme
 * « FOLLOW UP CPF 2800 » : on ne devine pas un montant dans une phrase.
 */
export function parseOffreAmount(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  const s = String(input).replace(/[\u00a0\u202f]/g, " ").trim();
  if (!s) return null;
  const num = "(\\d{1,3}(?:[ .]\\d{3})+|\\d+)(?:[.,](\\d{1,2}))?";
  const unit = "\\s*(?:€|eur|euros?)?";
  const toNumber = (int: string, dec?: string) => Number(int.replace(/[ .]/g, "") + (dec ? "." + dec : ""));
  const simple = new RegExp(`^${num}${unit}$`, "i").exec(s);
  if (simple) return Math.round(toNumber(simple[1], simple[2]));
  const multi = new RegExp(`^(\\d{1,2})\\s*[x×*]\\s*${num}${unit}$`, "i").exec(s);
  if (multi) return Math.round(Number(multi[1]) * toNumber(multi[2], multi[3]));
  return null;
}

/** Affichage d'une offre : un montant seul est mis en euros, un texte libre est laissé tel quel. */
export function formatOffre(input: string | number | null | undefined): string {
  const s = String(input ?? "").trim();
  if (!s) return "—";
  if (/^\d[\d\s.,\u00a0\u202f]*$/.test(s)) {
    const n = parseOffreAmount(s);
    if (n !== null) return formatEUR(n);
  }
  return s;
}
