import {
  Controller, Get, Patch, Param, Body, Req, UseGuards,
  ParseIntPipe, ForbiddenException, NotFoundException, UnauthorizedException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersService } from './users.service';
import { parseOwnUserPatch, ownProfileDto } from './users.dto';

interface UserRequest { user?: { id?: number } }

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // No public list/create/balance endpoints: there is no admin authorization.
  private ownerId(req: UserRequest, requestedId: number): number {
    const authenticatedId = req.user?.id;
    if (!Number.isSafeInteger(authenticatedId) || (authenticatedId ?? 0) <= 0) {
      throw new UnauthorizedException('Invalid authenticated identity');
    }
    if (requestedId !== authenticatedId) {
      throw new ForbiddenException('Only your own account is accessible');
    }
    return authenticatedId!;
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getById(@Param('id', ParseIntPipe) id: number, @Req() req: UserRequest) {
    const owner = this.ownerId(req, id);
    const user = await this.usersService.getOwnProfile(owner);
    if (!user) throw new NotFoundException('User not found');
    return ownProfileDto(user);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: UserRequest,
    @Body() body: unknown,
  ) {
    const owner = this.ownerId(req, id);
    const update = parseOwnUserPatch(body);
    return ownProfileDto(await this.usersService.updateOwnProfile(owner, update));
  }
}
