import { describe, it, expect } from "vitest";
import {
  isTransicionValida,
  validarTransicion,
  isEstadoValido,
} from "@/domain/services/TransicionEstado";

describe("TransicionEstado (dominio)", () => {
  it("valida estados válidos", () => {
    expect(isEstadoValido("pendiente")).toBe(true);
    expect(isEstadoValido("en_proceso")).toBe(true);
    expect(isEstadoValido("visto")).toBe(true);
    expect(isEstadoValido("otro")).toBe(false);
    expect(isEstadoValido("")).toBe(false);
  });

  it("permite idempotente (mismo estado)", () => {
    expect(isTransicionValida("pendiente", "pendiente")).toBe(true);
    expect(isTransicionValida("en_proceso", "en_proceso")).toBe(true);
    expect(isTransicionValida("visto", "visto")).toBe(true);
  });

  it("permite pendiente -> en_proceso", () => {
    expect(isTransicionValida("pendiente", "en_proceso")).toBe(true);
  });

  it("permite en_proceso -> visto", () => {
    expect(isTransicionValida("en_proceso", "visto")).toBe(true);
  });

  it("permite retroceso libre entre estados (cualquier dirección)", () => {
    expect(isTransicionValida("pendiente", "visto")).toBe(true);
    expect(isTransicionValida("en_proceso", "pendiente")).toBe(true);
    expect(isTransicionValida("visto", "pendiente")).toBe(true);
    expect(isTransicionValida("visto", "en_proceso")).toBe(true);
    expect(isTransicionValida("visto", "visto")).toBe(true);
  });

  it("validarTransicion ya no lanza 409 — solo valida estados (400)", () => {
    expect(() => validarTransicion("pendiente", "visto")).not.toThrow();
    expect(() => validarTransicion("en_proceso", "pendiente")).not.toThrow();
    expect(() => validarTransicion("visto", "pendiente")).not.toThrow();
    expect(() => validarTransicion("pendiente", "en_proceso")).not.toThrow();
  });
});
