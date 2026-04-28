export enum SyncCurrentStateStatus {
    IN_PROCESS = 'process',
    FREE = 'free',
    PAUSE = 'pause',
}

export type SyncCurrentState = {
    status: SyncCurrentStateStatus,
    hasChanges: boolean,
    error: string | null,
}