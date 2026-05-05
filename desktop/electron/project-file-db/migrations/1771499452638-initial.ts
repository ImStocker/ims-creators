import type { MigrationInterface, QueryRunner } from "typeorm";

export class Initial1771499452638 implements MigrationInterface {
    name = 'Initial1771499452638'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE assets(
                id uuid NOT NULL,
                title varchar,
                need_sync datetime,
                synced_at datetime,
                server_state JSONB,
                conflict varchar,
                conflict_message varchar,
                server_deleted bool,
                PRIMARY KEY (id)
            );
        `);
        await queryRunner.query(`
            CREATE TABLE workspaces(
                id uuid NOT NULL,
                title varchar,
                need_sync datetime,
                synced_at datetime,
                server_state JSONB,
                conflict varchar,
                conflict_message varchar,
                server_deleted bool,
                PRIMARY KEY (id)
            );
        `);

        
        await queryRunner.query(`
            CREATE TABLE files(
                server_file_id uuid NOT NULL,
                local_path varchar NOT NULL,
                server_store varchar,
                created_at datetime,
                PRIMARY KEY (local_path)
            );
        `);

        await queryRunner.query(`
            CREATE TABLE sync_logs(
                id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                sync_start datetime,
                sync_state datetime,
                sync_end datetime,
                error JSONB
            );
        `);

    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DELETE TABLE assets`);
        await queryRunner.query(`DELETE TABLE workspaces`);
        await queryRunner.query(`DELETE TABLE sync_logs`);
        await queryRunner.query(`DELETE TABLE files`);
    }

}
