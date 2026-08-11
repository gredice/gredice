/// <reference types="node" />

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    advancedSowingCartAuthorizationKind,
    advancedSowingSelectionRequestKind,
    advancedSowingSelectionSummaryKind,
    buildAdvancedSowingCartConfigurationV1,
    buildAdvancedSowingSelectionRequestV1,
    buildAdvancedSowingSelectionSummaryV1,
    getAdvancedSowingFootprintPositions,
    getAdvancedSowingLayoutOptions,
    parseAdvancedSowingCartAuthorizationV1,
    parseAdvancedSowingCartConfigurationV1,
    parseAdvancedSowingSelectionRequestV1,
    resolveAdvancedSowingDistanceRange,
    resolveAdvancedSowingLayout,
} from './advancedSowing';

describe('resolveAdvancedSowingDistanceRange', () => {
    it('uses the optimal distance for omitted bounds', () => {
        assert.deepEqual(
            resolveAdvancedSowingDistanceRange({ optimalDistanceCm: 30 }),
            {
                maxDistanceCm: 30,
                minDistanceCm: 30,
                optimalDistanceCm: 30,
            },
        );
    });

    it('supports either optional bound while preserving the optimal default', () => {
        assert.deepEqual(
            resolveAdvancedSowingDistanceRange({
                minDistanceCm: 15,
                optimalDistanceCm: 30,
            }),
            {
                maxDistanceCm: 30,
                minDistanceCm: 15,
                optimalDistanceCm: 30,
            },
        );
        assert.deepEqual(
            resolveAdvancedSowingDistanceRange({
                maxDistanceCm: 60,
                optimalDistanceCm: 30,
            }),
            {
                maxDistanceCm: 60,
                minDistanceCm: 30,
                optimalDistanceCm: 30,
            },
        );
    });

    it('rejects non-finite and non-positive distances', () => {
        for (const invalidDistance of [0, -1, Number.NaN, Infinity]) {
            assert.throws(
                () =>
                    resolveAdvancedSowingDistanceRange({
                        optimalDistanceCm: invalidDistance,
                    }),
                /finite positive number/u,
            );
        }
    });

    it('rejects ranges that do not contain the optimal distance', () => {
        assert.throws(
            () =>
                resolveAdvancedSowingDistanceRange({
                    minDistanceCm: 31,
                    optimalDistanceCm: 30,
                }),
            /min <= optimal <= max/u,
        );
        assert.throws(
            () =>
                resolveAdvancedSowingDistanceRange({
                    maxDistanceCm: 29,
                    optimalDistanceCm: 30,
                }),
            /min <= optimal <= max/u,
        );
    });
});

describe('resolveAdvancedSowingLayout', () => {
    const selectableRange = {
        maxDistanceCm: 60,
        minDistanceCm: 15,
        optimalDistanceCm: 30,
    };

    it('uses the optimal distance when no selection is supplied', () => {
        assert.deepEqual(resolveAdvancedSowingLayout(selectableRange), {
            ...selectableRange,
            fieldSpanColumns: 1,
            fieldSpanRows: 1,
            footprintFieldCount: 1,
            layoutKey: 'v1:fields:1x1:plants:1x1',
            plantCount: 1,
            plantsPerAxis: 1,
            selectedDistanceCm: 30,
        });
    });

    it('maps spacing up to 30 cm to a square density in one field', () => {
        assert.deepEqual(
            resolveAdvancedSowingLayout({
                ...selectableRange,
                selectedDistanceCm: 15,
            }),
            {
                ...selectableRange,
                fieldSpanColumns: 1,
                fieldSpanRows: 1,
                footprintFieldCount: 1,
                layoutKey: 'v1:fields:1x1:plants:2x2',
                plantCount: 4,
                plantsPerAxis: 2,
                selectedDistanceCm: 15,
            },
        );
    });

    it('maps spacing over 30 cm to one plant spanning a square footprint', () => {
        assert.deepEqual(
            resolveAdvancedSowingLayout({
                ...selectableRange,
                selectedDistanceCm: 60,
            }),
            {
                ...selectableRange,
                fieldSpanColumns: 2,
                fieldSpanRows: 2,
                footprintFieldCount: 4,
                layoutKey: 'v1:fields:2x2:plants:1x1',
                plantCount: 1,
                plantsPerAxis: 1,
                selectedDistanceCm: 60,
            },
        );
    });

    it('normalizes equivalent spacing selections to the same layout key', () => {
        const input = {
            maxDistanceCm: 20,
            minDistanceCm: 10,
            optimalDistanceCm: 15,
        };

        assert.equal(
            resolveAdvancedSowingLayout({
                ...input,
                selectedDistanceCm: 12,
            }).layoutKey,
            resolveAdvancedSowingLayout({
                ...input,
                selectedDistanceCm: 15,
            }).layoutKey,
        );
    });

    it('rejects a selected distance outside the configured range', () => {
        assert.throws(
            () =>
                resolveAdvancedSowingLayout({
                    ...selectableRange,
                    selectedDistanceCm: 10,
                }),
            /within the configured range/u,
        );
        assert.throws(
            () =>
                resolveAdvancedSowingLayout({
                    ...selectableRange,
                    selectedDistanceCm: 61,
                }),
            /within the configured range/u,
        );
    });
});

describe('getAdvancedSowingLayoutOptions', () => {
    it('returns the density, optimal, and multi-field choices for 15/30/60 cm', () => {
        const options = getAdvancedSowingLayoutOptions({
            maxDistanceCm: 60,
            minDistanceCm: 15,
            optimalDistanceCm: 30,
        });

        assert.deepEqual(
            options.map((option) => ({
                isDefault: option.isDefault,
                layoutKey: option.layoutKey,
                selectedDistanceCm: option.selectedDistanceCm,
            })),
            [
                {
                    isDefault: false,
                    layoutKey: 'v1:fields:1x1:plants:2x2',
                    selectedDistanceCm: 15,
                },
                {
                    isDefault: true,
                    layoutKey: 'v1:fields:1x1:plants:1x1',
                    selectedDistanceCm: 30,
                },
                {
                    isDefault: false,
                    layoutKey: 'v1:fields:2x2:plants:1x1',
                    selectedDistanceCm: 60,
                },
            ],
        );
    });

    it('rejects a range whose endpoint cannot fit the supported bed geometry', () => {
        assert.throws(
            () =>
                getAdvancedSowingLayoutOptions({
                    maxDistanceCm: 95,
                    minDistanceCm: 5,
                    optimalDistanceCm: 12,
                }),
            /footprint unsupported/u,
        );
    });

    it('includes wider footprints only when an explicit wider bed supports them', () => {
        const options = getAdvancedSowingLayoutOptions(
            {
                maxDistanceCm: 95,
                minDistanceCm: 5,
                optimalDistanceCm: 12,
            },
            { bedColumnCount: 4, bedFieldCount: 16 },
        );

        assert.deepEqual(
            options.map((option) => [
                option.selectedDistanceCm,
                option.layoutKey,
                option.isDefault,
            ]),
            [
                [5, 'v1:fields:1x1:plants:6x6', false],
                [6, 'v1:fields:1x1:plants:5x5', false],
                [7.5, 'v1:fields:1x1:plants:4x4', false],
                [10, 'v1:fields:1x1:plants:3x3', false],
                [12, 'v1:fields:1x1:plants:2x2', true],
                [30, 'v1:fields:1x1:plants:1x1', false],
                [60, 'v1:fields:2x2:plants:1x1', false],
                [90, 'v1:fields:3x3:plants:1x1', false],
                [95, 'v1:fields:4x4:plants:1x1', false],
            ],
        );
    });

    it('keeps both endpoint layouts when the range crosses a transition', () => {
        const options = getAdvancedSowingLayoutOptions({
            maxDistanceCm: 10.1,
            minDistanceCm: 10,
            optimalDistanceCm: 10.05,
        });

        assert.deepEqual(
            options.map((option) => ({
                isDefault: option.isDefault,
                layoutKey: option.layoutKey,
                selectedDistanceCm: option.selectedDistanceCm,
            })),
            [
                {
                    isDefault: false,
                    layoutKey: 'v1:fields:1x1:plants:3x3',
                    selectedDistanceCm: 10,
                },
                {
                    isDefault: true,
                    layoutKey: 'v1:fields:1x1:plants:2x2',
                    selectedDistanceCm: 10.05,
                },
            ],
        );
    });

    it('deduplicates one layout and retains the exact optimal distance', () => {
        const options = getAdvancedSowingLayoutOptions({
            maxDistanceCm: 14,
            minDistanceCm: 12,
            optimalDistanceCm: 13,
        });

        assert.equal(options.length, 1);
        assert.equal(options[0]?.selectedDistanceCm, 13);
        assert.equal(options[0]?.isDefault, true);
    });
});

describe('getAdvancedSowingFootprintPositions', () => {
    it('resolves a 2x2 footprint from a visual top-left anchor', () => {
        assert.deepEqual(
            getAdvancedSowingFootprintPositions({
                anchorPositionIndex: 17,
                fieldSpanColumns: 2,
                fieldSpanRows: 2,
            }),
            [17, 16, 14, 13],
        );
    });

    it('keeps a footprint contiguous across the two physical bed blocks', () => {
        assert.deepEqual(
            getAdvancedSowingFootprintPositions({
                anchorPositionIndex: 11,
                fieldSpanColumns: 2,
                fieldSpanRows: 2,
            }),
            [11, 10, 8, 7],
        );
    });

    it('rejects footprints extending beyond either bed edge', () => {
        assert.throws(
            () =>
                getAdvancedSowingFootprintPositions({
                    anchorPositionIndex: 15,
                    fieldSpanColumns: 2,
                    fieldSpanRows: 2,
                }),
            /extends outside/u,
        );
        assert.throws(
            () =>
                getAdvancedSowingFootprintPositions({
                    anchorPositionIndex: 2,
                    fieldSpanColumns: 2,
                    fieldSpanRows: 2,
                }),
            /extends outside/u,
        );
    });

    it('rejects invalid bed and anchor coordinates', () => {
        assert.throws(
            () =>
                getAdvancedSowingFootprintPositions({
                    anchorPositionIndex: 0,
                    bedFieldCount: 17,
                    fieldSpanColumns: 1,
                    fieldSpanRows: 1,
                }),
            /divisible by 3/u,
        );
        assert.throws(
            () =>
                getAdvancedSowingFootprintPositions({
                    anchorPositionIndex: 18,
                    fieldSpanColumns: 1,
                    fieldSpanRows: 1,
                }),
            /outside the raised bed/u,
        );
    });
});

describe('AdvancedSowingCartConfigurationV1', () => {
    const configuration = buildAdvancedSowingCartConfigurationV1({
        anchorPositionIndex: 11,
        bedFieldCount: 18,
        maxDistanceCm: 60,
        minDistanceCm: 15,
        optimalDistanceCm: 30,
        selectedDistanceCm: 60,
    });

    it('builds a complete versioned snapshot with its derived footprint', () => {
        assert.deepEqual(configuration, {
            anchorPositionIndex: 11,
            bedFieldCount: 18,
            fieldSpanColumns: 2,
            fieldSpanRows: 2,
            layoutKey: 'v1:fields:2x2:plants:1x1',
            maxDistanceCm: 60,
            minDistanceCm: 15,
            occupiedPositionIndices: [11, 10, 8, 7],
            optimalDistanceCm: 30,
            plantCount: 1,
            plantsPerAxis: 1,
            selectedDistanceCm: 60,
            version: 1,
        });
    });

    it('snapshots omitted bounds at the optimal distance', () => {
        const fixedConfiguration = buildAdvancedSowingCartConfigurationV1({
            anchorPositionIndex: 17,
            bedFieldCount: 18,
            optimalDistanceCm: 30,
        });

        assert.equal(fixedConfiguration.minDistanceCm, 30);
        assert.equal(fixedConfiguration.maxDistanceCm, 30);
        assert.equal(fixedConfiguration.selectedDistanceCm, 30);
    });

    it('strictly parses a valid untrusted value into a canonical result', () => {
        const untrustedValue: unknown = {
            ...configuration,
            occupiedPositionIndices: [11, 10, 8, 7],
        };

        assert.deepEqual(
            parseAdvancedSowingCartConfigurationV1(untrustedValue),
            configuration,
        );
    });

    it('rejects unknown properties and unsupported versions', () => {
        assert.throws(
            () =>
                parseAdvancedSowingCartConfigurationV1({
                    ...configuration,
                    unexpected: true,
                }),
            /properties do not match version one/u,
        );
        assert.throws(
            () =>
                parseAdvancedSowingCartConfigurationV1({
                    ...configuration,
                    version: 2,
                }),
            /version must be 1/u,
        );
    });

    it('rejects tampered layout and density values', () => {
        assert.throws(
            () =>
                parseAdvancedSowingCartConfigurationV1({
                    ...configuration,
                    layoutKey: 'v1:fields:1x1:plants:1x1',
                }),
            /layoutKey does not match/u,
        );
        assert.throws(
            () =>
                parseAdvancedSowingCartConfigurationV1({
                    ...configuration,
                    plantCount: 4,
                }),
            /plantCount does not match/u,
        );
        assert.throws(
            () =>
                parseAdvancedSowingCartConfigurationV1({
                    ...configuration,
                    fieldSpanRows: 1,
                }),
            /fieldSpanRows does not match/u,
        );
    });

    it('rejects changed inputs with stale derived data', () => {
        assert.throws(
            () =>
                parseAdvancedSowingCartConfigurationV1({
                    ...configuration,
                    selectedDistanceCm: 30,
                }),
            /does not match the derived layout/u,
        );
        assert.throws(
            () =>
                parseAdvancedSowingCartConfigurationV1({
                    ...configuration,
                    anchorPositionIndex: 17,
                }),
            /occupiedPositionIndices do not match/u,
        );
    });

    it('rejects reordered, incomplete, or duplicate occupied positions', () => {
        for (const occupiedPositionIndices of [
            [10, 11, 8, 7],
            [11, 10, 8],
            [11, 10, 8, 8],
        ]) {
            assert.throws(
                () =>
                    parseAdvancedSowingCartConfigurationV1({
                        ...configuration,
                        occupiedPositionIndices,
                    }),
                /occupiedPositionIndices do not match/u,
            );
        }
    });

    it('rejects a footprint that cannot fit within the snapshotted bed', () => {
        assert.throws(
            () =>
                buildAdvancedSowingCartConfigurationV1({
                    anchorPositionIndex: 15,
                    bedFieldCount: 18,
                    maxDistanceCm: 60,
                    minDistanceCm: 30,
                    optimalDistanceCm: 30,
                    selectedDistanceCm: 60,
                }),
            /extends outside/u,
        );
    });
});

describe('Advanced Sowing shared cart contracts', () => {
    const plan = buildAdvancedSowingCartConfigurationV1({
        anchorPositionIndex: 11,
        bedFieldCount: 18,
        maxDistanceCm: 60,
        minDistanceCm: 15,
        optimalDistanceCm: 30,
        selectedDistanceCm: 60,
    });

    it('strictly parses the client selection discriminator', () => {
        const request = {
            kind: advancedSowingSelectionRequestKind,
            selectedDistanceCm: 60,
            version: 1,
        };
        assert.deepEqual(
            parseAdvancedSowingSelectionRequestV1(request),
            request,
        );
        assert.deepEqual(buildAdvancedSowingSelectionRequestV1(60), request);

        for (const invalid of [
            { ...request, selectedDistanceCm: 0 },
            { ...request, selectedDistanceCm: Number.NaN },
            { ...request, version: 2 },
            { ...request, plan },
        ]) {
            assert.throws(
                () => parseAdvancedSowingSelectionRequestV1(invalid),
                /Invalid Advanced Sowing selection request/u,
            );
        }
    });

    it('strictly parses and canonicalizes the server authorization envelope', () => {
        const authorization = {
            kind: advancedSowingCartAuthorizationKind,
            plan,
            version: 1,
        };
        assert.deepEqual(
            parseAdvancedSowingCartAuthorizationV1(authorization),
            authorization,
        );
        assert.deepEqual(buildAdvancedSowingSelectionSummaryV1(authorization), {
            fieldSpanColumns: 2,
            fieldSpanRows: 2,
            kind: advancedSowingSelectionSummaryKind,
            layoutKey: 'v1:fields:2x2:plants:1x1',
            occupiedPositionIndices: [11, 10, 8, 7],
            plantCount: 1,
            selectedDistanceCm: 60,
            version: 1,
        });
        assert.throws(
            () =>
                parseAdvancedSowingCartAuthorizationV1({
                    ...authorization,
                    plan: { ...plan, plantCount: 4 },
                }),
            /plantCount does not match/u,
        );
        assert.throws(
            () =>
                parseAdvancedSowingCartAuthorizationV1({
                    ...authorization,
                    source: 'client',
                }),
            /Invalid Advanced Sowing cart authorization/u,
        );
    });
});
