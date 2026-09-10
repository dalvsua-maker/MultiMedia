import { describe, it, expect } from "vitest";
import {
  isTipoBusqueda,
  TIPOS_BUSQUEDA,
} from "@/application/dtos/BusquedaDto";

describe("Busqueda DTO (dominio)", () => {
  it("reconoce tipos válidos", () => {
    expect(isTipoBusqueda("pelicula")).toBe(true);
    expect(isTipoBusqueda("serie")).toBe(true);
    expect(isTipoBusqueda("videojuego")).toBe(true);
    expect(isTipoBusqueda("musica")).toBe(true);
  });

  it("rechaza tipos inválidos", () => {
    expect(isTipoBusqueda("libro")).toBe(false);
    expect(isTipoBusqueda("")).toBe(false);
    expect(isTipoBusqueda("Pelicula")).toBe(false); // case-sensitive
  });

  it("lista de tipos es 4 y contiene los esperados", () => {
    expect(TIPOS_BUSQUEDA).toHaveLength(4);
    expect(TIPOS_BUSQUEDA).toEqual(
      expect.arrayContaining(["pelicula", "serie", "videojuego", "musica"])
    );
  });
});
