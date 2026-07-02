import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTagsColumn1747657400000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE bounties ADD COLUMN tags TEXT[];`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE bounties DROP COLUMN tags;`);
  }
}
