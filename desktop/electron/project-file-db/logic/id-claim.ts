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
 * 3. a name that extends the OTHER claimant's name with a copy marker loses —
 *    checked relationally («starts with the other name + ` - <anything>` or
 *    ` (<number>)`»), so every localization (`X - 2`, `X - копия`,
 *    `X - Copy (2)`, …) is caught without enumerating suffixes; Explorer-style
 *    copies always displace, so the ORIGINAL keeps the identity in both the
 *    cold-load and the runtime paths (the runtime asymmetry already works
 *    this way; without this rule `'X - 2/…' < 'X/…'` would make the copy win);
 * 4. binary (code-unit) path comparison — deterministic on every clone.
 * Returns < 0 when `a` should keep the id.
 */

// A copy marker after another claimant's name: ` - <anything>` (the app's
// `X - 2`, Explorer's `X - Copy`, ru `X - копия`, with or without a trailing
// number — digits are intentionally optional so digitless localizations
// match) or a trailing `(<number>)`.
const COPY_TAIL_REGEXP = /^(?: - .*|\s*\(\d+\))$/;

const META_SUFFIX_REGEXP = /\.imw[ \d\(\)\[\]_]*\.json$/i;
const ASSET_SUFFIX_REGEXP = /\.(ima\.json|json|md)$/i;

/**
 * The claimant's identity path as segments: extensions stripped, the
 * in-folder `.imw` marker dropped (it marks HOW the workspace is stored,
 * not where it sits).
 */
function pathSegmentNames(rel_path: string): string[] {
    return rel_path.split('/').map(seg =>
        seg.replace(META_SUFFIX_REGEXP, '').replace(ASSET_SUFFIX_REGEXP, ''),
    ).filter(seg => seg !== '.imw' && seg !== '');
}

/**
 * True when `candidate_rel`'s name extends `base_rel`'s name with a copy
 * marker. Checked segment-wise from the root: the first differing segment
 * must be base+marker while the rest of the path stays identical, so the
 * marker may sit on any level (`X - 2/A1`, `A/Fire - 2`, `X - копия/.imw`).
 */
function isCopyExtensionOf(candidate_rel: string, base_rel: string): boolean {
    const candidate = pathSegmentNames(candidate_rel);
    const base = pathSegmentNames(base_rel);
    if (candidate.length !== base.length) return false;
    let diff = -1;
    for (let i = 0; i < base.length; i++) {
        if (candidate[i] === base[i]) continue;
        diff = i;
        break;
    }
    if (diff < 0) return false; // identical names — not a copy relation
    for (let i = diff + 1; i < base.length; i++) {
        if (candidate[i] !== base[i]) return false; // structure diverged
    }
    const seg = candidate[diff];
    const base_seg = base[diff];
    if (!base_seg || !seg.startsWith(base_seg)) return false;
    return COPY_TAIL_REGEXP.test(seg.substring(base_seg.length));
}

export function compareClaimInfo(a: ClaimInfo, b: ClaimInfo): number {
    const a_claimed = a.claimedAt !== null;
    const b_claimed = b.claimedAt !== null;
    if (a_claimed !== b_claimed) return a_claimed ? -1 : 1;
    if (a_claimed && b_claimed && a.claimedAt !== b.claimedAt) {
        return (a.claimedAt as number) < (b.claimedAt as number) ? -1 : 1;
    }
    const a_copies_b = isCopyExtensionOf(a.relPath, b.relPath);
    const b_copies_a = isCopyExtensionOf(b.relPath, a.relPath);
    if (a_copies_b !== b_copies_a) return a_copies_b ? 1 : -1;
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
