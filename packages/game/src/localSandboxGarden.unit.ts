import assert from 'node:assert/strict';
import test from 'node:test';
import { Vector3 } from 'three';
import {
    createDefaultLocalSandboxGarden,
    createLocalSandboxBlockId,
    loadLocalSandboxGarden,
    persistLocalSandboxGarden,
} from './localSandboxGarden';

function withLocalStorage(testFn: () => void) {
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
                removeItem: (key: string) => storage.delete(key),
                setItem: (key: string, value: string) => {
                    storage.set(key, value);
                },
            },
        },
    });

    try {
        testFn();
    } finally {
        if (originalWindow) {
            Object.defineProperty(globalThis, 'window', originalWindow);
        } else {
            Reflect.deleteProperty(globalThis, 'window');
        }
    }
}

test('persists local sandbox stacks in local storage', () => {
    withLocalStorage(() => {
        const garden = createDefaultLocalSandboxGarden();
        const nextGarden = {
            ...garden,
            stacks: [
                {
                    position: new Vector3(3, 0, -1),
                    blocks: [
                        {
                            id: createLocalSandboxBlockId('Tree'),
                            name: 'Tree',
                            rotation: 2,
                        },
                    ],
                },
            ],
        };

        persistLocalSandboxGarden('test-local-sandbox', nextGarden);
        const loadedGarden = loadLocalSandboxGarden('test-local-sandbox');

        assert.equal(loadedGarden.isSandbox, true);
        assert.equal(loadedGarden.stacks.length, 1);
        assert.equal(loadedGarden.stacks[0]?.position.x, 3);
        assert.equal(loadedGarden.stacks[0]?.position.z, -1);
        assert.equal(loadedGarden.stacks[0]?.blocks[0]?.name, 'Tree');
        assert.equal(loadedGarden.stacks[0]?.blocks[0]?.rotation, 2);
    });
});

test('falls back to a playable default local sandbox', () => {
    const garden = createDefaultLocalSandboxGarden();

    assert.equal(garden.isSandbox, true);
    assert.equal(garden.raisedBeds.length, 0);
    assert.ok(garden.stacks.length >= 9);
    assert.ok(
        garden.stacks.some((stack) =>
            stack.blocks.some((block) => block.name === 'Block_Grass'),
        ),
    );
});
