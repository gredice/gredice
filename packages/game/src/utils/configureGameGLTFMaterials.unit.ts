import assert from 'node:assert/strict';
import test from 'node:test';
import {
    ClampToEdgeWrapping,
    LinearFilter,
    LinearMipmapLinearFilter,
    MeshBasicMaterial,
    MeshStandardMaterial,
    NearestFilter,
    RepeatWrapping,
    Texture,
} from 'three';
import { configureGameGLTFColorPaletteMaterials } from './configureGameGLTFMaterials';

test('configures color palette textures without mipmap sampling', () => {
    const texture = new Texture();
    texture.magFilter = LinearFilter;
    texture.minFilter = LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    const material = new MeshStandardMaterial({ map: texture });

    configureGameGLTFColorPaletteMaterials({
        materials: {
            'Material.ColorPaletteMain': material,
        },
    });

    assert.equal(texture.magFilter, NearestFilter);
    assert.equal(texture.minFilter, NearestFilter);
    assert.equal(texture.generateMipmaps, false);
    assert.equal(texture.wrapS, ClampToEdgeWrapping);
    assert.equal(texture.wrapT, ClampToEdgeWrapping);
    assert.equal(texture.version, 1);
});

test('ignores missing or untextured color palette materials', () => {
    assert.doesNotThrow(() => {
        configureGameGLTFColorPaletteMaterials({});
        configureGameGLTFColorPaletteMaterials({
            materials: {
                'Material.ColorPaletteMain': new MeshBasicMaterial(),
            },
        });
    });
});
