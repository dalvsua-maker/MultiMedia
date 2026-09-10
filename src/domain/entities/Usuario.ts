export interface UsuarioProps {
  id: string;
  nombre: string;
  email: string;
  passwordHash: string;
  fechaRegistro: Date;
}

export class Usuario {
  readonly id: string;
  readonly nombre: string;
  readonly email: string;
  readonly passwordHash: string;
  readonly fechaRegistro: Date;

  constructor(props: UsuarioProps) {
    this.id = props.id;
    this.nombre = props.nombre;
    this.email = props.email;
    this.passwordHash = props.passwordHash;
    this.fechaRegistro = props.fechaRegistro;
  }

  static validateNombre(nombre: string): void {
    if (!nombre || nombre.trim().length === 0) {
      throw new Error("El nombre es obligatorio");
    }
    if (nombre.length > 100) {
      throw new Error("El nombre no puede superar 100 caracteres");
    }
  }

  static validateEmail(email: string): void {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Email no válido");
    }
    if (email.length > 255) {
      throw new Error("El email no puede superar 255 caracteres");
    }
  }
}
