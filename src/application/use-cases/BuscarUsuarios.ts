import { IUsuarioRepository } from "@/domain/repositories/IUsuarioRepository";
import { UsuarioBuscadoDto } from "@/application/dtos/ComparticionDto";
import {
  ValidationError,
  UnauthorizedError,
} from "@/application/errors/AppError";

export class BuscarUsuariosUseCase {
  constructor(private readonly usuarioRepo: IUsuarioRepository) {}

  async execute(
    usuarioId: string,
    qRaw: string
  ): Promise<UsuarioBuscadoDto[]> {
    if (!usuarioId) throw new UnauthorizedError("Usuario no autenticado");
    const q = (qRaw ?? "").trim();
    if (!q || q.length < 2) {
      throw new ValidationError("q debe tener al menos 2 caracteres");
    }
    const resultados = await this.usuarioRepo.buscarPorNombre(q, usuarioId, 10);
    return resultados;
  }
}
