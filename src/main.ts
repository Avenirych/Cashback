import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'node:path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.useStaticAssets(join(process.cwd(), 'public', 'avatars'), {
    prefix: '/avatars/',
    dotfiles: 'deny',
    index: false,
    setHeaders: (response) => {
      response.setHeader('X-Content-Type-Options', 'nosniff');
    },
  });

  app.enableCors();

  await app.listen(3001);

  console.log('Backend running at http://localhost:3001');
}

void bootstrap();
