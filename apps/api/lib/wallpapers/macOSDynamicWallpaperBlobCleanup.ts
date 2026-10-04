export type TemporaryWallpaperBlob = {
    pathname: string;
    uploadedAt: Date;
};

export function expiredMacOSDynamicWallpaperBlobPathnames({
    blobs,
    cutoff,
}: {
    blobs: ReadonlyArray<TemporaryWallpaperBlob>;
    cutoff: Date;
}) {
    return blobs
        .filter((blob) => blob.uploadedAt.getTime() <= cutoff.getTime())
        .map((blob) => blob.pathname);
}
