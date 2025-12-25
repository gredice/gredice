import { TZDate, tz } from '@date-fns/tz';
import type { BlockData, PlantSortData } from '@gredice/directory-types';
import {
    type AdventAward,
    AdventCalendarDayAlreadyOpenedError,
    type AdventCalendarOpenPayload,
    addInventoryItem,
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

export class AdventCalendarDayNotYetAvailableError extends Error {
    constructor(
        public readonly day: number,
        public readonly availableAt: Date,
    ) {
        super(
            `Day ${day} is not yet available. Available at ${availableAt.toISOString()}`,
        );
        this.name = 'AdventCalendarDayNotYetAvailableError';
    }
}

/**
 * Calculate when a specific advent day becomes available for a user.
 * Uses the user's timezone to determine when midnight of that day occurs.
 * @param day - The advent day (1-24)
 * @param timeZone - The user's IANA timezone (e.g., 'Europe/Paris')
 */
function getAdventDayAvailableAt(day: number, timeZone: string): Date {
    // Advent day 1 = December 1st, day 2 = December 2nd, etc.
    // Create date at midnight on December `day` directly in the user's timezone
    return new TZDate(ADVENT_YEAR, 11, day, 0, 0, 0, 0, timeZone);
}

/**
 * Get the current advent day based on the user's timezone.
 * This determines which day is "today" in the user's local time.
 * @param timeZone - The user's IANA timezone (e.g., 'Europe/Paris')
 * @param now - Optional date to use instead of current time (for testing)
 */
function getCurrentAdventDay(timeZone: string, now: Date = new Date()): number {
    // Convert current time to user's timezone
    const userTz = tz(timeZone);
    const userLocalTime = userTz(now);

    // Get day of month and month in user's timezone
    const dayOfMonth = userLocalTime.getDate();
    const month = userLocalTime.getMonth(); // 0-indexed, so December = 11

    // Only return valid advent days (1-24 in December)
    if (month === 11 && dayOfMonth >= 1 && dayOfMonth <= ADVENT_TOTAL_DAYS) {
        return dayOfMonth;
    }
    // Before December 1st or after December 24th
    return 0;
}

/**
 * Check if a specific advent day is currently available to open.
 * A day is only available if it's the current day in the user's timezone.
 * @param day - The advent day to check (1-24)
 * @param timeZone - The user's IANA timezone (e.g., 'Europe/Paris')
 * @param now - Optional date to use instead of current time (for testing)
 */
function isAdventDayAvailable(
    day: number,
    timeZone: string,
    now: Date = new Date(),
): boolean {
    const availableAt = getAdventDayAvailableAt(day, timeZone);

    // Check if the day has started (in user's timezone)
    if (now < availableAt) {
        return false;
    }

    // Check if it's still the current day (in user's timezone)
    const currentDay = getCurrentAdventDay(timeZone, now);
    return day === currentDay;
}

export function getAdventSeasonEndAt(timeZone: string): Date {
    return new TZDate(
        ADVENT_YEAR,
        11,
        ADVENT_TOTAL_DAYS + 1,
        0,
        0,
        0,
        0,
        timeZone,
    );
}

export function isAdventSeasonOver(
    timeZone: string,
    now: Date = new Date(),
): boolean {
    const userNow = tz(timeZone)(now);
    return userNow >= getAdventSeasonEndAt(timeZone);
}

const CHRISTMAS_TREE_BLOCK_NAME = 'PineAdvent';
const DECORATION_BLOCK_IDS = [
    'GiftBox_RedWhite',
    'GiftBox_GreenGold',
    'GiftBox_BlueWhite',
    'GiftBox_PurpleSilver',
    'GiftBox_GoldRed',
    'GiftBox_WhiteGreen',
    'Block_Snow_Falling',
    'Snowman',
];

export type AdventDayStatus = {
    day: number;
    opened: boolean;
    openedAt?: string;
    openedBy?: string;
    awards?: AdventAward[];
    awardDescriptions?: AdventAwardDescription[];
};

export type AdventAwardDescription = {
    title: string;
    description: string;
};

const ADVENT_DESCRIPTION =
    '24 dana darivanja: svaki dan u prosincu otvori novi prozorčić i osvoji nagradu.';

function describeAward(award: AdventAward): AdventAwardDescription {
    switch (award.kind) {
        case 'sunflowers':
            return {
                title: `${award.amount} suncokreta`,
                description: 'Suncokreta na tvom računu.',
            };
        case 'plant':
            return {
                title: award.title ?? 'Nova biljka',
                description: 'Biljka samo za tebe.',
            };
        case 'decoration':
            return {
                title: award.title ?? 'Blagdanska dekoracija',
                description:
                    'Ukras koji će uljepšati tvoj vrt u blagdansko vrijeme.',
            };
        case 'tree-decoration':
            return {
                title: award.title ?? `Ukras za drvce (dan ${award.day})`,
                description: 'Ukras koji će uljepšati tvoje božićno drvce.',
            };
        case 'gift':
            if (award.gift === 'christmas-tree') {
                return {
                    title: 'Božićno drvce',
                    description:
                        'Posebno drvce za tvoj prvi dan adventskog kalendara.',
                };
            }
            return {
                title: 'Adventski box',
                description:
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
    const title = plantSort.information.name;
    if (!title) {
        throw new Error('Selected plant sort has no name.');
    }

    return {
        kind: 'plant' as const,
        plantSortId: Number(plantSort.id ?? randomIndex + 1),
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

    const days: AdventDayStatus[] = [];
    for (let day = 1; day <= ADVENT_TOTAL_DAYS; day++) {
        const existing = opened.get(day);
        const awards =
            existing?.awards ??
            (existing?.award ? [existing.award] : undefined);
        days.push({
            day,
            opened: Boolean(existing),
            openedAt: existing?.createdAt,
            openedBy: existing?.openedBy,
            awards,
            awardDescriptions: awards?.map(describeAward),
        });
    }

    const openedCount = opened.size;
    const nextDay = days.find((d) => !d.opened)?.day ?? null;

    return {
        calendarId: ADVENT_CALENDAR_2025_ID,
        year: ADVENT_YEAR,
        totalDays: ADVENT_TOTAL_DAYS,
        openedCount,
        remaining: ADVENT_TOTAL_DAYS - openedCount,
        nextDay,
        description: ADVENT_DESCRIPTION,
        days,
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
    timeZone,
}: {
    accountId: string;
    userId: string;
    day: number;
    timeZone: string;
}) {
    // Check if the day is available yet (using user's timezone)
    if (!isAdventDayAvailable(day, timeZone)) {
        throw new AdventCalendarDayNotYetAvailableError(
            day,
            getAdventDayAvailableAt(day, timeZone),
        );
    }

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

                if (award.kind === 'plant') {
                    await addInventoryItem(
                        accountId,
                        {
                            entityTypeName: 'plantSort',
                            entityId: award.plantSortId.toString(),
                            amount: 1,
                            source: `advent-${ADVENT_YEAR}-dan-${day}`,
                        },
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
        awardDescriptions: resolvedAwards.map(describeAward),
    };
}

export {
    ADVENT_DESCRIPTION,
    ADVENT_TOTAL_DAYS,
    ADVENT_YEAR,
    AdventCalendarDayAlreadyOpenedError,
    // Exported for testing
    getAdventDayAvailableAt,
    getCurrentAdventDay,
    isAdventDayAvailable,
};
