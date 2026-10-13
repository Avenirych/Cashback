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
import { JwtConfigurationModule, jwtRegistrationOptions } from './jwt-configuration';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    JwtConfigurationModule,
    JwtModule.registerAsync(jwtRegistrationOptions),
    PassportModule,
    UsersModule,
    MailModule,
  ],
  providers: [AuthService, JwtStrategy],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
