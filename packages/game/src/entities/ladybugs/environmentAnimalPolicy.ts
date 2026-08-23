const environmentAnimalEntityNames = new Set(['Ladybug']);

export function isEnvironmentAnimalEntityName(name: string) {
    return environmentAnimalEntityNames.has(name);
}

export function isUserPlaceableEntityName(name: string) {
    return !isEnvironmentAnimalEntityName(name);
}
