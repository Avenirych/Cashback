import {forumWriteBarrier} from './forum/moderation-schema-gate';
import { localConfiguration } from './local-configuration';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'node:path';

async function bootstrap() {
  const config = localConfiguration();
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.use(forumWriteBarrier);
  app.useStaticAssets(join(process.cwd(), 'public', 'avatars'), {
    prefix: '/avatars/',
    dotfiles: 'deny',
    index: false,
    setHeaders: (response) => {
      response.setHeader('X-Content-Type-Options', 'nosniff');
    },
  });

  app.enableCors({origin:config.origin,methods:['GET','POST','PATCH','DELETE','OPTIONS'],allowedHeaders:['Content-Type','Authorization','Idempotency-Key']});

  await app.listen(config.port, config.host);

  console.log('Historical backend ready on configured local port');
}

void bootstrap();
