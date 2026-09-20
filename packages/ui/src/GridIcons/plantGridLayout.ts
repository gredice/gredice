/** Exact planting layout; invalid counts never become a misleading one-plant icon. */
export function plantGridLayout(totalPlants: number) {
    if (!Number.isSafeInteger(totalPlants) || totalPlants < 0) return null;

    const columns = Math.max(1, Math.ceil(Math.sqrt(totalPlants)));
    return {
        columns,
        fullRows: Math.floor(totalPlants / columns),
        lastRowPlants: totalPlants % columns,
    };
}
