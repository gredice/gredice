export const gardenOverview2DPath = '/pregled-vrta';

export type GardenViewMode = '2d' | '3d';

export function getGardenViewModeHref(
    currentMode: GardenViewMode,
    searchParams: Iterable<[string, string]>,
) {
    const targetPath = currentMode === '2d' ? '/' : gardenOverview2DPath;
    const query = new URLSearchParams(Array.from(searchParams)).toString();

    return `${targetPath}${query ? `?${query}` : ''}`;
}
