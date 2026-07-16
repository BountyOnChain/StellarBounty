import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFullTextSearchIndex1747657600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Functional GIN index for full-text search on title + description.
    // This enables queries like:
    //   WHERE to_tsvector('english', title || ' ' || description) @@ plainto_tsquery('english', :q)
    // and ranking with ts_rank(...).
    //
    // We keep it as a functional index rather than a generated column to avoid
    // needing an extra column in the entity metadata, preserving compatibility
    // with existing schema checks that compare migrations vs entities.
    // If a generated column is desired later, it can be added as:
    //   ALTER TABLE bounties ADD COLUMN search_vector tsvector
    //   GENERATED ALWAYS AS (to_tsvector('english', coalesce(title,'') || ' ' || coalesce(description,''))) STORED;
    //   CREATE INDEX bounties_search_vector_idx ON bounties USING GIN (search_vector);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS bounties_title_description_tsvector_idx
      ON bounties
      USING GIN (to_tsvector('english', title || ' ' || description));
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS bounties_title_description_tsvector_idx;
    `);
  }
}
