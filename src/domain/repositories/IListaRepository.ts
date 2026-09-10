import { Lista, ListaConContenidos } from "@/domain/entities/Lista";

export interface CrearListaData {
  usuarioId: string;
  nombre: string;
  descripcion?: string | null;
}

export interface IListaRepository {
  create(data: CrearListaData): Promise<Lista>;
  findByUsuarioId(usuarioId: string): Promise<Lista[]>;
  findById(id: string): Promise<Lista | null>;
  findByIdWithContenidos(id: string): Promise<ListaConContenidos | null>;
  addContenido(listaId: string, contenidoId: string): Promise<void>;
  removeContenido(listaId: string, contenidoId: string): Promise<void>;
  existsContenidoInLista(listaId: string, contenidoId: string): Promise<boolean>;
  contenidoExists(contenidoId: string): Promise<boolean>;
}
