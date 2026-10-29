import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Local id-claim registry (concept: meta/devdocs/desktop-id-claim.md).
 * Machine-local bookkeeping: which entity ids this project has ever seen,
 * used only to veto newly assigned ids (tombstone/id-reuse protection) and
 * for audit. Never feeds conflict discrimination — that uses content-carried
 * state so every clone resolves identically.
 */
export class IdClaims1793200000000 implements MigrationInterface {
    name = 'IdClaims1793200000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE id_claims(
                entity_id varchar NOT NULL,
                claimed_at bigint,
                first_seen_at bigint NOT NULL,
                file_path varchar,
                source varchar NOT NULL,
                changed_at bigint NOT NULL,
                PRIMARY KEY (entity_id)
            );
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE id_claims`);
    }
}
