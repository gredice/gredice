import { getStoredAccessToken } from './auth/tokenStore';

export function getAppUrl() {
    // Check if we're in a browser environment
    const isBrowser = typeof window !== 'undefined';

    if (isBrowser) {
        // Client-side: use relative path to proxy through Next.js app
        // This enables cookie-based auth and prevents tokens in URLs
        return '/api/gredice';
    }

    // Server-side: use direct API URL
    if (process.env.NEXT_PUBLIC_VERCEL_ENV === 'development') {
        return 'https://api.gredice.test';
    }
    return 'https://api.gredice.com';
}

export function getAuthToken() {
    return getStoredAccessToken();
}

export function getAuthHeaders() {
    if (typeof localStorage === 'undefined') {
        return null;
    }

    return `Bearer ${getAuthToken()}`;
}

/**
 * Creates a development-safe fetch function that disables SSL verification
 * for self-signed certificates in development environments.
 */
export function createDevSafeFetch(): typeof fetch {
    // In development, disable SSL verification to handle self-signed certificates
    const isDevEnvironment =
        process.env.NODE_ENV === 'development' ||
        process.env.NEXT_PUBLIC_VERCEL_ENV === 'development';

    // Check if we're running server-side (Node.js environment)
    const isServerSide = typeof process?.versions?.node !== 'undefined';

    if (isDevEnvironment && isServerSide) {
        // Server-side in development: create custom fetch that ignores SSL errors
        return async (input, init) => {
            // Store original environment variable
            const originalRejectUnauthorized =
                process.env.NODE_TLS_REJECT_UNAUTHORIZED;

            try {
                // Temporarily disable SSL certificate verification
                process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

                const response = await fetch(input, init);
                return response;
            } finally {
                // Restore original setting
                if (originalRejectUnauthorized !== undefined) {
                    process.env.NODE_TLS_REJECT_UNAUTHORIZED =
                        originalRejectUnauthorized;
                } else {
                    delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
                }
            }
        };
    }

    return fetch;
}
