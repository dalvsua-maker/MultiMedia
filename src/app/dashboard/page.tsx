"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Header } from "@/components/Header";
import { apiFetch } from "@/lib/api";
import Image from "next/image";

type Card = { id: string; titulo: string; tipo: string; imagenUrl: string | null };

function Grid({ items, empty }: { items: Card[]; empty: string }) {
  if (items.length === 0) {
    return <p className="text-sm text-zinc-500">{empty}</p>;
  }
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((c) => (
        <li key={c.id} className="rounded-2xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
          {c.imagenUrl ? (
            <div className="relative h-32 w-full rounded-xl overflow-hidden">
              <Image
                src={c.imagenUrl}
                alt={c.titulo}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              />
            </div>
          ) : (
            <div className="flex h-32 items-center justify-center rounded-xl bg-zinc-100 text-xs text-zinc-500 dark:bg-zinc-800">—</div>
          )}
          <h3 className="mt-2 truncate text-sm font-semibold">{c.titulo}</h3>
          <p className="text-xs text-zinc-500">{c.tipo}</p>
        </li>
      ))}
    </ul>
  );
}

export default function DashboardPage() {
  const { usuario, loading } = useAuth();
  const router = useRouter();
  const [enProceso, setEnProceso] = useState<Card[]>([]);
  const [recomendaciones, setRecomendaciones] = useState<Card[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && !usuario) router.push("/login");
  }, [loading, usuario, router]);

  useEffect(() => {
    if (!usuario) return;
    const load = async () => {
      setLoadingData(true);
      setError(null);
      try {
        const res = await apiFetch("/api/inicio");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Error cargando inicio");
        setEnProceso(
          (data.enProceso ?? []).map((e: { contenido: Card }) => e.contenido ?? e)
        );
        setRecomendaciones(
          (data.recomendaciones ?? []).map((c: Card) => c)
        );
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoadingData(false);
      }
    };
    load();
  }, [usuario]);

  if (loading || loadingData) return <><Header /><div className="p-10 text-center text-sm text-zinc-500">Cargando inicio...</div></>;
  if (!usuario) return null;

  return (
    <>
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight">Inicio</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Continúa lo que dejaste a medias y descubre qué ver después.</p>
        {error && <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}

        <section className="mt-8">
          <h2 className="text-sm font-semibold">Continuar — en proceso</h2>
          <div className="mt-3">
            <Grid items={enProceso} empty="Aún no tienes nada en proceso. Marca algo como “en proceso” desde tu lista o desde Buscar → Añadir." />
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-sm font-semibold">Recomendado para ti</h2>
          <p className="mt-1 text-xs text-zinc-500">Basado en el tipo que más consumes y la popularidad global. Nunca incluye lo que ya tienes.</p>
          <div className="mt-3">
            <Grid items={recomendaciones} empty="Añade al menos un contenido para ver recomendaciones." />
          </div>
        </section>
      </main>
    </>
  );
}
