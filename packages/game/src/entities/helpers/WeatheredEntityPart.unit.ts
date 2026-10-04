import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createRoot, extend } from '@react-three/fiber';
import { act, createElement } from 'react';
import { BoxGeometry, Mesh, MeshStandardMaterial, Scene } from 'three';
import { WeatheredEntityPart } from './WeatheredEntityPart';

describe('WeatheredEntityPart', () => {
    it('preserves hidden source mesh visibility', async () => {
        const node = new Mesh(
            new BoxGeometry(1, 1, 1),
            new MeshStandardMaterial(),
        );
        node.visible = false;
        const scene = new Scene();
        extend({ Mesh });
        const root = createRoot(new EventTarget());
        // Reconcile real Three objects without requiring a GPU in Node.
        const renderer = {
            render: () => undefined,
            setPixelRatio: () => undefined,
            setSize: () => undefined,
        };
        await root.configure({
            gl: renderer,
            scene,
            size: { width: 1, height: 1, top: 0, left: 0 },
            dpr: 1,
            frameloop: 'never',
        });
        const previousActEnvironment = Object.getOwnPropertyDescriptor(
            globalThis,
            'IS_REACT_ACT_ENVIRONMENT',
        );
        Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', {
            value: true,
            configurable: true,
        });
        try {
            await act(async () => {
                root.render(createElement(WeatheredEntityPart, { node }));
            });
            assert.equal(scene.children.length, 1);
            const rendered = scene.children[0];
            assert.ok(rendered instanceof Mesh);
            assert.equal(rendered.visible, false);

            node.visible = true;
            await act(async () => {
                root.render(createElement(WeatheredEntityPart, { node }));
            });
            assert.equal(scene.children[0], rendered);
            assert.equal(rendered.visible, true);
        } finally {
            await act(async () => root.unmount());
            if (previousActEnvironment) {
                Object.defineProperty(
                    globalThis,
                    'IS_REACT_ACT_ENVIRONMENT',
                    previousActEnvironment,
                );
            } else {
                Reflect.deleteProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT');
            }
            node.geometry.dispose();
            node.material.dispose();
        }
    });
});
