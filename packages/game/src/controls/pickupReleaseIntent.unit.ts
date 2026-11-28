import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { BlockEditingMode } from '../blockOptions/blockEditingState';
import {
    arePickupReleaseOptionsEnabled,
    getBlockEditingHighlightBlockId,
    type PickupReleaseIntent,
    type PickupSessionOrigin,
    resolvePickupReleaseIntent,
} from './pickupReleaseIntent';

function expectedIntent({
    origin,
    hasDraggedAfterPickup,
    hudDropRequested,
    selectionCount,
    optionsEnabled,
}: {
    origin: PickupSessionOrigin;
    hasDraggedAfterPickup: boolean;
    hudDropRequested: boolean;
    selectionCount: number;
    optionsEnabled: boolean;
}): PickupReleaseIntent {
    if (hudDropRequested || hasDraggedAfterPickup) {
        return 'drop';
    }
    if (origin === 'menu') {
        return 'carry';
    }
    return selectionCount > 1 || !optionsEnabled ? 'settle' : 'options';
}

test('covers the whole release truth table', () => {
    const origins: PickupSessionOrigin[] = ['hold', 'menu'];
    const flags = [false, true];
    let cases = 0;
    for (const origin of origins) {
        for (const hasDraggedAfterPickup of flags) {
            for (const hudDropRequested of flags) {
                for (const selectionCount of [0, 1, 2, 5]) {
                    for (const optionsEnabled of flags) {
                        const input = {
                            origin,
                            hasDraggedAfterPickup,
                            hudDropRequested,
                            selectionCount,
                            optionsEnabled,
                        };
                        assert.equal(
                            resolvePickupReleaseIntent(input),
                            expectedIntent(input),
                            JSON.stringify(input),
                        );
                        cases++;
                    }
                }
            }
        }
    }
    assert.equal(cases, 64);
});

test('a still hold-release opens the pop-up', () => {
    assert.equal(
        resolvePickupReleaseIntent({
            origin: 'hold',
            hasDraggedAfterPickup: false,
            hudDropRequested: false,
            selectionCount: 1,
            optionsEnabled: true,
        }),
        'options',
    );
});

test('any drag after the lift drops, whatever the snapped cell', () => {
    for (const origin of ['hold', 'menu'] as const) {
        assert.equal(
            resolvePickupReleaseIntent({
                origin,
                hasDraggedAfterPickup: true,
                hudDropRequested: false,
                selectionCount: 1,
                optionsEnabled: true,
            }),
            'drop',
        );
    }
});

test('a release over the items HUD drop target always drops', () => {
    for (const origin of ['hold', 'menu'] as const) {
        assert.equal(
            resolvePickupReleaseIntent({
                origin,
                hasDraggedAfterPickup: false,
                hudDropRequested: true,
                selectionCount: 3,
                optionsEnabled: false,
            }),
            'drop',
        );
    }
});

test('a multi-selection or disabled options settle without a pop-up', () => {
    const base = {
        origin: 'hold' as const,
        hasDraggedAfterPickup: false,
        hudDropRequested: false,
    };
    assert.equal(
        resolvePickupReleaseIntent({
            ...base,
            selectionCount: 2,
            optionsEnabled: true,
        }),
        'settle',
    );
    assert.equal(
        resolvePickupReleaseIntent({
            ...base,
            selectionCount: 1,
            optionsEnabled: false,
        }),
        'settle',
    );
});

test('Pomakni released without moving carries the block', () => {
    assert.equal(
        resolvePickupReleaseIntent({
            origin: 'menu',
            hasDraggedAfterPickup: false,
            hudDropRequested: false,
            selectionCount: 1,
            optionsEnabled: false,
        }),
        'carry',
    );
});

test('options are enabled only with the UI, data and no Expand, move or carry', () => {
    const modes: (BlockEditingMode | null | undefined)[] = [
        null,
        undefined,
        'menu',
        'moving',
        'carry',
        'confirm-remove',
        'expand',
    ];
    const enabledModes = modes.filter((editingMode) =>
        arePickupReleaseOptionsEnabled({
            editingMode,
            hasBlockData: true,
            hasGarden: true,
            hasOptionsUi: true,
        }),
    );
    assert.deepEqual(enabledModes, [null, undefined, 'menu']);
    assert.equal(
        arePickupReleaseOptionsEnabled({
            editingMode: null,
            hasBlockData: false,
            hasGarden: true,
            hasOptionsUi: true,
        }),
        false,
    );
    assert.equal(
        arePickupReleaseOptionsEnabled({
            editingMode: null,
            hasBlockData: true,
            hasGarden: false,
            hasOptionsUi: true,
        }),
        false,
    );
    // A hidden HUD mounts no pop-up: the release settles (no lasting
    // menu state or outline that nothing shows or closes).
    assert.equal(
        arePickupReleaseOptionsEnabled({
            editingMode: null,
            hasBlockData: true,
            hasGarden: true,
            hasOptionsUi: false,
        }),
        false,
    );
});

test('the pop-up, remove dialog and Expand keep their block outlined', () => {
    const outlined = (
        ['menu', 'moving', 'carry', 'confirm-remove', 'expand'] as const
    ).filter(
        (mode) =>
            getBlockEditingHighlightBlockId({ blockId: 'b', mode }) === 'b',
    );
    assert.deepEqual(outlined, ['menu', 'confirm-remove', 'expand']);
    assert.equal(getBlockEditingHighlightBlockId(null), null);
    assert.equal(getBlockEditingHighlightBlockId(undefined), null);
});
