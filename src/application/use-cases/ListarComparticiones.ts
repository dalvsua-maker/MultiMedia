import { IComparticionRepository } from "@/domain/repositories/IComparticionRepository";
import { ListarComparticionesResponseDto } from "@/application/dtos/ComparticionDto";
import { UnauthorizedError } from "@/application/errors/AppError";

export class ListarComparticionesUseCase {
  constructor(private readonly repo: IComparticionRepository) {}

  async execute(usuarioId: string): Promise<ListarComparticionesResponseDto> {
    if (!usuarioId) throw new UnauthorizedError("Usuario no autenticado");
    const { enviadas, recibidas } = await this.repo.findByUsuario(usuarioId);
    const map = (c: typeof enviadas[number]) => ({
      id: c.id,
      contenido: c.contenido,
      usuarioOrigen: c.usuarioOrigen,
      usuarioDestino: c.usuarioDestino,
      estado: c.estado,
      fechaEnvio: c.fechaEnvio.toISOString(),
    });
    return {
      enviadas: enviadas.map(map),
      recibidas: recibidas.map(map),
    };
  }
}
