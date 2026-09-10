import { describe, it, expect } from "vitest";
import { Comparticion } from "@/domain/entities/Comparticion";

describe("Comparticion (dominio)", () => {
  it("valida no auto-compartir", () => {
    expect(() => Comparticion.validateNoAutoCompartir("u1", "u1")).toThrow(
      "contigo mismo"
    );
    expect(() => Comparticion.validateNoAutoCompartir("u1", "u2")).not.toThrow();
  });

  it("valida estados", () => {
    expect(Comparticion.isEstadoValido("pendiente")).toBe(true);
    expect(Comparticion.isEstadoValido("aceptada")).toBe(true);
    expect(Comparticion.isEstadoValido("rechazada")).toBe(true);
    expect(Comparticion.isEstadoValido("otro")).toBe(false);
  });

  it("canResponder solo si pendiente", () => {
    const pendiente = new Comparticion({
      id: "c1",
      contenidoId: "cont-1",
      usuarioOrigenId: "u1",
      usuarioDestinoId: "u2",
      estado: "pendiente",
      fechaEnvio: new Date(),
    });
    expect(pendiente.canResponder()).toBe(true);

    const aceptada = new Comparticion({
      id: "c2",
      contenidoId: "cont-1",
      usuarioOrigenId: "u1",
      usuarioDestinoId: "u2",
      estado: "aceptada",
      fechaEnvio: new Date(),
    });
    expect(aceptada.canResponder()).toBe(false);
  });

  it("construye correctamente", () => {
    const c = new Comparticion({
      id: "id1",
      contenidoId: "cont-1",
      usuarioOrigenId: "u1",
      usuarioDestinoId: "u2",
      estado: "pendiente",
      fechaEnvio: new Date("2024-01-01"),
    });
    expect(c.estado).toBe("pendiente");
    expect(c.usuarioOrigenId).toBe("u1");
  });
});
