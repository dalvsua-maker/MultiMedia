import bcrypt from "bcryptjs";
import { signAccess } from "@/infrastructure/auth/jwt";
import { IUsuarioRepository } from "@/domain/repositories/IUsuarioRepository";
import { LoginDto, AuthResponseDto } from "@/application/dtos/AuthDto";
import { UnauthorizedError, ValidationError } from "@/application/errors/AppError";

export class LoginUsuarioUseCase {
  constructor(private readonly usuarioRepo: IUsuarioRepository) {}

  async execute(dto: LoginDto): Promise<AuthResponseDto> {
    if (!dto.email || !dto.password) {
      throw new ValidationError("Email y contraseña son obligatorios");
    }

    const email = dto.email.toLowerCase().trim();
    const usuario = await this.usuarioRepo.findByEmail(email);

    if (!usuario) {
      throw new UnauthorizedError("Credenciales no válidas");
    }

    const ok = await bcrypt.compare(dto.password, usuario.passwordHash);
    if (!ok) {
      throw new UnauthorizedError("Credenciales no válidas");
    }

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
