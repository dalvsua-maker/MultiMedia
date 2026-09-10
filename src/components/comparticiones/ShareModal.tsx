"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { apiFetch } from "@/lib/api";

type Usuario = {
  id: string;
  nombre: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contentId: string;
  contentTitle: string;
  onSuccess?: () => void;
};

export function ShareModal({
  open,
  onOpenChange,
  contentId,
  contentTitle,
  onSuccess,
}: Props) {
  const [query, setQuery] = useState("");
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loadingShare, setLoadingShare] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setUsuarios([]);
      return;
    }
    setLoadingSearch(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/usuarios/buscar?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error buscando usuarios");
      setUsuarios(data ?? []);
    } catch (err) {
      setError((err as Error).message);
      setUsuarios([]);
    } finally {
      setLoadingSearch(false);
    }
  }, []);

  const debouncedSearch = useCallback((q: string) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => doSearch(q), 300);
  }, [doSearch]);

  useEffect(() => {
    debouncedSearch(query);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [query, debouncedSearch]);

  const handleShare = async (usuarioDestinoId: string) => {
    setLoadingShare(usuarioDestinoId);
    setError(null);
    setToast(null);
    try {
      const res = await apiFetch("/api/comparticiones", {
        method: "POST",
        body: JSON.stringify({ contenidoId: contentId, usuarioDestinoId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al compartir");
      if (res.status === 200) {
        setToast({ message: "Ya se lo habías compartido, se lo has recordado", type: "success" });
      } else {
        setToast({ message: "Compartido correctamente", type: "success" });
      }
      onSuccess?.();
    } catch (err) {
      setToast({ message: (err as Error).message, type: "error" });
    } finally {
      setLoadingShare(null);
    }
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/compartido/${contentId}`;
    navigator.clipboard.writeText(url);
    setToast({ message: "Enlace copiado al portapapeles", type: "success" });
    setTimeout(() => setToast(null), 2000);
  };

  const handleClose = () => {
    onOpenChange(false);
    setQuery("");
    setUsuarios([]);
    setError(null);
    setToast(null);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={handleClose}
    >
      <div
        className="relative w-[90%] max-w-md max-h-[90vh] overflow-y-auto p-5 bg-white rounded-2xl dark:bg-zinc-900 border dark:border-zinc-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b">
          <h2 className="text-lg font-semibold">Compartir contenido</h2>
          <button onClick={handleClose} className="text-zinc-500 hover:text-zinc-700">
            ✕
          </button>
        </div>

        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
          Compartiendo: <span className="font-medium">{contentTitle}</span>
        </p>

        <div className="mt-4 space-y-3">
          <div className="space-y-2">
            <label className="text-sm font-medium">Buscar usuario</label>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Escribe al menos 2 caracteres..."
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800"
            />
            {loadingSearch && <div className="text-xs text-zinc-500">Buscando...</div>}
            {error && (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
                {error}
              </p>
            )}
          </div>

          {query.length >= 2 && usuarios.length === 0 && !loadingSearch && (
            <div className="text-center py-4 text-zinc-500 text-sm">No se encontraron usuarios</div>
          )}

          {usuarios.length > 0 && (
            <ul className="max-h-60 overflow-y-auto space-y-2">
              {usuarios.map((u) => (
                <li key={u.id} className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-2 dark:border-zinc-700 dark:bg-zinc-800">
                  <span className="text-sm font-medium truncate">{u.nombre}</span>
                  <button
                    onClick={() => handleShare(u.id)}
                    disabled={loadingShare === u.id}
                    className="rounded-full bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-900"
                  >
                    {loadingShare === u.id ? "Compartiendo..." : "Compartir"}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="pt-2 border-t">
            <button
              onClick={handleCopyLink}
              className="w-full rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
            >
              Copiar enlace
            </button>
            <p className="mt-2 text-center text-xs text-zinc-500">
              Enlace: <code className="break-all">{window.location.origin}/compartido/{contentId}</code>
            </p>
          </div>
        </div>

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
      </div>
    </div>
  );
}