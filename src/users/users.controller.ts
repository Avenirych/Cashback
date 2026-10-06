import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { User } from './user.entity';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  private safeUser(user: User | null) {
    if (!user) throw new UnauthorizedException('Account unavailable');
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar_url: user.avatar_url,
      balance: user.balance,
      created_at: user.created_at,
    };
  }

  private assertSelf(id: string, req: { user: { id: number } }) {
    if (id !== String(req.user.id)) throw new ForbiddenException();
  }

  @Get()
  getAll() {
    throw new ForbiddenException('Account directory unavailable');
  }

  @Get(':id')
  async getById(@Param('id') id: string, @Req() req: { user: { id: number } }) {
    this.assertSelf(id, req);
    return this.safeUser(await this.usersService.getById(req.user.id));
  }

  @Post()
  create() {
    throw new ForbiddenException('Use account registration');
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Req() req: { user: { id: number } },
    @Body() body: unknown,
  ) {
    this.assertSelf(id, req);
    if (!body || typeof body !== 'object' || Array.isArray(body))
      throw new BadRequestException();
    const input = body as Record<string, unknown>;
    if (Object.keys(input).some((key) => !['name', 'avatar_url'].includes(key)))
      throw new BadRequestException();
    const allowed: Partial<User> = {};
    if (input.name !== undefined) {
      if (
        typeof input.name !== 'string' ||
        input.name.trim().length < 2 ||
        input.name.length > 120
      )
        throw new BadRequestException();
      allowed.name = input.name.trim();
    }
    if (input.avatar_url !== undefined) {
      if (
        input.avatar_url !== null &&
        (typeof input.avatar_url !== 'string' ||
          !input.avatar_url.startsWith('https://') ||
          input.avatar_url.length > 2048)
      )
        throw new BadRequestException();
      allowed.avatar_url = input.avatar_url as string | null;
    }
    return this.safeUser(await this.usersService.update(req.user.id, allowed));
  }

  @Post(':id/balance')
  updateBalance() {
    throw new ForbiddenException(
      'Balances are managed by trusted server processes only',
    );
  }
}
