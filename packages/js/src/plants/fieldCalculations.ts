/**
 * Standard field size in centimeters for raised bed calculations.
 * Raised beds are divided into fields of this size for plant spacing calculations.
 */
export const FIELD_SIZE_CM = 30;

/**
 * Field size label for UI display
 */
export const FIELD_SIZE_LABEL = `${FIELD_SIZE_CM}x${FIELD_SIZE_CM} cm`;

/**
 * Calculates the number of plants that can fit in a field based on seeding distance.
 * @param seedingDistance - Distance between plants in centimeters
 * @returns Number of plants per row and total plants in the field
 */
export function calculatePlantsPerField(seedingDistance?: number | null) {
    const distance = seedingDistance ?? FIELD_SIZE_CM;
    let plantsPerRow = Math.floor(FIELD_SIZE_CM / distance);

    if (plantsPerRow < 1) {
        console.warn(
            `Plants per row is less than 1 (${plantsPerRow}) for seeding distance ${distance}cm. Setting to 1.`,
        );
        plantsPerRow = 1;
    }

    const totalPlants = plantsPerRow * plantsPerRow;

    return {
        plantsPerRow,
        totalPlants,
    };
}
