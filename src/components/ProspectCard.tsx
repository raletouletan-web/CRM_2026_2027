"use client";

import { CalendarClock, CreditCard, Mail, Pencil, Phone, Trash2 } from "lucide-react";
import { formatDate, formatOffre, fullName, initials } from "@/lib/crm";
import type { Prospect } from "@/lib/types";
import { PaiementBadge, StatusBadge, UrgenceBadge } from "@/components/badges";
import { cn } from "@/lib/crm";

const AVATAR_COLORS = [
  "bg-slate-100 text-slate-600",
  "bg-blue-100 text-blue-700",
  "bg-violet-100 text-violet-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
  "bg-sky-100 text-sky-700",
];

export function avatarColor(id: number): string {
  return AVATAR_COLORS[id % AVATAR_COLORS.length];
}

export function Avatar({ prospect, size = "md" }: { prospect: { id: number; nom: string; prenom: string }; size?: "sm" | "md" }) {
  return (
    <span
      className={cn(
        "flex shrink-0 select-none items-center justify-center rounded-full font-semibold uppercase",
        avatarColor(prospect.id),
        size === "sm" ? "h-8 w-8 text-[11px]" : "h-11 w-11 text-sm",
      )}
    >
      {initials(prospect)}
    </span>
  );
}

/** Carte prospect cliquable : un clic OUVRE LA FICHE (depuis toutes les vues). */
export function ProspectCard({
  prospect,
  onOpen,
  onDelete,
  compact = false,
}: {
  prospect: Prospect;
  onOpen: (id: number) => void;
  onDelete?: (id: number) => void;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <button
        onClick={() => onOpen(prospect.id)}
        className="block w-full rounded-xl border border-slate-200/80 bg-white p-3 text-left shadow-sm transition hover:-translate-y-px hover:border-blue-300 hover:shadow-md"
      >
        <div className="flex items-center gap-2">
          <Avatar prospect={prospect} size="sm" />
          <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-slate-800">{fullName(prospect)}</span>
        </div>
        <div className="mt-2 flex items-center gap-1.5">
          <UrgenceBadge urgence={prospect.urgence} className="!px-1.5 !py-px !text-[10px]" />
          {prospect.statut !== "close" && prospect.statut !== "perdu" ? (
            <StatusBadge statut={prospect.statut} className="!px-1.5 !py-px !text-[10px]" />
          ) : null}
        </div>
        {prospect.offreProposee ? (
          <p className="mt-1.5 line-clamp-3 text-[11px] leading-snug text-emerald-600">{formatOffre(prospect.offreProposee)}</p>
        ) : null}
      </button>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(prospect.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpen(prospect.id);
      }}
      className="card group cursor-pointer p-4 transition hover:-translate-y-px hover:border-blue-300 hover:shadow-lg sm:p-5"
    >
      <div className="flex items-start gap-3">
        <Avatar prospect={prospect} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-[15px] font-bold text-slate-900">
              {prospect.prenom} <span className="uppercase">{prospect.nom}</span>
            </h3>
            {prospect.entreprise ? (
              <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-700">
                {prospect.entreprise}
              </span>
            ) : null}
            <UrgenceBadge urgence={prospect.urgence} />
          </div>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px] text-slate-500">
            {prospect.telephone ? (
              <span className="inline-flex items-center gap-1">
                <Phone size={12} className="text-slate-400" />
                {prospect.telephone}
              </span>
            ) : null}
            {prospect.email ? (
              <span className="inline-flex min-w-0 items-center gap-1">
                <Mail size={12} className="shrink-0 text-slate-400" />
                <span className="truncate">{prospect.email}</span>
              </span>
            ) : null}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <StatusBadge statut={prospect.statut} />
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-500/10">
              <CreditCard size={11} />
              {prospect.financement || "Non défini"}
            </span>
            {prospect.offreProposee ? (
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                {formatOffre(prospect.offreProposee)}
              </span>
            ) : null}
            {prospect.statut === "close" ? <PaiementBadge paiement={prospect.statutPaiement} /> : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
          <button
            className="icon-btn"
            title="Modifier"
            onClick={(e) => {
              e.stopPropagation();
              onOpen(prospect.id);
            }}
          >
            <Pencil size={16} />
          </button>
          {onDelete ? (
            <button
              className="icon-btn danger"
              title="Supprimer"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(prospect.id);
              }}
            >
              <Trash2 size={16} />
            </button>
          ) : null}
        </div>
      </div>

      {prospect.resumeAppel ? (
        <div className="mt-3">
          <p className="text-xs font-medium text-slate-400">Dernier résumé :</p>
          <p className="mt-0.5 line-clamp-2 text-[13px] leading-relaxed text-slate-600">{prospect.resumeAppel}</p>
        </div>
      ) : null}

      {prospect.prochainRappel ? (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
          <CalendarClock size={13} className="text-blue-500" />
          Prochain rappel : <span className="font-medium text-slate-700">{formatDate(prospect.prochainRappel)}</span>
          {prospect.heureRappel ? <span className="text-slate-400">à {prospect.heureRappel}</span> : null}
        </p>
      ) : null}
    </div>
  );
}
