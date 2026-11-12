"use client";

import { useMemo } from "react";
import { useCrmData } from "@/lib/useCrmData";

export type Commercial = {
  id: number;
  nom: string;
  actif: boolean;
  parDefaut: boolean;
  ordre: number;
  nbProspects: number;
  nbEchanges: number;
  heures: number;
  nbJoursHeures: number;
};

type Payload = { commerciaux: Commercial[]; defaut: string };

/** Équipe commerciale définie dans Paramètres (rafraîchie à chaque modification). */
export function useCommerciaux() {
  const { data, loading, reload } = useCrmData<Payload>("/api/commerciaux");
  return useMemo(() => {
    const all = data?.commerciaux ?? [];
    return {
      all,
      /** Noms sélectionnables dans les formulaires */
      actifs: all.filter((c) => c.actif).map((c) => c.nom),
      /** Tous les noms, y compris désactivés (filtres de statistiques) */
      noms: all.map((c) => c.nom),
      /** Commercial appliqué par défaut ("" s'il n'y en a aucun) */
      defaut: data?.defaut ?? "",
      loading,
      reload,
    };
  }, [data, loading, reload]);
}
