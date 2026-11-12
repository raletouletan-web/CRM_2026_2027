"use client";

import { useCallback, useEffect, useState } from "react";

export const CRM_CHANGED_EVENT = "crm:changed";

/** Signale à toute l'app qu'une donnée a changé (pages + tiroir se rafraîchissent). */
export function notifyChange(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(CRM_CHANGED_EVENT));
  }
}

/**
 * Récupère une URL JSON et se re-déclenche à chaque événement crm:changed,
 * afin que toutes les vues restent synchronisées avec le tiroir global.
 */
export function useCrmData<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!url) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData((await res.json()) as T);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const handler = () => void reload();
    window.addEventListener(CRM_CHANGED_EVENT, handler);
    return () => window.removeEventListener(CRM_CHANGED_EVENT, handler);
  }, [reload]);

  return { data, loading, error, reload, setData };
}
