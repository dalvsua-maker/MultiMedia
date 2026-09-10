"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { Header } from "@/components/Header";

export default function Home() {
  const { usuario, loading } = useAuth();

  return (
    <>
      <Header />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-10 sm:px-6 sm:py-16">
        <section className="mx-auto max-w-2xl text-center">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Busca, organiza y comparte <span className="text-zinc-500">todo lo que ves y juegas</span>
          </h1>
          <p className="mt-4 text-lg leading-7 text-zinc-600 dark:text-zinc-400">
            Películas, series, videojuegos y música en un solo lugar. Listas, estados y recomendaciones sin perder lo que ya tienes.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            {loading ? null : usuario ? (
              <>
                <Link href="/buscar" className="rounded-full bg-zinc-900 px-6 py-3 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900">
                  Buscar contenido
                </Link>
                <Link href="/dashboard" className="rounded-full border border-zinc-200 bg-white px-6 py-3 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900">
                  Ir al inicio
                </Link>
              </>
            ) : (
              <>
                <Link href="/register" className="rounded-full bg-zinc-900 px-6 py-3 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900">
                  Crear cuenta
                </Link>
                <Link href="/login" className="rounded-full border border-zinc-200 bg-white px-6 py-3 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900">
                  Iniciar sesión
                </Link>
              </>
            )}
          </div>
        </section>

        <section className="mt-12 grid gap-4 sm:grid-cols-3">
          {[
            { title: "Búsqueda unificada", desc: "TMDB, IGDB y Spotify normalizados en una sola barra." },
            { title: "Listas y estados", desc: "Pendiente → en proceso → visto, con retroceso libre." },
            { title: "Compartir y recomendar", desc: "Enlace público o dentro de la app, con recomendaciones v1." },
          ].map((c) => (
            <div key={c.title} className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
              <h3 className="text-sm font-semibold">{c.title}</h3>
              <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{c.desc}</p>
            </div>
          ))}
        </section>
      </main>
    </>
  );
}
