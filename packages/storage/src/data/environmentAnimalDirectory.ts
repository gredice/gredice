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
