export const gardenBuildingSystemServerFlagName =
    'GREDICE_GARDEN_BUILDING_SYSTEM_ENABLED';

export function parseGardenBuildingSystemServerFlag(value: string | undefined) {
    return value === 'true';
}

export function isGardenBuildingSystemServerEnabled() {
    return parseGardenBuildingSystemServerFlag(
        process.env[gardenBuildingSystemServerFlagName],
    );
}
