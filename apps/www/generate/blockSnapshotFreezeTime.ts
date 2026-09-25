// Covers and top-downs must show the same season for opted-in deciduous assets.
export const snapshotFreezeTime = process.env.BLOCK_SNAPSHOT_FREEZE_TIME
    ? new Date(process.env.BLOCK_SNAPSHOT_FREEZE_TIME)
    : undefined;

if (snapshotFreezeTime && Number.isNaN(snapshotFreezeTime.getTime())) {
    throw new Error('BLOCK_SNAPSHOT_FREEZE_TIME must be a valid date.');
}
