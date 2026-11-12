"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Search, Trash2, Upload, X } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { ProspectCard } from "@/components/ProspectCard";
import { useProspectDrawer } from "@/components/store";
import { useCrmData, notifyChange } from "@/lib/useCrmData";
import { toCsv, downloadCsv } from "@/lib/csv";
import { readTableFile } from "@/lib/read-table";
import { TABLE_COLUMNS, mapHeaders, normalizeHeader, type HeaderAnalysis, type TableRow } from "@/lib/table-format";
import { STATUS, STATUS_ORDER, URGENCE } from "@/lib/crm";
import type { Prospect } from "@/lib/types";

const SORTS = [
  { value: "recent", label: "Plus récents" },
  { value: "rappel", label: "Prochain rappel" },
  { value: "nom", label: "Nom A → Z" },
  { value: "appels", label: "Plus d'appels" },
  { value: "ca", label: "CA décroissant" },
] as const;

type ImportPreview = { fileName: string; rows: Record<string, string>[]; analysis: HeaderAnalysis };

type ImportResult = {
  created: number;
  updated: number;
  skipped: number;
  doublons: number;
  historique: number;
  datesNonReconnues: number;
  replaced: boolean;
};

export default function ProspectsPage() {
  const { openProspect, openNew } = useProspectDrawer();
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [statut, setStatut] = useState("tous");
  const [urgence, setUrgence] = useState("toutes");
  const [sort, setSort] = useState<(typeof SORTS)[number]["value"]>("recent");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Import : aperçu du fichier avant validation, puis compte-rendu
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // Filtre initial éventuel dans l'URL (?statut=...&urgence=...)
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get("statut")) setStatut(p.get("statut")!);
    if (p.get("urgence")) setUrgence(p.get("urgence")!);
    if (p.get("q")) setQ(p.get("q")!);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounce de la recherche
  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  const url = useMemo(() => {
    const params = new URLSearchParams();
    if (qDebounced) params.set("q", qDebounced);
    if (statut !== "tous") params.set("statut", statut);
    if (urgence !== "toutes") params.set("urgence", urgence);
    params.set("sort", sort);
    return `/api/prospects?${params.toString()}`;
  }, [qDebounced, statut, urgence, sort]);

  const { data: prospects, loading } = useCrmData<Prospect[]>(url);

  async function removeOne(id: number) {
    const p = prospects?.find((x) => x.id === id);
    if (!window.confirm(`Supprimer « ${p ? `${p.prenom} ${p.nom}` : "ce prospect"} » ?`)) return;
    const res = await fetch(`/api/prospects/${id}`, { method: "DELETE" });
    if (res.ok) notifyChange();
  }

  async function wipeAll() {
    if (!window.confirm("ATTENTION : supprimer TOUS les prospects et tout leur historique ?")) return;
    setBusy(true);
    try {
      await fetch("/api/prospects", { method: "DELETE" });
      notifyChange();
    } finally {
      setBusy(false);
    }
  }

  /** Export au format du tableau : mêmes 22 en-têtes, même ordre (liste filtrée affichée). */
  async function exportCsv() {
    if (!prospects?.length) return;
    setBusy(true);
    try {
      const res = await fetch("/api/prospects/export", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const all = (await res.json()) as { id: number; row: TableRow }[];
      const byId = new Map(all.map((r) => [r.id, r.row]));
      const rows = prospects.map((p) => byId.get(p.id)).filter((r): r is TableRow => Boolean(r));
      downloadCsv(
        `prospects-${new Date().toISOString().slice(0, 10)}.csv`,
        toCsv(
          rows,
          TABLE_COLUMNS.map((c) => ({ key: c.label, label: c.label })),
        ),
      );
    } catch (e) {
      window.alert(`Échec de l'export : ${e instanceof Error ? e.message : "erreur inconnue"}`);
    } finally {
      setBusy(false);
    }
  }

  /** Étape 1 : lecture du fichier et vérification des en-têtes (rien n'est encore enregistré). */
  async function onFileChosen(file: File) {
    setBusy(true);
    setImportError(null);
    setImportResult(null);
    try {
      const table = await readTableFile(file);
      if (table.rows.length === 0) {
        window.alert("Aucune ligne de données trouvée dans ce fichier.");
        return;
      }
      setPreview({ fileName: file.name, rows: table.rows, analysis: mapHeaders(table.headers) });
    } catch (e) {
      window.alert(`Lecture du fichier impossible : ${e instanceof Error ? e.message : "erreur inconnue"}`);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  /** Étape 2 : enregistrement. */
  async function runImport(replace: boolean) {
    if (!preview) return;
    if (
      replace &&
      !window.confirm(
        "Remplacer TOUTES les données actuelles (prospects, fiches d'appels et heures de prospection) par le contenu de ce fichier ?\n\nCette action est irréversible.",
      )
    ) {
      return;
    }
    setBusy(true);
    setImportError(null);
    try {
      const res = await fetch("/api/prospects/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: preview.rows, replace }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) throw new Error(j?.error ?? `HTTP ${res.status}`);
      setImportResult(j as ImportResult);
      notifyChange();
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "erreur inconnue");
    } finally {
      setBusy(false);
    }
  }

  function closeImport() {
    setPreview(null);
    setImportResult(null);
    setImportError(null);
  }

  const canImport = preview?.analysis.recognized.some((r) => r.key === "nom" || r.key === "prenom") ?? false;

  return (
    <>
      <PageHeader title="Prospects" subtitle="Gérez et suivez vos prospects" />

      {/* Barre d'outils */}
      <div className="card mb-4 flex flex-wrap items-center gap-2 p-3">
        <div className="relative min-w-[200px] flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="field !pl-9"
            placeholder="Rechercher… (nom, téléphone, email)"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <select className="field !w-auto" value={statut} onChange={(e) => setStatut(e.target.value)}>
          <option value="tous">Tous les statuts</option>
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {STATUS[s].label}
            </option>
          ))}
        </select>
        <select className="field !w-auto" value={urgence} onChange={(e) => setUrgence(e.target.value)}>
          <option value="toutes">Toutes urgences</option>
          {Object.entries(URGENCE).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>
        <select className="field !w-auto" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <div className="ml-auto flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.txt,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onFileChosen(f);
            }}
          />
          <button
            className="btn-ghost !text-emerald-700 hover:!border-emerald-200 hover:!bg-emerald-50"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            title="Importer un tableau (.csv ou .xlsx)"
          >
            <Upload size={15} /> Importer
          </button>
          <button
            className="btn-ghost !text-blue-700 hover:!border-blue-200 hover:!bg-blue-50"
            disabled={busy || !prospects?.length}
            onClick={() => void exportCsv()}
            title="Exporter au format du tableau (22 colonnes)"
          >
            <Download size={15} /> Exporter
          </button>
          <button className="btn-danger-ghost" disabled={busy} onClick={() => void wipeAll()}>
            <Trash2 size={15} /> Tout effacer
          </button>
        </div>
      </div>

      {/* Résultats */}
      <div className="mb-2 flex items-center justify-between px-1">
        <p className="text-xs font-medium text-slate-400">
          {loading ? "Chargement…" : `${prospects?.length ?? 0} prospect(s)`}
          {qDebounced ? ` pour « ${qDebounced} »` : ""}
        </p>
        <button className="text-xs font-semibold text-blue-600 hover:underline" onClick={openNew}>
          + Nouveau prospect
        </button>
      </div>

      <div className="space-y-3">
        {prospects?.map((p) => (
          <ProspectCard key={p.id} prospect={p} onOpen={openProspect} onDelete={removeOne} />
        ))}
        {!loading && prospects?.length === 0 ? (
          <div className="card flex flex-col items-center justify-center py-16 text-center">
            <Search size={28} className="text-slate-300" />
            <p className="mt-3 text-sm font-medium text-slate-500">Aucun prospect trouvé</p>
            <p className="mt-1 text-xs text-slate-400">Essayez un autre terme ou importez votre tableau (.csv ou .xlsx).</p>
            <button className="btn-primary mt-4" onClick={openNew}>
              + Ajouter un prospect
            </button>
          </div>
        ) : null}
      </div>

      {/* Fenêtre d'import : contrôle des en-têtes puis compte-rendu */}
      {preview ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[2px]">
          <div className="card animate-pop-in flex max-h-[90vh] w-full max-w-2xl flex-col p-0 shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <FileSpreadsheet size={18} />
                </span>
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-slate-900">Importer le tableau</h3>
                  <p className="truncate text-xs text-slate-500">
                    {preview.fileName} · {preview.rows.length} ligne{preview.rows.length > 1 ? "s" : ""}
                  </p>
                </div>
              </div>
              <button className="icon-btn" onClick={closeImport} title="Fermer">
                <X size={18} />
              </button>
            </div>

            <div className="scrollbar-thin flex-1 space-y-4 overflow-y-auto px-5 py-4 text-sm">
              {importResult ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
                  <p className="flex items-center gap-2 font-bold text-emerald-800">
                    <CheckCircle2 size={17} /> Import terminé
                  </p>
                  <ul className="mt-2 space-y-1 text-[13px] text-emerald-900">
                    <li>
                      <strong>{importResult.created}</strong> fiche(s) créée(s) · <strong>{importResult.updated}</strong>{" "}
                      mise(s) à jour (même ID)
                    </li>
                    <li>
                      <strong>{importResult.historique}</strong> ligne(s) d'historique reprise(s) dans les fiches
                    </li>
                    {importResult.replaced ? <li>Les données précédentes ont été remplacées.</li> : null}
                  </ul>
                  {importResult.skipped + importResult.doublons + importResult.datesNonReconnues > 0 ? (
                    <ul className="mt-2 space-y-1 border-t border-emerald-200 pt-2 text-[13px] text-amber-800">
                      {importResult.skipped > 0 ? (
                        <li>{importResult.skipped} ligne(s) ignorée(s) : ni nom ni prénom.</li>
                      ) : null}
                      {importResult.doublons > 0 ? (
                        <li>{importResult.doublons} ligne(s) en double dans le fichier (même ID) : la dernière a été gardée.</li>
                      ) : null}
                      {importResult.datesNonReconnues > 0 ? (
                        <li>{importResult.datesNonReconnues} date(s) non reconnue(s), laissée(s) vide(s).</li>
                      ) : null}
                    </ul>
                  ) : null}
                </div>
              ) : (
                <>
                  <div>
                    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                      Colonnes reconnues ({preview.analysis.recognized.length})
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {preview.analysis.recognized.map((r) => (
                        <span
                          key={r.header}
                          className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20"
                        >
                          {normalizeHeader(r.header) === normalizeHeader(r.label) ? r.label : `${r.header} → ${r.label}`}
                        </span>
                      ))}
                    </div>
                  </div>

                  {preview.analysis.missing.length > 0 ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3">
                      <p className="flex items-center gap-1.5 text-xs font-bold text-amber-800">
                        <AlertTriangle size={14} /> Colonnes du tableau absentes de ce fichier
                      </p>
                      <p className="mt-1 text-xs text-amber-800">{preview.analysis.missing.join(" · ")}</p>
                      <p className="mt-1 text-[11px] text-amber-700">
                        Ces informations ne seront pas modifiées sur les fiches existantes et resteront vides sur les
                        nouvelles.
                      </p>
                    </div>
                  ) : null}

                  {preview.analysis.ignored.length > 0 ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs font-bold text-slate-600">Colonnes non reconnues (non importées)</p>
                      <p className="mt-1 text-xs text-slate-500">{preview.analysis.ignored.join(" · ")}</p>
                    </div>
                  ) : null}

                  {!canImport ? (
                    <p className="rounded-lg bg-rose-50 px-3 py-2 text-[13px] font-medium text-rose-700 ring-1 ring-rose-200">
                      Import impossible : aucune colonne « Nom » ou « Prénom » n'a été reconnue. Vérifiez la première
                      ligne du fichier.
                    </p>
                  ) : (
                    <ul className="list-disc space-y-1 pl-5 text-xs text-slate-500">
                      <li>Une ligne dont l'ID existe déjà met la fiche à jour au lieu de créer un doublon.</li>
                      <li>
                        L'historique importé apparaît dans la fiche du prospect. Il n'entre pas dans les statistiques
                        de performance, car le tableau ne contient ni résultat ni durée d'appel.
                      </li>
                    </ul>
                  )}

                  {importError ? (
                    <p className="rounded-lg bg-rose-50 px-3 py-2 text-[13px] font-medium text-rose-700 ring-1 ring-rose-200">
                      Échec de l'import : {importError}
                    </p>
                  ) : null}
                </>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 px-5 py-3.5">
              {importResult ? (
                <button className="btn-primary" onClick={closeImport}>
                  Fermer
                </button>
              ) : (
                <>
                  <button className="btn-ghost mr-auto" onClick={closeImport} disabled={busy}>
                    Annuler
                  </button>
                  <button
                    className="btn-danger-ghost"
                    disabled={busy || !canImport}
                    onClick={() => void runImport(true)}
                    title="Efface prospects, fiches d'appels et heures de prospection, puis importe le fichier"
                  >
                    Remplacer toutes les données
                  </button>
                  <button className="btn-primary" disabled={busy || !canImport} onClick={() => void runImport(false)}>
                    {busy ? "Import en cours…" : "Ajouter / mettre à jour"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
