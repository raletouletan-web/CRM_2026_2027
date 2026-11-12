"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, KanbanSquare, LayoutDashboard, Plus, Settings, Target, Users } from "lucide-react";
import { cn } from "@/lib/crm";
import { useProspectDrawer } from "@/components/store";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/prospects", label: "Prospects", icon: Users },
  { href: "/pipeline", label: "Pipeline", icon: KanbanSquare },
  { href: "/stats", label: "Statistiques CRM", icon: BarChart3 },
  { href: "/performance", label: "Performance B2C", icon: Target },
  { href: "/parametres", label: "Paramètres", icon: Settings },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const { openNew } = useProspectDrawer();

  return (
    <aside className="sticky top-0 flex h-screen w-[68px] shrink-0 flex-col border-r border-slate-200/80 bg-white lg:w-[240px]">
      <div className="flex items-center gap-2.5 border-b border-slate-100 px-3 py-4 lg:px-5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-orange-500 text-white shadow-md shadow-rose-500/25">
          <Target size={18} strokeWidth={2.4} />
        </span>
        <div className="hidden lg:block">
          <p className="text-[15px] font-bold leading-tight text-slate-900">CRM Prospection</p>
          <p className="text-xs text-slate-400">Gérez vos leads</p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-2 lg:p-3">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                "justify-center lg:justify-start",
                active ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
              )}
            >
              <Icon size={18} className={cn("shrink-0", active ? "text-blue-600" : "text-slate-400 group-hover:text-slate-600")} />
              <span className="hidden lg:inline">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-100 p-2 lg:p-3">
        <button
          onClick={openNew}
          className="btn-primary w-full justify-center !px-2 lg:!px-4"
          title="Nouveau prospect"
        >
          <Plus size={17} strokeWidth={2.6} />
          <span className="hidden lg:inline">Nouveau prospect</span>
        </button>
      </div>
    </aside>
  );
}
