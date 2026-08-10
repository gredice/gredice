import type {
    PublicGardenDetail,
    PublicGardenStack,
} from './PublicGardenViewer';

export type OutletGardenLayoutOffer = {
    id: number;
    plantId: number | null;
    plantSortId: number;
};

export type OutletGardenSlotAssignment = {
    plantKey: string;
    slotIndex: number;
};

export type OutletGardenSlotAssignments = ReadonlyMap<
    number,
    OutletGardenSlotAssignment
>;

export type OutletGardenOfferPlacement = {
    aisleRow: number;
    plantBay: number;
    surface: 'floor' | 'table';
    x: number;
    y: number;
};

const outletOfferBlockIdPrefix = 'outlet-offer:';
const outletGardenOffersPerPlantBay = 4;
const outletGardenPlantBaysPerAisleRow = 2;
const outletGardenAisleRowSpacing = 3;
const outletGardenTableDistance = 3;
const outletGardenFloorDistance = 4;
const outletGardenPathHalfWidth = 1;
const outletGardenSideMargin = 2;
const outletGardenFrontMargin = 3;
const outletGardenBackMargin = 3;
const outletGardenVirtualId = -1;
const outletGardenUpdatedAt = '1970-01-01T00:00:00.000Z';

const outletGardenPotNames = [
    'PotLowBowl',
    'PotRoundedBowl',
    'PotBulbousNeck',
    'PotTallTapered',
    'PotHourglass',
    'PotStraightShortTub',
    'PotNarrowFootBowl',
    'PotSquatRidged',
    'PotTallSlenderCone',
    'PotWideLippedCup',
] as const;

type OutletGardenPotName = (typeof outletGardenPotNames)[number];

export const outletGardenRegisteredBlockNames = [
    'Block_Grass',
    'Fence',
    'MulchWood',
    'WoodenBench',
    ...outletGardenPotNames,
] as const;

export function outletOfferBlockId(offerId: number) {
    return `${outletOfferBlockIdPrefix}${offerId.toString()}`;
}

export function outletOfferIdFromBlockId(blockId: string) {
    if (!blockId.startsWith(outletOfferBlockIdPrefix)) {
        return null;
    }

    const rawOfferId = blockId.slice(outletOfferBlockIdPrefix.length);
    if (!/^[1-9]\d*$/u.test(rawOfferId)) {
        return null;
    }

    const offerId = Number(rawOfferId);
    return Number.isSafeInteger(offerId) ? offerId : null;
}

function compareOutletGardenOffers(
    left: OutletGardenLayoutOffer,
    right: OutletGardenLayoutOffer,
) {
    const leftPlantId = left.plantId ?? Number.MAX_SAFE_INTEGER;
    const rightPlantId = right.plantId ?? Number.MAX_SAFE_INTEGER;

    return (
        leftPlantId - rightPlantId ||
        left.plantSortId - right.plantSortId ||
        left.id - right.id
    );
}

function outletGardenPlantKey(offer: OutletGardenLayoutOffer) {
    return offer.plantId === null
        ? 'plant:unknown'
        : `plant:${offer.plantId.toString()}`;
}

function outletGardenPlantBay(slotIndex: number) {
    return Math.floor(slotIndex / outletGardenOffersPerPlantBay);
}

/**
 * Keeps every allocated slot, including removed-offer tombstones. Initial
 * offers receive plant-grouped bays; later offers fill a never-used slot in an
 * existing plant bay when possible, otherwise they get a new bay. Existing
 * displays therefore never move during the mounted session.
 */
export function reconcileOutletGardenSlots(
    previousAssignments: OutletGardenSlotAssignments,
    offers: readonly OutletGardenLayoutOffer[],
) {
    const offersById = new Map<number, OutletGardenLayoutOffer>();
    for (const offer of offers) {
        if (!offersById.has(offer.id)) {
            offersById.set(offer.id, offer);
        }
    }

    const unseenOffers = Array.from(offersById.values())
        .filter((offer) => !previousAssignments.has(offer.id))
        .sort(compareOutletGardenOffers);
    if (unseenOffers.length === 0) {
        return previousAssignments;
    }

    const assignments = new Map(previousAssignments);
    const usedSlots = new Set(
        Array.from(assignments.values(), (assignment) => assignment.slotIndex),
    );
    const existingPlantBays = new Map<string, Set<number>>();

    for (const assignment of assignments.values()) {
        const { plantKey, slotIndex } = assignment;
        const plantBays = existingPlantBays.get(plantKey) ?? new Set<number>();
        plantBays.add(outletGardenPlantBay(slotIndex));
        existingPlantBays.set(plantKey, plantBays);
    }

    let nextPlantBay =
        Math.max(
            -1,
            ...Array.from(assignments.values(), (assignment) =>
                outletGardenPlantBay(assignment.slotIndex),
            ),
        ) + 1;
    const unseenOffersByPlant = new Map<string, OutletGardenLayoutOffer[]>();
    for (const offer of unseenOffers) {
        const plantKey = outletGardenPlantKey(offer);
        const plantOffers = unseenOffersByPlant.get(plantKey) ?? [];
        plantOffers.push(offer);
        unseenOffersByPlant.set(plantKey, plantOffers);
    }

    for (const [plantKey, plantOffers] of unseenOffersByPlant) {
        const availableSlots = Array.from(existingPlantBays.get(plantKey) ?? [])
            .sort((left, right) => left - right)
            .flatMap((plantBay) =>
                Array.from(
                    { length: outletGardenOffersPerPlantBay },
                    (_, offset) =>
                        plantBay * outletGardenOffersPerPlantBay + offset,
                ),
            )
            .filter((slotIndex) => !usedSlots.has(slotIndex));

        for (const offer of plantOffers) {
            let slotIndex = availableSlots.shift();
            if (slotIndex === undefined) {
                slotIndex = nextPlantBay * outletGardenOffersPerPlantBay;
                nextPlantBay += 1;
                for (
                    let offset = 1;
                    offset < outletGardenOffersPerPlantBay;
                    offset += 1
                ) {
                    availableSlots.push(slotIndex + offset);
                }
            }

            assignments.set(offer.id, { plantKey, slotIndex });
            usedSlots.add(slotIndex);
        }
    }

    return assignments;
}

function outletGardenPotName(plantSortId: number): OutletGardenPotName {
    const potIndex = Math.abs(plantSortId) % outletGardenPotNames.length;
    return outletGardenPotNames[potIndex] ?? outletGardenPotNames[0];
}

export function getOutletGardenOfferPlacement(
    slotIndex: number,
): OutletGardenOfferPlacement {
    const plantBay = outletGardenPlantBay(slotIndex);
    const aisleRow = Math.floor(plantBay / outletGardenPlantBaysPerAisleRow);
    const side = plantBay % outletGardenPlantBaysPerAisleRow === 0 ? -1 : 1;
    const slotInPlantBay = slotIndex % outletGardenOffersPerPlantBay;
    const y =
        aisleRow * outletGardenAisleRowSpacing + Math.floor(slotInPlantBay / 2);
    const startsOnTable = side < 0;
    const surface =
        (slotInPlantBay % 2 === 0) === startsOnTable ? 'table' : 'floor';
    const distance =
        surface === 'table'
            ? outletGardenTableDistance
            : outletGardenFloorDistance;

    return {
        aisleRow,
        plantBay,
        surface,
        x: side * distance,
        y,
    };
}

function stackKey(x: number, y: number) {
    return `${x.toString()}|${y.toString()}`;
}

function addBlock(
    stacksByPosition: Map<string, PublicGardenStack>,
    x: number,
    y: number,
    block: PublicGardenStack['blocks'][number],
) {
    const key = stackKey(x, y);
    const stack = stacksByPosition.get(key);
    if (stack) {
        stack.blocks.push(block);
        return;
    }

    stacksByPosition.set(key, { x, y, blocks: [block] });
}

function compareStacks(left: PublicGardenStack, right: PublicGardenStack) {
    return left.y - right.y || left.x - right.x;
}

function outletGardenBounds(assignments: OutletGardenSlotAssignments) {
    const highestPlantBay = Math.max(
        -1,
        ...Array.from(assignments.values(), (assignment) =>
            outletGardenPlantBay(assignment.slotIndex),
        ),
    );
    const aisleRowCount = Math.max(
        1,
        Math.ceil((highestPlantBay + 1) / outletGardenPlantBaysPerAisleRow),
    );
    const lastDisplayY = (aisleRowCount - 1) * outletGardenAisleRowSpacing + 1;

    return {
        maxX: outletGardenFloorDistance + outletGardenSideMargin,
        maxY: lastDisplayY + outletGardenBackMargin,
        minX: -outletGardenFloorDistance - outletGardenSideMargin,
        minY: -outletGardenFrontMargin,
    };
}

export function buildOutletGardenStacks(
    offers: readonly OutletGardenLayoutOffer[],
    assignments: OutletGardenSlotAssignments,
) {
    const { maxX, maxY, minX, minY } = outletGardenBounds(assignments);
    const stacksByPosition = new Map<string, PublicGardenStack>();

    for (let y = minY; y <= maxY; y += 1) {
        for (let x = minX; x <= maxX; x += 1) {
            addBlock(stacksByPosition, x, y, {
                id: `outlet-ground:${x.toString()}:${y.toString()}`,
                name: 'Block_Grass',
                rotation: 0,
            });

            if (y < maxY && Math.abs(x) <= outletGardenPathHalfWidth) {
                addBlock(stacksByPosition, x, y, {
                    id: `outlet-path:${x.toString()}:${y.toString()}`,
                    name: 'MulchWood',
                    rotation: 0,
                });
            }

            const atBoundary =
                x === minX || x === maxX || y === minY || y === maxY;
            const atFrontOpening =
                y === minY && Math.abs(x) <= outletGardenPathHalfWidth;
            if (atBoundary && !atFrontOpening) {
                addBlock(stacksByPosition, x, y, {
                    id: `outlet-fence:${x.toString()}:${y.toString()}`,
                    name: 'Fence',
                    rotation: 0,
                });
            }
        }
    }

    const assignedPlantBays = Array.from(
        new Set(
            Array.from(assignments.values(), (assignment) =>
                outletGardenPlantBay(assignment.slotIndex),
            ),
        ),
    ).sort((left, right) => left - right);
    for (const plantBay of assignedPlantBays) {
        const aisleRow = Math.floor(
            plantBay / outletGardenPlantBaysPerAisleRow,
        );
        const side = plantBay % outletGardenPlantBaysPerAisleRow === 0 ? -1 : 1;
        const tableX = side * outletGardenTableDistance;
        const tableStartY = aisleRow * outletGardenAisleRowSpacing;

        for (let offset = 0; offset < 2; offset += 1) {
            addBlock(stacksByPosition, tableX, tableStartY + offset, {
                id: `outlet-table:${plantBay.toString()}:${offset.toString()}`,
                name: 'WoodenBench',
                rotation: 1,
            });
        }
    }

    const offersById = new Map(offers.map((offer) => [offer.id, offer]));
    const placedOffers = Array.from(offersById.values())
        .map((offer) => ({
            assignment: assignments.get(offer.id),
            offer,
        }))
        .filter(
            (
                entry,
            ): entry is {
                assignment: OutletGardenSlotAssignment;
                offer: OutletGardenLayoutOffer;
            } => entry.assignment !== undefined,
        )
        .sort(
            (left, right) =>
                left.assignment.slotIndex - right.assignment.slotIndex ||
                left.offer.id - right.offer.id,
        );

    for (const { assignment, offer } of placedOffers) {
        const position = getOutletGardenOfferPlacement(assignment.slotIndex);
        addBlock(stacksByPosition, position.x, position.y, {
            id: outletOfferBlockId(offer.id),
            name: outletGardenPotName(offer.plantSortId),
            rotation: offer.plantSortId % 4,
        });
    }

    return Array.from(stacksByPosition.values()).sort(compareStacks);
}

function outletGardenResponseStacks(stacks: readonly PublicGardenStack[]) {
    const responseStacks: PublicGardenDetail['stacks'] = {};

    for (const stack of stacks) {
        const x = stack.x.toString();
        const y = stack.y.toString();
        const row = responseStacks[x] ?? {};
        row[y] = stack.blocks;
        responseStacks[x] = row;
    }

    return responseStacks;
}

export function buildOutletGardenDetail(
    offers: readonly OutletGardenLayoutOffer[],
    assignments: OutletGardenSlotAssignments,
) {
    return {
        backgroundPalette: 'default',
        farmId: outletGardenVirtualId,
        homeCamera: null,
        id: outletGardenVirtualId,
        isPublic: true,
        isSandbox: false,
        latitude: 45.815,
        longitude: 15.982,
        name: 'Outlet vrt',
        raisedBeds: [],
        stacks: outletGardenResponseStacks(
            buildOutletGardenStacks(offers, assignments),
        ),
        updatedAt: outletGardenUpdatedAt,
    } satisfies PublicGardenDetail;
}
