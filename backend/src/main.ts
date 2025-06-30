import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: ['http://localhost:3000', 'http://chat.local'], // allow both Ingress and port-forwarded frontend
    credentials: true, // allow cookies/sessions
  });

  await app.listen(3001);
}
bootstrap();
