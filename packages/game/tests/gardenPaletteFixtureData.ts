import {
    BoxGeometry,
    Color,
    DataTexture,
    Float32BufferAttribute,
    MeshStandardMaterial,
    NearestFilter,
    PlaneGeometry,
    RGBAFormat,
    SRGBColorSpace,
    UnsignedByteType,
} from 'three';
import { applyGroundPatchMaterial } from '../src/entities/helpers/groundPatchMaterial';

export type GardenPaletteFixtureWeather =
    | 'clear'
    | 'rain'
    | 'snow'
    | 'combined';

export type GardenPaletteFixtureReadback = {
    key: string;
    materials: number;
    meshes: number;
    paletteMaterials: number;
    paletteVertices: number;
    stockMeshes: number;
    sharedMaterialUsers: number;
};

export function createGardenPaletteFixtureSources() {
    const texture = new DataTexture(
        new Uint8Array([
            255, 210, 150, 255, 80, 130, 210, 255, 160, 240, 100, 255, 250, 110,
            160, 255,
        ]),
        2,
        2,
        RGBAFormat,
        UnsignedByteType,
    );
    texture.magFilter = NearestFilter;
    texture.minFilter = NearestFilter;
    texture.colorSpace = SRGBColorSpace;
    texture.needsUpdate = true;
    const masks = new DataTexture(
        new Uint8Array([
            255, 255, 40, 255, 0, 0, 230, 255, 0, 0, 230, 255, 255, 255, 40,
            255,
        ]),
        2,
        2,
        RGBAFormat,
        UnsignedByteType,
    );
    masks.magFilter = NearestFilter;
    masks.minFilter = NearestFilter;
    masks.needsUpdate = true;
    const coloredGeometry = new BoxGeometry();
    const count = coloredGeometry.getAttribute('position').count;
    const colors = new Float32Array(count * 3);
    for (let index = 0; index < count; index++) {
        colors[index * 3] = index % 2 ? 0.6 : 1;
        colors[index * 3 + 1] = 0.8;
        colors[index * 3 + 2] = index % 2 ? 1 : 0.7;
    }
    coloredGeometry.setAttribute(
        'color',
        new Float32BufferAttribute(colors, 3),
    );
    const sources = [
        {
            name: 'rough',
            geometry: new BoxGeometry(),
            material: new MeshStandardMaterial({
                color: '#c58743',
                roughness: 0.9,
            }),
            position: [-2, 0.5, 0],
        },
        {
            name: 'metal-emissive',
            geometry: new BoxGeometry(),
            material: new MeshStandardMaterial({
                color: '#316ac4',
                roughness: 0.2,
                metalness: 0.8,
                emissive: '#7e2915',
                emissiveIntensity: 0.65,
            }),
            position: [0, 0.5, 0],
        },
        {
            name: 'vertex-map',
            geometry: coloredGeometry,
            material: new MeshStandardMaterial({
                color: '#c8d9a9',
                map: texture,
                roughnessMap: masks,
                metalnessMap: masks,
                emissiveMap: texture,
                emissive: '#15251f',
                roughness: 0.7,
                metalness: 0.25,
                vertexColors: true,
            }),
            position: [2, 0.5, 0],
        },
        {
            name: 'cutout',
            geometry: new PlaneGeometry(1.5, 1.5),
            material: new MeshStandardMaterial({
                color: '#f1b569',
                map: texture,
                alphaMap: masks,
                alphaTest: 0.5,
                roughness: 0.55,
            }),
            position: [-2, 0.8, 1.3],
        },
        {
            name: 'ground',
            geometry: new BoxGeometry(1.5, 0.5, 1.5),
            material: applyGroundPatchMaterial(
                new MeshStandardMaterial({
                    color: new Color('#a15f36'),
                    roughness: 0.95,
                }),
                'dirt',
                {},
            ),
            position: [0, 0.25, 1.7],
            weather: true,
        },
        {
            name: 'ground-other-palette',
            geometry: new BoxGeometry(1.5, 0.5, 1.5),
            material: applyGroundPatchMaterial(
                new MeshStandardMaterial({ color: '#84513a', roughness: 0.65 }),
                'dirt',
                {},
            ),
            position: [2, 0.25, 1.7],
            weather: true,
        },
    ];
    return { sources, texture, masks };
}

export type GardenPaletteFixtureSource = ReturnType<
    typeof createGardenPaletteFixtureSources
>['sources'][number];
