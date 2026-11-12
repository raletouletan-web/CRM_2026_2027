import type { CallRow, ProspectRow } from "@/db/schema";

export type Prospect = ProspectRow;
export type Call = CallRow;

export type ProspectDetail = Prospect & { calls: Call[] };

export type StatsPayload = {
  total: number;
  appels: number;
  closings: number;
  caTotal: number;
  tauxClosing: number; // 0..1
  caParLead: number;
  appelsParClosing: number;
  appelsParLead: number;
  parStatut: Record<string, number>;
  parUrgence: Record<string, number>;
  closingsParOffre: { offre: string; count: number; ca: number }[];
  prospectsCloses: Prospect[];
  rappelsAujourdhui: number;
  nouveauxCetteSemaine: number;
};

export type ReminderItem = Prospect;

export type ActivityItem = Call & { prospectNom: string; prospectPrenom: string };

export type ActivitiesPayload = {
  date: string;
  rappels: ReminderItem[];
  activites: ActivityItem[];
};

export type ProspectListQuery = {
  q?: string;
  statut?: string;
  urgence?: string;
  sort?: "recent" | "rappel" | "nom" | "appels" | "ca";
};
