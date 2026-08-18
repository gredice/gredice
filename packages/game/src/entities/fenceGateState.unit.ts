import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    fenceGateClosedVariant,
    fenceGateOpenVariant,
    getToggledFenceGateVariant,
    isFenceGateOpen,
} from './fenceGateState';

describe('fence gate state', () => {
    it('fails closed for missing and unknown variants', () => {
        assert.equal(
            isFenceGateOpen({ name: 'FenceGate', variant: undefined }),
            false,
        );
        assert.equal(
            isFenceGateOpen({ name: 'FenceGate', variant: 99 }),
            false,
        );
        assert.equal(
            isFenceGateOpen({ name: 'Fence', variant: fenceGateOpenVariant }),
            false,
        );
    });

    it('toggles all gate materials between explicit persisted variants', () => {
        for (const name of [
            'FenceGate',
            'WhiteFenceGate',
            'StoneFenceGate',
            'PolishedStoneFenceGate',
        ]) {
            assert.equal(
                getToggledFenceGateVariant({ name, variant: null }),
                fenceGateOpenVariant,
            );
            assert.equal(
                getToggledFenceGateVariant({
                    name,
                    variant: fenceGateOpenVariant,
                }),
                fenceGateClosedVariant,
            );
        }
    });
});
