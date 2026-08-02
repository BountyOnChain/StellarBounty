import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSlugToBounties1747750000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE bounties ADD COLUMN slug VARCHAR(80) UNIQUE;`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_bounties_slug ON bounties (slug);`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_bounties_slug;`);
    await queryRunner.query(`ALTER TABLE bounties DROP COLUMN slug;`);
  }
}