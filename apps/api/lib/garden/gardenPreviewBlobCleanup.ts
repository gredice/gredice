export type GardenPreviewBlobCandidate = {
    pathname: string;
    uploadedAt: Date;
    url: string;
};

export function getNextGardenPreviewBlobScanCursor({
    cursor,
    hasMore,
}: {
    cursor?: string;
    hasMore: boolean;
}) {
    return hasMore && cursor ? cursor : null;
}

export function selectOrphanedGardenPreviewBlobUrls({
    blobs,
    orphanCutoff,
    referencedPathnames,
}: {
    blobs: GardenPreviewBlobCandidate[];
    orphanCutoff: number;
    referencedPathnames: ReadonlySet<string>;
}) {
    return blobs
        .filter(
            (blob) =>
                blob.uploadedAt.getTime() <= orphanCutoff &&
                !referencedPathnames.has(blob.pathname),
        )
        .map((blob) => blob.url);
}
