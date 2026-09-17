"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { Header } from "@/components/Header";
import { apiFetch } from "@/lib/api";
import { ContentSearchModal } from "@/components/listas/ContentSearchModal";
import { UserContentPickerModal } from "@/components/listas/UserContentPickerModal";
import { AddToListModal } from "@/components/listas/AddToListModal";
import Image from "next/image";

type Contenido = {
  id: string;
  tipo: string;
  titulo: string;
  imagenUrl: string | null;
  fuenteExterna: string;
  idExterno: string;
  fechaAnadido: string;
  estado: string | null;
};

const ESTADO_LABEL: Record<string, string> = {
  pendiente: "Pendiente",
  en_proceso: "En proceso",
  visto: "Visto",
};

const ESTADO_CLASSES: Record<string, string> = {
  pendiente: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  en_proceso: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
  visto: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
};

type Lista = {
  id: string;
  nombre: string;
  descripcion: string | null;
  fechaCreacion: string;
  contenidos: Contenido[];
};

export default function ListaDetallePage() {
  const { usuario, loading } = useAuth();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const listaId = params?.id;
  const [lista, setLista] = useState<Lista | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showPickerModal, setShowPickerModal] = useState(false);
  const [showAddToListModal, setShowAddToListModal] = useState<{
    open: boolean;
    contentId: string | null;
    contentTitle: string;
  }>({ open: false, contentId: null, contentTitle: "" });

  useEffect(() => {
    if (!loading && !usuario) router.push("/login");
  }, [loading, usuario, router]);

  useEffect(() => {
    if (!usuario || !listaId) return;
    const load = async () => {
      setLoadingData(true);
      setError(null);
      try {
        const res = await apiFetch(`/api/listas/${listaId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Error cargando lista");
        setLista(data);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoadingData(false);
      }
    };
    load();
  }, [usuario, listaId]);

  const quitar = async (cid: string) => {
    if (!listaId) return;
    setRemovingId(cid);
    setError(null);
    try {
      const res = await apiFetch(`/api/listas/${listaId}/contenidos/${cid}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo quitar");
      setToast("Contenido quitado");
      setTimeout(() => setToast(null), 2000);
      await reload();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRemovingId(null);
    }
  };

  const reload = async () => {
    if (!listaId) return;
    const res = await apiFetch(`/api/listas/${listaId}`);
    if (res.ok) {
      const data = await res.json();
      setLista(data);
    } else {
      const data = await res.json();
      setError(data.error ?? "Error al recargar la lista");
    }
  };

  const handleSearchSuccess = async () => {
    setToast("Contenido añadido a la lista");
    setTimeout(() => setToast(null), 2000);
    await reload();
    setShowSearchModal(false);
  };

  const handlePickerSuccess = async () => {
    setToast("Contenido añadido a la lista");
    setTimeout(() => setToast(null), 2000);
    await reload();
    setShowPickerModal(false);
  };

  const handleAddToListSuccess = async () => {
    setToast("Contenido añadido a la lista");
    setTimeout(() => setToast(null), 2000);
    await reload();
    setShowAddToListModal({ open: false, contentId: null, contentTitle: "" });
  };

  if (loading || loadingData) {
    return (
      <>
        <Header />
        <div className="p-10 text-center text-sm text-zinc-500">Cargando lista...</div>
      </>
    );
  }
  if (!usuario) return null;

  if (error && !lista) {
    return (
      <>
        <Header />
        <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </p>
          <Link
            href="/listas"
            className="mt-4 inline-block text-sm text-zinc-500 underline hover:text-zinc-700"
          >
            ← Volver a mis listas
          </Link>
        </main>
      </>
    );
  }

  if (!lista) return null;

  const existingContentIds = lista.contenidos.map((c) => c.id);

  return (
    <>
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <Link href="/listas" className="text-sm text-zinc-500 underline hover:text-zinc-700">
          ← Mis listas
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{lista.nombre}</h1>
        {lista.descripcion && (
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{lista.descripcion}</p>
        )}
        <p className="mt-1 text-xs text-zinc-500">
          Creada el {new Date(lista.fechaCreacion).toLocaleDateString("es-ES")} ·{" "}
          {lista.contenidos.length} contenido{lista.contenidos.length === 1 ? "" : "s"}
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
          <h2 className="text-sm font-semibold">Añadir contenido a la lista</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Elige de dónde quieres añadir el contenido:
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setShowSearchModal(true)}
              className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900"
            >
              Buscar contenido
            </button>
            <button
              type="button"
              onClick={() => setShowPickerModal(true)}
              className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
            >
              Mis contenidos
            </button>
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-sm font-semibold">Contenidos</h2>
          {lista.contenidos.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500">La lista está vacía. Añade el primer contenido arriba.</p>
          ) : (
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">
              {lista.contenidos.map((c) => (
                <li
                  key={c.id}
                  className="flex gap-3 rounded-2xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  {c.imagenUrl ? (
                    <Image
                      src={c.imagenUrl}
                      alt={c.titulo}
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
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="truncate text-sm font-semibold">{c.titulo}</h3>
                      {c.estado ? (
                        <span
                          className={
                            "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide " +
                            (ESTADO_CLASSES[c.estado] ?? "bg-zinc-100 text-zinc-600")
                          }
                        >
                          {ESTADO_LABEL[c.estado] ?? c.estado}
                        </span>
                      ) : (
                        <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                          Sin estado
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500">
                      {c.tipo} · {c.fuenteExterna}
                    </p>
                    <p className="mt-0.5 truncate text-[10px] text-zinc-400" title={c.id}>
                      {c.id}
                    </p>
                    <div className="mt-auto flex gap-2">
                      <button
                        onClick={() => quitar(c.id)}
                        disabled={removingId === c.id}
                        className="w-fit rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300"
                      >
                        {removingId === c.id ? "Quitando..." : "Quitar de lista"}
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <ContentSearchModal
          open={showSearchModal}
          onOpenChange={setShowSearchModal}
          onSuccess={handleSearchSuccess}
          listaId={listaId ?? undefined}
        />

        <UserContentPickerModal
          open={showPickerModal}
          onOpenChange={setShowPickerModal}
          onSuccess={handlePickerSuccess}
          listaId={listaId ?? ""}
          excludeIds={existingContentIds}
        />

        <AddToListModal
          open={showAddToListModal.open}
          onOpenChange={() => setShowAddToListModal({ open: false, contentId: null, contentTitle: "" })}
          contentId={showAddToListModal.contentId}
          contentTitle={showAddToListModal.contentTitle}
          onSuccess={handleAddToListSuccess}
        />
      </main>
    </>
  );
}