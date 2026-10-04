export const environmentAnimalTypeCategory = {
    icon: 'trees',
    label: 'Okoliš',
    name: 'environment',
    order: 'y',
} as const;

export const environmentAnimalType = {
    icon: 'snail',
    label: 'Životinje okoliša',
    name: 'environmentAnimal',
    order: 'ya',
} as const;

export const environmentAnimalAttributeCategories = [
    { label: 'Informacije', name: 'information', order: 'a' },
    { label: 'Ekologija i pojavljivanje', name: 'ecology', order: 'b' },
    { label: 'Ponašanje', name: 'behavior', order: 'c' },
] as const;

export const environmentAnimalAttributeDefinitions = [
    {
        category: 'information',
        dataType: 'text',
        description: 'Stabilni tehnički naziv životinje okoliša.',
        display: false,
        label: 'Naziv',
        name: 'name',
        order: 'aa',
        required: true,
    },
    {
        category: 'information',
        dataType: 'text',
        description: 'Naziv prikazan korisnicima.',
        display: true,
        label: 'Naziv za prikaz',
        name: 'label',
        order: 'ab',
        required: true,
    },
    {
        category: 'information',
        dataType: 'text',
        description: 'Kratki opis za sažeta mjesta u imeniku.',
        display: true,
        label: 'Kratki opis',
        name: 'shortDescription',
        order: 'ac',
        required: true,
    },
    {
        category: 'information',
        dataType: 'text',
        description: 'Potpuni opis životinje i njezine uloge u vrtu.',
        display: true,
        label: 'Opis',
        name: 'fullDescription',
        order: 'ad',
        required: true,
    },
    {
        category: 'ecology',
        dataType: 'text',
        description:
            'Izvor pojavljivanja; nije predmet kupnje ni postavljanja.',
        display: true,
        label: 'Način pojavljivanja',
        name: 'spawnMode',
        order: 'ba',
        required: true,
    },
    {
        category: 'ecology',
        dataType: 'boolean',
        description: 'Može li se životinja kupiti ili odabrati kao blok.',
        display: true,
        label: 'Može se kupiti',
        name: 'purchasable',
        order: 'bb',
        required: true,
    },
    {
        category: 'ecology',
        dataType: 'text',
        description: 'Uvjeti koji povećavaju prikladnost staništa.',
        display: true,
        label: 'Poželjni uvjeti',
        name: 'preferredConditions',
        order: 'bc',
        required: true,
    },
    {
        category: 'ecology',
        dataType: 'text',
        description: 'Uvjeti i površine na kojima se životinja ne pojavljuje.',
        display: true,
        label: 'Neprikladni uvjeti',
        name: 'avoidedConditions',
        order: 'bd',
        required: true,
    },
    {
        category: 'ecology',
        dataType: 'number',
        description: 'Najveći broj jedinki u jednom vrtu.',
        display: true,
        label: 'Najviše u vrtu',
        name: 'maxGardenPopulation',
        order: 'be',
        required: true,
    },
    {
        category: 'ecology',
        dataType: 'number',
        description: 'Najveći broj jedinki unutar lokalnog radijusa.',
        display: true,
        label: 'Najviše lokalno',
        name: 'maxLocalPopulation',
        order: 'bf',
        required: true,
    },
    {
        category: 'ecology',
        dataType: 'number',
        description: 'Radijus u vrtnim poljima za lokalno ograničenje.',
        display: false,
        label: 'Lokalni radijus',
        name: 'localPopulationRadius',
        order: 'bg',
        required: true,
    },
    {
        category: 'ecology',
        dataType: 'number',
        description:
            'Najveći broj ravnomjerno raspoređenih stanišnih ćelija rangiranih za pojavljivanje.',
        display: false,
        label: 'Budžet kandidata pojavljivanja',
        name: 'spawnCandidateBudget',
        order: 'bh',
        required: true,
    },
    {
        category: 'ecology',
        dataType: 'number',
        description: 'Sigurnosna stanka prije ponovnog pojavljivanja.',
        display: false,
        label: 'Stanka ponovnog pojavljivanja',
        name: 'spawnCooldownSeconds',
        order: 'bi',
        required: true,
        unit: 's',
    },
    {
        category: 'ecology',
        dataType: 'boolean',
        description: 'Smije li ponašanje mijenjati ili oštetiti biljke.',
        display: true,
        label: 'Šteti biljkama',
        name: 'harmsPlants',
        order: 'bj',
        required: true,
    },
    {
        category: 'behavior',
        dataType: 'text',
        description: 'Način kretanja vidljiv u vrtu.',
        display: true,
        label: 'Kretanje',
        name: 'locomotion',
        order: 'ca',
        required: true,
    },
    {
        category: 'behavior',
        dataType: 'text',
        description: 'Stanja animacije i ponašanja dostupna životinji.',
        display: true,
        label: 'Stanja',
        name: 'states',
        order: 'cb',
        required: true,
    },
] as const;

export const slugEnvironmentAnimal = {
    name: 'Slug',
    state: 'published',
    values: {
        'behavior.locomotion':
            'Vrlo sporo puzanje uz valovito gibanje tijela, klizanje stopala i pomicanje ticala.',
        'behavior.states':
            'Pojavljivanje, mirovanje, puzanje, traženje vlage, hranjenje bez utjecaja na biljke i sigurno nestajanje.',
        'ecology.avoidedConditions':
            'Suho, vruće i izloženo tlo, pijesak, kamen, šljunak, snijeg, staze, voda te zauzeta ili blokirana polja.',
        'ecology.harmsPlants': 'false',
        'ecology.localPopulationRadius': '3',
        'ecology.maxGardenPopulation': '4',
        'ecology.maxLocalPopulation': '2',
        'ecology.preferredConditions':
            'Vlažno tlo, kiša ili zadržana površinska vlaga, hlad i blizina prikladnih biljaka.',
        'ecology.purchasable': 'false',
        'ecology.spawnCandidateBudget': '96',
        'ecology.spawnCooldownSeconds': '45',
        'ecology.spawnMode': 'environment',
        'information.fullDescription':
            'Puž golać prirodno se pojavljuje u vlažnim i sjenovitim dijelovima vrta. Polako istražuje sigurne površine, zastaje i traži vlagu, ali ne oštećuje biljke i nije dostupan za kupnju ili postavljanje.',
        'information.label': 'Puž golać',
        'information.name': 'Slug',
        'information.shortDescription':
            'Tihi stanovnik vlažnih i sjenovitih dijelova vrta.',
    },
} as const;

export function environmentAnimalAttributePath({
    category,
    name,
}: {
    category: string;
    name: string;
}) {
    return `${category}.${name}`;
}
