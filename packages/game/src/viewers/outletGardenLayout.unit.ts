import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    buildOutletGardenDetail,
    buildOutletGardenStacks,
    getOutletGardenDisplayUnits,
    getOutletGardenOfferPlacement,
    isOutletGardenDisplayLimited,
    type OutletGardenLayoutOffer,
    outletGardenMaxDisplayedUnitsPerOffer,
    outletGardenMaxDisplayedUnitsTotal,
    outletGardenMaxTrackedTombstones,
    outletGardenRegisteredBlockNames,
    outletOfferBlockId,
    outletOfferDisplayFromBlockId,
    outletOfferIdFromBlockId,
    reconcileOutletGardenSlots,
} from './outletGardenLayout';

const offers = [
    { id: 301, plantId: 1, plantSortId: 102, remainingQuantity: 1 },
    { id: 302, plantId: 1, plantSortId: 101, remainingQuantity: 1 },
    { id: 303, plantId: 2, plantSortId: 201, remainingQuantity: 1 },
    { id: 304, plantId: 2, plantSortId: 202, remainingQuantity: 1 },
    { id: 305, plantId: null, plantSortId: 901, remainingQuantity: 1 },
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
    unitIndex = 0,
) {
    return assignments.get(outletOfferBlockId(offerId, unitIndex))?.slotIndex;
}

function assignmentSlots(
    assignments: ReturnType<typeof reconcileOutletGardenSlots>,
) {
    return Array.from(assignments, ([blockId, assignment]) => [
        blockId,
        assignment.slotIndex,
    ]);
}

function coordinateKey({ x, y }: { x: number; y: number }) {
    return `${x.toString()}|${y.toString()}`;
}

function positionsForBlocks(
    stacks: ReturnType<typeof buildOutletGardenStacks>,
    predicate: (block: (typeof stacks)[number]['blocks'][number]) => boolean,
) {
    return stacks.flatMap((stack) =>
        stack.blocks.some(predicate) ? [{ x: stack.x, y: stack.y }] : [],
    );
}

function blockById(
    stacks: ReturnType<typeof buildOutletGardenStacks>,
    blockId: string,
) {
    return stacks
        .flatMap((stack) => stack.blocks)
        .find((block) => block.id === blockId);
}

describe('outlet offer block IDs', () => {
    it('round-trips valid IDs and rejects malformed block IDs', () => {
        assert.equal(outletOfferIdFromBlockId(outletOfferBlockId(302)), 302);
        assert.deepEqual(
            outletOfferDisplayFromBlockId(outletOfferBlockId(302, 4)),
            { offerId: 302, unitIndex: 4 },
        );
        assert.equal(outletOfferIdFromBlockId('outlet-offer:0'), null);
        assert.equal(outletOfferIdFromBlockId('outlet-offer:0302'), null);
        assert.equal(outletOfferIdFromBlockId('outlet-offer:302:0'), null);
        assert.equal(outletOfferIdFromBlockId('outlet-offer:302:01'), null);
        assert.equal(outletOfferIdFromBlockId('outlet-offer:302-extra'), null);
        assert.equal(outletOfferIdFromBlockId('raised-bed:302'), null);
    });
});

describe('getOutletGardenDisplayUnits', () => {
    it('bounds a single pathological stock value before expanding scene objects', () => {
        const bulkOffer = {
            id: 900,
            plantId: 9,
            plantSortId: 901,
            remainingQuantity: 1_000_000_000,
        };
        const displays = getOutletGardenDisplayUnits([bulkOffer]);

        assert.equal(displays.length, outletGardenMaxDisplayedUnitsPerOffer);
        assert.equal(displays[0]?.blockId, outletOfferBlockId(900));
        assert.equal(
            displays.at(-1)?.blockId,
            outletOfferBlockId(900, outletGardenMaxDisplayedUnitsPerOffer - 1),
        );
        assert.equal(isOutletGardenDisplayLimited([bulkOffer]), true);
    });

    it('shares the total scene budget fairly while preserving offer grouping', () => {
        const bulkOffers = Array.from({ length: 6 }, (_, index) => ({
            id: 910 + index,
            plantId: index + 1,
            plantSortId: 910 + index,
            remainingQuantity: outletGardenMaxDisplayedUnitsPerOffer,
        }));
        const displays = getOutletGardenDisplayUnits(bulkOffers);
        const counts = bulkOffers.map(
            (offer) =>
                displays.filter((display) => display.id === offer.id).length,
        );

        assert.equal(displays.length, outletGardenMaxDisplayedUnitsTotal);
        assert.deepEqual(
            getOutletGardenDisplayUnits([...bulkOffers].reverse()),
            displays,
        );
        assert.ok(Math.max(...counts) - Math.min(...counts) <= 1);
        assert.deepEqual(
            Array.from(new Set(displays.map((display) => display.id))),
            bulkOffers.map((offer) => offer.id),
        );
        assert.equal(isOutletGardenDisplayLimited(bulkOffers), true);
        assert.equal(
            isOutletGardenDisplayLimited(bulkOffers.slice(0, 5)),
            false,
        );
        assert.equal(
            isOutletGardenDisplayLimited([
                ...bulkOffers.slice(0, 5),
                { ...bulkOffers[5], remainingQuantity: 1 },
            ]),
            true,
        );
        assert.equal(
            isOutletGardenDisplayLimited([
                {
                    ...bulkOffers[0],
                    remainingQuantity:
                        outletGardenMaxDisplayedUnitsPerOffer + 1,
                },
            ]),
            true,
        );
        assert.equal(isOutletGardenDisplayLimited(offers), false);
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
            ['outlet-offer:302', 0],
            ['outlet-offer:301', 1],
            ['outlet-offer:303', 4],
            ['outlet-offer:304', 5],
            ['outlet-offer:305', 8],
        ]);
    });

    it('preserves existing slots and fills only never-used room in the same plant bay', () => {
        const initial = reconcileOutletGardenSlots(new Map(), offers);
        const reconciled = reconcileOutletGardenSlots(initial, [
            offers[1],
            offers[2],
            offers[3],
            offers[4],
            {
                id: 306,
                plantId: 3,
                plantSortId: 301,
                remainingQuantity: 1,
            },
            {
                id: 307,
                plantId: 1,
                plantSortId: 103,
                remainingQuantity: 1,
            },
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
            { id: 1, plantId: 1, plantSortId: 101, remainingQuantity: 1 },
            { id: 2, plantId: 1, plantSortId: 101, remainingQuantity: 1 },
            { id: 3, plantId: 1, plantSortId: 102, remainingQuantity: 1 },
            { id: 4, plantId: 1, plantSortId: 102, remainingQuantity: 1 },
            { id: 5, plantId: 1, plantSortId: 103, remainingQuantity: 1 },
        ];
        const plantBOffer = {
            id: 6,
            plantId: 2,
            plantSortId: 201,
            remainingQuantity: 1,
        };
        const initial = reconcileOutletGardenSlots(new Map(), [
            ...plantAOffers,
            plantBOffer,
        ]);
        const reconciled = reconcileOutletGardenSlots(initial, [
            ...plantAOffers.slice(0, 4),
            plantBOffer,
            { id: 7, plantId: 1, plantSortId: 104, remainingQuantity: 1 },
        ]);

        assert.equal(assignedSlot(initial, 5), 2);
        assert.equal(assignedSlot(initial, 6), 8);
        assert.equal(assignedSlot(reconciled, 7), 3);
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

    it('fills tabletops across reserved bays first and restores quantity tombstones', () => {
        const quantityOffer = {
            id: 401,
            plantId: 4,
            plantSortId: 401,
            remainingQuantity: 5,
        };
        const initial = reconcileOutletGardenSlots(new Map(), [quantityOffer]);

        assert.deepEqual(
            Array.from({ length: 5 }, (_, unitIndex) =>
                assignedSlot(initial, quantityOffer.id, unitIndex),
            ),
            [0, 1, 4, 5, 2],
        );

        const reduced = reconcileOutletGardenSlots(initial, [
            { ...quantityOffer, remainingQuantity: 3 },
        ]);
        const restored = reconcileOutletGardenSlots(reduced, [quantityOffer]);

        assert.equal(reduced, initial);
        assert.equal(restored, initial);
        assert.equal(assignedSlot(restored, quantityOffer.id, 4), 2);
    });

    it('bounds historical tombstones and reuses fully released plant bays', () => {
        const offerBatch = (idOffset: number, plantOffset: number) =>
            Array.from({ length: 6 }, (_, index) => ({
                id: idOffset + index,
                plantId: plantOffset + index,
                plantSortId: idOffset + index,
                remainingQuantity: outletGardenMaxDisplayedUnitsPerOffer,
            }));
        const firstBatch = offerBatch(1_000, 1_000);
        const secondBatch = offerBatch(2_000, 2_000);
        const thirdBatch = offerBatch(3_000, 3_000);
        const firstAssignments = reconcileOutletGardenSlots(
            new Map(),
            firstBatch,
        );
        const secondAssignments = reconcileOutletGardenSlots(
            firstAssignments,
            secondBatch,
        );
        const onlySecondTombstones = reconcileOutletGardenSlots(
            secondAssignments,
            [],
        );
        const thirdAssignments = reconcileOutletGardenSlots(
            onlySecondTombstones,
            thirdBatch,
        );

        assert.equal(firstAssignments.size, outletGardenMaxDisplayedUnitsTotal);
        assert.equal(
            secondAssignments.size,
            outletGardenMaxDisplayedUnitsTotal +
                outletGardenMaxTrackedTombstones,
        );
        assert.equal(
            onlySecondTombstones.size,
            outletGardenMaxTrackedTombstones,
        );
        assert.equal(
            thirdAssignments.size,
            outletGardenMaxDisplayedUnitsTotal +
                outletGardenMaxTrackedTombstones,
        );
        assert.ok(
            Math.max(
                ...Array.from(
                    thirdAssignments.values(),
                    (assignment) => assignment.slotIndex,
                ),
            ) <
                (outletGardenMaxDisplayedUnitsTotal +
                    outletGardenMaxTrackedTombstones) *
                    2,
        );
        assert.ok(
            (assignedSlot(secondAssignments, 2_000) ?? -1) >
                Math.max(
                    ...Array.from(
                        firstAssignments.values(),
                        (assignment) => assignment.slotIndex,
                    ),
                ),
        );
        assert.equal(assignedSlot(thirdAssignments, 3_000), 0);
    });

    it('keeps capped survivor slots stable through repeated stock churn', () => {
        const stableOffer = {
            id: 4_000,
            plantId: 4_000,
            plantSortId: 4_000,
            remainingQuantity: outletGardenMaxDisplayedUnitsPerOffer,
        };
        const rotatingOffers = (cycle: number) =>
            Array.from({ length: 5 }, (_, index) => ({
                id: 5_000 + cycle * 10 + index,
                plantId: 5_000 + cycle * 10 + index,
                plantSortId: 5_000 + cycle * 10 + index,
                remainingQuantity: outletGardenMaxDisplayedUnitsPerOffer,
            }));
        const initialOffers = [stableOffer, ...rotatingOffers(0)];
        let assignments = reconcileOutletGardenSlots(new Map(), initialOffers);
        const stableSlots = new Map(
            getOutletGardenDisplayUnits(initialOffers)
                .filter((display) => display.id === stableOffer.id)
                .map((display) => [
                    display.blockId,
                    assignments.get(display.blockId)?.slotIndex,
                ]),
        );

        for (let cycle = 1; cycle <= 10; cycle += 1) {
            assignments = reconcileOutletGardenSlots(assignments, [
                stableOffer,
                ...rotatingOffers(cycle),
            ]);

            assert.ok(
                assignments.size <=
                    outletGardenMaxDisplayedUnitsTotal +
                        outletGardenMaxTrackedTombstones,
            );
            for (const [blockId, slotIndex] of stableSlots) {
                assert.equal(assignments.get(blockId)?.slotIndex, slotIndex);
            }
        }
    });
});

describe('getOutletGardenOfferPlacement', () => {
    it('fills both tabletop positions before floor positions around each winding segment', () => {
        assert.deepEqual(getOutletGardenOfferPlacement(0), {
            aisleRow: 0,
            plantBay: 0,
            surface: 'table',
            x: -3,
            y: 1,
        });
        assert.deepEqual(getOutletGardenOfferPlacement(1), {
            aisleRow: 0,
            plantBay: 0,
            surface: 'table',
            x: -3,
            y: 2,
        });
        assert.deepEqual(getOutletGardenOfferPlacement(4), {
            aisleRow: 0,
            plantBay: 1,
            surface: 'table',
            x: 3,
            y: 1,
        });
        assert.deepEqual(getOutletGardenOfferPlacement(5), {
            aisleRow: 0,
            plantBay: 1,
            surface: 'table',
            x: 3,
            y: 2,
        });
        assert.deepEqual(getOutletGardenOfferPlacement(6), {
            aisleRow: 0,
            plantBay: 1,
            surface: 'floor',
            x: 2,
            y: 1,
        });
        assert.deepEqual(getOutletGardenOfferPlacement(8), {
            aisleRow: 1,
            plantBay: 2,
            surface: 'table',
            x: -3,
            y: 4,
        });
        assert.deepEqual(getOutletGardenOfferPlacement(16), {
            aisleRow: 2,
            plantBay: 4,
            surface: 'table',
            x: 1,
            y: 13,
        });
        assert.deepEqual(getOutletGardenOfferPlacement(32), {
            aisleRow: 4,
            plantBay: 8,
            surface: 'table',
            x: 13,
            y: 9,
        });
    });
});

describe('buildOutletGardenStacks', () => {
    it('renders one display per remaining seedling using only registered scene blocks', () => {
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
        assert.ok(
            ['Tree', 'Bush'].every((name) =>
                stacks.some((stack) =>
                    stack.blocks.some((block) => block.name === name),
                ),
            ),
        );
        assert.ok(
            stacks.some(
                (stack) =>
                    stack.x === 1 &&
                    stack.y === 10 &&
                    stack.blocks.some((block) =>
                        block.id.startsWith('outlet-path:'),
                    ),
            ),
        );
    });

    it('uses unique interactive blocks for the full remaining quantity', () => {
        const quantityOffers = [
            { ...offers[0], remainingQuantity: 2 },
            { ...offers[2], remainingQuantity: 3 },
        ];
        const assignments = reconcileOutletGardenSlots(
            new Map(),
            quantityOffers,
        );
        const stacks = buildOutletGardenStacks(quantityOffers, assignments);
        const blockIds = stacks.flatMap((stack) =>
            stack.blocks
                .filter((block) => outletOfferIdFromBlockId(block.id) !== null)
                .map((block) => block.id),
        );

        assert.equal(blockIds.length, 5);
        assert.equal(new Set(blockIds).size, 5);
        assert.deepEqual(
            blockIds
                .filter((blockId) => outletOfferIdFromBlockId(blockId) === 301)
                .sort(),
            [outletOfferBlockId(301), outletOfferBlockId(301, 1)].sort(),
        );
        assert.deepEqual(
            blockIds
                .filter((blockId) => outletOfferIdFromBlockId(blockId) === 303)
                .sort(),
            [
                outletOfferBlockId(303),
                outletOfferBlockId(303, 1),
                outletOfferBlockId(303, 2),
            ].sort(),
        );
    });

    it('places tabletop seedlings above the Outlet table and floor seedlings directly on grass', () => {
        const quantityOffer = {
            id: 302,
            plantId: 1,
            plantSortId: 101,
            remainingQuantity: 3,
        };
        const assignments = reconcileOutletGardenSlots(new Map(), [
            quantityOffer,
        ]);
        const stacks = buildOutletGardenStacks([quantityOffer], assignments);
        const tableStack = stackForOffer(stacks, 302);
        const floorStack = stacks.find((stack) =>
            stack.blocks.some(
                (block) => block.id === outletOfferBlockId(302, 2),
            ),
        );

        assert.deepEqual(
            tableStack?.blocks.map((block) => block.name),
            ['Block_Grass', 'OutletDisplayTable', 'PotRoundedBowl'],
        );
        assert.deepEqual(
            floorStack?.blocks.map((block) => block.name),
            ['Block_Grass', 'PotRoundedBowl'],
        );
        assert.equal(
            tableStack?.blocks.find(
                (block) => block.name === 'OutletDisplayTable',
            )?.rotation,
            1,
        );
        assert.equal(tableStack?.x, -3);
        assert.equal(floorStack?.x, -2);
    });

    it('turns after eight tables while keeping one connected one-tile mulch path', () => {
        const windingOffer = {
            id: 801,
            plantId: 8,
            plantSortId: 801,
            remainingQuantity: 48,
        };
        const assignments = reconcileOutletGardenSlots(new Map(), [
            windingOffer,
        ]);
        const stacks = buildOutletGardenStacks([windingOffer], assignments);
        const pathPositions = positionsForBlocks(stacks, (block) =>
            block.id.startsWith('outlet-path:'),
        );
        const pathKeys = new Set(pathPositions.map(coordinateKey));
        const neighbors = ({ x, y }: { x: number; y: number }) =>
            [
                { x: x - 1, y },
                { x: x + 1, y },
                { x, y: y - 1 },
                { x, y: y + 1 },
            ].filter((point) => pathKeys.has(coordinateKey(point)));
        const endpoints = pathPositions.filter(
            (position) => neighbors(position).length === 1,
        );

        assert.equal(pathKeys.size, pathPositions.length);
        assert.equal(endpoints.length, 2);
        assert.ok(
            pathPositions.every((position) => {
                const degree = neighbors(position).length;
                return degree === 1 || degree === 2;
            }),
        );

        const visited = new Set<string>();
        const pending = [endpoints[0]];
        while (pending.length > 0) {
            const position = pending.pop();
            if (!position) {
                continue;
            }
            const key = coordinateKey(position);
            if (visited.has(key)) {
                continue;
            }
            visited.add(key);
            pending.push(...neighbors(position));
        }
        assert.equal(visited.size, pathKeys.size);

        for (const { x, y } of pathPositions) {
            assert.equal(
                [
                    { x, y },
                    { x: x + 1, y },
                    { x, y: y + 1 },
                    { x: x + 1, y: y + 1 },
                ].every((point) => pathKeys.has(coordinateKey(point))),
                false,
            );
        }

        assert.deepEqual(neighbors({ x: 0, y: 10 }), [
            { x: 1, y: 10 },
            { x: 0, y: 9 },
        ]);
        assert.deepEqual(neighbors({ x: 10, y: 10 }), [
            { x: 9, y: 10 },
            { x: 10, y: 9 },
        ]);

        const tablesPerSegment = new Map<number, number>();
        for (const table of stacks
            .flatMap((stack) => stack.blocks)
            .filter((block) => block.id.startsWith('outlet-table:'))) {
            const plantBay = Number(table.id.split(':')[1]);
            const aisleRow = Math.floor(plantBay / 2);
            const segmentIndex = Math.floor(aisleRow / 2);
            tablesPerSegment.set(
                segmentIndex,
                (tablesPerSegment.get(segmentIndex) ?? 0) + 1,
            );
        }
        assert.deepEqual(Array.from(tablesPerSegment.values()), [8, 8, 8]);

        const entranceY = Math.min(...pathPositions.map((point) => point.y));
        const entrance = stacks.find(
            (stack) => stack.x === 0 && stack.y === entranceY,
        );
        assert.equal(
            entrance?.blocks.some((block) => block.name === 'Fence'),
            false,
        );

        const frontFence = stacks.find(
            (stack) => stack.x === -1 && stack.y === entranceY,
        );
        assert.equal(
            frontFence?.blocks.some((block) => block.name === 'Fence'),
            true,
        );
    });

    it('faces tables and every plant surface toward its local walkway segment', () => {
        const facingOffer = {
            id: 880,
            plantId: 8,
            plantSortId: 881,
            remainingQuantity: 12,
        };
        const facingSlots = [0, 2, 4, 6, 16, 18, 20, 22, 32, 34, 36, 38];
        const assignments = new Map(
            facingSlots.map((slotIndex, unitIndex) => [
                outletOfferBlockId(facingOffer.id, unitIndex),
                {
                    offerId: facingOffer.id,
                    plantKey: 'plant:8',
                    slotIndex,
                    unitIndex,
                },
            ]),
        );
        const stacks = buildOutletGardenStacks([facingOffer], assignments);
        const expectedOfferRotations = [1, 1, 3, 3, 2, 2, 0, 0, 3, 3, 1, 1];

        assert.deepEqual(
            Array.from(
                { length: facingOffer.remainingQuantity },
                (_, index) =>
                    blockById(stacks, outletOfferBlockId(facingOffer.id, index))
                        ?.rotation,
            ),
            expectedOfferRotations,
        );
        assert.deepEqual(
            [0, 1, 4, 5, 8, 9].map(
                (plantBay) =>
                    blockById(stacks, `outlet-table:${plantBay.toString()}:0`)
                        ?.rotation,
            ),
            [1, 3, 2, 0, 3, 1],
        );

        const pathPositions = new Set(
            positionsForBlocks(stacks, (block) =>
                block.id.startsWith('outlet-path:'),
            ).map(coordinateKey),
        );
        for (const slotIndex of facingSlots) {
            const placement = getOutletGardenOfferPlacement(slotIndex);
            const pathDistance = placement.surface === 'table' ? 3 : 2;
            assert.ok(
                [
                    { x: placement.x - pathDistance, y: placement.y },
                    { x: placement.x + pathDistance, y: placement.y },
                    { x: placement.x, y: placement.y - pathDistance },
                    { x: placement.x, y: placement.y + pathDistance },
                ].some((point) => pathPositions.has(coordinateKey(point))),
            );
        }
    });

    it('adds restrained registered decor away from the path and every display position', () => {
        const decoratedOffer = {
            id: 890,
            plantId: 8,
            plantSortId: 891,
            remainingQuantity: 64,
        };
        const assignments = reconcileOutletGardenSlots(new Map(), [
            decoratedOffer,
        ]);
        const stacks = buildOutletGardenStacks([decoratedOffer], assignments);
        const decorations = stacks.flatMap((stack) =>
            stack.blocks.flatMap((block) =>
                block.id.startsWith('outlet-decor:')
                    ? [{ block, x: stack.x, y: stack.y }]
                    : [],
            ),
        );
        const decorationNames = Array.from(
            new Set(decorations.map(({ block }) => block.name)),
        ).sort();
        const registeredNames = new Set<string>(
            outletGardenRegisteredBlockNames,
        );
        const protectedPositions = [
            ...positionsForBlocks(stacks, (block) =>
                block.id.startsWith('outlet-path:'),
            ),
            ...positionsForBlocks(stacks, (block) =>
                block.id.startsWith('outlet-table:'),
            ),
            ...positionsForBlocks(
                stacks,
                (block) => outletOfferIdFromBlockId(block.id) !== null,
            ),
        ];

        assert.deepEqual(decorationNames, [
            'Bush',
            'StoneSmall',
            'Tree',
            'WoodenBench',
        ]);
        assert.equal(
            new Set(decorations.map(({ block }) => block.id)).size,
            decorations.length,
        );
        assert.ok(
            decorations.every(
                ({ block }) =>
                    registeredNames.has(block.name) &&
                    outletOfferIdFromBlockId(block.id) === null,
            ),
        );
        assert.ok(
            decorations.every(({ x, y }) =>
                protectedPositions.every(
                    (position) =>
                        Math.max(
                            Math.abs(x - position.x),
                            Math.abs(y - position.y),
                        ) > 1,
                ),
            ),
        );
    });

    it('keeps existing decor and offer coordinates stable as the route grows and stock churns', () => {
        const stockOffer = {
            id: 895,
            plantId: 8,
            plantSortId: 896,
            remainingQuantity: 16,
        };
        const initialAssignments = reconcileOutletGardenSlots(new Map(), [
            stockOffer,
        ]);
        const initialStacks = buildOutletGardenStacks(
            [stockOffer],
            initialAssignments,
        );
        const expandedOffer = { ...stockOffer, remainingQuantity: 48 };
        const expandedAssignments = reconcileOutletGardenSlots(
            initialAssignments,
            [expandedOffer],
        );
        const expandedStacks = buildOutletGardenStacks(
            [expandedOffer],
            expandedAssignments,
        );
        const reducedAssignments = reconcileOutletGardenSlots(
            expandedAssignments,
            [stockOffer],
        );
        const reducedStacks = buildOutletGardenStacks(
            [stockOffer],
            reducedAssignments,
        );
        const positionsById = (
            stacks: ReturnType<typeof buildOutletGardenStacks>,
        ) =>
            new Map(
                stacks.flatMap((stack) =>
                    stack.blocks.flatMap((block) =>
                        block.id.startsWith('outlet-decor:') ||
                        outletOfferIdFromBlockId(block.id) !== null
                            ? [[block.id, { x: stack.x, y: stack.y }] as const]
                            : [],
                    ),
                ),
            );
        const initialPositions = positionsById(initialStacks);
        const expandedPositions = positionsById(expandedStacks);
        const reducedPositions = positionsById(reducedStacks);

        for (const [blockId, position] of initialPositions) {
            assert.deepEqual(expandedPositions.get(blockId), position);
            assert.deepEqual(reducedPositions.get(blockId), position);
        }
        assert.ok(
            expandedStacks.some((stack) =>
                stack.blocks.some(
                    (block) => block.id === 'outlet-decor:Tree:2',
                ),
            ),
        );
        assert.equal(reducedAssignments, expandedAssignments);
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
            {
                id: 306,
                plantId: 3,
                plantSortId: 301,
                remainingQuantity: 1,
            },
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
            getOutletGardenDisplayUnits(offers).length,
        );
    });
});
