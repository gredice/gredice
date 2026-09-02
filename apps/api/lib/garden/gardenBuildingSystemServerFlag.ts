export const gardenBuildingSystemServerFlagName =
    'GREDICE_GARDEN_BUILDING_SYSTEM_ENABLED';
export const gardenBuildingSystemCommercialFlagName =
    'GREDICE_GARDEN_BUILDING_COMMERCIAL_ENABLED';

export function parseGardenBuildingSystemServerFlag(value: string | undefined) {
    return value === 'true';
}

export function isGardenBuildingSystemServerEnabled() {
    return parseGardenBuildingSystemServerFlag(
        process.env[gardenBuildingSystemServerFlagName],
    );
}

export function isGardenBuildingSystemCommercialEnabled() {
    return parseGardenBuildingSystemServerFlag(
        process.env[gardenBuildingSystemCommercialFlagName],
    );
}

export function getGardenBuildingSystemAvailability(isSandbox: boolean) {
    const systemEnabled = isGardenBuildingSystemServerEnabled();
    const commercialEnabled = isGardenBuildingSystemCommercialEnabled();

    return {
        enabled: systemEnabled && (isSandbox || commercialEnabled),
    };
}
