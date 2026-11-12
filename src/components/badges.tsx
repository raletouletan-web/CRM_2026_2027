import { Flame, Snowflake, Zap } from "lucide-react";
import { STATUS, URGENCE, cn, type StatutCode, type UrgenceCode } from "@/lib/crm";

export function StatusBadge({ statut, className }: { statut: string; className?: string }) {
  const s = STATUS[statut as StatutCode] ?? STATUS.nouveau_lead;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        s.badge,
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />
      {s.label}
    </span>
  );
}

const URGENCE_ICON = { chaud: Flame, moyen: Zap, froid: Snowflake } as const;

export function UrgenceBadge({ urgence, className }: { urgence: string; className?: string }) {
  const u = URGENCE[urgence as UrgenceCode] ?? URGENCE.moyen;
  const Icon = URGENCE_ICON[urgence as UrgenceCode] ?? Zap;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold text-white",
        u.badge,
        className,
      )}
    >
      <Icon size={11} strokeWidth={2.6} />
      {u.label}
    </span>
  );
}

export function PaiementBadge({ paiement }: { paiement: string }) {
  const ok = paiement === "Payé";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        ok ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20" : "bg-slate-100 text-slate-600 ring-slate-500/15",
      )}
    >
      {paiement}
    </span>
  );
}
