import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createElement } from 'react';
import { Color, DoubleSide, MeshStandardMaterial } from 'three';
import { readStaticGardenMaterialNode } from './gardenMaterialNodes';
import {
    createGardenPacketMaterial,
    getGardenPacketMaterialSignature,
} from './gardenPacketMaterials';

describe('static garden material node admission', () => {
    it('preserves authored constructor values and keeps heterogeneous PBR nodes in separate stock buckets', () => {
        const wood = readStaticGardenMaterialNode(
            createElement('meshStandardMaterial', {
                color: '#744020',
                roughness: 0.9,
                metalness: 0,
                side: DoubleSide,
            }),
        );
        const roof = readStaticGardenMaterialNode(
            createElement('meshStandardMaterial', {
                color: '#2f3437',
                roughness: 0.62,
                metalness: 0.3,
                side: DoubleSide,
            }),
        );
        assert.ok(wood);
        assert.ok(roof);
        const first = new MeshStandardMaterial(wood);
        const second = new MeshStandardMaterial(roof);
        assert.deepEqual(first.color, new Color('#744020'));
        assert.equal(first.roughness, 0.9);
        assert.equal(second.metalness, 0.3);
        assert.equal(first.side, DoubleSide);
        assert.notEqual(
            getGardenPacketMaterialSignature(first),
            getGardenPacketMaterialSignature(second),
        );
        const shared = createGardenPacketMaterial(first);
        shared.dispose();
        first.dispose();
        second.dispose();
    });

    it('keeps every unrecognized JSX ownership and shader path unchanged', () => {
        const unsupported: Record<string, unknown>[] = [
            { color: '#fff', ref: () => undefined },
            { args: [{ color: '#fff' }] },
            { onUpdate: () => undefined },
            { onBeforeCompile: () => undefined },
            { children: createElement('primitive', { object: {} }) },
            { attach: 'customMaterial' },
            { map: {} },
            { userData: { animation: true } },
            { roughness: Number.NaN },
            { side: 30 },
            { transparent: true },
            { color: '#fff', unknownUniform: 1 },
        ];
        for (const props of unsupported)
            assert.equal(
                readStaticGardenMaterialNode(
                    createElement('meshStandardMaterial', props),
                ),
                undefined,
            );
        assert.equal(
            readStaticGardenMaterialNode(
                createElement('meshBasicMaterial', { color: '#fff' }),
            ),
            undefined,
        );
        assert.equal(readStaticGardenMaterialNode(null), undefined);
        assert.equal(readStaticGardenMaterialNode('material'), undefined);
    });

    it('preserves cutout, depth, flat shading and vertex-color boundaries', () => {
        const parameters = readStaticGardenMaterialNode(
            createElement('meshStandardMaterial', {
                color: new Color(0.12345, 0.23456, 0.34567),
                emissive: '#321000',
                emissiveIntensity: 0.5,
                alphaTest: 0.2,
                opacity: 0.8,
                transparent: false,
                depthTest: true,
                depthWrite: false,
                toneMapped: false,
                flatShading: true,
                vertexColors: true,
            }),
        );
        assert.ok(parameters);
        const material = new MeshStandardMaterial(parameters);
        assert.equal(material.color.r, 0.12345);
        assert.equal(material.alphaTest, 0.2);
        assert.equal(material.depthWrite, false);
        assert.equal(material.flatShading, true);
        assert.equal(material.vertexColors, true);
        material.dispose();
    });
});
