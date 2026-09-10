import { Lista } from "@/domain/entities/Lista";
import { IListaRepository } from "@/domain/repositories/IListaRepository";
import { CrearListaDto, ListaDto } from "@/application/dtos/ListaDto";
import { ValidationError } from "@/application/errors/AppError";

function toDto(lista: Lista): ListaDto {
  return {
    id: lista.id,
    usuarioId: lista.usuarioId,
    nombre: lista.nombre,
    descripcion: lista.descripcion,
    fechaCreacion: lista.fechaCreacion.toISOString(),
  };
}

export class CrearListaUseCase {
  constructor(private readonly listaRepo: IListaRepository) {}

  async execute(usuarioId: string, dto: CrearListaDto): Promise<ListaDto> {
    if (!usuarioId) throw new ValidationError("Usuario no autenticado");

    const nombre = typeof dto.nombre === "string" ? dto.nombre.trim() : "";
    const descripcion =
      dto.descripcion != null && typeof dto.descripcion === "string"
        ? dto.descripcion.trim() || null
        : dto.descripcion ?? null;

    try {
      Lista.validateNombre(nombre);
      Lista.validateDescripcion(descripcion);
    } catch (e) {
      throw new ValidationError((e as Error).message);
    }

    const lista = await this.listaRepo.create({
      usuarioId,
      nombre,
      descripcion,
    });

    return toDto(lista);
  }
}
