import { absolutePathToUuid } from '../utils/files';

/**
 * Id-claim conflict resolution (concept: meta/devdocs/desktop-id-claim.md).
 *
 * Pure logic — no filesystem/db access: scanning, write-back and the local id
 * registry live in FileSystemService. All inputs here are content-carried or
 * path-derived state, so the same tree resolves identically on every machine.
 */

export type ClaimInfo = {
    /** idClaimedAt from the file, null when the file predates the field */
    claimedAt: number | null;
    /** root-relative path, '/' separators — portable, locale-independent */
    relPath: string;
};

export type WorkspaceClaimant = ClaimInfo & {
    /** one of the workspace's artifacts: legacy meta file, `.imw` inside the folder, or the folder itself */
    keyPath: string;
    kind: 'legacy' | 'folder' | 'synthesized';
    /** absolute path of the workspace folder; null for folderless metas */
    folderPath: string | null;
    id: string;
    /** parsed meta content for write-back; null for synthesized (no file) */
    parsed: Record<string, unknown> | null;
};

export type ClaimResolution =
    | { action: 'drop' }
    | { action: 'reid'; newId: string };

/**
 * Keeper selection chain (portable only, no filesystem birthtime):
 * 1. an explicit claim assertion beats a file predating the field;
 * 2. the earlier claim wins;
 * 3. binary (code-unit) path comparison — deterministic on every clone.
 * Returns < 0 when `a` should keep the id.
 */
export function compareClaimInfo(a: ClaimInfo, b: ClaimInfo): number {
    const a_claimed = a.claimedAt !== null;
    const b_claimed = b.claimedAt !== null;
    if (a_claimed !== b_claimed) return a_claimed ? -1 : 1;
    if (a_claimed && b_claimed && a.claimedAt !== b.claimedAt) {
        return (a.claimedAt as number) < (b.claimedAt as number) ? -1 : 1;
    }
    if (a.relPath !== b.relPath) return a.relPath < b.relPath ? -1 : 1;
    return 0;
}

export function groupClaimantsById(claimants: WorkspaceClaimant[]): Map<string, WorkspaceClaimant[]> {
    const by_id = new Map<string, WorkspaceClaimant[]>();
    for (const claimant of claimants) {
        const group = by_id.get(claimant.id);
        if (group) group.push(claimant);
        else by_id.set(claimant.id, [claimant]);
    }
    return by_id;
}

/**
 * Resolve duplicate-id conflicts across the whole tree (any nesting depth).
 *
 * Rules:
 * - A legacy meta sitting next to a folder that also has an in-folder `.imw`
 *   (or is represented by a synthesized claimant) is dropped from identity —
 *   the in-folder/synthesized representation owns the folder's content.
 * - Survival: a folderless meta sharing its id with a folder owner is dropped
 *   (file kept on disk); among folderless-only claimants one keeper survives;
 *   folder owners are never dropped — losers receive a new id.
 * - Keeper selection: compareClaimInfo chain.
 * - Loser ids: path-derived candidate, validated against all claimant ids,
 *   the session claim sets and the id registry (isIdTaken); random fallback.
 */
export async function resolveWorkspaceClaims(
    claimants: WorkspaceClaimant[],
    opts: {
        rootPath: string;
        isIdTaken: (id: string) => Promise<boolean>;
        randomId: () => string;
    },
): Promise<Map<string, ClaimResolution>> {
    const result = new Map<string, ClaimResolution>();
    if (claimants.length === 0) return result;

    // ids of every claimant are off-limits for assigned ids
    const taken = new Set<string>(claimants.map(c => c.id));

    // Same-folder duplicates: a folder with an in-folder `.imw` (or synthesized
    // entry) must not also expose a legacy sibling meta — the folder walk pairs
    // the legacy meta as the entity while content is attributed to the in-folder
    // meta, which splits identity. Drop the legacy representation.
    const folders_with_preferred = new Set<string>();
    for (const c of claimants) {
        if (c.kind !== 'legacy' && c.folderPath) folders_with_preferred.add(c.folderPath);
    }
    const survivors: WorkspaceClaimant[] = [];
    for (const c of claimants) {
        if (c.kind === 'legacy' && c.folderPath && folders_with_preferred.has(c.folderPath)) {
            if (!result.has(c.keyPath)) result.set(c.keyPath, { action: 'drop' });
            continue;
        }
        survivors.push(c);
    }

    const by_id = groupClaimantsById(survivors);
    for (const [, group] of by_id) {
        if (group.length < 2) continue;

        // Partition: folder owners vs folderless metas
        const owners = group.filter(c => c.folderPath !== null);
        const folderless = group.filter(c => c.folderPath === null);

        if (owners.length > 0) {
            // Conflicting folderless metas lose to any folder owner
            for (const c of folderless) {
                if (!result.has(c.keyPath)) result.set(c.keyPath, { action: 'drop' });
            }
            await assignLosers(owners, result, taken, opts);
        } else {
            // Folderless-only group: one keeper, the rest are dropped
            const sorted = [...group].sort(compareClaimInfo);
            for (const loser of sorted.slice(1)) {
                if (!result.has(loser.keyPath)) result.set(loser.keyPath, { action: 'drop' });
            }
        }
    }
    return result;
}

async function assignLosers(
    owners: WorkspaceClaimant[],
    result: Map<string, ClaimResolution>,
    taken: Set<string>,
    opts: {
        rootPath: string;
        isIdTaken: (id: string) => Promise<boolean>;
        randomId: () => string;
    },
): Promise<void> {
    const sorted = [...owners].sort(compareClaimInfo);
    for (const loser of sorted.slice(1)) {
        const folder_path = loser.folderPath as string;
        let new_id = absolutePathToUuid(folder_path, opts.rootPath);
        while (taken.has(new_id) || (await opts.isIdTaken(new_id))) {
            new_id = opts.randomId();
        }
        taken.add(new_id);
        if (!result.has(loser.keyPath)) result.set(loser.keyPath, { action: 'reid', newId: new_id });
    }
}
