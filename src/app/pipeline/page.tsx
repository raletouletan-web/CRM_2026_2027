"use client";

import { useMemo, useState } from "react";
import { Inbox } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { ProspectCard } from "@/components/ProspectCard";
import { useProspectDrawer } from "@/components/store";
import { useCrmData, notifyChange } from "@/lib/useCrmData";
import { STATUS, STATUS_ORDER, cn, type StatutCode } from "@/lib/crm";
import type { Prospect } from "@/lib/types";

export default function PipelinePage() {
  const { openProspect } = useProspectDrawer();
  const { data: prospects, loading } = useCrmData<Prospect[]>("/api/prospects?sort=rappel");
  const [dropTarget, setDropTarget] = useState<StatutCode | null>(null);
  const [draggingId, setDraggingId] = useState<number | null>(null);

  const columns = useMemo(() => {
    const map = new Map<StatutCode, Prospect[]>();
    for (const code of STATUS_ORDER) map.set(code, []);
    for (const p of prospects ?? []) {
      const code = (STATUS_ORDER as string[]).includes(p.statut) ? (p.statut as StatutCode) : "nouveau_lead";
      map.get(code)!.push(p);
    }
    return STATUS_ORDER.map((code) => ({ code, items: map.get(code) ?? [] }));
  }, [prospects]);

  async function moveProspect(id: number, target: StatutCode) {
    setDropTarget(null);
    const current = prospects?.find((p) => p.id === id);
    if (!current || current.statut === target) return;
    const res = await fetch(`/api/prospects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statut: target }),
    });
    if (res.ok) {
      // Journalise le changement de statut dans l'historique (sans compter un appel)
      await fetch(`/api/prospects/${id}/calls`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "statut",
          resume: `Statut : ${STATUS[current.statut as StatutCode]?.label ?? current.statut} → ${STATUS[target].label}`,
          increment: false,
        }),
      });
      notifyChange();
    }
  }

  return (
    <>
      <PageHeader title="Pipeline" subtitle="Visualisez votre entonnoir de vente — glissez une carte pour changer de statut" />

      {loading && !prospects ? (
        <p className="px-1 text-sm text-slate-400">Chargement du pipeline…</p>
      ) : (
        <div className="scrollbar-thin -mx-4 flex gap-3 overflow-x-auto px-4 pb-4 lg:-mx-8 lg:px-8">
          {columns.map(({ code, items }) => (
            <section
              key={code}
              onDragOver={(e) => {
                e.preventDefault();
                setDropTarget(code);
              }}
              onDragLeave={() => setDropTarget((d) => (d === code ? null : d))}
              onDrop={(e) => {
                e.preventDefault();
                const id = Number(e.dataTransfer.getData("text/plain"));
                setDraggingId(null);
                if (id) void moveProspect(id, code);
              }}
              className={cn(
                "flex max-h-[calc(100vh-170px)] w-[272px] shrink-0 flex-col rounded-2xl border p-3 transition-colors",
                STATUS[code].column,
                dropTarget === code ? "ring-2 ring-blue-400" : "",
              )}
            >
              <header className="mb-3 flex items-center justify-between px-1">
                <h3 className="flex items-center gap-2 text-[13px] font-bold text-slate-800">
                  <span className={cn("h-2 w-2 rounded-full", STATUS[code].dot)} />
                  {STATUS[code].label}
                </h3>
                <span
                  className={cn(
                    "rounded-lg px-2 py-0.5 text-xs font-bold",
                    items.length > 0 ? "bg-white text-slate-700 ring-1 ring-slate-200" : "text-slate-400",
                  )}
                >
                  {items.length}
                </span>
              </header>
              <div className="scrollbar-thin flex-1 space-y-2.5 overflow-y-auto pr-0.5">
                {items.map((p) => (
                  <div
                    key={p.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", String(p.id));
                      e.dataTransfer.effectAllowed = "move";
                      setDraggingId(p.id);
                    }}
                    onDragEnd={() => setDraggingId(null)}
                    className={cn("cursor-grab active:cursor-grabbing", draggingId === p.id ? "opacity-40" : "")}
                  >
                    <ProspectCard prospect={p} onOpen={openProspect} compact />
                  </div>
                ))}
                {items.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200/80 py-8 text-center">
                    <Inbox size={20} className="text-slate-300" />
                    <p className="mt-2 text-xs text-slate-400">Vide</p>
                  </div>
                ) : null}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
