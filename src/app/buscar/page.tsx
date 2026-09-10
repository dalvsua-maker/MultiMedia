"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Header } from "@/components/Header";
import { apiFetch } from "@/lib/api";
import Image from "next/image";

type Tipo = "pelicula" | "serie" | "videojuego" | "musica";
type Resultado = {
  fuenteExterna: string;
  idExterno: string;
  tipo: Tipo;
  titulo: string;
  imagenUrl: string | null;
  metadatos: Record<string, unknown>;
};

type Lista = {
  id: string;
  nombre: string;
};

export default function BuscarPage() {
  const { usuario, loading } = useAuth();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [tipo, setTipo] = useState<Tipo>("pelicula");
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [total, setTotal] = useState(0);
  const [fuente, setFuente] = useState<string>("");
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [addingToList, setAddingToList] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [showListSelector, setShowListSelector] = useState<string | null>(null);
  const [listas, setListas] = useState<Lista[]>([]);
  const [loadingListas, setLoadingListas] = useState(false);

  useEffect(() => {
    if (!loading && !usuario) router.push("/login");
  }, [loading, usuario, router]);

  const buscar = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);
    const term = q.trim();
    if (term.length < 2) {
      setError("Escribe al menos 2 caracteres");
      return;
    }
    setBuscando(true);
    try {
      const res = await apiFetch(`/api/contenidos/buscar?tipo=${tipo}&q=${encodeURIComponent(term)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error en la búsqueda");
      setResultados(data.resultados ?? []);
      setTotal(data.total ?? 0);
      setFuente(data.fuente ?? "");
    } catch (err) {
      setError((err as Error).message);
      setResultados([]);
    } finally {
      setBuscando(false);
    }
  };

  const anadir = async (r: Resultado) => {
    const key = `${r.fuenteExterna}:${r.idExterno}`;
    setAdding(key);
    setToast(null);
    try {
      const res = await apiFetch("/api/contenidos", {
        method: "POST",
        body: JSON.stringify({
          tipo: r.tipo,
          titulo: r.titulo,
          fuenteExterna: r.fuenteExterna,
          idExterno: r.idExterno,
          imagenUrl: r.imagenUrl,
          detalle: {},
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo añadir");
      setToast(data.yaExistia ? `Ya lo tenías — "${r.titulo}"` : `Añadido "${r.titulo}" a tu cuenta`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setAdding(null);
      setTimeout(() => setToast(null), 3000);
    }
  };

  const loadListas = async () => {
    setLoadingListas(true);
    try {
      const res = await apiFetch("/api/listas");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error cargando listas");
      setListas(data ?? []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoadingListas(false);
    }
  };

  const handleAddToList = async (result: Resultado, listaId: string) => {
    const key = `${result.fuenteExterna}:${result.idExterno}`;
    setAddingToList(key);
    setError(null);
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
          listaId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al añadir a la lista");
      setToast(data.yaExistia 
        ? `Ya existía — "${result.titulo}" añadido a la lista`
        : `Añadido "${result.titulo}" a la lista`
      );
      setShowListSelector(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setAddingToList(null);
    }
  };

  const openListSelector = (resultKey: string) => {
    setShowListSelector(resultKey);
    if (listas.length === 0) {
      loadListas();
    }
  };

  if (loading) return <div className="p-10 text-center text-sm text-zinc-500">Cargando...</div>;
  if (!usuario) return null;

  return (
    <>
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight">Buscar</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">TMDB para peli/serie, IGDB para juegos, Spotify para música.</p>

        <form onSubmit={buscar} className="mt-6 flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 sm:flex-row sm:items-end">
          <label className="flex-1 text-sm font-medium">
            Término
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="matrix, zelda, beatles, breaking bad..."
              className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800"
            />
          </label>
          <label className="text-sm font-medium sm:w-48">
            Tipo
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as Tipo)}
              className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none dark:border-zinc-700 dark:bg-zinc-800"
            >
              <option value="pelicula">Película</option>
              <option value="serie">Serie</option>
              <option value="videojuego">Videojuego</option>
              <option value="musica">Música</option>
            </select>
          </label>
          <button
            type="submit"
            disabled={buscando}
            className="rounded-full bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-900 sm:self-auto"
          >
            {buscando ? "Buscando..." : "Buscar"}
          </button>
        </form>

        {error && <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
        {toast && <p className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">{toast}</p>}

        {resultados.length > 0 && (
          <div className="mt-6">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {total} resultados · fuente {fuente} · límite 10
            </p>
            <ul className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {resultados.map((r) => {
                const key = `${r.fuenteExterna}:${r.idExterno}`;
                const isAdding = adding === key;
                const isAddingToList = addingToList === key;
                const showSelector = showListSelector === key;

                return (
                  <li key={key} className="flex gap-3 rounded-2xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900 relative">
                    {r.imagenUrl ? (
                      <Image
                        src={r.imagenUrl}
                        alt={r.titulo}
                        width={56}
                        height={80}
                        className="h-20 w-14 shrink-0 rounded-xl object-cover"
                      />
                    ) : (
                      <div className="flex h-20 w-14 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-xs text-zinc-500 dark:bg-zinc-800">—</div>
                    )}
                    <div className="flex min-w-0 flex-1 flex-col">
                      <h3 className="truncate text-sm font-semibold">{r.titulo}</h3>
                      <p className="text-xs text-zinc-500">{r.tipo} · {r.fuenteExterna}{r.metadatos?.fecha ? ` · ${String(r.metadatos.fecha).slice(0, 4)}` : ""}</p>
                      <div className="mt-auto flex flex-wrap gap-2">
                        <button
                          onClick={() => anadir(r)}
                          disabled={!!isAdding || !!isAddingToList}
                          className="rounded-full bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-900"
                        >
                          {isAdding ? "Añadiendo..." : "+ Añadir a mi biblioteca"}
                        </button>

                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => openListSelector(key)}
                            disabled={!!isAdding || !!isAddingToList || loadingListas}
                            className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                          >
                            {loadingListas ? "..." : "Añadir a lista"}
                          </button>

                          {showSelector && (
                            <div className="absolute bottom-full left-0 mb-1 w-48 rounded-xl border border-zinc-200 bg-white p-2 shadow-lg dark:border-zinc-700 dark:bg-zinc-900 z-10">
                              {loadingListas && listas.length === 0 ? (
                                <div className="px-2 py-1 text-xs text-zinc-500">Cargando listas...</div>
                              ) : listas.length === 0 ? (
                                <div className="px-2 py-1 text-xs text-zinc-500">No tienes listas</div>
                              ) : (
                                listas.map((lista) => (
                                  <button
                                    key={lista.id}
                                    onClick={() => handleAddToList(r, lista.id)}
                                    className="w-full text-left px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                                  >
                                    {lista.nombre}
                                  </button>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </main>
    </>
  );
}