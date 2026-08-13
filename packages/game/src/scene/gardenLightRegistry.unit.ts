import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { selectActiveGardenLightKeys } from './gardenLightBudget';
import { GardenLightRegistryStore } from './gardenLightRegistry';

describe('GardenLightRegistryStore', () => {
    it('retains and independently unregisters duplicate placement keys', () => {
        const registry = new GardenLightRegistryStore<{ key: string }>();
        const firstPlacement = { key: 'EnamelGardenLamp:block-type-id' };
        const secondPlacement = { key: 'EnamelGardenLamp:block-type-id' };
        const first = registry.register(firstPlacement);
        const second = registry.register(secondPlacement);

        assert.notEqual(first.instanceKey, second.instanceKey);
        assert.deepEqual(
            registry.getEntries().map((entry) => entry.registration),
            [firstPlacement, secondPlacement],
        );
        assert.deepEqual(
            [
                ...selectActiveGardenLightKeys(
                    registry.getEntries().map(({ instanceKey }) => ({
                        influenceIntersectsFrustum: true,
                        key: instanceKey,
                        x: 0,
                        y: 0,
                        z: 0,
                    })),
                    1,
                ),
            ],
            [first.instanceKey],
        );

        second.unregister();
        assert.deepEqual(registry.getEntries(), [
            {
                instanceKey: first.instanceKey,
                registration: firstPlacement,
            },
        ]);

        second.unregister();
        first.unregister();
        assert.deepEqual(registry.getEntries(), []);
    });
});
