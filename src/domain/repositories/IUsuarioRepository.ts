import { Usuario } from "@/domain/entities/Usuario";

export interface IUsuarioRepository {
  findByEmail(email: string): Promise<Usuario | null>;
  findById(id: string): Promise<Usuario | null>;
  create(data: { nombre: string; email: string; passwordHash: string }): Promise<Usuario>;
  buscarPorNombre(q: string, excluidoId: string, limite?: number): Promise<{ id: string; nombre: string }[]>;
}
