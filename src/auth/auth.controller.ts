import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

interface AuthenticatedRequest {
  user: {
    id: number;
    email: string;
    name?: string;
  };
}

interface RegisterBody {
  email: string;
  password: string;
  name: string;
}

interface LoginBody {
  email: string;
  password: string;
}

interface ResendVerificationBody {
  email: string;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
  ) {}

  @Post('register')
  async register(@Body() body: RegisterBody) {
    if (!body) {
      throw new BadRequestException(
        'Registration data is required',
      );
    }

    return this.authService.register(
      body.email,
      body.password,
      body.name,
    );
  }

  @Get('verify-email')
  async verifyEmail(@Query('token') token: string) {
    return this.authService.verifyEmail(token);
  }

  @Post('resend-verification')
  async resendVerification(
    @Body() body: ResendVerificationBody,
  ) {
    if (!body) {
      throw new BadRequestException('Email is required');
    }

    return this.authService.resendVerificationEmail(
      body.email,
    );
  }

  @Post('login')
  async login(@Body() body: LoginBody) {
    if (!body) {
      throw new BadRequestException(
        'Email and password are required',
      );
    }

    return this.authService.login(
      body.email,
      body.password,
    );
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async profile(@Request() req: AuthenticatedRequest) {
    return this.authService.profile(req.user);
  }
}