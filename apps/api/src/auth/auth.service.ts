import { Inject, Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { UserRepository } from '@byrdos/domain';
import { hashPassword, verifyPassword } from '@byrdos/auth';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    @Inject('UserRepository') private readonly userRepo: UserRepository,
  ) {}

  async signup(email: string, password: string, name?: string) {
    const existing = await this.userRepo.findByEmail(email);
    if (existing) {
      throw new ConflictException('Email already registered');
    }
    const passwordHash = await hashPassword(password);
    const user = await this.userRepo.create({ email, passwordHash, name });
    const accessToken = await this.signToken(user.id, user.email);
    return {
      user: { id: user.id, email: user.email, name: user.name },
      accessToken,
    };
  }

  async signin(email: string, password: string) {
    const user = await this.userRepo.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const storedHash = await this.userRepo.getPasswordHash(email);
    if (!storedHash) {
      throw new UnauthorizedException('Account uses social login. Please sign in with Google.');
    }
    const isValid = await verifyPassword(password, storedHash);
    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const accessToken = await this.signToken(user.id, user.email);
    return {
      user: { id: user.id, email: user.email, name: user.name },
      accessToken,
    };
  }

  async signToken(userId: string, email: string): Promise<string> {
    return this.jwtService.signAsync({ sub: userId, email });
  }

  async verifyToken(token: string): Promise<{ sub: string; email: string }> {
    return this.jwtService.verifyAsync(token);
  }
}
