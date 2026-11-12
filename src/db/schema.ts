import { boolean, doublePrecision, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

/** Identifiant externe au format du tableau d'import (ex. « ebni3pl2gt7 »). */
export function generateExternalId(): string {
  return (Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)).slice(0, 11);
}

export const prospects = pgTable("prospects", {
  id: serial("id").primaryKey(),
  // Colonne « ID » du tableau : sert à mettre à jour une fiche existante lors d'un ré-import.
  externalId: text("external_id")
    .notNull()
    .unique()
    .$defaultFn(() => generateExternalId()),
  nom: text("nom").notNull(),
  prenom: text("prenom").default("").notNull(),
  telephone: text("telephone").default("").notNull(),
  email: text("email").default("").notNull(),
  situationPro: text("situation_pro").default("").notNull(),
  metier: text("metier").default("").notNull(),
  diplome: text("diplome").default("").notNull(),
  financement: text("financement").default("Non défini").notNull(),
  urgence: text("urgence").default("moyen").notNull(), // chaud | moyen | froid
  statut: text("statut").default("nouveau_lead").notNull(), // voir STATUS_CODES dans src/lib/crm.ts
  nbAppels: integer("nb_appels").default(0).notNull(),
  dernierContact: timestamp("dernier_contact", { withTimezone: true }),
  prochainRappel: timestamp("prochain_rappel", { withTimezone: true }),
  heureRappel: text("heure_rappel").default("").notNull(), // "HH:MM"
  resumeAppel: text("resume_appel").default("").notNull(),
  objections: text("objections").default("").notNull(),
  // Texte libre, comme dans le tableau : « 1400 », « 3 x 350€ », « FOLLOW UP CPF 2800 »…
  offreProposee: text("offre_proposee"),
  statutPaiement: text("statut_paiement").default("Non défini").notNull(),
  caGenere: integer("ca_genere").default(0).notNull(),
  source: text("source").default("").notNull(),
  entreprise: text("entreprise").default("").notNull(),
  commercialAssigne: text("commercial_assigne").default("").notNull(), // nom d'un commercial (voir table commerciaux)
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const calls = pgTable("calls", {
  id: serial("id").primaryKey(),
  prospectId: integer("prospect_id")
    .references(() => prospects.id, { onDelete: "cascade" })
    .notNull(),
  commercial: text("commercial").default("").notNull(),
  entreprise: text("entreprise").default("").notNull(),
  telephone: text("telephone").default("").notNull(),
  date: timestamp("date", { withTimezone: true }).defaultNow().notNull(),
  // appel | note | rdv | email | statut | sms | historique (ligne reprise de la colonne « Historique Appels »)
  type: text("type").default("appel").notNull(),
  resultat: text("resultat").default("pas_reponse").notNull(),
  // faux_numero | pas_reponse | repondeur | barrage | mauvais_interlocuteur | contact_utile_refus | contact_utile_rappel | contact_utile_rdv
  dureeSecondes: integer("duree_secondes").default(0).notNull(),
  tempsTraitement: integer("temps_traitement").default(0).notNull(), // secondes post-appel
  duree: integer("duree").default(0).notNull(), // minutes (rétro-compatibilité)
  motifRefus: text("motif_refus").default("").notNull(), // pas_budget | deja_equipe | mauvais_moment | pas_bon_interlocuteur | autre
  rdvHonore: text("rdv_honore").default("a_venir").notNull(), // a_venir | oui | non
  clientSigne: text("client_signe").default("non").notNull(), // non | oui
  resume: text("resume").default("").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const prospectingHours = pgTable("prospecting_hours", {
  id: serial("id").primaryKey(),
  commercial: text("commercial").notNull(),
  date: text("date").notNull(), // YYYY-MM-DD
  heures: doublePrecision("heures").default(3.5).notNull(), // heures réellement passées
  notes: text("notes").default("").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const financialSettings = pgTable("financial_settings", {
  id: serial("id").primaryKey(),
  mois: text("mois").notNull().unique(), // YYYY-MM
  coutProspection: integer("cout_prospection").default(4500).notNull(), // Coût de la prospection du mois en €
  panierMoyen: integer("panier_moyen").default(2500).notNull(), // Panier moyen par client signé en €
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Équipe commerciale, gérée dans la page Paramètres.
export const commerciaux = pgTable("commerciaux", {
  id: serial("id").primaryKey(),
  nom: text("nom").notNull().unique(),
  actif: boolean("actif").default(true).notNull(), // désactivé = plus proposé à la saisie, historique conservé
  parDefaut: boolean("par_defaut").default(false).notNull(), // appliqué quand aucun commercial n'est précisé
  ordre: integer("ordre").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type CommercialRow = typeof commerciaux.$inferSelect;
export type ProspectRow = typeof prospects.$inferSelect;
export type ProspectInsert = typeof prospects.$inferInsert;
export type CallRow = typeof calls.$inferSelect;
export type CallInsert = typeof calls.$inferInsert;
export type ProspectingHoursRow = typeof prospectingHours.$inferSelect;
export type ProspectingHoursInsert = typeof prospectingHours.$inferInsert;
export type FinancialSettingsRow = typeof financialSettings.$inferSelect;
export type FinancialSettingsInsert = typeof financialSettings.$inferInsert;
