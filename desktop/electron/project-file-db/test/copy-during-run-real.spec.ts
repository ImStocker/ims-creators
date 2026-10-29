import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// NOTE: the REAL @parcel/watcher is used here — this spec reproduces the
// user-reported flow as-is: project open, folder copied via Explorer-style
// fs copy, watcher delivers events with real timing.

import { ProjectFileDb } from '../ProjectFileDb';

const W_X = 'aaaa0000-0000-0000-0000-000000000010';
const A1_ID = 'bbbb0000-0000-0000-0000-000000000001';
const A2_ID = 'bbbb0000-0000-0000-0000-000000000002';

function assetJson(id: string, title: string, workspace_id: string | null): Record<string, unknown> {
    return {
        id,
        title,
        name: null,
        icon: 'file-paper-2-fill',
        typeIds: [],
        parentIds: [],
        workspaceId: workspace_id,
        index: null,
        comments: [],
        references: [],
        blocks: [{
            id: 'blk-' + id,
            type: 'props',
            name: 'description',
            title: null,
            index: 1,
            own: true,
            ownTitle: null,
            createdAt: '2025-01-01T00:00:00.000Z',
            updatedAt: '2025-01-01T00:00:00.000Z',
            props: { value: 'x' },
            computed: { value: 'x' },
            inherited: {},
        }],
    };
}

function writeOriginalProject(dir: string) {
    fs.mkdirSync(path.join(dir, 'X'), { recursive: true });
    fs.writeFileSync(
        path.join(dir, 'X', '.imw'),
        JSON.stringify({ id: W_X, title: 'X', props: {} }, null, 1),
        'utf8',
    );
    for (const [name, id] of [['A1.ima.json', A1_ID], ['A2.ima.json', A2_ID]] as const) {
        fs.writeFileSync(
            path.join(dir, 'X', name),
            JSON.stringify(assetJson(id, name.replace('.ima.json', ''), W_X), null, 1),
            'utf8',
        );
    }
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

test('real watcher: Explorer-style copy during app run ends with copies attached to the new workspace', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ims-copy-real-'));
    const dir = path.join(root, 'project');
    fs.mkdirSync(dir, { recursive: true });
    writeOriginalProject(dir);

    let db: ProjectFileDb | null = null;
    try {
        db = new ProjectFileDb(dir);
        await db.init({ id: null, title: 'copy real watcher', rootWorkspaceId: null });

        // Copy with small per-file delays (mirrors Explorer writing files one
        // by one) to widen the window in which sync could observe a partial
        // state.
        const src = path.join(dir, 'X');
        const dst = path.join(dir, 'X - 2');
        fs.mkdirSync(dst);
        await sleep(120); // watcher registers the empty dir
        fs.copyFileSync(path.join(src, '.imw'), path.join(dst, '.imw'));
        await sleep(80);
        fs.copyFileSync(path.join(src, 'A1.ima.json'), path.join(dst, 'A1.ima.json'));
        await sleep(80);
        fs.copyFileSync(path.join(src, 'A2.ima.json'), path.join(dst, 'A2.ima.json'));

        // Sample the sync payload continuously during the event window: any
        // sample where a copied file would upload with the OLD workspace id
        // is the reported bug.
        const bad_payload_samples: string[] = [];
        const deadline = Date.now() + 6000;
        let settled = false;
        while (Date.now() < deadline && !settled) {
            await sleep(50);
            const ws_copy = db.workspace.findByLocalDirPath('X - 2');
            if (!ws_copy) continue;
            for (const [orig_id, name] of [[A1_ID, 'A1.ima.json'], [A2_ID, 'A2.ima.json']] as const) {
                const copy_asset = [...db.asset.assets.iterate()]
                    .find(a => a.localName === name && a.id !== orig_id);
                if (!copy_asset) continue;
                const payload = await db.sync.convertLocalAssetToServer(copy_asset);
                if (payload.workspaceId && payload.workspaceId !== ws_copy.id) {
                    bad_payload_samples.push(`${name}: ws=${payload.workspaceId} (X=${W_X}, copy=${ws_copy.id})`);
                }
            }
            // settled: both copies attached to the copy workspace
            const copies_ok = ([[A1_ID, 'A1.ima.json'], [A2_ID, 'A2.ima.json']] as const).every(([orig_id, name]) =>
                [...db!.asset.assets.iterate()]
                    .some(a => a.localName === name && a.id !== orig_id && a.workspaceId === ws_copy.id));
            settled = copies_ok;
        }

        expect(bad_payload_samples, 'copied assets must never target the old workspace in a sync payload')
            .toEqual([]);
        expect(settled, 'copied assets must converge to the copy workspace').toBe(true);

        // Final state
        const ws_copy = db.workspace.findByLocalDirPath('X - 2')!;
        expect(ws_copy.id).not.toBe(W_X);
        expect(db.asset.assets.byId.get(A1_ID)?.workspaceId).toBe(W_X);
        expect(db.asset.assets.byId.get(A2_ID)?.workspaceId).toBe(W_X);
    }
    finally {
        if (db) await db.destroy();
        fs.rmSync(root, { recursive: true, force: true });
    }
});
