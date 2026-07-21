import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}

  async signToken(userId: string, email: string): Promise<string> {
    return this.jwtService.signAsync({ sub: userId, email });
  }

  async verifyToken(token: string): Promise<{ sub: string; email: string }> {
    return this.jwtService.verifyAsync(token);
  }
}
