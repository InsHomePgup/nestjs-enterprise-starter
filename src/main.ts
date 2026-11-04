import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp, setupSwagger } from './app.setup';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  configureApp(app);
  setupSwagger(app);
  app.enableShutdownHooks();

  await app.listen(app.get(ConfigService).get<number>('app.port') ?? 3000);
}
void bootstrap();
