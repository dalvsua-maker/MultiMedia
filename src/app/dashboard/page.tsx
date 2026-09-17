"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Header } from "@/components/Header";
import { apiFetch } from "@/lib/api";
import Image from "next/image";

type Card = { id: string; titulo: string; tipo: string; imagenUrl: string | null; yaAnadido?: boolean };
type RecomendacionesPorTipo = Record<string, Card[]>;

function EnProcesoGrid({
  items,
  empty,
  onDelete,
  deletingId,
}: {
  items: Card[];
  empty: string;
  onDelete?: (card: Card) => void;
  deletingId?: string | null;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-zinc-500">{empty}</p>;
  }
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((c) => (
        <li key={c.id} className="flex flex-col rounded-2xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
          {c.imagenUrl ? (
            <div className="relative h-32 w-full rounded-xl overflow-hidden">
              <Image src={c.imagenUrl} alt={c.titulo} fill className="object-cover" sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw" />
            </div>
          ) : (
            <div className="flex h-32 items-center justify-center rounded-xl bg-zinc-100 text-xs text-zinc-500 dark:bg-zinc-800">—</div>
          )}
          <h3 className="mt-2 truncate text-sm font-semibold">{c.titulo}</h3>
          <p className="text-xs text-zinc-500">{c.tipo}</p>
          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(c)}
              disabled={deletingId === c.id}
              className="mt-3 w-full rounded-full border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900/50 dark:bg-zinc-900 dark:text-red-400 dark:hover:bg-red-950/30"
            >
              {deletingId === c.id ? "Eliminando..." : "Eliminar de Mis contenidos"}
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

function RecomendacionCard({
  card,
  onFeedback,
  onAdd,
  pendingVoto,
}: {
  card: Card;
  onFeedback: (card: Card, voto: "me_gusta" | "no_me_gusta" | "ya_lo_vi") => void;
  onAdd: (card: Card) => void;
  pendingVoto?: string | null;
}) {
  const isPending = pendingVoto === card.id;
  return (
    <li className="flex flex-col rounded-2xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
      {card.imagenUrl ? (
        <div className="relative h-32 w-full overflow-hidden rounded-xl">
          <Image src={card.imagenUrl} alt={card.titulo} fill className="object-cover" sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw" />
        </div>
      ) : (
        <div className="flex h-32 items-center justify-center rounded-xl bg-zinc-100 text-xs text-zinc-500 dark:bg-zinc-800">—</div>
      )}
      <div className="mt-2 flex items-start justify-between gap-2">
        <h3 className="min-w-0 flex-1 truncate text-sm font-semibold">{card.titulo}</h3>
        {card.yaAnadido && (
          <span className="shrink-0 rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] font-medium text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
            Ya añadido
          </span>
        )}
      </div>
      <p className="text-xs text-zinc-500">{card.tipo}</p>

      <div className="mt-3 grid grid-cols-3 gap-1.5">
        <button
          type="button"
          onClick={() => onFeedback(card, "me_gusta")}
          disabled={!!pendingVoto}
          className="rounded-full border border-zinc-200 bg-white px-2 py-1.5 text-[11px] font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
          title="Me gusta"
        >
          {isPending ? "…" : "👍 Me gusta"}
        </button>
        <button
          type="button"
          onClick={() => onFeedback(card, "no_me_gusta")}
          disabled={!!pendingVoto}
          className="rounded-full border border-zinc-200 bg-white px-2 py-1.5 text-[11px] font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
          title="No me gusta"
        >
          {isPending ? "…" : "👎 No me gusta"}
        </button>
        <button
          type="button"
          onClick={() => onFeedback(card, "ya_lo_vi")}
          disabled={!!pendingVoto}
          className="rounded-full border border-zinc-200 bg-white px-2 py-1.5 text-[11px] font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
          title="Ya lo vi"
        >
          {isPending ? "…" : "✓ Ya lo vi"}
        </button>
      </div>
      <button
        type="button"
        onClick={() => onAdd(card)}
        disabled={!!pendingVoto}
        className="mt-1.5 w-full rounded-full bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-900"
      >
        Añadir a Mis contenidos
      </button>
    </li>
  );
}

export default function DashboardPage() {
  const { usuario, loading } = useAuth();
  const router = useRouter();
  const [enProceso, setEnProceso] = useState<Card[]>([]);
  const [recomendacionesPorTipo, setRecomendacionesPorTipo] = useState<RecomendacionesPorTipo>({
    pelicula: [],
    serie: [],
    videojuego: [],
    musica: [],
  });
  const [error, setError] = useState<string | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingFeedbackId, setPendingFeedbackId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; card: Card; tipo: string; voto: string } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const removedRef = useRef<{ card: Card; tipo: string; index: number } | null>(null);

  useEffect(() => {
    if (!loading && !usuario) router.push("/login");
  }, [loading, usuario, router]);

  useEffect(() => {
    if (!usuario) return;
    const load = async () => {
      setLoadingData(true);
      setError(null);
      try {
        const res = await apiFetch("/api/inicio", { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Error cargando inicio");
        setEnProceso((data.enProceso ?? []).map((e: { contenido: Card }) => e.contenido ?? e));
        if (data.recomendacionesPorTipo) {
          setRecomendacionesPorTipo({
            pelicula: data.recomendacionesPorTipo.pelicula ?? [],
            serie: data.recomendacionesPorTipo.serie ?? [],
            videojuego: data.recomendacionesPorTipo.videojuego ?? [],
            musica: data.recomendacionesPorTipo.musica ?? [],
          });
        } else {
          // fallback viejo contrato
          const flat: Card[] = (data.recomendaciones ?? []).map((c: Card) => c);
          setRecomendacionesPorTipo({
            pelicula: flat.filter((c) => c.tipo === "pelicula"),
            serie: flat.filter((c) => c.tipo === "serie"),
            videojuego: flat.filter((c) => c.tipo === "videojuego"),
            musica: flat.filter((c) => c.tipo === "musica"),
          });
        }
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoadingData(false);
      }
    };
    load();
  }, [usuario]);

  const handleDeleteEnProceso = async (card: Card) => {
    const ok = window.confirm(`¿Eliminar "${card.titulo}" de Mis contenidos? Esta acción es definitiva y también lo quitará de todas tus listas.`);
    if (!ok) return;
    setDeletingId(card.id);
    setError(null);
    try {
      const res = await apiFetch(`/api/usuario-contenido/${card.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "No se pudo eliminar");
      setEnProceso((prev) => prev.filter((c) => c.id !== card.id));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleAddRecomendacion = async (card: Card) => {
    setError(null);
    try {
      const detailRes = await apiFetch(`/api/contenidos/${card.id}/publico`);
      const detail = await detailRes.json().catch(() => null);
      const c = detail?.contenido ?? detail;
      if (!detailRes.ok || !c?.id) throw new Error("No se pudo obtener detalle del contenido");
      const createRes = await apiFetch("/api/contenidos", {
        method: "POST",
        body: JSON.stringify({
          tipo: c.tipo,
          titulo: c.titulo,
          imagenUrl: c.imagenUrl,
          fuenteExterna: c.fuenteExterna,
          idExterno: c.idExterno,
          detalle: c.detalle ?? null,
        }),
      });
      const createData = await createRes.json();
      if (!createRes.ok) throw new Error(createData.error ?? "No se pudo añadir");
      setError(null);
      // quitar de recomendaciones optimistic
      setRecomendacionesPorTipo((prev) => {
        const next = { ...prev };
        for (const k of Object.keys(next) as Array<keyof typeof next>) {
          next[k] = next[k].filter((x) => x.id !== card.id);
        }
        return next;
      });
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleFeedback = async (card: Card, voto: "me_gusta" | "no_me_gusta" | "ya_lo_vi") => {
    // me_gusta: persiste y no oculta, solo toast
    if (voto === "me_gusta") {
      setPendingFeedbackId(card.id);
      try {
        const res = await apiFetch("/api/recomendaciones/feedback", {
          method: "POST",
          body: JSON.stringify({ contenidoId: card.id, voto }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error((data as { error?: string }).error ?? "No se pudo guardar feedback");
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        setToast({ msg: `Guardamos que te gusta "${card.titulo}"`, card, tipo: card.tipo, voto });
        toastTimerRef.current = setTimeout(() => setToast(null), 5000);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setPendingFeedbackId(null);
      }
      return;
    }

    // no_me_gusta / ya_lo_vi: persiste inmediato, oculta tarjeta, toast con Deshacer 5s
    // guardar posición para deshacer sin refetch — lectura síncrona (evita side-effect dentro de setState que es asíncrono/batcheado en React 18)
    let tipoKey: string = card.tipo;
    let idx = -1;
    for (const [k, arr] of Object.entries(recomendacionesPorTipo) as Array<[string, Card[]]>) {
      const i = arr.findIndex((x) => x.id === card.id);
      if (i !== -1) {
        tipoKey = k;
        idx = i;
        break;
      }
    }
    removedRef.current = { card, tipo: tipoKey, index: idx };

    // optimistic remove
    setRecomendacionesPorTipo((prev) => {
      const next = { ...prev };
      for (const k of Object.keys(next) as Array<keyof typeof next>) {
        next[k] = next[k].filter((x) => x.id !== card.id);
      }
      return next;
    });
    setPendingFeedbackId(card.id);
    setError(null);
    try {
      const res = await apiFetch("/api/recomendaciones/feedback", {
        method: "POST",
        body: JSON.stringify({ contenidoId: card.id, voto }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // rollback: reinsertar — defensivo contra tipo vacío/inexistente
        if (removedRef.current) {
          const { card: c, tipo, index } = removedRef.current;
          const tipoSafe = (tipo || c.tipo) as string;
          if (tipoSafe) {
            setRecomendacionesPorTipo((prev) => {
              const next = { ...prev };
              const arr = [...((next as Record<string, Card[]>)[tipoSafe] ?? [])];
              arr.splice(index >= 0 ? index : arr.length, 0, c);
              (next as Record<string, Card[]>)[tipoSafe] = arr;
              return next;
            });
          }
        }
        throw new Error((data as { error?: string }).error ?? "No se pudo guardar feedback");
      }
      // éxito: mostrar toast único (reemplaza anterior)
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      const msg = voto === "ya_lo_vi" ? `Marcado como ya visto "${card.titulo}"` : `No te mostraremos más "${card.titulo}"`;
      setToast({ msg, card, tipo: tipoKey, voto });
      toastTimerRef.current = setTimeout(() => {
        setToast(null);
        removedRef.current = null;
      }, 5000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPendingFeedbackId(null);
    }
  };

  const handleDeshacer = async () => {
    if (!toast || !removedRef.current) return;
    const { card } = removedRef.current;
    // intentar borrar feedback persistido
    try {
      const res = await apiFetch(`/api/recomendaciones/feedback/${card.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as { error?: string }).error ?? "No se pudo deshacer");
      }
      // éxito: reinsertar tarjeta en posición original — defensivo
      const { tipo, index } = removedRef.current;
      const tipoSafe = (tipo || card.tipo) as string;
      if (tipoSafe) {
        setRecomendacionesPorTipo((prev) => {
          const next = { ...prev };
          const arr = [...((next as Record<string, Card[]>)[tipoSafe] ?? [])];
          arr.splice(index >= 0 ? index : arr.length, 0, card);
          (next as Record<string, Card[]>)[tipoSafe] = arr;
          return next;
        });
      }
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      setToast(null);
      removedRef.current = null;
    } catch (err) {
      setError((err as Error).message);
      // NO reinsertar tarjeta si DELETE falló (queda descartado en backend)
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      setToast(null);
      removedRef.current = null;
    }
  };

  if (loading || loadingData)
    return (
      <>
        <Header />
        <div className="p-10 text-center text-sm text-zinc-500">Cargando inicio...</div>
      </>
    );
  if (!usuario) return null;

  const secciones: Array<{ key: string; label: string; items: Card[] }> = [
    { key: "pelicula", label: "Películas", items: recomendacionesPorTipo.pelicula ?? [] },
    { key: "serie", label: "Series", items: recomendacionesPorTipo.serie ?? [] },
    { key: "videojuego", label: "Videojuegos", items: recomendacionesPorTipo.videojuego ?? [] },
    { key: "musica", label: "Música", items: recomendacionesPorTipo.musica ?? [] },
  ];

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
            <EnProcesoGrid items={enProceso} empty="Aún no tienes nada en proceso. Marca algo como “en proceso” desde tu lista o desde Buscar → Añadir." onDelete={handleDeleteEnProceso} deletingId={deletingId} />
          </div>
        </section>

        <section className="mt-8">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold">Recomendado para ti</h2>
            <span className="text-xs text-zinc-500">4 por categoría · shuffle en cada carga · excluye lo que ya tienes y tu feedback</span>
          </div>
          <p className="mt-1 text-xs text-zinc-500">Pulsa 👍 Me gusta, 👎 No me gusta o ✓ Ya lo vi. “Ya añadido” indica que lo tuviste antes.</p>

          {secciones.map((sec) => (
            <div key={sec.key} className="mt-6">
              <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                {sec.label} <span className="ml-1 text-xs font-normal text-zinc-500">({sec.items.length})</span>
              </h3>
              {sec.items.length === 0 ? (
                <p className="mt-2 text-sm text-zinc-500">Sin recomendaciones por ahora en {sec.label.toLowerCase()}. Prueba a buscar y añadir algo de este tipo.</p>
              ) : (
                <ul className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {sec.items.map((c) => (
                    <RecomendacionCard key={c.id} card={c} onFeedback={handleFeedback} onAdd={handleAddRecomendacion} pendingVoto={pendingFeedbackId} />
                  ))}
                </ul>
              )}
            </div>
          ))}
        </section>

        {toast && (
          <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full bg-zinc-900 px-4 py-2 text-sm text-white shadow-lg dark:bg-white dark:text-zinc-900">
            <span>{toast.msg}</span>
            {(toast.voto === "no_me_gusta" || toast.voto === "ya_lo_vi") && (
              <button type="button" onClick={handleDeshacer} className="rounded-full bg-white px-3 py-1 text-xs font-medium text-zinc-900 hover:bg-zinc-100 dark:bg-zinc-900 dark:text-white">
                Deshacer
              </button>
            )}
          </div>
        )}
      </main>
    </>
  );
}
