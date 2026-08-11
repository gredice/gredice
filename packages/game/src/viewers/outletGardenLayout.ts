import type {
    PublicGardenDetail,
    PublicGardenStack,
} from './PublicGardenViewer';

export type OutletGardenLayoutOffer = {
    id: number;
    plantId: number | null;
    plantSortId: number;
    remainingQuantity: number;
};

export type OutletGardenSlotAssignment = {
    offerId: number;
    plantKey: string;
    slotIndex: number;
    unitIndex: number;
};

export type OutletGardenSlotAssignments = ReadonlyMap<
    string,
    OutletGardenSlotAssignment
>;

export type OutletGardenDisplayUnit = OutletGardenLayoutOffer & {
    blockId: string;
    unitIndex: number;
};

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
const outletGardenFloorDistance = 2;
const outletGardenPathHalfWidth = 0;
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
    'OutletDisplayTable',
    ...outletGardenPotNames,
] as const;

export function outletOfferBlockId(offerId: number, unitIndex = 0) {
    const suffix = unitIndex === 0 ? '' : `:${unitIndex.toString()}`;
    return `${outletOfferBlockIdPrefix}${offerId.toString()}${suffix}`;
}

export function outletOfferDisplayFromBlockId(blockId: string) {
    if (!blockId.startsWith(outletOfferBlockIdPrefix)) {
        return null;
    }

    const encodedDisplay = blockId.slice(outletOfferBlockIdPrefix.length);
    const match = /^([1-9]\d*)(?::([1-9]\d*))?$/u.exec(encodedDisplay);
    if (!match) {
        return null;
    }

    const offerId = Number(match[1]);
    const unitIndex = match[2] ? Number(match[2]) : 0;
    if (
        !Number.isSafeInteger(offerId) ||
        !Number.isSafeInteger(unitIndex) ||
        unitIndex < 0
    ) {
        return null;
    }

    return { offerId, unitIndex };
}

export function outletOfferIdFromBlockId(blockId: string) {
    return outletOfferDisplayFromBlockId(blockId)?.offerId ?? null;
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

export function getOutletGardenDisplayUnits(
    offers: readonly OutletGardenLayoutOffer[],
) {
    const offersById = new Map<number, OutletGardenLayoutOffer>();
    for (const offer of offers) {
        if (!offersById.has(offer.id)) {
            offersById.set(offer.id, offer);
        }
    }

    return Array.from(offersById.values())
        .sort(compareOutletGardenOffers)
        .flatMap((offer) => {
            const remainingQuantity = Number.isSafeInteger(
                offer.remainingQuantity,
            )
                ? Math.max(0, offer.remainingQuantity)
                : 0;

            return Array.from(
                { length: remainingQuantity },
                (_, unitIndex) => ({
                    ...offer,
                    blockId: outletOfferBlockId(offer.id, unitIndex),
                    unitIndex,
                }),
            );
        });
}

function outletGardenPlantBay(slotIndex: number) {
    return Math.floor(slotIndex / outletGardenOffersPerPlantBay);
}

/**
 * Keeps every allocated seedling slot, including stock tombstones. Initial
 * units receive plant-grouped bays with all tabletops filled before floor
 * positions. Later stock fills never-used room in an owned plant bay or a new
 * bay. Existing displays therefore never move during the mounted session.
 */
export function reconcileOutletGardenSlots(
    previousAssignments: OutletGardenSlotAssignments,
    offers: readonly OutletGardenLayoutOffer[],
) {
    const unseenDisplays = getOutletGardenDisplayUnits(offers).filter(
        (display) => !previousAssignments.has(display.blockId),
    );
    if (unseenDisplays.length === 0) {
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
    const unseenDisplaysByPlant = new Map<string, OutletGardenDisplayUnit[]>();
    for (const display of unseenDisplays) {
        const plantKey = outletGardenPlantKey(display);
        const plantDisplays = unseenDisplaysByPlant.get(plantKey) ?? [];
        plantDisplays.push(display);
        unseenDisplaysByPlant.set(plantKey, plantDisplays);
    }

    for (const [plantKey, plantDisplays] of unseenDisplaysByPlant) {
        const plantBays = Array.from(
            existingPlantBays.get(plantKey) ?? [],
        ).sort((left, right) => left - right);
        const availableExistingSlotCount = plantBays
            .flatMap((plantBay) =>
                Array.from(
                    { length: outletGardenOffersPerPlantBay },
                    (_, offset) =>
                        plantBay * outletGardenOffersPerPlantBay + offset,
                ),
            )
            .filter((slotIndex) => !usedSlots.has(slotIndex)).length;
        const newPlantBayCount = Math.ceil(
            Math.max(0, plantDisplays.length - availableExistingSlotCount) /
                outletGardenOffersPerPlantBay,
        );
        for (let index = 0; index < newPlantBayCount; index += 1) {
            plantBays.push(nextPlantBay);
            nextPlantBay += 1;
        }

        const availableSlots = plantBays
            .flatMap((plantBay) =>
                Array.from(
                    { length: outletGardenOffersPerPlantBay },
                    (_, offset) =>
                        plantBay * outletGardenOffersPerPlantBay + offset,
                ),
            )
            .filter((slotIndex) => !usedSlots.has(slotIndex))
            .sort((left, right) => {
                const leftOffset = left % outletGardenOffersPerPlantBay;
                const rightOffset = right % outletGardenOffersPerPlantBay;
                const leftSurface = leftOffset < 2 ? 0 : 1;
                const rightSurface = rightOffset < 2 ? 0 : 1;
                return (
                    leftSurface - rightSurface ||
                    outletGardenPlantBay(left) - outletGardenPlantBay(right) ||
                    leftOffset - rightOffset
                );
            });

        for (const display of plantDisplays) {
            const slotIndex = availableSlots.shift();
            if (slotIndex === undefined) {
                continue;
            }

            assignments.set(display.blockId, {
                offerId: display.id,
                plantKey,
                slotIndex,
                unitIndex: display.unitIndex,
            });
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
    const y = aisleRow * outletGardenAisleRowSpacing + (slotInPlantBay % 2);
    const surface = slotInPlantBay < 2 ? 'table' : 'floor';
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

    const displayDistance = Math.max(
        outletGardenFloorDistance,
        outletGardenTableDistance,
    );

    return {
        maxX: displayDistance + outletGardenSideMargin,
        maxY: lastDisplayY + outletGardenBackMargin,
        minX: -displayDistance - outletGardenSideMargin,
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
                name: 'OutletDisplayTable',
                rotation: 1,
            });
        }
    }

    const placedDisplays = getOutletGardenDisplayUnits(offers)
        .map((display) => ({
            assignment: assignments.get(display.blockId),
            display,
        }))
        .filter(
            (
                entry,
            ): entry is {
                assignment: OutletGardenSlotAssignment;
                display: OutletGardenDisplayUnit;
            } => entry.assignment !== undefined,
        )
        .sort(
            (left, right) =>
                left.assignment.slotIndex - right.assignment.slotIndex ||
                left.display.id - right.display.id ||
                left.display.unitIndex - right.display.unitIndex,
        );

    for (const { assignment, display } of placedDisplays) {
        const position = getOutletGardenOfferPlacement(assignment.slotIndex);
        const rotation =
            position.surface === 'floor'
                ? position.x < 0
                    ? 1
                    : 3
                : ((display.plantSortId % 4) + 4) % 4;
        addBlock(stacksByPosition, position.x, position.y, {
            id: display.blockId,
            name: outletGardenPotName(display.plantSortId),
            rotation,
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
