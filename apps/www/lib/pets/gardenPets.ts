export type GardenPet = {
    /** URL and anchor identifier used on the pets page. */
    slug: string;
    /** Croatian display name of the animal. */
    name: string;
    /** Genitive form of the name, used in Croatian sentences and alt texts. */
    genitive: string;
    /** Name of the block that brings the animal into the garden. */
    homeBlockName: string;
    /** Whether this block is the animal itself instead of a separate home. */
    directlyPlaceable?: boolean;
    /** Sound the animal makes in the garden. */
    sound: string;
    shortDescription: string;
    fullDescription: string;
    /** Everyday behaviours the animal shows in the garden. */
    habits: readonly string[];
    /** How far from home the animal wanders during the day, in blocks. */
    dayRangeBlocks: number;
    /** What the animal does at night. */
    nightRoutine: string;
    /** What the animal does when the weather turns bad. */
    weatherRoutine: string;
    /** Extra terms matched by the block search field. */
    searchTerms: readonly string[];
};

export const gardenPets = [
    {
        slug: 'zec',
        name: 'Zec',
        genitive: 'zeca',
        homeBlockName: 'Rabbit',
        directlyPlaceable: true,
        sound: 'Njušk!',
        shortDescription:
            'Znatiželjni zec koji skakuće, njuška, uređuje krzno i kratko pase.',
        fullDescription:
            'Zec skakuće u kratkim naletima pa zastaje kako bi osluškivao vrt i njuškao okolinu. Sjeda, uređuje krzno i povremeno kratko gricka travu. Kad mu se avatar previše približi, brzo se udalji sigurnom rutom koja obilazi prepreke.',
        habits: [
            'Skakuće u kratkim naletima s mirnim stankama',
            'Njuška i neovisno okreće ili trza ušima',
            'Sjeda i uređuje krzno',
            'Kratko gricka travu',
            'Brzo se udalji od avatara obilazeći prepreke',
        ],
        dayRangeBlocks: 5.5,
        nightRoutine:
            'Nastavlja skakutati u kratkim naletima unutar svojeg sigurnog raspona.',
        weatherRoutine:
            'Nastavlja svoju mirnu rutinu samo po sigurnom, prohodnom tlu.',
        searchTerms: ['zecic', 'kunić', 'kunic', 'rabbit'],
    },
    {
        slug: 'pas',
        name: 'Pas',
        genitive: 'psa',
        homeBlockName: 'DogHouse',
        sound: 'Vau!',
        shortDescription:
            'Veseli čuvar vrta koji obilazi svaki kutak i juri za pticama.',
        fullDescription:
            'Pas je najradoznaliji stanovnik vrta. Danju obilazi široki krug oko svoje kućice, provjerava staze i gredice, juri za pticama i rado zadirkuje mačku kad je sretne. Popne se na klupu ili niski blok da bolje vidi okolicu, a kad se spusti mrak vraća se na spavanje u kućicu.',
        habits: [
            'Provjerava staze i gredice po cijelom vrtu',
            'Juri za pticama koje slete u vrt',
            'Zadirkuje mačku kad se sretnu na stazi',
            'Penje se na klupe i niske blokove',
        ],
        dayRangeBlocks: 10.5,
        nightRoutine: 'Vraća se u kućicu i ostaje blizu nje.',
        weatherRoutine:
            'Po kiši, snijegu i jakom vjetru traži zaklon, kao i za najjačeg podnevnog sunca.',
        searchTerms: ['psic', 'kuca', 'pseca kucica'],
    },
    {
        slug: 'macka',
        name: 'Mačka',
        genitive: 'mačke',
        homeBlockName: 'CatPillow',
        sound: 'Mijau!',
        shortDescription:
            'Tiha lovkinja koja vreba ptice i najradije drijema na svom jastuku.',
        fullDescription:
            'Mačka se kreće mirnije i bliže domu od psa. Voli povišena mjesta pa se rado smjesti na niski blok s kojeg ima pregled nad vrtom, odatle vreba ptice i povremeno provocira psa. Kad joj dosadi, vraća se na jastuk i sklupča se na počinak.',
        habits: [
            'Vreba ptice iz prikrajka',
            'Voli povišene i niske blokove s kojih ima pregled',
            'Zadirkuje psa kad se sretnu',
            'Drijema na svom jastuku',
        ],
        dayRangeBlocks: 7.5,
        nightRoutine: 'Drži se uz jastuk i rijetko se udaljava.',
        weatherRoutine:
            'Prva bježi pod zaklon čim padne kiša ili zapuše jači vjetar.',
        searchTerms: ['macji jastuk', 'jastuk'],
    },
    {
        slug: 'kokos',
        name: 'Kokoš',
        genitive: 'kokoši',
        homeBlockName: 'ChickenCoop',
        sound: 'Kokoda!',
        shortDescription:
            'Znatiželjna kokoš koja cijeli dan kljuca i istražuje oko kokošinjca.',
        fullDescription:
            'Kokoš najviše vremena provodi tražeći hranu po zemlji oko kokošinjca. Između dvije potrage rado se okupa u prašini pa nastavi kljucati dalje. Ne udaljava se previše od doma i pred mrak se sama vraća u kokošinjac.',
        habits: [
            'Najviše vremena provodi tražeći hranu po zemlji',
            'Kupa se u prašini',
            'Ostaje u blizini kokošinjca',
        ],
        dayRangeBlocks: 5.5,
        nightRoutine: 'Vraća se u kokošinjac i tamo prenoći.',
        weatherRoutine:
            'Već na slabijoj kiši prekida potragu i sklanja se u kokošinjac.',
        searchTerms: ['kokoska', 'kokosinjac', 'perad'],
    },
    {
        slug: 'prascic',
        name: 'Praščić',
        genitive: 'praščića',
        homeBlockName: 'PigletPen',
        sound: 'Grok-grok!',
        shortDescription:
            'Razigrani praščić koji rije po zemlji i valja se u kaljuži.',
        fullDescription:
            'Praščić njuškom rije po zemlji u potrazi za nečim zanimljivim, a kad se umori odlazi se valjati u kaljužu pokraj obora. Kiša mu ne smeta jednako kao ostalima pa vani ostaje i kad drugi već potraže zaklon.',
        habits: [
            'Rije po zemlji njuškom',
            'Valja se u kaljuži pokraj obora',
            'Ostaje vani i po slabijoj kiši',
        ],
        dayRangeBlocks: 7,
        nightRoutine: 'Vraća se u obor na počinak.',
        weatherRoutine:
            'Podnosi više kiše od ostalih ljubimaca, ali se pred nevremenom povlači u obor.',
        searchTerms: ['prase', 'obor', 'svinja'],
    },
] as const satisfies readonly GardenPet[];
