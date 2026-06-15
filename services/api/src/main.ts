import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from '@fastify/helmet';
import { Logger } from '@nestjs/common';
import { collectDefaultMetrics, register } from 'prom-client';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: false }),
    { rawBody: true },
  );

  const config = app.get(ConfigService);
  const port = config.get<number>('port') ?? 3000;
  const prefix = config.get<string>('apiPrefix') ?? 'api/v1';
  const nodeEnv = config.get<string>('nodeEnv') ?? 'development';
  const corsOrigins = config.get<string[]>('corsOrigins') ?? [];

  // ── Security ───────────────────────────────────────────────────────────────
  await app.register(helmet, {
    contentSecurityPolicy: nodeEnv === 'production',
  });

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // ── API prefix ─────────────────────────────────────────────────────────────
  app.setGlobalPrefix(prefix, {
    exclude: ['health'],
  });

  // ── Swagger (non-production) ───────────────────────────────────────────────
  if (nodeEnv !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Aurum API')
      .setDescription('Trusted digital gold infrastructure')
      .setVersion('0.1.0')
      .addBearerAuth()
      .addTag('auth', 'Authentication & wallet linking')
      .addTag('users', 'User profile & wallet management')
      .addTag('kyc', 'KYC verification')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document, {
      jsonDocumentUrl: 'docs-json',
    });

    logger.log(`Swagger available at http://localhost:${port}/docs`);
  }

  // ── Prometheus metrics ─────────────────────────────────────────────────────
  collectDefaultMetrics({ register });

  const metricsToken = config.get<string>('metricsToken');
  const fastify = app.getHttpAdapter().getInstance();
  fastify.get('/metrics', async (req, reply) => {
    if (metricsToken) {
      const auth = (req.headers['authorization'] as string | undefined) ?? '';
      if (auth !== `Bearer ${metricsToken}`) {
        reply.code(401);
        reply.send({ message: 'Unauthorized' });
        return;
      }
    }
    reply.header('Content-Type', register.contentType);
    reply.send(await register.metrics());
  });

  // ── Start ──────────────────────────────────────────────────────────────────
  await app.listen(port, '0.0.0.0');

  logger.log(`Aurum API running on http://0.0.0.0:${port}`);
  logger.log(`API prefix: /${prefix}`);
  logger.log(`Environment: ${nodeEnv}`);
}

bootstrap().catch((err) => {
  console.error('Fatal startup error', err);
  process.exit(1);
});
