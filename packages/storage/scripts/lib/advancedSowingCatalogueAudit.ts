import {
    type AdvancedSowingBedGeometryInput,
    getAdvancedSowingLayoutOptions,
} from '@gredice/js/plants';

export type AdvancedSowingCatalogueAuditPlant = {
    attributes?: Record<string, unknown> | null;
    id: number;
    name?: string | null;
};

export type AdvancedSowingCatalogueAuditFindingCode =
    | 'invalid_distance_range'
    | 'invalid_distance_value'
    | 'missing_optimal_distance'
    | 'unsupported_bed_geometry';

export type AdvancedSowingCatalogueAuditFinding = {
    code: AdvancedSowingCatalogueAuditFindingCode;
    message: string;
    plantId: number;
    plantName: string;
};

export type AdvancedSowingCatalogueAuditPlantResult = {
    layoutOptionCount: number;
    plantId: number;
    plantName: string;
};

export type AdvancedSowingCatalogueAuditResult = {
    configuredPlantCount: number;
    findings: AdvancedSowingCatalogueAuditFinding[];
    publishedPlantCount: number;
    supportedPlants: AdvancedSowingCatalogueAuditPlantResult[];
};

function plantLabel(plant: AdvancedSowingCatalogueAuditPlant) {
    return plant.name?.trim() || `Plant #${plant.id.toString()}`;
}

function hasConfiguredBound(attributes: Record<string, unknown>) {
    return (
        (attributes.seedingDistanceMin !== null &&
            attributes.seedingDistanceMin !== undefined) ||
        (attributes.seedingDistanceMax !== null &&
            attributes.seedingDistanceMax !== undefined)
    );
}

function optionalDistance(
    attributes: Record<string, unknown>,
    key: 'seedingDistanceMax' | 'seedingDistanceMin',
) {
    const value = attributes[key];
    if (value === null || value === undefined) {
        return null;
    }
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new TypeError(`${key} must be a finite number.`);
    }
    return value;
}

function finding(
    plant: AdvancedSowingCatalogueAuditPlant,
    code: AdvancedSowingCatalogueAuditFindingCode,
    message: string,
): AdvancedSowingCatalogueAuditFinding {
    return {
        code,
        message,
        plantId: plant.id,
        plantName: plantLabel(plant),
    };
}

/**
 * Audits published catalogue values without changing them. A plant opts into
 * Advanced Sowing only when at least one optional distance bound is present.
 */
export function auditAdvancedSowingCatalogue(
    plants: readonly AdvancedSowingCatalogueAuditPlant[],
    geometry?: AdvancedSowingBedGeometryInput,
): AdvancedSowingCatalogueAuditResult {
    const findings: AdvancedSowingCatalogueAuditFinding[] = [];
    const supportedPlants: AdvancedSowingCatalogueAuditPlantResult[] = [];
    let configuredPlantCount = 0;

    for (const plant of plants) {
        const attributes = plant.attributes ?? {};
        if (!hasConfiguredBound(attributes)) {
            continue;
        }
        configuredPlantCount += 1;

        const optimalDistanceCm = attributes.seedingDistance;
        if (optimalDistanceCm === null || optimalDistanceCm === undefined) {
            findings.push(
                finding(
                    plant,
                    'missing_optimal_distance',
                    'Configured Advanced Sowing bounds require seedingDistance.',
                ),
            );
            continue;
        }
        if (
            typeof optimalDistanceCm !== 'number' ||
            !Number.isFinite(optimalDistanceCm)
        ) {
            findings.push(
                finding(
                    plant,
                    'invalid_distance_value',
                    'seedingDistance must be a finite number.',
                ),
            );
            continue;
        }

        let minDistanceCm: number | null;
        let maxDistanceCm: number | null;
        try {
            minDistanceCm = optionalDistance(attributes, 'seedingDistanceMin');
            maxDistanceCm = optionalDistance(attributes, 'seedingDistanceMax');
        } catch (error) {
            findings.push(
                finding(
                    plant,
                    'invalid_distance_value',
                    error instanceof Error
                        ? error.message
                        : 'Advanced Sowing distance must be numeric.',
                ),
            );
            continue;
        }

        try {
            const options = getAdvancedSowingLayoutOptions(
                {
                    maxDistanceCm,
                    minDistanceCm,
                    optimalDistanceCm,
                },
                geometry,
            );
            supportedPlants.push({
                layoutOptionCount: options.length,
                plantId: plant.id,
                plantName: plantLabel(plant),
            });
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'Advanced Sowing configuration is invalid.';
            findings.push(
                finding(
                    plant,
                    message.includes('unsupported by the raised bed geometry')
                        ? 'unsupported_bed_geometry'
                        : 'invalid_distance_range',
                    message,
                ),
            );
        }
    }

    return {
        configuredPlantCount,
        findings: findings.sort(
            (left, right) =>
                left.plantId - right.plantId ||
                left.code.localeCompare(right.code),
        ),
        publishedPlantCount: plants.length,
        supportedPlants: supportedPlants.sort(
            (left, right) => left.plantId - right.plantId,
        ),
    };
}
