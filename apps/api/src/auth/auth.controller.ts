import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  async signup(@Body() body: { email: string; password: string; name?: string }) {
    // Stub — will be wired in M1.5 when UserRepository is ready
    return {
      message: 'Signup endpoint ready',
      user: { email: body.email, name: body.name || null },
    };
  }

  @Post('signin')
  @HttpCode(HttpStatus.OK)
  async signin(@Body() body: { email: string; password: string }) {
    // Stub — will be wired in M1.5
    return {
      message: `Signin endpoint ready for ${body.email}`,
      accessToken: 'stub-token',
    };
  }
}
