import { getBrowserGrediceAppOrigin } from './origins';

export const HARVEST_TRACE_PUBLIC_PATH_PREFIX = '/trag';

export function buildHarvestTracePublicPath(token: string) {
    return `${HARVEST_TRACE_PUBLIC_PATH_PREFIX}/${encodeURIComponent(token)}`;
}

export function buildHarvestTracePublicUrl(
    token: string,
    origin = getBrowserGrediceAppOrigin('www'),
) {
    return new URL(buildHarvestTracePublicPath(token), origin).toString();
}
