import type { GardenVisitSummaryResponse } from '@gredice/client';

export type GardenVisitSummaryFact =
    GardenVisitSummaryResponse['facts'][number];
export type GardenVisitSummaryTarget = NonNullable<
    GardenVisitSummaryFact['target']
>;
export type GardenVisitSummarySource = GardenVisitSummaryFact['source'];

export type GardenVisitSummaryDisplayItem = {
    id: string;
    type: GardenVisitSummaryFact['type'];
    message: string;
    priority: number;
    occurredAt: string;
    facts: GardenVisitSummaryFact[];
    sources: GardenVisitSummarySource[];
    targets: GardenVisitSummaryTarget[];
    visualHints: GardenVisitSummaryFact['visualHint'][];
};

type FormatGardenVisitSummaryFactsOptions = {
    maxItems?: number;
};

type CroatianCountForms = {
    one: string;
    few: string;
    many: string;
};

type PlantCopy = {
    label: string;
    growthPredicate: string;
    supportPredicate: string;
    readyPredicate: string;
};

export const DEFAULT_GARDEN_VISIT_SUMMARY_DISPLAY_ITEMS = 5;

const gardenBedLocativeForms: CroatianCountForms = {
    one: 'gredici',
    few: 'gredice',
    many: 'gredica',
};
const fieldLocativeForms: CroatianCountForms = {
    one: 'polju',
    few: 'polja',
    many: 'polja',
};
const dayForms: CroatianCountForms = {
    one: 'dan',
    few: 'dana',
    many: 'dana',
};
const operationForms: CroatianCountForms = {
    one: 'radnja',
    few: 'radnje',
    many: 'radnji',
};

const knownPlantCopy = new Map<string, PlantCopy>([
    [
        'rajčica',
        {
            label: 'Rajčice',
            growthPredicate: 'su vidljivo narasle',
            supportPredicate: 'trebaju',
            readyPredicate: 'su spremne',
        },
    ],
    [
        'krastavac',
        {
            label: 'Krastavci',
            growthPredicate: 'su vidljivo narasli',
            supportPredicate: 'trebaju',
            readyPredicate: 'su spremni',
        },
    ],
    [
        'paprika',
        {
            label: 'Paprike',
            growthPredicate: 'su vidljivo narasle',
            supportPredicate: 'trebaju',
            readyPredicate: 'su spremne',
        },
    ],
    [
        'mrkva',
        {
            label: 'Mrkve',
            growthPredicate: 'su vidljivo narasle',
            supportPredicate: 'trebaju',
            readyPredicate: 'su spremne',
        },
    ],
    [
        'salata',
        {
            label: 'Salate',
            growthPredicate: 'su vidljivo narasle',
            supportPredicate: 'trebaju',
            readyPredicate: 'su spremne',
        },
    ],
    [
        'brokula',
        {
            label: 'Brokule',
            growthPredicate: 'su vidljivo narasle',
            supportPredicate: 'trebaju',
            readyPredicate: 'su spremne',
        },
    ],
    [
        'luk',
        {
            label: 'Luk',
            growthPredicate: 'je vidljivo narastao',
            supportPredicate: 'treba',
            readyPredicate: 'je spreman',
        },
    ],
    [
        'špinat',
        {
            label: 'Špinat',
            growthPredicate: 'je vidljivo narastao',
            supportPredicate: 'treba',
            readyPredicate: 'je spreman',
        },
    ],
]);

const fallbackPlantCopy: PlantCopy = {
    label: 'Biljke',
    growthPredicate: 'su vidljivo narasle',
    supportPredicate: 'trebaju',
    readyPredicate: 'su spremne',
};

export function gardenVisitSummaryQueryKey(
    gardenId: number | null | undefined,
) {
    return ['garden-visit-summary', gardenId ?? null];
}

function sentenceCaseCroatian(value: string) {
    const trimmed = value.trim();
    if (!trimmed) {
        return trimmed;
    }

    return `${trimmed.charAt(0).toLocaleUpperCase('hr-HR')}${trimmed.slice(1)}`;
}

function normalizePlantName(value: string) {
    return value.trim().toLocaleLowerCase('hr-HR');
}

function plantNameForFact(fact: GardenVisitSummaryFact) {
    return fact.plant?.plantName ?? fact.plant?.sortName ?? null;
}

function genericPlantCopy(name: string): PlantCopy {
    const label = sentenceCaseCroatian(name);
    const normalized = normalizePlantName(name);
    if (normalized.endsWith('a')) {
        return {
            label: `${label.slice(0, -1)}e`,
            growthPredicate: 'su vidljivo narasle',
            supportPredicate: 'trebaju',
            readyPredicate: 'su spremne',
        };
    }

    if (normalized.endsWith('ac')) {
        return {
            label: `${label.slice(0, -2)}ci`,
            growthPredicate: 'su vidljivo narasli',
            supportPredicate: 'trebaju',
            readyPredicate: 'su spremni',
        };
    }

    return {
        label,
        growthPredicate: 'je vidljivo narastao',
        supportPredicate: 'treba',
        readyPredicate: 'je spreman',
    };
}

function plantCopyForFacts(facts: GardenVisitSummaryFact[]): PlantCopy {
    const plantName = facts.map(plantNameForFact).find(Boolean);
    if (!plantName) {
        return fallbackPlantCopy;
    }

    return (
        knownPlantCopy.get(normalizePlantName(plantName)) ??
        genericPlantCopy(plantName)
    );
}

function isCroatianFewCount(count: number) {
    const absoluteCount = Math.abs(count);
    const lastDigit = absoluteCount % 10;
    const lastTwoDigits = absoluteCount % 100;

    return (
        lastDigit >= 2 &&
        lastDigit <= 4 &&
        !(lastTwoDigits >= 12 && lastTwoDigits <= 14)
    );
}

function croatianCountForm(count: number, forms: CroatianCountForms) {
    const absoluteCount = Math.abs(count);
    const lastDigit = absoluteCount % 10;
    const lastTwoDigits = absoluteCount % 100;

    if (lastDigit === 1 && lastTwoDigits !== 11) {
        return forms.one;
    }

    if (isCroatianFewCount(count)) {
        return forms.few;
    }

    return forms.many;
}

function formatCroatianCount(count: number, forms: CroatianCountForms) {
    return `${count.toString()} ${croatianCountForm(count, forms)}`;
}

function countFacts(facts: GardenVisitSummaryFact[]) {
    const explicitTotal = facts.reduce(
        (total, fact) => total + Math.max(0, fact.count ?? 1),
        0,
    );

    return explicitTotal > 0 ? explicitTotal : facts.length;
}

function priorityForFacts(facts: GardenVisitSummaryFact[]) {
    return facts.reduce(
        (highestPriority, fact) => Math.max(highestPriority, fact.priority),
        0,
    );
}

function occurredAtForFacts(facts: GardenVisitSummaryFact[]) {
    return facts.reduce(
        (latestOccurredAt, fact) =>
            fact.occurredAt > latestOccurredAt
                ? fact.occurredAt
                : latestOccurredAt,
        '',
    );
}

function targetsForFacts(facts: GardenVisitSummaryFact[]) {
    const targets: GardenVisitSummaryTarget[] = [];
    const seenTargetKeys = new Set<string>();

    for (const fact of facts) {
        if (!fact.target) {
            continue;
        }

        const key = [
            fact.target.raisedBedId?.toString() ?? '',
            fact.target.fieldId?.toString() ?? '',
            fact.target.positionIndex?.toString() ?? '',
        ].join(':');
        if (seenTargetKeys.has(key)) {
            continue;
        }

        seenTargetKeys.add(key);
        targets.push(fact.target);
    }

    return targets;
}

function visualHintsForFacts(facts: GardenVisitSummaryFact[]) {
    return [...new Set(facts.flatMap((fact) => fact.visualHint ?? []))];
}

function displayItemFromFacts({
    id,
    message,
    type,
    facts,
}: {
    id: string;
    message: string;
    type: GardenVisitSummaryFact['type'];
    facts: GardenVisitSummaryFact[];
}): GardenVisitSummaryDisplayItem {
    return {
        id,
        type,
        message,
        priority: priorityForFacts(facts),
        occurredAt: occurredAtForFacts(facts),
        facts,
        sources: facts.map((fact) => fact.source),
        targets: targetsForFacts(facts),
        visualHints: visualHintsForFacts(facts),
    };
}

function sortFacts(facts: GardenVisitSummaryFact[]) {
    return [...facts].sort((left, right) => {
        if (left.priority !== right.priority) {
            return right.priority - left.priority;
        }

        if (left.occurredAt !== right.occurredAt) {
            return right.occurredAt.localeCompare(left.occurredAt);
        }

        return left.id.localeCompare(right.id);
    });
}

function sortDisplayItems(items: GardenVisitSummaryDisplayItem[]) {
    return [...items].sort((left, right) => {
        if (left.priority !== right.priority) {
            return right.priority - left.priority;
        }

        if (left.occurredAt !== right.occurredAt) {
            return right.occurredAt.localeCompare(left.occurredAt);
        }

        return left.id.localeCompare(right.id);
    });
}

function groupFactsByKey(
    facts: GardenVisitSummaryFact[],
    keyForFact: (fact: GardenVisitSummaryFact) => string,
) {
    const groupsByKey = new Map<string, GardenVisitSummaryFact[]>();

    for (const fact of facts) {
        const key = keyForFact(fact);
        groupsByKey.set(key, [...(groupsByKey.get(key) ?? []), fact]);
    }

    return [...groupsByKey.entries()].map(([key, groupFacts]) => ({
        key,
        facts: groupFacts,
    }));
}

function plantGroupKey(fact: GardenVisitSummaryFact) {
    if (fact.plant?.sortId != null) {
        return `sort:${fact.plant.sortId.toString()}`;
    }

    return `name:${normalizePlantName(plantNameForFact(fact) ?? 'biljke')}`;
}

function drySoilDisplayItem(facts: GardenVisitSummaryFact[]) {
    return displayItemFromFacts({
        id: 'drySoil',
        type: 'drySoil',
        facts,
        message: `Tlo je suho na ${formatCroatianCount(countFacts(facts), gardenBedLocativeForms)}.`,
    });
}

function weedDisplayItems(facts: GardenVisitSummaryFact[]) {
    return groupFactsByKey(facts, (fact) =>
        fact.visualHint === 'field' || fact.target?.fieldId != null
            ? 'fields'
            : 'raisedBeds',
    ).map(({ key, facts: groupedFacts }) =>
        displayItemFromFacts({
            id: `weed:${key}`,
            type: 'weed',
            facts: groupedFacts,
            message: `Pojavio se korov na ${formatCroatianCount(
                countFacts(groupedFacts),
                key === 'fields' ? fieldLocativeForms : gardenBedLocativeForms,
            )}.`,
        }),
    );
}

function supportNeededDisplayItems(facts: GardenVisitSummaryFact[]) {
    return groupFactsByKey(facts, plantGroupKey).map(
        ({ key, facts: groupedFacts }) => {
            const plantCopy = plantCopyForFacts(groupedFacts);

            return displayItemFromFacts({
                id: `supportNeeded:${key}`,
                type: 'supportNeeded',
                facts: groupedFacts,
                message: `${plantCopy.label} ${plantCopy.supportPredicate} potporu.`,
            });
        },
    );
}

function plantGrowthDisplayItems(facts: GardenVisitSummaryFact[]) {
    return groupFactsByKey(facts, plantGroupKey).map(
        ({ key, facts: groupedFacts }) => {
            const plantCopy = plantCopyForFacts(groupedFacts);

            return displayItemFromFacts({
                id: `plantGrowth:${key}`,
                type: 'plantGrowth',
                facts: groupedFacts,
                message: `${plantCopy.label} ${plantCopy.growthPredicate}.`,
            });
        },
    );
}

function rangeForFacts(facts: GardenVisitSummaryFact[]) {
    const ranges = facts.flatMap((fact) => (fact.range ? [fact.range] : []));
    if (ranges.length === 0) {
        return null;
    }

    return {
        min: Math.min(...ranges.map((range) => range.min)),
        max: Math.max(...ranges.map((range) => range.max)),
    };
}

function formatHarvestRange(range: { min: number; max: number }) {
    if (range.min <= 0 && range.max <= 0) {
        return 'danas';
    }

    if (range.min <= 0) {
        return `u sljedeća ${formatCroatianCount(range.max, dayForms)}`;
    }

    if (range.min === range.max) {
        return `za ${formatCroatianCount(range.min, dayForms)}`;
    }

    return `za ${range.min.toString()}-${range.max.toString()} dana`;
}

function harvestWindowDisplayItems(facts: GardenVisitSummaryFact[]) {
    return groupFactsByKey(facts, plantGroupKey).map(
        ({ key, facts: groupedFacts }) => {
            const range = rangeForFacts(groupedFacts);
            const plantCopy = plantCopyForFacts(groupedFacts);
            const message =
                range && (range.min > 0 || range.max > 0)
                    ? `Berba bi mogla biti ${formatHarvestRange(range)}.`
                    : `${plantCopy.label} ${plantCopy.readyPredicate} za berbu.`;

            return displayItemFromFacts({
                id: `harvestWindow:${key}`,
                type: 'harvestWindow',
                facts: groupedFacts,
                message,
            });
        },
    );
}

function operationCompletedDisplayItem(facts: GardenVisitSummaryFact[]) {
    const count = countFacts(facts);
    const message =
        count === 1
            ? 'Dovršena je radnja u vrtu.'
            : isCroatianFewCount(count)
              ? `Dovršene su ${formatCroatianCount(count, operationForms)} u vrtu.`
              : `Dovršeno je ${formatCroatianCount(count, operationForms)} u vrtu.`;

    return displayItemFromFacts({
        id: 'operationCompleted',
        type: 'operationCompleted',
        facts,
        message,
    });
}

export function formatGardenVisitSummaryFacts(
    facts: GardenVisitSummaryFact[],
    options: FormatGardenVisitSummaryFactsOptions = {},
) {
    const sortedFacts = sortFacts(facts);
    const plantGrowthFacts = sortedFacts.filter(
        (fact) => fact.type === 'plantGrowth',
    );
    const operationCompletedFacts = sortedFacts.filter(
        (fact) => fact.type === 'operationCompleted',
    );
    const drySoilFacts = sortedFacts.filter((fact) => fact.type === 'drySoil');
    const weedFacts = sortedFacts.filter((fact) => fact.type === 'weed');
    const supportNeededFacts = sortedFacts.filter(
        (fact) => fact.type === 'supportNeeded',
    );
    const harvestWindowFacts = sortedFacts.filter(
        (fact) => fact.type === 'harvestWindow',
    );
    const items = [
        ...weedDisplayItems(weedFacts),
        ...(drySoilFacts.length > 0 ? [drySoilDisplayItem(drySoilFacts)] : []),
        ...supportNeededDisplayItems(supportNeededFacts),
        ...harvestWindowDisplayItems(harvestWindowFacts),
        ...plantGrowthDisplayItems(plantGrowthFacts),
        ...(operationCompletedFacts.length > 0
            ? [operationCompletedDisplayItem(operationCompletedFacts)]
            : []),
    ];

    return sortDisplayItems(items).slice(
        0,
        options.maxItems ?? DEFAULT_GARDEN_VISIT_SUMMARY_DISPLAY_ITEMS,
    );
}
