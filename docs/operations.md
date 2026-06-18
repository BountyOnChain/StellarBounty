# Operations

## Database migrations

Migrations are managed with TypeORM in `apps/backend`.

### Apply migrations

```bash
npm run build --workspace=apps/backend
npm run migration:run --workspace=apps/backend
```

### Rollback

To revert the most recent migration:

```bash
npm run migration:revert --workspace=apps/backend
```

Run the command once for each migration you need to roll back. Revert migrations in reverse order of application (most recent first).

After a rollback, confirm the database schema matches the deployed application version before leaving the environment in production.
