import type { BlockData, PlantSortData } from '@gredice/directory-types';
import {
    type AdventAward,
    AdventCalendarDayAlreadyOpenedError,
    type AdventCalendarOpenPayload,
    createAdventCalendarOpenEvent,
    createGardenBlock,
    createGardenStack,
    earnSunflowers,
    getAccountGardens,
    getAdventCalendarOpenEvents,
    getEntitiesFormatted,
    getGardenStacks,
    type SelectGardenStack,
    updateGardenStack,
} from '@gredice/storage';

const ADVENT_YEAR = 2025;
const ADVENT_TOTAL_DAYS = 24;
export const ADVENT_CALENDAR_2025_ID = 'calendar-2025';

const CHRISTMAS_TREE_BLOCK_NAME = 'PineAdvent';
const DECORATION_BLOCK_IDS = [
    'ukras-advent-vijenac',
    'ukras-snijeg-lampice',
    'ukras-advent-zvijezda',
];

export type AdventDayStatus = {
    dan: number;
    otvoren: boolean;
    otvorenoAt?: string;
    otvorio?: string;
    nagrade?: AdventAward[];
    opisNagrada?: AdventAwardDescription[];
};

export type AdventAwardDescription = {
    naslov: string;
    opis: string;
};

const ADVENT_DESCRIPTION =
    '24 dana darivanja: svaki dan u prosincu otvori novi prozorčić i osvoji nagradu.';

function describeAward(award: AdventAward): AdventAwardDescription {
    switch (award.kind) {
        case 'sunflowers':
            return {
                naslov: `${award.amount} suncokreta`,
                opis: 'Suncokreta na tvom računu.',
            };
        case 'plant':
            return {
                naslov: award.title ?? 'Nova biljka',
                opis: 'Biljka samo za tebe.',
            };
        case 'decoration':
            return {
                naslov: award.title ?? 'Blagdanska dekoracija',
                opis: 'Ukras koji će uljepšati tvoj vrt u blagdansko vrijeme.',
            };
        case 'tree-decoration':
            return {
                naslov: award.title ?? `Ukras za drvce (dan ${award.day})`,
                opis: 'Ukras koji će uljepšati tvoje božićno drvce.',
            };
        case 'gift':
            if (award.gift === 'christmas-tree') {
                return {
                    naslov: 'Božićno drvce',
                    opis: 'Posebno drvce za tvoj prvi dan adventskog kalendara.',
                };
            }
            return {
                naslov: 'Adventski box',
                opis:
                    award.delivery === 'digital+physical'
                        ? 'Fizički poklon box jer su otvoreni svi dani kalendara.'
                        : 'Nagrade za posljednji dan adventa.',
            };
    }
}

function rollSunflowerAward(): AdventAward | null {
    const sunflowerChance = Math.random();
    if (sunflowerChance >= 0.1) {
        return null;
    }

    const premiumChance = Math.random();
    const amount = premiumChance < 0.1 ? 5000 : 500;
    return { kind: 'sunflowers', amount };
}

async function pickPlantAward(): Promise<AdventAward> {
    const plantSorts = await getEntitiesFormatted<PlantSortData>('plantSort');
    if (!plantSorts?.length) {
        throw new Error('No plant sorts available to pick from.');
    }

    // Pick a random plant sort
    const randomIndex = Math.floor(Math.random() * plantSorts.length);
    const plantSort = plantSorts[randomIndex];
    const title = (plantSort as { name?: string }).name;
    if (!title) {
        throw new Error('Selected plant sort has no name.');
    }

    return {
        kind: 'plant' as const,
        plantSortId: Number(
            (plantSort as { id?: number | string }).id ?? randomIndex + 1,
        ),
        title,
    };
}

function pickDecorationAward(title?: string, blockId?: string): AdventAward {
    const resolvedBlockId =
        blockId ??
        DECORATION_BLOCK_IDS[
            Math.floor(Math.random() * DECORATION_BLOCK_IDS.length)
        ];
    return {
        kind: 'decoration',
        blockId: resolvedBlockId,
        title: title ?? 'Blagdanska dekoracija',
    };
}

function pickTreeDecorationAward(day: number): AdventAward {
    return {
        kind: 'tree-decoration',
        day,
        title: `Ukras za drvce #${day}`,
    };
}

async function pickAwardsForDay(
    day: number,
    hasFullAttendance: boolean,
): Promise<AdventAward[]> {
    const awards: AdventAward[] = [];

    // Every day gets a tree decoration
    awards.push(pickTreeDecorationAward(day));

    // Day 1: Christmas tree as a gift
    if (day === 1) {
        awards.push({
            kind: 'gift',
            gift: 'christmas-tree',
            delivery: 'digital',
        } as const satisfies AdventAward);
        return awards;
    }

    // Last day: Advent box
    if (day === ADVENT_TOTAL_DAYS) {
        awards.push({
            kind: 'gift',
            gift: 'advent-box',
            delivery: hasFullAttendance ? 'digital+physical' : 'digital',
        } as const satisfies AdventAward);
        return awards;
    }

    // Every 5th day: Plant award
    if (day % 5 === 0) {
        awards.push(await pickPlantAward());
        return awards;
    }

    // Try to roll sunflower award
    const sunflowerAward = rollSunflowerAward();
    if (sunflowerAward) {
        awards.push(sunflowerAward);
        return awards;
    }

    // Default: Random decoration
    awards.push(pickDecorationAward());
    return awards;
}

export function getAdventOccasionOverview() {
    return {
        id: 'advent',
        naziv: 'Advent',
        godina: ADVENT_YEAR,
        opis: ADVENT_DESCRIPTION,
        kalendari: [
            {
                id: ADVENT_CALENDAR_2025_ID,
                naziv: 'Adventski kalendar 2025',
                putanja: `/api/occasions/advent/${ADVENT_CALENDAR_2025_ID}`,
            },
        ],
    };
}

export async function getAdventCalendar2025Status(accountId: string) {
    const events = await getAdventCalendarOpenEvents(accountId, ADVENT_YEAR);
    const opened = new Map<
        number,
        AdventCalendarOpenPayload & { createdAt: string }
    >();
    for (const event of events) {
        opened.set(event.data.day, {
            ...event.data,
            createdAt: event.createdAt.toISOString(),
        });
    }

    const dani: AdventDayStatus[] = [];
    for (let day = 1; day <= ADVENT_TOTAL_DAYS; day++) {
        const existing = opened.get(day);
        const awards =
            existing?.awards ??
            (existing?.award ? [existing.award] : undefined);
        dani.push({
            dan: day,
            otvoren: Boolean(existing),
            otvorenoAt: existing?.createdAt,
            otvorio: existing?.openedBy,
            nagrade: awards,
            opisNagrada: awards?.map(describeAward),
        });
    }

    const brojOtvorenih = opened.size;
    const sljedeciDan = dani.find((day) => !day.otvoren)?.dan ?? null;

    return {
        kalendarId: ADVENT_CALENDAR_2025_ID,
        godina: ADVENT_YEAR,
        brojDana: ADVENT_TOTAL_DAYS,
        brojOtvorenih,
        preostalo: ADVENT_TOTAL_DAYS - brojOtvorenih,
        sljedeciDan,
        opis: ADVENT_DESCRIPTION,
        dani,
    };
}

/**
 * Get the position in a spiral pattern starting from origin (0, 0)
 * @see https://stackoverflow.com/a/19287714/563228
 */
function spiral(step: number): { x: number; y: number } {
    if (step === 0) return { x: 0, y: 0 };

    const r = Math.floor((Math.sqrt(step + 1) - 1) / 2) + 1;
    const p = (8 * r * (r - 1)) / 2;
    const en = r * 2;
    const a = (1 + step - p) % (r * 8);

    let x = 0;
    let y = 0;
    switch (Math.floor(a / (r * 2))) {
        case 0:
            x = a - r;
            y = -r;
            break;
        case 1:
            x = r;
            y = (a % en) - r;
            break;
        case 2:
            x = r - (a % en);
            y = r;
            break;
        case 3:
            x = -r;
            y = r - (a % en);
            break;
    }

    return { x, y };
}

/**
 * Check if a position is valid for placing a block
 * A position is valid if:
 * - No stack exists at position (empty spot)
 * - Stack exists but has no blocks (empty stack)
 * - Stack exists and the top block is stackable
 */
function isValidPosition(
    blockData: BlockData[],
    stacks: SelectGardenStack[],
    position: { x: number; y: number },
): boolean {
    const stack = stacks.find(
        (s) => s.positionX === position.x && s.positionY === position.y,
    );

    // No stack at position - valid
    if (!stack) return true;

    // Stack has no blocks - valid
    if (!stack.blocks || stack.blocks.length === 0) return true;

    // Check if the top block is stackable
    const topBlockName = stack.blocks.at(-1);
    if (!topBlockName) return true;

    const topBlockData = blockData.find(
        (data) => data.information?.name === topBlockName,
    );

    // If we can't find block data, assume not stackable for safety
    if (!topBlockData) return false;

    return topBlockData.attributes?.stackable ?? false;
}

/**
 * Find the first available position for placing a block using spiral search
 */
function findAvailablePosition(
    blockData: BlockData[],
    stacks: SelectGardenStack[],
): { x: number; y: number } {
    let step = 0;
    const maxSteps = 1000; // Safety limit

    while (step < maxSteps) {
        const position = spiral(step);
        if (isValidPosition(blockData, stacks, position)) {
            return position;
        }
        step++;
    }

    // Fallback to origin if no position found (shouldn't happen)
    return { x: 0, y: 0 };
}

export async function openAdventCalendar2025Day({
    accountId,
    userId,
    day,
}: {
    accountId: string;
    userId: string;
    day: number;
}) {
    // Get the user's garden for block placement
    const gardens = await getAccountGardens(accountId);
    const primaryGarden = gardens[0];

    // Track the awards for the response
    let resolvedAwards: AdventAward[] = [];
    // Track if this is the user's first advent day this year
    let isFirstDayOpened = false;

    const result = await createAdventCalendarOpenEvent({
        accountId,
        // Use a factory function to determine awards based on opened count
        payload: async (openedDaysCount) => {
            isFirstDayOpened = openedDaysCount === 0;
            const hasFullAttendance =
                day === ADVENT_TOTAL_DAYS &&
                openedDaysCount === ADVENT_TOTAL_DAYS - 1;

            resolvedAwards = await pickAwardsForDay(day, hasFullAttendance);

            return {
                year: ADVENT_YEAR,
                day,
                openedBy: userId,
                awards: resolvedAwards,
            };
        },
        onSuccess: async (tx, payload) => {
            const awards = payload.awards;

            // Process all sunflower awards within the transaction
            for (const award of awards) {
                if (award.kind === 'sunflowers') {
                    await earnSunflowers(
                        accountId,
                        award.amount,
                        `advent-${ADVENT_YEAR}-dan-${day}`,
                        tx,
                    );
                }
            }

            // Place block decorations in the user's garden
            if (primaryGarden) {
                // Get block data for checking stackable property
                const blockData =
                    (await getEntitiesFormatted<BlockData>('block')) ?? [];

                // Helper to place a block at the first available position
                const placeBlockAtAvailablePosition = async (
                    blockId: string,
                ) => {
                    // Refresh stacks to get current state
                    const stacks = await getGardenStacks(primaryGarden.id);
                    const position = findAvailablePosition(blockData, stacks);

                    const existingStack = stacks.find(
                        (s) =>
                            s.positionX === position.x &&
                            s.positionY === position.y,
                    );

                    if (!existingStack) {
                        // Create stack at position if it doesn't exist
                        await createGardenStack(
                            primaryGarden.id,
                            { x: position.x, y: position.y },
                            tx,
                        );
                        await updateGardenStack(
                            primaryGarden.id,
                            { x: position.x, y: position.y, blocks: [blockId] },
                            tx,
                        );
                    } else {
                        // Add block to existing stack
                        await updateGardenStack(
                            primaryGarden.id,
                            {
                                x: position.x,
                                y: position.y,
                                blocks: [...existingStack.blocks, blockId],
                            },
                            tx,
                        );
                    }
                };

                // Place Christmas tree (advent pine) on first day opened
                if (isFirstDayOpened) {
                    const blockId = await createGardenBlock(
                        primaryGarden.id,
                        CHRISTMAS_TREE_BLOCK_NAME,
                        tx,
                    );
                    await placeBlockAtAvailablePosition(blockId);
                }

                for (const award of awards) {
                    if (award.kind === 'decoration') {
                        const blockId = await createGardenBlock(
                            primaryGarden.id,
                            award.blockId,
                            tx,
                        );
                        await placeBlockAtAvailablePosition(blockId);
                    }
                }
            }
        },
    });

    return {
        payload: result.payload,
        opisNagrada: resolvedAwards.map(describeAward),
    };
}

export {
    ADVENT_DESCRIPTION,
    ADVENT_TOTAL_DAYS,
    ADVENT_YEAR,
    AdventCalendarDayAlreadyOpenedError,
};
