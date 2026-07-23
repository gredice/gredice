const rgba8BytesPerPixel = 4;

export function estimateRgba8MipmappedTextureBytes(
    width: number,
    height: number,
) {
    let levelWidth = Math.max(1, Math.floor(width));
    let levelHeight = Math.max(1, Math.floor(height));
    let bytes = 0;

    while (true) {
        bytes += levelWidth * levelHeight * rgba8BytesPerPixel;

        if (levelWidth === 1 && levelHeight === 1) {
            return bytes;
        }

        levelWidth = Math.max(1, Math.floor(levelWidth / 2));
        levelHeight = Math.max(1, Math.floor(levelHeight / 2));
    }
}
