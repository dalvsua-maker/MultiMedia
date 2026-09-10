export interface CrearListaDto {
  nombre: string;
  descripcion?: string | null;
}

export interface ListaDto {
  id: string;
  usuarioId: string;
  nombre: string;
  descripcion: string | null;
  fechaCreacion: string;
}

export interface ListaDetalleDto extends ListaDto {
  contenidos: {
    id: string;
    tipo: string;
    titulo: string;
    imagenUrl: string | null;
    fuenteExterna: string;
    idExterno: string;
    fechaAnadido: string;
  }[];
}

export interface AddContenidoDto {
  contenidoId: string;
}
