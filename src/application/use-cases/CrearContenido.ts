import {
  Contenido,
  FuenteExterna,
  TipoContenido,
} from "@/domain/entities/Contenido";
import { IContenidoRepository } from "@/domain/repositories/IContenidoRepository";
import { IUsuarioContenidoRepository } from "@/domain/repositories/IUsuarioContenidoRepository";
import { IListaRepository } from "@/domain/repositories/IListaRepository";
import { CrearContenidoDto, CrearContenidoResponseDto, ContenidoDto } from "@/application/dtos/ContenidoDto";
import {
  ValidationError,
  NotFoundError,
  ForbiddenError,
  UnauthorizedError,
} from "@/application/errors/AppError";

function toDto(
  c: Contenido,
  detalle: CrearContenidoResponseDto["contenido"]["detalle"]
): ContenidoDto {
  return {
    id: c.id,
    tipo: c.tipo,
    titulo: c.titulo,
    imagenUrl: c.imagenUrl,
    fuenteExterna: c.fuenteExterna,
    idExterno: c.idExterno,
    fechaAnadido: c.fechaAnadido.toISOString(),
    detalle,
  };
}

export class CrearContenidoUseCase {
  constructor(
    private readonly contenidoRepo: IContenidoRepository,
    private readonly usuarioContenidoRepo: IUsuarioContenidoRepository,
    private readonly listaRepo: IListaRepository
  ) {}

  async execute(
    usuarioId: string,
    dto: CrearContenidoDto
  ): Promise<CrearContenidoResponseDto> {
    if (!usuarioId) throw new UnauthorizedError("Usuario no autenticado");

    // Validaciones dominio
    try {
      Contenido.validateTipo(dto.tipo);
      Contenido.validateFuente(dto.fuenteExterna);
      Contenido.validateTitulo(dto.titulo);
      Contenido.validateIdExterno(dto.idExterno);
      Contenido.validateImagenUrl(dto.imagenUrl ?? null);
    } catch (e) {
      throw new ValidationError((e as Error).message);
    }

    // Si listaId proporcionado, validar ownership antes de tocar DB
    if (dto.listaId) {
      const lista = await this.listaRepo.findById(dto.listaId);
      if (!lista) throw new NotFoundError("Lista no encontrada");
      if (lista.usuarioId !== usuarioId) {
        throw new ForbiddenError("No tienes acceso a esta lista");
      }
    }

    // Buscar contenido global por @@unique — con handling de race P2002
    let contenido = await this.contenidoRepo.findByFuenteExternaAndIdExterno(
      dto.fuenteExterna as FuenteExterna,
      dto.idExterno
    );

    let yaExistia = false;
    let contenidoConDetalle: ContenidoDto["detalle"] = null;

    if (!contenido) {
      try {
        // Crear contenido + detalle (transacción en repo)
        contenido = await this.contenidoRepo.create({
          tipo: dto.tipo as TipoContenido,
          titulo: dto.titulo.trim(),
          imagenUrl: dto.imagenUrl ?? null,
          fuenteExterna: dto.fuenteExterna as FuenteExterna,
          idExterno: dto.idExterno,
          detalle: dto.detalle ?? null,
        });
        // Mapear detalle para respuesta
        contenidoConDetalle = dto.detalle
          ? ({ _tipo: dto.tipo, ...(dto.detalle as Record<string, unknown>) } as ContenidoDto["detalle"])
          : null;
        yaExistia = false;
      } catch (e: unknown) {
        const err = e as { code?: string; meta?: { target?: string[] } };
        const isP2002 =
          err?.code === "P2002" ||
          (Array.isArray(err?.meta?.target) &&
            err.meta.target.some((t) => t.includes("fuenteExterna") || t.includes("idExterno")));
        if (isP2002) {
          // Race: otro request creó el mismo contenido entre find y create → reutilizar
          const existente = await this.contenidoRepo.findByFuenteExternaAndIdExterno(
            dto.fuenteExterna as FuenteExterna,
            dto.idExterno
          );
          if (!existente) throw e;
          contenido = existente;
          yaExistia = true;
          const conDetalle = await this.contenidoRepo.findByIdConDetalle(contenido.id);
          contenidoConDetalle = conDetalle?.detalle ?? null;
        } else {
          throw e;
        }
      }
    } else {
      yaExistia = true;
      // Si ya existía, recuperar detalle para respuesta
      const conDetalle = await this.contenidoRepo.findByIdConDetalle(contenido.id);
      contenidoConDetalle = conDetalle?.detalle ?? null;
    }

    // Crear usuario_contenido si no existe (idempotente 200)
    const yaTiene = await this.usuarioContenidoRepo.exists(usuarioId, contenido.id);
    if (!yaTiene) {
      await this.usuarioContenidoRepo.create(usuarioId, contenido.id, "pendiente");
    } else {
      // idempotente: ya lo tiene, no error, mantener yaExistia true (global reuse)
      yaExistia = true;
    }

    // Si listaId, añadir a lista si no está ya (idempotente)
    if (dto.listaId) {
      const enLista = await this.listaRepo.existsContenidoInLista(
        dto.listaId,
        contenido.id
      );
      if (!enLista) {
        await this.listaRepo.addContenido(dto.listaId, contenido.id);
      }
    }

    return {
      contenido: toDto(contenido, contenidoConDetalle),
      estadoUsuario: "pendiente",
      yaExistia,
    };
  }
}
