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
    if (typeof globalThis !== 'undefined' && 'location' in globalThis) {
        // Use .test domain if current hostname includes .test
        const hostname = (
            globalThis as unknown as { location: { hostname: string } }
        ).location.hostname;
        if (hostname.includes('.test')) {
            return 'https://vrt.gredice.test';
        }
    }

    // Check environment variable (for server-side rendering or Node.js)
    if (
        typeof process !== 'undefined' &&
        process.env?.NODE_ENV === 'development'
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
    return `${getGardenBaseUrl()}?gredica=${encodeURIComponent(raisedBedName)}`;
}
