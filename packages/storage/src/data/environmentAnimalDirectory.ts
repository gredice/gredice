export const environmentAnimalEntityTypeName = 'environmentAnimal';

export const ladybugEnvironmentAnimal = {
    name: 'Ladybug',
    attributes: {
        'behavior.cropImpact': 'none',
        'behavior.movement':
            'Kretanje po biljci, kratko mirovanje i povremeni let do obližnje sigurne površine.',
        'behavior.purchasable': 'false',
        'habitat.hosts': 'Biljke i kulture u cvatu',
        'habitat.maximumTemperature': '33',
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
    },
} as const;
