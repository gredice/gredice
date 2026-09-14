export function isGardenStructureKitV1CatalogSnapshotReady(
    entryKey: string,
    readyEntryKey: string | null,
) {
    return readyEntryKey === entryKey;
}
