import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    getNeighborPlantSummaries,
    getPlantRelationshipSignal,
    getPlantRelationshipSignalSortScore,
    getRaisedBedFieldRelationshipIndicators,
    getRaisedBedNeighborPositionIndices,
    getRaisedBedRelationshipBlockCount,
} from './plantRelationshipSignals';

describe('getRaisedBedNeighborPositionIndices', () => {
    it('finds immediate edge neighbors inside a two-block raised bed', () => {
        assert.deepEqual(
            getRaisedBedNeighborPositionIndices({
                blockCount: 2,
                positionIndex: 4,
            }),
            [1, 3, 5, 7],
        );
    });

    it('includes the touching row across two 3x3 blocks', () => {
        assert.deepEqual(
            getRaisedBedNeighborPositionIndices({
                blockCount: 2,
                positionIndex: 11,
            }),
            [8, 10, 14],
        );
    });
});

describe('getRaisedBedRelationshipBlockCount', () => {
    it('defaults to the two-block raised-bed picker layout', () => {
        assert.equal(
            getRaisedBedRelationshipBlockCount({
                cartItems: [],
                fields: [],
                positionIndex: 0,
            }),
            2,
        );
    });
});

describe('getNeighborPlantSummaries', () => {
    it('combines active planted fields and pending cart plants', () => {
        const neighborPlants = getNeighborPlantSummaries({
            gardenId: 1,
            raisedBedId: 2,
            positionIndex: 4,
            fields: [
                {
                    active: true,
                    plantSortId: 10,
                    positionIndex: 3,
                },
                {
                    active: false,
                    plantSortId: 12,
                    positionIndex: 5,
                },
            ],
            cartItems: [
                {
                    entityId: '11',
                    entityTypeName: 'plantSort',
                    gardenId: 1,
                    raisedBedId: 2,
                    positionIndex: 5,
                    status: 'new',
                },
                {
                    entityId: '13',
                    entityTypeName: 'plantSort',
                    gardenId: 1,
                    raisedBedId: 2,
                    positionIndex: 12,
                    status: 'new',
                },
            ],
            sorts: [
                {
                    id: 10,
                    information: {
                        plant: {
                            id: 100,
                            information: { name: 'Bosiljak' },
                        },
                    },
                },
                {
                    id: 11,
                    information: {
                        plant: {
                            id: 101,
                            information: { name: 'Komorač' },
                        },
                    },
                },
                {
                    id: 12,
                    information: {
                        plant: {
                            id: 102,
                            information: { name: 'Neaktivna biljka' },
                        },
                    },
                },
                {
                    id: 13,
                    information: {
                        plant: {
                            id: 103,
                            information: { name: 'Predaleka biljka' },
                        },
                    },
                },
            ],
        });

        assert.deepEqual(neighborPlants, [
            { id: 100, name: 'Bosiljak' },
            { id: 101, name: 'Komorač' },
        ]);
    });
});

describe('getRaisedBedFieldRelationshipIndicators', () => {
    it('creates edge indicators for companion and antagonist neighbors', () => {
        const indicators = getRaisedBedFieldRelationshipIndicators({
            blockCount: 2,
            gardenId: 1,
            raisedBedId: 2,
            fields: [
                {
                    active: true,
                    plantSortId: 10,
                    positionIndex: 4,
                },
                {
                    active: true,
                    plantSortId: 11,
                    positionIndex: 5,
                },
                {
                    active: true,
                    plantSortId: 12,
                    positionIndex: 1,
                },
            ],
            sorts: [
                {
                    id: 10,
                    information: {
                        plant: {
                            id: 100,
                            information: { name: 'Rajčica' },
                            relationships: {
                                companions: [{ id: 101, name: 'Bosiljak' }],
                                antagonists: [{ id: 102, name: 'Komorač' }],
                            },
                        },
                    },
                },
                {
                    id: 11,
                    information: {
                        plant: {
                            id: 101,
                            information: { name: 'Bosiljak' },
                        },
                    },
                },
                {
                    id: 12,
                    information: {
                        plant: {
                            id: 102,
                            information: { name: 'Komorač' },
                        },
                    },
                },
            ],
        });

        assert.deepEqual(indicators, [
            {
                antagonistPlantNames: [],
                companionPlantNames: ['Bosiljak'],
                direction: 'left',
                neighborPositionIndex: 5,
                positionIndex: 4,
                status: 'companion',
            },
            {
                antagonistPlantNames: ['Komorač'],
                companionPlantNames: [],
                direction: 'top',
                neighborPositionIndex: 4,
                positionIndex: 1,
                status: 'antagonist',
            },
        ]);
    });

    it('uses plant sort relationships for edge indicators', () => {
        const indicators = getRaisedBedFieldRelationshipIndicators({
            blockCount: 2,
            gardenId: 1,
            raisedBedId: 2,
            fields: [
                {
                    active: true,
                    plantSortId: 10,
                    positionIndex: 4,
                },
                {
                    active: true,
                    plantSortId: 11,
                    positionIndex: 5,
                },
            ],
            sorts: [
                {
                    id: 10,
                    relationships: {
                        companions: [{ id: 101, name: 'Bosiljak' }],
                    },
                    information: {
                        plant: {
                            id: 100,
                            information: { name: 'Rajčica' },
                        },
                    },
                },
                {
                    id: 11,
                    information: {
                        plant: {
                            id: 101,
                            information: { name: 'Bosiljak' },
                        },
                    },
                },
            ],
        });

        assert.deepEqual(indicators, [
            {
                antagonistPlantNames: [],
                companionPlantNames: ['Bosiljak'],
                direction: 'left',
                neighborPositionIndex: 5,
                positionIndex: 4,
                status: 'companion',
            },
        ]);
    });

    it('ignores diagonal plant relationships', () => {
        const indicators = getRaisedBedFieldRelationshipIndicators({
            blockCount: 2,
            gardenId: 1,
            raisedBedId: 2,
            fields: [
                {
                    active: true,
                    plantSortId: 10,
                    positionIndex: 4,
                },
                {
                    active: true,
                    plantSortId: 11,
                    positionIndex: 8,
                },
            ],
            sorts: [
                {
                    id: 10,
                    relationships: {
                        companions: [{ id: 101, name: 'Bosiljak' }],
                    },
                    information: {
                        plant: {
                            id: 100,
                            information: { name: 'Rajčica' },
                        },
                    },
                },
                {
                    id: 11,
                    information: {
                        plant: {
                            id: 101,
                            information: { name: 'Bosiljak' },
                        },
                    },
                },
            ],
        });

        assert.deepEqual(indicators, []);
    });
});

describe('getPlantRelationshipSignal', () => {
    it('marks candidates with both companion and antagonist neighbors as mixed', () => {
        const signal = getPlantRelationshipSignal({
            candidate: {
                id: 7,
                information: { name: 'Rajčica' },
                relationships: {
                    companions: [{ id: 100, name: 'Bosiljak' }],
                    antagonists: [{ id: 101, name: 'Komorač' }],
                },
            },
            neighborPlants: [
                { id: 100, name: 'Bosiljak' },
                { id: 101, name: 'Komorač' },
            ],
        });

        assert.deepEqual(signal, {
            status: 'mixed',
            companionNeighborNames: ['Bosiljak'],
            antagonistNeighborNames: ['Komorač'],
            neighborPlantIds: [100, 101],
        });
    });
});

describe('getPlantRelationshipSignalSortScore', () => {
    it('promotes companions while keeping neutral choices above avoid signals', () => {
        assert.ok(
            getPlantRelationshipSignalSortScore('companion') >
                getPlantRelationshipSignalSortScore('neutral'),
        );
        assert.ok(
            getPlantRelationshipSignalSortScore('neutral') >
                getPlantRelationshipSignalSortScore('antagonist'),
        );
    });
});
