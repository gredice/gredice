import { resolveCloudShadowOvercast } from '../../cloudShadowAttenuation';
import type { WeatherFrame } from '../WeatherFrameContext';
import { resolveCloudDrift } from '../windClass';

/**
 * The cloud drift of a weather frame (`resolveCloudDrift`). The band clouds,
 * the overcast deck and the cloud shadows all read it, so they move the
 * same way on screen at every turn of the view.
 */
export function resolveWeatherCloudDrift({
    amounts,
    reducedMotion,
    view,
}: Pick<WeatherFrame, 'amounts' | 'reducedMotion' | 'view'>) {
    return resolveCloudDrift({
        overcast: resolveCloudShadowOvercast(amounts.cloudy),
        reducedMotion,
        right: view?.basis.right,
        windClass: amounts.windClass,
        windDirection: amounts.windDirection,
    });
}
