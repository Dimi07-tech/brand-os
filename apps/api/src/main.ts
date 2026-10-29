import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';
import type { Env } from './config/env.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get<ConfigService<Env, true>>(ConfigService);
  configureApp(app);

  // Documentation OpenAPI (§7.3), désactivée en production
  if (config.get('NODE_ENV', { infer: true }) !== 'production') {
    const openApi = new DocumentBuilder()
      .setTitle('Brand OS API')
      .setVersion('1.0')
      .addCookieAuth('session')
      .build();
    SwaggerModule.setup('api/docs', app, () => SwaggerModule.createDocument(app, openApi));
  }

  await app.listen(config.get('API_PORT', { infer: true }));
}
await bootstrap();
