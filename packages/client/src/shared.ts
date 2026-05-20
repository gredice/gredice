export function getServerGrediceApiOrigin() {
    const configuredApiHost = process.env.GREDICE_API_HOST?.trim();
    if (configuredApiHost) {
        return configuredApiHost.replace(/\/+$/, '');
    }

    const isDevelopment =
        process.env.NODE_ENV === 'development' ||
        process.env.VERCEL_ENV === 'development' ||
        process.env.NEXT_PUBLIC_VERCEL_ENV === 'development';
    return isDevelopment ? 'http://localhost:3005' : 'https://api.gredice.com';
}

export function getAppUrl() {
    // Check if we're in a browser environment
    const isBrowser = typeof window !== 'undefined';

    if (isBrowser) {
        // Client-side: use relative path to proxy through Next.js app
        // This enables cookie-based auth and prevents tokens in URLs
        return '/api/gredice';
    }

    // Server-side: use direct API URL
    if (
        process.env.NODE_ENV === 'development' ||
        process.env.VERCEL_ENV === 'development'
    ) {
        const configuredApiHost = process.env.GREDICE_API_HOST?.trim();
        if (configuredApiHost) {
            return configuredApiHost.replace(/\/+$/, '');
        }

        return 'https://api.gredice.test';
    }
    return 'https://api.gredice.com';
}

/**
 * Creates a development-safe fetch function that disables SSL verification
 * for self-signed certificates in development environments.
 */
export function createDevSafeFetch(): typeof fetch {
    const runtimeProcess = typeof process !== 'undefined' ? process : undefined;
    // In development, disable SSL verification to handle self-signed certificates
    const isDevEnvironment =
        runtimeProcess?.env.NODE_ENV === 'development' ||
        runtimeProcess?.env.VERCEL_ENV === 'development';

    // Check if we're running server-side (Node.js environment)
    const isServerSide = typeof runtimeProcess?.versions?.node !== 'undefined';

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
