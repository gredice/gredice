export type CommunityEditControlType =
    | 'boolean'
    | 'json'
    | 'markdown'
    | 'number'
    | 'operationSuggestion'
    | 'range'
    | 'reference'
    | 'select'
    | 'text';

export type CommunityEditableFieldOption = {
    value: string;
    label: string;
    helpText?: string;
};

export type CommunityEditableFieldDefinition = {
    entityTypeName: string;
    fieldKey: string;
    sectionKey: string;
    category: string;
    name: string;
    publicLabel: string;
    helpText?: string;
    controlType: CommunityEditControlType;
    pageLevel: boolean;
    inline: boolean;
    allowJson?: boolean;
    maxLength?: number;
    operationSuggestionStage?: CommunityEditableOperationSuggestionStage;
    options?: CommunityEditableFieldOption[];
};

export type CommunityEditableSection = {
    key: string;
    label: string;
    fields: CommunityEditableFieldDefinition[];
};

export type CommunityEditableOperationSuggestionStage = {
    name: string;
    label: string;
};

export const communityEditablePlantOperationStages: CommunityEditableOperationSuggestionStage[] =
    [
        { name: 'sowing', label: 'Sjetva' },
        { name: 'growth', label: 'Rast' },
        { name: 'watering', label: 'Zalijevanje' },
        { name: 'harvest', label: 'Berba' },
        { name: 'storage', label: 'Skladištenje' },
    ];

const communityEditablePlantOperationFields: CommunityEditableFieldDefinition[] =
    communityEditablePlantOperationStages.map((stage) => ({
        entityTypeName: 'plant',
        fieldKey: `plant.stage-operations.${stage.name}`,
        sectionKey: stage.name,
        category: 'information',
        name: 'operations',
        publicLabel: `Radnje: ${stage.label}`,
        helpText:
            'Predloži dodavanje ili uklanjanje radnje koja se prikazuje u ovoj fazi biljke.',
        controlType: 'operationSuggestion',
        pageLevel: true,
        inline: true,
        operationSuggestionStage: stage,
    }));

const communityEditableFieldRegistry: CommunityEditableFieldDefinition[] = [
    {
        entityTypeName: 'plant',
        fieldKey: 'plant.name',
        sectionKey: 'overview',
        category: 'information',
        name: 'name',
        publicLabel: 'Naziv biljke',
        controlType: 'text',
        pageLevel: true,
        inline: true,
        maxLength: 200,
    },
    {
        entityTypeName: 'plant',
        fieldKey: 'plant.latin-name',
        sectionKey: 'overview',
        category: 'information',
        name: 'latinName',
        publicLabel: 'Latinski naziv',
        controlType: 'text',
        pageLevel: true,
        inline: true,
        maxLength: 200,
    },
    {
        entityTypeName: 'plant',
        fieldKey: 'plant.origin',
        sectionKey: 'overview',
        category: 'information',
        name: 'origin',
        publicLabel: 'Porijeklo',
        controlType: 'text',
        pageLevel: true,
        inline: true,
        maxLength: 500,
    },
    {
        entityTypeName: 'plant',
        fieldKey: 'plant.description',
        sectionKey: 'overview',
        category: 'information',
        name: 'description',
        publicLabel: 'Opis biljke',
        helpText: 'Kratak uvodni opis koji se prikazuje na stranici biljke.',
        controlType: 'markdown',
        pageLevel: true,
        inline: true,
        maxLength: 12000,
    },
    {
        entityTypeName: 'plant',
        fieldKey: 'plant.sowing',
        sectionKey: 'sowing',
        category: 'information',
        name: 'sowing',
        publicLabel: 'Sjetva',
        controlType: 'markdown',
        pageLevel: true,
        inline: true,
        maxLength: 16000,
    },
    {
        entityTypeName: 'plant',
        fieldKey: 'plant.growth',
        sectionKey: 'growth',
        category: 'information',
        name: 'growth',
        publicLabel: 'Rast',
        controlType: 'markdown',
        pageLevel: true,
        inline: true,
        maxLength: 16000,
    },
    {
        entityTypeName: 'plant',
        fieldKey: 'plant.watering',
        sectionKey: 'watering',
        category: 'information',
        name: 'watering',
        publicLabel: 'Zalijevanje',
        controlType: 'markdown',
        pageLevel: true,
        inline: true,
        maxLength: 16000,
    },
    {
        entityTypeName: 'plant',
        fieldKey: 'plant.harvest',
        sectionKey: 'harvest',
        category: 'information',
        name: 'harvest',
        publicLabel: 'Berba',
        controlType: 'markdown',
        pageLevel: true,
        inline: true,
        maxLength: 16000,
    },
    {
        entityTypeName: 'plant',
        fieldKey: 'plant.storage',
        sectionKey: 'storage',
        category: 'information',
        name: 'storage',
        publicLabel: 'Skladištenje',
        controlType: 'markdown',
        pageLevel: true,
        inline: true,
        maxLength: 16000,
    },
    {
        entityTypeName: 'plant',
        fieldKey: 'plant.seeding-distance',
        sectionKey: 'sowing',
        category: 'attributes',
        name: 'seedingDistance',
        publicLabel: 'Razmak sijanja/sadnje',
        helpText: 'Vrijednost u centimetrima.',
        controlType: 'number',
        pageLevel: true,
        inline: true,
    },
    {
        entityTypeName: 'plant',
        fieldKey: 'plant.seeding-depth',
        sectionKey: 'sowing',
        category: 'attributes',
        name: 'seedingDepth',
        publicLabel: 'Dubina sijanja',
        helpText: 'Vrijednost u centimetrima.',
        controlType: 'number',
        pageLevel: true,
        inline: true,
    },
    {
        entityTypeName: 'plant',
        fieldKey: 'plant.germination-type',
        sectionKey: 'sowing',
        category: 'attributes',
        name: 'germinationType',
        publicLabel: 'Klijanje',
        controlType: 'select',
        pageLevel: true,
        inline: true,
        options: [
            {
                value: 'Klijanje pod svijetlosti',
                label: 'Klijanje pod svijetlosti',
            },
            { value: 'Klijanje u mraku', label: 'Klijanje u mraku' },
        ],
    },
    {
        entityTypeName: 'plant',
        fieldKey: 'plant.germination-temperature',
        sectionKey: 'sowing',
        category: 'attributes',
        name: 'gernimationTemperature',
        publicLabel: 'Temperatura klijanja',
        helpText: 'Vrijednost u stupnjevima °C.',
        controlType: 'number',
        pageLevel: true,
        inline: true,
    },
    {
        entityTypeName: 'plant',
        fieldKey: 'plant.germination-window-min',
        sectionKey: 'sowing',
        category: 'attributes',
        name: 'germinationWindowMin',
        publicLabel: 'Najkraće vrijeme klijanja',
        helpText: 'Vrijednost u danima.',
        controlType: 'number',
        pageLevel: true,
        inline: true,
    },
    {
        entityTypeName: 'plant',
        fieldKey: 'plant.germination-window-max',
        sectionKey: 'sowing',
        category: 'attributes',
        name: 'germinationWindowMax',
        publicLabel: 'Najduže vrijeme klijanja',
        helpText: 'Vrijednost u danima.',
        controlType: 'number',
        pageLevel: true,
        inline: true,
    },
    {
        entityTypeName: 'plant',
        fieldKey: 'plant.light',
        sectionKey: 'growth',
        category: 'attributes',
        name: 'light',
        publicLabel: 'Svjetlost',
        controlType: 'select',
        pageLevel: true,
        inline: true,
        options: [
            { value: '1', label: 'Sunce' },
            { value: '0.5', label: 'Polu-sjena' },
            { value: '0', label: 'Hlad' },
        ],
    },
    {
        entityTypeName: 'plant',
        fieldKey: 'plant.soil',
        sectionKey: 'growth',
        category: 'attributes',
        name: 'soil',
        publicLabel: 'Zemlja',
        controlType: 'select',
        pageLevel: true,
        inline: true,
        options: [
            {
                value: 'Lagano (pješčano)',
                label: 'Lagano (pješčano)',
            },
            {
                value: 'Srednje (ilovasto)',
                label: 'Srednje (ilovasto)',
            },
            {
                value: 'Teško (glineno)',
                label: 'Teško (glineno)',
            },
        ],
    },
    {
        entityTypeName: 'plant',
        fieldKey: 'plant.nutrients',
        sectionKey: 'growth',
        category: 'attributes',
        name: 'nutrients',
        publicLabel: 'Nutrijenti',
        controlType: 'select',
        pageLevel: true,
        inline: true,
        options: [
            { value: 'Niske potrebe', label: 'Niske potrebe' },
            { value: 'Srednje potrebe', label: 'Srednje potrebe' },
            { value: 'Visoke potrebe', label: 'Visoke potrebe' },
        ],
    },
    {
        entityTypeName: 'plant',
        fieldKey: 'plant.growth-window-min',
        sectionKey: 'growth',
        category: 'attributes',
        name: 'growthWindowMin',
        publicLabel: 'Najkraće vrijeme rasta',
        helpText: 'Vrijednost u danima.',
        controlType: 'number',
        pageLevel: true,
        inline: true,
    },
    {
        entityTypeName: 'plant',
        fieldKey: 'plant.growth-window-max',
        sectionKey: 'growth',
        category: 'attributes',
        name: 'growthWindowMax',
        publicLabel: 'Najduže vrijeme rasta',
        helpText: 'Vrijednost u danima.',
        controlType: 'number',
        pageLevel: true,
        inline: true,
    },
    {
        entityTypeName: 'plant',
        fieldKey: 'plant.water',
        sectionKey: 'watering',
        category: 'attributes',
        name: 'water',
        publicLabel: 'Voda',
        controlType: 'select',
        pageLevel: true,
        inline: true,
        options: [
            { value: 'Suho tlo', label: 'Suho tlo' },
            { value: 'Vlažno tlo', label: 'Vlažno tlo' },
            { value: 'Mokro tlo', label: 'Mokro tlo' },
        ],
    },
    {
        entityTypeName: 'plant',
        fieldKey: 'plant.harvest-window-min',
        sectionKey: 'harvest',
        category: 'attributes',
        name: 'harvestWindowMin',
        publicLabel: 'Najranija berba',
        helpText: 'Vrijednost u danima.',
        controlType: 'number',
        pageLevel: true,
        inline: true,
    },
    {
        entityTypeName: 'plant',
        fieldKey: 'plant.harvest-window-max',
        sectionKey: 'harvest',
        category: 'attributes',
        name: 'harvestWindowMax',
        publicLabel: 'Najkasnija berba',
        helpText: 'Vrijednost u danima.',
        controlType: 'number',
        pageLevel: true,
        inline: true,
    },
    {
        entityTypeName: 'plant',
        fieldKey: 'plant.yield-min',
        sectionKey: 'harvest',
        category: 'attributes',
        name: 'yieldMin',
        publicLabel: 'Najmanji očekivani prinos',
        helpText: 'Vrijednost u gramima.',
        controlType: 'number',
        pageLevel: true,
        inline: true,
    },
    {
        entityTypeName: 'plant',
        fieldKey: 'plant.yield-max',
        sectionKey: 'harvest',
        category: 'attributes',
        name: 'yieldMax',
        publicLabel: 'Najveći očekivani prinos',
        helpText: 'Vrijednost u gramima.',
        controlType: 'number',
        pageLevel: true,
        inline: true,
    },
    {
        entityTypeName: 'plant',
        fieldKey: 'plant.yield-type',
        sectionKey: 'harvest',
        category: 'attributes',
        name: 'yieldType',
        publicLabel: 'Mjera prinosa',
        controlType: 'select',
        pageLevel: true,
        inline: true,
        options: [
            { value: 'perField', label: 'Po polju' },
            { value: 'perPlant', label: 'Po biljci' },
        ],
    },
    {
        entityTypeName: 'plant',
        fieldKey: 'plant.clean-harvest',
        sectionKey: 'harvest',
        category: 'attributes',
        name: 'cleanHarvest',
        publicLabel: 'Uklanjanje biljke nakon berbe',
        controlType: 'boolean',
        pageLevel: true,
        inline: true,
    },
    ...communityEditablePlantOperationFields,
    {
        entityTypeName: 'plantSort',
        fieldKey: 'plant-sort.name',
        sectionKey: 'overview',
        category: 'information',
        name: 'name',
        publicLabel: 'Naziv sorte',
        controlType: 'text',
        pageLevel: true,
        inline: true,
        maxLength: 200,
    },
    {
        entityTypeName: 'plantSort',
        fieldKey: 'plant-sort.latin-name',
        sectionKey: 'overview',
        category: 'information',
        name: 'latinName',
        publicLabel: 'Latinski naziv sorte',
        controlType: 'text',
        pageLevel: true,
        inline: true,
        maxLength: 200,
    },
    {
        entityTypeName: 'plantSort',
        fieldKey: 'plant-sort.origin',
        sectionKey: 'overview',
        category: 'information',
        name: 'origin',
        publicLabel: 'Porijeklo sorte',
        controlType: 'text',
        pageLevel: true,
        inline: true,
        maxLength: 500,
    },
    {
        entityTypeName: 'plantSort',
        fieldKey: 'plant-sort.short-description',
        sectionKey: 'overview',
        category: 'information',
        name: 'shortDescription',
        publicLabel: 'Kratki opis sorte',
        controlType: 'text',
        pageLevel: true,
        inline: true,
        maxLength: 500,
    },
    {
        entityTypeName: 'plantSort',
        fieldKey: 'plant-sort.description',
        sectionKey: 'overview',
        category: 'information',
        name: 'description',
        publicLabel: 'Opis sorte',
        controlType: 'markdown',
        pageLevel: true,
        inline: true,
        maxLength: 12000,
    },
    {
        entityTypeName: 'plantSort',
        fieldKey: 'plant-sort.sowing',
        sectionKey: 'sowing',
        category: 'information',
        name: 'sowing',
        publicLabel: 'Sjetva sorte',
        controlType: 'markdown',
        pageLevel: true,
        inline: true,
        maxLength: 16000,
    },
    {
        entityTypeName: 'plantSort',
        fieldKey: 'plant-sort.growth',
        sectionKey: 'growth',
        category: 'information',
        name: 'growth',
        publicLabel: 'Rast sorte',
        controlType: 'markdown',
        pageLevel: true,
        inline: true,
        maxLength: 16000,
    },
    {
        entityTypeName: 'plantSort',
        fieldKey: 'plant-sort.watering',
        sectionKey: 'watering',
        category: 'information',
        name: 'watering',
        publicLabel: 'Zalijevanje sorte',
        controlType: 'markdown',
        pageLevel: true,
        inline: true,
        maxLength: 16000,
    },
    {
        entityTypeName: 'plantSort',
        fieldKey: 'plant-sort.harvest',
        sectionKey: 'harvest',
        category: 'information',
        name: 'harvest',
        publicLabel: 'Berba sorte',
        controlType: 'markdown',
        pageLevel: true,
        inline: true,
        maxLength: 16000,
    },
    {
        entityTypeName: 'operation',
        fieldKey: 'operation.label',
        sectionKey: 'overview',
        category: 'information',
        name: 'label',
        publicLabel: 'Naziv radnje',
        controlType: 'text',
        pageLevel: true,
        inline: true,
        maxLength: 200,
    },
    {
        entityTypeName: 'operation',
        fieldKey: 'operation.short-description',
        sectionKey: 'overview',
        category: 'information',
        name: 'shortDescription',
        publicLabel: 'Kratki opis radnje',
        controlType: 'text',
        pageLevel: true,
        inline: true,
        maxLength: 500,
    },
    {
        entityTypeName: 'operation',
        fieldKey: 'operation.description',
        sectionKey: 'description',
        category: 'information',
        name: 'description',
        publicLabel: 'Opis radnje',
        controlType: 'markdown',
        pageLevel: true,
        inline: true,
        maxLength: 20000,
    },
    {
        entityTypeName: 'operation',
        fieldKey: 'operation.instructions',
        sectionKey: 'instructions',
        category: 'information',
        name: 'instructions',
        publicLabel: 'Postupak',
        controlType: 'markdown',
        pageLevel: true,
        inline: true,
        maxLength: 20000,
    },
    {
        entityTypeName: 'operation',
        fieldKey: 'operation.duration',
        sectionKey: 'attributes',
        category: 'attributes',
        name: 'duration',
        publicLabel: 'Trajanje',
        helpText: 'Prosječno vrijeme izvođenja u minutama.',
        controlType: 'number',
        pageLevel: true,
        inline: true,
    },
    {
        entityTypeName: 'operation',
        fieldKey: 'operation.application',
        sectionKey: 'attributes',
        category: 'attributes',
        name: 'application',
        publicLabel: 'Primjena',
        helpText: 'Na čemu se radnja izvodi.',
        controlType: 'select',
        pageLevel: true,
        inline: true,
        options: [
            { value: 'farm', label: 'Farma' },
            { value: 'garden', label: 'Vrt' },
            { value: 'raisedBedFull', label: 'Cijela gredica' },
            { value: 'raisedBed1m', label: 'Gredica 1 m²' },
            { value: 'plant', label: 'Biljka' },
        ],
    },
    {
        entityTypeName: 'operation',
        fieldKey: 'operation.frequency',
        sectionKey: 'attributes',
        category: 'attributes',
        name: 'frequency',
        publicLabel: 'Učestalost',
        helpText: 'Javni savjet o učestalosti izvođenja radnje.',
        controlType: 'reference',
        pageLevel: true,
        inline: true,
    },
    {
        entityTypeName: 'operation',
        fieldKey: 'operation.stage',
        sectionKey: 'attributes',
        category: 'attributes',
        name: 'stage',
        publicLabel: 'Stadij',
        helpText: 'Preporučeni stadij biljke za izvođenje radnje.',
        controlType: 'reference',
        pageLevel: true,
        inline: true,
    },
    {
        entityTypeName: 'block',
        fieldKey: 'block.short-description',
        sectionKey: 'overview',
        category: 'information',
        name: 'shortDescription',
        publicLabel: 'Kratki opis bloka',
        controlType: 'text',
        pageLevel: true,
        inline: true,
        maxLength: 500,
    },
    {
        entityTypeName: 'block',
        fieldKey: 'block.full-description',
        sectionKey: 'description',
        category: 'information',
        name: 'fullDescription',
        publicLabel: 'Opis bloka',
        controlType: 'markdown',
        pageLevel: true,
        inline: true,
        maxLength: 20000,
    },
    {
        entityTypeName: 'block',
        fieldKey: 'block.height',
        sectionKey: 'attributes',
        category: 'attributes',
        name: 'height',
        publicLabel: 'Visina',
        helpText: 'Vrijednost u metrima.',
        controlType: 'number',
        pageLevel: true,
        inline: true,
    },
    {
        entityTypeName: 'block',
        fieldKey: 'block.stackable',
        sectionKey: 'attributes',
        category: 'attributes',
        name: 'stackable',
        publicLabel: 'Slaganje',
        controlType: 'boolean',
        pageLevel: true,
        inline: true,
    },
    {
        entityTypeName: 'block',
        fieldKey: 'block.placeable-on-water',
        sectionKey: 'attributes',
        category: 'attributes',
        name: 'placeableOnWater',
        publicLabel: 'Postavljanje na vodu',
        helpText: 'Dopušta postavljanje bloka izravno na vodeni blok.',
        controlType: 'boolean',
        pageLevel: true,
        inline: true,
    },
];

export function getCommunityEditableFieldDefinitions(
    entityTypeName: string,
    sectionKey?: string | null,
) {
    return communityEditableFieldRegistry.filter(
        (field) =>
            field.entityTypeName === entityTypeName &&
            (!sectionKey || field.sectionKey === sectionKey),
    );
}

export function getCommunityEditableFieldDefinition(
    entityTypeName: string,
    fieldKey: string,
) {
    return communityEditableFieldRegistry.find(
        (field) =>
            field.entityTypeName === entityTypeName &&
            field.fieldKey === fieldKey,
    );
}

export function getCommunityEditableSections(entityTypeName: string) {
    const sections = new Map<string, CommunityEditableFieldDefinition[]>();
    for (const field of getCommunityEditableFieldDefinitions(entityTypeName)) {
        const sectionFields = sections.get(field.sectionKey) ?? [];
        sectionFields.push(field);
        sections.set(field.sectionKey, sectionFields);
    }

    return Array.from(sections.entries()).map(
        ([key, fields]): CommunityEditableSection => ({
            key,
            label: communityEditableSectionLabel(key),
            fields,
        }),
    );
}

export function communityEditableSectionLabel(sectionKey: string) {
    switch (sectionKey) {
        case 'attributes':
            return 'Svojstva';
        case 'description':
            return 'Opis';
        case 'growth':
            return 'Rast';
        case 'harvest':
            return 'Berba';
        case 'instructions':
            return 'Postupak';
        case 'overview':
            return 'Pregled';
        case 'sowing':
            return 'Sjetva';
        case 'watering':
            return 'Zalijevanje';
        default:
            return sectionKey;
    }
}
