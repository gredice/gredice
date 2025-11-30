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
    nagrada?: AdventAward;
    opisNagrade?: AdventAwardDescription;
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
                opis: 'Suncokreti su dodani na tvoj račun kao adventska nagrada.',
            };
        case 'plant':
            return {
                naslov: award.title ?? 'Nova biljka',
                opis: 'Nasumično odabrana sorta iz baze biljaka.',
            };
        case 'decoration':
            return {
                naslov: award.title ?? 'Blagdanska dekoracija',
                opis: 'Ukras koji će uljepšati tvoj vrt u blagdansko vrijeme.',
            };
        case 'gift':
            if (award.gift === 'christmas-tree') {
                return {
                    naslov: 'Božićno drvce',
                    opis: 'Posebno drvce za prvi dan adventskog kalendara.',
                };
            }
            return {
                naslov: 'Adventski box',
                opis:
                    award.delivery === 'digital+physical'
                        ? 'Digitalni i fizički poklon box jer su otvoreni svi dani kalendara.'
                        : 'Digitalni poklon box za posljednji dan adventa.',
            };
    }
}

function rollSunflowerAward(): AdventAward | null {
    const sunflowerChance = Math.random();
    if (sunflowerChance >= 0.1) {
        return null;
    }

    const premiumChance = Math.random();
    const amount = premiumChance < 0.01 ? 5000 : 500;
    return { kind: 'sunflowers', amount };
}

async function pickPlantAward(): Promise<AdventAward | null> {
    const plantSorts = await getEntitiesFormatted<PlantSortData>('plantSort');
    if (!plantSorts?.length) {
        return null;
    }
    const randomIndex = Math.floor(Math.random() * plantSorts.length);
    const plantSort = plantSorts[randomIndex];
    const title = (plantSort as { name?: string }).name ?? 'Nova biljka';
    return {
        kind: 'plant',
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

async function pickAwardForDay(day: number, hasFullAttendance: boolean) {
    if (day === 1) {
        return pickDecorationAward('Božićno drvce', CHRISTMAS_TREE_BLOCK_ID);
    }

    if (day === ADVENT_TOTAL_DAYS) {
        return {
            kind: 'gift',
            gift: 'advent-box',
            delivery: hasFullAttendance ? 'digital+physical' : 'digital',
        } as const satisfies AdventAward;
    }

    if (day % 5 === 0) {
        const plantAward = await pickPlantAward();
        if (plantAward) return plantAward;
    }

    const sunflowerAward = rollSunflowerAward();
    if (sunflowerAward) {
        return sunflowerAward;
    }

    return pickDecorationAward();
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
        dani.push({
            dan: day,
            otvoren: Boolean(existing),
            otvorenoAt: existing?.createdAt,
            otvorio: existing?.openedBy,
            nagrada: existing?.award,
            opisNagrade: existing?.award
                ? describeAward(existing.award)
                : undefined,
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

    const award = await pickAwardForDay(day, completesCalendar);
    const payload: AdventCalendarOpenPayload = {
        year: ADVENT_YEAR,
        day,
        openedBy: userId,
        award,
    };

    await createAdventCalendarOpenEvent(accountId, payload);

    if (award.kind === 'sunflowers') {
        await earnSunflowers(
            accountId,
            award.amount,
            `advent-${ADVENT_YEAR}-dan-${day}`,
        );
    }

    return {
        payload,
        opisNagrade: describeAward(award),
    };
}

export {
    ADVENT_DESCRIPTION,
    ADVENT_TOTAL_DAYS,
    ADVENT_YEAR,
    AdventCalendarDayAlreadyOpenedError,
};
