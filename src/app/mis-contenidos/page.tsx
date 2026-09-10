"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Header } from "@/components/Header";
import { apiFetch } from "@/lib/api";
import { AddToListModal } from "@/components/listas/AddToListModal";
import { ShareModal } from "@/components/comparticiones/ShareModal";
import Image from "next/image";

type Estado = "pendiente" | "en_proceso" | "visto";
type Tipo = "pelicula" | "serie" | "videojuego" | "musica";

type Item = {
  contenido: {
    id: string;
    tipo: Tipo;
    titulo: string;
    imagenUrl: string | null;
  };
  estado: Estado;
  fechaActualizacion: string;
};

const ESTADOS: { value: Estado; label: string; classes: string }[] = [
  { value: "pendiente", label: "Pendiente", classes: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300" },
  { value: "en_proceso", label: "En proceso", classes: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300" },
  { value: "visto", label: "Visto", classes: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300" },
];

const TIPO_LABEL: Record<Tipo, string> = {
  pelicula: "Película",
  serie: "Serie",
  videojuego: "Videojuego",
  musica: "Música",
};

const FILTROS: { value: Estado | "todos"; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "pendiente", label: "Pendientes" },
  { value: "en_proceso", label: "En proceso" },
  { value: "visto", label: "Vistos" },
];

export default function MisContenidosPage() {
  const { usuario, loading } = useAuth();
  const router = useRouter();

  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [filtro, setFiltro] = useState<Estado | "todos">("todos");
  const [pendingId, startTransition] = useTransition();
  const [savingId, setSavingId] = useState<string | null>(null);

  const [showAddToListModal, setShowAddToListModal] = useState<{
    open: boolean;
    contentId: string | null;
    contentTitle: string;
  }>({ open: false, contentId: null, contentTitle: "" });

  const [showShareModal, setShowShareModal] = useState<{
    open: boolean;
    contentId: string | null;
    contentTitle: string;
  }>({ open: false, contentId: null, contentTitle: "" });

  useEffect(() => {
    if (!loading && !usuario) router.push("/login");
  }, [loading, usuario, router]);

  useEffect(() => {
    if (!usuario) return;
    const load = async () => {
      setLoadingData(true);
      setError(null);
      try {
        const res = await apiFetch("/api/usuario-contenido");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Error cargando contenidos");
        setItems(data.contenidos ?? []);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoadingData(false);
      }
    };
    load();
  }, [usuario]);

  const cambiarEstado = (item: Item, nuevoEstado: Estado) => {
    if (item.estado === nuevoEstado) return;
    const anterior = item.estado;

    setItems((prev) =>
      prev.map((it) =>
        it.contenido.id === item.contenido.id
          ? { ...it, estado: nuevoEstado, fechaActualizacion: new Date().toISOString() }
          : it
      )
    );
    setSavingId(item.contenido.id);
    setError(null);

    startTransition(async () => {
      try {
        const res = await apiFetch(`/api/usuario-contenido/${item.contenido.id}`, {
          method: "PATCH",
          body: JSON.stringify({ estado: nuevoEstado }),
        });
        const data = await res.json();
        if (!res.ok) {
          setItems((prev) =>
            prev.map((it) =>
              it.contenido.id === item.contenido.id ? { ...it, estado: anterior } : it
            )
          );
          throw new Error(data.error ?? "No se pudo actualizar el estado");
        }
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setSavingId(null);
      }
    });
  };

  const handleAddToListSuccess = () => {
    setShowAddToListModal({ open: false, contentId: null, contentTitle: "" });
  };

  const openAddToListModal = (contentId: string, contentTitle: string) => {
    setShowAddToListModal({ open: true, contentId, contentTitle });
  };

  const openShareModal = (contentId: string, contentTitle: string) => {
    setShowShareModal({ open: true, contentId, contentTitle });
  };

  if (loading || loadingData) {
    return (
      <>
        <Header />
        <div className="p-10 text-center text-sm text-zinc-500">Cargando tus contenidos...</div>
      </>
    );
  }
  if (!usuario) return null;

  const visibles =
    filtro === "todos" ? items : items.filter((it) => it.estado === filtro);

  return (
    <>
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight">Mis contenidos</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Todo lo que tienes en tu cuenta, en cualquier estado.
        </p>

        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          {FILTROS.map((f) => {
            const count =
              f.value === "todos" ? items.length : items.filter((it) => it.estado === f.value).length;
            const active = filtro === f.value;
            return (
              <button
                key={f.value}
                onClick={() => setFiltro(f.value)}
                className={
                  "rounded-full px-3 py-1.5 transition " +
                  (active
                    ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                    : "border border-zinc-200 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800")
                }
              >
                {f.label} <span className="ml-1 opacity-60">{count}</span>
              </button>
            );
          })}
        </div>

        {error && (
          <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </p>
        )}

        {visibles.length === 0 ? (
          <p className="mt-8 text-sm text-zinc-500">
            {items.length === 0
              ? "Aún no has añadido ningún contenido. Ve a Buscar para empezar."
              : "No hay contenidos en este filtro."}
          </p>
        ) : (
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visibles.map((it) => {
              const estadoActual = ESTADOS.find((e) => e.value === it.estado)!;
              const isSaving = savingId === it.contenido.id && pendingId;
              return (
                <li
                  key={it.contenido.id}
                  className="flex flex-col rounded-2xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  {it.contenido.imagenUrl ? (
                    <div className="relative h-32 w-full rounded-xl overflow-hidden">
                      <Image
                        src={it.contenido.imagenUrl}
                        alt={it.contenido.titulo}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                      />
                    </div>
                  ) : (
                    <div className="flex h-32 items-center justify-center rounded-xl bg-zinc-100 text-xs text-zinc-500 dark:bg-zinc-800">
                      —
                    </div>
                  )}

                  <div className="mt-3 flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-sm font-semibold">{it.contenido.titulo}</h3>
                      <p className="text-xs text-zinc-500">{TIPO_LABEL[it.contenido.tipo]}</p>
                    </div>
                    <span
                      className={
                        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide " +
                        estadoActual.classes
                      }
                    >
                      {estadoActual.label}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-col gap-2">
                    <div className="grid grid-cols-3 gap-1.5">
                      {ESTADOS.map((e) => {
                        const isActive = e.value === it.estado;
                        return (
                          <button
                            key={e.value}
                            onClick={() => cambiarEstado(it, e.value)}
                            disabled={isSaving}
                            className={
                              "rounded-full px-2 py-1.5 text-[11px] font-medium transition disabled:opacity-50 " +
                              (isActive
                                ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                                : "border border-zinc-200 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800")
                            }
                            title={`Marcar como ${e.label.toLowerCase()}`}
                          >
                            {isSaving && e.value !== it.estado ? "…" : e.label}
                          </button>
                        );
                      })}
                    </div>

                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => openAddToListModal(it.contenido.id, it.contenido.titulo)}
                        className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                      >
                        Añadir a lista
                      </button>
                      <button
                        type="button"
                        onClick={() => openShareModal(it.contenido.id, it.contenido.titulo)}
                        className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                      >
                        Compartir
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <AddToListModal
          open={showAddToListModal.open}
          onOpenChange={() => setShowAddToListModal({ open: false, contentId: null, contentTitle: "" })}
          contentId={showAddToListModal.contentId}
          contentTitle={showAddToListModal.contentTitle}
          onSuccess={handleAddToListSuccess}
        />
        <ShareModal
          open={showShareModal.open}
          onOpenChange={() => setShowShareModal({ open: false, contentId: null, contentTitle: "" })}
          contentId={showShareModal.contentId ?? ""}
          contentTitle={showShareModal.contentTitle ?? ""}
        />
      </main>
    </>
  );
}