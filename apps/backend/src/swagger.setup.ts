import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { API_PREFIX } from './api-prefix';

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('StellarBounty API')
    .setDescription('Decentralized bounty platform on Stellar network')
    .setVersion('1.0')
    .addServer(`/${API_PREFIX}`, 'Version 1 API')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'access-token',
    )
    .addTag('auth', 'Authentication endpoints')
    .addTag('bounties', 'Bounty management')
    .addTag('submissions', 'Submission management')
    .addTag('health', 'Health check')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'method',
    },
    customSiteTitle: 'StellarBounty API Docs',
  });
}
