/**
 * Local ↔ cloud root-workspace binding helpers
 *
 * A local-only project keeps its root ("gdd") folder at the placeholder id
 * `00000000-…-200000000002` (RootGddFolder in ProjectFileDb). Every asset and
 * workspace under the root is positioned from that id at load time, so binding
 * to a cloud project MUST swap in the server's root id. Writing
 * `rootWorkspaceId: null` next to a valid project id makes every load derive
 * ids from the placeholder and every sync upload it — which the server rejects
 * with ENTITY_NOT_FOUND ("workspace not found") on each reload.
 *
 * Kept dependency-free so electron main, the renderer and specs all import the
 * same implementation (`#bridge/utils/cloud-root`).
 */

/** Placeholder root id of a local-only project; never valid on the server. */
export const LOCAL_ROOT_WORKSPACE_ID = '00000000-0000-0000-0000-200000000002';

export type RootWorkspaceCandidate = {
  id: string;
  name?: string | null;
};

/**
 * Resolve the server id of the cloud project's gdd root workspace from a
 * `rootWorkspaces` list (server `project/info` / `app/projects` response).
 *
 * Returns null when no valid candidate exists — callers must treat that as
 * "do not bind / do not sync" instead of falling back to the placeholder id.
 */
export function resolveCloudRootWorkspaceId(
  rootWorkspaces: RootWorkspaceCandidate[]
): string | null {
  const byName = rootWorkspaces.find((w) => w.name === 'gdd' && w.id !== LOCAL_ROOT_WORKSPACE_ID);
  if (byName) return byName.id;
  return null;
}
