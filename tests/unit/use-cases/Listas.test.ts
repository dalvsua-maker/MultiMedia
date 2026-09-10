import { describe, it, expect, beforeEach } from "vitest";
import { CrearListaUseCase } from "@/application/use-cases/CrearLista";
import { ObtenerListasUseCase } from "@/application/use-cases/ObtenerListas";
import { ObtenerListaDetalleUseCase } from "@/application/use-cases/ObtenerListaDetalle";
import { AnadirContenidoAListaUseCase } from "@/application/use-cases/AnadirContenidoALista";
import { QuitarContenidoDeListaUseCase } from "@/application/use-cases/QuitarContenidoDeLista";
import type {
  IListaRepository,
  CrearListaData,
} from "@/domain/repositories/IListaRepository";
import { Lista, ListaConContenidos } from "@/domain/entities/Lista";

// --- Fake repository (in-memory, sin DB) ---
class FakeListaRepo implements IListaRepository {
  listas: Lista[] = [];
  contenidos = new Map<string, Set<string>>(); // listaId -> set contenidoId
  existentesContenidos = new Set<string>(["cont-1", "cont-2"]);

  async create(data: CrearListaData): Promise<Lista> {
    const lista = new Lista({
      id: `lista-${this.listas.length + 1}`,
      usuarioId: data.usuarioId,
      nombre: data.nombre,
      descripcion: data.descripcion ?? null,
      fechaCreacion: new Date(),
    });
    this.listas.push(lista);
    this.contenidos.set(lista.id, new Set());
    return lista;
  }

  async findByUsuarioId(usuarioId: string): Promise<Lista[]> {
    return this.listas.filter((l) => l.usuarioId === usuarioId);
  }

  async findById(id: string): Promise<Lista | null> {
    return this.listas.find((l) => l.id === id) ?? null;
  }

  async findByIdWithContenidos(id: string): Promise<ListaConContenidos | null> {
    const lista = this.listas.find((l) => l.id === id);
    if (!lista) return null;
    const set = this.contenidos.get(id) ?? new Set();
    return {
      id: lista.id,
      usuarioId: lista.usuarioId,
      nombre: lista.nombre,
      descripcion: lista.descripcion,
      fechaCreacion: lista.fechaCreacion,
      contenidos: [...set].map((cid) => ({
        id: cid,
        tipo: "pelicula",
        titulo: `Titulo ${cid}`,
        imagenUrl: null,
        fuenteExterna: "tmdb",
        idExterno: `ext-${cid}`,
        fechaAnadido: new Date(),
      })),
    };
  }

  async addContenido(listaId: string, contenidoId: string): Promise<void> {
    this.contenidos.get(listaId)?.add(contenidoId);
  }

  async removeContenido(listaId: string, contenidoId: string): Promise<void> {
    this.contenidos.get(listaId)?.delete(contenidoId);
  }

  async existsContenidoInLista(listaId: string, contenidoId: string): Promise<boolean> {
    return this.contenidos.get(listaId)?.has(contenidoId) ?? false;
  }

  async contenidoExists(contenidoId: string): Promise<boolean> {
    return this.existentesContenidos.has(contenidoId);
  }
}

describe("UC3 - Casos de uso Listas", () => {
  let repo: FakeListaRepo;

  beforeEach(() => {
    repo = new FakeListaRepo();
  });

  describe("CrearListaUseCase", () => {
    it("crea lista con datos válidos", async () => {
      const uc = new CrearListaUseCase(repo);
      const result = await uc.execute("user-1", {
        nombre: "  Mis Favoritas  ",
        descripcion: "  top pelis ",
      });
      expect(result.nombre).toBe("Mis Favoritas");
      expect(result.descripcion).toBe("top pelis");
      expect(result.usuarioId).toBe("user-1");
    });

    it("falla con nombre vacío", async () => {
      const uc = new CrearListaUseCase(repo);
      await expect(uc.execute("user-1", { nombre: "" })).rejects.toThrow();
      await expect(uc.execute("user-1", { nombre: "   " })).rejects.toThrow();
    });

    it("falla con nombre >100", async () => {
      const uc = new CrearListaUseCase(repo);
      await expect(
        uc.execute("user-1", { nombre: "a".repeat(101) })
      ).rejects.toThrow("100");
    });

    it("falla sin usuarioId", async () => {
      const uc = new CrearListaUseCase(repo);
      await expect(uc.execute("", { nombre: "Ok" })).rejects.toThrow("autenticado");
    });

    it("normaliza descripcion null/undefined", async () => {
      const uc = new CrearListaUseCase(repo);
      const r1 = await uc.execute("user-1", { nombre: "L1", descripcion: null });
      expect(r1.descripcion).toBeNull();
      const r2 = await uc.execute("user-1", { nombre: "L2" });
      expect(r2.descripcion).toBeNull();
    });
  });

  describe("ObtenerListasUseCase", () => {
    it("retorna solo listas del usuario", async () => {
      const crear = new CrearListaUseCase(repo);
      await crear.execute("user-1", { nombre: "U1-L1" });
      await crear.execute("user-2", { nombre: "U2-L1" });
      await crear.execute("user-1", { nombre: "U1-L2" });

      const uc = new ObtenerListasUseCase(repo);
      const listas = await uc.execute("user-1");
      expect(listas).toHaveLength(2);
      expect(listas.every((l) => l.usuarioId === "user-1")).toBe(true);
    });

    it("falla sin usuarioId", async () => {
      const uc = new ObtenerListasUseCase(repo);
      await expect(uc.execute("")).rejects.toThrow("autenticado");
    });
  });

  describe("ObtenerListaDetalleUseCase", () => {
    it("retorna detalle con contenidos", async () => {
      const crear = new CrearListaUseCase(repo);
      const lista = await crear.execute("user-1", { nombre: "Detalle" });
      repo.contenidos.get(lista.id)?.add("cont-1");

      const uc = new ObtenerListaDetalleUseCase(repo);
      const detalle = await uc.execute("user-1", lista.id);
      expect(detalle.id).toBe(lista.id);
      expect(detalle.contenidos).toHaveLength(1);
      expect(detalle.contenidos[0].id).toBe("cont-1");
    });

    it("lanza 404 si lista no existe", async () => {
      const uc = new ObtenerListaDetalleUseCase(repo);
      await expect(uc.execute("user-1", "no-existe")).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it("lanza 403 si lista no pertenece al usuario", async () => {
      const crear = new CrearListaUseCase(repo);
      const lista = await crear.execute("user-1", { nombre: "Privada" });
      const uc = new ObtenerListaDetalleUseCase(repo);
      await expect(uc.execute("user-2", lista.id)).rejects.toMatchObject({
        statusCode: 403,
      });
    });
  });

  describe("AnadirContenidoAListaUseCase", () => {
    it("añade contenido existente no duplicado", async () => {
      const crear = new CrearListaUseCase(repo);
      const lista = await crear.execute("user-1", { nombre: "Add" });
      const uc = new AnadirContenidoAListaUseCase(repo);
      await uc.execute("user-1", lista.id, "cont-1");
      expect(await repo.existsContenidoInLista(lista.id, "cont-1")).toBe(true);
    });

    it("falla 404 si lista no existe", async () => {
      const uc = new AnadirContenidoAListaUseCase(repo);
      await expect(uc.execute("user-1", "nope", "cont-1")).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it("falla 403 si lista no pertenece al usuario", async () => {
      const crear = new CrearListaUseCase(repo);
      const lista = await crear.execute("user-1", { nombre: "Owner" });
      const uc = new AnadirContenidoAListaUseCase(repo);
      await expect(uc.execute("user-2", lista.id, "cont-1")).rejects.toMatchObject({
        statusCode: 403,
      });
    });

    it("falla 404 si contenido no existe globalmente", async () => {
      const crear = new CrearListaUseCase(repo);
      const lista = await crear.execute("user-1", { nombre: "NoCont" });
      const uc = new AnadirContenidoAListaUseCase(repo);
      await expect(uc.execute("user-1", lista.id, "inexistente")).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it("falla 409 si ya está en la lista", async () => {
      const crear = new CrearListaUseCase(repo);
      const lista = await crear.execute("user-1", { nombre: "Dup" });
      const uc = new AnadirContenidoAListaUseCase(repo);
      await uc.execute("user-1", lista.id, "cont-1");
      await expect(uc.execute("user-1", lista.id, "cont-1")).rejects.toMatchObject({
        statusCode: 409,
      });
    });

    it("valida contenidoId obligatorio", async () => {
      const crear = new CrearListaUseCase(repo);
      const lista = await crear.execute("user-1", { nombre: "Val" });
      const uc = new AnadirContenidoAListaUseCase(repo);
      await expect(uc.execute("user-1", lista.id, "")).rejects.toMatchObject({
        statusCode: 400,
      });
    });
  });

  describe("QuitarContenidoDeListaUseCase", () => {
    it("elimina contenido existente", async () => {
      const crear = new CrearListaUseCase(repo);
      const lista = await crear.execute("user-1", { nombre: "Remove" });
      const add = new AnadirContenidoAListaUseCase(repo);
      await add.execute("user-1", lista.id, "cont-1");

      const uc = new QuitarContenidoDeListaUseCase(repo);
      await uc.execute("user-1", lista.id, "cont-1");
      expect(await repo.existsContenidoInLista(lista.id, "cont-1")).toBe(false);
    });

    it("falla 404 si contenido no está en la lista", async () => {
      const crear = new CrearListaUseCase(repo);
      const lista = await crear.execute("user-1", { nombre: "Empty" });
      const uc = new QuitarContenidoDeListaUseCase(repo);
      await expect(uc.execute("user-1", lista.id, "cont-1")).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it("falla 403 si no es propietario", async () => {
      const crear = new CrearListaUseCase(repo);
      const lista = await crear.execute("user-1", { nombre: "Priv" });
      const add = new AnadirContenidoAListaUseCase(repo);
      await add.execute("user-1", lista.id, "cont-1");
      const uc = new QuitarContenidoDeListaUseCase(repo);
      await expect(uc.execute("user-2", lista.id, "cont-1")).rejects.toMatchObject({
        statusCode: 403,
      });
    });

    it("falla 404 si lista no existe", async () => {
      const uc = new QuitarContenidoDeListaUseCase(repo);
      await expect(uc.execute("user-1", "nope", "cont-1")).rejects.toMatchObject({
        statusCode: 404,
      });
    });
  });
});
