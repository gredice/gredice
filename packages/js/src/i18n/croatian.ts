/**
 * Croatian pluralization utilities
 */

/**
 * Formats delivery count in Croatian with proper pluralization
 * @param count - Number of deliveries
 * @param includeVerb - Whether to include the verb form (bila je/bile su/bilo je)
 * @returns Formatted string in Croatian
 */
export function formatDeliveryCount(
    count: number,
    includeVerb = false,
): string {
    const noun = getDeliveryNoun(count);

    if (!includeVerb) {
        return `${count} ${noun}`;
    }

    const verb = getDeliveryVerb(count);
    return `${verb} ${count} ${noun}`;
}

/**
 * Gets the correct Croatian noun form for "dostava" based on count
 */
function getDeliveryNoun(count: number): string {
    if (count === 1) {
        return 'dostava';
    }

    if (count >= 2 && count <= 4) {
        return 'dostave';
    }

    return 'dostava';
}

/**
 * Gets the correct Croatian verb form for deliveries based on count
 */
function getDeliveryVerb(count: number): string {
    if (count === 1) {
        return 'bila je';
    }

    if (count >= 2 && count <= 4) {
        return 'bile su';
    }

    return 'bilo je';
}
