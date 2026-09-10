import { describe, it, expect } from "vitest";
import { Lista } from "@/domain/entities/Lista";

describe("Lista (dominio)", () => {
  it("valida nombre obligatorio", () => {
    expect(() => Lista.validateNombre("")).toThrow("obligatorio");
    expect(() => Lista.validateNombre("   ")).toThrow("obligatorio");
  });

  it("valida longitud nombre", () => {
    const largo = "a".repeat(101);
    expect(() => Lista.validateNombre(largo)).toThrow("100 caracteres");
    expect(() => Lista.validateNombre("Mi lista")).not.toThrow();
  });

  it("valida descripcion max 500", () => {
    const larga = "a".repeat(501);
    expect(() => Lista.validateDescripcion(larga)).toThrow("500 caracteres");
    expect(() => Lista.validateDescripcion(null)).not.toThrow();
    expect(() => Lista.validateDescripcion(undefined)).not.toThrow();
    expect(() => Lista.validateDescripcion("desc corta")).not.toThrow();
  });

  it("construye entidad correctamente", () => {
    const lista = new Lista({
      id: "uuid-1",
      usuarioId: "user-1",
      nombre: "Favoritas",
      descripcion: "Mis pelis",
      fechaCreacion: new Date("2024-01-01"),
    });
    expect(lista.id).toBe("uuid-1");
    expect(lista.nombre).toBe("Favoritas");
    expect(lista.usuarioId).toBe("user-1");
  });
});
