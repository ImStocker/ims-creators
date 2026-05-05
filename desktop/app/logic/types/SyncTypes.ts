export type SyncItem = {
    id: string,
    title: string,
    need_sync: string,
    synced_at: string,
    conflict: string,
    conflict_message: string,
}
export type SyncInfo = {
    syncEnd: string | null,
    syncState: string | null,
    error: string | null,
    assets: SyncItem[],
    workspaces: SyncItem[],
}