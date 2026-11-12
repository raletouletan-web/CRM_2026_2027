"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";

export type DrawerMode = "edit" | "new";

type DrawerState = {
  open: boolean;
  mode: DrawerMode;
  prospectId: number | null;
};

type ProspectDrawerContextValue = {
  drawer: DrawerState;
  /** Ouvre la fiche d'un prospect existant — utilisable depuis toutes les vues. */
  openProspect: (id: number) => void;
  /** Ouvre le tiroir en mode création. */
  openNew: () => void;
  closeDrawer: () => void;
};

const ProspectDrawerContext = createContext<ProspectDrawerContextValue | null>(null);

export function ProspectDrawerProvider({ children }: { children: ReactNode }) {
  const [drawer, setDrawer] = useState<DrawerState>({ open: false, mode: "edit", prospectId: null });

  const openProspect = useCallback((id: number) => {
    setDrawer({ open: true, mode: "edit", prospectId: id });
  }, []);

  const openNew = useCallback(() => {
    setDrawer({ open: true, mode: "new", prospectId: null });
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawer((d) => ({ ...d, open: false }));
  }, []);

  const value = useMemo(
    () => ({ drawer, openProspect, openNew, closeDrawer }),
    [drawer, openProspect, openNew, closeDrawer],
  );

  return <ProspectDrawerContext.Provider value={value}>{children}</ProspectDrawerContext.Provider>;
}

export function useProspectDrawer(): ProspectDrawerContextValue {
  const ctx = useContext(ProspectDrawerContext);
  if (!ctx) throw new Error("useProspectDrawer doit être utilisé dans ProspectDrawerProvider");
  return ctx;
}
