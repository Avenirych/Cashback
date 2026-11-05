import { requiredJwtSecret } from '../local-configuration';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { UsersModule } from '../users/users.module';
import { MailModule } from '../mail/mail.module';
import { User } from '../users/user.entity';
import {PasswordSecurityService} from './password-security.service';
import {PasswordSecurityController} from './password-security.controller';
import {PasswordMailWorker} from './password-mail.worker';
import {ActivityModule} from '../activity/activity.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    JwtModule.register({
      secret: requiredJwtSecret(),
      signOptions: { expiresIn: '24h' },
    }),
    PassportModule,
    UsersModule,
    MailModule,
    ActivityModule,
  ],
  providers: [AuthService, JwtStrategy, PasswordSecurityService, PasswordMailWorker],
  controllers: [AuthController, PasswordSecurityController],
  exports: [AuthService],
})
export class AuthModule {}
