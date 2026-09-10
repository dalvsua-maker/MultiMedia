import { useState } from "react";
import { apiFetch } from "@/lib/api";

export type TipoContenido = "pelicula" | "serie" | "videojuego" | "musica";

export type SearchResult = {
  fuenteExterna: string;
  idExterno: string;
  tipo: TipoContenido;
  titulo: string;
  imagenUrl: string | null;
  metadatos: Record<string, unknown>;
};

type UseContentSearchReturn = {
  results: SearchResult[];
  total: number;
  fuente: string;
  loading: boolean;
  error: string | null;
  search: (params: { tipo: TipoContenido; q: string }) => Promise<void>;
  reset: () => void;
};

export function useContentSearch(): UseContentSearchReturn {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [fuente, setFuente] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = async (params: { tipo: TipoContenido; q: string }) => {
    const term = params.q.trim();
    if (term.length < 2) {
      setError("Escribe al menos 2 caracteres");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(
        `/api/contenidos/buscar?tipo=${params.tipo}&q=${encodeURIComponent(term)}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error en la búsqueda");
      setResults(data.resultados ?? []);
      setTotal(data.total ?? 0);
      setFuente(data.fuente ?? "");
    } catch (err) {
      setError((err as Error).message);
      setResults([]);
      setTotal(0);
      setFuente("");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setResults([]);
    setTotal(0);
    setFuente("");
    setLoading(false);
    setError(null);
  };

  return { results, total, fuente, loading, error, search, reset };
}
