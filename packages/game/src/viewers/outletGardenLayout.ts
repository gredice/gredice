import type {
    PublicGardenDetail,
    PublicGardenStack,
} from './PublicGardenViewer';

export type OutletGardenLayoutOffer = {
    id: number;
};

export type OutletGardenSlotAssignments = ReadonlyMap<number, number>;

const outletOfferBlockIdPrefix = 'outlet-offer:';
const outletGardenColumns = 3;
const outletGardenDisplaySpacing = 2;
const outletGardenMinimumRows = 1;
const outletGardenSideMargin = 2;
const outletGardenFrontMargin = 2;
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
    'Shade',
    'Stool',
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

/**
 * Retains every previously allocated slot, including slots for offers that
 * disappeared. New offers are appended in numeric ID order, so a refetch can
 * never compact or reorder the outlet displays during the mounted session.
 */
export function reconcileOutletGardenSlots(
    previousAssignments: OutletGardenSlotAssignments,
    offers: readonly OutletGardenLayoutOffer[],
) {
    const unseenOfferIds = Array.from(
        new Set(
            offers
                .map((offer) => offer.id)
                .filter((offerId) => !previousAssignments.has(offerId)),
        ),
    ).sort((left, right) => left - right);
    if (unseenOfferIds.length === 0) {
        return previousAssignments;
    }

    const assignments = new Map(previousAssignments);
    const nextSlot = Math.max(-1, ...Array.from(assignments.values())) + 1;

    unseenOfferIds.forEach((offerId, index) => {
        assignments.set(offerId, nextSlot + index);
    });

    return assignments;
}

function outletGardenPotName(offerId: number): OutletGardenPotName {
    const potIndex = Math.abs(offerId) % outletGardenPotNames.length;
    return outletGardenPotNames[potIndex] ?? outletGardenPotNames[0];
}

function outletGardenDisplayPosition(slotIndex: number) {
    const column = slotIndex % outletGardenColumns;
    const row = Math.floor(slotIndex / outletGardenColumns);

    return {
        x:
            (column - Math.floor(outletGardenColumns / 2)) *
            outletGardenDisplaySpacing,
        y: row * outletGardenDisplaySpacing,
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

export function buildOutletGardenStacks(
    offers: readonly OutletGardenLayoutOffer[],
    assignments: OutletGardenSlotAssignments,
) {
    const highestAssignedSlot = Math.max(
        -1,
        ...Array.from(assignments.values()),
    );
    const rowCount = Math.max(
        outletGardenMinimumRows,
        Math.ceil((highestAssignedSlot + 1) / outletGardenColumns),
    );
    const displayHalfWidth =
        Math.floor(outletGardenColumns / 2) * outletGardenDisplaySpacing;
    const minX = -displayHalfWidth - outletGardenSideMargin;
    const maxX = displayHalfWidth + outletGardenSideMargin;
    const minY = -outletGardenFrontMargin;
    const maxY =
        (rowCount - 1) * outletGardenDisplaySpacing + outletGardenBackMargin;
    const shadeY = maxY - 1;
    const stacksByPosition = new Map<string, PublicGardenStack>();

    for (let y = minY; y <= maxY; y += 1) {
        for (let x = minX; x <= maxX; x += 1) {
            addBlock(stacksByPosition, x, y, {
                id: `outlet-ground:${x.toString()}:${y.toString()}`,
                name: 'Block_Grass',
                rotation: 0,
            });

            const atBoundary =
                x === minX || x === maxX || y === minY || y === maxY;
            const atFrontOpening =
                y === minY && Math.abs(x) <= outletGardenDisplaySpacing / 2;
            if (atBoundary && !atFrontOpening) {
                addBlock(stacksByPosition, x, y, {
                    id: `outlet-fence:${x.toString()}:${y.toString()}`,
                    name: 'Fence',
                    rotation: 0,
                });
            }
        }
    }

    for (let x = -displayHalfWidth; x <= displayHalfWidth; x += 1) {
        addBlock(stacksByPosition, x, shadeY, {
            id: `outlet-shade:${x.toString()}:${shadeY.toString()}`,
            name: 'Shade',
            rotation: 0,
        });
    }

    const offersById = new Map(offers.map((offer) => [offer.id, offer]));
    const placedOffers = Array.from(offersById.values())
        .map((offer) => ({
            offer,
            slotIndex: assignments.get(offer.id),
        }))
        .filter(
            (
                entry,
            ): entry is {
                offer: OutletGardenLayoutOffer;
                slotIndex: number;
            } => typeof entry.slotIndex === 'number',
        )
        .sort(
            (left, right) =>
                left.slotIndex - right.slotIndex ||
                left.offer.id - right.offer.id,
        );

    for (const { offer, slotIndex } of placedOffers) {
        const position = outletGardenDisplayPosition(slotIndex);
        addBlock(stacksByPosition, position.x, position.y, {
            id: `outlet-stool:${offer.id.toString()}`,
            name: 'Stool',
            rotation: offer.id % 4,
        });
        addBlock(stacksByPosition, position.x, position.y, {
            id: outletOfferBlockId(offer.id),
            name: outletGardenPotName(offer.id),
            rotation: offer.id % 4,
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
