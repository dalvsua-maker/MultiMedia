"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { usePathname } from "next/navigation";

export function Header() {
  const { usuario, logout, loading } = useAuth();
  const pathname = usePathname();
  const isAuthPage = pathname?.startsWith("/login") || pathname?.startsWith("/register");

  if (isAuthPage) return null;

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/80">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href={usuario ? "/dashboard" : "/"} className="text-base font-semibold tracking-tight">
          Plataforma<span className="text-zinc-500">Contenidos</span>
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          {loading ? (
            <span className="h-4 w-20 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
          ) : usuario ? (
            <>
              <Link href="/buscar" className="rounded-full px-3 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                Buscar
              </Link>
              <Link href="/listas" className="rounded-full px-3 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                Listas
              </Link>
              <Link href="/mis-contenidos" className="rounded-full px-3 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                Mis contenidos
              </Link>
              <Link href="/comparticiones" className="rounded-full px-3 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                Comparticiones
              </Link>
              <Link href="/dashboard" className="rounded-full px-3 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                Inicio
              </Link>
              <span className="hidden text-zinc-500 sm:inline">{usuario.nombre}</span>
              <button
                onClick={logout}
                className="rounded-full border border-zinc-200 px-3 py-1.5 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300"
              >
                Salir
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="rounded-full px-4 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                Entrar
              </Link>
              <Link href="/register" className="rounded-full bg-zinc-900 px-4 py-1.5 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900">
                Registro
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
