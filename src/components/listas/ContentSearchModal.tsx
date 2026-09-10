"use client";

import { useState } from "react";
import { useContentSearch, SearchResult, TipoContenido } from "@/hooks/useContentSearch";
import { apiFetch } from "@/lib/api";
import Image from "next/image";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  listaId?: string; // When called from /listas/[id], this is the target list
};

export function ContentSearchModal({
  open,
  onOpenChange,
  onSuccess,
  listaId,
}: Props) {
  const [tipo, setTipo] = useState<TipoContenido>("pelicula");
  const [q, setQ] = useState("");
  const { results, total, fuente, loading, error, search } = useContentSearch();
  const [adding, setAdding] = useState<string | null>(null);

  const handleClose = () => {
    onOpenChange(false);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    await search({ tipo, q });
  };

  const handleAddToList = async (result: SearchResult) => {
    setAdding(`${result.fuenteExterna}:${result.idExterno}`);

    try {
      const res = await apiFetch("/api/contenidos", {
        method: "POST",
        body: JSON.stringify({
          tipo: result.tipo,
          titulo: result.titulo,
          imagenUrl: result.imagenUrl,
          fuenteExterna: result.fuenteExterna,
          idExterno: result.idExterno,
          detalle: result.metadatos,
          listaId: listaId ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al añadir");
      
      setAdding(null);
      onSuccess?.();
      if (!listaId) {
        // If not from a specific list, close modal on success
        onOpenChange(false);
      }
    } catch {
      setAdding(null);
      // Error is shown via the global error state from the hook
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={handleClose}
    >
      <div
        className="relative w-[90%] max-w-2xl max-h-[90vh] overflow-y-auto p-4 bg-white rounded-2xl dark:bg-zinc-900 border dark:border-zinc-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b">
          <h2 className="text-xl font-semibold">Buscar contenido</h2>
          <button
            onClick={handleClose}
            className="text-zinc-500 hover:text-zinc-700"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSearch} className="mt-4 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex-1 text-sm font-medium">
              Tipo
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value as TipoContenido)}
                className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800"
              >
                <option value="pelicula">Película</option>
                <option value="serie">Serie</option>
                <option value="videojuego">Videojuego</option>
                <option value="musica">Música</option>
              </select>
            </label>
            <label className="flex-1 text-sm font-medium">
              Término
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="matrix, zelda, beatles, breaking bad..."
                className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800"
              />
            </label>
            <button
              type="submit"
              disabled={loading}
              className="rounded-full bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-900 sm:self-auto"
            >
              {loading ? "Buscando..." : "Buscar"}
            </button>
          </div>

          {error && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </p>
          )}
        </form>

        {results.length > 0 && (
          <div className="mt-6 border-t pt-4">
            <p className="text-sm text-zinc-500 mb-3">
              {total} resultados · fuente {fuente} · límite 10
            </p>
            <ul className="grid gap-3 sm:grid-cols-2">
              {results.map((r) => {
                const key = `${r.fuenteExterna}:${r.idExterno}`;
                const isAdding = adding === key;
                return (
                  <li
                    key={key}
                    className="flex gap-3 rounded-2xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    {r.imagenUrl ? (
                      <Image
                        src={r.imagenUrl}
                        alt={r.titulo}
                        width={56}
                        height={80}
                        className="h-20 w-14 shrink-0 rounded-xl object-cover"
                      />
                    ) : (
                      <div className="flex h-20 w-14 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-xs text-zinc-500 dark:bg-zinc-800">
                        —
                      </div>
                    )}
                    <div className="flex min-w-0 flex-1 flex-col">
                      <h3 className="truncate text-sm font-semibold">{r.titulo}</h3>
                      <p className="text-xs text-zinc-500">
                        {r.tipo} · {r.fuenteExterna}
                        {r.metadatos?.fecha ? ` · ${String(r.metadatos.fecha).slice(0, 4)}` : ""}
                      </p>
                      <button
                        onClick={() => handleAddToList(r)}
                        disabled={!!isAdding}
                        className="mt-auto w-fit rounded-full bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-900"
                      >
                        {isAdding ? "Añadiendo..." : "+ Añadir"}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}