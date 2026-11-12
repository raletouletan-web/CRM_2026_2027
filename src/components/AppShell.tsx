"use client";

import type { ReactNode } from "react";
import { ProspectDrawerProvider } from "@/components/store";
import { Sidebar } from "@/components/Sidebar";
import { ProspectDrawer } from "@/components/ProspectDrawer";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <ProspectDrawerProvider>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-6">{children}</main>
      </div>
      {/* Tiroir global : la fiche client s'ouvre depuis N'IMPORTE QUELLE vue */}
      <ProspectDrawer />
    </ProspectDrawerProvider>
  );
}
