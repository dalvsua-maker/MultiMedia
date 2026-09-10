import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { IUsuarioRepository } from "@/domain/repositories/IUsuarioRepository";
import { LoginDto, AuthResponseDto } from "@/application/dtos/AuthDto";
import { UnauthorizedError, ValidationError } from "@/application/errors/AppError";

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? "7d";

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET no configurado");
  return secret;
}

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

    const token = jwt.sign(
      { sub: usuario.id, email: usuario.email },
      getJwtSecret(),
      { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions
    );

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
