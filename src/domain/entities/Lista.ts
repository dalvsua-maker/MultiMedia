export interface ListaProps {
  id: string;
  usuarioId: string;
  nombre: string;
  descripcion: string | null;
  fechaCreacion: Date;
}

export class Lista {
  readonly id: string;
  readonly usuarioId: string;
  readonly nombre: string;
  readonly descripcion: string | null;
  readonly fechaCreacion: Date;

  constructor(props: ListaProps) {
    this.id = props.id;
    this.usuarioId = props.usuarioId;
    this.nombre = props.nombre;
    this.descripcion = props.descripcion;
    this.fechaCreacion = props.fechaCreacion;
  }

  static validateNombre(nombre: string): void {
    if (!nombre || nombre.trim().length === 0) {
      throw new Error("El nombre de la lista es obligatorio");
    }
    if (nombre.length > 100) {
      throw new Error("El nombre no puede superar 100 caracteres");
    }
  }

  static validateDescripcion(descripcion: string | null | undefined): void {
    if (descripcion != null && descripcion.length > 500) {
      throw new Error("La descripción no puede superar 500 caracteres");
    }
  }
}

export interface ListaConContenidos extends ListaProps {
  contenidos: {
    id: string;
    tipo: string;
    titulo: string;
    imagenUrl: string | null;
    fuenteExterna: string;
    idExterno: string;
    fechaAnadido: Date;
    estado: string | null;
  }[];
}
