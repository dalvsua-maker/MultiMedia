"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Header } from "@/components/Header";
import { apiFetch } from "@/lib/api";
import Image from "next/image";

type EstadoComparticion = "pendiente" | "aceptada" | "rechazada";

type Comparticion = {
  id: string;
  contenido: {
    id: string;
    titulo: string;
    tipo: string;
    imagenUrl: string | null;
    fuenteExterna: string;
    idExterno: string;
  };
  usuarioOrigen: {
    id: string;
    nombre: string;
  };
  usuarioDestino: {
    id: string;
    nombre: string;
  };
  estado: EstadoComparticion;
  fechaEnvio: string;
};

const ESTADO_LABEL: Record<EstadoComparticion, string> = {
  pendiente: "Pendiente",
  aceptada: "Aceptada",
  rechazada: "Rechazada",
};

const ESTADO_CLASSES: Record<EstadoComparticion, string> = {
  pendiente: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
  aceptada: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
  rechazada: "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300",
};

export default function ComparticionesPage() {
  const { usuario, loading } = useAuth();
  const router = useRouter();
  const [recibidas, setRecibidas] = useState<Comparticion[]>([]);
  const [enviadas, setEnviadas] = useState<Comparticion[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    if (!loading && !usuario) router.push("/login");
  }, [loading, usuario, router]);

  useEffect(() => {
    if (!usuario) return;
    const load = async () => {
      setLoadingData(true);
      setError(null);
      try {
        const res = await apiFetch("/api/comparticiones");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Error cargando comparticiones");
        setRecibidas(data.recibidas ?? []);
        setEnviadas(data.enviadas ?? []);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoadingData(false);
      }
    };
    load();
  }, [usuario]);

  const handleAction = async (comparticionId: string, accion: "aceptar" | "rechazar") => {
    setProcessingId(comparticionId);
    setError(null);
    setToast(null);
    try {
      const res = await apiFetch(`/api/comparticiones/${comparticionId}`, {
        method: "PATCH",
        body: JSON.stringify({ accion }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al procesar");
      
      const nuevoEstado = accion === "aceptar" ? "aceptada" : "rechazada";
      setRecibidas((prev) =>
        prev.map((c) =>
          c.id === comparticionId ? { ...c, estado: nuevoEstado } : c
        )
      );

      if (accion === "aceptar") {
        const yaExistia = data.yaExistia === true;
        setToast({
          message: yaExistia
            ? "Ya tenías este contenido en tu biblioteca"
            : "Contenido añadido a tu biblioteca y compartición aceptada",
          type: "success",
        });
      } else {
        setToast({
          message: "Compartición rechazada",
          type: "success",
        });
      }
    } catch (err) {
      setToast({
        message: (err as Error).message,
        type: "error",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const renderSection = (title: string, items: Comparticion[], isRecibidas: boolean) => {
    if (items.length === 0) {
      return (
        <section className="mt-8">
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="mt-3 text-sm text-zinc-500">No hay comparticiones {isRecibidas ? "recibidas" : "enviadas"}.</p>
        </section>
      );
    }
    return (
      <section className="mt-8">
        <h2 className="text-sm font-semibold">{title} ({items.length})</h2>
        <ul className="mt-3 space-y-3">
          {items.map((c) => (
            <li key={c.id} className="flex gap-3 rounded-2xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
              {c.contenido.imagenUrl ? (
                <Image
                  src={c.contenido.imagenUrl}
                  alt={c.contenido.titulo}
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
                <h3 className="truncate text-sm font-semibold">{c.contenido.titulo}</h3>
                <p className="text-xs text-zinc-500">
                  {c.contenido.tipo} · {c.contenido.fuenteExterna}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  {isRecibidas
                    ? `De: ${c.usuarioOrigen.nombre}`
                    : `Para: ${c.usuarioDestino.nombre}`}
                </p>
                <span
                  className={`mt-2 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${ESTADO_CLASSES[c.estado]}`}
                >
                  {ESTADO_LABEL[c.estado]}
                </span>
                {isRecibidas && c.estado === "pendiente" && (
                  <div className="mt-auto flex gap-2">
                    <button
                      onClick={() => handleAction(c.id, "aceptar")}
                      disabled={processingId === c.id}
                      className="w-fit rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {processingId === c.id ? "..." : "Aceptar"}
                    </button>
                    <button
                      onClick={() => handleAction(c.id, "rechazar")}
                      disabled={processingId === c.id}
                      className="w-fit rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                    >
                      {processingId === c.id ? "..." : "Rechazar"}
                    </button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>
    );
  };

  if (loading || loadingData) {
    return (
      <>
        <Header />
        <div className="p-10 text-center text-sm text-zinc-500">Cargando comparticiones...</div>
      </>
    );
  }
  if (!usuario) return null;

  return (
    <>
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight">Comparticiones</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Gestiona lo que has compartido y lo que te han compartido.
        </p>

        {error && (
          <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </p>
        )}

        {toast && (
          <p
            className={`mt-4 rounded-xl px-3 py-2 text-sm ${
              toast.type === "success"
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                : "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
            }`}
          >
            {toast.message}
          </p>
        )}

        {renderSection("Recibidas", recibidas, true)}
        {renderSection("Enviadas", enviadas, false)}
      </main>
    </>
  );
}