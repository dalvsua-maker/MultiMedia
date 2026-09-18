"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { getUsuario, clearAuth, setUsuario as setUsuarioLs } from "@/lib/api";

type Usuario = { id: string; nombre: string; email: string };

type AuthContextType = {
  usuario: Usuario | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (nombre: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [token] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUsuario(getUsuario());
    setLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Error al iniciar sesión");
    // token lives in httpOnly cookie, keep only usuario in localStorage for UI optimism
    setUsuarioLs(data.usuario);
    setUsuario(data.usuario);
  };

  const register = async (nombre: string, email: string, password: string) => {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ nombre, email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Error al registrarse");
    setUsuarioLs(data.usuario);
    setUsuario(data.usuario);
  };

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "DELETE", credentials: "include" });
    } catch {
      // ignore
    }
    clearAuth();
    setUsuario(null);
    router.push("/login");
  };

  return (
    <AuthContext.Provider value={{ usuario, token, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}
