export const environmentAnimalEntityTypeName = 'environmentAnimal';

export const batEnvironmentAnimal = {
    name: 'Bat',
    attributes: {
        'activity.dawnEnd': '0.27',
        'activity.duskStart': '0.73',
        'behavior.animationStates': 'Bat_Flap,Bat_Glide,Bat_Roost',
        'behavior.avatarReaction': 'gentle-flight-avoidance',
        'behavior.cropImpact': 'neutralan-koristan',
        'behavior.movement':
            'Kruži i traži kukce iznad krošnji uz promjene visine, naginjanje u zavojima i povremeno jedrenje. Putanju unaprijed provjerava kroz prostor te blago izbjegava prepreke, kameru i lika.',
        'behavior.placeable': 'false',
        'behavior.purchasable': 'false',
        'habitat.allowedTerrain': 'Tree,Pine,PineAdvent,Bush,DeadTreeTall',
        'habitat.eligibility': 'najmanje-16-polja-i-prirodni-zaklon',
        'habitat.hosts': 'Stablo, bor, grm ili suho stablo.',
        'habitat.maximumTemperature': '50',
        'habitat.maxWaterDepth': '0',
        'habitat.minimumCells': '16',
        'habitat.minimumTemperature': '-50',
        'habitat.persistence':
            'Od sumraka do zore dok su vrijeme i stanište prikladni; danju je skriven u zaklonu.',
        'habitat.spawnMode': 'environment',
        'habitat.timeOfDay': 'sumrak,noć',
        'information.fullDescription':
            'Šišmiš je noćni posjetitelj prikladnih vrtova. Izlazi iz zaklona u sumrak, kruži iznad krošnji i traži kukce kada nema jače kiše, snijega, grmljavine, guste magle ni snažnog vjetra. Danju se vraća u zaklon i nije vidljiv. Ne kupuje se niti postavlja iz vrtnog izbornika.',
        'information.label': 'Šišmiš',
        'information.name': 'Bat',
        'information.shortDescription':
            'Noćni posjetitelj koji u prikladnom vrtu kruži iznad krošnji i traži kukce.',
        'model.assetName': 'Bat',
        'spawn.cooldownMaxSeconds': '0',
        'spawn.cooldownMinSeconds': '0',
        'spawn.maxGlobal': '6',
        'spawn.maxGroupsPerScene': '2',
        'spawn.maxPopulation': '3',
        'spawn.maxPopulationPerHabitat': '2',
        'weather.maxFog': '0.68',
        'weather.maxRain': '0.12',
        'weather.maxSnow': '0.08',
        'weather.maxThunder': '0.08',
        'weather.maxWindSpeed': '7',
    },
} as const;

export const butterflyWingVariantDirectory = [
    {
        id: 'adriatic-blue',
        label: 'Jadransko plava',
        primary: '#4d8fbd',
        secondary: '#9ccfc5',
        pattern: 'rub i pjege',
    },
    {
        id: 'copper-cream',
        label: 'Bakreno krem',
        primary: '#c66a32',
        secondary: '#edc58f',
        pattern: 'pojas i pjege',
    },
    {
        id: 'plum-gold',
        label: 'Šljiva i zlato',
        primary: '#744b78',
        secondary: '#d7a64a',
        pattern: 'dvostruke pjege',
    },
    {
        id: 'sage-rose',
        label: 'Kadulja i ruža',
        primary: '#799474',
        secondary: '#d8898c',
        pattern: 'rub i pojas',
    },
    {
        id: 'lemon-charcoal',
        label: 'Limun i ugljen',
        primary: '#e9bd3e',
        secondary: '#5d5c57',
        pattern: 'tamni vrhovi',
    },
    {
        id: 'sky-coral',
        label: 'Nebo i koralj',
        primary: '#74add0',
        secondary: '#dd7d68',
        pattern: 'pojas i vanjske pjege',
    },
    {
        id: 'terracotta-mint',
        label: 'Terakota i metvica',
        primary: '#b65d3f',
        secondary: '#87b9a0',
        pattern: 'svijetli rub',
    },
    {
        id: 'violet-ivory',
        label: 'Ljubičica i bjelokost',
        primary: '#765a9a',
        secondary: '#e7d7b7',
        pattern: 'unutarnje i vanjske pjege',
    },
] as const;

export const butterflyEnvironmentAnimalAttributeSpecs = [
    {
        category: 'habitat',
        dataType: 'text',
        display: false,
        label: 'Vremenski uvjeti',
        name: 'weatherLimits',
        order: 'bj',
        required: false,
    },
    {
        category: 'spawn',
        dataType: 'number',
        display: false,
        label: 'Najkraći posjet',
        name: 'lifetimeMinSeconds',
        order: 'ce',
        required: false,
        unit: 's',
    },
    {
        category: 'spawn',
        dataType: 'number',
        display: false,
        label: 'Najduži posjet',
        name: 'lifetimeMaxSeconds',
        order: 'cf',
        required: false,
        unit: 's',
    },
    {
        category: 'behavior',
        dataType: 'boolean',
        display: true,
        label: 'Vidljivo u Ljubimcima',
        name: 'petPickerVisible',
        order: 'df',
        required: false,
    },
    {
        category: 'appearance',
        dataType: 'text',
        display: true,
        label: '3D model',
        name: 'modelName',
        order: 'ea',
        required: false,
    },
    {
        category: 'appearance',
        dataType: 'text',
        display: true,
        label: 'Varijante krila',
        name: 'wingVariants',
        order: 'eb',
        required: false,
    },
] as const;

export const butterflyEnvironmentAnimal = {
    name: 'Butterfly',
    attributes: {
        'appearance.modelName': 'Butterfly',
        'appearance.wingVariants': JSON.stringify(
            butterflyWingVariantDirectory,
        ),
        'behavior.animationStates':
            'meandering,approaching,landing,resting,taking-off,departing',
        'behavior.avatarReaction':
            'Nježno se udaljava od lika i po potrebi ranije polijeće.',
        'behavior.cropImpact': 'none',
        'behavior.movement':
            'Vijugavi let s promjenjivim zamahom krila, naginjanjem, prilaskom cvijetu, slijetanjem, odmorom sklopljenih ili lagano pomičnih krila, polijetanjem i odlaskom iz vrta.',
        'behavior.petPickerVisible': 'false',
        'behavior.purchasable': 'false',
        'habitat.allowedTerrain':
            'Sigurna zračna putanja; slijetanje samo na važeći cvjetni cilj iznad prohodnog tla',
        'habitat.eligibility':
            'Rascvjetane biljke, dnevno svjetlo i mirno vrijeme',
        'habitat.hosts': 'Rascvjetane biljke i cvjetni ukrasi',
        'habitat.maximumTemperature': '35',
        'habitat.maxWaterDepth': '0',
        'habitat.minimumTemperature': '12',
        'habitat.persistence': 'environment-ephemeral',
        'habitat.spawnMode': 'environment',
        'habitat.timeOfDay': 'daylight:0.29-0.74',
        'habitat.weatherLimits':
            'cloudCover<=0.52; rain/fog/snow/thunder<=0.06; windSpeed<=1.35',
        'information.fullDescription':
            'Leptiri sami dolaze u vrt kada ima cvijeća, dovoljno dnevnog svjetla i mirnog vremena. Lebde između cvjetova, kratko slijeću i odmaraju sklopljenih krila, a zatim nastavljaju svoj put. Ne kupuju se i ne pojavljuju se u biraču Ljubimci.',
        'information.label': 'Leptir',
        'information.name': 'Butterfly',
        'information.shortDescription':
            'Nježni oprašivač koji za lijepa dana prirodno posjećuje rascvjetane biljke.',
        'spawn.cooldownMaxSeconds': '14',
        'spawn.cooldownMinSeconds': '14',
        'spawn.lifetimeMaxSeconds': '112',
        'spawn.lifetimeMinSeconds': '68',
        'spawn.maxPopulation': '6',
        'spawn.maxPopulationPerHabitat': '2',
    },
} as const;

export const ladybugEnvironmentAnimal = {
    name: 'Ladybug',
    attributes: {
        'behavior.animationStates':
            'crawl,pause,wing-opening,takeoff,flight,landing,despawn',
        'behavior.avatarReaction': 'safe-relocation-or-despawn',
        'behavior.cropImpact': 'none',
        'behavior.movement':
            'Kretanje po biljci, kratko mirovanje i povremeni let do obližnje sigurne površine.',
        'behavior.purchasable': 'false',
        'habitat.allowedTerrain': 'flowering-host-surfaces',
        'habitat.eligibility': 'flowering-host,warm-clear-daytime',
        'habitat.hosts': 'Biljke i kulture u cvatu',
        'habitat.maximumTemperature': '33',
        'habitat.maxWaterDepth': '0',
        'habitat.minimumTemperature': '18',
        'habitat.persistence': 'environment-ephemeral',
        'habitat.spawnMode': 'environment',
        'habitat.timeOfDay': 'warm-daytime',
        'image.cover': JSON.stringify({
            url: 'https://www.gredice.com/assets/environment-animals/Ladybug.webp',
        }),
        'information.fullDescription':
            'Bubamara je mirna posjetiteljica vrta. Za toplog i suhog dana možeš je primijetiti kako zastaje i kreće se po površini biljaka u cvatu, a zatim kratko odleti do obližnje biljke. Ne kupuje se i ne utječe na stanje usjeva.',
        'information.label': 'Bubamara',
        'information.name': 'Ladybug',
        'information.shortDescription':
            'Mala vrtna posjetiteljica koja se za toplih dana pojavljuje na biljkama u cvatu.',
        'spawn.cooldownMaxSeconds': '0',
        'spawn.cooldownMinSeconds': '0',
        'spawn.maxPopulation': '5',
        'spawn.maxPopulationPerHabitat': '2',
    },
} as const;
