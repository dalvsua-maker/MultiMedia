"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Header } from "@/components/Header";
import { apiFetch } from "@/lib/api";

type Lista = {
  id: string;
  nombre: string;
  descripcion: string | null;
  fechaCreacion: string;
};

export default function ListasPage() {
  const { usuario, loading } = useAuth();
  const router = useRouter();
  const [listas, setListas] = useState<Lista[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [creando, setCreando] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !usuario) router.push("/login");
  }, [loading, usuario, router]);

  useEffect(() => {
    if (!usuario) return;
    const load = async () => {
      setLoadingData(true);
      setError(null);
      try {
        const res = await apiFetch("/api/listas");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Error cargando listas");
        setListas(data ?? []);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoadingData(false);
      }
    };
    load();
  }, [usuario]);

  const crear = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const nombreTrim = nombre.trim();
    if (nombreTrim.length < 1) {
      setError("El nombre es obligatorio");
      return;
    }
    if (nombreTrim.length > 100) {
      setError("Máximo 100 caracteres");
      return;
    }
    setCreando(true);
    try {
      const res = await apiFetch("/api/listas", {
        method: "POST",
        body: JSON.stringify({
          nombre: nombreTrim,
          descripcion: descripcion.trim() === "" ? null : descripcion.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo crear la lista");
      setListas((prev) => [data, ...prev]);
      setNombre("");
      setDescripcion("");
      setToast(`Lista "${data.nombre}" creada`);
      setTimeout(() => setToast(null), 2500);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCreando(false);
    }
  };

  if (loading || loadingData) {
    return (
      <>
        <Header />
        <div className="p-10 text-center text-sm text-zinc-500">Cargando listas...</div>
      </>
    );
  }
  if (!usuario) return null;

  return (
    <>
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight">Mis listas</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Crea listas temáticas y agrupa contenidos para tenerlos a mano.
        </p>

        {error && (
          <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </p>
        )}
        {toast && (
          <p className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
            {toast}
          </p>
        )}

        <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold">Crear nueva lista</h2>
          <form onSubmit={crear} className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex-1 text-sm font-medium">
              Nombre
              <input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Películas pendientes, Spiderman, etc."
                maxLength={100}
                className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800"
              />
            </label>
            <label className="flex-1 text-sm font-medium">
              Descripción (opcional)
              <input
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Qué tiene esta lista"
                className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800"
              />
            </label>
            <button
              type="submit"
              disabled={creando}
              className="rounded-full bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-900 sm:self-auto"
            >
              {creando ? "Creando..." : "+ Crear"}
            </button>
          </form>
        </section>

        <section className="mt-8">
          {listas.length === 0 ? (
            <p className="text-sm text-zinc-500">Aún no tienes listas. Crea la primera arriba.</p>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {listas.map((l) => (
                <li key={l.id}>
                  <Link
                    href={`/listas/${l.id}`}
                    className="block rounded-2xl border border-zinc-200 bg-white p-4 transition hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
                  >
                    <h3 className="truncate text-sm font-semibold">{l.nombre}</h3>
                    {l.descripcion && (
                      <p className="mt-1 line-clamp-2 text-xs text-zinc-500">{l.descripcion}</p>
                    )}
                    <p className="mt-3 text-[10px] uppercase tracking-wide text-zinc-400">
                      Creada {new Date(l.fechaCreacion).toLocaleDateString("es-ES")}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}
