import assert from 'node:assert/strict';
import { test } from 'node:test';
import { autumnLeafPiles } from '@gredice/js/autumnLeafPiles';
import { Vector3 } from 'three';
import {
    loadLocalSandboxGarden,
    persistLocalSandboxGarden,
} from './localSandboxGarden';

// Exercise the real saved-garden serializer and name normalization for both owned identities.
test('owned leaf piles keep their identity, position and rotation when a saved garden reloads', () => {
    const storage = new Map<string, string>();
    const originalWindow = Object.getOwnPropertyDescriptor(
        globalThis,
        'window',
    );
    Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: {
            localStorage: {
                getItem: (key: string) => storage.get(key) ?? null,
                setItem: (key: string, value: string) => {
                    storage.set(key, value);
                },
            },
        },
    });
    try {
        const garden = {
            stacks: autumnLeafPiles.map((item, index) => ({
                position: new Vector3(index + 2, 0, -3),
                blocks: [
                    {
                        id: `support:${index}`,
                        name: 'Block_Grass',
                        rotation: 0,
                    },
                    {
                        id: `owned:${index}`,
                        name: item.name,
                        rotation: index + 2,
                    },
                ],
            })),
        };
        persistLocalSandboxGarden('owned-leaf-piles', garden);
        const reloaded = loadLocalSandboxGarden('owned-leaf-piles');
        assert.equal(reloaded.stacks.length, 2);
        for (const [index, stack] of reloaded.stacks.entries()) {
            assert.equal(stack.position.x, index + 2);
            assert.equal(stack.position.z, -3);
            assert.deepEqual(
                stack.blocks.map(({ id, name, rotation }) => ({
                    id,
                    name,
                    rotation,
                })),
                garden.stacks[index].blocks,
            );
        }
        // A second save/load cycle must not turn owned piles into ambient effects.
        persistLocalSandboxGarden('owned-leaf-piles', reloaded);
        assert.deepEqual(
            loadLocalSandboxGarden('owned-leaf-piles').stacks,
            reloaded.stacks,
        );
    } finally {
        if (originalWindow)
            Object.defineProperty(globalThis, 'window', originalWindow);
        else Reflect.deleteProperty(globalThis, 'window');
    }
});
