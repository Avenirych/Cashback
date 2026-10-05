import { Controller, Body, Post, Get, Req, UseGuards, HttpException, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(
    @Body('email') email: string,
    @Body('password') password: string,
    @Body('name') name: string,
  ) {
    try {
      console.log('📨 Register endpoint received:', { email, name });
      const result = await this.authService.register(email, password, name);
      console.log('✅ Register endpoint success');
      return result;
    } catch (error) {
      console.error('📨 Register endpoint error:', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        error instanceof Error ? error.message : 'Registration failed',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post('login')
  async login(
    @Body('email') email: string,
    @Body('password') password: string,
  ) {
    try {
      console.log('📨 Login endpoint received:', email);
      const result = await this.authService.login(email, password);
      console.log('✅ Login endpoint success');
      return result;
    } catch (error) {
      console.error('📨 Login endpoint error:', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        error instanceof Error ? error.message : 'Login failed',
        HttpStatus.UNAUTHORIZED,
      );
    }
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  profile(@Req() req: any) {
    return this.authService.profile(req.user);
  }
}
