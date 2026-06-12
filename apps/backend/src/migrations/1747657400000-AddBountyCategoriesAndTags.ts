import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBountyCategoriesAndTags1747657400000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE bounty_category_enum AS ENUM ('development', 'design', 'writing', 'research', 'marketing', 'other');

      ALTER TABLE bounties
      ADD COLUMN category bounty_category_enum NOT NULL DEFAULT 'development';

      CREATE TABLE tags (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR NOT NULL UNIQUE
      );

      CREATE TABLE bounties_tags (
        "bountyId" UUID NOT NULL REFERENCES bounties(id) ON DELETE CASCADE,
        "tagId" UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
        PRIMARY KEY ("bountyId", "tagId")
      );

      CREATE INDEX idx_bounties_category ON bounties(category);
      CREATE INDEX idx_tags_name ON tags(name);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS bounties_tags;
      DROP TABLE IF EXISTS tags;
      DROP INDEX IF EXISTS idx_bounties_category;
      ALTER TABLE bounties DROP COLUMN IF EXISTS category;
      DROP TYPE IF EXISTS bounty_category_enum;
    `);
  }
}
