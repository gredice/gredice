import 'server-only';

import {
    calculatePlantsPerField,
    FIELD_SIZE_LABEL,
    getHarvestPlantRemovalDisclaimer,
} from '@gredice/js/plants';
import {
    type EntityStandardized,
    entityRevisions,
    getAttributeDefinitions,
    getEntitiesFormatted,
    type SelectEntityRevision,
    storage,
} from '@gredice/storage';
import { and, desc, gte, inArray } from 'drizzle-orm';

export type FarmerDocumentationChangeType = 'insert' | 'replace' | 'discard';
export type FarmerDocumentationEntityTypeName = 'operation' | 'plantSort';

export type FarmerDocumentationAttribute = {
    label: string;
    value: string;
};

export type FarmerDocumentationSection = {
    title: string;
    lines: string[];
};

export type FarmerDocumentationPage = {
    id: number;
    entityTypeName: FarmerDocumentationEntityTypeName;
    documentTypeLabel: string;
    code: string;
    label: string;
    appPath: string;
    summaryRows: FarmerDocumentationAttribute[];
    sections: FarmerDocumentationSection[];
    changedAt: Date | null;
    changeType: Exclude<FarmerDocumentationChangeType, 'discard'>;
    revisionActions: string[];
};

export type FarmerDocumentationOperation = FarmerDocumentationPage & {
    entityTypeName: 'operation';
};

export type FarmerDocumentationPlantSort = FarmerDocumentationPage & {
    entityTypeName: 'plantSort';
};

export type FarmerDocumentationDiscard = {
    entityTypeName: FarmerDocumentationEntityTypeName;
    entityId: number;
    documentTypeLabel: string;
    code: string;
    label: string;
    changedAt: Date;
    revisionActions: string[];
};

export type FarmerDocumentationPackage = {
    since: Date | null;
    generatedAt: Date;
    totalOperations: number;
    totalPlantSorts: number;
    currentOperations: FarmerDocumentationOperation[];
    currentPlantSorts: FarmerDocumentationPlantSort[];
    includedOperations: FarmerDocumentationOperation[];
    includedPlantSorts: FarmerDocumentationPlantSort[];
    discardedOperations: FarmerDocumentationDiscard[];
    discardedPlantSorts: FarmerDocumentationDiscard[];
};

export type FarmerDocumentationRevision = Pick<
    SelectEntityRevision,
    | 'id'
    | 'entityId'
    | 'entityTypeName'
    | 'action'
    | 'actorName'
    | 'attributeDefinitionId'
    | 'previousValue'
    | 'nextValue'
    | 'previousState'
    | 'nextState'
    | 'createdAt'
>;

const documentationEntityTypeNames: FarmerDocumentationEntityTypeName[] = [
    'operation',
    'plantSort',
];

const documentationEntityConfig: Record<
    FarmerDocumentationEntityTypeName,
    {
        codePrefix: string;
        documentTypeLabel: string;
        fallbackLabel: string;
        noun: string;
    }
> = {
    operation: {
        codePrefix: 'OP',
        documentTypeLabel: 'Radnja',
        fallbackLabel: 'Radnja',
        noun: 'radnja',
    },
    plantSort: {
        codePrefix: 'PS',
        documentTypeLabel: 'Sorta',
        fallbackLabel: 'Sorta',
        noun: 'sorta',
    },
};

const operationAttributeLabels: Record<string, string> = {
    application: 'Primjena',
    deliverable: 'Isporuka',
    frequency: 'Ucestalost',
    internal: 'Interno',
    printLabel: 'Ispis etikete',
    relativeDays: 'Relativni dani',
    stage: 'Faza',
};

const operationAttributeValueLabels: Record<string, Record<string, string>> = {
    application: {
        raisedBed: 'Gredica',
        raisedBedField: 'Polje gredice',
        raisedBedFull: 'Cijela gredica',
    },
    frequency: {
        once: 'Jednom',
        optional: 'Po potrebi',
        recurring: 'Ponavljajuce',
        required: 'Obavezno',
    },
};

const reproductionTypeLabels: Record<string, string> = {
    bulb: 'Lukovica',
    seed: 'Sjeme',
};

const monthNames = [
    'sijecanj',
    'veljaca',
    'ozujak',
    'travanj',
    'svibanj',
    'lipanj',
    'srpanj',
    'kolovoz',
    'rujan',
    'listopad',
    'studeni',
    'prosinac',
];

const plantSortTextFields = [
    { key: 'description', title: 'Opis' },
    { key: 'soilPreparation', title: 'Priprema tla' },
    { key: 'sowing', title: 'Sjetva' },
    { key: 'planting', title: 'Sadnja' },
    { key: 'growth', title: 'Rast' },
    { key: 'maintenance', title: 'Odrzavanje' },
    { key: 'watering', title: 'Zalijevanje' },
    { key: 'flowering', title: 'Cvatnja' },
    { key: 'harvest', title: 'Berba' },
    { key: 'storage', title: 'Cuvanje' },
    { key: 'origin', title: 'Podrijetlo' },
];

const calendarDetails = [
    { key: 'propagating', title: 'Sjetva u zatvorenom' },
    { key: 'sowing', title: 'Sjetva na otvorenom' },
    { key: 'planting', title: 'Presadivanje' },
    { key: 'harvest', title: 'Berba' },
];

export function getFarmerDocumentationCode(
    entityTypeName: FarmerDocumentationEntityTypeName,
    entityId: number,
) {
    const config = documentationEntityConfig[entityTypeName];
    return `${config.codePrefix}-${entityId.toString().padStart(4, '0')}`;
}

export function getFarmerAppOrigin() {
    const configured = process.env.NEXT_PUBLIC_GREDICE_FARM_ORIGIN?.trim();
    return (configured || 'https://farma.gredice.com').replace(/\/+$/, '');
}

export function parseDocumentationSince(value: string | undefined) {
    const normalized = value?.trim();
    if (!normalized) {
        return null;
    }

    const isDate = /^\d{4}-\d{2}-\d{2}$/.test(normalized);
    const isDateTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(normalized);
    const isIsoDateTime =
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z?$/.test(normalized);

    if (!isDate && !isDateTime && !isIsoDateTime) {
        return null;
    }

    const parsed = new Date(isDate ? `${normalized}T00:00:00` : normalized);
    if (Number.isNaN(parsed.getTime())) {
        return null;
    }

    return parsed;
}

export function formatDocumentationDateTime(date: Date | null) {
    if (!date) {
        return 'Nije odabrano';
    }

    return new Intl.DateTimeFormat('hr-HR', {
        timeZone: 'Europe/Zagreb',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date);
}

export function documentationChangeLabel(type: FarmerDocumentationChangeType) {
    switch (type) {
        case 'insert':
            return 'Umetni';
        case 'replace':
            return 'Zamijeni';
        case 'discard':
            return 'Ukloni';
    }
}

export function includedDocumentationPages(
    documentationPackage: FarmerDocumentationPackage,
) {
    return [
        ...documentationPackage.includedOperations,
        ...documentationPackage.includedPlantSorts,
    ].sort(compareDocumentationPage);
}

export function currentDocumentationPages(
    documentationPackage: FarmerDocumentationPackage,
) {
    return [
        ...documentationPackage.currentOperations,
        ...documentationPackage.currentPlantSorts,
    ].sort(compareDocumentationPage);
}

export function discardedDocumentationPages(
    documentationPackage: FarmerDocumentationPackage,
) {
    return [
        ...documentationPackage.discardedOperations,
        ...documentationPackage.discardedPlantSorts,
    ].sort(compareDocumentationPage);
}

export async function getFarmerDocumentationPackage({
    since,
}: {
    since: Date | null;
}): Promise<FarmerDocumentationPackage> {
    const [
        operations,
        plantSorts,
        revisions,
        operationAttributeDefinitions,
        plantSortAttributeDefinitions,
    ] = await Promise.all([
        getEntitiesFormatted<EntityStandardized>('operation').catch(
            (): EntityStandardized[] => [],
        ),
        getEntitiesFormatted<EntityStandardized>('plantSort').catch(
            (): EntityStandardized[] => [],
        ),
        getDocumentationRevisionsSince(since),
        getAttributeDefinitions('operation').catch(() => []),
        getAttributeDefinitions('plantSort').catch(() => []),
    ]);

    return buildFarmerDocumentationPackage({
        operations,
        plantSorts,
        revisions,
        labelAttributeDefinitionIds: {
            operation: labelAttributeDefinitionIds(
                operationAttributeDefinitions,
            ),
            plantSort: labelAttributeDefinitionIds(
                plantSortAttributeDefinitions,
            ),
        },
        generatedAt: new Date(),
        since,
    });
}

export function buildFarmerDocumentationPackage({
    generatedAt,
    labelAttributeDefinitionIds,
    operations,
    plantSorts,
    revisions,
    since,
}: {
    generatedAt: Date;
    labelAttributeDefinitionIds: Record<
        FarmerDocumentationEntityTypeName,
        ReadonlySet<number>
    >;
    operations: EntityStandardized[];
    plantSorts: EntityStandardized[];
    revisions: FarmerDocumentationRevision[];
    since: Date | null;
}): FarmerDocumentationPackage {
    const sortedOperations = [...operations].sort(
        (left, right) => left.id - right.id,
    );
    const sortedPlantSorts = [...plantSorts].sort((left, right) =>
        getPlantSortLabel(left).localeCompare(getPlantSortLabel(right), 'hr', {
            numeric: true,
        }),
    );
    const revisionsByEntityKey = groupRevisionsByEntityKey(revisions);
    const currentOperations = sortedOperations.map((operation) =>
        toDocumentationOperation(
            operation,
            revisionsByEntityKey.get(
                documentationEntityKey('operation', operation.id),
            ) ?? [],
            since,
        ),
    );
    const currentPlantSorts = sortedPlantSorts.map((plantSort) =>
        toDocumentationPlantSort(
            plantSort,
            revisionsByEntityKey.get(
                documentationEntityKey('plantSort', plantSort.id),
            ) ?? [],
            since,
        ),
    );
    const includedOperations = currentOperations.filter((operation) =>
        shouldIncludeCurrentEntity(
            operation,
            'operation',
            since,
            revisionsByEntityKey,
        ),
    );
    const includedPlantSorts = currentPlantSorts.filter((plantSort) =>
        shouldIncludeCurrentEntity(
            plantSort,
            'plantSort',
            since,
            revisionsByEntityKey,
        ),
    );

    return {
        since,
        generatedAt,
        totalOperations: sortedOperations.length,
        totalPlantSorts: sortedPlantSorts.length,
        currentOperations,
        currentPlantSorts,
        includedOperations,
        includedPlantSorts,
        discardedOperations: discardedPagesForType({
            currentEntities: sortedOperations,
            entityTypeName: 'operation',
            labelAttributeDefinitionIds: labelAttributeDefinitionIds.operation,
            revisionsByEntityKey,
        }),
        discardedPlantSorts: discardedPagesForType({
            currentEntities: sortedPlantSorts,
            entityTypeName: 'plantSort',
            labelAttributeDefinitionIds: labelAttributeDefinitionIds.plantSort,
            revisionsByEntityKey,
        }),
    };
}

function getDocumentationRevisionsSince(since: Date | null) {
    if (!since) {
        return Promise.resolve<FarmerDocumentationRevision[]>([]);
    }

    return storage().query.entityRevisions.findMany({
        columns: {
            id: true,
            entityId: true,
            entityTypeName: true,
            action: true,
            actorName: true,
            attributeDefinitionId: true,
            previousValue: true,
            nextValue: true,
            previousState: true,
            nextState: true,
            createdAt: true,
        },
        where: and(
            inArray(
                entityRevisions.entityTypeName,
                documentationEntityTypeNames,
            ),
            gte(entityRevisions.createdAt, since),
        ),
        orderBy: (revisionRows) => [
            desc(revisionRows.createdAt),
            desc(revisionRows.id),
        ],
    });
}

function labelAttributeDefinitionIds(
    attributeDefinitions: Array<{
        id: number;
        category: string | null;
        name: string;
    }>,
) {
    return new Set(
        attributeDefinitions
            .filter(
                (definition) =>
                    definition.category === 'information' &&
                    (definition.name === 'label' || definition.name === 'name'),
            )
            .map((definition) => definition.id),
    );
}

function groupRevisionsByEntityKey(revisions: FarmerDocumentationRevision[]) {
    const grouped = new Map<string, FarmerDocumentationRevision[]>();

    for (const revision of revisions) {
        const entityTypeName = normalizeDocumentationEntityTypeName(
            revision.entityTypeName,
        );
        if (!entityTypeName) {
            continue;
        }

        const key = documentationEntityKey(entityTypeName, revision.entityId);
        const entityRevisions = grouped.get(key) ?? [];
        entityRevisions.push(revision);
        grouped.set(key, entityRevisions);
    }

    return grouped;
}

function normalizeDocumentationEntityTypeName(
    value: string,
): FarmerDocumentationEntityTypeName | null {
    if (value === 'operation' || value === 'plantSort') {
        return value;
    }

    return null;
}

function documentationEntityKey(
    entityTypeName: FarmerDocumentationEntityTypeName,
    entityId: number,
) {
    return `${entityTypeName}:${entityId}`;
}

function shouldIncludeCurrentEntity(
    entity: { id: number },
    entityTypeName: FarmerDocumentationEntityTypeName,
    since: Date | null,
    revisionsByEntityKey: ReadonlyMap<string, FarmerDocumentationRevision[]>,
) {
    return (
        !since ||
        revisionsByEntityKey.has(
            documentationEntityKey(entityTypeName, entity.id),
        )
    );
}

function discardedPagesForType({
    currentEntities,
    entityTypeName,
    labelAttributeDefinitionIds,
    revisionsByEntityKey,
}: {
    currentEntities: EntityStandardized[];
    entityTypeName: FarmerDocumentationEntityTypeName;
    labelAttributeDefinitionIds: ReadonlySet<number>;
    revisionsByEntityKey: ReadonlyMap<string, FarmerDocumentationRevision[]>;
}) {
    const currentIds = new Set(currentEntities.map((entity) => entity.id));
    const config = documentationEntityConfig[entityTypeName];

    return Array.from(revisionsByEntityKey.entries())
        .filter(([, entityRevisions]) =>
            entityRevisions.some(
                (revision) => revision.entityTypeName === entityTypeName,
            ),
        )
        .filter(([, entityRevisions]) => {
            const entityId = entityRevisions[0]?.entityId;
            return entityId !== undefined && !currentIds.has(entityId);
        })
        .filter(([, entityRevisions]) =>
            entityRevisions.some(isDiscardRevision),
        )
        .map(([, entityRevisions]) => {
            const entityId = entityRevisions[0]?.entityId ?? 0;

            return {
                entityTypeName,
                entityId,
                documentTypeLabel: config.documentTypeLabel,
                code: getFarmerDocumentationCode(entityTypeName, entityId),
                label: revisionEntityLabel(
                    entityTypeName,
                    entityId,
                    entityRevisions,
                    labelAttributeDefinitionIds,
                ),
                changedAt: latestRevisionDate(entityRevisions),
                revisionActions: revisionActionSummary(
                    entityRevisions,
                    entityTypeName,
                ),
            };
        });
}

function toDocumentationOperation(
    operation: EntityStandardized,
    revisions: FarmerDocumentationRevision[],
    since: Date | null,
): FarmerDocumentationOperation {
    const changedAt =
        revisions.length > 0 ? latestRevisionDate(revisions) : null;
    const changeType = isInsertPage(revisions, since) ? 'insert' : 'replace';

    return {
        id: operation.id,
        entityTypeName: 'operation',
        documentTypeLabel:
            documentationEntityConfig.operation.documentTypeLabel,
        code: getFarmerDocumentationCode('operation', operation.id),
        label: getOperationLabel(operation),
        appPath: `/operations/${operation.id}`,
        summaryRows: compactRows([
            ['Kod', getFarmerDocumentationCode('operation', operation.id)],
            ['Vrsta', documentationEntityConfig.operation.documentTypeLabel],
            ['Trajanje', operationDurationLabel(operation)],
            ['Dokaz fotografijom', operationPhotoProofLabel(operation)],
            [
                'Promjena',
                changedAt
                    ? formatDocumentationDateTime(changedAt)
                    : 'Cijeli prirucnik',
            ],
        ]),
        sections: [
            documentationSection('Opis', [
                operation.information?.description?.trim() ||
                    'Opis nije definiran.',
            ]),
            documentationSection('Upute', [
                operation.information?.instructions?.trim() ||
                    'Upute nisu definirane.',
            ]),
            documentationSection(
                'Podaci radnje',
                operationAttributes(operation).map(
                    (attribute) => `${attribute.label}: ${attribute.value}`,
                ),
            ),
        ].filter((section): section is FarmerDocumentationSection =>
            Boolean(section),
        ),
        changedAt,
        changeType,
        revisionActions: revisionActionSummary(revisions, 'operation'),
    };
}

function toDocumentationPlantSort(
    plantSort: EntityStandardized,
    revisions: FarmerDocumentationRevision[],
    since: Date | null,
): FarmerDocumentationPlantSort {
    const plant = getPlantSortPlant(plantSort);
    const plantInformation = recordProperty(plant, 'information');
    const latinName = textProperty(plantInformation, 'latinName');
    const plantLabel = getPlantLabel(plant);
    const changedAt =
        revisions.length > 0 ? latestRevisionDate(revisions) : null;
    const changeType = isInsertPage(revisions, since) ? 'insert' : 'replace';

    return {
        id: plantSort.id,
        entityTypeName: 'plantSort',
        documentTypeLabel:
            documentationEntityConfig.plantSort.documentTypeLabel,
        code: getFarmerDocumentationCode('plantSort', plantSort.id),
        label: getPlantSortLabel(plantSort),
        appPath: `/plants/${plantSort.id}`,
        summaryRows: compactRows([
            ['Kod', getFarmerDocumentationCode('plantSort', plantSort.id)],
            ['Vrsta', documentationEntityConfig.plantSort.documentTypeLabel],
            ['Biljka', plantLabel],
            ['Latinski naziv', latinName],
            [
                'Promjena',
                changedAt
                    ? formatDocumentationDateTime(changedAt)
                    : 'Cijeli prirucnik',
            ],
        ]),
        sections: plantSortSections(plantSort),
        changedAt,
        changeType,
        revisionActions: revisionActionSummary(revisions, 'plantSort'),
    };
}

function getOperationLabel(operation: EntityStandardized) {
    return (
        operation.information?.label?.trim() ||
        operation.information?.name?.trim() ||
        `${documentationEntityConfig.operation.fallbackLabel} #${operation.id}`
    );
}

function getPlantSortLabel(plantSort: EntityStandardized) {
    return (
        plantSort.information?.label?.trim() ||
        plantSort.information?.name?.trim() ||
        `${documentationEntityConfig.plantSort.fallbackLabel} #${plantSort.id}`
    );
}

function getPlantSortPlant(plantSort: EntityStandardized) {
    return plantSort.information?.plant ?? null;
}

function getPlantLabel(plant: EntityStandardized | null) {
    return (
        plant?.information?.label?.trim() ||
        plant?.information?.name?.trim() ||
        null
    );
}

function operationDurationLabel(operation: EntityStandardized) {
    const duration = operation.attributes?.duration;
    const minutes =
        typeof duration === 'number'
            ? duration
            : typeof duration === 'string'
              ? Number.parseInt(duration, 10)
              : 0;

    if (!Number.isFinite(minutes) || minutes <= 0) {
        return 'Nije definirano';
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (hours > 0 && remainingMinutes > 0) {
        return `${hours} h ${remainingMinutes} min`;
    }
    if (hours > 0) {
        return `${hours} h`;
    }
    return `${minutes} min`;
}

function operationPhotoProofLabel(operation: EntityStandardized) {
    if (!operation.conditions?.completionAttachImages) {
        return 'Nije potrebno';
    }

    return operation.conditions.completionAttachImagesRequired
        ? 'Obavezno priloziti fotografije'
        : 'Preporuceno priloziti fotografije';
}

function operationAttributes(operation: EntityStandardized) {
    return Object.entries(operation.attributes ?? {})
        .filter(
            ([attributeName, attributeValue]) =>
                attributeName !== 'duration' &&
                attributeValue !== null &&
                attributeValue !== undefined,
        )
        .map(([attributeName, attributeValue]) => ({
            label: formatAttributeLabel(attributeName),
            value: formatAttributeValue(attributeValue, attributeName),
        }))
        .filter(
            (attribute): attribute is FarmerDocumentationAttribute =>
                attribute.value !== null,
        );
}

function plantSortSections(plantSort: EntityStandardized) {
    const plant = getPlantSortPlant(plantSort);
    const sortInformation = isRecord(plantSort.information)
        ? plantSort.information
        : null;
    const plantInformation = recordProperty(plant, 'information');
    const plantAttributes = recordProperty(plant, 'attributes');
    const plantCalendar = recordProperty(plant, 'calendar');
    const sortAttributes = isRecord(plantSort.attributes)
        ? plantSort.attributes
        : null;

    return [
        ...plantSortTextFields
            .map(({ key, title }) => {
                const text =
                    textProperty(sortInformation, key) ??
                    textProperty(plantInformation, key);

                return documentationSection(title, text ? [text] : []);
            })
            .filter((section): section is FarmerDocumentationSection =>
                Boolean(section),
            ),
        detailSection('Sorta', buildSortRows(sortAttributes)),
        detailSection('Sjetva', buildSowingRows(plantAttributes)),
        detailSection('Rast', buildGrowthRows(plantAttributes)),
        detailSection('Zalijevanje', buildWateringRows(plantAttributes)),
        detailSection('Berba', buildHarvestRows(plantAttributes)),
        detailSection('Kalendar uzgoja', buildCalendarRows(plantCalendar)),
    ].filter((section): section is FarmerDocumentationSection =>
        Boolean(section),
    );
}

function buildSortRows(attributes: Record<string, unknown> | null) {
    const reproductionType = stringProperty(attributes, 'reproductionType');

    return compactRows([
        [
            'Vrsta reprodukcije',
            reproductionType
                ? (reproductionTypeLabels[reproductionType] ?? reproductionType)
                : null,
        ],
    ]);
}

function buildSowingRows(attributes: Record<string, unknown> | null) {
    const seedingDistance = numberProperty(attributes, 'seedingDistance');
    const totalPlants =
        seedingDistance == null
            ? null
            : calculatePlantsPerField(seedingDistance).totalPlants;
    const germinationTemperature = numberProperty(
        attributes,
        'gernimationTemperature',
    );

    return compactRows([
        [
            `Broj biljaka na ${FIELD_SIZE_LABEL}`,
            totalPlants == null ? null : formatInteger(totalPlants),
        ],
        [
            'Razmak sijanja/sadnje',
            seedingDistance == null
                ? null
                : `${formatNumber(seedingDistance)} cm`,
        ],
        [
            'Dubina sijanja',
            numberProperty(attributes, 'seedingDepth') == null
                ? null
                : `${formatNumber(numberProperty(attributes, 'seedingDepth') ?? 0)} cm`,
        ],
        ['Klijanje', stringProperty(attributes, 'germinationType')],
        [
            'Temperatura klijanja',
            germinationTemperature == null
                ? null
                : `${formatNumber(germinationTemperature)} C`,
        ],
        [
            'Vrijeme klijanja',
            formatDayRange(
                numberProperty(attributes, 'germinationWindowMin'),
                numberProperty(attributes, 'germinationWindowMax'),
            ),
        ],
    ]);
}

function buildGrowthRows(attributes: Record<string, unknown> | null) {
    return compactRows([
        ['Svjetlost', formatLight(numberProperty(attributes, 'light'))],
        ['Zemlja', stringProperty(attributes, 'soil')],
        ['Nutrijenti', stringProperty(attributes, 'nutrients')],
        [
            'Vrijeme rasta',
            formatDayRange(
                numberProperty(attributes, 'growthWindowMin'),
                numberProperty(attributes, 'growthWindowMax'),
            ),
        ],
    ]);
}

function buildWateringRows(attributes: Record<string, unknown> | null) {
    return compactRows([['Voda', stringProperty(attributes, 'water')]]);
}

function buildHarvestRows(attributes: Record<string, unknown> | null) {
    const yieldMin = numberProperty(attributes, 'yieldMin');
    const yieldMax = numberProperty(attributes, 'yieldMax');
    const yieldType = stringProperty(attributes, 'yieldType');
    const yieldRange = formatWeightRange(yieldMin, yieldMax);
    const cleanHarvest = booleanProperty(attributes, 'cleanHarvest');

    return compactRows([
        [
            'Vrijeme berbe',
            formatDayRange(
                numberProperty(attributes, 'harvestWindowMin'),
                numberProperty(attributes, 'harvestWindowMax'),
            ),
        ],
        [
            'Ocekivani prinos',
            yieldRange
                ? `${yieldRange} ${yieldType === 'perPlant' ? 'po biljci' : 'po polju'}`
                : null,
        ],
        [
            'Nakon berbe',
            cleanHarvest == null
                ? null
                : getHarvestPlantRemovalDisclaimer(cleanHarvest),
        ],
    ]);
}

function buildCalendarRows(calendar: Record<string, unknown> | null) {
    if (!calendar) {
        return [];
    }

    return calendarDetails
        .map(({ key, title }) => [title, formatCalendarValue(calendar[key])])
        .filter(
            (row): row is [string, string] =>
                typeof row[1] === 'string' && row[1].trim().length > 0,
        )
        .map(([label, value]) => ({ label, value }));
}

function documentationSection(title: string, lines: string[]) {
    const visibleLines = lines
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

    return visibleLines.length > 0 ? { title, lines: visibleLines } : null;
}

function detailSection(title: string, rows: FarmerDocumentationAttribute[]) {
    return documentationSection(
        title,
        rows.map((row) => `${row.label}: ${row.value}`),
    );
}

function compactRows(
    rows: Array<[label: string, value: string | null | undefined]>,
) {
    return rows
        .filter(
            (row): row is [string, string] =>
                typeof row[1] === 'string' && row[1].trim().length > 0,
        )
        .map(([label, value]) => ({ label, value }));
}

function formatAttributeLabel(attributeName: string) {
    return (
        operationAttributeLabels[attributeName] ??
        attributeName
            .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
            .replace(/^./, (value) => value.toUpperCase())
    );
}

function formatAttributeValue(value: unknown, attributeName: string) {
    if (typeof value === 'boolean') {
        return value ? 'Da' : 'Ne';
    }

    if (typeof value === 'number') {
        return value.toLocaleString('hr-HR');
    }

    if (typeof value === 'string') {
        return operationAttributeValueLabels[attributeName]?.[value] ?? value;
    }

    if (value && typeof value === 'object') {
        const information = Reflect.get(value, 'information');
        if (information && typeof information === 'object') {
            const label = Reflect.get(information, 'label');
            const name = Reflect.get(information, 'name');
            if (typeof label === 'string' && label.trim()) {
                return label;
            }
            if (typeof name === 'string' && name.trim()) {
                return name;
            }
        }
    }

    return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function recordProperty(value: unknown, propertyName: string) {
    if (!isRecord(value)) {
        return null;
    }

    const propertyValue = value[propertyName];
    return isRecord(propertyValue) ? propertyValue : null;
}

function textProperty(value: unknown, propertyName: string) {
    if (!isRecord(value)) {
        return null;
    }

    const propertyValue = value[propertyName];
    return typeof propertyValue === 'string' && propertyValue.trim()
        ? propertyValue
        : null;
}

function numberProperty(value: Record<string, unknown> | null, key: string) {
    const propertyValue = value?.[key];
    return typeof propertyValue === 'number' && !Number.isNaN(propertyValue)
        ? propertyValue
        : null;
}

function stringProperty(value: Record<string, unknown> | null, key: string) {
    const propertyValue = value?.[key];
    return typeof propertyValue === 'string' && propertyValue.trim()
        ? propertyValue
        : null;
}

function booleanProperty(value: Record<string, unknown> | null, key: string) {
    const propertyValue = value?.[key];
    return typeof propertyValue === 'boolean' ? propertyValue : null;
}

function formatInteger(value: number) {
    return value.toLocaleString('hr-HR', { maximumFractionDigits: 0 });
}

function formatNumber(value: number) {
    return value.toLocaleString('hr-HR');
}

function formatDayRange(min: number | null, max: number | null) {
    if (min == null && max == null) {
        return null;
    }

    if (min != null && max != null) {
        if (min === max) {
            return `${formatNumber(min)} ${min === 1 ? 'dan' : 'dana'}`;
        }

        return `${formatNumber(min)}-${formatNumber(max)} dana`;
    }

    const value = min ?? max;
    return value == null
        ? null
        : `${formatNumber(value)} ${value === 1 ? 'dan' : 'dana'}`;
}

function formatWeightRange(min: number | null, max: number | null) {
    if (min == null && max == null) {
        return null;
    }

    if (min != null && max != null) {
        if (min === max) {
            return `${formatNumber(min)} g`;
        }

        return `${formatNumber(min)}-${formatNumber(max)} g`;
    }

    const value = min ?? max;
    return value == null ? null : `${formatNumber(value)} g`;
}

function formatLight(value: number | null) {
    if (value == null) {
        return null;
    }

    if (value >= 0.7) {
        return 'Sunce';
    }

    if (value >= 0.3) {
        return 'Polusjena';
    }

    return 'Hlad';
}

function formatMonthPoint(value: number) {
    const monthIndex = Math.floor(value) - 1;
    const monthName = monthNames[monthIndex];

    if (!monthName) {
        return formatNumber(value);
    }

    return value % 1 === 0 ? monthName : `sredina ${monthName}`;
}

function formatCalendarPeriod(value: unknown) {
    if (!isRecord(value)) {
        return null;
    }

    const start = numberProperty(value, 'start');
    const end = numberProperty(value, 'end');

    if (start == null && end == null) {
        return null;
    }

    if (start != null && end != null) {
        const formattedStart = formatMonthPoint(start);
        const formattedEnd = formatMonthPoint(end);
        return formattedStart === formattedEnd
            ? formattedStart
            : `${formattedStart} - ${formattedEnd}`;
    }

    return formatMonthPoint(start ?? end ?? 0);
}

function formatCalendarValue(value: unknown) {
    if (!Array.isArray(value)) {
        return null;
    }

    const periods = value
        .map((period) => formatCalendarPeriod(period))
        .filter((period): period is string => Boolean(period));

    if (periods.length === 0) {
        return null;
    }

    return periods.join('; ');
}

function isInsertPage(
    revisions: FarmerDocumentationRevision[],
    since: Date | null,
) {
    if (!since) {
        return false;
    }

    return revisions.some(
        (revision) =>
            revision.action === 'entity.created' ||
            (revision.action === 'entity.state_changed' &&
                revision.nextState === 'published' &&
                revision.previousState !== 'published'),
    );
}

function isDiscardRevision(revision: FarmerDocumentationRevision) {
    return (
        revision.action === 'entity.deleted' ||
        (revision.action === 'entity.state_changed' &&
            revision.previousState === 'published' &&
            revision.nextState !== 'published')
    );
}

function revisionEntityLabel(
    entityTypeName: FarmerDocumentationEntityTypeName,
    entityId: number,
    revisions: FarmerDocumentationRevision[],
    labelAttributeDefinitionIds: ReadonlySet<number>,
) {
    for (const revision of revisions) {
        if (
            revision.attributeDefinitionId &&
            labelAttributeDefinitionIds.has(revision.attributeDefinitionId)
        ) {
            const label = revision.nextValue || revision.previousValue;
            if (label?.trim()) {
                return label;
            }
        }
    }

    return `${documentationEntityConfig[entityTypeName].fallbackLabel} #${entityId}`;
}

function latestRevisionDate(revisions: FarmerDocumentationRevision[]) {
    return revisions.reduce(
        (latest, revision) =>
            revision.createdAt > latest ? revision.createdAt : latest,
        revisions[0]?.createdAt ?? new Date(0),
    );
}

function revisionActionSummary(
    revisions: FarmerDocumentationRevision[],
    entityTypeName: FarmerDocumentationEntityTypeName,
) {
    const noun = documentationEntityConfig[entityTypeName].noun;

    return Array.from(
        new Set(
            revisions.map((revision) => {
                switch (revision.action) {
                    case 'attribute.created':
                        return 'dodani podaci';
                    case 'attribute.deleted':
                        return 'uklonjeni podaci';
                    case 'attribute.updated':
                        return 'promijenjeni podaci';
                    case 'entity.created':
                        return `nova ${noun}`;
                    case 'entity.deleted':
                        return `obrisana ${noun}`;
                    case 'entity.state_changed':
                        return 'promijenjen status';
                    case 'entity.updated':
                        return `azurirana ${noun}`;
                    default:
                        return revision.action;
                }
            }),
        ),
    );
}

function compareDocumentationPage(
    left: { code: string },
    right: { code: string },
) {
    return left.code.localeCompare(right.code, 'hr', { numeric: true });
}
