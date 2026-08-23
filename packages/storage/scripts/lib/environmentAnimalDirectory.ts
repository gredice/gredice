export const environmentAnimalEntityType = {
    icon: 'PawPrint',
    isRoot: true,
    label: 'Životinje u okolišu',
    name: 'environment-animal',
    order: 'environment-animal',
} as const;

export const environmentAnimalCategories = [
    { label: 'Osnovne informacije', name: 'information', order: 'a' },
    { label: 'Dostupnost', name: 'availability', order: 'b' },
    { label: 'Model', name: 'model', order: 'c' },
    { label: 'Aktivnost', name: 'activity', order: 'd' },
    { label: 'Stanište', name: 'habitat', order: 'e' },
    { label: 'Vrijeme', name: 'weather', order: 'f' },
    { label: 'Populacija', name: 'population', order: 'g' },
] as const;

function definition({
    category,
    dataType,
    description,
    display = false,
    label,
    name,
    order,
    required = false,
}: {
    category: (typeof environmentAnimalCategories)[number]['name'];
    dataType: 'boolean' | 'markdown' | 'number' | 'text';
    description: string;
    display?: boolean;
    label: string;
    name: string;
    order: string;
    required?: boolean;
}) {
    return {
        category,
        dataType,
        defaultValue: null,
        description,
        display,
        entityTypeName: environmentAnimalEntityType.name,
        label,
        multiple: false,
        name,
        order,
        required,
        unit: null,
    };
}

export const environmentAnimalDefinitions = [
    definition({
        category: 'information',
        dataType: 'text',
        description: 'Stabilni tehnički naziv životinje u okolišu.',
        display: false,
        label: 'Naziv',
        name: 'name',
        order: 'a',
        required: true,
    }),
    definition({
        category: 'information',
        dataType: 'text',
        description: 'Naziv životinje prikazan korisniku.',
        display: true,
        label: 'Naziv za prikaz',
        name: 'label',
        order: 'b',
        required: true,
    }),
    definition({
        category: 'information',
        dataType: 'text',
        description: 'Kratki opis ponašanja životinje u vrtu.',
        display: true,
        label: 'Kratki opis',
        name: 'shortDescription',
        order: 'c',
        required: true,
    }),
    definition({
        category: 'information',
        dataType: 'markdown',
        description: 'Opis uvjeta u kojima se životinja pojavljuje.',
        display: true,
        label: 'Opis',
        name: 'fullDescription',
        order: 'd',
        required: true,
    }),
    definition({
        category: 'availability',
        dataType: 'boolean',
        description: 'Može li se životinja kupiti u vrtnom izborniku.',
        label: 'Može se kupiti',
        name: 'purchasable',
        order: 'a',
        required: true,
    }),
    definition({
        category: 'availability',
        dataType: 'boolean',
        description: 'Može li korisnik postaviti životinju kao vrtni blok.',
        label: 'Može se postaviti',
        name: 'placeable',
        order: 'b',
        required: true,
    }),
    definition({
        category: 'model',
        dataType: 'text',
        description: 'Naziv modela u registru imovine igre.',
        label: 'Model',
        name: 'assetName',
        order: 'a',
        required: true,
    }),
    definition({
        category: 'activity',
        dataType: 'text',
        description: 'Sažeti naziv vremenskog razdoblja aktivnosti.',
        label: 'Razdoblje',
        name: 'period',
        order: 'a',
        required: true,
    }),
    definition({
        category: 'activity',
        dataType: 'number',
        description: 'Kraj jutarnje aktivnosti kao udio dana od 0 do 1.',
        label: 'Kraj zore',
        name: 'dawnEnd',
        order: 'b',
        required: true,
    }),
    definition({
        category: 'activity',
        dataType: 'number',
        description: 'Početak večernje aktivnosti kao udio dana od 0 do 1.',
        label: 'Početak sumraka',
        name: 'duskStart',
        order: 'c',
        required: true,
    }),
    definition({
        category: 'habitat',
        dataType: 'text',
        description: 'Prirodni elementi vrta koji pružaju zaklon.',
        label: 'Zaklon',
        name: 'cover',
        order: 'a',
        required: true,
    }),
    definition({
        category: 'habitat',
        dataType: 'number',
        description: 'Najmanji broj vrtnih polja potreban za pojavljivanje.',
        label: 'Najmanja površina',
        name: 'minimumCells',
        order: 'b',
        required: true,
    }),
    ...[
        ['maxFog', 'Najveća magla', 'Najveći dopušteni intenzitet magle.'],
        ['maxRain', 'Najveća kiša', 'Najveći dopušteni intenzitet kiše.'],
        ['maxSnow', 'Najveći snijeg', 'Najveći dopušteni intenzitet snijega.'],
        [
            'maxThunder',
            'Najveća grmljavina',
            'Najveći dopušteni intenzitet grmljavine.',
        ],
        [
            'maxWindSpeed',
            'Najveća brzina vjetra',
            'Najveća dopuštena brzina vjetra.',
        ],
    ].map(([name, label, description], index) =>
        definition({
            category: 'weather',
            dataType: 'number',
            description,
            label,
            name,
            order: String.fromCharCode(97 + index),
            required: true,
        }),
    ),
    ...[
        ['maxPerGroup', 'Najviše u skupini'],
        ['maxGroupsPerScene', 'Najviše skupina u sceni'],
        ['maxPerScene', 'Najviše u sceni'],
        ['maxGlobal', 'Najviše ukupno'],
    ].map(([name, label], index) =>
        definition({
            category: 'population',
            dataType: 'number',
            description: `${label} u jednom pokrenutom prikazu igre.`,
            label,
            name,
            order: String.fromCharCode(97 + index),
            required: true,
        }),
    ),
] as const;

export const batEnvironmentAnimal = {
    attributes: {
        'activity.dawnEnd': '0.27',
        'activity.duskStart': '0.73',
        'activity.period': 'sumrak i noć',
        'availability.placeable': 'false',
        'availability.purchasable': 'false',
        'habitat.cover': 'stablo, bor, grm ili suho stablo',
        'habitat.minimumCells': '16',
        'information.fullDescription':
            'Šišmiš je noćni posjetitelj prikladnih vrtova. Izlazi iz zaklona u sumrak, kruži iznad krošnji i traži kukce kada nema jače kiše, snijega, grmljavine, guste magle ni snažnog vjetra. Danju se vraća u zaklon i nije vidljiv. Ne kupuje se niti postavlja iz vrtnog izbornika.',
        'information.label': 'Šišmiš',
        'information.name': 'Bat',
        'information.shortDescription':
            'Noćni posjetitelj koji u prikladnom vrtu kruži iznad krošnji i traži kukce.',
        'model.assetName': 'Bat',
        'population.maxGlobal': '6',
        'population.maxGroupsPerScene': '2',
        'population.maxPerGroup': '2',
        'population.maxPerScene': '3',
        'weather.maxFog': '0.68',
        'weather.maxRain': '0.12',
        'weather.maxSnow': '0.08',
        'weather.maxThunder': '0.08',
        'weather.maxWindSpeed': '7',
    },
    name: 'Bat',
} as const;

export function environmentAnimalDefinitionPath({
    category,
    name,
}: {
    category: string;
    name: string;
}) {
    return `${category}.${name}`;
}
