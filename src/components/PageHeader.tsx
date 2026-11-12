"use client";

import type { ReactNode } from "react";
import { Plus } from "lucide-react";
import { useProspectDrawer } from "@/components/store";

export function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  const { openNew } = useProspectDrawer();
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 lg:mb-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">{title}</h1>
        {subtitle ? <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p> : null}
      </div>
      <div className="flex items-center gap-2">
        {children}
        <button onClick={openNew} className="btn-primary">
          <Plus size={16} strokeWidth={2.6} />
          Ajouter
        </button>
      </div>
    </div>
  );
}
