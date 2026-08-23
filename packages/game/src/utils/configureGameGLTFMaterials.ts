import {
    ClampToEdgeWrapping,
    type Material,
    NearestFilter,
    Texture,
} from 'three';

const colorPaletteMaterialName = 'Material.ColorPaletteMain';

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
