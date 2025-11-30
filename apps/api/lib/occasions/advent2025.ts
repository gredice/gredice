import type { PlantSortData } from '@gredice/directory-types';
import {
    type AdventAward,
    AdventCalendarDayAlreadyOpenedError,
    type AdventCalendarOpenPayload,
    createAdventCalendarOpenEvent,
    earnSunflowers,
    getAdventCalendarOpenEvents,
    getEntitiesFormatted,
} from '@gredice/storage';

const ADVENT_YEAR = 2025;
const ADVENT_TOTAL_DAYS = 24;
export const ADVENT_CALENDAR_2025_ID = 'calendar-2025';

const CHRISTMAS_TREE_BLOCK_ID = 'ukras-bozicno-drvce';
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

    // Day 1: Christmas tree
    if (day === 1) {
        awards.push(
            pickDecorationAward('Božićno drvce', CHRISTMAS_TREE_BLOCK_ID),
        );
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

export async function openAdventCalendar2025Day({
    accountId,
    userId,
    day,
}: {
    accountId: string;
    userId: string;
    day: number;
}) {
    const events = await getAdventCalendarOpenEvents(accountId, ADVENT_YEAR);
    const openedDays = new Set(events.map((event) => event.data.day));
    const completesCalendar =
        day === ADVENT_TOTAL_DAYS && openedDays.size === ADVENT_TOTAL_DAYS - 1;

    const awards = await pickAwardsForDay(day, completesCalendar);
    const payload: AdventCalendarOpenPayload = {
        year: ADVENT_YEAR,
        day,
        openedBy: userId,
        awards,
    };

    await createAdventCalendarOpenEvent(accountId, payload);

    // Process all sunflower awards
    for (const award of awards) {
        if (award.kind === 'sunflowers') {
            await earnSunflowers(
                accountId,
                award.amount,
                `advent-${ADVENT_YEAR}-dan-${day}`,
            );
        }
    }

    return {
        payload,
        opisNagrada: awards.map(describeAward),
    };
}

export {
    ADVENT_DESCRIPTION,
    ADVENT_TOTAL_DAYS,
    ADVENT_YEAR,
    AdventCalendarDayAlreadyOpenedError,
};
