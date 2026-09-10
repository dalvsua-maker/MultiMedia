export interface RegisterDto {
  nombre: string;
  email: string;
  password: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface AuthResponseDto {
  usuario: {
    id: string;
    nombre: string;
    email: string;
    fechaRegistro: string;
  };
  token: string;
}

export interface UsuarioDto {
  id: string;
  nombre: string;
  email: string;
  fechaRegistro: string;
}
