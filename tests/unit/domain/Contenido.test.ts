import { describe, it, expect } from "vitest";
import { Contenido } from "@/domain/entities/Contenido";

describe("Contenido (dominio)", () => {
  it("valida tipo", () => {
    expect(() => Contenido.validateTipo("pelicula")).not.toThrow();
    expect(() => Contenido.validateTipo("serie")).not.toThrow();
    expect(() => Contenido.validateTipo("videojuego")).not.toThrow();
    expect(() => Contenido.validateTipo("musica")).not.toThrow();
    expect(() => Contenido.validateTipo("libro")).toThrow("no válido");
    expect(() => Contenido.validateTipo("")).toThrow();
  });

  it("valida fuente", () => {
    expect(() => Contenido.validateFuente("tmdb")).not.toThrow();
    expect(() => Contenido.validateFuente("igdb")).not.toThrow();
    expect(() => Contenido.validateFuente("spotify")).not.toThrow();
    expect(() => Contenido.validateFuente("other")).toThrow();
  });

  it("valida titulo obligatorio y longitud", () => {
    expect(() => Contenido.validateTitulo("")).toThrow("obligatorio");
    expect(() => Contenido.validateTitulo("   ")).toThrow("obligatorio");
    expect(() => Contenido.validateTitulo("a".repeat(256))).toThrow("255");
    expect(() => Contenido.validateTitulo("Matrix")).not.toThrow();
  });

  it("valida idExterno", () => {
    expect(() => Contenido.validateIdExterno("")).toThrow("obligatorio");
    expect(() => Contenido.validateIdExterno("a".repeat(101))).toThrow("100");
    expect(() => Contenido.validateIdExterno("603")).not.toThrow();
  });

  it("construye entidad correctamente", () => {
    const c = new Contenido({
      id: "uuid-1",
      tipo: "pelicula",
      titulo: "Matrix",
      imagenUrl: null,
      fuenteExterna: "tmdb",
      idExterno: "603",
      fechaAnadido: new Date("2024-01-01"),
    });
    expect(c.titulo).toBe("Matrix");
    expect(c.tipo).toBe("pelicula");
    expect(c.fuenteExterna).toBe("tmdb");
  });
});
