export const environmentAnimalEntityTypeName = 'environmentAnimal';

export const environmentAnimalSquirrelCategories = [
    { name: 'information', label: 'Informacije', order: 'a' },
    { name: 'habitat', label: 'Stanište', order: 'b' },
    { name: 'spawning', label: 'Pojavljivanje', order: 'c' },
    { name: 'lifecycle', label: 'Životni ciklus', order: 'd' },
] as const;

export const environmentAnimalSquirrelDefinitions = [
    {
        category: 'information',
        name: 'name',
        label: 'Naziv',
        description: 'Stabilni programski naziv životinje okoliša.',
        dataType: 'text',
        display: true,
        required: true,
        order: 'a',
    },
    {
        category: 'information',
        name: 'label',
        label: 'Naziv za prikaz',
        description: 'Hrvatski naziv životinje u korisničkom sučelju.',
        dataType: 'text',
        display: true,
        required: true,
        order: 'b',
    },
    {
        category: 'information',
        name: 'shortDescription',
        label: 'Kratki opis',
        description: 'Sažeti opis za kartice i popise direktorija.',
        dataType: 'text',
        display: true,
        required: true,
        order: 'c',
    },
    {
        category: 'information',
        name: 'fullDescription',
        label: 'Opis',
        description: 'Prošireni opis ponašanja i uloge životinje u vrtu.',
        dataType: 'markdown',
        display: true,
        required: true,
        order: 'd',
    },
    {
        category: 'habitat',
        name: 'requiredBlockNames',
        label: 'Prikladna stabla',
        description:
            'Imena blokova koji stvaraju prikladno drvenasto stanište.',
        dataType: 'json',
        display: true,
        required: true,
        order: 'a',
    },
    {
        category: 'habitat',
        name: 'minimumReachableGroundCells',
        label: 'Najmanje prohodnih polja',
        description:
            'Najmanji broj sigurnih povezanih polja potreban za pojavu.',
        dataType: 'number',
        display: true,
        required: true,
        order: 'b',
    },
    {
        category: 'spawning',
        name: 'maxPerGarden',
        label: 'Najviše po vrtu',
        description: 'Gornja granica istodobno prisutnih jedinki u vrtu.',
        dataType: 'number',
        display: true,
        required: true,
        order: 'a',
    },
    {
        category: 'spawning',
        name: 'maxPerHabitat',
        label: 'Najviše po staništu',
        description:
            'Gornja granica istodobno prisutnih jedinki uz jedno stablo.',
        dataType: 'number',
        display: true,
        required: true,
        order: 'b',
    },
    {
        category: 'spawning',
        name: 'cooldownSeconds',
        label: 'Odgoda ponovne pojave',
        description: 'Najkraća odgoda nakon nestanka prije ponovne pojave.',
        dataType: 'number',
        display: true,
        required: true,
        order: 'c',
    },
    {
        category: 'lifecycle',
        name: 'environmentSpawned',
        label: 'Pojavljuje se iz okoliša',
        description:
            'Životinja se pojavljuje automatski iz prikladnog staništa.',
        dataType: 'boolean',
        display: true,
        required: true,
        order: 'a',
    },
    {
        category: 'lifecycle',
        name: 'purchasable',
        label: 'Može se kupiti',
        description: 'Određuje je li životinja dostupna u izborniku Ljubimci.',
        dataType: 'boolean',
        display: true,
        required: true,
        order: 'b',
    },
    {
        category: 'lifecycle',
        name: 'persistence',
        label: 'Trajnost',
        description: 'Način čuvanja prisutnosti životinje između prikaza vrta.',
        dataType: 'text',
        display: true,
        required: true,
        order: 'c',
    },
    {
        category: 'lifecycle',
        name: 'treeExitMode',
        label: 'Odlazak prema stablu',
        description: 'Siguran vizualni način nestanka na tlu uz stablo.',
        dataType: 'text',
        display: true,
        required: true,
        order: 'd',
    },
] as const;

export const environmentAnimalSquirrelSpec = {
    name: 'Squirrel',
    attributes: {
        'information.name': 'Squirrel',
        'information.label': 'Vjeverica',
        'information.shortDescription':
            'Oprezna vrtna vjeverica koja se pojavljuje samo uz prikladna stabla.',
        'information.fullDescription':
            'Vjeverica sama dolazi u vrt s dovoljno sigurnog tla i prikladnim stablom. Trčkara, kratko poskakuje, uspravno osluškuje i njuška tlo, a kad joj se posjetitelj previše približi, sigurnom rutom bježi prema stablu.',
        'habitat.requiredBlockNames': JSON.stringify([
            'Tree',
            'Pine',
            'PineAdvent',
            'DeadTreeTall',
        ]),
        'habitat.minimumReachableGroundCells': '3',
        'spawning.maxPerGarden': '2',
        'spawning.maxPerHabitat': '1',
        'spawning.cooldownSeconds': '45',
        'lifecycle.environmentSpawned': 'true',
        'lifecycle.purchasable': 'false',
        'lifecycle.persistence': 'seeded-ephemeral',
        'lifecycle.treeExitMode': 'grounded-tree-edge-despawn',
    },
} as const;

export function parseEnvironmentAnimalSquirrelOptions(argv: string[]) {
    let apply = false;
    for (const argument of argv) {
        if (argument === '--') {
            continue;
        }
        if (argument === '--apply') {
            apply = true;
            continue;
        }
        throw new Error(`Unknown argument: ${argument}`);
    }
    return { apply };
}

export function environmentAnimalAttributePath({
    category,
    name,
}: {
    category: string;
    name: string;
}) {
    return `${category}.${name}`;
}
