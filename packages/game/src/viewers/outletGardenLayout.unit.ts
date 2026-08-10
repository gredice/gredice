import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    buildOutletGardenDetail,
    buildOutletGardenStacks,
    outletGardenRegisteredBlockNames,
    outletOfferBlockId,
    outletOfferIdFromBlockId,
    reconcileOutletGardenSlots,
} from './outletGardenLayout';

const offers = [{ id: 301 }, { id: 302 }, { id: 303 }];

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
    it('allocates unseen offers deterministically and never compacts removed slots', () => {
        const initial = reconcileOutletGardenSlots(new Map(), [
            { id: 303 },
            { id: 301 },
            { id: 302 },
        ]);

        assert.deepEqual(Array.from(initial.entries()), [
            [301, 0],
            [302, 1],
            [303, 2],
        ]);

        const reconciled = reconcileOutletGardenSlots(initial, [
            { id: 304 },
            { id: 303 },
        ]);

        assert.deepEqual(Array.from(reconciled.entries()), [
            [301, 0],
            [302, 1],
            [303, 2],
            [304, 3],
        ]);
    });

    it('preserves the assignment reference when the offer set is unchanged', () => {
        const initial = reconcileOutletGardenSlots(new Map(), offers);

        assert.equal(
            reconcileOutletGardenSlots(initial, [...offers].reverse()),
            initial,
        );
    });
});

describe('buildOutletGardenStacks', () => {
    it('renders one registered seedling marker for every current offer', () => {
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

        assert.deepEqual(markerIds, [301, 302, 303]);
        assert.ok(
            stacks.every((stack) =>
                stack.blocks.every((block) => registeredNames.has(block.name)),
            ),
        );
    });

    it('keeps surviving offers in place after an earlier offer disappears', () => {
        const initialAssignments = reconcileOutletGardenSlots(
            new Map(),
            offers,
        );
        const initialPositions = offerMarkerPositions(
            buildOutletGardenStacks(offers, initialAssignments),
        );
        const currentOffers = [{ id: 302 }, { id: 303 }, { id: 304 }];
        const reconciledAssignments = reconcileOutletGardenSlots(
            initialAssignments,
            currentOffers,
        );
        const currentPositions = offerMarkerPositions(
            buildOutletGardenStacks(currentOffers, reconciledAssignments),
        );

        assert.deepEqual(currentPositions.get(302), initialPositions.get(302));
        assert.deepEqual(currentPositions.get(303), initialPositions.get(303));
        assert.equal(reconciledAssignments.get(304), 3);
    });

    it('is independent of the API offer ordering', () => {
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
