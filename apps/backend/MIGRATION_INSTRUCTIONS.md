# Migration Instructions

After merging this PR, follow these steps to set up the database:

## 1. Start PostgreSQL

```bash
docker compose up -d
```

## 2. Install Dependencies

```bash
cd apps/backend
npm install @nestjs/typeorm typeorm pg class-validator class-transformer
```

## 3. Add to AppModule

```typescript
// In app.module.ts imports:
import { TypeOrmModule } from '@nestjs/typeorm';
import { DatabaseConfig } from './database.config';

@Module({
  imports: [
    ConfigModule.forRoot({ ... }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useClass: DatabaseConfig,
    }),
    // ... other modules
  ],
})
```

## 4. Generate Initial Migration

```bash
cd apps/backend
npx typeorm-ts-node-commonjs migration:generate src/database/migrations/InitialSchema -d src/database/data-source.ts
```

## 5. Run Migrations

```bash
npx typeorm-ts-node-commonjs migration:run -d src/database/data-source.ts
```

## 6. Verify

```bash
# Check that tables exist
docker compose exec postgres psql -U postgres -d stellar_bounty -c '\dt'
```

> ⚠️ In production, set `NODE_ENV=production` to disable `synchronize`.
