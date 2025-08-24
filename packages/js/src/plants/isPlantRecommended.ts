/**
 * Helper to determine if a plant is recommended for the current month
 * @param plant - The plant object containing calendar information
 * @property {Object} [plant.calendar] - The calendar object for the plant
 * @property {Object[]} [plant.calendar.sowing] - Array of sowing periods
 * @property {Object[]} [plant.calendar.propagating] - Array of propagating periods
 * @property {number} [plant.calendar.sowing[].start] - Start month for sowing
 * @property {number} [plant.calendar.sowing[].end] - End month for sowing
 * @property {number} [plant.calendar.propagating[].start] - Start month for propagating
 * @property {number} [plant.calendar.propagating[].end] - End month for propagating
 * @returns {boolean} - True if the plant is recommended for the current month, false otherwise
 */
export function isPlantRecommended(plant: {
    calendar?: {
        sowing?: { start?: number; end?: number }[];
        propagating?: { start?: number; end?: number }[];
    };
}): boolean {
    const now = new Date();
    const month = now.getMonth() + 1; // JS months are 0-based
    const calendar = plant.calendar;
    if (!calendar) return false;
    // Check sowing
    if (
        calendar.sowing?.some(
            (period) =>
                period.start &&
                period.end &&
                month >= period.start &&
                month <= period.end,
        )
    ) {
        return true;
    }
    // Check planting
    if (
        calendar.propagating?.some(
            (period) =>
                period.start &&
                period.end &&
                month >= period.start &&
                month <= period.end,
        )
    ) {
        return true;
    }
    return false;
}
