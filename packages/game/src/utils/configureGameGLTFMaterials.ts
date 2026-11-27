import {
    ClampToEdgeWrapping,
    type Material,
    NearestFilter,
    Texture,
} from 'three';

const colorPaletteMaterialName = 'Material.ColorPaletteMain';
/** At or above this roughness a surface is treated as matte. */
const matteRoughness = 0.75;

type GameGLTFWithColorPaletteMaterial = {
    materials?: {
        [colorPaletteMaterialName]?: Material;
    };
};

function getMaterialMap(material: Material | undefined): Texture | null {
    if (!material || !('map' in material)) {
        return null;
    }

    return material.map instanceof Texture ? material.map : null;
}

const normalizedMaterials = new WeakSet<Material>();

/**
 * Older models pair full roughness with metalness. The scene has no
 * environment to reflect, so on a matte surface metalness only removes
 * colour. Deliberately glossy metal parts keep their values.
 */
export function normalizeGameGLTFMatteMetalness(gltf: {
    materials?: Record<string, Material | undefined>;
}) {
    for (const material of Object.values(gltf.materials ?? {})) {
        if (!material || normalizedMaterials.has(material)) continue;
        normalizedMaterials.add(material);
        if (
            'metalness' in material &&
            'roughness' in material &&
            typeof material.metalness === 'number' &&
            typeof material.roughness === 'number' &&
            material.metalness > 0 &&
            material.roughness >= matteRoughness
        ) {
            material.metalness = 0;
        }
    }
}

export function configureGameGLTFColorPaletteMaterials(
    gltf: GameGLTFWithColorPaletteMaterial,
) {
    const colorPaletteTexture = getMaterialMap(
        gltf.materials?.[colorPaletteMaterialName],
    );

    if (!colorPaletteTexture) {
        return;
    }

    // Palette textures are color lookups; mipmaps blend neighboring swatches and can leak pink edge pixels.
    colorPaletteTexture.magFilter = NearestFilter;
    colorPaletteTexture.minFilter = NearestFilter;
    colorPaletteTexture.generateMipmaps = false;
    colorPaletteTexture.wrapS = ClampToEdgeWrapping;
    colorPaletteTexture.wrapT = ClampToEdgeWrapping;
    colorPaletteTexture.needsUpdate = true;
}
