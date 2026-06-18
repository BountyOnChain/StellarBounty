import { AppDataSource } from '../data-source';

const APP_TABLES = ['bounties', 'nonces', 'submissions'];
const MIGRATION_COUNT = 3;

async function getAppTables(): Promise<string[]> {
  const rows: { table_name: string }[] = await AppDataSource.query(
    `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ANY($1)
      ORDER BY table_name
    `,
    [APP_TABLES],
  );
  return rows.map((row) => row.table_name);
}

async function hasTagsColumn(): Promise<boolean> {
  const rows: { column_name: string }[] = await AppDataSource.query(
    `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'bounties'
        AND column_name = 'tags'
    `,
  );
  return rows.length > 0;
}

async function assertSchemaApplied(): Promise<void> {
  const tables = await getAppTables();
  const expected = [...APP_TABLES].sort();

  if (tables.join(',') !== expected.join(',')) {
    throw new Error(`Expected tables [${expected.join(', ')}], found [${tables.join(', ')}]`);
  }

  if (!(await hasTagsColumn())) {
    throw new Error('Expected tags column on bounties table');
  }
}

async function assertSchemaEmpty(): Promise<void> {
  const tables = await getAppTables();

  if (tables.length > 0) {
    throw new Error(`Expected no application tables, found [${tables.join(', ')}]`);
  }

  if (await hasTagsColumn()) {
    throw new Error('Expected tags column to be removed from bounties table');
  }
}

async function main(): Promise<void> {
  await AppDataSource.initialize();

  try {
    await AppDataSource.runMigrations({ transaction: 'all' });
    await assertSchemaApplied();

    for (let index = 0; index < MIGRATION_COUNT; index += 1) {
      await AppDataSource.undoLastMigration({ transaction: 'all' });
    }
    await assertSchemaEmpty();

    await AppDataSource.runMigrations({ transaction: 'all' });
    await assertSchemaApplied();

    console.log('Migration round-trip test passed.');
  } finally {
    await AppDataSource.destroy();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
