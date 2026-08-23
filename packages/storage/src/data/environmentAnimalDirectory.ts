export const environmentAnimalEntityTypeName = 'environmentAnimal';

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
