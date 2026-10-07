import {
  Injectable,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ForumUser } from './forum-user.entity';
import { UsersService } from '../users/users.service';

export const AVATAR_MAX_SIZE = 500 * 1024;
export interface AvatarUpload {
  buffer: Buffer;
  size: number;
  mimetype: string;
}

@Injectable()
export class ForumUserService {
  private lastAvatarTimestamp = 0;
  private readonly avatarDirectory = join(process.cwd(), 'public', 'avatars');

  constructor(
    private readonly usersService: UsersService,
    @InjectRepository(ForumUser)
    private readonly forumUserRepo: Repository<ForumUser>,
  ) {}

  private validateId(id: number) {
    if (!Number.isSafeInteger(id) || id <= 0) {
      throw new BadRequestException('Invalid ID / Некорректный ID');
    }
  }

  private validateUsername(username: unknown): asserts username is string {
    if (
      typeof username !== 'string' ||
      !/^[A-Za-z0-9_]{3,30}$/.test(username)
    ) {
      throw new BadRequestException(
        'Username must contain 3–30 letters, digits or underscores / Имя должно содержать 3–30 латинских букв, цифр или знаков подчёркивания',
      );
    }
  }

  private async verifiedUser(userId: number) {
    this.validateId(userId);
    const user = await this.usersService.getById(userId);
    if (!user || user.email_verified !== true) {
      throw new ForbiddenException('Verify your email / Подтвердите email');
    }
    return user;
  }

  async assertVerifiedUser(userId: number): Promise<void> {
    await this.verifiedUser(userId);
  }

  async activeMember(userId: number) {
    await this.verifiedUser(userId);
    const member = await this.getByUserId(userId);
    if (!member) {
      throw new ForbiddenException(
        'Register for the forum / Зарегистрируйтесь на форуме',
      );
    }
    if (member.agreed_to_rules !== true) {
      throw new ForbiddenException(
        'Accept the forum rules / Примите правила форума',
      );
    }
    if (member.banned) {
      throw new ForbiddenException(
        'Forum access is banned / Доступ к форуму заблокирован',
      );
    }
    return member;
  }

  private uniqueConflict(error: unknown): never {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === '23505'
    ) {
      throw new ConflictException(
        'Username or forum account already exists / Имя или аккаунт форума уже существует',
      );
    }
    throw error;
  }

  async register(userId: number, username: unknown, agreedToRules: unknown) {
    this.validateUsername(username);
    if (agreedToRules !== true) {
      throw new BadRequestException(
        'Accept the forum rules / Примите правила форума',
      );
    }
    await this.verifiedUser(userId);
    if (await this.getByUserId(userId)) {
      throw new ConflictException(
        'Already registered / Вы уже зарегистрированы',
      );
    }
    if (await this.getByUsername(username)) {
      throw new ConflictException('Username is taken / Имя уже занято');
    }
    const member = this.forumUserRepo.create({
      user_id: userId,
      username,
      agreed_to_rules: true,
      agreed_to_rules_at: new Date(),
      avatar_url: null,
      banned: false,
      ban_reason: null,
    });
    try {
      return this.safeProfile(await this.forumUserRepo.save(member), true);
    } catch (error) {
      this.uniqueConflict(error);
    }
  }

  getByUserId(userId: number): Promise<ForumUser | null> {
    this.validateId(userId);
    return this.forumUserRepo.findOne({ where: { user_id: userId } });
  }

  getByUsername(username: unknown): Promise<ForumUser | null> {
    this.validateUsername(username);
    return this.forumUserRepo.findOne({ where: { username } });
  }

  getByUserIds(userIds: number[]): Promise<ForumUser[]> {
    return userIds.length
      ? this.forumUserRepo.find({ where: { user_id: In(userIds) } })
      : Promise.resolve([]);
  }

  safeProfile(member: ForumUser, own = false) {
    return {
      id: member.id,
      user_id: member.user_id,
      username: member.username,
      avatar_url: member.avatar_url,
      created_at: member.created_at,
      agreed_to_rules: member.agreed_to_rules,
      agreed_to_rules_at: member.agreed_to_rules_at,
      updated_at: member.updated_at,
      ...(own ? { banned: member.banned } : {}),
    };
  }

  async status(userId: number) {
    const member = await this.getByUserId(userId);
    return {
      registered: !!member,
      forumUser: member ? this.safeProfile(member, true) : null,
    };
  }

  async publicProfile(username: unknown) {
    const member = await this.getByUsername(username);
    if (!member)
      throw new NotFoundException('Forum user not found / Участник не найден');
    return this.safeProfile(member);
  }

  async updateProfile(userId: number, data: unknown) {
    const member = await this.activeMember(userId);
    if (
      !data ||
      typeof data !== 'object' ||
      Array.isArray(data) ||
      Object.keys(data).some(
        (key) => !['username', 'avatarFile', 'avatar_url'].includes(key),
      ) ||
      Object.keys(data).length === 0
    ) {
      throw new BadRequestException(
        'Only username and a validated avatar can be updated / Можно изменить только имя и проверенный аватар',
      );
    }
    if ('avatar_url' in data && data.avatar_url !== null) {
      throw new BadRequestException(
        'Avatar URLs cannot be supplied / Нельзя задавать адрес аватара',
      );
    }
    if ('avatarFile' in data && 'avatar_url' in data) {
      throw new BadRequestException(
        'Choose an upload or avatar removal / Выберите загрузку или удаление аватара',
      );
    }
    const avatarFile =
      'avatarFile' in data
        ? (data.avatarFile as AvatarUpload | undefined)
        : undefined;
    if ('avatarFile' in data) this.avatarExtension(avatarFile);

    const changes: Partial<ForumUser> = {};
    if ('username' in data) {
      this.validateUsername(data.username);
      const existing = await this.getByUsername(data.username);
      if (existing && existing.user_id !== userId) {
        throw new ConflictException('Username is taken / Имя уже занято');
      }
      changes.username = data.username;
    }
    if ('avatar_url' in data) changes.avatar_url = null;
    if (Object.keys(changes).length) {
      changes.updated_at = new Date();
      try {
        const criteria =
          'avatar_url' in data
            ? {
                id: member.id,
                avatar_url:
                  member.avatar_url === null ? IsNull() : member.avatar_url,
              }
            : { id: member.id };
        const result = await this.forumUserRepo.update(criteria, changes);
        if (result.affected !== 1)
          throw new ConflictException(
            'Profile changed; retry / Профиль изменился; повторите попытку',
          );
      } catch (error) {
        this.uniqueConflict(error);
      }
      if ('avatar_url' in data)
        await this.removeAvatar(member.avatar_url, userId);
      Object.assign(member, changes);
    }
    if ('avatarFile' in data) return this.uploadAvatar(userId, avatarFile);
    return this.safeProfile(member, true);
  }

  private avatarExtension(file: AvatarUpload | undefined) {
    if (
      !file ||
      !Buffer.isBuffer(file.buffer) ||
      file.size !== file.buffer.length ||
      file.size <= 0 ||
      file.size > AVATAR_MAX_SIZE
    ) {
      throw new BadRequestException(
        'Avatar must be at most 500 KB / Аватар должен быть не больше 500 КБ',
      );
    }
    const bytes = file.buffer;
    if (
      file.mimetype === 'image/jpeg' &&
      bytes.length >= 3 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff
    )
      return 'jpg';
    if (
      file.mimetype === 'image/png' &&
      bytes.length >= 8 &&
      bytes
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    )
      return 'png';
    if (
      file.mimetype === 'image/webp' &&
      bytes.length >= 12 &&
      bytes.toString('ascii', 0, 4) === 'RIFF' &&
      bytes.toString('ascii', 8, 12) === 'WEBP'
    )
      return 'webp';
    throw new BadRequestException(
      'Only JPG, PNG and WebP images are allowed / Разрешены только JPG, PNG и WebP',
    );
  }

  private async removeAvatar(url: string | null, userId: number) {
    if (
      !url ||
      !/^\/avatars\/[1-9]\d*-\d+\.(jpg|png|webp)$/.test(url) ||
      !url.startsWith(`/avatars/${userId}-`)
    )
      return;
    await unlink(
      join(this.avatarDirectory, url.substring('/avatars/'.length)),
    ).catch(() => undefined);
  }

  async uploadAvatar(userId: number, file: AvatarUpload | undefined) {
    const extension = this.avatarExtension(file);
    const member = await this.activeMember(userId);
    await mkdir(this.avatarDirectory, { recursive: true });
    let url: string;
    for (;;) {
      this.lastAvatarTimestamp = Math.max(
        Date.now(),
        this.lastAvatarTimestamp + 1,
      );
      url = `/avatars/${userId}-${this.lastAvatarTimestamp}.${extension}`;
      try {
        await writeFile(
          join(
            this.avatarDirectory,
            `${userId}-${this.lastAvatarTimestamp}.${extension}`,
          ),
          file!.buffer,
          { flag: 'wx' },
        );
        break;
      } catch (error) {
        if (
          typeof error === 'object' &&
          error !== null &&
          'code' in error &&
          error.code === 'EEXIST'
        )
          continue;
        throw error;
      }
    }
    const updatedAt = new Date();
    try {
      const result = await this.forumUserRepo.update(
        {
          id: member.id,
          avatar_url: member.avatar_url === null ? IsNull() : member.avatar_url,
        },
        { avatar_url: url, updated_at: updatedAt },
      );
      if (result.affected !== 1)
        throw new ConflictException(
          'Avatar changed; retry / Аватар изменился; повторите попытку',
        );
    } catch (error) {
      await this.removeAvatar(url, userId);
      throw error;
    }
    await this.removeAvatar(member.avatar_url, userId);
    member.avatar_url = url;
    member.updated_at = updatedAt;
    return this.safeProfile(member, true);
  }

  async ban(userId: number, reason: unknown) {
    if (typeof reason !== 'string' || !reason.trim() || reason.length > 1000) {
      throw new BadRequestException(
        'Ban reason is required / Укажите причину блокировки',
      );
    }
    const member = await this.getByUserId(userId);
    if (!member) throw new NotFoundException('Forum user not found');
    await this.forumUserRepo.update(
      { id: member.id },
      { banned: true, ban_reason: reason.trim() },
    );
  }

  async isBanned(userId: number): Promise<boolean> {
    return (await this.getByUserId(userId))?.banned === true;
  }
}
