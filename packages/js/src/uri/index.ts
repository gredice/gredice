export function decodeUriComponentSafe(value: string) {
    try {
        return decodeURIComponent(value);
    } catch (error) {
        console.error('Failed to decode URI component', error);
        return value;
    }
}

/**
 * Decodes URL percent-encoding and common HTML entities found in route params.
 */
export function decodeRouteParam(value: string) {
    const decodedParam = decodeUriComponentSafe(value);

    return decodedParam.replaceAll(
        /&(?:amp|apos|quot);|&#(?:39|x27);/gi,
        (entity) => {
            const normalizedEntity = entity.toLowerCase();
            switch (normalizedEntity) {
                case '&amp;':
                    return '&';
                case '&apos;':
                case '&#39;':
                case '&#x27;':
                    return "'";
                case '&quot;':
                    return '"';
                default:
                    return entity;
            }
        },
    );
}
