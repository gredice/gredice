import { DataTexture, LinearFilter, RGBAFormat } from 'three';

const haloTextureSize = 64;

let haloTexture: DataTexture | null = null;

/**
 * Alpha of the garden light halo at a distance from its centre, as a share
 * of its radius: full at the centre, easing out to nothing at the edge with
 * no visible ring.
 */
export function getGardenLightHaloAlpha(distance: number) {
    const t = Math.min(1, Math.max(0, distance));
    const falloff = 1 - t * t;
    return falloff * falloff;
}

/** A soft round white glow, shared by every garden light halo. */
export function getGardenLightHaloTexture() {
    if (haloTexture) return haloTexture;
    const data = new Uint8Array(haloTextureSize * haloTextureSize * 4);
    const center = (haloTextureSize - 1) / 2;
    for (let y = 0; y < haloTextureSize; y++) {
        for (let x = 0; x < haloTextureSize; x++) {
            const distance = Math.hypot(x - center, y - center) / center;
            const index = (y * haloTextureSize + x) * 4;
            data[index] = 255;
            data[index + 1] = 255;
            data[index + 2] = 255;
            data[index + 3] = Math.round(
                getGardenLightHaloAlpha(distance) * 255,
            );
        }
    }
    const texture = new DataTexture(
        data,
        haloTextureSize,
        haloTextureSize,
        RGBAFormat,
    );
    texture.magFilter = LinearFilter;
    texture.minFilter = LinearFilter;
    texture.needsUpdate = true;
    haloTexture = texture;
    return texture;
}
