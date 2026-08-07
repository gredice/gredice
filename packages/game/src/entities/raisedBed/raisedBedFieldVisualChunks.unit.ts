import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    type FieldVisualChunk,
    type FieldVisualLayerBase,
    reconcileFieldVisualChunks,
} from './raisedBedFieldVisualChunks';

type TestLayer = FieldVisualLayerBase & {
    instances: readonly number[];
};

function layer(
    key: string,
    signature: string,
    instances: readonly number[],
): TestLayer {
    return { instances, key, signature };
}

function chunk(
    key: string,
    layers: readonly TestLayer[],
): FieldVisualChunk<TestLayer> {
    return { key, layers };
}

describe('field visual chunk reconciliation', () => {
    it('returns the incoming descriptions unchanged on the first compile', () => {
        const next = [chunk('0:0', [layer('weeds', 'v1', [1, 2])])];

        assert.equal(reconcileFieldVisualChunks(undefined, next), next);
    });

    it('reuses the complete previous graph when all signatures match', () => {
        const previousWeeds = layer('weeds', 'v1', [1, 2]);
        const previousSupport = layer('support', 'v1', [3]);
        const previous = [
            chunk('0:0', [previousWeeds, previousSupport]),
            chunk('1:0', [layer('weeds', 'v2', [4])]),
        ];
        const next = [
            chunk('0:0', [
                layer('weeds', 'v1', [100, 200]),
                layer('support', 'v1', [300]),
            ]),
            chunk('1:0', [layer('weeds', 'v2', [400])]),
        ];

        const reconciled = reconcileFieldVisualChunks(previous, next);

        assert.equal(reconciled, previous);
        assert.equal(reconciled[0]?.layers[0], previousWeeds);
        assert.equal(reconciled[0]?.layers[1], previousSupport);
    });

    it('replaces only the owning chunk and affected layer for a one-field update', () => {
        const previousWeeds = layer('weeds', 'bed-1:heavy', [1, 2]);
        const previousSupport = layer('support', 'bed-1:none', []);
        const untouchedChunk = chunk('-1:0', [
            layer('weeds', 'bed-2:heavy', [7, 8]),
        ]);
        const previous = [
            chunk('0:0', [previousWeeds, previousSupport]),
            untouchedChunk,
        ];
        const changedWeeds = layer('weeds', 'bed-1:field-3-clean', [1]);
        const next = [
            chunk('0:0', [changedWeeds, layer('support', 'bed-1:none', [999])]),
            chunk('-1:0', [layer('weeds', 'bed-2:heavy', [700, 800])]),
        ];

        const reconciled = reconcileFieldVisualChunks(previous, next);

        assert.notEqual(reconciled, previous);
        assert.notEqual(reconciled[0], previous[0]);
        assert.equal(reconciled[1], untouchedChunk);
        assert.equal(reconciled[0]?.layers[0], changedWeeds);
        assert.equal(reconciled[0]?.layers[1], previousSupport);
        assert.equal(
            reconciled[0]?.layers[1]?.instances,
            previousSupport.instances,
        );
    });

    it('follows next ordering while retaining matching layer objects', () => {
        const weeds = layer('weeds', 'v1', [1]);
        const support = layer('support', 'v1', [2]);
        const previous = [chunk('0:0', [weeds, support])];
        const next = [
            chunk('0:0', [
                layer('support', 'v1', [20]),
                layer('weeds', 'v1', [10]),
            ]),
        ];

        const reconciled = reconcileFieldVisualChunks(previous, next);

        assert.notEqual(reconciled[0], previous[0]);
        assert.equal(reconciled[0]?.layers[0], support);
        assert.equal(reconciled[0]?.layers[1], weeds);
    });

    it('rejects duplicate chunk and layer keys', () => {
        assert.throws(
            () =>
                reconcileFieldVisualChunks(undefined, [
                    chunk('0:0', []),
                    chunk('0:0', []),
                ]),
            /Duplicate field visual chunk key/,
        );
        assert.throws(
            () =>
                reconcileFieldVisualChunks(undefined, [
                    chunk('0:0', [
                        layer('weeds', 'v1', []),
                        layer('weeds', 'v2', []),
                    ]),
                ]),
            /Duplicate field visual layer key/,
        );
    });
});
