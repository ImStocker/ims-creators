import { DataSource } from 'typeorm';
import path from 'node:path';
import { PROJECT_META_DB } from './project-db-constants';
import { Initial1771499452638 } from './migrations/1771499452638-initial';
import { IdClaims1793200000000 } from './migrations/1793200000000-id-claims';

export function getProjectDataSource(projectPath: string): DataSource{
    return new DataSource({
        type: 'better-sqlite3',
        database: path.join(projectPath, PROJECT_META_DB),
        entities: [],
        synchronize: false,
        migrations: [
            Initial1771499452638,
            IdClaims1793200000000,
        ],
        logging: true
    })
}