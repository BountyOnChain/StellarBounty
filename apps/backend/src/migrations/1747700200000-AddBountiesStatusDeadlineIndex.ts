import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBountiesStatusDeadlineIndex1747700200000 implements MigrationInterface {
  name = 'AddBountiesStatusDeadlineIndex1747700200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 只索引会被截止时间自动化扫描的活跃状态，避免 completed/cancelled 数据拖慢高频查询。
    await queryRunner.query(`
      CREATE INDEX "idx_bounties_status_deadline"
      ON "bounties" ("status", "deadline")
      WHERE "status" IN ('open', 'in_progress');
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX "idx_bounties_status_deadline";
    `);
  }
}
