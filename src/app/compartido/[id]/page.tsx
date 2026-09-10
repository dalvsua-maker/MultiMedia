"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { getToken } from "@/lib/api";
import Image from "next/image";

type Tipo = "pelicula" | "serie" | "videojuego" | "musica";

type ContenidoPublico = {
  id: string;
  tipo: Tipo;
  titulo: string;
  imagenUrl: string | null;
  fuenteExterna: string;
  idExterno: string;
  detalle?: {
    duracionMin?: number;
    director?: string;
    anio?: number;
    numTemporadas?: number;
    numEpisodios?: number;
    anioInicio?: number;
    plataformas?: string[];
    desarrollador?: string;
    anioLanzamiento?: number;
    artista?: string;
    album?: string;
    duracionSeg?: number;
  };
};

const TIPO_LABEL: Record<Tipo, string> = {
  pelicula: "Película",
  serie: "Serie",
  videojuego: "Videojuego",
  musica: "Música",
};

const FUENTE_LABEL: Record<string, string> = {
  tmdb: "TMDB",
  igdb: "IGDB",
  spotify: "Spotify",
};

export default function CompartidoPublicoPage() {
  const params = useParams<{ id: string }>();
  const contenidoId = params?.id;
  const [contenido, setContenido] = useState<ContenidoPublico | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    if (!contenidoId) return;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch(`/api/contenidos/${contenidoId}/publico`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Contenido no encontrado");
        setContenido(data);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [contenidoId]);

  const handleAddToAccount = async () => {
    if (!contenido) return;
    setAdding(true);
    setToast(null);
    try {
      const res = await apiFetch("/api/contenidos", {
        method: "POST",
        body: JSON.stringify({
          tipo: contenido.tipo,
          titulo: contenido.titulo,
          imagenUrl: contenido.imagenUrl,
          fuenteExterna: contenido.fuenteExterna,
          idExterno: contenido.idExterno,
          detalle: contenido.detalle ?? {},
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo añadir");
      setToast({ message: data.yaExistia ? "Ya lo tenías en tu cuenta" : "Añadido a tu cuenta", type: "success" });
    } catch (err) {
      setToast({ message: (err as Error).message, type: "error" });
    } finally {
      setAdding(false);
    }
  };

  const renderDetalle = () => {
    if (!contenido?.detalle) return null;
    const d = contenido.detalle;
    const items: string[] = [];
    switch (contenido.tipo) {
      case "pelicula":
        if (d.anio) items.push(`${d.anio}`);
        if (d.duracionMin) items.push(`${d.duracionMin} min`);
        if (d.director) items.push(d.director);
        break;
      case "serie":
        if (d.anioInicio) items.push(`Desde ${d.anioInicio}`);
        if (d.numTemporadas) items.push(`${d.numTemporadas} temp.`);
        if (d.numEpisodios) items.push(`${d.numEpisodios} ep.`);
        break;
      case "videojuego":
        if (d.anioLanzamiento) items.push(`${d.anioLanzamiento}`);
        if (d.plataformas?.length) items.push(d.plataformas.join(", "));
        if (d.desarrollador) items.push(d.desarrollador);
        break;
      case "musica":
        if (d.artista) items.push(d.artista);
        if (d.album) items.push(d.album);
        if (d.duracionSeg) items.push(`${Math.floor(d.duracionSeg / 60)}:${String(d.duracionSeg % 60).padStart(2, "0")}`);
        break;
    }
    if (items.length === 0) return null;
    return (
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{items.join(" · ")}</p>
    );
  };

  const isLoggedIn = !!getToken();

  if (loading) {
    return (
      <div className="p-10 text-center text-sm text-zinc-500">Cargando contenido...</div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-md px-4 py-10 text-center">
        <p className="text-lg font-semibold">No se pudo cargar el contenido</p>
        <p className="mt-2 text-sm text-zinc-500">{error}</p>
        <Link href="/" className="mt-6 inline-block text-sm text-zinc-500 underline hover:text-zinc-700">
          ← Volver al inicio
        </Link>
      </div>
    );
  }

  if (!contenido) {
    return (
      <div className="mx-auto max-w-md px-4 py-10 text-center">
        <p className="text-lg font-semibold">Contenido no encontrado</p>
        <Link href="/" className="mt-6 inline-block text-sm text-zinc-500 underline hover:text-zinc-700">
          ← Volver al inicio
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-10 sm:px-6">
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex gap-4">
          {contenido.imagenUrl ? (
            <Image
              src={contenido.imagenUrl}
              alt={contenido.titulo}
              width={112}
              height={160}
              className="h-40 w-28 shrink-0 rounded-xl object-cover"
            />
          ) : (
            <div className="flex h-40 w-28 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-xs text-zinc-500 dark:bg-zinc-800">
              —
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="truncate text-xl font-semibold">{contenido.titulo}</h1>
            <p className="mt-1 text-sm text-zinc-500">
              {TIPO_LABEL[contenido.tipo]} · {FUENTE_LABEL[contenido.fuenteExterna] ?? contenido.fuenteExterna}
            </p>
            {renderDetalle()}
          </div>
        </div>

        <div className="mt-6 pt-6 border-t">
          {isLoggedIn ? (
            <button
              onClick={handleAddToAccount}
              disabled={adding}
              className="w-full rounded-full bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-900"
            >
              {adding ? "Añadiendo..." : "+ Añadir a mi cuenta"}
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
                Inicia sesión o regístrate para guardarlo
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Link
                  href={`/login?redirect=/compartido/${contenido.id}`}
                  className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 text-center"
                >
                  Iniciar sesión
                </Link>
                <Link
                  href={`/register?redirect=/compartido/${contenido.id}`}
                  className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 text-center"
                >
                  Registrarse
                </Link>
              </div>
            </div>
          )}
        </div>

        {toast && (
          <p
            className={`mt-4 rounded-xl px-3 py-2 text-sm text-center ${
              toast.type === "success"
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                : "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
            }`}
          >
            {toast.message}
          </p>
        )}
      </div>
    </div>
  );
}