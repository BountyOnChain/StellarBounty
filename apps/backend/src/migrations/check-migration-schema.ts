import { AppDataSource } from '../data-source';

async function assertSchemaMatchesEntities(): Promise<void> {
  const schemaBuilder = AppDataSource.driver.createSchemaBuilder();
  const schemaDiff = await schemaBuilder.log();

  if (schemaDiff.upQueries.length > 0 || schemaDiff.downQueries.length > 0) {
    console.error('Migrations do not match the current TypeORM entity metadata.');
    console.error('Pending schema changes TypeORM would apply:');
    schemaDiff.upQueries.forEach((query, index) => {
      console.error(`${index + 1}. ${query.query}`);
    });
    process.exitCode = 1;
  }
}

async function assertApplicationSchemaRemoved(): Promise<void> {
  const tables = await AppDataSource.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('bounties', 'submissions', 'nonces')
  `) as Array<{ table_name: string }>;

  if (tables.length > 0) {
    const tableNames = tables.map((table) => table.table_name).join(', ');
    throw new Error(`Down migrations left application tables behind: ${tableNames}`);
  }
}

async function revertMigrations(count: number): Promise<void> {
  for (let index = 0; index < count; index += 1) {
    await AppDataSource.undoLastMigration({ transaction: 'all' });
  }
}

async function main(): Promise<void> {
  await AppDataSource.initialize();

  try {
    const firstRun = await AppDataSource.runMigrations({ transaction: 'all' });
    await assertSchemaMatchesEntities();
    if (process.exitCode) return;

    await revertMigrations(firstRun.length);
    await assertApplicationSchemaRemoved();

    await AppDataSource.runMigrations({ transaction: 'all' });
    await assertSchemaMatchesEntities();
    if (process.exitCode) return;

    console.log('Database migrations round-trip and match TypeORM entity metadata.');
  } finally {
    await AppDataSource.destroy();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
