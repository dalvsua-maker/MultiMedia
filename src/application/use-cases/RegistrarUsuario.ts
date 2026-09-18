import bcrypt from "bcryptjs";
import { signAccess } from "@/infrastructure/auth/jwt";
import { Usuario } from "@/domain/entities/Usuario";
import { IUsuarioRepository } from "@/domain/repositories/IUsuarioRepository";
import { RegisterDto, AuthResponseDto } from "@/application/dtos/AuthDto";
import { ConflictError, ValidationError } from "@/application/errors/AppError";

const BCRYPT_ROUNDS = 10;

function validateRegisterDto(dto: RegisterDto): void {
  Usuario.validateNombre(dto.nombre);
  Usuario.validateEmail(dto.email);
  if (!dto.password || dto.password.length < 6) {
    throw new ValidationError("La contraseña debe tener al menos 6 caracteres");
  }
  if (dto.password.length > 255) {
    throw new ValidationError("La contraseña no puede superar 255 caracteres");
  }
}

export class RegistrarUsuarioUseCase {
  constructor(private readonly usuarioRepo: IUsuarioRepository) {}

  async execute(dto: RegisterDto): Promise<AuthResponseDto> {
    validateRegisterDto(dto);

    const email = dto.email.toLowerCase().trim();
    Usuario.validateEmail(email);

    const existente = await this.usuarioRepo.findByEmail(email);
    if (existente) {
      throw new ConflictError("Ya existe un usuario con ese email");
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const usuario = await this.usuarioRepo.create({
      nombre: dto.nombre.trim(),
      email,
      passwordHash,
    });

    const token = signAccess({ sub: usuario.id, email: usuario.email });

    return {
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        fechaRegistro: usuario.fechaRegistro.toISOString(),
      },
      token,
    };
  }
}
