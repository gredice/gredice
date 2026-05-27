import { isNightOnlyBlockName } from '@gredice/js/blocks';
import SunCalc from 'suncalc';

const DEFAULT_LOCATION = { lat: 45.739, lon: 16.572 };

type GardenLocation = {
    lat: number | null | undefined;
    lon: number | null | undefined;
};

function resolveLocation(location: GardenLocation | null | undefined) {
    const lat = location?.lat;
    const lon = location?.lon;

    if (
        typeof lat === 'number' &&
        Number.isFinite(lat) &&
        typeof lon === 'number' &&
        Number.isFinite(lon)
    ) {
        return { lat, lon };
    }

    return DEFAULT_LOCATION;
}

function isNightAtLocation(
    location: GardenLocation | null | undefined,
    currentTime: Date,
) {
    const { lat, lon } = resolveLocation(location);
    const { sunrise: sunriseStart, sunset: sunsetStart } = SunCalc.getTimes(
        currentTime,
        lat,
        lon,
    );

    return currentTime <= sunriseStart || currentTime >= sunsetStart;
}

export function isBlockPurchaseAvailableNow({
    blockName,
    currentTime = new Date(),
    location,
}: {
    blockName: string;
    currentTime?: Date;
    location?: GardenLocation | null;
}) {
    if (!isNightOnlyBlockName(blockName)) {
        return true;
    }

    return isNightAtLocation(location, currentTime);
}
