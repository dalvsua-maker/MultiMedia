"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

type Lista = {
  id: string;
  nombre: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contentId: string | null;
  contentTitle: string;
  onSuccess?: () => void;
};

export function AddToListModal({
  open,
  onOpenChange,
  contentId,
  contentTitle,
  onSuccess,
}: Props) {
  const [listas, setListas] = useState<Lista[]>([]);
  const [selectedListaId, setSelectedListaId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [loadingLists, setLoadingLists] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!open) return;
    const load = async () => {
      setLoadingLists(true);
      setError(null);
      try {
        const res = await apiFetch("/api/listas");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Error cargando listas");
        setListas(data ?? []);
        if (data?.length > 0) {
          setSelectedListaId(data[0].id);
        }
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoadingLists(false);
      }
    };
    load();
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    if (!selectedListaId || !contentId) return;
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/listas/${selectedListaId}/contenidos`, {
        method: "POST",
        body: JSON.stringify({ contenidoId: contentId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al añadir");
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onOpenChange(false);
        onSuccess?.();
      }, 1500);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (!open || !contentId) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="relative w-[90%] max-w-md p-5 bg-white rounded-2xl dark:bg-zinc-900 border dark:border-zinc-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b">
          <h2 className="text-lg font-semibold">Añadir a lista</h2>
          <button
            onClick={() => onOpenChange(false)}
            className="text-zinc-500 hover:text-zinc-700"
          >
            ✕
          </button>
        </div>

        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
          Añadiendo: <span className="font-medium">{contentTitle}</span>
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Lista destino</label>
            <select
              value={selectedListaId}
              onChange={(e) => setSelectedListaId(e.target.value)}
              disabled={loadingLists}
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800"
            >
              {loadingLists && listas.length === 0 ? (
                <option disabled>Cargando listas...</option>
              ) : listas.length === 0 ? (
                <option disabled>No tienes listas</option>
              ) : (
                listas.map((lista) => (
                  <option key={lista.id} value={lista.id}>
                    {lista.nombre}
                  </option>
                ))
              )}
            </select>
          </div>

          {error && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </p>
          )}
          {success && (
            <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              Añadido a la lista
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !selectedListaId}
            className="w-full rounded-full bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-900"
          >
            {loading ? "Añadiendo..." : "Añadir a lista"}
          </button>
        </form>
      </div>
    </div>
  );
}