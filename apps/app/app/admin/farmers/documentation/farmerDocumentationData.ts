import 'server-only';

import {
    calculatePlantsPerField,
    FIELD_SIZE_LABEL,
    getHarvestPlantRemovalDisclaimer,
} from '@gredice/js/plants';
import {
    type EntityStandardized,
    entityRevisions,
    getAllOperationPrices,
    getAttributeDefinitions,
    getEntitiesFormatted,
    getFarms,
    type SelectEntityRevision,
    type SelectFarm,
    type SelectOperationPrice,
    storage,
} from '@gredice/storage';
import { and, desc, gte, inArray } from 'drizzle-orm';
import { isMissingPayoutSchemaError } from '../payoutSchemaStatus';

export type FarmerDocumentationChangeType = 'insert' | 'replace' | 'discard';
export type FarmerDocumentationEntityTypeName =
    | 'operation'
    | 'plant'
    | 'plantSort';
export type FarmerDocumentationPageEntityTypeName = 'operation' | 'plant';
export type FarmerDocumentationPackageContent = 'all' | 'operations' | 'plants';

export type FarmerDocumentationAttribute = {
    label: string;
    value: string;
};

export type FarmerDocumentationSectionLayout = 'compactAttributes';

export type FarmerDocumentationSection = {
    title: string;
    lines: string[];
    layout?: FarmerDocumentationSectionLayout;
    attributes?: FarmerDocumentationAttribute[];
};

export type FarmerDocumentationImage = {
    label: string;
    url: string;
};

export type FarmerDocumentationPage = {
    id: number;
    entityTypeName: FarmerDocumentationPageEntityTypeName;
    documentTypeLabel: string;
    code: string;
    label: string;
    appPath: string;
    images: FarmerDocumentationImage[];
    summaryRows: FarmerDocumentationAttribute[];
    sections: FarmerDocumentationSection[];
    changedAt: Date | null;
    changeType: Exclude<FarmerDocumentationChangeType, 'discard'>;
    revisionActions: string[];
};

export type FarmerDocumentationOperation = FarmerDocumentationPage & {
    entityTypeName: 'operation';
};

export type FarmerDocumentationPlant = FarmerDocumentationPage & {
    entityTypeName: 'plant';
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

export type FarmerDocumentationPayoutPriceRow = {
    code: string;
    label: string;
    sublabel: string | null;
    userFacingPriceLabel: string;
    durationLabel: string;
    farmerPriceLabel: string;
    farmerPricePerMinuteLabel: string;
    hasFarmerPrice: boolean;
};

export type FarmerDocumentationPayoutPriceFarm = {
    farmId: number;
    farmName: string;
    rows: FarmerDocumentationPayoutPriceRow[];
};

export type FarmerDocumentationPayoutPrices = {
    schemaAvailable: boolean;
    farms: FarmerDocumentationPayoutPriceFarm[];
    totalRows: number;
    configuredRows: number;
    missingRows: number;
};

export type FarmerDocumentationPackage = {
    since: Date | null;
    generatedAt: Date;
    totalOperations: number;
    totalPlants: number;
    totalPlantSorts: number;
    currentOperations: FarmerDocumentationOperation[];
    currentPlants: FarmerDocumentationPlant[];
    includedOperations: FarmerDocumentationOperation[];
    includedPlants: FarmerDocumentationPlant[];
    discardedOperations: FarmerDocumentationDiscard[];
    discardedPlants: FarmerDocumentationDiscard[];
    discardedPlantSorts: FarmerDocumentationDiscard[];
    payoutPrices: FarmerDocumentationPayoutPrices;
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
    'plant',
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
    plant: {
        codePrefix: 'PL',
        documentTypeLabel: 'Biljka',
        fallbackLabel: 'Biljka',
        noun: 'biljka',
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
    frequency: 'Učestalost',
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
        recurring: 'Ponavljajuće',
        required: 'Obavezno',
    },
};

const reproductionTypeLabels: Record<string, string> = {
    bulb: 'Lukovica',
    seed: 'Sjeme',
};

const monthNames = [
    'siječanj',
    'veljača',
    'ožujak',
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
    { key: 'maintenance', title: 'Održavanje' },
    { key: 'watering', title: 'Zalijevanje' },
    { key: 'flowering', title: 'Cvatnja' },
    { key: 'harvest', title: 'Berba' },
    { key: 'storage', title: 'Čuvanje' },
    { key: 'origin', title: 'Podrijetlo' },
];

const plantTextFields = plantSortTextFields.filter(
    ({ key }) => key !== 'origin',
);

const calendarDetails = [
    { key: 'propagating', title: 'Sjetva u zatvorenom' },
    { key: 'sowing', title: 'Sjetva na otvorenom' },
    { key: 'planting', title: 'Presađivanje' },
    { key: 'harvest', title: 'Berba' },
];

const payoutPriceSyntheticRows: Array<{
    code: string;
    entityTypeName: string;
    entityId: null;
    label: string;
    sublabel: string;
    userFacingPriceNote: string;
}> = [
    {
        code: 'SOW-DIRECT',
        entityTypeName: 'sowing',
        entityId: null,
        label: 'Sijanje (direktno)',
        sublabel: 'sowing',
        userFacingPriceNote: 'prema cijeni biljke',
    },
    {
        code: 'SOW-GREENHOUSE',
        entityTypeName: 'sowingGreenhouse',
        entityId: null,
        label: 'Sijanje (staklenički rasad)',
        sublabel: 'sowingGreenhouse',
        userFacingPriceNote: 'prema cijeni biljke',
    },
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

export function parseDocumentationPackageContent(
    value: string | null | undefined,
): FarmerDocumentationPackageContent {
    switch (value?.trim()) {
        case 'operations':
            return 'operations';
        case 'plants':
        case 'plants-sorts':
        case 'plant-sorts':
        case 'plantSorts':
            return 'plants';
        default:
            return 'all';
    }
}

export function documentationPackageContentQueryValue(
    content: FarmerDocumentationPackageContent,
) {
    switch (content) {
        case 'all':
            return 'all';
        case 'operations':
            return 'operations';
        case 'plants':
            return 'plants';
    }
}

export function includedDocumentationPages(
    documentationPackage: FarmerDocumentationPackage,
    content: FarmerDocumentationPackageContent = 'all',
) {
    return filterDocumentationPagesByContent(
        [
            ...documentationPackage.includedOperations,
            ...documentationPackage.includedPlants,
        ],
        content,
    ).sort(compareDocumentationPage);
}

export function currentDocumentationPages(
    documentationPackage: FarmerDocumentationPackage,
    content: FarmerDocumentationPackageContent = 'all',
) {
    return filterDocumentationPagesByContent(
        [
            ...documentationPackage.currentOperations,
            ...documentationPackage.currentPlants,
        ],
        content,
    ).sort(compareDocumentationPage);
}

export function discardedDocumentationPages(
    documentationPackage: FarmerDocumentationPackage,
    content: FarmerDocumentationPackageContent = 'all',
) {
    return filterDocumentationPagesByContent(
        [
            ...documentationPackage.discardedOperations,
            ...documentationPackage.discardedPlants,
            ...documentationPackage.discardedPlantSorts,
        ],
        content,
    ).sort(compareDocumentationPage);
}

export async function getFarmerDocumentationPackage({
    since,
}: {
    since: Date | null;
}): Promise<FarmerDocumentationPackage> {
    const [
        operations,
        plants,
        plantSorts,
        revisions,
        operationAttributeDefinitions,
        plantAttributeDefinitions,
        plantSortAttributeDefinitions,
        farms,
        operationPrices,
    ] = await Promise.all([
        getEntitiesFormatted<EntityStandardized>('operation').catch(
            (): EntityStandardized[] => [],
        ),
        getEntitiesFormatted<EntityStandardized>('plant').catch(
            (): EntityStandardized[] => [],
        ),
        getEntitiesFormatted<EntityStandardized>('plantSort').catch(
            (): EntityStandardized[] => [],
        ),
        getDocumentationRevisionsSince(since),
        getAttributeDefinitions('operation').catch(() => []),
        getAttributeDefinitions('plant').catch(() => []),
        getAttributeDefinitions('plantSort').catch(() => []),
        getFarms(),
        getOperationPricesForDocumentation(),
    ]);

    return buildFarmerDocumentationPackage({
        operations,
        plants,
        plantSorts,
        revisions,
        labelAttributeDefinitionIds: {
            operation: labelAttributeDefinitionIds(
                operationAttributeDefinitions,
            ),
            plant: labelAttributeDefinitionIds(plantAttributeDefinitions),
            plantSort: labelAttributeDefinitionIds(
                plantSortAttributeDefinitions,
            ),
        },
        plantSortPlantAttributeDefinitionIds:
            plantSortPlantAttributeDefinitionIds(plantSortAttributeDefinitions),
        generatedAt: new Date(),
        farms,
        operationPrices: operationPrices.prices,
        operationPricesSchemaAvailable: operationPrices.schemaAvailable,
        since,
    });
}

export function buildFarmerDocumentationPackage({
    generatedAt,
    labelAttributeDefinitionIds,
    farms = [],
    operations,
    operationPrices = [],
    operationPricesSchemaAvailable = true,
    plants,
    plantSorts,
    plantSortPlantAttributeDefinitionIds,
    revisions,
    since,
}: {
    generatedAt: Date;
    labelAttributeDefinitionIds: Record<
        FarmerDocumentationEntityTypeName,
        ReadonlySet<number>
    >;
    farms?: SelectFarm[];
    operations: EntityStandardized[];
    operationPrices?: SelectOperationPrice[];
    operationPricesSchemaAvailable?: boolean;
    plants: EntityStandardized[];
    plantSorts: EntityStandardized[];
    plantSortPlantAttributeDefinitionIds: ReadonlySet<number>;
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
    const sortedPlants = plantsWithReferencedSortPlants(
        plants,
        sortedPlantSorts,
    ).sort((left, right) =>
        getPlantLabel(left).localeCompare(getPlantLabel(right), 'hr', {
            numeric: true,
        }),
    );
    const plantSortsByPlantId = groupPlantSortsByPlantId(sortedPlantSorts);
    const plantSortsById = new Map(
        sortedPlantSorts.map((plantSort) => [plantSort.id, plantSort]),
    );
    const revisionsByEntityKey = groupRevisionsByEntityKey(revisions);
    const movedPlantSortsByPreviousPlantId =
        groupMovedPlantSortsByPreviousPlantId({
            plantSortsById,
            plantSortPlantAttributeDefinitionIds,
            revisions,
        });
    const currentOperations = sortedOperations.map((operation) =>
        toDocumentationOperation(
            operation,
            revisionsByEntityKey.get(
                documentationEntityKey('operation', operation.id),
            ) ?? [],
            since,
        ),
    );
    const currentPlants = sortedPlants.map((plant) =>
        toDocumentationPlant({
            plant,
            plantSorts: plantSortsByPlantId.get(plant.id) ?? [],
            plantRevisions:
                revisionsByEntityKey.get(
                    documentationEntityKey('plant', plant.id),
                ) ?? [],
            plantSortRevisions: plantSortRevisionsForPlant({
                plantId: plant.id,
                plantSorts: plantSortsByPlantId.get(plant.id) ?? [],
                revisionsByEntityKey,
                movedPlantSortsByPreviousPlantId,
            }),
            since,
        }),
    );
    const includedOperations = currentOperations.filter((operation) =>
        shouldIncludeCurrentEntity(
            operation,
            'operation',
            since,
            revisionsByEntityKey,
        ),
    );
    const includedPlants = currentPlants.filter((plant) =>
        shouldIncludeCurrentPlant(
            plant,
            plantSortsByPlantId.get(plant.id) ?? [],
            since,
            revisionsByEntityKey,
            movedPlantSortsByPreviousPlantId,
        ),
    );

    return {
        since,
        generatedAt,
        totalOperations: sortedOperations.length,
        totalPlants: sortedPlants.length,
        totalPlantSorts: sortedPlantSorts.length,
        currentOperations,
        currentPlants,
        includedOperations,
        includedPlants,
        discardedOperations: discardedPagesForType({
            currentEntities: sortedOperations,
            entityTypeName: 'operation',
            labelAttributeDefinitionIds: labelAttributeDefinitionIds.operation,
            revisionsByEntityKey,
        }),
        discardedPlants: discardedPagesForType({
            currentEntities: sortedPlants,
            entityTypeName: 'plant',
            labelAttributeDefinitionIds: labelAttributeDefinitionIds.plant,
            revisionsByEntityKey,
        }),
        discardedPlantSorts: discardedPagesForType({
            currentEntities: sortedPlantSorts,
            entityTypeName: 'plantSort',
            labelAttributeDefinitionIds: labelAttributeDefinitionIds.plantSort,
            revisionsByEntityKey,
        }),
        payoutPrices: buildPayoutPriceDocumentation({
            farms,
            operations: sortedOperations,
            operationPrices,
            plants: sortedPlants,
            schemaAvailable: operationPricesSchemaAvailable,
        }),
    };
}

async function getOperationPricesForDocumentation(): Promise<{
    prices: SelectOperationPrice[];
    schemaAvailable: boolean;
}> {
    try {
        return {
            prices: await getAllOperationPrices(),
            schemaAvailable: true,
        };
    } catch (error) {
        if (!isMissingPayoutSchemaError(error)) {
            throw error;
        }

        console.warn(
            'Operation price tables are not available for farmer documentation.',
        );
        return {
            prices: [],
            schemaAvailable: false,
        };
    }
}

function buildPayoutPriceDocumentation({
    farms,
    operations,
    operationPrices,
    plants,
    schemaAvailable,
}: {
    farms: SelectFarm[];
    operations: EntityStandardized[];
    operationPrices: SelectOperationPrice[];
    plants: EntityStandardized[];
    schemaAvailable: boolean;
}): FarmerDocumentationPayoutPrices {
    if (!schemaAvailable) {
        return {
            schemaAvailable: false,
            farms: [],
            totalRows: 0,
            configuredRows: 0,
            missingRows: 0,
        };
    }

    const operationPriceByKey = new Map(
        operationPrices.map((price) => [
            operationPriceKey(
                price.farmId,
                price.entityTypeName,
                price.entityId,
            ),
            price,
        ]),
    );
    const plantPriceRange = plantPriceRangeLabel(plants);
    const payoutPriceFarms = farms.map((farm) => {
        const syntheticRows = payoutPriceSyntheticRows.map((row) =>
            syntheticPayoutPriceRow({
                plantPriceRange,
                price: operationPriceByKey.get(
                    operationPriceKey(
                        farm.id,
                        row.entityTypeName,
                        row.entityId,
                    ),
                ),
                row,
            }),
        );
        const operationRows = operations.map((operation) =>
            operationPayoutPriceRow({
                operation,
                price: operationPriceByKey.get(
                    operationPriceKey(farm.id, 'operation', operation.id),
                ),
            }),
        );

        return {
            farmId: farm.id,
            farmName: farm.name,
            rows: [...syntheticRows, ...operationRows],
        };
    });
    const allRows = payoutPriceFarms.flatMap((farm) => farm.rows);
    const configuredRows = allRows.filter((row) => row.hasFarmerPrice).length;

    return {
        schemaAvailable: true,
        farms: payoutPriceFarms,
        totalRows: allRows.length,
        configuredRows,
        missingRows: allRows.length - configuredRows,
    };
}

function syntheticPayoutPriceRow({
    plantPriceRange,
    price,
    row,
}: {
    plantPriceRange: string | null;
    price: SelectOperationPrice | undefined;
    row: (typeof payoutPriceSyntheticRows)[number];
}): FarmerDocumentationPayoutPriceRow {
    const farmerPrice = parseDecimalPrice(price?.pricePerUnit);

    return {
        code: row.code,
        label: row.label,
        sublabel: row.sublabel,
        userFacingPriceLabel: plantPriceRange
            ? `${plantPriceRange} (${row.userFacingPriceNote})`
            : row.userFacingPriceNote,
        durationLabel: 'Nije primjenjivo',
        farmerPriceLabel:
            farmerPrice === null
                ? 'Nije definirano'
                : formatEuroPrice(farmerPrice, price?.currency),
        farmerPricePerMinuteLabel: '-',
        hasFarmerPrice: farmerPrice !== null,
    };
}

function operationPayoutPriceRow({
    operation,
    price,
}: {
    operation: EntityStandardized;
    price: SelectOperationPrice | undefined;
}): FarmerDocumentationPayoutPriceRow {
    const farmerPrice = parseDecimalPrice(price?.pricePerUnit);
    const durationMinutes = operationDurationMinutes(operation);

    return {
        code: getFarmerDocumentationCode('operation', operation.id),
        label: getOperationLabel(operation),
        sublabel: operation.information?.name?.trim() || null,
        userFacingPriceLabel: operationPriceLabel(operation),
        durationLabel: operationDurationLabel(operation),
        farmerPriceLabel:
            farmerPrice === null
                ? 'Nije definirano'
                : formatEuroPrice(farmerPrice, price?.currency),
        farmerPricePerMinuteLabel:
            farmerPrice !== null && durationMinutes !== null
                ? `${formatEuroPrice(farmerPrice / durationMinutes, price?.currency)} / min`
                : '-',
        hasFarmerPrice: farmerPrice !== null,
    };
}

function operationPriceKey(
    farmId: number,
    entityTypeName: string,
    entityId: number | null,
) {
    return `${farmId}:${entityTypeName}:${entityId ?? 'null'}`;
}

function plantPriceRangeLabel(plants: EntityStandardized[]) {
    const prices = plants
        .map((plant) => plant.prices?.perPlant)
        .filter((price): price is number => Number.isFinite(price));

    if (prices.length === 0) {
        return null;
    }

    const min = Math.min(...prices);
    const max = Math.max(...prices);

    return min === max
        ? formatEuroPrice(min)
        : `${formatEuroPrice(min)} - ${formatEuroPrice(max)}`;
}

function parseDecimalPrice(value: string | undefined) {
    if (!value) {
        return null;
    }

    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function formatEuroPrice(value: number, currency = 'eur') {
    return `${value.toLocaleString('hr-HR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })} ${currency.toUpperCase()}`;
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

function plantSortPlantAttributeDefinitionIds(
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
                    definition.name === 'plant',
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
    if (value === 'operation' || value === 'plant' || value === 'plantSort') {
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

function shouldIncludeCurrentPlant(
    plant: { id: number },
    plantSorts: EntityStandardized[],
    since: Date | null,
    revisionsByEntityKey: ReadonlyMap<string, FarmerDocumentationRevision[]>,
    movedPlantSortsByPreviousPlantId: ReadonlyMap<number, ReadonlySet<number>>,
) {
    return (
        shouldIncludeCurrentEntity(
            plant,
            'plant',
            since,
            revisionsByEntityKey,
        ) ||
        movedPlantSortsByPreviousPlantId.has(plant.id) ||
        plantSorts.some((plantSort) =>
            revisionsByEntityKey.has(
                documentationEntityKey('plantSort', plantSort.id),
            ),
        )
    );
}

function filterDocumentationPagesByContent<
    T extends { entityTypeName: FarmerDocumentationEntityTypeName },
>(pages: T[], content: FarmerDocumentationPackageContent) {
    switch (content) {
        case 'all':
            return pages;
        case 'operations':
            return pages.filter((page) => page.entityTypeName === 'operation');
        case 'plants':
            return pages.filter(
                (page) =>
                    page.entityTypeName === 'plant' ||
                    page.entityTypeName === 'plantSort',
            );
    }
}

function plantsWithReferencedSortPlants(
    plants: EntityStandardized[],
    plantSorts: EntityStandardized[],
) {
    const plantsById = new Map(plants.map((plant) => [plant.id, plant]));

    for (const plantSort of plantSorts) {
        const plant = getPlantSortPlant(plantSort);
        if (plant && !plantsById.has(plant.id)) {
            plantsById.set(plant.id, plant);
        }
    }

    return Array.from(plantsById.values());
}

function groupPlantSortsByPlantId(plantSorts: EntityStandardized[]) {
    const plantSortsByPlantId = new Map<number, EntityStandardized[]>();

    for (const plantSort of plantSorts) {
        const plant = getPlantSortPlant(plantSort);
        if (!plant) {
            continue;
        }

        const plantSortsForPlant = plantSortsByPlantId.get(plant.id) ?? [];
        plantSortsForPlant.push(plantSort);
        plantSortsByPlantId.set(plant.id, plantSortsForPlant);
    }

    return plantSortsByPlantId;
}

function groupMovedPlantSortsByPreviousPlantId({
    plantSortsById,
    plantSortPlantAttributeDefinitionIds,
    revisions,
}: {
    plantSortsById: ReadonlyMap<number, EntityStandardized>;
    plantSortPlantAttributeDefinitionIds: ReadonlySet<number>;
    revisions: FarmerDocumentationRevision[];
}) {
    const movedPlantSortsByPreviousPlantId = new Map<number, Set<number>>();

    for (const revision of revisions) {
        if (
            revision.entityTypeName !== 'plantSort' ||
            !revision.attributeDefinitionId ||
            !plantSortPlantAttributeDefinitionIds.has(
                revision.attributeDefinitionId,
            ) ||
            !(
                revision.action === 'attribute.updated' ||
                revision.action === 'attribute.deleted'
            )
        ) {
            continue;
        }

        const previousPlantId = revisionEntityRefId(revision.previousValue);
        if (!previousPlantId) {
            continue;
        }

        const currentPlantSort = plantSortsById.get(revision.entityId);
        const currentPlantId =
            currentPlantSort && getPlantSortPlant(currentPlantSort)?.id;
        const nextPlantId =
            currentPlantId ?? revisionEntityRefId(revision.nextValue);
        if (nextPlantId === previousPlantId) {
            continue;
        }

        const movedSortIds =
            movedPlantSortsByPreviousPlantId.get(previousPlantId) ??
            new Set<number>();
        movedSortIds.add(revision.entityId);
        movedPlantSortsByPreviousPlantId.set(previousPlantId, movedSortIds);
    }

    return movedPlantSortsByPreviousPlantId;
}

function revisionEntityRefId(value: string | null) {
    const normalized = value?.trim();
    if (!normalized || !/^\d+$/.test(normalized)) {
        return null;
    }

    const parsed = Number.parseInt(normalized, 10);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function plantSortRevisionsForPlant({
    plantId,
    plantSorts,
    revisionsByEntityKey,
    movedPlantSortsByPreviousPlantId,
}: {
    plantId: number;
    plantSorts: EntityStandardized[];
    revisionsByEntityKey: ReadonlyMap<string, FarmerDocumentationRevision[]>;
    movedPlantSortsByPreviousPlantId: ReadonlyMap<number, ReadonlySet<number>>;
}) {
    const revisions = [
        ...plantSorts.flatMap(
            (plantSort) =>
                revisionsByEntityKey.get(
                    documentationEntityKey('plantSort', plantSort.id),
                ) ?? [],
        ),
        ...Array.from(
            movedPlantSortsByPreviousPlantId.get(plantId) ?? [],
        ).flatMap(
            (plantSortId) =>
                revisionsByEntityKey.get(
                    documentationEntityKey('plantSort', plantSortId),
                ) ?? [],
        ),
    ];

    return uniqueRevisions(revisions);
}

function uniqueRevisions(revisions: FarmerDocumentationRevision[]) {
    const unique = new Map<number, FarmerDocumentationRevision>();
    for (const revision of revisions) {
        unique.set(revision.id, revision);
    }

    return Array.from(unique.values());
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
        images: [],
        summaryRows: compactRows([
            ['Kod', getFarmerDocumentationCode('operation', operation.id)],
            ['Vrsta', documentationEntityConfig.operation.documentTypeLabel],
            ['Trajanje', operationDurationLabel(operation)],
            ['Cijena', operationPriceLabel(operation)],
            ['Dokaz fotografijom', operationPhotoProofLabel(operation)],
            [
                'Promjena',
                changedAt
                    ? formatDocumentationDateTime(changedAt)
                    : 'Cijeli priručnik',
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

function toDocumentationPlant({
    plant,
    plantRevisions,
    plantSortRevisions,
    plantSorts,
    since,
}: {
    plant: EntityStandardized;
    plantRevisions: FarmerDocumentationRevision[];
    plantSortRevisions: FarmerDocumentationRevision[];
    plantSorts: EntityStandardized[];
    since: Date | null;
}): FarmerDocumentationPlant {
    const plantInformation = recordProperty(plant, 'information');
    const latinName = textProperty(plantInformation, 'latinName');
    const origin = textProperty(plantInformation, 'origin');
    const revisions = [...plantRevisions, ...plantSortRevisions];
    const plantLabel = getPlantLabel(plant);
    const changedAt =
        revisions.length > 0 ? latestRevisionDate(revisions) : null;
    const changeType = isInsertPage(plantRevisions, since)
        ? 'insert'
        : 'replace';

    return {
        id: plant.id,
        entityTypeName: 'plant',
        documentTypeLabel: documentationEntityConfig.plant.documentTypeLabel,
        code: getFarmerDocumentationCode('plant', plant.id),
        label: plantLabel,
        appPath: '/plants',
        images: plantDocumentationImages(plant, plantSorts),
        summaryRows: compactRows([
            ['Kod', getFarmerDocumentationCode('plant', plant.id)],
            ['Vrsta', documentationEntityConfig.plant.documentTypeLabel],
            ['Latinski naziv', latinName],
            ['Podrijetlo', origin],
            ['Dostupnih sorti', formatInteger(plantSorts.length)],
            [
                'Promjena',
                changedAt
                    ? formatDocumentationDateTime(changedAt)
                    : 'Cijeli priručnik',
            ],
        ]),
        sections: plantSections(plant, plantSorts),
        changedAt,
        changeType,
        revisionActions: uniqueStrings([
            ...revisionActionSummary(plantRevisions, 'plant'),
            ...revisionActionSummary(plantSortRevisions, 'plantSort'),
        ]),
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

function getPlantLabel(plant: EntityStandardized) {
    return (
        plant?.information?.label?.trim() ||
        plant?.information?.name?.trim() ||
        `${documentationEntityConfig.plant.fallbackLabel} #${plant.id}`
    );
}

function plantDocumentationImages(
    plant: EntityStandardized,
    plantSorts: EntityStandardized[],
) {
    const images: FarmerDocumentationImage[] = [];
    const seenUrls = new Set<string>();
    const plantCoverUrl = entityCoverUrl(plant);

    if (plantCoverUrl) {
        images.push({
            label: `Biljka - ${getPlantLabel(plant)}`,
            url: plantCoverUrl,
        });
        seenUrls.add(plantCoverUrl);
    }

    for (const plantSort of plantSorts) {
        const sortCoverUrl = plantSortCoverUrl(plantSort);
        if (!sortCoverUrl || seenUrls.has(sortCoverUrl)) {
            continue;
        }

        images.push({
            label: `Sorta - ${getPlantSortLabel(plantSort)}`,
            url: sortCoverUrl,
        });
        seenUrls.add(sortCoverUrl);
    }

    return images;
}

function plantSortCoverUrl(plantSort: EntityStandardized) {
    return (
        entityCoverUrl(plantSort) ??
        entityCoverUrl(getPlantSortPlant(plantSort))
    );
}

function entityCoverUrl(entity: EntityStandardized | null | undefined) {
    const url = entity?.image?.cover?.url ?? entity?.images?.cover?.url;
    return typeof url === 'string' && url.trim().length > 0 ? url.trim() : null;
}

function operationDurationMinutes(operation: EntityStandardized) {
    const duration = operation.attributes?.duration;
    const minutes =
        typeof duration === 'number'
            ? duration
            : typeof duration === 'string'
              ? Number.parseFloat(duration)
              : 0;

    if (!Number.isFinite(minutes) || minutes <= 0) {
        return null;
    }

    return minutes;
}

function operationDurationLabel(operation: EntityStandardized) {
    const minutes = operationDurationMinutes(operation);

    if (minutes === null) {
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

function operationPriceLabel(operation: EntityStandardized) {
    const price = operation.prices?.perOperation;
    if (typeof price !== 'number' || !Number.isFinite(price)) {
        return 'Nije definirano';
    }

    return formatEuroPrice(price);
}

function operationPhotoProofLabel(operation: EntityStandardized) {
    if (!operation.conditions?.completionAttachImages) {
        return 'Nije potrebno';
    }

    return operation.conditions.completionAttachImagesRequired
        ? 'Obavezno priložiti fotografije'
        : 'Preporučeno priložiti fotografije';
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

function plantSections(
    plant: EntityStandardized,
    plantSorts: EntityStandardized[],
) {
    const plantInformation = recordProperty(plant, 'information');
    const plantAttributes = recordProperty(plant, 'attributes');
    const plantCalendar = recordProperty(plant, 'calendar');

    return [
        documentationSection(
            'Dostupne sorte',
            plantSorts.length > 0
                ? plantSorts.map(plantSortListLine)
                : ['Nema dostupnih sorti.'],
        ),
        ...plantTextFields
            .map(({ key, title }) => {
                const text = textProperty(plantInformation, key);

                return documentationSection(title, text ? [text] : []);
            })
            .filter((section): section is FarmerDocumentationSection =>
                Boolean(section),
            ),
        detailSection(
            'Sjetva',
            buildSowingRows(plantAttributes),
            'compactAttributes',
        ),
        detailSection(
            'Rast',
            buildGrowthRows(plantAttributes),
            'compactAttributes',
        ),
        detailSection(
            'Zalijevanje',
            buildWateringRows(plantAttributes),
            'compactAttributes',
        ),
        detailSection(
            'Berba',
            buildHarvestRows(plantAttributes),
            'compactAttributes',
        ),
        detailSection('Kalendar uzgoja', buildCalendarRows(plantCalendar)),
        ...plantSorts.map((plantSort) =>
            plantSortAdditionalSection(plantSort, plant),
        ),
    ].filter((section): section is FarmerDocumentationSection =>
        Boolean(section),
    );
}

function plantSortListLine(plantSort: EntityStandardized) {
    const sortAttributes = isRecord(plantSort.attributes)
        ? plantSort.attributes
        : null;
    const reproductionType = stringProperty(sortAttributes, 'reproductionType');
    const reproductionTypeLabel = reproductionType
        ? (reproductionTypeLabels[reproductionType] ?? reproductionType)
        : null;
    const detail = reproductionTypeLabel ? `, ${reproductionTypeLabel}` : '';

    return `${getFarmerDocumentationCode('plantSort', plantSort.id)} - ${getPlantSortLabel(plantSort)}${detail}`;
}

function plantSortAdditionalSection(
    plantSort: EntityStandardized,
    plant: EntityStandardized,
) {
    const sortInformation = isRecord(plantSort.information)
        ? plantSort.information
        : null;
    const plantInformation = recordProperty(plant, 'information');
    const lines = plantSortTextFields
        .map(({ key, title }) => {
            const sortText = textProperty(sortInformation, key);
            const plantText = textProperty(plantInformation, key);
            return sortText && sortText !== plantText
                ? `${title}: ${sortText}`
                : null;
        })
        .filter((line): line is string => Boolean(line));

    return documentationSection(
        `Dodatne informacije sorte - ${getPlantSortLabel(plantSort)}`,
        lines,
    );
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

function detailSection(
    title: string,
    rows: FarmerDocumentationAttribute[],
    layout?: FarmerDocumentationSectionLayout,
) {
    if (rows.length === 0) {
        return null;
    }

    const lines = rows.map((row) => `${row.label}: ${row.value}`);

    return layout
        ? {
              title,
              lines,
              layout,
              attributes: rows,
          }
        : documentationSection(title, lines);
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

function uniqueStrings(values: string[]) {
    return Array.from(new Set(values));
}

function compareDocumentationPage(
    left: { code: string; label: string },
    right: { code: string; label: string },
) {
    const labelComparison = left.label.localeCompare(right.label, 'hr', {
        numeric: true,
    });
    if (labelComparison !== 0) {
        return labelComparison;
    }

    return left.code.localeCompare(right.code, 'hr', { numeric: true });
}
