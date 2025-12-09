/**
 * Utility functions for generating URLs to the garden game
 */

/**
 * Gets the base URL for the garden game based on the environment
 * - Production: https://vrt.gredice.com
 * - Development: https://vrt.gredice.test
 */
function getGardenBaseUrl(): string {
    // Check if we're in a browser environment
    if (
        typeof window !== 'undefined' &&
        window.location?.hostname?.includes('.test')
    ) {
        // Use .test domain if current hostname includes .test
        return 'https://vrt.gredice.test';
    }

    // Check environment variable (for server-side rendering or Node.js)
    if (
        typeof process !== 'undefined' &&
        (process.env?.VERCEL_ENV === 'development' ||
            process.env?.VERCEL_ENV === 'preview' ||
            process.env?.NEXT_PUBLIC_ENVIRONMENT === 'development' ||
            process.env?.NODE_ENV === 'development')
    ) {
        return 'https://vrt.gredice.test';
    }

    // Default to production
    return 'https://vrt.gredice.com';
}

/**
 * Generates a URL to view a raised bed in closeup mode in the garden game
 * @param raisedBedName - The name of the raised bed
 * @returns The full URL with the gredica query parameter
 * @example
 * getRaisedBedCloseupUrl('Moja gredica') // => 'https://vrt.gredice.com?gredica=Moja%20gredica'
 */
export function getRaisedBedCloseupUrl(raisedBedName: string): string {
    if (!raisedBedName || !raisedBedName.trim()) {
        return getGardenBaseUrl();
    }
    return `${getGardenBaseUrl()}?gredica=${encodeURIComponent(raisedBedName)}`;
}
