import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    buildOutletGardenDetail,
    buildOutletGardenStacks,
    getOutletGardenOfferPlacement,
    type OutletGardenLayoutOffer,
    outletGardenRegisteredBlockNames,
    outletOfferBlockId,
    outletOfferIdFromBlockId,
    reconcileOutletGardenSlots,
} from './outletGardenLayout';

const offers = [
    { id: 301, plantId: 1, plantSortId: 102 },
    { id: 302, plantId: 1, plantSortId: 101 },
    { id: 303, plantId: 2, plantSortId: 201 },
    { id: 304, plantId: 2, plantSortId: 202 },
    { id: 305, plantId: null, plantSortId: 901 },
] satisfies OutletGardenLayoutOffer[];

function offerMarkerPositions(
    stacks: ReturnType<typeof buildOutletGardenStacks>,
) {
    return new Map(
        stacks.flatMap((stack) =>
            stack.blocks.flatMap((block) => {
                const offerId = outletOfferIdFromBlockId(block.id);
                return offerId === null
                    ? []
                    : [[offerId, { x: stack.x, y: stack.y }] as const];
            }),
        ),
    );
}

function stackForOffer(
    stacks: ReturnType<typeof buildOutletGardenStacks>,
    offerId: number,
) {
    return stacks.find((stack) =>
        stack.blocks.some((block) => block.id === outletOfferBlockId(offerId)),
    );
}

function assignedSlot(
    assignments: ReturnType<typeof reconcileOutletGardenSlots>,
    offerId: number,
) {
    return assignments.get(offerId)?.slotIndex;
}

function assignmentSlots(
    assignments: ReturnType<typeof reconcileOutletGardenSlots>,
) {
    return Array.from(assignments, ([offerId, assignment]) => [
        offerId,
        assignment.slotIndex,
    ]);
}

describe('outlet offer block IDs', () => {
    it('round-trips valid IDs and rejects malformed block IDs', () => {
        assert.equal(outletOfferIdFromBlockId(outletOfferBlockId(302)), 302);
        assert.equal(outletOfferIdFromBlockId('outlet-offer:0'), null);
        assert.equal(outletOfferIdFromBlockId('outlet-offer:0302'), null);
        assert.equal(outletOfferIdFromBlockId('outlet-offer:302-extra'), null);
        assert.equal(outletOfferIdFromBlockId('raised-bed:302'), null);
    });
});

describe('reconcileOutletGardenSlots', () => {
    it('creates deterministic plant bays with sorts ordered inside each bay', () => {
        const assignments = reconcileOutletGardenSlots(new Map(), [
            offers[4],
            offers[3],
            offers[0],
            offers[2],
            offers[1],
        ]);

        assert.deepEqual(assignmentSlots(assignments), [
            [302, 0],
            [301, 1],
            [303, 4],
            [304, 5],
            [305, 8],
        ]);
    });

    it('preserves existing slots and fills only never-used room in the same plant bay', () => {
        const initial = reconcileOutletGardenSlots(new Map(), offers);
        const reconciled = reconcileOutletGardenSlots(initial, [
            offers[1],
            offers[2],
            offers[3],
            offers[4],
            { id: 306, plantId: 3, plantSortId: 301 },
            { id: 307, plantId: 1, plantSortId: 103 },
        ]);

        assert.equal(assignedSlot(reconciled, 302), 0);
        assert.equal(assignedSlot(reconciled, 303), 4);
        assert.equal(assignedSlot(reconciled, 304), 5);
        assert.equal(assignedSlot(reconciled, 305), 8);
        assert.equal(assignedSlot(reconciled, 307), 2);
        assert.equal(assignedSlot(reconciled, 306), 12);
        assert.equal(assignedSlot(reconciled, 301), 1);
    });

    it('keeps a plant bay owned when its last live offer becomes a tombstone', () => {
        const plantAOffers = [
            { id: 1, plantId: 1, plantSortId: 101 },
            { id: 2, plantId: 1, plantSortId: 101 },
            { id: 3, plantId: 1, plantSortId: 102 },
            { id: 4, plantId: 1, plantSortId: 102 },
            { id: 5, plantId: 1, plantSortId: 103 },
        ];
        const plantBOffer = { id: 6, plantId: 2, plantSortId: 201 };
        const initial = reconcileOutletGardenSlots(new Map(), [
            ...plantAOffers,
            plantBOffer,
        ]);
        const reconciled = reconcileOutletGardenSlots(initial, [
            ...plantAOffers.slice(0, 4),
            plantBOffer,
            { id: 7, plantId: 1, plantSortId: 104 },
        ]);

        assert.equal(assignedSlot(initial, 5), 4);
        assert.equal(assignedSlot(initial, 6), 8);
        assert.equal(assignedSlot(reconciled, 7), 5);
        assert.equal(assignedSlot(reconciled, 6), 8);
    });

    it('keeps tombstones and restores a reappearing offer to its old slot', () => {
        const initial = reconcileOutletGardenSlots(new Map(), offers);
        const withoutFirst = reconcileOutletGardenSlots(
            initial,
            offers.slice(1),
        );
        const restored = reconcileOutletGardenSlots(withoutFirst, offers);

        assert.equal(withoutFirst, initial);
        assert.equal(restored, initial);
        assert.equal(assignedSlot(restored, 301), 1);
    });

    it('preserves the assignment reference when the offer set is unchanged', () => {
        const initial = reconcileOutletGardenSlots(new Map(), offers);

        assert.equal(
            reconcileOutletGardenSlots(initial, [...offers].reverse()),
            initial,
        );
    });
});

describe('getOutletGardenOfferPlacement', () => {
    it('alternates table and floor displays inside plant bays on both sides', () => {
        assert.deepEqual(getOutletGardenOfferPlacement(0), {
            aisleRow: 0,
            plantBay: 0,
            surface: 'table',
            x: -3,
            y: 0,
        });
        assert.deepEqual(getOutletGardenOfferPlacement(1), {
            aisleRow: 0,
            plantBay: 0,
            surface: 'floor',
            x: -2,
            y: 0,
        });
        assert.deepEqual(getOutletGardenOfferPlacement(4), {
            aisleRow: 0,
            plantBay: 1,
            surface: 'floor',
            x: 2,
            y: 0,
        });
        assert.deepEqual(getOutletGardenOfferPlacement(5), {
            aisleRow: 0,
            plantBay: 1,
            surface: 'table',
            x: 3,
            y: 0,
        });
        assert.deepEqual(getOutletGardenOfferPlacement(8), {
            aisleRow: 1,
            plantBay: 2,
            surface: 'table',
            x: -3,
            y: 3,
        });
    });
});

describe('buildOutletGardenStacks', () => {
    it('renders every offer once using only registered scene blocks', () => {
        const assignments = reconcileOutletGardenSlots(new Map(), offers);
        const stacks = buildOutletGardenStacks(offers, assignments);
        const markerIds = stacks.flatMap((stack) =>
            stack.blocks
                .map((block) => outletOfferIdFromBlockId(block.id))
                .filter((offerId) => offerId !== null),
        );
        const registeredNames = new Set<string>(
            outletGardenRegisteredBlockNames,
        );

        assert.deepEqual(
            markerIds.sort((left, right) => left - right),
            [301, 302, 303, 304, 305],
        );
        assert.ok(
            stacks.every((stack) =>
                stack.blocks.every((block) => registeredNames.has(block.name)),
            ),
        );
    });

    it('places tabletop seedlings above the Outlet table and floor seedlings directly on grass', () => {
        const assignments = reconcileOutletGardenSlots(new Map(), offers);
        const stacks = buildOutletGardenStacks(offers, assignments);
        const tableStack = stackForOffer(stacks, 302);
        const floorStack = stackForOffer(stacks, 301);

        assert.deepEqual(
            tableStack?.blocks.map((block) => block.name),
            ['Block_Grass', 'OutletDisplayTable', 'PotRoundedBowl'],
        );
        assert.deepEqual(
            floorStack?.blocks.map((block) => block.name),
            ['Block_Grass', 'PotBulbousNeck'],
        );
        assert.equal(
            tableStack?.blocks.find(
                (block) => block.name === 'OutletDisplayTable',
            )?.rotation,
            1,
        );
        const emptyTableSegment = stacks.find(
            (stack) => stack.x === -3 && stack.y === 1,
        );
        assert.deepEqual(
            emptyTableSegment?.blocks.map((block) => block.name),
            ['Block_Grass', 'OutletDisplayTable'],
        );
    });

    it('builds a continuous one-tile mulch aisle with a matching front entrance', () => {
        const assignments = reconcileOutletGardenSlots(new Map(), offers);
        const stacks = buildOutletGardenStacks(offers, assignments);

        const pathStacks = stacks.filter((stack) =>
            stack.blocks.some((block) => block.id.startsWith('outlet-path:')),
        );
        assert.deepEqual(
            Array.from(new Set(pathStacks.map((stack) => stack.x))),
            [0],
        );
        assert.deepEqual(
            pathStacks.map((stack) => stack.y),
            [-3, -2, -1, 0, 1, 2, 3, 4, 5, 6],
        );

        const entrance = stacks.find(
            (stack) => stack.x === 0 && stack.y === -3,
        );
        assert.equal(
            entrance?.blocks.some((block) => block.name === 'Fence'),
            false,
        );

        const frontFence = stacks.find(
            (stack) => stack.x === -1 && stack.y === -3,
        );
        assert.equal(
            frontFence?.blocks.some((block) => block.name === 'Fence'),
            true,
        );
    });

    it('turns floor displays toward the center aisle without changing tabletop variation', () => {
        const assignments = reconcileOutletGardenSlots(new Map(), offers);
        const stacks = buildOutletGardenStacks(offers, assignments);
        const leftFloor = stackForOffer(stacks, 301);
        const rightFloor = stackForOffer(stacks, 303);
        const leftTable = stackForOffer(stacks, 302);

        assert.equal(leftFloor?.x, -2);
        assert.equal(
            leftFloor?.blocks.find((block) =>
                block.id.startsWith('outlet-offer:'),
            )?.rotation,
            1,
        );
        assert.equal(rightFloor?.x, 2);
        assert.equal(
            rightFloor?.blocks.find((block) =>
                block.id.startsWith('outlet-offer:'),
            )?.rotation,
            3,
        );
        assert.equal(
            leftTable?.blocks.find((block) =>
                block.id.startsWith('outlet-offer:'),
            )?.rotation,
            1,
        );
        assert.equal(
            stacks.some(
                (stack) =>
                    stack.x === 0 &&
                    stack.blocks.some((block) =>
                        block.id.startsWith('outlet-offer:'),
                    ),
            ),
            false,
        );
    });

    it('keeps surviving offer coordinates stable through removal and additions', () => {
        const initialAssignments = reconcileOutletGardenSlots(
            new Map(),
            offers,
        );
        const initialPositions = offerMarkerPositions(
            buildOutletGardenStacks(offers, initialAssignments),
        );
        const currentOffers = [
            offers[1],
            offers[2],
            offers[3],
            offers[4],
            { id: 306, plantId: 3, plantSortId: 301 },
        ];
        const reconciledAssignments = reconcileOutletGardenSlots(
            initialAssignments,
            currentOffers,
        );
        const currentPositions = offerMarkerPositions(
            buildOutletGardenStacks(currentOffers, reconciledAssignments),
        );

        for (const offer of currentOffers.slice(0, 4)) {
            assert.deepEqual(
                currentPositions.get(offer.id),
                initialPositions.get(offer.id),
            );
        }
        assert.equal(assignedSlot(reconciledAssignments, 306), 12);
    });

    it('is independent of API offer ordering', () => {
        const assignments = reconcileOutletGardenSlots(new Map(), offers);

        assert.deepEqual(
            buildOutletGardenStacks(offers, assignments),
            buildOutletGardenStacks([...offers].reverse(), assignments),
        );
    });
});

describe('buildOutletGardenDetail', () => {
    it('creates a stable read-only synthetic garden for camera focus', () => {
        const assignments = reconcileOutletGardenSlots(new Map(), offers);
        const garden = buildOutletGardenDetail(offers, assignments);

        assert.equal(garden.id, -1);
        assert.equal(garden.isPublic, true);
        assert.equal(garden.raisedBeds.length, 0);
        assert.equal(garden.updatedAt, '1970-01-01T00:00:00.000Z');
        assert.equal(
            Object.values(garden.stacks)
                .flatMap((row) => Object.values(row))
                .flat()
                .filter((block) => block.id.startsWith('outlet-offer:')).length,
            offers.length,
        );
    });
});
