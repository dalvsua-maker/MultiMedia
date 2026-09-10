import { IListaRepository } from "@/domain/repositories/IListaRepository";
import { ListaDto } from "@/application/dtos/ListaDto";
import { ValidationError } from "@/application/errors/AppError";

export class ObtenerListasUseCase {
  constructor(private readonly listaRepo: IListaRepository) {}

  async execute(usuarioId: string): Promise<ListaDto[]> {
    if (!usuarioId) throw new ValidationError("Usuario no autenticado");
    const listas = await this.listaRepo.findByUsuarioId(usuarioId);
    return listas.map((l) => ({
      id: l.id,
      usuarioId: l.usuarioId,
      nombre: l.nombre,
      descripcion: l.descripcion,
      fechaCreacion: l.fechaCreacion.toISOString(),
    }));
  }
}
