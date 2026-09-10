"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import Image from "next/image";

type Estado = "pendiente" | "en_proceso" | "visto";
type Tipo = "pelicula" | "serie" | "videojuego" | "musica";

type UserContentItem = {
  contenido: {
    id: string;
    tipo: Tipo;
    titulo: string;
    imagenUrl: string | null;
    fuenteExterna: string;
    idExterno: string;
  };
  estado: Estado;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  listaId: string; // Target list
  excludeIds?: string[]; // Content IDs already in the list
};

const TIPO_LABEL: Record<Tipo, string> = {
  pelicula: "Película",
  serie: "Serie",
  videojuego: "Videojuego",
  musica: "Música",
};

const ESTADO_LABEL: Record<Estado, string> = {
  pendiente: "Pendiente",
  en_proceso: "En proceso",
  visto: "Visto",
};

export function UserContentPickerModal({
  open,
  onOpenChange,
  onSuccess,
  listaId,
  excludeIds = [],
}: Props) {
  const [items, setItems] = useState<UserContentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredItems = items
    .filter((it) => !excludeIds.includes(it.contenido.id))
    .filter((it) =>
      it.contenido.titulo.toLowerCase().includes(searchQuery.toLowerCase())
    );

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch("/api/usuario-contenido");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Error cargando contenidos");
        if (!cancelled) setItems(data.contenidos ?? []);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const handleClose = () => {
    onOpenChange(false);
  };

  const handleAddToList = async (contenidoId: string) => {
    setAdding(contenidoId);
    setError(null);
    try {
      const res = await apiFetch(`/api/listas/${listaId}/contenidos`, {
        method: "POST",
        body: JSON.stringify({ contenidoId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al añadir");
      setAdding(null);
      onSuccess?.();
      onOpenChange(false);
    } catch (err) {
      setError((err as Error).message);
      setAdding(null);
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
          <h2 className="text-xl font-semibold">Mis contenidos</h2>
          <button
            onClick={handleClose}
            className="text-zinc-500 hover:text-zinc-700"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <label className="text-sm font-medium">
            Buscar
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filtrar por título..."
              className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800"
            />
          </label>

          {error && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </p>
          )}

          {loading ? (
            <div className="text-center py-8 text-zinc-500">Cargando...</div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-8 text-zinc-500">
              {items.length === 0
                ? "No tienes contenidos en tu biblioteca. Ve a Buscar para añadir algunos."
                : "No hay contenidos que coincidan con la búsqueda o todos ya están en la lista."}
            </div>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 max-h-[60vh] overflow-y-auto">
              {filteredItems.map((it) => {
                const isAdding = adding === it.contenido.id;
                return (
                  <li
                    key={it.contenido.id}
                    className="flex gap-3 rounded-2xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    {it.contenido.imagenUrl ? (
                      <Image
                        src={it.contenido.imagenUrl}
                        alt={it.contenido.titulo}
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
                      <h3 className="truncate text-sm font-semibold">{it.contenido.titulo}</h3>
                      <p className="text-xs text-zinc-500">
                        {TIPO_LABEL[it.contenido.tipo]} · {it.contenido.fuenteExterna}
                      </p>
                      <span
                        className="mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                      >
                        {ESTADO_LABEL[it.estado]}
                      </span>
                      <button
                        onClick={() => handleAddToList(it.contenido.id)}
                        disabled={!!isAdding}
                        className="mt-auto w-fit rounded-full bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-900"
                      >
                        {isAdding ? "Añadiendo..." : "+ Añadir a esta lista"}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}