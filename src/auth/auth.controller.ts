import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  Query,
  BadRequestException,
  HttpException,
  Header,
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
  firstName?: string;
  lastName?: string;
  phone_e164?: string;
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
  private readonly resendRequests = new Map<string, { count: number; until: number }>();
  private checkResendLimit(ip: string) {
    const now = Date.now();
    for (const [key, value] of this.resendRequests) if (value.until <= now) this.resendRequests.delete(key);
    const entry = this.resendRequests.get(ip) || { count: 0, until: now + 3600000 };
    if (entry.count >= 10 || (!this.resendRequests.has(ip) && this.resendRequests.size >= 10000))
      throw new HttpException('Слишком много запросов. Попробуйте позже.', 429);
    entry.count++;
    this.resendRequests.set(ip, entry);
  }
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
      `${body.firstName || ""} ${body.lastName || ""}`.trim(),
      {firstName:body.firstName,lastName:body.lastName,phone_e164:body.phone_e164},
    );
  }

  @Get('verify-email')
  @Header('Cache-Control', 'no-store')
  async verifyEmail(@Query('token') token: string) {
    return this.authService.verifyEmail(token);
  }

  @Post('resend-verification')
  async resendVerification(
    @Body() body: ResendVerificationBody,
    @Request() req: { ip?: string; socket?: { remoteAddress?: string } } = {},
  ) {
    if (!body) {
      throw new BadRequestException('Email is required');
    }

    this.checkResendLimit(req.ip || req.socket?.remoteAddress || 'unknown');
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
  @Header('Cache-Control', 'no-store')
  @UseGuards(JwtAuthGuard)
  async profile(@Request() req: AuthenticatedRequest) {
    return this.authService.profile(req.user);
  }
}